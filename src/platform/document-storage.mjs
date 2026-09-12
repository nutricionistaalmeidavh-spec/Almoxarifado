import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DomainError } from '../domain/shared/domain-error.mjs';

function resolveInside(rootDir, storageName) {
  if (typeof storageName !== 'string' || storageName.trim() === '') throw new DomainError('INVALID_DOCUMENT','invalid storage name');
  const root=path.resolve(rootDir);
  const file=path.resolve(root,storageName);
  if (file===root || !file.startsWith(`${root}${path.sep}`)) throw new DomainError('INVALID_DOCUMENT','invalid storage path');
  return file;
}

export function createDocumentStorage({rootDir,maxFileSize=15*1024*1024}={}) {
  if(typeof rootDir!=='string'||!rootDir.trim()) throw new TypeError('rootDir is required');
  if(!Number.isInteger(maxFileSize)||maxFileSize<=0) throw new RangeError('maxFileSize must be a positive integer');
  const root=path.resolve(rootDir);
  return {
    rootDir:root,
    maxFileSize,
    async write({id,bytes}) {
      const body=Buffer.from(bytes??[]);
      if(body.length>maxFileSize) throw new DomainError('DOCUMENT_TOO_LARGE',`document exceeds ${maxFileSize} bytes`,{maxFileSize,size:body.length});
      const safeId=String(id??'').trim();
      if(!/^[A-Za-z0-9._-]+$/.test(safeId)) throw new DomainError('INVALID_DOCUMENT','invalid document id');
      const storageName=`${safeId}.bin`;
      const file=resolveInside(root,storageName);
      await mkdir(root,{recursive:true});
      try { await writeFile(file,body,{flag:'wx'}); }
      catch(error){ if(error?.code==='EEXIST') throw new DomainError('DOCUMENT_STORAGE_CONFLICT','document storage id already exists',{storageName}); throw error; }
      return {storageName,size:body.length,sha256:createHash('sha256').update(body).digest('hex')};
    },
    async read(storageName) { return readFile(resolveInside(root,storageName)); },
    async remove(storageName) {
      try { await unlink(resolveInside(root,storageName)); }
      catch(error){ if(error?.code!=='ENOENT') throw error; }
    },
    resolve(storageName){ return resolveInside(root,storageName); }
  };
}
