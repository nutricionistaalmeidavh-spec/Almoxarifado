import Papa from 'papaparse';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.mjs';
import { createCatalogService } from './catalog-service.mjs';
const aliases={sku:'sku',codigo:'sku',name:'name',nome:'name',produto:'name',unit:'unit',unidade:'unit',barcode:'barcode',codigodebarras:'barcode',minstock:'minStock',estoqueminimo:'minStock',unitcost:'unitCost',custo:'unitCost',custounitario:'unitCost'};
const cleanHeader=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function previewProductsCsv(repository,csv){
  if(typeof csv!=='string'||csv.length>1500000)throw new DomainError('INVALID_CSV','Arquivo CSV invalido ou muito grande');
  const parsed=Papa.parse(csv,{header:true,skipEmptyLines:'greedy',transformHeader:h=>aliases[cleanHeader(h)]??h});
  if(parsed.data.length>5000)throw new DomainError('CSV_TOO_MANY_ROWS','Limite: 5000 produtos por importacao');
  const errors=parsed.errors.map(e=>({row:(e.row??0)+2,message:e.message}));
  const existing=new Set(repository.listProducts().map(p=>String(p.sku).trim().toUpperCase()));
  const seen=new Set();const items=parsed.data.map((row,i)=>{
    const sku=String(row.sku??'').trim(),name=String(row.name??'').trim(),unit=String(row.unit??'UN').trim().toUpperCase();
    const minStock=Number(row.minStock||0),unitCost=Number(row.unitCost||0),barcode=String(row.barcode??'').trim();
    const problems=[];if(!sku||!name)problems.push('SKU e nome obrigatorios');
    if(existing.has(sku.toUpperCase())||seen.has(sku.toUpperCase()))problems.push('SKU duplicado');
    if(!Number.isFinite(minStock)||minStock<0||!Number.isFinite(unitCost)||unitCost<0)problems.push('Custo ou minimo invalido');
    seen.add(sku.toUpperCase());if(problems.length)errors.push({row:i+2,message:problems.join(', ')});
    return{sku,name,unit:unit||'UN',barcode:barcode||null,minStock,unitCost};
  });
  if(!items.length)errors.push({row:1,message:'Nenhum produto encontrado'});
  return{items,count:items.length,errors,valid:errors.length===0};
}
export async function importProductsCsv(repository,csv){
  return repository.transaction(async()=>{
    const preview=previewProductsCsv(repository,csv);
    if(!preview.valid)throw new DomainError('CSV_VALIDATION_FAILED','CSV contem erros',{errors:preview.errors});
    const catalog=createCatalogService({repository});
    const products=preview.items.map(x=>catalog.saveProduct({...x,id:randomUUID(),targetStock:x.minStock*2,active:true}));
    return{count:products.length,products:products.map(p=>({id:p.id,sku:p.sku}))};
  });
}
