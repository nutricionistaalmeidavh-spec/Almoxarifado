function clone(value) {
  return value == null ? value : structuredClone(value);
}

function balanceKey(productId, warehouseId) {
  return `${productId}::${warehouseId}`;
}

export function createMemoryStockRepository(seed = {}) {
  const state = {
    categories: new Map((seed.categories ?? []).map((item) => [item.id, clone(item)])),
    suppliers: new Map((seed.suppliers ?? []).map((item) => [item.id, clone(item)])),
    products: new Map((seed.products ?? []).map((item) => [item.id, clone(item)])),
    warehouses: new Map((seed.warehouses ?? []).map((item) => [item.id, clone(item)])),
    users: new Map((seed.users ?? []).map((item) => [item.id, clone(item)])),
    balances: new Map((seed.balances ?? []).map((item) => [balanceKey(item.productId, item.warehouseId), Number(item.quantity)])),
    movements: (seed.movements ?? []).map(clone),
    inventories: new Map((seed.inventories ?? []).map((item) => [item.id, clone(item)])),
    counts: new Map((seed.counts ?? []).map((item) => [`${item.inventoryId}::${item.productId}`, clone(item)]))
  };

  const cloneMap = (map) => new Map([...map].map(([key, value]) => [key, clone(value)]));
  const snapshot = () => ({
    categories: cloneMap(state.categories),
    suppliers: cloneMap(state.suppliers),
    products: cloneMap(state.products),
    warehouses: cloneMap(state.warehouses),
    users: cloneMap(state.users),
    balances: new Map(state.balances),
    movements: state.movements.map(clone),
    inventories: cloneMap(state.inventories),
    counts: cloneMap(state.counts)
  });

  const restore = (saved) => { for (const key of Object.keys(state)) state[key] = saved[key]; };
  const saveTo = (map, item) => { map.set(item.id, clone(item)); return clone(item); };

  const api = {
    getCategory: (id) => clone(state.categories.get(id) ?? null),
    listCategories: () => [...state.categories.values()].map(clone),
    saveCategory: (item) => saveTo(state.categories, item),
    getSupplier: (id) => clone(state.suppliers.get(id) ?? null),
    listSuppliers: () => [...state.suppliers.values()].map(clone),
    saveSupplier: (item) => saveTo(state.suppliers, item),
    getProduct: (id) => clone(state.products.get(id) ?? null),
    listProducts: () => [...state.products.values()].map(clone),
    saveProduct: (item) => saveTo(state.products, item),
    getWarehouse: (id) => clone(state.warehouses.get(id) ?? null),
    listWarehouses: () => [...state.warehouses.values()].map(clone),
    saveWarehouse: (item) => saveTo(state.warehouses, item),
    getUser: (id) => clone(state.users.get(id) ?? null),
    listUsers: () => [...state.users.values()].map(clone),
    saveUser: (item) => saveTo(state.users, item),
    getBalance: (productId, warehouseId) => state.balances.get(balanceKey(productId, warehouseId)) ?? 0,
    setBalance(productId, warehouseId, quantity) { state.balances.set(balanceKey(productId, warehouseId), quantity); return quantity; },
    listBalances() { return [...state.balances.entries()].map(([key, quantity]) => { const [productId, warehouseId] = key.split('::'); return { productId, warehouseId, quantity }; }); },
    addMovement(movement) { state.movements.push(clone(movement)); return clone(movement); },
    listMovements() { return state.movements.map(clone); },
    addInventory(session) { return saveTo(state.inventories, session); },
    getInventory(id) { return clone(state.inventories.get(id) ?? null); },
    listInventories() { return [...state.inventories.values()].map(clone); },
    saveInventory(session) { return saveTo(state.inventories, session); },
    addInventoryCount(item) { state.counts.set(`${item.inventoryId}::${item.productId}`, clone(item)); return clone(item); },
    getInventoryCount(inventoryId, productId) { return clone(state.counts.get(`${inventoryId}::${productId}`) ?? null); },
    listInventoryCounts(inventoryId) { return [...state.counts.values()].filter((item) => item.inventoryId === inventoryId).map(clone); },
    saveInventoryCount(item) { state.counts.set(`${item.inventoryId}::${item.productId}`, clone(item)); return clone(item); },
    hasOpenInventory(warehouseId) { return [...state.inventories.values()].some((item) => item.warehouseId === warehouseId && item.status === 'OPEN'); },
    exportState() {
      return {
        categories: api.listCategories(), suppliers: api.listSuppliers(), products: api.listProducts(), warehouses: api.listWarehouses(), users: api.listUsers(),
        balances: api.listBalances(), movements: api.listMovements(), inventories: api.listInventories(), counts: [...state.counts.values()].map(clone)
      };
    },
    async transaction(work) { const saved = snapshot(); try { return await work(); } catch (error) { restore(saved); throw error; } }
  };
  return api;
}
