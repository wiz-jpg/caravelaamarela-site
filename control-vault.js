import { syncZohoMail } from "./control-sync-zoho.js";
/* Caravela Control vault. Private Preview only; no destructive or outbound operations. */
const CONTROL_HOST="feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const CONTROL_MAILBOX="booking@caravelaamarela.com";
const MAX_BYTES=12*1024*1024;
const PART_BYTES=128*1024;
const ENC=new TextEncoder();
const DEC=new TextDecoder("utf-8",{fatal:true});
const HEX=x=>Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,"0")).join("");
const looksHash=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const looksId=x=>typeof x==="string"&&/^[0-9a-f-]{36}$/.test(x);
async function hashBytes(bytes){return HEX(await crypto.subtle.digest("SHA-256",bytes));}
function respond(data,status=200) {
  return Response.json(data,{status,headers:{"Cache-Control":"no-store","Pragma":"no-cache",
    "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
    "Cross-Origin-Resource-Policy":"same-origin"}});
}
function reject(code,status=400){return respond({ok:false,error:code},status);}
async function constantEqual(a,b){
  const [left,right]=await Promise.all([hashBytes(ENC.encode(a)),hashBytes(ENC.encode(b))]);
  let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}
function audit(db,operation,target,details={}){
  return db.prepare("INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) VALUES(?,?,?,?,?)")
   .bind(crypto.randomUUID(),Date.now(),operation,target,JSON.stringify(details));
}
function jsonBody(request,max=4096){
  const size=Number(request.headers.get("Content-Length")||0);
  if(size>max)throw new Error("payload_too_large");
  return request.text().then(txt=>{
    if(txt.length>max)throw new Error("payload_too_large");
    return JSON.parse(txt);
  });
}
function validImport(data) {
  if(!data||data.schema!=="caravela.crm.import.v1"||
    !looksHash(data.manifest_sha256)||
    !Array.isArray(data.entities)||!Array.isArray(data.actions)||
    !Array.isArray(data.artists)||!Array.isArray(data.suppressions)||
    !Array.isArray(data.source_evidence)||!Array.isArray(data.sources)||
    !data.summary||data.entities.length!==data.summary.total||
    data.actions.length!==data.summary.operational_actions||
    data.artists.length!==data.summary.artist_projects||
    data.source_evidence.length!==data.summary.source_evidence_rows||
    data.entities.length<1||data.entities.length>10000||
    data.actions.length>5000||data.artists.length>2000||
    data.source_evidence.length>50000)return false;
  const ids=new Set();
  for(const item of data.entities){
    if(!item||typeof item.id!=="string"||
      !/^(festival|venue|promoter|press)_[a-f0-9]{22}$/.test(item.id)||
      ids.has(item.id)||typeof item.name!=="string"||
      !item.name.trim()||!Array.isArray(item.emails)||!item.origin)return false;
    ids.add(item.id);
  }
  if(!data.automation_policy||
    data.automation_policy.automatic_sending_enabled!==false||
    data.automation_policy.automatic_follow_up_enabled!==false)return false;
  return true;
}
function unpack(parts,record){
  if(parts.length!==record.declared_parts)throw new Error("parts_missing");
  const buffer=new Uint8Array(record.declared_bytes);
  let offset=0;
  for(let i=0;i<parts.length;i++){
    const part=parts[i];
    if(part.part_index!==i)throw new Error("parts_not_contiguous");
    const binary=atob(part.encoded);
    if(binary.length!==part.bytes||part.bytes>PART_BYTES||
       offset+binary.length>buffer.byteLength)throw new Error("parts_invalid");
    for(let j=0;j<binary.length;j++)buffer[offset+j]=binary.charCodeAt(j);
    offset+=binary.length;
  }
  if(offset!==record.declared_bytes)throw new Error("size_mismatch");
  return buffer;
}
async function getParts(db,id){
  return (await db.prepare("SELECT part_index,bytes,encoded,sha256 FROM control_snapshot_parts WHERE snapshot_id=? ORDER BY part_index")
    .bind(id).all()).results||[];
}
async function loadSnapshot(db,id){
  const record=await db.prepare("SELECT * FROM control_snapshots WHERE id=? AND state='sealed'").bind(id).first();
  if(!record)throw new Error("snapshot_not_found");
  const bytes=unpack(await getParts(db,id),record);
  if(await hashBytes(bytes)!==record.raw_sha256)throw new Error("snapshot_integrity_failure");
  return {record,bytes};
}
export async function handleControl(request,env,url,zohoReader) {
  // A public production hostname must NEVER expose the private CRM routes.
  if(url.protocol!=="https:"||url.hostname!==CONTROL_HOST||
     env.ZOHO_ENABLED!=="true"||env.CONTROL_VAULT_ENABLED!=="true"||!env.ZOHO_DB||
     typeof env.ZOHO_ADMIN_TOKEN!=="string"||env.ZOHO_ADMIN_TOKEN.length<43)
    return reject("not_found",404);
  if(await constantEqual(request.headers.get("Authorization")||"",
     "Bearer "+env.ZOHO_ADMIN_TOKEN)===false)return reject("unauthorized",401);
  if((request.headers.get("Origin")&&request.headers.get("Origin")!==url.origin)||
     request.headers.get("Sec-Fetch-Site")==="cross-site")return reject("invalid_origin",403);
  const route=url.pathname.slice("/api/control/".length);
  const db=env.ZOHO_DB;
  try{
    if(route==="zoho/sync"){
      const result=await syncZohoMail(request,env,url,zohoReader);
      return respond(result,result.status||200);
    }
    if(route==="status"&&request.method==="GET"){
      const table=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='control_snapshots'").first();
      if(!table)return respond({ok:true,schema_ready:false,backup_status:"not_configured"});
      const selected=await db.prepare("SELECT value FROM control_state WHERE key='active_snapshot'").first();
      const snapshots=await db.prepare("SELECT id,raw_sha256,created_ms,sealed_ms,entity_count,action_count,artist_count,triage_count,state FROM control_snapshots ORDER BY created_ms DESC LIMIT 12").all();
      const mail=await db.prepare("SELECT folder_kind,COUNT(*) AS count FROM control_mail_headers GROUP BY folder_kind").all();
      const sources=await db.prepare("SELECT source_key,MAX(captured_ms) AS last_capture_ms,COUNT(*) AS versions FROM control_source_revisions GROUP BY source_key").all();
      return respond({ok:true,schema_ready:true,active_snapshot:selected?.value||null,
        snapshots:snapshots.results||[],mail:mail.results||[],sources:sources.results||[],
        gmail_connected:false,sheets_connected:!!env.CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON,
        scheduled_sync_configured:false,offsite_backup_configured:false});
    }
    if(route==="snapshot/active"&&request.method==="GET"){
      const record=await db.prepare("SELECT value FROM control_state WHERE key='active_snapshot'").first();
      if(!record)return reject("no_active_snapshot",404);
      const restored=await loadSnapshot(db,record.value);
      return new Response(restored.bytes,{status:200,headers:{
        "Content-Type":"application/json; charset=utf-8",
        "X-Content-Type-Options":"nosniff","Cache-Control":"no-store",
        "Referrer-Policy":"no-referrer","Cross-Origin-Resource-Policy":"same-origin",
        "X-Control-SHA256":restored.record.raw_sha256}});
    }
    if(route==="snapshot/start"&&request.method==="POST"){
      const input=await jsonBody(request);
      if(!looksHash(input?.raw_sha256)||!looksHash(input?.manifest_sha256)||
         !Number.isSafeInteger(input.bytes)||input.bytes<=0||input.bytes>MAX_BYTES||
         !Number.isSafeInteger(input.parts)||input.parts!==Math.ceil(input.bytes/PART_BYTES)||
         input.parts>128)return reject("invalid_snapshot_metadata");
      const old=await db.prepare("SELECT id,state FROM control_snapshots WHERE raw_sha256=?")
        .bind(input.raw_sha256).first();
      if(old)return respond({ok:true,id:old.id,state:old.state,already_exists:true});
      const id=crypto.randomUUID(),now=Date.now();
      await db.batch([
        db.prepare("INSERT INTO control_snapshots(id,raw_sha256,manifest_sha256,declared_bytes,declared_parts,state,created_ms) VALUES(?,?,?,?,?,'staging',?)")
        .bind(id,input.raw_sha256,input.manifest_sha256,input.bytes,input.parts,now),
        audit(db,"snapshot_started",id,{bytes:input.bytes,parts:input.parts})
      ]);
      return respond({ok:true,id,state:"staging",already_exists:false},201);
    }
    const partRoute=/^snapshot\/([0-9a-f-]{36})\/part\/(\d{1,3})$/.exec(route);
    if(partRoute&&request.method==="PUT"){
      const id=partRoute[1],index=Number(partRoute[2]);
      const item=await db.prepare("SELECT state,declared_parts,declared_bytes FROM control_snapshots WHERE id=?")
        .bind(id).first();
      if(!item||item.state!=="staging")return reject("not_staging",409);
      if(index>=item.declared_parts)return reject("invalid_part");
      const data=new Uint8Array(await request.arrayBuffer());
      if(data.length<1||data.length>PART_BYTES||
         (index<item.declared_parts-1&&data.length!==PART_BYTES)||
         (index===item.declared_parts-1&&data.length!==
           item.declared_bytes-index*PART_BYTES))return reject("invalid_part_size");
      const digest=await hashBytes(data);
      if(digest!==request.headers.get("X-Part-SHA256"))return reject("part_checksum_mismatch",422);
      const existing=await db.prepare("SELECT sha256 FROM control_snapshot_parts WHERE snapshot_id=? AND part_index=?")
        .bind(id,index).first();
      if(existing)return existing.sha256===digest?respond({ok:true,index,already_exists:true}):reject("immutable_part_conflict",409);
      let encoded="";
      for(let j=0;j<data.length;j+=8192)encoded+=String.fromCharCode(...data.subarray(j,j+8192));
      await db.prepare("INSERT INTO control_snapshot_parts(snapshot_id,part_index,bytes,sha256,encoded,created_ms) VALUES(?,?,?,?,?,?)")
        .bind(id,index,data.length,digest,btoa(encoded),Date.now()).run();
      return respond({ok:true,index});
    }
    const sealRoute=/^snapshot\/([0-9a-f-]{36})\/seal$/.exec(route);
    if(sealRoute&&request.method==="POST"){
      const id=sealRoute[1];
      const record=await db.prepare("SELECT * FROM control_snapshots WHERE id=?").bind(id).first();
      if(!record||record.state!=="staging")return reject("not_staging",409);
      const parts=await getParts(db,id);
      const bytes=unpack(parts,record);
      for(const part of parts){
        const raw=Uint8Array.from(atob(part.encoded),x=>x.charCodeAt(0));
        if(await hashBytes(raw)!==part.sha256)throw new Error("part_integrity_failure");
      }
      if(await hashBytes(bytes)!==record.raw_sha256)throw new Error("snapshot_integrity_failure");
      const parsed=JSON.parse(DEC.decode(bytes));
      if(!validImport(parsed)||parsed.manifest_sha256!==record.manifest_sha256)
        return reject("snapshot_schema_mismatch",422);
      const original={...parsed};
      delete original.manifest_sha256;
      if(await hashBytes(ENC.encode(JSON.stringify(original)))!==parsed.manifest_sha256)
        return reject("manifest_integrity_failure",422);
      const meta={entity_count:parsed.entities.length,action_count:parsed.actions.length,
        artist_count:parsed.artists.length,triage_count:parsed.zoho_triage?.address_count||0};
      await db.batch([
        db.prepare("UPDATE control_snapshots SET state='sealed',sealed_ms=?,entity_count=?,action_count=?,artist_count=?,triage_count=? WHERE id=? AND state='staging'")
          .bind(Date.now(),meta.entity_count,meta.action_count,meta.artist_count,meta.triage_count,id),
        audit(db,"snapshot_sealed",id,meta)
      ]);
      return respond({ok:true,id,state:"sealed",...meta});
    }
    const activate=/^snapshot\/([0-9a-f-]{36})\/activate$/.exec(route);
    if(activate&&request.method==="POST"){
      const id=activate[1];
      const verified=await loadSnapshot(db,id);
      if(!verified)return reject("not_sealed",409);
      await db.batch([
        db.prepare("INSERT INTO control_state(key,value,changed_ms) VALUES('active_snapshot',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,changed_ms=excluded.changed_ms")
          .bind(id,Date.now()),
        audit(db,"snapshot_activated",id,{raw_sha256:verified.record.raw_sha256})
      ]);
      return respond({ok:true,id,active:true});
    }
    if(route==="audit"&&request.method==="GET"){
      const result=await db.prepare("SELECT id,occurred_ms,operation,target,details_json FROM control_audit ORDER BY occurred_ms DESC LIMIT 100").all();
      return respond({ok:true,events:result.results||[]});
    }
    return reject("not_found",404);
  }catch(error){
    const fixed={
      payload_too_large:413,parts_missing:409,parts_not_contiguous:409,
      parts_invalid:422,size_mismatch:422,part_integrity_failure:422,
      snapshot_integrity_failure:422,snapshot_not_found:404
    };
    const name=typeof error.message==="string"&&Object.hasOwn(fixed,error.message)?error.message:null;
    const missing=typeof error.message==="string"&&
      /no such table|no such column/.test(error.message);
    return reject(name|| (missing?"migration_required":"vault_error"),
      name?fixed[name]:missing?503:500);
  }
}
