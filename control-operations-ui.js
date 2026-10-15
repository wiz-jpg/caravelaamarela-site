/* Caravela Control operational home: source freshness and suggested tasks.
 * All names come from the live private API, never from embedded source code.
 * A task is a review suggestion, NEVER permission to contact. */
(() => {"use strict";
  const target=document.getElementById("cc-view-sources");
  if(!target)return;
  const $=id=>document.getElementById(id);
  const card=document.createElement("section");
  card.className="cc-live-ops";card.id="cc-live-ops";
  card.innerHTML=
    '<div class="cc-live-heading"><div><h2>Estado operacional</h2>'+
    '<p class="cc-lead">Atualizações e tarefas sugeridas a partir das fontes. Nenhum email é enviado automaticamente.</p></div>'+
    '<button type="button" id="cc-ops-refresh" class="cc-neutral">Verificar agora</button></div>'+
    '<div class="cc-ops-health" id="cc-ops-health" aria-live="polite"></div>'+
    '<p id="cc-ops-message" class="cc-ops-message" role="status">Aguardamos a leitura do estado.</p>'+
    '<div class="cc-live-heading cc-live-subheading"><h2>Para rever</h2>'+
    '<small id="cc-ops-tasks-caption">Sem atualização disponível</small></div>'+
    '<div class="cc-ops-tasks" id="cc-ops-tasks"></div>'+
    '<p class="cc-ops-disclaimer">Estes são prazos indicados nas folhas, não contactos aprovados. Confirma o destinatário, o artista, as restrições e o último email antes de enviar.</p>';
  const stats=target.querySelector("#stats");
  target.insertBefore(card,stats||target.firstChild);
  const labels={zoho:"Zoho Mail",sheets:"Google Sheets"};
  const healthLabels={
    recent:"Atualizado",warning:"Erro recente",stale:"Desatualizado",
    failed:"Última tentativa falhou",never:"Ainda sem sincronização",
    not_configured:"Por configurar"
  };
  const fmt=ms=>ms?new Date(ms).toLocaleString("pt-PT",{dateStyle:"short",timeStyle:"short"}):"—";
  function info(label,value,flag){
    const item=document.createElement("div");
    item.className="cc-ops-health-item"+(flag?" cc-health-"+flag:"");
    const title=document.createElement("small");title.textContent=label;
    const strong=document.createElement("strong");strong.textContent=value;
    item.append(title,strong);return item;
  }
  function render(data){
    const holder=$("cc-ops-health");holder.replaceChildren();
    const sync=data.sync||[];
    const cron=data.automation||{};
    let autophrase="Agendamento ainda não confirmado";
    if(cron.observed&&cron.all_configured_sources_automated)autophrase="Execuções automáticas confirmadas";
    else if(cron.observed)autophrase="Parcialmente automático";
    else if(cron.configured)autophrase="Credencial de agendamento presente; execução por confirmar";
    holder.append(info("Automatização",autophrase,cron.observed?"recent":"warning"));
    for(const record of sync){
      const value=(healthLabels[record.freshness]||"Por verificar")+
        (record.last_success_ms?" · "+fmt(record.last_success_ms):"");
      holder.append(info(labels[record.provider]||record.provider,value,record.freshness));
    }
    const source=data.mode!=="historical_only"&&data.operational?.needs_source_review;
    const mode=data.mode==="historical_only"?"Arquivo histórico preservado · gestão diária no Booking nativo":
      "Fonte AÇÕES capturada em "+fmt(data.sheet_last_capture_ms);
    $("cc-ops-message").textContent=(source?"Atenção: informação operacional por atualizar. ":"")+mode+
      ". Emails indexados: "+(data.mail_indexed?.incoming||0)+" recebidos e "+
      (data.mail_indexed?.outgoing||0)+" enviados. "+
      "Os índices de emails não confirmam respostas comerciais.";
    $("cc-ops-message").classList.toggle("cc-ops-alert",!!source);
    const tasks=data.operational?.tasks||[];
    const area=$("cc-ops-tasks");area.replaceChildren();
    const caption=$("cc-ops-tasks-caption");
    if(data.mode==="historical_only"){
      caption.textContent="Ações históricas consultáveis · gestão de tarefas no CRM nativo";
      const el=document.createElement("p");el.className="cc-notice";
      el.textContent="A fonte Sheets é opcional. Regista e acompanha os novos follow-ups em Booking e ações; as próximas tarefas aparecem no bloco Trabalho diário.";area.append(el);return;
    }
    if(data.operational?.due_count===undefined){
      caption.textContent="Resumo disponível — sem permissões para consultar tarefas individuais";
      const el=document.createElement("p");el.className="cc-notice";
      el.textContent="Contacta o administrador para receberes tarefas específicas.";area.append(el);return;
    }
    caption.textContent=data.operational.due_count+" prazos vencidos ou a rever"+
      (source?" · origem desatualizada":"");
    if(!tasks.length){
      const empty=document.createElement("p");empty.className="cc-notice";
      empty.textContent="Não há tarefas datadas pendentes nesta captura. Isto não garante que todas as negociações estejam atualizadas.";
      area.append(empty);return;
    }
    for(const row of tasks.slice(0,8)){
      const article=document.createElement("article");article.className="cc-ops-task";
      const left=document.createElement("div");
      const title=document.createElement("strong");title.textContent=row.name;
      const meta=document.createElement("small");
      meta.textContent=[row.artist,row.state,"Prazo "+row.due].filter(Boolean).join(" · ");
      const next=document.createElement("p");next.textContent=row.next_step;
      left.append(title,meta,next);
      const right=document.createElement("span");
      right.className="cc-ops-priority";
      right.textContent=row.priority===3?"Alta prioridade":row.priority===2?"Prioridade média":"Rever";
      article.append(left,right);area.append(article);
    }
    const open=document.createElement("button");open.type="button";open.className="cc-neutral";
    open.textContent="Consultar Booking e ações";
    open.onclick=()=>window.CaravelaControlApp?.openView("booking");
    area.append(open);
  }
  let busy=false,loadedAt=0;
  async function load(force=false){
    if(busy||(!force&&Date.now()-loadedAt<60000))return;
    const transport=window.CaravelaControlRead;
    if(!transport){
      $("cc-ops-message").textContent="Ainda não foi possível ligar ao cofre.";
      return;
    }
    busy=true;
    $("cc-ops-refresh").disabled=true;
    try{
      const response=await transport.request("ops/overview");
      if(!response.ok)throw Error("Pedido não autorizado ("+response.status+").");
      const data=await response.json();
      if(!data.ok)throw Error("Não foi possível consultar o estado operacional.");
      loadedAt=Date.now();render(data);
    }catch(error){
      $("cc-ops-message").textContent="Não foi possível confirmar os dados atuais. "+
        "No modo de transição, introduz o token em Comunicações e volta a esta página. "+
        (error?.message||"");
      $("cc-ops-message").classList.add("cc-ops-alert");
    }finally{busy=false;$("cc-ops-refresh").disabled=false}
  }
  $("cc-ops-refresh").onclick=()=>load(true);
  window.addEventListener("caravela-control-view-opened",event=>{
    if(event.detail?.view==="sources")load(true);
  });
  window.addEventListener("caravela-control-token-ready",()=>load(true));
  window.addEventListener("caravela-control-authenticated",()=>load(true));
  window.addEventListener("caravela-control-signed-out",()=>{
    loadedAt=0;$("cc-ops-health").replaceChildren();
    $("cc-ops-tasks").replaceChildren();
    $("cc-ops-message").textContent="Sessão terminada.";
  });
  // Reload current server snapshot while the user is actively viewing the page.
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden&&!target.hidden)load();
  });
})();