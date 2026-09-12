import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../apps/web/manifest.webmanifest', import.meta.url);

test('web shell is installable as a standalone PWA', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'ArtiSys Almoxarifado');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
});
