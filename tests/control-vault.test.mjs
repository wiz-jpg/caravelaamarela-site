import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {handleControl} from "../control-vault.js";
const HOST="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const TOKEN="test-token-".padEnd(48,"x");
const enc=new TextEncoder();
const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",x)),b=>b.toString(16).padStart(2,"0")).join("");
let sqlite,env;
function d1(db){
  function bind(sql,args=[]){
    return {
      async first(){return db.prepare(sql).get(...args)||null},
      async all(){return {results:db.prepare(sql).all(...args)}},
      async run(){return db.prepare(sql).run(...args)}
    };
  }
  return {
    prepare(sql){return {bind(...args){return bind(sql,args)},...bind(sql)}},
    async batch(items){
      db.exec("BEGIN");
      try{const out=[];for(const item of items)out.push(await item.run());db.exec("COMMIT");return out;}
      catch(e){db.exec("ROLLBACK");throw e;}
    }
  };
}
beforeEach(()=>{
  sqlite=new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
  env={ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true",ZOHO_ADMIN_TOKEN:TOKEN,ZOHO_DB:d1(sqlite)};
});
afterEach(()=>sqlite.close());
function call(path,{method="GET",data,body,token=TOKEN,origin=HOST,headers={}}={}){
  const req=new Request(origin+path,{
    method,headers:{Authorization:"Bearer "+token,Origin:origin,...headers,
      ...(data?{"Content-Type":"application/json"}:{})},
    ...(data?{body:JSON.stringify(data)}:body?{body,duplex:"half"}:{})
  });
  return handleControl(req,env,new URL(req.url));
}
async function fixture(label){
  const data={schema:"caravela.crm.import.v1",manifest_version:3,
    summary:{total:1,operational_actions:1,artist_projects:1,source_evidence_rows:1},
    entities:[{id:"festival_"+"a".repeat(22),kind:"festival",name:"Test "+label,
      emails:["event@example.test"],origin:{file:"test",sheet:"fest",row:2}}],
    actions:[{name:"Test "+label,status:"Não avançar",artist:"Devil of a Woman"}],
    artists:[{name:"Test Project",is_roster:false}],suppressions:[],
    source_evidence:[{file:"fixture",row:2}],sources:[{file:"fixture"}],
    automation_policy:{automatic_sending_enabled:false,automatic_follow_up_enabled:false}};
  data.manifest_sha256=await sha(enc.encode(JSON.stringify(data)));
  const bytes=enc.encode(JSON.stringify(data));
  return {data,bytes,raw_sha256:await sha(bytes)};
}
async function saveFixture(label,{activate=true}={}){
  const f=await fixture(label);
  const start=await call("/api/control/snapshot/start",{method:"POST",data:{
    bytes:f.bytes.length,parts:1,raw_sha256:f.raw_sha256,
    manifest_sha256:f.data.manifest_sha256}});
  assert.equal(start.status,201);
  const meta=await start.json();
  const chunk=await call("/api/control/snapshot/"+meta.id+"/part/0",{
    method:"PUT",body:f.bytes,headers:{"X-Part-SHA256":f.raw_sha256}});
  assert.equal(chunk.status,200);
  const seal=await call("/api/control/snapshot/"+meta.id+"/seal",{method:"POST"});
  assert.equal(seal.status,200);
  assert.equal((await seal.json()).state,"sealed");
  if(activate)assert.equal((await call("/api/control/snapshot/"+meta.id+"/activate",{method:"POST"})).status,200);
  return {...f,id:meta.id};
}
test("production host, disabled vault and missing token fail closed",async()=>{
  const req=new Request("https://caravelaamarela.com/api/control/status",
    {headers:{Authorization:"Bearer "+TOKEN}});
  assert.equal((await handleControl(req,env,new URL(req.url))).status,404);
  assert.equal((await call("/api/control/status",{token:"bad"})).status,401);
  env.CONTROL_VAULT_ENABLED="false";
  assert.equal((await call("/api/control/status")).status,404);
});
test("original snapshot survives exact-byte roundtrip and is only active after approval",async()=>{
  const f=await saveFixture("initial",{activate:false});
  assert.equal((await call("/api/control/snapshot/active")).status,404);
  assert.equal((await call("/api/control/snapshot/"+f.id+"/activate",{method:"POST"})).status,200);
  const output=await call("/api/control/snapshot/active");
  assert.equal(output.headers.get("X-Control-SHA256"),f.raw_sha256);
  assert.deepEqual(new Uint8Array(await output.arrayBuffer()),f.bytes);
});
test("duplicate imports resume idempotently; new active version never deletes historical",async()=>{
  const old=await saveFixture("old");
  const existing=await call("/api/control/snapshot/start",{method:"POST",data:{
    bytes:old.bytes.length,parts:1,raw_sha256:old.raw_sha256,
    manifest_sha256:old.data.manifest_sha256}});
  assert.equal((await existing.json()).already_exists,true);
  const next=await saveFixture("new");
  assert.notEqual(old.id,next.id);
  const count=sqlite.prepare("SELECT COUNT(*) AS n FROM control_snapshots").get().n;
  assert.equal(count,2);
  const original=sqlite.prepare("SELECT state FROM control_snapshots WHERE id=?").get(old.id);
  assert.equal(original.state,"sealed");
  const backup=await call("/api/control/snapshot/active");
  assert.equal((await backup.json()).entities[0].name,"Test new");
});
test("corrupt part is rejected and cannot be sealed",async()=>{
  const f=await fixture("corruption");
  const start=await call("/api/control/snapshot/start",{method:"POST",data:{
    bytes:f.bytes.length,parts:1,raw_sha256:f.raw_sha256,
    manifest_sha256:f.data.manifest_sha256}});
  const id=(await start.json()).id;
  const modified=enc.encode(JSON.stringify({invalid:true}));
  const invalid=await call("/api/control/snapshot/"+id+"/part/0",{method:"PUT",
    body:modified,headers:{"X-Part-SHA256":f.raw_sha256}});
  assert.notEqual(invalid.status,200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_snapshot_parts").get().n,0);
});
test("single cron credential cannot view private snapshots or audit",async()=>{
  env.CONTROL_CRON_TOKEN="cron-token-".padEnd(48,"z");
  const key=env.CONTROL_CRON_TOKEN;
  assert.equal((await call("/api/control/status",{token:key})).status,401);
  assert.equal((await call("/api/control/snapshot/active",{token:key})).status,401);
  assert.equal((await call("/api/control/audit",{token:key})).status,401);
});
test("invalid import manifest cannot become active",async()=>{
  const f=await fixture("invalid");
  const object=JSON.parse(new TextDecoder().decode(f.bytes));
  object.automation_policy.automatic_sending_enabled=true;
  const changed=enc.encode(JSON.stringify(object));
  const raw=await sha(changed);
  const start=await call("/api/control/snapshot/start",{method:"POST",data:{
    bytes:changed.length,parts:1,raw_sha256:raw,
    manifest_sha256:object.manifest_sha256}});
  const id=(await start.json()).id;
  assert.equal((await call("/api/control/snapshot/"+id+"/part/0",{
    method:"PUT",body:changed,headers:{"X-Part-SHA256":raw}})).status,200);
  const seal=await call("/api/control/snapshot/"+id+"/seal",{method:"POST"});
  assert.equal(seal.status,422);
  assert.equal((await call("/api/control/snapshot/"+id+"/activate",{method:"POST"})).status,404);
});
