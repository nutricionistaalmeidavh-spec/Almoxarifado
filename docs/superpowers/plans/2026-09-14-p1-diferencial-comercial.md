# P1 Diferencial Comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar os seis diferenciais comerciais do P1 preservando o WMS P0 e o modo local-first.

**Architecture:** Novos serviços de domínio pequenos e independentes, persistidos pelas coleções existentes do repository/SQLite. API LAN agrega esses serviços e a PWA recebe uma superfície P1 isolada, sem reescrever o shell principal.

**Tech Stack:** Node.js 22+, ESM, `node:test`, `node:sqlite`, PWA vanilla JS, Electron 43.

**Spec:** `docs/superpowers/specs/2026-09-14-p1-diferencial-comercial-design.md`

## Global Constraints
- Core R$ 0 / self-hosted / open source.
- Nenhuma dependência SaaS obrigatória.
- Preservar APIs/fluxos P0 e dados legados.
- Test-first para todo comportamento novo.
- Sem depender de GitHub Actions para implementação.

---

### Task 1: Persistência e schema P1
**Files:** `src/domain/stock/repository.mjs`, `src/domain/stock/schema.mjs`, `src/domain/stock/sqlite-repository.mjs`, `tests/p1-schema-repository.test.mjs`.
**Interfaces:** novas coleções `assets`, `assetCheckouts`, `assetMaintenance`, `productSuppliers`, `unitConversions`, `qualityHolds`, `alertEvents`.
- [ ] Criar teste RED cobrindo export/replace e SQLite reopen das novas coleções.
- [ ] Adicionar getters/listers/savers seguindo o padrão do repository.
- [ ] Atualizar schema declarativo.
- [ ] Rodar teste GREEN e regressão do repository.

### Task 2: Ferramentas e patrimônio
**Files:** `src/domain/assets/asset-service.mjs`, `tests/assets.test.mjs`.
**Interfaces:** `createAssetService({repository,now,idFactory})`; `saveAsset`, `checkout`, `checkin`, `startMaintenance`, `finishMaintenance`, `history`.
- [ ] RED: impedir dupla retirada e registrar responsável/obra/previsão/condição.
- [ ] GREEN: implementar cadastro, retirada/devolução e manutenção auditável.
- [ ] RED/GREEN: perda e histórico cronológico.

### Task 3: Fornecedores N:N e unidades
**Files:** `src/domain/supply/supply-service.mjs`, `tests/supply.test.mjs`, `src/domain/catalog/catalog-service.mjs`.
**Interfaces:** `linkSupplier`, `setPreferredSupplier`, `saveUnitConversion`, `toBaseQuantity`, `resolveBarcode`.
- [ ] RED: vários fornecedores e somente um preferencial por produto.
- [ ] GREEN: persistir preço, lead time, MOQ, SKU fornecedor e embalagem.
- [ ] RED/GREEN: conversão UOM e barcode por unidade.

### Task 4: Qualidade/quarentena
**Files:** `src/domain/quality/quality-service.mjs`, `tests/quality.test.mjs`.
**Interfaces:** `holdReceipt`, `release`, `reject`, `quarantinedQuantity`.
- [ ] RED: item em inspeção não aumenta saldo disponível.
- [ ] GREEN: criar hold de qualidade.
- [ ] RED/GREEN: liberar gera ENTRY; rejeitar fecha hold sem entrada; auditoria preservada.

### Task 5: Reposição avançada e alertas
**Files:** `src/domain/costs/cost-service.mjs`, `src/domain/alerts/alert-service.mjs`, `tests/replenishment-alerts.test.mjs`.
**Interfaces:** `advancedReplenishmentSuggestions`, `createAlertService().list()`.
- [ ] RED: consumo médio, lead time, estoque de segurança, cobertura e fornecedor preferencial.
- [ ] GREEN: derivar métricas dos movimentos/histórico já persistidos.
- [ ] RED/GREEN: alertas de baixo estoque/ruptura, validade, pedido atrasado, ferramenta vencida, inventário vencido e backup.

### Task 6: API, permissões e PWA P1
**Files:** `src/platform/local-api.mjs`, `src/domain/auth/auth-service.mjs`, `src/domain/index.mjs`, `apps/web/p1.js`, `apps/web/p1.css`, `apps/web/ui-v2.js`, `apps/web/sw.js`, `tests/p1-api-ui.test.mjs`.
**Interfaces:** rotas `/api/assets/*`, `/api/supply/*`, `/api/quality/*`, `/api/replenishment/advanced`, `/api/alerts`.
- [ ] RED: API autenticada e superfície PWA esperada.
- [ ] GREEN: integrar serviços e permissões.
- [ ] GREEN: criar view P1 responsiva com patrimônio, fornecedores/unidades, qualidade, reposição e alertas.

### Task 7: Documentação e fechamento
**Files:** `README.md`, `docs/MANUAL-INSTALACAO.md`, `package.json` se necessário.
- [ ] Documentar P1, dados e operação.
- [ ] Revisar diff contra `main` para escopo e compatibilidade.
- [ ] Rodar verificações disponíveis, abrir PR e mergear somente após mergeable=true.
