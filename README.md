# ArtiSys Almoxarifado

Sistema local-first de almoxarifado. O PC Windows atua como host principal e serve a PWA/API para desktop, celular e tablet na mesma LAN. O núcleo não depende de cloud nem de serviço pago.

## Entregas implementadas

### 01 — Base do produto
Desktop Shell, backend local, PWA e operação sem internet obrigatória.

### 02 — Utilidades ArtiSys
Desktop Shell, Local Backend, EventBus, Dashboard, Capture, PDF, Printing, QA, Security e Release via `vendor/utilidades` pinado.

### 03 — Modelagem do banco
Produtos, categorias, fornecedores, depósitos, usuários, saldos, movimentações e inventário.

### 04 — Motor de estoque
Entrada, saída, ajuste, transferência atômica, saldo não negativo e histórico auditável.

### 05 — Inventário
Snapshot, contagem, divergência, recontagem, bloqueio do depósito e ajuste no fechamento.

### 06 — Interface operacional
Dashboard, cadastros, movimentações, inventário e relatórios responsivos.

### 07 — Rede local e persistência
API/PWA na LAN e base central em `.data/almoxarifado.json`.

### 08 — Código de barras
Leitor USB, busca por SKU/código e captura por câmera com decodificação local.

### 09 — Relatórios e impressão
KPIs, posição de estoque, histórico, CSV, impressão/PDF e etiquetas.

### 10 — Autenticação e permissões
- Primeiro acesso define a senha do administrador local.
- Senhas armazenadas com `scrypt` + salt; sem senha em texto puro.
- Sessões locais com token e expiração.
- Perfis: `ADMIN`, `ALMOXARIFE`, `COMPRAS`, `GESTOR`, `LEITURA`.
- Autorização aplicada no servidor, não apenas na interface.
- Auditoria usa sempre o usuário autenticado; `userId` enviado pelo cliente não é aceito como autoridade.
- Proteção básica contra tentativas repetidas de login.

### 11 — Backup e recuperação
- Backup manual e automático local.
- Backup pré-restauração/importação.
- Restauração validada e persistência atômica.
- Exportação/importação JSON versionada.
- Retenção configurável de backups.

### 12 — Compras e recebimento
- Solicitação de compra.
- Cotação por fornecedor.
- Aprovação.
- Pedido de compra.
- Recebimento com entrada automática no estoque.
- Histórico de preço e vínculo entre solicitação, pedido, recebimento e movimentos.

### 13 — Centros de custo e obras
- Centros de custo.
- Obras/projetos.
- Setores/departamentos.
- Responsável pela retirada.
- Vínculos gravados no movimento de estoque para auditoria futura.

### 14 — Estoque avançado
- Reservas e consumo/liberação.
- Estoque físico × disponível.
- Lote e validade.
- Número de série.
- Perda, avaria e devolução.
- Transferência com estado `IN_TRANSIT` e confirmação de recebimento.

### 15 — Custos e reposição
- Custo médio atualizado no recebimento de compra.
- Último custo e histórico por fornecedor.
- Dashboard/valorização preferem custo médio.
- Estoque mínimo e estoque-alvo.
- Sugestões de reposição considerando reservas e disponibilidade real.

## Primeiro acesso

```bash
git submodule update --init --recursive
npm install
npm run dev:web
```

No **primeiro acesso**, abra `http://localhost:4173` no PC principal e defina a senha do administrador (mínimo de 10 caracteres). Por segurança, esse bootstrap inicial é aceito apenas em loopback. Depois disso, outros aparelhos da mesma LAN podem usar `http://IP-DO-PC:4173` e fazer login normalmente.

## Dados locais

Por padrão:

```text
.data/almoxarifado.json
.data/backups/
```

A pasta `.data/` não deve ser versionada no Git.

## Verificação

```bash
npm test
npm run check
```

Gates mais pesados continuam explícitos e reservados para checkpoints/release:

```bash
npm run qa:validate
npm run security
npm run release:check
```

## Próxima entrega

**16 — Documentos e anexos:** NF/documentos, fotos, comprovantes e organização por movimentação/compra/recebimento.

> Homologações físicas em máquinas, leitores, impressoras, balanças, celular/tablet e ambiente real do cliente não fazem parte desta etapa.
