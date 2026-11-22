// Gera a edição comercial explicitamente sem modificar o core livre publicado.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const marker=new URL('../apps/desktop/src/edition.json',import.meta.url);
const original=await readFile(marker,'utf8');
function run(command,args){
 const windows=process.platform==='win32';
 const result=windows
  ?spawnSync('cmd.exe',['/d','/s','/c',command,...args],{stdio:'inherit'})
  :spawnSync(command,args,{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(command+' failed with exit code '+result.status);
}
try{
 await writeFile(marker,JSON.stringify({commercialActivation:true},null,2)+'\n','utf8');
 run('npm',['run','assets:vendor']);
 // A edição comercial possui nome próprio e nunca substitui a versão livre.
 run('npx',['electron-builder','--win','nsis','--x64','--publish','never',
  '--config.artifactName=ArtiSys-Almoxarifado-Setup-\u0024{version}-Commercial.\u0024{ext}']);
}finally{
 await writeFile(marker,original,'utf8');
}
