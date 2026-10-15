/* Caravela Control: new shell. Retains all existing CRM IDs, parsers and source provenance.
 * No CRM records are embedded in this file. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const main = document.querySelector("body > main");
  const bars = main?.querySelector(".bars");
  const legacyResults = document.getElementById("stats")?.closest("section.results");
  if (!main || !bars || !legacyResults) return;

  const app = document.createElement("div");
  app.id = "control-app";
  app.hidden = true;
  document.body.insertBefore(app, main);
  const side = document.createElement("aside");
  side.className = "cc-sidebar";
  side.innerHTML =
    '<div class="cc-logo"><span class="cc-mark">C</span><div><strong>CARAVELA<br>CONTROL</strong><small>Workspace privado</small></div></div>' +
    '<nav class="cc-nav" aria-label="Navegação principal"><div class="cc-nav-label">Plataforma</div>' +
    '<button type="button" data-view="dashboard"><span class="cc-nav-symbol">◫</span><span class="cc-nav-text">Visão geral</span></button>' +
    '<button type="button" data-view="contacts" data-min-role="manager"><span class="cc-nav-symbol">▤</span><span class="cc-nav-text">Contactos</span></button>' +
    '<button type="button" data-view="booking" data-min-role="manager"><span class="cc-nav-symbol">◇</span><span class="cc-nav-text">Booking e ações</span></button>' +
    '<button type="button" data-view="artists" data-min-role="admin"><span class="cc-nav-symbol">♧</span><span class="cc-nav-text">Artistas</span></button>' +
    '<button type="button" data-view="partnerships" data-min-role="manager"><span class="cc-nav-symbol">◎</span><span class="cc-nav-text">Parcerias</span></button>' +
    '<button type="button" data-view="communications" data-min-role="manager"><span class="cc-nav-symbol">✉</span><span class="cc-nav-text">Comunicações</span></button>' +
    '<button type="button" data-view="sources" data-min-role="admin"><span class="cc-nav-symbol">⚙</span><span class="cc-nav-text">Dados e backups</span></button>' +
    '<button type="button" data-view="team" data-min-role="admin"><span class="cc-nav-symbol">♙</span><span class="cc-nav-text">Equipa e acessos</span></button></nav>' +
    '<div class="cc-side-bottom"><div class="cc-role" id="cc-sidebar-role"></div>' +
    '<div class="cc-user"><span class="cc-avatar" id="cc-user-avatar">C</span>' +
    '<div class="cc-user-details"><strong id="cc-user-name"></strong><small id="cc-user-handle"></small></div></div>' +
    '<button type="button" id="cc-logout">Terminar sessão</button></div>';
  app.appendChild(side);
  app.appendChild(main);
  main.classList.add("cc-workspace");
  const oldBrand = main.querySelector(".brand");
  const oldTitle = main.querySelector("h1");
  const intro = main.querySelector(".intro");
  oldBrand?.remove();
  oldTitle?.remove();
  intro?.remove();

  const top = document.createElement("header");
  top.className = "cc-topbar";
  top.innerHTML =
    '<div><small>Caravela Amarela · Gestão interna</small><h1 id="cc-page-title">Visão geral</h1></div>' +
    '<div class="cc-top-meta"><span class="cc-dot" aria-hidden="true"></span><span>Preview protegido</span></div>';
  main.prepend(top);
  const views = document.createElement("div");
  views.id = "cc-views";
  top.after(views);
  const viewInfo = [
    ["dashboard", "Visão geral", "O ponto de partida para consultar os dados e organizar as próximas decisões."],
    ["contacts", "Contactos", "Festivais, salas, promotores e imprensa — com origens e validação."],
    ["booking", "Booking e ações", "Histórico operacional separado de mensagens observadas. Confirmar sempre a associação."],
    ["artists", "Artistas", "Projetos, condições e histórico das fichas originais."],
    ["partnerships", "Parcerias", "Marcas, entidades e parceiros estratégicos: histórico, propostas, evidência e próximos passos."],
    ["communications", "Comunicações", "Leitura do Zoho e identificação de endereços, sem envios automáticos."],
    ["sources", "Dados e backups", "Importação, cofre, fontes sincronizadas e recuperação de versões."],
    ["team", "Equipa e acessos", "Criar contas, definir funções e revogar acessos."]
  ];
  const viewMap = new Map();
  for (const [id, title, description] of viewInfo) {
    const section = document.createElement("section");
    section.id = "cc-view-" + id;
    section.className = "cc-view";
    section.hidden = true;
    const header = document.createElement("div");
    header.className = "cc-panel-head";
    const h = document.createElement("h2");
    h.textContent = title;
    const lead = document.createElement("p");
    lead.className = "cc-lead";
    lead.textContent = description;
    header.append(h, lead);
    section.appendChild(header);
    views.appendChild(section);
    viewMap.set(id, section);
  }
  const dashboard = viewMap.get("dashboard");
  const stats = $("stats");
  if (stats) dashboard.appendChild(stats);
  const actionRow = document.createElement("div");
  actionRow.className = "cc-actions";
  actionRow.innerHTML =
    '<button type="button" class="cc-primary" data-open="booking">Consultar ações</button>' +
    '<button type="button" class="cc-neutral" data-open="contacts">Pesquisar contactos</button>' +
    '<button type="button" class="cc-neutral" data-open="communications">Ver comunicações</button>';
  dashboard.appendChild(actionRow);
  const brief = document.createElement("div");
  brief.id = "cc-dashboard-brief";
  brief.className = "cc-notice";
  brief.textContent = "Os dados guardados são carregados após a autenticação. As correspondências por email continuam sujeitas a validação.";
  dashboard.appendChild(brief);
  const attention = document.createElement("section");
  attention.className = "cc-dashboard-attention";
  attention.innerHTML =
    '<div class="cc-attention-top"><div><h2>Resumo operacional</h2>' +
    '<p class="cc-lead">Estados declarados nas fontes. Rever as associações e o histórico antes de contactar.</p></div>' +
    '<button type="button" class="cc-neutral" id="cc-attention-open">Abrir todas as ações</button></div>' +
    '<div class="cc-operational-stats">' +
    '<div><small>Em negociação / conversa</small><strong id="cc-count-negotiations">—</strong></div>' +
    '<div><small>Por contactar (fonte)</small><strong id="cc-count-uncontacted">—</strong></div>' +
    '<div><small>Restrições por artista</small><strong id="cc-count-blocked">—</strong></div>' +
    '<div><small>Associações por confirmar</small><strong id="cc-count-unverified">—</strong></div></div>' +
    '<div class="cc-attention-list" id="cc-attention-list">' +
    '<p class="muted">As próximas ações aparecem quando abrires a base guardada.</p></div>';
  dashboard.appendChild(attention);
  $("cc-attention-open").addEventListener("click", () => openView("booking"));
  const note = Array.from(main.children).find(el => el.classList.contains("note"));
  if (note) dashboard.appendChild(note);

  viewMap.get("contacts").appendChild(legacyResults);
  const operational = $("crm-extra");
  const artistsView = viewMap.get("artists");
  if (operational) {
    const panels = operational.querySelectorAll(":scope > .panel");
    if (panels.length > 1) artistsView.appendChild(panels[1]);
    viewMap.get("booking").appendChild(operational);
  }
  const artistsEmpty = document.createElement("div");
  artistsEmpty.id = "cc-artists-empty";
  artistsEmpty.className = "cc-notice";
  artistsEmpty.textContent = "As fichas de artistas aparecem aqui assim que abrires a base guardada.";
  artistsView.appendChild(artistsEmpty);
  const bookingEmpty = document.createElement("div");
  bookingEmpty.id = "cc-booking-empty";
  bookingEmpty.className = "cc-notice";
  bookingEmpty.textContent = "Abre a base guardada para consultar o histórico das ações.";
  viewMap.get("booking").prepend(bookingEmpty);

  const communication = viewMap.get("communications");
  const zoho = bars.querySelectorAll(":scope > .panel")[1];
  if (zoho) communication.appendChild(zoho);
  const triage = $("crm-triage");
  if (triage) communication.appendChild(triage);
  const communicationInfo = document.createElement("div");
  communicationInfo.className = "cc-notice";
  communicationInfo.textContent = "Emails recebidos e enviados são observações, não prova automática de proposta entregue ou resposta comercial.";
  communication.prepend(communicationInfo);

  // Keep imported-source counters outside the daily booking dashboard.
  // They measure historical reconciliation, not current commercial pipeline.
  if(stats)viewMap.get("sources").appendChild(stats);
  viewMap.get("sources").appendChild(attention);
  viewMap.get("sources").appendChild(bars);
  const live = $("control-live-sheets");
  if (live) viewMap.get("sources").appendChild(live);
  const footer = main.querySelector("footer");
  if (footer) viewMap.get("sources").appendChild(footer);
  if (zoho) {
    const tokenInput = $("admin-token");
    if (tokenInput) {
      tokenInput.hidden = true;
      const tokenLabel = zoho.querySelector('label[for="admin-token"]');
      if (tokenLabel) tokenLabel.hidden = true;
    }
    const text = zoho.querySelector("p.muted");
    if (text) text.textContent = "Lê os endereços e datas das mensagens na caixa Zoho, sem modificar mensagens.";
  }

  const team = viewMap.get("team");
  const teamPanel = document.createElement("div");
  teamPanel.className = "cc-team-card";
  teamPanel.innerHTML =
    '<h2>Criar acesso individual</h2>' +
    '<p class="cc-lead">Cada colega terá o seu utilizador e palavra-passe. Partilha a palavra-passe temporária por um canal privado; será obrigatória a mudança no primeiro acesso.</p>' +
    '<form id="cc-add-member"><div class="cc-field-grid">' +
    '<div><label for="cc-new-username">Utilizador</label><input id="cc-new-username" type="text" required minlength="3" maxlength="40" autocomplete="off" placeholder="ex.: joao"></div>' +
    '<div><label for="cc-new-display">Nome apresentado</label><input id="cc-new-display" type="text" required maxlength="80" autocomplete="off" placeholder="Nome do colega"></div>' +
    '<div><label for="cc-new-role">Função</label><select id="cc-new-role"><option value="manager">Gestor</option><option value="viewer">Consulta</option><option value="admin">Administrador</option></select></div>' +
    '<div><label for="cc-new-password">Palavra-passe temporária (mín. 12)</label><input id="cc-new-password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></div></div>' +
    '<div class="cc-actions"><button class="cc-primary" type="submit">Criar utilizador</button></div>' +
    '<p id="cc-team-message" class="status" role="status" aria-live="polite"></p></form></div>' +
    '<div class="cc-team-card"><h2>Utilizadores autorizados</h2>' +
    '<p class="cc-lead">Desativar uma conta ou alterar a sua função revoga imediatamente as sessões existentes.</p>' +
    '<div id="cc-team-list" class="cc-team-list"></div></div>';
  team.appendChild(teamPanel);

  const labels = Object.fromEntries(viewInfo.map(entry => [entry[0], entry[1]]));
  let active = "dashboard", currentUser = null;
  const rank = { viewer: 1, manager: 2, admin: 3 };
  function openView(view) {
    if (!viewMap.has(view)) return;
    const permitted = side.querySelector(`button[data-view="${view}"]`);
    const requirement = permitted?.dataset.minRole;
    if (requirement && (rank[currentUser?.role] || 0) < rank[requirement]) return;
    active = view;
    for (const [key, section] of viewMap) section.hidden = key !== view;
    for (const button of side.querySelectorAll("[data-view]")) {
      if (button.dataset.view === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    $("cc-page-title").textContent = labels[view];
    window.dispatchEvent(new CustomEvent("caravela-control-view-opened",{detail:{view}}));
    if (view === "team") window.dispatchEvent(new Event("caravela-control-team-opened"));
    if (view === "partnerships") window.dispatchEvent(new Event("caravela-control-partnerships-opened"));
  }
  for (const button of side.querySelectorAll("[data-view]")) {
    button.addEventListener("click", () => openView(button.dataset.view));
  }
  for (const button of dashboard.querySelectorAll("[data-open]")) {
    button.addEventListener("click", () => openView(button.dataset.open));
  }
  function updateDashboard(manifest) {
    if (!manifest) return;
    const all = manifest.actions || [];
    const blocked = action => action.contact_policy === "blocked" || action.status === "Não avançar";
    const negotiating = action => ["Em negociação", "Em conversa"].includes(action.status);
    const uncontacted = action => action.status === "Por contactar";
    const blockedCount = all.filter(blocked).length;
    const unverifiedCount = all.filter(x => x.link_status !== "verified_name_email").length;
    $("cc-dashboard-brief").textContent =
      manifest.entities.length.toLocaleString("pt-PT") + " contactos · " +
      all.length.toLocaleString("pt-PT") + " ações operacionais · " +
      (manifest.artists || []).length + " fichas de projetos. " +
      "Os estados são os das fontes originais, não conclusões automáticas da análise Zoho.";
    $("cc-count-negotiations").textContent = all.filter(negotiating).length;
    $("cc-count-uncontacted").textContent = all.filter(uncontacted).length;
    $("cc-count-blocked").textContent = blockedCount;
    $("cc-count-unverified").textContent = unverifiedCount;
    const list = $("cc-attention-list");
    list.replaceChildren();
    const choices = all.filter(action => !blocked(action) && (negotiating(action) || uncontacted(action)))
      .sort((a, b) => Number(negotiating(b)) - Number(negotiating(a))).slice(0, 8);
    if (!choices.length) {
      const empty = document.createElement("p"); empty.className = "muted";
      empty.textContent = "Não há ações com estado «Em negociação», «Em conversa» ou «Por contactar» nesta versão.";
      list.appendChild(empty);
    }
    for (const action of choices) {
      const item = document.createElement("div");
      item.className = "cc-attention-item";
      const left = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = action.name || "Entidade não identificada";
      const info = document.createElement("small");
      info.textContent = (action.artist || "Artista não indicado") +
        (action.link_status !== "verified_name_email" ? " · associação por confirmar" : "");
      left.append(title, info);
      const badge = document.createElement("span");
      badge.className = "cc-stage";
      badge.textContent = action.status || "Sem estado";
      item.append(left, badge);
      list.appendChild(item);
    }
    $("cc-artists-empty").hidden = true;
    $("cc-booking-empty").hidden = true;
  }
  window.addEventListener("caravela-crm-imported", event => updateDashboard(event.detail?.manifest));
  window.addEventListener("caravela-control-authenticated", async event => {
    const user = event.detail?.user;
    if (!user) return;
    currentUser = user;
    app.hidden = false;
    $("cc-user-name").textContent = user.display_name;
    $("cc-user-handle").textContent = "@" + user.username;
    $("cc-user-avatar").textContent = (user.display_name || user.username).slice(0, 1).toUpperCase();
    $("cc-sidebar-role").textContent = ({admin:"Administrador",manager:"Gestor",viewer:"Consulta"})[user.role] || user.role;
    for (const button of side.querySelectorAll("[data-min-role]"))
      button.hidden = (rank[user.role] || 0) < (rank[button.dataset.minRole] || 3);
    const adminOnly = ["vault-save","vault-backup","vault-r2-backup","vault-native-export"];
    for (const id of adminOnly) if ($(id)) $(id).hidden = user.role !== "admin";
    openView("dashboard");
    if(user.role==="admin"){
      try {
        const response = await fetch("/api/control/status",{credentials:"same-origin",cache:"no-store"});
        const state = await response.json();
        if (response.ok && state.active_snapshot) $("vault-load")?.click();
        else $("vault-status")?.click();
      } catch { $("cc-dashboard-brief").textContent = "Não foi possível confirmar o cofre. Verifica a ligação em Dados e backups."; }
    } else {
      $("cc-dashboard-brief").textContent="Vista restrita. Apenas os dados operacionais autorizados são disponibilizados.";
    }
  });
  window.addEventListener("caravela-control-signed-out", () => { app.hidden = true; currentUser = null; });
  function legacyMode() {
    // Until CONTROL_AUTH_ENABLED is switched on, preserve the former token-based Preview workflow.
    currentUser = { role: "admin", username: "preview", display_name: "Modo de transição" };
    app.hidden = false;
    $("cc-user-name").textContent = "Modo de transição";
    $("cc-user-handle").textContent = "Acesso temporário com token";
    $("cc-user-avatar").textContent = "C";
    $("cc-sidebar-role").textContent = "Configuração pendente";
    $("cc-logout").hidden = true;
    $("cc-open-password")?.setAttribute("hidden", "");
    const tokenInput = $("admin-token");
    if (tokenInput) tokenInput.hidden = false;
    const tokenLabel = document.querySelector('label[for="admin-token"]');
    if (tokenLabel) tokenLabel.hidden = false;
    for (const button of side.querySelectorAll("[data-min-role]"))
      button.hidden = button.dataset.view === "team";
    const meta = top.querySelector(".cc-top-meta span:last-child");
    if (meta) meta.textContent = "Modo de transição · Preview";
    openView("sources");
  }
  window.CaravelaControlApp = { openView, legacyMode };
})();
