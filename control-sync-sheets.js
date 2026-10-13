/* Caravela Control: Google Sheets service-account READ ONLY snapshots. */
const SCOPE="https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const API_ORIGIN="https://sheets.googleapis.com";
const encoder=new TextEncoder();
function asBase64Url(input){
  const bytes=typeof input==="string"?encoder.encode(input):new Uint8Array(input);
  let binary="";
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function importedKey(pem){
  const body=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,"");
  return Uint8Array.from(atob(body),c=>c.charCodeAt(0));
}
async function serviceAccountAccess(env){
  let account;
  try{account=JSON.parse(env.CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON||"");}catch{throw Error("google_account_not_configured");}
  if(!account||account.type!=="service_account"||
     typeof account.client_email!=="string"||
     typeof account.private_key!=="string"||
     !account.private_key.includes("BEGIN PRIVATE KEY"))throw Error("google_account_not_configured");
  const now=Math.floor(Date.now()/1000);
  const header=asBase64Url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=asBase64Url(JSON.stringify({iss:account.client_email,scope:SCOPE,
    aud:TOKEN_URL,iat:now,exp:now+3300}));
  const value=header+"."+claims;
  const key=await crypto.subtle.importKey("pkcs8",importedKey(account.private_key),
    {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature=asBase64Url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,encoder.encode(value)));
  const response=await fetch(TOKEN_URL,{method:"POST",redirect:"error",
    signal:AbortSignal.timeout(15000),
    headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:value+"."+signature})});
  if(!response.ok)throw Error("google_auth_failed");
  const body=await response.json();
  if(typeof body.access_token!=="string"||!body.access_token)throw Error("google_auth_failed");
  return body.access_token;
}
function validSheetId(id){
  return typeof id==="string"&&/^[A-Za-z0-9_-]{25,125}$/.test(id);
}
function configs(env){
  const actions=env.CONTROL_ACTIONS_SHEET_ID;
  const artists=env.CONTROL_ARTISTS_SHEET_ID;
  if(!validSheetId(actions)||!validSheetId(artists))throw Error("google_sources_not_configured");
  return [{
    provider:"sheets",key:"control_actions",id:actions,title:"Caravela Control · AÇÕES",
    ranges:["'AÇÕES'!A1:M1000"]
  },{
    provider:"sheets",key:"artist_pipeline",id:artists,title:"Caravela Artist Pipeline",
    ranges:["'WILDCHAINS'!A1:H160","'Devil'!A1:H160","'Can Bayoğlu'!A1:H160",
      "'Sammer Salah'!A1:H160","'we are •••'!A1:H160","'THE BROTHERS'!A1:H160",
      "'Boney M — Maizie'!A1:H160","'WHY NOT TRIBE'!A1:H160","'iNWATER'!A1:H160",
      "'Nothisera'!A1:H160","'Francis Valadj'!A1:H160"]
  }];
}
async function readWorkbook(source,token){
  const params=new URLSearchParams({valueRenderOption:"FORMATTED_VALUE"});
  for(const range of source.ranges)params.append("ranges",range);
  const url=API_ORIGIN+"/v4/spreadsheets/"+source.id+"/values:batchGet?"+params;
  const response=await fetch(url,{method:"GET",redirect:"error",
    signal:AbortSignal.timeout(20000),
    headers:{"Authorization":"Bearer "+token,"Accept":"application/json"}});
  if(!response.ok)throw Error("google_sheet_read_failed");
  const result=await response.json();
  if(!Array.isArray(result.valueRanges)||
    result.valueRanges.length!==source.ranges.length)throw Error("google_sheet_invalid_response");
  const sheets=result.valueRanges.map((range,i)=>({
    range:source.ranges[i],returned_range:String(range.range||""),
    values:Array.isArray(range.values)?range.values:[]
  }));
  const rows=sheets.reduce((count,s)=>count+s.values.length,0);
  if(rows>2500)throw Error("google_sheet_exceeds_limit");
  return {source_key:source.key,title:source.title,provider:"sheets",sheets,rows};
}
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
async function hash(value){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)));}
async function lockSheets(db,runId){
  const now=Date.now();
  const lock=await db.prepare(
    "INSERT INTO control_state(key,value,changed_ms) VALUES('sheets_sync_lock',?,?) "+
    "ON CONFLICT(key) DO UPDATE SET value=excluded.value,changed_ms=excluded.changed_ms "+
    "WHERE control_state.changed_ms<? RETURNING value"
  ).bind(runId,now,now-120000).first();
  return lock?.value===runId;
}
async function unlockSheets(db,runId){
  await db.prepare("UPDATE control_state SET value='',changed_ms=0 "+
    "WHERE key='sheets_sync_lock' AND value=?").bind(runId).run();
}
export async function syncGoogleSheets(env,{trigger="manual"}={}){
  const sources=configs(env);
  const db=env.ZOHO_DB,runId=crypto.randomUUID(),started=Date.now();
  if(!(await lockSheets(db,runId)))throw Error("sheets_sync_in_progress");
  const added=[];
  try{
    const token=await serviceAccountAccess(env);
    for(const source of sources){
      const workbook=await readWorkbook(source,token);
      const raw=JSON.stringify(workbook);
      if(raw.length>1600000)throw Error("google_sheet_exceeds_storage_limit");
      const digest=await hash(raw);
      const exists=await db.prepare(
        "SELECT revision_sha256 FROM control_source_revisions "+
        "WHERE source_key=? AND revision_sha256=?"
      ).bind(source.key,digest).first();
      if(!exists){
        // Concurrent schedulers cannot advance the same source twice.
        await db.prepare(
          "INSERT OR IGNORE INTO control_source_revisions "+
          "(source_key,revision_sha256,provider,title,raw_json,row_count,captured_ms) "+
          "VALUES(?,?,?,?,?,?,?)"
        ).bind(source.key,digest,"sheets",source.title,raw,workbook.rows,Date.now()).run();
        added.push(source.key);
      }
    }
    await db.prepare(
      "INSERT INTO control_sync_runs(id,provider,started_ms,completed_ms,status,"+
      "new_records,examined_records,reason,meta_json) "+
      "VALUES(?,'sheets',?,?,'complete',?,?, '',?)"
    ).bind(runId,started,Date.now(),added.length,sources.length,
      JSON.stringify({trigger:trigger==="cron"?"cron":"manual",changed_sources:added})).run();
    return {ok:true,provider:"sheets",sources_scanned:sources.length,
      changed_sources:added,read_only:true,
      reminder:"Revisões adicionadas sem substituir a fonte original."};
  }catch(error){
    // Preserve a fixed public error code and only safe metadata.
    await db.prepare(
      "INSERT INTO control_sync_runs(id,provider,started_ms,completed_ms,status,"+
      "new_records,examined_records,reason,meta_json) "+
      "VALUES(?,'sheets',?,?,'failed',0,?,'provider_or_storage_error',?)"
    ).bind(runId,started,Date.now(),sources.length,
      JSON.stringify({trigger:trigger==="cron"?"cron":"manual"})).run().catch(()=>{});
    throw error;
  }finally{
    await unlockSheets(db,runId).catch(()=>{});
  }
}
