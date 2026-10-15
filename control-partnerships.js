/* Preview-only partnership registry. Reuses the existing append-only D1 decision log.
 * No booking actions or artist pipeline records are overwritten.
 * A conversation-reported contact is never silently promoted to a verified send. */
const OPERATION="partnership_record_v1";
const CATEGORIES=new Set(["marca","institucional","mobilidade","equipamento","producao","comunicacao","circuito","outra"]);
const STAGES=new Set(["idea","draft","contact_reported","sent_verified","reply_reported","negotiating","collaboration_reported","active_reported","confirmed","paused","closed"]);
const PRIORITIES=new Set(["alta","media","baixa","a_definir"]);
const SCOPES=new Set(["agencia","wildchains","devil","ambos","outro"]);
const EVIDENCES=new Set(["none","discussion","user_report","sent_message","received_message","agreement"]);
const FIELDS={
  name:140,objective:350,contact_name:110,contact_email:250,channel:80,
  last_contact_iso:10,next_review_iso:10,next_step:400,notes:1600,
  evidence_reference:450,source_label:160
};
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const entityKey=value=>String(value||"").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const dateRe=/^\d{4}-\d{2}-\d{2}$/;
const output=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const reject=(error,status=400)=>output({ok:false,error},status);
function clean(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const row={};
  for(const [key,max] of Object.entries(FIELDS)){
    const value=input[key]??"";
    if(typeof value!=="string"||value.length>max)return null;
    row[key]=value.trim();
  }
  if(!row.name||!row.objective||!row.next_step)return null;
  if(row.contact_email&&!emailRe.test(row.contact_email))return null;
  if(row.last_contact_iso&&(!dateRe.test(row.last_contact_iso)||Number.isNaN(Date.parse(row.last_contact_iso))))return null;
  if(row.next_review_iso&&(!dateRe.test(row.next_review_iso)||Number.isNaN(Date.parse(row.next_review_iso))))return null;
  for(const [field,set] of [
    ["category",CATEGORIES],["stage",STAGES],["priority",PRIORITIES],
    ["scope",SCOPES],["evidence_type",EVIDENCES]
  ]){
    if(typeof input[field]!=="string"||!set.has(input[field]))return null;
    row[field]=input[field];
  }
  // Publicly identified ongoing support is distinct from an executed contract.
  if(row.stage==="active_reported"&&(!row.evidence_reference||
     !["user_report","agreement"].includes(row.evidence_type)))
    return null;
  // Explicit message/contract evidence and a reference required for verified statuses.
  if(["sent_verified","confirmed"].includes(row.stage)&&
     (!row.evidence_reference||!["sent_message","received_message","agreement"].includes(row.evidence_type)))
    return null;
  if(row.stage==="idea"||row.stage==="draft"){
    if(row.evidence_type==="sent_message"||row.evidence_type==="received_message"||row.evidence_type==="agreement")
      return null;
  }
  return row;
}
async function records(db){
  const query=await db.prepare(
    "SELECT id,entity_id,decision,evidence_json,created_ms " +
    "FROM control_decision_events WHERE operation=? ORDER BY created_ms ASC,id ASC LIMIT 3000"
  ).bind(OPERATION).all();
  const latest=new Map();
  for(const event of query.results||[]){
    const id=event.entity_id?.replace(/^partnership:/,"");
    if(!id||!/^[a-f0-9-]{36}$/.test(id))continue;
    try{
      const data=JSON.parse(event.evidence_json);
      if(!data||typeof data!=="object"||!data.name)continue;
      latest.set(id,{id,...data,updated_ms:event.created_ms,revision:event.id});
    }catch{}
  }
  return [...latest.values()].sort((a,b)=>(b.updated_ms||0)-(a.updated_ms||0));
}
function append(db,id,data){
  return db.prepare("INSERT INTO control_decision_events(id,entity_id,artist_name,operation,decision,rationale,evidence_json,created_ms) VALUES(?,?,NULL,?,?,?,?,?)")
    .bind(crypto.randomUUID(),"partnership:"+id,OPERATION,data.stage,data.notes||data.objective,JSON.stringify(data),Date.now());
}
function audit(db,operation,id){
  return db.prepare("INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(),Date.now(),operation,"partnership:"+id,"{}");
}
export async function handlePartnerships(request,env,url,allowedToWrite){
  if(!env.ZOHO_DB)return reject("not_found",404);
  if(request.method!=="GET"&&!allowedToWrite)return reject("forbidden",403);
  if(request.method!=="GET"&&(
      (request.headers.get("Origin")&&request.headers.get("Origin")!==url.origin)||
      request.headers.get("Sec-Fetch-Site")==="cross-site"||
      request.headers.get("X-Caravela-Request")!=="1"))
    return reject("invalid_origin",403);
  const db=env.ZOHO_DB;
  try{
    const all=await records(db);
    if(request.method==="GET")return output({ok:true,partners:all,total:all.length,
      source:"control_decision_events",append_only:true});
    if(!["POST","PATCH"].includes(request.method))return reject("method_not_allowed",405);
    const raw=await request.text();
    if(raw.length>8000)return reject("payload_too_large",413);
    let input;try{input=JSON.parse(raw)}catch{return reject("invalid_json",400)}
    const cleaned=clean(input);
    if(!cleaned)return reject("invalid_partnership",422);
    const id=typeof input.id==="string"?input.id:"";
    if(request.method==="PATCH"&&(!/^[a-f0-9-]{36}$/.test(id)||!all.some(p=>p.id===id)))
      return reject("partnership_not_found",404);
    if(request.method==="POST"&&id)return reject("invalid_new_id",400);
    if(request.method==="POST"&&all.some(p=>entityKey(p.name)===entityKey(cleaned.name)))
      return reject("partnership_already_exists",409);
    const resolved=id||crypto.randomUUID();
    await db.batch([append(db,resolved,cleaned),audit(db,request.method==="POST"?"partnership_created":"partnership_updated",resolved)]);
    return output({ok:true,id:resolved,partner:cleaned,append_only:true},request.method==="POST"?201:200);
  }catch{return reject("partnership_storage_failed",503)}
}
