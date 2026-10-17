/* Downloadable press contact groups — client-side, no mail sends or writes.
 * Semicolon-separated UTF-8 with BOM for Portuguese spreadsheet applications.
 * A location CSV includes all rows shown by the current press search. */
(function(root){"use strict";
 const headers=["Entidade","Email(s)","Interlocutor(es)","Email(s) de interlocutor",
  "Localidade","Região","País","Situação de contacto","Fonte","ID da ficha"];
 const unique=a=>[...new Set(a.map(v=>String(v||"").trim()).filter(Boolean))];
 function policy(c){
  if(c.contact_policy==="blocked"||c.suppressed||c.source_suppressed||
     c.control_blocked||c.control_blocked_possible)return "Não contactar / bloqueado";
  if(c.shared_email||c.source_shared_email||c.review_required||
     c.duplicate_decision==="secondary"||c.canonical_id)return "Rever contacto partilhado / duplicado";
  if(c.contact_policy==="allowed")return "Autorizado na ficha - confirmar contexto";
  return "Por validar antes de contactar";
 }
 function safe(value){
  let s=String(value??"").replace(/[\r\n\t\u0000-\u001f\u007f]/g," ").trim();
  // Prevent formula injection when opened in Excel/Sheets/LibreOffice.
  if(/^[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 }
 function dataRow(c){
  const people=Array.isArray(c.people)?c.people.filter(x=>x&&typeof x==="object"):[];
  const emails=unique([...(Array.isArray(c.emails)?c.emails:[]),c.source_primary_email,
    c.authorization_email]);
  const personEmails=unique(people.map(x=>x.email));
  return [c.name||"",emails.join(" | "),
    unique(people.map(x=>[x.name,x.role].filter(Boolean).join(" — "))).join(" | "),
    personEmails.join(" | "),c.city||"",c.region||"",c.country||"",
    policy(c),c.source_label||c.source||"",c.id||""];
 }
 function filename(group){
  const key=String(group?.key||"unknown").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,65)||"sem-localizacao";
  return "caravela-imprensa-"+key+".csv";
 }
 function create(group){
  if(!group||!Array.isArray(group.rows))throw Error("invalid_press_group");
  const seen=new Set();
  const rows=group.rows.filter(c=>{
   const id=String(c?.id||"").trim();
   if(!id||seen.has(id))return false;
   seen.add(id);return true;
  });
  const content="\uFEFF"+[headers,...rows.map(dataRow)].map(row=>row.map(safe).join(";")).join("\r\n")+"\r\n";
  return {filename:filename(group),content,count:rows.length};
 }
 root.CaravelaPressCsv=Object.freeze({create,policy,headers});
})(typeof globalThis!=="undefined"?globalThis:null);
