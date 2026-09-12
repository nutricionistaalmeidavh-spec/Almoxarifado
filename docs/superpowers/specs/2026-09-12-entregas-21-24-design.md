# Entregas 21–24 — Design final de release

## Objetivo

Fechar o ArtiSys Almoxarifado como produto Windows distribuível, mantendo o núcleo local-first, sem dependência obrigatória de cloud, sem sistema de licença e sem bloqueio por ativação. A entrega final deve produzir um instalador `.exe`, validar automaticamente o máximo possível em GitHub Actions e publicar o artefato aprovado no Google Drive dentro da organização atual.

## Restrições obrigatórias

- Nenhum sistema de licença, chave, ativação, servidor de licença, limite por máquina ou bloqueio por assinatura.
- Dados do cliente permanecem locais e fora da pasta de instalação do aplicativo.
- Upgrade não pode apagar `.data`, documentos, backups, configurações ou logs.
- Desinstalação padrão não deve remover dados do usuário sem ação explícita.
- GitHub Actions pode ser usado nesta etapa final para build e validação.
- A afirmação de usabilidade se limita a evidência automatizável: build, instalação silenciosa em runner, inicialização, API, UI/smoke, fluxos principais, backup/restore e integridade do artefato.
- Homologação física de leitor, câmera, impressora, balança e máquina de cliente continua fora do escopo.

## Entrega 21 — Instalador e atualização

### Empacotamento

Usar Electron + `electron-builder` com target NSIS para Windows x64. A versão final desta etapa será `1.0.0`.

O pacote deve:

- gerar `ArtiSys-Almoxarifado-Setup-1.0.0.exe`;
- instalar atalhos apropriados;
- manter `userData` separado da instalação;
- permitir upgrade sobre versão anterior sem apagar dados;
- incluir todos os módulos locais necessários ao runtime;
- não depender de Node.js instalado na máquina do usuário;
- não exigir Internet para operar depois de instalado.

### Política de atualização

Nesta versão, atualização é manual por novo instalador. Não haverá auto-updater remoto obrigatório. O instalador deve substituir binários do aplicativo e preservar o diretório de dados.

## Entrega 22 — QA automatizado final

Criar uma suíte de release em duas camadas.

### Camada Linux/Node

Executar:

- `npm ci`;
- testes unitários/integrados completos;
- verificações de sintaxe;
- validação de configuração QA;
- testes de domínio/API/UI já existentes.

### Camada Windows

Em `windows-latest`:

1. instalar dependências;
2. executar testes compatíveis com Windows;
3. gerar o instalador NSIS;
4. instalar silenciosamente o `.exe` em ambiente limpo do runner;
5. iniciar o aplicativo/runtime instalado;
6. aguardar `/api/health` responder;
7. executar smoke automatizado sobre a aplicação instalada;
8. validar backup/restore com diretório temporário;
9. encerrar o app;
10. validar preservação dos dados após reinstalação/upgrade do mesmo pacote;
11. gerar artefato do workflow apenas se os gates anteriores estiverem verdes.

O smoke deve cobrir, no mínimo: tela inicial/login, bootstrap do admin quando aplicável, carregamento da UI, criação de produto, entrada de estoque, leitura do dashboard e endpoint de saúde.

## Entrega 23 — Segurança e release

### Gates finais

- `npm run check`;
- `npm run qa:validate`;
- `npm run security`;
- `npm run release:check`;
- verificação de ausência de segredos versionados;
- geração de SHA-256 do instalador;
- arquivo `SHA256SUMS.txt` junto do artefato;
- release manifest contendo versão, commit, nome do artefato, tamanho e hash.

O release-check deve falhar se o instalador esperado estiver ausente ou se algum gate obrigatório não tiver evidência.

### Segurança do Desktop

Manter `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true` e bloquear abertura arbitrária de janelas externas. Nenhuma credencial padrão será embutida no pacote.

## Entrega 24 — Distribuição comercial sem licença

A entrega comercial conterá apenas:

- instalador Windows final;
- `SHA256SUMS.txt`;
- manifesto da release;
- manual de instalação/primeiro acesso em formato simples no repositório;
- README atualizado.

Não haverá versão demo bloqueada nem mecanismo de licença.

## Google Drive

Publicar dentro da organização existente:

`01 - Sistemas e Artisys / Almoxarifado / Atual`

Estrutura desejada:

- `Atual/` — instalador final e arquivos de verificação;
- `Anterior/` — reservado para futuras versões substituídas;
- `Manuais/` — documentação de instalação/uso.

Se `Almoxarifado` ou subpastas ainda não existirem, criá-las sob `01 - Sistemas e Artisys`.

O upload ao Drive ocorre somente após o workflow final estar verde e o hash do artefato ser conferido.

## GitHub Actions

Criar workflow explícito de release final, acionável por `workflow_dispatch` e/ou tag `v*`. Não criar execução em cada commit. Isso preserva minutos e segue a regra de CI apenas no fechamento.

O workflow Windows deve publicar o instalador como artifact do GitHub Actions. O arquivo baixado desse artifact será o mesmo enviado ao Drive; não será reconstruído fora do workflow depois dos gates.

## Critério de conclusão

As entregas 21–24 só podem ser declaradas concluídas quando:

1. a suíte completa executada no commit final estiver verde;
2. o workflow Windows produzir o `.exe`;
3. a aplicação instalada responder ao smoke automatizado;
4. SHA-256 e manifesto forem gerados e conferidos;
5. o commit final estiver integrado ao `main`;
6. o mesmo `.exe` aprovado pelo workflow estiver publicado em `01 - Sistemas e Artisys / Almoxarifado / Atual`.

Falha em qualquer gate impede publicação e conclusão.