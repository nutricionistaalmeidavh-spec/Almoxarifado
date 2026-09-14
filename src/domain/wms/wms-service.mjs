import { randomUUID } from 'node:crypto';
import { DomainError, requireId, requireNonNegativeNumber, requirePositiveNumber } from '../shared/domain-error.mjs';

function active(entity,code,label,id){if(!entity||entity.active===false)throw new DomainError(code,`${label} not found`,{id});return entity;}
function normalizeCode(value){const code=String(value??'').trim().toUpperCase();if(!code)throw new DomainError('INVALID_INPUT','code is required');return code;}
function stripExpected(line){const {expectedQuantity,...safe}=line;return safe;}

export function createWmsService({repository,stock,now=()=>new Date().toISOString(),idFactory=randomUUID}={}){
  if(!repository||!stock)throw new TypeError('repository and stock are required');
  const location=(id)=>active(repository.getLocation(requireId(id,'locationId')),'LOCATION_NOT_FOUND','location',id);
  const cycle=(id)=>{const item=repository.getCycleCount(requireId(id,'cycleCountId'));if(!item)throw new DomainError('CYCLE_COUNT_NOT_FOUND','cycle count not found',{id});return item;};
  const cycleLine=(cycleCountId,lineId)=>{const line=repository.getCycleCountLine(requireId(lineId,'lineId'));if(!line||line.cycleCountId!==cycleCountId)throw new DomainError('CYCLE_COUNT_LINE_NOT_FOUND','cycle count line not found',{cycleCountId,lineId});return line;};
  const openCycle=(id)=>{const item=cycle(id);if(item.status!=='OPEN')throw new DomainError('CYCLE_COUNT_NOT_OPEN','cycle count is not open',{id,status:item.status});return item;};
  const positionsFor=({warehouseId,locationIds=null,productIds=null}={})=>repository.listStockPositions().filter(p=>p.active!==false&&Number(p.quantity)>0&&(!warehouseId||p.warehouseId===warehouseId)&&(!locationIds?.length||locationIds.includes(p.locationId))&&(!productIds?.length||productIds.includes(p.productId)));

  return{
    createLocation({warehouseId,parentId=null,code,name,type='POSITION',active:enabled=true}={}){
      active(repository.getWarehouse(requireId(warehouseId,'warehouseId')),'WAREHOUSE_NOT_FOUND','warehouse',warehouseId);
      const normalized=normalizeCode(code);
      if(repository.listLocations().some(item=>item.warehouseId===warehouseId&&String(item.code).toUpperCase()===normalized&&item.active!==false))throw new DomainError('LOCATION_CODE_EXISTS','location code already exists',{warehouseId,code:normalized});
      if(parentId){const parent=location(parentId);if(parent.warehouseId!==warehouseId)throw new DomainError('LOCATION_PARENT_WAREHOUSE_MISMATCH','parent location belongs to another warehouse',{parentId,warehouseId});}
      const allowed=new Set(['ZONE','AISLE','RACK','LEVEL','POSITION','RECEIVING','STAGING']);const normalizedType=String(type??'POSITION').toUpperCase();if(!allowed.has(normalizedType))throw new DomainError('INVALID_LOCATION_TYPE','invalid location type',{type});
      const item={id:idFactory(),warehouseId,parentId,code:normalized,name:String(name??normalized).trim()||normalized,type:normalizedType,active:enabled!==false,createdAt:now()};
      return repository.saveLocation(item);
    },
    locationPath(locationId){const result=[];const seen=new Set();let current=location(locationId);while(current){if(seen.has(current.id))throw new DomainError('LOCATION_CYCLE','location hierarchy contains a cycle',{locationId});seen.add(current.id);result.unshift(current);current=current.parentId?repository.getLocation(current.parentId):null;}return result;},
    resolveScan({code}={}){const raw=String(code??'').trim();if(!raw)throw new DomainError('INVALID_SCAN','scan code is required');const upper=raw.toUpperCase();const loc=repository.listLocations().find(x=>x.active!==false&&String(x.code).toUpperCase()===upper);if(loc)return{kind:'location',item:loc,path:this.locationPath(loc.id)};const product=repository.listProducts().find(x=>x.active!==false&&(String(x.barcode??'')===raw||String(x.sku??'').toUpperCase()===upper));if(product)return{kind:'product',item:product};const serial=repository.listSerials().find(x=>x.active!==false&&String(x.serial)===raw);if(serial)return{kind:'serial',item:serial};throw new DomainError('SCAN_NOT_FOUND','no location, product or serial matches scan',{code:raw});},
    recommendPick({productId,warehouseId,quantity}={}){
      const product=active(repository.getProduct(requireId(productId,'productId')),'PRODUCT_NOT_FOUND','product',productId);active(repository.getWarehouse(requireId(warehouseId,'warehouseId')),'WAREHOUSE_NOT_FOUND','warehouse',warehouseId);const requested=Number(quantity);requirePositiveNumber(requested);
      const strategy=String(product.removalStrategy??'MANUAL').toUpperCase();const lots=new Map(repository.listLots().map(x=>[x.id,x]));const locations=new Map(repository.listLocations().map(x=>[x.id,x]));
      const rows=positionsFor({warehouseId,productIds:[productId]}).slice().sort((a,b)=>{
        if(strategy==='FEFO'){const ae=Date.parse(lots.get(a.lotId)?.expiresAt??'9999-12-31'),be=Date.parse(lots.get(b.lotId)?.expiresAt??'9999-12-31');if(ae!==be)return ae-be;}
        if(strategy==='FIFO'||strategy==='FEFO'){const at=Date.parse(a.receivedAt??a.createdAt??0),bt=Date.parse(b.receivedAt??b.createdAt??0);if(at!==bt)return at-bt;}
        return String(locations.get(a.locationId)?.code??a.locationId).localeCompare(String(locations.get(b.locationId)?.code??b.locationId));
      });
      let remaining=requested;const plan=[];for(const row of rows){if(remaining<=0)break;const amount=Math.min(remaining,Number(row.quantity));if(amount<=0)continue;plan.push({positionId:row.id,productId,rowWarehouseId:row.warehouseId,warehouseId:row.warehouseId,locationId:row.locationId,lotId:row.lotId??null,serialId:row.serialId??null,quantity:amount});remaining-=amount;}
      if(remaining>0)throw new DomainError('INSUFFICIENT_POSITION_STOCK','tracked positions do not contain requested quantity',{productId,warehouseId,requested,planned:requested-remaining});return plan;
    },
    startCycleCount({warehouseId,locationIds=null,productIds=null,userId,requireRecount=true}={}){
      active(repository.getWarehouse(requireId(warehouseId,'warehouseId')),'WAREHOUSE_NOT_FOUND','warehouse',warehouseId);active(repository.getUser(requireId(userId,'userId')),'USER_NOT_FOUND','user',userId);
      if(locationIds)for(const id of locationIds){const loc=location(id);if(loc.warehouseId!==warehouseId)throw new DomainError('LOCATION_WAREHOUSE_MISMATCH','cycle count location belongs to another warehouse',{locationId:id,warehouseId});}
      const id=idFactory();const rows=positionsFor({warehouseId,locationIds,productIds});const session=repository.saveCycleCount({id,warehouseId,locationIds:locationIds??[],productIds:productIds??[],status:'OPEN',requireRecount:requireRecount!==false,startedAt:now(),startedBy:userId,completedAt:null,completedBy:null,lineCount:rows.length});
      for(const position of rows)repository.saveCycleCountLine({id:idFactory(),cycleCountId:id,positionId:position.id,productId:position.productId,warehouseId:position.warehouseId,locationId:position.locationId,lotId:position.lotId??null,serialId:position.serialId??null,expectedQuantity:Number(position.quantity),firstCount:null,secondCount:null,finalQuantity:null,status:'PENDING',countedBy:null,countedAt:null,recountedBy:null,recountedAt:null});
      return session;
    },
    listCycleCountLines(cycleCountId,{revealExpected=false}={}){cycle(cycleCountId);const rows=repository.listCycleCountLines(cycleCountId).sort((a,b)=>String(a.locationId).localeCompare(String(b.locationId))||String(a.productId).localeCompare(String(b.productId)));return revealExpected?rows:rows.map(stripExpected);},
    countCycleLine({cycleCountId,lineId,quantity,userId}={}){const session=openCycle(cycleCountId);active(repository.getUser(requireId(userId,'userId')),'USER_NOT_FOUND','user',userId);const amount=Number(quantity);requireNonNegativeNumber(amount,'quantity');const line=cycleLine(cycleCountId,lineId);const matches=amount===Number(line.expectedQuantity);const status=matches||session.requireRecount===false?'COUNTED':'NEEDS_RECOUNT';return repository.saveCycleCountLine({...line,firstCount:amount,finalQuantity:matches||session.requireRecount===false?amount:null,status,countedBy:userId,countedAt:now()});},
    recountCycleLine({cycleCountId,lineId,quantity,userId}={}){openCycle(cycleCountId);active(repository.getUser(requireId(userId,'userId')),'USER_NOT_FOUND','user',userId);const amount=Number(quantity);requireNonNegativeNumber(amount,'quantity');const line=cycleLine(cycleCountId,lineId);if(line.firstCount==null)throw new DomainError('INITIAL_COUNT_REQUIRED','initial cycle count is required',{lineId});return repository.saveCycleCountLine({...line,secondCount:amount,finalQuantity:amount,status:'COUNTED',recountedBy:userId,recountedAt:now()});},
    async closeCycleCount({cycleCountId,userId}={}){const session=openCycle(cycleCountId);active(repository.getUser(requireId(userId,'userId')),'USER_NOT_FOUND','user',userId);const lines=repository.listCycleCountLines(cycleCountId);const pending=lines.filter(x=>x.status!=='COUNTED'||x.finalQuantity==null);if(pending.length)throw new DomainError('CYCLE_COUNT_INCOMPLETE','all cycle count lines must be completed',{pendingLineIds:pending.map(x=>x.id)});let adjustments=0;for(const line of lines){const delta=Number(line.finalQuantity)-Number(line.expectedQuantity);if(!delta)continue;const context={locationId:line.locationId,lotId:line.lotId,serialId:line.serialId};if(delta>0)await stock.entry({productId:line.productId,warehouseId:line.warehouseId,quantity:delta,userId,reason:`Ajuste contagem cíclica ${cycleCountId}`,movementType:'CYCLE_ADJUSTMENT',...context});else await stock.exit({productId:line.productId,warehouseId:line.warehouseId,quantity:Math.abs(delta),userId,reason:`Ajuste contagem cíclica ${cycleCountId}`,movementType:'CYCLE_ADJUSTMENT',...context});adjustments++;}
      return repository.saveCycleCount({...session,status:'CLOSED',completedAt:now(),completedBy:userId,adjustments});
    },
    async executeMobileAction({action,productId,warehouseId,locationId,sourceLocationId,targetLocationId,quantity,userId,lotId=null,serialId=null,reason=''}={}){
      const type=String(action??'').toUpperCase();const amount=Number(quantity);if(type==='COUNT')throw new DomainError('CYCLE_COUNT_CONTEXT_REQUIRED','count action requires a cycle count line');requirePositiveNumber(amount);
      if(['RECEIVE','RETURN'].includes(type))return stock.entry({productId,warehouseId,locationId,quantity:amount,userId,lotId,serialId,reason:reason||type,movementType:type==='RETURN'?'RETURN':'ENTRY'});
      if(type==='PICK')return stock.exit({productId,warehouseId,locationId,quantity:amount,userId,lotId,serialId,reason:reason||'Picking',movementType:'EXIT'});
      if(['PUTAWAY','MOVE'].includes(type)){requireId(sourceLocationId,'sourceLocationId');requireId(targetLocationId,'targetLocationId');if(sourceLocationId===targetLocationId)throw new DomainError('INVALID_LOCATION_MOVE','source and target locations must differ');return repository.transaction(async()=>{const out=await stock.exit({productId,warehouseId,locationId:sourceLocationId,quantity:amount,userId,lotId,serialId,reason:reason||'Movimentação interna',movementType:'LOCATION_MOVE_OUT'});const incoming=await stock.entry({productId,warehouseId,locationId:targetLocationId,quantity:amount,userId,lotId,serialId,reason:reason||'Movimentação interna',movementType:'LOCATION_MOVE_IN'});return{out,incoming};});}
      throw new DomainError('INVALID_WMS_ACTION','unsupported WMS mobile action',{action:type});
    }
  };
}
