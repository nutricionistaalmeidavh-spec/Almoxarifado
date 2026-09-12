import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStockRepository } from '../src/domain/stock/file-repository.mjs';
import { createBackupService } from '../src/domain/backup/backup-service.mjs';

test('local backup snapshots and restores document files with repository state', () => {
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-backup-docs-'));
  const documents=path.join(dir,'documents');mkdirSync(documents,{recursive:true});
  const repository=createFileStockRepository({filePath:path.join(dir,'data.json')});
  repository.saveProduct({id:'p1',sku:'P1',name:'Produto',unit:'un',active:true});
  const backup=createBackupService({repository,backupDir:path.join(dir,'backups'),assetDirs:[{name:'documents',sourceDir:documents}],idFactory:()=> 'b1',now:()=>new Date('2026-09-12T20:00:00Z')});
  writeFileSync(path.join(documents,'doc-1.bin'),'original','utf8');
  const saved=backup.create('manual');
  writeFileSync(path.join(documents,'doc-1.bin'),'alterado','utf8');
  repository.saveProduct({id:'p1',sku:'P1',name:'Alterado',unit:'un',active:true});
  backup.restore(saved.filePath);
  assert.equal(repository.getProduct('p1').name,'Produto');
  assert.equal(readFileSync(path.join(documents,'doc-1.bin'),'utf8'),'original');
  assert.equal(existsSync(saved.filePath.replace(/\.json$/,'.assets/documents/doc-1.bin')),true);
});
