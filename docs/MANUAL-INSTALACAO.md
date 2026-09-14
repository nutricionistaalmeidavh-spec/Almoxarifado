# Manual de instalação — ArtiSys Almoxarifado 1.0.0 + WMS + P1 Comercial

## Requisitos

- Windows 10 ou 11 x64.
- Computador principal ligado durante o uso por outros dispositivos na rede local.
- Não é necessário instalar Node.js para usar o instalador final.
- O sistema funciona sem Internet após a instalação; Internet não é requisito do núcleo.
- O núcleo permanece R$ 0 de infraestrutura obrigatória, self-hosted e sem serviço SaaS necessário.

## Instalação

1. Execute `ArtiSys-Almoxarifado-Setup-1.0.0.exe` para a release de base ou o instalador posterior que incorpore WMS/P1.
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

Cadastre ferramentas/equipamentos por tag ou QR, nome, série e categoria. Um ativo pode estar:

- disponível;
- emprestado/retirado;
- em manutenção;
- perdido/inativo.

Na retirada, registre o responsável, a obra/projeto e a previsão de devolução. Na devolução, registre a condição de retorno. O sistema impede uma segunda retirada enquanto houver uma retirada aberta e também bloqueia retirada durante manutenção.

### Fotos e documentos do patrimônio

Dentro de **P1 Comercial > Patrimônio**, use **Foto / documento do patrimônio** para anexar foto, PDF, nota fiscal, comprovante ou outro arquivo. O documento fica armazenado localmente e vinculado ao ativo.

## Fornecedores por produto

Um produto pode ter vários fornecedores. Para cada vínculo, registre:

- SKU usado pelo fornecedor;
- embalagem;
- preço atual e histórico;
- lead time em dias;
- MOQ — quantidade mínima de compra;
- indicação de fornecedor preferencial.

Somente um vínculo fica como preferencial por produto. Quando houver lead time cadastrado, novos pedidos podem receber previsão de entrega automaticamente.

## Unidades e embalagens

A unidade original do produto continua sendo a unidade base. Cadastre conversões adicionais, por exemplo:

```text
1 CX = 12 UN
1 FD = 6 CX = 72 UN
```

Cada conversão pode possuir seu próprio código de barras. A API de conversão retorna a quantidade equivalente na unidade base.

## Qualidade e quarentena

Use **Qualidade / quarentena** para registrar material que ainda não deve ficar disponível para consumo.

Fluxo:

```text
Receber para inspeção -> manter em quarentena -> liberar ou rejeitar
```

Enquanto estiver em quarentena, a quantidade não entra no saldo disponível. A liberação gera uma entrada de estoque auditável. A rejeição encerra a quantidade correspondente sem incorporá-la ao estoque.

A quarentena é um fluxo opcional. O recebimento tradicional continua disponível para materiais que não exigem inspeção.

## Reposição avançada

A tela calcula sugestões usando:

- consumo médio diário no período selecionado;
- estoque físico e reservas;
- lead time do fornecedor preferencial;
- dias de segurança;
- estoque de segurança;
- ponto de reposição;
- cobertura estimada em dias;
- MOQ;
- fornecedor preferencial e custo estimado.

Esses cálculos são locais e estatísticos; não dependem de serviço de IA ou API externa.

## Central de alertas

A central reúne automaticamente:

- estoque abaixo do mínimo ou ruptura;
- lote próximo da validade;
- pedido de compra atrasado;
- ferramenta com devolução vencida;
- inventário cíclico vencido;
- falha de backup automático.

Os alertas são calculados/persistidos localmente. E-mail, WhatsApp ou notificações externas podem ser integrados futuramente, mas não são dependência obrigatória.

## Backup e restauração

Em **Configurações**, use **Criar backup** para gerar um snapshot local. O backup inclui a base, os registros P1 e os anexos locais. Antes de restaurar ou importar, o sistema gera um backup de segurança quando aplicável.

Falhas no backup automático também passam a gerar alerta crítico local.

## Atualização

A atualização 1.x é feita executando um novo instalador sobre a instalação existente. A atualização substitui arquivos do aplicativo e **não apaga os dados** armazenados no diretório de usuário.

A migração de JSON para SQLite ocorre automaticamente apenas quando aplicável e quando o banco SQLite ainda está vazio. Antes de qualquer atualização operacional, recomenda-se criar um backup pelo próprio sistema.

## Desinstalação

A desinstalação padrão remove o aplicativo instalado, mas **não remove os dados do usuário** automaticamente. Isso evita perder estoque, documentos e backups por uma desinstalação acidental.

## Leitor, câmera, impressora e balança

Leitor USB em modo teclado e captura por câmera fazem parte do produto. Integrações com balança/porta serial e impressão térmica são opcionais e dependem do hardware/driver disponível no computador.

A validação automatizada verifica software, API, interface, estoque e persistência. Essa evidência não substitui homologação física de modelos específicos de leitores, câmeras, impressoras ou balanças.

## Verificação do instalador

Junto ao instalador podem ser fornecidos:

- `SHA256SUMS.txt` — hash SHA-256;
- `release-manifest.json` — versão, commit, tamanho e hash do artefato.

Esses arquivos permitem conferir que o instalador recebido é exatamente o artefato aprovado no processo de release.
