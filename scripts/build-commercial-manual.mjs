import {chromium} from 'playwright';
import {mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const source=fileURLToPath(new URL('../docs/MANUAL-CLIENTE-COMERCIAL.html',import.meta.url));
const destination=path.resolve(process.argv[2]||'dist/Manual-ArtiSys-Almoxarifado.pdf');
await mkdir(path.dirname(destination),{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:780}});
 await page.goto(pathToFileURL(source).href,{waitUntil:'load'});
 await page.emulateMedia({media:'print'});
 await page.pdf({
  path:destination,format:'A4',printBackground:true,
  margin:{top:'16mm',bottom:'17mm',left:'18mm',right:'18mm'},
  displayHeaderFooter:true,
  headerTemplate:'<span></span>',
  footerTemplate:'<div style="width:100%;font:9px Arial;color:#657084;padding:0 18mm;display:flex;justify-content:space-between"><span>ArtiSys Almoxarifado — Manual de instruções</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
 });
 const info=await stat(destination);
 if(info.size<10_000)throw Error('Manual PDF generated with unexpected size');
 process.stdout.write(JSON.stringify({artifact:path.basename(destination),size:info.size})+'\n');
}finally{await browser.close();}
