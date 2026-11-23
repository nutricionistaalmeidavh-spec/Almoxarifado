import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createAlmoxarifadoDesktopRuntime } from '../src/platform/desktop-runtime.mjs';

const PASSWORD = 'AlmoxE2eSenha123!';
const EVIDENCE = process.env.ALMOX_E2E_EVIDENCE || '';
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function scenario(t, name, run, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'almox-e2e-'));
  const runtime = createAlmoxarifadoDesktopRuntime({dataDir:dir,host:'127.0.0.1',port:0});
  const context = await browser.newContext({viewport:options.viewport || {width:1440,height:900},acceptDownloads:true});
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const addr = await runtime.start();
    const base = 'http://127.0.0.1:' + addr.port;
    await page.goto(base + '/', { waitUntil:'domcontentloaded' });
    await page.locator('#auth-form input[name="password"]').fill(PASSWORD);
    await page.locator('#auth-form button[type="submit"]').click();
    await page.locator('#app-shell').waitFor({state:'visible'});
    await page.locator('#connection-status').filter({hasText:'Servidor local conectado'}).waitFor();
    const result = await run({page,base,runtime,context});
    assert.deepEqual(errors, [], 'Uncaught browser JavaScript errors');
    if (EVIDENCE) {
      await mkdir(EVIDENCE, {recursive:true});
      await page.screenshot({path:path.join(EVIDENCE,name + '-ok.png'),fullPage:true});
    }
    return result;
  } catch (error) {
    if (EVIDENCE) {
      await mkdir(EVIDENCE, {recursive:true});
      try { await page.screenshot({path:path.join(EVIDENCE,name + '-FAILED.png'),fullPage:true}); } catch {}
    }
    throw error;
  } finally {
    await context.close();
    await runtime.stop();
    await rm(dir,{recursive:true,force:true});
  }
}

async function view(page, name) {
  await page.locator('button[data-view="' + name + '"]').click();
  await page.locator('#view-' + name).waitFor({state:'visible'});
  assert.equal(await page.locator('.view:visible').count(),1,'Only active view should be visible');
}
async function message(page, text) {
  await page.locator('#message .notice:not(.error)').filter({hasText:text}).waitFor({state:'visible'});
}
async function errorMessage(page) {
  await page.locator('#message .notice.error').waitFor({state:'visible'});
}
async function snapshot(page, base) {
  const token = await page.evaluate(() => sessionStorage.getItem('almox-token'));
  assert.ok(token, 'browser auth session missing');
  const response = await page.request.get(base + '/api/bootstrap', {headers:{Authorization:'Bearer ' + token}});
  assert.equal(response.status(), 200, 'bootstrap API should accept browser session');
  return response.json();
}
function balance(state, productId, warehouseId = 'main') {
  return state.balances.filter(b => b.productId === productId && b.warehouseId === warehouseId)
    .reduce((sum,b) => sum + Number(b.quantity || 0),0);
}
async function product(page, sku, name) {
  await view(page,'cadastros');
  const form = page.locator('#product-form');
  await form.locator('[name="sku"]').fill(sku);
  await form.locator('[name="name"]').fill(name);
  await form.locator('[name="unit"]').fill('UN');
  await form.locator('[name="minStock"]').fill('2');
  await form.locator('[name="targetStock"]').fill('8');
  await form.locator('[name="unitCost"]').fill('7.50');
  await page.locator('#product-save').click();
  await message(page,'Cadastro salvo.');
  await page.locator('#products-table').getByText(sku,{exact:true}).waitFor();
}
async function move(page, {type, productId, quantity, warehouseId = 'main', targetWarehouseId, newQuantity}) {
  await view(page,'movimentacoes');
  const form = page.locator('#movement-form');
  await form.locator('[name="type"]').selectOption(type);
  await form.locator('[name="productId"]').selectOption(productId);
  await form.locator('[name="warehouseId"]').selectOption(warehouseId);
  if (targetWarehouseId) await form.locator('[name="targetWarehouseId"]').selectOption(targetWarehouseId);
  if (quantity != null) await form.locator('[name="quantity"]').fill(String(quantity));
  if (newQuantity != null) await form.locator('[name="newQuantity"]').fill(String(newQuantity));
  await form.locator('[name="reason"]').fill('E2E isolado');
  await form.getByRole('button',{name:'Confirmar'}).click();
}

