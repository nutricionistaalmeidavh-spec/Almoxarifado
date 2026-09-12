import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function sources(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await sources(p));else if(/\.(?:js|mjs|cjs|json|html)$/.test(entry.name))out.push(p);}return out;}

test('runtime and packaging contain no license or activation subsystem',async()=>{
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  const wiring=JSON.stringify({scripts:pkg.scripts,dependencies:pkg.dependencies,devDependencies:pkg.devDependencies}).toLowerCase();
  for(const token of ['license-server','license-key','activation-server','machine-limit']) assert.equal(wiring.includes(token),false,`forbidden runtime wiring: ${token}`);
  const files=[...await sources(path.join(root,'src')),...await sources(path.join(root,'apps'))];
  for(const file of files){const text=(await readFile(file,'utf8')).toLowerCase();for(const token of ['licensekey','activationserver','validate-license','checklicense'])assert.equal(text.includes(token),false,`${path.relative(root,file)} contains ${token}`);}
});
