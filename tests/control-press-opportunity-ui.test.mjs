import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const context={};
vm.runInNewContext(read("control-opportunity-availability.js"),{globalThis:context});
const open=context.CaravelaOpportunityCheck.open;
const opportunity={availability:"open_verified",open_verified_on:"2026-10-15",
 verified_on:"2026-10-16",deadline:"2026-11-02",status:"research"};
test("radar open category needs recent human verification and valid deadline",()=>{
 assert.equal(open(opportunity,"2026-10-17"),true);
 assert.equal(open({...opportunity,availability:"unverified"},"2026-10-17"),false);
 assert.equal(open({...opportunity,deadline:"2026-10-16"},"2026-10-17"),false);
 assert.equal(open({...opportunity,open_verified_on:"2026-09-01"},"2026-10-17"),false);
 assert.equal(open({...opportunity,verified_on:"2026-10-18"},"2026-10-17"),false);
 assert.equal(open({...opportunity,status:"closed"},"2026-10-17"),false);
});
test("press planner and home focus load with validated syntax",()=>{
 for(const path of ["control-press-ui.js","control-home-focus-ui.js",
  "control-opportunities-ui.js","control-booking-board-ui.js"]){
  assert.doesNotThrow(()=>new Function(read(path)),path);
 }
 const home=read("control-home-focus-ui.js");
 assert.match(home,/cc-essential-home/);
 assert.match(home,/cc-home-everything/);
 assert.match(home,/CaravelaOpportunityCheck/);
});
