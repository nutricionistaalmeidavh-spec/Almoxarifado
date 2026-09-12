import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';

function fixture() {
  const repository = createMemoryStockRepository({
    products: [{ id: 'p1', name: 'Tubo PVC', active: true }],
    warehouses: [{ id: 'w1', name: 'Principal', active: true }, { id: 'w2', name: 'Obra', active: true }],
    users: [{ id: 'u1', name: 'Almoxarife', active: true }]
  });
  const events = [];
  let sequence = 0;
  const service = createStockService({
    repository,
    now: () => '2026-09-12T12:00:00.000Z',
    idFactory: () => `id-${++sequence}`,
    publish: async (event) => events.push(event)
  });
  return { repository, service, events };
}

test('entry and exit keep an auditable non-negative balance', async () => {
  const { service, repository, events } = fixture();
  await service.entry({ productId: 'p1', warehouseId: 'w1', quantity: 10, userId: 'u1', reason: 'Compra' });
  await service.exit({ productId: 'p1', warehouseId: 'w1', quantity: 3, userId: 'u1', reason: 'Uso em obra' });
  assert.equal(await service.balance('p1', 'w1'), 7);
  assert.deepEqual(repository.listMovements().map((movement) => [movement.type, movement.before, movement.after]), [
    ['ENTRY', 0, 10],
    ['EXIT', 10, 7]
  ]);
  assert.deepEqual(events.map((event) => event.type), ['stock.entry.created', 'stock.exit.created']);
});

test('exit rejects stock below zero without creating movement', async () => {
  const { service, repository } = fixture();
  await assert.rejects(
    service.exit({ productId: 'p1', warehouseId: 'w1', quantity: 1, userId: 'u1' }),
    (error) => error.code === 'INSUFFICIENT_STOCK'
  );
  assert.equal(await service.balance('p1', 'w1'), 0);
  assert.equal(repository.listMovements().length, 0);
});

test('adjustment sets the physical balance and records the delta', async () => {
  const { service, repository } = fixture();
  await service.entry({ productId: 'p1', warehouseId: 'w1', quantity: 10, userId: 'u1' });
  const movement = await service.adjust({ productId: 'p1', warehouseId: 'w1', newQuantity: 6, userId: 'u1', reason: 'Correção' });
  assert.equal(movement.delta, -4);
  assert.equal(await service.balance('p1', 'w1'), 6);
  assert.equal(repository.listMovements().at(-1).type, 'ADJUSTMENT');
});

test('transfer is atomic and creates linked out/in movements', async () => {
  const { service, repository } = fixture();
  await service.entry({ productId: 'p1', warehouseId: 'w1', quantity: 8, userId: 'u1' });
  const result = await service.transfer({ productId: 'p1', sourceWarehouseId: 'w1', targetWarehouseId: 'w2', quantity: 5, userId: 'u1' });
  assert.equal(await service.balance('p1', 'w1'), 3);
  assert.equal(await service.balance('p1', 'w2'), 5);
  const transferMovements = repository.listMovements().filter((movement) => movement.transferId === result.transferId);
  assert.deepEqual(transferMovements.map((movement) => movement.type), ['TRANSFER_OUT', 'TRANSFER_IN']);
});
