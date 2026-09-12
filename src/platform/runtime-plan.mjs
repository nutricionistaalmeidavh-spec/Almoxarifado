import { createPlatformConfig } from './config.mjs';

export function buildRuntimePlan({ dataDir, port = 8090, desktopApi, backendApi } = {}) {
  if (typeof desktopApi?.createDesktopShellManifest !== 'function') {
    throw new TypeError('desktopApi.createDesktopShellManifest is required');
  }
  if (typeof backendApi?.buildPocketBasePlan !== 'function') {
    throw new TypeError('backendApi.buildPocketBasePlan is required');
  }
  const config = createPlatformConfig({ dataDir, port });
  return {
    desktop: desktopApi.createDesktopShellManifest(config.desktop),
    backend: backendApi.buildPocketBasePlan(config.backend),
    web: config.web
  };
}
