import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {validateNative} from "../control-native.js";

const source=readFileSync(new URL("../control-contact-window.js",import.meta.url),"utf8");
const sandbox={};runInNewContext(source,sandbox);
const {validMD,annualWindow}=sandbox.CaravelaContactWindow;
const venue=extra=>({
 name:"Exemplo",kind:"festival",city:"Braga",emails:["booking@example.test"],
 contact_policy:"review",notes:"",next_step:"",review_date:"",source_label:"Teste",
 origin_id:"",...extra
});
test("annual outreach window requires exact days and never infers dates",()=>{
 for(const invalid of ["","02-29","02-30","04-31","13-01","01-00","1-01","2026-10-10"])
  assert.equal(validMD(invalid),false,invalid);
 assert.equal(validMD("01-31"),true);
 assert.equal(validMD("12-01"),true);
 assert.equal(annualWindow(venue(), "2026-10-16").status,"unknown");
 const missing=validateNative("contacts",venue());
 assert.equal(missing.contact_window_basis,"unknown");
 assert.equal(missing.contact_window_start,"");
});
test("a documented week is highlighted only during its verified annual interval",()=>{
 const record=venue({contact_window_start:"10-12",contact_window_end:"10-19",
  contact_window_basis:"direct",contact_window_reason:"Organizador confirmou por email",
  contact_window_reference:"Zoho conversa 123"});
 assert.equal(validateNative("contacts",record).contact_window_basis,"direct");
 const open=annualWindow(record,"2026-10-16");
 assert.equal(open.status,"open");
 assert.equal(open.daysToStart,-4);
 assert.equal(open.daysToEnd,3);
 assert.equal(annualWindow(record,"2026-10-05").status,"soon");
 const next=annualWindow(record,"2026-10-25");
 assert.equal(next.status,"later");
 assert.equal(next.from.toISOString().slice(0,10),"2027-10-12");
});
test("annual recurring window wraps the year boundary",()=>{
 const entry=venue({contact_window_start:"12-20",contact_window_end:"01-10",
  contact_window_basis:"history",contact_window_reason:"Registo de ciclos anteriores"});
 const now=annualWindow(entry,"2027-01-02");
 assert.equal(now.status,"open");
 assert.equal(now.from.toISOString().slice(0,10),"2026-12-20");
 assert.equal(now.to.toISOString().slice(0,10),"2027-01-10");
 assert.equal(annualWindow(entry,"2027-11-26").status,"soon");
});
test("hypotheses and official claims without source are not promoted to verified windows",()=>{
 const hypo=venue({contact_window_start:"03-01",contact_window_end:"03-14",
  contact_window_basis:"hypothesis",contact_window_reason:"Por confirmar"});
 assert.equal(validateNative("contacts",hypo).contact_window_basis,"hypothesis");
 const suggestion=annualWindow(hypo,"2027-03-05");
 assert.equal(suggestion.status,"hypothesis");
 assert.equal(suggestion.verified,false);
 const official={...hypo,contact_window_basis:"official"};
 assert.equal(validateNative("contacts",official),null);
 assert.ok(validateNative("contacts",{...official,contact_window_reference:"https://example.test/calls"}));
 assert.equal(validateNative("contacts",{...hypo,contact_window_end:""}),null);
 assert.equal(validateNative("contacts",venue({contact_window_basis:"direct"})),null);
});
