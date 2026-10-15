/* Caravela Control native working records — Preview only.
 * Append-only manual records. Historical snapshots, Zoho and Sheets are immutable.
 * Statuses require human-entered evidence; email observation never promotes a deal. */
const CONTACT_OP="crm_contact_v1",BOOKING_OP="crm_booking_v1",FINANCE_OP="crm_finance_v1";
const FINANCE_TYPES=new Set(["income","expense"]);
const FINANCE_CATEGORIES=new Set(["agency_commission","creative_service","other_income","travel","production","marketing","other_expense"]);
const FINANCE_STATUSES=new Set(["planned","due","settled","cancelled"]);
const KINDS=new Set(["festival","venue","promoter","press","partnership","other"]);
const POLICIES=new Set(["review","allowed","blocked"]);
const STATUSES=new Set(["research","draft","contact_reported","sent_verified","reply_reported","negotiating","confirmed","declined","paused","closed"]);
const PRIORITIES=new Set(["high","medium","low"]);
const EVIDENCES=new Set(["none","user_report","sent_message","received_message","agreement"]);
const LEGACY_ID=/^(festival|venue|promoter|press)_[a-f0-9]{22}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
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
  for(const [k,max] of Object.entries({name:140,city:120,country:80,region:120,notes:1600,next_step:400,review_date:10,source_label:160})){
    row[k]=field(input[k]??"",max);
    if(row[k]===null)return null;
  }
  if(!row.name||!day(row.review_date)||!KINDS.has(input.kind)||!POLICIES.has(input.contact_policy))return null;
  if(!Array.isArray(input.emails)||input.emails.length>15)return null;
  const emails=input.emails.map(x=>field(x,254)?.toLowerCase());
  if(emails.some(x=>!x||!EMAIL.test(x))||new Set(emails).size!==emails.length)return null;
  row.kind=input.kind;row.emails=emails;row.contact_policy=input.contact_policy;
  const origin=input.origin_id??"";
  if(origin!==""&&!LEGACY_ID.test(origin))return null;
  row.origin_id=origin;return row;
}
function booking(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const row={};
  for(const [k,max] of Object.entries({
    contact_name:140,artist:110,subject:180,contact_id:80,contact_email:254,
    fee_note:300,conditions:1000,next_step:400,due_date:10,event_date:10,press_reference:400,
    last_contact_date:10,evidence_reference:450,notes:1600,origin_label:160,owner:110
  })){
    row[k]=field(input[k]??"",max);
    if(row[k]===null)return null;
  }
  if(!row.contact_name||!row.artist||!row.subject||!row.next_step)return null;
  if(!STATUSES.has(input.stage)||!PRIORITIES.has(input.priority)||!EVIDENCES.has(input.evidence_type))return null;
  if(row.contact_id&&!validId(row.contact_id))return null;
  if(row.contact_email&&!EMAIL.test(row.contact_email))return null;
  if(!day(row.due_date)||!day(row.last_contact_date)||!day(row.event_date))return null;
  const pressStatus=input.press_status??"unknown";
  if(!["unknown","planned","completed","not_applicable"].includes(pressStatus))return null;
  if(pressStatus==="completed"&&!row.press_reference)return null;
  row.press_status=pressStatus;
  const fee=input.fee_amount;
  if(fee!==null&&(typeof fee!=="number"||!Number.isFinite(fee)||fee<0||fee>10000000))return null;
  if(input.currency!=="EUR")return null;
  row.fee_amount=fee;row.currency=input.currency;
  const commission=input.commission_pct??null;
  if(commission!==null&&(typeof commission!=="number"||!Number.isFinite(commission)||
    commission<0||commission>100))return null;
  row.commission_pct=commission;
  row.stage=input.stage;row.priority=input.priority;row.evidence_type=input.evidence_type;
  const verified=["sent_verified","confirmed"].includes(row.stage);
  if(verified&&(!row.evidence_reference||!["sent_message","received_message","agreement"].includes(row.evidence_type)))
    return null;
  // Reported responses are never verified without a human-provided reference.
  if(row.stage==="reply_reported"&&row.evidence_type==="none")return null;
  return row;
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
  return kind==="contacts"?contact(input):kind==="booking"?booking(input):kind==="finance"?finance(input):null;
}
const operation=kind=>kind==="contacts"?CONTACT_OP:kind==="booking"?BOOKING_OP:kind==="finance"?FINANCE_OP:null;
const prefix=kind=>kind==="contacts"?"crm-contact:":kind==="booking"?"crm-booking:":"crm-finance:";
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
      if(record?.deleted===true && kind==="booking"){map.delete(id);continue;}
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
export async function nativeArchive(env){
  if(!env.ZOHO_DB)return fail("not_found",404);
  try{
    const manifest=await readActiveArchive(env.ZOHO_DB);
    if(!manifest)return out({ok:true,contacts:[],actions:[],active:false});
    const contacts=manifest.entities.map(x=>({
      id:x.id,name:x.name,kind:x.kind,city:x.city||"",emails:x.emails||[],
      suppressed:!!x.suppressed,control_blocked:!!x.control_blocked,
      control_blocked_possible:!!x.control_blocked_possible,
      review_required:!!x.review_required,shared_email:!!x.shared_email
    }));
    const actions=(manifest.actions||[]).map(x=>({
      name:String(x.name||"").slice(0,140),
      email:String(x.email||"").slice(0,254),
      artist:String(x.artist||"").slice(0,110),
      status:String(x.status||"").slice(0,100),
      next_step:String(x.next_step||"").slice(0,400),
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
    "SELECT COUNT(*) AS n FROM control_decision_events WHERE operation IN (?,?,?)"
  ).bind(CONTACT_OP,BOOKING_OP,FINANCE_OP).first();
  if((count?.n||0)>15000)return fail("export_event_limit",409);
  const result=await env.ZOHO_DB.prepare(
    "SELECT id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms "+
    "FROM control_decision_events WHERE operation IN (?,?,?) ORDER BY created_ms ASC,rowid ASC LIMIT 15001"
  ).bind(CONTACT_OP,BOOKING_OP,FINANCE_OP).all();
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
function appendRevision(db,kind,id,record,actor,revision){
  const eventId=crypto.randomUUID(),entity=prefix(kind)+id,op=operation(kind),now=Date.now();
  const changeSql="INSERT INTO control_decision_events("+
    "id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms) "+
    "SELECT ?,?,?,?,?,?,?,? WHERE "+(revision
      ?"(SELECT id FROM control_decision_events WHERE entity_id=? AND operation=? ORDER BY created_ms DESC,rowid DESC LIMIT 1)=?"
      :"NOT EXISTS(SELECT 1 FROM control_decision_events WHERE entity_id=? AND operation=?)");
  const query=db.prepare(changeSql).bind(eventId,entity,
    kind==="booking"||kind==="finance"?record.artist:null,op,
    kind==="contacts"?record.contact_policy:record.stage||record.status,
    record.next_step||"Atualização manual",JSON.stringify(record),now,
    entity,op,...(revision?[revision]:[]));
  const audit=db.prepare("INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) "+
    "SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM control_decision_events WHERE id=?)")
    .bind(crypto.randomUUID(),now,"crm_"+kind+"_"+(revision?"updated":"created"),entity,
      JSON.stringify({actor:actor||"legacy_admin",revision_event:eventId}),eventId);
  return [query,audit];
}
export async function handleNative(request,env,url,route,{canRead=false,canWrite=false,actor=""}={}){
  if(!env.ZOHO_DB||!canRead)return fail("forbidden",403);
  const kind=route.slice("native/".length);
  if(!operation(kind))return fail("not_found",404);
  if(request.method==="GET"){
    try{
      const rows=await listAll(env.ZOHO_DB,kind);
      return out({ok:true,records:rows,total:rows.length,source:"append_only_decision_events",
        historical_snapshots_untouched:true});
    }catch{return fail("native_unavailable",503);}
  }
  if(!["POST","PATCH","DELETE"].includes(request.method))return fail("method_not_allowed",405);
  if(request.method==="DELETE"&&kind!=="booking")return fail("method_not_allowed",405);
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
  const id=request.method==="POST"?(kind==="contacts"&&LEGACY_ID.test(input.id)?input.id:crypto.randomUUID()):input.id;
  if(!validId(id))return fail("invalid_id",422);
  // Do not allow hand-crafted historical references for newly created records.
  if(request.method==="POST"&&kind==="contacts"&&record.origin_id&&record.origin_id!==id)
    return fail("invalid_origin_reference",422);
  if(request.method==="POST"&&kind==="contacts"&&LEGACY_ID.test(id)&&record.origin_id!==id)
    return fail("invalid_origin_reference",422);
  try{
    const before=await listAll(env.ZOHO_DB,kind);
    const found=before.find(x=>x.id===id);
    if(request.method==="POST"&&found)return fail("record_exists",409);
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
      if(level==="review"&&record.contact_policy==="allowed")
        return fail("historical_contact_needs_review",422);
    }
    if(request.method==="POST"&&kind==="contacts"){
      const normalized=x=>String(x||"").trim().toLocaleLowerCase("pt-PT");
      const sameEntity=x=>normalized(x.name)===normalized(record.name)&&
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
    const writes=await env.ZOHO_DB.batch(appendRevision(env.ZOHO_DB,kind,id,record,actor,
      request.method==="PATCH"?input.revision:null));
    const changes=writes[0]?.meta?.changes??writes[0]?.changes;
    if(changes===0)return fail("revision_conflict",409);
    const current=(await listAll(env.ZOHO_DB,kind)).find(x=>x.id===id);
    return out({ok:true,record:current,append_only:true},request.method==="POST"?201:200);
  }catch{return fail("native_storage_failed",503);}
}
