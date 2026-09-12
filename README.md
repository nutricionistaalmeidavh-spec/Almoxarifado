# ArtiSys Almoxarifado

MVP local-first de almoxarifado: Desktop Windows como host principal, backend local e PWA acessível por celular/tablet na mesma rede LAN, sem internet obrigatória.

## Entregas implementadas

### 01 — Base do produto
- Node 22+.
- Configuração Desktop (`br.com.artisys.almoxarifado`).
- Backend local preparado via PocketBase/`@artisys/local-backend`.
- Bind LAN explícito (`0.0.0.0`) com `allowRemote: true`.
- Shell PWA instalável e servidor HTTP local sem dependência cloud.

### 02 — Utilidades ArtiSys
Runtime:
- `@artisys/desktop-shell`
- `@artisys/local-backend`
- `@artisys/eventbus`
- `@artisys/dashboard`
- `@artisys/capture`
- `@artisys/pdf`
- `@artisys/printing`

Desenvolvimento/release, sem entrar no runtime do cliente:
- `artisys-qa`
- `artisys-security`
- `@artisys/release`

### 03 — Modelagem do banco
Coleções locais definidas para:
- categorias e fornecedores;
- depósitos e usuários;
- produtos;
- saldos e movimentações;
- sessões e contagens de inventário.

O schema é entregue a `backend.collections`, mantendo a infraestrutura local-first.

### 04 — Motor de estoque
- entrada;
- saída com bloqueio de saldo negativo;
- ajuste de saldo físico;
- transferência atômica entre depósitos;
- movimentos auditáveis;
- eventos `stock.*` preparados para o EventBus.

### 05 — Inventário
- snapshot do saldo esperado;
- contagem e divergência;
- recontagem;
- bloqueio de movimentações no depósito enquanto o inventário está aberto;
- fechamento somente com todos os itens contados;
- divergências convertidas em ajustes auditáveis;
- eventos `inventory.*`.

O repositório `utilidades` é consumido como submodule em `vendor/utilidades`, fixado em commit revisado. Não são copiadas implementações upstream para este produto.

## Preparação

```bash
git submodule update --init --recursive
npm install
npm run artisys:verify
npm test
```

## PWA local

```bash
npm run dev:web
```

Por padrão escuta em `0.0.0.0:4173`, permitindo acesso por outro dispositivo na mesma LAN usando o IP do PC principal. Os dados do produto permanecem no host local.

## QA e segurança

Os gates são explícitos e não rodam a cada alteração local:

```bash
npm run qa:validate
npm run security
npm run release:check
```

A execução completa de QA/segurança/CI deve ser reservada aos checkpoints de entrega/release.

## Próxima entrega

Etapa 06: interface do produto — dashboard, cadastros, movimentações, inventário e relatórios.
