/* Caravela Control native working records — Preview only.
 * Append-only manual records. Historical snapshots, Zoho and Sheets are immutable.
 * Statuses require human-entered evidence; email observation never promotes a deal. */
const CONTACT_OP="crm_contact_v1",BOOKING_OP="crm_booking_v1",FINANCE_OP="crm_finance_v1",OPPORTUNITY_OP="crm_opportunity_v1";
const FINANCE_TYPES=new Set(["income","expense"]);
const FINANCE_CATEGORIES=new Set(["agency_commission","creative_service","other_income","travel","production","marketing","other_expense"]);
const FINANCE_STATUSES=new Set(["planned","due","settled","cancelled"]);
const KINDS=new Set(["festival","venue","promoter","press","partnership","other"]);
const POLICIES=new Set(["review","allowed","blocked"]);
const RELATIONS=new Set(["unknown","partner","target","in_discussion","former","not_applicable"]);
const DUPLICATE_DECISIONS=new Set(["unreviewed","distinct","secondary"]);
const STATUSES=new Set(["research","draft","contact_reported","sent_verified","reply_reported","negotiating","confirmed","declined","paused","closed"]);
const PRIORITIES=new Set(["high","medium","low"]);
const EVIDENCES=new Set(["none","user_report","sent_message","received_message","agreement"]);
const FEE_BASES=new Set(["legacy_unspecified","artist_base"]);
const COMMISSION_MODES=new Set(["unspecified","standard","exception"]);
const BILLING_PEOPLE=new Set(["unassigned","sergio","ana"]);
const FIT_LEVELS=new Set(["unreviewed","strong","possible","weak"]);
const STRATEGIC_REASONS=new Set(["none","prestige","new_territory","territory_consolidation","industry_contacts","event_relevance"]);
const cents=value=>Math.round(value*100);
const LEGACY_ID=/^(festival|venue|promoter|press)_[a-f0-9]{22}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const MMDD=/^(\d{2})-(\d{2})$/;
const WINDOW_BASIS=new Set(["unknown","official","direct","history","hypothesis"]);
const WINDOW_TARGET=new Set(["unknown","same_year","prior_year"]);
const BOOKING_CATEGORIES=new Set(["unknown","festival","venue","other"]);
const RADAR_TYPES=new Set(["international","grant","showcase","contest","program","other"]);
const RADAR_STATES=new Set(["research","interesting","preparing","submitted","awarded","declined","closed"]);
function validWindowDate(value){
  const parts=MMDD.exec(value);
  if(!parts)return false;
  const month=Number(parts[1]),day=Number(parts[2]);
  const date=new Date(Date.UTC(2001,month-1,day));
  return date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
const out=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const fail=(error,status=400)=>out({ok:false,error},status);
const validId=x=>typeof x==="string"&&(UUID.test(x)||LEGACY_ID.test(x));
function field(value,limit){
  return typeof value==="string"&&value.length<=limit?value.trim():null;
}
function day(value){
  return value===""||(DAY.test(value)&&!Number.isNaN(Date.parse(value))&&
    new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value);
}
function contact(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const row={};
  for(const [k,max] of Object.entries({name:140,city:120,country:80,region:120,owner:110,notes:1600,next_step:400,review_date:10,source_label:160,authorization_email:254,authorization_reference:100,
    contact_window_start:5,contact_window_end:5,contact_window_reason:360,
    contact_window_reference:450})){
    row[k]=field(input[k]??"",max);
    if(row[k]===null)return null;
  }
  if(!row.name||!day(row.review_date)||!KINDS.has(input.kind)||!POLICIES.has(input.contact_policy))return null;
  row.contact_window_basis=input.contact_window_basis??"unknown";
  row.contact_window_target=input.contact_window_target??"unknown";
  if(!WINDOW_BASIS.has(row.contact_window_basis)||!WINDOW_TARGET.has(row.contact_window_target))return null;
  const setWindow=!!(row.contact_window_start||row.contact_window_end);
  if(setWindow&&(!validWindowDate(row.contact_window_start)||!validWindowDate(row.contact_window_end) ||
      row.contact_window_basis==="unknown"||!row.contact_window_reason))return null;
  if(!setWindow&&(row.contact_window_start||row.contact_window_end||
      row.contact_window_basis!=="unknown"||row.contact_window_target!=="unknown"||
      row.contact_window_reason||row.contact_window_reference))return null;
  // An "official" or directly confirmed window must have an inspectable evidence reference.
  if(setWindow&&["official","direct"].includes(row.contact_window_basis)&&
     !row.contact_window_reference)return null;
  if(!Array.isArray(input.emails)||input.emails.length>15)return null;
  const emails=input.emails.map(x=>field(x,254)?.toLowerCase());
  if(emails.some(x=>!x||!EMAIL.test(x))||new Set(emails).size!==emails.length)return null;
  row.kind=input.kind;row.emails=emails;row.contact_policy=input.contact_policy;
  row.relationship=input.relationship??"unknown";
  if(!RELATIONS.has(row.relationship))return null;
  const origin=input.origin_id??"";
  if(origin!==""&&!LEGACY_ID.test(origin))return null;
  row.origin_id=origin;
  row.authorization_source=input.authorization_source??"none";
  if(!["none","zoho_thread"].includes(row.authorization_source))return null;
  if(row.authorization_source==="zoho_thread"&&
     (!row.authorization_reference||!row.authorization_email||!EMAIL.test(row.authorization_email)))return null;
  if(row.authorization_source==="none"&&(row.authorization_reference||row.authorization_email))return null;
  row.authorization_email=row.authorization_email.toLowerCase();
  if(!Array.isArray(input.people??[])||(input.people??[]).length>15)return null;
  row.people=[];
  for(const person of input.people??[]){
    if(!person||typeof person!=="object"||Array.isArray(person))return null;
    const name=field(person.name??"",110),role=field(person.role??"",110),
      email=field(person.email??"",254)?.toLowerCase(),phone=field(person.phone??"",65);
    if(name===null||role===null||email===null||phone===null||
       !name||(email&&!EMAIL.test(email)))return null;
    if(row.people.some(x=>x.name.toLocaleLowerCase("pt-PT")===name.toLocaleLowerCase("pt-PT")&&x.email===email))
      return null;
    row.people.push({name,role,email,phone});
  }
  row.linked_producer_ids=input.linked_producer_ids??[];
  if(!Array.isArray(row.linked_producer_ids)||row.linked_producer_ids.length>8||
     row.linked_producer_ids.some(x=>!validId(x))||
     new Set(row.linked_producer_ids).size!==row.linked_producer_ids.length)return null;
  if(row.linked_producer_ids.length&&!["festival","venue"].includes(row.kind))return null;
  row.canonical_id=input.canonical_id??"";
  if(row.canonical_id!==""&&!validId(row.canonical_id))return null;
  row.duplicate_decision=input.duplicate_decision??"unreviewed";
  if(!DUPLICATE_DECISIONS.has(row.duplicate_decision)||
     (row.duplicate_decision==="secondary")!==!!row.canonical_id)return null;
  return row;
}
function booking(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const row={};
  for(const [k,max] of Object.entries({
    contact_name:140,artist:110,subject:180,contact_id:80,contact_email:254,
    fee_note:300,conditions:1000,next_step:400,due_date:10,event_date:10,press_reference:400,
    last_contact_date:10,evidence_reference:450,notes:1600,origin_label:160,owner:110,
    commercial_exception_note:400,fit_reason:500
  })){
    row[k]=field(input[k]??"",max);
    if(row[k]===null)return null;
  }
  if(!row.contact_name||!row.artist||!row.subject||!row.next_step)return null;
  row.booking_year=field(input.booking_year??"",4);
  row.booking_category=input.booking_category??"unknown";
  if(row.booking_year===null||(row.booking_year!==""&&!/^20[2-9]\d$/.test(row.booking_year))||
     !BOOKING_CATEGORIES.has(row.booking_category)||
     (row.booking_year&&row.event_date&&row.booking_year!==row.event_date.slice(0,4)))
    return null;
  if(!STATUSES.has(input.stage)||!PRIORITIES.has(input.priority)||!EVIDENCES.has(input.evidence_type))return null;
  if(row.contact_id&&!validId(row.contact_id))return null;
  if(row.contact_email&&!EMAIL.test(row.contact_email))return null;
  if(!day(row.due_date)||!day(row.last_contact_date)||!day(row.event_date))return null;
  const pressStatus=input.press_status??"unknown";
  if(!["unknown","planned","completed","not_applicable"].includes(pressStatus))return null;
  if(pressStatus==="completed"&&!row.press_reference)return null;
  row.press_status=pressStatus;
  const advance=input.advance_status??"unknown";
  if(!["unknown","planned","ready","not_applicable"].includes(advance))return null;
  row.advance_status=advance;
  const fee=input.fee_amount;
  if(fee!==null&&(typeof fee!=="number"||!Number.isFinite(fee)||fee<0||fee>10000000))return null;
  if(input.currency!=="EUR")return null;
  row.fee_amount=fee;row.currency=input.currency;
  const commission=input.commission_pct??null;
  if(commission!==null&&(typeof commission!=="number"||!Number.isFinite(commission)||
    commission<0||commission>100))return null;
  row.commission_pct=commission;
  // fee_amount in older revisions has no reliable basis. Do not silently
  // treat it as either an artist fee or a promoter's total offer.
  row.fee_basis=input.fee_basis??"legacy_unspecified";
  row.commission_mode=input.commission_mode??"unspecified";
  row.billing_person=input.billing_person??"unassigned";
  row.promoter_total_amount=input.promoter_total_amount??null;
  if(!FEE_BASES.has(row.fee_basis)||!COMMISSION_MODES.has(row.commission_mode)||
     !BILLING_PEOPLE.has(row.billing_person))return null;
  const total=row.promoter_total_amount;
  if(total!==null&&(typeof total!=="number"||!Number.isFinite(total)||
     total<0||total>10000000||cents(total)/100!==total))return null;
  if(row.fee_basis==="legacy_unspecified"&&
     (total!==null||row.commission_mode!=="unspecified"||row.commercial_exception_note))
    return null;
  if(row.fee_basis==="artist_base"){
    if(fee!==null&&cents(fee)/100!==fee)return null;
    if(row.commission_mode==="unspecified"&&total!==null)return null;
    if(total!==null&&(fee===null||total<fee))return null;
    if(row.commission_mode==="standard"&&total!==null){
      if(commission===null||cents(total)!==cents(fee)+Math.round(cents(fee)*commission/100))
        return null;
    }
    if(row.commission_mode==="exception"&&!row.commercial_exception_note)return null;
    if(row.commission_mode!=="exception"&&row.commercial_exception_note)return null;
  }
  // Strategic value is a human assessment, never an automatically verified fact.
  row.fit_level=input.fit_level??"unreviewed";
  row.strategic_reason=input.strategic_reason??"none";
  if(!FIT_LEVELS.has(row.fit_level)||!STRATEGIC_REASONS.has(row.strategic_reason))
    return null;
  if(row.fit_level==="strong"&&!row.fit_reason)return null;
  if(row.strategic_reason!=="none"&&!row.fit_reason)return null;
  row.stage=input.stage;row.priority=input.priority;row.evidence_type=input.evidence_type;
  const verified=["sent_verified","confirmed"].includes(row.stage);
  if(verified&&(!row.evidence_reference||!["sent_message","received_message","agreement"].includes(row.evidence_type)))
    return null;
  // Reported responses are never verified without a human-provided reference.
  if(row.stage==="reply_reported"&&row.evidence_type==="none")return null;
  return row;
}
function opportunity(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const row={};
  for(const [k,max] of Object.entries({title:180,provider:140,source_url:600,
    artist:110,country:100,deadline:10,review_date:10,verified_on:10,
    owner:110,next_step:400,eligibility_note:600,notes:1200})){
    row[k]=field(input[k]??"",max);if(row[k]===null)return null;
  }
  if(!row.title||!row.provider||!row.next_step||
     !RADAR_TYPES.has(input.kind)||!RADAR_STATES.has(input.status)||
     !day(row.deadline)||!day(row.review_date)||!day(row.verified_on))return null;
  if(!row.source_url)return null;
  try{
    const u=new URL(row.source_url);
    if(u.protocol!=="https:"||u.username||u.password||
       !u.hostname.includes(".")||u.hostname.length>180)return null;
  }catch{return null}
  return {...row,kind:input.kind,status:input.status};
}
function finance(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const row={};
  for(const [key,max] of Object.entries({
    title:180,artist:110,booking_id:80,category_note:260,owner:110,
    due_date:10,settled_date:10,reference:450,notes:1400
  })){
    row[key]=field(input[key]??"",max);
    if(row[key]===null)return null;
  }
  if(!row.title||!FINANCE_TYPES.has(input.type)||
     !FINANCE_CATEGORIES.has(input.category)||!FINANCE_STATUSES.has(input.status))return null;
  if(row.booking_id&&!UUID.test(row.booking_id))return null;
  if(!day(row.due_date)||!day(row.settled_date))return null;
  const amount=input.amount;
  if(typeof amount!=="number"||!Number.isFinite(amount)||amount<=0||amount>10000000||
     Math.round(amount*100)/100!==amount||input.currency!=="EUR")return null;
  if(input.type==="income"&&!["agency_commission","creative_service","other_income"].includes(input.category))return null;
  if(input.type==="expense"&&!["travel","production","marketing","other_expense"].includes(input.category))return null;
  if(input.status==="settled"&&(!row.settled_date||!row.reference))return null;
  if(input.status!=="settled"&&row.settled_date)return null;
  return {...row,type:input.type,category:input.category,status:input.status,
    amount,currency:"EUR"};
}
export function validateNative(kind,input){
  return kind==="contacts"?contact(input):kind==="booking"?booking(input):
    kind==="finance"?finance(input):kind==="opportunities"?opportunity(input):null;
}
const operation=kind=>kind==="contacts"?CONTACT_OP:kind==="booking"?BOOKING_OP:
  kind==="finance"?FINANCE_OP:kind==="opportunities"?OPPORTUNITY_OP:null;
const prefix=kind=>kind==="contacts"?"crm-contact:":kind==="booking"?"crm-booking:":
  kind==="finance"?"crm-finance:":"crm-opportunity:";
async function listAll(db,kind){
  const op=operation(kind);
  if(!op)return [];
  const all=await db.prepare(
    "SELECT id,entity_id,decision,evidence_json,created_ms FROM control_decision_events "+
    "WHERE operation=? ORDER BY created_ms ASC,rowid ASC LIMIT 12000"
  ).bind(op).all();
  const map=new Map();
  for(const event of all.results||[]){
    const id=event.entity_id?.startsWith(prefix(kind))?event.entity_id.slice(prefix(kind).length):"";
    if(!validId(id))continue;
    try{
      const record=JSON.parse(event.evidence_json);
      if(record?.deleted===true && ["booking","contacts"].includes(kind)){map.delete(id);continue;}
      if(!validateNative(kind,record))continue;
      map.set(id,{id,...record,revision:event.id,updated_ms:event.created_ms});
    }catch{}
  }
  return [...map.values()].sort((a,b)=>b.updated_ms-a.updated_ms);
}
// Recheck legacy restrictions server-side against the sealed archive; never
// rely on a browser-supplied "allowed" flag for a historical contact.
async function readActiveArchive(db){
  const selected=await db.prepare(
    "SELECT s.id,s.raw_sha256,s.declared_bytes FROM control_snapshots s "+
    "JOIN control_state t ON t.value=s.id "+
    "WHERE t.key='active_snapshot' AND s.state='sealed'"
  ).first();
  if(!selected)return null;
  const parts=await db.prepare(
    "SELECT encoded FROM control_snapshot_parts WHERE snapshot_id=? ORDER BY part_index"
  ).bind(selected.id).all();
  const blocks=(parts.results||[]).map(x=>atob(x.encoded));
  const bytes=new Uint8Array(blocks.reduce((sum,x)=>sum+x.length,0));
  let offset=0;
  for(const block of blocks){for(let i=0;i<block.length;i++)bytes[offset+i]=block.charCodeAt(i);offset+=block.length;}
  if(bytes.length!==selected.declared_bytes)throw Error("archive_incomplete");
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)))
    .map(x=>x.toString(16).padStart(2,"0")).join("");
  if(digest!==selected.raw_sha256)throw Error("archive_checksum");
  const manifest=JSON.parse(new TextDecoder().decode(bytes));
  if(manifest.schema!=="caravela.crm.import.v1"||!Array.isArray(manifest.entities))
    throw Error("archive_schema");
  return manifest;
}
async function historicContact(db,id){
  const manifest=await readActiveArchive(db);
  return manifest?.entities.find(x=>x.id===id)||null;
}
async function verifiedZohoExchange(db,thread,addr){
  const response=await db.prepare(
    "SELECT folder_kind,from_email,to_json,received_ms FROM control_mail_headers "+
    "WHERE thread_id=? AND received_ms IS NOT NULL ORDER BY received_ms ASC LIMIT 250"
  ).bind(thread).all();
  let sent=null,incoming=null;
  for(const x of response.results||[]){
    const time=Number(x.received_ms);
    if(!Number.isFinite(time)||time<=0)continue;
    if(x.folder_kind==="outgoing"){
      let recipients=[];try{recipients=JSON.parse(x.to_json||"[]")}catch{}
      if(Array.isArray(recipients)&&recipients.some(e=>String(e).toLowerCase()===addr))
        sent=Math.min(sent??time,time);
    }else if(x.folder_kind==="incoming"&&String(x.from_email||"").toLowerCase()===addr)
      incoming=Math.max(incoming??time,time);
  }
  return sent!==null&&incoming!==null&&incoming>=sent;
}
export async function nativeArchive(env){
  if(!env.ZOHO_DB)return fail("not_found",404);
  try{
    const manifest=await readActiveArchive(env.ZOHO_DB);
    if(!manifest)return out({ok:true,contacts:[],actions:[],active:false});
    const contacts=manifest.entities.map(x=>({
      id:x.id,name:x.name,kind:x.kind,city:x.city||"",emails:x.emails||[],
      region:String(x.meta?.region||"").slice(0,120),
      country:String(x.meta?.country||(x.kind!=="press"&&
        ["PT_Festivals.xlsm","PT_Venues.xlsx"].includes(x.origin?.file)?"Portugal":"")).slice(0,80),
      media_type:String(x.meta?.media_type||"").slice(0,120),
      organizer:String(x.meta?.organizer||"").slice(0,180),
      contact_person:String(x.meta?.contact_person||"").slice(0,180),
      source_primary_email:String(x.channels?.primary_email||"").slice(0,254),
      source_channel_quality:String(x.meta?.contact_quality||"").slice(0,180),
      source_form_url:(x.channels?.phone_or_web?.urls_mentioned||[]).find(
        link=>typeof link==="string"&&link.startsWith("https://")&&link.length<=300)||"",
      suppressed:!!x.suppressed,control_blocked:!!x.control_blocked,
      control_blocked_possible:!!x.control_blocked_possible,
      review_required:!!x.review_required,shared_email:!!x.shared_email
    }));
    const actions=(manifest.actions||[]).map(x=>({
      id:String(x.id||"").slice(0,90),
      name:String(x.name||"").slice(0,140),
      email:String(x.email||"").slice(0,254),
      artist:String(x.artist||"").slice(0,110),
      status:String(x.status||"").slice(0,100),
      priority:String(x.priority||"").slice(0,35),
      next_step:String(x.next_step||"").slice(0,400),
      next_followup_iso:String(x.next_followup_iso||"").slice(0,10),
      next_action_iso:String(x.next_action_iso||"").slice(0,10),
      last_contact_iso:String(x.last_contact_iso||"").slice(0,10),
      contact_policy:String(x.contact_policy||"review").slice(0,20),
      no_outreach:/(?:não enviar|nao enviar|não contactar|nao contactar|não avançar|nao avancar|bloquead)/i.test(String(x.notes||""))||
        x.contact_policy==="blocked",
      matched_entity_id:String(x.matched_entity_id||"").slice(0,80),
      link_status:String(x.link_status||"").slice(0,60),
      origin:{row:x.origin?.row||null}
    }));
    return out({ok:true,contacts,actions,active:true,
      snapshot_id:manifest.manifest_sha256});
  }catch{return fail("archive_unavailable",503);}
}
export async function nativeExport(env){
 if(!env.ZOHO_DB)return fail("not_found",404);
 try{
  const count=await env.ZOHO_DB.prepare(
    "SELECT COUNT(*) AS n FROM control_decision_events WHERE operation IN (?,?,?,?)"
  ).bind(CONTACT_OP,BOOKING_OP,FINANCE_OP,OPPORTUNITY_OP).first();
  if((count?.n||0)>15000)return fail("export_event_limit",409);
  const result=await env.ZOHO_DB.prepare(
    "SELECT id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms "+
    "FROM control_decision_events WHERE operation IN (?,?,?,?) ORDER BY created_ms ASC,rowid ASC LIMIT 15001"
  ).bind(CONTACT_OP,BOOKING_OP,FINANCE_OP,OPPORTUNITY_OP).all();
  const events=result.results||[];
  if(events.length!==(count?.n||0))return fail("export_incomplete",503);
  return out({schema:"caravela.crm.native-backup.v1",exported_at:new Date().toISOString(),
    events,historical_snapshots_untouched:true,count:events.length});
 }catch{return fail("native_export_failed",503);}
}
function legacyPolicy(entity){
  if(!entity)return "missing";
  if(entity.suppressed||entity.control_blocked||entity.control_blocked_possible)return "blocked";
  if(entity.review_required||entity.shared_email)return "review";
  return "allowed";
}
function appendRevision(db,kind,id,record,actor,revision,mailReview=null){
  const eventId=crypto.randomUUID(),entity=prefix(kind)+id,op=operation(kind),now=Date.now();
  const changeSql="INSERT INTO control_decision_events("+
    "id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms) "+
    "SELECT ?,?,?,?,?,?,?,? WHERE "+(revision
      ?"(SELECT id FROM control_decision_events WHERE entity_id=? AND operation=? ORDER BY created_ms DESC,rowid DESC LIMIT 1)=?"
      :"NOT EXISTS(SELECT 1 FROM control_decision_events WHERE entity_id=? AND operation=?)")+
    (mailReview?" AND EXISTS (SELECT 1 FROM control_review_tasks t "+
      "JOIN control_mail_signals s ON s.mailbox=t.mailbox AND s.folder_kind=t.folder_kind "+
      "AND s.message_id=t.message_id WHERE t.mailbox=? AND t.folder_kind='incoming' "+
      "AND t.message_id=? AND t.status='pending' AND t.revision=? "+
      "AND s.topic='booking' AND s.confidence='rule_based' AND lower(s.external_email)=?)":"");
  const query=db.prepare(changeSql).bind(eventId,entity,
    kind==="booking"||kind==="finance"||kind==="opportunities"?record.artist:null,op,
    kind==="contacts"?record.contact_policy:record.stage||record.status,
    record.next_step||"Atualização manual",JSON.stringify(record),now,
    entity,op,...(revision?[revision]:[]),
    ...(mailReview?[mailReview.mailbox,mailReview.message_id,mailReview.revision,mailReview.external_email]:[]));
  const audit=db.prepare("INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) "+
    "SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM control_decision_events WHERE id=?)")
    .bind(crypto.randomUUID(),now,"crm_"+kind+"_"+(revision?"updated":"created"),entity,
      JSON.stringify({actor:actor||"legacy_admin",revision_event:eventId}),eventId);
  return {statements:[query,audit],eventId};
}
export async function handleNative(request,env,url,route,{canRead=false,canWrite=false,actor="",mailReview=null}={}){
  if(!env.ZOHO_DB||!canRead)return fail("forbidden",403);
  const kind=route.slice("native/".length);
  if(!operation(kind))return fail("not_found",404);
  if(mailReview&&(kind!=="booking"||!["POST","PATCH"].includes(request.method)||
      !actor||!/^\d{1,35}$/.test(mailReview.message_id||"")||
      !Number.isInteger(mailReview.revision)||mailReview.revision<0))
    return fail("invalid_mail_review",422);
  if(request.method==="GET"){
    try{
      const rows=await listAll(env.ZOHO_DB,kind);
      return out({ok:true,records:rows,total:rows.length,source:"append_only_decision_events",
        historical_snapshots_untouched:true});
    }catch{return fail("native_unavailable",503);}
  }
  if(!["POST","PATCH","DELETE"].includes(request.method))return fail("method_not_allowed",405);
  if(request.method==="DELETE"&&!["booking","contacts"].includes(kind))return fail("method_not_allowed",405);
  if(!canWrite)return fail("forbidden",403);
  if((request.headers.get("Origin")&&request.headers.get("Origin")!==url.origin)||
     request.headers.get("Sec-Fetch-Site")==="cross-site"||
     request.headers.get("X-Caravela-Request")!=="1")return fail("invalid_origin",403);
  let input;
  try{
    const raw=await request.text();
    if(raw.length>6500)return fail("payload_too_large",413);
    input=JSON.parse(raw);
  }catch{return fail("invalid_json",400);}
  if(request.method==="DELETE"&&kind==="contacts"){
    const id=input?.id,revision=input?.revision;
    if(!UUID.test(id||"")||!UUID.test(revision||""))return fail("invalid_reference",422);
    try{
      const all=await listAll(env.ZOHO_DB,"contacts"),existing=all.find(x=>x.id===id);
      if(!existing)return fail("record_not_found",404);
      if(existing.revision!==revision)return fail("revision_conflict",409);
      if(existing.origin_id)return fail("historical_contact_cannot_remove",409);
      const [bookings,finance]=await Promise.all([listAll(env.ZOHO_DB,"booking"),listAll(env.ZOHO_DB,"finance")]);
      if(bookings.some(x=>x.contact_id===id)||
         all.some(x=>x.id!==id&&(x.canonical_id===id||x.linked_producer_ids?.includes(id)))||
         finance.some(x=>x.contact_id===id))
        return fail("contact_has_dependencies",409);
      const now=Date.now(),eventId=crypto.randomUUID(),entity=prefix("contacts")+id;
      const operationName=CONTACT_OP;
      const deleteEvent=env.ZOHO_DB.prepare(
        "INSERT INTO control_decision_events(id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms) "+
        "SELECT ?,?,?,?,?,?,?,? WHERE (SELECT id FROM control_decision_events "+
        "WHERE entity_id=? AND operation=? ORDER BY created_ms DESC,rowid DESC LIMIT 1)=?"
      ).bind(eventId,entity,null,operationName,"removed",
        "Ficha nativa retirada do trabalho diário por confirmação explícita",
        JSON.stringify({deleted:true,source_revision:revision}),now,entity,operationName,revision);
      const audit=env.ZOHO_DB.prepare(
        "INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) "+
        "SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM control_decision_events WHERE id=?)"
      ).bind(crypto.randomUUID(),now,"crm_contact_removed",entity,
        JSON.stringify({actor:actor||"legacy_admin",revision_event:eventId}),eventId);
      const result=await env.ZOHO_DB.batch([deleteEvent,audit]);
      if((result[0]?.meta?.changes??result[0]?.changes)===0)return fail("revision_conflict",409);
      return out({ok:true,removed:true,historical_events_preserved:true});
    }catch{return fail("native_storage_failed",503)}
  }
  if(request.method==="DELETE"){
    const id=input?.id,revision=input?.revision;
    if(!UUID.test(id||"")||!UUID.test(revision||""))return fail("invalid_reference",422);
    try{
      const existing=(await listAll(env.ZOHO_DB,"booking")).find(x=>x.id===id);
      if(!existing)return fail("record_not_found",404);
      if(existing.revision!==revision)return fail("revision_conflict",409);
      if(existing.stage==="confirmed")return fail("cannot_remove_confirmed_booking",409);
      // Never remove a booking associated with a financial record.
      const linked=await listAll(env.ZOHO_DB,"finance");
      if(linked.some(x=>x.booking_id===id))return fail("booking_has_financial_records",409);
      const now=Date.now(),entity=prefix("booking")+id,eventId=crypto.randomUUID();
      const tombstone=env.ZOHO_DB.prepare(
        "INSERT INTO control_decision_events(id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms) "+
        "SELECT ?,?,?,?,?,?,?,? WHERE (SELECT id FROM control_decision_events "+
        "WHERE entity_id=? AND operation=? ORDER BY created_ms DESC,rowid DESC LIMIT 1)=?"
      ).bind(eventId,entity,existing.artist,BOOKING_OP,"removed",
        "Registo operacional removido por ação explícita da equipa",
        JSON.stringify({deleted:true,source_revision:revision}),now,entity,BOOKING_OP,revision);
      const audit=env.ZOHO_DB.prepare(
        "INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) "+
        "SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM control_decision_events WHERE id=?)"
      ).bind(crypto.randomUUID(),now,"crm_booking_removed",entity,
        JSON.stringify({actor:actor||"legacy_admin",revision_event:eventId}),eventId);
      const writes=await env.ZOHO_DB.batch([tombstone,audit]);
      if((writes[0]?.meta?.changes??writes[0]?.changes)===0)return fail("revision_conflict",409);
      return out({ok:true,removed:true,historical_events_preserved:true});
    }catch{return fail("native_storage_failed",503);}
  }
  const record=validateNative(kind,input);
  if(!record)return fail("invalid_record",422);
  const id=request.method==="POST"?
    (kind==="contacts"&&LEGACY_ID.test(input.id)?input.id:
      mailReview&&UUID.test(input.id||"")?input.id:crypto.randomUUID()):input.id;
  if(!validId(id))return fail("invalid_id",422);
  // Do not allow hand-crafted historical references for newly created records.
  if(request.method==="POST"&&kind==="contacts"&&record.origin_id&&record.origin_id!==id)
    return fail("invalid_origin_reference",422);
  if(request.method==="POST"&&kind==="contacts"&&LEGACY_ID.test(id)&&record.origin_id!==id)
    return fail("invalid_origin_reference",422);
  try{
    // Retry after an uncertain network response must never duplicate the booking.
    if(mailReview){
      const sourceMail=await env.ZOHO_DB.prepare(
        "SELECT t.status,t.revision,t.review_note,s.external_email,s.topic,s.confidence "+
        "FROM control_review_tasks t JOIN control_mail_signals s "+
        "ON s.mailbox=t.mailbox AND s.folder_kind=t.folder_kind AND s.message_id=t.message_id "+
        "WHERE t.mailbox=? AND t.folder_kind='incoming' AND t.message_id=?"
      ).bind("booking@caravelaamarela.com",mailReview.message_id).first();
      if(!sourceMail||sourceMail.topic!=="booking"||
         sourceMail.confidence!=="rule_based"||!sourceMail.external_email)
        return fail("mail_review_not_eligible",409);
      if(sourceMail.status==="reviewed"&&sourceMail.review_note==="booking:"+id){
        const booked=(await listAll(env.ZOHO_DB,"booking")).find(x=>x.id===id);
        if(booked)return out({ok:true,record:booked,review_completed:true,
          already_applied:true,message_id:mailReview.message_id});
      }
      if(sourceMail.status!=="pending"||Number(sourceMail.revision)!==mailReview.revision)
        return fail("mail_review_conflict",409);
      if(record.contact_email.toLowerCase()!==String(sourceMail.external_email).toLowerCase())
        return fail("mail_sender_mismatch",422);
      mailReview={...mailReview,mailbox:"booking@caravelaamarela.com",
        external_email:String(sourceMail.external_email).toLowerCase()};
    }
    const before=await listAll(env.ZOHO_DB,kind);
    const found=before.find(x=>x.id===id);
    if(request.method==="POST"&&found)return fail("record_exists",409);
    if(kind==="contacts"){
      if(record.canonical_id===id||record.linked_producer_ids.includes(id))
        return fail("self_entity_link",422);
      if(record.canonical_id||record.linked_producer_ids.length){
        const manifest=await readActiveArchive(env.ZOHO_DB);
        const resolve=x=>before.find(y=>y.id===x)||manifest?.entities.find(y=>y.id===x);
        if(record.canonical_id){
          const main=resolve(record.canonical_id);
          if(!main||main.kind!==record.kind||main.canonical_id||
             (main.duplicate_decision==="secondary"))
            return fail("invalid_canonical_link",422);
          // A secondary record remains readable, linkable and restricted as before.
          // Canonical links never grant send permissions, rewrite existing booking IDs,
          // or delete source evidence.
        }
        for(const parent of record.linked_producer_ids){
          const target=resolve(parent);
          if(!target||target.kind!=="promoter"||target.canonical_id)
            return fail("invalid_producer_link",422);
        }
      }
    }
    if(request.method==="PATCH"&&!found)return fail("record_not_found",404);
    if(request.method==="PATCH"&&(!input.revision||input.revision!==found.revision))
      return fail("revision_conflict",409);
    if(request.method==="PATCH"&&kind==="contacts"&&found.origin_id!==record.origin_id)
      return fail("cannot_change_origin",422);
    if(kind==="contacts"&&LEGACY_ID.test(id)){
      const source=await historicContact(env.ZOHO_DB,id);
      if(!source)return fail("historical_reference_not_found",422);
      if(record.origin_id!==id)return fail("cannot_change_origin",422);
      const level=legacyPolicy(source);
      if(level==="blocked"&&record.contact_policy!=="blocked")
        return fail("historical_contact_blocked",422);
      if(level==="review"&&record.contact_policy==="allowed"){
        // Reclassification requires an explicit approval plus provider-thread
        // proof. Never override opt-outs, shared identities or old restrictions.
        if(source.shared_email||!record.authorization_email||
           !record.authorization_reference||record.authorization_source!=="zoho_thread"||
           !(source.emails||[]).some(x=>x.toLowerCase()===record.authorization_email))
          return fail("historical_contact_needs_review",422);
        const manifest=await readActiveArchive(env.ZOHO_DB);
        const reused=(manifest?.entities||[]).some(x=>x.id!==id&&
          (x.emails||[]).some(e=>e.toLowerCase()===record.authorization_email));
        if(reused||!(await verifiedZohoExchange(env.ZOHO_DB,
          record.authorization_reference,record.authorization_email)))
          return fail("authorization_evidence_unverified",422);
      }
    }
    if(request.method==="POST"&&kind==="contacts"){
      const normalized=x=>String(x||"").trim().toLocaleLowerCase("pt-PT")
        .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
      // Two different entity types or two similarly named venues in distinct
      // municipalities are not duplicates. Do not merge shared mailboxes.
      const sameEntity=x=>x.kind===record.kind&&normalized(x.name)===normalized(record.name)&&
        normalized(x.city)===normalized(record.city);
      if(before.some(sameEntity))return fail("possible_duplicate_contact",409);
      // Continuation must reuse the immutable V3 ID instead of making a second record.
      const manifest=await readActiveArchive(env.ZOHO_DB);
      if(manifest?.entities.some(sameEntity))return fail("historical_contact_exists",409);
    }
    // Verified commercial states require a real, explicitly authorized contact.
    // Neither a free-text name nor an unresolvable ID can bypass contact policy.
    if(kind==="booking"&&["sent_verified","confirmed"].includes(record.stage)){
      if(!record.contact_id)return fail("verified_contact_link_required",422);
      const linked=(await listAll(env.ZOHO_DB,"contacts")).find(x=>x.id===record.contact_id);
      const historical=LEGACY_ID.test(record.contact_id)
        ?await historicContact(env.ZOHO_DB,record.contact_id):null;
      if(!linked&&!historical)return fail("contact_reference_not_found",422);
      if(linked?.contact_policy==="blocked"||
         (!linked&&historical&&legacyPolicy(historical)==="blocked"))
        return fail("contact_blocked",422);
      if(linked?linked.contact_policy!=="allowed":legacyPolicy(historical)!=="allowed")
        return fail("contact_review_required",422);
      const known=linked||historical;
      if(known.name.trim().toLocaleLowerCase("pt-PT")!==record.contact_name.toLocaleLowerCase("pt-PT"))
        return fail("contact_identity_mismatch",422);
      if(record.contact_email&&!(known.emails||[]).some(
        email=>email.toLowerCase()===record.contact_email.toLowerCase()))
        return fail("contact_identity_mismatch",422);
      // A shared or suppressed historical address is never implicitly cleared
      // by creating an unrelated native contact with the same email.
      if(record.contact_email){
        const manifest=await readActiveArchive(env.ZOHO_DB);
        if(manifest?.entities.some(x=>x.id!==record.contact_id&&
          (x.emails||[]).some(email=>email.toLowerCase()===record.contact_email.toLowerCase())&&
          legacyPolicy(x)!=="allowed"))
          return fail("contact_email_review_required",422);
      }
    }
    if(kind==="finance"&&record.booking_id){
      const linked=(await listAll(env.ZOHO_DB,"booking")).find(x=>x.id===record.booking_id);
      if(!linked)return fail("finance_booking_not_found",422);
      if(record.type==="income"&&record.category==="agency_commission"&&
         record.artist&&linked.artist.trim().toLocaleLowerCase("pt-PT")!==record.artist.toLocaleLowerCase("pt-PT"))
        return fail("finance_artist_mismatch",422);
    }
    // Atomic compare-and-append: two tabs cannot silently overwrite each other.
    // The audit row is inserted only if the guarded event was inserted.
    const prepared=appendRevision(env.ZOHO_DB,kind,id,record,actor,
      request.method==="PATCH"?input.revision:null,mailReview);
    const statements=[...prepared.statements];
    if(mailReview){
      const time=Date.now(),note="booking:"+id,reviewer=String(actor).slice(0,80);
      statements.push(env.ZOHO_DB.prepare(
        "UPDATE control_review_tasks SET status='reviewed',reviewed_by=?,reviewed_ms=?,"+
        "review_note=?,revision=revision+1,updated_ms=? "+
        "WHERE mailbox=? AND folder_kind='incoming' AND message_id=? "+
        "AND status='pending' AND revision=? "+
        "AND EXISTS (SELECT 1 FROM control_decision_events WHERE id=?)"
      ).bind(reviewer,time,note,time,mailReview.mailbox,mailReview.message_id,
        mailReview.revision,prepared.eventId));
      statements.push(env.ZOHO_DB.prepare(
        "INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) "+
        "SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM control_review_tasks "+
        "WHERE mailbox=? AND folder_kind='incoming' AND message_id=? "+
        "AND status='reviewed' AND revision=? AND review_note=? AND reviewed_ms=?) "+
        "AND EXISTS(SELECT 1 FROM control_decision_events WHERE id=?)"
      ).bind(crypto.randomUUID(),time,"crm_mail_task_resolved_booking",
        "zoho-message:"+mailReview.message_id,
        JSON.stringify({actor:reviewer,booking_id:id,revision_event:prepared.eventId}),
        mailReview.mailbox,mailReview.message_id,mailReview.revision+1,note,time,prepared.eventId));
    }
    // Cloudflare D1 batch() runs transactionally. Closing the task requires
    // the booking event inserted in the same transaction.
    const writes=await env.ZOHO_DB.batch(statements);
    const changes=Number(writes[0]?.meta?.changes??writes[0]?.changes??0);
    if(changes!==1)return fail(mailReview?"mail_review_conflict":"revision_conflict",409);
    if(mailReview&&Number(writes[2]?.meta?.changes??writes[2]?.changes??0)!==1)
      return fail("mail_review_state_unverified",503);
    const current=(await listAll(env.ZOHO_DB,kind)).find(x=>x.id===id);
    return out({ok:true,record:current,append_only:true,
      ...(mailReview?{review_completed:true,message_id:mailReview.message_id}:{})},
      request.method==="POST"?201:200);
  }catch{return fail("native_storage_failed",503);}
}
