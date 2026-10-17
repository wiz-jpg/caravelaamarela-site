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
 function classify({bookings=[],contacts=[],actions=[],year=2027,today="2026-10-17"}={}){
  if(!Number.isInteger(year)||year<2020||year>2099||!d(today))throw Error("invalid_board_date");
  const byId=new Map(contacts.map(x=>[x.id,x]));
  const festival={ongoing:[],late:[],now:[],soon:[],planning:[],archive:[],declined:[],confirmed:[]};
  const venue={ongoing:[],suggestions:[],archive:[],declined:[],confirmed:[]};
  const archivedKeys=new Set();
  const contactsWithHistory=new Set();
  const nameKey=x=>low(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const lookup=new Map();
  for(const c of contacts){const key=nameKey(c.name);if(!lookup.has(key))lookup.set(key,[]);lookup.get(key).push(c)}

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
   if(r.stage==="closed"){other.push(item);continue}
   if(r.stage==="paused"){
    if(type==="festival")festival.planning.push(item);
    else if(type==="venue")venue.suggestions.push(item);
    else other.push(item);
    continue;
   }
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
  // Imported AÇÕES can populate operational review lanes without modifying native booking.
  // Every derived card is visibly provisional; no status is promoted to confirmed.
  const grouped=new Map();
  const relevantDate=value=>d(value)&&value>=String(year-1)+"-01-01"&&value<=String(year)+"-12-31";
  const safety=c=>c?.contact_policy!=="blocked"&&!c?.source_suppressed&&
    !c?.source_shared_email&&!c?.suppressed&&!c?.control_blocked&&
    !c?.control_blocked_possible&&!c?.shared_email&&!c?.canonical_id&&
    c?.duplicate_decision!=="secondary";
  const contactEmail=c=>[...(c.emails||[]),...(c.people||[]).map(p=>p.email)].map(x=>low(x)).filter(Boolean);
  for(const a of actions){
   if(!a?.id||!a?.name||a.no_outreach||a.contact_policy==="blocked")continue;
   const options=(lookup.get(nameKey(a.name))||[]).filter(c=>
     !a.email||!contactEmail(c).length||contactEmail(c).includes(low(a.email)));
   let contact=null;
   if(options.length===1)contact=options[0];
   else if(options.length>1&&a.matched_entity_id){
    // Still need a unique exact candidate, not just a mutable spreadsheet reference.
    const found=options.filter(c=>c.id===a.matched_entity_id);
    if(found.length===1)contact=found[0];
   }
   if(!contact||!["festival","venue"].includes(contact.kind)||!safety(contact))continue;
   const project=artists(a.artist),band=project.join("+")||"unassigned";
   const key=contact.id+"|"+band;
   const already=bookings.some(r=>{
    if(!r)return false;
    if(r.contact_id!==contact.id&&nameKey(r.contact_name)!==nameKey(contact.name))return false;
    const sameArtist=artists(r.artist).join("+")===band;
    const explicit=exactYear(r);
    return sameArtist&&(explicit===year||explicit===null);
   });
   if(already)continue;
   const dates=[a.next_followup_iso,a.next_action_iso,a.last_contact_iso].filter(relevantDate);
   const rowNumber=Number(a.origin?.row)||0;
   const rank=(dates.sort().at(-1)||"")+"|"+String(rowNumber).padStart(7,"0");
   const prev=grouped.get(key);
   if(!prev||rank>prev.rank)grouped.set(key,{a,contact,project,rank});
  }
  for(const {a,contact,project} of grouped.values()){
   const key=contact.id+"|"+(project.join("+")||"unassigned");
   if(archivedKeys.has(key))continue;archivedKeys.add(key);
   contactsWithHistory.add(contact.id);
   const state=nameKey(a.status);
   const isFirst=state==="por contactar";
   const isOngoing=["enviado","em conversa","em negociacao"].includes(state);
   const dated=(isOngoing?a.next_followup_iso||a.next_action_iso:a.next_action_iso||a.next_followup_iso)||"";
   const validDate=relevantDate(dated)?dated:"";

   const item={type:"archive",provisional:true,archive:a,record:null,contact,artists:project,
    action_date:validDate,locality:[contact.city,contact.region,contact.country].filter(Boolean).join(" · "),
    reason:"Classificação sugerida a partir de AÇÕES · confirmar o ano e a evidência no Zoho"};
   const days=validDate?Math.round((Date.parse(validDate+"T12:00:00Z")-
     Date.parse(today+"T12:00:00Z"))/86400000):null;
   if(contact.kind==="festival"){
    let lane="archive";
    if(isOngoing)lane="ongoing"; // Provisional follow-up even without a verified date.
    else if(isFirst&&validDate&&days>=-90){
     lane=days<0?"late":days<=7?"now":days<=45?"soon":"planning";
    }else if(isFirst&&validDate){
     // A stale documented action remains in historical review; do not
     // replace its age with a recurring venue window.
     lane="archive";
    }else if(isFirst){
     const verifiedWindow=windowFor(contact,year,today).status;
     lane=["late","now","soon"].includes(verifiedWindow)?verifiedWindow:"planning";
    }
    // A reported refusal/confirmation from old records never closes a 2027 gig.
    festival[lane].push(item);
   }else{
    venue[isOngoing?"ongoing":isFirst?"suggestions":"archive"].push(item);
   }
  }
  for(const contact of contacts){
   if(!contact?.id||linkedForYear.has(contact.id)||contactsWithHistory.has(contact.id)||
     contact.contact_policy==="blocked"||contact.source_suppressed||
     contact.source_shared_email||contact.canonical_id||contact.duplicate_decision==="secondary")continue;
   if(contact.kind==="festival"){
    const window=windowFor(contact,year,today);
    const lane=["late","now","soon"].includes(window.status)?window.status:"planning";
    festival[lane].push({type:"candidate",contact,record:null,artists:[],
      locality:[contact.city,contact.region,contact.country].filter(Boolean).join(" · "),window,
      reason:lane==="planning"?"Investigar janela e ano de contacto para "+year:""});
   }else if(contact.kind==="venue"){
    const c=low(contact.city),region=low(contact.region),country=low(contact.country);
    if(!c&&!region){
      venue.suggestions.push({type:"candidate",contact,record:null,artists:[],
        locality:[contact.city,contact.region,contact.country].filter(Boolean).join(" · "),
        reason:"Localização e encaixe artístico a confirmar",matchScore:4});
      continue;
    }
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
    venue.suggestions.push({type:"candidate",record:null,contact,
      artists:best?.artists||[],locality:[contact.city,contact.region,contact.country].filter(Boolean).join(" · "),
      reason:best?.reason||"Sala do arquivo · avaliar encaixe, condições e território",
      nearbyGig:best?.concert||null,matchScore:best?.score??3});
   }
  }
  const cmp=(a,b)=> (a.type==="booking"?0:a.type==="archive"?1:2)-
     (b.type==="booking"?0:b.type==="archive"?1:2)||
   (a.matchScore??0)-(b.matchScore??0)||
   (a.window?.from||"9999").localeCompare(b.window?.from||"9999")||
   low(a.contact?.name||a.record?.contact_name).localeCompare(low(b.contact?.name||b.record?.contact_name),"pt-PT");
  for(const section of [festival,venue])for(const lane of Object.values(section))lane.sort(cmp);
  return {year,festival,venue,other,undated};
 }
 const api=Object.freeze({classify,windowFor,exactYear,kind,artists});
 if(root&&typeof root==="object")root.CaravelaBookingBoard=api;
})(typeof globalThis!=="undefined"?globalThis:null);
