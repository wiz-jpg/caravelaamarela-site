# Caravela Control | Centralização de emails — Fase 1 (Preview)

## Escopo aprovado (2026-10-16)
A Caravela Amarela pretende fazer booking num único workspace, reduzindo saltos entre
Zoho, histórico, contactos e oportunidades. **Não ativar envio** até aprovação e
testes dedicados de idempotência, consentimento e scopes de envio da Zoho.

### Entregue no PR #1 — branch feature/zoho-mail-readonly-oauth

- Email original fica no Zoho (OAuth read-only, cron isolado, sem alteração).
- `GET/POST/PATCH /api/control/mail/drafts` permite listar, guardar, editar,
  arquivar e restaurar textos **sem enviar mensagens**.
- Ligações manuais a um ID real de booking e/ou ID de mensagem recebida
  (validados no servidor). Não inferir artista, canal autorizado nem consenso.
- Cada edição cria nova **versão cifrada**; as anteriores são imutáveis.
- Cifragem AES-256-GCM com IV aleatório por versão e autenticação AAD
  (mailbox + ID + número da revisão). Chave independente **derivada por HKDF**
  de `ZOHO_TOKEN_KEY`, que já existe no Preview. O segredo não vai para
  JavaScript, D1, logs ou payloads devolvidos ao browser.
- Se `CONTROL_R2_BACKUP_ENABLED=true`, cada nova versão cifrada é
  copiada para `CONTROL_BACKUP_BUCKET` no prefixo privado
  `mail-drafts/v1/<id>/<revision>.json`, com SHA-256 e leitura de
  verificação **antes** de D1 ser atualizado. Se a cópia R2 falhar, a
  versão original permanece intacta no D1 e o guardado falha.
- Com R2 desativado, a API reporta `independent_backup_verified:false`;
  uma versão no D1 não equivale a backup offsite.
- O histórico de `control_audit` regista apenas ação, autor, ID e
  revisão, nunca texto de emails ou destinatários.
- O browser não guarda rascunhos em localStorage; texto guardado apenas no
  D1 cifrado e temporariamente na sessão autenticada, sob Cloudflare Access.
- Pré-visualização integrada em **Booking → Preparar emails** e atalhos nos
  cartões de booking/contactos e em respostas Zoho. O conteúdo é SEMPRE
  escrito/revisto por uma pessoa; não existe envio automático.
- A autorização técnica continua `admin/manager/viewer` (role-based).
  Scopes de equipa Ana/João ainda não estão aplicados, conforme pedido.
  Não conceder perfis manager para simular scopes pretendidos.
- O cofre de snapshots originais e históricos, Sheets e D1 existentes
  não são substituídos nem alterados.

## Única ativação D1 necessária

Executar **somente** em
Cloudflare D1 → `caravela-zoho-test` → Console o conteúdo exato de
`migrations/0007_control_mail_drafts.sql`.
É aditivo e idempotente: duas tabelas novas e índices, sem apagamentos.
Sem a migração, a interface informa `drafts_migration_required`,
não guarda nada e o cron Zoho continua a funcionar.

Antes da migração, verificar o nome da base no ecrã; **nunca Production**.

## Testes de aceitação antes de usar para booking real

1. Iniciar sessão no Preview e abrir Booking → Preparar emails.
2. Criar um rascunho dirigido ao próprio email de teste com texto fictício.
   Confirmar `Não enviado` e a inexistência de envio no Zoho.
3. Editar o rascunho; confirmar versão 2 e recuperar versão 1, sem apagar 2.
4. Arquivar e reabrir; validar que assunto, corpo e contexto persistem.
5. Se R2 está ativo, verificar sem divulgar o conteúdo que foi criado
   `mail-drafts/v1/<uuid>/<revision>.json`. Não expor tokens ou conteúdo.
6. Verificar as verificações GitHub: Node 22 / SQLite safety tests e
   Cloudflare Pages no HEAD do Draft PR.

## Restrições antes das fases 2 e 3

- **NÃO** adicionar Zoho Send OAuth scopes, `sendMail`, mailto automático,
  envio em lote, retry automático nem atualizações comerciais com base
  apenas em rascunhos.
- Envio futuro precisa de aprovação explícita, implementação separada,
  chaves/autorizações adequadas, dedupe e estado `uncertain` nos timeouts
  após possível aceitação do Zoho. Nunca repetir sem verificação externa.
- O backup R2 de drafts guarda cifrados; é necessário mecanismo documentado
  e testado de restauro antes de tratar isto como recuperação operacional
  completa após perda integral da D1.
- `ZOHO_TOKEN_KEY` **não pode ser rodada diretamente** depois de criar
  rascunhos cifrados; a rotação exige migração controlada com leitura da
  chave antiga e recifragem/verificação de todas as versões, incluindo R2.
- Antes do envio integrado, validar a compatibilidade do plano Zoho Mail Lite
  e permissões da API de escrita apenas em ambiente de testes e mediante
  autorização do utilizador.
