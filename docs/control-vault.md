# Caravela Control — Vault Preview (implantação controlada)

**Estado:** código preparado em `feature/zoho-mail-readonly-oauth`, PR #1 em Draft.
**Não fazer merge, não alterar `main`, não executar migrações em bases de produção.**
O Preview autorizado tem hostname exato `feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev`.

## Princípios de segurança

- Só a caixa `booking@caravelaamarela.com` é lida pelo conector Zoho atual.
- Zoho, Gmail e Sheets nunca são modificados por este sistema.
- O backup da importação preserva os **bytes exatos** do JSON, em partes verificadas por SHA-256. Cada importação ocupa uma nova versão; a anterior não é apagada.
- Ativar uma versão exige ação administrativa explícita. Guardar não equivale a ativar.
- Emails recebidos representam apenas atividade observada, **não** resposta a uma proposta.
- Estados e restrições comerciais são **por artista e por negociação**; não extrapolar permissões entre WILDCHAINS e Devil of a Woman.
- Não existe envio automático, follow-up automático nem edição de mensagens.
- Os dados originais mantêm-se no Google Drive e no Zoho.
- **Uma base D1 não é um backup independente.** Usar R2 e testes de restauro.
- Preview está acessível por URL: proteger com **Cloudflare Access** e apenas depois permitir introduzir a base privada.

## Passo A — Preparação sem risco de produção

1. Confirmar o Preview verde e as bindings Preview atuais, nomeadamente **D1 `ZOHO_DB` → `caravela-zoho-test`**.
2. Configurar **Cloudflare Access** para limitar a página e rotas privadas aos administradores aprovados. Preservar o callback OAuth ou planear a sua exceção controlada.
3. Na consola SQL **dessa D1 de testes**, aplicar exatamente `migrations/0003_control_vault.sql` (operações `CREATE TABLE/INDEX IF NOT EXISTS`). Não executar `0002_crm.sql` por engano nem alterar tabelas de produção.
4. Em **Workers & Pages → caravelaamarela-site → Settings → Variables and Secrets → Preview**, adicionar variável `CONTROL_VAULT_ENABLED=true` (apenas Preview). Confirmar que `ZOHO_ENABLED=true`, `ZOHO_ADMIN_TOKEN` e `ZOHO_DB` continuam configurados. **Nunca enviar tokens pelo chat.**
5. Publicar/repetir deployment **Preview** para aplicar variáveis. A `main` não deve ser alterada.
6. Com token administrativo, clicar **Verificar cofre**; exigir `schema_ready=true` e sem base ativa no primeiro uso.

## Passo B — Backup independente recomendado antes da primeira ativação

1. Criar um bucket R2 de testes, com acesso privado, política de retenção e controlo de custos.
2. Adicionar **binding Preview do tipo R2** com nome exato `CONTROL_BACKUP_BUCKET`, apontando para esse bucket.
3. Adicionar variável **Preview** `CONTROL_R2_BACKUP_ENABLED=true`.
4. Reabrir Preview, confirmar em **Verificar cofre** que R2 está configurado.
5. Na primeira importação, ao **Guardar versão importada**, o backend faz upload ao R2 e lê a cópia para verificar novamente o SHA-256 antes de selar a versão na D1. O respetivo recibo fica em `control_backup_copies`.
6. Confirmar que a cópia é recuperável no botão **Descarregar backup R2** e comparar SHA-256 com a base original.

Sem R2, o sistema permite guardar e ativar no D1, **mas a garantia de backup independente fica pendente**. Nunca afirmar que já existe um backup automático fora do D1 quando não existe binding R2.

## Passo C — Importação única

1. Abrir `/crm-control.html` no Preview e introduzir o token administrativo.
2. Importar uma última vez o JSON privado V3, já validado localmente por `crm-logic.js`.
3. Clicar **Guardar versão importada**; acompanhar os 55 fragmentos aproximados. Se a ligação interromper, voltar a guardar o mesmo ficheiro; os fragmentos válidos repetidos são reconhecidos como idempotentes.
4. Confirmar explicitamente a ativação.
5. Recarregar a página e clicar **Abrir base guardada**, **sem selecionar qualquer JSON**.
6. Testar **Descarregar cópia de segurança** do D1 e, com R2, **Descarregar backup R2**. Ambas verificam a integridade SHA-256 antes de permitir guardar.

Nunca inserir ficheiros JSON privados no GitHub, repositórios públicos, logs nem URLs.

## Passo D — Sincronização do Zoho (incremental, apenas leitura)

- Botão **Atualizar histórico Zoho**: cada execução consulta até 50 recentes + até 50 históricos por pasta (Recebidos e Enviados), evitando duplicados.
- A D1 guarda somente `message_id`, `thread_id`, datas e endereços. **Não guarda assuntos, resumos ou corpo de email**.
- `control_mail_sync_position` regista a posição de leitura histórica. A correspondência comercial e a classificação de respostas exigem revisão humana.
- Falhas ficam registadas em `control_sync_runs`. Não marcar automaticamente mensagens como entregues ou respondidas.
- Não pressupor que o backfill está completo até confirmar o número total de mensagens do provedor e a cobertura histórica. A seleção de mensagens já analisadas em V3 não substitui o backfill na D1.

