import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {validateNative} from "../control-native.js";

const source=readFileSync(new URL("../control-booking-board.js",import.meta.url),"utf8");
const browser={};vm.runInNewContext(source,{globalThis:browser});
const {classify,windowFor}=browser.CaravelaBookingBoard;
const contact=(patch={})=>({id:"festival-1",name:"Festival Teste",kind:"festival",
 city:"Braga",country:"Portugal",contact_policy:"review",
 contact_window_start:"10-01",contact_window_end:"10-30",
 contact_window_target:"prior_year",contact_window_basis:"history",
 contact_window_reason:"Histórico verificado",...patch});
const booking=(patch={})=>({
 id:"booking-1",contact_id:"festival-1",contact_name:"Festival Teste",
 artist:"WILDCHAINS",subject:"Festival 2027",booking_year:"2027",
 booking_category:"festival",stage:"research",...patch
});

test("2027 festival outreach window is positioned in 2026 only with a documented year basis",()=>{
 const c=contact();
 assert.equal(windowFor(c,2027,"2026-09-20").status,"soon");
 assert.equal(windowFor(c,2027,"2026-10-15").status,"now");
 assert.equal(windowFor(c,2027,"2026-11-01").status,"late");
 assert.equal(windowFor({...c,contact_window_target:"unknown"},2027,"2026-11-01").status,"unknown");
 assert.equal(windowFor({...c,contact_window_basis:"hypothesis"},2027,"2026-10-15").status,"unknown");
});
test("festival lanes respect commercial stages and retain separate band records",()=>{
 const c=contact();
 const rows=[
  booking({id:"b1",stage:"negotiating"}),
  booking({id:"b2",artist:"Devil of a Woman",stage:"research"}),
  booking({id:"b3",artist:"Devil of a Woman",stage:"confirmed"}),
  booking({id:"b4",artist:"WILDCHAINS",stage:"declined"}),
  booking({id:"b5",artist:"WILDCHAINS + Devil of a Woman",stage:"research"})
 ];
 const result=classify({bookings:rows,contacts:[c],year:2027,today:"2026-10-15"});
 assert.equal(result.festival.ongoing.length,1);
 assert.equal(result.festival.now.length,2);
 assert.equal(result.festival.confirmed.length,1);
 assert.equal(result.festival.declined.length,1);
 assert.equal(result.festival.now.find(x=>x.record.id==="b5").artists.length,2);
 assert.deepEqual(rows.map(x=>x.stage),["negotiating","research","confirmed","declined","research"]);
});
test("native bookings without explicit year are not silently assigned to 2027",()=>{
 const rows=[booking({id:"old",booking_year:"",event_date:""}),booking({id:"with-date",booking_year:"",event_date:"2027-09-05"})];
 const result=classify({bookings:rows,contacts:[contact()],year:2027,today:"2026-10-15"});
 assert.equal(result.undated.length,1);
 assert.equal(result.festival.now.length,1);
});
test("venue proximity means same city or region, never invented driving time",()=>{
 const contacts=[contact({id:"gig",name:"Festival do Porto",city:"Porto",region:"Porto"}),
  contact({id:"v1",name:"Sala no Porto",kind:"venue",city:"Porto",region:"Porto",contact_window_target:"unknown"}),
  contact({id:"v2",name:"Sala noutra cidade da região",kind:"venue",city:"Maia",region:"Porto",contact_window_target:"unknown"}),
  contact({id:"v3",name:"Sala de Lisboa",kind:"venue",city:"Lisboa",region:"Lisboa",contact_window_target:"unknown"})];
 const result=classify({bookings:[booking({id:"gig-booking",contact_id:"gig",stage:"confirmed",
  artist:"WILDCHAINS",event_date:"2027-04-21"})],contacts,year:2027,today:"2026-10-15"});
 assert.equal(result.venue.suggestions.length,3);
 assert.equal(result.venue.suggestions.find(x=>x.contact.id==="v1").reason,"Concerto confirmado na mesma cidade");
 assert.equal(result.venue.suggestions.find(x=>x.contact.id==="v3").matchScore,3); // General lead, not a route
});
test("native opportunity sources require real https reference, states and human next action",()=>{
 const row={
 title:"Internacionalização",provider:"Entidade",source_url:"https://example.org/convocatoria",
 artist:"WILDCHAINS",country:"Portugal",kind:"international",status:"research",
 deadline:"",review_date:"",verified_on:"",next_step:"Verificar critérios e avisos"
 };
 assert.equal(validateNative("opportunities",row).title,"Internacionalização");
 assert.equal(validateNative("opportunities",{...row,source_url:"javascript:alert(1)"}),null);
 assert.equal(validateNative("opportunities",{...row,status:"auto_approved"}),null);
 assert.equal(validateNative("opportunities",{...row,deadline:"2027-02-31"}),null);
 assert.equal(validateNative("opportunities",{...row,next_step:""}),null);
});


