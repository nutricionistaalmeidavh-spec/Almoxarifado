import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('repository consumes approved ArtiSys runtime kits from pinned utilidades submodule', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.engines.node, '>=22');
  for (const [name,module] of Object.entries({
    '@artisys/desktop-shell':'artisys-desktop-shell','@artisys/local-backend':'artisys-local-backend','@artisys/eventbus':'artisys-eventbus','@artisys/capture':'artisys-capture','@artisys/dashboard':'artisys-dashboard','@artisys/pdf':'artisys-pdf','@artisys/printing':'artisys-printing','@artisys/upload':'artisys-upload','@artisys/ocr':'artisys-ocr','@artisys/serialport':'artisys-serialport'
  })) assert.equal(pkg.dependencies[name], `file:vendor/utilidades/modules/${module}`);
});

test('utilidades submodule is declared at the standard vendor path', async () => {
  const modules = await read('.gitmodules');
  assert.match(modules, /path = vendor\/utilidades/);
  assert.match(modules, /github\.com\/nutricionistaalmeidavh-spec\/utilidades\.git/);
});

test('QA, security and release gates are wired as explicit scripts', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.scripts['qa:validate'], /artisys-qa/);
  assert.match(pkg.scripts.security, /artisys-security/);
  assert.match(pkg.scripts['release:check'], /release-check/);
  assert.match(pkg.scripts.desktop, /electron/);
});
