/* Caravela Control operational overview (Preview only).
 * Read-only derived insights; no auto-email, automatic commercial status or guesswork.
 * Every displayed opportunity comes from the most recent captured source row. */
const DATE_RE=/^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_RE=/^\d{4}-\d{2}-\d{2}$/;
const BLOCKED_RE=/não avançar|bloquead[oa]|não contactar|nao contactar|não enviar|nao enviar|falha de entrega|opt.out/i;
const PENDING_RE=/^por contactar$/i;
const REPLIED_RE=/^em conversa$|^em negociação$/i;
const SENT_RE=/^enviado$/i;
const PROVIDERS=["zoho","sheets"];
const normal=x=>typeof x==="string"?x.trim():String(x??"").trim();
const lower=x=>normal(x).toLocaleLowerCase("pt-PT");
const today=ms=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"
}).format(ms);
function parseDate(raw){
  if(typeof raw!=="string")return null;
  const value=raw.trim(),m=value.match(DATE_RE);
  const iso=m?m[3]+"-"+m[2]+"-"+m[1]:value;
  if(!ISO_RE.test(iso))return null;
  const timestamp=Date.parse(iso+"T12:00:00Z");
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===iso?iso:null;
}
function priority(value){
  const text=normal(value).toUpperCase();
  if(text.startsWith("A")||text==="ALTA")return 3;
  if(text.startsWith("B")||text==="MÉDIA"||text==="MEDIA")return 2;
  return 1;
}
function sourceActionTasks(rows,now,showDetail){
  const date=today(now),tasks=[];
  let candidates=0,blocked=0,unknown=0;
  for(const row of rows){
    if(!Array.isArray(row)||row.length<4)continue;
    const name=normal(row[1]),artist=normal(row[2]),stage=normal(row[3]);
    const notes=normal(row[12]),next=normal(row[11]),dateText=normal(row[10])||normal(row[0]);
    if(!name||!stage)continue;
    const blockedRow=BLOCKED_RE.test(stage)||BLOCKED_RE.test(notes);
    if(blockedRow){blocked++;continue;}
    if(!REPLIED_RE.test(stage)&&!SENT_RE.test(stage)&&!PENDING_RE.test(stage))continue;
    candidates++;
    const due=parseDate(dateText);
    if(!due||!next){unknown++;continue;}
    if(due>date)continue;
    const prio=priority(row[4]);
    const daysLate=Math.max(0,Math.round((Date.parse(date+"T12:00:00Z")-Date.parse(due+"T12:00:00Z"))/86400000));
    if(!showDetail)continue;
    tasks.push({name:name.slice(0,180),artist:artist.slice(0,120),state:stage.slice(0,70),
      due,days_late:daysLate,priority:prio,next_step:next.slice(0,400),
      source:"Caravela Control · AÇÕES",source_evidence:"sheet_row",
      /* The action is a suggestion, never permission to send. */
      requires_review:true});
  }
  tasks.sort((a,b)=>b.priority-a.priority||b.days_late-a.days_late||
    a.due.localeCompare(b.due)||a.name.localeCompare(b.name,"pt"));
  return {due_count:showDetail?tasks.length:undefined,candidates,blocked,without_complete_next_step:unknown,tasks:tasks.slice(0,20)};
}
async function latestRun(db,provider){
  const attempts=await db.prepare(
    "SELECT started_ms,completed_ms,status,new_records,examined_records,reason,meta_json "+
    "FROM control_sync_runs WHERE provider=? ORDER BY started_ms DESC LIMIT 30"
  ).bind(provider).all();
  const runs=attempts.results||[];
  const success=runs.find(r=>r.status==="complete");
  const auto=runs.find(r=>r.status==="complete"&&triggerFrom(r.meta_json)==="cron");
  return {provider,last_run_ms:runs[0]?.completed_ms||runs[0]?.started_ms||null,
    last_status:runs[0]?.status||"never",
    last_success_ms:success?.completed_ms||null,
    last_automatic_success_ms:auto?.completed_ms||null,
    last_new_records:success?.new_records??null,
    /* Only coded reasons. Never leak database or provider errors. */
    last_error:runs[0]?.status==="failed"?"sync_failed":null};
}
function triggerFrom(meta){
  try{
    const parsed=JSON.parse(meta||"{}");
    return parsed&&parsed.trigger==="cron"?"cron":"manual";
  }catch{return "manual"}
}
function freshness(run,now,threshold,configured){
  if(!configured)return "not_configured";
  if(!run.last_success_ms)return run.last_status==="failed"?"failed":"never";
  if(now-run.last_success_ms>threshold)return "stale";
  if(run.last_status==="failed")return "warning";
  return "recent";
}
export async function operationalOverview(env,{showDetails=false,now=Date.now()}={}){
  const db=env.ZOHO_DB;
  const [zoho,sheets,mail,source,snapshot]=await Promise.all([
    latestRun(db,"zoho"),latestRun(db,"sheets"),
    db.prepare("SELECT folder_kind,COUNT(*) AS n FROM control_mail_headers GROUP BY folder_kind").all(),
    db.prepare("SELECT raw_json,captured_ms,row_count FROM control_source_revisions WHERE source_key='control_actions' ORDER BY captured_ms DESC LIMIT 1").first(),
    db.prepare("SELECT s.entity_count,s.action_count,s.artist_count FROM control_snapshots s JOIN control_state t ON t.value=s.id WHERE t.key='active_snapshot' AND s.state='sealed'").first()
  ]);
  const settings={
    zoho:env.ZOHO_ENABLED==="true"&&!!env.ZOHO_DB,
    sheets:!!(env.CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON&&env.CONTROL_ACTIONS_SHEET_ID&&env.CONTROL_ARTISTS_SHEET_ID)
  };
  const statuses=[zoho,sheets].map(run=>({
    ...run,configured:settings[run.provider],
    freshness:freshness(run,now,run.provider==="zoho"?45*60000:90*60000,settings[run.provider])
  }));
  const latest=source?JSON.parse(source.raw_json):null;
  const actions=latest?.sheets?.find(sheet=>
    typeof sheet.range==="string"&&sheet.range.includes("AÇÕES"))?.values||[];
  const derived=sourceActionTasks(actions.slice(1),now,showDetails);
  const msgCount=Object.fromEntries((mail.results||[]).map(r=>[r.folder_kind,r.n]));
  return {
    ok:true,as_of_ms:now,
    mode:source?"sheets_snapshot":"historical_only",
    historical_counts:snapshot?{
      contacts:snapshot.entity_count,actions:snapshot.action_count,artists:snapshot.artist_count
    }:null,
    mail_indexed:{incoming:msgCount.incoming||0,outgoing:msgCount.outgoing||0},
    sync:statuses,
    automation:{
      configured:typeof env.CONTROL_CRON_TOKEN==="string"&&env.CONTROL_CRON_TOKEN.length>=43,
      observed:statuses.some(s=>s.last_automatic_success_ms!==null),
      all_configured_sources_automated:statuses.filter(s=>s.configured).every(s=>s.last_automatic_success_ms!==null)&&
        statuses.some(s=>s.configured)
    },
    sheet_last_capture_ms:source?.captured_ms||null,
    operational:{
      ...derived,
      /* A stale sheet must never be represented as reliable current data. */
      needs_source_review:!source||
        (now-source.captured_ms>90*60000)||
        statuses.find(s=>s.provider==="sheets")?.freshness!=="recent"
    }
  };
}
