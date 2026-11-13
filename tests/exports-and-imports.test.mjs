import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { exportStockPdf, exportStockXlsx, exportLabelsPdf } from '../src/domain/reports/export-service.mjs';
import { previewProductsCsv, importProductsCsv } from '../src/domain/catalog/csv-import-service.mjs';
const seed=()=>createMemoryStockRepository({
  products:[{id:'p1',sku:'T-01',name:'Tubo PVC',unit:'UN',barcode:'123456789012',avgCost:4.25,active:true}],
  warehouses:[{id:'w1',name:'Principal',active:true}],
  balances:[{productId:'p1',warehouseId:'w1',quantity:2}]
});
test('PDF, XLSX and barcode labels contain real binary documents',async()=>{
  const repo=seed();
  const pdf=await exportStockPdf(repo),xlsx=await exportStockXlsx(repo),labels=await exportLabelsPdf(repo);
  assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  assert.equal(xlsx.subarray(0,2).toString(),'PK');
  assert.equal(labels.subarray(0,4).toString(),'%PDF');
  assert.ok(labels.length>1000);
});
test('CSV import previews errors and commits valid products transactionally',async()=>{
  const repo=seed();
  const bad=previewProductsCsv(repo,'SKU;Produto;Unidade\nT-01;Duplicado;UN');
  assert.equal(bad.valid,false);
  await assert.rejects(importProductsCsv(repo,'SKU;Produto;Unidade\nT-01;Duplicado;UN'),e=>e.code==='CSV_VALIDATION_FAILED');
  assert.equal(repo.listProducts().length,1);
  const result=await importProductsCsv(repo,'SKU;Produto;Unidade;Estoque minimo;Custo unitario\nP-02;Parafuso;UN;5;0.75');
  assert.equal(result.count,1);
  assert.equal(repo.getProduct(result.products[0].id).name,'Parafuso');
});
