import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createDesktopShellManifest } from '@artisys/desktop-shell';
import { createFileStockRepository } from '../domain/stock/file-repository.mjs';
import { createBackupService } from '../domain/backup/backup-service.mjs';
import { createLocalApi } from './local-api.mjs';
import { createWebServer } from './web-server.mjs';
import { createHardwareAdapter } from './hardware-adapter.mjs';
import { createOcrAdapter } from './ocr-adapter.mjs';

function atomicJson(file,value){const tmp=`${file}.tmp`;writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`,'utf8');renameSync(tmp,file);}
function readJson(file){try{return JSON.parse(readFileSync(file,'utf8'));}catch{return null;}}
function normalizeSettings(input,defaults){const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};const port=Number(source.port??defaults.port);return{host:String(source.host??defaults.host),port:Number.isInteger(port)&&port>=0&&port<=65535?port:defaults.port,backup:{...defaults.backup,...(source.backup&&typeof source.backup==='object'?source.backup:{})},hardware:{...defaults.hardware,...(source.hardware&&typeof source.hardware==='object'?source.hardware:{})}};}
async function optionalImport(specifier){try{const mod=await import(specifier);return mod.default??mod;}catch{return null;}}
async function loadHardwareAdapter(){const [serialApi,printingApi]=await Promise.all([optionalImport('@artisys/serialport'),optionalImport('@artisys/printing')]);return createHardwareAdapter({serialApi,printingApi});}
function rotateLog(file,maxBytes=1024*1024){try{if(statSync(file).size<maxBytes)return;const previous=`${file}.1`;try{renameSync(file,previous);}catch{} }catch{}}

export function createAlmoxarifadoDesktopRuntime({dataDir=path.resolve('.data'),host='0.0.0.0',port=4173,dependencies={}}={}){
  if(typeof dataDir!=='string'||!dataDir.trim())throw new TypeError('dataDir is required');
  const data=path.resolve(dataDir);
  const paths={data,database:path.join(data,'almoxarifado.json'),documents:path.join(data,'documents'),backups:path.join(data,'backups'),logs:path.join(data,'logs'),settings:path.join(data,'settings.json')};
  for(const dir of [paths.data,paths.documents,paths.backups,paths.logs])mkdirSync(dir,{recursive:true});
  const defaults={host,port,backup:{enabled:true,intervalMs:86_400_000},hardware:{}};
  let currentSettings=normalizeSettings(readJson(paths.settings),defaults);
  if(!existsSync(paths.settings))atomicJson(paths.settings,currentSettings);
  const desktopApi=dependencies.desktopApi??{createDesktopShellManifest};
  if(typeof desktopApi.createDesktopShellManifest!=='function')throw new TypeError('desktopApi.createDesktopShellManifest is required');
  const manifest=desktopApi.createDesktopShellManifest({appId:'br.com.artisys.almoxarifado',userDataDir:paths.data,logDir:paths.logs,updateChannel:'stable',deepLinkSchemes:['artisys-almoxarifado'],telemetry:false});
  let server=null,stopAutomaticBackup=null,repository=null;
  const logFile=path.join(paths.logs,'almoxarifado.log');
  const log=(event,details={})=>{rotateLog(logFile);appendFileSync(logFile,`${JSON.stringify({at:new Date().toISOString(),event,...details})}\n`,'utf8');};
  const address=()=>server?.address?.()??null;

  async function start(){
    if(server){const current=address();return typeof current==='object'&&current?current:{address:current};}
    repository=(dependencies.createRepository??createFileStockRepository)({filePath:paths.database});
    const backup=(dependencies.createBackupService??createBackupService)({repository,backupDir:paths.backups});
    if(currentSettings.backup.enabled!==false)stopAutomaticBackup=backup.startAutomatic({intervalMs:Number(currentSettings.backup.intervalMs??86_400_000)});
    const hardwareAdapter=dependencies.hardwareAdapter??await loadHardwareAdapter();
    const ocrAdapter=dependencies.ocrAdapter??createOcrAdapter({providers:dependencies.ocrProviders??{}});
    const api=(dependencies.createLocalApi??createLocalApi)({repository,backupDir:paths.backups,documentDir:paths.documents,ocrAdapter,hardwareAdapter});
    server=(dependencies.createWebServer??createWebServer)({host:currentSettings.host,port:currentSettings.port,apiHandler:api});
    try{await server.start();const current=address();log('runtime.started',{host:current?.address??currentSettings.host,port:current?.port??currentSettings.port});return current;}
    catch(error){stopAutomaticBackup?.();stopAutomaticBackup=null;server=null;log('runtime.start_failed',{code:error?.code??'ERROR',message:String(error?.message??error)});throw error;}
  }
  async function stop(){if(!server)return;const current=server;server=null;stopAutomaticBackup?.();stopAutomaticBackup=null;await current.stop();log('runtime.stopped');}
  function saveSettings(patch={}){currentSettings=normalizeSettings({...currentSettings,...patch,backup:{...currentSettings.backup,...(patch.backup??{})},hardware:{...currentSettings.hardware,...(patch.hardware??{})}},defaults);atomicJson(paths.settings,currentSettings);log('settings.saved');return{...currentSettings,restartRequired:Boolean(server)};}

  return{manifest,paths,get settings(){return structuredClone(currentSettings);},start,stop,address,saveSettings,get repository(){return repository;}};
}
