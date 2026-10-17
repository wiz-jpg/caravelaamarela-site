import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const context={};
vm.runInNewContext(readFileSync(new URL("../control-auto-review.js",import.meta.url),"utf8"),
 {globalThis:context});
const engine=context.CaravelaAutoReview;
const action=(patch={})=>({
 id:"action-1",name:"Festival Exemplo",email:"contacto@example.test",
 artist:"WILDCHAINS",status:"Por contactar",next_step:"Preparar proposta",
 next_action_iso:"2026-10-17",next_followup_iso:"",
 link_status:"verified_name_email",matched_entity_id:"f1",contact_policy:"review",
 ...patch
});
const contact=(patch={})=>({
 id:"f1",name:"Festival Exemplo",kind:"festival",emails:["contacto@example.test"],
 contact_policy:"review",...patch
});
test("source actions generate stable, human-review-only suggestions from real dates",()=>{
 const results=engine.generate({actions:[action()],contacts:[contact()],today:"2026-10-17"});
 assert.equal(results.total,1);
 const one=results.review[0];
 assert.equal(one.key,"archive:action-1");
 assert.equal(one.when,"today");
 assert.equal(one.stage,"first");
 assert.equal(one.identity_review,false);
 assert.equal(one.date_provenance,"historical_record");
 assert.equal(one.due,"2026-10-17");
 assert.equal(one.source,"historical_action");
});
test("block and protect historical no-outreach and already represented records",()=>{
 const out=engine.generate({actions:[
   action({id:"blocked",no_outreach:true}),
   action({id:"existing"}),
   action({id:"declined",status:"Recusado"})
 ],contacts:[contact()],bookings:[
   {contact_id:"f1",contact_name:"Festival Exemplo",artist:"WILDCHAINS",stage:"research"}
 ],today:"2026-10-17"});
 assert.equal(out.total,0);
 assert.equal(out.skipped.blocked,1);
 assert.equal(out.skipped.duplicate,1);
});
test("ambiguous identity and missing dates never become proof of contact",()=>{
 const out=engine.generate({actions:[action({next_action_iso:"",matched_entity_id:"",
  link_status:"unverified",email:""})],contacts:[
   contact({id:"a"}),contact({id:"b"})
 ],today:"2026-10-17"});
 assert.equal(out.total,1);
 assert.equal(out.review[0].identity_review,true);
 assert.equal(out.review[0].identity_reason,"ambiguous");
 assert.equal(out.review[0].when,"date_missing");
 assert.equal(out.review[0].due,"");
});
test("old sent-email claims create review suggestions, never a verified commercial state",()=>{
 const out=engine.generate({actions:[action({status:"Enviado",next_action_iso:"",
  next_followup_iso:"2026-10-15"})],contacts:[contact()],today:"2026-10-17"});
 assert.equal(out.review[0].stage,"sent");
 assert.equal(out.review[0].when,"overdue");
 assert.match(out.review[0].reason,/confirmar no Zoho/);
 assert.equal(out.review[0].kind,"follow-up histórico");
});
test("duplicate imported action IDs are idempotent within projection",()=>{
 const first=action(),another=action({artist:"Devil of a Woman"});
 const out=engine.generate({actions:[first,another],contacts:[contact()],today:"2026-10-17"});
 assert.equal(out.total,1);
 assert.equal(out.skipped.duplicate,1);
});