test("paused and closed records do not become overdue outreach automatically",()=>{
 const c=contact({contact_window_start:"10-01",contact_window_end:"10-15"});
 const rows=[
  booking({id:"closed",stage:"closed"}),
  booking({id:"paused",stage:"paused"}),
  booking({id:"open",stage:"research"})
 ];
 const result=classify({bookings:rows,contacts:[c],year:2027,today:"2026-10-17"});
 assert.equal(result.festival.late.length,1);
 assert.equal(result.festival.planning.length,1);
 assert.equal(result.other.length,1);
});


test("historical contacts populate planning without fabricating contact windows",()=>{
 const rows=[contact({id:"f",contact_window_target:"unknown",contact_window_basis:"unknown",
  contact_window_start:"",contact_window_end:"",contact_window_reason:""})];
 const result=classify({bookings:[],contacts:rows,year:2027,today:"2026-10-17"});
 assert.equal(result.festival.planning.length,1);
 assert.equal(result.festival.late.length,0);
 assert.equal(result.festival.now.length,0);
 assert.equal(result.festival.planning[0].type,"candidate");
});
test("historical sent claims appear provisionally in follow-up, never confirmed",()=>{
 const c=contact({id:"f",emails:["venue@sample.com"]});
 const rows=[
  {id:"h1",name:"Festival Teste",email:"venue@sample.com",artist:"WILDCHAINS",
   status:"Enviado",next_step:"Follow-up sem prova"},
  {id:"h2",name:"Festival Teste",email:"wrong@sample.com",artist:"Devil of a Woman",
   status:"Em conversa"}
 ];
 const result=classify({bookings:[],contacts:[c],actions:rows,year:2027,today:"2026-10-17"});
 assert.equal(result.festival.archive.length,0);
 assert.equal(result.festival.ongoing.length,1);
 assert.equal(result.festival.ongoing[0].type,"archive");
 assert.equal(result.festival.ongoing[0].provisional,true);
 assert.equal(result.festival.confirmed.length,0);
});


