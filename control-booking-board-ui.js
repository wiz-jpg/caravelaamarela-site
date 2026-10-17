/* Booking by season, festival contact windows and venue route suggestions.
 * Read-only projections; all mutations go through the native editor. */
(()=>{"use strict";
 const view=document.getElementById("cc-view-booking");
 if(!view)return;
 const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n};
 const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const section=el("section",undefined,"cc-booking-board");
 const head=el("div",undefined,"cc-booking-board-top"),intro=el("div"),controls=el("div",undefined,"cc-booking-board-controls");
 intro.append(el("small","PLANEAMENTO DE BOOKING","cc-booking-eyebrow"),el("h2","Booking 2027","cc-booking-board-title"),
  el("p","Festivais por período de contacto. Venues por negociações e oportunidades de rota. Tudo separado por época e projeto.","cc-lead"));
 const yearLabel=el("label","Ano");
 const years=el("select");years.setAttribute("aria-label","Ano de programação");
 for(const y of [2026,2027,2028,2029,2030,2031]){const opt=el("option",y);opt.value=String(y);years.append(opt)}
 years.value="2027";yearLabel.append(years);
 const artistLabel=el("label","Artista"),artist=el("select");
 for(const [v,label] of [["all","Todos"],["wildchains","WILDCHAINS"],["devil","Devil"],["both","Ambas"]]){
  const opt=el("option",label);opt.value=v;artist.append(opt)
 }
 artistLabel.append(artist);
 const refresh=el("button","Atualizar","cc-neutral");refresh.type="button";
 const create=el("button","+ Oportunidade","cc-primary");create.type="button";
 const body=el("div",undefined,"cc-booking-board-body"),status=el("p","","cc-lead");
 status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 controls.append(yearLabel,artistLabel,refresh,create);
 head.append(intro,controls);section.append(head,status,body);
 view.querySelector(".cc-panel-head")?.after(section);
 let allBookings=[],allContacts=[],allActions=[],loaded=false,busy=false,failed="";
 const names={festival:{ongoing:"On going / Follow-up",late:"A contactar · em atraso",
  now:"A contactar agora",soon:"A contactar brevemente",planning:"Por calendarizar",
  archive:"Histórico a validar",declined:"Recusados",confirmed:"Fechados"},
  venue:{ongoing:"On going / Follow-up",suggestions:"Sugestões",archive:"Histórico a validar",
    declined:"Recusados",confirmed:"Fechados"}};
 function emit(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}))}
 function rowArtists(item){
  if(!item.artists?.length)return "Projeto por definir";
  return item.artists.length===2?"Ambas as bandas":item.artists[0]==="WILDCHAINS"?"WILDCHAINS":"Devil of a Woman";
 }
 function visible(item){
  if(artist.value==="all")return true;
  const n=item.artists||[];
  if(artist.value==="both")return n.length===2;
  if(!n.length)return false;
  return n.some(x=>artist.value==="wildchains"?x==="WILDCHAINS":x==="Devil of a Woman");
 }
 function rowCard(item,key){
  const r=item.record,c=item.contact;
  const card=el("article",undefined,"cc-board-item "+(r?"cc-board-real":"cc-board-candidate"));
  const title=el("strong",(c?.name||r?.contact_name||"Entidade por confirmar"),"cc-board-item-title");
  card.append(title,el("span",rowArtists(item),"cc-board-artist"));
  const event=r?.subject||"",location=item.locality||"Local por confirmar";
  if(event)card.append(el("small",event));
  card.append(el("small",location));
  if(r){
   const date=r.event_date||"";
   if(date)card.append(el("small","Concerto: "+date));
   if(["ongoing","planning","suggestions"].includes(key)&&r.next_step)
    card.append(el("p",r.next_step,"cc-board-action-label"));
   if(r.due_date&&["ongoing","planning","suggestions"].includes(key))
    card.append(el("small","Próximo passo: "+r.due_date));
   const b=el("button","Abrir oportunidade","cc-neutral");b.type="button";
   b.onclick=()=>emit("caravela-board-open-booking",{record:r});card.append(b);
  }else{
   if(item.archive){
    card.append(el("small","Arquivo importado · "+(item.archive.status||"estado desconhecido")));
    if(item.archive.next_step)card.append(el("p",item.archive.next_step,"cc-board-action-label"));
    card.append(el("small","O ano, o envio e a negociação não foram confirmados"));
   }
   if(item.window&&item.window.from){
    card.append(el("small","Janela: "+item.window.from+" — "+item.window.to));
    if(item.window.reason)card.append(el("p",item.window.reason,"cc-board-action-label"));
   }
   if(item.reason)card.append(el("p",item.reason,"cc-board-action-label"));
   if(item.nearbyGig?.event_date)card.append(el("small","Data próxima: "+item.nearbyGig.event_date));
   card.append(el("small",item.archive?"Reconciliar com Booking antes de contactar":
      "Contacto do arquivo · sem envio autorizado"));
   const acts=el("div",undefined,"cc-board-item-actions");
   const b=el("button",item.archive?"Retomar como proposta":"Preparar proposta","cc-neutral");b.type="button";
   b.onclick=()=>emit("caravela-board-create-booking",{
    contact_name:c.name,contact_id:c.id,booking_category:c.kind,
    booking_year:years.value,artist:item.artists?.length===1?item.artists[0]:"",
    subject:item.archive?.name|| (c.kind==="festival"?"Proposta festival ":"Proposta sala ")+years.value
   });
   acts.append(b);
   if(c.kind==="festival"){
    const w=el("button","Editar janela","cc-neutral");w.type="button";
    w.onclick=()=>emit("caravela-board-open-window",{contact_id:c.id});acts.append(w);
   }
   card.append(acts);
  }
  return card;
 }
 function render(){
  const api=window.CaravelaBookingBoard;
  body.replaceChildren();
  if(!loaded){
   status.textContent=failed||"A carregar o Booking e as fichas de contacto…";return
  }
  const year=Number(years.value);intro.querySelector("h2").textContent="Booking "+year;
  if(!api){status.textContent="A organização anual ainda não foi carregada.";return}
  let result;
  try{result=api.classify({bookings:allBookings,contacts:allContacts,actions:allActions,year,today:today()})}
  catch(e){status.textContent="Não foi possível organizar as oportunidades: "+e.message;return}
  const festival=el("section",undefined,"cc-board-group");
  festival.append(el("h3","Festivais"),el("p","Abordagens planeadas pelo ano do evento; atraso só quando a janela tem fundamento e ano definido.","cc-lead"));
  const venues=el("section",undefined,"cc-board-group");
  venues.append(el("h3","Venues"),el("p","Sugestões apenas com base em locais de concertos confirmados, sem calcular tempos ou distâncias.","cc-lead"));
  let visibleTotal=0;
  function lanes(holder,group,labels){
   const rail=el("div",undefined,"cc-board-rail");
   for(const [key,label] of Object.entries(labels)){
    const items=(group[key]||[]).filter(visible);visibleTotal+=items.length;
    const lane=el("section",undefined,"cc-board-lane cc-board-lane-"+key);
    const h=el("div",undefined,"cc-board-lane-head");
    h.append(el("strong",label),el("span",String(items.length),"cc-board-lane-count"));
    lane.append(h);
    const list=el("div",undefined,"cc-board-lane-list");
    if(!items.length)list.append(el("p","Sem oportunidades classificadas.","cc-board-empty"));
    for(const item of items.slice(0,30))list.append(rowCard(item,key));
    if(items.length>30){
     const rest=el("details"),summary=el("summary","Mostrar mais "+(items.length-30));
     rest.append(summary);for(const item of items.slice(30))rest.append(rowCard(item,key));
     list.append(rest);
    }
    lane.append(list);rail.append(lane);
   }
   holder.append(rail);
  }
  lanes(festival,result.festival,names.festival);
  lanes(venues,result.venue,names.venue);
  body.append(festival,venues);
  const orphan=result.undated.filter(x=>!artist.value||artist.value==="all"||
    (artist.value==="wildchains"&&/wildchains/i.test(x.artist||""))||
    (artist.value==="devil"&&/devil/i.test(x.artist||"")));
  const misc=result.other.filter(visible);
  if(orphan.length||misc.length){
   const unresolved=el("details",undefined,"cc-board-unclassified");
   unresolved.append(el("summary","Por classificar · "+(orphan.length+misc.length)+" registos"));
   unresolved.append(el("p","Sem ano, categoria ou ligação suficientemente clara. Conservados na base: confirma apenas o que realmente sabes.","cc-lead"));
   for(const entry of [...orphan.map(record=>({record})),...misc]){
    const r=entry.record;if(!r)continue;
    const b=el("button",(r.contact_name||"Entidade")+" · "+(r.artist||"Projeto a definir"),"cc-neutral");
    b.type="button";b.onclick=()=>emit("caravela-board-open-booking",{record:r});unresolved.append(b)
   }
   body.append(unresolved);
  }
  status.textContent=visibleTotal+" registos/candidatos visíveis · "+orphan.length+
   " sem ano definido. Propostas diferentes mantêm IDs e histórico próprios.";
 }
 async function load(){
  const t=window.CaravelaNativeTransport;if(!t){failed="Inicia sessão para consultar o Booking.";render();return}
  if(busy)return;busy=true;status.textContent="A sincronizar dados operacionais…";
  try{
   const [b,c,a]=await Promise.all([t.request("booking","GET"),t.request("contacts","GET"),t.request("archive","GET")]);
   if(!b.ok||!c.ok)throw Error("Sem acesso aos registos operacionais.");
   const [bookings,contacts]=await Promise.all([b.json(),c.json()]);
   let archive=[],archiveActions=[];
   if(a.ok){const data=await a.json();archive=data.contacts||[];archiveActions=data.actions||[]}
   const byId=new Map(archive.map(x=>[x.id,{...x,contact_policy:"review",source_suppressed:!!(x.suppressed||x.control_blocked||x.control_blocked_possible),
    source_shared_email:!!(x.shared_email||x.review_required),contact_window_target:"unknown"}]));
   for(const row of contacts.records||[])byId.set(row.id,{...byId.get(row.id),...row});
   allBookings=bookings.records||[];allContacts=[...byId.values()];allActions=archiveActions;
   loaded=true;failed="";render();
  }catch(e){failed="Não foi possível carregar. "+e.message;render()}
  finally{busy=false}
 }
 years.onchange=render;artist.onchange=render;refresh.onclick=()=>void load();
 create.onclick=()=>emit("caravela-board-create-booking",{booking_year:years.value});
 window.addEventListener("caravela-control-view-opened",e=>{if(e.detail?.view==="booking")void load()});
 window.addEventListener("caravela-control-token-ready",()=>void load());
 window.addEventListener("caravela-control-authenticated",()=>void load());
 window.addEventListener("caravela-control-booking-updated",()=>void load());
 window.addEventListener("caravela-control-contacts-updated",()=>void load());
 window.addEventListener("caravela-control-contact-action",()=>void load());
 window.addEventListener("caravela-control-signed-out",()=>{allBookings=[];allContacts=[];allActions=[];loaded=false;render()});
})();
