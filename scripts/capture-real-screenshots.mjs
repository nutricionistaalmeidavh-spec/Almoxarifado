import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd();
const dataDir=path.join(root,'.qa-real-screenshots-data');
const outDir=path.join(root,'artifacts','real-screenshots');
const baseUrl='http://127.0.0.1:4173';
const password='QARealScreenshots1!';

await rm(dataDir,{recursive:true,force:true});
await rm(outDir,{recursive:true,force:true});
await mkdir(outDir,{recursive:true});

const server=spawn(process.execPath,['scripts/serve-web.mjs'],{
  cwd:root,
  env:{...process.env,ALMOX_DATA_DIR:dataDir,ALMOX_WEB_HOST:'127.0.0.1',ALMOX_WEB_PORT:'4173',ALMOX_BACKUP_INTERVAL_MS:'86400000'},
  stdio:['ignore','pipe','pipe']
});
server.stdout.on('data',(chunk)=>process.stdout.write(chunk));
server.stderr.on('data',(chunk)=>process.stderr.write(chunk));

async function waitForHealth(timeoutMs=60_000){
  const deadline=Date.now()+timeoutMs;
  let last;
  while(Date.now()<deadline){
    try{
      const response=await fetch(`${baseUrl}/api/health`);
      if(response.ok){const body=await response.json();if(body.status==='ok')return;}
    }catch(error){last=error;}
    await new Promise((resolve)=>setTimeout(resolve,500));
  }
  throw new Error(`Servidor local não iniciou: ${last?.message||'timeout'}`);
}

async function shot(page,name){
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(outDir,`${name}.png`),fullPage:true});
  console.log(`capturado ${name}.png`);
}

let browser;
try{
  await waitForHealth();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
  await page.locator('#auth-form').waitFor({state:'visible'});
  await page.locator('#auth-form input[name="password"]').fill(password);
  await page.locator('#auth-form button[type="submit"]').click();
  await page.locator('#app-shell').waitFor({state:'visible',timeout:20_000});
  await page.locator('#connection-status').filter({hasText:'Servidor local conectado'}).waitFor({state:'visible',timeout:20_000});

  await page.locator('button[data-view="cadastros"]').click();
  await page.locator('#category-form input[name="name"]').fill('Hidráulica');
  await page.locator('#category-form button').click();
  await page.locator('#supplier-form input[name="name"]').fill('Fornecedor Central');
  await page.locator('#supplier-form button').click();
  await page.locator('#product-form input[name="sku"]').fill('MAT-001');
  await page.locator('#product-form input[name="barcode"]').fill('789000000001');
  await page.locator('#product-form input[name="name"]').fill('Tubo PVC 25 mm');
  await page.locator('#product-form input[name="unit"]').fill('un');
  await page.locator('#product-form input[name="minStock"]').fill('5');
  await page.locator('#product-form input[name="targetStock"]').fill('20');
  await page.locator('#product-form input[name="unitCost"]').fill('18.90');
  await page.locator('#product-form button').click();
  await page.locator('#products-table').filter({hasText:'MAT-001'}).waitFor({state:'visible',timeout:20_000});
  await shot(page,'02-cadastros');

  await page.locator('button[data-view="movimentacoes"]').click();
  const productOption=page.locator('#movement-product option').filter({hasText:'MAT-001'}).first();
  await productOption.waitFor({state:'attached'});
  const productId=await productOption.getAttribute('value');
  await page.locator('#movement-form select[name="type"]').selectOption('ENTRY');
  await page.locator('#movement-product').selectOption(productId);
  await page.locator('#movement-warehouse').selectOption('main');
  await page.locator('#movement-form input[name="quantity"]').fill('25');
  await page.locator('#movement-form input[name="reason"]').fill('Estoque inicial');
  await page.locator('#movement-form button').click();
  await page.locator('#movements-table').filter({hasText:'Tubo PVC 25 mm'}).waitFor({state:'visible',timeout:20_000});
  await page.locator('#movement-form select[name="type"]').selectOption('EXIT');
  await page.locator('#movement-product').selectOption(productId);
  await page.locator('#movement-warehouse').selectOption('main');
  await page.locator('#movement-form input[name="quantity"]').fill('4');
  await page.locator('#movement-form input[name="reason"]').fill('Retirada para obra');
  await page.locator('#movement-form button').click();
  await page.locator('#movements-table').filter({hasText:'Retirada para obra'}).waitFor({state:'visible',timeout:20_000}).catch(()=>{});
  await shot(page,'03-movimentacoes');

  await page.locator('button[data-view="dashboard"]').click();
  await page.locator('#metric-products').filter({hasText:'1'}).waitFor({state:'visible',timeout:20_000});
  await shot(page,'01-dashboard');

  await page.locator('button[data-view="inventario"]').click();
  await shot(page,'04-inventario');

  await page.locator('button[data-view="compras"]').click();
  await shot(page,'05-compras');

  await page.locator('button[data-view="documentos"]').click();
  await shot(page,'06-documentos');

  await page.locator('button[data-view="relatorios"]').click();
  await shot(page,'07-relatorios');

  await page.locator('button[data-view="configuracoes"]').click();
  await shot(page,'08-configuracoes');

  console.log(JSON.stringify({ok:true,sourceCommit:'7464416b510432c27ece04f142b6c4628f6c68c4',screenshots:8}));
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
