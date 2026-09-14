import { DomainError } from '../domain/shared/domain-error.mjs';
import { createStockService } from '../domain/stock/stock-service.mjs';
import { createAssetService } from '../domain/assets/asset-service.mjs';
import { createSupplyService } from '../domain/supply/supply-service.mjs';
import { createQualityService } from '../domain/quality/quality-service.mjs';
import { createCostService } from '../domain/costs/cost-service.mjs';
import { createAlertService } from '../domain/alerts/alert-service.mjs';

function sendJson(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));return true;}
async function readJson(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new DomainError('PAYLOAD_TOO_LARGE','request body is too large');chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('INVALID_JSON','request body must be valid JSON');}}

export function createP1ApiExtensions({repository,auth}={}){
  if(!repository||!auth)throw new TypeError('repository and auth are required');
  const stock=createStockService({repository});
  const assets=createAssetService({repository});
  const supply=createSupplyService({repository});
  const quality=createQualityService({repository,stock});
  const costs=createCostService({repository});
  const alerts=createAlertService({repository});
  const bootstrap=()=>({assets:repository.listAssets(),assetCheckouts:repository.listAssetCheckouts(),assetMaintenance:repository.listAssetMaintenance(),productSuppliers:repository.listProductSuppliers(),unitConversions:repository.listUnitConversions(),qualityHolds:repository.listQualityHolds(),suppliers:repository.listSuppliers(),products:repository.listProducts(),warehouses:repository.listWarehouses(),projects:repository.listProjects(),users:repository.listUsers().map(auth.publicUser),alerts:alerts.list()});
  return async function handleP1(req,res,url,token){
    const pathname=url.pathname;
    if(req.method==='GET'&&pathname==='/api/p1/bootstrap'){auth.require(token,'stock.view');return sendJson(res,200,bootstrap());}
    if(req.method==='GET'&&pathname==='/api/assets'){auth.require(token,'assets.view');return sendJson(res,200,{items:assets.list()});}
    if(req.method==='POST'&&pathname==='/api/assets'){auth.require(token,'assets.manage');return sendJson(res,201,{item:assets.saveAsset(await readJson(req))});}
    const assetAction=pathname.match(/^\/api\/assets\/([^/]+)\/(checkout|checkin|lost)$/);if(req.method==='POST'&&assetAction){const actor=auth.require(token,'assets.manage');const body=await readJson(req);const input={...body,assetId:assetAction[1],userId:actor.id};const item=assetAction[2]==='checkout'?assets.checkout(input):assetAction[2]==='checkin'?assets.checkin(input):assets.markLost(input);return sendJson(res,200,{item});}
    const maintenance=pathname.match(/^\/api\/assets\/([^/]+)\/maintenance\/(start|finish)$/);if(req.method==='POST'&&maintenance){const actor=auth.require(token,'assets.manage');const body=await readJson(req);const item=maintenance[2]==='start'?assets.startMaintenance({...body,assetId:maintenance[1],userId:actor.id}):assets.finishMaintenance({...body,assetId:maintenance[1],userId:actor.id});return sendJson(res,200,{item});}
    const history=pathname.match(/^\/api\/assets\/([^/]+)\/history$/);if(req.method==='GET'&&history){auth.require(token,'assets.view');return sendJson(res,200,{items:assets.history(history[1])});}

    if(req.method==='GET'&&pathname==='/api/supply/product-suppliers'){auth.require(token,'stock.view');return sendJson(res,200,{items:supply.listProductSuppliers(url.searchParams.get('productId')||null)});}
    if(req.method==='POST'&&pathname==='/api/supply/product-suppliers'){auth.require(token,'catalog.manage');return sendJson(res,201,{item:supply.linkSupplier(await readJson(req))});}
    if(req.method==='GET'&&pathname==='/api/supply/unit-conversions'){auth.require(token,'stock.view');return sendJson(res,200,{items:supply.listUnitConversions(url.searchParams.get('productId')||null)});}
    if(req.method==='POST'&&pathname==='/api/supply/unit-conversions'){auth.require(token,'catalog.manage');return sendJson(res,201,{item:supply.saveUnitConversion(await readJson(req))});}
    if(req.method==='POST'&&pathname==='/api/supply/convert'){auth.require(token,'stock.view');const body=await readJson(req);return sendJson(res,200,{baseQuantity:supply.toBaseQuantity({...body,quantity:Number(body.quantity)})});}
    if(req.method==='GET'&&pathname==='/api/supply/barcode'){auth.require(token,'stock.view');return sendJson(res,200,{result:supply.resolveBarcode(url.searchParams.get('code'))});}

    if(req.method==='GET'&&pathname==='/api/quality/holds'){auth.require(token,'quality.view');return sendJson(res,200,{items:quality.list()});}
    if(req.method==='POST'&&pathname==='/api/quality/holds'){const actor=auth.require(token,'quality.manage');const body=await readJson(req);return sendJson(res,201,{item:quality.holdReceipt({...body,userId:actor.id,quantity:Number(body.quantity)})});}
    const qualityAction=pathname.match(/^\/api\/quality\/holds\/([^/]+)\/(release|reject)$/);if(req.method==='POST'&&qualityAction){const actor=auth.require(token,'quality.manage');const body=await readJson(req);const input={...body,holdId:qualityAction[1],userId:actor.id,quantity:Number(body.quantity)};const item=qualityAction[2]==='release'?await quality.release(input):quality.reject(input);return sendJson(res,200,{item});}

    if(req.method==='GET'&&pathname==='/api/replenishment/advanced'){auth.require(token,'replenishment.view');return sendJson(res,200,{items:costs.advancedReplenishmentSuggestions({warehouseId:url.searchParams.get('warehouseId')||null,days:Number(url.searchParams.get('days')||30),safetyDays:Number(url.searchParams.get('safetyDays')||7)})});}
    if(req.method==='GET'&&pathname==='/api/alerts'){auth.require(token,'stock.view');return sendJson(res,200,{items:alerts.list()});}
    const ack=pathname.match(/^\/api\/alerts\/([^/]+)\/ack$/);if(req.method==='POST'&&ack){const actor=auth.require(token,'stock.view');return sendJson(res,200,{item:alerts.acknowledge(ack[1],actor.id)});}
    return false;
  };
}
