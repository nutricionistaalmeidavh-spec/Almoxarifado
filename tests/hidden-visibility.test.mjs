import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css=fs.readFileSync(new URL('../apps/web/styles.css',import.meta.url),'utf8');

test('hidden attribute remains authoritative for UI visibility',()=>{
  assert.match(
    css,
    /\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important\s*;?[^}]*\}/,
    'styles.css must define [hidden]{display:none!important} so author display rules cannot reveal hidden screens'
  );
});
