import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStockRepository } from '../src/domain/stock/file-repository.mjs';
import { createLocalApi } from '../src/platform/local-api.mjs';
import { createWebServer } from '../src/platform/web-server.mjs';

test('LAN API exposes addressing scan picking and cycle count flows',async(t)=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-wms-api-'));const repository=createFileStockRepository({filePath:path.join(dir,'data.json')});const server=createWebServer({host:'127.0.0.1',port:0,apiHandler:createLocalApi({repository,backupDir:path.join(dir,'backups')})});await server.start();t.after(()=>server.stop());const base=`http://127.0.0.1:${server.address().port}`;
  const raw=(url,body,token='')=>fetch(`${base}${url}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  await raw('/api/auth/bootstrap',{password:'SenhaForte123'});const login=await raw('/api/auth/login',{login:'admin',password:'SenhaForte123'});const token=(await login.json()).token;
  const post=async(url,body)=>{const r=await raw(url,body,token);const j=await r.json();assert.equal(r.ok,true,JSON.stringify(j));return j;};
  const product=(await post('/api/catalog/products',{sku:'P1',barcode:'7891',name:'Produto',unit:'un',removalStrategy:'FIFO'})).item;
  const location=(await post('/api/wms/locations',{warehouseId:'main',code:'A-01',name:'Posição A'})).item;
  await post('/api/stock/movements',{type:'ENTRY',productId:product.id,warehouseId:'main',locationId:location.id,quantity:5});
  const scan=await post('/api/wms/scan',{code:'A-01'});assert.equal(scan.result.kind,'location');
  const pick=await fetch(`${base}/api/wms/pick?productId=${product.id}&warehouseId=main&quantity=2`,{headers:{authorization:`Bearer ${token}`}}).then(r=>r.json());assert.equal(pick.items[0].locationId,location.id);
  const cycle=(await post('/api/wms/cycle-counts',{warehouseId:'main',locationIds:[location.id]})).item;
  const lines=await fetch(`${base}/api/wms/cycle-counts/${cycle.id}/lines`,{headers:{authorization:`Bearer ${token}`}}).then(r=>r.json());assert.equal('expectedQuantity' in lines.items[0],false);
});
