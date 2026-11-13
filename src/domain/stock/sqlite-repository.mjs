import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createMemoryStockRepository } from './repository.mjs';

const DEFAULT_SEED=Object.freeze({warehouses:[{id:'main',code:'ALM-01',name:'Almoxarifado principal',active:true}],users:[{id:'local-admin',name:'Administrador local',login:'admin',role:'ADMIN',active:true}]});
const ENTITY_METHODS=Object.freeze({saveCategory:'categories',saveSupplier:'suppliers',saveProduct:'products',saveWarehouse:'warehouses',saveUser:'users',saveCostCenter:'costCenters',saveProject:'projects',saveDepartment:'departments',savePurchaseRequest:'purchaseRequests',savePurchaseOrder:'purchaseOrders',saveReceipt:'receipts',saveReservation:'reservations',saveLot:'lots',saveSerial:'serials',saveTransitTransfer:'transitTransfers',addInventory:'inventories',saveInventory:'inventories',saveDocument:'documents',saveHardwareSetting:'hardwareSettings',saveLocation:'locations',saveStockPosition:'stockPositions',saveCycleCount:'cycleCounts',saveCycleCountLine:'cycleCountLines',saveAsset:'assets',saveAssetCheckout:'assetCheckouts',saveAssetMaintenance:'assetMaintenance',saveProductSupplier:'productSuppliers',saveUnitConversion:'unitConversions',saveQualityHold:'qualityHolds',saveAlertEvent:'alertEvents',saveCustomFieldDefinition:'customFieldDefinitions',saveCustomFieldValue:'customFieldValues',saveApprovalRule:'approvalRules',saveApprovalInstance:'approvalInstances',saveMaintenancePlan:'maintenancePlans',saveCalibrationRecord:'calibrationRecords',saveKit:'kits',saveNfeImport:'nfeImports'});
function parseJson(value,fallback=null){try{return JSON.parse(value);}catch{return fallback;}}
function json(value){return JSON.stringify(value);}
function mergeSeed(seed={}){const source=seed&&typeof seed==='object'&&!Array.isArray(seed)?seed:{};return{...source,warehouses:source.warehouses?.length?source.warehouses:DEFAULT_SEED.warehouses,users:source.users?.length?source.users:DEFAULT_SEED.users};}

