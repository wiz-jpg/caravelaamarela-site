# Caravela Control — classificação automática das filas de Booking

Data: 2026-10-17. Apenas branch feature/zoho-mail-readonly-oauth, Preview, PR Draft.

## Regra operacional

A interface não deve obrigar a transformar manualmente centenas de linhas de AÇÕES em bookings. A apresentação usa uma projeção de leitura das fontes importadas, sem alterar o evento, o estado comercial ou a autorização de contacto.

- Uma linha **Enviado**, **Em conversa** ou **Em negociação** de AÇÕES entra provisoriamente em **On going / Follow-up**, com o estado original apresentado e o ano/evento por confirmar.
- Uma linha **Por contactar** entra na fila de festivais baseada em data real de ação/follow-up registada: atraso até 90 dias, agora (até 7 dias), brevemente (até 45 dias), ou por calendarizar.
- Sem data de ação, apenas uma janela verificada e aplicável à época permite derivar urgência; caso contrário, fica em **Por calendarizar**.
- Para venues, enviados e conversas aparecem em **On going / Follow-up** e por contactar em **Sugestões**.
- Registos antigos de recusa/fecho sem prova da edição não passam a estados comerciais fechados para 2027; ficam em **Histórico a validar**.
- Correspondência entre entidade e ação exige nome exato normalizado, endereço de email compatível e entidade única. Eventuais entradas com emails partilhados/bloqueados ou contactos suprimidos são excluídas das filas ativas.
- Havendo uma negociação nativa do mesmo artista e entidade para a época, esta sobrepõe-se à sugestão histórica, mesmo que tenha sido recusada. A mesma entidade pode ter sugestões independentes para WILDCHAINS e Devil.
- Se existem várias linhas históricas para a mesma entidade e banda, apresentar a última ação datada da época, sem fundir ou apagar o histórico.
- O período de data nas sugestões é uma **hipótese de época de trabalho**, não prova da edição do evento. Ao preparar uma proposta a partir do arquivo, **o ano do concerto fica por confirmar**.
- Cartões provisórios apresentam **Classificação automática · por validar**, fonte/estado original e próxima ação conhecida.
- Nenhum email é enviado, nenhuma confirmação é inferida e não se escreve na base de dados por abrir a página.

## O que ainda não é possível garantir apenas com o arquivo

- A data do festival em 2027 quando só temos uma ação da equipa em 2026.
- Que o email «Enviado» chegou ao promotor sem confirmar na caixa Zoho/Gmail relevante.
- Que o promotor ainda aceita propostas ou que o destinatário continua a ser o adequado.
- Que os concursos estão abertos e a elegibilidade está confirmada (requer fontes oficiais).
- Pesquisa autónoma na Internet e alertas fundamentados sobre novos eventos/edital.

## Aceitação

Testes Node 22 / SQLite do classificador para todas as filas e bloqueios; verificação real posterior na Cloudflare Preview autenticada. Sem migrações, alterações fiscais, permissões ou produção.
