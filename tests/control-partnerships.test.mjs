import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {handleControl} from "../control-vault.js";
const BASE="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const TOKEN="admin-partnership-test-"+"t".repeat(50);
let sqlite,env;
function d1(db){
  const bind=(sql,args=[])=>({
    async first(){return db.prepare(sql).get(...args)||null},
    async all(){return {results:db.prepare(sql).all(...args)}},
    async run(){return db.prepare(sql).run(...args)}
  });
  return {prepare(sql){return {bind(...args){return bind(sql,args)},...bind(sql)}},
    async batch(items){
      db.exec("BEGIN");
      try{const out=[];for(const item of items)out.push(await item.run());db.exec("COMMIT");return out}
      catch(error){db.exec("ROLLBACK");throw error}
    }};
}
beforeEach(()=>{
  sqlite=new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
  env={ZOHO_DB:d1(sqlite),ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true",ZOHO_ADMIN_TOKEN:TOKEN};
});
afterEach(()=>sqlite.close());
function partner(patch={}){
  return {name:"Example Partner",objective:"Mobility for Portugal tour",next_step:"Confirm appropriate contact",
    stage:"idea",category:"marca",scope:"ambos",priority:"media",evidence_type:"discussion",
    contact_name:"",contact_email:"",channel:"",last_contact_iso:"",next_review_iso:"",
    evidence_reference:"",source_label:"Test only",notes:"Not contacted",...patch};
}
async function request(method="GET",data=null,{token=TOKEN,origin=BASE,csrf=true}={}){
  const r=new Request(origin+"/api/control/partnerships",{
    method,headers:{"Authorization":"Bearer "+token,"Origin":origin,
      ...(csrf?{"X-Caravela-Request":"1"}:{}),
      ...(data?{"Content-Type":"application/json"}:{})},
    ...(data?{body:JSON.stringify(data)}:{})
  });
  return handleControl(r,env,new URL(r.url));
}
test("partnership registry starts empty; no new schema needed",async()=>{
  const response=await request();
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).partners,[]);
});
test("creates partnership; saves immutable event and audit without altering CRM snapshot",async()=>{
  const created=await request("POST",partner());
  assert.equal(created.status,201);
  const id=(await created.json()).id;
  const items=(await (await request()).json()).partners;
  assert.equal(items.length,1);assert.equal(items[0].id,id);assert.equal(items[0].stage,"idea");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='partnership_record_v1'").get().n,1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_snapshots").get().n,0);
  const modified=await request("PATCH",partner({id,stage:"contact_reported",
    evidence_type:"user_report",notes:"User recalls contacting, not yet verified"}));
  assert.equal(modified.status,200);
  const after=(await (await request()).json()).partners;
  assert.equal(after.length,1);assert.equal(after[0].stage,"contact_reported");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='partnership_record_v1'").get().n,2);
});
test("does not silently mark an email sent or a deal confirmed",async()=>{
  assert.equal((await request("POST",partner({stage:"sent_verified"}))).status,422);
  assert.equal((await request("POST",partner({stage:"confirmed",evidence_type:"user_report"}))).status,422);
  assert.equal((await request("POST",partner({stage:"sent_verified",
    evidence_type:"sent_message",evidence_reference:"Zoho message ID, manually verified"}))).status,201);
});
test("rejects duplicates, cross-site mutation, unknown update and bad credentials",async()=>{
  assert.equal((await request("POST",partner())).status,201);
  assert.equal((await request("POST",partner())).status,409);
  assert.equal((await request("POST",partner(),{csrf:false})).status,403);
  assert.equal((await request("PATCH",partner({id:"a".repeat(36)}))).status,404);
  assert.equal((await request("GET",null,{token:"wrong"})).status,401);
  assert.equal((await request("GET",null,{origin:"https://caravelaamarela.com"})).status,404);
});
test("partnerships cannot be read with cron credentials",async()=>{
  env.CONTROL_CRON_TOKEN="cron-"+"x".repeat(48);
  assert.equal((await request("GET",null,{token:env.CONTROL_CRON_TOKEN})).status,401);
});
