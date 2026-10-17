import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const src=readFileSync(new URL("../control-other-contacts.js",import.meta.url),"utf8");
const scope={};vm.runInNewContext(src,{globalThis:scope});
const {group,category}=scope.CaravelaOtherContacts;
const row=(id,kind,patch={})=>({id,name:"Entidade "+id,kind,
 emails:[id+"@example.pt"],city:"Braga",country:"Portugal",...patch});
test("promoters, festivals, venues and press never appear in Outros contactos",()=>{
 const input=[row("p","promoter"),row("f","festival"),row("v","venue"),row("m","press"),
  row("x","other"),row("r","partnership")];
 const all=group(input);
 const ids=all.flatMap(x=>x.rows).map(x=>x.id);
 assert.deepEqual(Array.from(ids).sort(),["r","x"]);
 for(const c of input.slice(0,4))assert.equal(category(c),null);
});
test("partnerships are separated by recorded relationship, not guessed from name",()=>{
 const g=group([
  row("confirmed","partnership",{relationship:"partner"}),
  row("discussion","partnership",{relationship:"in_discussion"}),
  row("target","partnership",{relationship:"target"}),
  row("former","partnership",{relationship:"former"}),
  row("unknown","partnership",{relationship:"unknown"}),
  row("other-partner","other",{relationship:"partner"})
 ]);
 assert.deepEqual(Array.from(g.map(x=>x.label)),[
  "Parcerias existentes","Parcerias em conversa","Potenciais parcerias",
  "Parcerias anteriores","Parcerias por definir"
 ]);
 assert.equal(g[0].rows.length,2);
});
test("unknown contacts keep explicit unknown status until a specific human subtype is stored",()=>{
 const rows=[
  row("artist","other",{contact_subtype:"artist"}),
  row("service","other",{contact_subtype:"service"}),
  row("brand","other",{contact_subtype:"brand"}),
  row("institution","other",{contact_subtype:"institution"}),
  row("other","other",{contact_subtype:"other"}),
  row("unknown","other",{contact_subtype:"unknown",name:"Agência Cultural"}),
  row("missing","other",{name:"Empresa de Música"})
 ];
 const grouped=group(rows);
 assert.deepEqual(Array.from(grouped.map(x=>x.label)),[
  "Artistas e equipas","Serviços e fornecedores","Marcas e patrocínios",
  "Instituições e associações","Outras entidades identificadas","Tipo por identificar"
 ]);
 assert.equal(grouped.at(-1).rows.length,2);
 assert.equal(grouped.at(-1).basis,"Sem tipo específico confirmado");
});
test("search filters across categories without adding removed promoters back",()=>{
 const found=group([
  row("p","promoter",{name:"Música Produtora"}),
  row("r","partnership",{name:"Música Parceira",relationship:"target"}),
  row("s","other",{name:"Fotografia Visual",contact_subtype:"service"})
 ],{search:"música"});
 assert.equal(found.length,1);
 assert.equal(found[0].rows[0].id,"r");
});
