# Entregas 06–09 — Design

## Objetivo
Concluir a camada operacional do MVP local do Almoxarifado: interface responsiva, operação compartilhada pela LAN, leitura de códigos e relatórios/impressão.

## Entrega 06 — Interface
SPA local sem framework obrigatório, servida pelo PC principal. Telas: dashboard, cadastros, movimentações, inventário e relatórios. A interface nunca é fonte de verdade; toda alteração passa pela API local.

## Entrega 07 — Operação em rede local
O mesmo processo Node serve os arquivos da PWA e uma API HTTP em `0.0.0.0`. Um repositório JSON atômico no PC principal persiste os dados e centraliza as alterações feitas por desktop, celular e tablet. O core não usa cloud.

## Entrega 08 — Barcode
Leitor USB funciona como teclado. Para celular/tablet, o usuário pode fotografar o código usando `capture=environment`; a foto é decodificada localmente pelo `html5-qrcode`. Nenhuma imagem é enviada para serviço externo.

## Entrega 09 — Relatórios
Dashboard, posição de estoque e histórico são derivados do repositório local. CSV com BOM UTF-8 abre no Excel. Impressão do navegador fornece impressão física ou salvar como PDF. Etiquetas são geradas para impressão local.

## Segurança e custo
Core R$ 0, self-hosted e sem serviço pago obrigatório. API e arquivos de dados ficam no host local. CI completo continua reservado para checkpoints/release.
