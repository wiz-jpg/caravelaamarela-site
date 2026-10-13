# Caravela Amarela — V20 (pré-visualização, sem publicação)

## Mudanças nesta versão

- PT / EN / ES: a secção **Percurso / Palcos que contam** surge agora antes do bloco **Feitos para deixar marca**.
- WILDCHAINS: cinco cartões fotográficos verticais em colunas; Devil of a Woman: três cartões fotográficos, com imagens distintas. As imagens de Faial da Terra e Tomate Blues **são provisórias e não representam esses concertos**.
- Os cartões abrem contexto e ligações para cobertura efetiva ao passar o rato, tocar ou usar teclado. A ligação só é chamada de *notícia sobre a atuação* onde existe fonte diretamente associada; noutros casos identifica-se menção na imprensa, registo de concertos ou ausência de artigo.
- Devil of a Woman: o bloco **FEITOS PARA DEIXAR MARCA** passou a usar o mesmo título dos WILDCHAINS (com traduções EN/ES equivalentes).
- Tipografia global revista: pesos, tamanhos e alinhamentos mais equilibrados sem substituir a família Archivo / Instrument Sans nem o sistema de cores.
- Monitor de notícias V19 mantido: recolha RSS, Cloudflare D1, email com ligação assinada e publicação apenas depois de revisão. Na V20 verifica feeds PT / ES / EN, processa metadados em pequenos lotes, melhora a página de revisão e disponibiliza um endpoint de diagnóstico autenticado.
- A notícia aprovada é inserida no **arquivo de imprensa** da página de artista; a homepage pode apresentar notícias aprovadas. Os três artigos destacados de cada artista continuam curados manualmente.

**Importante:** este ZIP não configura sozinho a Cloudflare; o monitor de notícias só fica operacional quando os bindings e secrets referidos abaixo estiverem ativos no ambiente de produção. Não houve deploy nem alteração do site público.

## Imagens dos Devil of a Woman a substituir mais tarde

| Cartão | Imagem provisória | Substituir por |
| --- | --- | --- |
| CA Vilar de Mouros | `news-devil-vilar.webp` (imagem do arquivo existente) | Fotografia oficial da atuação no palco principal |
| Faial da Terra Blues | `devil-caldas.webp` | Fotografia da atuação nos Açores |
| Tomate Blues | `devil-levs.webp` | Fotografia do concerto no festival em Sevilha |

As imagens são trocadas nas seis páginas de artista (PT, EN, ES). Para uma futura V21, pode passar-se para um catálogo JSON único, sem duplicar essas referências.

## Verificar o monitor de notícias

Configurar em Cloudflare Pages: `CONTACTS_DB` (binding D1); `RESEND_API_KEY`, `NEWS_REVIEW_SECRET` e `NEWS_SCAN_TOKEN` (secrets); `PUBLIC_SITE_URL=https://caravelaamarela.com` (variável).

Depois de publicar, o scan acontece no máximo a cada 12 horas quando `/api/news` recebe tráfego, ou através de um cron externo que faz `POST /api/news/scan` com `Authorization: Bearer <NEWS_SCAN_TOKEN>`. O cron externo é a via fiável se pretender deteção regular mesmo sem visitas ao site. A integração não publica as peças encontradas sem aprovação.

**Diagnóstico novo:** `GET /api/news/status` com o mesmo `Authorization: Bearer <NEWS_SCAN_TOKEN>` devolve `configured`, `last_scan` e contagens por estado, sem revelar títulos nem excertos. Não coloques nenhum destes segredos no código JavaScript ou em páginas públicas.

As candidatas enviam uma notificação para `NEWS_NOTIFY_TO` ou, por defeito, `booking@caravelaamarela.com`. Cada email contém ligação individual para **Aprovar e publicar** ou **Ignorar**; o ecrã permite editar título, imagem, resumo, URL e data.

---

# Caravela Amarela — site oficial

Site estático para Cloudflare Pages, em português, inglês e espanhol.

## Conteúdo desta versão

