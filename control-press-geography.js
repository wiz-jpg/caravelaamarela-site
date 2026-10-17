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
  const country=norm(row?.country);
  if(country&&!portugal.has(country))return {key:"country:"+country,label:String(row.country).trim()};
  const place=district(row);
  if(place)return {key:"district:"+norm(place),label:place};
  return {key:"unknown",label:country&&portugal.has(country)?"Distrito por confirmar":"Localização por confirmar"};
 }
 function group(rows){
  const by=new Map();
  for(const row of rows){const g=region(row);
   if(!by.has(g.key))by.set(g.key,{...g,rows:[]});
   by.get(g.key).rows.push(row);
  }
  const order=x=>x.key.startsWith("district:")?0:x.key.startsWith("country:")?1:2;
  return [...by.values()].sort((a,b)=>order(a)-order(b)||
    a.label.localeCompare(b.label,"pt-PT")).map(g=>({...g,
    rows:g.rows.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-PT"))}));
 }

 const districtOrder=["Aveiro","Beja","Bragança","Castelo Branco","Coimbra",
  "Évora","Faro","Guarda","Leiria","Lisboa","Portalegre","Santarém",
  "Setúbal","Viana do Castelo","Vila Real","Viseu","Açores","Madeira"];
 const districts=new Map(districtOrder.map(x=>[norm(x),x]));
 const municipalities={
  "Aveiro":["aveiro","agueda","águeda","albergaria a velha","anadia","arouca",
   "castelo de paiva","espinho","estarreja","ilhavo","ílhavo","mealhada","murtosa",
   "oliveira de azemeis","oliveira de azeméis","oliveira do bairro","ovar",
   "santa maria da feira","sao joao da madeira","são joão da madeira",
   "sever do vouga","vagos","vale de cambra"],
  "Beja":["beja","aljustrel","almodovar","almodôvar","alvito","barrancos",
   "castro verde","cuba","ferreira do alentejo","mertola","mértola",
   "moura","odemira","ourique","serpa","vidigueira"],
  "Bragança":["braganca","bragança","alfandega da fe","alfândega da fé",
   "carrazeda de ansiaes","freixo de espada a cinta","macedo de cavaleiros",
   "miranda do douro","mirandela","mogadouro","torre de moncorvo",
   "vila flor","vimioso","vinhais"],
  "Castelo Branco":["castelo branco","belmonte","covilha","covilhã",
   "fundao","fundão","idanha a nova","oleiros","penamacor","proenca a nova",
   "serta","sertã","vila de rei","vila velha de rodao"],
  "Coimbra":["coimbra","arganil","cantanhede","condeixa a nova","figueira da foz",
   "gois","góis","lousa","lousã","mira","miranda do corvo","montemor o velho",
   "oliveira do hospital","pampilhosa da serra","penacova","penela",
   "soure","tabua","tábua","vila nova de poiares"],
  "Évora":["evora","évora","alandroal","arraiolos","borba","estremoz",
   "montemor o novo","mora","mourao","mourão","portel","redondo",
   "reguengos de monsaraz","vendas novas","viana do alentejo","vila vicosa"],
  "Faro":["faro","albufeira","alcoutim","aljezur","castro marim",
   "lagoa","lagos","loule","loulé","monchique","olhao","olhão","portimao",
   "portimão","sao bras de alportel","são brás de alportel","silves",
   "tavira","vila do bispo","vila real de santo antonio"],
  "Guarda":["guarda","aguiar da beira","almeida","celorico da beira",
   "figueira de castelo rodrigo","fornos de algodres","gouveia",
   "manteigas","meda","mêda","pinhel","sabugal","seia","trancoso",
   "vila nova de foz coa","vila nova de foz côa"],
  "Leiria":["leiria","alcobaca","alcobaça","alvaiazere","alvaiázere",
   "ansiao","ansião","batalha","bombarral","caldas da rainha",
   "castanheira de pera","figueiro dos vinhos","marinha grande",
   "nazare","nazaré","obidos","óbidos","pedrogao grande",
   "peniche","pombal","porto de mos"],
  "Lisboa":["lisboa","amadora","alcanena lisboa","arruda dos vinhos",
   "azambuja","cascais","cadaval","loures","lourinha","lourinhã",
   "mafra","odivelas","oeiras","sintra","sobral de monte agraco",
   "torres vedras","vila franca de xira"],
  "Portalegre":["portalegre","alter do chao","alter do chão","arronches",
   "avis","campo maior","castelo de vide","crato","elvas","fronteira",
   "gaviao","gavião","marvao","marvão","monforte","nisa",
   "ponte de sor","sousel"],
  "Santarém":["santarem","santarém","abrantes","alcanena","almeirim",
   "alpiarca","benavente","cartaxo","chamusca","constancia","constância",
   "coruche","entroncamento","ferreira do zezere","ferreira do zêzere",
   "golega","golegã","mação","ourém","rio maior","salvaterra de magos",
   "sardoal","tomar","torres novas","vila nova da barquinha"],
  "Setúbal":["setubal","setúbal","alcacer do sal","alcácer do sal",
   "alcochete","almada","barreiro","grândola","grandola","moita","montijo",
   "palmela","santiago do cacem","santiago do cacém","seixal","sesimbra",
   "sines"],
  "Viana do Castelo":["viana do castelo","arcos de valdevez","caminha",
   "melgaco","melgaço","moncao","monção","paredes de coura",
   "ponte da barca","ponte de lima","valenca","valença","vila nova de cerveira"],
  "Vila Real":["vila real","alijo","alijó","boticas","chaves",
   "mesao frio","mesão frio","mondim de basto","montalegre","murca",
   "murça","peso da regua","peso da régua","ribeira de pena",
   "sabrosa","santa marta de penaguiao","valpacos","valpaços",
   "vila pouca de aguiar"],
  "Viseu":["viseu","armamar","carregal do sal","castro daire","cinfaes",
   "cinfães","lamego","mangualde","moimenta da beira","mortagua",
   "mortágua","nelas","oliveira de frades","penalva do castelo",
   "penedono","resende","santa comba dao","santa comba dão",
   "sao joao da pesqueira","são joão da pesqueira","sao pedro do sul",
   "são pedro do sul","satao","sátão","sernancelhe","tabuaco",
   "tabuaço","tarouca","tondela","vila nova de paiva","vouzela"]
 };
 const cityDistrict=new Map();
 for(const [name,cities] of Object.entries(municipalities)){
  for(const city of cities){const key=norm(city);
   if(!cityDistrict.has(key))cityDistrict.set(key,name)}
 }
 function district(row){
  const country=norm(row?.country),r=norm(row?.region),city=norm(row?.city);
  if(country&&!portugal.has(country))return null;
  if(["acores","açores","regiao autonoma dos acores"].includes(r))return "Açores";
  if(["madeira","regiao autonoma da madeira"].includes(r))return "Madeira";
  if(braga.has(city)||r==="braga")return "Braga";
  if(porto.has(city)||r==="porto")return "Porto";
  if(districts.has(r))return districts.get(r);
  return cityDistrict.get(city)||null;
 }
 function districtsWithin(rows){
  const groups=new Map();
  for(const row of rows){
   const label=district(row)||"Distrito por confirmar";
   const key=label==="Distrito por confirmar"?"unknown":"district:"+norm(label);
   if(!groups.has(key))groups.set(key,{key,label,rows:[]});
   groups.get(key).rows.push(row);
  }
  return [...groups.values()].sort((a,b)=>
   Number(a.key==="unknown")-Number(b.key==="unknown")||
   a.label.localeCompare(b.label,"pt-PT")).map(g=>({...g,
   rows:g.rows.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pt-PT"))}));
 }

 root.CaravelaPressGeography=Object.freeze({region,group,district,districtsWithin});
})(typeof globalThis!=="undefined"?globalThis:null);
