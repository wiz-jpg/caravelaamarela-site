/* External-only booking radar. Source-led leads, not internal CRM recommendation.
 * Client-side deduplication against archived/native contacts, past actions and
 * bookings. Search results are leads; they require official confirmation. */
(function(root){"use strict";
 const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const official=[
  {name:"Laurus Nobilis Music Fest",artist:"WILDCHAINS",year:2027,type:"festival",
   city:"Vila Nova de Famalicão",page:"https://event.bol.pt/Comprar/Bilhetes/185370-laurus_nobilis_2027_passe_geral-laurus_nobilis_music_fest/",
   basis:"Edição 2027 anunciada. Festival de metal; possível abordagem apenas se existir espaço de programação.",status:"edition_announced"},
  {name:"Milagre Metaleiro Open Air",artist:"WILDCHAINS",year:2027,type:"festival",
   city:"Pindelo dos Milagres",page:"https://milagremetaleiro.eu/",
   basis:"Edição 2027 anunciada. Afinidade metal a confirmar com o cartaz e as condições.",status:"edition_announced"},
  {name:"SQUARE",artist:"WILDCHAINS",year:2027,type:"festival",
   city:"Braga",page:"https://www.squarefestival.pt/pt",
   basis:"Showcase de circulação internacional em Braga. A open call da edição 2027 terminou a 15/08/2026; não apresentar como candidatura aberta.",status:"application_closed"},
  {name:"Santa Maria Blues",artist:"Devil of a Woman",year:2027,type:"festival",
   city:"Vila do Porto, Açores",page:"https://www.santamariablues.com/",
   basis:"Festival dedicado ao blues com edição 2027 anunciada. Avaliar despesas de deslocação e cachet.",status:"edition_announced"}
 ];
 function existingNames({contacts=[],actions=[],bookings=[]}={}){
  const names=new Set();
  for(const c of contacts)if(c?.name)names.add(norm(c.name));
  for(const a of actions)if(a?.name)names.add(norm(a.name));
  for(const b of bookings)for(const value of [b.contact_name,b.subject]){
   if(value)names.add(norm(value));
  }
  return names;
 }
 function present(name,existing){
  const n=norm(name);if(!n)return true;
  for(const known of existing){
   if(known===n)return true;
   // Only compare partial names for substantial strings; avoid generic "rock".
   if(n.length>=10&&known.length>=10&&(n.includes(known)||known.includes(n)))return true;
  }
  return false;
 }
 function discover({contacts=[],actions=[],bookings=[],external=[],year=2027,artist="WILDCHAINS"}={}){
  const existing=existingNames({contacts,actions,bookings});
  const seen=new Set();
  const filter=(candidate)=>{
   const name=String(candidate.name||candidate.title||"").trim();
   if(!name||present(name,existing)||seen.has(norm(name)))return false;
   seen.add(norm(name));return true;
  };
  const curated=official.filter(x=>x.artist===artist&&x.year===year&&filter(x))
   .map(x=>({...x,source:"Página oficial / bilheteira",external:true,unverifiedForBooking:true}));
  const leads=[];
  for(const x of external){
   if(!x||x.status!=="lead_unverified"||!/^https:\/\//.test(x.url||""))continue;
   const title=String(x.title||"").trim();
   if(!/festival|blues|rock|metal|showcase|fest /i.test(title))continue;
   if(/rock in rio|nos alive|primavera sound|edp cool jazz/i.test(title))continue;
   if(!filter({name:title}))continue;
   leads.push({name:title,artist,type:"festival",city:"",
    page:x.url,source:x.source_host||"Pesquisa externa",
    status:"unverified_lead",external:true,unverifiedForBooking:true,
    basis:"Resultado de pesquisa externo · o nome do festival, a edição, a programação e o contacto ainda requerem verificação.",
    detail:x.description||""});
   if(leads.length>=15)break;
  }
  return {curated,leads,filteredExisting:existing.size,
   status:external.length?"search_results_require_verification":"official_candidates_only"};
 }
 root.CaravelaBookingRadar=Object.freeze({discover,existingNames,present});
})(typeof globalThis!=="undefined"?globalThis:null);
