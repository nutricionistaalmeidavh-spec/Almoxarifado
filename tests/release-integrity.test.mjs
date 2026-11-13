import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildReleaseManifest, writeReleaseFiles } from '../scripts/release-manifest.mjs';

const VERSION='1.0.1';

test('release manifest records artifact size hash version and commit',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'almox-release-'));
  const artifact=path.join(dir,'ArtiSys-Almoxarifado-Setup-1.0.1.exe');
  await writeFile(artifact,Buffer.from('fake-installer'));
  const manifest=await buildReleaseManifest({artifactPath:artifact,version:VERSION,commit:'abc123',generatedAt:'2026-09-12T22:00:00.000Z'});
  assert.equal(manifest.version,VERSION);
  assert.equal(manifest.commit,'abc123');
  assert.equal(manifest.artifact,path.basename(artifact));
  assert.equal(manifest.size,14);
  assert.match(manifest.sha256,/^[a-f0-9]{64}$/);
});

test('release files contain the same hash and manifest',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'almox-release-files-'));
  const artifact=path.join(dir,'ArtiSys-Almoxarifado-Setup-1.0.1.exe');
  await writeFile(artifact,Buffer.from('artifact-bytes'));
  const result=await writeReleaseFiles({artifactPath:artifact,version:VERSION,commit:'def456',outputDir:dir,generatedAt:'2026-09-12T22:00:00.000Z'});
  const sums=await readFile(result.sumsPath,'utf8');
  const parsed=JSON.parse(await readFile(result.manifestPath,'utf8'));
  assert.match(sums,new RegExp(`^${parsed.sha256}  ArtiSys-Almoxarifado-Setup-1\\.0\\.1\\.exe\\n$`));
  assert.equal(parsed.sha256,result.manifest.sha256);
});
