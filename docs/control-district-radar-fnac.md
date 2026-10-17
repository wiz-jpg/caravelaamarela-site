# Caravela Control — distritos, Radar de Booking e concertos FNAC visíveis

Preview privado em `feature/zoho-mail-readonly-oauth` / PR #1 Draft; não fazer merge para main.

## Imprensa
- Portugal: a primeira e única divisão geográfica é o **distrito**, incluindo Braga e Porto em igualdade com Lisboa, Coimbra, etc. Não utilizar os grupos Braga/arredores, Porto/arredores, Resto de Portugal nem sublistas de distritos.
- Estrangeiro: por país. Localizações nacionais sem município ou distrito dedutível de fonte explícita ficam «Distrito por confirmar».
- Cada distrito ou país mantém os botões «Exportar CSV» de todos os meios visíveis nesse grupo; sem envio automático nem alteração das fichas.
- As sugestões de press para concertos confirmados/annunciados consultam **o distrito do concerto**, não só a correspondência textual do nome da cidade. Outlets de outro distrito não entram por engano.
- Para lançamentos sem distrito definido, sugerir apenas meios com `coverage_scope= national` ou `press_scope=national` explícito; se não houver, mostrar falta de prova, não sugerir meios arbitrários.
- O «Início» reutiliza os mesmos resultados derivados da secção Imprensa através do evento `caravela-control-press-context`; não criar uma segunda lista conflituante.

## Concertos já anunciados
- A agenda pública versionada no repositório contém 10 anúncios de 2026, entre eles 6 datas da FNAC WILDCHAINS (Coimbra 06/11, Chiado 07/11, Cascais 08/11, Braga 21/11, Aveiro 28/11, Viseu 29/11).
- O Booking abre por defeito na temporada 2027, por isso os shows anunciados de 2026 não aparecem no «Fechados» de 2027, de forma correta.
- Criar **painel fixo visível no topo** «Concertos já anunciados» independente do ano selecionado: listar todos os anúncios disponíveis, artista, cidade, dia e «Ver em Fechados 2026», que muda a época para 2026 e desloca o utilizador à coluna.
- Preservar a origem e o conceito correto «concerto anunciado» ≠ contrato/cachet/fatura/recebimento confirmado.
- Não inventar concertos para 2027, nem mover datas de 2026.

## Radar de festivais / venues
- Dentro do Booking, um Radar específico separado do Radar de apoios/candidaturas; 2027, filtro por artista.
- Avaliar os contactos existentes por sinais reais: correspondência, notes sobre género musical, histórico de conversa e estado da entidade. Não transformar ausência de prova em adequação confirmada.
- Excluir contactos bloqueados, duplicados secundários, recusados para a banda e época e alvos megafestivais fora do perfil de abordagem prática.
- Exibir uma lista pequena priorizada e outra por pesquisar, nunca centenas de itens indiferenciados.
- Como sinal adicional para WILDCHAINS, consultar fontes públicas comprovadas da edição 2027 de Laurus Nobilis e Milagre Metaleiro; marcar explicitamente «edição anunciada, vagas não confirmadas», sem supor inscrição aberta. Datas, género e viabilidade comercial devem ser confirmados por humano.
- Não existe ainda crawler agendado ou monitor de novas edições; o Radar atual sintetiza dados já disponíveis e os dois eventos verificados. Não afirmar descoberta contínua da internet.
- Próxima etapa: monitor de fontes oficiais com revisões, deduplicação, prova de alterações e criação de tarefas sujeitas à validação humana.

## Segurança
Nenhum email, merge, publicação em produção, alteração dos estados do D1, edição de ficheiros de contacto, entrada contabilística ou decisão comercial automática.

## Testes
Testes Node 22/SQLite para geografia, ranking, bloqueios, datas públicas e renderização. Teste visual autenticado posterior necessário.
