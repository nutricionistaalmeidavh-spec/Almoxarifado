import { randomUUID } from 'node:crypto';
import { DomainError, requireId } from '../shared/domain-error.mjs';

const TYPES=new Set(['MAINTENANCE','CALIBRATION']);
function addDays(value,days){const date=new Date(value);date.setUTCDate(date.getUTCDate()+Number(days));return date.toISOString();}
function statusFor(plan,now){if(plan.active===false)return'INACTIVE';const due=Date.parse(plan.nextDueAt??'');if(!Number.isFinite(due))return'UNSCHEDULED';const current=now.getTime(),soon=current+30*86400000;if(due<current)return'OVERDUE';if(due<=soon)return'DUE_SOON';return'OK';}

export function createMaintenanceService({repository,now=()=>new Date().toISOString(),idFactory=randomUUID}={}){
  if(!repository)throw new TypeError('repository is required');
  const getPlan=(id)=>{const item=repository.getMaintenancePlan(requireId(id,'planId'));if(!item)throw new DomainError('MAINTENANCE_PLAN_NOT_FOUND','maintenance plan not found',{id});return item;};
  return{
    listPlans(assetId=null){return repository.listMaintenancePlans().filter(x=>!assetId||x.assetId===assetId);},
    savePlan(input={}){const asset=repository.getAsset(requireId(input.assetId,'assetId'));if(!asset)throw new DomainError('ASSET_NOT_FOUND','asset not found',{id:input.assetId});const type=String(input.type??'MAINTENANCE').toUpperCase();if(!TYPES.has(type))throw new DomainError('INVALID_MAINTENANCE_TYPE','invalid maintenance plan type',{type});const intervalDays=Math.max(1,Number(input.intervalDays??0));if(!Number.isFinite(intervalDays))throw new DomainError('INVALID_MAINTENANCE_INTERVAL','intervalDays must be valid');const current=input.id?repository.getMaintenancePlan(input.id):null;const nextDueAt=input.nextDueAt??current?.nextDueAt??addDays(now(),intervalDays);return repository.saveMaintenancePlan({...current,...input,id:input.id??idFactory(),assetId:input.assetId,type,intervalDays,nextDueAt,active:input.active!==false,updatedAt:now()});},
    status(planId){const plan=getPlan(planId);return{...plan,status:statusFor(plan,new Date(now()))};},
    due({days=30,type=null}={}){const limit=new Date(now()).getTime()+Math.max(0,Number(days))*86400000;return repository.listMaintenancePlans().filter(x=>x.active!==false&&(!type||x.type===type)&&Number.isFinite(Date.parse(x.nextDueAt))&&Date.parse(x.nextDueAt)<=limit).map(x=>({...x,status:statusFor(x,new Date(now()))})).sort((a,b)=>String(a.nextDueAt).localeCompare(String(b.nextDueAt)));},
    complete({planId,userId,performedAt=now(),certificateNumber=null,notes=null,measurement=null}={}){const plan=getPlan(planId);if(!repository.getUser(requireId(userId,'userId')))throw new DomainError('USER_NOT_FOUND','user not found',{id:userId});const record=repository.saveCalibrationRecord({id:idFactory(),planId:plan.id,assetId:plan.assetId,type:plan.type,performedAt,performedBy:userId,certificateNumber,notes,measurement});const updated=repository.saveMaintenancePlan({...plan,lastCompletedAt:performedAt,lastCompletedBy:userId,nextDueAt:addDays(performedAt,plan.intervalDays),updatedAt:now()});return{plan:updated,record};}
  };
}
