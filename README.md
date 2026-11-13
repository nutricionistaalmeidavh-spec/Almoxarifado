# ArtiSys Almoxarifado

Sistema local-first de almoxarifado. O PC Windows atua como host principal e serve a PWA/API para desktop, celular e tablet na mesma LAN. O núcleo não depende de cloud nem de serviço pago.

**Release atual:** `1.0.1` — Windows x64 — `ArtiSys-Almoxarifado-Setup-1.0.1.exe`. Distribuição pelas [GitHub Releases](https://github.com/nutricionistaalmeidavh-spec/Almoxarifado/releases).

O produto é distribuído **sem sistema de licença**, chave, ativação, limite por máquina, assinatura obrigatória ou servidor de licença.

## Entregas implementadas

### 01–09 — Núcleo operacional
Base Desktop/PWA, utilidades ArtiSys, modelagem, motor de estoque, inventário, interface, persistência LAN, código de barras, relatórios, impressão e etiquetas.

### 10 — Autenticação e permissões
Primeiro acesso configura o administrador local; senhas com `scrypt` + salt; sessões; perfis `ADMIN`, `ALMOXARIFE`, `COMPRAS`, `GESTOR`, `LEITURA`; autorização server-side e auditoria.

### 11 — Backup e recuperação
Backup manual/automático, snapshot pré-restauração/importação, restauração validada, persistência atômica, anexos binários e retenção configurável.

### 12 — Compras e recebimento
Solicitação, cotação, aprovação, pedido, recebimento com entrada automática e histórico de custos.

### 13 — Centros de custo e obras
Centros de custo, obras/projetos, setores/departamentos, responsável pela retirada e vínculo auditável com movimentações.

### 14 — Estoque avançado
Reservas, físico × disponível, lote/validade, número de série, perdas, avarias, devoluções e transferências em trânsito com rastreabilidade.

### 15 — Custos e reposição
Custo médio, histórico de preços, estoque mínimo/alvo e sugestão de reposição considerando reservas.

### 16 — Documentos e anexos
Armazenamento local em `.data/documents/`, PDF/imagens/texto, limite padrão de 15 MB, SHA-256, vínculos operacionais, download e exclusão auditável.

### 17 — OCR local opcional
Adapter OCR local, resultado persistido/revisável e funcionamento manual preservado quando não houver engine OCR instalada.

### 18 — Relatórios avançados
Curva ABC, consumo, sem giro, perdas/avarias, valorização, histórico de custo, filtros operacionais e CSV.

### 19 — Hardware opcional
Serial/balança e impressão por transporte quando disponíveis; ausência de hardware não impede o funcionamento do almoxarifado. Impressão do navegador/Desktop permanece como fallback.

### 20 — Desktop final
Runtime central para base, API/PWA, documentos, backup, configurações, logs, hardware e OCR. Electron com `contextIsolation`, sandbox, `nodeIntegration: false` e bloqueio de janelas externas.

### Atualização opcional do aplicativo Windows

Instalações empacotadas verificam atualizações ao abrir, com aviso e opção de baixar/instalar, exigindo confirmação e SHA-256 válido. O núcleo local-first continua funcionando sem internet. Como o repositório do código-fonte é privado, a distribuição automática para clientes depende de um catálogo HTTPS público de **binários**, sem expor código nem tokens. Configuração e limites: [docs/updates.md](docs/updates.md).

### 21 — Instalador e atualização
- Electron + NSIS para **Windows x64**.
- Artefato atual: `ArtiSys-Almoxarifado-Setup-1.0.1.exe`.
- Instalação por usuário com atalhos.
- Runtime completo empacotado: o usuário não precisa instalar Node.js.
- Dados ficam separados da pasta de instalação.
- Reinstalação/upgrade não remove a base local.
- Desinstalação padrão não apaga os dados do usuário.

### 22 — QA automatizado final
- Suíte completa Node/API/UI.
- Smoke Playwright sobre a aplicação instalada.
- Bootstrap/login, criação de produto, entrada de estoque e dashboard.
- Reinstalação do mesmo `.exe` e verificação de persistência dos dados.
- GitHub Actions Linux + Windows usado somente no fechamento da release.

### 23 — Segurança e release
- Gate de sintaxe/testes.
- QA de configuração.
- Verificação de segredos e hardening Desktop.
- Auditoria de dependências no workflow.
- SHA-256 do instalador.
- `SHA256SUMS.txt` e `release-manifest.json` conferidos antes da distribuição.

### 24 — Distribuição final sem licença
- Instalador Windows final.
- Arquivos de integridade e manifesto.
- Manual de instalação/primeiro acesso.
- Pacote comercial **sem licença ou ativação** e sem demo bloqueada.

### 25 — Persistência SQLite e migração
- `node:sqlite` passa a ser a persistência primária local.
- Banco principal: `.data/almoxarifado.sqlite`.
- Instalações antigas com `.data/almoxarifado.json` são importadas automaticamente na primeira abertura do banco vazio.
- O JSON anterior é preservado como `almoxarifado.json.migrated.bak`.
- O bootstrap de instalação nova continua criando `ALM-01` e o administrador local.
- Nenhuma dependência SaaS ou banco pago é exigida.

### 26 — Endereçamento físico
- Hierarquia por depósito: zona, corredor, estante, nível, posição, recebimento e staging.
- Código de endereço único dentro do depósito.
- Saldo rastreado por `produto + depósito + endereço + lote + série`, mantendo o saldo consolidado já existente por depósito.
- Movimentações podem registrar `locationId` sem quebrar os fluxos legados.

### 27 — Recebimento parcial
- Pedido pode ficar `PARTIALLY_RECEIVED` até a entrega completa.
- Controle por linha de quantidade entregue, aceita, rejeitada, avariada e pendente.
- Apenas a quantidade aceita entra no estoque e atualiza custo.
- O recebimento pode indicar endereço, lote e número de série.
- A chamada antiga sem lista de itens continua recebendo todo o saldo pendente para manter compatibilidade.

### 28 — FIFO / FEFO
Cada produto pode usar estratégia `MANUAL`, `FIFO` ou `FEFO`. O WMS gera plano de retirada a partir das posições rastreadas; FEFO prioriza menor validade e FIFO prioriza o recebimento mais antigo. A recomendação não baixa estoque sozinha: a movimentação continua exigindo confirmação operacional.

### 29 — Inventário cíclico
- Contagem por depósito e, opcionalmente, por endereço/produto.
- Primeira contagem é cega: o saldo esperado não é enviado ao fluxo operacional.
- Divergência pode exigir segunda contagem.
- Fechamento gera ajuste auditável por endereço, lote e série.
- O inventário global legado continua disponível.

### 30 — WMS / Coletor na PWA
A PWA existente ganhou a área **WMS / Coletor** com endereçamento, leitura de código, recebimento parcial, sugestão FIFO/FEFO, receber, guardar/mover, retirar, devolver e contagem cíclica. O fluxo funciona na LAN e não exige serviço externo.

## P1 — Diferencial comercial

A área **P1 Comercial** amplia o almoxarifado sem transformar o produto em um ERP e mantém o núcleo local-first.

### Patrimônio e ferramentas
- Cadastro por tag/QR, série, categoria, condição e custo.
- Retirada e devolução vinculadas a responsável e obra/projeto.
- Previsão de devolução, perda, manutenção e histórico auditável.
- Fotos, notas e documentos podem ser vinculados diretamente ao patrimônio.

### Produto × fornecedor
- Relação N:N entre produto e fornecedores.
- SKU do fornecedor, embalagem, preço, histórico de preço, lead time e MOQ.
- Um fornecedor preferencial por produto.
- O lead time pode gerar automaticamente a previsão de entrega do pedido de compra.

### Unidades e embalagens
- Conversões como `1 CX = 12 UN` sem alterar a unidade base do produto.
- Código de barras próprio por unidade/embalagem.
- Normalização para a quantidade base antes da movimentação.

### Qualidade e quarentena
- Quantidades em inspeção ficam fora do estoque disponível.
- Liberação parcial ou total gera entrada auditável no estoque.
- Rejeição fecha a quantidade inspecionada sem incorporá-la ao saldo.

### Reposição avançada
- Consumo médio diário a partir das movimentações locais.
- Lead time do fornecedor preferencial.
- Estoque de segurança e ponto de reposição.
- Cobertura estimada em dias.
- Sugestão de compra respeitando MOQ e fornecedor preferencial.

### Central de alertas
- Estoque baixo/ruptura.
- Lotes próximos da validade.
- Pedidos de compra atrasados.
- Ferramentas com devolução vencida.
- Inventários cíclicos vencidos.
- Falhas do backup automático.

## P2 — Maior retorno comercial

A área **P2 Gestão** adiciona recursos de governança e produtividade para clientes médios/maiores sem exigir cloud.

### Campos personalizados
- Campos adicionais por produto, fornecedor, patrimônio, obra, solicitação e pedido de compra.
- Tipos `TEXT`, `NUMBER`, `DATE`, `BOOLEAN` e `SELECT`.
- Campos obrigatórios e opções controladas.
- Valores ficam persistidos e auditados sem alterar o schema físico para cada cliente.

### Matriz de aprovação por valor
- Regras por faixa de valor, papel e etapa.
- Aprovação sequencial quando houver mais de uma etapa.
- Instâncias registram quem aprovou/rejeitou e quando.
- Se existir regra aplicável ao valor, a criação do pedido de compra é bloqueada até a matriz correspondente estar aprovada.
- Sem regra aplicável, o fluxo de compras anterior continua funcionando normalmente.

### KPI de fornecedores
- Quantidade de pedidos e valor comprado.
- Prazo médio de entrega e percentual entregue no prazo.
- Taxas de aceitação, rejeição e avaria.
- Variação de preço baseada no histórico local.
- Ranking calculado localmente a partir de pedidos e recebimentos.

### Manutenção e calibração
- Planos recorrentes vinculados ao patrimônio.
- Frequência em dias e próxima data prevista.
- Estados `OK`, `DUE_SOON` e `OVERDUE`.
- Registro de execução, responsável, certificado, observações e medições.
- Concluir um plano agenda automaticamente a próxima ocorrência.

### Kits / BOM
- Kits virtuais compostos por produtos e quantidades.
- Cálculo de quantos kits podem ser atendidos pelo estoque atual.
- Baixa transacional de todos os componentes com movimento `KIT_ISSUE`.
- O kit não cria saldo artificial: o estoque continua sendo dos componentes reais.

### XML de NF-e
- Leitura local de XML, sem API fiscal externa obrigatória.
- Extrai chave, emitente/CNPJ, itens, SKU, GTIN, unidade, quantidade, custo, NCM, CFOP, total e rastreabilidade de lote/validade quando presente.
- Preview faz matching com fornecedor e produtos existentes.
- Pode criar cadastros ausentes.
- Entrada física, custo e lote só são lançados após confirmação explícita do operador.
- XML com `DOCTYPE`/`ENTITY` é rejeitado e nenhum conteúdo externo é executado.

P0, P1 e P2 usam a mesma persistência SQLite, backup/restauração e API local. Nenhum recurso P2 introduz dependência SaaS paga no núcleo.

## Desenvolvimento

A fonte histórica de módulos reutilizáveis permanece pinada em `vendor/utilidades`. Para que o build final do repositório privado seja reproduzível sem credencial para um segundo repositório privado, os módulos efetivamente necessários ao runtime de distribuição também possuem snapshots mínimos pinados em `vendor/release-modules/`.

```bash
npm install
npm run dev:web
```

Para executar o host Electron em desenvolvimento:

```bash
npm run desktop
```

No primeiro acesso local, defina a senha do administrador com pelo menos 10 caracteres. Depois, dispositivos da mesma rede podem acessar `http://IP-DO-PC:4173`.

## Dados locais

```text
.data/
├── almoxarifado.sqlite
├── almoxarifado.json.migrated.bak   # somente após migração de uma instalação antiga
├── documents/
├── backups/
├── logs/
└── settings.json
```

Em uma instalação já existente, o arquivo `almoxarifado.json` é lido somente para a migração inicial quando o SQLite ainda está vazio. O backup de migração é preservado. No instalador, os dados ficam no diretório de dados do usuário do Windows, separado dos binários do programa.

## Verificação

```bash
npm test
npm run check
npm run qa:validate
npm run security
npm run release:check
```

O workflow `.github/workflows/release-final.yml` continua reservado para o fechamento de release Windows. P0, P1 e P2 podem ser validados localmente sem consumir GitHub Actions.

## Manual

Consulte `docs/MANUAL-INSTALACAO.md`.

> A validação automatizada comprova os fluxos de software cobertos pelos testes. Homologação física de leitores, câmeras, impressoras, balanças e máquinas específicas de clientes não é alegada por esse gate.
