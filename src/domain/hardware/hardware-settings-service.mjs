import { randomUUID } from 'node:crypto';
import { DomainError, requireId } from '../shared/domain-error.mjs';
function text(value,field){const out=String(value??'').trim();if(!out)throw new DomainError('INVALID_INPUT',`${field} is required`,{field});return out;}
export function createHardwareSettingsService({repository,now=()=>new Date().toISOString(),idFactory=randomUUID}={}){
  if(!repository||typeof repository.listHardwareSettings!=='function')throw new TypeError('repository with hardware settings is required');
  return{
    list(){return repository.listHardwareSettings().sort((a,b)=>String(a.kind).localeCompare(String(b.kind))||String(a.name).localeCompare(String(b.name)));},
    get(id){return repository.getHardwareSetting(requireId(id,'hardwareSettingId'));},
    save(input={},userId){const user=repository.getUser?.(requireId(userId,'userId'));if(!user||user.active===false)throw new DomainError('USER_NOT_FOUND','user not found',{id:userId});const id=input.id?requireId(input.id,'id'):idFactory();const previous=repository.getHardwareSetting(id)??{};const kind=text(input.kind??previous.kind,'kind'),name=text(input.name??previous.name,'name');const config=input.config??previous.config??{};if(!config||typeof config!=='object'||Array.isArray(config))throw new DomainError('INVALID_INPUT','config must be an object',{field:'config'});return repository.saveHardwareSetting({...previous,id,kind,name,enabled:Boolean(input.enabled??previous.enabled??true),config:structuredClone(config),updatedAt:now(),updatedBy:userId});}
  };
}
