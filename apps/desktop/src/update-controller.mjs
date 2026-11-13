import { readFileSync } from 'node:fs';
import path from 'node:path';
import { checkForUpdate, DEFAULT_UPDATE_FEED_URL, downloadVerifiedInstaller } from '../../../src/platform/update-service.mjs';

// Keep the application source private: only a public HTTPS JSON feed / release binary is required.
export function readUpdateFeedUrl({app,env=process.env}={}){
  const override=String(env.ARTISYS_ALMOX_UPDATE_URL||'').trim();
  if(override)return override;
  try{
    const config=JSON.parse(readFileSync(path.join(app.getPath('userData'),'update-source.json'),'utf8'));
    if(typeof config?.url==='string'&&config.url.trim())return config.url.trim();
  }catch{}
  return DEFAULT_UPDATE_FEED_URL;
}

export async function promptForDesktopUpdate({currentVersion,feedUrl,destinationDir,app,window,dialog,shell,fetchImpl=fetch}={}){
  const update=await checkForUpdate({currentVersion,feedUrl,fetchImpl});
  if(update.status!=='available'||window.isDestroyed?.())return update.status;
  const choice=await dialog.showMessageBox(window,{
    type:'info',title:'Atualização disponível — ArtiSys Almoxarifado',
    message:`Nova versão ${update.version} disponível`,
    detail:`Versão instalada: ${currentVersion}. Deseja baixar e executar o instalador? Seus dados locais serão preservados.`,
    buttons:['Baixar e instalar','Agora não'],defaultId:1,cancelId:1,noLink:true
  });
  if(choice.response!==0)return 'deferred';
  try{
    window.setProgressBar?.(2); // Indeterminate download indicator; the UI remains usable.
    const installer=await downloadVerifiedInstaller(update,{destinationDir,fetchImpl});
    if(window.isDestroyed?.())return 'window-closed';
    const error=await shell.openPath(installer);
    if(error)throw Error(error);
    app.quit(); // NSIS installer can replace program files after the app exits.
    return 'started-installer';
  }catch(error){
    if(!window.isDestroyed?.())await dialog.showMessageBox(window,{
      type:'error',title:'Não foi possível atualizar',
      message:'O instalador não foi executado.',
      detail:`O sistema continua funcionando normalmente. ${String(error?.message||error).slice(0,250)}`,
      buttons:['OK']
    });
    return 'download-failed';
  }finally{if(!window.isDestroyed?.())window.setProgressBar?.(-1);}
}
