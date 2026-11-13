import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkForUpdate, compareVersions, downloadVerifiedInstaller } from '../src/platform/update-service.mjs';

const sha=(data)=>createHash('sha256').update(data).digest('hex');
const feed=(version,data='installer')=>({version,downloadUrl:'https://updates.example.org/ArtiSys-Almoxarifado-Setup-'+version+'.exe',sha256:sha(data),size:Buffer.byteLength(data)});
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

test('numeric version comparison handles 1.10 > 1.9',()=>{
  assert.equal(compareVersions('1.10.0','1.9.9'),1);
  assert.equal(compareVersions('v1.0.0','1.0.0'),0);
  assert.equal(compareVersions('1.0.1','1.1.0'),-1);
  assert.throws(()=>compareVersions('1.2-beta','1.2.0'),/version/i);
});

test('startup feed shows only newer verified releases',async()=>{
  const args={currentVersion:'1.0.0',feedUrl:'https://updates.example.org/latest.json',fetchImpl:async()=>respond(feed('1.0.1'))};
  assert.equal((await checkForUpdate(args)).status,'available');
  assert.equal((await checkForUpdate({...args,currentVersion:'1.0.1'})).status,'current');
  assert.equal((await checkForUpdate({...args,currentVersion:'1.1.0'})).status,'current');
});

test('offline, private 404, missing hash or insecure url fail safely',async()=>{
  const args={currentVersion:'1.0.0',feedUrl:'https://updates.example.org/latest.json'};
  assert.equal((await checkForUpdate({...args,fetchImpl:async()=>{throw Error('offline');}})).status,'unavailable');
  assert.equal((await checkForUpdate({...args,fetchImpl:async()=>respond({},404)})).status,'unavailable');
  assert.equal((await checkForUpdate({...args,fetchImpl:async()=>respond({...feed('1.0.1'),sha256:''})})).status,'unavailable');
  assert.equal((await checkForUpdate({...args,fetchImpl:async()=>respond({...feed('1.0.1'),downloadUrl:'http://evil.example/installer.exe'})})).status,'unavailable');
});

test('supports public GitHub Releases with SHA-256 asset digest',async()=>{
  const hash=sha('installer');
  const release={tag_name:'v1.0.2',assets:[{name:'ArtiSys-Almoxarifado-Setup-1.0.2.exe',browser_download_url:'https://github.com/example/releases/download/v1.0.2/ArtiSys-Almoxarifado-Setup-1.0.2.exe',size:9,digest:'sha256:'+hash}]};
  const result=await checkForUpdate({currentVersion:'1.0.0',feedUrl:'https://api.github.com/repos/example/repo/releases/latest',fetchImpl:async()=>respond(release)});
  assert.equal(result.status,'available');
  assert.equal(result.sha256,hash);
});

test('verified download rejects mismatched SHA-256 and deletes partial files',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'almox-updates-test-'));
  try{
    const info={...feed('1.0.1'),status:'available'};
    const fetchImpl=async()=>new Response(Buffer.from('installer'));
    const file=await downloadVerifiedInstaller(info,{destinationDir:dir,fetchImpl});
    assert.equal((await readFile(file)).toString(),'installer');
    await assert.rejects(()=>downloadVerifiedInstaller({...info,sha256:sha('other')},{destinationDir:dir,fetchImpl}),/SHA-256/);
    assert.deepEqual((await readdir(dir)).filter(name=>name.endsWith('.part')),[]);
  }finally{await rm(dir,{recursive:true,force:true});}
});
