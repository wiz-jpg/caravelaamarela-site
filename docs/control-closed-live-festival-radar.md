# Caravela Control — Fechados por data e Radar de festivais externos

Preview protegido `feature/zoho-mail-readonly-oauth` / PR #1 Draft, 17/10/2026.

## Booking
- A agenda pública da Caravela, incluindo datas FNAC e Devil, alimenta diretamente as colunas **Fechados** de Venues e Festivais. Deixa de haver um bloco separado com concertos anunciados.
- Concertos **por realizar** ficam primeiro. Concertos cuja data já passou ficam **no fundo da mesma coluna**, visualmente a cinzento, por data decrescente. As datas 2026 continuam visíveis quando o quadro trabalha a época 2027.
- As oportunidades por contactar, follow-up, planeamento e negociações continuam dependentes da época selecionada. Não transferir propostas 2026 para 2027.
- O campo «Anunciado publicamente» continua a não ser prova de contrato, cachet, faturação ou pagamento. Nenhum evento financeiro é criado.
- Fonte e diagnostico do carregamento continuam disponíveis num painel pequeno e recolhido.

## Radar
- O Radar vem **abaixo do Booking**, depois dos Promotores, nunca entre o cabeçalho e as colunas.
- Descoberta de **festivais externos**; não recomenda festivais/venues já existentes nos contactos nativos, arquivo AÇÕES ou bookings, recorrendo a nome normalizado e comparação conservadora.
- Fontes oficiais verificadas para 2027 disponibilizadas como ponto de partida (Laurus Nobilis, Milagre Metaleiro, SQUARE em Braga; Santa Maria Blues para Devil). Não afirmar que há vagas, cachet viável ou inscrições abertas. A candidatura SQUARE 2027 terminou em agosto 2026.
- **Pesquisa a pedido:** endpoint privado `GET /api/control/radar/festivals?year=2027&artist=WILDCHAINS`, integrado com **Brave Search API**. Requer segredo `CONTROL_BRAVE_SEARCH_API_KEY` ou `BRAVE_SEARCH_API_KEY` no ambiente Cloudflare Preview; sem segredo apresenta erro explícito «search_provider_not_configured». Não inventar resultados.
- Resultados externos são **pistas que exigem validação** e podem ser títulos de páginas, não nomes canónicos de festivais. Nenhum entra automaticamente como contacto ou proposta.
- Sem escrita na D1, sem automação de envio e sem modificação do website público.

## Interface avançada
- Preservar histórico e edição detalhada, mas preferir painéis recolhidos e navegação por «Contactos»/«Administração»; a área principal deve privilegiar a ação do dia. Não apagar dados para simplificar visualmente.
