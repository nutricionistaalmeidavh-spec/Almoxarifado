import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createStockService } from '../src/domain/stock/stock-service.mjs';
import { createPurchasingService } from '../src/domain/purchasing/purchasing-service.mjs';

function fixture() {
  let seq = 0;
  const repository = createMemoryStockRepository({
    users: [{ id:'u1', name:'Comprador', login:'comprador', role:'ADMIN', active:true }],
    suppliers: [{ id:'s1', name:'Fornecedor A', active:true }, { id:'s2', name:'Fornecedor B', active:true }],
    products: [{ id:'p1', sku:'P1', name:'Tubo', unit:'un', active:true }, { id:'p2', sku:'P2', name:'Válvula', unit:'un', active:true }],
    warehouses: [{ id:'w1', name:'Principal', active:true }]
  });
  const idFactory = () => `p-${++seq}`;
  const stock = createStockService({ repository, idFactory });
  const purchasing = createPurchasingService({ repository, stock, idFactory });
  return { repository, purchasing };
}

test('não permite aprovar solicitação sem cotação e mantém o estado', () => {
  const { repository, purchasing } = fixture();
  const request = purchasing.createRequest({ warehouseId:'w1', requestedBy:'u1', items:[{productId:'p1',quantity:2}] });
  assert.throws(() => purchasing.approveRequest({ requestId:request.id, userId:'u1' }), error => error.code === 'QUOTE_REQUIRED');
  assert.equal(repository.getPurchaseRequest(request.id).status, 'REQUESTED');
});

test('recupera solicitação legada aprovada sem cotação, sem duplicar pedido ou perder ID', () => {
  const { repository, purchasing } = fixture();
  const request = purchasing.createRequest({ warehouseId:'w1', requestedBy:'u1', items:[{productId:'p1',quantity:2}] });
  repository.savePurchaseRequest({ ...request, status:'APPROVED', approvedBy:'u1', approvedAt:'2026-11-23T14:00:00Z' });
  const quote = purchasing.addQuote({ requestId:request.id, supplierId:'s1', userId:'u1', items:[{productId:'p1',quantity:2,unitCost:9.5}] });
  const afterQuote = repository.getPurchaseRequest(request.id);
  assert.equal(afterQuote.status, 'QUOTED');
  assert.equal(afterQuote.approvedBy, null);
  assert.equal(afterQuote.approvedAt, null);
  purchasing.approveRequest({ requestId:request.id, userId:'u1' });
  const order = purchasing.createOrder({ requestId:request.id, supplierId:'s1', userId:'u1' });
  assert.equal(order.total, 19);
  assert.equal(order.requestId, request.id);
  assert.equal(repository.listPurchaseRequests().length, 1);
  assert.equal(repository.listPurchaseOrders().length, 1);
  assert.equal(repository.getPurchaseRequest(request.id).status, 'ORDERED');
  assert.equal(quote.supplierId, 's1');
});

test('não aprova cotação incompleta ou sem custo positivo para todos os itens', () => {
  const { repository, purchasing } = fixture();
  const request = purchasing.createRequest({ warehouseId:'w1', requestedBy:'u1', items:[{productId:'p1',quantity:2},{productId:'p2',quantity:3}] });
  assert.throws(() => purchasing.addQuote({ requestId:request.id, supplierId:'s1', userId:'u1', items:[{productId:'p1',quantity:2,unitCost:9}] }), error => error.code === 'QUOTE_ITEMS_MISMATCH');
  assert.throws(() => purchasing.addQuote({ requestId:request.id, supplierId:'s1', userId:'u1', items:[{productId:'p1',quantity:2,unitCost:9},{productId:'p2',quantity:3,unitCost:0}] }), error => error.code === 'INVALID_NUMBER');
  assert.equal(repository.getPurchaseRequest(request.id).status, 'REQUESTED');
});

test('pedido exige cotação do fornecedor escolhido, mesmo com solicitação aprovada', () => {
  const { purchasing } = fixture();
  const request = purchasing.createRequest({ warehouseId:'w1', requestedBy:'u1', items:[{productId:'p1',quantity:2}] });
  purchasing.addQuote({ requestId:request.id, supplierId:'s1', userId:'u1', items:[{productId:'p1',quantity:2,unitCost:9}] });
  purchasing.approveRequest({ requestId:request.id, userId:'u1' });
  assert.throws(() => purchasing.createOrder({ requestId:request.id, supplierId:'s2', userId:'u1' }), error => error.code === 'QUOTE_REQUIRED');
});

test('interface mantém solicitação aprovada recuperável e traduz erros conhecidos', async () => {
  const app = await readFile(new URL('../apps/web/app.js', import.meta.url), 'utf8');
  assert.match(app, /QUOTE_REQUIRED:/);
  assert.match(app, /QUOTE_ITEMS_MISMATCH:/);
  assert.match(app, /'REQUESTED','QUOTED','APPROVED'/);
  assert.match(app, /function updatePurchaseGuidance/);
});
