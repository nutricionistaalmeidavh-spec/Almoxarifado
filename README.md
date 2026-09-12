# ArtiSys Almoxarifado

Sistema local-first de almoxarifado. O PC Windows atua como host principal e serve a PWA/API para desktop, celular e tablet na mesma LAN. O núcleo não depende de cloud nem de serviço pago.

**Release final:** `1.0.0` — Windows x64 — `ArtiSys-Almoxarifado-Setup-1.0.0.exe`.

O produto é distribuído **sem sistema de licença**, chave, ativação, limite por máquina, assinatura obrigatória ou servidor de licença.

## Entregas implementadas

### 01–09 — Núcleo operacional
Base Desktop/PWA, utilidades ArtiSys, modelagem, motor de estoque, inventário, interface, persistência LAN, código de barras, relatórios, impressão e etiquetas.

### 10 — Autenticação e permissões
Primeiro acesso configura o administrador local; senhas com `scrypt` + salt; sessões; perfis `ADMIN`, `ALMOXARIFE`, `COMPRAS`, `GESTOR`, `LEITURA`; autorização server-side e auditoria.

### 11 — Backup e recuperação
Backup manual/automático, snapshot pré-restauração/importação, restauração validada, persistência atômica, anexos binários e retenção configurável.

### 12 — Compras e recebimento
Solicitação, cotação, aprovação, pedido, recebimento com entrada automática e histórico de custos.

### 13 — Centros de custo e obras
Centros de custo, obras/projetos, setores/departamentos, responsável pela retirada e vínculo auditável com movimentações.

### 14 — Estoque avançado
Reservas, físico × disponível, lote/validade, número de série, perdas, avarias, devoluções e transferências em trânsito com rastreabilidade.

### 15 — Custos e reposição
Custo médio, histórico de preços, estoque mínimo/alvo e sugestão de reposição considerando reservas.

### 16 — Documentos e anexos
Armazenamento local em `.data/documents/`, PDF/imagens/texto, limite padrão de 15 MB, SHA-256, vínculos operacionais, download e exclusão auditável.

### 17 — OCR local opcional
Adapter OCR local, resultado persistido/revisável e funcionamento manual preservado quando não houver engine OCR instalada.

### 18 — Relatórios avançados
Curva ABC, consumo, sem giro, perdas/avarias, valorização, histórico de custo, filtros operacionais e CSV.

### 19 — Hardware opcional
Serial/balança e impressão por transporte quando disponíveis; ausência de hardware não impede o funcionamento do almoxarifado. Impressão do navegador/Desktop permanece como fallback.

### 20 — Desktop final
Runtime central para base, API/PWA, documentos, backup, configurações, logs, hardware e OCR. Electron com `contextIsolation`, sandbox, `nodeIntegration: false` e bloqueio de janelas externas.

### 21 — Instalador e atualização
- Electron + NSIS para **Windows x64**.
- Artefato final: `ArtiSys-Almoxarifado-Setup-1.0.0.exe`.
- Instalação por usuário com atalhos.
- Runtime completo empacotado: o usuário não precisa instalar Node.js.
- Dados ficam separados da pasta de instalação.
- Reinstalação/upgrade não remove a base local.
- Desinstalação padrão não apaga os dados do usuário.

### 22 — QA automatizado final
- Suíte completa Node/API/UI.
- Smoke Playwright sobre a aplicação instalada.
- Bootstrap/login, criação de produto, entrada de estoque e dashboard.
- Reinstalação do mesmo `.exe` e verificação de persistência dos dados.
- GitHub Actions Linux + Windows usado somente no fechamento da release.

### 23 — Segurança e release
- Gate de sintaxe/testes.
- QA de configuração.
- Verificação de segredos e hardening Desktop.
- Auditoria de dependências no workflow.
- SHA-256 do instalador.
- `SHA256SUMS.txt` e `release-manifest.json` conferidos antes da distribuição.

### 24 — Distribuição final sem licença
- Instalador Windows final.
- Arquivos de integridade e manifesto.
- Manual de instalação/primeiro acesso.
- Pacote comercial **sem licença ou ativação** e sem demo bloqueada.

## Desenvolvimento

A fonte histórica de módulos reutilizáveis permanece pinada em `vendor/utilidades`. Para que o build final do repositório privado seja reproduzível sem credencial para um segundo repositório privado, os módulos efetivamente necessários ao runtime de distribuição também possuem snapshots mínimos pinados em `vendor/release-modules/`.

```bash
npm install
npm run dev:web
```

Para executar o host Electron em desenvolvimento:

```bash
npm run desktop
```

No primeiro acesso local, defina a senha do administrador com pelo menos 10 caracteres. Depois, dispositivos da mesma rede podem acessar `http://IP-DO-PC:4173`.

## Dados locais

```text
.data/
├── almoxarifado.json
├── documents/
├── backups/
├── logs/
└── settings.json
```

No instalador, o equivalente fica no diretório de dados do usuário do Windows, separado dos binários do programa.

## Verificação

```bash
npm test
npm run check
npm run qa:validate
npm run security
npm run release:check
```

O workflow `.github/workflows/release-final.yml` adiciona o gate Windows: build NSIS, instalação silenciosa, inicialização, `/api/health`, smoke funcional, reinstalação/persistência, hash e manifesto.

## Manual

Consulte `docs/MANUAL-INSTALACAO.md`.

> A validação automatizada da release comprova os fluxos de software cobertos pelo workflow. Homologação física de leitores, câmeras, impressoras, balanças e máquinas específicas de clientes não é alegada por esse gate.