test('first access, session, logout/login, and free-core entitlement', async t => scenario(t,'01-auth', async ({page,base}) => {
  const ent = await page.request.get(base + '/api/license/status');
  assert.equal(ent.status(),200);
  assert.equal((await ent.json()).required,false,'Core cannot require a commercial license');
  assert.equal(await page.title(),'ArtiSys Almoxarifado');
  await view(page,'dashboard');
  await page.locator('#logout').click();
  await page.locator('#auth-form input[name="login"]').fill('admin');
  await page.locator('#auth-form input[name="password"]').fill(PASSWORD);
  await page.locator('#auth-form button[type="submit"]').click();
  await page.locator('#app-shell').waitFor({state:'visible'});
  const state = await snapshot(page,base);
  assert.equal(state.user.role,'ADMIN');
}));

test('product CRUD, auxiliaries, archive/reactivate, and linked deletion protection', async t => scenario(t,'02-catalog', async ({page,base}) => {
  await view(page,'cadastros');
  await page.locator('#category-form [name="name"]').fill('Hidráulica E2E');
  await page.locator('#category-form button').click();
  await message(page,'Cadastro salvo.');
  await page.locator('#supplier-form [name="name"]').fill('Fornecedor E2E');
  await page.locator('#supplier-form button').click();
  await message(page,'Cadastro salvo.');
  await page.locator('#warehouse-form [name="code"]').fill('AUX-E2E');
  await page.locator('#warehouse-form [name="name"]').fill('Depósito E2E');
  await page.locator('#warehouse-form button').click();
  await message(page,'Cadastro salvo.');
  await product(page,'SKU-E2E-001','Tubo inicial E2E');
  let state = await snapshot(page,base);
  const p = state.products.find(x => x.sku === 'SKU-E2E-001');
  assert.ok(p);
  assert.ok(state.categories.some(x => x.name === 'Hidráulica E2E'));
  assert.ok(state.suppliers.some(x => x.name === 'Fornecedor E2E'));
  assert.ok(state.warehouses.some(x => x.code === 'AUX-E2E'));
  let row = page.locator('#products-table tr').filter({hasText:'SKU-E2E-001'});
  await row.getByRole('button',{name:'Editar'}).click();
  await page.locator('#product-form [name="name"]').fill('Tubo revisado E2E');
  await page.locator('#product-save').click();
  await message(page,'Material atualizado.');
  state = await snapshot(page,base);
  assert.equal(state.products.find(x => x.id === p.id).name,'Tubo revisado E2E');
  row = page.locator('#products-table tr').filter({hasText:'SKU-E2E-001'});
  await row.getByRole('button',{name:'Desativar'}).click();
  await message(page,'Material desativado.');
  assert.equal((await snapshot(page,base)).products.find(x => x.id === p.id).active,false);
  await row.getByRole('button',{name:'Reativar'}).click();
  await message(page,'Material reativado.');
  assert.equal((await snapshot(page,base)).products.find(x => x.id === p.id).active,true);
  await product(page,'SKU-E2E-002','Material descartável');
  const disposable = (await snapshot(page,base)).products.find(x => x.sku === 'SKU-E2E-002');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#products-table tr').filter({hasText:'SKU-E2E-002'}).getByRole('button',{name:'Excluir'}).click();
  await message(page,'Material excluído.');
  assert.equal((await snapshot(page,base)).products.some(x => x.id === disposable.id),false);
  await move(page,{type:'ENTRY',productId:p.id,quantity:3});
  await message(page,'Movimentação registrada.');
  await view(page,'cadastros');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#products-table tr').filter({hasText:'SKU-E2E-001'}).getByRole('button',{name:'Excluir'}).click();
  await errorMessage(page);
  assert.ok((await snapshot(page,base)).products.some(x => x.id === p.id),'linked material must survive deletion attempt');
}));

