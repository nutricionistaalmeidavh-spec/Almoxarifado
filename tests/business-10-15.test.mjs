import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';
import { createPurchasingService } from '../src/domain/purchasing/purchasing-service.mjs';
import { createManagementService } from '../src/domain/management/management-service.mjs';
import { createAdvancedStockService } from '../src/domain/stock/advanced-stock-service.mjs';
import { createCostService } from '../src/domain/costs/cost-service.mjs';

function fixture() {
  let seq = 0;
  const repository = createMemoryStockRepository({
    suppliers:[{id:'s1',name:'Fornecedor',active:true}],
    products:[{id:'p1',sku:'P1',name:'Tubo',unit:'un',minStock:5,active:true}],
    warehouses:[{id:'w1',code:'A',name:'Principal',active:true},{id:'w2',code:'B',name:'Obra',active:true}],
    users:[{id:'u1',name:'Admin',login:'admin',role:'ADMIN',active:true}],
    balances:[{productId:'p1',warehouseId:'w1',quantity:10}]
  });
  const idFactory=()=>`id-${++seq}`;
  const now=()=> '2026-09-12T12:00:00.000Z';
  const stock=createStockService({repository,idFactory,now});
  const costs=createCostService({repository,idFactory,now});
  return {repository,stock,costs,idFactory,now};
}

test('management records cost center, project and department for stock context', async()=>{
  const {repository,stock,idFactory}=fixture();
  const management=createManagementService({repository,idFactory});
  const cc=management.saveCostCenter({code:'CC1',name:'Obra Centro'});
  const project=management.saveProject({code:'OB1',name:'Edifício A'});
  const dep=management.saveDepartment({code:'MAN',name:'Manutenção'});
  const movement=await stock.exit({productId:'p1',warehouseId:'w1',quantity:2,userId:'u1',costCenterId:cc.id,projectId:project.id,departmentId:dep.id,responsibleId:'u1'});
  assert.equal(movement.costCenterId,cc.id);
  assert.equal(movement.projectId,project.id);
  assert.equal(movement.departmentId,dep.id);
  assert.equal(movement.responsibleId,'u1');
});

test('purchase request quote approval order and receipt update stock and average cost', async()=>{
  const {repository,stock,costs,idFactory,now}=fixture();
  const purchasing=createPurchasingService({repository,stock,idFactory,now,recordCost:(input)=>costs.recordReceipt(input)});
  const request=purchasing.createRequest({warehouseId:'w1',requestedBy:'u1',items:[{productId:'p1',quantity:4}]});
  const quote=purchasing.addQuote({requestId:request.id,supplierId:'s1',userId:'u1',items:[{productId:'p1',quantity:4,unitCost:20}]});
  purchasing.approveRequest({requestId:request.id,userId:'u1'});
  const order=purchasing.createOrder({requestId:request.id,supplierId:'s1',quoteId:quote.id,userId:'u1'});
  const receipt=await purchasing.receiveOrder({orderId:order.id,userId:'u1'});
  assert.equal(repository.getBalance('p1','w1'),14);
  assert.equal(repository.getPurchaseOrder(order.id).status,'RECEIVED');
  assert.equal(receipt.items[0].unitCost,20);
  assert.equal(repository.listPriceHistory('p1').length,1);
  assert.ok(repository.getProduct('p1').avgCost>0);
});

test('reservations reduce available stock and consumption writes stock movement', async()=>{
  const {repository,stock,idFactory,now}=fixture();
  const advanced=createAdvancedStockService({repository,stock,idFactory,now});
  const reservation=advanced.reserve({productId:'p1',warehouseId:'w1',quantity:3,userId:'u1',reference:'OS-1'});
  assert.equal(advanced.available('p1','w1'),7);
  const movement=await advanced.consumeReservation({reservationId:reservation.id,userId:'u1'});
  assert.equal(movement.type,'RESERVATION_CONSUME');
  assert.equal(repository.getBalance('p1','w1'),7);
  assert.equal(repository.getReservation(reservation.id).status,'CONSUMED');
});

test('lot serial loss damage return and in-transit transfer are auditable', async()=>{
  const {repository,stock,idFactory,now}=fixture();
  const advanced=createAdvancedStockService({repository,stock,idFactory,now});
  const lot=advanced.createLot({productId:'p1',warehouseId:'w1',code:'L2026',expiresAt:'2027-09-12'});
  const serial=advanced.registerSerial({productId:'p1',warehouseId:'w1',serial:'SN001',lotId:lot.id});
  await advanced.loss({productId:'p1',warehouseId:'w1',quantity:1,userId:'u1',lotId:lot.id,serialId:serial.id,reason:'Extravio'});
  await advanced.damage({productId:'p1',warehouseId:'w1',quantity:1,userId:'u1',reason:'Quebra'});
  await advanced.returnToStock({productId:'p1',warehouseId:'w1',quantity:1,userId:'u1',reason:'Devolução'});
  const transit=await advanced.dispatchTransfer({productId:'p1',sourceWarehouseId:'w1',targetWarehouseId:'w2',quantity:2,userId:'u1'});
  assert.equal(transit.status,'IN_TRANSIT');
  await advanced.receiveTransfer({transferId:transit.id,userId:'u1'});
  assert.equal(repository.getTransitTransfer(transit.id).status,'RECEIVED');
  assert.deepEqual(repository.listMovements().map(m=>m.type),['LOSS','DAMAGE','RETURN','TRANSIT_OUT','TRANSIT_IN']);
});

test('replenishment uses minimum stock, reservations and latest cost', async()=>{
  const {repository,costs}=fixture();
  repository.setBalance('p1','w1',3);
  repository.saveReservation({id:'r1',productId:'p1',warehouseId:'w1',quantity:1,status:'ACTIVE'});
  await costs.recordReceipt({productId:'p1',supplierId:'s1',warehouseId:'w1',quantity:1,unitCost:12,previousQuantity:3,userId:'u1'});
  const suggestion=costs.replenishmentSuggestions({warehouseId:'w1'})[0];
  assert.equal(suggestion.available,2);
  assert.equal(suggestion.minStock,5);
  assert.equal(suggestion.suggestedQuantity,8);
  assert.equal(suggestion.estimatedUnitCost,12);
});

test('normal exits cannot consume stock reserved for another demand',async()=>{const{repository,stock,idFactory,now}=fixture();const advanced=createAdvancedStockService({repository,stock,idFactory,now});advanced.reserve({productId:'p1',warehouseId:'w1',quantity:8,userId:'u1'});await assert.rejects(stock.exit({productId:'p1',warehouseId:'w1',quantity:3,userId:'u1'}),(error)=>error.code==='INSUFFICIENT_AVAILABLE_STOCK');assert.equal(repository.getBalance('p1','w1'),10);});

test('purchase order rejects a quote from another supplier',()=>{const{repository,stock,costs,idFactory,now}=fixture();repository.saveSupplier({id:'s2',name:'Outro',active:true});const purchasing=createPurchasingService({repository,stock,idFactory,now,recordCost:(input)=>costs.recordReceipt(input)});const request=purchasing.createRequest({warehouseId:'w1',requestedBy:'u1',items:[{productId:'p1',quantity:1}]});const quote=purchasing.addQuote({requestId:request.id,supplierId:'s1',userId:'u1',items:[{productId:'p1',quantity:1,unitCost:5}]});purchasing.approveRequest({requestId:request.id,userId:'u1'});assert.throws(()=>purchasing.createOrder({requestId:request.id,supplierId:'s2',quoteId:quote.id,userId:'u1'}),(error)=>error.code==='QUOTE_SUPPLIER_MISMATCH');});
