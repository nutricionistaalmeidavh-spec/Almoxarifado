function clone(value) { return value == null ? value : structuredClone(value); }
function balanceKey(productId, warehouseId) { return `${productId}::${warehouseId}`; }
const MAP_COLLECTIONS = ['categories','suppliers','products','warehouses','users','costCenters','projects','departments','purchaseRequests','purchaseOrders','receipts','reservations','lots','serials','transitTransfers','inventories','documents','hardwareSettings'];

export function createMemoryStockRepository(seed = {}) {
  const state = { balances: new Map(), movements: [], counts: new Map(), priceHistory: [] };
  for (const name of MAP_COLLECTIONS) state[name] = new Map();

  const load = (source = {}) => {
    for (const name of MAP_COLLECTIONS) state[name] = new Map((source[name] ?? []).map((item) => [item.id, clone(item)]));
    state.balances = new Map((source.balances ?? []).map((item) => [balanceKey(item.productId, item.warehouseId), Number(item.quantity)]));
    state.movements = (source.movements ?? []).map(clone);
    state.counts = new Map((source.counts ?? []).map((item) => [`${item.inventoryId}::${item.productId}`, clone(item)]));
    state.priceHistory = (source.priceHistory ?? []).map(clone);
  };
  load(seed);

  const cloneMap = (map) => new Map([...map].map(([key, value]) => [key, clone(value)]));
  const snapshot = () => {
    const saved = { balances: new Map(state.balances), movements: state.movements.map(clone), counts: cloneMap(state.counts), priceHistory: state.priceHistory.map(clone) };
    for (const name of MAP_COLLECTIONS) saved[name] = cloneMap(state[name]);
    return saved;
  };
  const restore = (saved) => { for (const [key, value] of Object.entries(saved)) state[key] = value; };
  const saveTo = (map, item) => { map.set(item.id, clone(item)); return clone(item); };
  const listMap = (name) => [...state[name].values()].map(clone);
  const getMap = (name, id) => clone(state[name].get(id) ?? null);

  const api = {
    getCategory: (id) => getMap('categories', id), listCategories: () => listMap('categories'), saveCategory: (item) => saveTo(state.categories, item),
    getSupplier: (id) => getMap('suppliers', id), listSuppliers: () => listMap('suppliers'), saveSupplier: (item) => saveTo(state.suppliers, item),
    getProduct: (id) => getMap('products', id), listProducts: () => listMap('products'), saveProduct: (item) => saveTo(state.products, item),
    getWarehouse: (id) => getMap('warehouses', id), listWarehouses: () => listMap('warehouses'), saveWarehouse: (item) => saveTo(state.warehouses, item),
    getUser: (id) => getMap('users', id), getUserByLogin: (login) => listMap('users').find((u) => u.login === login) ?? null, listUsers: () => listMap('users'), saveUser: (item) => saveTo(state.users, item),
    getCostCenter: (id) => getMap('costCenters', id), listCostCenters: () => listMap('costCenters'), saveCostCenter: (item) => saveTo(state.costCenters, item),
    getProject: (id) => getMap('projects', id), listProjects: () => listMap('projects'), saveProject: (item) => saveTo(state.projects, item),
    getDepartment: (id) => getMap('departments', id), listDepartments: () => listMap('departments'), saveDepartment: (item) => saveTo(state.departments, item),
    getPurchaseRequest: (id) => getMap('purchaseRequests', id), listPurchaseRequests: () => listMap('purchaseRequests'), savePurchaseRequest: (item) => saveTo(state.purchaseRequests, item),
    getPurchaseOrder: (id) => getMap('purchaseOrders', id), listPurchaseOrders: () => listMap('purchaseOrders'), savePurchaseOrder: (item) => saveTo(state.purchaseOrders, item),
    getReceipt: (id) => getMap('receipts', id), listReceipts: () => listMap('receipts'), saveReceipt: (item) => saveTo(state.receipts, item),
    getReservation: (id) => getMap('reservations', id), listReservations: () => listMap('reservations'), saveReservation: (item) => saveTo(state.reservations, item),
    getLot: (id) => getMap('lots', id), listLots: () => listMap('lots'), saveLot: (item) => saveTo(state.lots, item),
    getSerial: (id) => getMap('serials', id), listSerials: () => listMap('serials'), saveSerial: (item) => saveTo(state.serials, item),
    getTransitTransfer: (id) => getMap('transitTransfers', id), listTransitTransfers: () => listMap('transitTransfers'), saveTransitTransfer: (item) => saveTo(state.transitTransfers, item),
    getDocument: (id) => getMap('documents', id), listDocuments: () => listMap('documents'), saveDocument: (item) => saveTo(state.documents, item),
    getHardwareSetting: (id) => getMap('hardwareSettings', id), listHardwareSettings: () => listMap('hardwareSettings'), saveHardwareSetting: (item) => saveTo(state.hardwareSettings, item),
    getBalance: (productId, warehouseId) => state.balances.get(balanceKey(productId, warehouseId)) ?? 0,
    setBalance(productId, warehouseId, quantity) { state.balances.set(balanceKey(productId, warehouseId), quantity); return quantity; },
    listBalances() { return [...state.balances.entries()].map(([key, quantity]) => { const [productId, warehouseId] = key.split('::'); return { productId, warehouseId, quantity }; }); },
    addMovement(movement) { state.movements.push(clone(movement)); return clone(movement); }, listMovements() { return state.movements.map(clone); },
    addInventory(session) { return saveTo(state.inventories, session); }, getInventory(id) { return getMap('inventories', id); }, listInventories() { return listMap('inventories'); }, saveInventory(session) { return saveTo(state.inventories, session); },
    addInventoryCount(item) { state.counts.set(`${item.inventoryId}::${item.productId}`, clone(item)); return clone(item); },
    getInventoryCount(inventoryId, productId) { return clone(state.counts.get(`${inventoryId}::${productId}`) ?? null); },
    listInventoryCounts(inventoryId) { return [...state.counts.values()].filter((item) => item.inventoryId === inventoryId).map(clone); },
    saveInventoryCount(item) { state.counts.set(`${item.inventoryId}::${item.productId}`, clone(item)); return clone(item); },
    hasOpenInventory(warehouseId) { return [...state.inventories.values()].some((item) => item.warehouseId === warehouseId && item.status === 'OPEN'); },
    addPriceHistory(item) { state.priceHistory.push(clone(item)); return clone(item); },
    listPriceHistory(productId = null) { return state.priceHistory.filter((item) => !productId || item.productId === productId).map(clone); },
    exportState() {
      const out = { balances: api.listBalances(), movements: api.listMovements(), counts: [...state.counts.values()].map(clone), priceHistory: api.listPriceHistory() };
      for (const name of MAP_COLLECTIONS) out[name] = listMap(name);
      return out;
    },
    replaceState(next) { if (!next || typeof next !== 'object' || Array.isArray(next)) throw new TypeError('state must be an object'); load(next); return api.exportState(); },
    async transaction(work) { const saved = snapshot(); try { return await work(); } catch (error) { restore(saved); throw error; } }
  };
  return api;
}
