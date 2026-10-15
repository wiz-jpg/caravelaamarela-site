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
 assert.equal(amended.status,422);
 assert.equal((await amended.json()).error,"verified_contact_link_required");
 assert.equal((await (await req("booking")).json()).records[0].stage,"research");
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,1);
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

test("private export preserves immutable revisions and empty archive needs no Sheets",async()=>{
 const initial=await req("export");
 assert.equal(initial.status,200);
 const snapshot=await initial.json();
 assert.equal(snapshot.schema,"caravela.crm.native-backup.v1");
 assert.equal(snapshot.count,0);
 const archive=await req("archive");
 assert.equal(archive.status,200);
 assert.equal((await archive.json()).active,false);
 assert.equal((await req("archive","POST",contact())).status,405);
 await req("contacts","POST",contact());
 const exported=await (await req("export")).json();
 assert.equal(exported.count,1);
 assert.equal(exported.events[0].operation,"crm_contact_v1");
 assert.equal(exported.historical_snapshots_untouched,true);
});
test("legacy contact references cannot be fabricated when no active sealed snapshot exists",async()=>{
 const origin="venue_"+"a".repeat(22);
 const res=await req("contacts","POST",contact({id:origin,origin_id:origin}));
 assert.equal(res.status,422);
 assert.equal((await res.json()).error,"historical_reference_not_found");
});

test("verified proposal enforces approved matching native contact and email",async()=>{
 const entry=await req("contacts","POST",contact({contact_policy:"allowed"}));
 const id=(await entry.json()).record.id;
 const verified=deal({contact_id:id,stage:"sent_verified",evidence_type:"sent_message",
   evidence_reference:"Human-checked Zoho message ID"});
 assert.equal((await req("booking","POST",deal({...verified,contact_id:crypto.randomUUID()}))).status,422);
 assert.equal((await req("booking","POST",deal({...verified,contact_name:"Other Venue"}))).status,422);
 assert.equal((await req("booking","POST",deal({...verified,contact_email:"another@example.pt"}))).status,422);
 assert.equal((await req("booking","POST",verified)).status,201);
});

test("agency finance ledger keeps artist cachets out of revenue and requires payment proof",async()=>{
 const base={title:"Comissão de concerto",type:"income",category:"agency_commission",amount:90,currency:"EUR",
  artist:"WILDCHAINS",booking_id:"",category_note:"Comissão negociada",owner:"Booking",status:"due",
  due_date:"2026-11-20",settled_date:"",reference:"",notes:"Valor da agência"};
 assert.ok(validateNative("finance",base));
 assert.equal(validateNative("finance",{...base,status:"settled"}),null);
 assert.equal(validateNative("finance",{...base,amount:-15}),null);
 assert.equal(validateNative("finance",{...base,type:"expense"}),null);
 const created=await req("finance","POST",base);
 assert.equal(created.status,201);
 const first=(await created.json()).record;
 assert.equal(first.amount,90);assert.equal(first.status,"due");
 const marked=await req("finance","PATCH",{...base,id:first.id,revision:first.revision,
  status:"settled",settled_date:"2026-11-25",reference:"Pagamento validado em extrato"});
 assert.equal(marked.status,200);
 const all=await (await req("finance")).json();
 assert.equal(all.records.length,1);assert.equal(all.records[0].status,"settled");
 assert.equal((await req("finance","PATCH",{...base,id:first.id,revision:first.revision})).status,409);
 const exported=await (await req("export")).json();
 assert.ok(exported.events.some(x=>x.operation==="crm_finance_v1"));
 assert.equal((await req("finance","POST",{...base,booking_id:crypto.randomUUID()})).status,422);
 assert.equal((await req("finance","GET",null,{token:"bad"})).status,401);
});

