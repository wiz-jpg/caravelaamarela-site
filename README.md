# Caravela Amarela — site oficial

Site estático para Cloudflare Pages, em português, inglês e espanhol.

## Conteúdo desta versão

- Nova assinatura institucional em PT/EN/ES: “Rotas entre talento e oportunidade.”
- Sistema de cor por artista: WILDCHAINS em azul-cobalto `#4F7FD1`, Devil of a Woman em vermelho e ações globais da Caravela em amarelo.
- Contactos separados por função: João Abreu no booking e representação artística (`+351 935 449 151`) e Sérgio Diogo em press e comunicação (`+351 934 751 993`).
- O email partilhado mantém-se em `booking@caravelaamarela.com`.
- Instagram `@caravela.amarela` integrado na área de contacto e nos rodapés.
- Formulários de booking e de artistas com envio real para `booking@caravelaamarela.com`.
- Cópia de cada pedido guardada em Cloudflare D1 e eliminação de registos com mais de 12 meses.
- Sem CAPTCHA nem filtragem do conteúdo das mensagens; apenas validação estrutural dos campos.
- Alternativa `mailto:` apresentada se o envio técnico falhar.
- Falhas de envio apresentadas num alerta de alto contraste; contacto direto destacado junto ao formulário.
- Galerias live em carrossel de WILDCHAINS e Devil of a Woman, com ligação ao material promocional no Google Drive.
- Notícias editoriais só são mostradas quando o cartão identifica explicitamente WILDCHAINS ou Devil of a Woman.
- Homepage com uma seleção curta de imprensa; agenda global reduzida a uma faixa automática imediatamente antes do rodapé.
- Botão “Ver agenda completa” abre um diálogo acessível com todas as datas por ordem cronológica. A fonte única das datas é `assets/data/agenda.json`.
- Seleção editorial revista para apresentar apenas uma notícia por acontecimento, escolhendo a fonte com melhor conteúdo e excertos relevantes para booking.
- Imagens dos cartões editoriais substituídas pelas imagens destacadas das publicações originais sempre que a fonte as disponibiliza.
- Cobertura de Vilar de Mouros atualizada com a atuação dos Devil of a Woman no palco principal e a vitória no António Barge.
- Introduções das páginas de artista reduzidas ao logótipo, género/origem, uma frase curta e ações diretas.
- Secções “Booking fit” refeitas como argumentos comerciais: prova editorial, contextos, experiência, prémios, materiais e chamada para booking.
- Formatos elétrico e acústico dos WILDCHAINS apresentados como dois produtos de palco inequívocos.
- Portefólios completos mantidos dentro da experiência, com os três palcos mais relevantes de cada ano destacados e aberturas associadas à data respetiva.
- RAJ Drumsticks apresentada como parceria de material e campanha televisiva de McDonald’s Portugal assinalada em 2026.
- Devil of a Woman apresentados com a sequência Prémio António Barge → palco principal de Vilar de Mouros e uma imagem de Vilar integrada na galeria.
- Página Para Artistas reforçada com casos visuais de lançamento, press e identidade/conteúdo.
- Agenda 2026 atualizada: Famalicão, Tomate Blues Festival, Associação Cultural Fora do Rebanho, 28.ª Rota Motard de S. Martinho e seis atuações acústicas dos WILDCHAINS na FNAC.
- Monitor de notícias com revisão humana: encontra candidatos, envia uma notificação, permite corrigir título/excerto/imagem e só publica depois de aprovação.
- CTA móvel de booking e dados estruturados `MusicEvent` gerados a partir da agenda.
- SEO PT/EN/ES: canonical, hreflang, dados estruturados e sitemap atualizado.
- Novos cartões sociais 1200×630, localizados por idioma e com nomes versionados para renovar a imagem apresentada no WhatsApp, Facebook, LinkedIn e X.

## Publicação do site

O projeto não tem build. Na Cloudflare Pages, usa o preset **None**, sem comando de build e com a raiz do projeto como diretório de saída.

O ficheiro `_worker.js` trata `/api/contact` e `/api/news`; `_routes.json` garante que só os pedidos à API invocam a Function, mantendo as páginas e imagens como assets estáticos gratuitos. Esta versão pode ser enviada pelo método **Create deployment / Drag and drop** da Cloudflare Pages, incluindo num ZIP. Também pode ser publicada por Wrangler:

```bash
npx wrangler pages deploy . --project-name=<NOME_DO_PROJETO>
```

## Ativar os formulários na Cloudflare

Estas definições só precisam de ser feitas uma vez no projeto Pages.

