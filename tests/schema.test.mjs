import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryCollections } from '../src/domain/stock/schema.mjs';

test('database model contains deliveries 1 through 15 collections',()=>{const names=createInventoryCollections().map((collection)=>collection.name);assert.deepEqual(names,['categories','suppliers','warehouses','users','cost_centers','projects','departments','products','stock_balances','stock_movements','reservations','lots','serials','transit_transfers','purchase_requests','purchase_orders','receipts','price_history','inventory_sessions','inventory_counts']);});
test('movement and product schemas expose advanced stock and cost fields',()=>{const collections=createInventoryCollections(),product=collections.find((item)=>item.name==='products'),movement=collections.find((item)=>item.name==='stock_movements');assert.equal(product.fields.some((field)=>field.name==='avgCost'),true);assert.equal(product.fields.some((field)=>field.name==='targetStock'),true);for(const name of['costCenterId','projectId','departmentId','responsibleId','lotId','serialId'])assert.equal(movement.fields.some((field)=>field.name===name),true);});
