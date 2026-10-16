/* Caravela Control mail workspace — Preview only.
 * Save and recover AES-GCM encrypted human-authored draft versions.
 * NO Zoho send scope, outbound fetch, queue, email dispatch, or auto commercial changes. */
import {handleNative} from "./control-native.js";

const HOST="feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const MAILBOX="booking@caravelaamarela.com";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE=/^\d{1,35}$/;
const ADDRESS=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const reply=(data,status=200)=>Response.json(data,{status,headers:{
 "Cache-Control":"no-store","Pragma":"no-cache","Referrer-Policy":"no-referrer",
 "X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"
}});
const failure=(error,status=400)=>reply({ok:false,error},status);
const encode=bytes=>btoa(String.fromCharCode(...bytes));
const decode=str=>Uint8Array.from(atob(str),x=>x.charCodeAt(0));

async function draftKey(env){
 const raw=env.ZOHO_TOKEN_KEY;
 if(typeof raw!=="string"||!/^[A-Za-z0-9+/]{43}=$/.test(raw))
  throw Error("draft_crypto_unavailable");
 const seed=await crypto.subtle.importKey("raw",decode(raw),"HKDF",false,["deriveKey"]);
 return crypto.subtle.deriveKey({
  name:"HKDF",hash:"SHA-256",
  salt:encoder.encode("caravela-control-private-drafts-v1"),
  info:encoder.encode("AES-GCM:booking@caravelaamarela.com:read-write-drafts")
 },seed,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function aad(id,revision){return encoder.encode("caravela:draft:v1:"+MAILBOX+":"+id+":"+revision)}
async function encryptedOffsiteCopy(env,{id,revision,ciphertext,status,now}){
 if(env.CONTROL_R2_BACKUP_ENABLED!=="true")return false;
 const bucket=env.CONTROL_BACKUP_BUCKET;
 if(!bucket)throw Error("draft_backup_unavailable");
 const key="mail-drafts/v1/"+id+"/"+revision+".json";
 const blob=encoder.encode(JSON.stringify({
  schema:"caravela.maildraft.encrypted.v1",id,revision,status,
  ciphertext,created_ms:now
 }));
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",blob)),
  b=>b.toString(16).padStart(2,"0")).join("");
 const existing=await bucket.head(key);
 if(existing){
  if(existing.customMetadata?.sha256!==hash)throw Error("draft_backup_conflict");
 }else{
  await bucket.put(key,blob,{
   httpMetadata:{contentType:"application/json"},
   customMetadata:{sha256:hash}
  });
 }
 const remote=await bucket.get(key);
 if(!remote)throw Error("draft_backup_missing");
 const received=new Uint8Array(await remote.arrayBuffer());
 const remoteHash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",received)),
  b=>b.toString(16).padStart(2,"0")).join("");
 if(hash!==remoteHash)throw Error("draft_backup_checksum_failed");
 return true;
}
async function protect(key,id,revision,payload){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=new Uint8Array(await crypto.subtle.encrypt({
  name:"AES-GCM",iv,additionalData:aad(id,revision)
 },key,encoder.encode(JSON.stringify(payload))));
 return "v1."+encode(iv)+"."+encode(cipher);
}
async function reveal(key,id,revision,text){
 const parts=String(text).split(".");
 if(parts.length!==3||parts[0]!=="v1")throw Error("draft_decrypt_failed");
 try{
  return JSON.parse(decoder.decode(await crypto.subtle.decrypt({
   name:"AES-GCM",iv:decode(parts[1]),additionalData:aad(id,revision)
  },key,decode(parts[2]))));
 }catch{throw Error("draft_decrypt_failed")}
}
function value(input,k,max){
 return typeof input[k]==="string"&&input[k].length<=max?input[k].trim():null;
}
function validate(input){
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const to=value(input,"to",254),subject=value(input,"subject",180),
  // Preserve intentional spacing, signatures and trailing newlines in email bodies.
  body=typeof input.body==="string"&&input.body.length<=12000?input.body:null,
  artist=value(input,"artist",110),
  context=value(input,"context",350),
  booking_id=value(input,"booking_id",80),
  source_message_id=value(input,"source_message_id",35);
 if([to,subject,body,artist,context,booking_id,source_message_id].some(x=>x===null))return null;
 if(to&&!ADDRESS.test(to))return null;
 if(booking_id&&!ID.test(booking_id))return null;
 if(source_message_id&&!MESSAGE.test(source_message_id))return null;
 // Draft can be incomplete; it is NEVER automatically approved for sending.
 return {to:to.toLowerCase(),subject,body,artist,context,booking_id,source_message_id};
}
async function verifyLinks(env,url,payload){
 if(payload.source_message_id){
  const exists=await env.ZOHO_DB.prepare(
   "SELECT message_id FROM control_mail_headers WHERE mailbox=? AND folder_kind='incoming' AND message_id=?"
  ).bind(MAILBOX,payload.source_message_id).first();
  if(!exists)return "source_message_not_found";
 }
 if(payload.booking_id){
  const nativeUrl=new URL("/api/control/native/booking",url);
  const data=await handleNative(new Request(nativeUrl,{method:"GET"}),env,nativeUrl,
   "native/booking",{canRead:true});
  if(!data.ok)return "booking_unavailable";
  const records=(await data.json()).records||[];
  if(!records.some(x=>x.id===payload.booking_id))return "booking_not_found";
 }
 return null;
}
async function schema(db){
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('control_mail_drafts','control_mail_draft_versions')").all()).results||[];
 return tables.length===2;
}
function checkOrigin(request,url){
 return request.headers.get("X-Caravela-Request")==="1"&&
  (!request.headers.get("Origin")||request.headers.get("Origin")===url.origin)&&
  request.headers.get("Sec-Fetch-Site")!=="cross-site";
}
async function inputBody(request){
 if(Number(request.headers.get("Content-Length")||0)>15000)return null;
 const raw=await request.text();
 if(raw.length>15000)return null;
 try{return JSON.parse(raw)}catch{return null}
}
export async function handleMailDrafts(request,env,url,{actor=""}={}){
 if(url.protocol!=="https:"||url.hostname!==HOST)return failure("not_found",404);
 if(!env.ZOHO_DB)return failure("storage_unavailable",503);
 if(!actor)return failure("unauthorized",401);
 try{
  const db=env.ZOHO_DB;
  if(!(await schema(db)))return failure("drafts_migration_required",409);
  // Keep the draft crypto key independent of the Zoho OAuth AES-GCM key via HKDF.
  // Key rotation needs a controlled re-encryption migration before changing ZOHO_TOKEN_KEY.
  const key=await draftKey(env);
  if(request.method==="GET"){
   const id=url.searchParams.get("id")||"";
   const requested=url.searchParams.get("revision");
   if(id&&!ID.test(id))return failure("invalid_draft_id",422);
   if(requested&&(!id||!/^[1-9]\d{0,5}$/.test(requested)))
    return failure("invalid_revision",422);
   if(id){
    const data=await db.prepare("SELECT id,revision,status,created_ms,updated_ms,created_by,edited_by FROM control_mail_drafts WHERE id=?").bind(id).first();
    if(!data)return failure("draft_not_found",404);
    const versions=(await db.prepare(
     "SELECT revision,created_ms,edited_by FROM control_mail_draft_versions WHERE draft_id=? ORDER BY revision DESC LIMIT 50"
    ).bind(id).all()).results||[];
    const revision=requested?Number(requested):data.revision;
    const latest=await db.prepare(
     "SELECT ciphertext FROM control_mail_draft_versions WHERE draft_id=? AND revision=?"
    ).bind(id,revision).first();
    if(!latest)return failure("draft_version_not_found",404);
    const payload=await reveal(key,id,revision,latest.ciphertext);
    return reply({ok:true,draft:{...data,...payload},displayed_revision:revision,
     versions,never_sent:true,mailbox:MAILBOX});
   }
   const rows=(await db.prepare(
    "SELECT d.id,d.revision,d.status,d.created_ms,d.updated_ms,d.created_by,d.edited_by,v.ciphertext "+
    "FROM control_mail_drafts d JOIN control_mail_draft_versions v "+
    "ON v.draft_id=d.id AND v.revision=d.revision "+
    "ORDER BY d.updated_ms DESC,d.id DESC LIMIT 100"
   ).all()).results||[];
   const drafts=[];
   for(const row of rows){
    const payload=await reveal(key,row.id,row.revision,row.ciphertext);
    const {ciphertext,...fields}=row;
    drafts.push({...fields,...payload});
   }
   return reply({ok:true,drafts,limit:100,mailbox:MAILBOX,
    never_sent:true,readonly_original_zoho:true});
  }
  if(!["POST","PATCH"].includes(request.method))return failure("method_not_allowed",405);
  if(!checkOrigin(request,url))return failure("invalid_origin",403);
  const body=await inputBody(request);
  const payload=validate(body);
  if(!payload)return failure("invalid_draft",422);
  const linkError=await verifyLinks(env,url,payload);
  if(linkError)return failure(linkError,409);
  const now=Date.now(),who=String(actor).slice(0,80);
  if(request.method==="POST"){
   if(body?.id!==undefined||body?.revision!==undefined||body?.status!==undefined)
    return failure("unexpected_fields",422);
   const id=crypto.randomUUID(),ciphertext=await protect(key,id,1,payload);
   // Verify an independent encrypted R2 copy first, when Preview R2 backups are enabled.
   const backedUp=await encryptedOffsiteCopy(env,{id,revision:1,ciphertext,status:"draft",now});
   await db.batch([
    db.prepare("INSERT INTO control_mail_drafts(id,revision,status,created_ms,updated_ms,created_by,edited_by) VALUES(?,1,'draft',?,?,?,?)").bind(id,now,now,who,who),
    db.prepare("INSERT INTO control_mail_draft_versions(draft_id,revision,ciphertext,created_ms,edited_by) VALUES(?,1,?,?,?)").bind(id,ciphertext,now,who),
    db.prepare("INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) VALUES(?,?,?,?,?)")
      .bind(crypto.randomUUID(),now,"mail_draft_created",id,JSON.stringify({actor:who,revision:1}))
   ]);
   return reply({ok:true,id,revision:1,status:"draft",saved:true,sent:false,
    independent_backup_verified:backedUp},201);
  }
  if(!ID.test(body?.id||"")||!Number.isSafeInteger(body?.revision)||
    body.revision<1||!["draft","archived"].includes(body?.status))
    return failure("invalid_update",422);
  const existing=await db.prepare("SELECT revision,status FROM control_mail_drafts WHERE id=?")
   .bind(body.id).first();
  if(!existing)return failure("draft_not_found",404);
  if(existing.revision!==body.revision)return failure("revision_conflict",409);
  const revision=existing.revision+1;
  const ciphertext=await protect(key,body.id,revision,payload);
  const backedUp=await encryptedOffsiteCopy(env,{
    id:body.id,revision,ciphertext,status:body.status,now
  });
  // A conditional optimistic update plus archival revision and audit are one D1 transaction.
  const changes=await db.batch([
   db.prepare("UPDATE control_mail_drafts SET revision=?,status=?,updated_ms=?,edited_by=? WHERE id=? AND revision=?")
    .bind(revision,body.status,now,who,body.id,existing.revision),
   db.prepare(
    "INSERT INTO control_mail_draft_versions(draft_id,revision,ciphertext,created_ms,edited_by) "+
    "SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM control_mail_drafts WHERE id=? AND revision=? AND updated_ms=? AND edited_by=?)"
   ).bind(body.id,revision,ciphertext,now,who,body.id,revision,now,who),
   db.prepare("INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) "+
    "SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM control_mail_draft_versions WHERE draft_id=? AND revision=?)")
    .bind(crypto.randomUUID(),now,"mail_draft_revised",body.id,
      JSON.stringify({actor:who,revision,status:body.status}),body.id,revision)
  ]);
  if(Number(changes[0]?.meta?.changes??changes[0]?.changes??0)!==1)
   return failure("revision_conflict",409);
  return reply({ok:true,id:body.id,revision,status:body.status,saved:true,sent:false,
   old_versions_preserved:true,independent_backup_verified:backedUp});
 }catch(e){
  const code=["draft_crypto_unavailable","draft_decrypt_failed"].includes(e?.message)?
    e.message:"drafts_unavailable";
  return failure(code,503);
 }
}
