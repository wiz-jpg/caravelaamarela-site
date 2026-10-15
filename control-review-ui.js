/* Contact intelligence workspace: privacy-preserving, review before write.
 * Uses metadata and immutable history, not read or interpretation of email bodies. */
(()=>{"use strict";
 const container=document.getElementById("cc-view-contacts");
 if(!container)return;
 const make=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
 const box=make("section",undefined,"cc-contact-assistant");
 const head=make("div",undefined,"cc-review-head");
 const title=make("div");title.append(make("h2","Sugestões para rever"),
   make("p","Cruzamento do arquivo, das fichas editáveis e dos endereços observados no Zoho. Sem fusões, envios ou decisões automáticas.","cc-lead"));
 const controls=make("div",undefined,"cc-review-controls");
 const refresh=make("button","Analisar base","cc-neutral");refresh.type="button";
 const sync=make("button","Sincronizar Zoho + analisar","cc-primary");sync.type="button";
 controls.append(refresh,sync);head.append(title,controls);
 const status=make("p",undefined,"cc-lead");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 const metrics=make("div",undefined,"cc-review-metrics");
 const content=make("div",undefined,"cc-review-sections");
 const caveats=make("p","A sincronização do Zoho atualiza somente remetentes, destinatários e datas: assuntos e texto dos emails ainda não são interpretados. Uma mensagem recebida não significa interesse confirmado.","cc-lead");
 box.append(head,status,metrics,content,caveats);
 const native=document.getElementById("cc-native-contacts");
 const originalReview=container.querySelector(".cc-contact-triage");
 if(originalReview){
  const archived=document.createElement("details");archived.className="cc-archive-toggle";
  archived.append(make("summary","Revisão manual anterior · prazos e relações já registadas"));
  originalReview.before(archived);archived.append(originalReview);
  archived.before(box);
 }else if(native)native.before(box);else container.append(box);
 let busy=false,loaded=false;
 const date=ms=>ms?new Date(ms).toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"}):"sem data confirmada";
 const action=(payload)=>window.dispatchEvent(new CustomEvent("caravela-control-contact-action",{detail:payload}));
 const open=id=>action({action:"open",id});
 function button(label,cb,cls="cc-neutral"){
  const x=make("button",label,cls);x.type="button";x.onclick=cb;return x;
 }
 function card(parent,title,description){
  const item=make("div",undefined,"cc-review-item");
  item.append(make("strong",title));
  if(description)item.append(make("p",description,"cc-lead"));
  const actions=make("div",undefined,"cc-review-item-actions");
  item.append(actions);parent.append(item);return actions;
 }
 function section(title,description,items,renderer){
  if(!items?.length)return;
  const details=make("details",undefined,"cc-contact-review-group cc-review-group");
  const sum=make("summary",title+" · "+items.length);details.append(sum);
  if(description)details.append(make("p",description,"cc-lead"));
  const list=make("div",undefined,"cc-review-items");
  const limit=12;let shown=0;
  const more=button("Mostrar mais",()=>draw());
  function draw(){const next=Math.min(shown+limit,items.length);for(let i=shown;i<next;i++)renderer(list,items[i]);shown=next;more.hidden=shown>=items.length}
  draw();details.append(list,more);content.append(details);
 }
 function render(data){
  metrics.replaceChildren();content.replaceChildren();
  const labels=[
   ["Novos endereços",data.counts.new_mail_addresses],["Entradas a rever",data.counts.incoming_to_review],
   ["Duplicados possíveis",data.counts.duplicate_groups],["Emails partilhados",data.counts.shared_email_groups],
   ["Ações por associar",data.counts.unresolved_actions],["Contactos em atraso",data.counts.overdue]
  ];
  for(const [label,num] of labels){const cell=make("div",undefined,"cc-review-metric");
   cell.append(make("small",label),make("strong",num));metrics.append(cell)}
  if(!data.archive_active)content.append(make("p","O arquivo consolidado ainda não está ativo. As sugestões estão incompletas.","cc-notice"));
  content.append(make("p","Mensagens indexadas: "+data.indexed_headers+
    ". Sugestões visíveis abaixo são amostras ordenadas; os totais contam todos os casos analisados. Não são tarefas automaticamente vencidas.","cc-lead"));
  section("Endereços novos observados no Zoho","O endereço ainda não aparece nas fichas. Pode pertencer a uma entidade existente; confirma antes de criar outra.",
    data.new_addresses,(place,x)=>{
    const actions=card(place,x.email,(x.incoming?"Entradas: "+x.incoming+" · ":"")+
      "Saídas: "+x.outgoing+" · Última observação "+date(Math.max(x.last_in_ms||0,x.last_out_ms||0)));
    actions.append(button("Adicionar a ficha existente",()=>action({action:"attach",email:x.email})));
    actions.append(button("Preparar nova ficha",()=>action({action:"new",email:x.email})));
  });
  section("Mensagens de entrada por rever","A entrada é posterior à última saída observada, ou não há saída indexada. Não significa necessariamente que exista um follow-up pendente.",
    data.recent_incoming,(place,x)=>{
    const names=x.linked.map(c=>c.name).join(" / ");
    const actions=card(place,x.email+" · "+names,"Última entrada observada "+date(x.last_in_ms)+
      " · "+x.incoming+" entradas indexadas");
    for(const c of x.linked.slice(0,3))actions.append(button("Rever "+c.name,()=>open(c.id)));
  });
  section("Possíveis duplicados por nome e categoria","Rever fichas semelhantes. Emails partilhados sozinhos não são prova de identidade.",
    data.duplicate_groups,(place,group)=>{
    const text=group.map(x=>x.name+(x.city?" ("+x.city+")":"")).join(" / ");
    const actions=card(place,text,"Mesmo tipo de entidade · "+group.length+" fichas");
    for(const x of group.slice(0,5))actions.append(button("Rever ficha",()=>open(x.id)));
  });
  section("Endereços partilhados por entidades","Um mesmo promotor pode representar vários festivais. Preservar os eventos e verificar o interlocutor.",
    data.shared_email_groups,(place,x)=>{
    const actions=card(place,x.email,x.entities.map(y=>y.name).join(" · "));
    for(const y of x.entities.slice(0,4))actions.append(button("Abrir "+y.name,()=>open(y.id)));
  });
  section("Ações comerciais sem ligação verificada","O histórico não prova que uma proposta foi enviada nem a sua associação correta.",
    data.actions_to_review,(place,x)=>{
    const actions=card(place,x.name+" · "+(x.artist||"projeto a validar"),
      (x.status||"Estado por confirmar")+" · "+(x.matched===1?"Email encontra uma ficha, mas a associação não foi aprovada":x.matched+" fichas com este email"));
    actions.append(button("Consultar no arquivo",()=>{
      window.CaravelaControlApp?.openView("booking");
      const search=document.getElementById("cc-native-history-search");
      const history=document.getElementById("cc-native-booking-history-wrap");
      if(history?.parentElement?.tagName==="DETAILS")history.parentElement.open=true;
      if(search){search.value=x.name;search.dispatchEvent(new Event("input"))}
      history?.scrollIntoView({behavior:"smooth",block:"start"});
    }));
  });
  section("Contactos com revisão vencida","Apenas datas explícitas em fichas operacionais.",
    data.overdue,(place,x)=>{
    const actions=card(place,x.name,x.review_date+" · "+(x.kind||"sem categoria"));
    actions.append(button("Abrir ficha",()=>open(x.id)));
  });
  section("Tipo ainda por classificar","Não deduzir a categoria a partir do domínio sem outras provas.",
    data.unclassified,(place,x)=>{
    const actions=card(place,x.name,x.emails.join(", "));
    actions.append(button("Classificar",()=>open(x.id)));
  });
  section("Localização incompleta","Corrigir apenas quando exista fonte ou informação fidedigna.",
    data.missing_geography,(place,x)=>{
    const actions=card(place,x.name,x.kind||"Tipo não registado");
    actions.append(button("Rever localização",()=>open(x.id)));
  });
  if(!content.querySelector("details"))content.append(make("p","Não há sugestões adicionais para apresentar. Os dados continuam sujeitos a validação manual.","cc-lead"));
 }
 async function request(runSync=false){
  if(busy)return;
  const transport=window.CaravelaContactReview;
  if(!transport){status.textContent="O módulo privado ainda não está pronto. Reabre a página.";return}
  busy=true;refresh.disabled=true;sync.disabled=true;
  status.textContent=runSync?"A ler novos metadados Zoho…":"A preparar sugestões…";
  try{
   if(runSync){
    const res=await transport.sync();
    const out=await res.json();
    if(!res.ok||!out.ok)throw Error("Sincronização Zoho indisponível ("+(out.error||res.status)+")");
   }
   const res=await transport.request(),body=await res.json();
   if(!res.ok||!body.ok)throw Error("Não foi possível analisar a base ("+(body.error||res.status)+")");
   render(body);loaded=true;
   status.textContent="Análise concluída. "+body.counts.contacts+" entidades identificadas. Nenhuma alteração aplicada.";
  }catch(error){
   status.textContent=error.message+". Os contactos anteriores não foram alterados.";
  }finally{busy=false;refresh.disabled=false;sync.disabled=false}
 }
 refresh.onclick=()=>request();
 sync.onclick=()=>request(true);
 window.addEventListener("caravela-control-view-opened",e=>{
  if(e.detail?.view==="contacts"&&!loaded)void request();
 });
 window.addEventListener("caravela-control-signed-out",()=>{
  loaded=false;content.replaceChildren();metrics.replaceChildren();status.textContent="";
 });
})();