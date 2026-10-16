# Caravela Control — UI funcional v2 (aprovação outubro 2026)
Preview / branch `feature/zoho-mail-readonly-oauth`; nunca publicar no main sem autorização.

## Escolhas fechadas pelo proprietário

- Início centrado **no que exige atenção hoje**, não em métricas ou infra.
- **Uma oportunidade por proposta de booking**, com seu artista, estado, responsável e próximo passo.
- **Uma ficha canónica por entidade**, com vários interlocutores, propostas e histórico — sem fundir automaticamente produtoras, festivais, venues ou emails partilhados.
- **Booking é o centro** do negócio. Press, parcerias, serviços e finanças são acessíveis mas menos proeminentes.
- Respostas Zoho: em Início e na oportunidade *quando comprovada a associação*, sem duplicar tarefa. A decisão é feita **numa única janela de revisão**.
- Densidade visual **compacta mas legível**; campos não essenciais recolhidos; cartões inteiros com cor de estado comercial e legenda próxima.
- Cartão booking: **entidade, artista, localização, estado, último contacto, próximo passo, responsável, prazo**. Cachet, comissão, evidência extensa e logística aparecem ao expandir.
- Se a localização ou ligação do email não tiver evidência inequívoca, mostrar «Por confirmar», nunca deduzir.
- Cor de **estado comercial** não é cor de urgência. Urgência é sinal separado e datado apenas quando há prazo real.
- Não enviar emails nem alterar estados comerciais automaticamente.

## Acessos pretendidos — não confundir com perfis técnicos existentes

| Colaborador | Booking | Finanças | Restante |
|---|---|---|---|
| Proprietário (Sérgio) | Todas as bandas | Todas | Tudo |
| João Abreu | Todas as bandas | Sem permissão | Sem permissão |
| Ana (Devil of a Woman) | Apenas Devil of a Woman | Todas as finanças da agência | Sem permissão |

**BLOQUEIO DE SEGURANÇA**: a infraestrutura em outubro de 2026 dispõe só dos papéis
`admin / manager / viewer`. `manager` pode usar booking, contactos, parcerias,
finanças e mais. A tabela acima é uma **política de produto**, não autorização
já implementada. NÃO atribuir `manager` à Ana nem ao João presumindo que
o menu esconderá dados. É indispensável implementar e testar autorização no
servidor, filtrando também GETs, exports, auditoria, tarefas e os IDs submetidos.
Não reconhecer utilizadores pela grafia dos seus nomes ou usernames; perfis
devem ser administrados por IDs de conta e escopos explícitos, com revogação.

## Fluxo-alvo de uma mensagem Zoho (uma janela)

1. Mostrar classificador com etiqueta «possível», hora, remetente e acesso à
   mensagem original; **uma tarefa por mensagem**, com revisão humana.
2. Propor ligação por ID / email exato e apresentar ambiguidades, sem fundir.
   Nome de artista/concerto não é inferido sem comprovativo.
3. Utilizador seleciona **oportunidade existente** ou **criar nova**, define
   artista, entidade, responsável, próximo passo e prazo se existir; pode
   manter «Sem prazo».
4. Utilizador escolhe o estado comercial explicitamente, sujeito a provas
   e restrições de contactos já implementadas. Não bastam palavras-chave.
5. Gravar a mudança da oportunidade e a decisão de revisão com idempotência,
   auditoria e proteção a conflitos, sem deixar tarefas fechadas se o
   registo comercial falhou. Nunca alterar dados históricos das fontes.

## Plano de implementação seguro e sequencial

### A. Implementado no Preview
- Sincronização/analise Zoho, sinais apenas em memória durante classificação,
  registo reduzido de sinal e fila com validação humana.
- Cartões compactos com cores integrais, legenda e detalhes recolhidos.
- Localização de booking vinda apenas de ficha inequivocamente ligada.

### B. Pendente: autorização de equipa
- Matriz de permissões por ID de utilizador (não username), recursos e artistas.
- Segregação de acesso ao **servidor**; Ana pode ler/escrever finanças globais
  sem ler o booking das WILDCHAINS; João sem acesso a dados financeiros.
- Testes negativos de API com contas diferentes; invalidar sessões após alteração
  de escopo. Migrar de perfil genérico só depois de validado.

### C. Pendente: fluxo Zoho em uma janela
- Associar mensagem a uma oportunidade e artista **explicitamente**.
- Criar/editar oportunidade e concluir revisão sem estados contraditórios.
- Idempotência, conflitos e validação por testes; sem novas rotas de envio.

### D. Pendente: acompanhamento operacional
- Mostrar tarefas Zoho uma única vez no Início e respetiva oportunidade.
- Ordenar por ação necessária e prazo explícito, não por conjeturas.
- Evitar o «0 concertos» enganoso: distinguir registos operacionais do histórico.
- Validar com utilizador em Preview antes de considerar UI final.
