/* Editorial reach and source-verified district hints for press only.
 * Historic locations preserved; directory projections do not write records. */
(function(root){"use strict";
 const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
   .replace(/[^a-z0-9]+/g," ").trim();
 const culture=new Set(["musicfest","musicfest pt","blitz","revista blitz",
  "arte e cultura","comunidade cultura e arte","comunidade de cultura e arte",
  "antena 3","arte sonora"]);
 const known=new Map(Object.entries({
  "Braga TV":"Braga","O Minho":"Braga","Diário do Minho":"Braga",
  "Correio do Minho":"Braga","O Vila Verdense":"Braga","Opinião Pública":"Braga",
  "O Povo Famalicense":"Braga","O Amarense":"Braga","Revista Rua":"Braga",
  "Revista SIM":"Braga","Revista Spot":"Braga","ComUM":"Braga",
  "Barcelos Popular":"Braga","Revista Minha":"Braga","Braga Cultura":"Braga",
  "Antena Minho":"Braga","Rádio Barcelos":"Braga","Rádio Cavado":"Braga",
  "Rádio Voz do Neiva":"Braga","Rádio Vizela":"Braga",
  "Rádio Região de Basto":"Braga","Rádio Santiago":"Braga",
  "Rádio Cidade Hoje":"Braga","Fama Radio":"Braga","RUM":"Braga",
  "Rádio Valdevez":"Viana do Castelo"
 }).map(([x,d])=>[norm(x),d]));
 function national(row){return !!row&&(!row.kind||row.kind==="press")&&
  (culture.has(norm(row.name))||["national","nacional"].includes(norm(row.coverage_scope||row.press_scope)))}
 function inferredDistrict(row){
  if(!row||row.kind&&row.kind!=="press")return null;
  if(row.country&&!["portugal","pt","portuguesa","portuguese"].includes(norm(row.country)))return null;
  return known.get(norm(row.name))||null;
 }
 function source(row){return national(row)?
   {type:"culture",basis:"Âmbito editorial nacional validado"}:
   inferredDistrict(row)?{type:"district",district:inferredDistrict(row),
    basis:"Lista de imprensa Caravela · localidade verificada"}:null}
 root.CaravelaPressEditorial=Object.freeze({national,inferredDistrict,source});
})(typeof globalThis!=="undefined"?globalThis:null);
