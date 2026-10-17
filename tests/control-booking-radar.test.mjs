import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const ctx={};vm.runInNewContext(readFileSync(new URL("../control-booking-radar.js",import.meta.url),"utf8"),{globalThis:ctx});
const radar=ctx.CaravelaBookingRadar;
test("radar only proposes candidates NOT already present in native or archived CRM",()=>{
 const found=radar.discover({year:2027,artist:"WILDCHAINS",contacts:[{id:"1",name:"Laurus Nobilis Music Fest"}],
  actions:[{name:"Milagre Metaleiro Open Air"}],bookings:[]});
 assert.equal(found.curated.length,1);
 assert.equal(found.curated[0].name,"SQUARE");
});
test("radar does not treat news search articles as verified open festival opportunities",()=>{
 const input={title:"Festival indie rock na região - Revista",url:"https://example.org/fest",
  status:"lead_unverified",description:"Edição de 2027",source_host:"example.org"};
 const found=radar.discover({year:2027,artist:"WILDCHAINS",external:[input]});
 assert.equal(found.leads.length,1);
 assert.equal(found.leads[0].status,"unverified_lead");
 assert.equal(found.leads[0].unverifiedForBooking,true);
 assert.match(found.leads[0].basis,/requerem verificação/);
});
test("known festival headline is excluded even if it appears inside a longer search result",()=>{
 const result=radar.discover({year:2027,artist:"WILDCHAINS",
  contacts:[{name:"Festival indie rock na região"}],
  external:[{title:"Festival indie rock na região",url:"https://example.org/fest",status:"lead_unverified"}]});
 assert.equal(result.leads.length,0);
});
test("does not return megafestivals or unrelated 2026 edition as priority",()=>{
 const result=radar.discover({year:2026,artist:"Devil of a Woman",
 external:[{title:"Rock in Rio festival 2026",url:"https://example.org/test",status:"lead_unverified"}]});
 assert.equal(result.curated.length,0);
 assert.equal(result.leads.length,0);
});