export function createSqliteStockRepository({dbPath,legacyJsonPath=null,seed={}}={}){
  if(typeof dbPath!=='string'||!dbPath.trim())throw new TypeError('dbPath is required');
  mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
  const db=new DatabaseSync(path.resolve(dbPath));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;');
  db.exec(`CREATE TABLE IF NOT EXISTS entities(collection TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(collection,id));CREATE TABLE IF NOT EXISTS balances(product_id TEXT NOT NULL,warehouse_id TEXT NOT NULL,quantity REAL NOT NULL,PRIMARY KEY(product_id,warehouse_id));CREATE TABLE IF NOT EXISTS movements(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,data TEXT NOT NULL);CREATE TABLE IF NOT EXISTS inventory_counts(inventory_id TEXT NOT NULL,product_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(inventory_id,product_id));CREATE TABLE IF NOT EXISTS price_history(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,data TEXT NOT NULL);CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  const entityUpsert=db.prepare('INSERT INTO entities(collection,id,data) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data');
  const balanceUpsert=db.prepare('INSERT INTO balances(product_id,warehouse_id,quantity) VALUES(?,?,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=excluded.quantity');
  const movementUpsert=db.prepare('INSERT INTO movements(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data');
  const countUpsert=db.prepare('INSERT INTO inventory_counts(inventory_id,product_id,data) VALUES(?,?,?) ON CONFLICT(inventory_id,product_id) DO UPDATE SET data=excluded.data');
  const priceUpsert=db.prepare('INSERT INTO price_history(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data');
  const isEmpty=()=>Number(db.prepare('SELECT (SELECT COUNT(*) FROM entities)+(SELECT COUNT(*) FROM balances)+(SELECT COUNT(*) FROM movements)+(SELECT COUNT(*) FROM inventory_counts)+(SELECT COUNT(*) FROM price_history) AS n').get().n)===0;
  const readState=()=>{const state={balances:[],movements:[],counts:[],priceHistory:[]};for(const row of db.prepare('SELECT collection,data FROM entities ORDER BY collection,id').all())(state[row.collection]??=[]).push(parseJson(row.data,{}));state.balances=db.prepare('SELECT product_id AS productId,warehouse_id AS warehouseId,quantity FROM balances').all().map(r=>({...r,quantity:Number(r.quantity)}));state.movements=db.prepare('SELECT data FROM movements ORDER BY seq').all().map(r=>parseJson(r.data,{}));state.counts=db.prepare('SELECT data FROM inventory_counts ORDER BY inventory_id,product_id').all().map(r=>parseJson(r.data,{}));state.priceHistory=db.prepare('SELECT data FROM price_history ORDER BY seq').all().map(r=>parseJson(r.data,{}));return state;};
  const clearAll=()=>db.exec('DELETE FROM entities; DELETE FROM balances; DELETE FROM movements; DELETE FROM inventory_counts; DELETE FROM price_history;');
  const persistState=(state)=>{clearAll();for(const[collection,items]of Object.entries(state)){if(['balances','movements','counts','priceHistory'].includes(collection)||!Array.isArray(items))continue;for(const item of items)if(item?.id)entityUpsert.run(collection,String(item.id),json(item));}for(const row of state.balances??[])balanceUpsert.run(String(row.productId),String(row.warehouseId),Number(row.quantity));for(const row of state.movements??[])movementUpsert.run(String(row.id),json(row));for(const row of state.counts??[])countUpsert.run(String(row.inventoryId),String(row.productId),json(row));for(const row of state.priceHistory??[])priceUpsert.run(String(row.id??`${row.productId}:${row.occurredAt}:${Math.random()}`),json(row));};
  if(isEmpty()){
    let initial=mergeSeed(seed);
    if(legacyJsonPath&&existsSync(legacyJsonPath)){initial=mergeSeed(parseJson(readFileSync(legacyJsonPath,'utf8'),seed)??seed);const backup=`${legacyJsonPath}.migrated.bak`;if(!existsSync(backup))copyFileSync(legacyJsonPath,backup);db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)').run('legacyMigratedAt',new Date().toISOString());}
    const bootstrap=createMemoryStockRepository(initial);db.exec('BEGIN IMMEDIATE');try{persistState(bootstrap.exportState());db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  }
  const inner=createMemoryStockRepository(readState());let txDepth=0;const context=new AsyncLocalStorage();let activeOwner=null;let queue=Promise.resolve();let revision=0;const api={};
  const wrap=(name,fn)=>{if(ENTITY_METHODS[name])return(...args)=>{const result=fn(...args);entityUpsert.run(ENTITY_METHODS[name],String(result.id),json(result));return result;};if(name==='setBalance')return(productId,warehouseId,quantity)=>{const result=fn(productId,warehouseId,quantity);balanceUpsert.run(String(productId),String(warehouseId),Number(quantity));return result;};if(name==='addMovement')return(item)=>{const result=fn(item);movementUpsert.run(String(result.id),json(result));return result;};if(name==='addInventoryCount'||name==='saveInventoryCount')return(item)=>{const result=fn(item);countUpsert.run(String(result.inventoryId),String(result.productId),json(result));return result;};if(name==='addPriceHistory')return(item)=>{const result=fn(item);priceUpsert.run(String(result.id),json(result));return result;};if(name==='replaceState')return(next)=>{const result=fn(next);persistState(result);return result;};return(...args)=>fn(...args);};
  for(const[name,value]of Object.entries(inner))if(name!=='transaction'){
    if(typeof value!=='function'){api[name]=value;continue;}
    const wrapped=wrap(name,value);
    api[name]=(...args)=>{const result=wrapped(...args);if(ENTITY_METHODS[name]||['setBalance','addMovement','addInventoryCount','saveInventoryCount','addPriceHistory','replaceState'].includes(name))revision++;return result;};
  }
  api.revision=()=>revision;
  // One SQLite connection is shared by LAN requests.  Unrelated requests must be
  // serialized, while true nested calls in the same async context use savepoints.
  const execute=async(work)=>{
    const level=txDepth++;
    const savepoint=`almox_tx_${level}`;
    const snapshot=inner.exportState();
    if(level===0)db.exec('BEGIN IMMEDIATE');else db.exec(`SAVEPOINT ${savepoint}`);
    try{
      const result=await inner.transaction(work);
      if(level===0)db.exec('COMMIT');else db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    }catch(error){
      try{if(level===0)db.exec('ROLLBACK');else db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`);}catch{}
      inner.replaceState(snapshot);
      throw error;
    }finally{txDepth-=1;}
  };
  api.transaction=async(work)=>{
    if(typeof work!=='function')throw new TypeError('transaction requires a function');
    if(activeOwner&&context.getStore()===activeOwner)return execute(work);
    const owner={};
    const task=queue.then(()=>{activeOwner=owner;return context.run(owner,async()=>{try{return await execute(work);}finally{activeOwner=null;}});});
    queue=task.then(()=>undefined,()=>undefined);
    return task;
  };
  api.close=()=>db.close();api.dbPath=path.resolve(dbPath);return api;
}
