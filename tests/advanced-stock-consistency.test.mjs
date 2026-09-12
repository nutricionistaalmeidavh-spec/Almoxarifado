import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';
import { createAdvancedStockService } from '../src/domain/stock/advanced-stock-service.mjs';

function fixture(){
  let sequence=0;
  const repository=createMemoryStockRepository({
    products:[{id:'p1',name:'Produto 1',active:true},{id:'p2',name:'Produto 2',active:true}],
    warehouses:[{id:'w1',name:'Principal',active:true},{id:'w2',name:'Obra',active:true}],
    users:[{id:'u1',name:'Admin',active:true}],
    balances:[{productId:'p1',warehouseId:'w1',quantity:10}]
  });
  const idFactory=()=>`id-${++sequence}`;
  const stock=createStockService({repository,idFactory,now:()=> '2026-09-12T15:00:00.000Z'});
  const advanced=createAdvancedStockService({repository,stock,idFactory,now:()=> '2026-09-12T15:00:00.000Z'});
  return {repository,stock,advanced};
}

test('loss and damage cannot consume units reserved by another operation',async()=>{
  const {advanced}=fixture();
  advanced.reserve({productId:'p1',warehouseId:'w1',quantity:9,userId:'u1'});
  await assert.rejects(
    advanced.damage({productId:'p1',warehouseId:'w1',quantity:2,userId:'u1'}),
    (error)=>error.code==='INSUFFICIENT_AVAILABLE_STOCK'
  );
});

test('lot code can repeat in another warehouse but serial must match its lot context',()=>{
  const {advanced}=fixture();
  const sourceLot=advanced.createLot({productId:'p1',warehouseId:'w1',code:'L1'});
  assert.doesNotThrow(()=>advanced.createLot({productId:'p1',warehouseId:'w2',code:'L1'}));
  assert.throws(
    ()=>advanced.registerSerial({productId:'p1',warehouseId:'w2',serial:'SN1',lotId:sourceLot.id}),
    (error)=>error.code==='LOT_CONTEXT_MISMATCH'
  );
});

test('serialized transit moves serial to destination and keeps equivalent lot there',async()=>{
  const {repository,advanced}=fixture();
  const sourceLot=advanced.createLot({productId:'p1',warehouseId:'w1',code:'L1',expiresAt:'2027-09-12'});
  const serial=advanced.registerSerial({productId:'p1',warehouseId:'w1',serial:'SN1',lotId:sourceLot.id});
  const transfer=await advanced.dispatchTransfer({productId:'p1',sourceWarehouseId:'w1',targetWarehouseId:'w2',quantity:1,userId:'u1',lotId:sourceLot.id,serialId:serial.id});
  assert.equal(repository.getSerial(serial.id).status,'IN_TRANSIT');
  const received=await advanced.receiveTransfer({transferId:transfer.id,userId:'u1'});
  const movedSerial=repository.getSerial(serial.id);
  const destinationLot=repository.getLot(movedSerial.lotId);
  assert.equal(movedSerial.status,'ACTIVE');
  assert.equal(movedSerial.warehouseId,'w2');
  assert.equal(destinationLot.code,'L1');
  assert.equal(destinationLot.warehouseId,'w2');
  assert.equal(destinationLot.expiresAt,'2027-09-12');
  assert.equal(received.destinationLotId,destinationLot.id);
});

test('tracked direct transfer is rejected so lot and serial cannot be attached to two warehouses',async()=>{
  const {stock,advanced}=fixture();
  const lot=advanced.createLot({productId:'p1',warehouseId:'w1',code:'L1'});
  await assert.rejects(
    stock.transfer({productId:'p1',sourceWarehouseId:'w1',targetWarehouseId:'w2',quantity:1,userId:'u1',lotId:lot.id}),
    (error)=>error.code==='TRACKED_TRANSFER_REQUIRES_TRANSIT'
  );
});

test('serialized damage closes the serial lifecycle after removing the physical unit',async()=>{
  const {repository,advanced}=fixture();
  const serial=advanced.registerSerial({productId:'p1',warehouseId:'w1',serial:'SN-DMG'});
  const movement=await advanced.damage({productId:'p1',warehouseId:'w1',quantity:1,userId:'u1',serialId:serial.id});
  const saved=repository.getSerial(serial.id);
  assert.equal(saved.status,'DAMAGED');
  assert.equal(saved.active,false);
  assert.equal(saved.lastMovementId,movement.id);
  assert.equal(saved.closedBy,'u1');
});
