# Atualização do instalador Windows (opcional e gratuita)

O ArtiSys Almoxarifado continua local-first. Ao abrir uma instalação **empacotada no Windows**, o Electron verifica em segundo plano se existe uma versão superior, sem bloquear a abertura do sistema. PWA e clientes conectados pela LAN não baixam nem executam instaladores.

- Só exibe aviso se houver versão maior, instalador HTTPS válido, SHA-256 e tamanho.
- O usuário pode optar por **Baixar e instalar** ou **Agora não**.
- O download é validado por tamanho e SHA-256 antes de abrir o instalador NSIS. A aplicação fecha somente após abrir o instalador.
- Falha de conexão, repositório inacessível ou metadados incorretos não impedem o uso normal.
- Os dados do SQLite permanecem separados dos arquivos do aplicativo e a configuração NSIS preserva dados em atualizações e desinstalações normais.
- Nenhum token de GitHub ou serviço pago é utilizado.

## Publicar versões para os clientes

**Canal padrão:** o repositório `nutricionistaalmeidavh-spec/Almoxarifado` está público desde 13/11/2026. O aplicativo consulta automaticamente `https://api.github.com/repos/nutricionistaalmeidavh-spec/Almoxarifado/releases/latest`. Não há necessidade de configurar um serviço externo ou token privado.

**Release v1.0.1:** o workflow `.github/workflows/release-final.yml` publica `v1.0.1` após gates Linux, instalação/reinstalação Windows e verificação de integridade. A release inclui `ArtiSys-Almoxarifado-Setup-1.0.1.exe`, `SHA256SUMS.txt` e `release-manifest.json`.

**Opcional:** para usar um servidor HTTPS próprio ou outro repositório de binários, configure a fonte como explicado abaixo.

Opção B: publicar um arquivo JSON estático em **servidor próprio ou hospedagem gratuita HTTPS**, com estes campos (valores fictícios abaixo; substitua pelos dados reais):

```json
{
  "version": "1.0.1",
  "downloadUrl": "https://seu-servidor.example/downloads/ArtiSys-Almoxarifado-Setup-1.0.1.exe",
  "sha256": "COLOQUE_AQUI_O_SHA256_REAL_64_CARACTERES_HEXADECIMAIS",
  "size": 12345678,
  "notes": "Melhorias e correções."
}
```

Aponte o aplicativo instalado para o catálogo criando `update-source.json` na pasta de dados do Electron (`app.getPath('userData')`, normalmente no perfil AppData do Windows), com o conteúdo:

```json
{ "url": "https://seu-servidor.example/almoxarifado/latest.json" }
```

Também é possível definir `ARTISYS_ALMOX_UPDATE_URL` no ambiente do processo antes de abrir o aplicativo; essa variável tem preferência sobre o arquivo local. Caso nenhuma fonte seja configurada, o aplicativo utiliza automaticamente as releases públicas deste repositório.

Ao lançar a próxima versão, **incremente `version` no `package.json`** e gere o instalador correspondente. O workflow de release gera e publica o instalador, condicionado à aprovação dos testes. A instalação substitui os binários, preservando o banco local.
