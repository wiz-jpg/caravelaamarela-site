/* Caravela Control: individual login, first-run owner registration and admin user management.
 * Passwords are sent only to the Preview API and never stored in browser storage. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const session = { authenticated: false, user: null };
  window.CaravelaControlSession = session;
  const overlay = document.createElement("div");
  overlay.id = "cc-auth-overlay";
  overlay.innerHTML =
    '<div class="cc-auth-box"><div class="cc-auth-mark"><span class="cc-auth-logo">C</span><span>CARAVELA CONTROL</span></div>' +
    '<h1 id="cc-auth-title">A verificar acesso...</h1>' +
    '<p id="cc-auth-description">A preparar o acesso privado à plataforma.</p>' +
    '<form id="cc-login-form" hidden>' +
      '<label for="cc-login-name">Utilizador</label><input id="cc-login-name" type="text" required autocomplete="username" maxlength="40">' +
      '<label for="cc-login-password">Palavra-passe</label><input id="cc-login-password" type="password" required autocomplete="current-password">' +
      '<button type="submit">Entrar na plataforma</button></form>' +
    '<form id="cc-bootstrap-form" hidden>' +
      '<label for="cc-boot-token">Token administrativo existente (apenas uma vez)</label>' +
      '<input id="cc-boot-token" type="password" required autocomplete="off">' +
      '<label for="cc-boot-name">Utilizador de administração</label>' +
      '<input id="cc-boot-name" type="text" minlength="3" maxlength="40" required autocomplete="username" placeholder="ex.: sergio">' +
      '<label for="cc-boot-display">Nome apresentado</label><input id="cc-boot-display" type="text" required maxlength="80">' +
      '<label for="cc-boot-password">Palavra-passe (mínimo 12 caracteres)</label>' +
      '<input id="cc-boot-password" type="password" minlength="12" maxlength="128" required autocomplete="new-password">' +
      '<button type="submit">Criar conta de administrador</button></form>' +
    '<form id="cc-change-password-form" hidden>' +
      '<label for="cc-old-password">Palavra-passe atual</label>' +
      '<input id="cc-old-password" type="password" required autocomplete="current-password">' +
      '<label for="cc-change-password">Nova palavra-passe (mínimo 12 caracteres)</label>' +
      '<input id="cc-change-password" type="password" minlength="12" maxlength="128" required autocomplete="new-password">' +
      '<button type="submit">Guardar nova palavra-passe</button>' +
      '<button id="cc-cancel-password" type="button" class="secondary">Voltar</button></form>' +
    '<p class="cc-auth-error" id="cc-auth-error" role="alert"></p>' +
    '<p class="cc-auth-hint">Acesso individual ao CRM. A proteção Cloudflare Access mantém-se ativa no Preview.</p></div>';
  document.body.appendChild(overlay);
  const forms = ["cc-login-form", "cc-bootstrap-form", "cc-change-password-form"];
  const errors = {
    invalid_credentials: "Utilizador ou palavra-passe inválidos.",
    temporarily_locked: "Demasiadas tentativas. Aguarda cerca de 15 minutos.",
    unauthorized: "Não tens autorização para esta operação.",
    forbidden: "A tua função não permite esta operação.",
    invalid_origin: "Pedido de segurança recusado. Atualiza a página.",
    auth_migration_required: "Falta aplicar a migração 0004_control_auth.sql na base D1 do Preview.",
    not_found: "A autenticação ainda não está ativada no ambiente Preview.",
    already_initialized: "Já existe um administrador. Inicia sessão normalmente.",
    username_unavailable: "Esse nome de utilizador já está em uso.",
    invalid_account: "Confirma o nome de utilizador, a função e a palavra-passe (mínimo 12 caracteres).",
    invalid_password: "A nova palavra-passe tem de ter entre 12 e 128 caracteres.",
    cannot_remove_own_admin_access: "Não podes retirar o teu próprio acesso de administrador.",
    last_admin_required: "É obrigatório manter pelo menos um administrador ativo.",
    auth_operation_failed: "Não foi possível concluir a operação. Verifica a ligação e tenta novamente."
  };
  function authMessage(message, bad = false) {
    const el = $("cc-auth-error");
    el.textContent = errors[message] || message || "";
    el.classList.toggle("ok", !bad);
  }
  function mode(which) {
    for (const id of forms) $(id).hidden = id !== which;
    authMessage("");
    const config = {
      "cc-login-form": ["Entrar", "Acede aos contactos, booking e artistas com a tua conta individual."],
      "cc-bootstrap-form": ["Criar a primeira conta", "Esta operação é única. Usa o token antigo uma vez para criar o administrador principal."],
      "cc-change-password-form": ["Alterar palavra-passe", "A tua conta exige uma palavra-passe individual. A nova terá de ter pelo menos 12 caracteres."]
    };
    if (config[which]) {
      $("cc-auth-title").textContent = config[which][0];
      $("cc-auth-description").textContent = config[which][1];
    }
  }
  async function api(path, options = {}) {
    const { headers: supplied, ...rest } = options;
    let response;
    try {
      response = await fetch("/api/control/auth/" + path, {
        ...rest, credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { "X-Caravela-Request": "1", ...(supplied || {}) }
      });
    } catch { throw Error("Não foi possível comunicar com o servidor."); }
    let result;
    try { result = await response.json(); }
    catch {
      // Cloudflare Access challenges and Worker runtime errors can return HTML.
      // Never display their HTML or include request bodies, tokens or passwords.
      const status = response.status;
      if (status === 429) throw Error("temporarily_locked");
      if (status >= 500) throw Error("Falha de execução no Cloudflare (HTTP " + status +
        "). Não foi possível confirmar a operação. Consulta o estado da conta antes de repetir.");
      if (status === 403 || status === 401) throw Error("O Cloudflare bloqueou o pedido (HTTP " + status +
        "). Verifica o Access e volta a entrar.");
      throw Error("O servidor devolveu uma resposta inesperada (HTTP " + status + ").");
    }
    if (!response.ok) throw Error(result.error || "Erro " + response.status);
    return result;
  }
  function reveal(user) {
    session.authenticated = true;
    session.user = user;
    if (user.must_change_password) {
      overlay.hidden = false;
      mode("cc-change-password-form");
      return;
    }
    overlay.hidden = true;
    window.dispatchEvent(new CustomEvent("caravela-control-authenticated", { detail: { user } }));
  }
  async function startup() {
    try {
      const me = await api("me");
      if (me.authenticated && me.user) return reveal(me.user);
      const boot = await api("bootstrap-status");
      mode(boot.needs_bootstrap ? "cc-bootstrap-form" : "cc-login-form");
    } catch (error) {
      if (error.message === "not_found" && window.CaravelaControlApp?.legacyMode) {
        overlay.hidden = true;
        window.CaravelaControlApp.legacyMode();
        return;
      }
      $("cc-auth-title").textContent = "Configuração pendente";
      $("cc-auth-description").textContent = "A plataforma ainda não está pronta para autenticar utilizadores.";
      authMessage(error.message, true);
    }
  }
  $("cc-login-form").addEventListener("submit", async event => {
    event.preventDefault();
    authMessage("A autenticar...");
    const name = $("cc-login-name").value.trim(), pw = $("cc-login-password").value;
    $("cc-login-password").value = "";
    try {
      const data = await api("login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: pw })
      });
      reveal(data.user);
    } catch (error) { authMessage(error.message, true); }
  });
  $("cc-bootstrap-form").addEventListener("submit", async event => {
    event.preventDefault();
    authMessage("A criar conta...");
    const token = $("cc-boot-token").value;
    const password = $("cc-boot-password").value;
    $("cc-boot-token").value = "";
    $("cc-boot-password").value = "";
    try {
      const data = await api("bootstrap", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          username: $("cc-boot-name").value, display_name: $("cc-boot-display").value, password
        })
      });
      reveal(data.user);
    } catch (error) { authMessage(error.message, true); }
  });
  $("cc-change-password-form").addEventListener("submit", async event => {
    event.preventDefault();
    authMessage("A guardar...");
    const old_password = $("cc-old-password").value, new_password = $("cc-change-password").value;
    $("cc-old-password").value = "";
    $("cc-change-password").value = "";
    try {
      const data = await api("change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password, new_password })
      });
      reveal(data.user);
    } catch (error) { authMessage(error.message, true); }
  });
  $("cc-cancel-password").addEventListener("click", () => {
    if (session.user?.must_change_password) return;
    overlay.hidden = true;
  });
  const sideBottom = document.querySelector(".cc-side-bottom");
  if (sideBottom) {
    const change = document.createElement("button");
    change.type = "button";
    change.id = "cc-open-password";
    change.className = "cc-neutral";
    change.textContent = "Alterar palavra-passe";
    const logout = $("cc-logout");
    sideBottom.insertBefore(change, logout);
    change.addEventListener("click", () => { overlay.hidden = false; mode("cc-change-password-form"); });
  }
  $("cc-logout")?.addEventListener("click", async () => {
    try { await api("logout", { method: "POST" }); } catch {}
    session.authenticated = false;
    session.user = null;
    window.dispatchEvent(new Event("caravela-control-signed-out"));
    // Drop all client-side CRM data and any previously loaded file objects.
    window.location.reload();
  });

  const teamMsg = (message, bad = false) => {
    const el = $("cc-team-message");
    if (el) { el.textContent = errors[message] || message; el.classList.toggle("error", bad); }
  };
  async function refreshUsers() {
    if (session.user?.role !== "admin") return;
    const root = $("cc-team-list");
    if (!root) return;
    try {
      const data = await api("users");
      root.replaceChildren();
      for (const user of data.users) {
        const item = document.createElement("div");
        item.className = "cc-member";
        const info = document.createElement("div");
        info.className = "cc-member-info";
        const name = document.createElement("strong");
        name.textContent = user.display_name + (user.enabled ? "" : " · desativado");
        const meta = document.createElement("small");
        meta.textContent = "@" + user.username +
          " · " + ({admin:"Administrador",manager:"Gestor",viewer:"Consulta"})[user.role] +
          (user.must_change_password ? " · aguarda mudança de palavra-passe" : "");
        info.append(name, meta);
        const controls = document.createElement("div");
        controls.className = "cc-member-controls";
        const role = document.createElement("select");
        role.setAttribute("aria-label", "Função de " + user.display_name);
        for (const option of [{value:"admin",label:"Administrador"},{value:"manager",label:"Gestor"},{value:"viewer",label:"Consulta"}]) {
          const opt = document.createElement("option");
          opt.value = option.value; opt.textContent = option.label; role.append(opt);
        }
        role.value = user.role;
        const apply = document.createElement("button");
        apply.type = "button"; apply.textContent = "Guardar função"; apply.className = "secondary";
        apply.addEventListener("click", () => modify(user.id, { role: role.value }));
        const toggle = document.createElement("button");
        toggle.type = "button"; toggle.className = "secondary";
        toggle.textContent = user.enabled ? "Desativar" : "Reativar";
        toggle.addEventListener("click", () => {
          if (user.enabled && !confirm("Desativar a conta de " + user.display_name + " e terminar as suas sessões?")) return;
          modify(user.id, { enabled: !user.enabled });
        });
        const reset = document.createElement("button");
        reset.type = "button"; reset.className = "secondary"; reset.textContent = "Repor palavra-passe";
        reset.addEventListener("click", () => {
          const password = prompt("Nova palavra-passe temporária (mínimo 12 caracteres). Partilha apenas em privado:");
          if (password === null) return;
          if (password.length < 12 || password.length > 128) return teamMsg("invalid_password", true);
          modify(user.id, { password });
        });
        controls.append(role, apply, toggle, reset);
        item.append(info, controls);
        root.append(item);
      }
    } catch (error) { teamMsg(error.message, true); }
  }
  async function modify(id, change) {
    try {
      await api("users/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      teamMsg("Alteração guardada. As sessões afetadas foram revogadas.");
      await refreshUsers();
    } catch (error) { teamMsg(error.message, true); }
  }
  $("cc-add-member")?.addEventListener("submit", async event => {
    event.preventDefault();
    const password = $("cc-new-password").value;
    $("cc-new-password").value = "";
    if (!session.authenticated || session.user?.role !== "admin") return;
    try {
      await api("users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("cc-new-username").value.trim(),
          display_name: $("cc-new-display").value.trim(),
          role: $("cc-new-role").value, password
        })
      });
      $("cc-add-member").reset();
      teamMsg("Conta criada. Partilha a palavra-passe temporária por um canal privado.");
      await refreshUsers();
    } catch (error) { teamMsg(error.message, true); }
  });
  window.addEventListener("caravela-control-team-opened", refreshUsers);
  startup();
})();
