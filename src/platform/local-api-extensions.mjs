import path from 'node:path';
import { DomainError } from '../domain/shared/domain-error.mjs';
import { createDocumentService } from '../domain/documents/document-service.mjs';
import { createAnalyticsService } from '../domain/analytics/analytics-service.mjs';
import { createHardwareSettingsService } from '../domain/hardware/hardware-settings-service.mjs';
import { createDocumentStorage } from './document-storage.mjs';
import { createP1ApiExtensions } from './p1-api-extensions.mjs';

function sendJson(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function sendText(res,status,body,contentType='text/plain; charset=utf-8',headers={}){res.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store',...headers});res.end(body);}
async function readJson(req,maxBytes=2*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw new DomainError('PAYLOAD_TOO_LARGE','request body is too large',{maxBytes});chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('INVALID_JSON','request body must be valid JSON');}}
function decodeBase64(value){const raw=String(value??'').replace(/\s/g,'');if(!raw)throw new DomainError('INVALID_DOCUMENT','contentBase64 is required');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)||raw.length%4!==0)throw new DomainError('INVALID_DOCUMENT','contentBase64 is invalid');const bytes=Buffer.from(raw,'base64');const canonical=bytes.toString('base64').replace(/=+$/,'');if(canonical!==raw.replace(/=+$/,''))throw new DomainError('INVALID_DOCUMENT','contentBase64 is invalid');return bytes;}
function documentMeta(item){if(!item)return item;const{bytes,...meta}=item;return meta;}
function filtersFrom(url){const out={};for(const key of ['from','to','productId','categoryId','warehouseId','supplierId','costCenterId','projectId','departmentId','userId','responsibleId','days']){const value=url.searchParams.get(key);if(value!=null&&value!=='')out[key]=key==='days'?Number(value):value;}return out;}
const CSV_COLUMNS={
  abc:[['productId','Produto ID'],['product','Produto'],['quantity','Quantidade'],['value','Valor'],['share','Participação %'],['cumulativeShare','Acumulado %'],['class','Classe']],
  consumption:[['productId','Produto ID'],['product','Produto'],['quantity','Quantidade'],['value','Valor']],
  'no-movement':[['productId','Produto ID'],['product','Produto'],['lastMovementAt','Último movimento'],['daysWithoutMovement','Dias sem giro'],['physical','Estoque físico']],
  losses:[['occurredAt','Data'],['type','Tipo'],['productId','Produto ID'],['product','Produto'],['warehouseId','Depósito'],['quantity','Quantidade'],['value','Valor']],
  valuation:[['productId','Produto ID'],['product','Produto'],['warehouseId','Depósito'],['asOf','Data-base'],['physical','Físico'],['reserved','Reservado'],['available','Disponível'],['unitCost','Custo'],['value','Valor']],
  movements:[['occurredAt','Data'],['type','Tipo'],['productId','Produto ID'],['product','Produto'],['warehouseId','Depósito'],['quantity','Quantidade'],['reason','Motivo']]
};

