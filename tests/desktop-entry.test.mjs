import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('desktop entry uses Electron with hardened web preferences', async () => {
  const source=await read('apps/desktop/src/electron-main.mjs');
  assert.match(source,/BrowserWindow/);
  assert.match(source,/contextIsolation:\s*true/);
  assert.match(source,/nodeIntegration:\s*false/);
  assert.match(source,/sandbox:\s*true/);
  assert.match(source,/createAlmoxarifadoDesktopRuntime/);
});

test('package exposes desktop runtime command with pinned Electron', async () => {
  const pkg=JSON.parse(await read('package.json'));
  assert.match(pkg.scripts.desktop,/electron-main\.mjs/);
  assert.equal(pkg.devDependencies.electron,'43.4.1');
});

test('installed Windows desktop checks updates only after the window is ready',async()=>{
  const source=await read('apps/desktop/src/electron-main.mjs');
  assert.match(source,/app\.isPackaged/);
  const subscribe = source.indexOf("mainWindow.once('ready-to-show'");
  const navigate = source.indexOf('mainWindow.loadURL(');
  assert.ok(subscribe >= 0 && subscribe < navigate, 'Register window visibility before navigation starts');
  assert.match(source,/promptForDesktopUpdate/);
  assert.match(source,/readUpdateFeedUrl/);
  assert.match(source,/app\.getVersion\(\)/);
});
