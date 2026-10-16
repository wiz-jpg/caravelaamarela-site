import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {materializeMailReviewTasks,matchMailTaskContacts} from "../control-review-tasks.js";
import {handleControl} from "../control-vault.js";

const ADDRESS="booking@caravelaamarela.com";
const HOST="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const ADMIN="admin-"+"z".repeat(48);
const CRON="cron-"+"z".repeat(48);
let sql,env;
function adapter(db){
 const stmt=(query,args=[])=>({
  async first(){return db.prepare(query).get(...args)||null},
  async all(){return {results:db.prepare(query).all(...args)}},
  async run(){return db.prepare(query).run(...args)}
 });
 return {prepare(q){return {bind(...a){return stmt(q,a)},...stmt(q)}},
  async batch(statements){
   db.exec("BEGIN");
   try{
    const out=[];for(const s of statements)out.push(await s.run());
    db.exec("COMMIT");return out;
   }catch(e){db.exec("ROLLBACK");throw e}
  }};
}
beforeEach(()=>{
 sql=new DatabaseSync(":memory:");
 for(const file of ["0003_control_vault.sql","0005_control_mail_signals.sql","0006_control_review_tasks.sql"]){
  sql.exec(readFileSync(new URL("../migrations/"+file,import.meta.url),"utf8"));
 }
 env={ZOHO_DB:adapter(sql),ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true",
  CONTROL_CRON_TOKEN:CRON,ZOHO_ADMIN_TOKEN:ADMIN};
});
afterEach(()=>sql.close());
function insert(id,email="venue@example.test",topic="booking",signal="interest",confidence="rule_based"){
 sql.prepare("INSERT INTO control_mail_headers(mailbox,folder_kind,message_id,folder_id,from_email,"+
  "to_json,received_ms,thread_id,first_seen_ms) VALUES (?,?,?,?,?,?,?,?,?)")
 .run(ADDRESS,"incoming",id,"11",email,"[]",1790000000000,"123",1790000000000);
 sql.prepare("INSERT INTO control_mail_signals(mailbox,folder_kind,message_id,thread_id,"+
  "external_email,message_ms,topic,signal,confidence,reason_code,classifier_version,observed_ms) "+
  "VALUES (?,?,?,?,?,?,?,?,?,?,1,?)")
 .run(ADDRESS,"incoming",id,"123",email,1790000000000,topic,signal,confidence,"test_rule",1790000000000);
}
function call(method="GET",body=null,token=ADMIN,headers={}){
 const url=new URL(HOST+"/api/control/mail/review-tasks");
 const request=new Request(url,{method,headers:{
  Authorization:"Bearer "+token,Origin:HOST,"X-Caravela-Request":"1",
  ...(body?{"Content-Type":"application/json"}:{}),...headers
 },...(body?{body:JSON.stringify(body)}:{})});
 return handleControl(request,env,url,async()=>Response.json({ok:false},{status:500}));
}
test("one pending task per real Zoho message; irrelevant, ambiguous and noreply messages excluded",async()=>{
 insert("100");insert("101","noreply@example.test");insert("102","editor@example.test","press","needs_reply");
 insert("103","contact@example.test","other","interest");insert("104","fest@example.test","booking","ambiguous","insufficient");
 const out=await materializeMailReviewTasks(env.ZOHO_DB);
 assert.equal(out.created,2);
 assert.equal((await materializeMailReviewTasks(env.ZOHO_DB)).created,0);
 const rows=sql.prepare("SELECT * FROM control_review_tasks").all();
 assert.deepEqual(rows.map(x=>x.message_id).sort(),["100","102"]);
 assert.ok(rows.every(x=>x.status==="pending"&&x.revision===0));
 const saved=JSON.stringify(rows);assert.ok(!saved.includes("subject")&&!saved.includes("body"));
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events").get().n,0);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_audit").get().n,0);
});
test("private role checks, human-only disposition, revision conflict and retained history",async()=>{
 insert("200");
 await materializeMailReviewTasks(env.ZOHO_DB);
 assert.equal((await call("GET",null,CRON)).status,401);
 assert.equal((await call("PATCH",{message_id:"200",revision:0,status:"reviewed",note:""},CRON)).status,401);
 const listed=await call();
 assert.equal(listed.status,200);
 const payload=await listed.json();
 assert.equal(payload.kind,"human_review_queue");
 assert.equal(payload.counts.pending,1);
 assert.equal(payload.tasks[0].association,"unmatched");
 assert.equal(payload.tasks[0].requires_review,true);
 assert.equal((await call("PATCH",{message_id:"200",revision:0,status:"reviewed",note:"" },ADMIN,
  {"X-Caravela-Request":""})).status,403);
 const first=await call("PATCH",{message_id:"200",revision:0,status:"reviewed",note:""},ADMIN);
 assert.equal(first.status,200);
 assert.equal((await first.json()).commercial_records_unchanged,true);
 assert.equal((await call("PATCH",{message_id:"200",revision:0,status:"dismissed",note:""},ADMIN)).status,409);
 assert.equal((await materializeMailReviewTasks(env.ZOHO_DB)).created,0);
 const final=await (await call()).json();
 assert.equal(final.counts.pending,0);assert.equal(final.counts.reviewed,1);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_audit").get().n,1);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events").get().n,0);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_mail_signals").get().n,1);
});
test("missing migration disables task creation without touching Zoho or commercial decisions",async()=>{
 insert("301");
 sql.exec("DROP TABLE control_review_tasks");
 const out=await materializeMailReviewTasks(env.ZOHO_DB);
 assert.equal(out.enabled,false);assert.equal(out.reason,"migration_required");
 assert.equal((await call()).status,409);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_mail_signals").get().n,1);
});

