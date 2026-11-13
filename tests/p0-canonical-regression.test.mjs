import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createSqliteStockRepository } from '../src/domain/stock/sqlite-repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';
import { createPurchasingService } from '../src/domain/purchasing/purchasing-service.mjs';
import { createQualityService } from '../src/domain/quality/quality-service.mjs';
import { buildDashboard } from '../src/domain/reports/report-service.mjs';

const fixture=()=>createMemoryStockRepository({users:[{id:'u1',name:'Almoxarife',role:'ADMIN',active:true}],products:[{id:'p1',sku:'A',name:'Tubo',minStock:5,avgCost:2,active:true}],warehouses:[{id:'w1',name:'A',active:true},{id:'w2',name:'B',active:true}],balances:[{productId:'p1',warehouseId:'w1',quantity:0},{productId:'p1',warehouseId:'w2',quantity:20}]});

test('dashboard flags product requiring replenishment in one warehouse',()=>{
  const repo=fixture();
  assert.equal(buildDashboard(repo).lowStock,1);
});

test('receipt operationKey is idempotent even after order completes',async()=>{
  const repo=fixture();
  repo.saveSupplier({id:'s1',name:'Fornecedor',active:true});
  const stock=createStockService({repository:repo});
  const purchasing=createPurchasingService({repository:repo,stock});
  const request=purchasing.createRequest({warehouseId:'w1',requestedBy:'u1',items:[{productId:'p1',quantity:2}]});
  purchasing.addQuote({requestId:request.id,supplierId:'s1',userId:'u1',items:[{productId:'p1',quantity:2,unitCost:5}]});
  purchasing.approveRequest({requestId:request.id,userId:'u1'});
  const order=purchasing.createOrder({requestId:request.id,supplierId:'s1',userId:'u1'});
  const input={orderId:order.id,userId:'u1',items:[{productId:'p1',quantity:2}],operationKey:'client-123'};
  const first=await purchasing.receiveOrder(input);
  const repeated=await purchasing.receiveOrder(input);
  assert.equal(first.id,repeated.id);
  assert.equal(repo.getBalance('p1','w1'),2);
  assert.equal(repo.listReceipts().length,1);
});

test('quality release rolls back stock entry when hold update fails',async()=>{
  const repo=fixture();
  const stock=createStockService({repository:repo});
  const service=createQualityService({repository:repo,stock});
  const hold=service.holdReceipt({productId:'p1',warehouseId:'w1',quantity:3,userId:'u1',sourceType:'PURCHASE_RECEIPT',sourceId:'r1'});
  const original=repo.saveQualityHold;
  repo.saveQualityHold=()=>{throw Error('disk error');};
  await assert.rejects(service.release({holdId:hold.id,quantity:2,userId:'u1'}),/disk error/);
  repo.saveQualityHold=original;
  assert.equal(repo.getBalance('p1','w1'),0);
  assert.equal(repo.getQualityHold(hold.id).remainingQuantity,3);
});

test('SQLite serializes unrelated async transactions and survives rollback',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-queue-'));
  const repo=createSqliteStockRepository({dbPath:path.join(dir,'stock.sqlite')});
  let unblock;const gate=new Promise(resolve=>{unblock=resolve;});
  let started;const startedPromise=new Promise(resolve=>{started=resolve;});
  const first=repo.transaction(async()=>{
    repo.setBalance('p','main',1);
    started();
    await gate;
    throw Error('failed transaction');
  });
  await startedPromise;
  const second=repo.transaction(async()=>{repo.setBalance('p','main',2);});
  unblock();
  await assert.rejects(first,/failed transaction/);
  await second;
  assert.equal(repo.getBalance('p','main'),2);
  repo.close();rmSync(dir,{recursive:true,force:true});
});
