# Manual de instalação — ArtiSys Almoxarifado 1.0.0 + P0 WMS

## Requisitos

- Windows 10 ou 11 x64.
- Computador principal ligado durante o uso por outros dispositivos na rede local.
- Não é necessário instalar Node.js para usar o instalador final.
- O sistema funciona sem Internet após a instalação; Internet não é requisito do núcleo.
- O núcleo permanece R$ 0 de infraestrutura obrigatória, self-hosted e sem serviço SaaS necessário.

## Instalação

1. Execute `ArtiSys-Almoxarifado-Setup-1.0.0.exe` para a release de base ou o instalador posterior que incorpore o P0.
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

A base principal do P0 é local e usa SQLite:

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

Base, documentos, configurações, logs e backups continuam no diretório de dados do usuário do Windows, separado da pasta de instalação do programa. Isso permite trocar os binários do aplicativo sem sobrescrever os dados operacionais.

## WMS / Coletor

A PWA possui a seção **WMS / Coletor**. Ela funciona no PC, celular ou tablet conectado à mesma rede local.

### Endereçamento

Cadastre a estrutura física do depósito usando os tipos disponíveis: zona, corredor, estante, nível, posição, recebimento e staging. O código do endereço deve ser único dentro do depósito.

Exemplo:

```text
ALM-01 / Z-A / C-03 / E-02 / N-04 / P-01
```

### Leitura e movimentação

O fluxo móvel recomendado é:

```text
Endereço -> produto -> quantidade -> ação -> confirmar
```

As operações disponíveis incluem receber, guardar/mover, retirar e devolver. A movimentação fica registrada localmente e mantém a posição física vinculada ao saldo consolidado do depósito.

### FIFO e FEFO

No cadastro do produto, escolha:

- `MANUAL` — operador escolhe a posição;
- `FIFO` — prioriza o item recebido há mais tempo;
- `FEFO` — prioriza o lote com validade mais próxima.

A opção **Sugerir retirada** gera o plano de separação. A recomendação não baixa o estoque automaticamente; a confirmação operacional continua obrigatória.

## Recebimento parcial

Em **WMS / Coletor > Recebimento parcial**, selecione o pedido, produto e informe a quantidade entregue. Opcionalmente discrimine:

- quantidade aceita;
- quantidade rejeitada;
- quantidade avariada;
- endereço de destino.

A soma de aceita + rejeitada + avariada deve ser igual ao total entregue. Apenas a quantidade aceita entra no estoque. Se ainda houver saldo a entregar, o pedido permanece como **recebido parcialmente** até a conclusão.

## Inventário cíclico

O inventário global tradicional continua disponível. Para contagens operacionais menores, use **WMS / Coletor > Inventário cíclico**.

A primeira contagem é cega: o operador não recebe o saldo esperado. Quando a opção de recontagem estiver ativa, uma divergência exige segunda contagem. Ao fechar a sessão, diferenças confirmadas geram ajuste auditável na posição correspondente.

## Backup e restauração

Em **Configurações**, use **Criar backup** para gerar um snapshot local. O backup completo inclui base e anexos locais. Antes de restaurar ou importar, o sistema gera um backup de segurança quando aplicável.

Mantenha cópias periódicas da pasta de backups em mídia/local seguro conforme a política da empresa.

## Atualização

A atualização 1.x é feita executando um novo instalador sobre a instalação existente. A atualização substitui arquivos do aplicativo e **não apaga os dados** armazenados no diretório de usuário.

A migração de JSON para SQLite ocorre automaticamente apenas quando aplicável e quando o banco SQLite ainda está vazio. Antes de qualquer atualização operacional, recomenda-se criar um backup pelo próprio sistema.

## Desinstalação

A desinstalação padrão remove o aplicativo instalado, mas **não remove os dados do usuário** automaticamente. Isso evita perder estoque, documentos e backups por uma desinstalação acidental.

A exclusão definitiva dos dados, quando desejada, deve ser feita separadamente pelo responsável depois de conferir os backups necessários.

## Leitor, câmera, impressora e balança

Leitor USB em modo teclado e captura por câmera fazem parte do produto. Integrações com balança/porta serial e impressão térmica são opcionais e dependem do hardware/driver disponível no computador.

A validação automatizada verifica software, API, interface, estoque e persistência. Essa evidência não substitui homologação física de modelos específicos de leitores, câmeras, impressoras ou balanças.

## Verificação do instalador

Junto ao instalador podem ser fornecidos:

- `SHA256SUMS.txt` — hash SHA-256;
- `release-manifest.json` — versão, commit, tamanho e hash do artefato.

Esses arquivos permitem conferir que o instalador recebido é exatamente o artefato aprovado no processo de release.
