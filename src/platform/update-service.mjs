import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// A public binary feed can be hosted anywhere over HTTPS; no paid service or token is needed.
// GitHub's releases API also works when the release repository is public.
export const DEFAULT_UPDATE_FEED_URL='https://api.github.com/repos/nutricionistaalmeidavh-spec/Almoxarifado/releases/latest';
const VERSION=/^v?(\d+)\.(\d+)\.(\d+)$/;
const SHA256=/^[a-f0-9]{64}$/i;
const MAX_INSTALLER_BYTES=600*1024*1024;

export function compareVersions(a,b){
  const left=VERSION.exec(String(a)),right=VERSION.exec(String(b));
  if(!left||!right)throw new TypeError('Invalid version: expected major.minor.patch');
  for(let i=1;i<=3;i++){
    const difference=Number(left[i])-Number(right[i]);
    if(difference)return Math.sign(difference);
  }
  return 0;
}
function httpsUrl(value,suffix){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||!url.hostname)return false;
    return !suffix||url.pathname.toLowerCase().endsWith(suffix);
  }catch{return false;}
}
function validUpdate(candidate){
  if(!candidate||typeof candidate!=='object'||!VERSION.test(String(candidate.version)))throw Error('Invalid update version');
  if(!httpsUrl(candidate.downloadUrl,'.exe'))throw Error('Invalid HTTPS installer URL');
  if(!SHA256.test(String(candidate.sha256)))throw Error('Missing SHA-256 installer digest');
  const size=Number(candidate.size);
  if(!Number.isSafeInteger(size)||size<1||size>MAX_INSTALLER_BYTES)throw Error('Invalid installer size');
  return {version:String(candidate.version).replace(/^v/,''),downloadUrl:candidate.downloadUrl,sha256:candidate.sha256.toLowerCase(),size,notes:String(candidate.notes||'').slice(0,500)};
}
function githubAsset(release){
  const version=String(release.tag_name||'').replace(/^v/,'');
  const asset=release.assets.find(a=>a.name===`ArtiSys-Almoxarifado-Setup-${version}.exe`);
  if(!asset)throw Error('No Windows installer in this release');
  const digest=String(asset.digest||'').match(/^sha256:([a-f0-9]{64})$/i)?.[1];
  return {asset,digest};
}
async function fetchJson(url,fetchImpl,signal){
  if(!httpsUrl(url))throw Error('Non-HTTPS update feed');
  const response=await fetchImpl(url,{headers:{accept:'application/vnd.github+json, application/json','user-agent':'ArtiSys-Almoxarifado-Updater'},signal,redirect:'follow'});
  if(!response.ok||!httpsUrl(response.url||url))throw Error('Update feed unavailable');
  return response.json();
}
export async function checkForUpdate({currentVersion,feedUrl=DEFAULT_UPDATE_FEED_URL,fetchImpl=fetch,timeoutMs=8000}={}){
  try{
    if(!VERSION.test(String(currentVersion)))return {status:'unavailable'};
    const signal=AbortSignal.timeout(timeoutMs);
    const source=await fetchJson(feedUrl,fetchImpl,signal);
    let candidate;
    if(Array.isArray(source?.assets)&&source?.tag_name){
      if(source.draft||source.prerelease)return {status:'current'};
      const {asset,digest}=githubAsset(source);
      let sha256=digest;
      if(!sha256){
        const manifestAsset=source.assets.find(a=>a.name==='release-manifest.json');
        if(!manifestAsset)throw Error('Release is missing SHA-256');
        const manifest=await fetchJson(manifestAsset.browser_download_url,fetchImpl,signal);
        if(manifest.artifact!==asset.name||manifest.version!==String(source.tag_name).replace(/^v/,''))throw Error('Release integrity metadata mismatch');
        sha256=manifest.sha256;
      }
      candidate={version:source.tag_name,downloadUrl:asset.browser_download_url,sha256,size:asset.size,notes:source.body};
    }else candidate=source;
    const update=validUpdate(candidate);
    if(compareVersions(update.version,currentVersion)<=0)return {status:'current',version:update.version};
    return {status:'available',...update};
  }catch{return {status:'unavailable'};}
}
export async function downloadVerifiedInstaller(update,{destinationDir,fetchImpl=fetch,timeoutMs=180_000}={}){
  const candidate=validUpdate(update);
  if(!destinationDir)throw new TypeError('destinationDir is required');
  await mkdir(destinationDir,{recursive:true});
  const filename=`ArtiSys-Almoxarifado-Setup-${candidate.version}.exe`;
  const target=path.join(destinationDir,filename);
  const partial=`${target}.${process.pid}.${Date.now()}.part`;
  let total=0;
  const hash=createHash('sha256');
  try{
    const response=await fetchImpl(candidate.downloadUrl,{headers:{'user-agent':'ArtiSys-Almoxarifado-Updater'},signal:AbortSignal.timeout(timeoutMs),redirect:'follow'});
    if(!response.ok||!response.body||!httpsUrl(response.url||candidate.downloadUrl))throw Error('Falha ao baixar instalador por HTTPS');
    const verifier=new Transform({transform(chunk,encoding,callback){
      total+=chunk.length;
      if(total>MAX_INSTALLER_BYTES||total>candidate.size)return callback(new Error('Tamanho do instalador excedido'));
      hash.update(chunk);
      callback(null,chunk);
    }});
    await pipeline(Readable.fromWeb(response.body),verifier,createWriteStream(partial,{flags:'wx'}));
    if(total!==candidate.size)throw Error('Tamanho do instalador divergente');
    if(hash.digest('hex')!==candidate.sha256)throw Error('SHA-256 do instalador divergente');
    await rm(target,{force:true});
    await rename(partial,target);
    return target;
  }catch(error){await rm(partial,{force:true});throw error;}
}