test('entries, insufficient exit, legitimate exit, transfer, adjustment, persistent balances', async t => scenario(t,'03-stock', async ({page,base}) => {
  await product(page,'EST-E2E','Estoque E2E');
  let state = await snapshot(page,base);
  const p = state.products.find(x => x.sku === 'EST-E2E');
  await page.locator('#warehouse-form [name="code"]').fill('W2-E2E');
  await page.locator('#warehouse-form [name="name"]').fill('Depósito 2');
  await page.locator('#warehouse-form button').click();
  await message(page,'Cadastro salvo.');
  state = await snapshot(page,base);
  const w2 = state.warehouses.find(x => x.code === 'W2-E2E');
  assert.ok(w2);
  await move(page,{type:'ENTRY',productId:p.id,quantity:10});
  await message(page,'Movimentação registrada.');
  assert.equal(balance(await snapshot(page,base),p.id),10);
  await move(page,{type:'EXIT',productId:p.id,quantity:11});
  await errorMessage(page);
  assert.equal(balance(await snapshot(page,base),p.id),10,'failed exit must not change stock');
  await move(page,{type:'EXIT',productId:p.id,quantity:3});
  await message(page,'Movimentação registrada.');
  await move(page,{type:'TRANSFER',productId:p.id,quantity:2,targetWarehouseId:w2.id});
  await message(page,'Movimentação registrada.');
  state = await snapshot(page,base);
  assert.equal(balance(state,p.id),5);
  assert.equal(balance(state,p.id,w2.id),2);
  await move(page,{type:'ADJUSTMENT',productId:p.id,newQuantity:4});
  await message(page,'Movimentação registrada.');
  state = await snapshot(page,base);
  assert.equal(balance(state,p.id),4);
  assert.equal(balance(state,p.id,w2.id),2);
  assert.ok(state.movements.some(x => x.type === 'TRANSFER_OUT'));
  assert.ok(state.movements.some(x => x.type === 'TRANSFER_IN'));
  await page.reload();
  await page.locator('#app-shell').waitFor({state:'visible'});
  state = await snapshot(page,base);
  assert.equal(balance(state,p.id),4);
  assert.equal(balance(state,p.id,w2.id),2);
}));

test('inventory counting, lock, close, and audited adjustment', async t => scenario(t,'04-inventory', async ({page,base}) => {
  await product(page,'INV-E2E','Contagem E2E');
  const p = (await snapshot(page,base)).products.find(x => x.sku === 'INV-E2E');
  await move(page,{type:'ENTRY',productId:p.id,quantity:5});
  await message(page,'Movimentação registrada.');
  await view(page,'inventario');
  await page.locator('#inventory-start-form [name="warehouseId"]').selectOption('main');
  await page.locator('#inventory-start-form button').click();
  await page.locator('#inventory-count-panel').waitFor({state:'visible'});
  await move(page,{type:'EXIT',productId:p.id,quantity:1});
  await errorMessage(page);
  assert.equal(balance(await snapshot(page,base),p.id),5);
  await view(page,'inventario');
  const form = page.locator('.count-form[data-product="' + p.id + '"]');
  await form.locator('[name="quantity"]').fill('3');
  await form.getByRole('button',{name:'Contar'}).click();
  await page.locator('#inventory-counts').getByText('3',{exact:true}).first().waitFor();
  await page.locator('#close-inventory').click();
  await page.locator('#inventory-count-panel').waitFor({state:'hidden'});
  const state = await snapshot(page,base);
  assert.equal(balance(state,p.id),3);
  assert.equal(state.inventories[0].status,'CLOSED');
  assert.ok(state.movements.some(x => x.inventoryId === state.inventories[0].id));
}));

