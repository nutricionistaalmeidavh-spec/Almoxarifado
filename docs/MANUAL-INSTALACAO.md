# Manual de instalação — ArtiSys Almoxarifado 1.0.0 + WMS + P1 + P2

## Requisitos

- Windows 10 ou 11 x64.
- Computador principal ligado durante o uso por outros dispositivos na rede local.
- Não é necessário instalar Node.js para usar o instalador final.
- O sistema funciona sem Internet após a instalação; Internet não é requisito do núcleo.
- O núcleo permanece R$ 0 de infraestrutura obrigatória, self-hosted e sem serviço SaaS necessário.

## Instalação

1. Execute `ArtiSys-Almoxarifado-Setup-1.0.0.exe` para a release de base ou o instalador posterior que incorpore WMS/P1/P2.
2. Confirme a instalação para o usuário atual.
3. Ao concluir, abra **ArtiSys Almoxarifado** pelo atalho da Área de Trabalho ou Menu Iniciar.
4. O aplicativo inicia o servidor local e abre a interface do almoxarifado.

O produto é distribuído **sem licença**, chave, ativação, limite por máquina ou servidor de licença.

## Primeiro acesso

No primeiro acesso feito no PC principal:

1. informe uma senha de administrador com pelo menos 10 caracteres;
2. confirme o cadastro inicial;
3. depois disso, entre com o usuário `admin` e a senha definida pelo responsável.

A senha não vem pronta dentro do instalador. Uma instalação nova cria automaticamente o depósito `ALM-01` e o administrador local que será configurado no primeiro acesso.

## Rede local

O PC Windows principal é o host. Celulares e tablets na mesma rede local podem acessar:

```text
http://IP-DO-PC:4173
```

O PC principal precisa permanecer ligado enquanto outros dispositivos usam o sistema. A operação do núcleo não depende de cloud.

## Dados e migração para SQLite

A base principal é local e usa SQLite:

```text
.data/
├── almoxarifado.sqlite
├── almoxarifado.json.migrated.bak
├── documents/
├── backups/
├── logs/
└── settings.json
```

Em uma instalação nova, o sistema cria `almoxarifado.sqlite` automaticamente.

Em uma instalação anterior que ainda possui `almoxarifado.json`, quando o banco SQLite estiver vazio o sistema:

1. lê a base JSON existente;
2. importa os registros para SQLite;
3. preserva uma cópia em `almoxarifado.json.migrated.bak`;
4. passa a utilizar o SQLite como base principal nas próximas aberturas.

Não apague o JSON original nem o `.migrated.bak` antes de conferir a primeira abertura e manter o backup operacional desejado.

## WMS / Coletor

A PWA possui a seção **WMS / Coletor**. Ela funciona no PC, celular ou tablet conectado à mesma rede local.

### Endereçamento
Cadastre zona, corredor, estante, nível, posição, recebimento e staging. O código do endereço deve ser único dentro do depósito.

Exemplo:

```text
ALM-01 / Z-A / C-03 / E-02 / N-04 / P-01
```

### Leitura e movimentação
O fluxo móvel recomendado é `Endereço -> produto -> quantidade -> ação -> confirmar`. As operações incluem receber, guardar/mover, retirar e devolver.

### FIFO e FEFO
- `MANUAL` — operador escolhe a posição.
- `FIFO` — prioriza o item recebido há mais tempo.
- `FEFO` — prioriza o lote com validade mais próxima.

A sugestão de retirada não baixa o estoque sozinha; a confirmação operacional continua obrigatória.

## Recebimento parcial

Em **WMS / Coletor > Recebimento parcial**, informe a quantidade entregue e, quando necessário, separe aceita, rejeitada e avariada. Apenas a quantidade aceita entra no estoque. Se ainda houver saldo, o pedido permanece `PARTIALLY_RECEIVED`.

## Inventário cíclico

A primeira contagem é cega. Quando a recontagem estiver ativa, divergências exigem segunda contagem. Ao fechar a sessão, diferenças confirmadas geram ajuste auditável.

# P1 Comercial

A seção **P1 Comercial** concentra os diferenciais adicionais de operação e controle.

## Patrimônio e ferramentas

Cadastre ferramentas/equipamentos por tag ou QR, nome, série e categoria. Um ativo pode estar disponível, emprestado, em manutenção ou perdido/inativo. Na retirada, registre responsável, obra/projeto e previsão de devolução; na devolução, registre a condição de retorno.

### Fotos e documentos do patrimônio
Dentro de **P1 Comercial > Patrimônio**, use **Foto / documento do patrimônio** para anexar foto, PDF, nota fiscal, comprovante ou outro arquivo. O documento fica armazenado localmente e vinculado ao ativo.

## Fornecedores por produto

Um produto pode ter vários fornecedores. Para cada vínculo, registre SKU do fornecedor, embalagem, preço, lead time, MOQ e fornecedor preferencial. O lead time pode gerar automaticamente a previsão de entrega do pedido.

## Unidades e embalagens

A unidade original do produto continua sendo a unidade base. Cadastre conversões como `1 CX = 12 UN`; cada conversão pode possuir código de barras próprio.

