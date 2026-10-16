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
 const caveats=make("p","Os sinais das conversas são classificações automáticas para revisão. O texto integral não fica guardado no CRM. Nenhuma resposta confirma, por si só, um concerto ou uma autorização de envio.","cc-lead");
 box.append(head,status,metrics,content,caveats);
 // The detailed reconciliation assistant is available on demand, not before
 // the primary contact directory or the pending-message work queue.
 const native=document.getElementById("cc-native-contacts");
 const drawer=document.createElement("details");drawer.className="cc-archive-toggle cc-suggestions-drawer";
 drawer.append(make("summary","Sugestões avançadas · duplicados e correspondências Zoho"),box);
 if(native)native.after(drawer);else container.append(drawer);
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
   ["Novos endereços",data.counts.new_mail_addresses],["Conversas bilaterais",data.counts.verified_exchange_threads],
   ["Entradas a rever",data.counts.incoming_to_review],
   ["Duplicados possíveis",data.counts.duplicate_groups],["Emails partilhados",data.counts.shared_email_groups],
   ["Ações por associar",data.counts.unresolved_actions],["Contactos em atraso",data.counts.overdue]
  ];
  for(const [label,num] of labels){const cell=make("div",undefined,"cc-review-metric");
   cell.append(make("small",label),make("strong",num));metrics.append(cell)}
  if(!data.archive_active)content.append(make("p","O arquivo consolidado ainda não está ativo. As sugestões estão incompletas.","cc-notice"));
  content.append(make("p","Metadados Zoho indexados: "+data.indexed_headers+" mensagens. Última sincronização concluída: "+
    date(data.zoho_last_sync_ms)+". Os totais representam o índice disponível; não garantem cobertura integral da caixa.","cc-lead"));
  const intelligence=data.mail_intelligence||{};
  if(!intelligence.enabled){
    content.append(make("p","A interpretação de conteúdo Zoho ainda não foi ativada na infraestrutura. A revisão por metadados continua disponível.","cc-lead"));
  }else if(!intelligence.schema_ready){
    content.append(make("p","A análise de conteúdo necessita da migração privada 0005 na base de dados Preview.","cc-notice"));
  }
  const topics={booking:"Booking",partnership:"Parceria",press:"Imprensa",other:"Outro",unclear:"Não classificado"};
  const signals={interest:"Possível interesse",decline:"Possível recusa",
    possible_confirmation:"Possível confirmação — rever comprovativo",
    needs_reply:"Pergunta comercial a rever",ambiguous:"Sem conclusão segura",none:"Sem sinal"};
  section("Sinais detetados no conteúdo · validar","Classificação por regras simples, sem acesso automático à decisão comercial. Abre a ficha e confirma o email na caixa Zoho antes de alterar qualquer estado.",
    intelligence.signals||[],(place,x)=>{
      const title=(x.external_email||"Remetente por identificar")+" · "+(topics[x.topic]||"Outro");
      const desc=(signals[x.signal]||"Sinal por confirmar")+" · "+
        (x.message_ms?date(x.message_ms):"Data não disponível")+
        " · "+(x.matched_contacts?.length?x.matched_contacts.map(y=>y.name).join(" / "):"Sem ficha associada");
      const actions=card(place,title,desc);
      for(const c of (x.matched_contacts||[]).slice(0,3))actions.append(button("Rever "+c.name,()=>open(c.id)));
      if(!x.matched_contacts?.length&&x.external_email)
        actions.append(button("Associar à entidade",()=>action({action:"attach",email:x.external_email})));
    });
  section("Conversas bilaterais identificadas","Uma saída seguida de entrada no mesmo fio Zoho. Só propomos autorização a endereços ligados a uma única entidade sem bloqueios; confirma a finalidade da conversa.",
    data.verified_exchanges,(place,x)=>{
    const actions=card(place,x.contact.name+" · "+x.email,
      "Troca observada no Zoho · última entrada "+date(x.last_in)+
      (x.contact.contact_policy==="allowed"?" · Contacto já autorizado":" · Por validar"));
    if(x.contact.contact_policy!=="allowed")
      actions.append(button("Rever e autorizar",()=>action({action:"approve",
        id:x.contact.id,email:x.email,thread_id:x.thread_id})));
    else actions.append(button("Abrir ficha",()=>open(x.contact.id)));
  });
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