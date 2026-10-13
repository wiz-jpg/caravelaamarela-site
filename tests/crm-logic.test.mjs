import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const logic=createRequire(import.meta.url)("../crm-logic.js");
const id=(kind,c)=>kind+"_"+c.repeat(22);
function input(){
  return {schema:"caravela.crm.import.v1",manifest_sha256:"a".repeat(64),
    summary:{total:3},suppressions:[],entities:[
      {id:id("festival","1"),kind:"festival",name:"Festival A",city:"Braga",
        emails:["a@example.pt"],review_required:false,shared_email:false,suppressed:false,
        crm_safety:{mail_delivery_confirmed:false}},
      {id:id("festival","2"),kind:"festival",name:"Festival B",city:"Porto",
        emails:["shared@example.pt"],review_required:true,shared_email:true,suppressed:false},
      {id:id("venue","3"),kind:"venue",name:"Venue C",city:"Porto",
        emails:["shared@example.pt"],review_required:true,shared_email:true,suppressed:false}
    ]};
}
test("v2 file keeps 3 canonical entities",()=>assert.equal(logic.validateImport(input()).entities.length,3));
test("one exact email gets one matching entity",()=>{
  const r=logic.matchMail({messageId:"1",fromAddress:"A <a@example.pt>"},"incoming",logic.indexContacts(input()));
  assert.equal(r.status,"unique");assert.equal(r.entity_id,id("festival","1"));
});
test("shared email is ambiguous",()=>{
  const r=logic.matchMail({messageId:"2",toAddress:"shared@example.pt"},"outgoing",logic.indexContacts(input()));
  assert.equal(r.status,"ambiguous");assert.equal(r.entity_id,null);
});
test("similar but different email cannot be fuzzy-matched",()=>{
  const r=logic.matchMail({messageId:"3",fromAddress:"a@example.com"},"incoming",logic.indexContacts(input()));
  assert.equal(r.status,"unmatched");
});
test("outgoing message to multiple entities is ambiguous",()=>{
  const r=logic.matchMail({messageId:"4",toAddress:"a@example.pt,shared@example.pt"},"outgoing",logic.indexContacts(input()));
  assert.equal(r.status,"ambiguous");
});
test("unverified CRM v2 must not suggest follow-ups",()=>{
  const e=input().entities[0];
  assert.equal(logic.followUpCandidate(e,{last_sent:Date.now()-20*86400000,last_received:null}),false);
});
test("review export omits subject and message summary",()=>{
  const d=input();const r=logic.reconcile(d,[{direction:"incoming",message:{
    messageId:"5",fromAddress:"a@example.pt",subject:"private",summary:"confidential"
  }}]);
  const exported=JSON.stringify(logic.exportReview(d,r));
  assert.equal(exported.includes("private"),false);
  assert.equal(exported.includes("confidential"),false);
});
