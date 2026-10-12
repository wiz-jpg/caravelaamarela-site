# Caravela Control — interface nova e contas individuais (Preview, fase 1)

**Âmbito:** apenas branch feature/zoho-mail-readonly-oauth / PR #1 (rascunho).
**Não fazer merge em main, nem implementar em Production sem auditoria e testes.**
**Cloudflare Access continua a proteger todo o Preview**, antes de qualquer pedido chegar ao Worker.

## O que foi implementado no código

- Nova interface responsiva: Visão geral, Contactos, Booking e ações, Artistas,
  Comunicações, Dados e backups, Equipa e acessos.
- Mantém os IDs originais, lógica de importação, decisões por artista, filtros,
  análise de emails e histórico. Não inclui dados privados estáticos.
- A interface carrega a versão ativa do cofre D1 após uma autenticação válida,
  se já existir. A versão original e a cópia R2 não são substituídas.
- Contas individuais com nomes de utilizador únicos e palavras-passe:
  PBKDF2-SHA256 (310.000 iterações, salt aleatório), sem palavras-passe em texto na D1.
- Sessões D1 com tokens aleatórios de 256 bits, SHA-256 no armazenamento,
  cookie __Host-, HttpOnly, Secure, SameSite=Strict, expiração em 24h.
- Requer origem igual à página e cabeçalho personalizado em operações de alteração.
- Tentativas inválidas limitadas por utilizador e IP durante 15 minutos.
- Administrador cria, desativa, muda funções e repõe palavras-passe;
  alterações sensíveis revogam sessões existentes.
- Primeira conta (admin) só pode ser criada uma vez e requer o token
  administrativo antigo. Depois, cada pessoa usa apenas nome e palavra-passe.
- Novas rotas privadas de autenticação sob /api/control/auth/.
- APIs do cofre verificam funções reais no servidor; não confiam nos menus ocultados.
- Zoho read-only admite sessão de Consulta/Gestor/Admin apenas nos endpoints
  de status/pastas/cabeçalhos; acesso a conteúdo de mensagem e OAuth permanece admin.
- A nova autenticação fica desativada até configurar CONTROL_AUTH_ENABLED=true.
  Antes disso, o Preview mantém uma opção de transição com o token antigo.

## Matriz efetiva de permissões (fase 1)

| Ação | Consulta | Gestor | Admin |
|---|---|---|---|
| Ver contactos, ações, artistas da versão ativa | Sim | Sim | Sim |
| Ver origem Sheets sincronizada | Sim | Sim | Sim |
| Consultar cabeçalhos Zoho | Sim | Sim | Sim |
| Solicitar atualização das fontes Zoho/Sheets | Não | Sim | Sim |
| Criar/ativar versões e descarregar backups | Não | Não | Sim |
| Criar/desativar contas, alterar funções, repor passwords | Não | Não | Sim |
| Ler corpos de emails pela API Zoho | Não | Não | Token técnico legado apenas |
| Enviar emails ou editar estado comercial no D1 | Não | Não | Não implementado |

**Importante:** funções não autorizam contactar promotores nem transformam
"email recebido" em resposta a proposta. Bloqueios são sempre por artista
e negociação, mesmo quando uma entidade aparece noutras ações.

## Migração / ativação (não executada pelo código)

1. Em Cloudflare D1, selecionar exclusivamente **caravela-zoho-test** e confirmar
   que existem as 10 tabelas control_ da migração 0003.
2. Guardar o bookmark de recuperação D1, como na migração anterior.
3. Aplicar migrations/0004_control_auth.sql na D1 de testes. O ficheiro só contém
   CREATE TABLE / CREATE INDEX IF NOT EXISTS. O Console D1 pode aceitar um
   comando por vez; ignorar linhas começadas por --. Esperado: mais 4 tabelas:
   control_auth_settings, control_users, control_sessions, control_login_attempts;
   e mais 2 índices.
4. Em Pages → caravelaamarela-site → Settings → Variables and secrets
   → **Preview** adicionar TEXT CONTROL_AUTH_ENABLED=true.
   Preservar CONTROL_VAULT_ENABLED=true, ZOHO_ENABLED=true, ZOHO_DB,
   ZOHO_ADMIN_TOKEN, CONTROL_BACKUP_BUCKET e CONTROL_R2_BACKUP_ENABLED=true.
5. Confirmar se existe um Preview deployment da branch atualizado. Não forçar
   deploy nem alterar Production sem consentimento do responsável.
6. Abrir https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev/crm-control.html
   com Cloudflare Access; ver formulário "Criar a primeira conta".
7. Inserir uma única vez o token administrativo **no browser**, nunca em chats,
   repositório ou screenshots, escolher utilizador e password forte (12+ chars).
8. Entrar; confirmar que "Visão geral" mostra a base ativa e filtros existentes;
   testar login após atualizar a página, recuperar backup e logout.
9. Em "Equipa e acessos" criar colegas com password temporária. Cada um deve
   alterá-la no primeiro login. Proteger envio das credenciais entre pessoas.
10. No Cloudflare One Access → Applications → política do Preview, adicionar
    **explicitamente o email de cada colega** autorizado, sem permitir
    Everyone nem domínios inteiros indiscriminadamente. Login de aplicação
    **não substitui** o login por email exigido por Cloudflare Access.
    Testar primeiro com uma conta de Consulta, depois com Gestor.
11. Confirmar que conta Consulta não vê nem executa ações administrativas,
    que Gestor consegue apenas sincronizar fontes e que desativar uma conta
    termina sessões imediatamente. Testar recuperação da base D1 e cópia R2.

## Rotas novas (todas HTTPS e só Preview)

GET  /api/control/auth/bootstrap-status (sem sessão; exige Cloudflare Access)
POST /api/control/auth/bootstrap        (token técnico original, uma vez)
POST /api/control/auth/login
GET  /api/control/auth/me
POST /api/control/auth/logout
POST /api/control/auth/change-password
GET  /api/control/auth/users            (admin)
POST /api/control/auth/users            (admin)
PATCH /api/control/auth/users/:id       (admin)

Alterações exigem X-Caravela-Request: 1 e política de mesma origem.
Só o browser guarda um cookie HttpOnly. Não usar localStorage para tokens.
Os dados da versão V3 não são migrados, alterados nem duplicados por esta fase.

## Limites e avisos

- O login com utilizador/password é **uma segunda camada** atrás de Access
  no Preview: os colegas precisam ser adicionados às duas listas.
- Existem rotas técnicas antigas por Bearer token para compatibilidade e
  recuperação; não distribuir esse token à equipa. Considerar a remoção
  dessas rotas só após testes completos de todas as operações.
- As permissões são globais por função, não por artista ou pasta de email.
- Gestores não editam ainda os estados comerciais diretamente; essa é uma fase
  futura que deverá criar eventos auditáveis sem sobrepor as fontes originais.
- Autenticação individual não liga Google Sheets ou Gmail automaticamente.
  A integração Sheets exige a conta de serviço e permissões read-only próprias.
- A infraestrutura exige testar o código no Preview após aplicar a migração,
  incluindo o tempo real de PBKDF2 no Cloudflare Workers, proteção Access,
  expiração das sessões, browser mobile, e recuperação D1/R2.
- O R2 é usage-billed mesmo que o uso previsto caiba na oferta gratuita;
  manter alertas de custo. Não garantir custo zero para sempre.
