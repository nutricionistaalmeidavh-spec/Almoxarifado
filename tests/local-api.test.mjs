import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStockRepository } from '../src/domain/stock/file-repository.mjs';
import { createLocalApi } from '../src/platform/local-api.mjs';
import { createWebServer } from '../src/platform/web-server.mjs';

test('LAN API enforces auth and completes purchase flow locally',async(t)=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-api-'));const repository=createFileStockRepository({filePath:path.join(dir,'data.json')});const server=createWebServer({host:'127.0.0.1',port:0,apiHandler:createLocalApi({repository,backupDir:path.join(dir,'backups')})});await server.start();t.after(()=>server.stop());const base=`http://127.0.0.1:${server.address().port}`;
  let response=await fetch(`${base}/api/bootstrap`);assert.equal(response.status,401);
  const jsonPost=(url,body,token='')=>fetch(`${base}${url}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  response=await jsonPost('/api/auth/bootstrap',{password:'SenhaForte123'});assert.equal(response.status,201);
  response=await jsonPost('/api/auth/login',{login:'admin',password:'SenhaForte123'});const token=(await response.json()).token;assert.ok(token);
  const post=async(url,body)=>{const r=await jsonPost(url,body,token);const j=await r.json();assert.equal(r.ok,true,JSON.stringify(j));return j;};
  const supplier=(await post('/api/catalog/suppliers',{name:'Fornecedor'})).item;const product=(await post('/api/catalog/products',{sku:'P1',name:'Produto',unit:'un',minStock:5,targetStock:10,unitCost:5})).item;const center=(await post('/api/management/cost-centers',{code:'CC1',name:'Obra'})).item;
  await post('/api/stock/movements',{type:'ENTRY',productId:product.id,warehouseId:'main',quantity:3,costCenterId:center.id});
  const request=(await post('/api/purchases/requests',{warehouseId:'main',items:[{productId:product.id,quantity:4}]})).item;await post(`/api/purchases/requests/${request.id}/quotes`,{supplierId:supplier.id,items:[{productId:product.id,quantity:4,unitCost:8}]});await post(`/api/purchases/requests/${request.id}/approve`,{});const order=(await post('/api/purchases/orders',{requestId:request.id,supplierId:supplier.id})).item;await post(`/api/purchases/orders/${order.id}/receive`,{});
  const boot=await fetch(`${base}/api/bootstrap`,{headers:{authorization:`Bearer ${token}`}}).then((r)=>r.json());assert.equal(boot.dashboard.totalUnits,7);assert.equal(boot.purchaseOrders[0].status,'RECEIVED');
  const backup=await post('/api/backups',{});assert.match(backup.item.name,/almoxarifado-/);
});
