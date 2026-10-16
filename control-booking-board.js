/* Booking board 2027+: pure, non-mutating classification.
   Historical contact window relevance to the target year must be explicit. */
(function(root){"use strict";
 const ISO=/^\d{4}-\d{2}-\d{2}$/;
 const MD=/^(\d{2})-(\d{2})$/;
 const low=x=>String(x||"").trim().toLocaleLowerCase("pt-PT");
 const stagesOngoing=new Set(["contact_reported","sent_verified","reply_reported","negotiating"]);
 const d=s=>ISO.test(s||"")&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
 function exactYear(row){
  if(/^\d{4}$/.test(row?.booking_year||""))return +row.booking_year;
  return d(row?.event_date)?+row.event_date.slice(0,4):null;
 }
 function kind(row,contact){
  if(["festival","venue"].includes(contact?.kind))return contact.kind;
  return ["festival","venue"].includes(row?.booking_category)?row.booking_category:"other";
 }
 function artists(value){
  const t=low(value),both=/wildchains/.test(t)&&/devil/.test(t);
  if(both)return ["WILDCHAINS","Devil of a Woman"];
  if(t==="wildchains")return ["WILDCHAINS"];
  if(t==="devil"||t==="devil of a woman")return ["Devil of a Woman"];
  return [];
 }
 function windowFor(contact,year,todayISO){
  const start=MD.exec(contact?.contact_window_start||""),
   end=MD.exec(contact?.contact_window_end||"");
  if(!start||!end||!d(todayISO)||!["same_year","prior_year"].includes(contact?.contact_window_target)||
    !["official","direct","history"].includes(contact?.contact_window_basis))
   return {status:"unknown",reason:"Janela para este ano por confirmar"};
  const base=year-(contact.contact_window_target==="prior_year"?1:0);
  function mk(when,y){
   const stamp=new Date(Date.UTC(y,+when[1]-1,+when[2]));
   return stamp.getUTCMonth()===+when[1]-1&&stamp.getUTCDate()===+when[2]?
     stamp.toISOString().slice(0,10):null;
  }
  const from=mk(start,base),wrap=contact.contact_window_start>contact.contact_window_end,
    to=mk(end,base+(wrap?1:0));
  if(!from||!to)return {status:"unknown",reason:"Datas da janela inválidas"};
  const diff=Math.round((Date.parse(from+"T00:00:00Z")-Date.parse(todayISO+"T00:00:00Z"))/86400000);
  const status=todayISO>to?"late":todayISO>=from?"now":diff<=45?"soon":"later";
  return {status,from,to,daysUntil:diff,reason:contact.contact_window_reason||"",
    basis:contact.contact_window_basis};
 }
 function classify({bookings=[],contacts=[],year=2027,today="2026-10-17"}={}){
  if(!Number.isInteger(year)||year<2020||year>2099||!d(today))throw Error("invalid_board_date");
  const byId=new Map(contacts.map(x=>[x.id,x]));
  const festival={ongoing:[],late:[],now:[],soon:[],planning:[],declined:[],confirmed:[]};
  const venue={ongoing:[],suggestions:[],declined:[],confirmed:[]};
  const other=[],undated=[];
  const linkedForYear=new Set();
  const confirmedGigs=[];
  const sorted=bookings.filter(x=>x&&typeof x==="object").slice();
  for(const r of sorted){
   const actualYear=exactYear(r);
   if(actualYear===null){undated.push(r);continue;}
   if(actualYear!==year)continue;
   if(r.contact_id)linkedForYear.add(r.contact_id);
   const contact=byId.get(r.contact_id);
   const type=kind(r,contact);
   const item={type:"booking",record:r,contact,artists:artists(r.artist),
    locality:[contact?.city,contact?.region,contact?.country].filter(Boolean).join(" · "),
    window:windowFor(contact,year,today)};
   if(r.stage==="confirmed"){
    if(type==="festival")festival.confirmed.push(item);
    else if(type==="venue")venue.confirmed.push(item);
    else other.push(item);
    if(contact&&["festival","venue"].includes(type))confirmedGigs.push(item);
   }else if(r.stage==="declined"){
    if(type==="festival")festival.declined.push(item);
    else if(type==="venue")venue.declined.push(item);
    else other.push(item);
   }else if(type==="festival"){
    if(stagesOngoing.has(r.stage))festival.ongoing.push(item);
    else {
     const lane=item.window.status;
     festival[["late","now","soon"].includes(lane)?lane:"planning"].push(item);
    }
   }else if(type==="venue"){
    venue[stagesOngoing.has(r.stage)?"ongoing":"suggestions"].push(item);
   }else other.push(item);
  }
  for(const contact of contacts){
   if(!contact?.id||linkedForYear.has(contact.id)||
     contact.contact_policy==="blocked"||contact.source_suppressed||
     contact.source_shared_email||contact.canonical_id||contact.duplicate_decision==="secondary")continue;
   if(contact.kind==="festival"){
    const window=windowFor(contact,year,today);
    if(["late","now","soon"].includes(window.status))
     festival[window.status].push({type:"candidate",contact,record:null,artists:[],
       locality:[contact.city,contact.region,contact.country].filter(Boolean).join(" · "),window});
   }else if(contact.kind==="venue"){
    const c=low(contact.city),region=low(contact.region),country=low(contact.country);
    if(!c&&!region)continue;
    let best=null;
    for(const gig of confirmedGigs){
     const v=gig.contact,otherCity=low(v.city),otherRegion=low(v.region),otherCountry=low(v.country);
     if(country&&otherCountry&&country!==otherCountry)continue;
     const sameCity=c&&otherCity&&c===otherCity;
     const sameRegion=region&&otherRegion&&region===otherRegion;
     if(!sameCity&&!sameRegion)continue;
     const score=sameCity?0:1;
     if(!best||score<best.score)best={score,concert:gig.record,artists:gig.artists,
       reason:sameCity?"Concerto confirmado na mesma cidade":"Concerto confirmado na mesma região"};
    }
    if(best)venue.suggestions.push({type:"candidate",record:null,contact,
      artists:best.artists,locality:[contact.city,contact.region,contact.country].filter(Boolean).join(" · "),
      reason:best.reason,nearbyGig:best.concert,matchScore:best.score});
   }
  }
  const cmp=(a,b)=> (a.type==="booking"?0:1)-(b.type==="booking"?0:1)||
   (a.matchScore??0)-(b.matchScore??0)||
   (a.window?.from||"9999").localeCompare(b.window?.from||"9999")||
   low(a.contact?.name||a.record?.contact_name).localeCompare(low(b.contact?.name||b.record?.contact_name),"pt-PT");
  for(const section of [festival,venue])for(const lane of Object.values(section))lane.sort(cmp);
  return {year,festival,venue,other,undated};
 }
 const api=Object.freeze({classify,windowFor,exactYear,kind,artists});
 if(root&&typeof root==="object")root.CaravelaBookingBoard=api;
})(typeof globalThis!=="undefined"?globalThis:null);
