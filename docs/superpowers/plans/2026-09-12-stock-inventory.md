# Stock and Inventory MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a modelagem local, motor de estoque e inventário do MVP do Almoxarifado.

**Architecture:** Domínio independente de UI, com schema exportável ao backend local, serviços de negócio e repositório injetável. Estoque e inventário compartilham o mesmo contrato transacional para manter saldo e auditoria consistentes.

**Tech Stack:** Node.js 22+, ESM, `node:test`, módulos ArtiSys já integrados.

**Spec:** `docs/superpowers/specs/2026-09-12-stock-inventory-design.md`

## Global Constraints

- Core obrigatório com custo de licença/assinatura R$ 0.
- Operação normal local/self-hosted e sem internet obrigatória.
- Não adicionar serviço pago como dependência.
- Não rodar CI remoto em alterações intermediárias.

---

### Task 1: Modelagem do banco

**Files:** `src/domain/stock/schema.mjs`, `src/platform/config.mjs`, `tests/schema.test.mjs`

- [x] Escrever testes do schema e verificar falha sem implementação.
- [x] Criar as nove coleções do MVP e campos necessários.
- [x] Injetar o modelo em `backend.collections`.
- [x] Rodar os testes do schema.

### Task 2: Motor de estoque

**Files:** `src/domain/shared/domain-error.mjs`, `src/domain/stock/repository.mjs`, `src/domain/stock/stock-service.mjs`, `tests/stock-service.test.mjs`

- [x] Escrever testes de entrada, saída, ajuste e transferência.
- [x] Implementar repositório transacional de referência.
- [x] Impedir saldo negativo e transferências inválidas.
- [x] Registrar movimentos auditáveis e emitir eventos.
- [x] Rodar os testes do motor.

### Task 3: Inventário

**Files:** `src/domain/inventory/inventory-service.mjs`, `tests/inventory-service.test.mjs`

- [x] Escrever testes de snapshot, bloqueio, contagem, recontagem e fechamento.
- [x] Implementar bloqueio do depósito durante inventário aberto.
- [x] Aplicar divergências como ajustes auditáveis no fechamento.
- [x] Rejeitar inventário incompleto ou snapshot obsoleto.
- [x] Rodar testes da entrega.
