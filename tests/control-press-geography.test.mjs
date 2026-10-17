import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../control-press-geography.js",import.meta.url),"utf8");
const ctx={};vm.runInNewContext(src,{globalThis:ctx});
const {region,group}=ctx.CaravelaPressGeography;
test("press is grouped into Braga, Porto, Portugal and distinct foreign countries",()=>{
 assert.equal(region({city:"Guimarães",country:"Portugal"}).key,"braga");
 assert.equal(region({city:"Vila Nova de Famalicão",country:"PT"}).key,"braga");
 assert.equal(region({city:"Matosinhos",country:"Portugal"}).key,"porto");
 assert.equal(region({region:"Porto",country:"Portugal"}).key,"porto");
 assert.equal(region({city:"Lisboa",country:"Portugal"}).key,"portugal");
 assert.equal(region({city:"Madrid",country:"Espanha"}).key,"country:espanha");
 assert.equal(region({city:"Paris",country:"França"}).key,"country:franca");
 assert.equal(region({city:"Lisboa",country:""}).key,"unknown");
 const grouped=group([
  {name:"Lisboa",city:"Lisboa",country:"Portugal"},
  {name:"Guimarães",city:"Guimarães",country:"Portugal"},
  {name:"Jerez",city:"Jerez",country:"Espanha"},
  {name:"Porto",city:"Porto",country:"Portugal"}
 ]);
 assert.equal(grouped.length,4);
 assert.deepEqual(Array.from(grouped.map(x=>x.key)),
  ["braga","porto","portugal","country:espanha"]);
});
test("a foreign country never enters Braga or Porto just because its city has a matching name",()=>{
 assert.equal(region({city:"Porto",country:"Brasil"}).key,"country:brasil");
 assert.equal(region({city:"Braga",country:"Espanha"}).key,"country:espanha");
});
