/* Source-preserving live Google Sheets view. Never overwrites imported history. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const anchor=document.querySelector(".note");
  if(!anchor)return;
  const section=document.createElement("section");
  section.className="results";
  section.hidden=true;
  section.id="control-live-sheets";
  section.innerHTML=
    '<h2>Folhas atuais — apenas leitura</h2>'+
    '<p class="muted" id="live-summary"></p>'+
    '<p class="note">Estas linhas foram capturadas dos Google Sheets. São independentes do histórico do JSON; não eliminam versões anteriores nem autorizam novos envios.</p>'+
    '<div class="toolbar">'+
    '<div><label for="live-search">Pesquisar AÇÕES atuais</label><input id="live-search" type="search" placeholder="Entidade, artista, email"></div>'+
    '<div><label for="live-state">Estado operacional na folha</label>'+
    '<select id="live-state"><option value="all">Todos</option>'+
    '<option value="Enviado">Enviado</option>'+
    '<option value="Por contactar">Por contactar</option>'+
    '<option value="Em negociação">Em negociação</option>'+
    '<option value="Em conversa">Em conversa</option>'+
    '<option value="Não avançar">Não avançar</option>'+
    '</select></div></div>'+
    '<p id="live-count" class="muted"></p>'+
    '<div class="tableWrap"><table><thead><tr>'+
    '<th>Entidade</th><th>Artista</th><th>Estado</th><th>Último contacto</th>'+
    '<th>Próximo passo</th><th>Notas / contexto</th>'+
    '</tr></thead><tbody id="live-actions-body"></tbody></table></div>'+
    '<div class="actions"><button type="button" class="secondary" id="live-more">Mostrar mais</button></div>'+
    '<h2 style="margin-top:24px">Fichas dos artistas — versão dos Sheets</h2>'+
    '<p class="muted">Fichas originais de cada separador, preservadas por revisão. Nenhuma relação de agenciamento é inferida apenas pelo nome.</p>'+
    '<div id="live-artists"></div>';
  anchor.before(section);
  let records=[],show=50;
  const clean=x=>x===null||x===undefined?"":String(x);
  const norm=x=>clean(x).toLocaleLowerCase("pt-PT");
  const date=ms=>Number.isFinite(ms)?new Date(ms).toLocaleString("pt-PT"):"—";
  function cell(row,value,isFlag=false){
    const td=document.createElement("td");td.textContent=clean(value)||"—";
    if(isFlag)td.className="flag";
    row.appendChild(td);
  }
  function draw(){
    const query=norm($("live-search").value.trim());
    const state=$("live-state").value;
    const filtered=records.filter(row=>
      (state==="all"||clean(row[3])===state)&&
      (!query||norm(row.join(" ")).includes(query))
    );
    const frag=document.createDocumentFragment();
    for(const row of filtered.slice(0,show)){
      const tr=document.createElement("tr");
      cell(tr,row[1]);cell(tr,row[2]);cell(tr,row[3],/não avançar|falha de entrega/i.test(clean(row[3])));
      cell(tr,row[9]);cell(tr,row[11]);cell(tr,row[12]);
      frag.appendChild(tr);
    }
    $("live-actions-body").replaceChildren(frag);
    $("live-count").textContent=filtered.length+" ações atuais · "+Math.min(show,filtered.length)+" apresentadas";
    $("live-more").disabled=show>=filtered.length;
  }
  function artists(revisions){
    const root=$("live-artists");root.replaceChildren();
    for(const sheet of revisions){
      const title=clean(sheet.range).split("!")[0].replace(/^'|'$/g,"");
      const detail=document.createElement("details");
      detail.style.cssText="border:1px solid #454638;border-radius:8px;margin:8px 0;padding:12px";
      const summary=document.createElement("summary");
      summary.textContent=title+" · "+(sheet.values||[]).length+" linhas";
      summary.style.cursor="pointer";
      detail.appendChild(summary);
      const container=document.createElement("div");
      container.className="tableWrap";
      container.style.marginTop="12px";
      const table=document.createElement("table");
      table.style.minWidth="440px";
      const body=document.createElement("tbody");
      (sheet.values||[]).forEach((row,i)=>{
        if(!row.some(x=>clean(x).trim()))return;
        const tr=document.createElement("tr");
        cell(tr,i+1);
        cell(tr,row[0]||"");
        cell(tr,row.slice(1).map(clean).join(" | "));
        body.appendChild(tr);
      });
      table.appendChild(body);container.appendChild(table);detail.appendChild(container);
      root.appendChild(detail);
    }
  }
  $("live-search").addEventListener("input",()=>{show=50;draw()});
  $("live-state").addEventListener("change",()=>{show=50;draw()});
  $("live-more").addEventListener("click",()=>{show+=50;draw()});
  window.addEventListener("caravela-control-live-sources",event=>{
    const action=event.detail?.actions;
    const artist=event.detail?.artists;
    if(!action?.data?.sheets?.length||!artist?.data?.sheets?.length)return;
    // Row 1 contains the original source headings; remaining rows are never normalized silently.
    records=action.data.sheets[0].values.slice(1).filter(row=>row.some(x=>clean(x).trim()));
    show=50;
    $("live-summary").textContent="AÇÕES capturadas: "+date(action.captured_ms)+
      " · Fichas artísticas capturadas: "+date(artist.captured_ms)+
      " · Revisões SHA-256: "+action.revision_sha256.slice(0,12)+" / "+artist.revision_sha256.slice(0,12);
    section.hidden=false;
    artists(artist.data.sheets);
    draw();
  });
})();