# Booking, Press e validação de triagem — Preview

Implementação de 17/10/2026 na branch feature/zoho-mail-readonly-oauth (PR #1 Draft). Não fazer merge nem publicar produção sem autorização.

## Imprensa
- Diretório existente separado por Braga e arredores, Porto e arredores, Resto de Portugal e grupos por país.
- A classificação usa metadados explícitos de localidade/região/país; fora de Portugal não é classificado por nome da cidade; sem dados fiáveis fica por confirmar.
- Uma ficha canónica por contacto; agrupamento apenas visual, sem duplicar ou alterar fontes.
- A agenda oficial da Caravela, quando disponível, alimenta sugestões de press para datas públicas futuras, independentemente das finanças.

## Booking
- Secção Promotores com fichas da base existente, sem as fundir com os festivais que programam.
- Fechados inclui concertos com estado comercial confirmado, mais entradas datadas e atribuídas a artista na agenda pública da Caravela `assets/data/agenda.json`.
- Cada entrada da agenda pública é identificada como **Anunciado publicamente · confirmação comercial por verificar**, não gera receita, cachet, contrato, follow-up ou pagamento.
- Filtragem rígida pelo ano real de realização: a agenda atual é principalmente 2026 e não justifica criar concertos 2027.
- Evitar duplicados óbvios com bookings confirmados do mesmo dia, artista e título/venue.

## Validação de colunas
- Os cartões sugeridos pela análise histórica ou janela de contacto têm **Confirmar triagem** e **Mover** (seletor de colunas).
- Guardar decisões de triagem numa família append-only de eventos `crm_booking_review_v1`, com origem, ano, banda e revisão otimista; sem migração D1.
- Triagem validada não equivale a envio comprovado, proposta aprovada ou concerto confirmado.
- Quando a coluna é Recusados ou Fechados, abrir o editor do Booking com estado pretendido, para que o utilizador forneça dados e evidência adequados; não fechar comercialmente por revisão rápida.
- As atualizações anteriores são preservadas no histórico e na exportação administrativa. As fichas originais do Zoho/Sheets e os eventos antigos não são modificados.

## Próximas validações
- CI Node 22/SQLite: regra geográfica, agenda anual, promotores, decisões de triagem e revisão concorrente.
- Teste real na Cloudflare Preview autenticada, incluindo botões, IDs repetidos, estado protegido e responsividade.
- Continuar a integrar outras fontes de datas oficiais das bandas, se a agenda da Caravela não tiver todos os anúncios.