### 1. Base de dados D1

1. Na Cloudflare, abre **Storage & Databases → D1 SQL Database** e cria uma base de dados, por exemplo `caravela-contacts`.
2. Abre **Workers & Pages → projeto do site → Settings → Bindings**.
3. Adiciona uma ligação **D1 database** com o nome exato `CONTACTS_DB` e escolhe a base criada.
4. Não é preciso criar tabelas manualmente: o site cria `contact_submissions`, `news_candidates` e `news_scan_state` quando forem necessárias.

### 2. Envio das notificações por email

1. No Resend, adiciona e verifica o subdomínio `forms.caravelaamarela.com`, com envio ativo e receção desativada.
2. Mantém todos os registos do Resend dentro desse subdomínio para não interferirem com o Zoho no domínio principal.
3. Cria uma API key no Resend apenas com permissão de envio.
4. Em **Workers & Pages → projeto → Settings → Variables and Secrets**, adiciona `RESEND_API_KEY` como **Secret / Encrypt**.

O remetente técnico é `notifications@forms.caravelaamarela.com`; não precisa de mailbox própria. O cabeçalho `Reply-To` é o email preenchido no formulário, portanto o botão Responder no Zoho/Gmail responde diretamente à pessoa.

### 3. Tornar a configuração ativa

Depois de criar o binding e as variáveis, faz uma nova publicação. Alterações a bindings e secrets só entram em vigor após novo deployment.

## Ativar o monitor de notícias e as notificações

O fluxo foi deliberadamente construído com aprovação humana: uma notícia encontrada nunca entra no site sem revisão. Isto evita repetições do mesmo acontecimento, fontes fracas e excertos que não vendem o artista.

Em **Workers & Pages → projeto → Settings → Variables and Secrets**, configura:

- `NEWS_REVIEW_SECRET` como Secret: uma sequência aleatória longa, por exemplo gerada com `openssl rand -hex 32`.
- `NEWS_SCAN_TOKEN` como Secret: outra sequência aleatória, usada por um agendador externo para chamar o scan.
- `PUBLIC_SITE_URL` como texto: `https://caravelaamarela.com`.
- `NEWS_NOTIFY_TO` como texto, opcional: destinatário das notificações. Se faltar, usa `booking@caravelaamarela.com`.

O monitor procura menções exatas a WILDCHAINS e Devil of a Woman em feeds de notícias, tenta recuperar o URL, excerto e imagem editorial originais e guarda o resultado como candidato. O Resend envia então um email com uma ligação segura de revisão. Nesse ecrã é possível:

1. Abrir a peça original.
2. Corrigir título, fonte, URL, excerto relevante e imagem.
3. Aprovar e publicar imediatamente, ou ignorar.

O feed público em `/api/news` só devolve registos com estado `published`.

### Frequência do scan

Em Cloudflare Pages, o site tenta um scan em segundo plano quando alguém abre uma página com notícias, no máximo uma vez a cada 12 horas. Para uma verificação garantida a horas fixas, configura um agendador externo (por exemplo, Cloudflare Cron Trigger num Worker mínimo ou outro serviço de cron) para fazer um `POST` a:

```text
https://caravelaamarela.com/api/news/scan
```

com o cabeçalho:

```text
Authorization: Bearer <NEWS_SCAN_TOKEN>
```

Uma frequência de duas vezes por dia é suficiente. O handler também inclui `scheduled()` para reutilização direta caso o projeto seja futuramente movido de Pages para um Worker com Cron Trigger.

## Teste obrigatório após publicar

1. Envia um pedido curto pelo formulário de booking.
2. Confirma a mensagem de sucesso no site e a chegada a `booking@caravelaamarela.com`.
3. No email recebido, usa **Responder** e confirma que o destinatário é o email introduzido no formulário.
4. Repete o teste em **Para Artistas**.
5. Em D1, consulta `contact_submissions` e confirma que ambos os pedidos ficaram guardados com `email_status = sent`.
6. Faz um `POST` autenticado a `/api/news/scan`, confirma a chegada da notificação e testa as ações **Aprovar e publicar** e **Ignorar notícia**.

## Rotas

- Português: `/`, `/wildchains`, `/devil-of-a-woman`, `/for-artists`
- Inglês: `/en/`, `/en/wildchains`, `/en/devil-of-a-woman`, `/en/for-artists`
- Espanhol: `/es/`, `/es/wildchains`, `/es/devil-of-a-woman`, `/es/para-artistas`

Documentação oficial relevante: [Cloudflare Pages Advanced Mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases) e [Email Sending REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).
