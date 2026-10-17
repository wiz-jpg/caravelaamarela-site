# Correção de registos nativos apagados que reaparecem em «Outros contactos»

Preview apenas, 17/10/2026, branch `feature/zoho-mail-readonly-oauth`.

## Diagnóstico

- O utilizador confirmou que a ficha manual de teste «Teste» (Braga) ainda surge em «Outros contactos» após ter sido removida noutra área.
- A operação de remoção existe e regista um tombstone append-only na D1, mas a vista de «Outros contactos» geria o seu próprio estado em memória e a operação de remoção na Base completa não emitia um evento de atualização. Isto permite desfasamento entre separadores.
- Não há acesso direto à D1 autenticada neste ambiente: não afirmar que o tombstone de «Teste» existe nem removê-lo silenciosamente. Caso apareça como ativo na leitura nova, permitir a sua remoção explícita e verificada.

## Implementado

1. Adicionar **Remover ficha** aos cartões em «Outros contactos» apenas para fichas nativas sem `origin_id` e com `revision`.
2. Exigir confirmação humana. Fazer `DELETE native/contacts` autenticado e validar `removed:true`, depois reconsultar `GET native/contacts`; só então remover da vista e sinalizar sucesso.
3. Erros e dependências mostram mensagem e mantêm a ficha; não apresentar sucesso quando não confirmado.
4. Emitir `caravela-control-contacts-updated` após remoção também na «Base completa» e refrescar ambos os painéis. Se um carregamento estiver em curso, enfileirar um novo em vez de descartar o pedido e arriscar dados antigos.
5. Corrigir o subtítulo da secção para não mencionar promotores e simplificar o título interno repetido.
6. Manter os eventos de auditoria, snapshots, contactos com referências financeiras/comerciais e a segurança das ligações.

## Validação

Os testes Node 22/SQLite abrangem tombstones, leituras posteriores, histórico imutável e a existência do fluxo de verificação da UI. Validação manual autenticada: após deploy, abrir «Outros contactos», usar «Remover ficha» no único registo nativo «Teste», confirmar e verificar também a Base completa, sem modificar outras fichas.

Produção inalterada; não fazer merge, não enviar emails.
