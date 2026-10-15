/* Caravela Control — editable working area, Preview only.
 * Historical V3 stays immutable; saved records are a separate append-only stream. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const contactView=$("cc-view-contacts"),bookingView=$("cc-view-booking"),dashboard=$("cc-view-dashboard");
if(!contactView||!bookingView||!dashboard)return;
const CONTACT_FIELDS=[
  ["name","Nome / entidade","text",true],["kind","Tipo","select",true],
  ["city","Localidade","text"],["emails","Emails (separados por vírgulas)","text"],
  ["contact_policy","Política de contacto","select",true],
  ["next_step","Próximo passo","textarea"],["review_date","Rever em","date"],
  ["notes","Notas internas","textarea"]
];
const BOOKING_FIELDS=[
  ["contact_name","Entidade / promotor","text",true],["contact_id","Associar a contacto","select"],
  ["artist","Artista","text",true],["subject","Proposta / evento","text",true],
  ["stage","Estado","select",true],["priority","Prioridade","select",true],
  ["contact_email","Email operacional","email"],["fee_amount","Cachet (€)","number"],
  ["fee_note","Notas de valor / comissão","text"],
  ["conditions","Condições / deslocação / alojamento","textarea"],
  ["last_contact_date","Último contacto comprovado","date"],
  ["due_date","Próxima revisão","date"],["owner","Responsável","text"],
  ["next_step","Próxima ação","textarea",true],
  ["evidence_type","Evidência","select",true],["evidence_reference","Referência (email / contrato / nota)","text"],
  ["notes","Contexto interno","textarea"]
];
const choices={
 kind:{festival:"Festival",venue:"Sala / espaço",promoter:"Promotor",press:"Imprensa",other:"Outro"},
 contact_policy:{review:"Rever antes de contactar",allowed:"Contacto autorizado",blocked:"Não contactar"},
 stage:{research:"Por avaliar",draft:"Proposta por preparar",contact_reported:"Contacto referido (não verificado)",
   sent_verified:"Envio verificado",reply_reported:"Resposta referida",negotiating:"Em negociação",
   confirmed:"Confirmado",declined:"Recusado",paused:"Em pausa",closed:"Concluído"},
 priority:{high:"Alta",medium:"Média",low:"Baixa"},
 evidence_type:{none:"Sem comprovativo",user_report:"Registo manual / relato",
   sent_message:"Email enviado — verificado",received_message:"Email recebido — verificado",
   agreement:"Contrato / acordo verificado"}
};
const state={historical:[],actions:[],saved:{contacts:[],booking:[]},busy:false,shown:{contacts:40,booking:30}};
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
 return {id:x.id,origin_id:x.id,name:x.name,kind:x.kind,city:x.city||"",
   emails:Array.isArray(x.emails)?x.emails:[],contact_policy:historicPolicy(x),
   next_step:"",review_date:"",notes:"",source_label:"Arquivo importado (original imutável)",historical:true};
}
function contactRows(){
 const map=new Map(state.historical.map(x=>[x.id,historicalContact(x)]));
 for(const entry of get("contacts"))map.set(entry.id,{...map.get(entry.id),...entry,historical:!!map.get(entry.id)});
 const rows=[...map.values()].sort((a,b)=>lower(a.name).localeCompare(lower(b.name),"pt-PT"));
 byId.clear();rows.forEach(x=>byId.set(x.id,x));return rows;
}
function nativeRows(kind){return kind==="contacts"?contactRows():get("booking").slice()}
function api(kind,method,data){
 const transport=window.CaravelaNativeTransport;
 if(!transport)throw Error("Ligação ao cofre indisponível. Reabre a página.");
 return transport.request(kind,method,data);
}
let archiveLoaded=false,archiveBusy=false;
async function loadArchive(){
 if(archiveLoaded||archiveBusy)return;
 archiveBusy=true;
 try{
  const response=await api("archive","GET");
  if(response.status===403)return; // No permission to read even the safe archive projection.
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||"Arquivo indisponível");
  state.historical=data.contacts||[];
  state.actions=data.actions||[];
  archiveLoaded=true;
  render("contacts");render("booking");renderDashboard();
 }catch(error){
  // Native manually authored records are still usable if the archive cannot be read.
  if($("cc-native-contacts-status"))
   $("cc-native-contacts-status").textContent="Registos próprios disponíveis. Arquivo: "+error.message;
 }finally{archiveBusy=false}
}
async function load(kind){
 const status=$("cc-native-"+kind+"-status");
 try{
  const response=await api(kind,"GET");
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||"Erro "+response.status);
  state.saved[kind]=data.records||[];
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
function filtered(kind){
 const term=lower($("cc-native-"+kind+"-search").value);
 const filter=$("cc-native-"+kind+"-filter").value;
 return nativeRows(kind).filter(r=>{
  if(kind==="contacts"&&filter!=="all"&&r.contact_policy!==filter)return false;
  if(kind==="booking"){
   if(filter==="due"){
    const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    if(!r.due_date||r.due_date>today||["confirmed","declined","closed"].includes(r.stage))return false;
   } else if(filter!=="all"&&r.stage!==filter)return false;
  }
  return !term||lower([r.name,r.city,r.emails?.join(" "),r.contact_name,r.artist,r.subject,
    r.contact_email,r.notes,r.next_step,r.owner].filter(Boolean).join(" ")).includes(term);
 });
}
function render(kind){
 const all=filtered(kind),list=$("cc-native-"+kind+"-list"),limit=state.shown[kind];
 list.replaceChildren();
 let count=0;
 if(kind==="contacts"){
  const rows=contactRows();
  const saved=get(kind).length;
  $("cc-native-contacts-summary").textContent=rows.length+" contactos disponíveis · "+
   saved+" fichas operacionais guardadas · restantes do arquivo imutável.";
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
  top.append(title,badge(kind==="contacts"?r.contact_policy:r.stage,kind));card.append(top);
  if(kind==="booking"){
   hint(card,"Proposta",r.subject);
   hint(card,"Próximo passo",r.next_step);
   hint(card,"Rever",r.due_date||"Sem prazo");
   hint(card,"Cachet",r.fee_amount===null?"Não definido":Number(r.fee_amount).toLocaleString("pt-PT")+" €");
   hint(card,"Responsável",r.owner);
   hint(card,"Evidência",(choices.evidence_type[r.evidence_type]||"")+" · "+(r.evidence_reference||"não referenciada"));
   hint(card,"Origem",r.origin_label);
  } else {
   hint(card,"Tipo / local",((choices.kind[r.kind]||"")+" · "+(r.city||"—")));
   hint(card,"Emails",r.emails?.join(", ")||"Sem endereço");
   hint(card,"Próximo passo",r.next_step);
   hint(card,"Rever",r.review_date);
   if(r.historical)hint(card,"Origem","Arquivo original — registo separado de alterações");
  }
  const actions=make("div",undefined,"cc-native-card-actions");
  const button=make("button",r.revision?"Atualizar":"Editar ficha","cc-neutral");
  button.type="button";button.onclick=()=>edit(kind,r);actions.append(button);
  if(kind==="contacts"){
   const b=make("button","Nova proposta","cc-neutral");b.type="button";
   b.onclick=()=>{window.CaravelaControlApp?.openView("booking");edit("booking",{
     contact_name:r.name,contact_id:r.id,contact_email:r.emails?.[0]||""
   });};actions.append(b);
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
const history=make("section",undefined,"cc-native-history");
history.id="cc-native-booking-history-wrap";
history.innerHTML='<h2>Ações do arquivo</h2><label>Pesquisar ações originais<input id="cc-native-history-search" type="search" placeholder="Entidade, artista, estado..."></label><div id="cc-native-booking-history"></div>';
bookingView.querySelector("#cc-native-booking")?.after(history);
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
 else if(key==="fee_amount")field.value=current.fee_amount===null||current.fee_amount===undefined?"":current.fee_amount;
 else field.value=current[key]??({
   kind:"venue",contact_policy:"review",stage:"research",priority:"medium",evidence_type:"none"
 }[key]||"");
 box.append(field);parent.append(box);return field;
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
 form.append(title,help,grid);
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
  }else{
   const money=record.fee_amount;record.fee_amount=money===""?null:Number(money);
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
 '<div id="cc-native-dash-body" class="cc-native-list"><p class="cc-lead">A consultar tarefas...</p></div>';
dashboard.appendChild(dashboardPanel);
$("cc-native-dash-open").onclick=()=>window.CaravelaControlApp?.openView("booking");
function renderDashboard(){
 const root=$("cc-native-dash-body");root.replaceChildren();
 const entries=get("booking").filter(x=>!["confirmed","declined","closed"].includes(x.stage))
  .sort((a,b)=>{
   const ad=a.due_date||"9999-99-99",bd=b.due_date||"9999-99-99";
   return ad.localeCompare(bd)||({high:0,medium:1,low:2}[a.priority]-({high:0,medium:1,low:2}[b.priority]));
  });
 if(!entries.length){root.append(make("p","Ainda não há negociações nativas em curso. Abre Booking para criar a primeira.","cc-notice"));return;}
 for(const row of entries.slice(0,6)){
  const item=make("button",undefined,"cc-native-dash-task");item.type="button";
  item.append(make("strong",row.contact_name+" · "+row.artist),
    make("span",row.next_step+" · "+(row.due_date?"Rever "+row.due_date:"Sem prazo")));
  item.onclick=()=>{window.CaravelaControlApp?.openView("booking");edit("booking",row)};
  root.append(item);
 }
}
function onOpened(event){
 const view=event.detail?.view;
 if(view==="contacts"||view==="booking"){
  loadArchive();load(view==="contacts"?"contacts":"booking");
  if(view==="booking")renderHistory();
 } else if(view==="dashboard"){load("booking")}
}
window.addEventListener("caravela-control-view-opened",onOpened);
window.addEventListener("caravela-control-token-ready",()=>{
 loadArchive();load("contacts");load("booking");
});
window.addEventListener("caravela-crm-imported",event=>{
 archiveLoaded=true;
 state.historical=event.detail?.manifest?.entities||[];
 state.actions=event.detail?.manifest?.actions||[];
 render("contacts");render("booking");renderDashboard();
});
window.addEventListener("caravela-control-signed-out",()=>{
 archiveLoaded=false;archiveBusy=false;
 state.saved={contacts:[],booking:[]};state.historical=[];state.actions=[];
 render("contacts");render("booking");renderDashboard();
});
render("contacts");render("booking");renderDashboard();
})();