const imported=(id,status,artist,date="",patch={})=>({
 id,name:"Festival Teste",email:"venue@sample.com",artist,
 status,next_step:"Verificar condições no Zoho",next_action_iso:date,
 origin:{row:Number(id.replace(/\D+/g,""))||10},...patch
});
test("dated source actions are placed automatically in late, now, soon and planning",()=>{
 const c=contact({emails:["venue@sample.com"],contact_window_start:"",
  contact_window_end:"",contact_window_target:"unknown"});
 for(const [date,lane] of [["2026-10-12","late"],["2026-10-17","now"],
   ["2026-10-24","now"],["2026-11-03","soon"],["2027-01-05","planning"]]){
  const result=classify({bookings:[],contacts:[c],
   actions:[imported("r1","Por contactar","WILDCHAINS",date)],
   year:2027,today:"2026-10-17"});
  assert.equal(result.festival[lane].filter(x=>x.type==="archive").length,1,date);
  assert.equal(result.festival.archive.length,0);
  assert.equal(result.festival.confirmed.length,0);
  assert.equal(result.festival.declined.length,0);
  assert.equal(result.festival[lane][0].action_date,date);
  assert.equal(result.festival[lane][0].provisional,true);
 }
});
test("source-only older scheduled dates stay in review, not an active overdue alert",()=>{
 const c=contact({emails:["venue@sample.com"]});
 const result=classify({bookings:[],contacts:[c],
  actions:[imported("r1","Por contactar","WILDCHAINS","2026-02-03")],
  year:2027,today:"2026-10-17"});
 assert.equal(result.festival.late.length,0);
 assert.equal(result.festival.archive.length,1);
});
test("verified festival window classifies an undated action without fabricating another date",()=>{
 const c=contact({id:"f2",emails:["venue@sample.com"]});
 const result=classify({bookings:[],contacts:[c],
  actions:[imported("r1","Por contactar","WILDCHAINS")],
  year:2027,today:"2026-10-17"});
 assert.equal(result.festival.now.length,1);
 assert.equal(result.festival.now[0].action_date,"");
 assert.equal(result.festival.now[0].provisional,true);
});
test("separate historic rows for the two bands remain independently reviewable",()=>{
 const c=contact({emails:["venue@sample.com"]});
 const result=classify({bookings:[],contacts:[c],
  actions:[
   imported("r1","Por contactar","WILDCHAINS","2026-10-17"),
   imported("r2","Em conversa","Devil of a Woman","2026-10-04")
  ],year:2027,today:"2026-10-17"});
 assert.equal(result.festival.now.length,1);
 assert.equal(result.festival.ongoing.length,1);
 assert.equal(result.festival.now[0].artists[0],"WILDCHAINS");
 assert.equal(result.festival.ongoing[0].artists[0],"Devil of a Woman");
});
test("native deals win over imported action suggestions for the same band",()=>{
 const c=contact({emails:["venue@sample.com"]});
 const result=classify({bookings:[booking({contact_id:c.id,artist:"WILDCHAINS",stage:"declined"})],
  contacts:[c],actions:[imported("r1","Por contactar","WILDCHAINS","2026-10-17")],
  year:2027,today:"2026-10-17"});
 assert.equal(result.festival.declined.length,1);
 assert.equal(result.festival.now.length,0);
 assert.equal(result.festival.planning.length,0);
});
test("old refusal and closed claims never become 2027 confirmed decisions",()=>{
 const c=contact({emails:["venue@sample.com"]});
 const result=classify({bookings:[],contacts:[c],year:2027,today:"2026-10-17",
  actions:[
   imported("r1","Recusado","WILDCHAINS"),
   imported("r2","Fechado","Devil of a Woman")
  ]});
 assert.equal(result.festival.archive.length,2);
 assert.equal(result.festival.declined.length,0);
 assert.equal(result.festival.confirmed.length,0);
});
test("blocked, shared and suppressed historical contacts never enter actionable queues",()=>{
 for(const patch of [
  {contact_policy:"blocked"},{source_suppressed:true},
  {source_shared_email:true},{duplicate_decision:"secondary"}
 ]){
  const c=contact({emails:["venue@sample.com"],...patch});
  const out=classify({bookings:[],contacts:[c],
   actions:[imported("r1","Por contactar","WILDCHAINS","2026-10-17")],
   year:2027,today:"2026-10-17"});
  assert.equal(out.festival.now.length,0);
  assert.equal(out.festival.planning.length,0);
  assert.equal(out.festival.archive.length,0);
 }
});
test("multiple archive revisions on same entity and artist choose latest stated action",()=>{
 const c=contact({emails:["venue@sample.com"]});
 const r=classify({bookings:[],contacts:[c],year:2027,today:"2026-10-17",
  actions:[
   imported("r1","Por contactar","WILDCHAINS","2026-10-07"),
   imported("r2","Por contactar","WILDCHAINS","2026-10-17")
  ]});
 assert.equal(r.festival.late.length,0);
 assert.equal(r.festival.now.length,1);
 assert.equal(r.festival.now[0].archive.id,"r2");
});


