/* Visible auto-generated review queue. Does not create/send/change anything. */
(()=>{"use strict";
 const home=document.getElementById("cc-view-dashboard");if(!home)return;
 const mk=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const panel=mk("section",undefined,"cc-auto-review-panel");
 panel.append(mk("h2","Sugestões automáticas para validar"),
  mk("p","Com base nas ações históricas: próximas decisões, datas existentes e contactos a reconciliar. Nenhum estado ou prazo é inventado.","cc-lead"));
 const note=mk("p","A consultar fontes…","cc-lead");note.setAttribute("role","status");
 const summary=mk("div",undefined,"cc-auto-review-metrics");
 const list=mk("div",undefined,"cc-auto-review-list");
 const expand=mk("button","Ver mais","cc-neutral");expand.type="button";
 panel.append(note,summary,list,expand);
 const drawer=mk("details",undefined,"cc-auto-review-drawer");
 const trigger=mk("summary","Arquivo histórico por validar · não é uma lista de urgências confirmadas");
 drawer.append(trigger,panel);
 const other=home.querySelector(".cc-home-everything")||home.querySelector(".cc-essential-home")||
  home.querySelector(".cc-panel-head");
 other?.after(drawer);
 let shown=6,items=[],revision=0,working=false;
 const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 function draw(){
  summary.replaceChildren();list.replaceChildren();
  for(const [name,value] of [["Datas antigas por confirmar",items.filter(x=>x.when==="overdue"||x.when==="stale").length],
    ["Data histórica de hoje · validar",items.filter(x=>x.when==="today").length],
    ["Sem data fiável",items.filter(x=>x.when==="date_missing").length]]){
    const b=mk("div",undefined,"cc-auto-review-metric");
    b.append(mk("strong",value),mk("small",name));summary.append(b);
  }
  for(const s of items.slice(0,shown)){
   const card=mk("article",undefined,"cc-auto-review-item");
   card.append(mk("strong",s.title+" · "+(s.artist||"Projeto por confirmar")),
    mk("small",(s.stage==="first"?"Primeiro contacto":"Seguimento")+" · "+(s.due||"data ainda por confirmar")));
   const warning=s.identity_review?"Identidade/contacto por verificar. ":"";
   card.append(mk("p",warning+s.reason+" · "+s.next_step,"cc-lead"));
   const button=mk("button","Rever e preparar","cc-neutral");
   button.type="button";
   button.onclick=()=>window.dispatchEvent(new CustomEvent("caravela-auto-review-open",{detail:{item:s}}));
   card.append(button);list.append(card);
  }
  expand.hidden=items.length<=shown;
  expand.textContent="Mostrar mais ("+(items.length-shown)+")";
  if(!items.length)list.append(mk("p","Sem ações do arquivo adequadas ou pendentes de validação neste momento.","cc-lead"));
 }
 async function refresh(){
  const transport=window.CaravelaNativeTransport;
  if(!transport||working)return;
  const rev=++revision;working=true;
  note.textContent="A relacionar histórico, contactos e negociações…";
  try{
   const result=await Promise.all([transport.request("archive","GET"),
    transport.request("booking","GET"),transport.request("contacts","GET")]);
   if(result.some(x=>!x.ok))throw Error("Fontes de trabalho indisponíveis");
   const [archive,booking,contacts]=await Promise.all(result.map(x=>x.json()));
   if(rev!==revision)return;
   const byId=new Map((archive.contacts||[]).map(x=>[x.id,{...x,contact_policy:"review",
    source_suppressed:!!(x.suppressed||x.control_blocked||x.control_blocked_possible),
    source_shared_email:!!(x.shared_email||x.review_required)}]));
   for(const c of contacts.records||[])byId.set(c.id,{...byId.get(c.id),...c});
   const engine=window.CaravelaAutoReview;
   if(!engine)throw Error("Motor de revisão indisponível");
   const resultData=engine.generate({actions:archive.actions||[],contacts:[...byId.values()],
    bookings:booking.records||[],today:today(),limit:150});
   items=resultData.review;draw();
   trigger.textContent="Arquivo por validar · "+resultData.total+
    " sugestões históricas (não urgências confirmadas)";
   note.textContent=resultData.total+" sugestões do histórico (não são envios autorizados). "+
     resultData.skipped.blocked+" bloqueadas pelas políticas de contacto; "+
     resultData.skipped.duplicate+" repetidas ou já operacionais. "+
     "As respostas recentes do Zoho continuam na fila de revisão.";
  }catch(e){note.textContent="Não foi possível construir as sugestões: "+e.message}
  finally{working=false}
 }
 expand.onclick=()=>{shown+=10;draw()};
 const triggers=["caravela-control-token-ready","caravela-control-authenticated",
  "caravela-control-booking-updated","caravela-control-contacts-updated"];
 for(const event of triggers)window.addEventListener(event,()=>void refresh());
 window.addEventListener("caravela-control-view-opened",e=>{if(e.detail?.view==="dashboard")void refresh()});
 window.addEventListener("caravela-control-signed-out",()=>{items=[];revision++;draw();note.textContent="Sessão terminada"});
})();
