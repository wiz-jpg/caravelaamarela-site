/* Conservative, source-led festival/venue shortlist. No submission or current
 * availability is inferred. Original archived entities are never changed. */
(function(root){"use strict";
 const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase().replace(/\s+/g," ").trim();
 const excluded=/\b(rock in rio|nos alive|primavera sound|passeio maritimo)\b/i;
 const denied=/recusad|declined|rejeitad|bloquead|não contactar|nao contactar/i;
 const stages=new Set(["declined","confirmed","closed"]);
 const future2027=[
  {id:"official:laurus-2027",name:"Laurus Nobilis Music Fest",kind:"festival",year:2027,
   city:"Louro, Vila Nova de Famalicão",district:"Braga",artist:"WILDCHAINS",
   page:"https://event.bol.pt/Comprar/Bilhetes/185370-laurus_nobilis_2027_passe_geral-laurus_nobilis_music_fest/",
   event_dates:"15–17 julho 2027",basis:"Edição 2027 anunciada. Metal; avaliar encaixe e eventual lugar nacional, sem candidatura conhecida.",
   tier:"avaliar"},
  {id:"official:milagre-2027",name:"Milagre Metaleiro Open Air",kind:"festival",year:2027,
   city:"Pindelo dos Milagres",district:"Viseu",artist:"WILDCHAINS",
   page:"https://milagremetaleiro.eu/",event_dates:"20–22 agosto 2027",
   basis:"Festival de rock/metal com edição 2027 anunciada; verificar compatibilidade com cartaz e espaços restantes.",
   tier:"avaliar"}
 ];
 function roster(artist){return artist==="WILDCHAINS"||artist==="Devil of a Woman"?artist:"WILDCHAINS"}
 function discover({contacts=[],actions=[],bookings=[],year=2027,artist="WILDCHAINS",max=12}={}){
  const band=roster(artist),items=[],seen=new Set();
  const used=new Set(bookings.filter(b=>stages.has(b.stage)&&String(b.booking_year||b.event_date?.slice(0,4))===String(year)&&
   norm(b.artist)===norm(band)).map(b=>norm(b.contact_name)));
  const actionByName=new Map();
  for(const a of actions){
   if(!a?.name)continue;
   const key=norm(a.name);
   if(!actionByName.has(key))actionByName.set(key,[]);
   actionByName.get(key).push(a);
  }
  for(const c of contacts){
   if(!["festival","venue"].includes(c.kind)||!c?.name||c.contact_policy==="blocked"||
      c.source_suppressed||c.source_shared_email||c.suppressed||c.control_blocked||
      c.canonical_id||c.duplicate_decision==="secondary")continue;
   const key=norm(c.name);
   if(seen.has(key)||used.has(key)||excluded.test(key))continue;
   seen.add(key);
   const related=(actionByName.get(key)||[]).filter(a=>norm(a.artist)===norm(band));
   if(related.some(a=>denied.test(a.status)||a.no_outreach))continue;
   const latest=related.slice().sort((a,b)=>String(b.last_contact_iso||b.next_action_iso||"")
      .localeCompare(String(a.last_contact_iso||a.next_action_iso||"")))[0];
   const replied=related.some(a=>/em conversa|em negociacao/i.test(norm(a.status)));
   const evidence=[c.notes,c.source_recommendation,c.source_channel_quality,
     c.source_label].map(norm).join(" ");
   // Artistic fit must be supported by genre information actually present.
   const heavy=/heavy rock|hard rock|alternative rock|metal|rock alternativo|rock pesado/.test(evidence);
   const blues=/blues|soul|roots|rhythm and blues/.test(evidence);
   const broad=/\brock\b|musica ao vivo|música ao vivo/.test(evidence);
   const fit=band==="WILDCHAINS"?(heavy?2:broad?1:0):(blues?2:broad?1:0);
   let score=(replied?6:0)+(fit*3)+(latest?2:0)+
     (c.kind==="festival"?2:0);
   const priority=replied&&fit>=1?"Promissor · rever contacto":
     fit>=2&&latest?"Relevante · verificar programação":
     replied?"Contacto em conversa · avaliar enquadramento":
     "Pesquisa · adequação por confirmar";
   items.push({key:"archive:"+c.id,name:c.name,type:c.kind,city:c.city||"",
    region:c.region||"",country:c.country||"",artist:band,score,
    priority,basis:(replied?"Há histórico de conversa. ":"")+
     (fit?"As notas indicam afinidade musical. ":"O género musical e as condições ainda não estão validados. ")+
     (latest?"Existe uma ação anterior do artista.":"Sem ação anterior atribuída ao artista."),
    next:"Confirmar edição, interlocutor, cachet e possibilidade de proposta antes de contactar.",
    contact_id:c.id,source:"Arquivo Caravela",action:latest||null});
  }
  items.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,"pt-PT"));
  const priority=items.filter(x=>x.score>=5).slice(0,max);
  const research=items.filter(x=>x.score<5).slice(0,Math.max(0,max-priority.length));
  const curated=year===2027&&band==="WILDCHAINS"?future2027.map(x=>({
   key:x.id,name:x.name,type:x.kind,city:x.city,region:x.district,country:"Portugal",
   artist:band,source:"Fonte pública da edição de 2027",page:x.page,priority:"Edição anunciada · encaixe a avaliar",
   next:"Verificar programação, adequação artística, condições e contactos antes de enviar proposta.",
   basis:x.basis,event_dates:x.event_dates,score:0,curated:true,
   contact_id:contacts.find(c=>norm(c.name)===norm(x.name))?.id||""
  })).filter(x=>!items.some(y=>norm(y.name)===norm(x.name))):[];
  return {priority, research, editionChecks:curated,scanned:items.length};
 }
 root.CaravelaBookingRadar=Object.freeze({discover});
})(typeof globalThis!=="undefined"?globalThis:null);
