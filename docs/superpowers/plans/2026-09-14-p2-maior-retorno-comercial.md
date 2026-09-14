# P2 — Maior Retorno Comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os seis módulos P2 e integrá-los ao runtime/API/PWA local-first.

**Architecture:** Cada capacidade vive em serviço de domínio próprio e persiste pelas coleções genéricas do repositório/SQLite. A API P2 é encadeada após P1 e a PWA ganha uma tela isolada `P2 Gestão`, preservando os fluxos atuais.

**Tech Stack:** Node.js 22 ESM, node:sqlite, API HTTP local, PWA vanilla JS/CSS, node:test.

**Spec:** `docs/superpowers/specs/2026-09-14-p2-maior-retorno-comercial-design.md`

## Global Constraints
- Local-first e sem dependência SaaS obrigatória.
- Nenhuma nova dependência paga.
- XML de NF-e não baixa estoque sem confirmação explícita.
- Compatibilidade com P0/P1 e backups existentes.
- Desenvolvimento sem GitHub Actions.

---

### Task 1: RED — contratos P2
**Files:** Create `tests/p2-commercial.test.mjs`, `tests/p2-api-ui.test.mjs`, `tests/p2-schema-repository.test.mjs`.
- [ ] Criar testes para custom fields, aprovação por faixa, KPI, manutenção/calibração, kits e parser/apply NF-e.
- [ ] Criar testes estáticos das rotas e PWA.
- [ ] Confirmar RED por ausência dos novos módulos/rotas.

### Task 2: Persistência e schema
**Files:** Modify `src/domain/stock/repository.mjs`, `src/domain/stock/sqlite-repository.mjs`, `src/domain/stock/schema.mjs`.
- [ ] Adicionar coleções `customFieldDefinitions`, `customFieldValues`, `approvalRules`, `approvalInstances`, `maintenancePlans`, `calibrationRecords`, `kits`, `nfeImports`.
- [ ] Expor get/list/save e persistência SQLite via tabela `entities`.
- [ ] Garantir export/replace para backup.

### Task 3: Campos personalizados e aprovação
**Files:** Create `src/domain/custom-fields/custom-field-service.mjs`, `src/domain/approvals/approval-service.mjs`.
- [ ] Validar tipos/opções/obrigatoriedade.
- [ ] Implementar regras ordenadas por valor e instâncias auditáveis.
- [ ] Bloquear criação de pedido quando houver matriz aplicável ainda não aprovada.

### Task 4: KPI de fornecedor
**Files:** Create `src/domain/suppliers/supplier-kpi-service.mjs`.
- [ ] Calcular pontualidade, prazo, aceitação, rejeição/avaria, volume e valor.
- [ ] Expor resumo individual e ranking.

### Task 5: Manutenção/calibração
**Files:** Create `src/domain/maintenance/maintenance-service.mjs`.
- [ ] Criar planos recorrentes por ativo.
- [ ] Registrar execução/calibração e calcular próxima data.
- [ ] Expor vencidos/próximos.

### Task 6: Kits/BOM
**Files:** Create `src/domain/kits/kit-service.mjs`.
- [ ] Criar/editar BOM validado.
- [ ] Calcular disponibilidade máxima por depósito.
- [ ] Baixar componentes transacionalmente como `KIT_ISSUE`.

### Task 7: XML NF-e
**Files:** Create `src/domain/nfe/nfe-service.mjs`.
- [ ] Parsear XML localmente e extrair emitente, itens, totais e rastro.
- [ ] Fazer matching de fornecedor/produto.
- [ ] Aplicar cadastros e, com `commitStock:true`, lançar entrada, custo e lote.

### Task 8: API, permissões e exports
**Files:** Create `src/platform/p2-api-extensions.mjs`; modify `src/platform/local-api-extensions.mjs`, `src/domain/auth/auth-service.mjs`, `src/domain/index.mjs`, `src/domain/purchasing/purchasing-service.mjs`.
- [ ] Rotas autenticadas para todos os módulos.
- [ ] Permissões P2 por papel.
- [ ] Exportar serviços.

### Task 9: PWA
**Files:** Create `apps/web/p2.js`, `apps/web/p2.css`; modify `apps/web/ui-v2.js`, `apps/web/sw.js`.
- [ ] Criar `P2 Gestão` com seis painéis operacionais.
- [ ] Manter P1/WMS intactos.
- [ ] Cachear assets locais e manter `/api/` network-only.

### Task 10: Documentação e verificação
**Files:** Modify `README.md`, `docs/MANUAL-INSTALACAO.md`, `package.json`.
- [ ] Documentar P2 e operação.
- [ ] Adicionar checks de sintaxe.
- [ ] Executar validação local disponível e revisar diff contra main.
- [ ] Abrir PR e mergear somente se branch estiver 0 atrás e PR mergeável.
