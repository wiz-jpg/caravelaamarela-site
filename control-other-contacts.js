/* Categorisation of non-booking relationships. Pure and non-mutating.
 * Use explicit kind, relationship and human-selected subtype; never guess by name. */
(function(root){"use strict";
 const excluded=new Set(["festival","venue","press","promoter"]);
 const types=Object.freeze({
  artist:"Artistas e equipas",
  service:"Serviços e fornecedores",
  brand:"Marcas e patrocínios",
  institution:"Instituições e associações",
  other:"Outras entidades identificadas",
  unknown:"Tipo por identificar"
 });
 const partnerships=Object.freeze({
  partner:"Parcerias existentes",
  in_discussion:"Parcerias em conversa",
  target:"Potenciais parcerias",
  former:"Parcerias anteriores",
  unknown:"Parcerias por definir",
  not_applicable:"Parcerias por definir"
 });
 const order=["Parcerias existentes","Parcerias em conversa","Potenciais parcerias",
  "Parcerias anteriores","Parcerias por definir","Artistas e equipas",
  "Serviços e fornecedores","Marcas e patrocínios","Instituições e associações",
  "Outras entidades identificadas","Tipo por identificar"];
 const simple=s=>String(s||"").trim().toLocaleLowerCase("pt-PT");
 function category(contact){
  if(!contact||excluded.has(contact.kind))return null;
  const rel=contact.relationship;
  if(contact.kind==="partnership"||["partner","in_discussion","target","former"].includes(rel)){
   const relation=["partner","in_discussion","target","former"].includes(rel)?rel:"unknown";
   return {key:"relationship:"+relation,label:partnerships[relation],basis:
    relation==="unknown"?"Parceria identificada, relação ainda por definir":
    "Estado de parceria registado na ficha"};
  }
  const subtype=Object.prototype.hasOwnProperty.call(types,contact.contact_subtype)?
   contact.contact_subtype:"unknown";
  return {key:"type:"+subtype,label:types[subtype],basis:subtype==="unknown"?
    "Sem tipo específico confirmado":"Tipo específico registado na ficha"};
 }
 function group(contacts,{search=""}={}){
  const query=simple(search),groups=new Map();
  for(const c of contacts||[]){
   const cat=category(c);if(!cat)continue;
   const text=[c.name,c.city,c.region,c.country,c.contact_subtype,c.relationship,
    c.source_label,c.source_contact_person,c.organizer,c.source_recommendation,
    ...(Array.isArray(c.emails)?c.emails:[])].join(" ");
   if(query&&!simple(text).includes(query)&&!simple(cat.label).includes(query))continue;
   if(!groups.has(cat.key))groups.set(cat.key,{...cat,rows:[]});
   groups.get(cat.key).rows.push(c);
  }
  return [...groups.values()].sort((a,b)=>order.indexOf(a.label)-order.indexOf(b.label))
   .map(g=>({...g,rows:g.rows.slice().sort((a,b)=>
    String(a.name||"").localeCompare(String(b.name||""),"pt-PT"))}));
 }
 root.CaravelaOtherContacts=Object.freeze({category,group,types,partnerships});
})(typeof globalThis!=="undefined"?globalThis:null);
