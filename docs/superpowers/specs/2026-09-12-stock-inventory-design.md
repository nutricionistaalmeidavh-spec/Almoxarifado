# Almoxarifado — Estoque e Inventário Design

## Escopo aprovado

Implementar as etapas 03 a 05 do roadmap do MVP local-first:

1. modelagem do banco para categorias, fornecedores, depósitos, usuários, produtos, saldos, movimentações e inventário;
2. motor de estoque com entrada, saída, ajuste, transferência e consulta de saldo;
3. inventário com snapshot, contagem, divergência, recontagem, fechamento e ajuste auditável.

## Arquitetura

O domínio permanece independente de UI e de infraestrutura. A configuração do backend local recebe o schema de coleções; regras de estoque e inventário ficam em serviços de domínio testáveis. Persistência é acessada por um contrato de repositório; o adapter em memória serve como implementação determinística para testes e como referência do contrato para o adapter local do host.

O estoque nunca fica negativo. Transferências são atômicas e geram movimentos vinculados de saída e entrada. Um depósito com inventário aberto fica bloqueado para movimentações, preservando o snapshot físico até o fechamento.

## Inventário

Ao abrir um inventário, o sistema captura o saldo esperado de cada produto selecionado. Contagem e recontagem mantêm a divergência visível. O fechamento exige todos os itens contados e rejeita snapshot obsoleto. Divergências viram movimentos `ADJUSTMENT` ligados ao inventário para auditoria.

## Eventos

Os serviços publicam eventos por uma fronteira injetável, preparada para o `@artisys/eventbus`:

- `stock.entry.created`
- `stock.exit.created`
- `stock.adjusted`
- `stock.transferred`
- `inventory.started`
- `inventory.counted`
- `inventory.recounted`
- `inventory.closed`

## Restrições

- Core R$ 0, local/self-hosted e sem serviço pago obrigatório.
- Node 22+.
- Sem dependência cloud para operação normal.
- CI completo somente em checkpoint de release; testes desta entrega rodam localmente.
