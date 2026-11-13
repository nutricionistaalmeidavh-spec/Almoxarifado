import { randomUUID } from 'node:crypto';
import { DomainError, requireId, requirePositiveNumber } from '../shared/domain-error.mjs';

export function createQualityService({repository,stock,now=()=>new Date().toISOString(),idFactory=randomUUID}={}){
  if(!repository||!stock)throw new TypeError('repository and stock are required');
  const get=(id)=>{const item=repository.getQualityHold(id);if(!item)throw new DomainError('QUALITY_HOLD_NOT_FOUND','quality hold not found',{id});return item;};
  const ensureQty=(hold,quantity)=>{requirePositiveNumber(Number(quantity));if(hold.status!=='OPEN'||Number(quantity)>Number(hold.remainingQuantity))throw new DomainError('QUALITY_QUANTITY_INVALID','quantity exceeds open quarantine',{remaining:hold.remainingQuantity,quantity});};
  return{
    list(){return repository.listQualityHolds();},get,
    holdReceipt({productId,warehouseId,locationId=null,lotId=null,serialId=null,quantity,userId,sourceType='MANUAL',sourceId=null,notes=null}){requireId(productId,'productId');requireId(warehouseId,'warehouseId');requireId(userId,'userId');requirePositiveNumber(Number(quantity));if(!repository.getProduct(productId))throw new DomainError('PRODUCT_NOT_FOUND','product not found',{productId});if(!repository.getWarehouse(warehouseId))throw new DomainError('WAREHOUSE_NOT_FOUND','warehouse not found',{warehouseId});if(!String(sourceId??'').trim())throw new DomainError('QUALITY_SOURCE_REQUIRED','origin reference is required for unposted material');
      const related=repository.getReceipt?.(sourceId);
      if(related&&related.items?.some(x=>x.productId===productId&&Number(x.acceptedQuantity||0)>0))throw new DomainError('QUALITY_ALREADY_POSTED','material from this receipt was already posted to stock');
      if(repository.listQualityHolds().some(x=>x.sourceType===sourceType&&x.sourceId===sourceId&&x.productId===productId&&x.status==='OPEN'))throw new DomainError('QUALITY_SOURCE_DUPLICATED','source already has an open hold');
      return repository.saveQualityHold({id:idFactory(),productId,warehouseId,locationId,lotId,serialId,quantity:Number(quantity),remainingQuantity:Number(quantity),releasedQuantity:0,rejectedQuantity:0,status:'OPEN',sourceType,sourceId,notes,createdAt:now(),createdBy:userId});},
    quarantinedQuantity(productId,warehouseId){return repository.listQualityHolds().filter(x=>x.productId===productId&&x.warehouseId===warehouseId&&x.status==='OPEN').reduce((sum,x)=>sum+Number(x.remainingQuantity||0),0);},
    async release({holdId,quantity,userId,locationId=null,reason='Liberado pela qualidade'}){
      requireId(userId,'userId');
      return repository.transaction(async()=>{
        const hold=get(holdId);ensureQty(hold,quantity);
        const movement=await stock.entry({productId:hold.productId,warehouseId:hold.warehouseId,quantity:Number(quantity),userId,reason,movementType:'QUALITY_RELEASE',locationId:locationId??hold.locationId,lotId:hold.lotId,serialId:hold.serialId});
        const remaining=Number(hold.remainingQuantity)-Number(quantity);
        const saved=repository.saveQualityHold({...hold,remainingQuantity:remaining,releasedQuantity:Number(hold.releasedQuantity||0)+Number(quantity),status:remaining===0?'RELEASED':'OPEN',lastReleasedAt:now(),lastReleasedBy:userId,closedAt:remaining===0?now():null});
        return {hold:saved,movement};
      });
    },
    reject({holdId,quantity,userId,reason='Reprovado pela qualidade'}){requireId(userId,'userId');const hold=get(holdId);ensureQty(hold,quantity);const remaining=Number(hold.remainingQuantity)-Number(quantity);return repository.saveQualityHold({...hold,remainingQuantity:remaining,rejectedQuantity:Number(hold.rejectedQuantity||0)+Number(quantity),status:remaining===0?'REJECTED':'OPEN',rejectReason:reason,lastRejectedAt:now(),lastRejectedBy:userId,closedAt:remaining===0?now():null});}
  };
}
