import { randomUUID } from 'node:crypto';
import { DomainError, requireId, requireNonNegativeNumber, requirePositiveNumber } from '../shared/domain-error.mjs';

function ensureEntity(repository, kind, id) {
  const getter = kind === 'product' ? 'getProduct' : kind === 'warehouse' ? 'getWarehouse' : 'getUser';
  const entity = repository[getter](id);
  if (!entity || entity.active === false) throw new DomainError(`${kind.toUpperCase()}_NOT_FOUND`, `${kind} not found`, { id });
  return entity;
}
function ensureUnlocked(repository, warehouseId) {
  if (repository.hasOpenInventory(warehouseId)) throw new DomainError('WAREHOUSE_INVENTORY_LOCKED', 'warehouse has an open inventory', { warehouseId });
}
function reservedQuantity(repository, productId, warehouseId) {
  if (typeof repository.listReservations !== 'function') return 0;
  return repository.listReservations().filter((item) => item.productId === productId && item.warehouseId === warehouseId && item.status === 'ACTIVE').reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}
function positionId({productId,warehouseId,locationId,lotId=null,serialId=null}){return [productId,warehouseId,locationId,lotId??'',serialId??''].join('::');}
function validateContext(repository, context = {}, productId, warehouseId, quantity = null) {
  const refs = [['costCenterId','getCostCenter','COST_CENTER_NOT_FOUND'],['projectId','getProject','PROJECT_NOT_FOUND'],['departmentId','getDepartment','DEPARTMENT_NOT_FOUND'],['responsibleId','getUser','RESPONSIBLE_NOT_FOUND']];
  for (const [key,getter,code] of refs) { const id=context[key]; if(!id)continue; const value=repository[getter]?.(id); if(!value||value.active===false)throw new DomainError(code,`${key} not found`,{id}); }
  const locationId=context.locationId||null;
  if(locationId){const location=repository.getLocation?.(locationId);if(!location||location.active===false)throw new DomainError('LOCATION_NOT_FOUND','location not found',{locationId});if(location.warehouseId!==warehouseId)throw new DomainError('LOCATION_WAREHOUSE_MISMATCH','location does not belong to warehouse',{locationId,warehouseId});}
  let lotId=context.lotId||null;
  if(lotId){const lot=repository.getLot?.(lotId);if(!lot||lot.active===false)throw new DomainError('LOT_NOT_FOUND','lotId not found',{id:lotId});if(lot.productId!==productId||lot.warehouseId!==warehouseId)throw new DomainError('LOT_CONTEXT_MISMATCH','lot does not belong to product and warehouse',{lotId,productId,warehouseId});}
  const serialId=context.serialId||null;
  if(serialId){const serial=repository.getSerial?.(serialId);if(!serial||serial.active===false)throw new DomainError('SERIAL_NOT_FOUND','serialId not found',{id:serialId});if(serial.status!=='ACTIVE')throw new DomainError('SERIAL_NOT_AVAILABLE','serial is not active',{serialId,status:serial.status});if(serial.productId!==productId||serial.warehouseId!==warehouseId)throw new DomainError('SERIAL_CONTEXT_MISMATCH','serial does not belong to product and warehouse',{serialId,productId,warehouseId});if(quantity!=null&&Number(quantity)!==1)throw new DomainError('SERIAL_QUANTITY_INVALID','serialized movement quantity must be exactly one',{serialId,quantity});if(serial.lotId){if(lotId&&lotId!==serial.lotId)throw new DomainError('SERIAL_LOT_MISMATCH','serial belongs to another lot',{serialId,lotId,serialLotId:serial.lotId});lotId=serial.lotId;}}
  return {costCenterId:context.costCenterId||null,projectId:context.projectId||null,departmentId:context.departmentId||null,responsibleId:context.responsibleId||null,locationId,lotId,serialId};
}

