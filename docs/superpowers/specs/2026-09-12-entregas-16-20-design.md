# Design — Entregas 16 a 20

Data: 2026-09-12
Branch: `feat/entregas-16-20`

## Objetivo

Evoluir o ArtiSys Almoxarifado das entregas 1–15 para um produto comercial local-first com documentos/anexos, OCR local, relatórios avançados, integração opcional com hardware e runtime Desktop Windows final. O núcleo deve permanecer self-hosted, sem cloud obrigatória e sem dependência paga.

## Restrições

- Host principal: Windows Desktop.
- PWA/API disponíveis na LAN sem internet obrigatória.
- Dados operacionais permanecem locais.
- Serviços pagos/cloud podem existir apenas como extensões opcionais, nunca como dependência do fluxo principal.
- Reusar módulos de `vendor/utilidades` por adapters, evitando acoplamento do domínio a bibliotecas de terceiros.
- Não executar homologação física de impressoras, balanças, leitores, celular/tablet ou máquinas reais nesta etapa.
- Não executar CI remoto durante desenvolvimento intermediário; gates pesados ficam para checkpoint/release.

## Arquitetura

As novas capacidades serão divididas em serviços de domínio e adapters de plataforma:

1. `documents`: metadados, vínculo com entidades e lifecycle de anexos.
2. `ocr`: contrato interno de extração e adapter para `artisys-ocr`.
3. `analytics`: cálculos e relatórios avançados sobre dados já persistidos.
4. `hardware`: contratos opcionais para serial, balança e impressão térmica.
5. `desktop-runtime`: composição final do host Windows, API local, logs, settings e lifecycle.

Nenhum módulo externo será importado diretamente pelo domínio de estoque, compras ou inventário. Integrações ficam atrás de adapters locais.

## Entrega 16 — Documentos e anexos

### Escopo

- Diretório local padrão `.data/documents/`.
- Metadados persistidos em coleção `documents`.
- Tipos aceitos inicialmente: PDF, imagens JPEG/PNG/WebP e arquivos de texto simples.
- Limite de tamanho configurável, com default conservador.
- Hash SHA-256 por arquivo para integridade e deduplicação opcional.
- Vínculo genérico por `entityType` + `entityId`.
- Entidades suportadas inicialmente: produto, movimentação, solicitação de compra, pedido, recebimento e fornecedor.
- Listagem, download e exclusão lógica/física controlada por permissão.
- Fotos e comprovantes passam pelo mesmo contrato.

### Regras

- Nome do arquivo fornecido pelo usuário nunca será usado como caminho físico.
- O storage usará IDs internos e diretório controlado.
- Downloads devem validar autorização e resolver arquivos apenas dentro do diretório permitido.
- Exclusão deve remover metadado e arquivo de forma consistente, com tratamento para ausência física.

## Entrega 17 — OCR e automação de recebimento

### Escopo

- Adapter para `@artisys/ocr`/módulo equivalente pinado em `vendor/utilidades`.
- OCR executado localmente quando engine local estiver disponível.
- Entrada: documento anexado.
- Saída persistida como `ocrResult` associado ao documento.
- Resultado contém texto bruto, campos candidatos e confiança quando disponível.
- Para NF/recibos, extrair candidatos como fornecedor, documento, data, número, itens, quantidades e valores quando o adapter conseguir identificar.
- A extração nunca grava estoque ou financeiro automaticamente.
- Usuário deve revisar e confirmar antes de transformar dados OCR em recebimento/cadastro.

### Fallback

- Se OCR local não estiver disponível, o documento continua válido e utilizável.
- A API informa `OCR_UNAVAILABLE` sem bloquear anexos ou recebimentos manuais.

## Entrega 18 — Relatórios avançados

### Relatórios

- Curva ABC por valor movimentado/consumido no período.
- Consumo por produto e período.
- Produtos sem giro.
- Perdas e avarias.
- Valorização histórica de estoque.
- Histórico de custo por produto/fornecedor.
- Movimentações por centro de custo, obra/projeto, setor/departamento, responsável e usuário.
- Posição física versus disponível considerando reservas.

### Filtros

- Período.
- Produto/categoria.
- Depósito.
- Fornecedor.
- Centro de custo.
- Projeto/obra.
- Departamento.
- Usuário/responsável.

### Saídas

- JSON para UI.
- CSV compatível com Excel.
- Impressão/PDF via fluxo existente.

## Entrega 19 — Hardware opcional

### Serial/balança

- Adapter para `@artisys/serialport`.
- Listagem de portas disponíveis.
- Configuração local persistida de porta, baud rate e perfil.
- Perfil inicial de balança para leitura de peso.
- Contrato genérico para dispositivos seriais futuros.
- Ausência do módulo, driver ou hardware deve resultar em estado `unavailable`, nunca derrubar o servidor.

### Impressão térmica

- Adapter para `@artisys/printing`.
- Impressão de etiquetas/recibos térmicos como opção adicional.
- Fallback obrigatório para impressão padrão do navegador/Desktop.
- QR Code pode ser usado em etiquetas quando houver biblioteca local já disponível ou implementação sem serviço externo.

### Segurança operacional

