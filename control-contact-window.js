/* Caravela Control — annual booking outreach windows.
 * Dates are manually evidenced per entity; nothing here authorizes contact. */
(function(root){
 "use strict";
 const DATE=/^(\d{2})-(\d{2})$/;
 const DAY_MS=86400000;
 function validMD(value){
  const m=DATE.exec(value||"");if(!m)return false;
  const month=Number(m[1]),day=Number(m[2]);
  if(month<1||month>12||day<1||day>31)return false;
  // 2000 is leap, but recurring February 29 would not exist every year.
  const date=new Date(Date.UTC(2001,month-1,day));
  return date.getUTCMonth()===month-1&&date.getUTCDate()===day;
 }
 function utcDate(year,mmdd){
  return new Date(Date.UTC(year,Number(mmdd.slice(0,2))-1,Number(mmdd.slice(3,5))));
 }
 function fmt(when){
  return String(when.getUTCDate()).padStart(2,"0")+"/"+
    String(when.getUTCMonth()+1).padStart(2,"0")+"/"+when.getUTCFullYear();
 }
 function isoDay(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const ms=Date.parse(value+"T00:00:00Z");
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value?ms:null;
 }
 function annualWindow(contact,todayISO){
  const start=contact?.contact_window_start||"",end=contact?.contact_window_end||"";
  if(!validMD(start)||!validMD(end))return {status:"unknown",label:"Janela por pesquisar"};
  const epoch=isoDay(todayISO);
  if(epoch===null)return {status:"unknown",label:"Data de referência inválida"};
  const now=new Date(epoch),y=now.getUTCFullYear(),wrap=start>end;
  const slots=[];
  for(const year of [y-1,y,y+1]){
   const from=utcDate(year,start),to=utcDate(year+(wrap?1:0),end);
   slots.push({from,to,daysToStart:Math.round((from.valueOf()-epoch)/DAY_MS),
    daysToEnd:Math.round((to.valueOf()-epoch)/DAY_MS)});
  }
  const active=slots.find(x=>x.daysToStart<=0&&x.daysToEnd>=0);
  const next=active||slots.filter(x=>x.daysToStart>0).sort((a,b)=>a.from-b.from)[0];
  if(!next)return {status:"unknown",label:"Janela por pesquisar"};
  const hypothesis=contact?.contact_window_basis==="hypothesis";
  const status=hypothesis?"hypothesis":active?"open":next.daysToStart<=30?"soon":"later";
  return {...next,status,source:contact.contact_window_basis||"unknown",
   label:fmt(next.from)+"–"+fmt(next.to),active:!!active,hypothesis,
   daysToStart:next.daysToStart,daysToEnd:next.daysToEnd,
   verified:contact.contact_window_basis==="official"||contact.contact_window_basis==="direct"};
 }
 const api=Object.freeze({validMD,annualWindow});
 if(root&&typeof root==="object")root.CaravelaContactWindow=api;
})(typeof globalThis!=="undefined"?globalThis:null);
