/* Derived actionable review suggestions. No sending, commercial state change, or inferred deadlines. */
(function(root){"use strict";
 const ISO=/^\d{4}-\d{2}-\d{2}$/;
 const valid=v=>{if(!ISO.test(v||""))return "";const d=new Date(v+"T12:00:00Z");
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:""};
 const norm=s=>String(s||"").trim().toLocaleLowerCase("pt-PT").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
 const email=s=>String(s||"").trim().toLowerCase();
 const stage=s=>{const n=norm(s);return n==="por contactar"?"first":
  n==="enviado"?"sent":n==="em conversa"||n==="em negociacao"?"conversation":"other"};
 function find(a,byId,byName){
  const linked=byId.get(a.matched_entity_id);
  if(linked)return {contact:linked,certainty:a.link_status==="verified_name_email"?"verified":"review"};
  const list=(byName.get(norm(a.name))||[]).filter(c=>{
   const e=email(a.email);return !e||!(c.emails||[]).length||(c.emails||[]).some(v=>email(v)===e);
  });
  return list.length===1?{contact:list[0],certainty:"review"}:
   {contact:null,certainty:list.length>1?"ambiguous":"unmatched"};
 }
 function generate({actions=[],contacts=[],bookings=[],today="2026-10-17",limit=80}={}){
  if(!valid(today))throw Error("invalid_worklist_date");
  const byId=new Map(contacts.filter(c=>c?.id).map(c=>[c.id,c])),byName=new Map();
  for(const c of contacts){
   if(!c?.name)continue;
   const key=norm(c.name);if(!byName.has(key))byName.set(key,[]);
   byName.get(key).push(c);
  }
  // Existing bookings, including rejected/closed ones, prevent resurrection of old actions.
  const existing=new Set();
  for(const b of bookings){
   const artist=norm(b.artist),ref=b.contact_id||norm(b.contact_name);
   if(artist&&ref)existing.add(ref+"|"+artist);
  }
  const seen=new Set(),items=[],skipped={blocked:0,duplicate:0,unsuitable:0};
  for(const a of actions){
   if(!a?.id||!a.name){skipped.unsuitable++;continue}
   const key=String(a.id);
   if(seen.has(key)){skipped.duplicate++;continue}seen.add(key);
   const type=stage(a.status);
   if(type==="other"){skipped.unsuitable++;continue}
   const {contact:c,certainty}=find(a,byId,byName);
   const blocked=!!a.no_outreach||a.contact_policy==="blocked"||
    !!c&&(c.contact_policy==="blocked"||c.suppressed||c.control_blocked||
     c.control_blocked_possible||c.source_suppressed||c.shared_email||
     c.source_shared_email||c.duplicate_decision==="secondary"||!!c.canonical_id);
   if(blocked){skipped.blocked++;continue}
   const artist=norm(a.artist),contactId=c?.id||norm(a.name);
   if(existing.has(contactId+"|"+artist)||existing.has(norm(a.name)+"|"+artist)){
    skipped.duplicate++;continue;
   }
   const due=valid(type==="first"?(a.next_action_iso||a.next_followup_iso):
    (a.next_followup_iso||a.next_action_iso));
   const diff=due?Math.round((Date.parse(today+"T12:00:00Z")-Date.parse(due+"T12:00:00Z"))/86400000):null;
   const when=!due?"date_missing":diff>90?"stale":diff>0?"overdue":diff===0?"today":"future";
   const reason=type==="sent"?"Arquivo refere envio; confirmar no Zoho antes de fazer follow-up":
    type==="conversation"?"Arquivo refere conversa; verificar resposta e próximo passo":
    "Arquivo refere primeiro contacto pendente; validar data e destinatário";
   items.push({key:"archive:"+key,source:"historical_action",action_id:key,
    contact_id:c?.id||"",title:c?.name||a.name,artist:String(a.artist||""),
    category:c?.kind||"other",stage:type,when,due,status_source:String(a.status||""),
    reason,next_step:String(a.next_step||"Confirmar dados e preparar contacto"),
    priority:/wildchains|devil/i.test(a.artist||"")?0:1,
    identity_review:certainty!=="verified",identity_reason:certainty,
    kind:type==="first"?"primeiro contacto":"follow-up histórico",
    source_reference:"AÇÕES · linha "+(a.origin?.row||"?"),
    date_provenance:due?"historical_record":"missing"});
  }
  const rank=v=>({overdue:0,today:1,date_missing:2,future:3,stale:4})[v]??5;
  items.sort((a,b)=>a.priority-b.priority||rank(a.when)-rank(b.when)||
   (a.due||"9999").localeCompare(b.due||"9999")||
   a.title.localeCompare(b.title,"pt-PT"));
  return {review:items.slice(0,Math.max(1,Math.min(500,limit))),total:items.length,skipped,
   counts:{overdue:items.filter(x=>x.when==="overdue").length,
    today:items.filter(x=>x.when==="today").length,
    stale:items.filter(x=>x.when==="stale").length,
    needs_date:items.filter(x=>x.when==="date_missing").length,
    needs_identity:items.filter(x=>x.identity_review).length}};
 }
 if(root&&typeof root==="object")root.CaravelaAutoReview=Object.freeze({generate});
})(typeof globalThis!=="undefined"?globalThis:null);
