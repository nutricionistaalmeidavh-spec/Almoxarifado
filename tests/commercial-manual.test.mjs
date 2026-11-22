import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const read=async file=>readFile(new URL(file,root),'utf8');

test('customer PDF manual source covers license, activation, inventory, backup and LAN',async()=>{
 const html=await read('docs/MANUAL-CLIENTE-COMERCIAL.html');
 for(const heading of ['Instalação e ativação','Movimentações e inventário','Acesso pelo celular','Backup','Suporte ArtiSys']){
  assert.ok(html.includes(heading),heading+' is missing');
 }
 assert.match(html,/seis dígitos/i);
 assert.match(html,/48 horas/i);
 assert.match(html,/192\.168\.1\.50/);
 assert.match(html,/Comercial/);
 assert.match(html,/código não recupera os dados|não recupera os dados/i);
 assert.doesNotMatch(html,/clone o repositório/i);
});

test('commercial manual can be built into the exact PDF asset expected by the welcome email',async()=>{
 const script=await read('scripts/build-commercial-manual.mjs');
 assert.match(script,/Manual-ArtiSys-Almoxarifado\.pdf/);
 assert.match(script,/chromium/);
 assert.match(script,/page\.pdf/);
});
