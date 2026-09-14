import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('P2 API extension exposes all commercial routes',async()=>{const js=await read('src/platform/p2-api-extensions.mjs');for(const route of['/api/p2/bootstrap','/api/custom-fields/definitions','/api/approvals/rules','/api/approvals/request','/api/suppliers/kpi','/api/maintenance/plans','/api/kits','/api/nfe/preview','/api/nfe/apply'])assert.match(js,new RegExp(route.replaceAll('/','\\/')));});

test('P2 PWA exposes six commercial panels and is cached locally',async()=>{const js=await read('apps/web/p2.js');for(const token of['P2 Gestão','Campos personalizados','Matriz de aprovação','KPI de fornecedores','Manutenção / calibração','Kits / BOM','Importar XML NF-e'])assert.match(js,new RegExp(token));const ui=await read('apps/web/ui-v2.js');assert.match(ui,/p2\.js/);const sw=await read('apps/web/sw.js');assert.match(sw,/p2\.js/);assert.match(sw,/p2\.css/);});
