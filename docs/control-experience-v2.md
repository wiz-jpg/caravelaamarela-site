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


## Implementação efetiva — outubro de 2026 (Preview, não produção)

### Janelas por entidade

- Campos persistidos **nas revisões nativas append-only**, sem migração D1:
  `contact_window_start` e `contact_window_end` (`MM-DD` internamente,
  introduzidos como **DD/MM**), `contact_window_basis`, `contact_window_reason`,
  `contact_window_reference`.
- Fontes: `official` (fonte declarada como oficial), `direct` (resposta direta),
  `history` (padrão histórico), `hypothesis` (hipótese). São **declarações
  do operador**, não verificações independentes pelo software.
  Fonte oficial ou direta exige referência; qualquer janela exige motivo.
- Nenhuma data pré-preenchida para entidades sem evidência. Feb. 29 inválido
  em recorrência anual para evitar anos impossíveis. Intervalos que cruzam
  dezembro/janeiro são suportados.
- Contactos permite «Definir janela ideal» sem abrir a ficha completa;
  também filtra «Janela aberta agora», «Abre nos próximos 30 dias» e
  «Janela por pesquisar». Início destaca apenas janelas com fonte diferente
  de hipótese, sem bloqueios históricos conhecidos.
- Contactos não autorizados continuam sujeitos a validação manual e não
  aparecem como emails prontos a enviar.
- No exemplo «Rock in Rio», **não há semana de submissões de opening acts
  comprovada pela pesquisa pública efetuada**; não inserir uma semana arbitrária.
- História preservada, IDs preservados, nenhum envio, nenhuma alteração
  comercial automática. Não inferir janelas só pela data pública do festival.

### Navegação e cartões

- Menu diário: Início, Booking e Contactos. Finanças, Parcerias, Artistas e Ajuda
  em «Outras áreas»; Administração mantém-se separada.
- Contactos: identidade, local e altura preferível visíveis. Outros campos
  em «Detalhes e histórico», triagem/CSV em painéis fechados por defeito.
- Booking: cartões integrais coloridos, campos úteis expostos e resto recolhido.
  Legenda próxima. Estado comercial e urgência separados.
- O roster mostra apenas a contagem comprovada pelos registos operacionais,
  não toda a atividade histórica das bandas.

### Mensagens Zoho numa única janela

- Na fila Zoho de Contactos, o botão «Resolver numa janela» é apresentado
  em sinais com tópico de booking. Lista apenas oportunidades candidatas por
  ligação de ficha e/ou email observado; seleção explicitamente humana.
- A equipa confirma que leu a mensagem, escolhe nova/existente oportunidade,
  preenche artista, evento, estado, responsável, próximo passo e prazo (opcional).
  Não oferece nova confirmação comercial automática. O servidor mantém as
  restrições originais de `handleNative`.
- Operação é **sequencial**: guardar booking e, quando guardado, fechar tarefa.
  **Ainda não é transação atómica entre as duas tabelas**. Se fechar a tarefa
  falhar após guardar o booking, a interface informa que o booking já foi
  guardado e bloqueia a repetição de gravação na janela atual; a tarefa pode
  ser concluída manualmente. Um eventual refresh exige rever a oportunidade
  antes de tentar novamente, para não criar duplicados.
- Conserva referência à mensagem no histórico manual da oportunidade. O texto
  do email não é guardado no booking.
- Finanças e permissões particulares de Ana/João continuam por implementar
  no servidor; não ativar acesso alargado provisório para simular funções.

### Aceitação no Preview

1. Rever Início: prioridades Zoho, janelas de contactos e quatro filas de booking.
2. Abrir Contactos, verificar pesquisa, filtros e cartões recolhidos.
3. Editar **uma ficha de teste aprovada** com janela anual e referência; recarregar
   para confirmar persistência e data futura correta.
4. Em mensagem Zoho cujo conteúdo foi revisto, testar «Resolver numa janela»
   com uma oportunidade de ensaio não confirmada. Não marcar acordos reais.
5. Confirmar que Cloudflare Pages e Node 22 / SQLite safety tests passam,
   sem merge de PR nem alteração do hostname de produção.
