# Caravela Control — ativar Zoho 10 minutos (Preview)

Estado: código preparado em Draft PR #1, ainda não ativado na Cloudflare. Não alterar produção, main, emails públicos, nem bases originais.

## Já implementado
- Cloudflare Worker separado com cron 10/10 minutos (UTC), Zoho em todos os ciclos e Sheets a cada 30 minutos, se configurado.
- Sincronização incremental com IDs, remetentes, destinatários e timestamps.
- Interpretação opt-in de até 6 novos emails recebidos por ciclo, por regras transparentes. Assunto e corpo não são armazenados; apenas sinais de interesse, possível recusa/confirmação, pergunta e tema.
- Interface de revisão de sinais no CRM e estado no Início, que distingue execução automática confirmada de mera configuração.
- Nunca envia emails nem atualiza acordos, política de contactos ou decisões financeiras.

## Ações necessárias do proprietário Cloudflare
1. No D1, confirmar que a base é EXATAMENTE caravela-zoho-test e aplicar migrations/0005_control_mail_signals.sql apenas nela. Com a CLI Cloudflare autenticada e a base confirmada:
   npx wrangler d1 execute caravela-zoho-test --remote --file=migrations/0005_control_mail_signals.sql
2. Em Workers & Pages > caravelaamarela-site > Settings > Variables and Secrets > Preview, criar um secret CONTROL_CRON_TOKEN: valor aleatório único de 43+ caracteres, diferente do ZOHO_ADMIN_TOKEN. Confirmar ZOHO_ENABLED=true, CONTROL_VAULT_ENABLED=true e ligação OAuth já existente. Depois da migração definir CONTROL_MAIL_ANALYSIS_ENABLED=true exclusivamente em Preview.
3. Em Zero Trust > Access > Service credentials > Service Tokens criar caravela-control-scheduler-preview. Na Access Application do hostname Preview acrescentar uma política Service Auth autorizando APENAS esse token. Manter login humano; não usar Bypass, Everyone ou remover Access.
4. Criar/deployar um Worker INDEPENDENTE: examples/control-cron-worker.js e workers/control-automation/wrangler.jsonc. Com autenticação Cloudflare e na raiz do repo:
   npx wrangler deploy -c workers/control-automation/wrangler.jsonc
   Guardar no Worker como secrets CONTROL_CRON_TOKEN (mesmo valor de Preview), CF_ACCESS_CLIENT_ID e CF_ACCESS_CLIENT_SECRET. Cron */10 * * * * em UTC. Sem HTTP público.
5. Executar uma invocação scheduled de teste pelo Cloudflare Dashboard; confirmar em control_sync_runs da D1 Preview status=complete, provider=zoho, meta_json.trigger=cron e analysis_enabled=true. Repetir com navegador fechado passado um ciclo. Verificar Início.
6. Em caso de erro, partilhar apenas o código ou estado genérico e a data. Nunca partilhar valores de secrets, tokens, conteúdos das mensagens ou logs privados.

## Limites
- Isto é polling, NÃO monitorização em tempo real; Zoho/Cloudflare podem atrasar. Até 6 emails por ciclo são interpretados, enquanto o histórico antigo é processado progressivamente.
- A classificação é heurística, não interpretação humana/IA semântica; todo o sinal exige revisão antes de agir.
- A flag de conteúdo e migração 0005 são opt-in. Sem elas, a sincronização de metadados continua a funcionar e não se deve apresentar a leitura de corpo como ativa.
- O agendamento NÃO foi ativado remotamente por esta PR; só o proprietário Cloudflare o pode efetuar com os seus segredos.
- Gmail WILDCHAINS continua fora do agendador. É uma integração independente.
- Não enviar, não apagar históricos, não fazer merge/deploy de produção até duas provas de Cron real e testes de falha.
