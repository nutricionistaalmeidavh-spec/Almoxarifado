import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('P1 API extension exposes commercial routes',async()=>{const js=await read('src/platform/p1-api-extensions.mjs');for(const route of['/api/assets','/api/supply/product-suppliers','/api/supply/unit-conversions','/api/quality/holds','/api/replenishment/advanced','/api/alerts'])assert.match(js,new RegExp(route.replaceAll('/','\\/')));});

test('P1 PWA exposes assets supply quality replenishment alerts and asset documents',async()=>{const js=await read('apps/web/p1.js');for(const token of['P1 Comercial','Patrimônio','Foto / documento do patrimônio','Fornecedores do produto','Unidades / embalagens','Qualidade / quarentena','Reposição avançada','Central de alertas','/api/documents'])assert.match(js,new RegExp(token.replaceAll('/','\\/')));const ui=await read('apps/web/ui-v2.js');assert.match(ui,/import\('\/p1\.js'\)/);const sw=await read('apps/web/sw.js');assert.match(sw,/p1\.js/);assert.match(sw,/p1\.css/);});
