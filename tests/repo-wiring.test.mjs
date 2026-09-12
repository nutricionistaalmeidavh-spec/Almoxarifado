import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('release consumes pinned ArtiSys runtime snapshots without private-repo dependency',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  assert.equal(pkg.engines.node,'>=22');
  for(const [name,module] of Object.entries({
    '@artisys/desktop-shell':'artisys-desktop-shell','@artisys/printing':'artisys-printing','@artisys/upload':'artisys-upload','@artisys/ocr':'artisys-ocr','@artisys/serialport':'artisys-serialport'
  })) assert.equal(pkg.dependencies[name],`file:vendor/release-modules/${module}`);
  assert.equal(Object.values(pkg.dependencies).some((value)=>String(value).includes('vendor/utilidades')),false);
  assert.equal(Object.values(pkg.devDependencies).some((value)=>String(value).includes('vendor/utilidades')),false);
});

test('utilidades submodule remains declared as source/reference pin',async()=>{
  const modules=await read('.gitmodules');
  assert.match(modules,/path = vendor\/utilidades/);
  assert.match(modules,/github\.com\/nutricionistaalmeidavh-spec\/utilidades\.git/);
});

test('QA security release and Windows packaging gates are explicit and self-contained',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  assert.match(pkg.scripts['qa:validate'],/qa-validate/);
  assert.match(pkg.scripts.security,/security-scan/);
  assert.match(pkg.scripts['release:check'],/release-check/);
  assert.match(pkg.scripts['build:win'],/electron-builder/);
  assert.match(pkg.scripts['smoke:release'],/release-smoke/);
});
