import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformConfig } from '../src/platform/config.mjs';
import { createInventoryCollections } from '../src/domain/stock/schema.mjs';

test('database model contains every MVP almoxarifado collection', () => {
  const names = createInventoryCollections().map((collection) => collection.name);
  assert.deepEqual(names, [
    'categories', 'suppliers', 'warehouses', 'users', 'products',
    'stock_balances', 'stock_movements', 'inventory_sessions', 'inventory_counts'
  ]);
});

test('platform config sends the inventory model to the local backend', () => {
  const config = createPlatformConfig({ dataDir: 'C:/Almoxarifado/data' });
  assert.equal(config.backend.collections.length, 9);
  assert.equal(config.backend.collections.find((item) => item.name === 'products').fields.some((field) => field.name === 'barcode'), true);
  assert.equal(config.backend.collections.find((item) => item.name === 'stock_movements').fields.some((field) => field.name === 'type'), true);
});
