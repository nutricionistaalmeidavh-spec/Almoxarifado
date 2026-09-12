# Manual de instalação — ArtiSys Almoxarifado 1.0.0

## Requisitos

- Windows 10 ou 11 x64.
- Computador principal ligado durante o uso por outros dispositivos na rede local.
- Não é necessário instalar Node.js para usar o instalador final.
- O sistema funciona sem Internet após a instalação; Internet não é requisito do núcleo.

## Instalação

1. Execute `ArtiSys-Almoxarifado-Setup-1.0.0.exe`.
2. Confirme a instalação para o usuário atual.
3. Ao concluir, abra **ArtiSys Almoxarifado** pelo atalho da Área de Trabalho ou Menu Iniciar.
4. O aplicativo inicia o servidor local e abre a interface do almoxarifado.

O produto é distribuído **sem licença**, chave, ativação, limite por máquina ou servidor de licença.

## Primeiro acesso

No primeiro acesso feito no PC principal:

1. informe uma senha de administrador com pelo menos 10 caracteres;
2. confirme o cadastro inicial;
3. depois disso, entre com o usuário `admin` e a senha definida pelo responsável.

A senha não vem pronta dentro do instalador.

## Rede local

O PC Windows principal é o host. Celulares e tablets na mesma rede local podem acessar:

```text
http://IP-DO-PC:4173
```

O PC principal precisa permanecer ligado enquanto outros dispositivos usam o sistema. A operação do núcleo não depende de cloud.

## Dados

Base, documentos, configurações, logs e backups ficam no diretório de dados do usuário do Windows, separado da pasta de instalação do programa. Isso permite trocar os binários do aplicativo sem sobrescrever os dados operacionais.

## Backup e restauração

Em **Configurações**, use **Criar backup** para gerar um snapshot local. O backup completo inclui base e anexos locais. Antes de restaurar ou importar, o sistema gera um backup de segurança quando aplicável.

Mantenha cópias periódicas da pasta de backups em mídia/local seguro conforme a política da empresa.

## Atualização

A atualização 1.x é feita executando um novo instalador sobre a instalação existente. A atualização substitui arquivos do aplicativo e **não apaga os dados** armazenados no diretório de usuário.

Antes de qualquer atualização operacional, recomenda-se criar um backup pelo próprio sistema.

## Desinstalação

A desinstalação padrão remove o aplicativo instalado, mas **não remove os dados do usuário** automaticamente. Isso evita perder estoque, documentos e backups por uma desinstalação acidental.

A exclusão definitiva dos dados, quando desejada, deve ser feita separadamente pelo responsável depois de conferir os backups necessários.

## Leitor, câmera, impressora e balança

Leitor USB em modo teclado e captura por câmera fazem parte do produto. Integrações com balança/porta serial e impressão térmica são opcionais e dependem do hardware/driver disponível no computador.

A release automatizada valida software, instalação, inicialização, API, interface, estoque e persistência. Essa evidência não substitui homologação física de modelos específicos de leitores, câmeras, impressoras ou balanças.

## Verificação do instalador

Junto ao instalador podem ser fornecidos:

- `SHA256SUMS.txt` — hash SHA-256;
- `release-manifest.json` — versão, commit, tamanho e hash do artefato.

Esses arquivos permitem conferir que o instalador recebido é exatamente o artefato aprovado no processo de release.
