/* Press contacts and other relationships: views over one canonical contact dataset.
 * Press pitches are suggested for confirmed gigs or explicitly planned releases.
 * No send and no automatic claim of consent. */
(()=>{"use strict";
 const $=id=>document.getElementById(id);
 const press=$("cc-view-press"),other=$("cc-view-other-contacts"),home=$("cc-view-dashboard");
 if(!press||!other||!home)return;
 const mk=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);if(cls)x.className=cls;return x};
 const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const l=s=>String(s||"").trim().toLocaleLowerCase("pt-PT");
 const pressKinds={release:"Lançamento / single / álbum",gig:"Concerto",other:"Outra ação de imprensa"};
 const planStatuses={planned:"A preparar",in_progress:"Em acompanhamento",completed:"Concluída",paused:"Em pausa"};
 const all=mk("section",undefined,"cc-press-workspace");
 const otherBox=mk("section",undefined,"cc-other-contact-workspace");
 const headline=mk("div",undefined,"cc-press-head");
 headline.append(mk("h2","Imprensa e campanhas"),
  mk("p","Contactos de imprensa organizados por localização e planos ligados a concertos ou lançamentos. Sugestões exigem verificação editorial.","cc-lead"));
 const newPlan=mk("button","+ Plano de imprensa","cc-primary");newPlan.type="button";headline.append(newPlan);
 const campaigns=mk("div",undefined,"cc-press-plans"),suggestions=mk("div",undefined,"cc-press-suggestions");
 const pressSearch=mk("input");pressSearch.type="search";pressSearch.placeholder="Pesquisar meios, localidade, região…";
 pressSearch.setAttribute("aria-label","Pesquisar imprensa");
 const pressDirectory=mk("div",undefined,"cc-contact-directory");
 const planForm=mk("section",undefined,"cc-press-plan-editor");planForm.hidden=true;
 all.append(headline,planForm,mk("h3","Campanhas e lembretes"),campaigns,
  mk("h3","Sugestões para concertos e lançamentos"),suggestions,
  mk("h3","Contactos de imprensa"),pressSearch,pressDirectory);
 press.querySelector(".cc-panel-head")?.after(all);
 const otherSearch=mk("input");otherSearch.type="search";otherSearch.placeholder="Pesquisar artista, serviço, marca, instituição, parceria…";
 const otherDirectory=mk("div",undefined,"cc-contact-directory");
 otherBox.append(mk("h2","Outros contactos"),
  mk("p","Parcerias, artistas, serviços, marcas e instituições, agrupados pelo tipo registado. Promotores pertencem exclusivamente ao Booking; fichas sem classificação aparecem em «Tipo por identificar».","cc-lead"),
  otherSearch,otherDirectory);
 other.querySelector(".cc-panel-head")?.after(otherBox);
 let contacts=[],bookings=[],plans=[],announcements=[],loading=false;
 const openedRegions=new Set(),openedOtherGroups=new Set();
 function exportRegion(group){
  const module=window.CaravelaPressCsv;
  if(!module)throw Error("Exportador CSV indisponível");
  const file=module.create(group);
  if(!file.count)throw Error("Não existem contactos para exportar");
  const url=URL.createObjectURL(new Blob([file.content],{type:"text/csv;charset=utf-8"}));
  try{
   const link=document.createElement("a");
   link.href=url;link.download=file.filename;link.hidden=true;
   document.body.append(link);link.click();link.remove();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }
 const same=(a,b)=>l(a)&&l(a)===l(b);
 const openContact=c=>window.dispatchEvent(new CustomEvent("caravela-board-open-contact",{detail:{id:c.id}}));
 function eligible(c){return c.kind==="press"&&c.contact_policy!=="blocked"&&
  !c.suppressed&&!c.control_blocked&&!c.control_blocked_possible&&
  !c.shared_email&&!c.source_shared_email&&!c.canonical_id&&c.duplicate_decision!=="secondary"}
 function pressFor({kind,city="",region="",country=""}){
  const list=contacts.filter(eligible);
  if(kind==="release")return list.slice().sort((a,b)=>
   (Number(!!b.media_type)-Number(!!a.media_type))||l(a.name).localeCompare(l(b.name),"pt-PT")).slice(0,8);
  return list.filter(c=>{
   const local=same(c.city,city);
   const regional=region&&same(c.region,region)&&(!c.country||!country||same(c.country,country));
   return local||regional||(!c.city&&!c.region&&(!c.country||!country||same(c.country,country)));
  }).sort((a,b)=>Number(same(b.city,city))-Number(same(a.city,city))||
   Number(same(b.region,region))-Number(same(a.region,region))||l(a.name).localeCompare(l(b.name),"pt-PT")).slice(0,8);
 }
 function candidateCard(c,desc=""){
  const card=mk("article",undefined,"cc-contact-result");
  card.append(mk("strong",c.name),mk("small",[c.city,c.region,c.country].filter(Boolean).join(" · ")||"Âmbito geográfico por confirmar"));
  if(desc)card.append(mk("small",desc));
  const b=mk("button","Abrir ficha","cc-neutral");b.type="button";b.onclick=()=>openContact(c);card.append(b);
  return card;
 }
 function directory(el,kind,q){
  el.replaceChildren();
  const rows=contacts.filter(c=>kind==="press"?c.kind==="press":
   !["festival","venue","press","promoter"].includes(c.kind));
  const filtered=rows.filter(c=>!q||l([c.name,c.kind,c.city,c.region,c.country,
    (c.emails||[]).join(" "),c.contact_subtype,c.relationship,c.source_label].join(" ")).includes(q));
  if(kind==="press")el.append(mk("p",filtered.length+" fichas · originais preservados","cc-lead"));
  if(kind==="press"){
   const groups=window.CaravelaPressGeography?.group(filtered)||[];
   const searching=!!q;
   if(!groups.length)el.append(mk("p","Nenhum meio de comunicação encontrado.","cc-lead"));
   el.append(mk("p","Abre uma localização para consultar os meios. O CSV exporta todos os contactos apresentados nessa localização"+
     (searching?" com a pesquisa atual.":"."),"cc-lead cc-press-directory-help"));
   function makeLocation(group,nested=false){
    const key=group.key;
    const block=mk("details",undefined,nested?"cc-press-location cc-press-district":"cc-press-location");
    const header=mk("summary",undefined,"cc-press-location-summary");
    const name=mk("span",group.label,"cc-press-location-name");
    const count=mk("span",group.rows.length+" contactos","cc-press-location-count");
    header.append(name,count);block.append(header);
    const interior=mk("div",undefined,"cc-press-location-body");
    const endBar=mk("div",undefined,"cc-press-location-footer");
    const isPortugal=key==="portugal";
    const caption=mk("small",isPortugal?
      "Exporta todos os contactos de Resto de Portugal ou escolhe um distrito acima.":
      "Exporta todos os contactos desta localização, incluindo os que não cabem no ecrã e os que exigem validação.");
    const action=mk("button","Exportar CSV · "+group.rows.length+" contactos","cc-primary");
    action.type="button";
    const feedback=mk("small","","cc-press-export-feedback");
    feedback.setAttribute("role","status");
    action.onclick=()=>{
     try{
      exportRegion(group);
      feedback.textContent="CSV preparado com "+group.rows.length+" contactos.";
     }catch(error){
      feedback.textContent="Não foi possível exportar: "+String(error.message||error);
     }
    };
    endBar.append(caption,action,feedback);
    interior.append(endBar);
    block.append(interior);
    let populated=false;
    const populate=()=>{
     if(populated)return;
     populated=true;
     if(isPortugal){
      const districtGroups=window.CaravelaPressGeography?.districtsWithin(group.rows)||[];
      const note=mk("p","Seleciona o distrito. Cada um tem a sua lista e CSV próprios.","cc-lead");
      interior.insertBefore(note,endBar);
      for(const district of districtGroups)
       interior.insertBefore(makeLocation(district,true),endBar);
     }else{
      const cards=mk("div",undefined,"cc-contact-results");
      for(const c of group.rows)
       cards.append(candidateCard(c,!eligible(c)?"Verificar política de contacto":""));
      interior.insertBefore(cards,endBar);
     }
    };
    block.open=searching||openedRegions.has(key);
    if(block.open)populate();
    block.addEventListener("toggle",()=>{
     if(block.open)populate();
     if(searching)return;
     if(block.open)openedRegions.add(key);
     else openedRegions.delete(key);
    });
    return block;
   }
   for(const group of groups)el.append(makeLocation(group));
  }else{
   const classifier=window.CaravelaOtherContacts;
   const groups=classifier?.group(rows,{search:q})||[];
   const total=groups.reduce((n,g)=>n+g.rows.length,0);
   el.append(mk("p",total+" fichas em "+groups.length+
    " categorias · promotores excluídos · histórico preservado","cc-lead"));
   if(!groups.length)el.append(mk("p","Sem outros contactos para este filtro.","cc-lead"));
   if(!classifier){
    el.append(mk("p","Organização por tipo indisponível. Recarrega a página.","cc-lead"));
    return;
   }
   for(const group of groups){
    const block=mk("details",undefined,"cc-other-category");
    const heading=mk("summary",undefined,"cc-other-category-head");
    heading.append(mk("strong",group.label),
      mk("span",group.rows.length+" contactos","cc-other-category-count"));
    block.append(heading);
    const content=mk("div",undefined,"cc-other-category-body");
    content.append(mk("p",group.basis+
      ". As fichas só são reclassificadas quando guardas o tipo correto.","cc-lead"));
    const cards=mk("div",undefined,"cc-contact-results");
    content.append(cards);block.append(content);
    let populated=false;
    const populate=()=>{
     if(populated)return;
     populated=true;
     for(const c of group.rows){
      const category=classifier.category(c),card=mk("article",undefined,"cc-contact-result");
      card.append(mk("strong",c.name||"Entidade sem designação"));
      card.append(mk("small",[c.city,c.region,c.country].filter(Boolean).join(" · ")||"Localização por confirmar"));
      card.append(mk("small",category.basis));
      if(c.source_label)card.append(mk("small","Origem: "+c.source_label));
      if(c.source_contact_person)card.append(mk("small","Interlocutor: "+c.source_contact_person));
      if(c.owner)card.append(mk("small","Responsável: "+c.owner));
      if(c.organizer)card.append(mk("small","Organizador indicado: "+c.organizer));
      const button=mk("button",category.key==="type:unknown"?
       "Identificar tipo na ficha":"Ver / alterar ficha","cc-neutral");
      button.type="button";button.onclick=()=>openContact(c);card.append(button);
      cards.append(card);
     }
    };
    block.open=!!q||openedOtherGroups.has(group.key);
    if(block.open)populate();
    block.addEventListener("toggle",()=>{
     if(block.open)populate();
     if(q)return;
     if(block.open)openedOtherGroups.add(group.key);
     else openedOtherGroups.delete(group.key);
    });
    el.append(block);
   }
  }
 }
 function render(){
  directory(pressDirectory,"press",l(pressSearch.value));
  directory(otherDirectory,"other",l(otherSearch.value));
  campaigns.replaceChildren();suggestions.replaceChildren();
  const active=plans.filter(p=>p.status!=="completed"&&p.status!=="paused");
  if(!active.length)campaigns.append(mk("p","Ainda não existem planos de imprensa registados. Podes criar um para o próximo single.","cc-lead"));
  for(const p of active.slice(0,12)){
   const card=mk("article",undefined,"cc-press-campaign");
   card.append(mk("strong",p.title+" · "+p.artist),mk("small",pressKinds[p.kind]+" · "+p.event_date+" · "+planStatuses[p.status]),
    mk("p",p.next_step,"cc-lead"));
   if(p.review_date)card.append(mk("small","Rever: "+p.review_date));
   const b=mk("button","Editar plano","cc-neutral");b.type="button";b.onclick=()=>edit(p);card.append(b);campaigns.append(card)
  }
  const events=[];
  const stamp=today();
  for(const gig of bookings){
   if(gig.stage!=="confirmed"||!gig.event_date||gig.event_date<stamp)continue;
   const c=contacts.find(x=>x.id===gig.contact_id);
   if(!c)continue;
   events.push({kind:"gig",title:gig.subject,artist:gig.artist,date:gig.event_date,city:c.city,region:c.region,country:c.country});
  }
  for(const e of announcements){
   if(!e?.date||e.date<stamp||!["wild","devil","both"].includes(e.artist))continue;
   const a=e.artist==="wild"?"WILDCHAINS":e.artist==="devil"?"Devil of a Woman":"WILDCHAINS + Devil of a Woman";
   if(events.some(x=>x.date===e.date&&x.artist===a&&
      (x.title===e.title||x.title===e.venue)))continue;
   events.push({kind:"gig",title:e.title,artist:a,date:e.date,
    city:typeof e.city==="string"?e.city:e.city?.pt||"",
    country:"",region:"",announcement:true});
  }
  for(const p of active){if(p.event_date>=stamp||p.review_date>=stamp)
    events.push({kind:p.kind,title:p.title,artist:p.artist,date:p.event_date,city:p.city,region:p.region,country:p.country})}
  for(const event of events.slice(0,10)){
   const block=mk("section",undefined,"cc-press-suggestion-group");
   block.append(mk("strong",event.title+" · "+event.artist),
    mk("small",pressKinds[event.kind]+" · "+event.date+
      (event.city?" · "+event.city:"")));
   const candidates=pressFor(event);
   if(!candidates.length)block.append(mk("p","Sem imprensa compatível com a localização registada. Podes pesquisar na base completa.","cc-lead"));
   const cards=mk("div",undefined,"cc-press-candidate-grid");
   for(const c of candidates)cards.append(candidateCard(c,"Sugestão · verificar cobertura, interlocutor e consentimento"));
   block.append(cards);suggestions.append(block);
  }
  if(!events.length)suggestions.append(mk("p","Regista um concerto confirmado no Booking ou um lançamento para obter sugestões contextualizadas.","cc-lead"));
  window.dispatchEvent(new CustomEvent("caravela-control-press-context",{detail:{
   campaigns:active.slice(0,10),suggestions:events.slice(0,8).map(e=>({...e,contacts:pressFor(e).map(x=>({id:x.id,name:x.name,city:x.city,region:x.region}))}))
  }}));
 }
 function field(form,key,label,type,original,opts=null){
  const wrap=mk("label",label),v=mk(type==="select"?"select":type==="textarea"?"textarea":"input");
  v.name=key;if(!["select","textarea"].includes(type))v.type=type;
  if(type==="select")for(const [value,name] of Object.entries(opts||{})){
    const option=mk("option",name);option.value=value;v.append(option)
  }
  v.value=original??"";wrap.append(v);form.append(wrap);
  return v;
 }
 function edit(p={}){
  planForm.hidden=false;planForm.replaceChildren();
  const form=mk("form",undefined,"cc-press-plan-form");
  form.append(mk("h3",p.id?"Editar plano de imprensa":"Novo plano de imprensa"));
  field(form,"title","Ação / lançamento","text",p.title).required=true;
  field(form,"artist","Artista","select",p.artist||"WILDCHAINS",
   {"WILDCHAINS":"WILDCHAINS","Devil of a Woman":"Devil of a Woman"});
  field(form,"kind","Tipo","select",p.kind||"release",pressKinds);
  field(form,"event_date","Data do evento / lançamento","date",p.event_date).required=true;
  field(form,"city","Localidade (opcional)","text",p.city);
  field(form,"region","Região (opcional)","text",p.region);
  field(form,"country","País (opcional)","text",p.country);
  field(form,"review_date","Próxima revisão","date",p.review_date);
  field(form,"status","Estado","select",p.status||"planned",planStatuses);
  field(form,"next_step","Próximo passo","textarea",p.next_step||"Definir meios relevantes e preparar abordagem").required=true;
  field(form,"notes","Notas","textarea",p.notes);
  const buttons=mk("div",undefined,"cc-press-form-actions");
  const save=mk("button","Guardar plano","cc-primary");save.type="submit";
  const cancel=mk("button","Cancelar","cc-neutral");cancel.type="button";
  cancel.onclick=()=>{planForm.hidden=true;planForm.replaceChildren()};
  const feedback=mk("p","","cc-lead");feedback.setAttribute("role","status");
  buttons.append(save,cancel);form.append(buttons,feedback);
  form.onsubmit=async event=>{
   event.preventDefault();save.disabled=true;
   try{
    const record=Object.fromEntries(new FormData(form).entries());
    if(p.id)record.id=p.id;if(p.revision)record.revision=p.revision;
    const transport=window.CaravelaNativeTransport;
    if(!transport)throw Error("Inicia sessão");
    const resp=await transport.request("press_plans",p.revision?"PATCH":"POST",record);
    const result=await resp.json();
    if(!resp.ok||!result.ok)throw Error(result.error||"Falha ao guardar");
    planForm.hidden=true;planForm.replaceChildren();await load();
   }catch(e){feedback.textContent=e.message}finally{save.disabled=false}
  };
  planForm.append(form);planForm.scrollIntoView({behavior:"smooth",block:"start"});
 }
 async function load(){
  const t=window.CaravelaNativeTransport;if(!t||loading)return;loading=true;
  try{
   const [a,c,b,p,agenda]=await Promise.all([t.request("archive"),t.request("contacts"),
    t.request("booking"),t.request("press_plans"),
    fetch("/assets/data/agenda.json",{cache:"no-store"})]);
   if(!a.ok||!c.ok||!b.ok||!p.ok)throw Error("Não foi possível consultar todas as fontes");
   const [arc,contactsData,bookingsData,plansData]=await Promise.all([a.json(),c.json(),b.json(),p.json()]);
   const merged=new Map((arc.contacts||[]).map(x=>[x.id,{...x,contact_policy:"review",
     source_shared_email:!!x.shared_email}]));
   for(const row of contactsData.records||[])merged.set(row.id,{...merged.get(row.id),...row});
   contacts=[...merged.values()];bookings=bookingsData.records||[];plans=plansData.records||[];
   if(agenda.ok){const list=await agenda.json();announcements=Array.isArray(list.events)?list.events:[]}
   else announcements=[];
   render();
  }catch(e){campaigns.replaceChildren(mk("p","Dados de imprensa indisponíveis: "+e.message,"cc-lead"))}
  finally{loading=false}
 }
 newPlan.onclick=()=>edit();
 pressSearch.oninput=()=>directory(pressDirectory,"press",l(pressSearch.value));
 otherSearch.oninput=()=>directory(otherDirectory,"other",l(otherSearch.value));
 for(const event of ["caravela-control-token-ready","caravela-control-authenticated",
   "caravela-control-booking-updated","caravela-control-contacts-updated"])
  window.addEventListener(event,()=>void load());
 window.addEventListener("caravela-control-view-opened",e=>{
  if(["press","other-contacts","dashboard"].includes(e.detail?.view))void load();
 });
 window.addEventListener("caravela-control-signed-out",()=>{
  contacts=[];bookings=[];plans=[];announcements=[];render();
 });
})();
