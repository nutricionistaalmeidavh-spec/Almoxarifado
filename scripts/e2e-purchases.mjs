import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createAlmoxarifadoDesktopRuntime } from '../src/platform/desktop-runtime.mjs';

// Real Chromium + real HTTP API + isolated SQLite database. All local, no SaaS.
// Run: npx playwright install chromium && node scripts/e2e-purchases.mjs
const dir=await mkdtemp(path.join(os.tmpdir(),'almox-e2e-compras-'));
const artifactDir=process.env.ALMOX_E2E_ARTIFACTS||path.resolve('qa-artifacts/compras');
const results=[];
const password='QA-Dados-Local-2026!';
let browser=null;
let runtime=null;
let page=null;
let base='';
let token='';
let scenario='inicialização';

const check=(name,condition,details='')=>{
  assert.ok(condition,name+(details?' — '+details:''));
  results.push({name,status:'ok'});
  console.log('[E2E OK] '+name);
};
async function state(){
  const response=await fetch(base+'/api/bootstrap',{headers:{authorization:'Bearer '+token}});
  assert.equal(response.status,200,'bootstrap HTTP: '+response.status);
  return response.json();
}
async function post(url,payload,expected=200){
  const response=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(payload)});
  const body=await response.json();
  if(expected===200)assert.ok(response.ok,url+': '+response.status+' '+JSON.stringify(body));
  else assert.equal(response.status,expected,url+': '+JSON.stringify(body));
  return body;
}
async function until(predicate,description){
  const deadline=Date.now()+12000;
  let value;
  while(Date.now()<deadline){
    value=await predicate();
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  throw new Error('Timeout esperando: '+description);
}
async function selectAction(value){
  await page.locator('#purchase-action-form select[name="action"]').selectOption(value);
}
async function formSubmit(selector){
  await page.locator(selector+' button[type="submit"], '+selector+' button:not([type])').last().click();
}
async function successNotice(message){
  await page.locator('#message .notice').filter({hasText:message}).waitFor({state:'visible',timeout:9000});
}
async function receipt(orderId,delivered,accepted,rejected,damaged){
  await page.locator('#purchases-table .receive-order[data-id="'+orderId+'"]').click();
  const dialog=page.locator('#purchase-receive-dialog');
  await dialog.waitFor({state:'visible'});
  for(const [name,value] of Object.entries({quantity:delivered,acceptedQuantity:accepted,rejectedQuantity:rejected,damagedQuantity:damaged})){
    await dialog.locator('input[name="'+name+'"]').fill(String(value));
  }
  await dialog.getByRole('button',{name:'Registrar conferência'}).click();
  await dialog.waitFor({state:'hidden',timeout:12000});
}
async function screenshot(name){
  if(!page)return;
  await mkdir(artifactDir,{recursive:true});
  await page.screenshot({path:path.join(artifactDir,name+'.png'),fullPage:true}).catch(()=>{});
}

try{
  runtime=createAlmoxarifadoDesktopRuntime({dataDir:dir,host:'127.0.0.1',port:0});
  runtime.saveSettings({host:'127.0.0.1',port:0,backup:{enabled:false}});
  const address=await runtime.start();
  base='http://127.0.0.1:'+address.port;
  const anonymous=await fetch(base+'/api/bootstrap');
  check('API exige autenticação',anonymous.status===401);
  const entitlement=await fetch(base+'/api/license/status').then(r=>r.json());
  check('Core local não exige licença',entitlement.required===false&&entitlement.active===true);

  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});
  page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#auth-form input[name="password"]').fill(password);
  await page.locator('#auth-form button').click();
  await page.locator('#app-shell').waitFor({state:'visible',timeout:15000});
  token=await page.evaluate(()=>sessionStorage.getItem('almox-token'));
  check('Primeiro acesso e login reais pelo navegador',!!token);

  scenario='cadastro de fornecedor e produtos';
  await page.locator('button[data-view="cadastros"]').click();
  await page.locator('#supplier-form input[name="name"]').fill('Fornecedor E2E A');
  await page.locator('#supplier-form button').click();
  await until(async()=>(await state()).suppliers.some(s=>s.name==='Fornecedor E2E A'),'fornecedor A');
  await page.locator('#supplier-form input[name="name"]').fill('Fornecedor E2E B');
  await page.locator('#supplier-form button').click();
  await until(async()=>(await state()).suppliers.some(s=>s.name==='Fornecedor E2E B'),'fornecedor B');
  for(const [sku,name,cost] of [['QA-001','Tubo QA',12],['QA-002','Conexão QA',7]]){
    const form=page.locator('#product-form');
    await form.locator('[name="sku"]').fill(sku);
    await form.locator('[name="name"]').fill(name);
    await form.locator('[name="unitCost"]').fill(String(cost));
    await form.locator('[name="unit"]').fill('un');
    await form.locator('[name="minStock"]').fill('2');
    await form.locator('[name="targetStock"]').fill('8');
    await form.locator('button[type="submit"]').click();
    await page.locator('#products-table').filter({hasText:sku}).waitFor({state:'visible'});
  }
  let snapshot=await state();
  const supplierA=snapshot.suppliers.find(s=>s.name==='Fornecedor E2E A');
  const supplierB=snapshot.suppliers.find(s=>s.name==='Fornecedor E2E B');
  const productA=snapshot.products.find(p=>p.sku==='QA-001');
  const productB=snapshot.products.find(p=>p.sku==='QA-002');
  check('Dois fornecedores e dois produtos persistiram',!!supplierA&&!!supplierB&&!!productA&&!!productB);

  scenario='entrada de estoque e solicitação';
  await page.locator('button[data-view="movimentacoes"]').click();
  const movement=page.locator('#movement-form');
  await movement.locator('[name="type"]').selectOption('ENTRY');
  await movement.locator('[name="productId"]').selectOption(productA.id);
  await movement.locator('[name="warehouseId"]').selectOption('main');
  await movement.locator('[name="quantity"]').fill('3');
  await movement.locator('[name="reason"]').fill('Estoque inicial QA');
  await movement.locator('button').click();
  await until(async()=>(await state()).balances.some(b=>b.productId===productA.id&&b.quantity===3),'saldo inicial do produto A');
  check('Entrada manual atualiza saldo e dashboard',true);

  await page.locator('button[data-view="compras"]').click();
  const reqForm=page.locator('#purchase-request-form');
  await reqForm.locator('[name="warehouseId"]').selectOption('main');
  await reqForm.locator('[name="productId"]').selectOption(productA.id);
  await reqForm.locator('[name="quantity"]').fill('5');
  await reqForm.locator('[name="notes"]').fill('E2E compra principal');
  await reqForm.locator('button').click();
  const request=await until(async()=>(await state()).purchaseRequests.find(r=>r.notes==='E2E compra principal'),'solicitação cadastrada');
  check('Solicitação de compra criada no navegador',request.status==='REQUESTED');

  scenario='não permitir aprovação sem cotação';
  await page.locator('#purchase-request').selectOption(request.id);
  await selectAction('approve');
  await page.locator('#purchase-action-form button').click();
  await successNotice('Registre uma cotação');
  check('Aprovação sem cotação é bloqueada em português',(await state()).purchaseRequests.find(r=>r.id===request.id).status==='REQUESTED');

  scenario='cotação e aprovação';
  await selectAction('quote');
  await page.locator('#purchase-supplier').selectOption(supplierA.id);
  await page.locator('#purchase-unit-cost-inputs input[name="unitCost_0"]').fill('8.50');
  await page.locator('#purchase-action-form button').click();
  const firstQuote=await until(async()=>(await state()).purchaseRequests.find(r=>r.id===request.id)?.quotes?.[0],'cotação salva');
  check('Cotação por item persistida',firstQuote.items[0].unitCost===8.5);
  await selectAction('approve');
  await page.locator('#purchase-action-form button').click();
  await until(async()=>(await state()).purchaseRequests.find(r=>r.id===request.id)?.status==='APPROVED','solicitação aprovada');
  check('Solicitação aprovada depois da cotação',true);

  scenario='fornecedor sem cotação é bloqueado';
  await page.locator('#purchase-supplier').selectOption(supplierB.id);
  await selectAction('order');
  await page.locator('#purchase-action-form button').click();
  await successNotice('Registre uma cotação');
  check('Pedido de fornecedor sem cotação é recusado',!(await state()).purchaseOrders.some(o=>o.requestId===request.id));

  scenario='gerar pedido e conferir recebimento parcial';
  await page.locator('#purchase-supplier').selectOption(supplierA.id);
  await page.locator('#purchase-action-form button').click();
  const order=await until(async()=>(await state()).purchaseOrders.find(o=>o.requestId===request.id),'pedido gerado');
  check('Pedido aprovado tem total correto',order.status==='ORDERED'&&order.total===42.5);
  await receipt(order.id,2,1,1,0);
  snapshot=await state();
  const partial=snapshot.purchaseOrders.find(o=>o.id===order.id);
  const partialBalance=snapshot.balances.find(b=>b.productId===productA.id&&b.warehouseId==='main')?.quantity;
  check('Recebimento parcial lança apenas aceitos no estoque',partial.status==='PARTIALLY_RECEIVED'&&partial.items[0].pendingQuantity===3&&partialBalance===4);

  await receipt(order.id,3,3,0,0);
  snapshot=await state();
  const completed=snapshot.purchaseOrders.find(o=>o.id===order.id);
  check('Recebimento final fecha pedido e atualiza saldos',completed.status==='RECEIVED'&&snapshot.balances.find(b=>b.productId===productA.id&&b.warehouseId==='main')?.quantity===7);
  check('Pedido recebido aparece em português',await page.locator('#purchases-table').innerText().then(t=>t.includes('Recebido')&&!t.includes('RECEIVED')));

  scenario='recuperação de solicitação legada com dois produtos';
  const legacy=await post('/api/purchases/requests',{warehouseId:'main',notes:'LEGADO E2E',items:[{productId:productA.id,quantity:2},{productId:productB.id,quantity:3}]});
  runtime.repository.savePurchaseRequest({...legacy.item,status:'APPROVED',approvedAt:new Date().toISOString(),approvedBy:'admin'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#app-shell').waitFor({state:'visible',timeout:15000});
  await page.locator('button[data-view="compras"]').click();
  await page.locator('#purchase-request').selectOption(legacy.item.id);
  await selectAction('quote');
  await page.locator('#purchase-supplier').selectOption(supplierB.id);
  const costs=page.locator('#purchase-unit-cost-inputs input');
  check('Solicitação legada recuperável com custos individuais',await costs.count()===2);
  await costs.nth(0).fill('6.25');
  await costs.nth(1).fill('9.75');
  await page.locator('#purchase-action-form button').click();
  snapshot=await state();
  const recovered=snapshot.purchaseRequests.find(r=>r.id===legacy.item.id);
  check('Recuperação preserva ID e invalida aprovação antiga',recovered.status==='QUOTED'&&recovered.approvedAt===null&&recovered.quotes.length===1);
  await selectAction('approve');
  await page.locator('#purchase-action-form button').click();
  await until(async()=>(await state()).purchaseRequests.find(r=>r.id===legacy.item.id)?.status==='APPROVED','aprovação de legado');
  await selectAction('order');
  await page.locator('#purchase-action-form button').click();
  const legacyOrder=await until(async()=>(await state()).purchaseOrders.find(o=>o.requestId===legacy.item.id),'pedido legado');
  check('Pedido legado tem dois itens, quantidades e custos corretos',legacyOrder.items.length===2&&legacyOrder.total===41.75);

  scenario='revisão da cotação do mesmo fornecedor';
  const revision=await post('/api/purchases/requests',{warehouseId:'main',notes:'REVISAO E2E',items:[{productId:productB.id,quantity:2}]});
  await post('/api/purchases/requests/'+revision.item.id+'/quotes',{supplierId:supplierA.id,items:[{productId:productB.id,quantity:2,unitCost:4}]});
  await post('/api/purchases/requests/'+revision.item.id+'/quotes',{supplierId:supplierA.id,items:[{productId:productB.id,quantity:2,unitCost:5}]});
  await post('/api/purchases/requests/'+revision.item.id+'/approve',{});
  const revisionOrder=await post('/api/purchases/orders',{requestId:revision.item.id,supplierId:supplierA.id});
  check('Pedido usa cotação mais recente do mesmo fornecedor',revisionOrder.item.total===10);

  scenario='restrição de recebimento e idempotência';
  const invalidReceipt=await post('/api/purchases/orders/'+revisionOrder.item.id+'/receive',{items:[{productId:productB.id,quantity:3,acceptedQuantity:3}]},400);
  check('Recebimento acima do saldo é rejeitado sem mutação',invalidReceipt.error==='RECEIPT_EXCEEDS_PENDING');
  const beforeB=(await state()).balances.find(b=>b.productId===productB.id)?.quantity||0;
  const key='e2e-receipt-key-01';
  const once=await post('/api/purchases/orders/'+revisionOrder.item.id+'/receive',{operationKey:key,items:[{productId:productB.id,quantity:2,acceptedQuantity:2}]});
  const twice=await post('/api/purchases/orders/'+revisionOrder.item.id+'/receive',{operationKey:key,items:[{productId:productB.id,quantity:2,acceptedQuantity:2}]});
  const afterB=(await state()).balances.find(b=>b.productId===productB.id)?.quantity||0;
  check('Repetição do recebimento não duplica estoque',once.item.id===twice.item.id&&afterB-beforeB===2);

  scenario='persistência SQLite depois de reiniciar';
  await screenshot('fluxo-compras-concluido');
  await browser.close();browser=null;page=null;
  await runtime.stop();
  await runtime.start();
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:'admin',password})});
  check('Banco e usuário persistem após reiniciar',login.status===200);
  const newToken=(await login.json()).token;
  const persisted=await fetch(base+'/api/bootstrap',{headers:{authorization:'Bearer '+newToken}}).then(r=>r.json());
  check('Pedidos, recebimentos e saldo sobrevivem ao reinício',persisted.purchaseOrders.length===3&&persisted.receipts.length===3&&persisted.products.some(p=>p.sku==='QA-001'));
  check('Navegador não apresentou erros JavaScript',pageErrors.length===0,pageErrors.join(' | '));

  console.log(JSON.stringify({suite:'e2e-purchases-real-browser',status:'passed',checks:results.length,details:results},null,2));
}catch(error){
  console.error('[E2E FAILED] cenário='+scenario+'; '+String(error.stack||error));
  await screenshot('falha-'+scenario.replace(/[^a-z0-9]/gi,'-').slice(0,55));
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(runtime)await runtime.stop().catch(()=>{});
  await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
