import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('PWA composes the mobile WMS module and surface',async()=>{
  const ui=await read('apps/web/ui-v2.js');
  const js=await read('apps/web/wms.js');
  assert.match(ui,/import ['"]\.\/wms\.js['"]/);
  for(const id of['view-wms','wms-location-form','wms-scan-form','wms-mobile-form','wms-cycle-form','wms-receive-form','wms-locations','wms-pick-plan','wms-cycle-lines'])assert.match(js,new RegExp(id));
});

test('WMS client calls local addressing receiving scan mobile and cycle endpoints',async()=>{
  const js=await read('apps/web/wms.js');
  for(const route of['/api/wms/locations','/api/wms/scan','/api/wms/pick','/api/wms/mobile','/api/wms/cycle-counts','/api/purchases/orders/'])assert.match(js,new RegExp(route.replaceAll('/','\\/')));
});

test('service worker caches WMS module and styles for local PWA use',async()=>{
  const sw=await read('apps/web/sw.js');
  assert.match(sw,/wms\.js/);
  assert.match(sw,/wms\.css/);
});
