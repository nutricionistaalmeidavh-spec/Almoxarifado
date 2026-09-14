# P1 — Diferencial Comercial

## Objetivo
Evoluir o ArtiSys Almoxarifado de WMS leve para uma solução comercial mais completa sem virar ERP, mantendo core local-first, R$ 0, self-hosted e sem serviço pago obrigatório.

## Escopo aprovado
1. Ferramentas/patrimônio: cadastro, retirada, devolução, responsável, obra/projeto, previsão de retorno, condição, perda, manutenção, fotos/documentos por vínculo e histórico.
2. Produto–fornecedor N:N: vários fornecedores por produto, SKU do fornecedor, embalagem, preço, lead time, MOQ, preferencial e histórico.
3. Unidades/embalagens: unidade base, conversões (ex.: 1 CX = 12 UN), código de barras por unidade e normalização de quantidade para estoque.
4. Qualidade/quarentena: recebimento em inspeção, liberação/rejeição e saldo bloqueado separado do disponível.
5. Reposição avançada: consumo médio, lead time, estoque de segurança, cobertura em dias e sugestão de compra por fornecedor preferencial.
6. Central de alertas: estoque baixo/ruptura, validade, pedido atrasado, ferramenta vencida, inventário vencido e falha de backup.

## Arquitetura
- Novos domínios isolados em `src/domain/assets`, `src/domain/supply`, `src/domain/quality`, `src/domain/alerts`.
- `repository.mjs`/SQLite recebem novas coleções sem alterar contratos existentes.
- Produtos continuam com `unit` como unidade base; conversões ficam em coleção própria para não quebrar cadastros legados.
- Qualidade usa `qualityHolds` e movimentações de estoque somente na liberação/rejeição; quantidade em inspeção não entra como disponível.
- Reposição avançada reutiliza movimentos, reservas, pedidos, fornecedores e histórico de preço existentes.
- Alertas são calculados localmente, sem serviço externo; integrações futuras de e-mail/WhatsApp permanecem opcionais.
- UI PWA em módulo isolado `apps/web/p1.js` carregado pelo shell, seguindo o padrão do WMS.

## Compatibilidade
- Nenhum campo legado obrigatório muda.
- Produtos antigos funcionam sem fornecedor N:N e sem conversões.
- Recebimento existente continua utilizável; inspeção de qualidade é opcional por item.
- Backups permanecem portáveis via `exportState`/`replaceState`.

## Segurança e permissões
- Ferramentas: `assets.view` / `assets.manage`.
- Fornecedores/unidades: `catalog.manage` para escrita; `stock.view` para consulta.
- Qualidade: `quality.view` / `quality.manage`.
- Alertas/reposição: permissões de leitura existentes (`replenishment.view`, `stock.view`).
- Todas as mutações registram usuário e timestamps no domínio.

## Testes
- Patrimônio: checkout, bloqueio de dupla retirada, devolução e manutenção.
- Produto–fornecedor: preferencial único, MOQ/lead time/preço.
- Unidades: conversão e barcode por UOM.
- Qualidade: quarentena, liberação/rejeição e saldo.
- Reposição: consumo médio, segurança, cobertura e fornecedor preferencial.
- Alertas: cada tipo crítico e deduplicação básica.
- API/UI/schema/repository e regressão do P0.
