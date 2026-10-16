# Caravela Control — resolução única de resposta Zoho (Preview)

Âmbito: branch `feature/zoho-mail-readonly-oauth`, PR #1 Draft. Não fazer merge, enviar emails ou publicar produção.

## O que passa a acontecer

- Uma pessoa lê a mensagem original no Zoho e escolhe a oportunidade, entidade, artista, estado, responsável, próximo passo e prazo (se conhecido).
- `POST /api/control/mail/resolve-booking` exige autenticação privada, permissão técnica manager/admin, origem igual à do Preview e confirmação humana.
- O servidor valida os dados com o mesmo validador de Booking; não modifica políticas de contacto, não confirma concertos por classificação heurística e não envia emails.
- O email operacional selecionado na oportunidade tem de coincidir exatamente com o remetente do sinal. Um interlocutor diferente exige associação manual na ficha de Booking.
- O evento comercial append-only e o fecho da tarefa de revisão são guardados no mesmo `D1.batch()` transacional, com eventos de auditoria. O fecho é condicionado à inserção real da revisão do booking.
- O campo `review_note` da tarefa, já existente, conserva apenas `booking:<uuid>`; não há migração D1 nova.
- Repetir a mesma operação após falha de rede devolve `already_applied` se a mesma mensagem e oportunidade foram gravadas; não duplica eventos.
- Outra oportunidade, revisão desatualizada ou mensagem já descartada é recusada.

## O que permanece pendente
- Validação end-to-end autenticada no Cloudflare Preview.
- Recuperação independente testada dos eventos CRM operacionais em D1.
- Permissões Ana/João, adiada expressamente.
- Fluxo de envio de emails, ainda não autorizado.
- Gestão integral de concerto confirmado e distribuição dos pagamentos.

## Testes de aceitação
1. Criar um sinal de booking com dados fictícios e rever a mensagem original.
2. Associar uma oportunidade existente, guardar e verificar que há só um evento e que a revisão fica concluída.
3. Criar nova oportunidade, repetir a mesma operação e verificar que não aparece duplicado.
4. Simular revisão concorrente, email divergente e falha na validação comercial; garantir que a tarefa fica pendente sem nova revisão.
5. Confirmar que o website público, Zoho, Sheets e permissões não mudaram.
