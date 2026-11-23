# Testes funcionais E2E (Playwright + SQLite)

## Objetivo

Rodar testes reais no Chromium contra a aplicação web servida pelo **mesmo runtime local** usado pelo desktop. Cada cenário cria e apaga um banco SQLite temporário, sem acessar clientes, arquivos da instalação existente, serviços remotos ou exigir ativação paga.

## Execução local

```bash
npm install --no-audit --no-fund
npx playwright install chromium
node --test qa/e2e-functional.mjs
```

Para guardar screenshots dos fluxos aprovados e reprovados:

```bash
ALMOX_E2E_EVIDENCE=artifacts/e2e-screenshots node --test qa/e2e-functional.mjs
```

Os prints ficam somente em `artifacts/e2e-screenshots`, ou nos artefatos do job de CI. **Nunca executar esta suíte com `ALMOX_DATA_DIR` ou banco real de cliente.** Este teste ignora esses caminhos e cria a própria pasta temporária.

## Cobertura operacional

1. Primeira configuração, sessão, logout/login e núcleo sem licença comercial obrigatória.
2. Categorias, fornecedores, depósitos e produto: criação, edição, inativação, reativação, exclusão e proteção por vínculos.
3. Entrada, saída, rejeição de saldo insuficiente, transferência, ajuste, auditoria e persistência após recarga.
4. Inventário: abertura, bloqueio de movimentação, contagem, fechamento e reconciliação.
5. Compras: solicitação, cotação por item, aprovação, pedido, conferência parcial, rejeição, recebimento final e saldo.
6. Reservas: impedir retirada de saldo reservado e liberar disponibilidade.
7. Relatórios: CSV de estoque e movimentações.
8. Permissões: usuário de leitura, login e proibição de alteração de catálogo.
9. Mobile: navegação em viewport de telefone e leitura por SKU.
10. WMS: endereçamento, leitura, recebimento, sugestão de picking, baixa e inventário cíclico.
11. P1: patrimônio e fornecedor preferencial associado ao material.
12. P2: definição de campo personalizado, cadastro de kit/BOM e baixa real dos componentes.

## Evidências e gates

- Workflow: `.github/workflows/e2e-functional.yml` em toda PR que toca código/QA.
- Screenshots por cenário em artefato GitHub Actions (`almoxarifado-playwright-e2e-evidence`).
- O job falha quando a API, a UI ou o saldo persistido divergem das expectativas.
- Separadamente, execute `npm run check`, `npm run qa:validate` e `npm run security`.
- A suíte E2E verifica o navegador e a API com SQLite; **não substitui** instalação/reinstalação real do NSIS no Windows, hardware externo, rede entre PCs ou autoupdate do Electron. Esses precisam de QA próprio antes de qualquer release.
- O funcionamento e a licença do Core não devem depender de serviços pagos. Publicação não é realizada automaticamente por este workflow.
