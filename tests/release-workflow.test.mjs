import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('final release workflow validates Linux and installed Windows artifact',async()=>{
  const yml=await read('.github/workflows/release-final.yml');
  for(const token of ['workflow_dispatch','feat/entregas-21-24','main','windows-latest','ubuntu-latest','actions/setup-node','node-version: 22','npm run check','npm run qa:validate','npm run security','npm run release:check','playwright install chromium','npm run build:win','windows-installed-smoke.ps1','release:manifest','RELEASE_ARTIFACT_REQUIRED','actions/upload-artifact','artisys-almoxarifado-1.0.0','CSC_IDENTITY_AUTO_DISCOVERY']) assert.ok(yml.includes(token),`workflow missing ${token}`);
  assert.ok(!yml.includes('submodules: recursive'),'final workflow must not depend on sibling private submodule');
});

test('one-time release trigger documents its purpose',async()=>{
  const trigger=await read('.release-trigger');
  assert.match(trigger,/1\.0\.0/);
  assert.match(trigger,/final release/i);
});
