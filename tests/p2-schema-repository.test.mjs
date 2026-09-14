import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryCollections } from '../src/domain/stock/schema.mjs';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';

test('P2 schema exposes persistent commercial collections',()=>{const names=createInventoryCollections().map(x=>x.name);for(const name of['custom_field_definitions','custom_field_values','approval_rules','approval_instances','maintenance_plans','calibration_records','kits','nfe_imports'])assert.ok(names.includes(name),`missing ${name}`);});

test('P2 repository exports and restores all generic collections',()=>{const repository=createMemoryStockRepository();const methods=['saveCustomFieldDefinition','saveCustomFieldValue','saveApprovalRule','saveApprovalInstance','saveMaintenancePlan','saveCalibrationRecord','saveKit','saveNfeImport'];for(const name of methods)assert.equal(typeof repository[name],'function',`missing ${name}`);repository.saveKit({id:'k1',code:'KIT',name:'Kit',components:[]});const state=repository.exportState();assert.equal(state.kits[0].id,'k1');const restored=createMemoryStockRepository();restored.replaceState(state);assert.equal(restored.getKit('k1').code,'KIT');});
