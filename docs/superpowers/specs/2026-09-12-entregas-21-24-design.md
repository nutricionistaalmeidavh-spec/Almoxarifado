# Entregas 21–24 — Design final de release

## Objetivo

Fechar o ArtiSys Almoxarifado como produto Windows distribuível, mantendo o núcleo local-first, sem dependência obrigatória de cloud, sem sistema de licença e sem bloqueio por ativação. A entrega final deve produzir um instalador `.exe`, validar automaticamente o máximo possível em GitHub Actions e publicar o artefato aprovado no Google Drive dentro da organização atual.

## Restrições obrigatórias

- Nenhum sistema de licença, chave, ativação, servidor de licença, limite por máquina ou bloqueio por assinatura.
- Dados do cliente permanecem locais e fora da pasta de instalação do aplicativo.
- Upgrade não pode apagar base, documentos, backups, configurações ou logs.
- Desinstalação padrão não deve remover dados do usuário sem ação explícita.
- GitHub Actions pode ser usado nesta etapa final para build e validação.
- A afirmação de usabilidade se limita a evidência automatizável: build, instalação silenciosa em runner, inicialização, API, UI/smoke, fluxos principais, persistência e integridade do artefato.
- Homologação física de leitor, câmera, impressora, balança e máquina de cliente continua fora do escopo.

## Runtime reproduzível

`vendor/utilidades` continua pinado como fonte/referência dos módulos reutilizáveis, mas é um repositório privado separado. O workflow de release não pode depender de credenciais implícitas para clonar outro repositório privado. Por isso, os módulos necessários ao binário distribuído possuem snapshots de release em `vendor/release-modules/`, derivados do pin aprovado de `utilidades`. O `package.json` do produto final referencia apenas esses snapshots locais e pacotes públicos com versão fixa. Isso torna build/CI autocontidos e não adiciona serviço cloud ao runtime do cliente.

## Entrega 21 — Instalador e atualização

### Empacotamento

Usar Electron + `electron-builder` com target NSIS para Windows x64. A versão final desta etapa será `1.0.0`.

O pacote deve:

- gerar `ArtiSys-Almoxarifado-Setup-1.0.0.exe`;
- instalar atalhos apropriados;
- manter `userData` separado da instalação;
- permitir upgrade/reinstalação sem apagar dados;
- incluir todos os módulos locais necessários ao runtime;
- não depender de Node.js instalado na máquina do usuário;
- não exigir Internet para operar depois de instalado.

### Política de atualização

Nesta versão, atualização é manual por novo instalador. Não haverá auto-updater remoto obrigatório. O instalador substitui binários e preserva o diretório de dados.

## Entrega 22 — QA automatizado final

Criar uma suíte de release em duas camadas.

### Camada Linux/Node

Executar testes unitários/integrados completos, verificações de sintaxe, validação QA, segurança e preflight de release.

### Camada Windows

Em `windows-latest`:

1. instalar dependências;
2. executar testes e checks;
3. gerar o instalador NSIS;
4. instalar silenciosamente o `.exe` em ambiente limpo do runner;
5. iniciar a aplicação instalada;
6. aguardar `/api/health`;
7. executar smoke automatizado sobre a UI/API instalada;
8. criar produto e entrada de estoque;
9. encerrar o app;
10. reinstalar o mesmo pacote sem apagar `userData`;
11. reiniciar e verificar que produto/saldo persistiram;
12. gerar artifact apenas se todos os gates anteriores estiverem verdes.

O smoke cobre, no mínimo: tela inicial/login, bootstrap do admin quando aplicável, carregamento da UI, criação de produto, entrada de estoque, leitura do dashboard e endpoint de saúde.

## Entrega 23 — Segurança e release

### Gates finais

- `npm run check`;
- `npm run qa:validate`;
- `npm run security`;
- auditoria de dependências de produção no workflow;
- `npm run release:check`;
- verificação de ausência de segredos versionados;
- geração de SHA-256 do instalador;
- `SHA256SUMS.txt`;
- `release-manifest.json` com versão, commit, artefato, tamanho e hash.

O release-check falha se o instalador esperado, hash ou manifesto estiver ausente/inconsistente no gate final.

### Segurança do Desktop

Manter `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true` e bloquear abertura arbitrária de janelas externas. Nenhuma credencial padrão é embutida no pacote.

## Entrega 24 — Distribuição comercial sem licença

A entrega comercial contém:

- instalador Windows final;
- `SHA256SUMS.txt`;
- manifesto da release;
- manual de instalação/primeiro acesso;
- README atualizado.

Não haverá versão demo bloqueada nem mecanismo de licença.

## Google Drive

Publicar dentro da organização existente:

`01 - Sistemas e Artisys / Almoxarifado / Atual`

Estrutura:

- `Atual/` — instalador final e arquivos de verificação;
- `Anterior/` — reservado para futuras versões substituídas;
- `Manuais/` — documentação de instalação/uso.

Se `Almoxarifado` ou subpastas não existirem, criá-las sob `01 - Sistemas e Artisys`.

O upload ocorre somente após o workflow final verde e conferência do hash.

## GitHub Actions

Workflow explícito de release final, acionado manualmente/tag ou pelo trigger de fechamento. Ele não roda em cada commit. Para provar a branch antes da integração, o mesmo trigger pode ser usado uma vez na branch final; após integração, a alteração do trigger em `main` valida novamente exatamente o commit distribuído.

O job Windows publica o instalador como artifact. O arquivo baixado desse artifact é o mesmo enviado ao Drive; não é reconstruído depois dos gates.

## Critério de conclusão

As entregas 21–24 só podem ser declaradas concluídas quando:

1. a suíte completa do commit final estiver verde;
2. o workflow Windows produzir o `.exe`;
3. a aplicação instalada passar pelo smoke automatizado;
4. SHA-256 e manifesto forem conferidos;
5. o commit final estiver integrado ao `main`;
6. o mesmo `.exe` aprovado estiver publicado em `01 - Sistemas e Artisys / Almoxarifado / Atual`.

Falha em qualquer gate impede publicação e conclusão.
