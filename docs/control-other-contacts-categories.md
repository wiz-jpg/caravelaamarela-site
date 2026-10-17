# Caravela Control — «Outros contactos» por tipo (Preview)

Atualização 17/10/2026. Branch `feature/zoho-mail-readonly-oauth` (PR #1 Draft). Não publicar produção.

## Separação

- «Outros contactos» deixa de apresentar **promotores**, que permanecem na secção Promotores do Booking.
- Também não replica Festivais, Venues ou Imprensa.
- Uma ficha continua a ser uma entidade canónica na mesma base D1 e arquivo original; não se migram, fundem nem eliminam registos.
- A navegação é por separadores recolhíveis com contagens, origem, localidade e identificação disponível da ficha.

## Categorias suportadas

- **Parcerias existentes / em conversa / potenciais / anteriores / por definir**, apenas com base em `kind=partnership` e/ou `relationship` já registados.
- **Artistas e equipas**, **Serviços e fornecedores**, **Marcas e patrocínios**, **Instituições e associações** e **Outras entidades identificadas** apenas com `contact_subtype` explicitamente escolhido na ficha.
- **Tipo por identificar** para registos classificados como «Outro» mas sem detalhe suficiente. Nenhuma categoria é deduzida de palavras no nome.

## Edição, rastreabilidade e segurança

- O campo opcional `contact_subtype` é editável na ficha, com histórico append-only e revisão otimista na D1. `unknown` é o valor inicial para registos antigos; não é criada migração nem inventada uma classificação.
- Alterar o tipo específico não autoriza contactar, não altera a relação comercial, não envia mensagens e não muda a entidade para promotor.
- Para corrigir uma ficha que é realmente um promotor mas estava marcada como «Outro», o operador deverá alterar explicitamente `kind` na ficha original, com validação humana.
- Os dados históricos permanecem intocados. O Preview continua com autenticação e regras de contacto.

## Validação

Testes Node 22/SQLite para exclusão dos quatro tipos geridos noutras áreas, agrupamento por categoria e relação, comportamento com tipo desconhecido, pesquisa e revisão de tipo em contactos D1. Teste manual do Preview autenticado ainda necessário.