export function createLocalApiExtensions({repository,auth,documentDir=path.resolve('.data/documents'),ocrAdapter=null,hardwareAdapter=null}={}){
  if(!repository||!auth)throw new TypeError('repository and auth are required');
  const storage=createDocumentStorage({rootDir:documentDir});
  const documents=createDocumentService({repository,storage});
  const analytics=createAnalyticsService({repository});
  const hardwareSettings=createHardwareSettingsService({repository});
  const p1=createP1ApiExtensions({repository,auth});
  const unavailableHardware={status:()=>({serial:'unavailable',printing:'unavailable'}),async listPorts(){throw new DomainError('HARDWARE_UNAVAILABLE','serial hardware is unavailable');},async readScale(){throw new DomainError('HARDWARE_UNAVAILABLE','scale hardware is unavailable');},async print(){throw new DomainError('HARDWARE_UNAVAILABLE','printing hardware is unavailable');}};
  const hardware=hardwareAdapter??unavailableHardware;

  return async function handleExtension(req,res,url,token){
    const pathname=url.pathname;
    if(req.method==='POST'&&pathname==='/api/documents'){
      const actor=auth.require(token,'documents.manage');const body=await readJson(req,22*1024*1024);const item=await documents.create({...body,bytes:decodeBase64(body.contentBase64),createdBy:actor.id});return sendJson(res,201,{item:documentMeta(item)})||true;
    }
    if(req.method==='GET'&&pathname==='/api/documents'){
      auth.require(token,'documents.view');return sendJson(res,200,{items:documents.list({entityType:url.searchParams.get('entityType')||null,entityId:url.searchParams.get('entityId')||null})})||true;
    }
    const download=pathname.match(/^\/api\/documents\/([^/]+)\/download$/);
    if(req.method==='GET'&&download){auth.require(token,'documents.view');const item=await documents.read(download[1]);const disposition=`attachment; filename*=UTF-8''${encodeURIComponent(item.originalName)}`;return sendText(res,200,item.bytes,item.mimeType,{'Content-Disposition':disposition,'Content-Length':String(item.bytes.length)})||true;}
    const documentRoute=pathname.match(/^\/api\/documents\/([^/]+)$/);
    if(req.method==='DELETE'&&documentRoute){const actor=auth.require(token,'documents.manage');const item=await documents.remove({id:documentRoute[1],userId:actor.id});return sendJson(res,200,{item:documentMeta(item)})||true;}
    const ocrRoute=pathname.match(/^\/api\/documents\/([^/]+)\/ocr$/);
    if(req.method==='POST'&&ocrRoute){const actor=auth.require(token,'ocr.run');if(!ocrAdapter||typeof ocrAdapter.recognize!=='function')throw new DomainError('OCR_UNAVAILABLE','local OCR provider is unavailable');const meta=repository.getDocument(ocrRoute[1]);if(!meta||meta.deletedAt)throw new DomainError('DOCUMENT_NOT_FOUND','document not found',{id:ocrRoute[1]});const body=await readJson(req);const result=await ocrAdapter.recognize({source:storage.resolve(meta.storageName),language:body.language??'por',mode:body.mode??'structured'});const item=documents.saveOcrResult({id:meta.id,result,userId:actor.id});return sendJson(res,200,{item:documentMeta(item)})||true;}
    if(req.method==='GET'&&ocrRoute){auth.require(token,'documents.view');const item=repository.getDocument(ocrRoute[1]);if(!item||item.deletedAt)throw new DomainError('DOCUMENT_NOT_FOUND','document not found',{id:ocrRoute[1]});return sendJson(res,200,{status:item.ocrStatus,result:item.ocrResult,updatedAt:item.ocrUpdatedAt,updatedBy:item.ocrUpdatedBy})||true;}

    const analyticsRoute=pathname.match(/^\/api\/analytics\/(abc|consumption|no-movement|losses|valuation|movements)$/);
    if(req.method==='GET'&&analyticsRoute){auth.require(token,'analytics.view');const kind=analyticsRoute[1],filters=filtersFrom(url);const method=kind==='no-movement'?'noMovement':kind;const items=analytics[method](filters);if(url.searchParams.get('format')==='csv'){const columns=CSV_COLUMNS[kind].map(([key,label])=>({key,label}));return sendText(res,200,analytics.toCsv(items,columns),'text/csv; charset=utf-8')||true;}return sendJson(res,200,{items})||true;}

    if(req.method==='GET'&&pathname==='/api/hardware/status'){auth.require(token,'hardware.use');return sendJson(res,200,hardware.status())||true;}
    if(req.method==='GET'&&pathname==='/api/hardware/serial/ports'){auth.require(token,'hardware.use');return sendJson(res,200,{items:await hardware.listPorts()})||true;}
    if(req.method==='POST'&&pathname==='/api/hardware/scale/read'){auth.require(token,'hardware.use');const body=await readJson(req);return sendJson(res,200,{reading:await hardware.readScale(body)})||true;}
    if(req.method==='POST'&&pathname==='/api/hardware/print'){auth.require(token,'hardware.use');const body=await readJson(req);return sendJson(res,200,{result:await hardware.print(body.job,body.settings??{})})||true;}
    if(req.method==='GET'&&pathname==='/api/hardware/settings'){auth.require(token,'hardware.use');return sendJson(res,200,{items:hardwareSettings.list()})||true;}
    if(req.method==='POST'&&pathname==='/api/hardware/settings'){const actor=auth.require(token,'hardware.configure');const body=await readJson(req);return sendJson(res,200,{item:hardwareSettings.save(body,actor.id)})||true;}
    if(await p1(req,res,url,token))return true;
    return false;
  };
}
