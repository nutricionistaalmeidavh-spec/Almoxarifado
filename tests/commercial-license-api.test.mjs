import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createFileStockRepository} from '../src/domain/stock/file-repository.mjs';
import {createLocalApi} from '../src/platform/local-api.mjs';
import {createWebServer} from '../src/platform/web-server.mjs';

test('edição comercial bloqueia endpoints operacionais antes de ativar, inclusive primeiro admin',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'almox-commercial-api-'));
 const repository=createFileStockRepository({filePath:path.join(dir,'db.json')});
 let active=false,attempts=0;
 const licenseControl={
  required:true,status:async()=>({required:true,active,offline:false}),
  activate:async({email,code})=>{
   attempts++;
   if(email!=='cliente@example.com'||code!=='123456')
    throw Object.assign(Error('Código inválido'),{status:400});
   active=true;return {required:true,active:true,offline:false};
  }
 };
 const server=createWebServer({host:'127.0.0.1',port:0,apiHandler:createLocalApi({
  repository,backupDir:path.join(dir,'backups'),documentDir:path.join(dir,'documents'),licenseControl
 })});
 await server.start();
 t.after(async()=>{await server.stop();repository.close?.();rmSync(dir,{force:true,recursive:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const post=(route,data)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 const ent=await fetch(base+'/api/license/status');
 assert.deepEqual(await ent.json(),{required:true,active:false,offline:false});
 assert.equal((await fetch(base+'/api/auth/status')).status,423);
 assert.equal((await fetch(base+'/api/bootstrap')).status,423);
 assert.equal((await post('/api/auth/bootstrap',{password:'senha-super-segura'})).status,423);
 assert.equal(attempts,0);
 assert.equal((await post('/api/license/activate',{email:'cliente@example.com',code:'000000'})).status,400);
 assert.equal((await post('/api/license/activate',{email:'cliente@example.com',code:'123456'})).status,200);
 assert.equal((await fetch(base+'/api/auth/status')).status,200);
 const boot=await post('/api/auth/bootstrap',{password:'senha-super-segura'});
 assert.equal(boot.status,201);
 active=false;
 assert.equal((await fetch(base+'/api/auth/me')).status,423);
});

test('edição gratuita informa ativação não necessária e preserva login',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'almox-free-api-'));
 const repository=createFileStockRepository({filePath:path.join(dir,'db.json')});
 const server=createWebServer({host:'127.0.0.1',port:0,apiHandler:createLocalApi({
  repository,backupDir:path.join(dir,'backups'),documentDir:path.join(dir,'documents')
 })});
 await server.start();
 t.after(async()=>{await server.stop();repository.close?.();rmSync(dir,{force:true,recursive:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const response=await fetch(base+'/api/license/status');
 assert.deepEqual(await response.json(),{required:false,active:true,offline:false});
 assert.equal((await fetch(base+'/api/auth/status')).status,200);
});
