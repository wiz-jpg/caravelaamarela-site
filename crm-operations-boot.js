/* Static UI scaffold only. NO user-controlled HTML or data ever interpolated. */
(() => {
  "use strict";
  const anchor=document.querySelector("footer");
  if(!anchor)return;
  const style=document.createElement("style");
  style.textContent=String.raw`
    .crm-artist-item{border:1px solid #44463d;border-radius:8px;padding:12px;margin-top:10px;background:#191b17}
    .crm-artist-item summary{cursor:pointer;font-weight:750;color:#f0ce65}
    .crm-artist-item dl{display:grid;grid-template-columns:minmax(130px,1fr) 3fr;gap:7px 14px;font-size:13px;margin-top:14px}
    .crm-artist-item dt{color:#bcbcb0;font-weight:650}
    .crm-artist-item dd{margin:0;overflow-wrap:anywhere}
    #crm-extra[hidden]{display:none}
    @media(max-width:760px){.crm-artist-item dl{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  const section=document.createElement("section");
  section.id="crm-extra";section.className="results";section.hidden=true;
  // Deliberately static, trusted markup. Records are rendered elsewhere with textContent.
  section.innerHTML=String.raw`
    <h2>Histórico operacional e artistas</h2>
    <p id="crm-extra-count" class="muted"></p>
    <p id="crm-extra-verification" class="note"></p>
    <p id="crm-evidence-count" class="muted"></p>
    <div class="panel" style="margin-top:20px">
      <h2>Ações do Caravela Control</h2>
      <p class="muted">Todas as ações originais aparecem aqui, mesmo sem correspondência segura com a base geral. «Enviado» é o estado da folha, não prova de entrega Zoho.</p>
      <div class="toolbar" style="grid-template-columns:2fr 1fr">
        <div><label for="crm-actions-search">Pesquisar ações</label><input id="crm-actions-search" type="search" placeholder="Entidade, artista, email"></div>
        <div><label for="crm-actions-state">Filtrar</label><select id="crm-actions-state">
          <option value="all">Todas</option>
          <option value="unresolved">Associação por rever</option>
          <option value="sent">Enviado na folha</option>
          <option value="negotiation">Negociação / conversa</option>
          <option value="blocked">Não avançar / falha de entrega</option>
        </select></div>
      </div>
      <p id="crm-actions-count" class="muted"></p>
      <div class="tableWrap"><table><thead><tr><th>Entidade</th><th>Artista</th><th>Estado</th><th>Último contacto (folha)</th><th>Email</th><th>Associação</th><th>Próximo passo</th></tr></thead>
      <tbody id="crm-actions-body"></tbody></table></div>
      <div class="actions"><button type="button" class="secondary" id="crm-actions-more">Mostrar mais ações</button></div>
    </div>
    <div class="panel" style="margin-top:20px">
      <h2>Projetos artísticos e condições</h2>
      <p class="muted">As relações, comissões, notas e riscos provêm das fichas dos artistas. Leads de serviços não são automaticamente artistas representados.</p>
      <div id="crm-artists-list"></div>
    </div>
  `;
  anchor.before(section);
})();
