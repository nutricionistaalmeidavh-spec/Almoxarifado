import { randomUUID } from 'node:crypto';
import { DomainError, requireId, requirePositiveNumber } from '../shared/domain-error.mjs';

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new DomainError('INVALID_ITEMS', 'at least one item is required');
  return items.map((item) => ({
    productId: requireId(item.productId, 'productId'),
    quantity: requirePositiveNumber(Number(item.quantity)),
    unitCost: item.unitCost == null ? null : requirePositiveNumber(Number(item.unitCost), 'unitCost')
  }));
}
function ensure(repository, getter, id, code, label) {
  const entity = repository[getter](requireId(id, `${label}Id`));
  if (!entity || entity.active === false) throw new DomainError(code, `${label} not found`, { id });
  return entity;
}

export function createPurchasingService({ repository, stock, recordCost = async () => {}, now = () => new Date().toISOString(), idFactory = randomUUID } = {}) {
  if (!repository || !stock) throw new TypeError('repository and stock service are required');
  return {
    createRequest({ warehouseId, items, requestedBy, notes = '' }) {
      ensure(repository,'getWarehouse',warehouseId,'WAREHOUSE_NOT_FOUND','warehouse');
      ensure(repository,'getUser',requestedBy,'USER_NOT_FOUND','user');
      const normalized = normalizeItems(items);
      for (const item of normalized) ensure(repository,'getProduct',item.productId,'PRODUCT_NOT_FOUND','product');
      return repository.savePurchaseRequest({ id:idFactory(), warehouseId, items:normalized.map(({unitCost,...item})=>item), requestedBy, notes:String(notes).trim(), status:'REQUESTED', quotes:[], createdAt:now(), approvedAt:null, approvedBy:null });
    },
    addQuote({ requestId, supplierId, items, userId }) {
      const request = repository.getPurchaseRequest(requireId(requestId,'requestId'));
      if (!request) throw new DomainError('PURCHASE_REQUEST_NOT_FOUND','purchase request not found');
      if (!['REQUESTED','QUOTED'].includes(request.status)) throw new DomainError('INVALID_PURCHASE_STATUS','request cannot receive quotes',{status:request.status});
      ensure(repository,'getSupplier',supplierId,'SUPPLIER_NOT_FOUND','supplier');
      ensure(repository,'getUser',userId,'USER_NOT_FOUND','user');
      const quotedItems = normalizeItems(items);
      const quote = { id:idFactory(), supplierId, items:quotedItems, quotedBy:userId, quotedAt:now(), total:quotedItems.reduce((sum,item)=>sum + item.quantity*item.unitCost,0) };
      const saved = { ...request, status:'QUOTED', quotes:[...(request.quotes??[]), quote] };
      repository.savePurchaseRequest(saved);
      return quote;
    },
    approveRequest({ requestId, userId }) {
      const request = repository.getPurchaseRequest(requireId(requestId,'requestId'));
      if (!request) throw new DomainError('PURCHASE_REQUEST_NOT_FOUND','purchase request not found');
      if (!['REQUESTED','QUOTED'].includes(request.status)) throw new DomainError('INVALID_PURCHASE_STATUS','request cannot be approved',{status:request.status});
      ensure(repository,'getUser',userId,'USER_NOT_FOUND','user');
      return repository.savePurchaseRequest({ ...request, status:'APPROVED', approvedAt:now(), approvedBy:userId });
    },
    createOrder({ requestId, supplierId, quoteId = null, userId }) {
      const request = repository.getPurchaseRequest(requireId(requestId,'requestId'));
      if (!request) throw new DomainError('PURCHASE_REQUEST_NOT_FOUND','purchase request not found');
      if (request.status !== 'APPROVED') throw new DomainError('PURCHASE_NOT_APPROVED','purchase request must be approved');
      ensure(repository,'getSupplier',supplierId,'SUPPLIER_NOT_FOUND','supplier');
      ensure(repository,'getUser',userId,'USER_NOT_FOUND','user');
      const quote = quoteId ? (request.quotes??[]).find((item)=>item.id===quoteId) : (request.quotes??[]).find((item)=>item.supplierId===supplierId);
      if (quoteId && !quote) throw new DomainError('QUOTE_NOT_FOUND','quote not found',{quoteId});
      if (quote && quote.supplierId !== supplierId) throw new DomainError('QUOTE_SUPPLIER_MISMATCH','quote does not belong to selected supplier',{quoteId:quote.id,supplierId});
      const items = quote?.items ?? request.items.map((item)=>({ ...item, unitCost:0 }));
      if (items.some((item)=>!Number.isFinite(item.unitCost) || item.unitCost <= 0)) throw new DomainError('UNIT_COST_REQUIRED','approved order requires unit cost for every item');
      const order = repository.savePurchaseOrder({ id:idFactory(), requestId, supplierId, warehouseId:request.warehouseId, items:items.map((item)=>({...item})), status:'ORDERED', orderedBy:userId, orderedAt:now(), receivedAt:null, receivedBy:null, total:items.reduce((sum,item)=>sum+item.quantity*item.unitCost,0) });
      repository.savePurchaseRequest({ ...request, status:'ORDERED', orderId:order.id });
      return order;
    },
    async receiveOrder({ orderId, userId }) {
      const order = repository.getPurchaseOrder(requireId(orderId,'orderId'));
      if (!order) throw new DomainError('PURCHASE_ORDER_NOT_FOUND','purchase order not found');
      if (order.status !== 'ORDERED') throw new DomainError('INVALID_PURCHASE_STATUS','order is not open for receiving',{status:order.status});
      ensure(repository,'getUser',userId,'USER_NOT_FOUND','user');
      const receiptId = idFactory();
      const receivedAt = now();
      const receipt = await repository.transaction(async () => {
        const movements = [];
        for (const item of order.items) {
          const before = repository.getBalance(item.productId, order.warehouseId);
          const movement = await stock.entry({ productId:item.productId, warehouseId:order.warehouseId, quantity:item.quantity, userId, reason:`Recebimento pedido ${order.id}` });
          movements.push(movement.id);
          await recordCost({ productId:item.productId, supplierId:order.supplierId, warehouseId:order.warehouseId, quantity:item.quantity, unitCost:item.unitCost, previousQuantity:before, userId, sourceType:'PURCHASE_ORDER', sourceId:order.id, occurredAt:receivedAt });
        }
        const saved = repository.saveReceipt({ id:receiptId, orderId:order.id, supplierId:order.supplierId, warehouseId:order.warehouseId, items:order.items.map((item)=>({...item})), movementIds:movements, receivedBy:userId, receivedAt });
        repository.savePurchaseOrder({ ...order, status:'RECEIVED', receivedAt, receivedBy:userId, receiptId });
        const request = repository.getPurchaseRequest(order.requestId);
        if (request) repository.savePurchaseRequest({ ...request, status:'RECEIVED' });
        return saved;
      });
      return receipt;
    }
  };
}
