import { createDesktopShellManifest } from '@artisys/desktop-shell';
import { createAlmoxarifadoDesktopRuntime } from '../../../src/platform/desktop-runtime.mjs';

export function createDesktopRuntime(dataDir, port = 4173, options = {}) {
  return createAlmoxarifadoDesktopRuntime({
    dataDir,
    host: options.host ?? '0.0.0.0',
    port,
    dependencies: {
      ...options.dependencies,
      desktopApi: options.dependencies?.desktopApi ?? { createDesktopShellManifest }
    }
  });
}

export { createAlmoxarifadoDesktopRuntime };
