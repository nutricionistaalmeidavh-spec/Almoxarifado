import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCatalogService } from '../src/domain/catalog/catalog-service.mjs';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createFileStockRepository } from '../src/domain/stock/file-repository.mjs';
import { createSqliteStockRepository } from '../src/domain/stock/sqlite-repository.mjs';

const fixture=()=>createMemoryStockRepository({
  products:[{id:'p1',sku:'OLD',name:'Antes',unit:'UN',active:true,avgCost:9}],
  warehouses:[{id:'main',code:'MAIN',name:'Principal',active:true}],
  users:[{id:'local-admin',login:'admin',role:'ADMIN',name:'Admin',active:true}]
});

test('editing an existing material preserves its id, average cost and existing stock',()=>{
  const repo=fixture(),catalog=createCatalogService({repository:repo});
  repo.setBalance('p1','main',12);
  const updated=catalog.updateProduct('p1',{sku:'NEW',name:'Depois',unit:'CX',minStock:2,unitCost:5,categoryId:null});
  assert.equal(updated.id,'p1');
  assert.equal(updated.name,'Depois');
  assert.equal(updated.avgCost,9);
  assert.equal(repo.listProducts().length,1);
  assert.equal(repo.getBalance('p1','main'),12);
  assert.throws(()=>catalog.updateProduct('missing',{name:'Não existe'}),e=>e.code==='PRODUCT_NOT_FOUND');
});

test('deactivation and reactivation maintain stock and original material ID',()=>{
  const repo=fixture(),catalog=createCatalogService({repository:repo});
  repo.setBalance('p1','main',4);
  assert.equal(catalog.updateProduct('p1',{active:false}).active,false);
  assert.equal(repo.getBalance('p1','main'),4);
  assert.equal(catalog.updateProduct('p1',{active:true}).active,true);
  assert.equal(repo.listProducts().length,1);
});

test('unused material is permanently removed without affecting other materials',()=>{
  const repo=fixture(),catalog=createCatalogService({repository:repo});
  repo.saveProduct({id:'p2',sku:'KEEP',name:'Manter',active:true});
  repo.setBalance('p1','main',0);
  const deleted=catalog.removeProduct('p1');
  assert.equal(deleted.id,'p1');
  assert.equal(repo.getProduct('p1'),null);
  assert.equal(repo.getProduct('p2').name,'Manter');
  assert.equal(repo.listBalances().filter(x=>x.productId==='p1').length,0);
  assert.throws(()=>catalog.removeProduct('p1'),e=>e.code==='PRODUCT_NOT_FOUND');
});

test('deletion rejects nonzero stock and any historical movement, even after stock returns to zero',()=>{
  const repo=fixture(),catalog=createCatalogService({repository:repo});
  repo.setBalance('p1','main',2);
  assert.throws(()=>catalog.removeProduct('p1'),e=>e.code==='PRODUCT_IN_USE');
  repo.setBalance('p1','main',0);
  repo.addMovement({id:'m1',productId:'p1',quantity:2});
  assert.throws(()=>catalog.removeProduct('p1'),e=>e.code==='PRODUCT_IN_USE');
  assert.equal(repo.getProduct('p1').name,'Antes');
});

test('deletion rejects nested purchase references, documents and kit components',()=>{
  for(const [collection,record] of [
    ['purchaseRequests',{id:'pr1',items:[{productId:'p1',quantity:1}]}],
    ['documents',{id:'doc1',entityType:'product',entityId:'p1',deletedAt:'2026-01-01'}],
    ['kits',{id:'k1',components:[{productId:'p1',quantity:2}]}],
    ['productSuppliers',{id:'link1',productId:'p1',supplierId:'s1'}]
  ]){
    const repo=fixture(),catalog=createCatalogService({repository:repo});
    const state=repo.exportState();
    state[collection].push(record);
    repo.replaceState(state);
    assert.throws(()=>catalog.removeProduct('p1'),e=>e.code==='PRODUCT_IN_USE',collection);
  }
});

test('physical material deletion persists across JSON and SQLite repository reopen',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-materials-'));
  try{
    const filePath=path.join(dir,'data.json'),dbPath=path.join(dir,'data.sqlite');
    for(const [open,reopen] of [
      [()=>createFileStockRepository({filePath}),()=>createFileStockRepository({filePath})],
      [()=>createSqliteStockRepository({dbPath}),()=>createSqliteStockRepository({dbPath})]
    ]){
      const repo=open(),catalog=createCatalogService({repository:repo});
      const material=catalog.saveProduct({sku:'TMP',name:'Material',unit:'un'});
      assert.ok(repo.getProduct(material.id));
      catalog.removeProduct(material.id);
      repo.close?.();
      const loaded=reopen();
      assert.equal(loaded.getProduct(material.id),null);
      loaded.close?.();
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
