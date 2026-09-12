import { randomUUID } from 'node:crypto';
import { validateUploadBatch } from '@artisys/upload';
import { DomainError, requireId } from '../shared/domain-error.mjs';

const ACCEPT=['application/pdf','image/jpeg','image/png','image/webp','text/plain'];
const ENTITY_GETTERS={product:'getProduct',movement:null,purchaseRequest:'getPurchaseRequest',purchaseOrder:'getPurchaseOrder',receipt:'getReceipt',supplier:'getSupplier'};
function nonEmpty(value,field){const text=String(value??'').trim();if(!text)throw new DomainError('INVALID_DOCUMENT',`${field} is required`,{field});return text;}
function ensureUser(repository,userId){const user=repository.getUser?.(requireId(userId,'userId'));if(!user||user.active===false)throw new DomainError('USER_NOT_FOUND','user not found',{id:userId});return user;}
function ensureEntity(repository,entityType,entityId){
  if(!(entityType in ENTITY_GETTERS))throw new DomainError('INVALID_DOCUMENT','unsupported entity type',{entityType});
  requireId(entityId,'entityId');
  if(entityType==='movement'){
    const found=repository.listMovements?.().some((item)=>item.id===entityId);if(!found)throw new DomainError('DOCUMENT_ENTITY_NOT_FOUND','movement not found',{entityType,entityId});return;
  }
  const value=repository[ENTITY_GETTERS[entityType]]?.(entityId);if(!value)throw new DomainError('DOCUMENT_ENTITY_NOT_FOUND','linked entity not found',{entityType,entityId});
}
function uploadError(rejection){if(rejection?.reasons?.includes('file-too-large'))return new DomainError('DOCUMENT_TOO_LARGE','document exceeds configured size limit');return new DomainError('INVALID_DOCUMENT','document type is not allowed',{reasons:rejection?.reasons??[]});}
export function createDocumentService({repository,storage,now=()=>new Date().toISOString(),idFactory=randomUUID}={}){
  if(!repository||!storage)throw new TypeError('repository and storage are required');
  return {
    async create(input={}){
      const entityType=nonEmpty(input.entityType,'entityType'),entityId=nonEmpty(input.entityId,'entityId'),kind=nonEmpty(input.kind,'kind'),originalName=nonEmpty(input.originalName,'originalName'),mimeType=nonEmpty(input.mimeType,'mimeType').toLowerCase();
      ensureEntity(repository,entityType,entityId);ensureUser(repository,input.createdBy);
      const bytes=Buffer.from(input.bytes??[]);
      const checked=validateUploadBatch([{name:originalName,size:bytes.length,type:mimeType}],{maxFiles:1,maxFileSize:storage.maxFileSize,accept:ACCEPT});
      if(checked.rejected.length)throw uploadError(checked.rejected[0]);
      const id=idFactory();
      const stored=await storage.write({id,bytes,mimeType});
      const item={id,entityType,entityId,kind,originalName,storageName:stored.storageName,mimeType,size:stored.size,sha256:stored.sha256,createdAt:now(),createdBy:input.createdBy,deletedAt:null,deletedBy:null,ocrStatus:'NOT_RUN',ocrResult:null,ocrUpdatedAt:null,ocrUpdatedBy:null};
      try{return repository.saveDocument(item);}catch(error){await storage.remove(stored.storageName);throw error;}
    },
    list(filter={}){return repository.listDocuments().filter((item)=>!item.deletedAt&&(!filter.entityType||item.entityType===filter.entityType)&&(!filter.entityId||item.entityId===filter.entityId));},
    async read(id){const item=repository.getDocument(requireId(id,'documentId'));if(!item||item.deletedAt)throw new DomainError('DOCUMENT_NOT_FOUND','document not found',{id});const bytes=await storage.read(item.storageName).catch((error)=>{if(error?.code==='ENOENT')throw new DomainError('DOCUMENT_NOT_FOUND','document file is missing',{id});throw error;});return{...item,bytes};},
    async remove({id,userId}){ensureUser(repository,userId);const item=repository.getDocument(requireId(id,'documentId'));if(!item||item.deletedAt)throw new DomainError('DOCUMENT_NOT_FOUND','document not found',{id});const updated={...item,deletedAt:now(),deletedBy:userId};const saved=repository.saveDocument(updated);try{await storage.remove(item.storageName);return saved;}catch(error){repository.saveDocument(item);throw error;}},
    saveOcrResult({id,result,userId}){ensureUser(repository,userId);const item=repository.getDocument(requireId(id,'documentId'));if(!item||item.deletedAt)throw new DomainError('DOCUMENT_NOT_FOUND','document not found',{id});if(!result||typeof result!=='object')throw new DomainError('INVALID_DOCUMENT','OCR result is required');const normalized={provider:String(result.provider??''),text:String(result.text??''),confidence:Number.isFinite(result.confidence)?result.confidence:null,blocks:Array.isArray(result.blocks)?result.blocks.map((block)=>({...block})):[],candidates:result.candidates&&typeof result.candidates==='object'?structuredClone(result.candidates):{},reviewed:Boolean(result.reviewed)};return repository.saveDocument({...item,ocrStatus:'DONE',ocrResult:normalized,ocrUpdatedAt:now(),ocrUpdatedBy:userId});}
  };
}
