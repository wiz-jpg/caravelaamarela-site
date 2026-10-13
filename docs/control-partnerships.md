# Parcerias estratégicas — Caravela Control Preview

A nova área Parcerias separa relações com marcas, instituições e fornecedores do Booking e do Artist Pipeline.

## Dados e segurança

- Registo de oportunidades, objetivos, prioridades, contactos e próximos passos.
- Histórico imutável em D1: tabela control_decision_events, operação partnership_record_v1. Não exige nova migração SQL.
- O histórico do Zoho, os snapshots V3 e os Sheets originais não são alterados.
- Não são enviados emails nem feitos follow-ups automáticos.
- GET /api/control/partnerships: consulta autenticada.
- POST e PATCH /api/control/partnerships: gestão apenas por administrador/gestor, com controlo de origem e cabeçalho X-Caravela-Request.
- O token antigo funciona apenas no Preview durante o modo de transição; não é guardado no navegador.
- O repositório não inclui nomes, contactos nem negociações privadas; os dados são importados localmente por utilizador autorizado.

## Estados

- Ideia: sem proposta pronta ou envio.
- Proposta preparada: não indica que foi enviada.
- Contacto referido: envio por verificar no Zoho.
- Envio verificado: precisa de referência explícita de mensagem ou documento.
- Resposta referida: requer validação para confirmação externa.
- Em negociação: registo manual do estado.
- Colaboração realizada, reportada: relato do utilizador, não contrato necessariamente financeiro.
- Parceria confirmada: requer evidência de mensagem ou acordo.
- Em pausa / Fechada: motivo e próximo passo nas notas.

## Levantamento inicial

Um ficheiro JSON privado, formato caravela.partnerships.review.v1,
pode importar até 40 oportunidades por lote. A importação não substitui
registos existentes. O levantamento de 13/10/2026 contém 20 hipóteses,
classificadas conforme fontes anteriores e pesquisa pública, com
estatutos conservadores:
McDonald's/FNAC (colaboração reportada); Repsol/Visit Braga
(contactos referidos sem prova Zoho nesta revisão); SC Braga e outras
entidades (ideias sem envio confirmado).

## Fonte de verdade

- Booking permanece no Google Sheet Caravela Control AÇÕES.
- Representação artística permanece no Artist Pipeline 2026–27.
- Parcerias estratégicas novas ficam no registo de eventos D1, sem duplicar
  nenhuma das duas folhas. Se futuramente for criado um separador PARCERIAS,
  reconciliar versões e definir uma única fonte editável.
- Fontes externas são pistas de contacto, não confirmação de parceria.

Trabalhar apenas na branch feature/zoho-mail-readonly-oauth. Sem merge
ou publicação em Production. A plataforma Pages pode criar Previews
automaticamente quando se envia um commit.
