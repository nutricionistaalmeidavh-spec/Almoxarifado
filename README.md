# ArtiSys Almoxarifado

Sistema local-first de almoxarifado. O PC Windows atua como host principal e serve a PWA/API para desktop, celular e tablet na mesma LAN. O núcleo não depende de cloud nem de serviço pago.

## Entregas implementadas

### 01–09 — Núcleo operacional
Base Desktop/PWA, utilidades ArtiSys, modelagem, motor de estoque, inventário, interface, persistência LAN, código de barras, relatórios, impressão e etiquetas.

### 10 — Autenticação e permissões
- Primeiro acesso configura o administrador local.
- Senhas com `scrypt` + salt, sessões locais e expiração.
- Perfis: `ADMIN`, `ALMOXARIFE`, `COMPRAS`, `GESTOR`, `LEITURA`.
- Autorização server-side e auditoria pelo usuário autenticado.

### 11 — Backup e recuperação
- Backup manual e automático local.
- Backup pré-restauração/importação.
- Restauração validada e persistência atômica.
- Backups locais incluem também os arquivos em `.data/documents/`.
- Retenção configurável.

> `Exportar base` continua sendo exportação JSON da base. Os backups locais em `.data/backups/` são os snapshots completos que preservam também anexos binários.

### 12 — Compras e recebimento
Solicitação, cotação, aprovação, pedido, recebimento com entrada automática no estoque e histórico de custos.

### 13 — Centros de custo e obras
Centros de custo, obras/projetos, setores/departamentos, responsável pela retirada e vínculo auditável com movimentações.

### 14 — Estoque avançado
Reservas, físico × disponível, lote/validade, número de série, perdas, avarias, devoluções e transferências em trânsito com rastreabilidade.

### 15 — Custos e reposição
Custo médio, histórico de preços, estoque mínimo/alvo e sugestões de reposição considerando reservas.

### 16 — Documentos e anexos
- Arquivos locais em `.data/documents/`.
- PDF, JPEG, PNG, WebP e texto simples.
- Limite padrão de 15 MB.
- SHA-256 para integridade.
- Vínculo com produto, movimentação, fornecedor, solicitação, pedido ou recebimento.
- Download e exclusão auditável com autorização server-side.
- Nome fornecido pelo usuário nunca é usado como caminho físico.

### 17 — OCR local opcional
- Adapter para `@artisys/ocr`.
- Resultado persistido no documento com texto, confiança, blocos e candidatos extraídos.
- Prévia/revisão antes de qualquer uso operacional.
- OCR indisponível não bloqueia anexos nem recebimento manual.
- Nenhum serviço cloud é obrigatório.

### 18 — Relatórios avançados
- Curva ABC.
- Consumo por período.
- Produtos sem giro.
- Perdas e avarias.
- Valorização física/disponível e histórico de custo.
- Filtros por produto, categoria, depósito, fornecedor, centro de custo, obra, setor, usuário e responsável.
- JSON e CSV compatível com Excel.

### 19 — Hardware opcional
- Serial/balança via `@artisys/serialport`.
- Impressão térmica via `@artisys/printing`.
- Configurações locais e auditáveis.
- Falta de driver/dispositivo resulta em `unavailable`; o sistema continua funcionando normalmente.
- Impressão padrão do navegador/Desktop continua disponível como fallback.

### 20 — Desktop final
- Runtime operacional centralizado para base local, API, PWA, documentos, backup, hardware e OCR.
- `settings.json` local com rede, backup e hardware.
- Logs locais com rotação simples.
- Host Electron com `contextIsolation`, sandbox e `nodeIntegration` desativado.
- Mesma composição é reutilizada pelo modo web de desenvolvimento para reduzir divergência.
- O runtime operacional usa `.data/almoxarifado.json`; PocketBase permanece apenas como preparação/legado arquitetural e não é a fonte de dados do produto atual.

## Executar

```bash
git submodule update --init --recursive
npm install
```

### Desktop Windows

```bash
npm run desktop
```

### Host web/PWA local

```bash
npm run dev:web
```

No primeiro acesso, abra `http://localhost:4173` no PC principal e defina a senha do administrador com pelo menos 10 caracteres. Esse bootstrap inicial é aceito apenas em loopback. Depois, outros aparelhos da mesma LAN podem acessar `http://IP-DO-PC:4173` e autenticar normalmente.

## Dados locais

```text
.data/
├── almoxarifado.json
├── documents/
├── backups/
│   ├── almoxarifado-....json
│   └── almoxarifado-....assets/documents/
├── logs/
└── settings.json
```

A pasta `.data/` não deve ser versionada no Git.

## Verificação

```bash
npm test
npm run check
```

Gates mais pesados continuam explícitos e reservados para checkpoint/release:

```bash
npm run qa:validate
npm run security
npm run release:check
```

## Próxima entrega

**21 — Empacotamento Windows:** instalador `.exe`, upgrade, desinstalação e preservação segura da base local.

> Homologações físicas em máquinas, leitores, impressoras, balanças, celular/tablet e ambiente real do cliente não fazem parte desta etapa.
