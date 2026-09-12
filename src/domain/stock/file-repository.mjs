import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createMemoryStockRepository } from './repository.mjs';

const DEFAULT_SEED = Object.freeze({
  warehouses: [{ id: 'main', code: 'ALM-01', name: 'Almoxarifado principal', active: true }],
  users: [{ id: 'local-admin', name: 'Administrador local', login: 'admin', role: 'ADMIN', active: true }]
});

function mergeSeed(seed = {}) {
  return { ...seed, warehouses: seed.warehouses?.length ? seed.warehouses : DEFAULT_SEED.warehouses, users: seed.users?.length ? seed.users : DEFAULT_SEED.users };
}

export function createFileStockRepository({ filePath, seed = {} } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new TypeError('filePath is required');
  mkdirSync(path.dirname(filePath), { recursive: true });
  let loaded = mergeSeed(seed);
  if (existsSync(filePath)) { const raw = readFileSync(filePath, 'utf8').trim(); if (raw) loaded = mergeSeed(JSON.parse(raw)); }
  const inner = createMemoryStockRepository(loaded);
  let transactionDepth = 0;
  const persist = () => { const tmp = `${filePath}.tmp`; writeFileSync(tmp, `${JSON.stringify(inner.exportState(), null, 2)}\n`, 'utf8'); renameSync(tmp, filePath); };
  const mutating = new Set(['saveCategory','saveSupplier','saveProduct','saveWarehouse','saveUser','setBalance','addMovement','addInventory','saveInventory','addInventoryCount','saveInventoryCount']);
  const repository = {};
  for (const [name, value] of Object.entries(inner)) {
    if (name === 'transaction') continue;
    if (typeof value !== 'function') { repository[name] = value; continue; }
    repository[name] = (...args) => { const result = value(...args); if (mutating.has(name) && transactionDepth === 0) persist(); return result; };
  }
  repository.transaction = async (work) => {
    transactionDepth += 1;
    try { const result = await inner.transaction(work); transactionDepth -= 1; if (transactionDepth === 0) persist(); return result; }
    catch (error) { transactionDepth -= 1; throw error; }
  };
  repository.persist = persist;
  if (!existsSync(filePath)) persist();
  return repository;
}
