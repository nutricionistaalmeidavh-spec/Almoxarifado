export function createPlatformConfig({ dataDir, port = 8090 } = {}) {
  if (typeof dataDir !== 'string' || dataDir.trim() === '') {
    throw new TypeError('dataDir is required');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('port is invalid');
  }
  return {
    desktop: {
      appId: 'br.com.artisys.almoxarifado',
      userDataDir: dataDir,
      deepLinkSchemes: ['artisys-almoxarifado'],
      telemetry: false
    },
    backend: {
      dataDir,
      host: '0.0.0.0',
      port,
      allowRemote: true,
      collections: []
    },
    web: {
      localOnly: true,
      installable: true,
      backendPort: port
    }
  };
}
