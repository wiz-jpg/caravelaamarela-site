(() => {
  "use strict";
  const form = document.querySelector("#connect");
  const input = document.querySelector("#admin-token");
  const button = document.querySelector("#connect-button");
  const message = document.querySelector("#message");

  function report(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }

  // The OAuth callback only passes a fixed, non-sensitive error identifier.
  // Remove it immediately after displaying the explanation.
  const outcome = new URLSearchParams(window.location.search).get("result");
  if (outcome) {
    const explanations = {
      oauth_client_rejected: "O Zoho recusou as credenciais da aplicação. Precisamos de verificar a configuração do Client ID e Client Secret no Cloudflare.",
      oauth_redirect_rejected: "O Zoho recusou o endereço de retorno. Precisamos de conferir o Redirect URI.",
      oauth_provider_rejected: "O servidor de autenticação do Zoho recusou a troca do código por tokens. Vamos verificar os dados da aplicação.",
      oauth_transport_error: "A ligação ao servidor de autenticação do Zoho falhou ou devolveu uma resposta inválida.",
      accounts_provider_rejected: "A autenticação avançou, mas o Zoho recusou o pedido de consulta da conta de email.",
      accounts_transport_error: "A autenticação avançou, mas não foi possível obter uma resposta válida da API do Zoho Mail.",
      reauthorization_required: "O código de autorização não foi aceite ou expirou. Será necessária uma nova autorização.",
      refresh_token_missing: "O Zoho não devolveu o token necessário para manter a ligação ativa.",
      mailbox_mismatch: "A conta autorizada não corresponde à caixa de booking da Caravela.",
      invalid_scopes: "As permissões concedidas pelo Zoho não correspondem às permissões de leitura exigidas.",
      invalid_state: "A sessão de autorização expirou ou não coincide com este navegador.",
      invalid_code: "O Zoho não devolveu um código de autorização válido.",
      authorization_denied: "A autorização foi recusada ou cancelada.",
      storage_error: "Não foi possível concluir a ligação por um erro interno. Não repitas a autorização por enquanto."
    };
    report(explanations[outcome] || "A ligação não ficou concluída. Não repitas a autorização por enquanto.", true);
    window.history.replaceState(null, "", window.location.pathname);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    const token = input.value.trim();
    input.value = "";
    if (!token) return report("Introduz o token administrativo.", true);
    button.disabled = true;
    report("A preparar a autorização segura…");
    try {
      const response = await fetch("/api/zoho/authorize", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error"
      });
      const result = await response.json();
      if (!response.ok) {
        const messages = {
          unauthorized: "Token incorreto. Verifica o token administrativo do Preview.",
          invalid_origin: "O endereço do ambiente Preview não coincide com o Redirect URI.",
          configuration_required: "Falta configurar um dos segredos ou bindings do Cloudflare Preview.",
          storage_error: "Não foi possível aceder à base de dados de teste."
        };
        throw new Error(messages[result.error] || "Não foi possível iniciar a autorização (" + response.status + ").");
      }
      const destination = new URL(result.authorizationUrl);
      if (destination.protocol !== "https:" ||
          !["accounts.zoho.eu", "accounts.zoho.com"].includes(destination.hostname) ||
          destination.pathname !== "/oauth/v2/auth") {
        throw new Error("O servidor devolveu um endereço de autorização inválido.");
      }
      report("A abrir a autorização oficial do Zoho…");
      window.location.assign(destination.href);
    } catch (error) {
      report(error.message || "Erro de ligação. Tenta novamente.", true);
      button.disabled = false;
    }
  });
})();
