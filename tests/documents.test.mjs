import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createDocumentStorage } from '../src/platform/document-storage.mjs';
import { createDocumentService } from '../src/domain/documents/document-service.mjs';

test('document lifecycle uses internal path, hash and audited deletion', async () => {
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-docs-'));
  const repository=createMemoryStockRepository({
    users:[{id:'u1',name:'Operador',login:'op',role:'ALMOXARIFE',active:true}],
    products:[{id:'p1',sku:'P1',name:'Produto',unit:'un',active:true}]
  });
  const storage=createDocumentStorage({rootDir:path.join(dir,'documents'),maxFileSize:15*1024*1024});
  const service=createDocumentService({repository,storage,idFactory:()=> 'doc-1',now:()=> '2026-09-12T16:00:00.000Z'});
  const doc=await service.create({entityType:'product',entityId:'p1',kind:'invoice',originalName:'../../nota.pdf',mimeType:'application/pdf',bytes:Buffer.from('%PDF'),createdBy:'u1'});
  assert.equal(doc.storageName,'doc-1.bin');
  assert.match(doc.sha256,/^[a-f0-9]{64}$/);
  assert.equal((await service.read(doc.id)).bytes.toString(),'%PDF');
  await service.remove({id:doc.id,userId:'u1'});
  assert.equal(repository.getDocument(doc.id).deletedBy,'u1');
  await assert.rejects(service.read(doc.id),(error)=>error.code==='DOCUMENT_NOT_FOUND');
});

test('document storage rejects traversal and service rejects invalid type', async () => {
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-docs-safe-'));
  const storage=createDocumentStorage({rootDir:path.join(dir,'documents')});
  await assert.rejects(storage.read('../outside.txt'),(error)=>error.code==='INVALID_DOCUMENT');
  const repository=createMemoryStockRepository({users:[{id:'u1',active:true}],products:[{id:'p1',active:true}]});
  const service=createDocumentService({repository,storage,idFactory:()=> 'doc-2'});
  await assert.rejects(service.create({entityType:'product',entityId:'p1',kind:'other',originalName:'bad.exe',mimeType:'application/x-msdownload',bytes:Buffer.from('x'),createdBy:'u1'}),(error)=>error.code==='INVALID_DOCUMENT');
});
