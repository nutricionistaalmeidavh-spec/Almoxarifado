# Almoxarifado Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação Desktop + backend local + PWA LAN e integrar os kits ArtiSys aprovados.

**Architecture:** Configuração centralizada em `src/platform`, PWA estática servida localmente e módulos ArtiSys consumidos do submodule `vendor/utilidades`. Gates de QA, segurança e release são explícitos e ficam fora do runtime.

**Tech Stack:** Node 22+, ESM, Node Test Runner, PWA, PocketBase via `@artisys/local-backend`.

**Spec:** `docs/superpowers/specs/2026-09-12-almoxarifado-bootstrap-design.md`

## Global Constraints
- Core obrigatório R$ 0.
- Sem serviço pago obrigatório.
- Operação local sem internet.
- Node 22+.
- CI completo somente em checkpoint/release.

---

### Task 1: Plataforma local
**Files:** `src/platform/config.mjs`, `src/platform/runtime-plan.mjs`, `src/platform/web-server.mjs`, `apps/web/*`, `apps/desktop/src/main.mjs`, `tests/*`.
**Produces:** configuração LAN, runtime plan e PWA local testada.
- [x] Escrever testes de configuração/runtime/PWA primeiro e confirmar falha.
- [x] Implementar configuração local, shell PWA e servidor LAN.
- [x] Executar testes e confirmar verde.

### Task 2: Integrações ArtiSys
**Files:** `.gitmodules`, `package.json`, `src/platform/integrations.mjs`, `artisys-qa.config.json`, `scripts/*`, `tests/repo-wiring.test.mjs`.
**Produces:** consumo pinado das utilidades e gates explícitos.
- [x] Escrever testes do registry e wiring primeiro e confirmar falha.
- [x] Integrar módulos runtime por package boundary.
- [x] Integrar QA/Security/Release fora do runtime.
- [x] Executar `npm run check`.
