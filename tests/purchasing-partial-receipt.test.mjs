import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';
import { createPurchasingService } from '../src/domain/purchasing/purchasing-service.mjs';

function fixture(){
  let seq=0;
  const repository=createMemoryStockRepository({
    suppliers:[{id:'s1',name:'Fornecedor',active:true}],
    products:[{id:'p1',sku:'P1',name:'Tubo',unit:'un',active:true}],
    warehouses:[{id:'w1',code:'A',name:'Principal',active:true}],
    users:[{id:'u1',name:'Admin',login:'admin',role:'ADMIN',active:true}]
  });
  const idFactory=()=>`id-${++seq}`;
  const now=()=> '2026-09-14T12:00:00.000Z';
  const stock=createStockService({repository,idFactory,now});
  const purchasing=createPurchasingService({repository,stock,idFactory,now});
  const request=purchasing.createRequest({warehouseId:'w1',requestedBy:'u1',items:[{productId:'p1',quantity:10}]});
  const quote=purchasing.addQuote({requestId:request.id,supplierId:'s1',userId:'u1',items:[{productId:'p1',quantity:10,unitCost:5}]});
  purchasing.approveRequest({requestId:request.id,userId:'u1'});
  const order=purchasing.createOrder({requestId:request.id,supplierId:'s1',quoteId:quote.id,userId:'u1'});
  return{repository,purchasing,order};
}

test('partial receipt keeps order open and tracks pending quantity',async()=>{
  const {repository,purchasing,order}=fixture();
  const receipt=await purchasing.receiveOrder({orderId:order.id,userId:'u1',items:[{productId:'p1',quantity:4}]});
  assert.equal(receipt.items[0].acceptedQuantity,4);
  assert.equal(repository.getBalance('p1','w1'),4);
  const saved=repository.getPurchaseOrder(order.id);
  assert.equal(saved.status,'PARTIALLY_RECEIVED');
  assert.equal(saved.items[0].pendingQuantity,6);
});

test('second receipt completes purchase order',async()=>{
  const {repository,purchasing,order}=fixture();
  await purchasing.receiveOrder({orderId:order.id,userId:'u1',items:[{productId:'p1',quantity:4}]});
  await purchasing.receiveOrder({orderId:order.id,userId:'u1',items:[{productId:'p1',quantity:6}]});
  assert.equal(repository.getBalance('p1','w1'),10);
  assert.equal(repository.getPurchaseOrder(order.id).status,'RECEIVED');
});

test('rejected and damaged quantities are recorded but not added to available stock',async()=>{
  const {repository,purchasing,order}=fixture();
  const receipt=await purchasing.receiveOrder({orderId:order.id,userId:'u1',items:[{productId:'p1',quantity:5,acceptedQuantity:2,rejectedQuantity:2,damagedQuantity:1}]});
  assert.equal(repository.getBalance('p1','w1'),2);
  assert.equal(receipt.items[0].rejectedQuantity,2);
  assert.equal(receipt.items[0].damagedQuantity,1);
  assert.equal(repository.getPurchaseOrder(order.id).items[0].pendingQuantity,5);
});

test('legacy receive without items still receives all pending quantity',async()=>{
  const {repository,purchasing,order}=fixture();
  await purchasing.receiveOrder({orderId:order.id,userId:'u1'});
  assert.equal(repository.getBalance('p1','w1'),10);
  assert.equal(repository.getPurchaseOrder(order.id).status,'RECEIVED');
});
