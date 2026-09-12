import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformConfig } from '../src/platform/config.mjs';

test('MVP local exposes PWA on LAN while keeping data local', () => {
  const config = createPlatformConfig({ dataDir: 'C:/Almoxarifado/data' });
  assert.equal(config.desktop.appId, 'br.com.artisys.almoxarifado');
  assert.equal(config.backend.host, '0.0.0.0');
  assert.equal(config.backend.allowRemote, true);
  assert.equal(config.backend.port, 8090);
  assert.equal(config.web.localOnly, true);
  assert.equal(config.web.installable, true);
});
