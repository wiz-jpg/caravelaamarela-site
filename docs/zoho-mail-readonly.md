# Zoho Mail — integração de leitura

Implementado no `_worker.js` existente; desativado por defeito. Apenas a branch
`feature/zoho-mail-readonly-oauth`. Sem merge, deploy ou alterações de produção.
Os formulários, notícias e `_routes.json` mantêm o comportamento anterior.

## Configuração Cloudflare (não aplicada)

Antes de futuros pushes, excluir esta branch das preview deployments em
Workers & Pages → caravelaamarela-site → Settings → Builds / Branch control.
O PR tinha uma preview automática anterior a esta implementação. O commit desta
implementação usa o prefixo `[CF-Pages-Skip]` para não publicar uma nova preview.
Não voltar a executar um deployment manualmente. Manter produção em `main`.

Para testes reais FUTUROS, depois de autorizar uma infraestrutura de teste:

| Nome | Tipo | Valor / finalidade |
| --- | --- | --- |
| `ZOHO_ENABLED` | variável | `false` inicialmente; `true` só no ambiente de teste autorizado |
| `ZOHO_REGION` | variável | `eu` ou `us`, confirmar no Zoho; não inferir pela localização do utilizador |
| `ZOHO_REDIRECT_URI` | variável | `https://<host-de-teste>/api/zoho/callback`, exatamente igual no Zoho |
| `ZOHO_CLIENT_ID` | segredo | Client ID de um cliente **Server-based Application** dedicado |
| `ZOHO_CLIENT_SECRET` | segredo | Client secret desse cliente |
| `ZOHO_ADMIN_TOKEN` | segredo | 32 bytes aleatórios em base64url (43 caracteres), independente dos outros segredos |
| `ZOHO_TOKEN_KEY` | segredo | 32 bytes aleatórios em base64 padrão (44 caracteres), chave AES-256-GCM |
| `ZOHO_DB` | binding D1 | base de teste isolada, com `migrations/0001_zoho.sql` aplicada |

Gerar os dois valores aleatórios separadamente, no próprio computador, com
`openssl rand -base64 32`; para o admin converter `+` em `-`, `/` em `_` e remover `=`.
Introduzir no gestor de segredos Cloudflare, nunca no repositório, chat, URL ou
localStorage. Não usar os valores fictícios dos testes.

A migração não foi executada remotamente. Aplicá-la primeiro numa D1 de teste via
console D1 ou Wrangler (`wrangler d1 execute <base-de-teste> --remote --file=migrations/0001_zoho.sql`).
Um futuro binding `ZOHO_DB` pode apontar à D1 existente, mas testes não devem usar
a D1 de produção. As tabelas novas são independentes das de notícias/contactos.
Não são criadas automaticamente por pedidos HTTP.

A URI de produção anteriormente planeada era
`https://caravelaamarela.com/api/zoho/callback`. Não a usar para testar esta branch:
esse host continua a executar o worker de produção. Registar a URI de teste no
cliente OAuth dedicado, no centro de dados correto. O código suporta EU/US;
outros centros de dados exigem revisão explícita da allowlist.

## API administrativa

Todas as rotas abaixo (exceto callback e página final genérica) exigem
`Authorization: Bearer <ZOHO_ADMIN_TOKEN>`. Não há CORS nem tokens na query string.
É autenticação por segredo administrativo, não um login multiutilizador.
Adicionar limitação de pedidos no Cloudflare a `/api/zoho/*` antes da ativação;
Cloudflare Access pode servir como camada adicional, sem substituir o Bearer.

| Método e rota | Função |
| --- | --- |
| `POST /api/zoho/authorize` | Cria state/cookie e devolve `authorizationUrl` |
| `GET /api/zoho/callback` | Consome state vinculado ao browser, troca código, valida caixa e guarda tokens |
| `GET /api/zoho/status` | Indica presença de ligação guardada (não é um teste de validade do token) |
| `GET /api/zoho/folders` | Lista pastas da conta validada |
| `GET /api/zoho/messages?folderId=…&start=1&limit=50` | Lista mensagens; limite máximo 100 |
| `GET /api/zoho/content?folderId=…&messageId=…` | Devolve conteúdo em JSON, sem o renderizar |

