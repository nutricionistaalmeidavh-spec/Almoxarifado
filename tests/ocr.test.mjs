import test from 'node:test';
import assert from 'node:assert/strict';
import { createOcrAdapter } from '../src/platform/ocr-adapter.mjs';

test('OCR adapter selects local provider and extracts review candidates', async () => {
  const adapter=createOcrAdapter({providers:{tesseract:{recognize:async()=>({text:'NF 123\nCNPJ 12.345.678/0001-90\nTotal R$ 1.234,56\n12/09/2026',confidence:0.91})}}});
  assert.equal(adapter.available(),true);
  const result=await adapter.recognize({source:'/tmp/doc.png',mode:'structured'});
  assert.equal(result.provider,'tesseract');
  assert.equal(result.candidates.invoiceNumber,'123');
  assert.equal(result.candidates.total,1234.56);
  assert.equal(result.reviewed,false);
});

test('OCR absence degrades without blocking the application', async () => {
  const adapter=createOcrAdapter({providers:{}});
  assert.equal(adapter.available(),false);
  await assert.rejects(adapter.recognize({source:'x'}),(error)=>error.code==='OCR_UNAVAILABLE');
});