test("one promoter can be linked to two events without merging or altering originals",async()=>{
 const promoter=await (await req("contacts","POST",contact({
  name:"Example Productions",kind:"promoter",emails:["producer@example.org"],city:"Porto"
 }))).json();
 const p=promoter.record;
 const festival=await (await req("contacts","POST",contact({
  name:"Independent Festival",kind:"festival",city:"Braga",emails:["festival@example.org"],
  linked_producer_ids:[p.id],people:[{name:"Alex Booking",role:"Booking",email:"alex@example.org",phone:"0000000"}]
 }))).json();
 const venue=await (await req("contacts","POST",contact({
  name:"Example Hall",kind:"venue",city:"Guimarães",emails:["hall@example.org"],
  linked_producer_ids:[p.id]
 }))).json();
 assert.equal(festival.record.linked_producer_ids[0],p.id);
 assert.equal(festival.record.people[0].role,"Booking");
 assert.equal(venue.record.linked_producer_ids[0],p.id);
 let contacts=(await (await req("contacts")).json()).records;
 assert.equal(contacts.length,3);
 const revised=await req("contacts","PATCH",contact({
  id:venue.record.id,revision:venue.record.revision,
  name:"Example Hall",kind:"venue",city:"Guimarães",emails:["hall@example.org"],
  linked_producer_ids:[],people:[]
 }));
 assert.equal(revised.status,200);
 contacts=(await (await req("contacts")).json()).records;
 assert.equal(contacts.find(x=>x.id===festival.record.id).linked_producer_ids.length,1);
 assert.equal(contacts.find(x=>x.id===venue.record.id).linked_producer_ids.length,0);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='crm_contact_v1'").get().n,4);
 assert.equal((await req("contacts","POST",contact({name:"Self Link",linked_producer_ids:["bad-id"]}))).status,422);
});
test("duplicate review only creates a reversible alias; event booking IDs are unaffected",async()=>{
 const one=await (await req("contacts","POST",contact({name:"Media Sample",kind:"press",city:"Porto",emails:["a@example.org"]}))).json();
 const two=await (await req("contacts","POST",contact({name:"Media Sample",kind:"press",city:"Lisboa",emails:["b@example.org"]}))).json();
 const base=contact({id:two.record.id,revision:two.record.revision,name:"Media Sample",kind:"press",city:"Lisboa",
  emails:["b@example.org"],canonical_id:one.record.id,duplicate_decision:"secondary"});
 const tagged=await req("contacts","PATCH",base);
 assert.equal(tagged.status,200);
 const saved=(await tagged.json()).record;
 assert.equal(saved.canonical_id,one.record.id);
 const book=(await (await req("booking","POST",deal({contact_id:two.record.id,contact_name:"Media Sample"}))).json()).record;
 assert.equal(book.contact_id,two.record.id);
 const reversed=await req("contacts","PATCH",{...base,revision:saved.revision,canonical_id:"",duplicate_decision:"distinct"});
 assert.equal(reversed.status,200);
 const contacts=(await (await req("contacts")).json()).records;
 assert.equal(contacts.find(x=>x.id===two.record.id).canonical_id,"");
 assert.equal(contacts.length,2);
 assert.equal((await req("contacts","PATCH",{...base,revision:(await reversed.json()).record.revision,canonical_id:one.record.id,duplicate_decision:"distinct"})).status,422);
});
test("reject invalid cross-type, self, cyclic, and untracked producer relationships",async()=>{
 const promoter=(await (await req("contacts","POST",contact({name:"Company",kind:"promoter",emails:["prom@example.org"]}))).json()).record;
 const festival=(await (await req("contacts","POST",contact({name:"Event One",kind:"festival",emails:["event1@example.org"]}))).json()).record;
 const venue=(await (await req("contacts","POST",contact({name:"Venue One",kind:"venue",emails:["venue1@example.org"]}))).json()).record;
 const native={id:festival.id,revision:festival.revision,name:"Event One",kind:"festival",emails:["event1@example.org"]};
 assert.equal((await req("contacts","PATCH",contact({...native,canonical_id:venue.id,duplicate_decision:"secondary"}))).status,422);
 assert.equal((await req("contacts","PATCH",contact({...native,canonical_id:festival.id,duplicate_decision:"secondary"}))).status,422);
 assert.equal((await req("contacts","PATCH",contact({...native,linked_producer_ids:[venue.id]}))).status,422);
 assert.equal((await req("contacts","PATCH",contact({...native,linked_producer_ids:[promoter.id]}))).status,200);
 const wrong=contact({id:promoter.id,revision:promoter.revision,name:"Company",kind:"promoter",emails:["prom@example.org"],linked_producer_ids:[festival.id]});
 assert.equal((await req("contacts","PATCH",wrong)).status,422);
});