test("the public announced agenda appears in Fechados only for its real season",()=>{
 const announcement={date:"2026-11-08",artist:"wild",title:"FNAC Cascais",
  venue:"CascaiShopping",city:"Cascais"};
 const r2026=classify({bookings:[],contacts:[],published:[announcement],
  year:2026,today:"2026-10-17"});
 assert.equal(r2026.venue.confirmed.length,1);
 assert.equal(r2026.venue.confirmed[0].type,"announcement");
 assert.equal(r2026.venue.confirmed[0].notCommerciallyConfirmed,true);
 assert.equal(r2026.venue.confirmed[0].artists[0],"WILDCHAINS");
 const r2027=classify({bookings:[],contacts:[],published:[announcement],
  year:2027,today:"2026-10-17"});
 assert.equal(r2027.venue.confirmed.length,0);
});
test("one public festival announcement can apply to both bands without creating native bookings",()=>{
 const event={date:"2026-09-18",artist:"both",title:"Festival de roster",
  venue:"Sala Cultural",city:"Famalicão"};
 const r=classify({bookings:[],contacts:[],published:[event],year:2026,today:"2026-10-17"});
 assert.equal(r.festival.confirmed[0].artists.length,2);
 assert.equal(r.festival.confirmed[0].record,null);
});
test("manual triage overrides inferred lane without claiming a verified commercial deal",()=>{
 const c=contact({emails:["venue@sample.com"]});
 const a={id:"r4",name:"Festival Teste",email:"venue@sample.com",artist:"WILDCHAINS",
   status:"Por contactar",next_action_iso:"2026-10-17"};
 const source_key="action:r4|2027|wildchains";
 const r=classify({bookings:[],contacts:[c],actions:[a],reviews:[{
   source_key,year:"2027",lane:"ongoing",decision:"moved",notes:"Rever troca no Zoho"
 }],year:2027,today:"2026-10-17"});
 assert.equal(r.festival.now.length,0);
 assert.equal(r.festival.ongoing.length,1);
 assert.equal(r.festival.ongoing[0].reviewed,true);
 assert.equal(r.festival.ongoing[0].record,null);
 assert.equal(r.festival.confirmed.length,0);
});
test("promoters appear independently as shared contacts rather than being merged with festivals",()=>{
 const contacts=[
   contact({id:"p1",name:"Produtora Exemplo",kind:"promoter",region:"Porto"}),
   contact({id:"f1",name:"Festival Exemplo",kind:"festival",linked_producer_ids:["p1"]})
 ];
 const r=classify({bookings:[],contacts,year:2027,today:"2026-10-17"});
 assert.equal(r.promoter.length,1);
 assert.equal(r.promoter[0].contact.name,"Produtora Exemplo");
 assert.equal(r.festival.now.length,1);
});


test("real public Caravela agenda events populate Fechados in 2026 but not in 2027",()=>{
 const data=JSON.parse(readFileSync(new URL("../assets/data/agenda.json",import.meta.url),"utf8"));
 assert.ok(data.events.length>=10,"expected published concerts from the website");
 assert.ok(data.events.some(x=>x.artist==="wild"));
 assert.ok(data.events.some(x=>x.artist==="devil"));
 const current=classify({bookings:[],contacts:[],published:data.events,
   year:2026,today:"2026-10-17"});
 const total=current.festival.confirmed.length+current.venue.confirmed.length;
 assert.equal(total,data.events.filter(e=>e.date?.startsWith("2026-")).length);
 assert.ok(current.venue.confirmed.some(x=>x.announcement?.title==="FNAC Braga"));
 assert.ok(current.festival.confirmed.some(x=>x.announcement?.title==="Tomate Blues Festival"));
 const later=classify({bookings:[],contacts:[],published:data.events,
   year:2027,today:"2026-10-17"});
 assert.equal(later.festival.confirmed.length+later.venue.confirmed.length,0);
});
test("confirmed non-festival venue booking remains visible as uncategorized; closed does not imply a paid gig",()=>{
 const result=classify({bookings:[
   booking({id:"confirmed-other",booking_category:"other",stage:"confirmed"}),
   booking({id:"closed-other",booking_category:"other",stage:"closed"})
  ],contacts:[],year:2027,today:"2026-10-17"});
 assert.equal(result.other.filter(x=>x.record?.stage==="confirmed").length,1);
 assert.equal(result.other.filter(x=>x.record?.stage==="closed").length,1);
 assert.equal(result.festival.confirmed.length,0);
});
