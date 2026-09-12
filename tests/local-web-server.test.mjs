import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebServer } from '../src/platform/web-server.mjs';

test('local web server serves the PWA shell without internet', async (t) => {
  const server = createWebServer({ host: '127.0.0.1', port: 0 });
  await server.start();
  t.after(() => server.stop());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/manifest.webmanifest`);
  assert.equal(response.status, 200);
  const manifest = await response.json();
  assert.equal(manifest.name, 'ArtiSys Almoxarifado');
});
