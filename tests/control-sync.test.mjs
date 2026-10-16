import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {handleControl} from "../control-vault.js";
const BASE="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const ADMIN="admin-"+"a".repeat(48);
const CRON="cron-"+"c".repeat(48);
let db,env,calls;
function adapter(sqlite){
  const query=(sql,args=[])=>({
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async run(){return sqlite.prepare(sql).run(...args);}
  });
  return {prepare(sql){return {bind(...args){return query(sql,args)},...query(sql)}},
    async batch(batch){
      sqlite.exec("BEGIN");
      try{for(const statement of batch)await statement.run();sqlite.exec("COMMIT")}
      catch(e){sqlite.exec("ROLLBACK");throw e}
    }};
}
beforeEach(()=>{
  db=new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
  env={ZOHO_DB:adapter(db),ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true",
    ZOHO_ADMIN_TOKEN:ADMIN,CONTROL_CRON_TOKEN:CRON};
  calls=[];
});
afterEach(()=>db.close());
async function reader(request){
  const url=new URL(request.url);
  calls.push({route:url.pathname,params:url.searchParams,
    auth:request.headers.get("Authorization")});
  if(url.pathname.endsWith("/folders"))return Response.json({ok:true,data:[
    {folderId:"11",folderName:"Inbox"},{folderId:"22",folderName:"Sent"}
  ]});
  if(url.pathname.endsWith("/content"))return Response.json({ok:true,data:{content:"Temos interesse em avançar para um concerto no festival."}});
  if(url.pathname.endsWith("/messages")){
    const start=Number(url.searchParams.get("start"));
    if(start>1)return Response.json({ok:true,data:[]});
    const isInbox=url.searchParams.get("folderId")==="11";
    return Response.json({ok:true,data:[{
      messageId:isInbox?"200":"100",threadId:"300",
      fromAddress:isInbox?"festival@example.test":"booking@caravelaamarela.com",
      toAddress:isInbox?"booking@caravelaamarela.com":"festival@example.test",
      receivedTime:1790000000000,subject:"Private booking offer",
      summary:"Do not save this preview"
    }]});
  }
  return Response.json({ok:false,error:"not_found"},{status:404});
}
async function request(token=ADMIN,method="POST"){
  const req=new Request(BASE+"/api/control/zoho/sync",{
    method,headers:{Authorization:"Bearer "+token,Origin:BASE}
  });
  return handleControl(req,env,new URL(req.url),reader);
}
test("Zoho sync stores minimal metadata in D1, never subjects or bodies",async()=>{
  const result=await request();
  assert.equal(result.status,200);
  const data=await result.json();
  assert.equal(data.scanned,2);
  assert.equal(data.new_records,2);
  const rows=db.prepare("SELECT * FROM control_mail_headers").all();
  assert.equal(rows.length,2);
  assert.equal(rows.some(r=>r.from_email==="festival@example.test"),true);
  const stored=JSON.stringify(rows);
  assert.equal(stored.includes("Private booking offer"),false);
  assert.equal(stored.includes("Do not save this preview"),false);
});
test("rerunning Zoho sync is idempotent and preserves previous rows",async()=>{
  assert.equal((await request()).status,200);
  const second=await request();
  assert.equal((await second.json()).new_records,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM control_mail_headers").get().n,2);
});
test("cron token only authorizes sync and never forwards cron token upstream",async()=>{
  const response=await request(CRON);
  assert.equal(response.status,200);
  assert.ok(calls.length>=3);
  for(const call of calls)assert.equal(call.auth,"Bearer "+ADMIN);
  const req=new Request(BASE+"/api/control/audit",{headers:{Authorization:"Bearer "+CRON}});
  assert.equal((await handleControl(req,env,new URL(req.url),reader)).status,401);
});
test("Zoho sync cannot run when Preview cofre is disabled",async()=>{
  env.CONTROL_VAULT_ENABLED="false";
  assert.equal((await request()).status,404);
  assert.equal(calls.length,0);
});


test("enabled mail-body analysis stores only review signals and never changes booking",async()=>{
 db.exec(readFileSync(new URL("../migrations/0005_control_mail_signals.sql",import.meta.url),"utf8"));
 env.CONTROL_MAIL_ANALYSIS_ENABLED="true";
 const first=await (await request()).json();
 assert.equal(first.ok,true);
 assert.equal(first.analysis.enabled,true);
 assert.equal(first.analysis.new_signals,1);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM control_mail_signals").get().n,1);
 assert.equal(db.prepare("SELECT signal FROM control_mail_signals").get().signal,"interest");
 const saved=JSON.stringify(db.prepare("SELECT * FROM control_mail_signals").all());
 assert.ok(!saved.includes("Temos interesse"));
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM control_decision_events").get().n,0);
 assert.equal((await (await request()).json()).analysis.new_signals,0);
});
test("content feature gate and migration requirement are visible without breaking metadata sync",async()=>{
 env.CONTROL_MAIL_ANALYSIS_ENABLED="true";
 const out=(await (await request()).json());
 assert.equal(out.ok,true);
 assert.equal(out.analysis.reason,"migration_required");
 assert.equal(out.total_indexed,2);
});

test("automatic Cron creates exactly one human-review task after classifying mail",async()=>{
 db.exec(readFileSync(new URL("../migrations/0005_control_mail_signals.sql",import.meta.url),"utf8"));
 db.exec(readFileSync(new URL("../migrations/0006_control_review_tasks.sql",import.meta.url),"utf8"));
 env.CONTROL_MAIL_ANALYSIS_ENABLED="true";
 const first=await (await request(CRON)).json();
 assert.equal(first.ok,true);
 assert.equal(first.analysis.new_signals,1);
 assert.equal(first.review_tasks.enabled,true);
 assert.equal(first.review_tasks.created,1);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_review_tasks WHERE status='pending'").get().n,1);
 const again=await (await request(CRON)).json();
 assert.equal(again.review_tasks.created,0);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_review_tasks").get().n,1);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_decision_events").get().n,0);
 const meta=JSON.parse(db.prepare(
  "SELECT meta_json FROM control_sync_runs ORDER BY started_ms DESC,rowid DESC LIMIT 1").get().meta_json);
 assert.equal(meta.review_tasks_enabled,true);
});
test("absent review-task migration does not interrupt existing read-only Cron sync",async()=>{
 db.exec(readFileSync(new URL("../migrations/0005_control_mail_signals.sql",import.meta.url),"utf8"));
 env.CONTROL_MAIL_ANALYSIS_ENABLED="true";
 const result=await (await request(CRON)).json();
 assert.equal(result.ok,true);
 assert.equal(result.analysis.enabled,true);
 assert.equal(result.review_tasks.enabled,false);
 assert.equal(result.review_tasks.reason,"migration_required");
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_mail_signals").get().n,1);
});
