import { createDesktopShellManifest } from '@artisys/desktop-shell';
import { buildPocketBasePlan } from '@artisys/local-backend';
import { buildRuntimePlan } from '../../../src/platform/runtime-plan.mjs';

export function createDesktopRuntime(dataDir, port = 8090) {
  return buildRuntimePlan({
    dataDir,
    port,
    desktopApi: { createDesktopShellManifest },
    backendApi: { buildPocketBasePlan }
  });
}
