# P2 — Maior Retorno Comercial

## Objetivo
Elevar o ArtiSys Almoxarifado com seis recursos comerciais de alto valor sem quebrar P0/P1: campos personalizados, matriz de aprovação por valor, KPI de fornecedores, manutenção/calibração programada, kits/BOM e importação local de XML de NF-e.

## Restrições globais
- Continuar local-first, R$ 0 de infraestrutura obrigatória e sem SaaS pago.
- Persistência primária em SQLite usando a camada genérica de entidades já existente.
- Nenhuma GitHub Action necessária para desenvolvimento do P2.
- P0/WMS, P1 Comercial, backups e formatos existentes devem continuar compatíveis.
- Importação de NF-e deve ser explícita: parsear/validar primeiro; movimentar estoque somente em ação confirmada.

## 1. Campos personalizados
Coleções `customFieldDefinitions` e `customFieldValues`. Definições por tipo de entidade (`product`, `supplier`, `asset`, `project`, `purchaseRequest`, `purchaseOrder`) com tipo `TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `SELECT`, obrigatoriedade e opções. Valores são validados no domínio e podem ser lidos por entidade.

## 2. Matriz de aprovação
Coleções `approvalRules` e `approvalInstances`. Regras por faixa de valor, papel exigido e ordem. A instância registra etapas, aprovadores e auditoria. O valor da solicitação é derivado de cotação selecionada/menor cotação quando houver; também pode ser informado explicitamente. Pedidos de compra sujeitos a regra exigem instância aprovada.

## 3. KPI de fornecedor
Serviço analítico sem nova persistência obrigatória. Consolida pedidos e recebimentos por fornecedor: pedidos, valor comprado, prazo médio, entrega no prazo, quantidade aceita, rejeitada e avariada, taxa de aceitação e variação de preço.

## 4. Manutenção e calibração
Coleções `maintenancePlans` e `calibrationRecords`. Plano por ativo com frequência em dias e tipo `MAINTENANCE` ou `CALIBRATION`. Conclusão calcula próxima data. O módulo reutiliza patrimônio existente e gera status `OK`, `DUE_SOON` e `OVERDUE`.

## 5. Kits / BOM
Coleção `kits`. Kit virtual composto por produtos + quantidades. Serviço calcula disponibilidade máxima e permite baixa transacional dos componentes com movimento `KIT_ISSUE`; não cria estoque artificial do kit.

## 6. XML de NF-e
Parser local sem dependência externa. Extrai chave, emitente/CNPJ, itens (`cProd`, `xProd`, `cEAN`, `uCom`, `qCom`, `vUnCom`, `vProd`, NCM/CFOP) e rastreabilidade (`nLote`, `qLote`, `dVal`) quando presente. Preview faz matching por CNPJ, SKU e barcode. Aplicação pode criar cadastros ausentes e, somente com confirmação explícita, lançar entrada/custo/lote em estoque.

## API/PWA
Nova extensão `p2-api-extensions.mjs` encadeada após P1. Nova superfície `P2 Gestão` com seis painéis. Service worker inclui os novos assets locais. Permissões específicas são adicionadas aos papéis atuais.

## Compatibilidade e segurança
Backups continuam funcionando por `exportState/replaceState`; novas coleções entram automaticamente. XML é tratado apenas como dados, sem execução de conteúdo, URLs externas ou scripts. Operações de estoque permanecem transacionais e auditáveis.
