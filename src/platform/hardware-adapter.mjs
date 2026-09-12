import { DomainError } from '../domain/shared/domain-error.mjs';
function unavailable(capability){return new DomainError('HARDWARE_UNAVAILABLE',`${capability} hardware is unavailable`,{capability});}
function normalizeScaleSettings(settings={}){const portPath=String(settings.portPath??settings.path??'').trim();if(!portPath)throw new DomainError('INVALID_INPUT','portPath is required',{field:'portPath'});const baudRate=Number(settings.baudRate??9600);if(!Number.isInteger(baudRate)||baudRate<=0)throw new DomainError('INVALID_INPUT','baudRate must be a positive integer',{field:'baudRate'});return{...settings,portPath,baudRate,profile:{path:portPath,baudRate,...(settings.profile??{})}};}
export function createHardwareAdapter({serialApi=null,printingApi=null}={}){
  const serialAvailable=()=>Boolean(serialApi&&typeof serialApi.createSerialPortManager==='function');
  const printingAvailable=()=>Boolean(printingApi&&(typeof printingApi.print==='function'||typeof printingApi.createTransportPrinterDriver==='function'||typeof printingApi.createPrinterResolver==='function'));
  return{
    status(){return{serial:serialAvailable()?'available':'unavailable',printing:printingAvailable()?'available':'unavailable'};},
    async listPorts(){if(!serialAvailable())throw unavailable('serial');try{return await serialApi.createSerialPortManager().list();}catch(error){throw new DomainError('HARDWARE_UNAVAILABLE','serial ports could not be listed',{cause:String(error?.message??error)});}},
    async readScale(settings={}){
      if(!serialAvailable())throw unavailable('serial');const normalized=normalizeScaleSettings(settings);
      try{
        if(typeof serialApi.readScale==='function'){const raw=await serialApi.readScale(normalized);const value=Number(raw?.value??raw?.weight??raw);if(!Number.isFinite(value))throw new Error('invalid scale value');return{value,unit:raw?.unit??'kg',raw:raw?.raw??null};}
        const manager=serialApi.createSerialPortManager();if(typeof manager.createTransport!=='function'||typeof serialApi.createRequestResponseSession!=='function'||typeof serialApi.parseNumericWeight!=='function'||typeof serialApi.createScaleAdapter!=='function')throw unavailable('scale');
        const transport=manager.createTransport(normalized.profile);const session=serialApi.createRequestResponseSession({transport,request:settings.request??'',timeoutMs:Number(settings.timeoutMs??1500),parse:serialApi.parseNumericWeight});const scale=serialApi.createScaleAdapter({session,profile:normalized.profile});const result=await scale.readWeight();return{value:Number(result.weight),unit:result.unit??'kg',raw:null};
      }catch(error){if(error instanceof DomainError)throw error;throw new DomainError('HARDWARE_READ_FAILED','scale reading failed',{cause:String(error?.message??error)});}
    },
    async print(job,settings={}){
      if(!printingAvailable())throw unavailable('printing');
      try{
        if(typeof printingApi.print==='function')return await printingApi.print(job,settings);
        if(settings.mode==='transport'&&serialAvailable()&&typeof printingApi.createTransportPrinterDriver==='function'){
          const normalized=normalizeScaleSettings(settings);const transport=serialApi.createSerialPortManager().createTransport(normalized.profile);const driver=printingApi.createTransportPrinterDriver({transport});return await driver.print(job,settings);
        }
        throw unavailable('printing');
      }catch(error){if(error instanceof DomainError)throw error;throw new DomainError('PRINT_FAILED','printing failed',{cause:String(error?.message??error)});}
    }
  };
}
