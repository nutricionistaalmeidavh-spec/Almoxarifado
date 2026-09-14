# P0 WMS Operacional — Design

## Objetivo
Evoluir o ArtiSys Almoxarifado 1.0 para um WMS leve local-first, sem SaaS obrigatório, preservando os fluxos existentes e os dados de instalações atuais.

## Escopo P0
1. Persistência SQLite local com migração automática do `almoxarifado.json`.
2. Endereçamento físico: depósito > zona > corredor > estante > nível > posição.
3. Recebimento parcial de pedidos, com pendência, rejeição/avaria e destino por endereço.
4. FIFO/FEFO por produto e sugestão de retirada baseada em posições rastreadas.
5. Inventário cíclico por endereço/produto, com contagem cega, recontagem e ajuste auditável.
6. Fluxo móvel PWA por leitura: localizar endereço/produto e executar receber/guardar/retirar/transferir/contar/devolver.

## Restrições
- Core R$ 0, self-hosted e open source; nenhum serviço pago obrigatório.
- Compatibilidade com Windows x64 e runtime Electron atual.
- Não remover APIs/fluxos existentes.
- Dados legados devem migrar automaticamente e o arquivo JSON anterior deve ser preservado como backup de migração.
- Sem dependência de GitHub Actions para validação desta entrega.

## Arquitetura
### Persistência
Adicionar `src/domain/stock/sqlite-repository.mjs` usando `node:sqlite`. Entidades ficam em tabelas SQLite locais; dados flexíveis continuam serializados como JSON por entidade, enquanto saldos, movimentos, contagens e histórico de preço possuem tabelas dedicadas. O runtime prefere SQLite e importa uma única vez o estado do JSON legado quando o banco ainda está vazio.

### Endereçamento e posições
Adicionar coleção `locations` e posições de estoque. `locationId` é opcional nos fluxos legados, mas os novos fluxos WMS registram saldo por posição. O saldo consolidado por depósito continua disponível para compatibilidade.

### WMS
Adicionar `wms-service.mjs` para hierarquia de endereços, regras FIFO/FEFO, recomendação de retirada, inventário cíclico e resolução de códigos de leitura. O serviço usa o estoque atual para efetivar ajustes e movimentações, mantendo auditoria existente.

### Compras
`receiveOrder` passa a aceitar itens parciais. Sem `items`, mantém o comportamento compatível de receber todo o saldo pendente. Cada linha acumula entregue/aceito/rejeitado/avariado e o pedido fica `PARTIALLY_RECEIVED` até a entrega total.

### API/PWA
Expor endpoints WMS e uma tela móvel simples reutilizando a PWA existente. O leitor por câmera/código não depende de serviço externo.

## Segurança e consistência
- Transações SQLite usam `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`.
- Referências depósito/endereço/produto/lote/serial são validadas no domínio.
- Inventário cíclico não revela o saldo esperado durante a primeira contagem.
- Divergências exigem recontagem quando configurado e geram ajuste auditável ao fechar.

## Testes
- Migração JSON -> SQLite e persistência entre reaberturas.
- Hierarquia/endereço e posições.
- FIFO/FEFO.
- Recebimento parcial e conclusão posterior.
- Inventário cíclico cego/recontagem/fechamento.
- Fluxo de leitura móvel e regressão dos testes existentes.
