# Caravela Control — Booking por época e Radar (Preview)

Atualização: 17/10/2026. Apenas branch `feature/zoho-mail-readonly-oauth` / PR #1 Draft. Sem merge para main, sem envio de emails, sem alteração de fontes históricas.

## Booking 2027 (e outros anos)

A vista Booking passa a mostrar:
- **Festivais:** On going / Follow-up; A contactar em atraso; A contactar agora; A contactar brevemente; Por calendarizar; Recusados; Fechados.
- **Venues:** On going / Follow-up; Sugestões; Recusados; Fechados.
- Ano selecionável; filtro por WILDCHAINS, Devil of a Woman, ambas; cartões compactos com ficha individual.
- A base completa de negociações e o arquivo preservado permanecem num painel expansível.
- Booking nativo recebe dois campos opcionais: `booking_year` e `booking_category`. Campo antigo sem ano não é reescrito automaticamente; pode surgir em «Por classificar».
- Confirmado só com o estado comercial `confirmed` já validado pela política de booking. `closed` não é convertido em confirmado. Pausas e encerramentos não são transformados em chamadas urgentes.
- Janelas anuais passam a aceitar `contact_window_target`: mesmo ano ou ano anterior ao concerto, **sempre escolhida por humano**. `official`, `direct` ou `history` são fundamentos disponíveis. `hypothesis` não gera atraso/urgência.
- Contactos antigos com ano de janela desconhecido **não são classificados como atrasados**.
- Sugestões de venue usam apenas cidades ou regiões coincidentes com concertos **confirmados e registados para esse ano**; não são rotas calculadas, tempos/distâncias nem avaliação de fit.
- Um candidato ainda não é oportunidade atribuída a banda nem destinatário autorizado. Propor requer edição/validação humana.

## Radar de Oportunidades

Nova vista `Oportunidades` no menu principal:
- Pesquisa local por palavras-chave em 5 fontes oficiais curadas inicialmente: DGARTES Internacionalização, DGARTES Concursos, Fundação GDA Showcases Internacionais, Europa Criativa Portugal e Culture Moves Europe.
- Cada fonte liga ao portal oficial. Não há scraping automático, alertas verificados em tempo real nem inferência de que uma convocatória está aberta.
- O aviso DGARTES Internacionalização 2026 já tinha decisão final; o cartão direciona para confirmar futuras edições.
- Um operador pode guardar uma candidatura concreta como `crm_opportunity_v1` usando o mesmo D1 append-only e controlo de revisões do CRM, sem tabela/migração nova.
- Campos: título, entidade responsável, URL https, categoria, artista, país, deadline, data da próxima revisão, data de verificação humana, responsável, estado, próximo passo, notas e elegibilidade.
- Sem submissões automáticas; prazos e candidaturas só refletem registos humanos.
- Exportação administrativa de eventos nativos inclui os registos do Radar.
- Fonte DGARTES https://www.dgartes.gov.pt/pt/apoio/9487
- Fonte Fundação GDA https://www.fundacaogda.pt/internacionalizacao/showcases-internacionais/
- Fonte Europa Criativa https://europacriativa.eu/

## Validação e limites

Testes Node 22/SQLite devem cobrir as classificações de cada fila, ano ausente, janelas comprovadas, sugestões por cidade/região e a gravação append-only de oportunidades.

Ainda pendente:
- Testar interface e API end-to-end no Cloudflare Preview autenticado.
- Enriquecer candidatos com fit de género e historial de bookings verificados; não atribuir bandas por mera proximidade.
- Pesquisa periódica automatizada em chamadas públicas com confirmação de critérios de elegibilidade e encerramentos.
- Backups independentes e restauração testada de eventos operacionais.
- Permissões por função (explicitamente adiadas).

Não existe migração automática de todos os contactos/ações antigos para Booking 2027; a triagem humana é necessária para evitar oportunidades falsas, duplicações e prazos inventados.