- Operações de hardware exigem permissão específica.
- Configuração de porta/dispositivo é administrativa.

## Entrega 20 — Desktop final

### Runtime

- Transformar `apps/desktop` de plano/runtime foundation em host operacional do produto.
- Inicializar storage, repositório, API e web server locais.
- Abrir a interface web local dentro do Desktop Shell.
- Lifecycle seguro de start/stop.
- Porta configurável com detecção de conflito e erro claro.
- Diretório de dados derivado de pasta de aplicação do usuário, com override por configuração/env para desenvolvimento.
- Logs locais rotacionáveis/simples, sem dados sensíveis desnecessários.
- Settings locais para rede, backup, impressora e serial.

### Atualização e instalador

A Entrega 20 deixa o runtime pronto para empacotamento, mas o instalador `.exe`, upgrade/desinstalação e release distribuível continuam pertencendo à Entrega 21.

## Permissões

Novas permissões mínimas:

- `documents.view`
- `documents.manage`
- `ocr.run`
- `analytics.view`
- `hardware.use`
- `hardware.configure`
- `desktop.settings`

`ADMIN` mantém acesso total. Perfis existentes recebem somente permissões coerentes com seu papel.

## Modelo de dados adicional

### `documents`

Campos principais:
- `id`
- `entityType`
- `entityId`
- `kind`
- `originalName`
- `storageName`
- `mimeType`
- `size`
- `sha256`
- `createdAt`
- `createdBy`
- `deletedAt`
- `deletedBy`
- `ocrStatus`
- `ocrResult`

### `hardware_settings`

Campos principais:
- `id`
- `kind`
- `name`
- `enabled`
- `config`
- `updatedAt`
- `updatedBy`

A persistência JSON local atual continuará suportada; o schema declarativo deve ser atualizado de forma compatível.

## API

### Documentos

- `POST /api/documents`
- `GET /api/documents?entityType=&entityId=`
- `GET /api/documents/:id/download`
- `DELETE /api/documents/:id`

### OCR

- `POST /api/documents/:id/ocr`
- `GET /api/documents/:id/ocr`

### Analytics

- `GET /api/analytics/abc`
- `GET /api/analytics/consumption`
- `GET /api/analytics/no-movement`
- `GET /api/analytics/losses`
- `GET /api/analytics/valuation`
- `GET /api/analytics/movements`

Cada rota aceita filtros relevantes por query string e exportação CSV quando aplicável.

### Hardware

- `GET /api/hardware/status`
- `GET /api/hardware/serial/ports`
- `POST /api/hardware/scale/read`
- `POST /api/hardware/print`
- `GET /api/hardware/settings`
- `POST /api/hardware/settings`

## UI

Adicionar navegação sem reestruturar o shell atual:

- `Documentos` contextual nas telas de produto, compra, recebimento e movimentação.
- `Relatórios` ganha filtros e relatórios avançados.
- `Configurações` ganha hardware, backup, rede e preferências Desktop.
- OCR aparece como ação no documento e sempre mostra prévia/revisão antes de qualquer aplicação de dados.

A UI continua responsiva e mobile-first para a PWA.

## Tratamento de erros

- Arquivo inválido: `INVALID_DOCUMENT`.
- Arquivo grande: `DOCUMENT_TOO_LARGE`.
- Documento inexistente: `DOCUMENT_NOT_FOUND`.
- OCR indisponível: `OCR_UNAVAILABLE`.
- Hardware indisponível: `HARDWARE_UNAVAILABLE`.
- Porta serial inválida/ocupada: erro específico do adapter convertido para domínio/plataforma.
- Impressão falha: resposta de erro sem alterar estado de estoque/compras.

## Testes automatizados

### Domínio

- vínculo e lifecycle de documento;
- proteção contra path traversal;
- hash e metadados;
- OCR adapter e fallback;
- cálculos ABC, consumo, sem giro, perdas e valuation;
- contratos de hardware com adapters fake;
- permissões das novas rotas.

### Integração

- upload/download/delete pela API local;
- OCR mock/fake sem hardware ou processo externo;
- analytics JSON/CSV;
- hardware indisponível não quebra bootstrap/API;
- runtime Desktop inicia e encerra componentes com doubles quando necessário.

### Fora de escopo nesta etapa

- testes em impressora física;
- testes em balança física;
- validação de drivers Windows reais;
- homologação manual em celular/tablet;
- instalador Windows final.

## Critérios de aceite

A etapa é considerada concluída quando:

1. Entregas 16–20 estão acessíveis por serviços/API/UI compatíveis com o fluxo atual.
2. Dados e arquivos permanecem locais por padrão.
3. OCR e hardware são opcionais e não impedem operação manual.
4. Permissões são aplicadas server-side.
5. Relatórios produzem resultados determinísticos e exportáveis.
6. Desktop final consegue compor o host local sem depender de cloud.
7. Testes automatizados afetados ficam verdes localmente.
8. README e documentação refletem as novas capacidades.
9. Nenhum CI remoto é disparado durante entregas intermediárias.

## Próxima etapa

Entrega 21: empacotamento Windows, instalador `.exe`, upgrade, desinstalação e preservação segura da base local.
