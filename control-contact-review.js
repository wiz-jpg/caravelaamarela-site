/* Contact reconciliation suggestions — Preview only; no writes, no mailbox content. */
import {nativeArchive,handleNative} from "./control-native.js";
const MAILBOX="booking@caravelaamarela.com";
const clean=x=>typeof x==="string"?x.trim():"";
const norm=x=>clean(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-PT").replace(/[^a-z0-9]+/g," ").trim();
const email=x=>clean(x).toLowerCase();
const properMail=x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
const maxDate=x=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
const candidates = (map,key,record)=>{let v=map.get(key);if(!v){v=new Map();map.set(key,v)}v.set(record.id,record)};
const today = now=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
function parseRecipients(value){
  try{const values=typeof value==="string"?JSON.parse(value):value;
    return Array.isArray(values)?values.slice(0,50).map(email).filter(properMail):[];
  }catch{return []}
}
const identity=x=>({id:x.id,name:x.name,kind:x.kind,city:x.city||"",country:x.country||"",
   emails:x.emails||[],review_date:x.review_date||"",contact_policy:x.contact_policy||"review",
   relationship:x.relationship||"unknown",duplicate_decision:x.duplicate_decision||"unreviewed",
   canonical_id:x.canonical_id||"",historical:!!x.historical});
export function reviewContacts({archive=[],working=[],headers=[],actions=[],asOf=Date.now()}={}){
  const merged=new Map();
  for(const x of archive)if(x?.id&&x?.name)merged.set(x.id,{...x,historical:true});
  for(const x of working)if(x?.id&&x?.name)merged.set(x.id,{...merged.get(x.id),...x,historical:merged.has(x.id)});
  const contacts=[...merged.values()];
  const names=new Map(),emails=new Map();
  for(const contact of contacts){
    const city=norm(contact.city);
    const identifier=[contact.kind||"other",norm(contact.name),city].join("|");
    if(norm(contact.name))candidates(names,identifier,contact);
    for(const addr of new Set((contact.emails||[]).map(email).filter(properMail)))candidates(emails,addr,contact);
  }
  const allowed=x=>x.duplicate_decision!=="distinct"&&x.duplicate_decision!=="secondary"&&!x.canonical_id;
  const duplicateGroups=[...names.values()].map(group=>[...group.values()].filter(allowed))
    .filter(group=>group.length>1).sort((a,b)=>b.length-a.length);
  const sharedEmails=[...emails.entries()].filter(([,items])=>items.size>1)
    .sort((a,b)=>b[1].size-a[1].size);
  const seen=new Map();
  for(const head of headers){
    const direction=head.folder_kind==="incoming"?"incoming":head.folder_kind==="outgoing"?"outgoing":null;
    if(!direction)continue;
    let addresses=direction==="incoming"?[email(head.from_email)]:parseRecipients(head.to_json);
    const ms=maxDate(head.received_ms)||maxDate(head.first_seen_ms);
    for(const addr of new Set(addresses)){
      if(!properMail(addr)||addr===MAILBOX||/^(no-?reply|donotreply|postmaster|mailer-daemon)@/.test(addr))continue;
      const old=seen.get(addr)||{email:addr,incoming:0,outgoing:0,last_in_ms:null,last_out_ms:null};
      old[direction]+=1;
      const key=direction==="incoming"?"last_in_ms":"last_out_ms";
      if(ms!==null)old[key]=Math.max(old[key]||0,ms);
      seen.set(addr,old);
    }
  }
  // Stronger evidence than a simple inbox hit: exact sender and recipient
  // share one provider thread, and a later inbound message follows an outgoing one.
  const exchanges=new Map();
  for(const head of headers){
    const thread=clean(head.thread_id);
    const at=maxDate(head.received_ms);
    if(!thread||at===null)continue;
    const direction=head.folder_kind==="incoming"?"incoming":head.folder_kind==="outgoing"?"outgoing":null;
    if(!direction)continue;
    const addresses=direction==="incoming"?[email(head.from_email)]:parseRecipients(head.to_json);
    for(const addr of new Set(addresses)){
      if(!properMail(addr)||addr===MAILBOX)continue;
      const key=thread+"|"+addr;
      const old=exchanges.get(key)||{thread_id:thread,email:addr,first_out:null,last_in:null};
      if(direction==="outgoing")old.first_out=Math.min(old.first_out??at,at);
      else old.last_in=Math.max(old.last_in??at,at);
      exchanges.set(key,old);
    }
  }
  const verifiedExchanges=[];
  for(const x of exchanges.values()){
    if(x.first_out===null||x.last_in===null||x.last_in<x.first_out)continue;
    const records=[...(emails.get(x.email)?.values()||[])];
    if(records.length!==1)continue;
    const target=records[0];
    if(target.suppressed||target.control_blocked||target.control_blocked_possible||
       target.shared_email||target.contact_policy==="blocked")continue;
    verifiedExchanges.push({...x,contact:identity(target)});
  }
  verifiedExchanges.sort((a,b)=>b.last_in-a.last_in);
  const newAddresses=[],recentIncoming=[];
  for(const row of seen.values()){
    const linked=[...(emails.get(row.email)?.values()||[])].map(identity);
    const item={...row,linked};
    if(!linked.length)newAddresses.push(item);
    else if(row.incoming>0&&row.last_in_ms!==null&&
       (row.last_out_ms===null||row.last_in_ms>row.last_out_ms))recentIncoming.push(item);
  }
  const recency=(a,b)=>Math.max(b.last_in_ms||0,b.last_out_ms||0)-Math.max(a.last_in_ms||0,a.last_out_ms||0);
  newAddresses.sort(recency);recentIncoming.sort(recency);
  const unresolvedActions=[];
  for(const action of actions){
    if(action.matched_entity_id||action.link_status==="linked")continue;
    const targetEmail=email(action.email);
    const matching=targetEmail?(emails.get(targetEmail)?.size||0):0;
    unresolvedActions.push({name:clean(action.name),artist:clean(action.artist),
      status:clean(action.status),email:targetEmail,matched:matching});
  }
  const date=today(asOf);
  const due=contacts.filter(x=>x.review_date&&x.review_date<date);
  const now=contacts.filter(x=>x.review_date===date);
  const later=contacts.filter(x=>x.review_date&&x.review_date>date);
  const missingType=contacts.filter(x=>!x.kind||x.kind==="other");
  const missingGeography=contacts.filter(x=>!x.country&&!x.region&&!x.city);
  const displayGroup=group=>group.map(x=>identity(x));
  return {ok:true,as_of_ms:asOf,kind:"suggestions_only",source:"immutable_archive_native_records_zoho_headers",
    limits:["O índice do Zoho não contém assunto nem corpo; atividade de entrada não significa acordo ou resposta a proposta.",
      "A presença de um email partilhado não comprova duplicação. Nenhuma associação ou estado foi alterado.",
      "Contactos sem prazo explícito não são automaticamente classificados como atrasados.",
      "Uma troca bidirecional no mesmo thread prova interação observada, não consentimento de marketing nem acordo."],
    counts:{contacts:contacts.length,working:working.length,duplicate_groups:duplicateGroups.length,
      shared_email_groups:sharedEmails.length,new_mail_addresses:newAddresses.length,
      incoming_to_review:recentIncoming.length,verified_exchange_threads:verifiedExchanges.length,
      unresolved_actions:unresolvedActions.length,
      overdue:due.length,today:now.length,scheduled:later.length,
      type_unclassified:missingType.length,location_missing:missingGeography.length,
      partners:contacts.filter(x=>x.relationship==="partner").length,
      partnership_targets:contacts.filter(x=>x.relationship==="target").length},
    duplicate_groups:duplicateGroups.slice(0,75).map(displayGroup),
    shared_email_groups:sharedEmails.slice(0,65).map(([addr,items])=>({email:addr,entities:displayGroup([...items.values()])})),
    new_addresses:newAddresses.slice(0,60),recent_incoming:recentIncoming.slice(0,50),
    verified_exchanges:verifiedExchanges.slice(0,60),
    actions_to_review:unresolvedActions.slice(0,65),unclassified:missingType.slice(0,50).map(identity),
    overdue:due.slice(0,45).map(identity),
    missing_geography:missingGeography.slice(0,45).map(identity),
    indexed_headers:headers.length};
}
export async function contactReviewHandler(request,env,url){
  if(request.method!=="GET")return Response.json({ok:false,error:"method_not_allowed"},{status:405});
  if(!env.ZOHO_DB)return Response.json({ok:false,error:"storage_unavailable"},{status:503});
  try{
    const nativeUrl=new URL("/api/control/native/contacts",url);
    const [archived,native,mails,lastZoho]=await Promise.all([
      nativeArchive(env),
      handleNative(new Request(nativeUrl,{method:"GET"}),env,nativeUrl,"native/contacts",{canRead:true}),
      env.ZOHO_DB.prepare(
        "SELECT folder_kind,from_email,to_json,received_ms,first_seen_ms "+
        "FROM control_mail_headers ORDER BY first_seen_ms DESC LIMIT 12000").all(),
      env.ZOHO_DB.prepare("SELECT completed_ms FROM control_sync_runs "+
        "WHERE provider='zoho' AND status='complete' ORDER BY completed_ms DESC LIMIT 1").first()
    ]);
    if(!archived.ok||!native.ok)throw Error("contact_sources_failed");
    const [archive,updates]=await Promise.all([archived.json(),native.json()]);
    const response=reviewContacts({archive:archive.contacts||[],working:updates.records||[],
      headers:mails.results||[],actions:archive.actions||[]});
    response.archive_active=!!archive.active;
    response.zoho_last_sync_ms=lastZoho?.completed_ms||null;
    return Response.json(response,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch{
    return Response.json({ok:false,error:"contact_review_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
