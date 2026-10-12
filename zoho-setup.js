(() => {
  "use strict";
  const form = document.querySelector("#connect");
  const input = document.querySelector("#admin-token");
  const button = document.querySelector("#connect-button");
  const diagnose = document.querySelector("#diagnose-button");
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
      oauth_secret_rejected: "O Zoho não aceitou o Client Secret. É necessário confirmar o segredo e a região da aplicação.",
      oauth_network_failure: "O servidor Cloudflare não conseguiu estabelecer ligação ao Zoho.",
      oauth_timeout: "O servidor de autenticação do Zoho demorou mais de 15 segundos a responder.",
      oauth_unexpected_response: "O Zoho devolveu uma resposta que não tem o formato esperado.",
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

  for (const status of ["200", "301", "302", "400", "401", "403", "404", "405", "429", "500", "502", "503", "504", "other"]) {
    // The provider response body is never displayed.
    const code = "oauth_non_json_" + status;
    const description = status === "403"
      ? "O Zoho devolveu HTTP 403 e uma resposta que não é JSON (possível bloqueio de segurança)."
      : status === "429"
        ? "O Zoho devolveu HTTP 429 (limite de pedidos)."
        : "O servidor de autenticação devolveu HTTP " + status + ", mas não enviou JSON válido.";
    if (outcome === code) {
      report(description, true);
    }
  }

  diagnose.addEventListener("click", async () => {
    if (diagnose.disabled || button.disabled) return;
    const token = input.value.trim();
    input.value = "";
    if (!token) return report("Introduz o token administrativo para verificar a ligação.", true);
    button.disabled = true;
    diagnose.disabled = true;
    report("A verificar ligação ao Zoho. Não será pedido acesso aos teus emails…");
    try {
      const response = await fetch("/api/zoho/diagnose", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error"
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "unauthorized") throw new Error("Token administrativo incorreto.");
        if (result.error === "configuration_required") throw new Error("Falta uma configuração do Zoho no Cloudflare.");
        throw new Error("A verificação não pôde começar (" + response.status + ").");
      }
      const detail = result.result;
      const descriptions = {
        oauth_endpoint_responding: "O servidor Zoho respondeu corretamente ao teste. As credenciais parecem ser aceites; falta verificar a autorização real.",
        oauth_client_rejected: "O Zoho recusou o Client ID. Confirma que a aplicação pertence à região europeia.",
        oauth_secret_rejected: "O Zoho recusou o Client Secret. É preciso verificar ou renovar esse segredo.",
        oauth_redirect_rejected: "O Zoho recusou o Redirect URI configurado.",
        oauth_provider_rejected: "O Zoho respondeu com um erro de autenticação que ainda não identificámos.",
        oauth_network_failure: "O Cloudflare não conseguiu estabelecer a ligação ao servidor Zoho.",
        oauth_timeout: "A comunicação com o Zoho excedeu o tempo limite.",
        oauth_unexpected_response: "O servidor Zoho respondeu num formato inesperado.",
        storage_error: "Houve um erro interno na verificação."
      };
      let detailText = descriptions[detail];
      if (!detailText && /^oauth_non_json_(200|301|302|400|401|403|404|405|429|500|502|503|504|other)$/.test(detail)) {
        const status = detail.slice("oauth_non_json_".length);
        detailText = "Resposta HTTP " + status + " do Zoho, mas não em JSON. Pode existir um bloqueio de segurança ou um erro de encaminhamento.";
      }
      report(detailText || "Resultado do diagnóstico: " + String(detail || "desconhecido"), !result.ok);
    } catch (error) {
      report(error.message || "Erro a verificar a ligação.", true);
    } finally {
      button.disabled = false;
      diagnose.disabled = false;
    }
  });

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
