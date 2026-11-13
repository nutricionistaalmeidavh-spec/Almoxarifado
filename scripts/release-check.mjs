import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { sha256File } from './release-manifest.mjs';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const version=process.env.npm_package_version||pkg.version;
const required=process.env.RELEASE_ARTIFACT_REQUIRED==='1';
const artifactPath=path.resolve(process.env.RELEASE_ARTIFACT||`dist/ArtiSys-Almoxarifado-Setup-${version}.exe`);
const distDir=path.dirname(artifactPath),sumsPath=path.join(distDir,'SHA256SUMS.txt'),manifestPath=path.join(distDir,'release-manifest.json');
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`invalid release version: ${version}`);
let artifacts=[];
if(required){
  const artifactInfo=await stat(artifactPath).catch(()=>null);if(!artifactInfo?.isFile())throw new Error(`required installer is missing: ${artifactPath}`);
  const manifest=JSON.parse(await readFile(manifestPath,'utf8').catch(()=>{throw new Error(`release manifest is missing: ${manifestPath}`);}));
  const sums=await readFile(sumsPath,'utf8').catch(()=>{throw new Error(`SHA256SUMS.txt is missing: ${sumsPath}`);});
  const actualHash=await sha256File(artifactPath);
  if(manifest.version!==version)throw new Error(`manifest version mismatch: ${manifest.version}`);
  if(manifest.artifact!==path.basename(artifactPath))throw new Error('manifest artifact name mismatch');
  if(Number(manifest.size)!==artifactInfo.size)throw new Error('manifest artifact size mismatch');
  if(manifest.sha256!==actualHash)throw new Error('manifest SHA-256 mismatch');
  if(!sums.trim().startsWith(`${actualHash}  ${path.basename(artifactPath)}`))throw new Error('SHA256SUMS.txt mismatch');
  if(process.env.GITHUB_SHA&&manifest.commit!==process.env.GITHUB_SHA)throw new Error('manifest commit mismatch');
  artifacts=[artifactPath,sumsPath,manifestPath];
}
const plan={schemaVersion:1,product:'ArtiSys Almoxarifado',version,artifacts,checks:required?['tests','qa','security','installed-smoke','integrity']:['qa','security'],licenseSystem:false,status:'ready'};
process.stdout.write(`${JSON.stringify({required,artifactPath:required?artifactPath:null,plan},null,2)}\n`);