## Qualidade e quarentena

Use **Qualidade / quarentena** quando o material ainda não deve ficar disponível. A liberação gera entrada auditável; a rejeição encerra a quantidade sem incorporá-la ao saldo.

## Reposição avançada

A tela considera consumo médio diário, estoque físico/reservas, lead time, dias de segurança, estoque de segurança, cobertura, MOQ e fornecedor preferencial.

## Central de alertas

A central reúne estoque abaixo do mínimo/ruptura, validade, pedido atrasado, ferramenta vencida, inventário cíclico vencido e falha de backup.

# P2 Gestão

A seção **P2 Gestão** concentra recursos de governança comercial e automação administrativa.

## Campos personalizados

Em **P2 Gestão > Campos personalizados**:

1. escolha a entidade: produto, fornecedor, patrimônio, obra, solicitação ou pedido;
2. informe a chave e o nome do campo;
3. escolha `TEXT`, `NUMBER`, `DATE`, `BOOLEAN` ou `SELECT`;
4. para `SELECT`, informe as opções permitidas;
5. marque como obrigatório quando necessário.

Os valores são salvos separadamente do cadastro-base, permitindo personalizar clientes sem criar outra versão do sistema. O painel também permite informar o ID do registro e um objeto JSON com os valores personalizados.

## Matriz de aprovação por valor

Cadastre regras por faixa, papel e etapa. Exemplo:

```text
R$ 0 a R$ 1.999,99      -> ALMOXARIFE / etapa 1
R$ 2.000 a R$ 9.999,99 -> GESTOR / etapa 1
Acima de R$ 10.000      -> ADMIN / etapa 1
```

Para compras sujeitas à matriz:

1. informe o ID da solicitação e o valor total;
2. gere a instância de aprovação;
3. cada papel necessário aprova sua etapa;
4. somente após o status `APPROVED` o pedido poderá ser criado para aquele valor.

Se nenhuma regra se aplicar, o fluxo tradicional de compras continua funcionando.

## KPI de fornecedores

O painel calcula automaticamente, usando dados locais:

- quantidade de pedidos;
- valor comprado;
- prazo médio real;
- percentual entregue no prazo;
- taxa de aceitação;
- rejeições e avarias;
- variação de preço.

O ranking não depende de API externa.

## Manutenção / calibração

Crie um plano escolhendo o patrimônio, tipo (`MAINTENANCE` ou `CALIBRATION`), intervalo em dias e próxima data. O sistema identifica itens próximos do prazo e vencidos. Ao concluir um plano, informe certificado/referência quando houver; a próxima data é recalculada automaticamente.

## Kits / BOM

Cadastre um kit com código, nome e componentes. Na interface, use uma linha por componente no formato:

```text
SKU;quantidade
PARAFUSO-01;4
BUCHA-02;4
```

Ao baixar um kit, escolha depósito e quantidade. O sistema confere todos os componentes antes da operação e baixa tudo de forma transacional com movimento `KIT_ISSUE`.

## Importar XML NF-e

Em **P2 Gestão > Importar XML NF-e**:

1. selecione o arquivo `.xml`;
2. selecione o depósito;
3. use **Pré-visualizar** para conferir fornecedor, valor e itens;
4. somente depois use **Importar e lançar estoque**;
5. confirme a operação.

O parser local extrai emitente/CNPJ, produtos, SKU, GTIN, unidade, quantidade, custo, NCM, CFOP, total e, quando existir no XML, lote e validade. O sistema tenta relacionar fornecedor por documento e produto por SKU/código de barras; cadastros ausentes podem ser criados automaticamente.

A pré-visualização não altera estoque. A entrada física e o custo só são gravados após confirmação explícita. XML com `DOCTYPE` ou `ENTITY` é rejeitado por segurança.

## Backup e restauração

Em **Configurações**, use **Criar backup** para gerar um snapshot local. O backup inclui a base, os registros P1/P2 e os anexos locais. Antes de restaurar ou importar, o sistema gera um backup de segurança quando aplicável.

## Atualização

A atualização 1.x é feita executando um novo instalador sobre a instalação existente. A atualização substitui arquivos do aplicativo e **não apaga os dados** armazenados no diretório de usuário. Antes de qualquer atualização operacional, recomenda-se criar um backup pelo próprio sistema.

## Desinstalação

A desinstalação padrão remove o aplicativo instalado, mas **não remove os dados do usuário** automaticamente.

## Leitor, câmera, impressora e balança

Leitor USB em modo teclado e captura por câmera fazem parte do produto. Integrações com balança/porta serial e impressão térmica são opcionais e dependem do hardware/driver disponível no computador.

A validação automatizada verifica software, API, interface, estoque e persistência. Essa evidência não substitui homologação física de modelos específicos de leitores, câmeras, impressoras ou balanças.

## Verificação do instalador

Junto ao instalador podem ser fornecidos:

- `SHA256SUMS.txt` — hash SHA-256;
- `release-manifest.json` — versão, commit, tamanho e hash do artefato.

Esses arquivos permitem conferir que o instalador recebido é exatamente o artefato aprovado no processo de release.
