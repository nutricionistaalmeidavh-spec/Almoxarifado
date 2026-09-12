import { randomUUID } from 'node:crypto';
import { DomainError, requireId, requirePositiveNumber } from '../shared/domain-error.mjs';

function entity(repository,getter,id,code,label){
  const value=repository[getter](requireId(id,`${label}Id`));
  if(!value||value.active===false) throw new DomainError(code,`${label} not found`,{id});
  return value;
}
function requireTrackedContext(repository,{productId,warehouseId,lotId=null,serialId=null,quantity=null}={}){
  let lot=null,serial=null;
  if(lotId){
    lot=entity(repository,'getLot',lotId,'LOT_NOT_FOUND','lot');
    if(lot.productId!==productId||lot.warehouseId!==warehouseId) throw new DomainError('LOT_CONTEXT_MISMATCH','lot does not belong to product and warehouse',{lotId,productId,warehouseId});
  }
  if(serialId){
    serial=entity(repository,'getSerial',serialId,'SERIAL_NOT_FOUND','serial');
    if(serial.status!=='ACTIVE') throw new DomainError('SERIAL_NOT_AVAILABLE','serial is not active',{serialId,status:serial.status});
    if(serial.productId!==productId||serial.warehouseId!==warehouseId) throw new DomainError('SERIAL_CONTEXT_MISMATCH','serial does not belong to product and warehouse',{serialId,productId,warehouseId});
    if(quantity!=null&&Number(quantity)!==1) throw new DomainError('SERIAL_QUANTITY_INVALID','serialized movement quantity must be exactly one',{serialId,quantity});
    if(serial.lotId){
      if(lotId&&serial.lotId!==lotId) throw new DomainError('SERIAL_LOT_MISMATCH','serial belongs to another lot',{serialId,lotId,serialLotId:serial.lotId});
      lot=entity(repository,'getLot',serial.lotId,'LOT_NOT_FOUND','lot');
      if(lot.productId!==productId||lot.warehouseId!==warehouseId) throw new DomainError('LOT_CONTEXT_MISMATCH','serial lot does not belong to product and warehouse',{serialId,lotId:serial.lotId,productId,warehouseId});
    }
  }
  return{lot,serial,lotId:lot?.id??lotId,serialId:serial?.id??serialId};
}

