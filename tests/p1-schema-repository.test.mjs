import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInventoryCollections } from '../src/domain/stock/schema.mjs';
import { createSqliteStockRepository } from '../src/domain/stock/sqlite-repository.mjs';

test('P1 schema exposes commercial differentiation collections',()=>{const names=createInventoryCollections().map(x=>x.name);for(const name of['assets','asset_checkouts','asset_maintenance','product_suppliers','unit_conversions','quality_holds','alert_events'])assert.equal(names.includes(name),true,name);});

test('SQLite persists P1 entity collections across reopen',()=>{const dir=mkdtempSync(path.join(os.tmpdir(),'almox-p1-'));const dbPath=path.join(dir,'db.sqlite');let repo=createSqliteStockRepository({dbPath});repo.saveAsset({id:'a1',tag:'A1',name:'Furadeira',status:'AVAILABLE'});repo.saveProductSupplier({id:'ps1',productId:'p1',supplierId:'s1',preferred:true});repo.saveUnitConversion({id:'uom1',productId:'p1',unit:'CX',factor:12});repo.saveQualityHold({id:'q1',productId:'p1',warehouseId:'main',quantity:2,status:'OPEN'});repo.close();repo=createSqliteStockRepository({dbPath});assert.equal(repo.getAsset('a1').name,'Furadeira');assert.equal(repo.getProductSupplier('ps1').preferred,true);assert.equal(repo.getUnitConversion('uom1').factor,12);assert.equal(repo.getQualityHold('q1').quantity,2);repo.close();rmSync(dir,{recursive:true,force:true});});
