import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.mjs';

export const ROLE_PERMISSIONS = Object.freeze({
  ADMIN: ['*'],
  ALMOXARIFE: ['catalog.view','catalog.manage','stock.view','stock.create','stock.adjust','stock.transfer','inventory.view','inventory.create','inventory.count','inventory.close','reports.export','advanced-stock.manage','documents.view','documents.manage','ocr.run','analytics.view','hardware.use','assets.view','assets.manage','quality.view','quality.manage','custom-fields.view','custom-fields.manage','maintenance.view','maintenance.manage','kits.view','kits.manage','nfe.view','nfe.manage'],
  COMPRAS: ['catalog.view','stock.view','reports.export','purchases.view','purchases.create','purchases.quote','purchases.order','purchases.receive','costs.view','replenishment.view','documents.view','documents.manage','ocr.run','analytics.view','assets.view','quality.view','quality.manage','custom-fields.view','approvals.view','approvals.request','suppliers.kpi.view','maintenance.view','kits.view','nfe.view','nfe.manage'],
  GESTOR: ['catalog.view','stock.view','inventory.view','reports.export','purchases.view','purchases.approve','costs.view','replenishment.view','management.view','management.manage','documents.view','analytics.view','hardware.use','assets.view','assets.manage','quality.view','quality.manage','custom-fields.view','custom-fields.manage','approvals.view','approvals.manage','approvals.approve','suppliers.kpi.view','maintenance.view','maintenance.manage','kits.view','kits.manage','nfe.view'],
  LEITURA: ['catalog.view','stock.view','inventory.view','reports.export','purchases.view','costs.view','management.view','documents.view','analytics.view','assets.view','quality.view','custom-fields.view','approvals.view','suppliers.kpi.view','maintenance.view','kits.view','nfe.view']
});

function normalizeLogin(value) { return String(value ?? '').trim().toLowerCase(); }
function derive(password, salt) { return scryptSync(password, salt, 64).toString('hex'); }
function safeEqualHex(a, b) {
  try { const aa = Buffer.from(a, 'hex'); const bb = Buffer.from(b, 'hex'); return aa.length === bb.length && timingSafeEqual(aa, bb); } catch { return false; }
}
function publicUser(user) { if (!user) return null; const { passwordHash, passwordSalt, ...safe } = user; return safe; }

export function permissionsForRole(role) { return [...(ROLE_PERMISSIONS[role] ?? [])]; }
export function hasPermission(user, permission) {
  if (!user || user.active === false) return false;
  const permissions = ROLE_PERMISSIONS[user.role] ?? [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function createAuthService({ repository, now = () => Date.now(), tokenFactory = () => randomBytes(32).toString('hex'), sessionTtlMs = 12 * 60 * 60 * 1000, idFactory = randomUUID } = {}) {
  if (!repository || typeof repository.getUserByLogin !== 'function') throw new TypeError('repository with users is required');
  const sessions = new Map();
  const failures = new Map();
  const clean = () => { const t = now(); for (const [token, session] of sessions) if (session.expiresAt <= t) sessions.delete(token); };
  const requireSession = (token) => {
    clean();
    const session = sessions.get(token);
    if (!session) throw new DomainError('AUTH_REQUIRED', 'authentication required');
    const user = repository.getUser(session.userId);
    if (!user || user.active === false) { sessions.delete(token); throw new DomainError('AUTH_REQUIRED', 'authentication required'); }
    return user;
  };

  return {
    needsBootstrap() {
      const admin = repository.getUser('local-admin') ?? repository.listUsers().find((user) => user.role === 'ADMIN');
      return !admin?.passwordHash;
    },
    bootstrapAdmin(password) {
      if (!this.needsBootstrap()) throw new DomainError('AUTH_ALREADY_BOOTSTRAPPED', 'administrator password is already configured');
      if (typeof password !== 'string' || password.length < 10) throw new DomainError('WEAK_PASSWORD', 'password must contain at least 10 characters');
      const admin = repository.getUser('local-admin') ?? repository.listUsers().find((user) => user.role === 'ADMIN');
      if (!admin) throw new DomainError('ADMIN_NOT_FOUND', 'local administrator not found');
      const passwordSalt = randomBytes(16).toString('hex');
      const saved = repository.saveUser({ ...admin, login: normalizeLogin(admin.login || 'admin'), passwordSalt, passwordHash: derive(password, passwordSalt), active: true });
      return publicUser(saved);
    },
    authenticate(login, password) {
      const key = normalizeLogin(login);
      const meta = failures.get(key);
      if (meta?.blockedUntil > now()) throw new DomainError('AUTH_THROTTLED', 'too many failed attempts; try again later');
      const user = repository.getUserByLogin(key);
      const valid = user?.active !== false && user?.passwordHash && typeof password === 'string' && safeEqualHex(derive(password, user.passwordSalt), user.passwordHash);
      if (!valid) {
        const count = (meta?.count ?? 0) + 1;
        failures.set(key, { count, blockedUntil: count >= 5 ? now() + 60_000 : 0 });
        throw new DomainError('INVALID_CREDENTIALS', 'invalid login or password');
      }
      failures.delete(key);
      const token = tokenFactory();
      const expiresAt = now() + sessionTtlMs;
      sessions.set(token, { userId: user.id, expiresAt });
      return { token, expiresAt, user: publicUser(user), permissions: permissionsForRole(user.role) };
    },
    logout(token) { sessions.delete(token); },
    session(token) { const user = requireSession(token); return { user: publicUser(user), permissions: permissionsForRole(user.role) }; },
    require(token, permission) {
      const user = requireSession(token);
      if (!hasPermission(user, permission)) throw new DomainError('FORBIDDEN', 'permission denied', { permission });
      return user;
    },
    createUser(actorToken, input) {
      this.require(actorToken, 'users.manage');
      const login = normalizeLogin(input.login);
      if (!login) throw new DomainError('INVALID_INPUT', 'login is required');
      if (repository.getUserByLogin(login)) throw new DomainError('LOGIN_EXISTS', 'login already exists');
      if (!ROLE_PERMISSIONS[input.role]) throw new DomainError('INVALID_ROLE', 'invalid role');
      if (typeof input.password !== 'string' || input.password.length < 10) throw new DomainError('WEAK_PASSWORD', 'password must contain at least 10 characters');
      const passwordSalt = randomBytes(16).toString('hex');
      return publicUser(repository.saveUser({ id: idFactory(), name: String(input.name ?? '').trim(), login, role: input.role, active: true, passwordSalt, passwordHash: derive(input.password, passwordSalt) }));
    },
    publicUser
  };
}
