import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {handleControl} from "../control-vault.js";
import {validateNative} from "../control-native.js";
const BASE="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const TOKEN="native-test-admin-"+"x".repeat(49);
let sqlite,env;
function d1(db){
  const stmt=(sql,args=[])=>({
    async first(){return db.prepare(sql).get(...args)||null},
    async all(){return {results:db.prepare(sql).all(...args)}},
    async run(){return db.prepare(sql).run(...args)}
  });
  return {prepare(sql){return {bind(...args){return stmt(sql,args)},...stmt(sql)}},
    async batch(items){
      db.exec("BEGIN");
      try{const result=[];for(const x of items)result.push(await x.run());db.exec("COMMIT");return result}
      catch(error){db.exec("ROLLBACK");throw error}
    }};
}
beforeEach(()=>{
  sqlite=new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
  env={ZOHO_DB:d1(sqlite),ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true",ZOHO_ADMIN_TOKEN:TOKEN};
});
afterEach(()=>sqlite.close());
const contact=(patch={})=>({
  name:"Example Venue",kind:"venue",city:"Braga",emails:["venue@example.pt"],
  contact_policy:"review",notes:"Needs human check",next_step:"Validate promoter",
  review_date:"2026-10-20",source_label:"Manual test",origin_id:"",...patch
});
const deal=(patch={})=>({
  contact_name:"Example Venue",contact_id:"",contact_email:"venue@example.pt",
  artist:"WILDCHAINS",subject:"Concert 2027",stage:"research",priority:"high",
  fee_amount:700,currency:"EUR",fee_note:"Travel excluded",conditions:"Venue to provide PA",
  next_step:"Validate contact",due_date:"2026-10-18",last_contact_date:"",
  evidence_type:"none",evidence_reference:"",origin_label:"Manual test",
  owner:"Booking",notes:"No proposal sent",...patch
});
async function req(kind="contacts",method="GET",record=null,{token=TOKEN,origin=BASE,csrf=true}={}){
 const request=new Request(origin+"/api/control/native/"+kind,{
  method,headers:{"Authorization":"Bearer "+token,"Origin":origin,
   ...(csrf?{"X-Caravela-Request":"1"}:{}),
   ...(record?{"Content-Type":"application/json"}:{})},
  ...(record?{body:JSON.stringify(record)}:{})
 });
 return handleControl(request,env,new URL(request.url));
}
test("native workspaces start empty without extra migration; snapshots unaffected",async()=>{
 for(const kind of ["contacts","booking"]){
   const response=await req(kind);
   assert.equal(response.status,200);
   assert.deepEqual((await response.json()).records,[]);
 }
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_snapshots").get().n,0);
});
test("contact is created, revised with optimistic token and logged append-only",async()=>{
 const response=await req("contacts","POST",contact());
 assert.equal(response.status,201);
 const first=(await response.json()).record;
 assert.equal(first.name,"Example Venue");assert.equal(first.contact_policy,"review");
 const changed=await req("contacts","PATCH",contact({id:first.id,revision:first.revision,contact_policy:"blocked"}));
 assert.equal(changed.status,200);
 assert.equal((await changed.json()).record.contact_policy,"blocked");
 assert.equal((await req("contacts","PATCH",contact({id:first.id,revision:first.revision}))).status,409);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='crm_contact_v1'").get().n,2);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_audit WHERE operation LIKE 'crm_contacts_%'").get().n,2);
});
test("booking evidence and status guards; no inferred send or agreement",async()=>{
 assert.equal(validateNative("booking",deal({stage:"sent_verified"})),null);
 assert.equal((await req("booking","POST",deal({stage:"confirmed",evidence_type:"user_report"}))).status,422);
 assert.equal((await req("booking","POST",deal({stage:"reply_reported"}))).status,422);
 const created=await req("booking","POST",deal());
 assert.equal(created.status,201);
 const first=(await created.json()).record;
 assert.equal(first.stage,"research");
 const amended=await req("booking","PATCH",deal({
   id:first.id,revision:first.revision,stage:"sent_verified",evidence_type:"sent_message",
   evidence_reference:"Zoho mail ID verified manually"
 }));
 assert.equal(amended.status,200);
 assert.equal((await amended.json()).record.stage,"sent_verified");
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,2);
});
test("blocked native contact cannot be attached to verified booking",async()=>{
 const saved=await req("contacts","POST",contact({contact_policy:"blocked"}));
 const id=(await saved.json()).record.id;
 const result=await req("booking","POST",deal({
  contact_id:id,stage:"sent_verified",evidence_type:"sent_message",
  evidence_reference:"Old Zoho mail ID"
 }));
 assert.equal(result.status,422);assert.equal((await result.json()).error,"contact_blocked");
});
test("rejects duplicates, unsafe input and unauthorized public or Cron access",async()=>{
 assert.equal((await req("contacts","POST",contact())).status,201);
 assert.equal((await req("contacts","POST",contact())).status,409);
 assert.equal((await req("contacts","POST",contact({emails:["bad email"]}))).status,422);
 assert.equal((await req("contacts","POST",contact(),{csrf:false})).status,403);
 assert.equal((await req("booking","POST",deal(),{token:"invalid"})).status,401);
 assert.equal((await req("contacts","GET",null,{origin:"https://caravelaamarela.com"})).status,404);
 env.CONTROL_CRON_TOKEN="cron-"+"y".repeat(48);
 assert.equal((await req("contacts","GET",null,{token:env.CONTROL_CRON_TOKEN})).status,401);
});
