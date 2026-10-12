# Zoho Mail — integração de leitura (em desenvolvimento)

Esta branch é uma preparação isolada da versão pública do site.

- Caixa: `booking@caravelaamarela.com` (Zoho Mail Lite).
- Redirect URI: `https://caravelaamarela.com/api/zoho/callback`.
- Objetivo: autenticação OAuth e consulta de mensagens, **sem** envio ou eliminação.
- As credenciais e os tokens devem ser configurados como segredos no Cloudflare, nunca neste repositório.
- Não publicar ou ativar até testar autenticação e controlo de acesso.

O site utiliza `_worker.js` em modo avançado do Cloudflare Pages. Qualquer rota de integração deve respeitar a configuração `_routes.json`.
