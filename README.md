# Caravela Amarela — site oficial

Site estático para Cloudflare Pages, em português, inglês e espanhol.

## Conteúdo desta versão

- Contacto único: `booking@caravelaamarela.com` e João Abreu · `+351 935 449 151`.
- Formulários de booking e de artistas com envio real para `booking@caravelaamarela.com`.
- Cópia de cada pedido guardada em Cloudflare D1 e eliminação de registos com mais de 12 meses.
- Sem CAPTCHA nem filtragem do conteúdo das mensagens; apenas validação estrutural dos campos.
- Alternativa `mailto:` apresentada se o envio técnico falhar.
- Falhas de envio apresentadas num alerta de alto contraste; contacto direto destacado junto ao formulário.
- Galerias live em carrossel de WILDCHAINS e Devil of a Woman, com ligação ao material promocional no Google Drive.
- Notícias editoriais só são mostradas quando o cartão identifica explicitamente WILDCHAINS ou Devil of a Woman.
- RAJ Drumsticks apresentada discretamente como parceria de material.
- Campanha televisiva de McDonald’s Portugal assinalada como “brevemente”.
- SEO PT/EN/ES: canonical, hreflang, dados estruturados e sitemap atualizado.

## Publicação do site

O projeto não tem build. Na Cloudflare Pages, usa o preset **None**, sem comando de build e com a raiz do projeto como diretório de saída.

O ficheiro `_worker.js` trata `/api/contact`; `_routes.json` garante que só os pedidos à API invocam a Function, mantendo as páginas e imagens como assets estáticos gratuitos. Esta versão pode ser enviada pelo método **Create deployment / Drag and drop** da Cloudflare Pages, incluindo num ZIP. Também pode ser publicada por Wrangler:

```bash
npx wrangler pages deploy . --project-name=<NOME_DO_PROJETO>
```

## Ativar os formulários na Cloudflare

Estas definições só precisam de ser feitas uma vez no projeto Pages.

### 1. Base de dados D1

1. Na Cloudflare, abre **Storage & Databases → D1 SQL Database** e cria uma base de dados, por exemplo `caravela-contacts`.
2. Abre **Workers & Pages → projeto do site → Settings → Bindings**.
3. Adiciona uma ligação **D1 database** com o nome exato `CONTACTS_DB` e escolhe a base criada.
4. Não é preciso criar tabelas manualmente: o formulário cria a tabela `contact_submissions` no primeiro pedido.

### 2. Envio das notificações por email

1. No Resend, adiciona e verifica o subdomínio `forms.caravelaamarela.com`, com envio ativo e receção desativada.
2. Mantém todos os registos do Resend dentro desse subdomínio para não interferirem com o Zoho no domínio principal.
3. Cria uma API key no Resend apenas com permissão de envio.
4. Em **Workers & Pages → projeto → Settings → Variables and Secrets**, adiciona `RESEND_API_KEY` como **Secret / Encrypt**.

O remetente técnico é `notifications@forms.caravelaamarela.com`; não precisa de mailbox própria. O cabeçalho `Reply-To` é o email preenchido no formulário, portanto o botão Responder no Zoho/Gmail responde diretamente à pessoa.

### 3. Tornar a configuração ativa

Depois de criar o binding e as variáveis, faz uma nova publicação. Alterações a bindings e secrets só entram em vigor após novo deployment.

## Teste obrigatório após publicar

1. Envia um pedido curto pelo formulário de booking.
2. Confirma a mensagem de sucesso no site e a chegada a `booking@caravelaamarela.com`.
3. No email recebido, usa **Responder** e confirma que o destinatário é o email introduzido no formulário.
4. Repete o teste em **Para Artistas**.
5. Em D1, consulta `contact_submissions` e confirma que ambos os pedidos ficaram guardados com `email_status = sent`.

## Rotas

- Português: `/`, `/wildchains`, `/devil-of-a-woman`, `/for-artists`
- Inglês: `/en/`, `/en/wildchains`, `/en/devil-of-a-woman`, `/en/for-artists`
- Espanhol: `/es/`, `/es/wildchains`, `/es/devil-of-a-woman`, `/es/para-artistas`

Documentação oficial relevante: [Cloudflare Pages Advanced Mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases) e [Email Sending REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).
