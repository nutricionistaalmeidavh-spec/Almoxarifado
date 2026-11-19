import { randomUUID } from 'node:crypto';
import { DomainError, requireNonNegativeNumber } from '../shared/domain-error.mjs';
function text(value,name){if(typeof value!=='string'||!value.trim())throw new DomainError('INVALID_INPUT',`${name} is required`,{field:name});return value.trim();}
function optionalText(value){return value==null?'':String(value).trim();}
function unique(repository,listMethod,id,key,value,code){if(!value)return;const duplicate=repository[listMethod]().find((item)=>item.id!==id&&item[key]===value);if(duplicate)throw new DomainError(code,`${key} already exists`,{key,value});}
function removalStrategy(value){const normalized=String(value??'MANUAL').toUpperCase();if(!['MANUAL','FIFO','FEFO'].includes(normalized))throw new DomainError('INVALID_REMOVAL_STRATEGY','removalStrategy must be MANUAL, FIFO or FEFO',{value});return normalized;}
// References can be nested in purchase lines, kits and imported documents.
function referencesProduct(node,id){
  if(!node||typeof node!=='object')return false;
  if(Array.isArray(node))return node.some(item=>referencesProduct(item,id));
  if(node.productId===id||Array.isArray(node.productIds)&&node.productIds.includes(id))return true;
  if(['product','products'].includes(String(node.entityType||'').toLowerCase())&&node.entityId===id)return true;
  return Object.values(node).some(value=>typeof value==='object'&&referencesProduct(value,id));
}
function assertProductCanBeDeleted(repository,id){
  const state=repository.exportState();
  if((state.balances||[]).some(item=>item.productId===id&&Number(item.quantity)!==0))
    throw new DomainError('PRODUCT_IN_USE','O material possui saldo em estoque. Zere o saldo antes de excluir.',{id,kind:'stock'});
  for(const [collection,records] of Object.entries(state)){
    if(['products','balances'].includes(collection))continue;
    if(referencesProduct(records,id))throw new DomainError('PRODUCT_IN_USE','O material possui histórico ou vínculos. Desative-o para preservar a rastreabilidade.',{id,kind:collection});
  }
}
export function createCatalogService({repository,idFactory=randomUUID}={}){if(!repository)throw new TypeError('repository is required');return{
  saveCategory(input={}){const id=input.id||idFactory();const previous=repository.getCategory(id)||{};return repository.saveCategory({...previous,id,name:text(input.name??previous.name,'name'),active:input.active??previous.active??true});},
  saveSupplier(input={}){const id=input.id||idFactory();const previous=repository.getSupplier(id)||{};return repository.saveSupplier({...previous,id,name:text(input.name??previous.name,'name'),document:optionalText(input.document??previous.document),phone:optionalText(input.phone??previous.phone),email:optionalText(input.email??previous.email),active:input.active??previous.active??true});},
  saveWarehouse(input={}){const id=input.id||idFactory();const previous=repository.getWarehouse(id)||{};const code=text(input.code??previous.code,'code').toUpperCase();unique(repository,'listWarehouses',id,'code',code,'WAREHOUSE_CODE_EXISTS');return repository.saveWarehouse({...previous,id,code,name:text(input.name??previous.name,'name'),active:input.active??previous.active??true});},
  updateProduct(id,patch={}){
    if(!repository.getProduct(id))throw new DomainError('PRODUCT_NOT_FOUND','Material não encontrado',{id});
    if(Object.hasOwn(patch,'active')&&typeof patch.active!=='boolean')throw new DomainError('INVALID_INPUT','active must be boolean',{field:'active'});
    return this.saveProduct({...patch,id});
  },
  removeProduct(id){
    const product=repository.getProduct(id);
    if(!product)throw new DomainError('PRODUCT_NOT_FOUND','Material não encontrado',{id});
    assertProductCanBeDeleted(repository,id);
    return repository.removeProduct(id);
  },
  saveProduct(input={}){const id=input.id||idFactory();const previous=repository.getProduct(id)||{};const sku=text(input.sku??previous.sku,'sku').toUpperCase();const barcode=optionalText(input.barcode??previous.barcode);const minStock=Number(input.minStock??previous.minStock??0);const targetStock=Number(input.targetStock??previous.targetStock??0);const unitCost=Number(input.unitCost??previous.unitCost??0);requireNonNegativeNumber(minStock,'minStock');requireNonNegativeNumber(targetStock,'targetStock');requireNonNegativeNumber(unitCost,'unitCost');unique(repository,'listProducts',id,'sku',sku,'PRODUCT_SKU_EXISTS');unique(repository,'listProducts',id,'barcode',barcode,'PRODUCT_BARCODE_EXISTS');const categoryId=input.categoryId??previous.categoryId??null;const supplierId=input.supplierId??previous.supplierId??null;if(categoryId&&!repository.getCategory(categoryId))throw new DomainError('CATEGORY_NOT_FOUND','category not found',{categoryId});if(supplierId&&!repository.getSupplier(supplierId))throw new DomainError('SUPPLIER_NOT_FOUND','supplier not found',{supplierId});return repository.saveProduct({...previous,id,sku,barcode,name:text(input.name??previous.name,'name'),categoryId,supplierId,unit:text(input.unit??previous.unit??'un','unit'),minStock,targetStock,unitCost,avgCost:previous.avgCost??unitCost,removalStrategy:removalStrategy(input.removalStrategy??previous.removalStrategy??'MANUAL'),active:input.active??previous.active??true});}
};}