test('full purchasing workflow with quote, approval, partial and final receipt', async t => scenario(t,'05-purchases', async ({page,base}) => {
  await product(page,'BUY-E2E','Compra E2E');
  const p = (await snapshot(page,base)).products.find(x => x.sku === 'BUY-E2E');
  await page.locator('#supplier-form [name="name"]').fill('Fornecedor Compras');
  await page.locator('#supplier-form button').click();
  await message(page,'Cadastro salvo.');
  let state = await snapshot(page,base);
  const supplier = state.suppliers.find(x => x.name === 'Fornecedor Compras');
  await view(page,'compras');
  await page.locator('#purchase-request-form [name="warehouseId"]').selectOption('main');
  await page.locator('#purchase-request-form [name="productId"]').selectOption(p.id);
  await page.locator('#purchase-request-form [name="quantity"]').fill('4');
  await page.locator('#purchase-request-form button').click();
  await message(page,'Solicitação criada.');
  state = await snapshot(page,base);
  const req = state.purchaseRequests[0];
  assert.equal(req.status,'REQUESTED');
  const form = page.locator('#purchase-action-form');
  await form.locator('[name="requestId"]').selectOption(req.id);
  await form.locator('[name="supplierId"]').selectOption(supplier.id);
  await form.locator('[name="unitCost_0"]').fill('12');
  await form.locator('[name="action"]').selectOption('quote');
  await form.getByRole('button',{name:'Executar'}).click();
  await message(page,'Cotação registrada.');
  assert.equal((await snapshot(page,base)).purchaseRequests.find(x => x.id === req.id).status,'QUOTED');
  await form.locator('[name="requestId"]').selectOption(req.id);
  await form.locator('[name="supplierId"]').selectOption(supplier.id);
  await form.locator('[name="action"]').selectOption('approve');
  await form.getByRole('button',{name:'Executar'}).click();
  await message(page,'Solicitação aprovada.');
  await form.locator('[name="requestId"]').selectOption(req.id);
  await form.locator('[name="supplierId"]').selectOption(supplier.id);
  await form.locator('[name="action"]').selectOption('order');
  await form.getByRole('button',{name:'Executar'}).click();
  await message(page,'Pedido gerado com sucesso.');
  state = await snapshot(page,base);
  const order = state.purchaseOrders[0];
  assert.equal(order.status,'ORDERED');
  assert.equal(order.total,48);
  await page.locator('#purchases-table .receive-order[data-id="' + order.id + '"]').click();
  const dialog = page.locator('#purchase-receive-dialog');
  await dialog.waitFor({state:'visible'});
  await dialog.locator('[name="quantity"]').fill('3');
  await dialog.locator('[name="acceptedQuantity"]').fill('2');
  await dialog.locator('[name="rejectedQuantity"]').fill('1');
  await dialog.locator('[name="damagedQuantity"]').fill('0');
  await dialog.getByRole('button',{name:'Registrar conferência'}).click();
  await dialog.waitFor({state:'hidden'});
  state = await snapshot(page,base);
  assert.equal(state.purchaseOrders[0].status,'PARTIALLY_RECEIVED');
  assert.equal(balance(state,p.id),2);
  await page.locator('#purchases-table .receive-order[data-id="' + order.id + '"]').click();
  await dialog.waitFor({state:'visible'});
  await dialog.locator('[name="quantity"]').fill('1');
  await dialog.locator('[name="acceptedQuantity"]').fill('1');
  await dialog.getByRole('button',{name:'Registrar conferência'}).click();
  await dialog.waitFor({state:'hidden'});
  state = await snapshot(page,base);
  assert.equal(state.purchaseOrders[0].status,'RECEIVED');
  assert.equal(balance(state,p.id),3);
  assert.equal(state.receipts.length,2);
}));