Para iniciar no browser, abrir uma página no host de teste autorizado e executar
na consola (o prompt evita colocar o segredo no código ou histórico):

```js
const authorization = await fetch('/api/zoho/authorize', {
  method: 'POST',
  headers: { Authorization: `Bearer ${prompt('Token administrativo')}` }
});
const result = await authorization.json();
if (authorization.ok) location.assign(result.authorizationUrl);
else console.error(result.error);
```

O cookie HttpOnly deve permanecer no mesmo browser até ao callback. O callback
não necessita do Bearer: exige o state de utilização única e o segredo do browser
emitidos por um pedido administrativo autenticado. Não basta copiar a URL para
outro browser. O state expira em 10 minutos. Consentimento recusado exige reiniciar.
Após sucesso, 303 remove o código do endereço; a página final é genérica.

## Segurança e limitações

- Scopes fixos: `ZohoMail.accounts.READ`, `ZohoMail.folders.READ`, `ZohoMail.messages.READ`.
  Só GETs para a API Mail; POST apenas para obter/renovar OAuth. Sem envio,
  alteração de flags, marcação como lido, eliminação ou escrita no Google Sheets.
- Cliente OAuth dedicado: não reutilizar concessões antigas com permissões maiores.
  Se o Zoho devolver scopes, estes são validados; se os omitir, aplicam-se os
  scopes fixos pedidos ao cliente dedicado. Não permite importar tokens antigos.
- Conta validada como `ZOHO_ACCOUNT`, email principal exato
  `booking@caravelaamarela.com`. Account ID é sempre escolhido pelo servidor e
  guardado cifrado; aliases/contas externas não autorizam outra caixa.
- Access e refresh tokens cifrados AES-256-GCM, IV aleatório por escrita, AAD
  vinculado ao email, cliente e região. D1 não guarda tokens em claro.
- State e cookie apenas como hashes em D1; DELETE RETURNING consome atomicamente.
- Renovação com lock em D1 entre isolates; contenção devolve 503
  `refresh_in_progress` (voltar a tentar após alguns segundos). Lock expira em 60 s.
- Tokens inválidos/revogados exigem nova autorização; não há retries ilimitados.
  Um access token revogado antes da expiração também pode exigir reautorização.
- Não há logs de aplicação com códigos, tokens ou mensagens. Verificar também
  retenção/redação em logs HTTP externos: callbacks transportam códigos na URL.
- Respostas não cacheáveis. Não renderizar HTML recebido de emails com innerHTML;
  uma futura UI precisa de sanitização e isolamento próprios.
- Desligar imediatamente: `ZOHO_ENABLED=false`; revogar a concessão na conta Zoho,
  depois apagar apenas as linhas das duas tabelas Zoho. Sem endpoint de revogação.
- Rodar chave AES exige apagar a ligação e reautorizar (ou migração cifrada própria).
  Alterar região/client ID também invalida os tokens guardados. Rotação admin
  invalida o Bearer anterior; estados já emitidos duram no máximo 10 minutos.

## Verificação

Sem dependências npm, Node 24:

```sh
node --check _worker.js
node --test tests/zoho.test.mjs
git diff --check
```

Os testes usam Web Crypto real, SQLite em memória para executar SQL real e
respostas Zoho simuladas. Cobrem autenticação, origem, scopes, state/cookie,
replay, conta errada, cifra, refresh, concorrência/lock, parâmetros, ausência de
escrita Mail e regressões básicas das rotas públicas. Não substituem um teste no
runtime Cloudflare com D1 e uma conta Zoho Mail Lite real.

Antes de eventual publicação, num ambiente isolado autorizado: confirmar região e
acesso API do plano, executar consentimento, listar pastas/mensagens, testar refresh,
recusa e revogação. Confirmar que emails não ficam marcados como lidos, que
segredos não aparecem nos logs e que outra conta é recusada. Nenhum destes testes
reais foi efetuado nesta implementação; nenhum email real foi consultado.

Fontes oficiais verificadas:
- https://www.zoho.com/mail/help/api/using-oauth-2.html
- https://www.zoho.com/mail/help/api/get-all-users-accounts.html
- https://www.zoho.com/mail/help/api/get-emails-list.html
- https://www.zoho.com/mail/help/api/email-api.html
- https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