- Nova assinatura institucional em PT/EN/ES: “Rotas entre talento e oportunidade.”
- Sistema de cor por artista: WILDCHAINS em azul-cobalto `#4F7FD1`, Devil of a Woman em vermelho e ações globais da Caravela em amarelo.
- Contactos separados por função: João Abreu no booking (`+351 935 449 151`) e Sérgio Diogo em press, comunicação e booking (`+351 934 751 993`).
- O email partilhado mantém-se em `booking@caravelaamarela.com`.
- Instagram `@caravela.amarela` integrado na área de contacto e nos rodapés.
- Booking num formulário modal comum a todo o site, com quatro dados obrigatórios e mensagem opcional, e formulário Para Artistas simplificado e ampliado. Ambos mantêm o envio real para `booking@caravelaamarela.com`.
- Cópia de cada pedido guardada em Cloudflare D1 e eliminação de registos com mais de 12 meses.
- Sem CAPTCHA nem filtragem do conteúdo das mensagens; apenas validação estrutural dos campos.
- Alternativa `mailto:` apresentada se o envio técnico falhar.
- Falhas de envio apresentadas num alerta de alto contraste; contacto direto destacado junto ao formulário.
- Fotografias integradas de forma contextual no hero, proposta artística, formatos e provas editoriais; o percurso ao vivo fica num bloco textual mais direto e o material promocional completo continua acessível no respetivo media pack.
- Notícias editoriais só são mostradas quando o cartão identifica explicitamente WILDCHAINS ou Devil of a Woman.
- Homepage com nova hierarquia de marca, imprensa em movimento lento e contínuo e agenda exclusiva numa faixa automática sem rótulo lateral, imediatamente antes do rodapé; no mobile, a faixa também aceita scroll horizontal por toque.
- Assinatura “Rotas entre talento e oportunidade” apresentada em maiúsculas, amarelo Caravela e com tipografia de leitura mais limpa.
- Botão “Ver agenda completa” abre um diálogo acessível com todas as datas por ordem cronológica. A fonte única das datas é `assets/data/agenda.json`.
- Seleção editorial revista para apresentar apenas uma notícia por acontecimento, escolhendo a fonte com melhor conteúdo e excertos relevantes para booking.
- Imagens dos cartões editoriais substituídas pelas imagens destacadas das publicações originais sempre que a fonte as disponibiliza.
- Cobertura de Vilar de Mouros atualizada com a atuação dos Devil of a Woman no palco principal e a vitória no António Barge.
- Introduções das páginas de artista reduzidas ao logótipo, género/origem, uma frase curta e ações diretas.
- Perfis revistos numa hierarquia orientada à decisão: identidade, proposta sonora, três argumentos ao vivo, experiência comprovada, formatos quando aplicável, materiais e booking.
- Argumentos ao vivo integrados em blocos editoriais com fotografia, três provas curtas e apenas os palcos essenciais à primeira leitura; nos WILDCHAINS, os destaques incluem salas, festival e festas populares sem repetir nomes de artistas das aberturas. O detalhe continua disponível nos expansíveis.
- WILDCHAINS apresenta The Great Fado através de uma capa editorial ligada à playlist, sem simular um vídeo ao vivo que ainda não existe.
- Apenas as três melhores peças de imprensa ficam expostas e imóveis nos perfis; novas publicações aprovadas entram no arquivo sem aumentar o ruído da página.
- A campanha televisiva dos 35 anos da McDonald’s Portugal integra a prova externa e o bloco de parcerias dos WILDCHAINS, com ligação à cobertura de Imagens de Marca.
- Materiais de booking apresentados como ações fotográficas, com imagens contextuais, ícones grandes e descrições curtas para vídeo, media pack e rider técnico.
- Rodapé reorganizado numa estrutura convencional e legível, com marca, email, responsáveis, telefones, Instagram e navegação em hierarquia clara.
- Portefólios completos mantidos dentro da experiência, com os três palcos mais relevantes de cada ano destacados sem marcadores decorativos e todas as aberturas conhecidas associadas à data respetiva.
- RAJ Drumsticks apresentada como parceria de material, campanha televisiva de McDonald’s Portugal assinalada em 2026 e Acisum identificada como parceria no desenvolvimento da aplicação musical.
- Devil of a Woman apresentados com 25+ concertos desde 2024, palco principal de Vilar de Mouros e expansão no circuito de blues; o Prémio António Barge mantém-se no percurso e a citação da Glam fica exclusivamente na prova editorial.
- Prova externa ampliada com novas peças verificadas e imagens editoriais originais, mantendo apenas o top 3 exposto e o restante arquivo a um clique.
- Página Para Artistas reforçada com casos visuais de lançamento, press e identidade/conteúdo.
- Agenda 2026 atualizada: Famalicão, Tomate Blues Festival, Associação Cultural Fora do Rebanho, 28.ª Rota Motard de S. Martinho e seis atuações acústicas dos WILDCHAINS na FNAC.
- Monitor de notícias com revisão humana: encontra candidatos, envia uma notificação, permite corrigir título/excerto/imagem e só publica depois de aprovação.
- Todos os CTAs de booking abrem o mesmo formulário modal, com o artista pré-selecionado nos respetivos perfis; CTA móvel e dados estruturados `MusicEvent` mantidos.
- Formulário de booking revisto para caber integralmente em ecrãs desktop comuns, com uma chamada de contacto imediata e sem alterar o endpoint, o arquivo D1 ou as notificações por email.
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
