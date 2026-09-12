import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ARTISYS_MODULES } from '../src/platform/integrations.mjs';

const root = process.cwd();
const required = Object.values(ARTISYS_MODULES).map((entry) => entry.path || `vendor/utilidades/modules/${entry.package.replace('@artisys/', 'artisys-')}/module.json`);
const missing = [];
for (const relative of required) {
  try { await access(path.join(root, relative)); } catch { missing.push(relative); }
}
if (missing.length) {
  console.error('Utilidades ausentes. Execute: git submodule update --init --recursive');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}
const gitmodules = await readFile(path.join(root, '.gitmodules'), 'utf8');
if (!gitmodules.includes('vendor/utilidades')) process.exit(1);
console.log('Integrações ArtiSys disponíveis no checkout.');
