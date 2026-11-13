import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readUpdateFeedUrl, promptForDesktopUpdate } from '../apps/desktop/src/update-controller.mjs';
import { DEFAULT_UPDATE_FEED_URL } from '../src/platform/update-service.mjs';

test('source may be configured without embedding private credentials',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'almox-update-config-'));
  try{
    const app={getPath:()=>dir};
    assert.equal(readUpdateFeedUrl({app,env:{}}),DEFAULT_UPDATE_FEED_URL);
    await writeFile(path.join(dir,'update-source.json'),JSON.stringify({url:'https://example.org/updates.json'}));
    assert.equal(readUpdateFeedUrl({app,env:{}}),'https://example.org/updates.json');
    assert.equal(readUpdateFeedUrl({app,env:{ARTISYS_ALMOX_UPDATE_URL:'https://other.example/updates.json'}}),'https://other.example/updates.json');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('desktop requests consent, verifies installer and exits after opening setup',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'almox-controller-'));
  try{
    const bytes=Buffer.from('installer');
    const payload={version:'1.0.1',size:bytes.length,downloadUrl:'https://example.org/Setup.exe',sha256:createHash('sha256').update(bytes).digest('hex')};
    const fetchImpl=async url=>url.endsWith('.json')?new Response(JSON.stringify(payload)):new Response(bytes);
    const actions=[];
    const app={quit:()=>actions.push('quit')};
    const window={isDestroyed:()=>false,setProgressBar:n=>actions.push('progress:'+n)};
    const dialog={showMessageBox:async(_win,opts)=>{actions.push('dialog:'+opts.buttons[0]);return{response:0};}};
    const shell={openPath:async file=>{actions.push('open:'+path.basename(file));return '';}};
    const result=await promptForDesktopUpdate({currentVersion:'1.0.0',feedUrl:'https://example.org/latest.json',destinationDir:dir,app,window,dialog,shell,fetchImpl});
    assert.equal(result,'started-installer');
    assert.ok(actions.includes('open:ArtiSys-Almoxarifado-Setup-1.0.1.exe'));
    assert.ok(actions.indexOf('quit')>actions.findIndex(x=>x.startsWith('open:')));
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('choosing later avoids downloading or exiting',async()=>{
  const bytes=Buffer.from('installer');let requests=0,quits=0;
  const payload={version:'1.0.1',size:bytes.length,downloadUrl:'https://example.org/Setup.exe',sha256:createHash('sha256').update(bytes).digest('hex')};
  const result=await promptForDesktopUpdate({currentVersion:'1.0.0',feedUrl:'https://example.org/latest.json',destinationDir:os.tmpdir(),app:{quit:()=>quits++},window:{isDestroyed:()=>false},dialog:{showMessageBox:async()=>({response:1})},shell:{openPath:async()=>''},fetchImpl:async()=>{requests++;return new Response(JSON.stringify(payload));}});
  assert.equal(result,'deferred');
  assert.equal(requests,1);
  assert.equal(quits,0);
});
