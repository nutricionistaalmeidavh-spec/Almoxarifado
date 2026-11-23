import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {checkForUpdate,downloadVerifiedInstaller} from '../src/platform/update-service.mjs';

const hash=createHash('sha256').update('installer').digest('hex');
const root='https://github.com/example/repo/releases/download/v2.0.0/';
const name=edition=>'ArtiSys-Almoxarifado-Setup-2.0.0'+(edition?'-Commercial':'')+'.exe';
const asset=edition=>({name:name(edition),browser_download_url:root+name(edition),size:9,digest:'sha256:'+hash});
const fetchFeed=release=>async()=>new Response(JSON.stringify(release),{headers:{'content-type':'application/json'}});

test('comercial nunca instala atualização livre quando release só contém livre',async()=>{
 const release={tag_name:'v2.0.0',assets:[asset(false)]};
 const result=await checkForUpdate({currentVersion:'1.0.2',commercialActivation:true,feedUrl:'https://example.org/commercial/feed.json',fetchImpl:fetchFeed(release)});
 assert.equal(result.status,'unavailable');
});

test('release com as duas edições escolhe o executável correto e preserva SHA256',async()=>{
 const release={tag_name:'v2.0.0',assets:[asset(false),asset(true)]};
 const commercial=await checkForUpdate({currentVersion:'1.0.2',commercialActivation:true,feedUrl:'https://example.org/commercial/feed.json',fetchImpl:fetchFeed(release)});
 const free=await checkForUpdate({currentVersion:'1.0.2',commercialActivation:false,fetchImpl:fetchFeed(release)});
 assert.equal(commercial.status,'available');assert.equal(free.status,'available');
 assert.equal(commercial.commercialActivation,true);assert.equal(free.commercialActivation,false);
 assert.equal(new URL(commercial.downloadUrl).pathname.split('/').at(-1),name(true));
 assert.equal(new URL(free.downloadUrl).pathname.split('/').at(-1),name(false));
 const dir=await mkdtemp(path.join(os.tmpdir(),'almox-edition-update-'));
 try{
  const file=await downloadVerifiedInstaller(commercial,{destinationDir:dir,commercialActivation:true,fetchImpl:async()=>new Response('installer')});
  assert.equal(path.basename(file),name(true));
  assert.equal((await readFile(file)).toString(),'installer');
  await assert.rejects(()=>downloadVerifiedInstaller(free,{destinationDir:dir,commercialActivation:true}),/edição|edition|incompat/i);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('feeds externos e URLs de binários não podem trocar a edição',async()=>{
 const feed={version:'2.0.0',downloadUrl:root+name(false),sha256:hash,size:9};
 assert.equal((await checkForUpdate({currentVersion:'1.0.2',commercialActivation:true,feedUrl:'https://example.org/commercial/feed.json',fetchImpl:fetchFeed(feed)})).status,'unavailable');
 assert.equal((await checkForUpdate({currentVersion:'1.0.2',commercialActivation:false,fetchImpl:fetchFeed({...feed,downloadUrl:root+name(true)})})).status,'unavailable');
});

test('edição comercial sem canal próprio não consulta o feed público',async()=>{
 let calls=0;
 const result=await checkForUpdate({currentVersion:'1.0.2',commercialActivation:true,fetchImpl:async()=>{calls++;return fetchFeed({})();}});
 assert.equal(result.status,'unavailable');
 assert.equal(calls,0);
});
