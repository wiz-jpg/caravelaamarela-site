/* Caravela Control Preview — human validation inbox, no commercial automation. */
(()=>{"use strict";
 const home=document.getElementById("cc-view-dashboard");
 const contacts=document.getElementById("cc-view-contacts");
 if(!home||!contacts)return;
 const make=(tag,value,cls)=>{
  const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);
  if(cls)x.className=cls;return x;
 };
 const compact=make("section",undefined,"cc-review-tasks-home");
 compact.append(make("strong","Tarefas por validar · Zoho"));
 const homeCount=make("span","A verificar…");
 const homeOpen=make("button","Abrir fila de revisão","cc-neutral");homeOpen.type="button";
 homeOpen.onclick=()=>window.CaravelaControlApp?.openView("contacts");
 compact.append(homeCount,homeOpen);
 const homeStatus=home.querySelector(".cc-mail-automation-status");
 if(homeStatus)homeStatus.after(compact);else home.querySelector(".cc-panel-head")?.after(compact);
 const panel=make("section",undefined,"cc-review-tasks-panel");
 const heading=make("div",undefined,"cc-review-tasks-heading");
 const left=make("div");left.append(make("h2","Tarefas pendentes de validação"),
  make("p","Criadas automaticamente a partir de mensagens recebidas no Zoho. Cada decisão é humana e não altera o estado comercial.","cc-lead"));
 const refresh=make("button","Atualizar fila","cc-neutral");refresh.type="button";
 heading.append(left,refresh);
 const info=make("p","A aguardar ligação privada.","cc-lead");info.setAttribute("role","status");
 const items=make("div",undefined,"cc-review-tasks-items");
 const foot=make("p","Rever sempre a mensagem original no Zoho. Um sinal não comprova uma proposta aceite, recusa definitiva ou autorização para contactar.","cc-lead");
 panel.append(heading,info,items,foot);
 const reviewSection=contacts.querySelector(".cc-contact-assistant");
 if(reviewSection)reviewSection.before(panel);
 else contacts.querySelector(".cc-panel-head")?.after(panel);
 const topics={booking:"Booking",partnership:"Parceria",press:"Imprensa"};
 const signals={possible_confirmation:"Possível confirmação",needs_reply:"Pergunta a responder",
  interest:"Possível interesse",decline:"Possível recusa"};
 let loading=false;
 const date=x=>x?new Date(x).toLocaleString("pt-PT",{dateStyle:"short",timeStyle:"short"}):"Data desconhecida";
 function btn(label,onclick,css="cc-neutral"){
  const b=make("button",label,css);b.type="button";b.onclick=onclick;return b;
 }
 function contactButton(contact){
  return btn("Abrir ficha: "+contact.name,()=>
    window.dispatchEvent(new CustomEvent("caravela-control-contact-action",{detail:{action:"open",id:contact.id}})));
 }
 async function decide(task,status){
  const verb=status==="reviewed"?"Concluir a revisão":"Descartar este sinal";
  if(!window.confirm(verb+"? Esta ação fecha apenas a tarefa, não altera o contacto ou o booking."))return;
  try{
    info.textContent="A guardar revisão humana…";
    const response=await window.CaravelaMailReviewTasks.update(task.message_id,task.revision,status,"");
    const result=await response.json();
    if(!response.ok||!result.ok)throw Error(result.error||"Não foi possível guardar.");
    await load();
  }catch(err){info.textContent="Não foi possível concluir a revisão: "+err.message+"; atualiza a fila."}
 }
 function taskCard(task){
  const article=make("article",undefined,"cc-review-task");
  const heading=make("div",undefined,"cc-review-task-head");
  heading.append(make("strong",task.external_email||"Remetente desconhecido"),
    make("span",signals[task.signal]||"Sinal para revisão","cc-review-task-signal"));
  article.append(heading,
    make("p",(topics[task.topic]||"Outros")+" · "+date(task.message_ms||task.created_ms)+" · "+
    (task.association==="unique_candidate"?"Uma ficha candidata":
     task.association==="shared_email"?"Email associado a várias entidades — escolher manualmente":
     task.association==="restricted"?"Contacto com restrições — não contactar automaticamente":
     "Sem associação inequívoca"),"cc-lead"));
  const actions=make("div",undefined,"cc-review-task-actions");
  if(task.association==="unique_candidate"&&task.matches?.[0])
    actions.append(contactButton(task.matches[0]));
  else if(task.association==="shared_email"||task.association==="restricted"){
    const names=(task.matches||[]).map(x=>x.name).join(" / ");
    actions.append(make("small",names||"Rever identidade e restrições"));
  }
  const mail=document.createElement("a");mail.href="https://mail.zoho.eu/zm/#mail/folder/inbox";
  mail.textContent="Consultar Zoho";mail.target="_blank";mail.rel="noopener noreferrer";
  mail.className="cc-review-task-link";
  actions.append(mail,btn("Revisão concluída",()=>decide(task,"reviewed"),"cc-neutral"),
    btn("Descartar sinal",()=>decide(task,"dismissed"),"cc-neutral"));
  article.append(actions);return article;
 }
 function render(data){
  const count=data.counts?.pending||0;
  homeCount.textContent=count+" pendente"+(count===1?"":"s")+" de revisão";
  items.replaceChildren();
  info.textContent=count+" tarefa"+(count===1?"":"s")+" pendente"+(count===1?"":"s")+
    " · "+(data.counts?.reviewed||0)+" revistas · "+(data.counts?.dismissed||0)+
    " descartadas. As tarefas não são ações comerciais confirmadas.";
  if(!data.tasks?.length){
    items.append(make("p","Sem tarefas pendentes. A sincronização continua a verificar novas mensagens.","cc-lead"));
    return;
  }
  for(const item of data.tasks)items.append(taskCard(item));
  if(count>data.tasks.length)items.append(make("p","A apresentar as primeiras "+
    data.tasks.length+" tarefas. Conclui algumas e atualiza para ver as restantes.","cc-lead"));
 }
 async function load(){
  if(loading)return;
  const transport=window.CaravelaMailReviewTasks;
  if(!transport){info.textContent="A aguardar sessão.";return}
  loading=true;refresh.disabled=true;
  try{
    const response=await transport.list(),data=await response.json();
    if(response.status===403){
      homeCount.textContent="Disponível apenas para gestores";
      info.textContent="Esta fila exige perfil de gestor ou administrador.";
      items.replaceChildren();return;
    }
    if(response.status===409&&data.error==="review_tasks_migration_required"){
      homeCount.textContent="Migração privada pendente";
      info.textContent="Falta aplicar a migração 0006 na base D1 do Preview. Não foram criadas tarefas.";
      items.replaceChildren();return;
    }
    if(!response.ok||!data.ok)throw Error(data.error||"Não foi possível carregar.");
    render(data);
  }catch(err){
    homeCount.textContent="Fila indisponível";
    info.textContent="Não foi possível consultar as tarefas: "+err.message;
  }finally{loading=false;refresh.disabled=false}
 }
 refresh.onclick=()=>void load();
 window.addEventListener("caravela-control-view-opened",e=>{
  if(["dashboard","contacts"].includes(e.detail?.view))void load();
 });
 window.addEventListener("caravela-control-authenticated",()=>void load());
 window.addEventListener("caravela-control-token-ready",()=>void load());
 window.addEventListener("caravela-control-signed-out",()=>{
  homeCount.textContent="Sessão terminada";items.replaceChildren();info.textContent="Inicia sessão para consultar a fila.";
 });
})();
