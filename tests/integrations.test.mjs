import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTISYS_MODULES, loadArtisysModule } from '../src/platform/integrations.mjs';

test('repository registers all approved ArtiSys utilities through delivery 20', () => {
  assert.deepEqual(Object.keys(ARTISYS_MODULES).sort(), [
    'capture','dashboard','desktopShell','eventbus','localBackend','ocr','pdf','printing','qa','release','security','serialport','upload'
  ]);
});

test('runtime modules resolve through stable package boundaries', async () => {
  const seen = [];
  const fakeImporter = async (specifier) => { seen.push(specifier); return { specifier }; };
  const loaded = await loadArtisysModule('ocr', fakeImporter);
  assert.equal(loaded.specifier, '@artisys/ocr');
  assert.deepEqual(seen, ['@artisys/ocr']);
});

test('CI-only security integration is not imported into runtime', async () => {
  await assert.rejects(() => loadArtisysModule('security', async () => ({})), /CI-only/);
});
