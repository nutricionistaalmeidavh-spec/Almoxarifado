export const ARTISYS_MODULES = Object.freeze({
  desktopShell: { package: '@artisys/desktop-shell', runtime: true },
  localBackend: { package: '@artisys/local-backend', runtime: true },
  eventbus: { package: '@artisys/eventbus', runtime: true },
  dashboard: { package: '@artisys/dashboard', runtime: true },
  capture: { package: '@artisys/capture', runtime: true },
  pdf: { package: '@artisys/pdf', runtime: true },
  printing: { package: '@artisys/printing', runtime: true },
  qa: { package: '@artisys/qa', runtime: false, ciOnly: true },
  security: { path: 'vendor/utilidades/modules/artisys-security/security.py', runtime: false, ciOnly: true },
  release: { package: '@artisys/release', runtime: false, ciOnly: true }
});

export async function loadArtisysModule(name, importer = (specifier) => import(specifier)) {
  const entry = ARTISYS_MODULES[name];
  if (!entry) throw new TypeError(`unknown ArtiSys module: ${name}`);
  if (entry.ciOnly || !entry.runtime) throw new Error(`${name} is CI-only and must not be imported into runtime`);
  return importer(entry.package);
}
