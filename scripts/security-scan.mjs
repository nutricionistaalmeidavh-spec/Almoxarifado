import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const skipped=new Set(['.git','node_modules','dist','.data']);
const textExt=new Set(['.js','.mjs','.cjs','.json','.md','.yml','.yaml','.toml','.py','.ps1','.html','.css','.txt']);
const secretPatterns=[
  ['OpenAI key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['GitHub classic token',/\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['GitHub fine-grained token',/\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/],
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
];
const findings=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(skipped.has(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory()){await walk(file);continue;}if(!entry.isFile()||!textExt.has(path.extname(entry.name).toLowerCase()))continue;const info=await stat(file);if(info.size>2_000_000)continue;const source=await readFile(file,'utf8').catch(()=>null);if(source==null)continue;for(const [name,pattern] of secretPatterns)if(pattern.test(source))findings.push({type:name,file:path.relative(root,file)});}}
await walk(root);
const electron=await readFile(path.join(root,'apps/desktop/src/electron-main.mjs'),'utf8');
for(const required of ['contextIsolation:true','nodeIntegration:false','sandbox:true','webSecurity:true','setWindowOpenHandler','action:\'deny\''])if(!electron.includes(required))findings.push({type:'desktop-hardening',file:'apps/desktop/src/electron-main.mjs',missing:required});
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const allNames=JSON.stringify({...pkg.dependencies,...pkg.devDependencies,...pkg.scripts}).toLowerCase();
for(const forbidden of ['license-server','license-key','activation-server'])if(allNames.includes(forbidden))findings.push({type:'forbidden-license-runtime',file:'package.json',value:forbidden});
if(findings.length){process.stderr.write(`${JSON.stringify({passed:false,findings},null,2)}\n`);process.exitCode=1;}else process.stdout.write(`${JSON.stringify({passed:true,checks:['secret-patterns','desktop-hardening','no-license-runtime']})}\n`);
