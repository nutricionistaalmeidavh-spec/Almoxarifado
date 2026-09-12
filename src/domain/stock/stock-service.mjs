import { randomUUID } from 'node:crypto';
import { DomainError, requireId, requireNonNegativeNumber, requirePositiveNumber } from '../shared/domain-error.mjs';

function ensureEntity(repository, kind, id) {
  const getter = kind === 'product' ? 'getProduct' : kind === 'warehouse' ? 'getWarehouse' : 'getUser';
  const entity = repository[getter](id);
  if (!entity || entity.active === false) throw new DomainError(`${kind.toUpperCase()}_NOT_FOUND`, `${kind} not found`, { id });
  return entity;
}

function ensureUnlocked(repository, warehouseId) {
  if (repository.hasOpenInventory(warehouseId)) {
    throw new DomainError('WAREHOUSE_INVENTORY_LOCKED', 'warehouse has an open inventory', { warehouseId });
  }
}

export function createStockService({ repository, publish = async () => {}, now = () => new Date().toISOString(), idFactory = randomUUID } = {}) {
  if (!repository || typeof repository.transaction !== 'function') throw new TypeError('repository is required');
  if (typeof publish !== 'function') throw new TypeError('publish must be a function');

  const validateRefs = (productId, warehouseId, userId) => {
    requireId(productId, 'productId'); requireId(warehouseId, 'warehouseId'); requireId(userId, 'userId');
    ensureEntity(repository, 'product', productId); ensureEntity(repository, 'warehouse', warehouseId); ensureEntity(repository, 'user', userId);
  };

  const writeMovement = ({ type, productId, warehouseId, relatedWarehouseId = null, quantity, delta, before, after, transferId = null, inventoryId = null, reason = '', userId }) => {
    const movement = {
      id: idFactory(), type, productId, warehouseId, relatedWarehouseId, quantity, delta, before, after,
      transferId, inventoryId, reason: reason || '', userId, occurredAt: now()
    };
    repository.addMovement(movement);
    return movement;
  };

  return {
    async balance(productId, warehouseId) {
      requireId(productId, 'productId'); requireId(warehouseId, 'warehouseId');
      ensureEntity(repository, 'product', productId); ensureEntity(repository, 'warehouse', warehouseId);
      return repository.getBalance(productId, warehouseId);
    },

    async entry({ productId, warehouseId, quantity, userId, reason = '' }) {
      validateRefs(productId, warehouseId, userId); requirePositiveNumber(quantity);
      ensureUnlocked(repository, warehouseId);
      const movement = await repository.transaction(async () => {
        const before = repository.getBalance(productId, warehouseId);
        const after = before + quantity;
        repository.setBalance(productId, warehouseId, after);
        return writeMovement({ type: 'ENTRY', productId, warehouseId, quantity, delta: quantity, before, after, reason, userId });
      });
      await publish({ type: 'stock.entry.created', payload: { movementId: movement.id, productId, warehouseId, quantity } });
      return movement;
    },

    async exit({ productId, warehouseId, quantity, userId, reason = '' }) {
      validateRefs(productId, warehouseId, userId); requirePositiveNumber(quantity);
      ensureUnlocked(repository, warehouseId);
      const movement = await repository.transaction(async () => {
        const before = repository.getBalance(productId, warehouseId);
        if (before < quantity) throw new DomainError('INSUFFICIENT_STOCK', 'insufficient stock', { productId, warehouseId, available: before, requested: quantity });
        const after = before - quantity;
        repository.setBalance(productId, warehouseId, after);
        return writeMovement({ type: 'EXIT', productId, warehouseId, quantity, delta: -quantity, before, after, reason, userId });
      });
      await publish({ type: 'stock.exit.created', payload: { movementId: movement.id, productId, warehouseId, quantity } });
      return movement;
    },

    async adjust({ productId, warehouseId, newQuantity, userId, reason = '' }) {
      validateRefs(productId, warehouseId, userId); requireNonNegativeNumber(newQuantity, 'newQuantity');
      ensureUnlocked(repository, warehouseId);
      const movement = await repository.transaction(async () => {
        const before = repository.getBalance(productId, warehouseId);
        const after = newQuantity;
        const delta = after - before;
        repository.setBalance(productId, warehouseId, after);
        return writeMovement({ type: 'ADJUSTMENT', productId, warehouseId, quantity: Math.abs(delta), delta, before, after, reason, userId });
      });
      await publish({ type: 'stock.adjusted', payload: { movementId: movement.id, productId, warehouseId, before: movement.before, after: movement.after } });
      return movement;
    },

    async transfer({ productId, sourceWarehouseId, targetWarehouseId, quantity, userId, reason = '' }) {
      requireId(sourceWarehouseId, 'sourceWarehouseId'); requireId(targetWarehouseId, 'targetWarehouseId');
      if (sourceWarehouseId === targetWarehouseId) throw new DomainError('INVALID_TRANSFER', 'source and target warehouses must differ');
      validateRefs(productId, sourceWarehouseId, userId); ensureEntity(repository, 'warehouse', targetWarehouseId); requirePositiveNumber(quantity);
      ensureUnlocked(repository, sourceWarehouseId); ensureUnlocked(repository, targetWarehouseId);
      const transferId = idFactory();
      const result = await repository.transaction(async () => {
        const sourceBefore = repository.getBalance(productId, sourceWarehouseId);
        if (sourceBefore < quantity) throw new DomainError('INSUFFICIENT_STOCK', 'insufficient stock', { productId, warehouseId: sourceWarehouseId, available: sourceBefore, requested: quantity });
        const targetBefore = repository.getBalance(productId, targetWarehouseId);
        const sourceAfter = sourceBefore - quantity;
        const targetAfter = targetBefore + quantity;
        repository.setBalance(productId, sourceWarehouseId, sourceAfter);
        repository.setBalance(productId, targetWarehouseId, targetAfter);
        const out = writeMovement({ type: 'TRANSFER_OUT', productId, warehouseId: sourceWarehouseId, relatedWarehouseId: targetWarehouseId, quantity, delta: -quantity, before: sourceBefore, after: sourceAfter, transferId, reason, userId });
        const incoming = writeMovement({ type: 'TRANSFER_IN', productId, warehouseId: targetWarehouseId, relatedWarehouseId: sourceWarehouseId, quantity, delta: quantity, before: targetBefore, after: targetAfter, transferId, reason, userId });
        return { transferId, out, incoming };
      });
      await publish({ type: 'stock.transferred', payload: { transferId, productId, sourceWarehouseId, targetWarehouseId, quantity } });
      return result;
    }
  };
}
