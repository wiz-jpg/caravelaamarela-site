import {test} from "node:test";
import assert from "node:assert/strict";
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
 assert.equal(result.venue.suggestions.length,2);
 assert.equal(result.venue.suggestions.find(x=>x.contact.id==="v1").reason,"Concerto confirmado na mesma cidade");
 assert.equal(result.venue.suggestions.some(x=>x.contact.id==="v3"),false);
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
