import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('release browser smoke covers installed usability path',async()=>{
  const source=await read('scripts/release-smoke.mjs');
  for(const token of ["from 'playwright'","/api/health","/api/auth/status","#auth-form","#app-shell","#product-form","#movement-form","#metric-products","#metric-units","/api/bootstrap","ALMOX_QA_SKU","verify-only"]) assert.match(source,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('release smoke captures real UI v2 screenshots from installed app',async()=>{
  const source=await read('scripts/release-smoke.mjs');
  for(const token of ['ALMOX_SCREENSHOT_DIR','page.screenshot','dashboard','cadastros','movimentacoes','inventario','compras','documentos','relatorios','configuracoes','.view:visible']) assert.ok(source.includes(token),`release smoke missing visual QA token ${token}`);
});

test('windows smoke silently installs, runs smoke, reinstalls and verifies persisted data',async()=>{
  const source=await read('scripts/windows-installed-smoke.ps1');
  assert.match(source,/\/S/);
  assert.match(source,/ArtiSys Almoxarifado\.exe/);
  assert.match(source,/api\/health/);
  assert.match(source,/smoke:release/);
  assert.match(source,/ALMOX_SMOKE_MODE/);
  assert.match(source,/verify-only/);
});

test('ArtiSys QA smoke flow is non-empty and valid-shaped',async()=>{
  const flow=JSON.parse(await read('qa/flows/smoke.json'));
  assert.equal(flow.name,'smoke');
  assert.ok(Array.isArray(flow.steps));
  assert.ok(flow.steps.length>=2);
  assert.equal(flow.steps[0].action,'expectVisible');
});
