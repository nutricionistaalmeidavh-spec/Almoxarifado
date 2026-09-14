import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSqliteStockRepository } from '../src/domain/stock/sqlite-repository.mjs';

test('sqlite repository persists entities balances and movements across reopen',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-sqlite-'));
  const dbPath=path.join(dir,'almoxarifado.sqlite');
  const repo=createSqliteStockRepository({dbPath,seed:{warehouses:[{id:'w1',code:'A',name:'A',active:true}],users:[{id:'u1',login:'admin',name:'Admin',role:'ADMIN',active:true}]}});
  repo.saveProduct({id:'p1',sku:'P1',name:'Tubo',unit:'un',active:true});
  repo.setBalance('p1','w1',7);
  repo.addMovement({id:'m1',type:'ENTRY',productId:'p1',warehouseId:'w1',quantity:7,delta:7,before:0,after:7,userId:'u1',occurredAt:'2026-09-14T12:00:00.000Z'});
  repo.close();
  const reopened=createSqliteStockRepository({dbPath});
  assert.equal(reopened.getProduct('p1').name,'Tubo');
  assert.equal(reopened.getBalance('p1','w1'),7);
  assert.equal(reopened.listMovements()[0].id,'m1');
  reopened.close();
  rmSync(dir,{recursive:true,force:true});
});

test('sqlite repository imports legacy json once and preserves migration backup',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-migrate-'));
  const dbPath=path.join(dir,'almoxarifado.sqlite');
  const legacyJsonPath=path.join(dir,'almoxarifado.json');
  writeFileSync(legacyJsonPath,JSON.stringify({products:[{id:'p1',sku:'P1',name:'Legado',unit:'un',active:true}],warehouses:[{id:'w1',code:'A',name:'A',active:true}],users:[{id:'u1',login:'admin',name:'Admin',role:'ADMIN',active:true}],balances:[{productId:'p1',warehouseId:'w1',quantity:3}]}));
  const repo=createSqliteStockRepository({dbPath,legacyJsonPath});
  assert.equal(repo.getProduct('p1').name,'Legado');
  assert.equal(repo.getBalance('p1','w1'),3);
  assert.equal(existsSync(`${legacyJsonPath}.migrated.bak`),true);
  repo.saveProduct({id:'p1',sku:'P1',name:'SQLite',unit:'un',active:true});
  repo.close();
  const reopened=createSqliteStockRepository({dbPath,legacyJsonPath});
  assert.equal(reopened.getProduct('p1').name,'SQLite');
  reopened.close();
  rmSync(dir,{recursive:true,force:true});
});

test('fresh sqlite database preserves default local admin and main warehouse',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-default-'));
  const repo=createSqliteStockRepository({dbPath:path.join(dir,'almoxarifado.sqlite')});
  assert.equal(repo.getWarehouse('main').code,'ALM-01');
  assert.equal(repo.getUser('local-admin').login,'admin');
  repo.close();
  rmSync(dir,{recursive:true,force:true});
});

test('replaceState persists imported backup state after reopening SQLite',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-restore-'));
  const dbPath=path.join(dir,'almoxarifado.sqlite');
  let repo=createSqliteStockRepository({dbPath});
  const state=repo.exportState();
  state.products=[{id:'restored',sku:'REST',name:'Restaurado',unit:'un',active:true}];
  state.balances=[{productId:'restored',warehouseId:'main',quantity:9}];
  repo.replaceState(state);
  repo.close();
  repo=createSqliteStockRepository({dbPath});
  assert.equal(repo.getProduct('restored').name,'Restaurado');
  assert.equal(repo.getBalance('restored','main'),9);
  repo.close();
  rmSync(dir,{recursive:true,force:true});
});
