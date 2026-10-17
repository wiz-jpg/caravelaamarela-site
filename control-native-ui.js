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
  ["owner","Responsável Caravela","text"],["next_step","Próximo passo","textarea"],["review_date","Rever em","date"],
  ["contact_window_start","Janela anual · início (MM-DD)","text"],
  ["contact_window_end","Janela anual · fim (MM-DD)","text"],
  ["contact_window_basis","Fundamento da janela","select"],
  ["contact_window_target","Ano de aplicação da janela","select"],
  ["contact_window_reason","Porquê esta altura?","textarea"],
  ["contact_window_reference","Fonte / email / link de prova","text"],
  ["notes","Notas internas","textarea"]
];
const BOOKING_FIELDS=[
  ["contact_name","Entidade / promotor","text",true],["contact_id","Associar a contacto","select"],
  ["artist","Artista","text",true],["subject","Proposta / evento","text",true],
  ["booking_year","Ano do concerto","select"],["booking_category","Tipo de oportunidade","select"],
  ["stage","Estado","select",true],["priority","Prioridade","select",true],
  ["contact_email","Email operacional","email"],
  ["fee_basis","Base do cachet","select"],
  ["fee_amount","Cachet da banda / valor histórico (€)","number"],
  ["commission_pct","Comissão de referência (%)","number"],
  ["commission_mode","Condições da comissão","select"],
  ["promoter_total_amount","Total proposto ao promotor (€)","number"],
  ["commercial_exception_note","Justificação da exceção","textarea"],
  ["billing_person","Responsável pela faturação individual (previsto)","select"],
  ["fit_level","Encaixe artístico (avaliação humana)","select"],
  ["strategic_reason","Principal valor estratégico","select"],
  ["fit_reason","Fundamentação do encaixe / relevância","textarea"],
  ["event_date","Data prevista do concerto","date"],
  ["press_status","Estado de comunicação / imprensa","select"],["press_reference","Referência de imprensa / divulgação","text"],
  ["advance_status","Preparação técnica / advancing","select"],
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
 advance_status:{unknown:"Por verificar",planned:"Em preparação",ready:"Pronto / validado pela equipa",not_applicable:"Não aplicável"},
 contact_policy:{review:"Rever antes de contactar",allowed:"Contacto autorizado",blocked:"Não contactar"},
 relationship:{unknown:"Por classificar",partner:"Parceria existente",target:"Queremos colaborar",in_discussion:"Em conversa",former:"Parceria anterior",not_applicable:"Não aplicável"},
 authorization_source:{none:"Sem prova confirmada",zoho_thread:"Conversa Zoho de ida e volta — verificar no servidor"},
 stage:{research:"Por avaliar",draft:"Proposta por preparar",contact_reported:"Contacto referido (não verificado)",
   sent_verified:"Envio verificado",reply_reported:"Resposta referida",negotiating:"Em negociação",
   confirmed:"Confirmado",declined:"Recusado",paused:"Em pausa",closed:"Concluído"},
 priority:{high:"Alta",medium:"Média",low:"Baixa"},
 fee_basis:{legacy_unspecified:"Valor antigo · base por confirmar",artist_base:"Valor pretendido pela banda (antes da comissão)"},
 commission_mode:{unspecified:"Por definir",standard:"Comissão adicionada ao cachet da banda",exception:"Condições excecionais aprovadas"},
 billing_person:{unassigned:"Por definir",sergio:"Sérgio · atividade individual",ana:"Ana · atividade individual"},
 fit_level:{unreviewed:"Por avaliar",strong:"Bom encaixe (avaliado)",possible:"Possível encaixe",weak:"Baixa adequação"},
 strategic_reason:{none:"Ainda não definido",prestige:"Prestígio",new_territory:"Novo território",territory_consolidation:"Consolidar território",industry_contacts:"Contactos profissionais",event_relevance:"Relevância do evento"},
 contact_window_basis:{unknown:"Ainda por investigar",official:"Calendário / candidatura oficial",direct:"Informação recebida do organizador",history:"Padrão histórico registado",hypothesis:"Hipótese a confirmar"},
 contact_window_target:{unknown:"Por confirmar · não determina urgência",same_year:"No ano do concerto",prior_year:"No ano anterior ao concerto"},
 booking_year:{"":"Ano por classificar","2026":"2026","2027":"2027","2028":"2028","2029":"2029","2030":"2030","2031":"2031"},
 booking_category:{unknown:"Por classificar",festival:"Festival",venue:"Venue / sala",other:"Outro evento"},
 evidence_type:{none:"Sem comprovativo",user_report:"Registo manual / relato",
   sent_message:"Email enviado — verificado",received_message:"Email recebido — verificado",
   agreement:"Contrato / acordo verificado"}
};
const state={historical:[],actions:[],saved:{contacts:[],booking:[]},busy:false,shown:{contacts:40,booking:30}};
let boardYear=2027;
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
   source_status:x.status_2027||"",owner:x.owner||""};
}
function contactRows(){
 const map=new Map(state.historical.map(x=>[x.id,historicalContact(x)]));
 for(const entry of get("contacts"))map.set(entry.id,{...map.get(entry.id),...entry,historical:!!map.get(entry.id)});
 const rows=[...map.values()].sort((a,b)=>lower(a.name).localeCompare(lower(b.name),"pt-PT"));
 byId.clear();rows.forEach(x=>byId.set(x.id,x));return rows;
}
function nativeRows(kind){return kind==="contacts"?contactRows():get("booking").slice()}
function displayWindowDate(value){
 return /^\d{2}-\d{2}$/.test(value||"")?value.slice(3,5)+"/"+value.slice(0,2):"";
}
function storeWindowDate(value){
 const match=/^(\d{2})\/(\d{2})$/.exec(String(value||"").trim());
 return match?match[2]+"-"+match[1]:"";
}
function windowInfo(contact){
 const tool=window.CaravelaContactWindow;
 if(!tool)return {status:"unknown",label:"Janela por pesquisar"};
 return tool.annualWindow(contact,localToday());
}
function windowDescription(contact){
 const w=windowInfo(contact);
 if(w.status==="unknown")return "Por pesquisar · sem calendário validado";
 const source=({
   official:"Fonte oficial",direct:"Resposta do organizador",
   history:"Padrão histórico",hypothesis:"Hipótese — confirmar antes de usar"
 })[contact.contact_window_basis]||"Por validar";
 return w.label+" · "+source;
}
function isWindowEligible(contact){
 return contact.contact_policy!=="blocked"&&!contact.source_suppressed&&
   !contact.source_shared_email&&contact.duplicate_decision!=="secondary"&&!contact.canonical_id;
}
/* Never derive an opportunity location from a shared/ambiguous name. */
function bookingLocation(entry){
 const contacts=contactRows(),linked=entry.contact_id?
  contacts.filter(x=>x.id===entry.contact_id):
  contacts.filter(x=>lower(x.name)===lower(entry.contact_name));
 if(linked.length!==1)return "Por confirmar";
 return [linked[0].city,linked[0].region,linked[0].country].filter(Boolean).join(" · ")||"Por confirmar";
}
function bookingTone(stage){
 if(stage==="confirmed")return "confirmed";
 if(stage==="negotiating"||stage==="reply_reported")return "negotiating";
 if(stage==="sent_verified"||stage==="contact_reported")return "contacted";
 if(stage==="declined")return "declined";
 if(stage==="paused"||stage==="closed")return "paused";
 return "prospect";
}
function colorLegend(){
 const details=make("details",undefined,"cc-status-legend");
 const summary=make("summary","Legenda dos estados");details.append(summary);
 const list=make("div",undefined,"cc-status-legend-list");
 for(const [tone,title,explanation] of [
  ["confirmed","Confirmado","Acordo validado"],
  ["negotiating","Em negociação","Resposta ou conversa a acompanhar"],
  ["contacted","Contactado","Envio ou contacto registado; verificar evidência"],
  ["prospect","Por contactar","Pesquisa e preparação"],
  ["declined","Recusado","Proposta sem avanço"],
  ["paused","Em pausa","Aguarda nova decisão"]
 ]){
  const item=make("span",undefined,"cc-status-legend-item cc-tone-"+tone);
  item.append(make("strong",title),make("small",explanation));list.append(item);
 }
 details.append(list,make("p","Urgência e prazo são indicadores separados da cor do estado. Nunca deduzimos uma confirmação a partir de um email.","cc-lead"));
 return details;
}
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
  const batchTools=make("details",undefined,"cc-archive-toggle cc-mail-merge-toggle");
  batchTools.append(make("summary","Ferramentas de seleção e exportação CSV"));
  batchTools.append(basket);
  geo.after(batchTools);
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
 const opts=kind==="contacts"?{
  all:"Todos",window_open:"Janela aberta agora",window_soon:"Abre nos próximos 30 dias",
  window_missing:"Janela por pesquisar",...choices.contact_policy
 }:{all:"Todos",due:"Follow-ups vencidos",...choices.stage};
 for(const [key,label] of Object.entries(opts)){const el=make("option",label);el.value=key;filter.append(el)}
 filter.onchange=()=>{state.shown[kind]=kind==="contacts"?40:30;render(kind)};
 root.querySelector("#cc-native-"+kind+"-more").onclick=()=>{state.shown[kind]+=40;render(kind)};
 return root;
}
contactView.querySelector(".cc-panel-head")?.after(build("contacts","Fichas operacionais"));
const bookingLegacy=build("booking","Registos e edição detalhada");
const bookingAdvanced=make("details",undefined,"cc-booking-advanced");
bookingAdvanced.append(make("summary","Base completa, pesquisa e edição detalhada"),bookingLegacy);
bookingView.querySelector(".cc-panel-head")?.after(bookingAdvanced);
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
   if(["window_open","window_soon","window_missing"].includes(filter)){
     const w=windowInfo(r);
     if(filter==="window_open"&&!(w.status==="open"&&isWindowEligible(r)))return false;
     if(filter==="window_soon"&&!(w.status==="soon"&&isWindowEligible(r)))return false;
     if(filter==="window_missing"&&w.status!=="unknown")return false;
   }else if(filter!=="all"&&r.contact_policy!==filter)return false;
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
    r.contact_email,r.notes,r.next_step,r.owner,
    r.contact_window_reason,r.contact_window_reference].filter(Boolean).join(" ")).includes(term);
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
  const mapped=rows.filter(x=>windowInfo(x).status!=="unknown").length;
  $("cc-native-contacts-summary").textContent=rows.length+" fichas preservadas · "+
   all.length+" neste filtro · "+mapped+" com janela anual registada · "+saved+
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
  if(kind==="booking")card.classList.add("cc-tone-"+bookingTone(r.stage));
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
   hint(card,"Localização",bookingLocation(r));
   hint(card,"Último contacto",r.last_contact_date||"Não registado");
   hint(card,"Próximo passo",r.next_step||"Por definir");
   hint(card,"Responsável",r.owner||"Por atribuir");
   hint(card,"Rever",r.due_date||"Sem prazo definido");
   const more=make("details",undefined,"cc-booking-more");
   more.append(make("summary","Detalhes da oportunidade"));
   hint(more,"Proposta",r.subject);
   const money=value=>Number(value).toLocaleString("pt-PT",{style:"currency",currency:"EUR"});
   const artistBasis=r.fee_basis==="artist_base";
   hint(more,artistBasis?"Cachet pretendido pela banda":"Cachet registado (base por confirmar)",
     r.fee_amount===null?"Não definido":money(r.fee_amount));
   if(artistBasis&&r.fee_amount!==null){
    const total=r.promoter_total_amount;
    if(total!==null&&total!==undefined){
     hint(more,"Total registado para promotor",money(total));
     hint(more,"Margem de booking prevista",money(Math.round((total-r.fee_amount)*100)/100)+" · não recebida");
    }else if(r.commission_mode==="standard"&&r.commission_pct!==null&&r.commission_pct!==undefined){
     const commission=Math.round(r.fee_amount*100*r.commission_pct/100)/100;
     hint(more,"Proposta calculada (não acordada)",money(r.fee_amount+commission));
     hint(more,"Comissão prevista",money(commission)+" · não recebida");
    }
   }else if(r.fee_amount!==null){
    hint(more,"Comissão","Por verificar: registo antigo sem identificação da base de cálculo");
   }
   hint(more,"Condições comerciais",choices.commission_mode[r.commission_mode||"unspecified"]);
   if(r.commercial_exception_note)hint(more,"Exceção comercial",r.commercial_exception_note);
   hint(more,"Faturação individual prevista",choices.billing_person[r.billing_person||"unassigned"]);
   hint(more,"Encaixe artístico",choices.fit_level[r.fit_level||"unreviewed"]);
   if(r.strategic_reason&&r.strategic_reason!=="none")
    hint(more,"Valor estratégico",choices.strategic_reason[r.strategic_reason]);
   if(r.fit_reason)hint(more,"Avaliação fundamentada",r.fit_reason);
   hint(more,"Data do concerto",r.event_date||"Sem data");
   hint(more,"Comunicação / imprensa",choices.press_status[r.press_status||"unknown"]);
   hint(more,"Preparação técnica",choices.advance_status[r.advance_status||"unknown"]);
   hint(more,"Evidência",(choices.evidence_type[r.evidence_type]||"")+" · "+(r.evidence_reference||"não referenciada"));
   hint(more,"Origem",r.origin_label);
   card.append(more);
  } else {
   hint(card,"Tipo / local",((choices.kind[r.kind]||"")+" · "+[r.city,r.region,r.country].filter(Boolean).join(", ")));
   hint(card,"Melhor altura",windowDescription(r));
   const contactMore=make("details",undefined,"cc-contact-more");
   contactMore.append(make("summary","Detalhes e histórico"));
   hint(contactMore,"Responsável Caravela",r.owner||"Por atribuir");
   if(r.contact_window_start&&r.contact_window_reason)
     hint(contactMore,"Motivo da janela",r.contact_window_reason);
   if(r.contact_window_start)hint(contactMore,"Ano da janela",choices.contact_window_target[r.contact_window_target||"unknown"]);
   if(r.__members?.length)hint(contactMore,"Fichas agrupadas",
     r.__members.length+" registos históricos/operacionais apresentados em conjunto, sem fusão");
   hint(contactMore,"Emails",r.emails?.join(", ")||"Sem endereço");
   if(r.authorization_source==="zoho_thread")
    hint(contactMore,"Relação comprovada","Conversa bilateral Zoho · "+r.authorization_email+" (não equivale a consentimento para campanhas)");
   const formPreferred=!!r.source_form_url&&/formul[aá]rio/i.test(r.source_channel_quality||"");
   if(formPreferred)hint(contactMore,"Canal preferencial no arquivo","Formulário web (confirmar se continua ativo): "+r.source_form_url);
   const route=suggestedChannel(r);
   if(route&&!formPreferred)hint(contactMore,"Canal a validar",route.email+" · "+route.reason+" (sugestão; envio não autorizado)");
   else if(!formPreferred&&r.emails?.length)hint(contactMore,"Canal para proposta","Nenhum email adequado identificado; rever contacto");
   if(r.media_type)hint(contactMore,"Meio de comunicação",r.media_type);
   if(r.people?.length)hint(contactMore,"Interlocutores",r.people.map(p=>p.name+(p.role?" · "+p.role:"")).join("; "));
   if(r.source_contact_person&&!r.people?.length)hint(contactMore,"Interlocutor histórico (por rever)",r.source_contact_person);
   if(r.canonical_id)hint(contactMore,"Ficha associada a",byId.get(r.canonical_id)?.name||"entidade existente");
   if(r.linked_producer_ids?.length)hint(contactMore,"Produtora(s)",
     r.linked_producer_ids.map(id=>byId.get(id)?.name||"entidade associada").join("; "));
   if(r.organizer)hint(contactMore,"Organização histórica",r.organizer);
   if(r.source_recommendation)hint(contactMore,"Encaixe histórico",r.source_recommendation);
   if(r.source_suppressed)hint(contactMore,"Restrição","Suprimido no arquivo: não contactar");
   if(r.source_shared_email)hint(contactMore,"Contacto partilhado","Endereço usado por várias entidades: validar interlocutor");
   if(r.__members?.length){
    const kinds=[...new Set(r.__members.map(x=>x.media_type).filter(Boolean))];
    if(kinds.length)hint(contactMore,"Canais registados",kinds.join(" / "));
   }
   if(r.relationship&&r.relationship!=="unknown")hint(contactMore,"Relação",choices.relationship[r.relationship]);
   hint(contactMore,"Próximo passo",r.next_step);
   hint(contactMore,"Rever",r.review_date);
   if(r.historical)hint(contactMore,"Origem","Arquivo original — registo separado de alterações");

   card.append(contactMore);  }
  const actions=make("div",undefined,"cc-native-card-actions");
  const button=make("button",r.revision?"Atualizar":"Editar ficha","cc-neutral");
  button.type="button";button.onclick=()=>edit(kind,r.__members?.find(x=>x.id===r.id)||r);actions.append(button);
  if(kind==="booking"){
    const draftButton=make("button","Preparar email","cc-neutral");draftButton.type="button";
    draftButton.onclick=()=>window.dispatchEvent(new CustomEvent("caravela-control-draft-compose",{
      detail:{to:r.contact_email||"",artist:r.artist||"",booking_id:r.id||"",
        subject:r.subject||"",context:"Oportunidade: "+r.contact_name+
        ". Validar destinatário, condições e histórico antes de qualquer envio."}
    }));
    actions.append(draftButton);
  }
  if(kind==="contacts"){
   const windowButton=make("button","Definir janela ideal","cc-neutral");windowButton.type="button";
   windowButton.onclick=()=>editContactWindow(r);
   actions.append(windowButton);
  }
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
   const contactDraft=make("button","Preparar email","cc-neutral");contactDraft.type="button";
   contactDraft.onclick=()=>window.dispatchEvent(new CustomEvent("caravela-control-draft-compose",{
     detail:{context:"Entidade: "+r.name+
       ". Contacto por verificar: confirmar endereço, restrições e oportunidade antes de enviar."}
   }));
   actions.append(contactDraft);
   const b=make("button","Nova proposta","cc-neutral");b.type="button";
   b.onclick=()=>{window.CaravelaControlApp?.openView("booking");edit("booking",{
     contact_name:r.name,contact_id:r.id,booking_year:String(boardYear),
     booking_category:["festival","venue"].includes(r.kind)?r.kind:"unknown",
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
const tools=make("details",undefined,"cc-archive-toggle cc-contact-admin-toggle");
tools.append(make("summary","Revisão de contactos e organização avançada"),triage);
contactView.querySelector("#cc-native-contacts")?.after(tools);
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
 if(key==="contact_window_start"||key==="contact_window_end"){
   field.placeholder="DD/MM · ex.: 01/03";field.maxLength=5;field.pattern="[0-9]{2}/[0-9]{2}";
   field.title="Indica dia e mês, por exemplo 01/03; o período repete-se anualmente.";
 }
 if(key==="contact_window_reference")field.placeholder="Link, email ou referência verificável";
 if(key==="emails")field.value=(current.emails||[]).join(", ");
 else if(["fee_amount","commission_pct","promoter_total_amount"].includes(key))
   field.value=current[key]===null||current[key]===undefined?"":current[key];
 else if(key==="contact_window_start"||key==="contact_window_end")
   field.value=displayWindowDate(current[key]);
 else field.value=current[key]??({
   kind:"venue",contact_policy:"review",authorization_source:"none",contact_window_basis:"unknown",contact_window_target:"unknown",stage:"research",priority:"medium",evidence_type:"none",press_status:"unknown"
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
function editContactWindow(entry){
 const source=entry.__members?.find(x=>x.id===entry.id)||entry;
 const root=$("cc-native-contacts-editor");
 if(!root)return;
 root.hidden=false;root.replaceChildren();
 const panel=make("form",undefined,"cc-window-editor");
 panel.append(make("h3","Altura ideal · "+source.name),
  make("p","Regista uma janela anual apoiada por evidência. Isto apenas sugere quando preparar o contacto; não autoriza emails.","cc-lead"));
 const fields=make("div",undefined,"cc-window-editor-grid");
 function input(label,tag,value){
  const box=make("label",label),el=make(tag);el.value=value||"";
  box.append(el);fields.append(box);return el;
 }
 const start=input("Desde (DD/MM)","input",displayWindowDate(source.contact_window_start));
 const end=input("Até (DD/MM)","input",displayWindowDate(source.contact_window_end));
 for(const el of [start,end]){
  el.type="text";el.placeholder="DD/MM";el.maxLength=5;el.pattern="[0-9]{2}/[0-9]{2}";
 }
 const basis=input("Como sabemos esta altura?","select",source.contact_window_basis||"unknown");
 for(const [value,label] of Object.entries(choices.contact_window_basis)){
  const option=make("option",label);option.value=value;basis.append(option);
 }
 basis.value=source.contact_window_basis||"unknown";
 const why=input("Porquê este período?","textarea",source.contact_window_reason);
 why.maxLength=360;why.rows=2;
 const ref=input("Fonte / resposta / referência","input",source.contact_window_reference);
 ref.type="text";ref.maxLength=450;ref.placeholder="URL, conversa Zoho ou nota de pesquisa";
 const target=input("Quando se abre esta janela relativamente ao concerto?","select","");
 for(const [key,label] of Object.entries(choices.contact_window_target)){
  const opt=make("option",label);opt.value=key;target.append(opt);
 }
 target.value=source.contact_window_target||"unknown";
 panel.append(fields);
 const actions=make("div",undefined,"cc-actions");
 const submit=make("button","Guardar janela","cc-primary");submit.type="submit";
 const clear=make("button","Sem janela comprovada","cc-neutral");clear.type="button";
 const cancel=make("button","Cancelar","cc-neutral");cancel.type="button";
 cancel.onclick=()=>{root.hidden=true;root.replaceChildren()};
 clear.onclick=()=>{start.value="";end.value="";basis.value="unknown";target.value="unknown";why.value="";ref.value=""};
 actions.append(submit,clear,cancel);panel.append(actions);
 const notice=make("p","","status");notice.setAttribute("role","status");panel.append(notice);
 panel.onsubmit=async event=>{
  event.preventDefault();if(state.busy)return;
  const left=storeWindowDate(start.value),right=storeWindowDate(end.value);
  const tool=window.CaravelaContactWindow;
  if((start.value||end.value)&&(!tool?.validMD(left)||!tool?.validMD(right))){
   notice.textContent="Datas inválidas. Indica DD/MM, por exemplo 01/03 e 14/03.";return;
  }
  if((left||right)&&(!why.value.trim()||basis.value==="unknown")){
   notice.textContent="Indica o fundamento e o motivo deste período.";return;
  }
  if((left||right)&&["official","direct"].includes(basis.value)&&!ref.value.trim()){
   notice.textContent="Indica a referência verificável da fonte oficial ou resposta direta.";return;
  }
  const record={...source,contact_window_start:left,contact_window_end:right,
   contact_window_basis:basis.value,contact_window_reason:why.value.trim(),
   contact_window_reference:ref.value.trim(),contact_window_target:left&&right?target.value:"unknown"};
  state.busy=true;submit.disabled=true;notice.textContent="A guardar no histórico...";
  try{
   const result=await api("contacts",source.revision?"PATCH":"POST",record);
   const body=await result.json();
   if(!result.ok)throw Error(({
    invalid_record:"Confirma as datas, origem e dados da ficha original.",
    historical_contact_blocked:"As restrições históricas são obrigatórias.",
    revision_conflict:"A ficha mudou noutra sessão. Atualiza antes de guardar."
   })[body.error]||body.error||"Não foi possível guardar");
   await load("contacts");
   window.dispatchEvent(new CustomEvent("caravela-control-contacts-updated"));
   root.hidden=true;root.replaceChildren();
  }catch(error){notice.textContent=error.message}
  finally{state.busy=false;submit.disabled=false}
 };
 root.append(panel);
 root.scrollIntoView({behavior:"smooth",block:"start"});
}
function edit(kind,entry={}){
 if(kind==="booking")bookingAdvanced.open=true;
 const root=$("cc-native-"+kind+"-editor"),form=make("form",undefined,"cc-native-form");
 root.hidden=false;root.replaceChildren();
 const title=make("h3",entry.revision?"Atualizar registo":"Novo registo operacional");
 const help=make("p",kind==="booking"?
  "Indica o próximo passo. Estados de envio ou confirmação exigem evidência concreta. O CRM não envia emails.":
  "Escolhe a altura anual para abordar esta entidade apenas quando houver evidência. Sem prova, assinala como hipótese. Nada será enviado automaticamente.","cc-lead");
 const fields=kind==="contacts"?CONTACT_FIELDS:BOOKING_FIELDS;
 const grid=make("div",undefined,"cc-field-grid");
 const defaults=kind==="booking"?{
  fee_basis:entry.revision?"legacy_unspecified":"artist_base",
  commission_mode:entry.revision?"unspecified":"standard",
  billing_person:"unassigned",fit_level:"unreviewed",strategic_reason:"none",
  booking_year:entry.revision?"":entry.event_date?entry.event_date.slice(0,4):String(boardYear),
  booking_category:"unknown"
 }:{};
 for(const def of fields)editorField(grid,kind,def,{...defaults,...entry});
 if(kind==="contacts"){
  const basis=grid.querySelector('[name="contact_window_basis"]');
  if(basis&&!basis.value)basis.value="unknown";
  grid.append(make("p","Ex.: 01/03 a 14/03 é 1–14 de março, todos os anos. Uma hipótese não entra na lista de recomendações. Fonte oficial ou resposta direta exigem uma referência.","cc-lead"));
 }
 if(kind==="booking"){
  const linkedContact=grid.querySelector('[name="contact_id"]'),category=grid.querySelector('[name="booking_category"]');
  if(linkedContact&&category)linkedContact.addEventListener("change",()=>{
   const linked=byId.get(linkedContact.value);
   if(linked&&["festival","venue"].includes(linked.kind))category.value=linked.kind;
  });
  const artist=grid.querySelector('[name="artist"]'),commission=grid.querySelector('[name="commission_pct"]');
  if(artist&&commission){
   const suggest=()=>{
    if(commission.value.trim())return;
    if(entry.revision)return; // Never introduce an assumed rate while editing old records.
    if(/^(wildchains|devil of a woman)$/i.test(artist.value.trim()))commission.value="15";
    else if(artist.value.trim())commission.value="20";
   };
   artist.addEventListener("blur",suggest);
   suggest();
   const h=make("p","Modelo de referência: 15% por cima do valor pretendido pelo roster, 20% para artistas externos. São sugestões; confirma sempre as condições com a banda. Valor histórico não é recalculado.","cc-lead");
   grid.append(h);
   const basis=grid.querySelector('[name="fee_basis"]'),
    base=grid.querySelector('[name="fee_amount"]'),
    mode=grid.querySelector('[name="commission_mode"]'),
    total=grid.querySelector('[name="promoter_total_amount"]'),
    exception=grid.querySelector('[name="commercial_exception_note"]');
   const estimate=make("p",undefined,"cc-lead");
   estimate.setAttribute("role","status");
   const refreshEstimate=()=>{
    const fee=base.value===""?null:Number(base.value);
    const pct=commission.value===""?null:Number(commission.value);
    const agreedTotal=total.value===""?null:Number(total.value);
    if(basis.value!=="artist_base"){
     estimate.textContent="Valor antigo: base de cálculo por identificar. Confirma o valor com a banda antes de mudar este campo.";
    }else if(fee===null||!Number.isFinite(fee)){
     estimate.textContent="Indica o cachet pretendido pela banda para calcular uma proposta.";
    }else if(mode.value==="standard"&&pct!==null&&Number.isFinite(pct)){
     const plus=Math.round(fee*100*pct/100)/100;
     estimate.textContent="Proposta de referência: "+(fee+plus).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})+
       " (banda "+fee.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})+
       " + comissão "+plus.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})+
       "). Ainda não é um valor acordado.";
    }else if(mode.value==="exception"){
     estimate.textContent=agreedTotal!==null&&Number.isFinite(agreedTotal)?
       "Exceção: margem prevista "+(agreedTotal-fee).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})+
       ". É necessária a aprovação das partes e uma justificação.":
       "Exceção comercial: define condições e fundamenta a decisão.";
    }else estimate.textContent="Comissão por definir; não será calculada automaticamente.";
    exception.closest("label").hidden=mode.value!=="exception";
   };
   for(const input of [basis,base,mode,total,exception,commission])
    input.addEventListener("input",refreshEstimate);
   refreshEstimate();
   grid.append(estimate);
   grid.append(make("p","Abaixo de 400 € de cachet artístico, assinala a razão estratégica e valida a exceção com a banda; nunca é um bloqueio automático. 'Faturação individual prevista' não significa fatura emitida.","cc-lead"));
  }
  const stage=grid.querySelector('[name="stage"]'),
    lastContact=grid.querySelector('[name="last_contact_date"]'),
    due=grid.querySelector('[name="due_date"]');
  if(stage&&lastContact&&due){
   // A recommendation must never become a persisted deadline without a click.
   const suggest=make("button","Escolher revisão em 7 dias","cc-neutral");
   suggest.type="button";
   suggest.onclick=()=>{
    if(due.value||!/^(sent_verified|reply_reported|negotiating)$/.test(stage.value)||
       !/^\d{4}-\d{2}-\d{2}$/.test(lastContact.value))return;
    const date=new Date(lastContact.value+"T12:00:00Z");
    if(Number.isNaN(date.getTime()))return;
    date.setUTCDate(date.getUTCDate()+7);
    const chosen=date.toISOString().slice(0,10);
    if(chosen>=localToday())due.value=chosen;
   };
   grid.append(suggest);
   grid.append(make("p","Opcional: podes escolher explicitamente uma revisão em 7 dias após contacto comprovado. Não inventamos prazos ao abrir a ficha.","cc-lead"));
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
   for(const key of ["contact_window_start","contact_window_end"]){
     const input=record[key];
     if(input&&!/^\d{2}\/\d{2}$/.test(input)){
       notice.textContent="Usa DD/MM na janela anual, por exemplo 01/03.";return;
     }
     record[key]=storeWindowDate(input);
   }
   record.emails=record.emails?record.emails.split(",").map(x=>x.trim()).filter(Boolean):[];
   record.origin_id=entry.origin_id||"";
   record.source_label=entry.source_label||"Registo manual";
   try{Object.assign(record,relationshipData())}
   catch(error){notice.textContent=error.message;return}
  }else{
   for(const key of ["fee_amount","commission_pct","promoter_total_amount"])
    record[key]=record[key]===""?null:Number(record[key]);
   record.currency="EUR";record.origin_label=entry.origin_label||"Registo manual";
   if(record.fee_basis==="artist_base"&&record.fee_amount!==null&&record.fee_amount<400&&
      !window.confirm("O cachet artístico está abaixo da referência de 400 €. A banda está alinhada com esta exceção?"))return;
   if(record.fee_basis==="artist_base"&&record.promoter_total_amount!==null&&
      record.commission_mode==="standard"&&record.commission_pct!==null){
    const expected=Math.round(record.fee_amount*100)+
       Math.round(Math.round(record.fee_amount*100)*record.commission_pct/100);
    if(Math.round(record.promoter_total_amount*100)!==expected){
     notice.textContent="O total indicado não corresponde à comissão por cima do cachet artístico. Usa «Condições excecionais» e explica o acordo.";return;
    }
   }
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
   if(kind==="booking")window.dispatchEvent(new CustomEvent("caravela-control-booking-updated"));
   else window.dispatchEvent(new CustomEvent("caravela-control-contacts-updated"));
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
(dashboard.querySelector(".cc-panel-head")||dashboard.lastElementChild).after(dashboardPanel);
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

const normalizeEntity=value=>lower(value).normalize("NFD").replace(/\p{M}/gu,"").replace(/[^a-z0-9]+/g," ").trim();
function nextBusinessDay(day,offset=7){
 const result=new Date(day+"T12:00:00Z");result.setUTCDate(result.getUTCDate()+offset);
 return result.toISOString().slice(0,10);
}
const quickDefinitions=[
 {key:"won",symbol:"✓",label:"Fechado",cls:"won"},
 {key:"contacted",symbol:"✉",label:"Contactado",cls:"contacted"},
 {key:"lost",symbol:"×",label:"Recusou",cls:"lost"},
 {key:"later",symbol:"◷",label:"Adiar",cls:"later"},
 {key:"paused",symbol:"Ⅱ",label:"Pausa",cls:"paused"}
];
function createBookingFromTask(task,decision,formData){
 const original=task.record||{},isNative=task.source==="booking";
 const rawArtist=(original.artist||task.artist||"").trim();
 const contactName=(original.contact_name||task.name||"").trim();
 const today=localToday(),notes=(original.notes||"").trim();
 const updateNote="[Atualização manual "+today+" · "+decision+"] "+formData.note.trim();
 const row=isNative?{...original}:{
  contact_name:contactName,artist:rawArtist,subject:original.subject||"Proposta de booking · "+contactName,
  contact_id:original.link_status==="verified_name_email"?(original.matched_entity_id||""):"",
  contact_email:original.email||"",stage:"research",priority:/^A\b/.test(original.priority||"")?"high":"medium",
  fee_amount:null,commission_pct:null,fee_note:"",conditions:"",event_date:"",press_status:"unknown",
  press_reference:"",advance_status:"unknown",last_contact_date:"",currency:"EUR",
  origin_label:"Ação histórica · "+(original.id||original.origin?.row||contactName),
  evidence_reference:"",evidence_type:"none",notes:"",owner:""
 };
 row.owner=formData.owner.trim();row.notes=[notes,updateNote].filter(Boolean).join("\n").slice(-1600);
 row.next_step=formData.next_step.trim().slice(0,400);
 row.due_date=(formData.next_date||"").trim();
 if(decision==="contacted"){
  // A newly reported contact must never erase pre-existing verified delivery.
  row.stage=isNative&&["sent_verified","reply_reported","negotiating"].includes(original.stage)?
    original.stage:"contact_reported";
  row.evidence_type=row.stage==="contact_reported"?"user_report":original.evidence_type;
  row.evidence_reference=row.stage==="contact_reported"?"":original.evidence_reference;
  row.last_contact_date=formData.when||today;
 }else if(decision==="won"){
  row.stage="confirmed";row.evidence_type=formData.evidence_type==="received_message"?"received_message":"agreement";
  row.evidence_reference=formData.evidence.trim();row.event_date=formData.event_date;
  row.last_contact_date=formData.when||today;row.due_date="";
 }else if(decision==="lost"){
  row.stage="declined";row.evidence_type=isNative&&original.evidence_type!=="none"?
    original.evidence_type:"user_report";
  row.evidence_reference=isNative?original.evidence_reference||"":"";
  row.due_date="";
 }else{
  row.stage="paused";row.evidence_type=isNative&&original.evidence_type!=="none"?
    original.evidence_type:"user_report";
  row.evidence_reference=isNative?original.evidence_reference||"":"";
  if(decision==="paused")row.due_date="";
 }
 if(!isNative){delete row.id;delete row.revision;}
 return row;
}
function createFastAction(container,task,decision){
 container.querySelector(".cc-home-fast-form")?.remove();
 const panel=make("form",undefined,"cc-home-fast-form");
 panel.append(make("strong",quickDefinitions.find(x=>x.key===decision).label+" · "+task.title),
  make("p","Registo manual no booking. Não envia emails, não altera contactos históricos e não confirma pagamentos.","cc-lead"));
 const body=make("div",undefined,"cc-home-fast-fields");
 const fields={};
 const add=(key,label,type="text",value="",required=false)=>{
  const wrapper=make("label",label),input=make("input");input.name=key;input.type=type;input.value=value;
  input.required=required;fields[key]=input;wrapper.append(input);body.append(wrapper);return input;
 };
 const baseline=task.record||{};
 add("owner","Responsável Caravela","text",baseline.owner||"",true);
 if(!baseline.artist&& !task.artist){
  const label=make("label","Artista"),select=make("select");
  for(const artist of ["","WILDCHAINS","Devil of a Woman"]){
    const option=make("option",artist||"Escolher artista");option.value=artist;select.append(option)
  }
  select.required=true;select.name="artist";fields.artist=select;label.append(select);body.append(label);
 }
 const nextDefault=decision==="contacted"?nextBusinessDay(localToday(),7):
   decision==="later"?nextBusinessDay(localToday(),14):"";
 if(["contacted","later"].includes(decision))
   add("next_date","Próximo follow-up / revisão","date",nextDefault,true);
 if(decision==="won") {
  add("event_date","Data do concerto","date",baseline.event_date||"",true);
  const label=make("label","Tipo de comprovativo"),select=make("select");
  for(const [value,name] of [["agreement","Contrato / acordo"],["received_message","Email de confirmação recebido"]]){
   const option=make("option",name);option.value=value;select.append(option);
  }
  select.name="evidence_type";fields.evidence_type=select;label.append(select);body.append(label);
  add("evidence","Referência verificável do acordo ou email","text",baseline.evidence_reference||"",true);
 }
 add("note",decision==="won"?"Nota de confirmação":
  decision==="lost"?"Motivo da recusa":"O que aconteceu / próximo passo","text","",true);
 panel.append(body);
 const actions=make("div",undefined,"cc-home-fast-controls");
 const submit=make("button","Guardar alteração","cc-primary");submit.type="submit";
 const cancel=make("button","Cancelar","cc-neutral");cancel.type="button";cancel.onclick=()=>panel.remove();
 actions.append(submit,cancel);panel.append(actions);
 const notice=make("p",undefined,"cc-lead");notice.setAttribute("role","status");panel.append(notice);
 panel.onsubmit=async e=>{
  e.preventDefault();if(state.busy)return;
  const raw=Object.fromEntries(Object.entries(fields).map(([k,input])=>[k,input.value.trim()]));
  if(decision==="won"&&!baseline.contact_id&&
     !(baseline.link_status==="verified_name_email"&&baseline.matched_entity_id)){
    notice.textContent="A confirmação exige associar uma entidade autorizada. Abre o formulário de Booking para escolher o contacto e indicar o acordo.";
    const move=make("button","Abrir Booking","cc-neutral");move.type="button";
    move.onclick=()=>{
      const draft=createBookingFromTask(task,"contacted",
        {owner:raw.owner,note:raw.note,next_step:"Confirmar acordo e entidade",next_date:"",when:localToday()});
      // This is only an editor draft; no provisional contact was persisted.
      draft.stage="research";draft.evidence_type="none";draft.last_contact_date="";
      window.CaravelaControlApp?.openView("booking");edit("booking",draft);
    };notice.append(move);return;
  }
  const combined={...raw,next_step:
    decision==="contacted"?"Rever resposta e decidir próximo passo":
    decision==="won"?"Preparar concerto e condições técnicas":
    decision==="lost"?"Recusado — conservar para histórico":
    decision==="later"?"Retomar contacto na data definida":"Suspenso até nova decisão"};
  const taskForSave=fields.artist?{...task,artist:raw.artist}:task;
  const record=createBookingFromTask(taskForSave,decision,combined);
  if(!record.owner||!record.artist){notice.textContent="Preenche o responsável e o artista.";return}
  state.busy=true;submit.disabled=true;notice.textContent="A guardar...";
  try{
   const response=await api("booking",task.source==="booking"?"PATCH":"POST",record);
   const result=await response.json();
   if(!response.ok)throw Error(({
    contact_review_required:"Contacto ainda por autorizar. Revê a ficha antes de confirmar.",
    verified_contact_link_required:"Associa um contacto validado para confirmar.",
    contact_identity_mismatch:"O contacto associado não corresponde ao nome/email.",
    contact_email_review_required:"Este email está sujeito a restrições no arquivo.",
    revision_conflict:"O estado foi alterado noutra sessão. Atualiza primeiro.",
    invalid_record:"Revê os campos, datas e comprovativos."
   })[result.error]||result.error||"Não foi possível guardar ("+response.status+")");
   await load("booking");
   panel.remove();
  }catch(error){notice.textContent=error.message}
  finally{state.busy=false;submit.disabled=false}
 };
 container.append(panel);
 panel.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function homeTaskCard(task){
 const row=make("article",undefined,"cc-home-task");
 const stage=task.stage||"research";
 row.classList.add("cc-home-task--"+stage.replace(/[^a-z_-]/g,""));
 row.classList.add("cc-tone-"+(task.source==="arquivo"?"archive":bookingTone(stage)));
 const head=make("div",undefined,"cc-home-task-heading");
 const name=make("button",task.title,"cc-home-task-name");name.type="button";name.onclick=task.click;
 head.append(name,make("span",task.statusLabel||"Por analisar","cc-home-stage cc-home-stage--"+stage));
 row.append(head);
 const info=make("p",task.note||"Verificar próximo passo","cc-home-task-info");
 row.append(info);
 if(task.triageSuggested)row.append(make("small","Triagem sugerida esta semana — prazo histórico por verificar","cc-home-suggestion"));
 const owner=make("div",undefined,"cc-home-task-meta");
 if(task.source==="booking"){
  owner.append(make("span","Responsável: "+(task.record?.owner||"Por atribuir")));
  const location=bookingLocation(task.record);
  if(location!=="Por confirmar")owner.append(make("span",location));
  if(task.record?.last_contact_date)owner.append(make("span","Último contacto: "+task.record.last_contact_date));
  owner.append(make("span",task.date?"Revisão: "+task.date:"Sem data definida"));
 }else{
  owner.append(make("span",task.date?"Data indicada no arquivo: "+task.date:
    "Sem data comprovada no arquivo"));
  owner.append(make("span","Envio, contacto e destinatário por verificar"));
 }
 row.append(owner);
 if(task.source==="booking"||task.source==="arquivo"){
  const commands=task.stage==="confirmed"||task.stage==="declined"||task.stage==="closed"?[]:quickDefinitions;
  if(commands.length){
   const details=make("details",undefined,"cc-home-decision");
   details.append(make("summary",task.source==="arquivo"?
     "Rever e registar decisão":"Atualizar estado"));
   const tools=make("div",undefined,"cc-home-task-tools");
   for(const opt of commands){
    const button=make("button",opt.label,"cc-home-status cc-home-status--"+opt.cls);
    button.type="button";button.title=opt.label;
    button.setAttribute("aria-label",opt.label+" · "+task.title);
    button.onclick=()=>createFastAction(row,task,opt.key);tools.append(button);
   }
   details.append(tools);row.append(details);
  }
 }
 return row;
}
function renderDashboard(){
 const root=$("cc-native-dash-body"),metrics=$("cc-native-dash-metrics");
 if(!root||!metrics)return;
 root.replaceChildren();metrics.replaceChildren();
 const today=localToday(),day=new Date(today+"T12:00:00Z");
 const monday=new Date(day);monday.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));
 const week=offset=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
 const endThisWeek=week(7),endNextWeek=week(14);
 const live=get("booking"),normalize=value=>lower(value).normalize("NFD").replace(/\p{M}/gu,"").replace(/[^a-z0-9]+/g," ").trim();
 const liveKeys=new Set(live.map(x=>normalize(x.contact_name)+"|"+normalize(x.artist)));
 const followups=[],leads=[],archiveFollowups=[],archiveLeads=[],other=[],confirmed=[],paused=[];
 for(const x of live){
  const task={source:"booking",record:x,artist:x.artist,name:x.contact_name,
   title:x.contact_name+" · "+x.artist,date:x.due_date||"",priority:x.priority,
   note:x.next_step,stage:x.stage,statusLabel:choices.stage[x.stage]||"Por analisar",
   click:()=>{window.CaravelaControlApp?.openView("booking");edit("booking",x)}};
  if(["confirmed","declined","closed"].includes(x.stage)){confirmed.push(task);continue}
  if(x.stage==="paused"&&!x.due_date){paused.push(task);continue}
  if(["sent_verified","reply_reported","negotiating","contact_reported"].includes(x.stage))followups.push(task);
  else if(x.stage==="paused")leads.push({...task,note:"Retomar no prazo escolhido · "+(x.next_step||"revisão programada")});
  else leads.push(task);
 }
 for(const row of state.actions){
  if(row.no_outreach||row.contact_policy==="blocked"||!/^(Por contactar|Enviado|Em conversa|Em negociação)$/i.test(row.status||""))continue;
  if(liveKeys.has(normalize(row.name)+"|"+normalize(row.artist)))continue;
  const isFollowup=!/^Por contactar$/i.test(row.status||"");
  const task={source:"arquivo",record:row,artist:row.artist,name:row.name,
   title:row.name+" · "+(row.artist||"Artista a definir"),
   date:row.next_action_iso||row.next_followup_iso||"",priority:/^A\b/i.test(row.priority||"")?"high":"medium",
   stage:isFollowup?"contact_reported":"research",
   statusLabel:isFollowup?"Arquivo · contacto referido":"Arquivo · por contactar (por verificar)",
   note:(row.next_step||"Rever oportunidade")+(row.link_status!=="verified_name_email"?" · identidade por confirmar":""),
   click:()=>displayHistoricalAction(row)};
  if(isFollowup)archiveFollowups.push(task);else archiveLeads.push(task);
 }
 // Preserve dated individual contact reviews as a separate planning queue.
 for(const x of contactRows()){
  if(!x.review_date||x.contact_policy==="blocked"||!x.next_step)continue;
  if(live.some(b=>b.contact_id===x.id))continue;
  other.push({source:"contacts",record:x,name:x.name,artist:"",
   title:x.name,date:x.review_date,stage:"research",
   statusLabel:"Revisão de contacto",note:x.next_step,
   click:()=>{window.CaravelaControlApp?.openView("contacts");edit("contacts",x)}});
 }
 const sorting=(a,b)=>(a.date||"9999").localeCompare(b.date||"9999")||
   Number(b.priority==="high")-Number(a.priority==="high")||a.title.localeCompare(b.title,"pt-PT");
 followups.sort(sorting);leads.sort(sorting);
 archiveFollowups.sort(sorting);archiveLeads.sort(sorting);
 const followupOverdue=followups.filter(x=>x.date&&x.date<today);
 const followupSoon=followups.filter(x=>!x.date||x.date>=today);
 // Only operational bookings may populate the live action board. Historical
 // statements are review candidates, never verified current follow-ups.
 const newLate=leads.filter(x=>x.date&&x.date<today);
 const newWeek=leads.filter(x=>x.date&&x.date>=today&&x.date<endThisWeek);
 const newFuture=leads.filter(x=>!x.date||x.date>=endThisWeek);
 const buckets=[
  {title:"Follow-ups operacionais",count:followups.length,
   help:"Registos da plataforma. Confirma sempre a evidência antes de contactar.",
   items:[...followupOverdue,...followupSoon],id:"followup"},
  {title:"Primeiros contactos · vencidos",count:newLate.length,
   help:"Prazos definidos em propostas operacionais que já passaram.",
   items:newLate,id:"late"},
  {title:"Primeiros contactos · esta semana",count:newWeek.length,
   help:"Datas de revisão registadas para esta semana.",
   items:newWeek,id:"week"},
  {title:"A programar / mais tarde",count:newFuture.length,
   help:"Propostas sem data ou com revisão marcada para depois desta semana.",
   items:newFuture,id:"future"}
 ];
 const archiveCount=archiveFollowups.length+archiveLeads.length;
 metrics.hidden=true;
 // Contact timing is separate from deal status and has no guessed deadlines.
 const allContacts=contactRows();
 const eligibleWindows=allContacts.filter(isWindowEligible).map(contact=>({
   contact,window:windowInfo(contact)
 })).filter(x=>["open","soon"].includes(x.window.status));
 const openWindows=eligibleWindows.filter(x=>x.window.status==="open");
 const upcomingWindows=eligibleWindows.filter(x=>x.window.status==="soon");
 const timed=make("section",undefined,"cc-contact-timing");
 const timingHead=make("div",undefined,"cc-contact-timing-head");
 const timingIntro=make("div");
 timingIntro.append(make("h3","Melhor altura para abordar"),
   make("p","Janelas anuais registadas por entidade. Uma janela não autoriza o envio nem confirma que aceitem propostas.","cc-lead"));
 const timingButton=make("button","Ver calendário de contactos","cc-neutral");timingButton.type="button";
 timingButton.onclick=()=>{
   window.CaravelaControlApp?.openView("contacts");
   const sel=$("cc-native-contacts-filter");
   if(sel){sel.value="window_open";sel.dispatchEvent(new Event("change"))}
 };
 timingHead.append(timingIntro,timingButton);
 timed.append(timingHead);
 const timingSummary=make("div",undefined,"cc-contact-timing-summary");
 for(const [label,n] of [["Janela aberta",openWindows.length],
   ["Próximos 30 dias",upcomingWindows.length]]){
  const item=make("span");item.append(make("strong",n),make("small",label));timingSummary.append(item);
 }
 timed.append(timingSummary);
 const timingItems=make("div",undefined,"cc-contact-timing-items");
 for(const group of [openWindows,upcomingWindows]){
  for(const {contact:entry,window:w} of group.slice(0,5)){
   const item=make("article",undefined,"cc-contact-window-card cc-contact-window-"+w.status);
   const action=make("button",entry.name,"cc-contact-window-name");action.type="button";
   action.onclick=()=>{window.CaravelaControlApp?.openView("contacts");editContactWindow(entry)};
   item.append(action,make("span",w.status==="open"?"Janela aberta":"Abre em "+w.daysToStart+" dias","cc-contact-window-label"),
    make("small",w.label+" · "+(entry.city||entry.region||entry.country||"Localização não registada")),
    make("p",entry.contact_window_reason||"Consultar a fonte antes de agir","cc-contact-window-reason"),
    make("small",entry.contact_policy==="allowed"?"Contacto marcado como autorizado — verificar destinatário":
      "Contacto e canal ainda por validar"));
   timingItems.append(item);
  }
 }
 timed.append(timingItems);
 if(!eligibleWindows.length)timed.append(make("p",
   "Ainda não existem janelas comprovadas em curso ou próximas. Define-as progressivamente nas fichas dos festivais e salas prioritários, com fonte ou histórico.","cc-lead"));
 // The daily action queues take precedence over research calendars.
 const overview=make("div",undefined,"cc-home-summary");
 const liveTotal=followups.length+leads.length;
 overview.append(make("strong",liveTotal?liveTotal+" oportunidades operacionais por tratar":
   "Sem oportunidades operacionais pendentes"),
   make("span",archiveCount+" ações antigas no arquivo · não são follow-ups atuais confirmados"));
 root.append(overview);
 const priorityModule=window.CaravelaWorkflowPriority;
 const focusItems=priorityModule?.selectDailyActions(live,{today,limit:5})||[];
 const focus=make("section",undefined,"cc-daily-focus");
 focus.append(make("h3","As próximas decisões"));
 focus.append(make("p","Até 5 propostas operacionais com revisão vencida, marcada para os próximos 7 dias, resposta por organizar ou responsável em falta. O arquivo e os sinais Zoho ficam nas suas próprias filas, sem prazos inventados.","cc-lead"));
 if(!focusItems.length){
  focus.append(make("p","Sem ações prioritárias comprovadas nesta altura. Consulta as restantes propostas para planear novos contactos.","cc-lead"));
 }else{
  const tasksById=new Map([...followups,...leads].map(task=>[task.record?.id,task]));
  const focusGrid=make("div",undefined,"cc-daily-focus-list");
  for(const item of focusItems){
   const task=tasksById.get(item.id);
   if(!task)continue;
   const wrap=make("div",undefined,"cc-daily-focus-item");
   const reason=make("div",item.reason+(item.missingOwner?" · Responsável por atribuir":""),"cc-daily-focus-reason");
   wrap.append(reason,homeTaskCard(task));focusGrid.append(wrap);
  }
  focus.append(focusGrid);
 }
 root.append(focus);
 const board=make("div",undefined,"cc-home-board");
 const visibleBuckets=buckets.filter(x=>x.items.length>0);
 for(const bucket of visibleBuckets){
  const column=make("section",undefined,"cc-home-column");
  column.append(make("h3",bucket.title+" · "+bucket.count),make("p",bucket.help,"cc-lead"));
  const list=make("div",undefined,"cc-home-column-list");
  const showMore=make("button","Mostrar mais","cc-neutral");showMore.type="button";
  let visible=3;
  function draw(){
   list.replaceChildren();
   for(const task of bucket.items.slice(0,visible))list.append(homeTaskCard(task));
   showMore.hidden=visible>=bucket.items.length;
   showMore.textContent="Mostrar mais ("+(bucket.items.length-visible)+")";
  }
  showMore.onclick=()=>{visible+=5;draw()};draw();
  column.append(list,showMore);board.append(column);
 }
 if(!visibleBuckets.length){
  const empty=make("div",undefined,"cc-home-nonative");
  empty.append(make("strong","O trabalho comercial ainda não foi lançado como oportunidades."),
   make("p","Começa pelas respostas pendentes do Zoho ou recupera uma ação do arquivo, depois de confirmar os dados.","cc-lead"));
  const open=make("button","Rever respostas Zoho","cc-neutral");open.type="button";
  open.onclick=()=>window.CaravelaControlApp?.openView("contacts");
  empty.append(open);board.append(empty);
 }
 if(visibleBuckets.length){
  root.append(colorLegend());
  const allQueues=make("details",undefined,"cc-archive-toggle cc-home-all-queues");
  allQueues.append(make("summary","Consultar todas as filas de Booking · "+liveTotal+" oportunidades"));
  allQueues.append(board);root.append(allQueues);
 }else root.append(board);
 const archive=make("details",undefined,"cc-archive-toggle cc-home-archive");
 archive.append(make("summary","Arquivo histórico · "+archiveFollowups.length+
   " contactos referidos · "+archiveLeads.length+" por contactar (verificar)"));
 archive.append(make("p","Estes números provêm das AÇÕES importadas, não de mensagens confirmadas. Não entram automaticamente nos prazos atuais.","cc-lead"));
 const archives=make("div",undefined,"cc-home-archive-columns");
 for(const [title,entries] of [["Contactos históricos por rever",archiveFollowups],
   ["Primeiros contactos do arquivo",archiveLeads]]){
  const group=make("section",undefined,"cc-home-column");
  group.append(make("h3",title+" · "+entries.length));
  const list=make("div",undefined,"cc-home-column-list");
  const more=make("button","Mostrar mais","cc-neutral");more.type="button";
  let shown=3;
  function paint(){
   list.replaceChildren();
   for(const task of entries.slice(0,shown))list.append(homeTaskCard(task));
   more.hidden=shown>=entries.length;
   more.textContent="Mostrar mais ("+(entries.length-shown)+")";
  }
  more.onclick=()=>{shown+=5;paint()};paint();
  group.append(list,more);archives.append(group);
 }
 archive.append(archives);root.append(archive);
 if(eligibleWindows.length)root.append(timed);
 else{
  const windowDrawer=make("details",undefined,"cc-archive-toggle cc-home-windows");
  windowDrawer.append(make("summary","Janelas ideais de contacto · ainda sem períodos validados"),timed);
  root.append(windowDrawer);
 }
 // Supporting work stays below the four booking queues, not mixed with prospecting.
 const pendingPartner=partnerTasks.filter(x=>
   ["contact_reported","sent_verified","reply_reported","negotiating","draft"].includes(x.stage));
 const pendingFinance=financeTasks.filter(x=>x.status==="due"&&!["settled","cancelled"].includes(x.status));
 const secondary=make("div",undefined,"cc-home-secondary");
 const summary=[
  {title:"Parcerias pendentes",count:pendingPartner.length,view:"partnerships",
    detail:"Propostas e conversas que ainda precisam de resolução"},
  {title:"Pagamentos a tratar",count:pendingFinance.length,view:"finance",
    detail:"Apenas movimentos financeiros lançados na plataforma"},
  {title:"Datas confirmadas",count:confirmed.filter(x=>x.stage==="confirmed").length,view:"booking",
    detail:"Concertos registados como confirmados com evidência"},
  {title:"Contactos sem responsável",count:live.filter(x=>!x.owner).length,view:"booking",
    detail:"Negociações que ainda precisam de responsável"}
 ];
 for(const item of summary){
  const btn=make("button",undefined,"cc-home-secondary-card");btn.type="button";
  btn.append(make("strong",item.count),make("span",item.title),make("small",item.detail));
  btn.onclick=()=>window.CaravelaControlApp?.openView(item.view);secondary.append(btn);
 }
 const supporting=make("details",undefined,"cc-archive-toggle cc-home-support");
 supporting.append(make("summary","Outras áreas · "+pendingPartner.length+
   " parcerias · "+pendingFinance.length+" pagamentos por tratar"),secondary);
 const preparation=[];
 for(const item of live.filter(x=>x.stage==="confirmed"&&/^\d{4}-\d{2}-\d{2}$/.test(x.event_date||""))){
  const dueFor=offset=>nextBusinessDay(item.event_date,-offset);
  const base={title:item.contact_name+" · "+item.artist,owner:item.owner||"Por atribuir",
   open:()=>{window.CaravelaControlApp?.openView("booking");edit("booking",item)}};
  if(!item.press_status||item.press_status==="unknown")
    preparation.push({...base,date:dueFor(21),name:"Plano de divulgação e imprensa"});
  if(!item.advance_status||["unknown","planned"].includes(item.advance_status))
    preparation.push({...base,date:dueFor(10),name:"Rider, horários, técnicos e logística"});
 }
 if(preparation.length){
  preparation.sort((a,b)=>a.date.localeCompare(b.date));
  const box=make("details",undefined,"cc-archive-toggle");
  const overdue=preparation.filter(x=>x.date<today).length;
  box.append(make("summary","Preparação de concertos · "+preparation.length+
    (overdue?" · "+overdue+" revisões vencidas":"")));
  box.append(make("p","Tarefas indicativas calculadas das datas confirmadas. Não equivalem a compromissos aceites pelo promotor.","cc-lead"));
  for(const item of preparation.slice(0,20)){
   const btn=make("button",item.date+" · "+item.name+" · "+item.title+
     " · "+item.owner,"cc-native-dash-task");
   btn.type="button";btn.onclick=item.open;box.append(btn);
  }
  root.append(box);
 }
 const partnershipPending=partnerTasks.filter(x=>["sent_verified","contact_reported","reply_reported","negotiating","draft"].includes(x.stage));
 if(partnershipPending.length){
  const box=make("details",undefined,"cc-archive-toggle");
  box.append(make("summary","Parcerias a acompanhar · "+partnershipPending.length));
  for(const p of partnershipPending.slice(0,15)){
   const btn=make("button",p.name+" · "+(p.next_step||"Confirmar próximo passo")+
     " · "+(p.owner||"Por atribuir"),"cc-native-dash-task");
   btn.type="button";btn.onclick=()=>{
    window.CaravelaControlApp?.openView("partnerships");
    const search=$("cc-partners-search");if(search){search.value=p.name;search.dispatchEvent(new Event("input"))}
   };box.append(btn);
  }
  supporting.append(box);
 }
 const extra=[{label:"Revisões de contactos",rows:other,route:"contacts"},
  {label:"Negociações suspensas",rows:paused,route:"booking"}];
 for(const group of extra){
  if(!group.rows.length)continue;
  const details=make("details",undefined,"cc-archive-toggle");
  details.append(make("summary",group.label+" · "+group.rows.length));
  for(const x of group.rows.slice(0,20)){
   const b=make("button",x.title+" · "+(x.date||"Sem prazo"),"cc-native-dash-task");
   b.type="button";b.onclick=x.click;details.append(b);
  }
  supporting.append(details);
 }
 root.append(supporting);
 const artist=make("details",undefined,"cc-archive-toggle cc-roster-details");
 artist.append(make("summary","Roster principal · dados operacionais"));
 const artistGrid=make("div",undefined,"cc-agenda-artists");
 artistGrid.append(make("small","Os totais abaixo incluem apenas propostas criadas na plataforma, não o histórico das bandas.","cc-agenda-roster-note"));
 for(const [name,rx] of [["WILDCHAINS",/wildchains/i],["Devil of a Woman",/devil\s*(of a woman)?/i]]){
  const relevant=live.filter(x=>rx.test(x.artist||"")),card=make("article",undefined,"cc-agenda-artist");
  card.append(make("strong",name),make("p",
    relevant.filter(x=>!["confirmed","declined","closed"].includes(x.stage)).length+" negociações em acompanhamento · "+
    relevant.filter(x=>x.stage==="confirmed").length+" concertos confirmados registados · "+
    relevant.filter(x=>!x.owner).length+" sem responsável"));
  const b=make("button","Ver booking","cc-neutral");b.type="button";
  b.onclick=()=>window.CaravelaControlApp?.openView("booking");card.append(b);artistGrid.append(card);
 }
 artist.append(artistGrid);root.append(artist);
}

