/* Essential daily dashboard: actionable and evidence-aware; old queues stay accessible.
 * No automatic sending, state changes or inferred deadlines. */
(()=>{"use strict";
 const view=document.getElementById("cc-view-dashboard");
 if(!view)return;
 const mk=(tag,t,cls)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=String(t);if(cls)x.className=cls;return x};
 const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const panel=mk("section",undefined,"cc-essential-home");
 panel.append(mk("h2","Prioridades de hoje"),mk("p","Só o trabalho que exige atenção. As oportunidades históricas continuam por confirmar.","cc-lead"));
 const columns=mk("div",undefined,"cc-essential-grid");panel.append(columns);
 let presses=[];
 function linkTo(viewId,title){const b=mk("button",title,"cc-neutral");b.type="button";
  b.onclick=()=>window.CaravelaControlApp?.openView(viewId);return b}
 const slots={};
 for(const [id,title,viewId,button] of [
  ["follow","Follow-ups","booking","Abrir Booking"],
  ["now","A contactar agora","booking","Ver Festivais e Venues"],
  ["opps","Candidaturas abertas","opportunities","Abrir Radar"],
  ["press","Imprensa a preparar","press","Abrir Imprensa"]
 ]){
  const card=mk("section",undefined,"cc-essential-card");
  const heading=mk("div",undefined,"cc-essential-card-head");
  heading.append(mk("h3",title),linkTo(viewId,button));
  const count=mk("span","","cc-essential-count"),list=mk("div",undefined,"cc-essential-items");
  card.append(heading,count,list);columns.append(card);slots[id]={count,list};
 }
 view.querySelector(".cc-panel-head")?.after(panel);
 const archiveDrawer=mk("details",undefined,"cc-home-everything");
 archiveDrawer.append(mk("summary","Mais tarefas: respostas Zoho, arquivo e outras áreas"));
 // Existing modules are rearranged after scripts have initialised; their
 // asynchronous status updates continue to target the very same DOM nodes.
 for(const selector of [".cc-review-tasks-home",".cc-native-dashboard",".cc-dashboard-attention"]){
  const node=view.querySelector(selector);if(node)archiveDrawer.append(node);
 }
 panel.after(archiveDrawer);
 const statusLine=mk("p","","cc-lead");panel.append(statusLine);
 function item(label,note,viewId){
  const card=mk("div",undefined,"cc-essential-item");
  card.append(mk("strong",label),mk("small",note));
  card.append(linkTo(viewId,"Ver detalhes"));return card;
 }
 function fill(id,values,empty){const slot=slots[id];slot.list.replaceChildren();slot.count.textContent=values.length?values.length+" itens":"";
  for(const v of values.slice(0,5))slot.list.append(item(...v));
  if(!values.length)slot.list.append(mk("p",empty,"cc-lead"));
 }
 function pressSection(){
  const items=[];
  for(const s of presses?.suggestions||[]){
   const local=s.city?" · "+s.city:"";
   items.push([s.title+" · "+s.artist,
    "Press sugerido: "+(s.contacts||[]).slice(0,3).map(x=>x.name).join(", ")+local,"press"]);
  }
  for(const p of presses?.campaigns||[]){
   if(p.kind==="release")items.push([p.title+" · "+p.artist,"Lançamento "+p.event_date+" · "+p.next_step,"press"]);
  }
  fill("press",items,"Nenhuma ação de imprensa registada. Adiciona um lançamento ou confirma um concerto.");
 }
 async function load(){
  const t=window.CaravelaNativeTransport;if(!t)return;
  statusLine.textContent="A consultar o trabalho operacional…";
  try{
   const [book,contacts,archive,opps]=await Promise.all([
    t.request("booking"),t.request("contacts"),t.request("archive"),t.request("opportunities")
   ]);
   if(!book.ok||!contacts.ok||!opps.ok)throw Error("Dados operacionais indisponíveis");
   const [b,c,o]=await Promise.all([book.json(),contacts.json(),opps.json()]);
   const arc=archive.ok?await archive.json():{contacts:[],actions:[]};
   const live=b.records||[],merged=new Map((arc.contacts||[]).map(x=>[x.id,{
    ...x,contact_policy:"review",source_shared_email:!!x.shared_email,
    source_suppressed:!!(x.suppressed||x.control_blocked||x.control_blocked_possible),
    contact_window_target:"unknown"
   }]));
   for(const c0 of c.records||[])merged.set(c0.id,{...merged.get(c0.id),...c0});
   const contactsAll=[...merged.values()],stamp=today();
   const follow=live.filter(x=>["sent_verified","contact_reported","reply_reported","negotiating"].includes(x.stage))
     .sort((a,b)=>(a.due_date||"9999").localeCompare(b.due_date||"9999"))
     .map(x=>[x.contact_name+" · "+x.artist,
      (x.due_date?"Rever "+x.due_date:"Prazo por definir")+" · "+(x.next_step||"Verificar resposta"),"booking"]);
   fill("follow",follow,"Sem follow-ups operacionais. As respostas Zoho por rever estão em «Mais tarefas».");
   const board=window.CaravelaBookingBoard?.classify({
    bookings:live,contacts:contactsAll,actions:arc.actions||[],year:2027,today:stamp
   });
   const ready=board?.festival?.now||[];
   fill("now",ready.map(x=>[(x.contact?.name||x.record?.contact_name)+" · "+(x.artists?.join(" + ")||"Banda a escolher"),
     x.window?.from?"Janela 2027: "+x.window.from+"–"+x.window.to:"Contacto por rever","booking"]),
     "Nenhuma janela de abordagem a 2027 validada para hoje. Há mais contactos por calendarizar no Booking.");
   const opened=(o.records||[]).filter(x=>window.CaravelaOpportunityCheck?.open(x,stamp))
     .sort((a,b)=>a.deadline.localeCompare(b.deadline));
   fill("opps",opened.map(x=>[x.title,x.provider+" · prazo "+x.deadline+" · abertura verificada "+x.open_verified_on,"opportunities"]),
     "Sem candidaturas oficialmente abertas e confirmadas recentemente no Radar.");
   pressSection();
   statusLine.textContent="Vista resumida. O histórico por verificar não é tratado como negociação confirmada.";
  }catch(e){statusLine.textContent="Não foi possível atualizar as prioridades: "+e.message}
 }
 window.addEventListener("caravela-control-press-context",e=>{presses=e.detail||[];pressSection()});
 for(const ev of ["caravela-control-token-ready","caravela-control-authenticated","caravela-control-booking-updated","caravela-control-contacts-updated"])
  window.addEventListener(ev,()=>void load());
 window.addEventListener("caravela-control-view-opened",e=>{if(e.detail?.view==="dashboard")void load()});
 window.addEventListener("caravela-control-signed-out",()=>{for(const id of Object.keys(slots))fill(id,[],"Inicia sessão");statusLine.textContent="Sessão terminada"});
})();
