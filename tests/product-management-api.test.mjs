import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSqliteStockRepository } from '../src/domain/stock/sqlite-repository.mjs';
import { createLocalApi } from '../src/platform/local-api.mjs';
import { createWebServer } from '../src/platform/web-server.mjs';

test('LAN material edit, status, deletion and permissions preserve canonical stock',async t=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-api-products-'));
  const repository=createSqliteStockRepository({dbPath:path.join(dir,'stock.sqlite')});
  const server=createWebServer({host:'127.0.0.1',port:0,apiHandler:createLocalApi({repository,backupDir:path.join(dir,'backups'),documentDir:path.join(dir,'documents')})});
  await server.start();
  t.after(async()=>{await server.stop();repository.close();rmSync(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const json=async(method,route,payload,token='')=>{
    const response=await fetch(base+route,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
    return {code:response.status,body:await response.json()};
  };
  assert.equal((await json('POST','/api/auth/bootstrap',{password:'SenhaForte123'})).code,201);
  const login=await json('POST','/api/auth/login',{login:'admin',password:'SenhaForte123'});
  const token=login.body.token;
  assert.ok(token);
  const created=await json('POST','/api/catalog/products',{sku:'MAT',name:'Material',unit:'UN'},token);
  assert.equal(created.code,201);
  const id=created.body.item.id;
  assert.equal((await json('PATCH',`/api/catalog/products/${id}`,{name:'Não autorizado'})).code,401);
  const updated=await json('PATCH',`/api/catalog/products/${id}`,{name:'Material editado',sku:'MAT2',id:'outro'},token);
  assert.equal(updated.code,200);
  assert.equal(updated.body.item.id,id);
  assert.equal(updated.body.item.name,'Material editado');
  assert.equal(repository.listProducts().length,1);
  const disabled=await json('PATCH',`/api/catalog/products/${id}`,{active:false},token);
  assert.equal(disabled.code,200);
  assert.equal(disabled.body.item.active,false);
  assert.equal((await json('PATCH',`/api/catalog/products/${id}`,{active:true},token)).body.item.active,true);
  repository.setBalance(id,'main',5);
  const denied=await json('DELETE',`/api/catalog/products/${id}`,undefined,token);
  assert.equal(denied.code,409);
  assert.equal(denied.body.error,'PRODUCT_IN_USE');
  assert.ok(repository.getProduct(id));
  const fresh=await json('POST','/api/catalog/products',{sku:'DEL',name:'Temporário',unit:'UN'},token);
  assert.equal(fresh.code,201);
  const deleted=await json('DELETE',`/api/catalog/products/${fresh.body.item.id}`,undefined,token);
  assert.equal(deleted.code,200);
  assert.equal(repository.getProduct(fresh.body.item.id),null);
  const missing=await json('PATCH','/api/catalog/products/missing',{name:'abc'},token);
  assert.equal(missing.code,404);
});

test('material page offers accessible edit, archive/reactivate, delete and cancel controls',async()=>{
  const {readFile}=await import('node:fs/promises');
  const index=await readFile(new URL('../apps/web/index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../apps/web/app.js',import.meta.url),'utf8');
  for(const word of ['product-cancel-edit','products-table'])assert.ok(index.includes(word));
  for(const word of ['Editar','Desativar','Reativar','Excluir','products-table','product-cancel-edit','confirm('])assert.ok(js.includes(word),word);
});
