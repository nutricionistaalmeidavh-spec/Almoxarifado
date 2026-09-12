import { randomUUID } from 'node:crypto';
import { DomainError, requireId, requireNonNegativeNumber } from '../shared/domain-error.mjs';

function ensureActive(entity, code, label, id) {
  if (!entity || entity.active === false) throw new DomainError(code, `${label} not found`, { id });
  return entity;
}

export function createInventoryService({ repository, publish = async () => {}, now = () => new Date().toISOString(), idFactory = randomUUID } = {}) {
  if (!repository || typeof repository.transaction !== 'function') throw new TypeError('repository is required');

  const sessionOrThrow = (inventoryId) => {
    requireId(inventoryId, 'inventoryId');
    const session = repository.getInventory(inventoryId);
    if (!session) throw new DomainError('INVENTORY_NOT_FOUND', 'inventory not found', { inventoryId });
    return session;
  };

  const openSessionOrThrow = (inventoryId) => {
    const session = sessionOrThrow(inventoryId);
    if (session.status !== 'OPEN') throw new DomainError('INVENTORY_NOT_OPEN', 'inventory is not open', { inventoryId, status: session.status });
    return session;
  };

  return {
    async start({ warehouseId, userId, productIds } = {}) {
      requireId(warehouseId, 'warehouseId'); requireId(userId, 'userId');
      ensureActive(repository.getWarehouse(warehouseId), 'WAREHOUSE_NOT_FOUND', 'warehouse', warehouseId);
      ensureActive(repository.getUser(userId), 'USER_NOT_FOUND', 'user', userId);
      if (repository.hasOpenInventory(warehouseId)) throw new DomainError('INVENTORY_ALREADY_OPEN', 'warehouse already has an open inventory', { warehouseId });

      const products = productIds == null
        ? repository.listProducts().filter((item) => item.active !== false)
        : productIds.map((id) => ensureActive(repository.getProduct(requireId(id, 'productId')), 'PRODUCT_NOT_FOUND', 'product', id));
      const uniqueProducts = [...new Map(products.map((item) => [item.id, item])).values()];
      const inventoryId = idFactory();
      const startedAt = now();
      const session = await repository.transaction(async () => {
        const created = repository.addInventory({ id: inventoryId, warehouseId, status: 'OPEN', startedAt, startedBy: userId, completedAt: null, completedBy: null, productCount: uniqueProducts.length });
        for (const product of uniqueProducts) {
          repository.addInventoryCount({
            id: idFactory(), inventoryId, productId: product.id,
            expectedQuantity: repository.getBalance(product.id, warehouseId),
            countedQuantity: null, recountQuantity: null, finalQuantity: null,
            divergence: null, countedBy: null, countedAt: null
          });
        }
        return created;
      });
      await publish({ type: 'inventory.started', payload: { inventoryId, warehouseId, productCount: uniqueProducts.length } });
      return session;
    },

    listCounts(inventoryId) {
      sessionOrThrow(inventoryId);
      return repository.listInventoryCounts(inventoryId).sort((a, b) => a.productId.localeCompare(b.productId));
    },

    async count({ inventoryId, productId, quantity, userId }) {
      openSessionOrThrow(inventoryId); requireId(productId, 'productId'); requireId(userId, 'userId'); requireNonNegativeNumber(quantity);
      ensureActive(repository.getUser(userId), 'USER_NOT_FOUND', 'user', userId);
      const current = repository.getInventoryCount(inventoryId, productId);
      if (!current) throw new DomainError('PRODUCT_NOT_IN_INVENTORY', 'product is not part of this inventory', { inventoryId, productId });
      const updated = {
        ...current,
        countedQuantity: quantity,
        recountQuantity: null,
        finalQuantity: quantity,
        divergence: quantity - current.expectedQuantity,
        countedBy: userId,
        countedAt: now()
      };
      repository.saveInventoryCount(updated);
      await publish({ type: 'inventory.counted', payload: { inventoryId, productId, divergence: updated.divergence } });
      return updated;
    },

    async recount({ inventoryId, productId, quantity, userId }) {
      openSessionOrThrow(inventoryId); requireId(productId, 'productId'); requireId(userId, 'userId'); requireNonNegativeNumber(quantity);
      ensureActive(repository.getUser(userId), 'USER_NOT_FOUND', 'user', userId);
      const current = repository.getInventoryCount(inventoryId, productId);
      if (!current) throw new DomainError('PRODUCT_NOT_IN_INVENTORY', 'product is not part of this inventory', { inventoryId, productId });
      if (current.countedQuantity == null) throw new DomainError('INITIAL_COUNT_REQUIRED', 'initial count is required before recount', { inventoryId, productId });
      const updated = {
        ...current,
        recountQuantity: quantity,
        finalQuantity: quantity,
        divergence: quantity - current.expectedQuantity,
        countedBy: userId,
        countedAt: now()
      };
      repository.saveInventoryCount(updated);
      await publish({ type: 'inventory.recounted', payload: { inventoryId, productId, divergence: updated.divergence } });
      return updated;
    },

    async close({ inventoryId, userId }) {
      const session = openSessionOrThrow(inventoryId); requireId(userId, 'userId');
      ensureActive(repository.getUser(userId), 'USER_NOT_FOUND', 'user', userId);
      const counts = repository.listInventoryCounts(inventoryId);
      const pending = counts.filter((item) => item.finalQuantity == null);
      if (pending.length) throw new DomainError('INVENTORY_INCOMPLETE', 'all products must be counted before closing inventory', { inventoryId, pendingProductIds: pending.map((item) => item.productId) });

      const completedAt = now();
      const result = await repository.transaction(async () => {
        let adjustments = 0;
        for (const item of counts) {
          const currentBalance = repository.getBalance(item.productId, session.warehouseId);
          if (currentBalance !== item.expectedQuantity) {
            throw new DomainError('INVENTORY_SNAPSHOT_STALE', 'stock changed after inventory snapshot', { inventoryId, productId: item.productId, expected: item.expectedQuantity, current: currentBalance });
          }
          const delta = item.finalQuantity - currentBalance;
          if (delta !== 0) {
            repository.setBalance(item.productId, session.warehouseId, item.finalQuantity);
            repository.addMovement({
              id: idFactory(), type: 'ADJUSTMENT', productId: item.productId, warehouseId: session.warehouseId,
              relatedWarehouseId: null, quantity: Math.abs(delta), delta, before: currentBalance, after: item.finalQuantity,
              transferId: null, inventoryId, reason: `Ajuste de inventário ${inventoryId}`, userId, occurredAt: completedAt
            });
            adjustments += 1;
          }
        }
        return repository.saveInventory({ ...session, status: 'CLOSED', completedAt, completedBy: userId, adjustments });
      });
      await publish({ type: 'inventory.closed', payload: { inventoryId, warehouseId: session.warehouseId, adjustments: result.adjustments } });
      return result;
    }
  };
}
