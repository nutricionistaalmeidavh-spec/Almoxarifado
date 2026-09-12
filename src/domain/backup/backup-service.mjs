import { mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
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

export function createBackupService({ repository, backupDir, now = () => new Date(), idFactory = randomUUID, maxBackups = 30 } = {}) {
  if (!repository?.exportState || !repository?.replaceState) throw new TypeError('repository with exportState/replaceState is required');
  if (typeof backupDir !== 'string' || !backupDir.trim()) throw new TypeError('backupDir is required');
  mkdirSync(backupDir, { recursive: true });
  const list = () => readdirSync(backupDir).filter((name) => name.endsWith('.json')).map((name) => ({ name, filePath: path.join(backupDir, name), size: statSync(path.join(backupDir, name)).size, modifiedAt: statSync(path.join(backupDir, name)).mtime.toISOString() })).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  const prune = () => { for (const item of list().slice(maxBackups)) { try { unlinkSync(item.filePath); } catch {} } };
  return {
    create(reason = 'manual') {
      const createdAt = now().toISOString();
      const payload = { schemaVersion: SCHEMA_VERSION, id: idFactory(), createdAt, reason, state: repository.exportState() };
      const filePath = path.join(backupDir, `almoxarifado-${stamp(new Date(createdAt))}-${payload.id}.json`);
      const tmp = `${filePath}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      renameSync(tmp, filePath); prune();
      return { ...payload, state: undefined, filePath, name: path.basename(filePath) };
    },
    list,
    restore(filePath) {
      const resolved = path.resolve(filePath); const base = path.resolve(backupDir);
      if (!resolved.startsWith(`${base}${path.sep}`)) throw new DomainError('INVALID_BACKUP_PATH', 'backup must be inside configured backup directory');
      const payload = validatePayload(JSON.parse(readFileSync(resolved, 'utf8')));
      const safety = this.create('pre-restore'); repository.replaceState(payload.state);
      return { restoredFrom: resolved, safetyBackup: safety.filePath, createdAt: payload.createdAt };
    },
    exportPayload() { return { schemaVersion: SCHEMA_VERSION, createdAt: now().toISOString(), reason: 'export', state: repository.exportState() }; },
    importPayload(payload) { validatePayload(payload); const safety = this.create('pre-import'); repository.replaceState(payload.state); return { safetyBackup: safety.filePath }; },
    startAutomatic({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
      if (!Number.isFinite(intervalMs) || intervalMs < 60_000) throw new RangeError('automatic backup interval must be at least 60 seconds');
      const timer = setInterval(() => { try { this.create('automatic'); } catch {} }, intervalMs); timer.unref?.(); return () => clearInterval(timer);
    }
  };
}
