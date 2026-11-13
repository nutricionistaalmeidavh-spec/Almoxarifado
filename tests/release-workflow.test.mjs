import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('final release workflow validates Linux and installed Windows artifact',async()=>{
  const yml=await read('.github/workflows/release-final.yml');
  for(const token of ['workflow_dispatch','feat/entregas-21-24','main','windows-latest','ubuntu-latest','actions/setup-node','node-version: 22','npm run check','npm run qa:validate','npm run security','npm run release:check','playwright install chromium','npm run build:win','windows-installed-smoke.ps1','release:manifest','RELEASE_ARTIFACT_REQUIRED','actions/upload-artifact','artisys-almoxarifado-1.0.1','CSC_IDENTITY_AUTO_DISCOVERY']) assert.ok(yml.includes(token),`workflow missing ${token}`);
  assert.ok(!yml.includes('submodules: recursive'),'final workflow must not depend on sibling private submodule');
});

test('versioned release is published only after verified Windows smoke and SHA-256 gate',async()=>{
  const yml=await read('.github/workflows/release-final.yml');
  assert.ok(yml.includes('contents: write'),'release job must receive write permission');
  const smoke=yml.indexOf('windows-installed-smoke.ps1');
  const integrity=yml.indexOf('Final artifact release gate');
  const published=yml.indexOf('gh release create v1.0.1');
  assert.ok(smoke>0 && integrity>smoke && published>integrity,'release must follow Windows smoke and verified hashes');
  assert.match(yml,/gh release edit v1\.0\.1 --draft=false --latest/);
  assert.match(yml,/release-manifest\.json/);
});

test('final release workflow publishes real UI v2 screenshots as a QA artifact',async()=>{
  const yml=await read('.github/workflows/release-final.yml');
  for(const token of ['ALMOX_SCREENSHOT_DIR','qa-artifacts/ui-v2','ui-v2-real-screenshots']) assert.ok(yml.includes(token),`workflow missing visual QA token ${token}`);
});

test('one-time release trigger documents its purpose',async()=>{
  const trigger=await read('.release-trigger');
  assert.match(trigger,/1\.0\.0/);
  assert.match(trigger,/final release/i);
});
