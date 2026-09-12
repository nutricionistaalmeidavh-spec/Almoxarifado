import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';
import { createInventoryService } from '../src/domain/inventory/inventory-service.mjs';

function fixture() {
  const repository = createMemoryStockRepository({
    products: [
      { id: 'p1', name: 'Tubo PVC', active: true },
      { id: 'p2', name: 'Joelho PVC', active: true }
    ],
    warehouses: [{ id: 'w1', name: 'Principal', active: true }],
    users: [{ id: 'u1', name: 'Almoxarife', active: true }],
    balances: [
      { productId: 'p1', warehouseId: 'w1', quantity: 10 },
      { productId: 'p2', warehouseId: 'w1', quantity: 4 }
    ]
  });
  const events = [];
  let sequence = 0;
  const common = {
    repository,
    now: () => '2026-09-12T13:00:00.000Z',
    idFactory: () => `id-${++sequence}`,
    publish: async (event) => events.push(event)
  };
  return {
    repository,
    stock: createStockService(common),
    inventory: createInventoryService(common),
    events
  };
}

test('starting inventory snapshots balances and locks warehouse movements', async () => {
  const { inventory, stock } = fixture();
  const session = await inventory.start({ warehouseId: 'w1', userId: 'u1' });
  const counts = inventory.listCounts(session.id);
  assert.deepEqual(counts.map((item) => [item.productId, item.expectedQuantity]), [['p1', 10], ['p2', 4]]);
  await assert.rejects(
    stock.exit({ productId: 'p1', warehouseId: 'w1', quantity: 1, userId: 'u1' }),
    (error) => error.code === 'WAREHOUSE_INVENTORY_LOCKED'
  );
});

test('count and recount expose the final divergence', async () => {
  const { inventory } = fixture();
  const session = await inventory.start({ warehouseId: 'w1', userId: 'u1', productIds: ['p1'] });
  let count = await inventory.count({ inventoryId: session.id, productId: 'p1', quantity: 8, userId: 'u1' });
  assert.equal(count.divergence, -2);
  count = await inventory.recount({ inventoryId: session.id, productId: 'p1', quantity: 9, userId: 'u1' });
  assert.equal(count.finalQuantity, 9);
  assert.equal(count.divergence, -1);
});

test('closing inventory applies adjustments, writes audit movement and unlocks warehouse', async () => {
  const { inventory, stock, repository, events } = fixture();
  const session = await inventory.start({ warehouseId: 'w1', userId: 'u1', productIds: ['p1'] });
  await inventory.count({ inventoryId: session.id, productId: 'p1', quantity: 8, userId: 'u1' });
  const closed = await inventory.close({ inventoryId: session.id, userId: 'u1' });
  assert.equal(closed.status, 'CLOSED');
  assert.equal(await stock.balance('p1', 'w1'), 8);
  const adjustment = repository.listMovements().find((movement) => movement.inventoryId === session.id);
  assert.equal(adjustment.type, 'ADJUSTMENT');
  assert.equal(adjustment.delta, -2);
  await stock.entry({ productId: 'p1', warehouseId: 'w1', quantity: 1, userId: 'u1' });
  assert.equal(await stock.balance('p1', 'w1'), 9);
  assert.equal(events.some((event) => event.type === 'inventory.closed'), true);
});

test('inventory cannot close while an item is uncounted', async () => {
  const { inventory } = fixture();
  const session = await inventory.start({ warehouseId: 'w1', userId: 'u1' });
  await inventory.count({ inventoryId: session.id, productId: 'p1', quantity: 10, userId: 'u1' });
  await assert.rejects(
    inventory.close({ inventoryId: session.id, userId: 'u1' }),
    (error) => error.code === 'INVENTORY_INCOMPLETE'
  );
});
