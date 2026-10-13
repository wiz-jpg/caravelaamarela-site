/* Preview-only Zoho metadata sync. Exact-address observations, not commercial decisions. */
const MAILBOX="booking@caravelaamarela.com";
const EMAIL=/[a-z0-9.!#$%&'*+/=?^_{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
function emailList(data){
  const raw=[];
  const walk=value=>{
    if(typeof value==="string")raw.push(...(value.match(EMAIL)||[]));
    else if(Array.isArray(value))value.slice(0,50).forEach(walk);
    else if(value&&typeof value==="object"){
      for(const k of ["emailAddress","mailId","email","address"])if(value[k])walk(value[k]);
    }
  };
  walk(data);
  return [...new Set(raw.map(x=>x.toLowerCase()))].slice(0,50);
}
function kindOf(folder){
  const names=[folder.folderType,folder.folderName,folder.name].filter(Boolean)
    .map(x=>String(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase());
  if(names.some(x=>["inbox","caixa de entrada","recebidos"].includes(x)))return "incoming";
  if(names.some(x=>["sent","sent items","enviados","enviadas"].includes(x)))return "outgoing";
  return "";
}
function dateMs(m){
  for(const x of [m.receivedTime,m.sentDateInGMT,m.sentDate,m.date,m.time]){
    if(typeof x==="number"&&Number.isFinite(x))return x<1e11?x*1000:x;
    if(typeof x==="string"&&/^\d{10,13}$/.test(x))return x.length===10?Number(x)*1000:Number(x);
    if(typeof x==="string"&&x.length<70){
      const n=Date.parse(x);if(Number.isFinite(n))return n;
    }
  }
  return null;
}
function isId(s){return typeof s==="string"&&/^\d{1,35}$/.test(s);}
async function providerRead(url,path,request,env,zohoReader){
  const target=new URL("/api/zoho/"+path,url.origin);
  const delegated=new Request(target,{method:"GET",headers:{
    Authorization:request.headers.get("Authorization")||"",
    Origin:url.origin,"Accept":"application/json"
  }});
  const response=await zohoReader(delegated,env,target);
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error("zoho_read_failed");
  return result.data??result.folders;
}
async function lockRun(db,id){
  const now=Date.now();
  const lock=await db.prepare("INSERT INTO control_state(key,value,changed_ms) VALUES('zoho_sync_lock',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,changed_ms=excluded.changed_ms WHERE control_state.changed_ms<? RETURNING value")
    .bind(id,now,now-120000).first();
  return lock?.value===id;
}
async function unlockRun(db,id){
  await db.prepare("UPDATE control_state SET value='',changed_ms=0 WHERE key='zoho_sync_lock' AND value=?").bind(id).run();
}
function insertBlocks(db,rows) {
  const statements=[];
  // 9 bindings per message; 10 rows = 90 parameters (<100 D1 limit).
  for(let offset=0;offset<rows.length;offset+=10){
    const subset=rows.slice(offset,offset+10);
    if(!subset.length)continue;
    const values=subset.map(()=>"(?,?,?,?,?,?,?,?,?)").join(",");
    const query="INSERT OR IGNORE INTO control_mail_headers"+
      "(mailbox,folder_kind,message_id,folder_id,from_email,to_json,received_ms,thread_id,first_seen_ms) VALUES "+values;
    const params=subset.flatMap(r=>[r.mailbox,r.kind,r.id,r.folder_id,r.from,
      r.to_json,r.date,r.thread_id,r.observed]);
    statements.push(db.prepare(query).bind(...params));
  }
  return statements;
}
export async function syncZohoMail(request,env,url,zohoReader,{trigger="manual"}={}) {
  if(request.method!=="POST")return {ok:false,error:"method_not_allowed",status:405};
  if(typeof zohoReader!=="function")return {ok:false,error:"sync_not_available",status:503};
  const db=env.ZOHO_DB,id=crypto.randomUUID(),now=Date.now();
  if(!(await lockRun(db,id)))return {ok:false,error:"sync_in_progress",status:409};
  let scanned=0,newRows=0;
  try {
    const folders=await providerRead(url,"folders",request,env,zohoReader);
    if(!Array.isArray(folders))throw new Error("zoho_invalid_folders");
    const kinds=["incoming","outgoing"];
    const rows=[],updates=[];
    for(const kind of kinds){
      const folder=folders.find(f=>kindOf(f)===kind);
      if(!folder)throw new Error("zoho_folder_missing");
      const folderId=String(folder.folderId||folder.id||"");
      if(!isId(folderId))throw new Error("zoho_invalid_folder_id");
      const position=await db.prepare("SELECT folder_id,older_start FROM control_mail_sync_position WHERE folder_kind=?")
        .bind(kind).first();
      const previous=position?.folder_id===folderId?position.older_start:1;
      const olderStart=Math.max(1,Math.min(1000000,previous||1));
      // Always scan 50 newest plus 50 older for incremental coverage.
      const windows=[1,olderStart===1?51:olderStart];
      let lastWindowCount=0;
      for(const start of windows) {
        const response=await providerRead(url,"messages?"+
          new URLSearchParams({folderId,start:String(start),limit:"50"}),request,env,zohoReader);
        const items=Array.isArray(response)?response:response?.messages;
        if(!Array.isArray(items))throw new Error("zoho_invalid_messages");
        scanned+=items.length;
        lastWindowCount=items.length;
        for(const mail of items) {
          const msgId=String(mail.messageId||"");
          if(!isId(msgId))continue;
          rows.push({mailbox:MAILBOX,kind,id:msgId,folder_id:folderId,
            from:emailList(mail.fromAddress)[0]||null,
            to_json:JSON.stringify(emailList(mail.toAddress)),
            date:dateMs(mail),thread_id:String(mail.threadId||"").slice(0,100)||null,
            observed:Date.now()});
        }
      }
      const next=lastWindowCount<50?Math.max(1,olderStart):olderStart===1?101:olderStart+50;
      updates.push(db.prepare("INSERT INTO control_mail_sync_position(folder_kind,folder_id,older_start,updated_ms) VALUES(?,?,?,?) ON CONFLICT(folder_kind) DO UPDATE SET folder_id=excluded.folder_id,older_start=excluded.older_start,updated_ms=excluded.updated_ms")
        .bind(kind,folderId,Math.min(1000000,next),Date.now()));
    }
    // Observations are append-only; duplicate message IDs are ignored on repeat scans.
    const previous=await db.prepare("SELECT COUNT(*) AS n FROM control_mail_headers").first();
    await db.batch([...insertBlocks(db,rows),...updates,
      db.prepare("INSERT INTO control_sync_runs(id,provider,started_ms,completed_ms,status,new_records,examined_records,reason,meta_json) VALUES(?,'zoho',?,?,'complete',0,?,'',?)")
        .bind(id,now,Date.now(),scanned,JSON.stringify({trigger:trigger==="cron"?"cron":"manual"}))]);
    const current=await db.prepare("SELECT COUNT(*) AS n FROM control_mail_headers").first();
    newRows=(current?.n||0)-(previous?.n||0);
    await db.prepare("UPDATE control_sync_runs SET new_records=? WHERE id=?").bind(newRows,id).run();
    return {ok:true,provider:"zoho",scanned,new_records:newRows,
      total_indexed:current?.n||0,read_only:true,
      note:"Email recebido não demonstra resposta a proposta; assuntos e corpos não são guardados."};
  }catch{
    await db.prepare("INSERT INTO control_sync_runs(id,provider,started_ms,completed_ms,status,new_records,examined_records,reason,meta_json) VALUES(?,'zoho',? ,?,'failed',0,?,'provider_or_storage_error',?)")
      .bind(id,now,Date.now(),scanned,JSON.stringify({trigger:trigger==="cron"?"cron":"manual"})).run().catch(()=>{});
    return {ok:false,error:"zoho_sync_failed",status:502};
  }finally{await unlockRun(db,id).catch(()=>{});}
}
