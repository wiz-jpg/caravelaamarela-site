import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {operationalOverview} from "../control-operations.js";
const now=Date.parse("2026-10-13T10:00:00Z");
let db,env;
function d1(sqlite){
  function statement(sql,args=[]){return {
    async first(){return sqlite.prepare(sql).get(...args)||null},
    async all(){return {results:sqlite.prepare(sql).all(...args)}},
    async run(){return sqlite.prepare(sql).run(...args)}
  }}
  return {prepare(sql){return {bind(...args){return statement(sql,args)},...statement(sql)}}};
}
beforeEach(()=>{
  db=new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
  env={ZOHO_DB:d1(db),ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true"};
});
afterEach(()=>db.close());
function addRun(provider,status,started,trigger="manual",newRecords=0){
  db.prepare("INSERT INTO control_sync_runs(id,provider,started_ms,completed_ms,status,new_records,examined_records,reason,meta_json) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(crypto.randomUUID(),provider,started,started,status,newRecords,42,status==="failed"?"provider_or_storage_error":"",JSON.stringify({trigger}));
}
function actions(){
  return {provider:"sheets",source_key:"control_actions",title:"AÇÕES",rows:7,
    sheets:[{range:"'AÇÕES'!A1:M1000",values:[
      ["Próxima ação","Festival","Artista","Estado","Prioridade","Região","Mês / datas","Contacto / pessoa","Email principal","Último contacto","Follow-up previsto","Próximo passo","Notas"],
      ["","Festival A","WILDCHAINS","Enviado","A — AGORA","","","","","08/10/2026","12/10/2026","Fazer follow-up se não houver resposta","Proposta enviada"],
      ["","Festival B","Devil of a Woman","Não avançar","A","","","","","","11/10/2026","Contactar","Não avançar por decisão do artista"],
      ["","Festival C","AMBOS","Em negociação","A","","","","","","15/10/2026","Negociar detalhes",""],
      ["","Festival D","Devil of a Woman","Por contactar","B — EM BREVE","","","","","","13/10/2026","Confirmar destinatário","Ainda sem envio"],
      ["","Festival E","AMBOS","Enviado","A","","","","","","12/10/2026","Follow-up","Não contactar este evento"],
      ["","Festival F","WILDCHAINS","Enviado","A","","","","","","12/10/2026","","Falta informação"]]}]};
}
function addSource(time=now){
  const raw=JSON.stringify(actions());
  db.prepare("INSERT INTO control_source_revisions(source_key,revision_sha256,provider,title,raw_json,row_count,captured_ms) VALUES(?,?,?,?,?,?,?)")
    .run("control_actions","a".repeat(64),"sheets","AÇÕES",raw,7,time);
}
test("first launch says historic-only and never claims automation",async()=>{
  const result=await operationalOverview(env,{now,showDetails:true});
  assert.equal(result.mode,"historical_only");
  assert.equal(result.automation.configured,false);
  assert.equal(result.automation.observed,false);
  assert.equal(result.operational.tasks.length,0);
  assert.equal(result.operational.needs_source_review,true);
  assert.equal(result.sync.find(r=>r.provider==="zoho").freshness,"never");
  assert.equal(result.sync.find(r=>r.provider==="sheets").freshness,"not_configured");
});
test("follow-up suggestions are date-bound and exclude blocked or ambiguous rows",async()=>{
  addSource();
  env.CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON="dummy";
  env.CONTROL_ACTIONS_SHEET_ID="dummy1";env.CONTROL_ARTISTS_SHEET_ID="dummy2";
  addRun("sheets","complete",now-1000);
  const result=await operationalOverview(env,{now,showDetails:true});
  assert.equal(result.mode,"sheets_snapshot");
  assert.equal(result.operational.due_count,2);
  assert.deepEqual(result.operational.tasks.map(t=>t.name),["Festival A","Festival D"]);
  assert.equal(result.operational.tasks.every(t=>t.requires_review===true),true);
  assert.equal(result.operational.blocked,2);
  assert.equal(result.operational.without_complete_next_step,1);
  assert.equal(result.operational.needs_source_review,false);
});
test("viewer receives aggregates without contact names or next steps",async()=>{
  addSource();addRun("sheets","complete",now-3000);
  const result=await operationalOverview(env,{now,showDetails:false});
  assert.equal(result.operational.tasks.length,0);
  assert.equal(result.operational.due_count,undefined);
  assert.equal(JSON.stringify(result).includes("Festival A"),false);
});
test("only successful verified Cron executions are considered automatic",async()=>{
  env.CONTROL_CRON_TOKEN="cron-"+"a".repeat(48);
  env.CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON="dummy";
  env.CONTROL_ACTIONS_SHEET_ID="dummy1";env.CONTROL_ARTISTS_SHEET_ID="dummy2";
  addRun("zoho","complete",now-30000,"manual",5);
  addRun("sheets","failed",now-15000,"cron");
  let x=await operationalOverview(env,{now});
  assert.equal(x.automation.observed,false);
  assert.equal(x.sync.find(s=>s.provider==="sheets").freshness,"failed");
  addRun("zoho","complete",now-4000,"cron",3);
  addRun("sheets","complete",now-3000,"cron",1);
  x=await operationalOverview(env,{now});
  assert.equal(x.automation.observed,true);
  assert.equal(x.automation.all_configured_sources_automated,true);
  assert.equal(x.sync.find(s=>s.provider==="zoho").last_new_records,3);
});
test("stale source is flagged even if a historical snapshot is present",async()=>{
  addSource(now-120*60000);
  env.CONTROL_GOOGLE_SERVICE_ACCOUNT_JSON="dummy";
  env.CONTROL_ACTIONS_SHEET_ID="dummy1";env.CONTROL_ARTISTS_SHEET_ID="dummy2";
  addRun("sheets","complete",now-110*60000);
  const data=await operationalOverview(env,{now,showDetails:true});
  assert.equal(data.operational.needs_source_review,true);
  assert.equal(data.sync.find(s=>s.provider==="sheets").freshness,"stale");
});
