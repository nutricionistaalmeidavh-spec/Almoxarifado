import { readFile } from 'node:fs/promises';
import path from 'node:path';

const configPath=path.resolve(process.argv[2]||'artisys-qa.config.json');
const config=JSON.parse(await readFile(configPath,'utf8'));
if(config.schemaVersion!==1)throw new Error('QA config schemaVersion must be 1');
if(config.systemId!=='artisys-almoxarifado')throw new Error('QA config systemId mismatch');
const environment=config.environments?.[config.defaultEnvironment];
if(!environment?.baseURL)throw new Error('QA default environment/baseURL is required');
if(!/^https?:\/\//.test(environment.baseURL))throw new Error('QA baseURL must be HTTP(S)');
if(!environment.baseURL.includes(':4173'))throw new Error(`QA release baseURL must use port 4173, got ${environment.baseURL}`);
const flowRel=config.flows?.[config.defaultFlow];
if(!flowRel)throw new Error('QA default flow is required');
const flow=JSON.parse(await readFile(path.resolve(path.dirname(configPath),flowRel),'utf8'));
if(typeof flow.name!=='string'||!flow.name.trim())throw new Error('QA flow name is required');
if(!Array.isArray(flow.steps)||flow.steps.length===0)throw new Error('QA smoke flow must contain steps');
const allowed=new Set(['expectVisible','screenshot','goto','click','fill','expectText','waitFor']);
for(const [index,step] of flow.steps.entries()){
  if(!step||typeof step!=='object'||!allowed.has(step.action))throw new Error(`unsupported QA action at step ${index+1}`);
  if(step.action==='expectVisible'&&typeof step.selector!=='string')throw new Error(`expectVisible selector missing at step ${index+1}`);
  if(step.action==='screenshot'&&typeof step.name!=='string')throw new Error(`screenshot name missing at step ${index+1}`);
}
process.stdout.write(`${JSON.stringify({passed:true,baseURL:environment.baseURL,flow:config.defaultFlow,steps:flow.steps.length})}\n`);