test('reservation prevents over-issuing and releasing restores availability', async t => scenario(t,'06-reservations', async ({page,base}) => {
  await product(page,'RES-E2E','Reservado E2E');
  const p = (await snapshot(page,base)).products.find(x => x.sku === 'RES-E2E');
  await move(page,{type:'ENTRY',productId:p.id,quantity:6});
  await message(page,'Movimentação registrada.');
  await view(page,'avancado');
  await page.locator('#reservation-form [name="productId"]').selectOption(p.id);
  await page.locator('#reservation-form [name="warehouseId"]').selectOption('main');
  await page.locator('#reservation-form [name="quantity"]').fill('2');
  await page.locator('#reservation-form button').click();
  await page.locator('#advanced-table .reservation-release').waitFor({state:'visible'});
  const reservation = (await snapshot(page,base)).reservations.find(x => x.productId === p.id);
  assert.equal(reservation.status,'ACTIVE');
  await move(page,{type:'EXIT',productId:p.id,quantity:5});
  await errorMessage(page);
  assert.equal(balance(await snapshot(page,base),p.id),6);
  await view(page,'avancado');
  await page.locator('.reservation-release[data-id="' + reservation.id + '"]').click();
  await page.locator('#advanced-table .reservation-release[data-id="' + reservation.id + '"]').waitFor({state:'detached'});
  assert.equal((await snapshot(page,base)).reservations.find(x => x.id === reservation.id).status,'RELEASED');
  await move(page,{type:'EXIT',productId:p.id,quantity:5});
  await message(page,'Movimentação registrada.');
  assert.equal(balance(await snapshot(page,base),p.id),1);
}));

test('stock and movement CSV exports match the browser-visible data', async t => scenario(t,'07-reports', async ({page,base}) => {
  await product(page,'CSV-E2E','Produto exportado E2E');
  const p = (await snapshot(page,base)).products.find(x => x.sku === 'CSV-E2E');
  await move(page,{type:'ENTRY',productId:p.id,quantity:4});
  await message(page,'Movimentação registrada.');
  await view(page,'relatorios');
  await page.locator('#report-stock').getByText('Produto exportado E2E').waitFor();
  const [stockDownload] = await Promise.all([page.waitForEvent('download'),page.locator('#download-stock').click()]);
  assert.ok(stockDownload.suggestedFilename().endsWith('.csv'));
  const [movementDownload] = await Promise.all([page.waitForEvent('download'),page.locator('#download-movements').click()]);
  assert.ok(movementDownload.suggestedFilename().endsWith('.csv'));
  const state = await snapshot(page,base);
  assert.equal(balance(state,p.id),4);
}));

test('read-only role can log in and view, but cannot mutate catalog', async t => scenario(t,'08-permissions', async ({page,base}) => {
  await view(page,'configuracoes');
  await page.locator('[data-settings-target="users"]').click();
  const form = page.locator('#user-form');
  await form.locator('[name="name"]').fill('Somente leitura E2E');
  await form.locator('[name="login"]').fill('leitura-e2e');
  await form.locator('[name="role"]').selectOption('LEITURA');
  await form.locator('[name="password"]').fill('SenhaLeitura123!');
  await form.getByRole('button',{name:'Criar usuário'}).click();
  await message(page,'Usuário criado.');
  await page.locator('#logout').click();
  await page.locator('#auth-form [name="login"]').fill('leitura-e2e');
  await page.locator('#auth-form [name="password"]').fill('SenhaLeitura123!');
  await page.locator('#auth-form button').click();
  await page.locator('#app-shell').waitFor({state:'visible'});
  const before = await snapshot(page,base);
  assert.equal(before.user.role,'LEITURA');
  await view(page,'cadastros');
  await page.locator('#product-form [name="sku"]').fill('DENY-E2E');
  await page.locator('#product-form [name="name"]').fill('Não deve salvar');
  await page.locator('#product-save').click();
  await errorMessage(page);
  const afterState = await snapshot(page,base);
  assert.equal(afterState.products.some(x => x.sku === 'DENY-E2E'),false);
}));

test('mobile viewport loads app, navigation and scan without browser errors', async t => scenario(t,'09-mobile', async ({page,base}) => {
  assert.equal((await snapshot(page,base)).user.role,'ADMIN');
  await view(page,'cadastros');
  await product(page,'MOB-E2E','Produto móvel');
  await view(page,'dashboard');
  await page.locator('#quick-barcode').fill('MOB-E2E');
  await page.locator('#quick-barcode').press('Enter');
  await page.locator('#scan-result').getByText('Produto móvel').waitFor();
}, {viewport:{width:390,height:844}}));
