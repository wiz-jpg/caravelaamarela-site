/* Editorial reach and source-verified district hints for press only.
 * Historic locations preserved; directory projections do not write records. */
(function(root){"use strict";
 const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
   .replace(/[^a-z0-9]+/g," ").trim();
 const culture=new Set(["musicfest","musicfest pt","blitz","revista blitz",
  "arte e cultura","comunidade cultura e arte","comunidade de cultura e arte",
  "antena 3","arte sonora"]);
 // Source: [UPDATED] Media List (Google Drive), PT press/radio lists,
 // reviewed on 2026-10-17; only exact distinct publication names.
 const portugueseCatalogue=new Set([
 "1054 cascais",
 "a musica portuguesa",
 "alfinete fanzine",
 "algumas ideias soltas ponto",
 "all stars radio",
 "alta tensao rtp",
 "altamont",
 "alvor fm",
 "amalia",
 "amp webzine",
 "antena 1",
 "antena 3",
 "antena mais radio",
 "antena minho",
 "arte 351",
 "arte factos",
 "arte sonora",
 "azul ericeira mag",
 "backstage pt",
 "barcelos popular",
 "batida fm",
 "billboard tuga",
 "blogue do minho",
 "bomdia eu",
 "braga cultura",
 "braga tv",
 "brigantia",
 "brigantina",
 "caio indica",
 "cardapio",
 "casa das musicas",
 "cascais garage 159",
 "catedral do rock",
 "cister fm",
 "comunidade cultura e arte",
 "confraria do rock tuga",
 "contrabanda",
 "correio do minho",
 "cronica eletronica",
 "cultura em peso",
 "cvlto pt",
 "daniela santos",
 "diario de noticias",
 "diario do minho",
 "discos perdidos",
 "douro nacional",
 "e cultura pt",
 "echo boomer",
 "el coyote",
 "em busca do heavy rock perdido",
 "em busca do rock perdido",
 "engenharia radio",
 "ensaio artes cultura",
 "esradio",
 "eurovision by truta",
 "evasoes",
 "ever metal",
 "fama radio",
 "flagra",
 "flua portugual",
 "gerador",
 "glam magazine",
 "global news pt",
 "gramofone",
 "gritos nocturnos",
 "guia da cidade",
 "headbangers radio online",
 "headliner",
 "hedflow",
 "hellheaven",
 "hits of 80 and 90",
 "indie tuga",
 "indiesciplina",
 "ipsilon",
 "irreversivel",
 "jornal de noticias",
 "jornal mais semanario",
 "jornal primeiro minuto",
 "jornal referencia",
 "jornalismo porto net",
 "jose carlos fernandes",
 "laughbanging",
 "linha da noticia",
 "look mag",
 "lorezine",
 "loud portugal",
 "made in portugal musica",
 "mais musica",
 "manifesto suburbano",
 "marginal",
 "meloteca",
 "mentecultural",
 "mesa de mistura",
 "metal global",
 "metal hammer portugal",
 "metal imperium",
 "metal junkbox",
 "mortifera mag",
 "motard fm",
 "movimento rota sonora",
 "music fest",
 "musica com pt",
 "musica sem capa",
 "musituga",
 "mutante radio",
 "my sound",
 "nacao sonica",
 "noite e musica magazine",
 "novum canal",
 "o amarense",
 "o cidadao",
 "o gaiense",
 "o minho",
 "o povo famalicense",
 "o vila verdense",
 "observador",
 "opiniao publica",
 "orbital",
 "os garotos de liverpool",
 "palco principal",
 "pecado sonoro",
 "pedra de metal",
 "peso bruto",
 "plasmodium",
 "playback",
 "playsify",
 "popular fm",
 "porta 253",
 "portal do rock",
 "portal musica portuguesa",
 "portugal fm",
 "portugal rebelde",
 "portuguese music info",
 "press minho",
 "press musica",
 "press point",
 "pressmedia",
 "prova oral",
 "punktuganews",
 "que amor e este",
 "quinta avenida",
 "radar lisboa",
 "radio agita",
 "radio alta tensao",
 "radio alto ave",
 "radio alto minho",
 "radio atlantida",
 "radio b",
 "radio baixa",
 "radio barcelos",
 "radio bobadela",
 "radio brigantina",
 "radio cavado",
 "radio caxinas",
 "radio cidade hoje",
 "radio clube da feira",
 "radio clube de monsanto",
 "radio escola superior da educacao ipp",
 "radio foz do mondego",
 "radio hertz",
 "radio linear",
 "radio lisboa",
 "radio movimento",
 "radio music portugal",
 "radio nova oeste",
 "radio nove3cinco",
 "radio olisipo",
 "radio onda viva",
 "radio ophelia",
 "radio pa news",
 "radio portuense",
 "radio promove portugal",
 "radio pt",
 "radio quantica",
 "radio radar",
 "radio regiao de basto",
 "radio regional",
 "radio regional de arouca",
 "radio regional do centro",
 "radio rock fm",
 "radio salesiana",
 "radio santiago",
 "radio sesimbra fm",
 "radio suave",
 "radio urbana",
 "radio utopia",
 "radio vaivem",
 "radio valdevez",
 "radio vale do minho",
 "radio vila nova",
 "radio vilanovenses",
 "radio vizela",
 "radio voz do neiva",
 "radio xl fm",
 "radio yeye",
 "radioclube agramonte",
 "rampa radio show",
 "rarozine",
 "rdp internacional",
 "reis do rock",
 "revista minha",
 "revista rua",
 "revista sabado",
 "revista sim",
 "revista spot",
 "riffs e palcos",
 "rimas e batidas",
 "rock nation",
 "rua de baixo webzine",
 "rua fm",
 "ruido alternativo",
 "ruido constante",
 "ruido sonoro",
 "s titulo",
 "santo tirso online",
 "santos da casa blog",
 "sbsr fm",
 "sete ponto sete",
 "sinfonias",
 "sintoniza te",
 "som de portugal",
 "som direto",
 "som lusitano",
 "songsoul",
 "soundcheck",
 "super bock fm",
 "super fm",
 "templo do rock",
 "the insight",
 "threshold",
 "timeout",
 "todos musica",
 "underground rock portugal",
 "underground tuga oficial",
 "utopia plataformica",
 "via noturna",
 "vox pop music zine",
 "where the music meets",
 "whiplash",
 "wiki loves musica portuguesa",
 "ze rock porto radio"
]);
 const districtCatalogue=new Map([
 [
  "antena minho",
  "Braga"
 ],
 [
  "barcelos popular",
  "Braga"
 ],
 [
  "braga cultura",
  "Braga"
 ],
 [
  "braga tv",
  "Braga"
 ],
 [
  "correio do minho",
  "Braga"
 ],
 [
  "daniela santos",
  "Braga"
 ],
 [
  "diario do minho",
  "Braga"
 ],
 [
  "fama radio",
  "Braga"
 ],
 [
  "jose carlos fernandes",
  "Braga"
 ],
 [
  "o amarense",
  "Braga"
 ],
 [
  "o minho",
  "Braga"
 ],
 [
  "o povo famalicense",
  "Braga"
 ],
 [
  "o vila verdense",
  "Braga"
 ],
 [
  "opiniao publica",
  "Braga"
 ],
 [
  "radio barcelos",
  "Braga"
 ],
 [
  "radio cavado",
  "Braga"
 ],
 [
  "radio cidade hoje",
  "Braga"
 ],
 [
  "radio nove3cinco",
  "Braga"
 ],
 [
  "radio regiao de basto",
  "Braga"
 ],
 [
  "radio santiago",
  "Braga"
 ],
 [
  "radio suave",
  "Braga"
 ],
 [
  "radio valdevez",
  "Viana do Castelo"
 ],
 [
  "radio vizela",
  "Braga"
 ],
 [
  "radio voz do neiva",
  "Braga"
 ],
 [
  "revista minha",
  "Braga"
 ],
 [
  "revista rua",
  "Braga"
 ],
 [
  "revista sim",
  "Braga"
 ],
 [
  "revista spot",
  "Braga"
 ],
 [
  "ruido constante",
  "Braga"
 ],
 [
  "sintoniza te",
  "Braga"
 ]
]);
 function confirmedPortuguese(row){
  if(!row||row.kind&&row.kind!=="press")return false;
  return portugueseCatalogue.has(norm(row.name));
 }
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
  if(row.country&&!["portugal","pt","portuguesa","portuguese"].includes(norm(row.country))&&
   !(["por confirmar","nao identificado","desconhecido","unknown","a confirmar"].includes(norm(row.country))&&
     confirmedPortuguese(row)))return null;
  return districtCatalogue.get(norm(row.name))||known.get(norm(row.name))||null;
 }
 function source(row){return national(row)?
   {type:"culture",basis:"Âmbito editorial nacional validado"}:
   inferredDistrict(row)?{type:"district",district:inferredDistrict(row),
    basis:"Lista de imprensa Caravela · localidade verificada"}:null}
 root.CaravelaPressEditorial=Object.freeze({national,inferredDistrict,confirmedPortuguese,source});
})(typeof globalThis!=="undefined"?globalThis:null);
