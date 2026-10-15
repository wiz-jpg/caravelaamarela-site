# Caravela Control — MVP operacional nativo (Preview)
Atualização: 15/10/2026. Apenas a branch feature/zoho-mail-readonly-oauth / PR #1.
NÃO fazer merge nem publicar o website público. Nunca ativar envio automático.

## O que passou a existir
- Contactos editáveis (novos ou continuação explícita das fichas V3), políticas de contacto,
  emails, local, notas e próxima revisão.
- Booking nativo: entidade, artista, evento, estado declarado por humano, cachet EUR,
  despesas/condições, responsável, evidência, data de próximo passo.
- Filtros e pesquisa nas duas áreas; dashboard Trabalho diário com negociações/prioridades.
- Arquivo ativo D1 lido automaticamente por administrador; ações antigas mantidas imutáveis.
  "Retomar" cria uma nova ficha operacional com referência à linha original.
- Histórico de edições append-only em control_decision_events, trilho em control_audit.
- D1 já tem ambas as tabelas via migrations/0003_control_vault.sql: não há migrações novas.
- Exportação administrativa JSON de todos os eventos CRM nativos em Dados e backups.
- Perfis manager podem editar registos operacionais; raw archive/export exclusivos de admin.
- O Zoho continua somente leitura e não altera estados comerciais nem envia emails.
- Google Sheets não é requisito para criar, alterar ou consultar as novas fichas.

## Contratos
GET /api/control/native/contacts e /booking: lista de fichas editáveis.
POST /api/control/native/contacts ou /booking: cria nova ficha e evento.
PATCH: requer id e revision devolvida no GET; falha com 409 se outra sessão a editou.
GET /api/control/native/archive: projeção mínima da versão ativa (admin).
GET /api/control/native/export: backup administrativo completo dos eventos nativos, não das fontes.
Todas as rotas são privadas e exigem sessão manager/admin ou token administrativo legado
(comportamento de transição). Cookies/Zoho OAuth não são expostos no JS.
Origin + X-Caravela-Request:1 são obrigatórios para escrever.
Estados "sent_verified" e "confirmed" exigem referência e evidência humana.
Arquivo suprimido/bloqueado não pode ser promovido silenciosamente a permitido.

## Testes realizados e pendentes
- Análise de sintaxe das alterações JavaScript: executada com parser V8.
- Teste de validação: contactos e negociações válidos aceites; status confirmado sem evidência
  e emails inválidos rejeitados.
- SQL compare-and-append concorrente simulado com SQLite: uma atualização com revision
  obsoleta não inseriu segundo evento.
- Adicionado tests/control-native.test.mjs; a CI de GitHub para novos commits ainda não
  disponibilizou resultados, não afirmar que passou.
- NÃO foi efetuada prova ponta-a-ponta autenticada na Cloudflare Preview nesta alteração.
- Teste manual ainda necessário: abrir Preview, entrar, consultar Contactos, criar ficha
  de teste, editar, retomar uma ação em Booking, guardar próximo passo e confirmar reload
  + verificar export JSON. Não usar destinatário real nem declarar envio inexistente.
- Preservar Sheets anteriores sem editar até reconciliar versão final.
- Limites MVP: não há atribuição de tarefas com notificações, faturação, upload de
  contratos, gestão completa de artistas nem associação automática de threads Zoho.
  As cópias R2 existentes protegem snapshots históricos; as novas decisões CRM
  necessitam de exportação manual até configurar backup periódico próprio.
