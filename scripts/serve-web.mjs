import path from 'node:path';
import { createAlmoxarifadoDesktopRuntime } from '../src/platform/desktop-runtime.mjs';

const host=process.env.ALMOX_WEB_HOST||'0.0.0.0';
const port=Number(process.env.ALMOX_WEB_PORT||4173);
const dataDir=process.env.ALMOX_DATA_DIR||path.resolve('.data');
const backupIntervalMs=Number(process.env.ALMOX_BACKUP_INTERVAL_MS||86_400_000);
const runtime=createAlmoxarifadoDesktopRuntime({dataDir,host,port});
runtime.saveSettings({host,port,backup:{enabled:true,intervalMs:backupIntervalMs}});
const address=await runtime.start();
console.log(`ArtiSys Almoxarifado local: http://${address.address}:${address.port}`);
console.log(`Dados locais: ${runtime.paths.database}`);
console.log(`Documentos locais: ${runtime.paths.documents}`);
console.log(`Backups locais: ${runtime.paths.backups}`);
console.log(`Logs locais: ${runtime.paths.logs}`);
const shutdown=async()=>{await runtime.stop();process.exit(0);};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
