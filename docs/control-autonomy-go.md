# GO Caravela Control — ativação segura do motor autónomo (Preview)

Última revisão: 13/10/2026.
Âmbito exclusivo: branch `feature/zoho-mail-readonly-oauth`, PR #1 em rascunho, Cloudflare Pages **Preview** `feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev`. Não fazer merge, não modificar produção e não alterar a autenticação atual até passar os testes.

## O que já existe no código

- `control-operations.js`: resume o histórico D1 e os eventos de sincronização; identifica prazos vencidos na folha `AÇÕES`; exclui automaticamente linhas bloqueadas e requer revisão humana.
- `control-operations-ui.js`: mostra estado Zoho/Sheets e alertas de atualização no dashboard. Não interpreta emails como aceitação/recusa.
- `control-sync-sheets.js`: atualização incremental, só de leitura; bloqueio contra sobreposição; log de sucesso/falha e origem cron/manual.
- `control-sync-zoho.js`: indexação de metadados somente; log de origem cron/manual.
- `examples/control-cron-worker.js`: Worker independente e sem endpoints HTTP públicos; Cron a cada 10 minutos. Zoho em todas as execuções, Google Sheets a cada meia hora. Exige três segredos e verifica se o destino respondeu JSON corretamente.
- `workers/control-automation/wrangler.jsonc`: configuração do Worker independente e Cron.
- `control-vault.js`: acesso separado a resumos operacionais; exportações completas da D1 e origens Sheets exigem perfil administrativo.
- Testes em `tests/control-operations.test.mjs` e `tests/control-scheduler.test.mjs`.

**Ter código de Cron não é o mesmo que o Cron estar ativo.** A palavra «automático» no dashboard só aparece depois de existir prova de execuções agendadas na D1.

## Ordem de ativação — intervenção do responsável

1. **Cloudflare Access > Service credentials > Service tokens**: criar `caravela-control-scheduler-preview`, com expiração/rotação definida. Nunca publicar o Client ID ou Client Secret no chat, GitHub, imagens, logs ou no código-fonte.
2. No aplicativo Access que protege o hostname Preview, adicionar uma política de tipo **Service Auth** que inclua apenas esse Service Token. Preservar a política OTP por email; não abrir para Everyone nem retirar Access da área privada.
3. Criar um novo secret `CONTROL_CRON_TOKEN` com valor aleatório forte (43+ caracteres) em **Pages > caravelaamarela-site > Variables and secrets > Preview**. Não reutilizar `ZOHO_ADMIN_TOKEN`. Nunca criar em Production.
4. Criar o Worker independente `caravela-control-automation-preview` com o código `examples/control-cron-worker.js` (ou Wrangler com `workers/control-automation/wrangler.jsonc`). **Não** substituir `_worker.js` da Pages por este código.
5. No Worker independente guardar exclusivamente como **secrets** `CONTROL_CRON_TOKEN` (exatamente o mesmo valor Preview), `CF_ACCESS_CLIENT_ID` e `CF_ACCESS_CLIENT_SECRET`.
6. Configurar Cron Trigger `*/10 * * * *`, em UTC. Não habilitar rotas públicas. Para uma prova mais conservadora, começar com execução manual do trigger de teste através do Cloudflare dashboard e observar os logs.
7. Confirmar 200 e JSON do endpoint Zoho através do Worker. Em `control_sync_runs` da D1 Preview deve existir `provider='zoho'`, `status='complete'` e `meta_json` com `{"trigger":"cron"}`. Não assumir que a conta Zoho está conectada antes desta confirmação.
8. Para a fonte Sheets: criar uma conta de serviço Google com scope de leitura Sheets API, partilhar apenas os dois documentos como **Leitor** com o email da conta e definir no **Preview** as três variáveis/segredos:
   - `CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON` (secret, JSON integral com private_key)
   - `CONTROL_ACTIONS_SHEET_ID=1m4O5Yvhumo6r5Et9EMDnKvevgGKof7xVNGq6hNCp20w`
   - `CONTROL_ARTISTS_SHEET_ID=1kbdYLTXCZNgRmCfUMzEfBLy46PhnGPzltCkypiT_9zY`
9. Confirmar `provider='sheets'`, `status='complete'`, `meta_json.trigger='cron'`; se não há modificações, não será inserida nova revisão — e isto é esperado.
10. Abrir a Visão geral do Preview com token administrativo em memória e verificar frescura de ambas as origens. Fechar o navegador e confirmar novamente depois de um ciclo agendado.

## Bloqueios e segurança

- Um Worker separado é necessário: o `scheduled()` presente na `_worker.js` da Pages serve as notícias e não constitui um agendamento comprovado de sincronização CRM.
- Cloudflare Access bloqueia chamadas anónimas; o Worker Cron precisa de credenciais de **Service Auth** para o Preview e do seu próprio Bearer token. Um redirecionamento/HTML de login não é interpretado como sucesso.
- Nenhum segredo pode ser guardado no GitHub; a ligação Google do ChatGPT não transfere credenciais OAuth para Cloudflare.
- `GET /api/control/ops/overview` fornece dados agregados a viewers; nomes de oportunidades apenas a admins/gestores. Exportar a base e ler versões Sheets completas exige admin.
- Ainda **não** existe o perfil Operador de Booking isolado por tarefas/artistas, nem autorização para enviar emails. Atribuição, aprovação e envio são fases futuras e não devem ser simuladas apenas ocultando menus.
- O dashboard usa a versão **mais recente capturada**, não substitui a versão histórica importada nem modifica os Google Sheets.
- Continuam necessários testes manuais no Preview: Access, permissões reais, falhas do Zoho, quota de CPU Cloudflare, reinício de browser, revisão de dados e recuperação R2.
- Todas as alterações permanecem na branch e em Previews automáticos da Cloudflare; não fazer merge ou deploy de Production.

## Critérios de sucesso

- Novos eventos `cron` para Zoho e Sheets na D1 Preview.
- Dashboard mostra sincronizações recentes, estado automático confirmado e tarefas baseadas na folha AÇÕES, com avisos para origem desatualizada.
- Uma mensagem recebida nunca altera automaticamente o estado comercial; envio/aceitação seguem dependentes de autorização humana.
- Um utilizador não administrativo não consegue descarregar `snapshot/active` nem ler `source/latest` mesmo invocando diretamente a API.
- Website público em `caravelaamarela.com` inalterado.
