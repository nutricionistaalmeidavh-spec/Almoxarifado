import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createFileStockRepository } from '../src/domain/stock/file-repository.mjs';
import { createAuthService, hasPermission } from '../src/domain/auth/auth-service.mjs';
import { createBackupService } from '../src/domain/backup/backup-service.mjs';

test('admin bootstraps once, login creates session and permissions are server-side', () => {
  const repository = createMemoryStockRepository({ users: [{ id:'local-admin', name:'Admin', login:'admin', role:'ADMIN', active:true }] });
  let n=0; const auth=createAuthService({repository,now:()=>1000,tokenFactory:()=>`token-${++n}`,idFactory:()=> 'u2'});
  assert.equal(auth.needsBootstrap(),true); auth.bootstrapAdmin('SenhaForte123'); assert.equal(auth.needsBootstrap(),false);
  assert.throws(()=>auth.bootstrapAdmin('OutraSenha123'),(e)=>e.code==='AUTH_ALREADY_BOOTSTRAPPED');
  const session=auth.authenticate('ADMIN','SenhaForte123'); assert.equal(auth.require(session.token,'users.manage').id,'local-admin');
  const created=auth.createUser(session.token,{name:'Operador',login:'op',role:'ALMOXARIFE',password:'Operador1234'});
  assert.equal('passwordHash' in created,false); assert.equal(hasPermission(repository.getUser(created.id),'stock.create'),true); assert.equal(hasPermission(repository.getUser(created.id),'users.manage'),false);
});

test('invalid credentials throttle after repeated failures',()=>{
  const repository=createMemoryStockRepository({users:[{id:'local-admin',name:'Admin',login:'admin',role:'ADMIN',active:true}]}); let clock=1000; const auth=createAuthService({repository,now:()=>clock}); auth.bootstrapAdmin('SenhaForte123');
  for(let i=0;i<5;i++)assert.throws(()=>auth.authenticate('admin','errada'),(e)=>e.code==='INVALID_CREDENTIALS'); assert.throws(()=>auth.authenticate('admin','SenhaForte123'),(e)=>e.code==='AUTH_THROTTLED'); clock+=61_000; assert.equal(auth.authenticate('admin','SenhaForte123').user.id,'local-admin');
});

test('backup restore is atomic and creates safety backup',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-backup-')); const repository=createFileStockRepository({filePath:path.join(dir,'data.json')}); repository.saveProduct({id:'p1',sku:'P1',name:'Original',unit:'un',active:true});
  const backup=createBackupService({repository,backupDir:path.join(dir,'backups'),now:()=>new Date('2026-09-12T12:00:00Z'),idFactory:()=> 'b1'}); const saved=backup.create('manual'); repository.saveProduct({id:'p1',sku:'P1',name:'Alterado',unit:'un',active:true}); const restored=backup.restore(saved.filePath);
  assert.equal(repository.getProduct('p1').name,'Original'); assert.match(restored.safetyBackup,/backups/); assert.equal(JSON.parse(readFileSync(path.join(dir,'data.json'),'utf8')).products[0].name,'Original');
});
