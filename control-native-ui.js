/* Caravela Control — editable working area, Preview only.
 * Historical V3 stays immutable; saved records are a separate append-only stream. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const contactView=$("cc-view-contacts"),bookingView=$("cc-view-booking"),dashboard=$("cc-view-dashboard");
if(!contactView||!bookingView||!dashboard)return;
const CONTACT_FIELDS=[
  ["name","Nome / entidade","text",true],["kind","Tipo","select",true],
  ["city","Localidade","text"],["region","Região / distrito","text"],["country","País","text"],["emails","Emails (separados por vírgulas)","text"],
  ["contact_policy","Política de contacto","select",true],
  ["relationship","Relação comercial","select"],
  ["authorization_source","Evidência da autorização operacional","select"],
  ["authorization_email","Endereço da conversa (se comprovado)","email"],
  ["authorization_reference","Identificador da conversa Zoho (se comprovado)","text"],
  ["next_step","Próximo passo","textarea"],["review_date","Rever em","date"],
  ["notes","Notas internas","textarea"]
];
const BOOKING_FIELDS=[
  ["contact_name","Entidade / promotor","text",true],["contact_id","Associar a contacto","select"],
  ["artist","Artista","text",true],["subject","Proposta / evento","text",true],
  ["stage","Estado","select",true],["priority","Prioridade","select",true],
  ["contact_email","Email operacional","email"],["fee_amount","Cachet (€)","number"],
  ["commission_pct","Comissão acordada (%)","number"],
  ["event_date","Data prevista do concerto","date"],
  ["press_status","Estado de comunicação / imprensa","select"],["press_reference","Referência de imprensa / divulgação","text"],
  ["fee_note","Notas de valor / comissão","text"],
  ["conditions","Condições / deslocação / alojamento","textarea"],
  ["last_contact_date","Último contacto comprovado","date"],
  ["due_date","Próxima revisão","date"],["owner","Responsável","text"],
  ["next_step","Próxima ação","textarea",true],
  ["evidence_type","Evidência","select",true],["evidence_reference","Referência (email / contrato / nota)","text"],
  ["notes","Contexto interno","textarea"]
];
const choices={
 kind:{festival:"Festival",venue:"Sala / espaço",promoter:"Promotor",press:"Imprensa",partnership:"Possível parceria",other:"Outro"},
 press_status:{unknown:"Por avaliar",planned:"Divulgação planeada",completed:"Divulgação realizada (referenciada)",not_applicable:"Não aplicável"},
 contact_policy:{review:"Rever antes de contactar",allowed:"Contacto autorizado",blocked:"Não contactar"},
 relationship:{unknown:"Por classificar",partner:"Parceria existente",target:"Queremos colaborar",in_discussion:"Em conversa",former:"Parceria anterior",not_applicable:"Não aplicável"},
 authorization_source:{none:"Sem prova confirmada",zoho_thread:"Conversa Zoho de ida e volta — verificar no servidor"},
 stage:{research:"Por avaliar",draft:"Proposta por preparar",contact_reported:"Contacto referido (não verificado)",
   sent_verified:"Envio verificado",reply_reported:"Resposta referida",negotiating:"Em negociação",
   confirmed:"Confirmado",declined:"Recusado",paused:"Em pausa",closed:"Concluído"},
 priority:{high:"Alta",medium:"Média",low:"Baixa"},
 evidence_type:{none:"Sem comprovativo",user_report:"Registo manual / relato",
   sent_message:"Email enviado — verificado",received_message:"Email recebido — verificado",
   agreement:"Contrato / acordo verificado"}
};
const state={historical:[],actions:[],saved:{contacts:[],booking:[]},busy:false,shown:{contacts:40,booking:30}};
const mergeSelection=new Set(); // Only in-memory; never auto-send or import into Zoho.
const byId=new Map();
const normalize=x=>String(x??"").trim();
const lower=x=>normalize(x).toLocaleLowerCase("pt-PT");
const get=kind=>state.saved[kind];
const make=(tag,text,cls)=>{
  const el=document.createElement(tag);
  if(text!==undefined)el.textContent=String(text);
  if(cls)el.className=cls;
  return el;
};
function historicPolicy(x){
 if(x.suppressed||x.control_blocked||x.control_blocked_possible)return "blocked";
 if(x.review_required||x.shared_email)return "review";
 return "review"; // original history is never automatically approved for a new send
}
function historicalContact(x){
 const meta=x.meta||{},source=x.origin?.file||"";
 const isPortugal=/^PT_[A-Za-z]+\./i.test(source);
 return {id:x.id,origin_id:x.id,name:x.name,kind:x.kind,city:x.city||"",
   region:x.region||meta.region||"",country:x.country||meta.country||(isPortugal?"Portugal":""),
   media_type:x.media_type||meta.media_type||"",organizer:x.organizer||meta.organizer||"",
   source_contact_person:x.contact_person||meta.contact_person||"",
   source_primary_email:x.source_primary_email||"",source_channel_quality:x.source_channel_quality||"",
   source_form_url:x.source_form_url||"",
   people:[],linked_producer_ids:[],canonical_id:"",duplicate_decision:"unreviewed",
   emails:Array.isArray(x.emails)?x.emails:[],contact_policy:historicPolicy(x),
   next_step:"",review_date:"",notes:"",relationship:"unknown",
   source_label:"Arquivo importado (original imutável)",historical:true,
   source_review_required:!!x.review_required,source_shared_email:!!x.shared_email,
   source_suppressed:!!x.suppressed,source_duplicate_name_city:!!x.duplicate_name_city,
   source_priority:x.priority||"",source_recommendation:x.recommendation||"",
   source_status:x.status_2027||""};
}
function contactRows(){
 const map=new Map(state.historical.map(x=>[x.id,historicalContact(x)]));
 for(const entry of get("contacts"))map.set(entry.id,{...map.get(entry.id),...entry,historical:!!map.get(entry.id)});
 const rows=[...map.values()].sort((a,b)=>lower(a.name).localeCompare(lower(b.name),"pt-PT"));
 byId.clear();rows.forEach(x=>byId.set(x.id,x));return rows;
}
function nativeRows(kind){return kind==="contacts"?contactRows():get("booking").slice()}
function suggestedChannel(contact){
 if(contact.source_suppressed||contact.contact_policy==="blocked")return null;
 const mails=[...new Set((contact.emails||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean))];
 const scored=mails.map(email=>{
  const local=email.split("@")[0]||"";
  const unsuitable=/(^|[._-])(privacy|support|legal|noreply|no-reply|admin|administracao|billing|facturas|comercial|publicidade|advertising|tickets|bilhetes|atendimento|passatempos)([._-]|$)/.test(local);
  let priority=unsuitable?-100:5;
  if(contact.kind==="press"){
   if(/redaccao|redacao|cultura|editor|music|imprensa|press|reviews/.test(local))priority+=45;
   else if(/contact|contato|geral|info|mail|jornal/.test(local))priority+=18;
  }else if(/booking|programac|artistas|bandas|production|producao|concertos|eventos/.test(local))priority+=40;
  else if(/geral|info|contact|contato|mail/.test(local))priority+=12;
  if(email===String(contact.source_primary_email||"").toLowerCase())priority+=16;
  return {email,priority,reason:priority>=30?"canal especializado ou prioritário no arquivo":priority>=14?"canal geral":"contacto sem função identificada"};
 }).filter(x=>x.priority>0).sort((a,b)=>b.priority-a.priority||a.email.localeCompare(b.email));
 return scored[0]||null;
}

function api(kind,method,data){
 const transport=window.CaravelaNativeTransport;
 if(!transport)throw Error("Ligação ao cofre indisponível. Reabre a página.");
 return transport.request(kind,method,data);
}
let archiveLoaded=false,archiveBusy=false,archivePromise=null;
function loadArchive(){
 if(archiveLoaded)return Promise.resolve();
 if(archivePromise)return archivePromise;
 archiveBusy=true;
 archivePromise=(async()=>{
  try{
   const response=await api("archive","GET");
   if(response.status===403)return;
   const data=await response.json();
   if(!response.ok||!data.ok)throw Error(data.error||"Arquivo indisponível");
   state.historical=data.contacts||[];
   state.actions=data.actions||[];
   archiveLoaded=true;
   updateGeoFilters();
   render("contacts");render("booking");renderDashboard();
  }catch(error){
   if($("cc-native-contacts-status"))
    $("cc-native-contacts-status").textContent="Registos próprios disponíveis. Arquivo: "+error.message;
  }finally{archiveBusy=false;archivePromise=null}
 })();
 return archivePromise;
}
async function load(kind){
 const status=$("cc-native-"+kind+"-status");
 try{
  const response=await api(kind,"GET");
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||"Erro "+response.status);
  state.saved[kind]=data.records||[];
  if(kind==="contacts")updateGeoFilters();
  render(kind);renderDashboard();
  status.textContent="Registos operacionais guardados no D1 · histórico original preservado.";
  status.classList.remove("error");
 }catch(error){
  status.textContent="Não foi possível consultar a área de trabalho. "+error.message+
    " No modo de transição, valida o token em Comunicações.";
  status.classList.add("error");
 }
}
function build(kind,heading){
 const root=document.createElement("section");root.className="cc-native";
 root.id="cc-native-"+kind;
 root.innerHTML='<div class="cc-native-head"><div><h2>'+heading+'</h2>'+
  '<p class="cc-lead">Registos operacionais editáveis, com histórico de alterações. Nenhum email é enviado automaticamente.</p></div>'+
  '<button type="button" class="cc-primary" id="cc-native-'+kind+'-new">+ Novo registo</button></div>'+
  '<div class="cc-native-tools"><label>Pesquisar<input id="cc-native-'+kind+'-search" type="search" placeholder="Nome, artista, notas, email..."></label>'+
  '<label>Mostrar<select id="cc-native-'+kind+'-filter"></select></label></div>'+
  '<p class="cc-native-summary" id="cc-native-'+kind+'-summary"></p>'+
  '<p class="status" role="status" id="cc-native-'+kind+'-status"></p>'+
  '<div id="cc-native-'+kind+'-editor" class="cc-native-editor" hidden></div>'+
  '<div id="cc-native-'+kind+'-list" class="cc-native-list"></div>'+
  '<button type="button" class="cc-neutral cc-native-more" id="cc-native-'+kind+'-more" hidden>Mostrar mais</button>';
 root.querySelector("#cc-native-"+kind+"-new").onclick=()=>edit(kind);
 root.querySelector("#cc-native-"+kind+"-search").oninput=()=>{state.shown[kind]=kind==="contacts"?40:30;render(kind)};
 if(kind==="contacts"){
  const geo=make("div",undefined,"cc-native-geo");
  geo.innerHTML='<label>Tipo de entidade <select id="cc-native-contact-type"><option value="all">Todos</option></select></label>'+
    '<label>País <select id="cc-native-contact-country"><option value="all">Todos</option></select></label>'+
    '<label>Região <select id="cc-native-contact-region"><option value="all">Todas</option></select></label>';
  root.querySelector(".cc-native-tools").after(geo);
  const basket=make("section",undefined,"cc-contact-basket");
  basket.innerHTML='<div class="cc-basket-head"><div><strong>Seleção para mail merge</strong>'+
    '<p>Seleciona entidades com as caixas. O CSV de envio só inclui emails de fichas autorizadas, sem bloqueios nem caixas partilhadas.</p></div>'+
    '<strong id="cc-basket-count">0 selecionadas</strong></div>'+
    '<div class="cc-basket-actions"><button type="button" class="cc-neutral" id="cc-basket-visible">Selecionar resultados visíveis</button>'+
    '<button type="button" class="cc-neutral" id="cc-basket-clear">Limpar seleção</button>'+
    '<label class="cc-basket-project">Projeto <select id="cc-basket-project"><option value="WILDCHAINS">WILDCHAINS</option>'+
    '<option value="Devil of a Woman">Devil of a Woman</option><option value="WILDCHAINS + Devil of a Woman">Ambos</option>'+
    '<option value="Caravela Amarela">Caravela Amarela</option></select></label>'+
    '<button type="button" class="cc-neutral" id="cc-basket-review">CSV para revisão (não enviar)</button>'+
    '<button type="button" class="cc-primary" id="cc-basket-export">Exportar CSV elegível</button></div>'+
    '<p id="cc-basket-summary" class="cc-lead" aria-live="polite"></p>';
  geo.after(basket);
  root.querySelector("#cc-basket-visible").onclick=()=>{
    for(const contact of filtered("contacts").slice(0,state.shown.contacts))mergeSelection.add(contact.id);
    render("contacts");
  };
  root.querySelector("#cc-basket-clear").onclick=()=>{mergeSelection.clear();render("contacts")};
  root.querySelector("#cc-basket-review").onclick=()=>exportBasketReview();
  root.querySelector("#cc-basket-export").onclick=()=>exportBasket();

  for(const [value,label] of Object.entries(choices.kind)){
    const opt=make("option",label);opt.value=value;root.querySelector("#cc-native-contact-type").append(opt);
  }
  for(const id of ["cc-native-contact-type","cc-native-contact-country","cc-native-contact-region"])
    root.querySelector("#"+id).onchange=()=>render("contacts");
 }
 const filter=root.querySelector("#cc-native-"+kind+"-filter");
 const opts=kind==="contacts"?{all:"Todos",...choices.contact_policy}:{all:"Todos",due:"Follow-ups vencidos",...choices.stage};
 for(const [key,label] of Object.entries(opts)){const el=make("option",label);el.value=key;filter.append(el)}
 filter.onchange=()=>{state.shown[kind]=kind==="contacts"?40:30;render(kind)};
 root.querySelector("#cc-native-"+kind+"-more").onclick=()=>{state.shown[kind]+=40;render(kind)};
 return root;
}
contactView.querySelector(".cc-panel-head")?.after(build("contacts","Fichas operacionais"));
bookingView.querySelector(".cc-panel-head")?.after(build("booking","Negociações e follow-ups"));
function hint(holder,label,value){
 if(!value)return;
 const line=make("div",undefined,"cc-native-row");
 line.append(make("small",label),make("span",value));
 holder.append(line);
}
function badge(s,kind){
 return make("span",(choices[kind==="contacts"?"contact_policy":"stage"]||{})[s]||s,"cc-native-stage");
}
function contactCards(rows){
 // Display grouping only: each archived identifier, revision and restriction survives.
 // Press names may share a publisher but retain distinct editorial channels.
 const cleanName=x=>lower(x).normalize("NFD").replace(/\p{M}/gu,"").replace(/[^a-z0-9]+/g," ").trim();
 const output=[];
 for(const record of rows){
  const key=[record.kind,cleanName(record.name),cleanName(record.city),cleanName(record.country)].join("|");
  const group=output.find(x=>{
   if(x.key!==key)return false;
   if(record.kind==="press")return true;
   return (record.emails||[]).some(e=>(x.members[0].emails||[]).some(a=>lower(a)===lower(e)));
  });
  if(group)group.members.push(record);
  else output.push({key,members:[record]});
 }
 return output.map(({members})=>{
  if(members.length===1)return members[0];
  const candidates=[...members].sort((a,b)=>
   (Number(!!b.media_type)+Number(!!b.organizer)+Number(!!b.source_primary_email)+Number(!!b.revision))-
   (Number(!!a.media_type)+Number(!!a.organizer)+Number(!!a.source_primary_email)+Number(!!a.revision)));
  const row={...candidates[0],__members:members};
  row.emails=[...new Set(members.flatMap(m=>m.emails||[]).map(lower).filter(Boolean))];
  row.source_shared_email=members.some(x=>x.source_shared_email);
  row.source_suppressed=members.some(x=>x.source_suppressed);
  row.contact_policy=members.some(x=>x.contact_policy==="blocked")?"blocked":
    members.every(x=>x.contact_policy==="allowed")?"allowed":"review";
  return row;
 });
}
function filtered(kind){
 const term=lower($("cc-native-"+kind+"-search").value);
 const filter=$("cc-native-"+kind+"-filter").value;
 const selected=nativeRows(kind).filter(r=>{
  if(kind==="contacts"){
   if(filter!=="all"&&r.contact_policy!==filter)return false;
   for(const [id,key] of [["cc-native-contact-type","kind"],["cc-native-contact-country","country"],["cc-native-contact-region","region"]]){
    const chosen=$(id)?.value||"all";if(chosen!=="all"&&r[key]!==chosen)return false;
   }
  }
  if(kind==="booking"){
   if(filter==="due"){
    const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    if(!r.due_date||r.due_date>today||["confirmed","declined","closed"].includes(r.stage))return false;
   } else if(filter!=="all"&&r.stage!==filter)return false;
  }
  return !term||lower([r.name,r.city,r.emails?.join(" "),r.contact_name,r.artist,r.subject,
    r.contact_email,r.notes,r.next_step,r.owner].filter(Boolean).join(" ")).includes(term);
 });
 return kind==="contacts"?contactCards(selected):selected;
}
function updateGeoFilters(){
 const rows=contactRows();
 for(const [id,field] of [["cc-native-contact-country","country"],["cc-native-contact-region","region"]]){
  const select=$(id);if(!select)return;
  const prior=select.value;
  const options=[...new Set(rows.map(x=>normalize(x[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-PT"));
  select.replaceChildren();const all=make("option",field==="country"?"Todos":"Todas");all.value="all";select.append(all);
  for(const value of options){const option=make("option",value);option.value=value;select.append(option)}
  select.value=options.includes(prior)?prior:"all";
 }
}

function mergeRows(){
 const entries=contactCards(contactRows()).filter(x=>mergeSelection.has(x.id));
 const seen=new Set(),eligible=[],excluded=[];
 for(const x of entries){
  const address=suggestedChannel(x)?.email||"";
  const restricted=x.contact_policy!=="allowed"||x.source_suppressed||
    x.source_shared_email||x.source_review_required||x.source_form_url&&/formul[aá]rio/i.test(x.source_channel_quality||"")||
    x.__members?.some(member=>member.contact_policy!=="allowed"||member.source_suppressed||member.source_shared_email);
  const elsewhere=address&&contactRows().some(c=>c.id!==x.id&&
    (c.emails||[]).some(e=>lower(e)===address)&&
    !(x.__members||[x]).some(m=>m.id===c.id));
  if(restricted||!address||elsewhere||seen.has(address)){
   excluded.push({name:x.name,reason:restricted?"Rever autorização ou canal partilhado":elsewhere?"Email associado a outra entidade":"Sem endereço de envio válido ou já selecionado"});
   continue;
  }
  seen.add(address);
  eligible.push({email:address,name:x.name,kind:choices.kind[x.kind]||x.kind,
    city:x.city||"",region:x.region||"",country:x.country||""});
 }
 return {eligible,excluded,total:entries.length};
}
function csvValue(value){
 let text=String(value??"");
 // Prevent spreadsheet formula injection when CSV is imported into office suites.
 if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
function renderBasket(){
 const summary=$("cc-basket-summary"),counter=$("cc-basket-count");
 if(!summary||!counter)return;
 const ids=new Set(contactCards(contactRows()).map(x=>x.id));
 for(const id of mergeSelection)if(!ids.has(id))mergeSelection.delete(id);
 const {eligible,excluded,total}=mergeRows();
 counter.textContent=total+" selecionadas";
 summary.textContent=eligible.length+" destinatários aptos para CSV · "+excluded.length+
  " excluídos por falta de aprovação, partilha de endereço ou canal inválido. Nenhum email foi enviado.";
 $("cc-basket-export").disabled=!eligible.length;
 $("cc-basket-review").disabled=!total;
}
function exportBasketReview(){
 const rows=contactCards(contactRows()).filter(x=>mergeSelection.has(x.id));
 if(!rows.length)return;
 const header=["Entidade","Tipo","Localidade","País","Emails por validar","Política","Motivo da revisão"];
 const records=rows.map(x=>{
  const address=[...new Set((x.emails||[]).map(lower).filter(Boolean))].join("; ");
  const reason=x.contact_policy==="blocked"||x.source_suppressed?"NÃO CONTACTAR":
   x.source_shared_email?"Contacto partilhado — validar entidade/interlocutor":
   x.contact_policy!=="allowed"?"Rever autorização":
   "Validar destinatário e personalização antes de enviar";
  return [x.name,choices.kind[x.kind]||x.kind,x.city||"",x.country||"",
   reason==="NÃO CONTACTAR"?"":address,x.contact_policy,reason];
 });
 const csv=[header,...records].map(x=>x.map(csvValue).join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
 const a=make("a");a.href=url;a.download="caravela_para_revisao_NAO_ENVIAR.csv";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 $("cc-basket-summary").textContent=rows.length+
  " fichas exportadas PARA REVISÃO. Este CSV não é uma lista de envio Zoho.";
}
function exportBasket(){
 const {eligible,excluded}=mergeRows();
 if(!eligible.length){$("cc-basket-summary").textContent="Não existem destinatários validados para exportação.";return}
 const artist=$("cc-basket-project").value;
 const headings=["Email","Nome","Entidade","Tipo","Localidade","Região","País","Artista"];
 const csv=[headings,...eligible.map(x=>[x.email,x.name,x.name,x.kind,x.city,x.region,x.country,artist])]
  .map(row=>row.map(csvValue).join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
 const link=make("a");link.href=url;link.download="caravela_mailmerge_"+
  new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon"}).format(new Date())+".csv";
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 $("cc-basket-summary").textContent=eligible.length+" linhas exportadas para Zoho (sem envio). "+
  excluded.length+" fichas excluídas. Revê os destinatários e personaliza antes de enviar.";
}
function render(kind){
 if(kind==="contacts"){renderContactTriage();renderBasket();}
 const all=filtered(kind),list=$("cc-native-"+kind+"-list"),limit=state.shown[kind];
 list.replaceChildren();
 let count=0;
 if(kind==="contacts"){
  const rows=contactRows();
  const saved=get(kind).length;
  $("cc-native-contacts-summary").textContent=rows.length+" fichas preservadas · "+
   all.length+" entidades apresentadas após agrupamento visual · "+saved+
   " fichas operacionais. Os registos agrupados não foram fundidos.";
 }else{
  const due=get(kind).filter(x=>x.due_date&&x.due_date<=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())&&
    !["confirmed","declined","closed"].includes(x.stage)).length;
  $("cc-native-booking-summary").textContent=get(kind).length+
    " negociações operacionais · "+due+" revisões vencidas · "+state.actions.length+
    " ações disponíveis no arquivo.";
 }
 if(!all.length)list.append(make("div",
   kind==="contacts"?"Sem contactos neste filtro. Abre a base guardada em Dados e backups.":"Sem negociações neste filtro. Cria a primeira proposta ou retoma uma ação histórica.","cc-notice"));
 for(const r of all.slice(0,limit)){
  const card=make("article",undefined,"cc-native-card");
  const title=make("strong",kind==="contacts"?r.name:r.contact_name+" · "+r.artist);
  const top=make("div",undefined,"cc-native-card-head");
  if(kind==="contacts"){
   const label=make("label",undefined,"cc-card-select");
   const check=make("input");check.type="checkbox";check.checked=mergeSelection.has(r.id);
   check.setAttribute("aria-label","Selecionar "+r.name+" para lista CSV");
   check.onchange=()=>{if(check.checked)mergeSelection.add(r.id);else mergeSelection.delete(r.id);renderBasket()};
   label.append(check);top.append(label);
  }
  top.append(title,badge(kind==="contacts"?r.contact_policy:r.stage,kind));card.append(top);
  if(kind==="booking"){
   hint(card,"Proposta",r.subject);
   hint(card,"Próximo passo",r.next_step);
   hint(card,"Rever",r.due_date||"Sem prazo");
   hint(card,"Cachet",r.fee_amount===null?"Não definido":Number(r.fee_amount).toLocaleString("pt-PT")+" €");
   if(r.commission_pct!==null&&r.commission_pct!==undefined&&r.fee_amount!==null)
    hint(card,"Comissão estimada",Number(r.fee_amount*r.commission_pct/100).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})+" ("+r.commission_pct+"%) · ainda não recebida");
   hint(card,"Data do concerto",r.event_date);
   hint(card,"Comunicação / imprensa",choices.press_status[r.press_status||"unknown"]);
   hint(card,"Responsável",r.owner);
   hint(card,"Evidência",(choices.evidence_type[r.evidence_type]||"")+" · "+(r.evidence_reference||"não referenciada"));
   hint(card,"Origem",r.origin_label);
  } else {
   hint(card,"Tipo / local",((choices.kind[r.kind]||"")+" · "+[r.city,r.region,r.country].filter(Boolean).join(", ")));
   if(r.__members?.length)hint(card,"Fichas agrupadas",
     r.__members.length+" registos históricos/operacionais apresentados em conjunto, sem fusão");
   hint(card,"Emails",r.emails?.join(", ")||"Sem endereço");
   if(r.authorization_source==="zoho_thread")
    hint(card,"Relação comprovada","Conversa bilateral Zoho · "+r.authorization_email+" (não equivale a consentimento para campanhas)");
   const formPreferred=!!r.source_form_url&&/formul[aá]rio/i.test(r.source_channel_quality||"");
   if(formPreferred)hint(card,"Canal preferencial no arquivo","Formulário web (confirmar se continua ativo): "+r.source_form_url);
   const route=suggestedChannel(r);
   if(route&&!formPreferred)hint(card,"Canal a validar",route.email+" · "+route.reason+" (sugestão; envio não autorizado)");
   else if(!formPreferred&&r.emails?.length)hint(card,"Canal para proposta","Nenhum email adequado identificado; rever contacto");
   if(r.media_type)hint(card,"Meio de comunicação",r.media_type);
   if(r.people?.length)hint(card,"Interlocutores",r.people.map(p=>p.name+(p.role?" · "+p.role:"")).join("; "));
   if(r.source_contact_person&&!r.people?.length)hint(card,"Interlocutor histórico (por rever)",r.source_contact_person);
   if(r.canonical_id)hint(card,"Ficha associada a",byId.get(r.canonical_id)?.name||"entidade existente");
   if(r.linked_producer_ids?.length)hint(card,"Produtora(s)",
     r.linked_producer_ids.map(id=>byId.get(id)?.name||"entidade associada").join("; "));
   if(r.organizer)hint(card,"Organização histórica",r.organizer);
   if(r.source_recommendation)hint(card,"Encaixe histórico",r.source_recommendation);
   if(r.source_suppressed)hint(card,"Restrição","Suprimido no arquivo: não contactar");
   if(r.source_shared_email)hint(card,"Contacto partilhado","Endereço usado por várias entidades: validar interlocutor");
   if(r.__members?.length){
    const kinds=[...new Set(r.__members.map(x=>x.media_type).filter(Boolean))];
    if(kinds.length)hint(card,"Canais registados",kinds.join(" / "));
   }
   if(r.relationship&&r.relationship!=="unknown")hint(card,"Relação",choices.relationship[r.relationship]);
   hint(card,"Próximo passo",r.next_step);
   hint(card,"Rever",r.review_date);
   if(r.historical)hint(card,"Origem","Arquivo original — registo separado de alterações");
  }
  const actions=make("div",undefined,"cc-native-card-actions");
  const button=make("button",r.revision?"Atualizar":"Editar ficha","cc-neutral");
  button.type="button";button.onclick=()=>edit(kind,r.__members?.find(x=>x.id===r.id)||r);actions.append(button);
  if(kind==="contacts"&&r.__members?.length){
   const extra=make("details",undefined,"cc-contact-variants");
   extra.append(make("summary","Rever as "+r.__members.length+" fichas originais"));
   for(const original of r.__members){
    const b=make("button","Editar "+original.name+
      (original.media_type?" · "+original.media_type:"")+" · "+original.id.slice(0,7),"cc-neutral");
    b.type="button";b.onclick=()=>edit("contacts",original);extra.append(b);
   }
   card.append(extra);
  }
  if(kind==="contacts"){
   const b=make("button","Nova proposta","cc-neutral");b.type="button";
   b.onclick=()=>{window.CaravelaControlApp?.openView("booking");edit("booking",{
     contact_name:r.name,contact_id:r.id,
     contact_email:r.contact_policy==="allowed"&&!r.source_shared_email&&
       !((r.source_form_url||"")&&/formul[aá]rio/i.test(r.source_channel_quality||""))?
       (suggestedChannel(r)?.email||""):""
   });};actions.append(b);
  }
  if(kind==="contacts"&&r.revision&&!r.historical&&!r.origin_id){
   const remove=make("button","Remover ficha de teste / duplicada","cc-neutral");
   remove.type="button";remove.onclick=async()=>{
    if(state.busy)return;
    if(!window.confirm("Retirar a ficha nativa «"+r.name+"» do trabalho diário? O histórico fica guardado. Não remove entidades do arquivo."))return;
    state.busy=true;remove.disabled=true;
    try{
     const res=await api("contacts","DELETE",{id:r.id,revision:r.revision});
     const data=await res.json();
     if(!res.ok)throw Error(({contact_has_dependencies:"Esta ficha está associada a propostas ou entidades. Retira as ligações primeiro.",
       historical_contact_cannot_remove:"Os contactos históricos não podem ser removidos.",
       revision_conflict:"Ficha alterada noutra sessão. Atualiza a página."})[data.error]||data.error||"Falha a remover ficha");
     await load("contacts");
     $("cc-native-contacts-status").textContent="Ficha retirada; revisões preservadas.";
    }catch(error){$("cc-native-contacts-status").textContent=error.message}
    finally{state.busy=false;remove.disabled=false}
   };
   actions.append(remove);
  }
  if(kind==="booking"&&r.revision&&r.stage!=="confirmed"){
    const remove=make("button","Remover proposta","cc-neutral");remove.type="button";
    remove.onclick=async()=>{
      if(!window.confirm("Remover esta proposta do trabalho diário? O histórico de auditoria será preservado."))return;
      if(state.busy)return;
      state.busy=true;remove.disabled=true;
      try{
        const response=await api("booking","DELETE",{id:r.id,revision:r.revision});
        const result=await response.json();
        if(!response.ok)throw Error(({booking_has_financial_records:"Esta proposta tem movimentos financeiros associados e não pode ser removida.",revision_conflict:"Proposta alterada noutra sessão. Atualiza primeiro."})[result.error]||result.error||"Erro ao remover");
        await load("booking");$("cc-native-booking-status").textContent="Proposta removida do trabalho diário; histórico preservado.";
      }catch(error){$("cc-native-booking-status").textContent=error.message}
      finally{state.busy=false;remove.disabled=false}
    };
    actions.append(remove);
  }
  card.append(actions);list.append(card);count++;
 }
 const more=$("cc-native-"+kind+"-more");more.hidden=all.length<=limit;
 if(kind==="booking")renderHistory();
}
function renderHistory(){
 const area=$("cc-native-booking-history");
 if(!area)return;
 const items=state.actions;area.replaceChildren();
 const p=make("p","Arquivo importado: "+items.length+" ações. Mantêm-se inalteradas. "+
  "Para gerir uma delas, cria uma negociação operacional associada à origem.","cc-lead");
 area.append(p);
 const q=lower($("cc-native-history-search")?.value||"");
 for(const item of items.filter(x=>!q||lower([x.name,x.artist,x.status,x.email].join(" ")).includes(q)).slice(0,15)){
  const row=make("div",undefined,"cc-native-history-row");
  const content=make("span",(item.name||"Sem nome")+" · "+(item.artist||"Sem artista")+
    " · "+(item.status||"Estado original"));
  const b=make("button","Retomar","cc-neutral");b.type="button";
  b.onclick=()=>edit("booking",{
    contact_name:item.name||"",artist:item.artist||"",contact_email:item.email||"",
    origin_label:"AÇÕES · linha "+(item.origin?.row||"?"),
    next_step:item.next_step||"Confirmar informação antes de contactar",
    notes:"Estado no arquivo: "+(item.status||"não indicado")+"; associação e envio por verificar."
  });
  row.append(content,b);area.append(row);
 }
}
const triage=make("section",undefined,"cc-contact-triage");
triage.innerHTML='<h2>Organização de contactos</h2><p class="cc-lead">Revisão assistida: nunca junta contactos nem altera dados sem aprovação.</p>'+
 '<div id="cc-contact-triage-stats" class="cc-native-metrics"></div><div id="cc-contact-triage-list"></div>';
contactView.querySelector("#cc-native-contacts")?.before(triage);
function renderContactTriage(){
 const root=$("cc-contact-triage-stats"),list=$("cc-contact-triage-list");if(!root||!list)return;
 root.replaceChildren();list.replaceChildren();
 const contacts=contactRows();
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const due=contacts.filter(x=>x.review_date&&x.review_date<today);
 const current=contacts.filter(x=>x.review_date===today);
 const future=contacts.filter(x=>x.review_date&&x.review_date>today);
 const partner=contacts.filter(x=>x.relationship==="partner");
 const target=contacts.filter(x=>x.relationship==="target");
 const normal=x=>String(x||"").trim().toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const duplicates=new Map();
 for(const c of contacts){
  // The same publication is often duplicated without a city; keep the entity type in the key.
  // A venue sharing a generic name with another city must never be silently grouped.
  const names=c.name?[normal(c.kind)+"|"+normal(c.name)+"|"+normal(c.city)]:[];
  for(const email of c.emails||[])names.push("email:"+normal(email));
  for(const key of names){const group=duplicates.get(key)||new Map();group.set(c.id,c);duplicates.set(key,group)}
 }
 // Reviewed distinct entities and manually linked secondary records stop
 // resurfacing as unresolved duplicates. Source entities are never deleted.
 const groups=[...duplicates.entries()].map(([key,m])=>[key,new Map([...m.entries()].filter(
  ([,contact])=>contact.duplicate_decision!=="distinct"&&!contact.canonical_id))])
  .filter(([,m])=>m.size>1).sort((a,b)=>b[1].size-a[1].size);
 const counts=[["Revisões vencidas",due.length],["Para hoje",current.length],["Mais tarde",future.length],
  ["Parcerias existentes",partner.length],["A conquistar",target.length],["Grupos a rever",groups.length],
  ["Fichas secundárias",contacts.filter(c=>c.canonical_id).length],
  ["Eventos com produtora",contacts.filter(c=>c.linked_producer_ids?.length).length]];
 for(const [label,value] of counts){const cell=make("div",undefined,"cc-native-metric");cell.append(make("small",label),make("strong",value));root.append(cell)}
 const guide=make("p","As revisões só aparecem com data explícita. Contactos importados sem data não são considerados tratados nem atrasados. Correspondências por email partilhado podem ser legítimas.","cc-lead");
 list.append(guide);
 const sections=[["Contactos vencidos",due],["Para hoje",current],["Programados para depois",future],["Parcerias atuais",partner],["Parcerias desejadas",target]];
 for(const [label,records] of sections){
  if(!records.length)continue;
  const details=make("details",undefined,"cc-contact-review-group");
  details.append(make("summary",label+" · "+records.length));
  const content=make("div",undefined,"cc-contact-review-items");
  for(const c of records.slice(0,12)){
   const button=make("button",c.name+" · "+(c.city||c.region||c.country||"local não indicado"),"cc-neutral");button.type="button";
   button.onclick=()=>{edit("contacts",c);};content.append(button)
  }
  details.append(content);list.append(details);
 }
 if(groups.length){
  const details=make("details",undefined,"cc-contact-review-group");
  details.append(make("summary","Possíveis duplicados · "+groups.length+" grupos"));
  const area=make("div",undefined,"cc-contact-review-items");
  for(const [key,members] of groups.slice(0,40)){
   const records=[...members.values()];
   const item=make("div",undefined,"cc-contact-duplicate-item");
   item.append(make("p",(key.startsWith("email:")?"Email partilhado (não implica duplicação)":"Nome e local semelhantes")+
     " · "+records.map(x=>x.name+(x.city?" ("+x.city+")":"")).join(" / ")));
   for(const record of records){
    const button=make("button","Rever "+record.name,"cc-neutral");button.type="button";
    button.onclick=()=>edit("contacts",record);item.append(button);
   }
   area.append(item);
  }
  details.append(area);list.append(details);
 }
}
const history=make("section",undefined,"cc-native-history");
history.id="cc-native-booking-history-wrap";
history.innerHTML='<h2>Ações do arquivo</h2><label>Pesquisar ações originais<input id="cc-native-history-search" type="search" placeholder="Entidade, artista, estado..."></label><div id="cc-native-booking-history"></div>';
const historyToggle=make("details",undefined,"cc-archive-toggle");
historyToggle.innerHTML='<summary>Ações importadas <small>Consultar ou retomar dados antigos</small></summary>';
historyToggle.append(history);
bookingView.querySelector("#cc-native-booking")?.after(historyToggle);
$("cc-native-history-search").oninput=renderHistory;
function editorField(parent,kind,def,current){
 const [key,label,type,required]=def;
 const box=make("label",label);box.htmlFor="cc-native-field-"+kind+"-"+key;
 let field;
 if(type==="textarea"){field=make("textarea");field.rows=2}
 else if(type==="select"){
  field=make("select");
  const options=key==="contact_id"?{"":"Sem associação confirmada",...Object.fromEntries(
    contactRows().map(x=>[x.id,x.name+" · "+(x.city||"sem local")]))}:choices[key];
  for(const [v,l] of Object.entries(options||{})){
   const opt=make("option",l);opt.value=v;field.append(opt);
  }
 }else {field=make("input");field.type=type;}
 field.id=box.htmlFor;field.name=key;field.required=!!required;
 if(type==="number"){field.min="0";field.max="10000000";field.step="0.01"}
 if(key==="emails")field.value=(current.emails||[]).join(", ");
 else if(key==="fee_amount"||key==="commission_pct")field.value=current[key]===null||current[key]===undefined?"":current[key];
 else field.value=current[key]??({
   kind:"venue",contact_policy:"review",authorization_source:"none",stage:"research",priority:"medium",evidence_type:"none",press_status:"unknown"
 }[key]||"");
 box.append(field);parent.append(box);return field;
}
function contactRelationships(form,entry){
 const rows=contactRows();
 const normalizeName=value=>lower(value).normalize("NFD").replace(/\p{M}/gu,"").replace(/[^a-z0-9]+/g," ").trim();
 const details=make("section",undefined,"cc-entity-links");
 details.append(make("h3","Identidade e relações"));
 details.append(make("p","Os vínculos só são gravados quando guardares esta ficha. Não alteram outras entidades nem autorizam envios.","cc-lead"));
 if(entry.source_contact_person&&!entry.people?.length)
  details.append(make("p","Interlocutor indicado no arquivo (por confirmar): "+entry.source_contact_person,"cc-entity-source-note"));
 const people=make("div",undefined,"cc-entity-people");
 const peopleTitle=make("strong","Interlocutores desta entidade");
 const addPerson=make("button","+ Interlocutor","cc-neutral");addPerson.type="button";
 const nameRow=make("div",undefined,"cc-entity-heading");nameRow.append(peopleTitle,addPerson);
 details.append(nameRow,people);
 function personRow(values={}){
  if(people.children.length>=15)return;
  const row=make("div",undefined,"cc-entity-person");
  const fields={};
  for(const [key,label,type] of [["name","Nome","text"],["role","Função","text"],["email","Email","email"],["phone","Telefone","tel"]]){
   const wrapper=make("label",label);
   const input=make("input");input.type=type;input.value=values[key]||"";
   input.maxLength={name:110,role:110,email:254,phone:65}[key];
   if(key==="name")input.required=true;
   fields[key]=input;wrapper.append(input);row.append(wrapper);
  }
  const remove=make("button","Retirar","cc-neutral");remove.type="button";remove.onclick=()=>row.remove();
  row.append(remove);row._personFields=fields;people.append(row);
 }
 for(const person of entry.people||[])personRow(person);
 addPerson.onclick=()=>personRow();
 const duplicates=make("div",undefined,"cc-entity-duplicates");
 duplicates.append(make("strong","Fichas com o mesmo nome ou contacto"));
 const decisionLabel=make("label","Resultado da revisão");
 const decision=make("select");
 for(const [value,label] of Object.entries({
  unreviewed:"Por rever",distinct:"Entidades distintas — não juntar",secondary:"Ficha secundária de outra entidade"
 })){const option=make("option",label);option.value=value;decision.append(option)}
 decision.value=entry.duplicate_decision||"unreviewed";decisionLabel.append(decision);duplicates.append(decisionLabel);
 const candidates=rows.filter(x=>x.id!==entry.id&&x.kind===(entry.kind||form.elements.namedItem("kind")?.value)&&
  (normalizeName(x.name)===normalizeName(entry.name)||
   (x.emails||[]).some(email=>(entry.emails||[]).includes(email))));
 const canonicalLabel=make("label","Ficha principal (não altera referências antigas)");
 const canonical=make("select");
 const absent=make("option","Escolher ficha principal");absent.value="";canonical.append(absent);
 for(const item of candidates){
  if(item.canonical_id)continue;
  const option=make("option",item.name+(item.city?" · "+item.city:"")+" · "+item.id.slice(0,9));option.value=item.id;canonical.append(option);
 }
 canonical.value=entry.canonical_id||"";
 if(entry.canonical_id&&!candidates.some(x=>x.id===entry.canonical_id)){
  const option=make("option",byId.get(entry.canonical_id)?.name||"Ficha associada");option.value=entry.canonical_id;canonical.append(option);
  canonical.value=entry.canonical_id;
 }
 const refresh=()=>{canonicalLabel.hidden=decision.value!=="secondary"};
 decision.onchange=refresh;canonicalLabel.append(canonical);duplicates.append(canonicalLabel);
 refresh();
 if(!candidates.length){
  duplicates.append(make("p","Não foram encontradas fichas candidatas com o mesmo nome ou email. Nada será associado automaticamente.","cc-lead"));
 }
 details.append(duplicates);
 const producers=make("div",undefined,"cc-entity-producers");
 producers.append(make("strong","Produtoras / promotores associados"));
 const selected=new Set(entry.linked_producer_ids||[]);
 const list=make("div",undefined,"cc-entity-selected");
 const allPromoters=rows.filter(x=>x.kind==="promoter");
 const selector=make("select");
 const placeholder=make("option","Selecionar uma entidade promotora");placeholder.value="";selector.append(placeholder);
 for(const item of allPromoters){
  const option=make("option",item.name+(item.city?" · "+item.city:""));option.value=item.id;selector.append(option);
 }
 const historicOrganizer=(entry.organizer||"").trim().toLocaleLowerCase("pt-PT");
 const suggested=allPromoters.filter(x=>historicOrganizer&&x.name.toLocaleLowerCase("pt-PT")===historicOrganizer);
 if(suggested.length)producers.append(make("p",
  "A organização histórica coincide com "+suggested.map(x=>x.name).join(", ")+
  ". Confirma esta associação antes de guardar.","cc-entity-source-note"));
 const add=make("button","Associar produtora","cc-neutral");add.type="button";
 const actions=make("div",undefined,"cc-entity-add");actions.append(selector,add);
 function drawLinks(){
  list.replaceChildren();
  for(const id of selected){
   const item=make("div",undefined,"cc-entity-linked");
   item.append(make("span",byId.get(id)?.name||"Produtora do arquivo"));
   const remove=make("button","Desassociar","cc-neutral");remove.type="button";
   remove.onclick=()=>{selected.delete(id);drawLinks()};
   item.append(remove);list.append(item);
  }
 }
 add.onclick=()=>{if(selector.value&&selected.size<8&&selector.value!==entry.id){
  selected.add(selector.value);selector.value="";drawLinks()
 }};
 drawLinks();
 producers.append(actions,list);
 producers.append(make("p","Um festival ou venue pode ter várias produtoras. Não elimina nenhuma das fichas e não cria um acordo comercial.","cc-lead"));
 const typeInput=form.elements.namedItem("kind");
 const setVisibility=()=>{producers.hidden=!["festival","venue"].includes(typeInput?.value||entry.kind)};
 if(typeInput)typeInput.addEventListener("change",setVisibility);
 setVisibility();
 details.append(producers);form.append(details);
 return ()=>{
  const collected=[];
  for(const row of people.children){
   const obj=Object.fromEntries(Object.entries(row._personFields).map(([key,input])=>[key,input.value.trim()]));
   if(obj.name||obj.role||obj.email||obj.phone)collected.push(obj);
  }
  if(decision.value==="secondary"&&!canonical.value)throw Error("Seleciona a ficha principal antes de guardar.");
  return {people:collected,linked_producer_ids:["festival","venue"].includes(typeInput?.value)?[...selected]:[],
   canonical_id:decision.value==="secondary"?canonical.value:"",
   duplicate_decision:decision.value};
 };
}
function edit(kind,entry={}){
 const root=$("cc-native-"+kind+"-editor"),form=make("form",undefined,"cc-native-form");
 root.hidden=false;root.replaceChildren();
 const title=make("h3",entry.revision?"Atualizar registo":"Novo registo operacional");
 const help=make("p",kind==="booking"?
  "Indica o próximo passo. Estados de envio ou confirmação exigem evidência concreta. O CRM não envia emails.":
  "O arquivo original não é alterado. Confirma restrições antes de contactar.","cc-lead");
 const fields=kind==="contacts"?CONTACT_FIELDS:BOOKING_FIELDS;
 const grid=make("div",undefined,"cc-field-grid");
 for(const def of fields)editorField(grid,kind,def,entry);
 if(kind==="booking"){
  const artist=grid.querySelector('[name="artist"]'),commission=grid.querySelector('[name="commission_pct"]');
  if(artist&&commission){
   const suggest=()=>{
    if(commission.value.trim())return;
    if(/^(wildchains|devil of a woman)$/i.test(artist.value.trim()))commission.value="15";
   };
   artist.addEventListener("blur",suggest);
   suggest();
   const h=make("p","Roster principal: referência de comissão 15% sobre o cachet artístico. Confirma o acordo antes de guardar.","cc-lead");
   grid.append(h);
  }
  const stage=grid.querySelector('[name="stage"]'),
    lastContact=grid.querySelector('[name="last_contact_date"]'),
    due=grid.querySelector('[name="due_date"]');
  if(stage&&lastContact&&due){
   const suggestFollowup=()=>{
    if(due.value||!/^(sent_verified|reply_reported|negotiating)$/.test(stage.value)||
       !/^\d{4}-\d{2}-\d{2}$/.test(lastContact.value))return;
    const date=new Date(lastContact.value+"T12:00:00Z");
    if(Number.isNaN(date.getTime()))return;
    date.setUTCDate(date.getUTCDate()+7);
    const suggested=date.toISOString().slice(0,10);
    // Suggested and editable, never counted as an actually promised deadline.
    if(suggested>=localToday())due.value=suggested;
   };
   stage.addEventListener("change",suggestFollowup);
   lastContact.addEventListener("change",suggestFollowup);
   suggestFollowup();
   grid.append(make("p","Com envio/resposta comprovados, sugere-se rever em 7 dias. Podes alterar a data; nunca é criada a partir de envios antigos sem prova.","cc-lead"));
  }
 }
 form.append(title,help,grid);
 const relationshipData=kind==="contacts"?contactRelationships(form,entry):null;
 const actions=make("div",undefined,"cc-actions");
 const save=make("button","Guardar registo","cc-primary");save.type="submit";
 const cancel=make("button","Cancelar","cc-neutral");cancel.type="button";
 cancel.onclick=()=>{root.hidden=true;root.replaceChildren()};
 actions.append(save,cancel);form.append(actions);
 const notice=make("p",undefined,"status");notice.setAttribute("role","status");form.append(notice);
 form.onsubmit=async e=>{
  e.preventDefault();if(state.busy)return;
  const record={};
  for(const [k] of fields)record[k]=form.elements.namedItem(k).value.trim();
  if(kind==="contacts"){
   record.emails=record.emails?record.emails.split(",").map(x=>x.trim()).filter(Boolean):[];
   record.origin_id=entry.origin_id||"";
   record.source_label=entry.source_label||"Registo manual";
   try{Object.assign(record,relationshipData())}
   catch(error){notice.textContent=error.message;return}
  }else{
   const money=record.fee_amount;record.fee_amount=money===""?null:Number(money);
   record.commission_pct=record.commission_pct===""?null:Number(record.commission_pct);
   record.currency="EUR";record.origin_label=entry.origin_label||"Registo manual";
  }
  const id=entry.id,revision=entry.revision;
  if(id)record.id=id;
  if(revision)record.revision=revision;
  if(kind==="contacts"&&!revision&&record.origin_id)record.id=record.origin_id;
  if(kind==="booking"&&["sent_verified","confirmed"].includes(record.stage)&&
   (!record.evidence_reference||!["sent_message","received_message","agreement"].includes(record.evidence_type))){
   notice.textContent="Envio ou confirmação exige email/contrato verificado e referência.";return;
  }
  state.busy=true;save.disabled=true;notice.textContent="A guardar no cofre...";
  try{
   const method=revision?"PATCH":"POST";
   const response=await api(kind,method,record);
   const result=await response.json();
   if(!response.ok)throw Error(({
     invalid_record:"Confirma os campos e a evidência.",
     record_exists:"Esta ficha já foi criada. Atualiza a página.",
     revision_conflict:"Ficha alterada noutra sessão. Recarrega antes de guardar.",
     possible_duplicate_contact:"Possível contacto duplicado. Pesquisa a ficha existente.",
     contact_blocked:"Contacto bloqueado: não é possível confirmar esta proposta.",
     verified_contact_link_required:"Associa um contacto validado antes de marcar envio ou confirmação.",
     contact_reference_not_found:"A associação não existe na base. Seleciona um contacto válido.",
     contact_review_required:"A ficha tem de estar autorizada antes de verificares o envio.",
     contact_email_review_required:"O endereço surge associado a restrições históricas. Revê a identidade.",
     contact_identity_mismatch:"Nome ou email não corresponde à ficha associada.",
     historical_contact_exists:"Esta entidade já existe no arquivo. Abre a ficha original em Contactos.",
     authorization_evidence_unverified:"Não foi possível confirmar ida e volta no mesmo fio de conversa Zoho.",
     historical_contact_needs_review:"O contacto exige revisão de identidade, possível partilha de email ou prova Zoho.",
     self_entity_link:"Uma entidade não pode ser associada a si própria.",
     invalid_canonical_link:"A ficha principal não existe, é de outro tipo ou já é secundária.",
     invalid_producer_link:"A produtora escolhida não existe ou não é uma ficha principal de promotor.",
     invalid_origin_reference:"Referência do arquivo inválida."
   })[result.error]||result.error||"Erro "+response.status);
   root.hidden=true;root.replaceChildren();
   await load(kind);
   $("cc-native-"+kind+"-status").textContent="Guardado com histórico de alterações. Nenhum email foi enviado.";
  }catch(error){notice.textContent=error.message;notice.classList.add("error")}
  finally{state.busy=false;save.disabled=false}
 };
 root.append(form);root.scrollIntoView({behavior:"smooth",block:"start"});
}
const dashboardPanel=make("section",undefined,"cc-native-dashboard");
dashboardPanel.innerHTML='<div class="cc-native-head"><div><h2>Trabalho diário</h2>'+
 '<p class="cc-lead">Negociações e follow-ups registados na plataforma, independentes dos Sheets.</p></div>'+
 '<button type="button" class="cc-neutral" id="cc-native-dash-open">Abrir booking</button></div>'+
 '<div id="cc-native-dash-metrics" class="cc-native-metrics"></div>'+
 '<div id="cc-native-dash-body" class="cc-native-list"><p class="cc-lead">A consultar tarefas...</p></div>';
dashboard.appendChild(dashboardPanel);
$("cc-native-dash-open").onclick=()=>window.CaravelaControlApp?.openView("booking");
let partnerTasks=[],financeTasks=[];
async function loadFinanceTasks(){
 try{
  const response=await api("finance","GET");
  const body=await response.json();
  if(response.ok&&body.ok){financeTasks=body.records||[];renderDashboard()}
 }catch{}
}
async function loadPartnerTasks(){
 try{
  if(!window.CaravelaPartnershipTransport)return;
  const response=await window.CaravelaPartnershipTransport.request("GET");
  const data=await response.json();
  if(response.ok&&data.ok){partnerTasks=data.partners||[];renderDashboard();}
 }catch{} // Not an authorization grant; booking and contacts remain available.
}
const localToday=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function displayHistoricalAction(item){
 window.CaravelaControlApp?.openView("booking");
 const toggle=$("cc-native-booking-history-wrap")?.closest("details");if(toggle)toggle.open=true;
 const search=$("cc-native-history-search");
 if(search){search.value=item.name;search.dispatchEvent(new Event("input"))}
 $("cc-native-booking-history-wrap")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderDashboard(){
 const root=$("cc-native-dash-body"),metrics=$("cc-native-dash-metrics");
 if(!root||!metrics)return;
 root.replaceChildren();metrics.replaceChildren();
 const today=localToday();
 const d=new Date(today+"T12:00:00Z");
 const monday=new Date(d);monday.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 const week=days=>{const x=new Date(monday);x.setUTCDate(x.getUTCDate()+days);return x.toISOString().slice(0,10)};
 const weekEnd=week(7),nextEnd=week(14);
 const live=get("booking"),tasks=[];
 const active=live.filter(x=>!["declined","closed"].includes(x.stage));
 const normalized=x=>lower(x).normalize("NFD").replace(/\p{M}/gu,"").replace(/[^a-z0-9]+/g," ").trim();
 const liveKeys=new Set(live.map(x=>normalized(x.contact_name)+"|"+normalized(x.artist)));
 for(const x of active){
  if(x.due_date)tasks.push({date:x.due_date,title:x.contact_name+" · "+x.artist,
   note:x.next_step||"Rever negociação",source:"booking",priority:x.priority,
   followup:["sent_verified","reply_reported","negotiating","contact_reported"].includes(x.stage),
   click:()=>{window.CaravelaControlApp?.openView("booking");edit("booking",x)}});
  if(x.stage==="confirmed"&&x.event_date&&(!x.press_status||x.press_status==="unknown"))
   tasks.push({date:x.event_date,title:x.contact_name+" · "+x.artist,
    note:"Verificar necessidade de imprensa para o concerto",source:"booking",priority:x.priority,
    click:()=>{window.CaravelaControlApp?.openView("booking");edit("booking",x)}});
 }
 for(const row of state.actions){
  const due=row.next_action_iso||row.next_followup_iso;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due||""))continue;
  if(row.contact_policy==="blocked"||row.no_outreach||
    /não avançar|nao avancar|bloquead|não contactar|nao contactar/i.test(row.status||""))continue;
  // First-contact leads have their own prospecting queue, never a follow-up.
  if(!/^(Enviado|Em conversa|Em negociação)$/i.test(row.status||""))continue;
  if(liveKeys.has(normalized(row.name)+"|"+normalized(row.artist)))continue;
  tasks.push({date:due,title:row.name+" · "+(row.artist||"projeto a confirmar"),
   note:row.next_step||"Rever ação antiga",source:"arquivo",
   priority:/^A\b/i.test(row.priority||"")?"high":"medium",
   followup:!/^Por contactar$/i.test(row.status||""),
   click:()=>displayHistoricalAction(row)});
 }
 for(const x of contactRows()){
  if(!x.review_date||x.contact_policy==="blocked")continue;
  tasks.push({date:x.review_date,title:x.name,
   note:x.next_step||"Rever entidade e verificar se deve ser contactada",
   source:"contacto",priority:"medium",
   click:()=>{window.CaravelaControlApp?.openView("contacts");edit("contacts",x)}});
 }
 for(const row of financeTasks){
  if(!row.due_date||["settled","cancelled"].includes(row.status))continue;
  const due=row.status==="due";
  tasks.push({date:row.due_date,title:row.title+" · "+(row.artist||"Caravela"),
   note:(due?"Pagamento a tratar":"Valor previsto")+" · "+row.type+
    " · "+Number(row.amount).toLocaleString("pt-PT",{style:"currency",currency:"EUR"}),
   source:"financeiro",priority:due?"high":"medium",click:()=>window.CaravelaControlApp?.openView("finance")});
 }
 for(const p of partnerTasks){
  if(!p.next_review_iso||["closed","confirmed"].includes(p.stage))continue;
  tasks.push({date:p.next_review_iso,title:p.name,
   note:p.next_step||"Rever proposta de parceria",source:"parceria",priority:p.priority==="alta"?"high":"medium",
   click:()=>{window.CaravelaControlApp?.openView("partnerships");
     const search=$("cc-partners-search");if(search){search.value=p.name;search.dispatchEvent(new Event("input"))}}});
 }
 // Plan review-only work for the coming two weeks from genuinely old archived
 // follow-ups. This is a recommendation, not a fabricated scheduled deadline.
 const oldArchive=tasks.filter(x=>x.source==="arquivo"&&x.date<today);
 oldArchive.sort((a,b)=>Number(b.priority==="high")-Number(a.priority==="high")||
   b.date.localeCompare(a.date)||a.title.localeCompare(b.title,"pt-PT"));
 oldArchive.slice(0,12).forEach(x=>{x.suggestedWeek="this"});
 oldArchive.slice(12,24).forEach(x=>{x.suggestedWeek="next"});
 tasks.sort((a,b)=>a.date.localeCompare(b.date)||
   (a.priority==="high"?-1:0)-(b.priority==="high"?-1:0));
 const followupTasks=tasks.filter(x=>x.followup);
 const followupSection=make("section",undefined,"cc-followup-section");
 const followupHeading=make("div",undefined,"cc-followup-heading");
 followupHeading.append(make("h3","Follow-ups · negociação"),
  make("p","Mensagens já trocadas ou propostas em andamento. Rever a conversa antes de insistir.","cc-lead"));
 followupSection.append(followupHeading);
 const followupGroups=[
  {label:"Vencidos",icon:"!",entries:followupTasks.filter(x=>x.date<today&&!x.suggestedWeek)},
  {label:"Para esta semana",icon:"↗",entries:followupTasks.filter(x=>x.suggestedWeek==="this"||(x.date>=today&&x.date<weekEnd))},
  {label:"Próxima semana",icon:"→",entries:followupTasks.filter(x=>x.suggestedWeek==="next"||(x.date>=weekEnd&&x.date<nextEnd))}
 ];
 const followupMetrics=make("div",undefined,"cc-followup-cards");
 for(const group of followupGroups){
  const card=make("div",undefined,"cc-followup-card");
  card.append(make("span",group.icon,"cc-followup-symbol"),make("strong",String(group.entries.length)),
    make("small",group.label));
  if(group.entries.length){
   const b=make("button","Ver "+Math.min(5,group.entries.length)+" prioritários","cc-neutral");b.type="button";
   b.onclick=()=>{const d=card.querySelector("details");if(d)d.open=!d.open};
   card.append(b);
   const details=make("details");details.append(make("summary","Entidades"));
   for(const x of group.entries.slice(0,5)){
    const link=make("button",x.title,"cc-native-dash-task");link.type="button";link.onclick=x.click;details.append(link);
   }
   card.append(details);
  }
  followupMetrics.append(card);
 }
 followupSection.append(followupMetrics);
 root.append(followupSection);
 // First-contact leads are not follow-ups and require individual research.
 const prospects=state.actions.filter(x=>/^Por contactar$/i.test(x.status||"")&&
  !x.no_outreach&&x.contact_policy!=="blocked"&&!liveKeys.has(normalized(x.name)+"|"+normalized(x.artist)));
 prospects.sort((x,y)=>Number(/^A\b/i.test(y.priority||""))-Number(/^A\b/i.test(x.priority||""))||
  x.name.localeCompare(y.name,"pt-PT"));
 const prospectsBox=make("section",undefined,"cc-pipeline-prospects");
 prospectsBox.append(make("h3","Novas oportunidades · investigar"),
  make("p",prospects.length+" entradas históricas «Por contactar». Validar programação, encaixe artístico e restrições antes de enviar.","cc-lead"));
 const prospectList=make("div",undefined,"cc-prospect-list");
 for(const x of prospects.slice(0,8)){
  const button=make("button",undefined,"cc-prospect-item");button.type="button";
  button.append(make("strong",x.name),make("span",(x.artist||"Artista a confirmar")+
    " · "+(x.next_step||"Preparar abordagem")+" · Fonte: arquivo, não enviado"));
  button.onclick=()=>displayHistoricalAction(x);prospectList.append(button);
 }
 if(!prospects.length)prospectList.append(make("p","Sem oportunidades históricas por verificar.","cc-lead"));
 prospectsBox.append(prospectList);root.append(prospectsBox);
 const sections=[
  {label:"Backlog em atraso · por revalidar",description:"Prazos históricos ainda sem triagem atribuída. Não pressupõem falta de resposta.",test:x=>x.date<today&&!x.suggestedWeek},
  {label:"Esta semana · prioridades sugeridas",description:"Tarefas realmente agendadas e até 12 revisões antigas selecionadas automaticamente. Não são novos envios.",test:x=>(x.date>=today&&x.date<weekEnd)||x.suggestedWeek==="this"},
  {label:"Próxima semana · preparação",description:"Prazos reais e até 12 revisões antigas propostas para a semana seguinte.",test:x=>(x.date>=weekEnd&&x.date<nextEnd)||x.suggestedWeek==="next"}
 ];
 const undated=active.filter(x=>!x.due_date);
 const partnersUndated=partnerTasks.filter(x=>!x.next_review_iso&&!["closed","confirmed","paused"].includes(x.stage));
 const paymentsUndated=financeTasks.filter(x=>x.status==="due"&&!x.due_date);
 const stats=[["A rever",tasks.filter(sections[0].test).length],
  ["Esta semana",tasks.filter(sections[1].test).length],
  ["Próxima semana",tasks.filter(sections[2].test).length],
  ["Sem prazo",undated.length]];
 for(const [label,count] of stats){
  const cell=make("div",undefined,"cc-native-metric");
  cell.append(make("small",label),make("strong",count));metrics.append(cell);
 }
 for(const section of sections){
  const items=tasks.filter(section.test),box=make("section",undefined,"cc-agenda-section");
  box.append(make("h3",section.label+" · "+items.length),make("p",section.description,"cc-lead"));
  if(!items.length)box.append(make("p","Sem ações datadas neste período.","cc-agenda-empty"));
  for(const entry of items.slice(0,16)){
   const action=make("button",undefined,"cc-native-dash-task");
   action.type="button";
   action.append(make("strong",entry.title),make("span",
    (entry.suggestedWeek?"Triagem sugerida (prazo antigo "+entry.date+")":"Prazo "+entry.date)+
    " · "+entry.note+" · "+({arquivo:"Arquivo — por confirmar",contacto:"Contacto",booking:"Booking",parceria:"Parceria",financeiro:"Finanças"}[entry.source]||entry.source)));
   if(entry.date<today)action.classList.add("cc-native-overdue");
   action.onclick=entry.click;box.append(action);
  }
  if(items.length>16)box.append(make("p","+"+(items.length-16)+
   " ações adicionais. Usa Booking ou Contactos para consultar todas; os prazos antigos são apenas candidatos a reavaliação.","cc-lead"));
  root.append(box);
 }
 const future=tasks.filter(x=>x.date>=nextEnd);
 if(future.length){
  const box=make("details",undefined,"cc-archive-toggle");
  box.append(make("summary","Mais à frente · "+future.length+" ações programadas"));
  for(const x of future.slice(0,20)){
   const btn=make("button",x.date+" · "+x.title,"cc-native-dash-task");
   btn.type="button";btn.onclick=x.click;box.append(btn);
  }
  root.append(box);
 }
 if(paymentsUndated.length){
  const box=make("details",undefined,"cc-archive-toggle");
  box.append(make("summary","Pagamentos pendentes sem vencimento · "+paymentsUndated.length));
  for(const p of paymentsUndated.slice(0,15)){
   const link=make("button",p.title+" · "+Number(p.amount).toLocaleString("pt-PT",{style:"currency",currency:"EUR"}),"cc-native-dash-task");
   link.type="button";link.onclick=()=>window.CaravelaControlApp?.openView("finance");box.append(link);
  }
  root.append(box);
 }
 if(partnersUndated.length){
  const box=make("details",undefined,"cc-archive-toggle");
  box.append(make("summary","Parcerias sem próximo prazo · "+partnersUndated.length));
  box.append(make("p","Associa uma data depois de verificares o último contacto; não inventamos follow-ups.","cc-lead"));
  for(const x of partnersUndated.slice(0,14)){
   const btn=make("button",x.name+" · "+x.next_step,"cc-native-dash-task");btn.type="button";
   btn.onclick=()=>{
    window.CaravelaControlApp?.openView("partnerships");
    const q=$("cc-partners-search");if(q){q.value=x.name;q.dispatchEvent(new Event("input"))}
   };box.append(btn);
  }
  root.append(box);
 }
 if(undated.length){
  const box=make("details",undefined,"cc-archive-toggle");
  box.append(make("summary","Negociações sem próxima data · "+undated.length));
  for(const x of undated.slice(0,15)){
   const btn=make("button",x.contact_name+" · "+x.artist,"cc-native-dash-task");
   btn.type="button";btn.onclick=()=>{window.CaravelaControlApp?.openView("booking");edit("booking",x)};box.append(btn);
  }
  root.append(box);
 }
 const artistSection=make("section",undefined,"cc-agenda-artists");
 artistSection.append(make("h3","O que se passa com os artistas"));
 const profiles=[["WILDCHAINS",/wildchains/i],["Devil of a Woman",/devil\s*(of a woman)?/i]];
 for(const [label,re] of profiles){
  const belonging=live.filter(x=>re.test(x.artist||""));
  const old=state.actions.filter(x=>re.test(x.artist||"")&&!/bloquead|não avançar/i.test(x.status||""));
  const box=make("article",undefined,"cc-agenda-artist");
  box.append(make("strong",label),make("p",belonging.filter(x=>!["declined","closed","confirmed"].includes(x.stage)).length+
   " negociações atuais · "+belonging.filter(x=>x.stage==="confirmed").length+
   " confirmadas · "+old.length+" ações no arquivo (a revalidar)"));
  box.append(make("p",label==="WILDCHAINS"?
   "Heavy / Alternative Rock · 50+ concertos, Lugo/Madrid e Festas d’Amares. Prioridade: festivais estratégicos, Espanha/França e Japão 2027. Booking: 15%.":
   "Blues Rock · Concurso António Barge / Vilar 2026 e Tomate Blues (Espanha). Prioridade: circuito PT/ES e double bills seletivos. Booking: 15%.","cc-lead"));
  const btn=make("button","Abrir booking","cc-neutral");btn.type="button";btn.onclick=()=>window.CaravelaControlApp?.openView("booking");
  box.append(btn);artistSection.append(box);
 }
 const other=live.filter(x=>!profiles.some(([,re])=>re.test(x.artist||"")));
 const more=make("details",undefined,"cc-archive-toggle");
 more.append(make("summary","Outros projetos · "+other.length));artistSection.append(more);root.append(artistSection);
}
function onOpened(event){
 const view=event.detail?.view;
 if(view==="contacts"||view==="booking"){
  loadArchive();load(view==="contacts"?"contacts":"booking");
  if(view==="booking")renderHistory();
 } else if(view==="dashboard"){loadArchive();load("contacts");load("booking");void loadPartnerTasks();void loadFinanceTasks()}
}
window.addEventListener("caravela-control-view-opened",onOpened);
window.addEventListener("caravela-control-token-ready",()=>{
 loadArchive();load("contacts");load("booking");void loadPartnerTasks();void loadFinanceTasks();
});
window.addEventListener("caravela-crm-imported",event=>{
 archiveLoaded=true;
 state.historical=event.detail?.manifest?.entities||[];
 state.actions=event.detail?.manifest?.actions||[];
 updateGeoFilters();
 render("contacts");render("booking");renderDashboard();
});
window.addEventListener("caravela-control-contact-action",async event=>{
 const action=event.detail?.action;
 window.CaravelaControlApp?.openView("contacts");
 // Review results can load ahead of the native archive on a cold session.
 // Resolve entity IDs against the actual workspace before editing.
 await loadArchive();
 await load("contacts");
 if(action==="open"||action==="approve"){
  const contact=contactRows().find(x=>x.id===event.detail?.id);
  if(contact&&action==="approve"&&contact.contact_policy!=="blocked"){
   const addr=String(event.detail?.email||"").toLowerCase();
   const thread=String(event.detail?.thread_id||"");
   if((contact.emails||[]).some(e=>lower(e)===addr)&&thread){
    edit("contacts",{...contact,contact_policy:"allowed",
      authorization_source:"zoho_thread",authorization_email:addr,
      authorization_reference:thread});
    return;
   }
  }
  if(contact)edit("contacts",contact);
  return;
 }
 const addr=String(event.detail?.email||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr))return;
 if(action==="new"){
  edit("contacts",{name:"",kind:"other",emails:[addr],country:"",city:"",
   contact_policy:"review",relationship:"unknown",
   source_label:"Sugestão pendente — endereço observado nos metadados Zoho",
   notes:"A categoria, entidade e autorização de contacto exigem validação."});
  return;
 }
 if(action!=="attach")return;
 const panel=$("cc-native-contacts-editor");panel.hidden=false;panel.replaceChildren();
 const container=make("div",undefined,"cc-native-form");
 container.append(make("h3","Associar email a uma entidade existente"),
  make("p","Seleciona uma entidade pelo nome. O endereço só será acrescentado quando guardares a ficha; não valida nem autoriza o envio.","cc-lead"));
 const search=make("input");search.type="search";search.placeholder="Pesquisar entidade pelo nome, cidade ou país";
 search.setAttribute("aria-label","Pesquisar entidade para associação");
 const matches=make("div",undefined,"cc-review-matches");
 const refresh=()=>{
  const q=lower(search.value);matches.replaceChildren();
  if(q.length<2){matches.append(make("p","Escreve pelo menos dois caracteres para procurar.","cc-lead"));return}
  const found=contactRows().filter(x=>lower([x.name,x.city,x.country].join(" ")).includes(q)).slice(0,14);
  if(!found.length)matches.append(make("p","Nenhuma entidade encontrada. Não cries duplicados sem confirmar.","cc-lead"));
  for(const x of found){
   const button=make("button",x.name+(x.city?" · "+x.city:""),"cc-neutral");button.type="button";
   button.onclick=()=>{
    if((x.emails||[]).includes(addr)){edit("contacts",x);return}
    if((x.emails||[]).length>=15){matches.replaceChildren(make("p","A ficha atingiu o limite de endereços. Revê antes de alterar.","cc-lead"));return}
    edit("contacts",{...x,emails:[...(x.emails||[]),addr]});
   };matches.append(button);
  }
 };
 search.oninput=refresh;
 const cancel=make("button","Cancelar","cc-neutral");cancel.type="button";cancel.onclick=()=>{panel.hidden=true;panel.replaceChildren()};
 container.append(search,matches,cancel);panel.append(container);refresh();
 panel.scrollIntoView({behavior:"smooth",block:"start"});search.focus();
});
window.addEventListener("caravela-control-signed-out",()=>{
 archiveLoaded=false;archiveBusy=false;archivePromise=null;
 mergeSelection.clear();
 state.saved={contacts:[],booking:[]};state.historical=[];state.actions=[];
 render("contacts");render("booking");renderDashboard();
});
render("contacts");render("booking");renderDashboard();
})();
