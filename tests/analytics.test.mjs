import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createAnalyticsService } from '../src/domain/analytics/analytics-service.mjs';

test('analytics calculates ABC, losses, no movement and valuation deterministically', () => {
  const repository=createMemoryStockRepository({
    products:[
      {id:'p1',sku:'P1',name:'Alto giro',unit:'un',avgCost:10,active:true},
      {id:'p2',sku:'P2',name:'Baixo giro',unit:'un',avgCost:5,active:true},
      {id:'p3',sku:'P3',name:'Sem giro',unit:'un',avgCost:2,active:true}
    ],
    warehouses:[{id:'w1',code:'W1',name:'Principal',active:true}],
    balances:[{productId:'p1',warehouseId:'w1',quantity:50},{productId:'p2',warehouseId:'w1',quantity:10},{productId:'p3',warehouseId:'w1',quantity:20}],
    movements:[
      {id:'m1',type:'EXIT',productId:'p1',warehouseId:'w1',quantity:30,delta:-30,occurredAt:'2026-09-10T10:00:00Z'},
      {id:'m2',type:'EXIT',productId:'p2',warehouseId:'w1',quantity:2,delta:-2,occurredAt:'2026-09-10T11:00:00Z'},
      {id:'m3',type:'LOSS',productId:'p2',warehouseId:'w1',quantity:1,delta:-1,occurredAt:'2026-09-11T11:00:00Z'}
    ]
  });
  const analytics=createAnalyticsService({repository,now:()=>new Date('2026-09-12T12:00:00Z')});
  const abc=analytics.abc({from:'2026-09-01',to:'2026-09-30'});
  assert.equal(abc[0].productId,'p1');
  assert.equal(abc[0].class,'A');
  assert.deepEqual(analytics.losses({}).map(x=>x.type),['LOSS']);
  assert.equal(analytics.noMovement({days:30}).some(x=>x.productId==='p3'),true);
  const valuation=analytics.valuation({});
  assert.equal(valuation.find(x=>x.productId==='p1').value,500);
});

test('analytics CSV is UTF-8 BOM and filterable by warehouse', () => {
  const repository=createMemoryStockRepository({products:[{id:'p1',name:'Produto',sku:'P1',unit:'un',avgCost:3,active:true}],warehouses:[{id:'w1',active:true},{id:'w2',active:true}],balances:[{productId:'p1',warehouseId:'w1',quantity:2},{productId:'p1',warehouseId:'w2',quantity:4}]});
  const analytics=createAnalyticsService({repository});
  assert.equal(analytics.valuation({warehouseId:'w1'}).length,1);
  assert.ok(analytics.toCsv([{product:'Produto',value:6}],[{key:'product',label:'Produto'},{key:'value',label:'Valor'}]).startsWith('\uFEFF'));
});
