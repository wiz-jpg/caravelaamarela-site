# Caravela Control — interfaces operacionais 17/10/2026

**Branch:** feature/zoho-mail-readonly-oauth; Preview apenas; não fazer merge para main.

## Organização do Booking
- Festivais e venues existentes no arquivo voltam a ser apresentados mesmo sem negociações nativas criadas.
- Contactos sem janela comprovada para o ano selecionado aparecem em **Por calendarizar**, não em **A contactar agora** nem **Em atraso**.
- Venues do arquivo podem constar de Sugestões, separando candidatas gerais de encaixes por cidade/região com concertos confirmados.
- Ações antigas associadas apenas a uma entidade identificada sem ambiguidade são apresentadas em **Histórico a validar**, nunca em negociação confirmada.
- Cartões e cabeçalhos têm contraste reforçado.

## Imprensa / contactos
- Entradas de menu Imprensa e Outros contactos, com a base unificada conservada em Outras áreas.
- Imprensa sugere meios da cidade, região e cobertura ampla para concertos *confirmados no Booking*; não inventa concertos nem assume que o meio cobre aquele género.
- Planos manuais de lançamento e divulgação são guardados em D1 append-only como `crm_press_plan_v1` e alimentam sugestões.
- As sugestões nunca autorizam envios. Não se cria uma ficha duplicada para apresentar a imprensa.

## Radar
- Secção atualmente abertas inclui somente oportunidades **verificadas manualmente** em fonte oficial recentemente (até 30 dias), com prazo válido e histórico da verificação.
- As restantes ficam em **Outras oportunidades**, incluindo fontes gerais para pesquisa.
- Não existe verificação em tempo real da abertura, submissão automática nem pesquisa web automatizada nesta versão.

## Início
- Quatro focos: follow-ups operacionais, janelas de contacto 2027 comprovadas, candidaturas abertas comprovadas e campanhas/sugestões de imprensa.
- A fila de sinais Zoho, histórico e restantes tarefas permanecem acessíveis em «Mais tarefas», sem perda ou fusão de dados.

## Validação pendente
- CI Node 22 + SQLite; testar na Cloudflare Preview autenticada, sobretudo múltiplas bandas e respostas do Zoho.
- Reconciliação individual de estados, anos e janelas históricas; não é migração automática.
- Teste de recuperação/restauro do cofre D1.
