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
 const publishedInfo=el("details",undefined,"cc-booking-public-source");
 const radar=el("section",undefined,"cc-booking-fit-radar");
 status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 controls.append(yearLabel,artistLabel,refresh,create);
 head.append(intro,controls);section.append(head,status,publishedInfo,body,radar);
 view.querySelector(".cc-panel-head")?.after(section);
 let allBookings=[],allContacts=[],allActions=[],allReviews=[],published=[],loaded=false,busy=false,failed="";
 let publicAgendaStatus="A confirmar leitura da agenda pública…";
 let externalResults=[],remoteSearchStatus="Pesquisa externa ainda não executada.",searching=false;
 let radarArtist="WILDCHAINS",radarTerritory="PT",externalKey="";
 let remoteEnabled=null,remoteStatusChecked=false;
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
  const card=el("article",undefined,"cc-board-item "+(r?"cc-board-real":"cc-board-candidate")+
   (item.past&&key==="confirmed"?" cc-board-past":""));
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
   card.append(el("small",(item.past?"Já realizado: ":"Data anunciada: ")+e.date),
    el("small","Local: "+(e.venue||"a confirmar")));
   card.append(el("small","Agenda pública · confirmação comercial e pagamentos não registados"));
   return card;
  }
  if(r){
   const date=r.event_date||"";
   if(date)card.append(el("small",(item.past&&key==="confirmed"?"Já realizado: ":"Concerto: ")+date));
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
   // High-density cards: expose name, locality, status and human action.
   // Source details and explanatory paragraphs remain one click away.
   const meta=[...card.children].filter(x=>x.tagName==="SMALL"||
    x.classList?.contains("cc-board-action-label"));
   if(meta.length>2){
    const detail=el("details",undefined,"cc-board-card-meta");
    detail.append(el("summary","Ver contexto e origem"));
    for(const node of meta.slice(2))detail.append(node);
    card.insertBefore(detail,acts);
   }
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
  body.replaceChildren();publishedInfo.replaceChildren();radar.replaceChildren();
  if(!loaded){
   status.textContent=failed||"A carregar o Booking e as fichas de contacto…";return
  }
  const year=Number(years.value);intro.querySelector("h2").textContent="Booking "+year;
  publishedInfo.append(el("summary","Fontes de concertos consultadas"));
  publishedInfo.append(el("p",publicAgendaStatus,"cc-lead"));
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
  function lanes(holder,group,labels,primary){
   const makeRail=(entries)=>{
    const rail=el("div",undefined,"cc-board-rail cc-board-focus-rail");
    for(const [key,label] of entries){
     const items=(group[key]||[]).filter(visible);visibleTotal+=items.length;
     const lane=el("section",undefined,"cc-board-lane cc-board-lane-"+key);
     const h=el("div",undefined,"cc-board-lane-head");
     h.append(el("strong",label),el("span",String(items.length),"cc-board-lane-count"));
     lane.append(h);
     const list=el("div",undefined,"cc-board-lane-list");
     if(!items.length)list.append(el("p","Sem contactos nesta fase.","cc-board-empty"));
     let pastHeading=false;
     const cap=key==="confirmed"?12:6;
     for(const item of items.slice(0,cap)){
      if(key==="confirmed"&&item.past&&!pastHeading){
       list.append(el("p","Concertos já realizados","cc-board-past-heading"));pastHeading=true;
      }
      list.append(rowCard(item,key));
     }
     if(items.length>cap){
      const extra=el("details",undefined,"cc-board-more-records");
      extra.append(el("summary","Ver mais "+(items.length-cap)+" nesta coluna"));
      for(const item of items.slice(cap)){
       if(key==="confirmed"&&item.past&&!pastHeading){
        extra.append(el("p","Concertos já realizados","cc-board-past-heading"));pastHeading=true;
       }
       extra.append(rowCard(item,key));
      }
      list.append(extra);
     }
     lane.append(list);rail.append(lane);
    }
    return rail;
   };
   const essential=primary.map(x=>[x,labels[x]]).filter(x=>x[1]);
   holder.append(makeRail(essential));
   const remaining=Object.entries(labels).filter(([key])=>!primary.includes(key));
   if(remaining.length){
    const panel=el("details",undefined,"cc-board-secondary");
    const n=remaining.reduce((sum,[key])=>sum+(group[key]||[]).filter(visible).length,0);
    panel.append(el("summary","Planeamento e arquivo · "+n+
     " registos (abrir apenas quando necessário)"));
    panel.append(makeRail(remaining));
    holder.append(panel);
   }
  }
  lanes(festival,result.festival,names.festival,["ongoing","now","late","soon","confirmed"]);
  lanes(venues,result.venue,names.venue,["ongoing","suggestions","confirmed"]);
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
  const promoters=el("details",undefined,"cc-board-promoters cc-board-secondary");
  promoters.append(el("summary","Promotores · "+result.promoter.length+
    " fichas (pesquisa na base comum)"));
  const promoterSearch=el("input");promoterSearch.type="search";
  promoterSearch.placeholder="Pesquisar promotores…";promoterSearch.setAttribute("aria-label","Pesquisar promotores");
  const promoterCount=el("p","","cc-lead"),promoterList=el("div",undefined,"cc-board-promoter-grid");
  const drawPromoters=()=>{
   const query=promoterSearch.value.trim().toLowerCase();
   const matches=result.promoter.filter(x=>!query||[
    x.contact.name,x.contact.city,x.contact.region,x.contact.country
   ].join(" ").toLowerCase().includes(query));
   promoterCount.textContent=matches.length+" contactos de promotores"+
    (matches.length>40?" · primeiros 40 apresentados; refina a pesquisa":"");
   promoterList.replaceChildren();
   for(const item of matches.slice(0,40)){
    const c=item.contact,card=el("article",undefined,"cc-board-item cc-board-candidate");
    card.append(el("strong",c.name),el("small",item.locality||"Local por confirmar"));
    if(c.contact_policy==="blocked"||c.source_suppressed||c.source_shared_email)
     card.append(el("small","Contacto condicionado · verificar restrições"));
    const open=el("button","Abrir ficha","cc-neutral");open.type="button";
    open.onclick=()=>emit("caravela-board-open-contact",{id:c.id});
    card.append(open);promoterList.append(card);
   }
   if(!matches.length)promoterList.append(el("p","Sem promotores neste filtro.","cc-lead"));
  };
  promoterSearch.oninput=drawPromoters;
  promoters.addEventListener("toggle",()=>{if(promoters.open)drawPromoters()});
  promoters.append(promoterSearch,promoterCount,promoterList);body.append(promoters);
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
  renderExternalRadar(year);
  status.textContent=visibleTotal+" registos e candidatos · "+provisional+
   " classificados automaticamente para validação · "+orphan.length+
   " sem ano definido. Estados comerciais originais não alterados.";
 }
 function renderExternalRadar(year){
  radar.replaceChildren();
  const h=el("h3","Radar externo de festivais · "+year);
  const subtitle=el("p","Pesquisa de festivais que não constam do arquivo nem dos contactos operacionais. "+
   "A edição, as condições, a programação e a possibilidade de propor uma banda exigem confirmação.","cc-lead");
  radar.append(h,subtitle);
  const tools=el("div",undefined,"cc-booking-radar-tools");
  const choose=el("select");choose.setAttribute("aria-label","Artista para descoberta externa");
  for(const [v,n] of [["WILDCHAINS","WILDCHAINS"],["Devil of a Woman","Devil of a Woman"]]){
   const option=el("option",n);option.value=v;choose.append(option);
  }
  choose.value=radarArtist;
  const location=el("select");location.setAttribute("aria-label","Território da pesquisa");
  for(const [v,n] of [["PT","Portugal"],["ES","Espanha"],["FR","França"]]){
   const option=el("option",n);option.value=v;location.append(option);
  }
  location.value=radarTerritory;
  const run=el("button",searching?"A pesquisar…":"Pesquisar festivais novos","cc-primary");
  run.type="button";run.disabled=searching;
  const feedback=el("p",remoteSearchStatus,"cc-lead");
  const runSearch=async()=>{
   if(searching)return;
   const api=window.CaravelaFestivalSearch;
   if(!api){remoteSearchStatus="Pesquisa externa indisponível. Verificar serviço de pesquisa no Preview.";renderExternalRadar(year);return}
   searching=true;remoteSearchStatus="A pesquisar fontes externas…";renderExternalRadar(year);
   try{
    const response=await api.search(year,radarArtist,radarTerritory);
    const result=await response.json();
    if(!response.ok||!result.ok){
     const message=result.error==="search_provider_not_configured"?
      "Pesquisa ao vivo ainda não configurada. É necessária uma chave de API de pesquisa no Cloudflare Preview.":
      "A pesquisa externa falhou ("+(result.error||response.status)+").";
     throw Error(message);
    }
    externalResults=result.items||[];
    externalKey=year+"|"+radarArtist+"|"+radarTerritory;
    remoteSearchStatus=externalResults.length+" resultados externos, sujeitos a verificação. "+
     "Consulta sempre a fonte antes de guardar um festival.";
   }catch(e){
    externalResults=[];externalKey="";
    remoteSearchStatus=e.message||"Não foi possível pesquisar.";
   }finally{searching=false;renderExternalRadar(year)}
  };
  run.onclick=()=>void runSearch();
  choose.onchange=()=>{radarArtist=choose.value;remoteSearchStatus="Pesquisa deste artista ainda não executada.";renderExternalRadar(year)};
  location.onchange=()=>{radarTerritory=location.value;remoteSearchStatus="Pesquisa deste território ainda não executada.";renderExternalRadar(year)};
  const config=el("p",remoteEnabled===false?
   "Pesquisa ao vivo por ativar: configurar CONTROL_BRAVE_SEARCH_API_KEY como Secret no Cloudflare Preview. Sem chave, apenas as fontes já verificadas aparecem.":
   remoteEnabled===true?"Pesquisa externa configurada · 3 consultas por pesquisa, com revisão humana.":
   "A verificar a ligação de pesquisa externa…","cc-lead cc-radar-config");
  tools.append(el("label","Artista"),choose,el("label","Território"),location,run);
  radar.append(tools,config,feedback);
  const engine=window.CaravelaBookingRadar;
  if(!engine){radar.append(el("p","Radar indisponível.","cc-lead"));return}
  const discovery=engine.discover({contacts:allContacts,actions:allActions,bookings:allBookings,
   external:externalKey===year+"|"+radarArtist+"|"+radarTerritory?externalResults:[],year,artist:radarArtist});
  const groups=el("div",undefined,"cc-booking-radar-results");
  for(const [label,items] of [
   ["Festivais externos com edição identificada",discovery.curated||[]],
   ["Novas pistas de pesquisa · identificação por confirmar",discovery.leads||[]]
  ]){
   const panel=el("details",undefined,"cc-booking-radar-section");panel.open=true;
   panel.append(el("summary",label+" · "+items.length));
   const cards=el("div",undefined,"cc-booking-radar-grid");
   for(const candidate of items){
    const card=el("article",undefined,"cc-booking-radar-card");
    card.append(el("strong",candidate.name),
     el("small",candidate.city||candidate.source||"Festival por verificar"),
     el("p",candidate.basis),el("small",candidate.status==="application_closed"?
       "Candidaturas encerradas para esta edição":"Não há vaga nem proposta confirmada"));
    const actions=el("div",undefined,"cc-booking-radar-card-actions");
    if(/^https:\/\//.test(candidate.page||"")){
     const link=el("a","Consultar fonte");link.href=candidate.page;
     link.target="_blank";link.rel="noopener noreferrer";actions.append(link);
    }
    card.append(actions);cards.append(card);
   }
   if(!items.length)cards.append(el("p",label.startsWith("Novas")?
     "Executa a pesquisa para procurar novas fontes; a pesquisa não está automaticamente ativa.":
     "Nenhum festival externo pré-verificado ficou fora da base para esta banda e ano.","cc-lead"));
   panel.append(cards);groups.append(panel);
  }
  radar.append(groups);
 }
 async function checkRadarConnection(){
  if(remoteStatusChecked)return;
  remoteStatusChecked=true;
  try{
   const transport=window.CaravelaFestivalSearch;
   if(!transport)throw Error("provider_transport_missing");
   const response=await transport.status(),body=await response.json();
   remoteEnabled=response.ok&&body.ok?!!body.configured:false;
  }catch(error){remoteEnabled=false}
  if(loaded)renderExternalRadar(Number(years.value));
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
   void checkRadarConnection();
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
