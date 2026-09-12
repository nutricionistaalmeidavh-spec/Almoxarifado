import path from 'node:path';
import { DomainError } from '../domain/shared/domain-error.mjs';
import { createCatalogService } from '../domain/catalog/catalog-service.mjs';
import { createStockService } from '../domain/stock/stock-service.mjs';
import { createInventoryService } from '../domain/inventory/inventory-service.mjs';
import { createAuthService } from '../domain/auth/auth-service.mjs';
import { createManagementService } from '../domain/management/management-service.mjs';
import { createPurchasingService } from '../domain/purchasing/purchasing-service.mjs';
import { createAdvancedStockService } from '../domain/stock/advanced-stock-service.mjs';
import { createCostService } from '../domain/costs/cost-service.mjs';
import { createBackupService } from '../domain/backup/backup-service.mjs';
import { buildDashboard, buildLabels, buildMovementCsv, buildStockCsv } from '../domain/reports/report-service.mjs';
import { createLocalApiExtensions } from './local-api-extensions.mjs';

function sendJson(res, status, body) { const json=JSON.stringify(body); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(json); }
function sendText(res,status,body,contentType='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store'});res.end(body);}
async function readJson(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new DomainError('PAYLOAD_TOO_LARGE','request body is too large');chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('INVALID_JSON','request body must be valid JSON');}}
function tokenFrom(req){const value=req.headers.authorization||'';if(value.startsWith('Bearer '))return value.slice(7).trim();return String(req.headers['x-session-token']||'').trim();}
function isLoopback(req){const address=String(req.socket?.remoteAddress||'');return address==='127.0.0.1'||address==='::1'||address==='::ffff:127.0.0.1';}
function statusFor(error){if(error.code==='AUTH_REQUIRED'||error.code==='INVALID_CREDENTIALS')return 401;if(error.code==='FORBIDDEN')return 403;if(error.code==='AUTH_THROTTLED')return 429;if(error.code==='PAYLOAD_TOO_LARGE'||error.code==='DOCUMENT_TOO_LARGE')return 413;if(error.code==='OCR_UNAVAILABLE'||error.code==='HARDWARE_UNAVAILABLE')return 503;if(/NOT_FOUND$/.test(error.code))return 404;return 400;}

