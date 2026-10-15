import {test} from "node:test";
import assert from "node:assert/strict";
import {reviewContacts} from "../control-contact-review.js";

const make=(id,name,kind,emails,city="",extra={})=>
 ({id,name,kind,emails,city,contact_policy:"review",...extra});
test("keeps festival and promoter distinct despite a shared mailbox",()=>{
 const source=[
  make("f1","Festival Alpha","festival",["producer@example.org"],"Braga"),
  make("f2","Festival Beta","festival",["producer@example.org"],"Porto"),
  make("p1","Example Promoter","promoter",["producer@example.org"],"Porto")
 ];
 const output=reviewContacts({archive:source});
 assert.equal(output.counts.contacts,3);
 assert.equal(output.counts.duplicate_groups,0);
 assert.equal(output.counts.shared_email_groups,1);
 assert.equal(output.shared_email_groups[0].entities.length,3);
 assert.equal(source[0].emails.length,1);
});
test("same publication gets candidate review; explicit decisions hide resolved suggestions",()=>{
 const archive=[make("a","Heavy Media","press",["editor@heavy.example"],""),
  make("b","HEAVY MEDIA","press",["press@heavy.example"],"")];
 assert.equal(reviewContacts({archive}).counts.duplicate_groups,1);
 const linked=reviewContacts({archive,working:[make("b","HEAVY MEDIA","press",["press@heavy.example"],"",
  {canonical_id:"a",duplicate_decision:"secondary"})]});
 assert.equal(linked.counts.duplicate_groups,0);
 const distinct=reviewContacts({archive,working:[make("b","HEAVY MEDIA","press",["press@heavy.example"],"",
  {duplicate_decision:"distinct"})]});
 assert.equal(distinct.counts.duplicate_groups,0);
});
test("Zoho header index suggests but never marks a deal as replied or confirmed",()=>{
 const archive=[make("f1","Known Festival","festival",["known@fest.example"],"Braga")];
 const headers=[
  {folder_kind:"incoming",from_email:"booking@caravelaamarela.com",to_json:"[]",received_ms:3},
  {folder_kind:"outgoing",from_email:"booking@caravelaamarela.com",to_json:JSON.stringify(["known@fest.example"]),received_ms:1000},
  {folder_kind:"incoming",from_email:"known@fest.example",to_json:"[]",received_ms:2000},
  {folder_kind:"incoming",from_email:"new@newfestival.example",to_json:"[]",received_ms:3000},
  {folder_kind:"incoming",from_email:"noreply@misc.example",to_json:"[]",received_ms:3000}
 ];
 const output=reviewContacts({archive,headers});
 assert.equal(output.counts.incoming_to_review,1);
 assert.equal(output.counts.new_mail_addresses,1);
 assert.equal(output.recent_incoming[0].linked[0].name,"Known Festival");
 assert.equal(output.new_addresses[0].email,"new@newfestival.example");
 assert.ok(!JSON.stringify(output).includes("confirmed"));
});
test("only overdue with an explicitly entered date and actions remain pending without a validated link",()=>{
 const archive=[make("f1","Known Festival","festival",["known@fest.example"],"Braga")];
 const working=[make("f1","Known Festival","festival",["known@fest.example"],"Braga",
  {review_date:"2026-10-10"})];
 const actions=[{name:"Old Festival",status:"Enviado",email:"known@fest.example",link_status:"needs_review"},
 {name:"Linked",email:"known@fest.example",matched_entity_id:"f1"}];
 const out=reviewContacts({archive,working,actions,asOf:Date.parse("2026-10-15")});
 assert.equal(out.counts.overdue,1);
 assert.equal(out.counts.unresolved_actions,1);
 assert.equal(out.actions_to_review[0].matched,1);
});
test("shared address never creates a duplicate of different venue cities",()=>{
 const a=[make("v1","Auditório Central","venue",["info@central.example"],"Braga"),
  make("v2","Auditório Central","venue",["info@central.example"],"Lisboa")];
 const out=reviewContacts({archive:a});
 assert.equal(out.counts.duplicate_groups,0);
 assert.equal(out.counts.shared_email_groups,1);
});


test("review endpoint is private, read-only and never mutates the archive",async()=>{
 const {DatabaseSync}=await import("node:sqlite");
 const {readFileSync}=await import("node:fs");
 const {handleControl}=await import("../control-vault.js");
 const db=new DatabaseSync(":memory:");
 db.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
 const stmt=(sql,args=[])=>({
   async first(){return db.prepare(sql).get(...args)||null},
   async all(){return {results:db.prepare(sql).all(...args)}},
   async run(){return db.prepare(sql).run(...args)}
 });
 const d1={prepare(sql){return {bind(...args){return stmt(sql,args)},...stmt(sql)}},
  async batch(statements){const result=[];for(const statement of statements)result.push(await statement.run());return result}};
 const token="test-key-"+"a".repeat(52);
 const host="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
 const env={ZOHO_DB:d1,ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true",ZOHO_ADMIN_TOKEN:token};
 const visit=(auth,method="GET")=>{
  const url=new URL(host+"/api/control/contacts/review");
  return handleControl(new Request(url,{method,headers:{
   Authorization:auth?"Bearer "+token:"",Origin:host,
   "X-Caravela-Request":"1"}}),env,url);
 };
 try{
  assert.equal((await visit(false)).status,401);
  assert.equal((await visit(true,"POST")).status,405);
  const res=await visit(true);assert.equal(res.status,200);
  const result=await res.json();
  assert.equal(result.kind,"suggestions_only");assert.equal(result.counts.contacts,0);
  assert.equal(result.zoho_last_sync_ms,null);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM control_decision_events").get().n,0);
 }finally{db.close()}
});

test("a bilateral exchange requires an identical thread, response chronology and unshared address",()=>{
 const base=make("a","Festival Confirmado","festival",["book@festival.example"],"Braga");
 const headers=[
  {folder_kind:"outgoing",thread_id:"1001",from_email:"booking@caravelaamarela.com",
   to_json:JSON.stringify(["book@festival.example"]),received_ms:10},
  {folder_kind:"incoming",thread_id:"1001",from_email:"book@festival.example",
   to_json:"[]",received_ms:20}
 ];
 const yes=reviewContacts({archive:[base],headers});
 assert.equal(yes.counts.verified_exchange_threads,1);
 assert.equal(yes.verified_exchanges[0].contact.id,"a");
 assert.equal(reviewContacts({archive:[base],headers:[headers[0],{...headers[1],thread_id:"1002"}]})
  .counts.verified_exchange_threads,0);
 assert.equal(reviewContacts({archive:[base],headers:[headers[0],{...headers[1],received_ms:5}]})
  .counts.verified_exchange_threads,0);
 assert.equal(reviewContacts({archive:[base,{...base,id:"b",name:"Outro evento"}],headers})
  .counts.verified_exchange_threads,0);
 assert.equal(reviewContacts({archive:[{...base,suppressed:true}],headers})
  .counts.verified_exchange_threads,0);
});
