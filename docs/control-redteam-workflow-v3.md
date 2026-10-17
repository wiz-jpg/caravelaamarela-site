# Caravela Control — auditoria redteam operacional v3
17/10/2026. Alterações em feature/zoho-mail-readonly-oauth, PR #1 Draft, só Preview.

## Problemas identificados
- Início: mensagens recentes Zoho escondidas, 122 revisões históricas visíveis como urgências apesar de não comprovarem follow-ups de negociação.
- Booking: 8 colunas, 238+ cartões por calendarizar, vários níveis de scroll, texto repetido, promotores em lista gigantesca, rascunhos vazios a ocupar o topo.
- Fechados: datas anunciadas precisam de ser visíveis no próprio quadro, com datas passadas a cinzento; anúncio não prova pagamento.
- Radar de festivais: a pesquisa externa precisa de uma API key; fontes estáticas não equivalem a pesquisa atual.
- Imprensa: 599 fichas, centenas com localização por reconciliar; não confundir Portugal sem distrito com país desconhecido. Cultura portuguesa é uma classificação de alcance editorial.
- Oportunidades: fontes estáticas desnecessariamente expandidas; 0 candidaturas abertas verificadas.
- Repetição de títulos e tabela AÇÕES técnica em Booking.

## Princípios de desenho
A próxima atividade comprovada deve aparecer antes do arquivo; base e histórico canónicos não são duplicados; a mesma ficha serve Booking, imprensa e parcerias. Foco na evidência e na decisão, nunca na interpretação automática de histórico como confirmação comercial.

## Implementado
1. Mensagens Zoho reais prioritárias no Início; só 2–3 itens por bloco de trabalho. Revisões derivadas de AÇÕES permanecem disponíveis mas recolhidas e identificadas como arquivo, nunca apresentadas como urgências comprovadas.
2. Booking: colunas úteis e Fechados em primeiro plano, etapas secundárias recolhidas, cartões com detalhes expandíveis e listas iniciais limitadas, promotores pesquisáveis e recolhidos. Responsive layout, menos scroll interno.
3. Rascunhos cifrados e fontes de Oportunidades recolhidos por defeito. A tabela original AÇÕES passa a Administração → Dados e backups.
4. Imprensa: 241 nomes portugueses e 30 referências geográficas de meios cruzados com a lista [UPDATED] Media List do Google Drive; apresentação por cultura editorial nacional, distritos, Portugal sem distrito, país desconhecido ou estrangeiro. Sem mutações em contactos originais.
5. Radar: estado da ligação ao fornecedor de pesquisa, pesquisas explícitas por WILDCHAINS/Devil e território Portugal/Espanha/França. Três consultas externas por clique; resultados apenas pistas para revisão humana.

## Dependência Brave Search API
A pesquisa ao vivo exige segredo CONTROL_BRAVE_SEARCH_API_KEY no Cloudflare Pages, ambiente Preview. O gestor deve criar a chave na Brave e colá-la diretamente no Cloudflare → Workers & Pages → caravelaamarela-site → Settings → Variables and secrets → Preview, como Secret encriptado. Não partilhar a chave no chat, prints ou GitHub. O fornecedor atualmente anuncia $5 de crédito mensal e $5/1000 consultas; com três consultas por busca isso representa cerca de $0,015 por busca fora dos créditos. Configurar saldo pré-pago $0 / controlo de custos antes da ativação. Esta implementação não cria monitorização recorrente.

## Validação adicional
Os testes automatizados não validam automaticamente a sessão Cloudflare, o histórico real D1 ou Zoho. É preciso confirmar no Preview que os concertos FNAC aparecem em Fechados, que o total de imprensa se conserva com novas categorias, que a fila Zoho mostra mensagens recentes e que a primeira busca real devolve fontes não existentes no CRM. Não fazer merge nem enviar emails automaticamente.
