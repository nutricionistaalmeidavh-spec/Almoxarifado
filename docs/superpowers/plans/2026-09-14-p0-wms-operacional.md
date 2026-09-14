# P0 WMS Operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o Almoxarifado para WMS leve local-first com SQLite, endereçamento, recebimento parcial, FIFO/FEFO, inventário cíclico e operação móvel por leitura.

**Architecture:** Preservar os serviços e APIs atuais e acrescentar uma camada WMS isolada. SQLite substitui o arquivo JSON como persistência primária, importando o JSON legado uma única vez. Endereços e posições são novos conceitos sem quebrar saldos consolidados por depósito.

**Tech Stack:** Node.js >=22, `node:sqlite`, Electron, PWA vanilla JS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-p0-wms-operacional-design.md`

## Global Constraints
- Core R$ 0, self-hosted e open source; nenhum serviço pago obrigatório.
- Compatibilidade com Windows x64 e runtime Electron atual.
- Não remover APIs/fluxos existentes.
- Dados legados devem migrar automaticamente e o JSON anterior deve ser preservado.
- Sem GitHub Actions nesta entrega.

---

### Task 1: Persistência SQLite e migração
**Files:**
- Create: `tests/sqlite-repository.test.mjs`
- Create: `src/domain/stock/sqlite-repository.mjs`
- Modify: `src/platform/desktop-runtime.mjs`

**Interfaces:**
- Produces: `createSqliteStockRepository({dbPath, legacyJsonPath, seed})` com a mesma API do repository atual.

- [ ] Escrever teste que cria banco temporário, persiste produto/saldo/movimento, reabre e confirma os dados.
- [ ] Escrever teste de migração de JSON legado e criação de `.migrated.bak`.
- [ ] Executar testes e confirmar falha pela ausência do repository SQLite.
- [ ] Implementar schema, CRUD compatível, transações e migração.
- [ ] Alterar runtime para preferir `.data/almoxarifado.sqlite` e manter fallback de migração.
- [ ] Executar testes SQLite e regressão de repository.

### Task 2: Endereçamento físico e posições
**Files:**
- Create: `tests/wms-locations.test.mjs`
- Create: `src/domain/wms/wms-service.mjs`
- Modify: `src/domain/stock/repository.mjs`
- Modify: `src/domain/stock/sqlite-repository.mjs`
- Modify: `src/domain/stock/stock-service.mjs`
- Modify: `src/domain/catalog/catalog-service.mjs`

**Interfaces:**
- Produces: `saveLocation`, `listLocations`, `getLocation`, `getStockPosition`, `saveStockPosition`, `listStockPositions`.
- Produces WMS methods `createLocation`, `locationPath`, `resolveScan`.

- [ ] Testar hierarquia depósito > zona > corredor > estante > nível > posição e código único por depósito.
- [ ] Testar posição por produto/endereço/lote/serial e atualização em entrada/saída com `locationId`.
- [ ] Executar testes em RED.
- [ ] Implementar collections e validações.
- [ ] Integrar atualização de posição ao estoque mantendo saldo consolidado.
- [ ] Executar testes novos e regressão de estoque.

### Task 3: Recebimento parcial
**Files:**
- Create: `tests/purchasing-partial-receipt.test.mjs`
- Modify: `src/domain/purchasing/purchasing-service.mjs`

**Interfaces:**
- `receiveOrder({orderId,userId,items?})`; cada item pode conter `productId`, `quantity`, `acceptedQuantity`, `rejectedQuantity`, `damagedQuantity`, `locationId`, `lotId`, `serialId`.

- [ ] Testar recebimento parcial mantendo `PARTIALLY_RECEIVED` e saldo pendente.
- [ ] Testar segunda entrega concluindo pedido.
- [ ] Testar rejeitado/avariado sem entrada no estoque.
- [ ] Executar em RED.
- [ ] Implementar acumuladores por linha e compatibilidade sem `items`.
- [ ] Executar testes de compras existentes e novos.

### Task 4: FIFO/FEFO
**Files:**
- Extend: `tests/wms-locations.test.mjs`
- Modify: `src/domain/catalog/catalog-service.mjs`
- Modify: `src/domain/wms/wms-service.mjs`

**Interfaces:**
- Produto ganha `removalStrategy: MANUAL|FIFO|FEFO`.
- Produces: `recommendPick({productId,warehouseId,quantity})`.

- [ ] Testar FEFO priorizando menor validade e ignorando posição sem saldo.
- [ ] Testar FIFO por `receivedAt/createdAt`.
- [ ] Executar em RED.
- [ ] Implementar estratégia e recomendação sem movimentar estoque automaticamente.
- [ ] Executar testes.

### Task 5: Inventário cíclico
**Files:**
- Create: `tests/cycle-count.test.mjs`
- Modify: `src/domain/stock/repository.mjs`
- Modify: `src/domain/stock/sqlite-repository.mjs`
- Modify: `src/domain/wms/wms-service.mjs`

**Interfaces:**
- Produces: `startCycleCount`, `listCycleCountLines`, `countCycleLine`, `recountCycleLine`, `closeCycleCount`.

- [ ] Testar sessão por localização com resposta cega (sem expected na listagem operacional).
- [ ] Testar divergência exigindo recontagem.
- [ ] Testar fechamento gerando ajuste e mantendo auditoria.
- [ ] Executar em RED.
- [ ] Implementar sessão/linhas e fechamento transacional.
- [ ] Executar testes.

### Task 6: API e PWA móvel
**Files:**
- Create: `tests/wms-api.test.mjs`
- Modify: `src/platform/local-api-extensions.mjs`
- Modify: `src/platform/desktop-runtime.mjs`
- Modify: `apps/web/index.html`
- Modify: `apps/web/features-16-20.js`
- Modify: `apps/web/styles.css`

**Interfaces:**
- Endpoints locais para locais/scan/pick/cycle counts e recebimento parcial.
- Nova view `wms-mobile` com fluxo endereço -> produto -> quantidade -> ação.

- [ ] Testar autorização e payload dos endpoints WMS.
- [ ] Executar em RED.
- [ ] Expor serviços no runtime/API.
- [ ] Adicionar tela PWA responsiva sem dependência externa.
- [ ] Executar testes API/UI existentes e novos.

### Task 7: Documentação e verificação
**Files:**
- Modify: `README.md`
- Modify: `docs/MANUAL-INSTALACAO.md`
- Modify: `package.json`

- [ ] Atualizar documentação para SQLite, endereçamento, ciclo, FEFO/FIFO e operação móvel.
- [ ] Incluir novos arquivos em `npm run check`.
- [ ] Rodar `npm test` completo.
- [ ] Rodar `npm run check`, `npm run qa:validate` e `npm run security`.
- [ ] Comparar branch contra `main` e revisar escopo antes de merge.
