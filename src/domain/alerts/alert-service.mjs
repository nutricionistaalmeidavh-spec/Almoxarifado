function daysBetween(a,b){return Math.floor((b-a)/86400000);}
function alert(type,severity,entityType,entityId,message,details={}){return{id:`${type}:${entityType}:${entityId}`,type,severity,entityType,entityId,message,details};}
export function createAlertService({repository,now=()=>new Date()}={}){
  if(!repository)throw new TypeError('repository is required');
  return{
    list(){const current=now() instanceof Date?now():new Date(now()),items=[];
      for(const product of repository.listProducts().filter(p=>p.active!==false))for(const warehouse of repository.listWarehouses().filter(w=>w.active!==false)){const balance=repository.getBalance(product.id,warehouse.id),min=Number(product.minStock??0);if(min>0&&balance<min)items.push(alert('LOW_STOCK',balance<=0?'critical':'warning','product',`${product.id}:${warehouse.id}`,`${product.name} abaixo do estoque mínimo`,{productId:product.id,warehouseId:warehouse.id,balance,minStock:min}));}
      for(const lot of repository.listLots().filter(l=>l.active!==false&&l.expiresAt)){const expiry=new Date(lot.expiresAt),days=daysBetween(current,expiry);if(days>=0&&days<=90)items.push(alert('EXPIRING_LOT',days<=7?'critical':days<=30?'warning':'info','lot',lot.id,`Lote ${lot.code} vence em ${days} dia(s)`,{days,expiresAt:lot.expiresAt,productId:lot.productId,warehouseId:lot.warehouseId}));}
      for(const order of repository.listPurchaseOrders().filter(o=>!['RECEIVED','CANCELLED'].includes(o.status)&&o.expectedAt&&new Date(o.expectedAt)<current))items.push(alert('PURCHASE_OVERDUE','warning','purchaseOrder',order.id,'Pedido de compra atrasado',{expectedAt:order.expectedAt,supplierId:order.supplierId}));
      for(const checkout of repository.listAssetCheckouts?.().filter(x=>x.status==='OPEN'&&x.expectedCheckinAt&&new Date(x.expectedCheckinAt)<current)??[])items.push(alert('ASSET_OVERDUE','warning','asset',checkout.assetId,'Ferramenta com devolução vencida',{checkoutId:checkout.id,expectedCheckinAt:checkout.expectedCheckinAt}));
      for(const cycle of repository.listCycleCounts?.().filter(x=>x.status==='OPEN'&&x.nextDueAt&&new Date(x.nextDueAt)<current)??[])items.push(alert('INVENTORY_OVERDUE','warning','cycleCount',cycle.id,'Inventário cíclico vencido',{warehouseId:cycle.warehouseId,nextDueAt:cycle.nextDueAt}));
      const backupEvent=repository.listAlertEvents?.().filter(x=>x.type==='BACKUP_FAILURE'&&!x.acknowledgedAt).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];if(backupEvent)items.push({...backupEvent,id:backupEvent.id||`BACKUP_FAILURE:${backupEvent.createdAt}`});
      return items.sort((a,b)=>({critical:0,warning:1,info:2}[a.severity]??3)-({critical:0,warning:1,info:2}[b.severity]??3));
    },
    recordBackupFailure({message='Falha no backup automático',details={},createdAt=null}={}){const item={id:`backup:${createdAt??new Date().toISOString()}`,type:'BACKUP_FAILURE',severity:'critical',entityType:'backup',entityId:'local',message,details,createdAt:createdAt??new Date().toISOString(),acknowledgedAt:null};return repository.saveAlertEvent(item);},
    acknowledge(id,userId){const item=repository.getAlertEvent(id);if(!item)return null;return repository.saveAlertEvent({...item,acknowledgedAt:new Date().toISOString(),acknowledgedBy:userId});}
  };
}
