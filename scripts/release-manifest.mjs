import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function sha256File(filePath){
  const bytes=await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

export async function buildReleaseManifest({artifactPath,version='1.0.0',commit=process.env.GITHUB_SHA||'local',generatedAt=new Date().toISOString()}={}){
  if(typeof artifactPath!=='string'||!artifactPath.trim()) throw new TypeError('artifactPath is required');
  const resolved=path.resolve(artifactPath);
  const info=await stat(resolved);
  if(!info.isFile()) throw new Error(`release artifact is not a file: ${resolved}`);
  const sha256=await sha256File(resolved);
  return {
    product:'ArtiSys Almoxarifado',
    version,
    commit:String(commit||'local'),
    artifact:path.basename(resolved),
    size:info.size,
    sha256,
    generatedAt
  };
}

export async function writeReleaseFiles({artifactPath,version='1.0.0',commit=process.env.GITHUB_SHA||'local',outputDir=path.dirname(path.resolve(artifactPath)),generatedAt=new Date().toISOString()}={}){
  const manifest=await buildReleaseManifest({artifactPath,version,commit,generatedAt});
  const dir=path.resolve(outputDir);
  await mkdir(dir,{recursive:true});
  const sumsPath=path.join(dir,'SHA256SUMS.txt');
  const manifestPath=path.join(dir,'release-manifest.json');
  await writeFile(sumsPath,`${manifest.sha256}  ${manifest.artifact}\n`,'utf8');
  await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`,'utf8');
  return {manifest,sumsPath,manifestPath};
}

const isMain=Boolean(process.argv[1])&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(isMain){
  const artifactPath=process.argv[2]||process.env.RELEASE_ARTIFACT||path.resolve('dist/ArtiSys-Almoxarifado-Setup-1.0.0.exe');
  const result=await writeReleaseFiles({artifactPath,version:process.env.npm_package_version||'1.0.0',commit:process.env.GITHUB_SHA||'local',outputDir:path.dirname(path.resolve(artifactPath))});
  process.stdout.write(`${JSON.stringify(result.manifest,null,2)}\n`);
}
