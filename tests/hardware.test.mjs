import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStockRepository } from '../src/domain/stock/repository.mjs';
import { createHardwareAdapter } from '../src/platform/hardware-adapter.mjs';
import { createHardwareSettingsService } from '../src/domain/hardware/hardware-settings-service.mjs';

test('hardware adapter degrades cleanly when no driver is installed', async () => {
  const adapter=createHardwareAdapter({serialApi:null,printingApi:null});
  assert.deepEqual(adapter.status(),{serial:'unavailable',printing:'unavailable'});
  await assert.rejects(adapter.listPorts(),(error)=>error.code==='HARDWARE_UNAVAILABLE');
  await assert.rejects(adapter.readScale({portPath:'COM3'}),(error)=>error.code==='HARDWARE_UNAVAILABLE');
});

test('serial adapter lists ports and reads injected scale', async () => {
  const serialApi={createSerialPortManager:()=>({list:async()=>[{path:'COM3'}]}),readScale:async()=>({weight:12.5,unit:'kg',raw:'12.500'})};
  const adapter=createHardwareAdapter({serialApi});
  assert.deepEqual(await adapter.listPorts(),[{path:'COM3'}]);
  assert.deepEqual(await adapter.readScale({portPath:'COM3',baudRate:9600}),{value:12.5,unit:'kg',raw:'12.500'});
});

test('hardware settings are persisted with audit metadata', () => {
  const repository=createMemoryStockRepository({users:[{id:'admin',active:true}]});
  const service=createHardwareSettingsService({repository,idFactory:()=> 'hw-1',now:()=> '2026-09-12T17:00:00.000Z'});
  const saved=service.save({kind:'scale',name:'Balança balcão',enabled:true,config:{portPath:'COM3',baudRate:9600}},'admin');
  assert.equal(saved.updatedBy,'admin');
  assert.equal(service.list()[0].config.portPath,'COM3');
});
