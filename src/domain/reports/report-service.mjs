import { stockProjection } from '../stock/stock-projection.mjs';
function productName(repository,id){return repository.getProduct(id)?.name??id;} function warehouseName(repository,id){return repository.getWarehouse(id)?.name??id;}
export function buildDashboard(repository){
  const products=repository.listProducts().filter(item=>item.active!==false);
  const projection=stockProjection(repository);
  const flagged=new Set(projection.filter(row=>row.lowStock).map(row=>row.productId));
  return {products:products.length,
    totalUnits:repository.listBalances().reduce((sum,row)=>sum+Number(row.quantity||0),0),
    lowStock:flagged.size,
    totalValue:Number(projection.reduce((sum,row)=>sum+row.value,0).toFixed(2)),
    openInventories:repository.listInventories().filter(item=>item.status==='OPEN').length,
    recentMovements:repository.listMovements().slice(-5).reverse()};
}
export function buildStockRows(repository){const balances=repository.listBalances();const rows=[];for(const product of repository.listProducts().filter((item)=>item.active!==false)){const productBalances=balances.filter((item)=>item.productId===product.id);const cost=product.avgCost??product.unitCost??0;if(!productBalances.length){rows.push({sku:product.sku,barcode:product.barcode||'',product:product.name,warehouse:'-',quantity:0,unit:product.unit,minStock:product.minStock,unitCost:cost,value:0});continue;}for(const balance of productBalances){rows.push({sku:product.sku,barcode:product.barcode||'',product:product.name,warehouse:warehouseName(repository,balance.warehouseId),quantity:balance.quantity,unit:product.unit,minStock:product.minStock,unitCost:cost,value:Number((balance.quantity*Number(cost)).toFixed(2))});}}return rows.sort((a,b)=>a.product.localeCompare(b.product)||a.warehouse.localeCompare(b.warehouse));}
export function buildMovementRows(repository){return repository.listMovements().map((item)=>({date:item.occurredAt,type:item.type,product:productName(repository,item.productId),warehouse:warehouseName(repository,item.warehouseId),quantity:item.quantity,before:item.before,after:item.after,reason:item.reason||''})).reverse();}
function csvCell(value){const raw=value==null?'':String(value);const text=typeof value==='string'&&/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
export function toCsv(rows,columns){const header=columns.map((column)=>csvCell(column.label)).join(',');const body=rows.map((row)=>columns.map((column)=>csvCell(row[column.key])).join(','));return `\uFEFF${[header,...body].join('\n')}\n`;}
export function buildStockCsv(repository){return toCsv(buildStockRows(repository),[{key:'sku',label:'SKU'},{key:'barcode',label:'Código de barras'},{key:'product',label:'Produto'},{key:'warehouse',label:'Depósito'},{key:'quantity',label:'Quantidade'},{key:'unit',label:'Unidade'},{key:'minStock',label:'Estoque mínimo'},{key:'unitCost',label:'Custo médio'},{key:'value',label:'Valor'}]);}
export function buildMovementCsv(repository){return toCsv(buildMovementRows(repository),[{key:'date',label:'Data'},{key:'type',label:'Tipo'},{key:'product',label:'Produto'},{key:'warehouse',label:'Depósito'},{key:'quantity',label:'Quantidade'},{key:'before',label:'Antes'},{key:'after',label:'Depois'},{key:'reason',label:'Motivo'}]);}
export function buildLabels(repository){return repository.listProducts().filter((item)=>item.active!==false).map((item)=>({id:item.id,sku:item.sku,barcode:item.barcode||item.sku,name:item.name}));}
