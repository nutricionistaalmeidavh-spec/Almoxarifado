import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme = fs.readFileSync(new URL('../apps/web/theme-lote-a.css', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../apps/web/ui-v2.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../apps/web/sw.js', import.meta.url), 'utf8');

test('Lote A warehouse theme is isolated and local-first', () => {
  assert.match(theme, /--color-sidebar:#12343b/);
  assert.match(theme, /--color-primary:#0f6674/);
  assert.match(ui, /theme-lote-a\.css/);
  assert.match(sw, /theme-lote-a\.css/);
});