window.addEventListener("caravela-board-open-booking",event=>{
 const row=event.detail?.record;
 if(row&&row.id){window.CaravelaControlApp?.openView("booking");edit("booking",row)}
});
window.addEventListener("caravela-board-create-booking",event=>{
 const d=event.detail||{};
 boardYear=Number(d.booking_year)||boardYear;
 window.CaravelaControlApp?.openView("booking");
 edit("booking",{contact_name:d.contact_name||"",contact_id:d.contact_id||"",
  booking_year:String(boardYear),booking_category:d.booking_category||"unknown",
  artist:d.artist||"",subject:d.subject||"",next_step:"Confirmar oportunidade e contacto"});
});
window.addEventListener("caravela-board-open-contact",event=>{
 const row=contactRows().find(x=>x.id===event.detail?.id);
 if(row){window.CaravelaControlApp?.openView("contacts");edit("contacts",row)}
});
window.addEventListener("caravela-board-open-window",event=>{
 const id=event.detail?.contact_id;
 const row=contactRows().find(x=>x.id===id);
 if(row){window.CaravelaControlApp?.openView("contacts");editContactWindow(row)}
});

// A small, on-demand explanation is displayed near the booking workflow.
bookingView.querySelector(".cc-panel-head")?.after(colorLegend());
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
window.addEventListener("caravela-control-booking-updated",()=>{void load("booking")});
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
