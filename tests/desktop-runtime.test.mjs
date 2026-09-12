import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAlmoxarifadoDesktopRuntime } from '../src/platform/desktop-runtime.mjs';

test('desktop runtime composes repository, API and local web server lifecycle', async () => {
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-desktop-'));
  const runtime=createAlmoxarifadoDesktopRuntime({dataDir:dir,host:'127.0.0.1',port:0,dependencies:{desktopApi:{createDesktopShellManifest:(value)=>({...value,capabilities:['settings','logs']})}}});
  assert.equal(runtime.manifest.appId,'br.com.artisys.almoxarifado');
  await runtime.start();
  const address=runtime.address();
  assert.ok(address.port>0);
  const health=await fetch(`http://127.0.0.1:${address.port}/api/health`).then((r)=>r.json());
  assert.equal(health.status,'ok');
  assert.match(runtime.paths.database,/almoxarifado\.json$/);
  await runtime.stop();
  await runtime.stop();
});

test('desktop runtime start is idempotent and exposes settings path', async () => {
  const dir=mkdtempSync(path.join(os.tmpdir(),'almox-desktop-settings-'));
  const runtime=createAlmoxarifadoDesktopRuntime({dataDir:dir,host:'127.0.0.1',port:0,dependencies:{desktopApi:{createDesktopShellManifest:(value)=>value}}});
  const first=await runtime.start();
  const second=await runtime.start();
  assert.equal(first.port,second.port);
  assert.match(runtime.paths.settings,/settings\.json$/);
  await runtime.stop();
});
