# Imprensa — diretório por localização e exportação CSV (Preview)

Implementação 17/10/2026 na branch `feature/zoho-mail-readonly-oauth` / PR #1 Draft.

## Navegação
- **Braga (e arredores)**, **Porto (e arredores)**, **Resto de Portugal** e um bloco por **país estrangeiro**.
- Todos os blocos são recolhidos inicialmente; podem ser abertos e fechados individualmente.
- Dentro de **Resto de Portugal**, os meios são subdivididos por **distrito**, cada um com o respetivo bloco recolhível. Açores e Madeira são apresentados pelo nome da região; as localidades ambíguas ficam em **Distrito por confirmar**.
- A pesquisa por texto mantém-se, filtrando os contactos e abrindo automaticamente os grupos correspondentes. As aberturas feitas sem pesquisa são preservadas enquanto a sessão está ativa.
- Renderização dos cartões é adiada até abrir a localização; evita acrescentar centenas de cartões à interface logo à entrada.

## CSV
- Cada localização tem, **no fim do bloco aberto**, botão **Exportar CSV**.
- O Resto de Portugal permite exportar **por distrito** e, no fim do grupo principal, exportar **todo o Resto de Portugal**.
- Em pesquisa ativa, o CSV contém exatamente os contactos desse grupo que cumprem a pesquisa, não uma exportação invisível da lista completa.
- O CSV contém todos os registos do grupo, sem limite de 35/70 cartões. Deduplicação apenas por ID canónico, sem apagar nem juntar fichas na base.
- CSV UTF-8 com BOM, colunas separadas por ponto e vírgula; células escapadas contra aspas, mudanças de linha e fórmulas de folhas de cálculo.
- Colunas: entidade, emails, nomes/funções dos interlocutores, emails de interlocutores, localidade, região, país, situação de contacto, fonte e ID.
- Bloqueados, partilhados e não autorizados podem aparecer na lista solicitada **com aviso explícito no CSV**. Exportar é preparar dados para revisão, **não** autorização para campanhas ou emails.
- Não há mutações no D1, envios Zoho, mudanças de estado comercial, permissões ou dados de produção.

## Validação
- Unit tests: divisões geográficas, distrito por município conhecido, não inferir distrito a partir de macro-regiões, CSV completo, deduplicação, codificação e escape, restrições.
- Validação adicional na interface protegida é necessária.
