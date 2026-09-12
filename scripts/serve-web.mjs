import path from 'node:path';
import { createFileStockRepository } from '../src/domain/stock/file-repository.mjs';
import { createLocalApi } from '../src/platform/local-api.mjs';
import { createWebServer } from '../src/platform/web-server.mjs';
const host=process.env.ALMOX_WEB_HOST||'0.0.0.0';const port=Number(process.env.ALMOX_WEB_PORT||4173);const dataDir=process.env.ALMOX_DATA_DIR||path.resolve('.data');const repository=createFileStockRepository({filePath:path.join(dataDir,'almoxarifado.json')});const apiHandler=createLocalApi({repository});const server=createWebServer({host,port,apiHandler});await server.start();const address=server.address();console.log(`ArtiSys Almoxarifado local: http://${address.address}:${address.port}`);console.log(`Dados locais: ${path.join(dataDir,'almoxarifado.json')}`);const shutdown=async()=>{await server.stop();process.exit(0);};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
