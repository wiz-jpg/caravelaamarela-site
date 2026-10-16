/* Private, Preview-only follow-up queue.
 * A mail classification can open a TASK for human review, never a deal or outreach permission.
 * Never persist subjects, bodies or snippets, and never infer a specific artist/event. */
import {nativeArchive,handleNative} from "./control-native.js";

const MAILBOX="booking@caravelaamarela.com";
const VALID_ID=/^\d{1,35}$/;
const VALID_EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREVIEW_HOST="feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const json=(data,status=200)=>Response.json(data,{status,headers:{
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}});
const error=(code,status=400)=>json({ok:false,error:code},status);

async function schemaReady(db){
  return !!(await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='control_review_tasks'").first());
}

// Bounded, repeatable backfill; one item per Zoho message, across all cron cycles.
export async function materializeMailReviewTasks(db,{limit=80,now=Date.now()}={}){
  if(!(await schemaReady(db)))return {enabled:false,reason:"migration_required",created:0};
  const count=Math.min(200,Math.max(1,Math.trunc(limit)));
  const saved=await db.prepare(
    "INSERT OR IGNORE INTO control_review_tasks "+
    "(mailbox,folder_kind,message_id,status,revision,created_ms,updated_ms) "+
    "SELECT s.mailbox,s.folder_kind,s.message_id,'pending',0,?,? "+
    "FROM control_mail_signals s "+
    "LEFT JOIN control_review_tasks t "+
    "ON t.mailbox=s.mailbox AND t.folder_kind=s.folder_kind AND t.message_id=s.message_id "+
    "WHERE s.mailbox=? AND s.folder_kind='incoming' AND s.confidence='rule_based' "+
    "AND s.topic IN ('booking','partnership','press') "+
    "AND s.signal IN ('interest','decline','possible_confirmation','needs_reply') "+
    "AND s.external_email IS NOT NULL AND s.external_email<>? "+
    "AND s.external_email NOT LIKE 'noreply@%' AND s.external_email NOT LIKE 'no-reply@%' "+
    "AND s.external_email NOT LIKE 'donotreply@%' AND s.external_email NOT LIKE 'postmaster@%' "+
    "AND t.message_id IS NULL ORDER BY s.observed_ms DESC LIMIT ?"
  ).bind(now,now,MAILBOX,MAILBOX,count).run();
  return {enabled:true,created:Number(saved.meta?.changes??saved.changes??0),read_only_source:true};
}

const normalizeEmail=x=>typeof x==="string"?x.trim().toLowerCase():"";
export function matchMailTaskContacts(contacts,address){
  if(!VALID_EMAIL.test(address||""))return {matches:[],association:"unknown"};
  const map=new Map();
  for(const contact of contacts){
    if(!contact?.id||!contact?.name||!Array.isArray(contact.emails))continue;
    // Use exact addresses from both the entity and its named interlocutors.
    // A producer's shared mailbox must still produce several candidates.
    const entityAddresses=contact.emails||[];
    const peopleAddresses=(contact.people||[]).map(person=>person?.email);
    if(![...entityAddresses,...peopleAddresses].some(addr=>normalizeEmail(addr)===address))continue;
    map.set(contact.id,{
      id:contact.id,name:contact.name,kind:contact.kind||"other",
      restricted:!!(contact.suppressed||contact.control_blocked||
        contact.control_blocked_possible||contact.shared_email||
        contact.contact_policy==="blocked")
    });
  }
  const matches=[...map.values()];
  return {matches:matches.slice(0,6),association:matches.length===1&&!matches[0].restricted?
    "unique_candidate":matches.length>1?"shared_email":matches.some(x=>x.restricted)?"restricted":"unmatched"};
}

async function linkedContacts(env,rows,url){
  if(!rows.length)return new Map();
  try{
    const nativeUrl=new URL("/api/control/native/contacts",url);
    const [archived,working]=await Promise.all([
      nativeArchive(env),
      handleNative(new Request(nativeUrl,{method:"GET"}),env,nativeUrl,"native/contacts",{canRead:true})
    ]);
    if(!archived.ok||!working.ok)return new Map();
    const [archive,native]=await Promise.all([archived.json(),working.json()]);
    const merged=new Map();
    for(const x of archive.contacts||[])if(x?.id)merged.set(x.id,x);
    for(const x of native.records||[])if(x?.id)merged.set(x.id,{...merged.get(x.id),...x});
    const contacts=[...merged.values()],lookup=new Map();
    for(const row of rows){
      const address=normalizeEmail(row.external_email);
      if(!lookup.has(address))lookup.set(address,matchMailTaskContacts(contacts,address));
    }
    return lookup;
  }catch{return new Map()}
}

export async function handleMailReviewTasks(request,env,url,{actor=""}={}){
  if(url.protocol!=="https:"||url.hostname!==PREVIEW_HOST)return error("not_found",404);
  const db=env.ZOHO_DB;
  if(!db)return error("storage_unavailable",503);
  try{
    if(!(await schemaReady(db)))return error("review_tasks_migration_required",409);
    if(request.method==="GET"){
      const [counts,items]=await Promise.all([
        db.prepare("SELECT status,COUNT(*) AS n FROM control_review_tasks GROUP BY status").all(),
        db.prepare(
          "SELECT t.message_id,t.status,t.revision,t.created_ms,s.external_email,s.thread_id,"+
          "s.message_ms,s.topic,s.signal,s.confidence,s.reason_code "+
          "FROM control_review_tasks t JOIN control_mail_signals s "+
          "ON s.mailbox=t.mailbox AND s.folder_kind=t.folder_kind AND s.message_id=t.message_id "+
          "WHERE t.mailbox=? AND t.folder_kind='incoming' AND t.status='pending' "+
          "ORDER BY CASE s.signal WHEN 'possible_confirmation' THEN 0 WHEN 'needs_reply' THEN 1 "+
          "WHEN 'interest' THEN 2 ELSE 3 END,COALESCE(s.message_ms,t.created_ms) DESC LIMIT 80"
        ).bind(MAILBOX).all()
      ]);
      const rows=items.results||[],matches=await linkedContacts(env,rows,url);
      const summary=Object.fromEntries((counts.results||[]).map(x=>[x.status,x.n]));
      return json({ok:true,source:"zoho_signals",kind:"human_review_queue",
        counts:{pending:summary.pending||0,reviewed:summary.reviewed||0,dismissed:summary.dismissed||0},
        tasks:rows.map(({message_id,status,revision,created_ms,external_email,thread_id,message_ms,topic,signal,confidence,reason_code})=>{
          const addr=normalizeEmail(external_email),linked=matches.get(addr)||{matches:[],association:"unknown"};
          return {message_id,status,revision,created_ms,external_email:addr,thread_id,
            message_ms,topic,signal,confidence,reason_code,...linked,requires_review:true};
        }),
        limits:["Cada mensagem gera no máximo uma tarefa.","Emails partilhados ou restritos exigem revisão da identidade.",
          "Concluir ou descartar uma tarefa não altera contactos, autorização de envio, booking ou finanças."]});
    }
    if(request.method!=="PATCH")return error("method_not_allowed",405);
    if(!actor||request.headers.get("X-Caravela-Request")!=="1"||
       (request.headers.get("Origin")&&request.headers.get("Origin")!==url.origin)||
       request.headers.get("Sec-Fetch-Site")==="cross-site")return error("invalid_origin",403);
    const raw=await request.text();
    if(raw.length>1400)return error("payload_too_large",413);
    let input;
    try{input=JSON.parse(raw)}catch{return error("invalid_json",400)}
    if(!VALID_ID.test(input?.message_id||"")||
       !Number.isInteger(input?.revision)||input.revision<0||
       !["reviewed","dismissed"].includes(input?.status)||
       typeof input?.note!=="string"||input.note.length>320)
      return error("invalid_review_action",422);
    const time=Date.now(),reviewer=String(actor).slice(0,80);
    const update=db.prepare(
      "UPDATE control_review_tasks SET status=?,reviewed_by=?,reviewed_ms=?,review_note=?,"+
      "revision=revision+1,updated_ms=? "+
      "WHERE mailbox=? AND folder_kind='incoming' AND message_id=? "+
      "AND status='pending' AND revision=?"
    ).bind(input.status,reviewer,time,input.note.trim(),time,MAILBOX,input.message_id,input.revision);
    const audit=db.prepare(
      "INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) "+
      "SELECT ?,?,?,?,? WHERE EXISTS("+
      "SELECT 1 FROM control_review_tasks WHERE mailbox=? AND folder_kind='incoming' "+
      "AND message_id=? AND status=? AND revision=? AND reviewed_by=? AND reviewed_ms=?)"
    ).bind(crypto.randomUUID(),time,"crm_mail_task_"+input.status,
      "zoho-message:"+input.message_id,
      JSON.stringify({actor:reviewer,status:input.status,previous_revision:input.revision}),
      MAILBOX,input.message_id,input.status,input.revision+1,reviewer,time);
    const results=await db.batch([update,audit]);
    if(Number(results[0]?.meta?.changes??results[0]?.changes??0)!==1)
      return error("review_conflict",409);
    return json({ok:true,message_id:input.message_id,status:input.status,
      human_review_only:true,commercial_records_unchanged:true});
  }catch{
    return error("review_tasks_unavailable",503);
  }
}
