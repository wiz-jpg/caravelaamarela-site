import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../control-press-geography.js",import.meta.url),"utf8");
const ctx={};vm.runInNewContext(src,{globalThis:ctx});
const {region,group}=ctx.CaravelaPressGeography;
test("press is grouped directly by district in Portugal and by country abroad",()=>{
 assert.equal(region({city:"Guimarães",country:"Portugal"}).key,"district:braga");
 assert.equal(region({city:"Vila Nova de Famalicão",country:"PT"}).key,"district:braga");
 assert.equal(region({city:"Matosinhos",country:"Portugal"}).key,"district:porto");
 assert.equal(region({region:"Porto",country:"Portugal"}).key,"district:porto");
 assert.equal(region({city:"Lisboa",country:"Portugal"}).key,"district:lisboa");
 assert.equal(region({city:"Madrid",country:"Espanha"}).key,"country:espanha");
 assert.equal(region({city:"Paris",country:"França"}).key,"country:franca");
 assert.equal(region({city:"Lisboa",country:""}).key,"district:lisboa");
 const grouped=group([
  {name:"Lisboa",city:"Lisboa",country:"Portugal"},
  {name:"Guimarães",city:"Guimarães",country:"Portugal"},
  {name:"Jerez",city:"Jerez",country:"Espanha"},
  {name:"Porto",city:"Porto",country:"Portugal"}
 ]);
 assert.equal(grouped.length,4);
 assert.deepEqual(Array.from(grouped.map(x=>x.key)),
  ["district:braga","district:lisboa","district:porto","country:espanha"]);
});
test("a foreign country never enters Braga or Porto just because its city has a matching name",()=>{
 assert.equal(region({city:"Porto",country:"Brasil"}).key,"country:brasil");
 assert.equal(region({city:"Braga",country:"Espanha"}).key,"country:espanha");
});


test("Portugal is directly divided into districts based on confirmed municipalities",()=>{
 assert.equal(region({city:"Coimbra",country:"Portugal"}).key,"district:coimbra");
 assert.equal(region({city:"Lisboa",country:"Portugal"}).key,"district:lisboa");
 assert.equal(region({city:"Faro",country:"Portugal"}).key,"district:faro");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Coimbra",country:"Portugal"}),"Coimbra");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Cascais",country:"Portugal"}),"Lisboa");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Portimão",country:"Portugal"}),"Faro");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Leiria",country:"Portugal"}),"Leiria");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Viseu",country:"Portugal"}),"Viseu");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Tomar",country:"Portugal"}),"Santarém");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Almada",country:"Portugal"}),"Setúbal");
});
test("explicit districts take precedence and unidentified district remains unclassified",()=>{
 assert.equal(ctx.CaravelaPressGeography.district({city:"",region:"Viana do Castelo",country:"Portugal"}),"Viana do Castelo");
 assert.equal(ctx.CaravelaPressGeography.district({city:"Algarve",region:"Sul",country:"Portugal"}),null);
 assert.equal(ctx.CaravelaPressGeography.district({city:"Lisboa",country:"Espanha"}),null);
 const g=ctx.CaravelaPressGeography.districtsWithin([
  {id:"1",name:"Meio de Leiria",city:"Leiria",country:"Portugal"},
  {id:"2",name:"Meio de Lisboa",city:"Oeiras",country:"Portugal"},
  {id:"3",name:"Meio sem distrito",city:"Algarve",region:"Sul",country:"Portugal"},
  {id:"4",name:"Meio de Coimbra",region:"Coimbra",city:"",country:"Portugal"},
  {id:"5",name:"Segundo meio de Leiria",region:"Leiria",city:"",country:"Portugal"}
 ]);
 assert.deepEqual(Array.from(g.map(x=>x.key)),["district:coimbra","district:leiria","district:lisboa","unknown"]);
 assert.equal(g.find(x=>x.key==="district:leiria").rows.length,2);
 assert.equal(g.find(x=>x.key==="unknown").rows[0].id,"3");
});


test("Portuguese city with no province is not classified into an arbitrary district",()=>{
 assert.equal(region({city:"Cidade não catalogada",country:"Portugal"}).key,"unknown");
 assert.equal(region({city:"Porto",country:"Brasil"}).key,"country:brasil");
 assert.equal(region({city:"Braga",country:"Portugal"}).key,"district:braga");
 assert.equal(region({city:"Guimarães",country:"Portugal"}).label,"Braga");
 assert.equal(region({city:"Gondomar",country:"Portugal"}).label,"Porto");
});
