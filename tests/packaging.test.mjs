import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('release 1.0.1 is packaged as NSIS x64 without deleting app data', async()=>{
  const pkg=JSON.parse(await read('package.json'));
  assert.equal(pkg.version,'1.0.1');
  assert.equal(pkg.devDependencies['electron-builder'],'26.15.3');
  assert.equal(pkg.devDependencies.playwright,'1.62.1');
  assert.match(pkg.scripts['build:win'],/electron-builder/);
  assert.equal(pkg.build.appId,'br.com.artisys.almoxarifado');
  assert.equal(pkg.build.productName,'ArtiSys Almoxarifado');
  assert.equal(pkg.build.artifactName,'ArtiSys-Almoxarifado-Setup-${version}.${ext}');
  assert.equal(pkg.build.win.target[0].target,'nsis');
  assert.deepEqual(pkg.build.win.target[0].arch,['x64']);
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall,false);
  assert.equal(pkg.build.nsis.perMachine,false);
  assert.equal(pkg.build.nsis.createDesktopShortcut,true);
  assert.equal(pkg.build.nsis.createStartMenuShortcut,true);
});