export function createAdvancedStockService({repository,stock,now=()=>new Date().toISOString(),idFactory=randomUUID}={}){
  if(!repository||!stock) throw new TypeError('repository and stock are required');
  const activeReserved=(productId,warehouseId)=>repository.listReservations().filter((r)=>r.productId===productId&&r.warehouseId===warehouseId&&r.status==='ACTIVE').reduce((sum,r)=>sum+Number(r.quantity||0),0);
  const closeTrackedSerial=async(input,movementType,serialStatus)=>repository.transaction(async()=>{
    const amount=Number(input.quantity); requirePositiveNumber(amount);
    const tracked=requireTrackedContext(repository,{productId:input.productId,warehouseId:input.warehouseId,lotId:input.lotId??null,serialId:input.serialId??null,quantity:amount});
    const movement=await stock.exit({...input,quantity:amount,movementType,lotId:tracked.lotId,serialId:tracked.serialId});
    if(tracked.serial) repository.saveSerial({...tracked.serial,status:serialStatus,active:false,closedAt:now(),closedBy:input.userId,lastMovementId:movement.id,updatedAt:now()});
    return movement;
  });
  const ensureDestinationLot=(sourceLot,targetWarehouseId)=>{
    if(!sourceLot) return null;
    const existing=repository.listLots().find((lot)=>lot.productId===sourceLot.productId&&lot.warehouseId===targetWarehouseId&&lot.code===sourceLot.code&&lot.active!==false);
    if(existing) return existing;
    return repository.saveLot({id:idFactory(),productId:sourceLot.productId,warehouseId:targetWarehouseId,code:sourceLot.code,expiresAt:sourceLot.expiresAt??null,manufactureAt:sourceLot.manufactureAt??null,notes:sourceLot.notes??'',active:true,createdAt:now(),sourceLotId:sourceLot.id});
  };

  return{
    available(productId,warehouseId){return repository.getBalance(productId,warehouseId)-activeReserved(productId,warehouseId);},
    reserve({productId,warehouseId,quantity,userId,reference='',expiresAt=null}){
      entity(repository,'getProduct',productId,'PRODUCT_NOT_FOUND','product'); entity(repository,'getWarehouse',warehouseId,'WAREHOUSE_NOT_FOUND','warehouse'); entity(repository,'getUser',userId,'USER_NOT_FOUND','user');
      const amount=Number(quantity); requirePositiveNumber(amount); const available=this.available(productId,warehouseId);
      if(available<amount) throw new DomainError('INSUFFICIENT_AVAILABLE_STOCK','insufficient available stock',{available,requested:amount});
      return repository.saveReservation({id:idFactory(),productId,warehouseId,quantity:amount,reference:String(reference),status:'ACTIVE',createdBy:userId,createdAt:now(),expiresAt,releasedAt:null,consumedAt:null});
    },
    releaseReservation({reservationId,userId}){
      const r=repository.getReservation(requireId(reservationId,'reservationId')); if(!r) throw new DomainError('RESERVATION_NOT_FOUND','reservation not found'); if(r.status!=='ACTIVE') throw new DomainError('RESERVATION_NOT_ACTIVE','reservation is not active'); entity(repository,'getUser',userId,'USER_NOT_FOUND','user');
      return repository.saveReservation({...r,status:'RELEASED',releasedAt:now(),releasedBy:userId});
    },
    async consumeReservation({reservationId,userId,reason=''}){
      const r=repository.getReservation(requireId(reservationId,'reservationId')); if(!r) throw new DomainError('RESERVATION_NOT_FOUND','reservation not found'); if(r.status!=='ACTIVE') throw new DomainError('RESERVATION_NOT_ACTIVE','reservation is not active');
      return repository.transaction(async()=>{ const movement=await stock.exit({productId:r.productId,warehouseId:r.warehouseId,quantity:r.quantity,userId,reason:reason||`Consumo reserva ${r.id}`,movementType:'RESERVATION_CONSUME'}); repository.saveReservation({...r,status:'CONSUMED',consumedAt:now(),consumedBy:userId,movementId:movement.id}); return movement; });
    },
    createLot({productId,warehouseId,code,expiresAt=null,manufactureAt=null,notes=''}){
      entity(repository,'getProduct',productId,'PRODUCT_NOT_FOUND','product'); entity(repository,'getWarehouse',warehouseId,'WAREHOUSE_NOT_FOUND','warehouse');
      const normalized=String(code??'').trim(); if(!normalized) throw new DomainError('INVALID_INPUT','lot code is required');
      if(repository.listLots().some((l)=>l.productId===productId&&l.warehouseId===warehouseId&&l.code===normalized&&l.active!==false)) throw new DomainError('LOT_EXISTS','lot already exists');
      return repository.saveLot({id:idFactory(),productId,warehouseId,code:normalized,expiresAt,manufactureAt,notes:String(notes),active:true,createdAt:now()});
    },
    registerSerial({productId,warehouseId,serial,lotId=null}){
      entity(repository,'getProduct',productId,'PRODUCT_NOT_FOUND','product'); entity(repository,'getWarehouse',warehouseId,'WAREHOUSE_NOT_FOUND','warehouse');
      if(lotId){ const lot=entity(repository,'getLot',lotId,'LOT_NOT_FOUND','lot'); if(lot.productId!==productId||lot.warehouseId!==warehouseId) throw new DomainError('LOT_CONTEXT_MISMATCH','lot does not belong to product and warehouse',{lotId,productId,warehouseId}); }
      const value=String(serial??'').trim(); if(!value) throw new DomainError('INVALID_INPUT','serial is required');
      if(repository.listSerials().some((s)=>s.serial===value)) throw new DomainError('SERIAL_EXISTS','serial already exists');
      return repository.saveSerial({id:idFactory(),productId,warehouseId,lotId,serial:value,status:'ACTIVE',active:true,createdAt:now()});
    },
    async loss(input){ return closeTrackedSerial(input,'LOSS','LOST'); },
    async damage(input){ return closeTrackedSerial(input,'DAMAGE','DAMAGED'); },
    async returnToStock(input){ return stock.entry({...input,movementType:'RETURN'}); },
    async dispatchTransfer({productId,sourceWarehouseId,targetWarehouseId,quantity,userId,reason='',lotId=null,serialId=null}){
      if(sourceWarehouseId===targetWarehouseId) throw new DomainError('INVALID_TRANSFER','source and target warehouses must differ');
      entity(repository,'getProduct',productId,'PRODUCT_NOT_FOUND','product'); entity(repository,'getWarehouse',sourceWarehouseId,'WAREHOUSE_NOT_FOUND','warehouse'); entity(repository,'getWarehouse',targetWarehouseId,'WAREHOUSE_NOT_FOUND','warehouse'); entity(repository,'getUser',userId,'USER_NOT_FOUND','user');
      const amount=Number(quantity); requirePositiveNumber(amount); const tracked=requireTrackedContext(repository,{productId,warehouseId:sourceWarehouseId,lotId,serialId,quantity:amount}); const transferId=idFactory();
      return repository.transaction(async()=>{
        const movement=await stock.exit({productId,warehouseId:sourceWarehouseId,quantity:amount,userId,reason:reason||`Transferência em trânsito ${transferId}`,movementType:'TRANSIT_OUT',lotId:tracked.lotId,serialId:tracked.serialId});
        if(tracked.serial) repository.saveSerial({...tracked.serial,status:'IN_TRANSIT',targetWarehouseId,transitTransferId:transferId,updatedAt:now()});
        return repository.saveTransitTransfer({id:transferId,productId,sourceWarehouseId,targetWarehouseId,quantity:amount,sourceLotId:tracked.lotId,serialId:tracked.serialId,status:'IN_TRANSIT',dispatchedAt:now(),dispatchedBy:userId,outMovementId:movement.id,receivedAt:null,receivedBy:null,destinationLotId:null});
      });
    },
    async receiveTransfer({transferId,userId}){
      const transfer=repository.getTransitTransfer(requireId(transferId,'transferId')); if(!transfer) throw new DomainError('TRANSIT_TRANSFER_NOT_FOUND','transfer not found'); if(transfer.status!=='IN_TRANSIT') throw new DomainError('TRANSFER_NOT_IN_TRANSIT','transfer is not in transit'); entity(repository,'getUser',userId,'USER_NOT_FOUND','user');
      return repository.transaction(async()=>{
        const sourceLot=transfer.sourceLotId?repository.getLot(transfer.sourceLotId):null;
        if(transfer.sourceLotId&&!sourceLot) throw new DomainError('LOT_NOT_FOUND','source lot not found',{lotId:transfer.sourceLotId});
        const destinationLot=ensureDestinationLot(sourceLot,transfer.targetWarehouseId);
        let serial=null;
        if(transfer.serialId){
          serial=repository.getSerial(transfer.serialId); if(!serial) throw new DomainError('SERIAL_NOT_FOUND','serial not found',{serialId:transfer.serialId}); if(serial.status!=='IN_TRANSIT'||serial.transitTransferId!==transfer.id) throw new DomainError('SERIAL_TRANSIT_MISMATCH','serial is not assigned to this transfer',{serialId:serial.id,transferId:transfer.id});
          serial=repository.saveSerial({...serial,warehouseId:transfer.targetWarehouseId,lotId:destinationLot?.id??null,status:'ACTIVE',active:true,targetWarehouseId:null,transitTransferId:null,updatedAt:now()});
        }
        const movement=await stock.entry({productId:transfer.productId,warehouseId:transfer.targetWarehouseId,quantity:transfer.quantity,userId,reason:`Recebimento transferência ${transfer.id}`,movementType:'TRANSIT_IN',lotId:destinationLot?.id??null,serialId:serial?.id??null});
        return repository.saveTransitTransfer({...transfer,status:'RECEIVED',receivedAt:now(),receivedBy:userId,inMovementId:movement.id,destinationLotId:destinationLot?.id??null});
      });
    }
  };
}
