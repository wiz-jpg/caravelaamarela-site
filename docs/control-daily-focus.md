# Caravela Control — foco diário operacional (16/10/2026)

Âmbito: apenas branch \`feature/zoho-mail-readonly-oauth\`, PR #1 (Draft).
Nenhum merge, publicação de produção, envio de emails ou alteração de dados.

## O que muda
- O Início destaca até **5 decisões de booking** a partir de oportunidades nativas, com ligação à edição manual existente.
- As quatro filas completas ficam recolhidas mas acessíveis, sem apagar nem mover registos.
- Prioridade por ordem: revisão com data vencida; revisão de hoje; revisão nos 7 dias seguintes; negociação/resposta registada sem data; oportunidade sem responsável nem data.
- Cada razão é apresentada explicitamente. O campo de prioridade indicado pela equipa só desempata dentro de uma classe e data.
- **Nenhum prazo é inventado:** datas vazias e sinais de email não geram alertas vencidos.
- Apenas os registos operacionais nativos entram no destaque. O arquivo histórico permanece no seu painel, e mensagens Zoho pendentes permanecem no painel de revisão.
- Propostas diferentes da mesma entidade continuam distintas, porque a chave é o ID da oportunidade.
- A função é pura e apenas faz ordenação no browser: não escreve D1, Sheets, R2, Zoho, auditoria, estados ou finanças.
- Pedidos futuros (>7 dias) e propostas ainda não organizadas continuam visíveis nas filas completas.

## Critérios de aceitação
1. Confirmar que o Preview carrega sem erro e que o novo destaque vem antes das filas completas.
2. Testar manualmente com dados **fictícios**: prazo vencido, hoje, próximos dias, proposta sem prazo e duas oportunidades distintas da mesma entidade.
3. Verificar que a revisão Zoho ainda aparece em Início e que nenhum sinal é tratado como acordo confirmado.
4. Expandir todas as filas; confirmar que não desapareceu nenhum registo.
5. Abrir, editar e guardar uma oportunidade fictícia; recarregar e confirmar o estado.
6. Executar os testes de Node 22, rever as verificações do PR e não publicar em Production.

## Limitações mantidas
- A união entre guardar booking e fechar tarefa de revisão Zoho ainda não é transação atómica.
- Envio de emails continua proibido; apenas rascunhos cifrados sujeitos a revisão.
- Perfis de equipa Ana/João ainda não têm scopes impostos pelo servidor.
- Sem prova end-to-end autenticada de Cloudflare Preview, isto é uma melhoria de código e não uma validação operacional concluída.