export function createLocalApi({ repository, publish=async()=>{}, backupDir = path.resolve('.data/backups'), documentDir = path.resolve('.data/documents'), ocrAdapter = null, hardwareAdapter = null } = {}) {
  if(!repository)throw new TypeError('repository is required');
  const catalog=createCatalogService({repository});
  const stock=createStockService({repository,publish});
  const inventory=createInventoryService({repository,publish});
  const auth=createAuthService({repository});
  const management=createManagementService({repository});
  const costs=createCostService({repository});
  const purchasing=createPurchasingService({repository,stock,recordCost:(input)=>costs.recordReceipt(input)});
  const advanced=createAdvancedStockService({repository,stock});
  const backup=createBackupService({repository,backupDir});
  const extensions=createLocalApiExtensions({repository,auth,documentDir,ocrAdapter,hardwareAdapter});
  const publicUsers=()=>repository.listUsers().map(auth.publicUser);
  const bootstrap=(user)=>({
    user:auth.publicUser(user),
    dashboard:buildDashboard(repository), categories:repository.listCategories(), suppliers:repository.listSuppliers(), warehouses:repository.listWarehouses(), products:repository.listProducts(), balances:repository.listBalances(), movements:repository.listMovements().slice().reverse(), inventories:repository.listInventories().slice().reverse(),
    costCenters:repository.listCostCenters(), projects:repository.listProjects(), departments:repository.listDepartments(), purchaseRequests:repository.listPurchaseRequests().slice().reverse(), purchaseOrders:repository.listPurchaseOrders().slice().reverse(), receipts:repository.listReceipts().slice().reverse(), reservations:repository.listReservations().slice().reverse(), lots:repository.listLots(), serials:repository.listSerials(), transitTransfers:repository.listTransitTransfers().slice().reverse(), priceHistory:repository.listPriceHistory().slice().reverse(), users:user?.role==='ADMIN'?publicUsers():[]
  });

  return async function localApi(req,res){
    try{
      const url=new URL(req.url||'/','http://local'); const pathname=url.pathname;
      if(req.method==='GET'&&pathname==='/api/health')return sendJson(res,200,{status:'ok',mode:'local-lan'});
      if(req.method==='GET'&&pathname==='/api/auth/status')return sendJson(res,200,{needsBootstrap:auth.needsBootstrap()});
      if(req.method==='POST'&&pathname==='/api/auth/bootstrap'){if(!isLoopback(req))throw new DomainError('FORBIDDEN','initial administrator setup must be completed on the host PC');const body=await readJson(req);const user=auth.bootstrapAdmin(body.password);return sendJson(res,201,{user});}
      if(req.method==='POST'&&pathname==='/api/auth/login'){const body=await readJson(req);return sendJson(res,200,auth.authenticate(body.login,body.password));}
      const token=tokenFrom(req);
      if(req.method==='POST'&&pathname==='/api/auth/logout'){auth.session(token);auth.logout(token);return sendJson(res,200,{ok:true});}
      if(req.method==='GET'&&pathname==='/api/auth/me')return sendJson(res,200,auth.session(token));

      if(req.method==='GET'&&pathname==='/api/bootstrap'){const actor=auth.require(token,'stock.view');return sendJson(res,200,bootstrap(actor));}
      if(req.method==='POST'&&pathname==='/api/users'){const body=await readJson(req);const user=auth.createUser(token,body);return sendJson(res,201,{user});}

      if(req.method==='POST'&&pathname.startsWith('/api/catalog/')){
        auth.require(token,'catalog.manage'); const body=await readJson(req); const kind=pathname.slice('/api/catalog/'.length);
        const method=kind==='categories'?'saveCategory':kind==='suppliers'?'saveSupplier':kind==='warehouses'?'saveWarehouse':kind==='products'?'saveProduct':null;
        if(!method)return sendJson(res,404,{error:'NOT_FOUND'}); const item=catalog[method](body); return sendJson(res,201,{item,bootstrap:bootstrap(auth.session(token).user)});
      }
      if(req.method==='POST'&&pathname==='/api/stock/movements'){
        const body=await readJson(req); const permission=body.type==='ADJUSTMENT'?'stock.adjust':body.type==='TRANSFER'?'stock.transfer':'stock.create'; const actor=auth.require(token,permission); let result;
        const payload={...body,userId:actor.id}; if(body.type==='ENTRY')result=await stock.entry({...payload,quantity:Number(body.quantity)});else if(body.type==='EXIT')result=await stock.exit({...payload,quantity:Number(body.quantity)});else if(body.type==='ADJUSTMENT')result=await stock.adjust({...payload,newQuantity:Number(body.newQuantity)});else if(body.type==='TRANSFER')result=await stock.transfer({...payload,sourceWarehouseId:body.warehouseId||body.sourceWarehouseId,targetWarehouseId:body.targetWarehouseId,quantity:Number(body.quantity)});else throw new DomainError('INVALID_MOVEMENT_TYPE','unsupported movement type',{type:body.type}); return sendJson(res,201,{result,bootstrap:bootstrap(actor)});
      }
      if(req.method==='POST'&&pathname==='/api/inventories'){const actor=auth.require(token,'inventory.create');const body=await readJson(req);const item=await inventory.start({...body,userId:actor.id});return sendJson(res,201,{item,counts:inventory.listCounts(item.id),bootstrap:bootstrap(actor)});}
      const inventoryAction=pathname.match(/^\/api\/inventories\/([^/]+)\/(counts|recount|close)$/);
      if(req.method==='POST'&&inventoryAction){const[,inventoryId,name]=inventoryAction;const permission=name==='close'?'inventory.close':'inventory.count';const actor=auth.require(token,permission);const body=await readJson(req);let item;if(name==='counts')item=await inventory.count({inventoryId,productId:body.productId,quantity:Number(body.quantity),userId:actor.id});else if(name==='recount')item=await inventory.recount({inventoryId,productId:body.productId,quantity:Number(body.quantity),userId:actor.id});else item=await inventory.close({inventoryId,userId:actor.id});return sendJson(res,200,{item,counts:inventory.listCounts(inventoryId),bootstrap:bootstrap(actor)});}
      const counts=pathname.match(/^\/api\/inventories\/([^/]+)\/counts$/);if(req.method==='GET'&&counts){auth.require(token,'inventory.view');return sendJson(res,200,{items:inventory.listCounts(counts[1])});}

      const managementMap={ '/api/management/cost-centers':'saveCostCenter','/api/management/projects':'saveProject','/api/management/departments':'saveDepartment' };
      if(req.method==='POST'&&managementMap[pathname]){const actor=auth.require(token,'management.manage');const body=await readJson(req);const item=management[managementMap[pathname]](body);return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}

      if(req.method==='POST'&&pathname==='/api/purchases/requests'){const actor=auth.require(token,'purchases.create');const body=await readJson(req);const item=purchasing.createRequest({...body,requestedBy:actor.id});return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      const quoteRoute=pathname.match(/^\/api\/purchases\/requests\/([^/]+)\/quotes$/);if(req.method==='POST'&&quoteRoute){const actor=auth.require(token,'purchases.quote');const body=await readJson(req);const item=purchasing.addQuote({...body,requestId:quoteRoute[1],userId:actor.id});return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      const approveRoute=pathname.match(/^\/api\/purchases\/requests\/([^/]+)\/approve$/);if(req.method==='POST'&&approveRoute){const actor=auth.require(token,'purchases.approve');const item=purchasing.approveRequest({requestId:approveRoute[1],userId:actor.id});return sendJson(res,200,{item,bootstrap:bootstrap(actor)});}
      if(req.method==='POST'&&pathname==='/api/purchases/orders'){const actor=auth.require(token,'purchases.order');const body=await readJson(req);const item=purchasing.createOrder({...body,userId:actor.id});return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      const receiveRoute=pathname.match(/^\/api\/purchases\/orders\/([^/]+)\/receive$/);if(req.method==='POST'&&receiveRoute){const actor=auth.require(token,'purchases.receive');const item=await purchasing.receiveOrder({orderId:receiveRoute[1],userId:actor.id});return sendJson(res,200,{item,bootstrap:bootstrap(actor)});}

      if(req.method==='POST'&&pathname==='/api/advanced/reservations'){const actor=auth.require(token,'advanced-stock.manage');const body=await readJson(req);const item=advanced.reserve({...body,userId:actor.id,quantity:Number(body.quantity)});return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      const reservationRoute=pathname.match(/^\/api\/advanced\/reservations\/([^/]+)\/(release|consume)$/);if(req.method==='POST'&&reservationRoute){const actor=auth.require(token,'advanced-stock.manage');const body=await readJson(req);const item=reservationRoute[2]==='release'?advanced.releaseReservation({reservationId:reservationRoute[1],userId:actor.id}):await advanced.consumeReservation({reservationId:reservationRoute[1],userId:actor.id,reason:body.reason});return sendJson(res,200,{item,bootstrap:bootstrap(actor)});}
      if(req.method==='POST'&&pathname==='/api/advanced/lots'){const actor=auth.require(token,'advanced-stock.manage');const body=await readJson(req);const item=advanced.createLot(body);return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      if(req.method==='POST'&&pathname==='/api/advanced/serials'){const actor=auth.require(token,'advanced-stock.manage');const body=await readJson(req);const item=advanced.registerSerial(body);return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      for(const [route,method] of [['/api/advanced/loss','loss'],['/api/advanced/damage','damage'],['/api/advanced/returns','returnToStock']])if(req.method==='POST'&&pathname===route){const actor=auth.require(token,'advanced-stock.manage');const body=await readJson(req);const item=await advanced[method]({...body,userId:actor.id,quantity:Number(body.quantity)});return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      if(req.method==='POST'&&pathname==='/api/advanced/transfers/dispatch'){const actor=auth.require(token,'advanced-stock.manage');const body=await readJson(req);const item=await advanced.dispatchTransfer({...body,userId:actor.id,quantity:Number(body.quantity)});return sendJson(res,201,{item,bootstrap:bootstrap(actor)});}
      const transitReceive=pathname.match(/^\/api\/advanced\/transfers\/([^/]+)\/receive$/);if(req.method==='POST'&&transitReceive){const actor=auth.require(token,'advanced-stock.manage');const item=await advanced.receiveTransfer({transferId:transitReceive[1],userId:actor.id});return sendJson(res,200,{item,bootstrap:bootstrap(actor)});}

      if(req.method==='GET'&&pathname==='/api/costs/replenishment'){auth.require(token,'replenishment.view');return sendJson(res,200,{items:costs.replenishmentSuggestions({warehouseId:url.searchParams.get('warehouseId')||null})});}
      if(req.method==='GET'&&pathname==='/api/costs/history'){auth.require(token,'costs.view');return sendJson(res,200,{items:costs.priceHistory(url.searchParams.get('productId'))});}

      if(req.method==='GET'&&pathname==='/api/backups'){auth.require(token,'backup.manage');return sendJson(res,200,{items:backup.list().map(({filePath,...item})=>item)});}
      if(req.method==='POST'&&pathname==='/api/backups'){auth.require(token,'backup.manage');const item=backup.create('manual');return sendJson(res,201,{item:{name:item.name,createdAt:item.createdAt,reason:item.reason}});}
      if(req.method==='POST'&&pathname==='/api/backups/restore'){const actor=auth.require(token,'backup.manage');const body=await readJson(req);const found=backup.list().find((item)=>item.name===body.name);if(!found)throw new DomainError('BACKUP_NOT_FOUND','backup not found');const result=backup.restore(found.filePath);return sendJson(res,200,{result:{createdAt:result.createdAt},bootstrap:bootstrap(actor)});}
      if(req.method==='GET'&&pathname==='/api/backup/export'){auth.require(token,'backup.manage');return sendJson(res,200,backup.exportPayload());}
      if(req.method==='POST'&&pathname==='/api/backup/import'){const actor=auth.require(token,'backup.manage');const body=await readJson(req);backup.importPayload(body);return sendJson(res,200,{bootstrap:bootstrap(actor)});}

      if(req.method==='GET'&&pathname==='/api/reports/stock.csv'){auth.require(token,'reports.export');return sendText(res,200,buildStockCsv(repository),'text/csv; charset=utf-8');}
      if(req.method==='GET'&&pathname==='/api/reports/movements.csv'){auth.require(token,'reports.export');return sendText(res,200,buildMovementCsv(repository),'text/csv; charset=utf-8');}
      if(req.method==='GET'&&pathname==='/api/reports/labels'){auth.require(token,'reports.export');return sendJson(res,200,{items:buildLabels(repository)});}
      if(await extensions(req,res,url,token))return;
      return sendJson(res,404,{error:'NOT_FOUND'});
    }catch(error){if(error instanceof DomainError)return sendJson(res,statusFor(error),{error:error.code,message:error.message,details:error.details});console.error(error);return sendJson(res,500,{error:'INTERNAL_ERROR',message:'internal local server error'});}
  };
}
