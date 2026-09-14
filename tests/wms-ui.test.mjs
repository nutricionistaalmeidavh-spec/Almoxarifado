import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('PWA exposes mobile WMS addressing and cycle-count surface',async()=>{
  const html=await read('apps/web/index.html');
  for(const id of['view-wms','wms-location-form','wms-scan-form','wms-mobile-form','wms-cycle-form','wms-locations','wms-pick-plan','wms-cycle-lines'])assert.match(html,new RegExp(id));
  assert.match(html,/\/wms\.js/);
});

test('WMS client calls local addressing scan mobile and cycle endpoints',async()=>{
  const js=await read('apps/web/wms.js');
  for(const route of['/api/wms/locations','/api/wms/scan','/api/wms/pick','/api/wms/mobile','/api/wms/cycle-counts'])assert.match(js,new RegExp(route.replaceAll('/','\\/')));
});
