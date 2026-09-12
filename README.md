# ArtiSys Almoxarifado

MVP local-first de almoxarifado: Desktop Windows como host principal, backend local e PWA acessível por celular/tablet na mesma rede LAN, sem internet obrigatória.

## Entregas implementadas

### 01 — Base do produto
- Node 22+.
- Configuração Desktop (`br.com.artisys.almoxarifado`).
- Backend local preparado via `@artisys/local-backend`.
- PWA instalável e servidor LAN.

### 02 — Utilidades ArtiSys
Runtime: Desktop Shell, Local Backend, EventBus, Dashboard, Capture, PDF e Printing. Desenvolvimento/release: QA, Security e Release.

### 03 — Modelagem do banco
Categorias, fornecedores, depósitos, usuários, produtos, saldos, movimentações, inventários e contagens.

### 04 — Motor de estoque
Entrada, saída, ajuste, transferência atômica, saldo não negativo, auditoria e eventos `stock.*`.

### 05 — Inventário
Snapshot, contagem, divergência, recontagem, bloqueio de depósito, fechamento e ajustes auditáveis.

### 06 — Interface operacional
- Dashboard responsivo.
- Cadastros de produtos, categorias, fornecedores e depósitos.
- Movimentações e histórico.
- Tela de inventário e contagem.
- Relatórios.
- Desktop, tablet e celular.

### 07 — Rede local e persistência
- PWA e API servidas pelo PC principal em `0.0.0.0`.
- Dados centralizados no host local.
- Persistência atômica em `.data/almoxarifado.json`.
- Desktop/celular/tablet compartilham o mesmo estoque pela LAN.
- Sem cloud obrigatória.

### 08 — Código de barras
- Leitor USB em modo teclado.
- Busca por código/SKU.
- Câmera de celular/tablet por captura de foto.
- Decodificação local com `html5-qrcode`; a imagem não sai da rede/dispositivo.

### 09 — Relatórios e impressão
- KPIs e posição de estoque.
- Histórico de movimentações.
- Exportação CSV compatível com Excel.
- Impressão e salvar como PDF pelo navegador.
- Impressão de etiquetas.

O repositório `utilidades` permanece consumido como submodule em `vendor/utilidades`, fixado em commit revisado.

## Preparação

```bash
git submodule update --init --recursive
npm install
npm run artisys:verify
npm test
```

## Executar localmente

```bash
npm run dev:web
```

Por padrão:
- interface/API: `http://0.0.0.0:4173`;
- dados: `.data/almoxarifado.json`.

Em outro aparelho da mesma rede, abra `http://IP-DO-PC:4173`.

## QA e segurança

```bash
npm run qa:validate
npm run security
npm run release:check
```

Os gates completos ficam reservados para checkpoints/release para não consumir CI desnecessariamente.

## Próxima entrega

Etapa 10: acabamento operacional — permissões/autenticação, backup/restauração e preparação do instalador.
