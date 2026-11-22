# Licença comercial opcional — ArtiSys Almoxarifado

## Edições

- **Livre:** núcleo R$ 0, open source, SQLite local, LAN/PWA e self-hosted. Não precisa de Cloudflare, conexão externa nem licença. O comando `npm run build:win` usa `apps/desktop/src/edition.json` com `commercialActivation: false`.
- **Comercial:** `npm run build:win:commercial` cria o instalador `ArtiSys-Almoxarifado-Setup-<versão>-Commercial.exe`, incorporando `commercialActivation: true` em seu próprio pacote. O script restaura o manifesto da edição livre ao terminar, inclusive se o build falhar. A marca é incorporada ao aplicativo; não depende de variáveis de ambiente definidas pelo cliente. O fluxo operacional não recebe outro serviço pago.

A versão comercial utiliza a **mesma Central de Licenças** do Oficina e PDV:
https://pdv-artisys.sistema-artisys.workers.dev/admin

Selecione **ArtiSys Almoxarifado**, e-mail do cliente e data de validade (em branco = vitalícia). A Central emite um código de **seis dígitos, uso único, válido por 48 horas**. O código expira separadamente da licença. Reativação após formatação utiliza a licença original na Central, sem cancelar ou criar nova licença.

## Contrato de ativação

- Produto isolado no Worker: `ALMOXARIFADO`. A Central não aceita um código de `OFICINA`, `PDV` ou outros produtos como licença de Almoxarifado.
- `POST /v1/activation/verify` com `{product:'ALMOXARIFADO',email,code,installationId}`; sempre por HTTPS.
- `GET /v1/license/status?product=ALMOXARIFADO&installationId=...`. Verifica remotamente no máximo a cada 15 minutos.
- A ID da instalação é persistida no perfil local do host e os dados operacionais **não** são enviados à Central.
- O host expõe `GET /api/license/status` e `POST /api/license/activate`. A ativação é autorizada **somente via loopback do computador principal**, nunca em tablets/PCs remotos na LAN.
- Sem licença ativa na edição comercial, a API de dados e cadastro do primeiro administrador responde `423 LICENSE_REQUIRED`. Após a ativação, o usuário cria a senha local do administrador.
- Falha de rede/5xx não bloqueia a licença previamente confirmada como ativa, dentro da validade registrada localmente. Ausência de ativação, expiração conhecida e revogação online confirmada bloqueiam o acesso. Revogação não é instantânea enquanto o host permanece totalmente offline.

**Separação de ambientes:** os clientes do core livre não dependem do Worker. Nunca incluir `ADMIN_TOKEN`, `ACTIVATION_PEPPER` ou credenciais no instalador ou no GitHub. Não modificar as licenças existentes da Central.

## Verificação antes de publicar

1. Rodar `npm test`, `npm run check` e `npm run security`.
2. Rodar testes de integração `tests/commercial-license.test.mjs` e `tests/commercial-license-api.test.mjs`.
3. Verificar que o `edition.json` do instalador comercial foi incorporado com `commercialActivation:true` e que a edição livre tem `false`.
4. Testar manualmente em Windows novo: primeira ativação, segundo acesso offline, código inválido/expirado, expiração da licença, suspensão e reinstalação. Nunca enviar um instalador sem QA em Windows.
5. Central Cloudflare: executar testes do `PDV-ARTISYS`; deploy somente pelo Worker já vinculado à conta correta, com D1 e secrets existentes preservados.

**Atualizações seguras por edição:** o atualizador da versão comercial só aceita artefatos `-Commercial.exe` e manifesto `release-manifest-commercial.json` quando necessário; se a release publicar apenas a edição livre, não oferece atualização comercial. A edição livre só aceita o instalador livre. Nunca cruzar as edições por atualização automática.

**Nota:** senha de administrador local e arquivos de estoque/SQLite não fazem parte do serviço de licenças.
