import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const ctx={};
vm.runInNewContext(readFileSync(new URL("../control-press-csv.js",import.meta.url),"utf8"),{globalThis:ctx});
const csv=ctx.CaravelaPressCsv;
test("district CSV includes all rows, not merely the first 35 cards",()=>{
 const contacts=Array.from({length:52},(_,i)=>({
  id:"press-"+i,name:"Jornal "+String(i).padStart(3,"0"),
  emails:["redaccao"+i+"@exemplo.pt"],
  city:"Lisboa",region:"Lisboa",country:"Portugal",
  contact_policy:"review"
 }));
 const data=csv.create({key:"district:lisboa",label:"Lisboa",rows:contacts});
 assert.equal(data.filename,"caravela-imprensa-district-lisboa.csv");
 assert.equal(data.count,52);
 assert.equal(data.content.split("\r\n").filter(Boolean).length,53);
 assert.ok(data.content.startsWith("\uFEFF"));
 assert.match(data.content,/redaccao51@exemplo.pt/);
});
test("region export contains all of Resto de Portugal while districts remain separate",()=>{
 const outside=[
  {id:"l",name:"Lisboa",city:"Lisboa",country:"Portugal",emails:["a@example.pt"]},
  {id:"c",name:"Coimbra",city:"Coimbra",country:"Portugal",emails:["b@example.pt"]}
 ];
 const all=csv.create({key:"portugal",label:"Resto de Portugal",rows:outside});
 const city=csv.create({key:"district:coimbra",label:"Coimbra",rows:outside.slice(1)});
 assert.equal(all.count,2);
 assert.equal(city.count,1);
 assert.match(all.content,/a@example.pt/);
 assert.doesNotMatch(city.content,/a@example.pt/);
});
test("CSV escapes commas, semicolons, line breaks, quotes and spreadsheet formulas",()=>{
 const data=csv.create({key:"braga",rows:[{
  id:"x",name:'=HYPERLINK("evil";"click")\r\n',city:"Braga",country:"Portugal",
  emails:["press@example.pt"],people:[{name:"João; Oliveira",role:"editor",email:"joao@example.pt"}]
 }]});
 assert.match(data.content,/"'=HYPERLINK\(""evil"";""click""\)"?/);
 assert.match(data.content,/"João; Oliveira — editor"/);
 assert.equal(data.content.split("\r\n").filter(Boolean).length,2);
});
test("restricted press contacts stay in export with explicit status and are deduplicated by ID",()=>{
 const blocked={id:"abc",name:"Meio de Imprensa",contact_policy:"blocked",
  emails:["blocked@example.pt"],city:"Porto",country:"Portugal"};
 const data=csv.create({key:"porto",rows:[blocked,blocked]});
 assert.equal(data.count,1);
 assert.match(data.content,/Não contactar \/ bloqueado/);
 assert.match(data.content,/blocked@example.pt/);
 assert.equal(csv.policy({source_shared_email:true}),"Rever contacto partilhado / duplicado");
});
test("CSV does not export blank or repeated internal IDs",()=>{
 const data=csv.create({key:"unknown",rows:[{id:"x",name:"A"},{id:"x",name:"B"},{name:"C"}]});
 assert.equal(data.count,1);
 assert.equal(data.filename,"caravela-imprensa-unknown.csv");
});
