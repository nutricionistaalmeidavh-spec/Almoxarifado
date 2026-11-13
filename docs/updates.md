# Atualização do instalador Windows (opcional e gratuita)

O ArtiSys Almoxarifado continua local-first. Ao abrir uma instalação **empacotada no Windows**, o Electron verifica em segundo plano se existe uma versão superior, sem bloquear a abertura do sistema. PWA e clientes conectados pela LAN não baixam nem executam instaladores.

- Só exibe aviso se houver versão maior, instalador HTTPS válido, SHA-256 e tamanho.
- O usuário pode optar por **Baixar e instalar** ou **Agora não**.
- O download é validado por tamanho e SHA-256 antes de abrir o instalador NSIS. A aplicação fecha somente após abrir o instalador.
- Falha de conexão, repositório inacessível ou metadados incorretos não impedem o uso normal.
- Os dados do SQLite permanecem separados dos arquivos do aplicativo e a configuração NSIS preserva dados em atualizações e desinstalações normais.
- Nenhum token de GitHub ou serviço pago é utilizado.

## Publicar versões para os clientes

**Importante:** o repositório atual `nutricionistaalmeidavh-spec/Almoxarifado` é privado. A API pública do GitHub retorna 404 para clientes sem autenticação. Portanto, **o fluxo de atualização não fica operacional nos computadores dos clientes até disponibilizar um feed HTTPS público com o instalador** (sem disponibilizar o repositório-fonte). Nunca embuta um token privado no aplicativo.

Opção A: disponibilizar somente o instalador em uma GitHub Release de um **repositório público dedicado a binários** e configurar a URL da API `https://api.github.com/repos/ORGANIZACAO/REPOSITORIO-BINARIOS/releases/latest`. O release precisa ter um arquivo `ArtiSys-Almoxarifado-Setup-X.Y.Z.exe` e seu SHA-256 no campo `digest` ou o `release-manifest.json` gerado pela rotina existente.

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

Também é possível definir `ARTISYS_ALMOX_UPDATE_URL` no ambiente do processo antes de abrir o aplicativo; essa variável tem preferência sobre o arquivo local. Caso nenhuma fonte seja configurada, o aplicativo tenta a API do repositório original: ela permanecerá inacessível enquanto o repositório for privado.

Ao lançar a próxima versão, **incremente `version` no `package.json`** e gere o instalador correspondente. Esta PR apenas adiciona o atualizador; não publica binários, nem muda a versão comercial existente, nem move dados do usuário.