test("remove a native test contact without erasing past events, preserving linked entities",async()=>{
 const created=await req("contacts","POST",contact({name:"Teste",city:"Braga",review_date:"2026-10-15",emails:[]}));
 assert.equal(created.status,201);
 const first=(await created.json()).record;
 const deleted=await req("contacts","DELETE",{id:first.id,revision:first.revision});
 assert.equal(deleted.status,200);
 assert.equal((await (await req("contacts")).json()).total,0);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='crm_contact_v1'").get().n,2);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_audit WHERE operation='crm_contact_removed'").get().n,1);
 assert.equal((await req("contacts","DELETE",{id:first.id,revision:first.revision})).status,404);
});
test("refuse removal of a contact referenced by a booking or a producer relationship",async()=>{
 const saved=await (await req("contacts","POST",contact({name:"Venue Alpha"}))).json();
 const dealResult=await req("booking","POST",deal({contact_id:saved.record.id}));
 assert.equal(dealResult.status,201);
 assert.equal((await req("contacts","DELETE",{id:saved.record.id,revision:saved.record.revision})).status,409);
 const org=(await (await req("contacts","POST",contact({kind:"promoter",name:"Producer",emails:["producer@example.pt"],city:"Porto"}))).json()).record;
 const event=await req("contacts","POST",contact({kind:"festival",name:"Festival Alpha",city:"Aveiro",emails:["alpha@example.pt"],linked_producer_ids:[org.id]}));
 assert.equal(event.status,201);
 assert.equal((await req("contacts","DELETE",{id:org.id,revision:org.revision})).status,409);
});
test("historical contact authorization fields require evidence shape",()=>{
 assert.equal(validateNative("contacts",contact({authorization_source:"zoho_thread",
  authorization_email:"",authorization_reference:""})),null);
 assert.ok(validateNative("contacts",contact({authorization_source:"none"})));
 assert.ok(validateNative("contacts",contact({authorization_source:"zoho_thread",
  authorization_email:"contact@example.pt",authorization_reference:"thread-100"})));
});

test("a manual contacted state schedules a follow-up and keeps evidence as a user report",async()=>{
 const person=await req("contacts","POST",contact({name:"Sample Festival",owner:"João Abreu",kind:"festival"}));
 assert.equal(person.status,201);
 assert.equal((await person.json()).record.owner,"João Abreu");
 const created=await req("booking","POST",deal({
  contact_name:"Sample Festival",contact_id:"",contact_email:"venue@example.pt",
  owner:"João Abreu",stage:"contact_reported",evidence_type:"user_report",
  evidence_reference:"",last_contact_date:"2026-10-15",due_date:"2026-10-22",
  next_step:"Confirmar se obtivemos resposta"
 }));
 assert.equal(created.status,201);
 const rec=(await created.json()).record;
 assert.equal(rec.stage,"contact_reported");
 assert.equal(rec.due_date,"2026-10-22");
 const rejected=await req("booking","PATCH",deal({...rec,id:rec.id,revision:rec.revision,
  stage:"declined",owner:"João Abreu",evidence_type:"user_report",
  next_step:"Recusado, manter no histórico",due_date:"",notes:"Recusa relatada por quem falou com a entidade"}));
 assert.equal(rejected.status,200);
 const list=(await (await req("booking")).json()).records;
 assert.equal(list.length,1);
 assert.equal(list[0].stage,"declined");
 assert.equal(list[0].due_date,"");
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_decision_events WHERE operation='crm_booking_v1'").get().n,2);
});
