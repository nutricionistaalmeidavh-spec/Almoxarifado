# Entregas 10–15 — Design

## Objetivo
Fechar o núcleo operacional do produto completo até custos/reposição sem introduzir dependência cloud ou serviço pago obrigatório.

## Invariantes
- Local-first e self-hosted.
- Compatibilidade com a base JSON existente: coleções novas ausentes iniciam vazias.
- Senhas nunca persistem em texto puro.
- Autorização é aplicada na API; a UI não é fronteira de segurança.
- O usuário de auditoria vem da sessão autenticada, nunca do `userId` informado pelo cliente.
- Operações multi-etapa de estoque/compra usam transação do repositório.
- Restauração/importação cria backup de segurança antes de substituir a base.
- Nenhum CI remoto é necessário durante estas entregas.

## Entrega 10 — Autenticação/RBAC
`scrypt` + salt, sessão local expirada, perfis e permissões server-side, primeiro acesso para definir senha do admin e criação de usuários pelo administrador.

## Entrega 11 — Backup
JSON versionado, escrita atômica, backup manual/automático, retenção, export/import e restauração validada.

## Entrega 12 — Compras
Solicitação → cotação → aprovação → pedido → recebimento. Recebimento gera entrada auditável e histórico de preços.

## Entrega 13 — Gestão
Centro de custo, projeto/obra, setor/departamento e responsável vinculáveis aos movimentos.

## Entrega 14 — Estoque avançado
Reserva, lote, validade, série, perda, avaria, devolução e transferência em trânsito.

## Entrega 15 — Custos/reposição
Custo médio ponderado no recebimento, histórico de preços e sugestão por mínimo/alvo considerando reservas.
