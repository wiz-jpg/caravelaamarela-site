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
