/* Group press by verified geographic metadata; no geocoding or guesses. */
(function(root){"use strict";
 const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLocaleLowerCase("pt-PT").replace(/\s+/g," ").trim();
 const braga=new Set(["braga","guimaraes","vila nova de famalicao","famalicao","barcelos",
  "vila verde","amares","esposende","povoa de lanhoso","vieira do minho",
  "terras de bouro","cabeceiras de basto","celorico de basto","vizela"]);
 const porto=new Set(["porto","vila nova de gaia","gaia","matosinhos","maia",
  "gondomar","valongo","trofa","santo tirso","povoa de varzim","vila do conde",
  "paredes","penafiel","paços de ferreira","pacos de ferreira","felgueiras",
  "lousada","amarante","marco de canaveses","baiao"]);
 const portugal=new Set(["portugal","pt","portuguesa","portuguese"]);
 function region(row){
  const city=norm(row.city),area=norm(row.region),country=norm(row.country);
  const localPT=portugal.has(country);
  const br=braga.has(city)||area==="braga";
  const po=porto.has(city)||area==="porto";
  if(country&&!localPT)return {key:"country:"+country,label:String(row.country).trim()};
  if(br)return {key:"braga",label:"Braga (e arredores)"};
  if(po)return {key:"porto",label:"Porto (e arredores)"};
  if(localPT)return {key:"portugal",label:"Resto de Portugal"};
  if(!country&&city)return {key:"unknown",label:"País por confirmar"};
  return {key:"unknown",label:"Localização por confirmar"};
 }
 function group(rows){
  const by=new Map();
  for(const row of rows){const g=region(row);
   if(!by.has(g.key))by.set(g.key,{...g,rows:[]});
   by.get(g.key).rows.push(row);
  }
  const order=x=>x.key==="braga"?0:x.key==="porto"?1:x.key==="portugal"?2:
    x.key.startsWith("country:")?3:4;
  return [...by.values()].sort((a,b)=>order(a)-order(b)||
    a.label.localeCompare(b.label,"pt-PT")).map(g=>({...g,
    rows:g.rows.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-PT"))}));
 }
 root.CaravelaPressGeography=Object.freeze({region,group});
})(typeof globalThis!=="undefined"?globalThis:null);
