/* Caravela Control native working records — Preview only.
 * Append-only manual records. Historical snapshots, Zoho and Sheets are immutable.
 * Statuses require human-entered evidence; email observation never promotes a deal. */
const CONTACT_OP="crm_contact_v1",BOOKING_OP="crm_booking_v1";
const KINDS=new Set(["festival","venue","promoter","press","other"]);
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
  for(const [k,max] of Object.entries({name:140,city:120,notes:1600,next_step:400,review_date:10,source_label:160})){
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
    fee_note:300,conditions:1000,next_step:400,due_date:10,
    last_contact_date:10,evidence_reference:450,notes:1600,origin_label:160,owner:110
  })){
    row[k]=field(input[k]??"",max);
    if(row[k]===null)return null;
  }
  if(!row.contact_name||!row.artist||!row.subject||!row.next_step)return null;
  if(!STATUSES.has(input.stage)||!PRIORITIES.has(input.priority)||!EVIDENCES.has(input.evidence_type))return null;
  if(row.contact_id&&!validId(row.contact_id))return null;
  if(row.contact_email&&!EMAIL.test(row.contact_email))return null;
  if(!day(row.due_date)||!day(row.last_contact_date))return null;
  const fee=input.fee_amount;
  if(fee!==null&&(typeof fee!=="number"||!Number.isFinite(fee)||fee<0||fee>10000000))return null;
  if(input.currency!=="EUR")return null;
  row.fee_amount=fee;row.currency=input.currency;
  row.stage=input.stage;row.priority=input.priority;row.evidence_type=input.evidence_type;
  const verified=["sent_verified","confirmed"].includes(row.stage);
  if(verified&&(!row.evidence_reference||!["sent_message","received_message","agreement"].includes(row.evidence_type)))
    return null;
  // Reported responses are never verified without a human-provided reference.
  if(row.stage==="reply_reported"&&row.evidence_type==="none")return null;
  return row;
}
export function validateNative(kind,input){
  return kind==="contacts"?contact(input):kind==="booking"?booking(input):null;
}
const operation=kind=>kind==="contacts"?CONTACT_OP:kind==="booking"?BOOKING_OP:null;
const prefix=kind=>kind==="contacts"?"crm-contact:":"crm-booking:";
async function listAll(db,kind){
  const op=operation(kind);
  if(!op)return [];
  const all=await db.prepare(
    "SELECT id,entity_id,decision,evidence_json,created_ms FROM control_decision_events "+
    "WHERE operation=? ORDER BY created_ms ASC,id ASC LIMIT 12000"
  ).bind(op).all();
  const map=new Map();
  for(const event of all.results||[]){
    const id=event.entity_id?.startsWith(prefix(kind))?event.entity_id.slice(prefix(kind).length):"";
    if(!validId(id))continue;
    try{
      const record=JSON.parse(event.evidence_json);
      if(!validateNative(kind,record))continue;
      map.set(id,{id,...record,revision:event.id,updated_ms:event.created_ms});
    }catch{}
  }
  return [...map.values()].sort((a,b)=>b.updated_ms-a.updated_ms);
}
function insertEvent(db,kind,id,record,actor){
  return db.prepare(
    "INSERT INTO control_decision_events(id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms) "+
    "VALUES(?,?,?,?,?,?,?,?)"
  ).bind(crypto.randomUUID(),prefix(kind)+id,kind==="booking"?record.artist:null,
    operation(kind),kind==="booking"?record.stage:record.contact_policy,
    record.next_step||"Atualização manual",JSON.stringify(record),Date.now());
}
function audit(db,kind,id,actor,action){
  return db.prepare(
    "INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) VALUES(?,?,?,?,?)"
  ).bind(crypto.randomUUID(),Date.now(),"crm_"+kind+"_"+action,prefix(kind)+id,
    JSON.stringify({actor:actor||"legacy_admin",action}));
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
  if(!["POST","PATCH"].includes(request.method))return fail("method_not_allowed",405);
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
  const record=validateNative(kind,input);
  if(!record)return fail("invalid_record",422);
  const id=request.method==="POST"?(kind==="contacts"&&LEGACY_ID.test(input.id)?input.id:crypto.randomUUID()):input.id;
  if(!validId(id))return fail("invalid_id",422);
  // Do not allow hand-crafted historical references for newly created records.
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
    if(request.method==="POST"&&kind==="contacts"){
      const emails=new Set(record.emails);
      if(before.some(x=>x.name.toLocaleLowerCase("pt-PT")===record.name.toLocaleLowerCase("pt-PT")||
        x.emails.some(e=>emails.has(e))))
        return fail("possible_duplicate_contact",409);
    }
    // A blocked contact must not be linked to a verified proposal.
    if(kind==="booking"&&["sent_verified","confirmed"].includes(record.stage)&&record.contact_id){
      const linked=(await listAll(env.ZOHO_DB,"contacts")).find(x=>x.id===record.contact_id);
      if(linked?.contact_policy==="blocked")return fail("contact_blocked",422);
    }
    // Preserve revision event and audit together. There is no delete endpoint.
    await env.ZOHO_DB.batch([
      insertEvent(env.ZOHO_DB,kind,id,record,actor),
      audit(env.ZOHO_DB,kind,id,actor,request.method==="POST"?"created":"updated")
    ]);
    const current=(await listAll(env.ZOHO_DB,kind)).find(x=>x.id===id);
    return out({ok:true,record:current,append_only:true},request.method==="POST"?201:200);
  }catch{return fail("native_storage_failed",503);}
}
