import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { createAlmoxarifadoDesktopRuntime } from '../../../src/platform/desktop-runtime.mjs';

let runtime;
let mainWindow;
let shuttingDown=false;

async function boot(){
  const dataDir=path.join(app.getPath('userData'),'data');
  runtime=createAlmoxarifadoDesktopRuntime({dataDir,host:'0.0.0.0',port:4173});
  const address=await runtime.start();
  mainWindow=new BrowserWindow({width:1280,height:820,minWidth:960,minHeight:640,show:false,autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  await mainWindow.loadURL(`http://127.0.0.1:${address.port}/`);
  mainWindow.once('ready-to-show',()=>mainWindow.show());
}

app.whenReady().then(boot).catch((error)=>{console.error(error);app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',(event)=>{
  if(shuttingDown||!runtime)return;
  event.preventDefault();
  shuttingDown=true;
  runtime.stop().catch((error)=>console.error(error)).finally(()=>app.quit());
});
