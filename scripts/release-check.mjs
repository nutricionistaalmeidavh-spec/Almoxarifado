import { createReleasePlan } from '@artisys/release';

const plan = createReleasePlan({
  product: 'ArtiSys Almoxarifado',
  version: process.env.npm_package_version || '0.1.0',
  artifacts: [],
  checks: ['qa', 'security']
});

process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
