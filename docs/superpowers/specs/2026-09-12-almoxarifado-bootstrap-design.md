# Almoxarifado Bootstrap — Design

## Objetivo
Criar a base Desktop + backend local + PWA LAN e integrar os kits ArtiSys aprovados, sem implementar ainda as regras de estoque.

## Arquitetura
O PC principal executa o Desktop e o backend local. A PWA é servida por HTTP na LAN e pode ser aberta em celular/tablet sem depender de internet. O produto consome `utilidades` por uma fronteira local e por submodule fixado em commit revisado.

## Fronteiras
- `src/platform/config.mjs`: configuração única do produto.
- `src/platform/runtime-plan.mjs`: compõe Desktop Shell + Local Backend por injeção de contrato.
- `src/platform/integrations.mjs`: catálogo das integrações runtime e CI-only.
- `src/platform/web-server.mjs`: servidor estático local da PWA.
- `apps/desktop`: entrada Desktop.
- `apps/web`: shell PWA.
- `vendor/utilidades`: submodule pinado.

## Utilidades
Runtime: Desktop Shell, Local Backend, EventBus, Dashboard, Capture, PDF e Printing. QA, Security e Release ficam fora do runtime e são acionados explicitamente.

## Restrições
- Core obrigatório R$ 0.
- Sem API/serviço pago obrigatório.
- Sem internet obrigatória para operação local.
- Node 22+.
- Sem regras de estoque nesta entrega.
- CI completo apenas em checkpoint/release, não a cada pequena alteração.

## Testes
Node Test Runner cobre configuração LAN, registry de módulos, composição do runtime, PWA e servidor HTTP local.
