import { DomainError } from '../domain/shared/domain-error.mjs';
import { createStockService } from '../domain/stock/stock-service.mjs';
import { createCostService } from '../domain/costs/cost-service.mjs';
import { createCustomFieldService } from '../domain/custom-fields/custom-field-service.mjs';
import { createApprovalService } from '../domain/approvals/approval-service.mjs';
import { createSupplierKpiService } from '../domain/suppliers/supplier-kpi-service.mjs';
import { createMaintenanceService } from '../domain/maintenance/maintenance-service.mjs';
import { createKitService } from '../domain/kits/kit-service.mjs';
import { createNfeService } from '../domain/nfe/nfe-service.mjs';

function sendJson(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));return true;}
async function readJson(req,maxBytes=4*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw new DomainError('PAYLOAD_TOO_LARGE','request body is too large',{maxBytes});chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('INVALID_JSON','request body must be valid JSON');}}

export function createP2ApiExtensions({repository,auth}={}){
  if(!repository||!auth)throw new TypeError('repository and auth are required');
  const stock=createStockService({repository});
  const costs=createCostService({repository});
  const customFields=createCustomFieldService({repository});
  const approvals=createApprovalService({repository});
  const supplierKpi=createSupplierKpiService({repository});
  const maintenance=createMaintenanceService({repository});
  const kits=createKitService({repository,stock});
  const nfe=createNfeService({repository,stock,recordCost:(input)=>costs.recordReceipt(input)});
  const bootstrap=()=>({
    customFieldDefinitions:customFields.listDefinitions(),approvalRules:approvals.listRules(),approvalInstances:repository.listApprovalInstances(),maintenancePlans:repository.listMaintenancePlans(),calibrationRecords:repository.listCalibrationRecords(),kits:kits.list(),nfeImports:repository.listNfeImports(),supplierKpis:supplierKpi.ranking(),assets:repository.listAssets(),products:repository.listProducts(),suppliers:repository.listSuppliers(),warehouses:repository.listWarehouses(),users:repository.listUsers().map(auth.publicUser)
  });
  return async function handleP2(req,res,url,token){
    const pathname=url.pathname;
    if(req.method==='GET'&&pathname==='/api/p2/bootstrap'){auth.require(token,'stock.view');return sendJson(res,200,bootstrap());}

    if(req.method==='GET'&&pathname==='/api/custom-fields/definitions'){auth.require(token,'custom-fields.view');return sendJson(res,200,{items:customFields.listDefinitions(url.searchParams.get('entityType')||null)});}
    if(req.method==='POST'&&pathname==='/api/custom-fields/definitions'){auth.require(token,'custom-fields.manage');return sendJson(res,201,{item:customFields.createDefinition(await readJson(req))});}
    if(req.method==='GET'&&pathname==='/api/custom-fields/values'){auth.require(token,'custom-fields.view');return sendJson(res,200,{values:customFields.getValues(url.searchParams.get('entityType'),url.searchParams.get('entityId'))});}
    if(req.method==='POST'&&pathname==='/api/custom-fields/values'){const actor=auth.require(token,'custom-fields.manage');const body=await readJson(req);return sendJson(res,200,{items:customFields.setValues({...body,userId:actor.id})});}

    if(req.method==='GET'&&pathname==='/api/approvals/rules'){auth.require(token,'approvals.view');return sendJson(res,200,{items:approvals.listRules(url.searchParams.get('scope')||null)});}
    if(req.method==='POST'&&pathname==='/api/approvals/rules'){auth.require(token,'approvals.manage');return sendJson(res,201,{item:approvals.saveRule(await readJson(req))});}
    if(req.method==='GET'&&pathname==='/api/approvals'){auth.require(token,'approvals.view');return sendJson(res,200,{items:repository.listApprovalInstances()});}
    if(req.method==='POST'&&pathname==='/api/approvals/request'){const actor=auth.require(token,'approvals.request');const body=await readJson(req);return sendJson(res,201,{item:approvals.request({...body,requestedBy:actor.id})});}
    const approvalAction=pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);if(req.method==='POST'&&approvalAction){const actor=auth.require(token,'approvals.approve');const body=await readJson(req);const item=approvalAction[2]==='approve'?approvals.approve({approvalId:approvalAction[1],userId:actor.id}):approvals.reject({approvalId:approvalAction[1],userId:actor.id,reason:body.reason});return sendJson(res,200,{item});}

    if(req.method==='GET'&&pathname==='/api/suppliers/kpi'){auth.require(token,'suppliers.kpi.view');const supplierId=url.searchParams.get('supplierId');return sendJson(res,200,supplierId?{item:supplierKpi.summary(supplierId)}:{items:supplierKpi.ranking()});}

    if(req.method==='GET'&&pathname==='/api/maintenance/plans'){auth.require(token,'maintenance.view');return sendJson(res,200,{items:maintenance.listPlans(url.searchParams.get('assetId')||null)});}
    if(req.method==='POST'&&pathname==='/api/maintenance/plans'){auth.require(token,'maintenance.manage');return sendJson(res,201,{item:maintenance.savePlan(await readJson(req))});}
    if(req.method==='GET'&&pathname==='/api/maintenance/due'){auth.require(token,'maintenance.view');return sendJson(res,200,{items:maintenance.due({days:Number(url.searchParams.get('days')||30),type:url.searchParams.get('type')||null})});}
    const completePlan=pathname.match(/^\/api\/maintenance\/plans\/([^/]+)\/complete$/);if(req.method==='POST'&&completePlan){const actor=auth.require(token,'maintenance.manage');const body=await readJson(req);return sendJson(res,200,maintenance.complete({...body,planId:completePlan[1],userId:actor.id}));}

    if(req.method==='GET'&&pathname==='/api/kits'){auth.require(token,'kits.view');return sendJson(res,200,{items:kits.list()});}
    if(req.method==='POST'&&pathname==='/api/kits'){auth.require(token,'kits.manage');return sendJson(res,201,{item:kits.saveKit(await readJson(req))});}
    if(req.method==='GET'&&pathname==='/api/kits/availability'){auth.require(token,'kits.view');return sendJson(res,200,{available:kits.availability({kitId:url.searchParams.get('kitId'),warehouseId:url.searchParams.get('warehouseId')})});}
    const issueKit=pathname.match(/^\/api\/kits\/([^/]+)\/issue$/);if(req.method==='POST'&&issueKit){const actor=auth.require(token,'kits.manage');const body=await readJson(req);return sendJson(res,200,await kits.issue({...body,kitId:issueKit[1],userId:actor.id}));}

    if(req.method==='POST'&&pathname==='/api/nfe/preview'){auth.require(token,'nfe.view');const body=await readJson(req);return sendJson(res,200,nfe.preview(body.xml));}
    if(req.method==='POST'&&pathname==='/api/nfe/apply'){const actor=auth.require(token,'nfe.manage');const body=await readJson(req);return sendJson(res,200,{item:await nfe.apply({...body,userId:actor.id,commitStock:Boolean(body.commitStock)})});}
    return false;
  };
}