export function createStockService({ repository, publish = async () => {}, now = () => new Date().toISOString(), idFactory = randomUUID } = {}) {
  if (!repository || typeof repository.transaction !== 'function') throw new TypeError('repository is required');
  if (typeof publish !== 'function') throw new TypeError('publish must be a function');
  const validateRefs=(productId,warehouseId,userId)=>{requireId(productId,'productId');requireId(warehouseId,'warehouseId');requireId(userId,'userId');ensureEntity(repository,'product',productId);ensureEntity(repository,'warehouse',warehouseId);ensureEntity(repository,'user',userId);};
  const writeMovement=({type,productId,warehouseId,relatedWarehouseId=null,quantity,delta,before,after,transferId=null,inventoryId=null,reason='',userId,context={}})=>{const movement={id:idFactory(),type,productId,warehouseId,relatedWarehouseId,quantity,delta,before,after,transferId,inventoryId,reason:reason||'',userId,...context,occurredAt:now()};repository.addMovement(movement);return movement;};
  const changePosition=(context,productId,warehouseId,delta)=>{
    if(!context.locationId||typeof repository.saveStockPosition!=='function')return null;
    const id=positionId({productId,warehouseId,...context});
    const current=repository.getStockPosition(id)??{id,productId,warehouseId,locationId:context.locationId,lotId:context.lotId??null,serialId:context.serialId??null,quantity:0,receivedAt:now(),createdAt:now(),active:true};
    const next=Number(current.quantity||0)+Number(delta);
    if(next<0)throw new DomainError('INSUFFICIENT_POSITION_STOCK','insufficient stock at location',{locationId:context.locationId,available:Number(current.quantity||0),requested:Math.abs(Number(delta))});
    return repository.saveStockPosition({...current,quantity:next,updatedAt:now(),active:next>0});
  };

  return {
    async balance(productId,warehouseId){requireId(productId,'productId');requireId(warehouseId,'warehouseId');ensureEntity(repository,'product',productId);ensureEntity(repository,'warehouse',warehouseId);return repository.getBalance(productId,warehouseId);},
    async entry({productId,warehouseId,quantity,userId,reason='',movementType='ENTRY',...contextInput}){
      validateRefs(productId,warehouseId,userId);requirePositiveNumber(quantity);ensureUnlocked(repository,warehouseId);const context=validateContext(repository,contextInput,productId,warehouseId,quantity);
      const movement=await repository.transaction(async()=>{const before=repository.getBalance(productId,warehouseId),after=before+quantity;repository.setBalance(productId,warehouseId,after);changePosition(context,productId,warehouseId,quantity);return writeMovement({type:movementType,productId,warehouseId,quantity,delta:quantity,before,after,reason,userId,context});});
      await publish({type:'stock.entry.created',payload:{movementId:movement.id,productId,warehouseId,quantity,movementType}});return movement;
    },
    async exit({productId,warehouseId,quantity,userId,reason='',movementType='EXIT',...contextInput}){
      validateRefs(productId,warehouseId,userId);requirePositiveNumber(quantity);ensureUnlocked(repository,warehouseId);const context=validateContext(repository,contextInput,productId,warehouseId,quantity);
      const movement=await repository.transaction(async()=>{const before=repository.getBalance(productId,warehouseId);if(before<quantity)throw new DomainError('INSUFFICIENT_STOCK','insufficient stock',{productId,warehouseId,available:before,requested:quantity});const reserved=reservedQuantity(repository,productId,warehouseId),available=before-reserved;const bypassReservation=movementType==='RESERVATION_CONSUME'||movementType==='CYCLE_ADJUSTMENT';if(!bypassReservation&&available<quantity)throw new DomainError('INSUFFICIENT_AVAILABLE_STOCK','stock is reserved',{productId,warehouseId,physical:before,reserved,available,requested:quantity});changePosition(context,productId,warehouseId,-quantity);const after=before-quantity;repository.setBalance(productId,warehouseId,after);return writeMovement({type:movementType,productId,warehouseId,quantity,delta:-quantity,before,after,reason,userId,context});});
      await publish({type:'stock.exit.created',payload:{movementId:movement.id,productId,warehouseId,quantity,movementType}});return movement;
    },
    async adjust({productId,warehouseId,newQuantity,userId,reason='',...contextInput}){
      validateRefs(productId,warehouseId,userId);requireNonNegativeNumber(newQuantity,'newQuantity');ensureUnlocked(repository,warehouseId);const context=validateContext(repository,contextInput,productId,warehouseId,null);
      const movement=await repository.transaction(async()=>{const before=repository.getBalance(productId,warehouseId),reserved=reservedQuantity(repository,productId,warehouseId);if(newQuantity<reserved)throw new DomainError('RESERVED_STOCK_CONFLICT','new balance cannot be below reserved stock',{productId,warehouseId,reserved,newQuantity});const after=newQuantity,delta=after-before;changePosition(context,productId,warehouseId,delta);repository.setBalance(productId,warehouseId,after);return writeMovement({type:'ADJUSTMENT',productId,warehouseId,quantity:Math.abs(delta),delta,before,after,reason,userId,context});});
      await publish({type:'stock.adjusted',payload:{movementId:movement.id,productId,warehouseId,before:movement.before,after:movement.after}});return movement;
    },
    async transfer({productId,sourceWarehouseId,targetWarehouseId,quantity,userId,reason='',targetLocationId=null,...contextInput}){
      requireId(sourceWarehouseId,'sourceWarehouseId');requireId(targetWarehouseId,'targetWarehouseId');if(sourceWarehouseId===targetWarehouseId)throw new DomainError('INVALID_TRANSFER','source and target warehouses must differ');if(contextInput.lotId||contextInput.serialId)throw new DomainError('TRACKED_TRANSFER_REQUIRES_TRANSIT','lot/serial transfers must use transit workflow');validateRefs(productId,sourceWarehouseId,userId);ensureEntity(repository,'warehouse',targetWarehouseId);requirePositiveNumber(quantity);ensureUnlocked(repository,sourceWarehouseId);ensureUnlocked(repository,targetWarehouseId);
      const context=validateContext(repository,contextInput,productId,sourceWarehouseId,quantity);const targetContext=validateContext(repository,{...contextInput,locationId:targetLocationId,lotId:null,serialId:null},productId,targetWarehouseId,quantity);const transferId=idFactory();
      const result=await repository.transaction(async()=>{const sourceBefore=repository.getBalance(productId,sourceWarehouseId);if(sourceBefore<quantity)throw new DomainError('INSUFFICIENT_STOCK','insufficient stock',{productId,warehouseId:sourceWarehouseId,available:sourceBefore,requested:quantity});const reserved=reservedQuantity(repository,productId,sourceWarehouseId),available=sourceBefore-reserved;if(available<quantity)throw new DomainError('INSUFFICIENT_AVAILABLE_STOCK','stock is reserved',{productId,warehouseId:sourceWarehouseId,physical:sourceBefore,reserved,available,requested:quantity});const targetBefore=repository.getBalance(productId,targetWarehouseId),sourceAfter=sourceBefore-quantity,targetAfter=targetBefore+quantity;changePosition(context,productId,sourceWarehouseId,-quantity);changePosition(targetContext,productId,targetWarehouseId,quantity);repository.setBalance(productId,sourceWarehouseId,sourceAfter);repository.setBalance(productId,targetWarehouseId,targetAfter);const out=writeMovement({type:'TRANSFER_OUT',productId,warehouseId:sourceWarehouseId,relatedWarehouseId:targetWarehouseId,quantity,delta:-quantity,before:sourceBefore,after:sourceAfter,transferId,reason,userId,context});const incoming=writeMovement({type:'TRANSFER_IN',productId,warehouseId:targetWarehouseId,relatedWarehouseId:sourceWarehouseId,quantity,delta:quantity,before:targetBefore,after:targetAfter,transferId,reason,userId,context:targetContext});return{transferId,out,incoming};});
      await publish({type:'stock.transferred',payload:{transferId,productId,sourceWarehouseId,targetWarehouseId,quantity}});return result;
    }
  };
}
