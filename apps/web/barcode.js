import './features-16-20.js';

export function normalizeBarcode(value){return String(value??'').trim();}
export function findProductByBarcode(products,code){const normalized=normalizeBarcode(code);if(!normalized)return null;return products.find((item)=>item.barcode===normalized||item.sku===normalized)??null;}
export function createKeyboardBarcodeScanner({onCode,minLength=4,timeoutMs=90,now=()=>Date.now()}={}){if(typeof onCode!=='function')throw new TypeError('onCode is required');let buffer='',lastAt=0;return{handle(event){const at=now();if(at-lastAt>timeoutMs)buffer='';lastAt=at;if(event.key==='Enter'){if(buffer.length>=minLength)onCode(buffer);buffer='';return;}if(event.key?.length===1)buffer+=event.key;},reset(){buffer='';lastAt=0;}};}
export async function scanBarcodePhoto(file,ScannerClass=globalThis.Html5Qrcode){if(!file)throw new TypeError('file is required');if(typeof ScannerClass!=='function')throw new Error('barcode decoder unavailable');const scanner=new ScannerClass('barcode-reader');try{return normalizeBarcode(await scanner.scanFile(file,false));}finally{if(typeof scanner.clear==='function')await scanner.clear().catch(()=>{});}}
