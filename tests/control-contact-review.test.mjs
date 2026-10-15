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
