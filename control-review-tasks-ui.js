/* Preview private human-validation queue. No inferred deadline, artist, agreement or send. */
(()=>{"use strict";
 const home=document.getElementById("cc-view-dashboard");
 const contacts=document.getElementById("cc-view-contacts");
 if(!home||!contacts)return;
 const make=(tag,value,cls)=>{
  const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);
  if(cls)x.className=cls;return x;
 };
 const topics={booking:"Booking",partnership:"Parceria",press:"Imprensa"};
 const signals={
  possible_confirmation:"Possível confirmação",
  needs_reply:"Pergunta a responder",
  interest:"Possível interesse",
  decline:"Possível recusa"
 };
 const guidance={
  possible_confirmation:"Verificar o acordo e as condições no Zoho antes de confirmar algo.",
  needs_reply:"Verificar a pergunta e decidir se é necessário responder.",
  interest:"Verificar se existe uma oportunidade concreta para a agência.",
  decline:"Verificar a recusa antes de atualizar o histórico ou insistir."
 };
 const priorities={possible_confirmation:0,needs_reply:1,interest:2,decline:3};
 const date=x=>x?new Date(x).toLocaleString("pt-PT",{dateStyle:"short",timeStyle:"short"}):"Data desconhecida";
 const btn=(label,onclick,css="cc-neutral")=>{
  const b=make("button",label,css);b.type="button";b.onclick=onclick;return b;
 };
 const compact=make("section",undefined,"cc-review-tasks-home");
 const compactHeader=make("div",undefined,"cc-review-tasks-home-header");
 const homeCount=make("span","A verificar…");
 const homeOpen=btn("Abrir fila de revisão",()=>window.CaravelaControlApp?.openView("contacts"));
 compactHeader.append(make("strong","Tarefas por validar · Zoho"),homeCount,homeOpen);
 const homePreviews=make("div",undefined,"cc-review-tasks-home-preview");
 compact.append(compactHeader,homePreviews);
 const homeStatus=home.querySelector(".cc-mail-automation-status");
 if(homeStatus)homeStatus.after(compact);
 else home.querySelector(".cc-panel-head")?.after(compact);
 const panel=make("section",undefined,"cc-review-tasks-panel");
 const heading=make("div",undefined,"cc-review-tasks-heading");
 const left=make("div");
 left.append(make("h2","Tarefas pendentes de validação"),
  make("p","Mensagens do Zoho classificadas por regras. As prioridades são apenas de leitura e verificação; nunca são prazos de resposta nem negócios confirmados.","cc-lead"));
 const refresh=btn("Atualizar fila",()=>void load());
 heading.append(left,refresh);
 const filters=make("div",undefined,"cc-review-task-filters");
 const filterLabel=make("label","Tipo de sinal"),filter=make("select");
 for(const [key,label] of [
  ["all","Todos os sinais"],
  ["needs_reply","Perguntas a rever"],
  ["possible_confirmation","Possíveis confirmações"],
  ["interest","Possível interesse"],
  ["decline","Possíveis recusas"]
 ]){const option=make("option",label);option.value=key;filter.append(option)}
 filterLabel.append(filter);
 const searchLabel=make("label","Pesquisar remetente ou contacto");
 const search=make("input");search.type="search";search.placeholder="Pesquisar…";search.autocomplete="off";
 searchLabel.append(search);filters.append(filterLabel,searchLabel);
 const info=make("p","A aguardar ligação privada.","cc-lead");
 info.setAttribute("role","status");info.setAttribute("aria-live","polite");
 const items=make("div",undefined,"cc-review-tasks-items");
 const foot=make("p","Rever a mensagem original no Zoho. Um sinal não comprova uma proposta aceite, recusa definitiva, autorização de envio ou data acordada.","cc-lead");
 panel.append(heading,filters,info,items,foot);
 // Keep urgent Zoho work visible above the contact directory. Other
 // reconciliation tools live in collapsed drawers further down the page.
 contacts.querySelector(".cc-panel-head")?.after(panel);
 let loading=false,lastData=null;
 const priorityName=x=>["needs_reply","possible_confirmation"].includes(x)?"Rever primeiro":"Rever";
 const association=x=>x.association==="unique_candidate"?"Ficha candidata por email exato":
  x.association==="shared_email"?"Email partilhado: escolher entidade manualmente":
  x.association==="restricted"?"Contacto com restrições — não contactar automaticamente":
  "Identidade por confirmar";
 function openTask(task){
  filter.value="all";search.value="";drawQueue();
  window.CaravelaControlApp?.openView("contacts");
  const row=[...items.children].find(x=>x.dataset?.messageId===task.message_id);
  row?.scrollIntoView({behavior:"smooth",block:"center"});
 }
 async function decide(task,status){
  const verb=status==="reviewed"?"Concluir a revisão":"Descartar este sinal";
  if(!window.confirm(verb+"? Apenas a tarefa será fechada; o contacto e o booking não mudam."))return;
  try{
    info.textContent="A guardar decisão de revisão…";
    const response=await window.CaravelaMailReviewTasks.update(task.message_id,task.revision,status,"");
    const result=await response.json();
    if(!response.ok||!result.ok)throw Error(result.error||"Operação recusada.");
    lastData=null;await load();
  }catch(err){info.textContent="Não foi possível concluir a revisão: "+err.message+". Atualiza a fila."}
 }
 async function resolveBookingInPlace(task,article){
  const existingPanel=article.querySelector(".cc-task-resolver");
  if(existingPanel){existingPanel.remove();return}
  const box=make("section",undefined,"cc-task-resolver");
  box.append(make("strong","Resolver numa única janela"),
    make("p","Confirma primeiro a mensagem original no Zoho. Escolhe uma oportunidade e regista uma decisão tua; o sinal automático não confirma acordos nem envia emails.","cc-lead"));
  const progress=make("p","A consultar oportunidades…","cc-lead");
  progress.setAttribute("role","status");
  box.append(progress);article.append(box);
  const transport=window.CaravelaNativeTransport;
  if(!transport){progress.textContent="A sessão de booking não está disponível.";return}
  try{
   const response=await transport.request("booking","GET");
   if(!response.ok)throw Error("Não foi possível consultar as oportunidades.");
   const data=await response.json(),all=data.records||[];
   const candidates=new Set((task.matches||[]).map(x=>x.id));
   const similar=all.filter(x=>!["confirmed","closed"].includes(x.stage)&&(
     x.contact_email?.toLowerCase()===task.external_email?.toLowerCase()||
     x.contact_id&&candidates.has(x.contact_id)
   )).slice(0,25);
   progress.remove();
   const form=make("form",undefined,"cc-task-resolve-form");
   const labeled=(label,type,initial="")=>{
    const outer=make("label",label),el=make(type==="select"?"select":"input");
    if(type!=="select")el.type=type;el.value=initial;outer.append(el);form.append(outer);return el;
   };
   const choose=labeled("Oportunidade","select");
   let opt=make("option","Criar nova oportunidade");opt.value="";choose.append(opt);
   for(const row of similar){
    const option=make("option",row.contact_name+" · "+row.artist+" · "+(row.subject||"Proposta"));
    option.value=row.id;choose.append(option);
   }
   const entity=labeled("Entidade / promotor","text");
   entity.maxLength=140;entity.required=true;
   const linked=labeled("Ficha da entidade (associação manual)","select");
   let unlinked=make("option","Sem associação confirmada");unlinked.value="";linked.append(unlinked);
   for(const x of task.matches||[]){
    const option=make("option",x.name+(x.restricted?" · restrição":""));
    option.value=x.id;linked.append(option);
   }
   const artist=labeled("Artista","text");artist.maxLength=110;artist.required=true;
   const examples=make("datalist");examples.id="cc-task-artists-"+task.message_id;
   for(const name of ["WILDCHAINS","Devil of a Woman"]){
    const option=make("option");option.value=name;examples.append(option);
   }
   artist.setAttribute("list",examples.id);form.append(examples);
   const subject=labeled("Proposta / evento","text");subject.maxLength=180;subject.required=true;
   const stage=labeled("Estado depois da revisão","select");
   for(const [key,label] of [
    ["research","Por avaliar"],["draft","Proposta por preparar"],
    ["contact_reported","Contacto referido, por comprovar"],
    ["reply_reported","Resposta referida, por comprovar"],
    ["negotiating","Em negociação"],["declined","Recusado"],
    ["paused","Em pausa"]
   ]){const option=make("option",label);option.value=key;stage.append(option)}
   const owner=labeled("Responsável","text");owner.maxLength=110;
   const next=labeled("Próximo passo","text");next.maxLength=400;next.required=true;
   const due=labeled("Rever em (opcional)","date");
   const proof=make("label",undefined,"cc-task-resolve-consent");
   const checkbox=make("input");checkbox.type="checkbox";checkbox.required=true;
   proof.append(checkbox,make("span","Li a mensagem no Zoho e confirmo esta decisão manual."));
   form.append(proof);
   const controls=make("div",undefined,"cc-task-resolve-controls");
   const submit=make("button","Guardar oportunidade e concluir revisão","cc-primary");
   submit.type="submit";
   const dismiss=btn("Cancelar",()=>box.remove());
   controls.append(submit,dismiss);form.append(controls);
   const feedback=make("p","","cc-lead");feedback.setAttribute("role","status");form.append(feedback);
   let saved=false;
   const updateForm=()=>{
    const selected=similar.find(x=>x.id===choose.value);
    if(selected){
     entity.value=selected.contact_name||"";linked.value=selected.contact_id||"";
     artist.value=selected.artist||"";subject.value=selected.subject||"";
     stage.value=selected.stage||"research";
     // Preserve existing verified states without offering them for new assignments.
     if(!stage.value){
      const option=make("option","Estado já verificado — conservar");option.value=selected.stage;
      stage.append(option);stage.value=selected.stage;
     }
     owner.value=selected.owner||"";next.value=selected.next_step||"";
     due.value=selected.due_date||"";
    }else{
     entity.value=task.association==="unique_candidate"&&task.matches?.[0]?.name||"";
     linked.value="";artist.value="";subject.value="";stage.value="research";
     owner.value="";next.value="";due.value="";
    }
    feedback.textContent="";
   };
   choose.onchange=updateForm;
   updateForm();
   form.onsubmit=async e=>{
    e.preventDefault();if(saved)return;
    if(!checkbox.checked){feedback.textContent="Confirma primeiro a revisão da mensagem.";return}
    const old=similar.find(x=>x.id===choose.value);
    const select=task.matches?.find(x=>x.id===linked.value);
    const newEntry={
     contact_name:select?select.name:entity.value.trim(),
     contact_id:linked.value,
     contact_email:task.external_email||"",
     artist:artist.value.trim(),subject:subject.value.trim(),stage:stage.value,
     priority:"medium",evidence_type:stage.value==="reply_reported"?"user_report":"none",
     evidence_reference:"",fee_amount:null,commission_pct:null,currency:"EUR",
     fee_note:"",conditions:"",event_date:"",press_status:"unknown",press_reference:"",
     advance_status:"unknown",last_contact_date:"",owner:owner.value.trim(),
     next_step:next.value.trim(),due_date:due.value,notes:"",
     origin_label:"Zoho · mensagem "+task.message_id
    };
    const record=old?{
      ...old,
      // Never unlink an existing association just because the current email
      // has no unambiguous matching candidate in this task.
      contact_name:newEntry.contact_id?newEntry.contact_name:old.contact_name,
      contact_id:newEntry.contact_id||old.contact_id,
      artist:newEntry.artist,subject:newEntry.subject,stage:newEntry.stage,
      owner:newEntry.owner,next_step:newEntry.next_step,due_date:newEntry.due_date,
      evidence_type:newEntry.stage==="reply_reported"&&old.evidence_type==="none"?
        "user_report":old.evidence_type,
      notes:(old.notes||"").slice(0,1450)
    }:newEntry;
    // A verified state is not created from an automatic classification.
    if(["confirmed","sent_verified"].includes(record.stage)&&!old){
      feedback.textContent="Confirmações e envios exigem a ficha completa e evidência.";return;
    }
    submit.disabled=true;feedback.textContent="A guardar a decisão humana no booking…";
    try{
     const result=await transport.request("booking",old?"PATCH":"POST",record);
     const payload=await result.json();
     if(!result.ok||!payload.ok)throw Error(payload.error||"Não foi possível guardar booking.");
     saved=true;
     feedback.textContent="Booking guardado. A concluir a revisão da mensagem…";
     const updated=await window.CaravelaMailReviewTasks.update(task.message_id,task.revision,"reviewed","");
     const review=await updated.json();
     if(!updated.ok||!review.ok)throw Error("A oportunidade foi guardada, mas a tarefa continua pendente. Conclui-a manualmente para evitar duplicar o booking.");
     lastData=null;await load();
     window.dispatchEvent(new CustomEvent("caravela-control-booking-updated"));
    }catch(error){feedback.textContent=String(error.message||error);
      if(saved){
       submit.textContent="Oportunidade já guardada";
       submit.disabled=true;
      }
    }finally{if(!saved)submit.disabled=false}
   };
   box.append(form);
  }catch(error){progress.textContent=String(error.message||error)}
 }
 function taskCard(task){
  const article=make("article",undefined,"cc-review-task");
  article.dataset.messageId=task.message_id;
  const top=make("div",undefined,"cc-review-task-head");
  top.append(make("strong",task.external_email||"Remetente desconhecido"),
    make("span",signals[task.signal]||"Sinal por rever","cc-review-task-signal"));
  article.append(top);
  const desc=[topics[task.topic]||"Outro",priorityName(task.signal),
   date(task.message_ms||task.created_ms),association(task)];
  article.append(make("p",desc.join(" · "),"cc-lead"),
    make("p",guidance[task.signal]||"Confirmar manualmente o contexto.","cc-review-task-guidance"));
  const actions=make("div",undefined,"cc-review-task-actions");
  if(task.association==="unique_candidate"&&task.matches?.[0]){
    actions.append(btn("Abrir ficha: "+task.matches[0].name,()=>
      window.dispatchEvent(new CustomEvent("caravela-control-contact-action",{
        detail:{action:"open",id:task.matches[0].id}
      }))));
  }else if(task.matches?.length){
    actions.append(make("small",(task.matches||[]).map(x=>x.name).join(" / ")));
  }
  const mail=document.createElement("a");
  mail.href="https://mail.zoho.eu/zm/#mail/folder/inbox";
  mail.textContent="Consultar no Zoho";mail.target="_blank";mail.rel="noopener noreferrer";
  mail.className="cc-review-task-link";
  actions.append(mail);
  if(task.topic==="booking")
    actions.append(btn("Resolver numa janela",()=>void resolveBookingInPlace(task,article),"cc-primary"));
  actions.append(btn("Revisão concluída",()=>decide(task,"reviewed")),
    btn("Descartar sinal",()=>decide(task,"dismissed")));
  article.append(actions);return article;
 }
 function drawQueue(){
  if(!lastData)return;
  const data=lastData,count=data.counts?.pending||0;
  const term=search.value.trim().toLocaleLowerCase("pt-PT");
  const visible=(data.tasks||[]).filter(x=>
   (filter.value==="all"||x.signal===filter.value)&&
   (!term||[x.external_email,...(x.matches||[]).map(m=>m.name)]
     .some(y=>String(y||"").toLocaleLowerCase("pt-PT").includes(term))));
  items.replaceChildren();
  info.textContent=count+" tarefa"+(count===1?"":"s")+" pendente"+(count===1?"":"s")+
    " · "+(data.counts?.reviewed||0)+" revistas · "+(data.counts?.dismissed||0)+
    " descartadas · "+visible.length+" apresentada"+(visible.length===1?"":"s")+
    ". Sem prazos ou responsáveis presumidos.";
  if(!visible.length){
    items.append(make("p",count?"Nenhuma tarefa corresponde ao filtro.":"Sem tarefas pendentes nesta altura.","cc-lead"));
  }else{
    for(const task of visible)items.append(taskCard(task));
    if(count>data.tasks.length)items.append(make("p","A mostrar as primeiras "+data.tasks.length+
      " tarefas; conclui algumas e atualiza para ver as restantes.","cc-lead"));
  }
 }
 filter.onchange=drawQueue;search.oninput=drawQueue;
 function renderHome(data){
  const count=data.counts?.pending||0;
  homeCount.textContent=count+" pendente"+(count===1?"":"s");
  homePreviews.replaceChildren();
  const preview=(data.tasks||[]).slice().sort((a,b)=>
   (priorities[a.signal]??4)-(priorities[b.signal]??4)||
   (b.message_ms||b.created_ms||0)-(a.message_ms||a.created_ms||0)).slice(0,3);
  if(!count){homePreviews.append(make("p","Sem mensagens a validar.","cc-lead"));return}
  for(const task of preview){
    const name=task.association==="unique_candidate"&&task.matches?.[0]?
      task.matches[0].name:(task.external_email||"Remetente desconhecido");
    const button=btn((signals[task.signal]||"Rever")+" · "+name,()=>openTask(task),"cc-review-home-entry");
    button.title="Abrir esta tarefa na fila de revisão; não altera estados comerciais";
    homePreviews.append(button);
  }
  if(count>preview.length)homePreviews.append(make("small","+"+(count-preview.length)+" tarefas na fila"));
 }
 function render(data){lastData=data;renderHome(data);drawQueue()}
 async function load(){
  if(loading)return;
  const transport=window.CaravelaMailReviewTasks;
  if(!transport){info.textContent="A aguardar sessão privada.";return}
  loading=true;refresh.disabled=true;
  try{
    const response=await transport.list(),data=await response.json();
    if(response.status===403){
      homeCount.textContent="Acesso reservado a gestores";
      info.textContent="Esta fila exige perfil de gestor ou administrador.";
      lastData=null;items.replaceChildren();homePreviews.replaceChildren();return;
    }
    if(response.status===409&&data.error==="review_tasks_migration_required"){
      homeCount.textContent="Migração privada pendente";
      info.textContent="A migração 0006 ainda não está disponível no D1 Preview.";
      lastData=null;items.replaceChildren();homePreviews.replaceChildren();return;
    }
    if(!response.ok||!data.ok)throw Error(data.error||"Não foi possível carregar.");
    render(data);
  }catch(err){
    homeCount.textContent="Fila temporariamente indisponível";
    info.textContent="Não foi possível consultar as tarefas: "+err.message;
  }finally{loading=false;refresh.disabled=false}
 }
 window.addEventListener("caravela-control-view-opened",e=>{
  if(["dashboard","contacts"].includes(e.detail?.view))void load();
 });
 window.addEventListener("caravela-control-authenticated",()=>void load());
 window.addEventListener("caravela-control-token-ready",()=>void load());
 window.addEventListener("caravela-control-signed-out",()=>{
  lastData=null;homeCount.textContent="Sessão terminada";
  homePreviews.replaceChildren();items.replaceChildren();
  info.textContent="Inicia sessão para consultar as tarefas.";
 });
})();
