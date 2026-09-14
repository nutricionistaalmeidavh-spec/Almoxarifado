import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';
import { createWmsService } from '../src/domain/wms/wms-service.mjs';

function fixture(){
  let seq=0;
  const repository=createMemoryStockRepository({
    warehouses:[{id:'w1',code:'ALM',name:'Principal',active:true}],
    users:[{id:'u1',login:'admin',name:'Admin',role:'ADMIN',active:true}],
    products:[{id:'p1',sku:'P1',barcode:'7891',name:'Tubo',unit:'un',removalStrategy:'FEFO',active:true}],
    balances:[{productId:'p1',warehouseId:'w1',quantity:10}],
    lots:[{id:'lot1',productId:'p1',warehouseId:'w1',code:'L1',expiresAt:'2026-12-01',createdAt:'2026-09-01',active:true},{id:'lot2',productId:'p1',warehouseId:'w1',code:'L2',expiresAt:'2026-10-01',createdAt:'2026-09-02',active:true}]
  });
  const idFactory=()=>`id-${++seq}`;
  const now=()=> '2026-09-14T12:00:00.000Z';
  const stock=createStockService({repository,idFactory,now});
  const wms=createWmsService({repository,stock,idFactory,now});
  return{repository,stock,wms};
}

test('creates hierarchical locations with unique codes inside warehouse',()=>{
  const {wms}=fixture();
  const zone=wms.createLocation({warehouseId:'w1',code:'Z-A',name:'Zona A',type:'ZONE'});
  const aisle=wms.createLocation({warehouseId:'w1',parentId:zone.id,code:'C-01',name:'Corredor 01',type:'AISLE'});
  const bin=wms.createLocation({warehouseId:'w1',parentId:aisle.id,code:'P-01',name:'Posição 01',type:'POSITION'});
  assert.equal(wms.locationPath(bin.id).map(x=>x.code).join('/'),'Z-A/C-01/P-01');
  assert.throws(()=>wms.createLocation({warehouseId:'w1',code:'P-01',name:'Duplicada'}),(error)=>error.code==='LOCATION_CODE_EXISTS');
});

test('FEFO pick recommendation uses tracked stock positions and nearest expiry first',async()=>{
  const {repository,stock,wms}=fixture();
  const a=wms.createLocation({warehouseId:'w1',code:'A-01',name:'A01'});
  const b=wms.createLocation({warehouseId:'w1',code:'B-01',name:'B01'});
  repository.setBalance('p1','w1',0);
  await stock.entry({productId:'p1',warehouseId:'w1',locationId:a.id,lotId:'lot1',quantity:6,userId:'u1'});
  await stock.entry({productId:'p1',warehouseId:'w1',locationId:b.id,lotId:'lot2',quantity:4,userId:'u1'});
  const plan=wms.recommendPick({productId:'p1',warehouseId:'w1',quantity:7});
  assert.deepEqual(plan.map(x=>[x.locationId,x.lotId,x.quantity]),[[b.id,'lot2',4],[a.id,'lot1',3]]);
});

test('cycle count is blind, requires recount on divergence and closes with audited adjustment',async()=>{
  const {repository,stock,wms}=fixture();
  const bin=wms.createLocation({warehouseId:'w1',code:'P-01',name:'Posição 01'});
  repository.setBalance('p1','w1',0);
  await stock.entry({productId:'p1',warehouseId:'w1',locationId:bin.id,quantity:5,userId:'u1'});
  const session=wms.startCycleCount({warehouseId:'w1',locationIds:[bin.id],userId:'u1',requireRecount:true});
  const blind=wms.listCycleCountLines(session.id);
  assert.equal('expectedQuantity' in blind[0],false);
  const first=wms.countCycleLine({cycleCountId:session.id,lineId:blind[0].id,quantity:4,userId:'u1'});
  assert.equal(first.status,'NEEDS_RECOUNT');
  const second=wms.recountCycleLine({cycleCountId:session.id,lineId:blind[0].id,quantity:4,userId:'u1'});
  assert.equal(second.status,'COUNTED');
  const closed=await wms.closeCycleCount({cycleCountId:session.id,userId:'u1'});
  assert.equal(closed.status,'CLOSED');
  assert.equal(repository.getBalance('p1','w1'),4);
  assert.equal(repository.listMovements().at(-1).type,'CYCLE_ADJUSTMENT');
});

test('resolveScan distinguishes location and product codes',()=>{
  const {wms}=fixture();
  const location=wms.createLocation({warehouseId:'w1',code:'LOC-1',name:'Posição'});
  assert.equal(wms.resolveScan({code:'LOC-1'}).item.id,location.id);
  assert.equal(wms.resolveScan({code:'7891'}).item.id,'p1');
  assert.equal(wms.resolveScan({code:'P1'}).kind,'product');
});
