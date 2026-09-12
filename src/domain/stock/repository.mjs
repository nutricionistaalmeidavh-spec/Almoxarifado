function clone(value) {
  return value == null ? value : structuredClone(value);
}

function balanceKey(productId, warehouseId) {
  return `${productId}::${warehouseId}`;
}

export function createMemoryStockRepository(seed = {}) {
  const state = {
    products: new Map((seed.products ?? []).map((item) => [item.id, clone(item)])),
    warehouses: new Map((seed.warehouses ?? []).map((item) => [item.id, clone(item)])),
    users: new Map((seed.users ?? []).map((item) => [item.id, clone(item)])),
    balances: new Map((seed.balances ?? []).map((item) => [balanceKey(item.productId, item.warehouseId), Number(item.quantity)])),
    movements: (seed.movements ?? []).map(clone),
    inventories: new Map((seed.inventories ?? []).map((item) => [item.id, clone(item)])),
    counts: new Map((seed.counts ?? []).map((item) => [`${item.inventoryId}::${item.productId}`, clone(item)]))
  };

  const snapshot = () => ({
    products: new Map([...state.products].map(([key, value]) => [key, clone(value)])),
    warehouses: new Map([...state.warehouses].map(([key, value]) => [key, clone(value)])),
    users: new Map([...state.users].map(([key, value]) => [key, clone(value)])),
    balances: new Map(state.balances),
    movements: state.movements.map(clone),
    inventories: new Map([...state.inventories].map(([key, value]) => [key, clone(value)])),
    counts: new Map([...state.counts].map(([key, value]) => [key, clone(value)]))
  });

  const restore = (saved) => {
    for (const key of Object.keys(state)) state[key] = saved[key];
  };

  return {
    getProduct: (id) => clone(state.products.get(id) ?? null),
    getWarehouse: (id) => clone(state.warehouses.get(id) ?? null),
    getUser: (id) => clone(state.users.get(id) ?? null),
    listProducts: () => [...state.products.values()].map(clone),
    getBalance: (productId, warehouseId) => state.balances.get(balanceKey(productId, warehouseId)) ?? 0,
    setBalance(productId, warehouseId, quantity) {
      state.balances.set(balanceKey(productId, warehouseId), quantity);
      return quantity;
    },
    addMovement(movement) {
      state.movements.push(clone(movement));
      return clone(movement);
    },
    listMovements() {
      return state.movements.map(clone);
    },
    addInventory(session) {
      state.inventories.set(session.id, clone(session));
      return clone(session);
    },
    getInventory(id) {
      return clone(state.inventories.get(id) ?? null);
    },
    saveInventory(session) {
      state.inventories.set(session.id, clone(session));
      return clone(session);
    },
    addInventoryCount(item) {
      state.counts.set(`${item.inventoryId}::${item.productId}`, clone(item));
      return clone(item);
    },
    getInventoryCount(inventoryId, productId) {
      return clone(state.counts.get(`${inventoryId}::${productId}`) ?? null);
    },
    listInventoryCounts(inventoryId) {
      return [...state.counts.values()].filter((item) => item.inventoryId === inventoryId).map(clone);
    },
    saveInventoryCount(item) {
      state.counts.set(`${item.inventoryId}::${item.productId}`, clone(item));
      return clone(item);
    },
    hasOpenInventory(warehouseId) {
      return [...state.inventories.values()].some((item) => item.warehouseId === warehouseId && item.status === 'OPEN');
    },
    async transaction(work) {
      const saved = snapshot();
      try {
        return await work();
      } catch (error) {
        restore(saved);
        throw error;
      }
    }
  };
}
