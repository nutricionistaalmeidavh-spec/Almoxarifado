import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntimePlan } from '../src/platform/runtime-plan.mjs';

test('desktop runtime combines Desktop Shell and LAN-safe Local Backend contracts', () => {
  const desktopApi = {
    createDesktopShellManifest(value) { return { ...value, capabilities: ['settings'] }; }
  };
  const backendApi = {
    buildPocketBasePlan(value) { return { ...value, executable: 'pocketbase', args: ['serve'] }; }
  };
  const plan = buildRuntimePlan({
    dataDir: 'C:/Almoxarifado/data',
    desktopApi,
    backendApi
  });
  assert.equal(plan.desktop.appId, 'br.com.artisys.almoxarifado');
  assert.equal(plan.backend.host, '0.0.0.0');
  assert.equal(plan.backend.allowRemote, true);
  assert.equal(plan.backend.executable, 'pocketbase');
});