test("email association checks entity and interlocutor exact addresses without ambiguous merges",()=>{
 const contacts=[
  {id:"venue-a",name:"Auditório A",emails:["geral@auditorio.test"],
   people:[{name:"João",email:"booking@produtora.test"}]},
  {id:"festival-b",name:"Festival B",emails:["booking@produtora.test"],people:[]},
  {id:"label-c",name:"Editora C",emails:["press@editora.test"],people:[],
   contact_policy:"blocked"}
 ];
 let result=matchMailTaskContacts(contacts,"booking@produtora.test");
 assert.equal(result.association,"shared_email");
 assert.equal(result.matches.length,2);
 result=matchMailTaskContacts(contacts,"geral@auditorio.test");
 assert.equal(result.association,"unique_candidate");
 assert.equal(result.matches[0].id,"venue-a");
 result=matchMailTaskContacts(contacts,"press@editora.test");
 assert.equal(result.association,"restricted");
 result=matchMailTaskContacts(contacts,"missing@empresa.test");
 assert.equal(result.association,"unmatched");
});


const sampleBooking=(patch={})=>({
 contact_name:"Example Venue",contact_id:"",contact_email:"venue@example.test",
 artist:"WILDCHAINS",subject:"Festival 2027",stage:"research",priority:"medium",
 fee_amount:null,commission_pct:null,currency:"EUR",fee_note:"",conditions:"",
 event_date:"",press_status:"unknown",press_reference:"",advance_status:"unknown",
 last_contact_date:"",owner:"Sérgio",next_step:"Validar condições",due_date:"",
 evidence_type:"none",evidence_reference:"",notes:"Nota de teste",origin_label:"Zoho teste",...patch
});
async function resolve(id,taskRevision,record,method="POST",token=ADMIN,headers={}){
 const url=new URL(HOST+"/api/control/mail/resolve-booking");
 return handleControl(new Request(url,{method:"POST",headers:{
  Authorization:"Bearer "+token,Origin:HOST,"X-Caravela-Request":"1",
  "Content-Type":"application/json",...headers
 },body:JSON.stringify({message_id:id,task_revision:taskRevision,
  booking_method:method,record,review_confirmed:true})}),env,url);
}
test("atomic booking resolution closes task once, audits and never sends email",async()=>{
 insert("701");await materializeMailReviewTasks(env.ZOHO_DB);
 const uuid=crypto.randomUUID(),record=sampleBooking({id:uuid});
 const result=await resolve("701",0,record);
 assert.equal(result.status,201);
 const body=await result.json();
 assert.equal(body.review_completed,true);
 assert.equal(body.record.id,uuid);
 const task=sql.prepare("SELECT status,revision,review_note FROM control_review_tasks WHERE message_id='701'").get();
 assert.equal(task.status,"reviewed");
 assert.equal(task.revision,1);
 assert.equal(task.review_note,"booking:"+uuid);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,1);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_audit WHERE operation='crm_mail_task_resolved_booking'").get().n,1);
 const retry=await resolve("701",0,record);
 assert.equal(retry.status,200);
 assert.equal((await retry.json()).already_applied,true);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,1);
 assert.equal((await (await call()).json()).counts.pending,0);
});
test("resolution rejects stale task, mismatched sender, wrong topic and unauthorized caller",async()=>{
 insert("711");insert("712","venue@example.test","press","interest");
 await materializeMailReviewTasks(env.ZOHO_DB);
 const row=sampleBooking({id:crypto.randomUUID()});
 assert.equal((await resolve("711",1,row)).status,409);
 assert.equal((await resolve("711",0,{...row,contact_email:"other@example.test"})).status,422);
 assert.equal((await resolve("712",0,{...row,id:crypto.randomUUID()})).status,409);
 assert.equal((await resolve("711",0,{...row,id:crypto.randomUUID()},"POST",CRON)).status,401);
 assert.equal((await resolve("711",0,{...row,id:crypto.randomUUID()},"POST",ADMIN,
  {"X-Caravela-Request":""})).status,403);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,0);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_review_tasks WHERE status='pending'").get().n,2);
});
test("one Zoho message cannot create bookings for two different opportunities",async()=>{
 insert("801");await materializeMailReviewTasks(env.ZOHO_DB);
 const first=sampleBooking({id:crypto.randomUUID()}),another=sampleBooking({id:crypto.randomUUID()});
 assert.equal((await resolve("801",0,first)).status,201);
 assert.equal((await resolve("801",0,another)).status,409);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,1);
});
test("booking validation errors leave the mail task pending",async()=>{
 insert("901");await materializeMailReviewTasks(env.ZOHO_DB);
 const wrong=sampleBooking({id:crypto.randomUUID(),stage:"confirmed"});
 assert.equal((await resolve("901",0,wrong)).status,422);
 assert.equal(sql.prepare("SELECT status FROM control_review_tasks WHERE message_id='901'").get().status,"pending");
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events").get().n,0);
});
test("atomic resolution can revise existing opportunity without duplicating it",async()=>{
 insert("991");await materializeMailReviewTasks(env.ZOHO_DB);
 const bookUrl=new URL(HOST+"/api/control/native/booking");
 const first=await handleControl(new Request(bookUrl,{method:"POST",headers:{
  Authorization:"Bearer "+ADMIN,Origin:HOST,"X-Caravela-Request":"1"},
  body:JSON.stringify(sampleBooking())
 }),env,bookUrl);
 assert.equal(first.status,201);
 const original=(await first.json()).record;
 const update={...original,next_step:"Resposta validada",stage:"reply_reported",evidence_type:"user_report"};
 const patched=await resolve("991",0,update,"PATCH");
 assert.equal(patched.status,200);
 const result=await patched.json();
 assert.equal(result.record.id,original.id);
 assert.equal(result.record.stage,"reply_reported");
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,2);
 assert.equal(sql.prepare("SELECT status FROM control_review_tasks WHERE message_id='991'").get().status,"reviewed");
});
test("stale booking revision leaves a pending Zoho task unchanged",async()=>{
 insert("995");await materializeMailReviewTasks(env.ZOHO_DB);
 const bookUrl=new URL(HOST+"/api/control/native/booking");
 const first=await handleControl(new Request(bookUrl,{method:"POST",headers:{
  Authorization:"Bearer "+ADMIN,Origin:HOST,"X-Caravela-Request":"1"},
  body:JSON.stringify(sampleBooking())
 }),env,bookUrl);
 assert.equal(first.status,201);
 const old=(await first.json()).record;
 assert.equal((await resolve("995",0,{...old,revision:crypto.randomUUID()},"PATCH")).status,409);
 assert.equal(sql.prepare("SELECT status FROM control_review_tasks WHERE message_id='995'").get().status,"pending");
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,1);
});
