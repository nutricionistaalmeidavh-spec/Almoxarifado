import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.mjs';

const SCHEMA_VERSION = 1;
function stamp(date) { return date.toISOString().replace(/[:.]/g, '-'); }
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || payload.schemaVersion !== SCHEMA_VERSION || !payload.state || typeof payload.state !== 'object') {
    throw new DomainError('INVALID_BACKUP', 'backup file is invalid or incompatible');
  }
  for (const key of ['users','warehouses','products']) if (!Array.isArray(payload.state[key])) throw new DomainError('INVALID_BACKUP', `backup state is missing ${key}`);
  if (!payload.state.users.some((user) => user?.role === 'ADMIN' && user?.active !== false)) throw new DomainError('INVALID_BACKUP', 'backup must contain an active administrator');
  if (payload.state.warehouses.length === 0) throw new DomainError('INVALID_BACKUP', 'backup must contain at least one warehouse');
  return payload;
}
function normalizeAssets(assetDirs=[]) {
  if (!Array.isArray(assetDirs)) throw new TypeError('assetDirs must be an array');
  return assetDirs.map((item)=>{
    const name=String(item?.name??'').trim(),sourceDir=String(item?.sourceDir??'').trim();
    if(!/^[A-Za-z0-9._-]+$/.test(name))throw new TypeError('asset name is invalid');
    if(!sourceDir)throw new TypeError('asset sourceDir is required');
    return{name,sourceDir:path.resolve(sourceDir)};
  });
}
function assetRoot(filePath){return filePath.replace(/\.json$/,'.assets');}
function uniqueBackupPath(backupDir,createdAt,id){const prefix=`almoxarifado-${stamp(new Date(createdAt))}-${id}`;let index=0;while(true){const suffix=index?`-${index}`:'';const candidate=path.join(backupDir,`${prefix}${suffix}.json`);if(!existsSync(candidate)&&!existsSync(assetRoot(candidate)))return candidate;index+=1;}}

export function createBackupService({ repository, backupDir, now = () => new Date(), idFactory = randomUUID, maxBackups = 30, assetDirs = null } = {}) {
  if (!repository?.exportState || !repository?.replaceState) throw new TypeError('repository with exportState/replaceState is required');
  if (typeof backupDir !== 'string' || !backupDir.trim()) throw new TypeError('backupDir is required');
  const resolvedBackupDir=path.resolve(backupDir);
  mkdirSync(resolvedBackupDir, { recursive: true });
  const effectiveAssets=assetDirs??[{name:'documents',sourceDir:path.join(path.dirname(resolvedBackupDir),'documents')}];
  const assets=normalizeAssets(effectiveAssets);
  for(const asset of assets)mkdirSync(asset.sourceDir,{recursive:true});
  const list = () => readdirSync(resolvedBackupDir).filter((name) => name.endsWith('.json')).map((name) => ({ name, filePath: path.join(resolvedBackupDir, name), size: statSync(path.join(resolvedBackupDir, name)).size, modifiedAt: statSync(path.join(resolvedBackupDir, name)).mtime.toISOString() })).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  const removeSnapshot=(filePath)=>{try{unlinkSync(filePath);}catch{}try{rmSync(assetRoot(filePath),{recursive:true,force:true});}catch{}};
  const prune = () => { for (const item of list().slice(maxBackups)) removeSnapshot(item.filePath); };
  const snapshotAssets=(filePath)=>{
    if(!assets.length)return;
    const root=assetRoot(filePath),tmp=`${root}.tmp`;rmSync(tmp,{recursive:true,force:true});rmSync(root,{recursive:true,force:true});mkdirSync(tmp,{recursive:true});
    try{for(const asset of assets){const destination=path.join(tmp,asset.name);if(existsSync(asset.sourceDir))cpSync(asset.sourceDir,destination,{recursive:true});else mkdirSync(destination,{recursive:true});}renameSync(tmp,root);}catch(error){rmSync(tmp,{recursive:true,force:true});rmSync(root,{recursive:true,force:true});throw error;}
  };
  const restoreAssets=(filePath)=>{
    const root=assetRoot(filePath);if(!existsSync(root))return;
    for(const asset of assets){const source=path.join(root,asset.name);if(!existsSync(source))continue;rmSync(asset.sourceDir,{recursive:true,force:true});mkdirSync(path.dirname(asset.sourceDir),{recursive:true});cpSync(source,asset.sourceDir,{recursive:true});}
  };
  const validateCurrentDocumentAssets=(payload)=>{
    if(!assets.length||!Array.isArray(payload.state.documents))return;
    const documentsAsset=assets.find((item)=>item.name==='documents');if(!documentsAsset)return;
    const missing=payload.state.documents.filter((doc)=>!doc.deletedAt).filter((doc)=>doc.storageName&&!existsSync(path.join(documentsAsset.sourceDir,path.basename(doc.storageName))));
    if(missing.length)throw new DomainError('DOCUMENT_ASSETS_REQUIRED','backup metadata references document files that are not available',{documentIds:missing.map((doc)=>doc.id)});
  };
  return {
    create(reason = 'manual') {
      const createdAt = now().toISOString();
      const payload = { schemaVersion: SCHEMA_VERSION, id: idFactory(), createdAt, reason, state: repository.exportState() };
      const filePath = uniqueBackupPath(resolvedBackupDir,createdAt,payload.id);
      const tmp = `${filePath}.tmp`;
      try{writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');snapshotAssets(filePath);renameSync(tmp, filePath);}catch(error){try{unlinkSync(tmp);}catch{}removeSnapshot(filePath);throw error;}
      prune();
      return { ...payload, state: undefined, filePath, name: path.basename(filePath) };
    },
    list,
    restore(filePath) {
      const resolved = path.resolve(filePath); const base = resolvedBackupDir;
      if (!resolved.startsWith(`${base}${path.sep}`)) throw new DomainError('INVALID_BACKUP_PATH', 'backup must be inside configured backup directory');
      const payload = validatePayload(JSON.parse(readFileSync(resolved, 'utf8')));
      const before=repository.exportState();const safety = this.create('pre-restore');
      try{repository.replaceState(payload.state);restoreAssets(resolved);return { restoredFrom: resolved, safetyBackup: safety.filePath, createdAt: payload.createdAt };}
      catch(error){repository.replaceState(before);try{restoreAssets(safety.filePath);}catch{}throw error;}
    },
    exportPayload() { return { schemaVersion: SCHEMA_VERSION, createdAt: now().toISOString(), reason: 'export', state: repository.exportState() }; },
    importPayload(payload) { validatePayload(payload);validateCurrentDocumentAssets(payload);const before=repository.exportState();const safety = this.create('pre-import');try{repository.replaceState(payload.state);return { safetyBackup: safety.filePath };}catch(error){repository.replaceState(before);throw error;} },
    startAutomatic({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
      if (!Number.isFinite(intervalMs) || intervalMs < 60_000) throw new RangeError('automatic backup interval must be at least 60 seconds');
      const timer = setInterval(() => { try { this.create('automatic'); } catch {} }, intervalMs); timer.unref?.(); return () => clearInterval(timer);
    }
  };
}
