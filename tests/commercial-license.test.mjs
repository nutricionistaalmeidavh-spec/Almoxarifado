import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAlmoxarifadoCommercialLicense} from '../src/platform/commercial-license.mjs';

const endpoint='https://pdv-artisys.sistema-artisys.workers.dev';
const setup=async t=>{const root=await mkdtemp(path.join(os.tmpdir(),'almox-license-'));t.after(()=>rm(root,{force:true,recursive:true}));return root;};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

test('core livre não depende da central e não exige licença',async()=>{
 const license=createAlmoxarifadoCommercialLicense({required:false});
 assert.deepEqual(await license.status(),{required:false,active:true,offline:false});
 await assert.rejects(license.activate({email:'a@b.com',code:'123456'}),/não habilitado/);
});

test('ativação comercial só aceita produto ALMOXARIFADO e mantém instalação local',async t=>{
 const root=await setup(t);const calls=[];
 const license=createAlmoxarifadoCommercialLicense({required:true,root,fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,body});
  return response({product:'ALMOXARIFADO',licenseId:'lic-1',accountEmail:body.email,expiresAt:null});
 }});
 assert.equal((await license.status()).active,false);
 await assert.rejects(license.activate({email:'bad',code:'123456'}),/E-mail/);
 await assert.rejects(license.activate({email:'ok@example.com',code:'123'}),/6 dígitos/);
 assert.equal((await license.activate({email:' OK@example.com ',code:'123456'})).active,true);
 assert.equal(calls[0].url,endpoint+'/v1/activation/verify');
 assert.equal(calls[0].body.product,'ALMOXARIFADO');
 assert.match(calls[0].body.installationId,/^almoxarifado-[a-f0-9-]{36}$/);
 const stored=JSON.parse(await readFile(path.join(root,'almoxarifado-commercial-license.json'),'utf8'));
 assert.equal(stored.licenseId,'lic-1');
 assert.equal(stored.accountEmail,'ok@example.com');
});

test('central jamais aceita licença de outro produto',async t=>{
 const root=await setup(t);
 const license=createAlmoxarifadoCommercialLicense({required:true,root,fetchImpl:async()=>response({product:'OFICINA',licenseId:'lic-1',accountEmail:'ok@example.com',expiresAt:null})});
 await assert.rejects(license.activate({email:'ok@example.com',code:'123456'}),/incompatível/);
 assert.equal((await license.status()).active,false);
});

test('falha de rede preserva licença confirmada ativa, mas expiração local bloqueia',async t=>{
 const root=await setup(t);let clock=Date.parse('2026-11-22T00:00:00Z'),online=true;
 const expire='2026-11-24T00:00:00Z';
 const license=createAlmoxarifadoCommercialLicense({required:true,root,now:()=>clock,fetchImpl:async(url,init)=>{
  if(!online)throw Error('offline');
  if(init.method==='POST')return response({product:'ALMOXARIFADO',licenseId:'lic-1',accountEmail:'ok@example.com',expiresAt:expire});
  return response({product:'ALMOXARIFADO',active:true,expiresAt:expire});
 }});
 await license.activate({email:'ok@example.com',code:'123456'});
 online=false;clock+=16*60*1000;
 assert.deepEqual(await license.status(),{required:true,active:true,offline:true,expiresAt:expire});
 clock=Date.parse('2026-11-25T00:00:00Z');
 assert.equal((await license.status()).active,false);
});

test('suspensão online revoga acesso, inclusive quando a internet cai depois',async t=>{
 const root=await setup(t);let now=Date.parse('2026-11-22T00:00:00Z'),offline=false;
 const license=createAlmoxarifadoCommercialLicense({required:true,root,now:()=>now,fetchImpl:async(url,init)=>{
  if(offline)throw Error('sem rede');
  if(init.method==='POST')return response({product:'ALMOXARIFADO',licenseId:'lic-1',accountEmail:'ok@example.com',expiresAt:null});
  return response({product:'ALMOXARIFADO',active:false,expiresAt:null});
 }});
 await license.activate({email:'ok@example.com',code:'123456'});
 now+=16*60*1000;assert.equal((await license.status()).active,false);
 offline=true;now+=16*60*1000;assert.equal((await license.status()).active,false);
});

test('endpoint de ativação exige origem HTTPS pura e explícita',async t=>{
 const root=await setup(t);
 for(const endpoint of ['http://localhost:3000','https://a.example/evil','https://u:p@a.example','https://a.example?x=1']){
  assert.throws(()=>createAlmoxarifadoCommercialLicense({required:true,root,endpoint}),/HTTPS/);
 }
});
