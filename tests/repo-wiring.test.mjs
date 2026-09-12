import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('repository consumes ArtiSys runtime kits from pinned utilidades submodule', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.engines.node, '>=22');
  assert.equal(pkg.dependencies['@artisys/desktop-shell'], 'file:vendor/utilidades/modules/artisys-desktop-shell');
  assert.equal(pkg.dependencies['@artisys/local-backend'], 'file:vendor/utilidades/modules/artisys-local-backend');
  assert.equal(pkg.dependencies['@artisys/eventbus'], 'file:vendor/utilidades/modules/artisys-eventbus');
  assert.equal(pkg.dependencies['@artisys/capture'], 'file:vendor/utilidades/modules/artisys-capture');
  assert.equal(pkg.dependencies['@artisys/dashboard'], 'file:vendor/utilidades/modules/artisys-dashboard');
  assert.equal(pkg.dependencies['@artisys/pdf'], 'file:vendor/utilidades/modules/artisys-pdf');
  assert.equal(pkg.dependencies['@artisys/printing'], 'file:vendor/utilidades/modules/artisys-printing');
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
});
