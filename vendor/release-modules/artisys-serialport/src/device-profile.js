'use strict';
const {SerialError}=require('./errors');
const PARITY=new Set(['none','even','odd','mark','space']);
function normalizeDeviceProfile(input={}){const portPath=String(input.path||'').trim();if(!portPath)throw new SerialError('SERIAL_PORT_NOT_FOUND','Porta serial nao configurada.');const baudRate=Number(input.baudRate??9600),dataBits=Number(input.dataBits??8),stopBits=Number(input.stopBits??1),parity=String(input.parity||'none').toLowerCase();if(!Number.isInteger(baudRate)||baudRate<=0)throw new TypeError('baudRate invalido.');if(![5,6,7,8].includes(dataBits))throw new TypeError('dataBits invalido.');if(![1,1.5,2].includes(stopBits))throw new TypeError('stopBits invalido.');if(!PARITY.has(parity))throw new TypeError('parity invalido.');return Object.freeze({path:portPath,baudRate,dataBits,stopBits,parity});}
module.exports={normalizeDeviceProfile};
