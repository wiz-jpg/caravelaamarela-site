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
  el("p","Festivais por janela de contacto e histórico analisado; venues por negociação e oportunidades de rota. Os cartões do arquivo são sugestões por validar.","cc-lead"));
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
 const publishedInfo=el("div",undefined,"cc-booking-public-source");
 const confirmedIndex=el("section",undefined,"cc-published-roster");
 const radar=el("section",undefined,"cc-booking-fit-radar");
 status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 controls.append(yearLabel,artistLabel,refresh,create);
 head.append(intro,controls);section.append(head,status,publishedInfo,confirmedIndex,radar,body);
 view.querySelector(".cc-panel-head")?.after(section);
 let allBookings=[],allContacts=[],allActions=[],allReviews=[],published=[],loaded=false,busy=false,failed="";
 let publicAgendaStatus="A confirmar leitura da agenda pública…";
 let saving=false;
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
  const title=el("strong",item.announcement?.title||c?.name||r?.contact_name||"Entidade por confirmar","cc-board-item-title");
  card.append(title,el("span",rowArtists(item),"cc-board-artist"));
  const event=r?.subject||"",location=item.locality||"Local por confirmar";
  if(event)card.append(el("small",event));
  card.append(el("small",location));
  if(item.provisional||item.source_key&&!item.reviewed)
   card.append(el("span","Por validar","cc-board-inferred"));
  if(item.reviewed)card.append(el("span","Triagem validada pela equipa","cc-board-verified"));
  if(item.announcement){
   const e=item.announcement;
   card.append(el("small","Data anunciada: "+e.date),el("small","Local: "+(e.venue||"a confirmar")));
   card.append(el("small","Agenda pública · confirmação comercial e pagamentos não registados"));
   return card;
  }
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
    card.append(el("small","Estado registado em AÇÕES: "+(item.archive.status||"desconhecido")));
    if(item.action_date)card.append(el("small","Data da ação no arquivo: "+item.action_date));
    if(item.archive.next_step)card.append(el("p",item.archive.next_step,"cc-board-action-label"));
    card.append(el("small","É uma sugestão para rever; ano do concerto, envio e negociação por confirmar"));
   }
   if(item.window&&item.window.from){
    card.append(el("small","Janela: "+item.window.from+" — "+item.window.to));
    if(item.window.reason)card.append(el("p",item.window.reason,"cc-board-action-label"));
   }
   if(item.reason)card.append(el("p",item.reason,"cc-board-action-label"));
   if(item.nearbyGig?.event_date)card.append(el("small","Data próxima: "+item.nearbyGig.event_date));
   card.append(el("small",item.archive?"Informação histórica · sem contacto autorizado automaticamente":
      "Contacto do arquivo · sem envio autorizado"));
   const acts=el("div",undefined,"cc-board-item-actions");
   const b=el("button",item.archive?"Retomar como proposta":"Preparar proposta","cc-neutral");b.type="button";
   b.onclick=()=>emit("caravela-board-create-booking",{
    contact_name:c.name,contact_id:c.id,booking_category:c.kind,
    booking_year:item.archive?"":years.value,
    season_hint:years.value,
    artist:item.artists?.length===1?item.artists[0]:"",
    origin_label:item.archive?"AÇÕES · linha "+(item.archive.origin?.row||"?"):"Contacto de arquivo",
    notes:item.archive?
      "Classificação sugerida para planeamento de "+years.value+
       ". Ano real do evento e histórico por verificar. Estado de origem: "+item.archive.status+
       "; data de ação registada: "+(item.action_date||"não indicada"):"",
    next_step:item.archive?.next_step||"Verificar oportunidade, condições e destinatário",
    subject:item.archive?"Rever proposta "+years.value+" · "+c.name:
      (c.kind==="festival"?"Proposta festival ":"Proposta sala ")+years.value
   });
   acts.append(b);
   if(c.kind==="festival"){
    const w=el("button","Editar janela","cc-neutral");w.type="button";
    w.onclick=()=>emit("caravela-board-open-window",{contact_id:c.id});acts.append(w);
   }
   if(item.source_key){
    const row=el("div",undefined,"cc-board-validation-actions");
    const confirm=el("button","✓ Confirmar triagem","cc-neutral");confirm.type="button";
    confirm.onclick=()=>void reviewItem(item,key,"confirmed");
    row.append(confirm);
    const move=el("select");move.setAttribute("aria-label","Mudar coluna");
    const allowed=c?.kind==="festival"?
      [["ongoing","Follow-up"],["late","Em atraso"],["now","Agora"],["soon","Brevemente"],
       ["planning","Por calendarizar"],["archive","Por validar"],
       ["declined","Recusados"],["confirmed","Fechados"]]:
      [["ongoing","Follow-up"],["suggestions","Sugestões"],["archive","Por validar"],
       ["declined","Recusados"],["confirmed","Fechados"]];
    for(const [v,label] of allowed){const o=el("option",label);o.value=v;move.append(o)}
    move.value=key;
    const moveButton=el("button","Mover","cc-neutral");moveButton.type="button";
    moveButton.onclick=()=>void reviewItem(item,move.value,"moved");
    row.append(move,moveButton);acts.append(row);
   }
   card.append(acts);
  }
  return card;
 }
 async function reviewItem(item,lane,decision){
  const c=item.contact;
  if(!c||!item.source_key||saving)return;
  if(["confirmed","declined"].includes(lane)){
   // A public booking confirmation or rejection is a commercial decision.
   // The existing editor requires explicit evidence for a confirmed concert.
   emit("caravela-board-create-booking",{
    contact_name:c.name,contact_id:c.id,booking_category:c.kind,
    booking_year:"",season_hint:years.value,artist:item.artists?.length===1?item.artists[0]:"",
    subject:"Rever proposta "+years.value+" · "+c.name,
    next_step:"Validar decisão comercial e evidência antes de guardar",
    requested_stage:lane==="confirmed"?"confirmed":"declined"
   });return;
  }
  const source_type=item.archive?"action":"contact";
  const source_id=String(item.archive?.id||c.id);
  const year=years.value;
  const artistName=item.archive?String(item.archive.artist||""):"";
  const source_key=source_type+":"+source_id+"|"+year+"|"+artistName.toLowerCase();
  const bytes=new TextEncoder().encode("caravela-booking-review-v1:"+source_key);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  digest[6]=(digest[6]&15)|64;digest[8]=(digest[8]&63)|128;
  const raw=Array.from(digest.slice(0,16),v=>v.toString(16).padStart(2,"0")).join("");
  const id=[raw.slice(0,8),raw.slice(8,12),raw.slice(12,16),raw.slice(16,20),raw.slice(20,32)].join("-");
  const previous=allReviews.find(x=>x.source_key===source_key);
  if(previous?.lane===lane&&previous?.decision===decision){return}
  const record={id,source_key,source_type,source_id,contact_id:c.id,
   artist:artistName,year,lane,decision,
   notes:decision==="moved"?"Triagem alterada manualmente para "+lane:""};
  if(previous){record.id=previous.id;record.revision=previous.revision}
  saving=true;
  status.textContent="A guardar triagem validada, sem alterar o estado comercial…";
  try{
   const res=await window.CaravelaNativeTransport.request("booking_reviews",
    previous?"PATCH":"POST",record);
   const data=await res.json();
   if(!res.ok||!data.ok)throw Error(data.error||"Não foi possível guardar triagem");
   await load();
  }catch(e){status.textContent="Não foi possível guardar: "+e.message+" · recarrega e tenta novamente"}
  finally{saving=false}
 }
 function render(){
  const api=window.CaravelaBookingBoard;
  body.replaceChildren();publishedInfo.replaceChildren();confirmedIndex.replaceChildren();radar.replaceChildren();
  if(!loaded){
   status.textContent=failed||"A carregar o Booking e as fichas de contacto…";return
  }
  const year=Number(years.value);intro.querySelector("h2").textContent="Booking "+year;
  const totals=new Map();
  for(const e of published)if(/^20\d{2}-\d{2}-\d{2}$/.test(e?.date||"")){
   const target=Number(e.date.slice(0,4));totals.set(target,(totals.get(target)||0)+1);
  }
  const shown=totals.get(year)||0, total=published.length;
  publishedInfo.append(el("strong","Agenda pública · "+shown+" concerto(s) anunciado(s) em "+year));
  publishedInfo.append(el("p",publicAgendaStatus,"cc-lead"));
  if(!shown&&total){
   const otherYears=[...totals.keys()].filter(y=>y!==year).sort((a,b)=>b-a);
   publishedInfo.append(el("p","Os concertos de "+otherYears.map(y=>y+" ("+totals.get(y)+")").join(", ")+
    " não pertencem à época "+year+". A agenda não é um registo completo de todos os contratos.","cc-lead"));
   for(const targetYear of otherYears){
    if(![2026,2027,2028,2029,2030,2031].includes(targetYear))continue;
    const b=el("button","Ver Fechados "+targetYear+" · "+totals.get(targetYear),"cc-neutral");
    b.type="button";b.onclick=()=>{years.value=String(targetYear);render()};
    publishedInfo.append(b);
   }
  }
  // Pinned announced roster gigs independently of the year currently planned.
  // The public calendar is evidence of a published date, not commercial settlement.
  confirmedIndex.append(el("h3","Concertos já anunciados · WILDCHAINS e Devil"));
  const eligiblePublished=published.filter(e=>e?.date&&["wild","devil","both"].includes(e.artist)&&
    (artist.value==="all"||artist.value==="both"&&e.artist==="both"||
     artist.value==="wildchains"&&["wild","both"].includes(e.artist)||
     artist.value==="devil"&&["devil","both"].includes(e.artist)))
   .sort((a,b)=>a.date.localeCompare(b.date));
  const announcedYearCounts=new Map();
  for(const e of eligiblePublished){
   const y=e.date.slice(0,4);announcedYearCounts.set(y,(announcedYearCounts.get(y)||0)+1);
  }
  confirmedIndex.append(el("p",
    (eligiblePublished.length?eligiblePublished.length+" datas públicas carregadas: "+
     [...announcedYearCounts].map(([y,n])=>y+" · "+n).join(" / "):
     "Ainda não há datas públicas carregadas para este filtro.")+
    ". «Anunciado» não significa cachet ou contrato registado.","cc-lead"));
  const announcementDetails=el("details",undefined,"cc-announced-dates");
  announcementDetails.open=true;
  announcementDetails.append(el("summary","Ver concertos anunciados ("+eligiblePublished.length+")"));
  const announcedGrid=el("div",undefined,"cc-announced-grid");
  for(const event of eligiblePublished){
   const gig=el("article",undefined,"cc-announced-gig");
   const city=typeof event.city==="string"?event.city:event.city?.pt||"";
   gig.append(el("strong",event.title),el("small",event.date+" · "+city),
    el("small",event.artist==="wild"?"WILDCHAINS":event.artist==="devil"?"Devil of a Woman":"WILDCHAINS + Devil"));
   const action=el("button","Ver em Fechados "+event.date.slice(0,4),"cc-neutral");
   action.type="button";action.onclick=()=>{
    years.value=event.date.slice(0,4);render();
    const target=body.querySelector(".cc-board-group .cc-board-lane-confirmed");
    if(target){target.scrollIntoView({behavior:"smooth",block:"center"})}
   };
   gig.append(action);announcedGrid.append(gig);
  }
  announcementDetails.append(announcedGrid);confirmedIndex.append(announcementDetails);
  const chooseBand=artist.value==="devil"?"Devil of a Woman":"WILDCHAINS";
  const radarData=window.CaravelaBookingRadar?.discover({
   contacts:allContacts,actions:allActions,bookings:allBookings,year,artist:chooseBand,max:12
  });
  radar.append(el("h3","Radar de festivais e venues · "+year),
   el("p","Pesquisa de oportunidades fundamentada em contactos existentes e fontes públicas. "+
    "Um festival ter edição anunciada não significa que aceite candidaturas. Prioridades sem comprovativo "+
    "ficam por investigar.","cc-lead"));
  const radarSelector=el("div",undefined,"cc-booking-radar-tools");
  const radarArtist=el("select");
  radarArtist.setAttribute("aria-label","Artista do radar");
  for(const [key,label] of [["WILDCHAINS","WILDCHAINS"],["Devil of a Woman","Devil of a Woman"]]){
   const opt=el("option",label);opt.value=key;radarArtist.append(opt);
  }
  radarArtist.value=radar.dataset.artist||chooseBand;
  radarSelector.append(el("label","Adequação para o artista"),radarArtist);radar.append(radarSelector);
  function showRadar(){
   radar.querySelector(".cc-booking-radar-results")?.remove();
   radar.dataset.artist=radarArtist.value;
   const data=window.CaravelaBookingRadar?.discover({
    contacts:allContacts,actions:allActions,bookings:allBookings,year,
    artist:radarArtist.value,max:12
   });
   const groups=el("div",undefined,"cc-booking-radar-results");
   for(const [label,list] of [
    ["A avaliar prioritariamente",data?.priority||[]],
    ["Para investigar · dados insuficientes",data?.research||[]],
    ["Edições públicas verificadas · vagas não confirmadas",data?.editionChecks||[]]
   ]){
    const detail=el("details",undefined,"cc-booking-radar-section");detail.open=label==="A avaliar prioritariamente";
    detail.append(el("summary",label+" · "+list.length));
    const cards=el("div",undefined,"cc-booking-radar-grid");
    for(const candidate of list){
     const card=el("article",undefined,"cc-booking-radar-card");
     card.append(el("strong",candidate.name),
      el("small",(candidate.type==="festival"?"Festival":"Venue")+" · "+
       [candidate.city,candidate.region,candidate.country].filter(Boolean).join(" / ")),
      el("small",candidate.priority),el("p",candidate.basis),
      el("small",candidate.next));
     const actions=el("div",undefined,"cc-booking-radar-card-actions");
     if(candidate.page&&/^https:\/\//.test(candidate.page)){
      const a=el("a","Fonte pública","cc-neutral");a.href=candidate.page;
      a.target="_blank";a.rel="noopener noreferrer";actions.append(a);
     }
     const btn=el("button",candidate.contact_id?"Abrir ficha":"Pesquisar contacto","cc-neutral");
     btn.type="button";btn.onclick=()=>{
      if(candidate.contact_id)emit("caravela-board-open-contact",{id:candidate.contact_id});
      else{window.CaravelaControlApp?.openView("contacts");
       emit("caravela-board-search-contact",{name:candidate.name})}
     };actions.append(btn);card.append(actions);cards.append(card);
    }
    if(!list.length)cards.append(el("p","Sem candidatos com prova suficiente nesta categoria.","cc-lead"));
    detail.append(cards);groups.append(detail);
   }
   radar.append(groups);
  }
  radarArtist.onchange=showRadar;showRadar();

  if(!api){status.textContent="A organização anual ainda não foi carregada.";return}
  let result;
  try{result=api.classify({bookings:allBookings,contacts:allContacts,actions:allActions,
     reviews:allReviews,published,year,today:today()})}
  catch(e){status.textContent="Não foi possível organizar as oportunidades: "+e.message;return}
  const festival=el("section",undefined,"cc-board-group");
  festival.append(el("h3","Festivais"),el("p","Colunas com ações sugeridas a partir do histórico e janelas comprovadas. As sugestões não confirmam a edição 2027 nem autorizam emails.","cc-lead"));
  const venues=el("section",undefined,"cc-board-group");
  venues.append(el("h3","Venues"),el("p","Inclui ações importadas para rever, salas de interesse e proximidades a concertos confirmados; sem tempos de deslocação inventados.","cc-lead"));
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
  const otherConfirmed=result.other.filter(x=>x.record?.stage==="confirmed");
  const otherCompleted=result.other.filter(x=>x.record?.stage==="closed");
  if(otherConfirmed.length||otherCompleted.length){
   const special=el("details",undefined,"cc-board-unclassified");
   special.append(el("summary","Outros registos: "+otherConfirmed.length+
     " confirmados sem categoria · "+otherCompleted.length+" concluídos"));
   special.append(el("p","Não atribuímos estes registos a Festivais ou Venues sem confirmar o tipo de evento. «Concluído» não é prova de concerto confirmado.","cc-lead"));
   for(const item of [...otherConfirmed,...otherCompleted])special.append(rowCard(item,"other"));
   body.append(special);
  }
  const promoters=el("section",undefined,"cc-board-group cc-board-promoters");
  promoters.append(el("h3","Promotores"),
    el("p","Contactos de promotores da base comum, independentemente dos eventos que organizam.","cc-lead"));
  const promoterList=el("div",undefined,"cc-board-promoter-grid");
  for(const item of result.promoter.slice(0,150)){
   const c=item.contact,card=el("article",undefined,"cc-board-item cc-board-candidate");
   card.append(el("strong",c.name),el("small",item.locality||"Local por confirmar"));
   if(c.contact_policy==="blocked"||c.source_suppressed||c.source_shared_email)
    card.append(el("small","Contacto condicionado · verificar restrições"));
   const b=el("button","Abrir contacto","cc-neutral");b.type="button";
   b.onclick=()=>emit("caravela-board-open-contact",{id:c.id});
   card.append(b);promoterList.append(card);
  }
  if(result.promoter.length>150)promoterList.append(el("p","Mais promotores disponíveis na base completa.","cc-lead"));
  if(!result.promoter.length)promoterList.append(el("p","Sem promotores classificados no arquivo.","cc-lead"));
  promoters.append(promoterList);body.append(promoters);
  if(!result.festival.confirmed.length&&!result.venue.confirmed.length&&published.length){
   const years=[...new Set(published.map(x=>x.date?.slice(0,4)))].filter(Boolean).sort();
   if(years.length){
    const hint=el("p","A agenda pública contém concertos anunciados em "+years.join(", ")+
       ". Seleciona o ano correspondente para os ver em Fechados.","cc-lead");
    promoters.before(hint);
   }
  }
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
  const provisional=[...Object.values(result.festival),...Object.values(result.venue)]
   .flat().filter(x=>x.provisional&&visible(x)).length;
  status.textContent=visibleTotal+" registos e candidatos · "+provisional+
   " classificados automaticamente para validação · "+orphan.length+
   " sem ano definido. Estados comerciais originais não alterados.";
 }
 async function load(){
  const t=window.CaravelaNativeTransport;if(!t){failed="Inicia sessão para consultar o Booking.";render();return}
  if(busy)return;busy=true;status.textContent="A sincronizar dados operacionais…";
  try{
   const [b,c,a,v,agenda]=await Promise.all([
    t.request("booking","GET"),t.request("contacts","GET"),t.request("archive","GET"),
    t.request("booking_reviews","GET"),
    fetch("/assets/data/agenda.json",{cache:"no-store"}).catch(()=>null)
   ]);
   if(!b.ok||!c.ok||!v.ok)throw Error("Sem acesso aos registos operacionais.");
   const [bookings,contacts]=await Promise.all([b.json(),c.json()]);
   let archive=[],archiveActions=[];
   if(a.ok){const data=await a.json();archive=data.contacts||[];archiveActions=data.actions||[]}
   const byId=new Map(archive.map(x=>[x.id,{...x,contact_policy:"review",source_suppressed:!!(x.suppressed||x.control_blocked||x.control_blocked_possible),
    source_shared_email:!!(x.shared_email||x.review_required),contact_window_target:"unknown"}]));
   for(const row of contacts.records||[])byId.set(row.id,{...byId.get(row.id),...row});
   allBookings=bookings.records||[];allContacts=[...byId.values()];allActions=archiveActions;
   const reviews=await v.json();allReviews=reviews.records||[];
   if(agenda?.ok){
    const data=await agenda.json();
    if(!Array.isArray(data.events))throw Error("agenda_publica_invalida");
    published=data.events;
    const yearsFound=[...new Set(published.map(x=>x.date?.slice(0,4)).filter(Boolean))].sort();
    publicAgendaStatus="Foram lidos "+published.length+" anúncios do website Caravela"+
      (data.updated?" (agenda atualizada em "+data.updated+")":"")+
      ". Anos disponíveis: "+(yearsFound.join(", ")||"nenhum")+
      ". Isto não confirma o cachet, a faturação ou a existência de outros concertos.";
   }else{
    published=[];
    publicAgendaStatus="Não foi possível ler a agenda pública"+
      (agenda?" (HTTP "+agenda.status+")":" (erro de rede)")+
      ". Os concertos já registados no Booking continuam visíveis.";
   }
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
 window.addEventListener("caravela-control-signed-out",()=>{allBookings=[];allContacts=[];allActions=[];allReviews=[];published=[];loaded=false;render()});
})();
