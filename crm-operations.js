/* Caravela Control: private v2 operational and artist audit. No persistence or network calls. */
(() => {
  "use strict";
  const get=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat("pt-PT").format(n||0);
  const sanitize=x=>x===null||x===undefined||x===""?"—":String(x);
  let data=null,limit=50;
  function td(tr,value,className) {
    const cell=document.createElement("td");
    cell.textContent=sanitize(value);
    if(className)cell.className=className;
    tr.appendChild(cell);
    return cell;
  }
  function redrawActions() {
    const body=get("crm-actions-body");
    body.replaceChildren();
    if(!data)return;
    const query=get("crm-actions-search").value.trim().toLocaleLowerCase("pt-PT");
    const selected=get("crm-actions-state").value;
    const actions=data.actions.filter(action=>{
      if(query&&![action.name,action.email,action.status,action.artist,action.notes]
          .join(" ").toLocaleLowerCase("pt-PT").includes(query))return false;
      if(selected==="unresolved"&&action.link_status==="verified_name_email")return false;
      if(selected==="sent"&&action.status!=="Enviado")return false;
      if(selected==="blocked"&&action.contact_policy!=="blocked")return false;
      if(selected==="negotiation"&&!["Em negociação","Em conversa"].includes(action.status))return false;
      return true;
    });
    const fragment=document.createDocumentFragment();
    for(const action of actions.slice(0,limit)){
      const row=document.createElement("tr");
      const nameCell=td(row,action.name,"name");
      const origin=document.createElement("small");
      origin.textContent="AÇÕES · linha "+action.origin.row;
      nameCell.appendChild(document.createElement("br"));nameCell.appendChild(origin);
      td(row,action.artist);
      td(row,action.status,action.contact_policy==="blocked"?"flag":"");
      td(row,action.last_contact_iso||action.last_contact||"—");
      td(row,action.email||"sem email operacional");
      const quality=action.link_status==="verified_name_email"
          ?"Nome e email coincidem (ligação da entidade)"
          :"PENDENTE: "+sanitize(action.link_status).replaceAll("_"," ");
      td(row,quality,action.link_status==="verified_name_email"?"":"flag");
      td(row,action.next_step||"A avaliar");
      fragment.appendChild(row);
    }
    body.appendChild(fragment);
    get("crm-actions-count").textContent=fmt(actions.length)+
      " ações · "+fmt(Math.min(limit,actions.length))+" visíveis";
    get("crm-actions-more").disabled=limit>=actions.length;
  }
  function redrawArtists(){
    const container=get("crm-artists-list");
    container.replaceChildren();
    if(!data)return;
    for(const artist of data.artists){
      const card=document.createElement("details");
      card.className="crm-artist-item";
      const heading=document.createElement("summary");
      heading.textContent=artist.name+" · "+artist.relationship+" · "+artist.status;
      card.appendChild(heading);
      const list=document.createElement("dl");
      const fields={
        "Estado operacional":artist.status,"Comissão":artist.commission,
        "Responsável":artist.owner,"À espera de":artist.waiting_for,
        "Próximo passo":artist.next_step
      };
      for(const [key,value] of Object.entries({...fields,...artist.details})){
        if(!value||value==="—")continue;
        const dt=document.createElement("dt"),dd=document.createElement("dd");
        dt.textContent=key;dd.textContent=String(value);
        list.appendChild(dt);list.appendChild(dd);
      }
      card.appendChild(list);
      for(const activity of artist.activity_log||[]){
        const p=document.createElement("p");
        p.className="muted";
        p.textContent="Registo "+sanitize(activity.date)+": "+sanitize(activity.description)+
          " · "+sanitize(activity.owner)+" · "+sanitize(activity.outcome);
        card.appendChild(p);
      }
      container.appendChild(card);
    }
  }
  function render(){
    if(!data)return;
    get("crm-extra").hidden=false;
    get("crm-extra-count").textContent=fmt(data.actions.length)+" ações do Control · "+
      fmt(data.artists.length)+" projetos · "+fmt(data.summary.source_workbooks||0)+
      " ficheiros de origem";
    get("crm-extra-verification").textContent=
      fmt(data.summary.operational_action_links_confirmed||0)+
      " associações de entidade por nome + email iguais (não provam envio); "+
      fmt(data.summary.operational_action_links_not_confirmed||0)+
      " por resolver. Nenhum estado de contacto foi alterado automaticamente.";
    get("crm-evidence-count").textContent=fmt(data.summary.source_evidence_rows||0)+
      " linhas históricas preservadas (não são alvos automaticamente válidos); "+
      fmt(data.summary.media_forms||0)+" contactos por formulário; "+
      fmt(data.summary.review_required||0)+" entidades com revisão pendente.";
    redrawActions();redrawArtists();
  }
  window.addEventListener("caravela-crm-imported",event=>{
    const manifest=event.detail?.manifest;
    if(!manifest||!Array.isArray(manifest.actions)||!Array.isArray(manifest.artists))return;
    data=manifest;limit=50;render();
  });
  get("crm-actions-search").addEventListener("input",()=>{limit=50;redrawActions()});
  get("crm-actions-state").addEventListener("change",()=>{limit=50;redrawActions()});
  get("crm-actions-more").addEventListener("click",()=>{limit+=50;redrawActions()});
})();
