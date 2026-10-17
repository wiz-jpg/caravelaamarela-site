import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const ctx={};vm.runInNewContext(readFileSync(new URL("../control-booking-radar.js",import.meta.url),"utf8"),{globalThis:ctx});
const radar=ctx.CaravelaBookingRadar;
const entity=(id,kind,notes="",extra={})=>({
 id,name:"Festival "+id,kind,notes,city:"Braga",country:"Portugal",
 contact_policy:"review",emails:["x@example.pt"],...extra
});
test("radar prioritizes relevant rock festival with reply evidence; does not infer availability",()=>{
 const c=entity("s1","festival","Alternative rock and heavy rock");
 const r=radar.discover({contacts:[c],actions:[{id:"a1",name:c.name,artist:"WILDCHAINS",status:"Em conversa"}],
 year:2027,artist:"WILDCHAINS"});
 assert.equal(r.priority.length,1);
 assert.match(r.priority[0].basis,/histórico de conversa/);
 assert.doesNotMatch(JSON.stringify(r.priority),/candidatura aberta/i);
});
test("radar excludes blocked, refused, previous confirmed and oversized targets",()=>{
 const rows=[entity("blocked","festival","rock",{contact_policy:"blocked"}),
 entity("refused","festival","rock"),entity("confirmed","festival","rock"),
 entity("huge","festival","rock",{name:"Rock in Rio"})];
 const r=radar.discover({contacts:rows,actions:[{name:"Festival refused",artist:"WILDCHAINS",status:"Recusado"}],
 bookings:[{contact_name:"Festival confirmed",artist:"WILDCHAINS",stage:"confirmed",booking_year:"2027"}],
 artist:"WILDCHAINS",year:2027});
 assert.equal(r.scanned,0);
});
test("a venue appears as a candidate but unverified genre is not given high priority",()=>{
 const r=radar.discover({contacts:[entity("v1","venue","")],artist:"WILDCHAINS",year:2027});
 assert.equal(r.priority.length,0);
 assert.equal(r.research.length,1);
 assert.equal(r.research[0].type,"venue");
});
test("the seed list is presented as 2027 edition evidence only for a relevant artist",()=>{
 const a=radar.discover({year:2027,artist:"WILDCHAINS"});
 assert.equal(a.editionChecks.length,2);
 assert.ok(a.editionChecks.every(x=>x.page.startsWith("https://")));
 assert.ok(a.editionChecks.every(x=>/vagas não confirmadas|avaliar|Verificar/.test(x.basis+" "+x.next)));
 assert.equal(radar.discover({year:2027,artist:"Devil of a Woman"}).editionChecks.length,0);
 assert.equal(radar.discover({year:2026,artist:"WILDCHAINS"}).editionChecks.length,0);
});
