import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl=(process.env.ALMOX_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const password=process.env.ALMOX_QA_PASSWORD;
const sku=process.env.ALMOX_QA_SKU||'QA-RELEASE-100';
const mode=(process.env.ALMOX_SMOKE_MODE||'full').toLowerCase();
const verifyOnly=mode==='verify-only'||process.argv.includes('--verify-only');
const screenshotDir=process.env.ALMOX_SCREENSHOT_DIR?.trim()||'';

if(!password||password.length<10) throw new Error('ALMOX_QA_PASSWORD must contain at least 10 characters');

async function sleep(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
async function json(pathname,options={}){
  const response=await fetch(`${baseUrl}${pathname}`,options);
  const body=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(`${pathname} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
async function waitForHealth(timeoutMs=60_000){
  const deadline=Date.now()+timeoutMs;
  let lastError=null;
  while(Date.now()<deadline){
    try{const health=await json('/api/health');assert.equal(health.status,'ok');return health;}catch(error){lastError=error;await sleep(1000);}
  }
  throw new Error(`local API did not become healthy: ${lastError?.message||'timeout'}`);
}

async function captureRealUiScreenshots(page){
  if(!screenshotDir||verifyOnly)return [];
  await mkdir(screenshotDir,{recursive:true});
  const captures=[];
  const views=[
    ['dashboard','01-dashboard'],
    ['cadastros','02-cadastros'],
    ['movimentacoes','03-movimentacoes'],
    ['inventario','04-inventario'],
    ['compras','05-compras'],
    ['documentos','06-documentos'],
    ['relatorios','07-relatorios'],
    ['configuracoes','08-configuracoes']
  ];
  for(const [view,name] of views){
    await page.locator(`button[data-view="${view}"]`).click();
    await page.locator(`#view-${view}`).waitFor({state:'visible',timeout:10_000});
    await page.waitForTimeout(180);
    const file=path.resolve(screenshotDir,`${name}.png`);
    await page.screenshot({path:file,fullPage:true});
    captures.push(file);
  }
  return captures;
}

await waitForHealth();
const authStatus=await json('/api/auth/status');
if(verifyOnly&&authStatus.needsBootstrap) throw new Error('persisted administrator credentials were lost after reinstall');

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded'});
  await assert.doesNotReject(()=>page.waitForSelector('#auth-form',{state:'visible',timeout:15_000}));

  if(authStatus.needsBootstrap){
    await page.locator('#auth-form input[name="password"]').fill(password);
    await page.locator('#auth-form button[type="submit"]').click();
  }else{
    await page.locator('#auth-form input[name="login"]').fill('admin');
    await page.locator('#auth-form input[name="password"]').fill(password);
    await page.locator('#auth-form button[type="submit"]').click();
  }

  await page.locator('#app-shell').waitFor({state:'visible',timeout:20_000});
  await page.locator('#connection-status').filter({hasText:'Servidor local conectado'}).waitFor({state:'visible',timeout:20_000});
  assert.equal(await page.title(),'ArtiSys Almoxarifado');
  assert.ok(await page.locator('.nav-icon').count()>=10,'UI v2 sidebar icons were not rendered');
  assert.equal(await page.locator('.metric-card').count(),4,'UI v2 dashboard metric cards were not rendered');

  if(!verifyOnly){
    await page.locator('button[data-view="cadastros"]').click();
    await page.locator('#product-form input[name="sku"]').fill(sku);
    await page.locator('#product-form input[name="name"]').fill(`Produto ${sku}`);
    await page.locator('#product-form input[name="unit"]').fill('un');
    await page.locator('#product-form input[name="minStock"]').fill('1');
    await page.locator('#product-form input[name="targetStock"]').fill('5');
    await page.locator('#product-form input[name="unitCost"]').fill('10');
    await page.locator('#product-form button').click();
    await page.locator('#products-table').filter({hasText:sku}).waitFor({state:'visible',timeout:20_000});

    await page.locator('button[data-view="movimentacoes"]').click();
    await page.locator('[data-movement-type="EXIT"]').click();
    assert.equal(await page.locator('#movement-form select[name="type"]').inputValue(),'EXIT','UI v2 movement shortcut did not update the operation type');
    await page.locator('[data-movement-type="ENTRY"]').click();
    const productOption=page.locator('#movement-product option').filter({hasText:sku}).first();
    await productOption.waitFor({state:'attached',timeout:10_000});
    const productId=await productOption.getAttribute('value');
    assert.ok(productId,'created product option has no value');
    await page.locator('#movement-form select[name="type"]').selectOption('ENTRY');
    await page.locator('#movement-product').selectOption(productId);
    await page.locator('#movement-warehouse').selectOption('main');
    await page.locator('#movement-form input[name="quantity"]').fill('3');
    await page.locator('#movement-form input[name="reason"]').fill('QA release 1.0.0');
    await page.locator('#movement-form button').click();
    await page.locator('#movements-table').filter({hasText:`Produto ${sku}`}).waitFor({state:'visible',timeout:20_000});
  }

  await page.locator('button[data-view="dashboard"]').click();
  const productsText=await page.locator('#metric-products').textContent();
  const unitsText=await page.locator('#metric-units').textContent();
  const metricNumber=(value)=>Number(String(value??'').replace(/[^0-9,-]/g,'').replace(/\./g,'').replace(',','.'));
  assert.ok(metricNumber(productsText)>=1,'dashboard did not show products');
  assert.ok(metricNumber(unitsText)>=3,'dashboard did not show persisted stock units');

  const token=await page.evaluate(()=>sessionStorage.getItem('almox-token'));
  assert.ok(token,'authenticated UI did not persist a session token');
  const bootstrap=await json('/api/bootstrap',{headers:{Authorization:`Bearer ${token}`}});
  const product=bootstrap.products.find((item)=>item.sku===sku);
  assert.ok(product,`product ${sku} was not persisted`);
  const quantity=bootstrap.balances.filter((item)=>item.productId===product.id).reduce((sum,item)=>sum+Number(item.quantity||0),0);
  assert.ok(quantity>=3,`product ${sku} stock was not preserved; got ${quantity}`);

  const screenshots=await captureRealUiScreenshots(page);
  process.stdout.write(`${JSON.stringify({ok:true,mode:verifyOnly?'verify-only':'full',sku,products:bootstrap.dashboard.products,totalUnits:bootstrap.dashboard.totalUnits,screenshots:screenshots.length})}\n`);
}finally{
  await browser.close();
}
