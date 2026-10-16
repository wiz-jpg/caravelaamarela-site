/* Caravela Control Preview: human-authored, encrypted draft workspace.
 * Never sends mail, never writes commercial stages, never closes Zoho tasks. */
(()=>{"use strict";
 const booking=document.getElementById("cc-view-booking");
 if(!booking)return;
 const mk=(tag,text,cls)=>{
  const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);
  if(cls)el.className=cls;return el;
 };
 const panel=mk("section",undefined,"cc-drafts");
 const header=mk("div",undefined,"cc-drafts-head");
 const intro=mk("div");
 intro.append(mk("h2","Preparar emails"),
  mk("p","Rascunhos cifrados com histórico de versões. Nenhum email é enviado pela Caravela nesta fase.","cc-lead"));
 const newButton=mk("button","+ Novo rascunho","cc-primary");newButton.type="button";
 header.append(intro,newButton);
 const status=mk("p","A aguardar sessão privada.","cc-lead");status.setAttribute("role","status");
 status.setAttribute("aria-live","polite");
 const controls=mk("div",undefined,"cc-drafts-controls");
 const find=mk("input");find.type="search";find.placeholder="Pesquisar rascunhos, entidade, assunto…";find.setAttribute("aria-label","Pesquisar rascunhos");
 const scope=mk("select");scope.setAttribute("aria-label","Filtrar estado");
 for(const [v,label] of [["draft","Em preparação"],["all","Todos"],["archived","Arquivados"]]){
  const opt=mk("option",label);opt.value=v;scope.append(opt);
 }
 controls.append(find,scope);
 const grid=mk("div",undefined,"cc-drafts-grid");
 const editor=mk("div",undefined,"cc-drafts-editor");editor.hidden=true;
 panel.append(header,status,controls,grid,editor);
 booking.querySelector(".cc-panel-head")?.after(panel);
 let rows=[],editing=null,loading=false,editingDirty=false,sourceContext=null;
 const transport=()=>window.CaravelaDraftTransport;
 const action=(label,onClick,cls="cc-neutral")=>{
  const button=mk("button",label,cls);button.type="button";button.onclick=onClick;return button;
 };
 const time=x=>x?new Date(x).toLocaleString("pt-PT",{dateStyle:"short",timeStyle:"short"}):"—";
 function abandon(){
  if(editingDirty&&!window.confirm("Descartar alterações não guardadas a este rascunho?"))return false;
  editor.hidden=true;editor.replaceChildren();editing=null;editingDirty=false;sourceContext=null;
  return true;
 }
 function render(){
  grid.replaceChildren();
  const term=find.value.trim().toLowerCase();
  const show=rows.filter(r=>(scope.value==="all"||r.status===scope.value)&&
   (!term||[r.to,r.subject,r.artist,r.context].some(x=>String(x||"").toLowerCase().includes(term))));
  if(!show.length){
   grid.append(mk("p",rows.length?"Sem rascunhos neste filtro.":"Sem rascunhos guardados. Podes preparar um sem enviar emails.","cc-lead"));
   return;
  }
  for(const item of show){
   const card=mk("article",undefined,"cc-drafts-card");
   const content=mk("div");content.append(
    mk("strong",item.subject||"Sem assunto"),
    mk("span",(item.to||"Destinatário por definir")+" · "+(item.artist||"Artista por escolher")),
    mk("small","Versão "+item.revision+" · "+time(item.updated_ms)+
      (item.status==="archived"?" · Arquivado":" · Não enviado"))
   );
   const edit=action("Abrir",()=>openEditor(item));
   card.append(content,edit);grid.append(card);
  }
 }
 async function refresh(){
  if(loading)return;
  if(!transport()){status.textContent="A aguardar autenticação.";return}
  loading=true;
  try{
   const response=await transport().list(),data=await response.json();
   if(!response.ok||!data.ok)throw Error(data.error||"Lista indisponível");
   rows=data.drafts||[];
   status.textContent=rows.filter(x=>x.status==="draft").length+
     " rascunho(s) em preparação · cifrados, recuperáveis e ainda não enviados.";
   render();
  }catch(error){
   rows=[];render();
   const label=String(error.message||error);
   status.textContent=label.includes("drafts_migration_required")?
    "Falta aplicar a migração privada 0007 na D1 Preview. Nenhum rascunho foi perdido.":
    label.includes("draft_crypto_unavailable")?"A chave de cifragem do Preview não está disponível.":
    "Não foi possível carregar os rascunhos. "+label;
  }finally{loading=false}
 }
 async function possibleBookings(select,picked=""){
  try{
   const response=await window.CaravelaNativeTransport?.request("booking","GET");
   if(!response?.ok)return;
   const data=await response.json();
   for(const deal of data.records||[]){
    const opt=mk("option",deal.contact_name+" · "+deal.artist+" · "+(deal.subject||"Proposta"));
    opt.value=deal.id;select.append(opt);
   }
   select.value=picked;
  }catch{}
 }
 function openEditor(draft=null,prefill={}){
  if(!abandon())return;
  editing=draft;editingDirty=false;
  const fresh=draft||{
   to:prefill.to||"",subject:prefill.subject||"",body:"",artist:prefill.artist||"",
   context:prefill.context||"",booking_id:prefill.booking_id||"",
   source_message_id:prefill.source_message_id||"",status:"draft"
  };
  sourceContext={...fresh};
  editor.hidden=false;
  const heading=mk("div",undefined,"cc-drafts-edit-head");
  heading.append(mk("h3",draft?"Editar rascunho · versão "+draft.revision:"Novo rascunho"),
   mk("small","Guardar não envia mensagens nem altera estados comerciais"));
  const form=mk("form",undefined,"cc-drafts-form");
  const fields={};
  const input=(key,title,type="text",value="")=>{
   const label=mk("label",title);
   const el=mk(type==="textarea"?"textarea":"input");if(type!=="textarea")el.type=type;
   el.name=key;el.value=value||"";fields[key]=el;
   label.append(el);form.append(label);
   el.addEventListener("input",()=>{editingDirty=true});
   return el;
  };
  const recipient=input("to","Para · destinatário (um email)","email",fresh.to);
  recipient.maxLength=254;
  const artist=input("artist","Artista / projeto","text",fresh.artist);artist.maxLength=110;
  const subject=input("subject","Assunto","text",fresh.subject);subject.maxLength=180;
  const body=input("body","Texto do email","textarea",fresh.body);body.maxLength=12000;body.rows=9;
  const context=input("context","Nota interna · não aparece no email","textarea",fresh.context);
  context.maxLength=350;context.rows=2;
  const associate=mk("label","Oportunidade associada (escolha manual)");
  const bookingSelect=mk("select"),opt=mk("option","Sem oportunidade associada");opt.value="";
  bookingSelect.append(opt);bookingSelect.value="";
  fields.booking_id=bookingSelect;
  associate.append(bookingSelect);form.append(associate);
  bookingSelect.onchange=()=>{editingDirty=true};
  void possibleBookings(bookingSelect,fresh.booking_id);
  if(fresh.source_message_id){
   const ref=mk("p","Origem: mensagem Zoho "+fresh.source_message_id+
    " · não foi enviada nem marcada como tratada.","cc-lead");
   form.append(ref);
  }
  const tools=mk("div",undefined,"cc-drafts-form-actions");
  const save=mk("button","Guardar rascunho cifrado","cc-primary");save.type="submit";
  const cancel=action("Fechar",()=>abandon());
  tools.append(save,cancel);
  if(draft){
   const archive=action(draft.status==="archived"?"Reabrir rascunho":"Arquivar",async()=>{
    if(!window.confirm(draft.status==="archived"?
      "Reabrir este rascunho?":"Arquivar este rascunho? O conteúdo e todas as versões serão preservados."))return;
    await persist(draft.status==="archived"?"draft":"archived");
   });
   tools.append(archive);
  }
  const message=mk("p","","cc-lead");message.setAttribute("role","status");
  form.append(tools,message);editor.append(heading,form);
  if(draft){
   const history=mk("details",undefined,"cc-drafts-versions");
   history.append(mk("summary","Histórico de versões · recuperar texto anterior"));
   const versions=mk("div",undefined,"cc-drafts-version-buttons");
   history.append(versions);editor.append(history);
   void transport().read(draft.id).then(r=>r.json()).then(data=>{
    if(!data.ok)return;
    for(const v of data.versions||[]){
     const restore=action("Ver versão "+v.revision+" · "+time(v.created_ms),async()=>{
      try{
       const response=await transport().read(draft.id,v.revision);
       const older=(await response.json()).draft;
       if(!older)throw Error("Versão não encontrada");
       if(!window.confirm("Carregar o texto da versão "+v.revision+
        "? A versão atual não será apagada e só haverá alteração ao guardar."))return;
       for(const key of ["to","subject","body","artist","context"]){
        fields[key].value=older[key]||"";
       }
       fields.booking_id.value=older.booking_id||"";
       editingDirty=true;message.textContent="Versão anterior carregada. Guarda para criar uma nova revisão; o histórico permanece intacto.";
      }catch(error){message.textContent="Erro a recuperar versão: "+error.message}
     });
     versions.append(restore);
    }
   }).catch(()=>{});
  }
  async function persist(statusValue){
   if(loading)return;
   const payload={
    to:fields.to.value.trim(),subject:fields.subject.value.trim(),
    body:fields.body.value,artist:fields.artist.value.trim(),
    context:fields.context.value.trim(),booking_id:fields.booking_id.value,
    source_message_id:fresh.source_message_id||""
   };
   if(payload.to&&!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(payload.to)){
    message.textContent="Confirma o destinatário. Cada rascunho tem apenas um email.";
    return;
   }
   save.disabled=true;message.textContent="A guardar versão no cofre privado…";
   try{
    const response=await transport().save(draft?{
      ...payload,id:draft.id,revision:draft.revision,status:statusValue
    }:payload);
    const data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||"Não foi possível guardar");
    editingDirty=false;
    editor.hidden=true;editor.replaceChildren();editing=null;
    status.textContent="Rascunho guardado em nova versão. Não foi enviado nenhum email.";
    await refresh();
   }catch(error){
    message.textContent="Não foi possível guardar: "+error.message+
      ". Mantivemos o texto no formulário para nova tentativa.";
   }finally{save.disabled=false}
  }
  form.onsubmit=e=>{e.preventDefault();void persist(draft?.status||"draft")};
  editor.scrollIntoView({behavior:"smooth",block:"nearest"});
 }
 newButton.onclick=()=>openEditor();
 find.oninput=render;scope.onchange=render;
 window.addEventListener("caravela-control-view-opened",e=>{
  if(e.detail?.view==="booking")void refresh();
 });
 window.addEventListener("caravela-control-authenticated",()=>void refresh());
 window.addEventListener("caravela-control-token-ready",()=>void refresh());
 window.addEventListener("caravela-control-signed-out",()=>{
  rows=[];editingDirty=false;editor.hidden=true;editor.replaceChildren();
  status.textContent="Inicia sessão para consultar rascunhos cifrados.";render();
 });
 window.addEventListener("caravela-control-draft-compose",event=>{
  const context=event.detail||{};
  window.CaravelaControlApp?.openView("booking");
  openEditor(null,{
   to:typeof context.to==="string"?context.to:"",
   artist:typeof context.artist==="string"?context.artist:"",
   subject:typeof context.subject==="string"?context.subject:"",
   context:typeof context.context==="string"?context.context:"",
   booking_id:typeof context.booking_id==="string"?context.booking_id:"",
   source_message_id:typeof context.source_message_id==="string"?context.source_message_id:""
  });
 });
})();
