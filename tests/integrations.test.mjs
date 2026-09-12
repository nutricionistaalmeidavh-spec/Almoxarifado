import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTISYS_MODULES, loadArtisysModule } from '../src/platform/integrations.mjs';

test('delivery 2 registers all approved ArtiSys utilities', () => {
  assert.deepEqual(Object.keys(ARTISYS_MODULES).sort(), [
    'capture','dashboard','desktopShell','eventbus','localBackend','pdf','printing','qa','release','security'
  ]);
});

test('runtime modules resolve through stable package boundaries', async () => {
  const seen = [];
  const fakeImporter = async (specifier) => { seen.push(specifier); return { specifier }; };
  const loaded = await loadArtisysModule('eventbus', fakeImporter);
  assert.equal(loaded.specifier, '@artisys/eventbus');
  assert.deepEqual(seen, ['@artisys/eventbus']);
});

test('CI-only security integration is not imported into runtime', async () => {
  await assert.rejects(() => loadArtisysModule('security', async () => ({})), /CI-only/);
});
