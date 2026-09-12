import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('README documents final deliveries, Windows release and no activation',async()=>{
  const text=await read('README.md');
  for(const token of ['### 21','### 22','### 23','### 24','1.0.0','Windows x64','sem sistema de licença','ArtiSys-Almoxarifado-Setup-1.0.0.exe']) assert.ok(text.includes(token),`README missing ${token}`);
  assert.doesNotMatch(text,/## Próxima entrega/);
});

test('installation manual covers install first access LAN backup update and uninstall',async()=>{
  const text=(await read('docs/MANUAL-INSTALACAO.md')).toLowerCase();
  for(const token of ['instalação','primeiro acesso','rede local','backup','atualização','desinstalação','dados','sem licença']) assert.ok(text.includes(token),`manual missing ${token}`);
  assert.match(text,/não apaga|não remove/);
});
