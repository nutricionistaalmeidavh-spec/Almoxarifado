'use strict';
const {PrintingError,wrapPrintingError}=require('./errors');
const {normalizePrinterProfile}=require('./printer-profile');
const {createTransportPrinterDriver}=require('./drivers/transport-printer');
function createPrinterResolver({transportDriver}={}){return function resolve(profile={}){if(profile.mode==='transport'&&transportDriver)return transportDriver;throw new PrintingError('PRINTER_NOT_AVAILABLE',`Driver indisponivel para ${profile.mode||'modo desconhecido'}.`);};}
module.exports={PrintingError,wrapPrintingError,normalizePrinterProfile,createTransportPrinterDriver,createPrinterResolver};