## Passo E — Google Sheets (autorização explícita necessária)

1. Criar conta de serviço no Google Cloud, ativar Google Sheets API e gerar uma credencial JSON. Limitar acesso ao mínimo.
2. Partilhar **somente os dois Google Sheets necessários**, como **Viewer**, com o email dessa conta de serviço (Caravela Control e Artist Pipeline).
3. Guardar o JSON completo como **segredo Preview** `CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON`. Nunca publicá-lo no GitHub, chat ou no HTML.
4. Definir variáveis Preview `CONTROL_ACTIONS_SHEET_ID` e `CONTROL_ARTISTS_SHEET_ID` (IDs dos documentos já partilhados).
5. Clicar **Atualizar Google Sheets**. Confirmação: duas origens capturadas em `control_source_revisions`.
6. Clicar **Ver AÇÕES e artistas atuais** para consultar as linhas mais recentes, sem sobrepor nem eliminar os dados da V3.
7. Revisões só são acrescentadas quando o conteúdo muda; capturas iguais são deduplicadas por hash.

**Não usar automaticamente o estado das folhas como permissão para contactar.** A reconciliação de 116 ações ambíguas permanece por resolver.

## Passo F — Execução agendada (não está ligada só por existir o código)

1. Criar segredo longo e aleatório `CONTROL_CRON_TOKEN` (mínimo 43 caracteres) nas variáveis **Preview**. Deve ser diferente do token de administrador.
2. Criar um Worker Cloudflare **separado** usando `examples/control-cron-worker.js`, com o mesmo segredo apenas no Worker (Secret).
3. Definir Cron Trigger, por exemplo, a cada 30 minutos (`*/30 * * * *`).
4. Testar manualmente uma execução e confirmar um registo novo em `control_sync_runs`. A rota com o token do Cron só pode chamar `zoho/sync` e `sheets/sync`; não pode ler a base ou os backups.
5. Confirmar falhas e limites através de logs de Worker (sem imprimir mensagens, tokens ou payloads).
6. Se Google Sheets ainda não estiver configurado, o Cron ignora especificamente `sheets_credentials_required`; o Zoho continua a sincronizar.

O cron de Pages `scheduled()` não deve ser assumido como configurado. O Worker separado exige configuração manual.

## Gmail: impedimento pendente

A integração Gmail da conta ChatGPT **não fornece credenciais OAuth ao website**. Para integrar Gmail diretamente no Caravela Control será necessário:
- Escolher explicitamente a conta e o âmbito dos emails relevantes;
- Configurar OAuth próprio com `gmail.readonly`, consentimento e armazenamento seguro dos tokens;
- Separar correio pessoal de informação profissional e documentar limites de retenção;
- Testar identidade, paginação, deduplicação e política de revisão antes de ligar a sincronização.

**Ainda não existe ligação Gmail ativa no servidor.** Não alegar que Gmail está automaticamente sincronizado.

## Recuperação e auditoria

- Histórico de versões `control_snapshots`, fragmentos `control_snapshot_parts`, versões ativas em `control_state`.
- Diário de ações administrativas `control_audit`; observações de email em `control_mail_headers`; revisões Sheets em `control_source_revisions`.
- Para recuperar o último original, usar **Abrir base guardada** ou **Descarregar cópia de segurança**. Para recuperar de desastre D1, usar o backup R2 validado e procedimento de reconstrução controlado; não usar `DROP` nem apagar a base sem cópias testadas.
- Cloudflare D1 Time Travel pode ajudar em falhas recentes, mas não constitui um arquivo histórico indefinido: a retenção depende do plano e não substitui o R2. Consultar a documentação Cloudflare atual para limites.
- Antes de abandonar os Sheets como ferramenta operacional, reconciliar os 116 casos pendentes, confirmar cobertura total do Zoho, executar um restauro de teste e validar as rotinas de backup.
- Testar localmente com Node 22: `node --test tests/*.test.mjs`. CI em `.github/workflows/control-preview-tests.yml`.

## Estado de implementação (2026-10-12)

**Preparado em código:** esquema append-only, importação e recuperação verificadas por digest, autenticação Preview, leitura incremental Zoho, capturas read-only dos Sheets, separação de permissões Cron, backup R2 opcional, interface e testes.

**A aguardar configuração e prova em Cloudflare:** aplicação SQL, habilitação Preview, proteção Access, R2, Google Service Account, Worker Cron, upload inicial e ensaio de restauro.

**Não implementado:** integração OAuth Gmail no servidor; deduplicação e atribuição comercial automatizada totalmente resolvidas; alterações bidirecionais nos Sheets; envio de mensagens (deliberadamente desativado); migração para produção.
