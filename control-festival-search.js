/* Authenticated, read-only external festival search for Caravela Preview.
 * Search API secret is stored server-side. Three bounded queries per click. */
export async function handleFestivalSearch(request,env,url){
 const respond=(data,status=200)=>Response.json(data,{status,
   headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 if(request.method!=="GET")return respond({ok:false,error:"method_not_allowed"},405);
 const secret=env.CONTROL_BRAVE_SEARCH_API_KEY||env.BRAVE_SEARCH_API_KEY;
 if(url.searchParams.get("status")==="1")
  return respond({ok:true,configured:!!secret,provider:"Brave Search API",
   operations:"read_only",requests_per_search:3});
 const year=Number(url.searchParams.get("year")||2027);
 const artist=url.searchParams.get("artist")||"WILDCHAINS";
 const territory=url.searchParams.get("territory")||"PT";
 if(!Number.isInteger(year)||year<2026||year>2031||
   !["WILDCHAINS","Devil of a Woman"].includes(artist)||
   !["PT","ES","FR"].includes(territory))
  return respond({ok:false,error:"invalid_search"},400);
 if(!secret)return respond({ok:false,error:"search_provider_not_configured"},503);
 const loc={PT:["Portugal","pt","pt"],ES:["España","es","es"],
  FR:["France","fr","fr"]}[territory];
 const queries=artist==="WILDCHAINS"?
  ["festival rock hard rock bandas "+loc[0]+" "+year,
   "festival rock alternativo grupos emergentes "+loc[0]+" "+year,
   "festival metal rock oportunidades artistas "+loc[0]+" "+year]:
  ["festival blues soul bands "+loc[0]+" "+year,
   "festival blues rock roots "+loc[0]+" "+year,
   "festival blues grupos emergentes "+loc[0]+" "+year];
 const tasks=queries.map(async q=>{
  const target=new URL("https://api.search.brave.com/res/v1/web/search");
  target.searchParams.set("q",q);
  target.searchParams.set("count","12");
  target.searchParams.set("country",loc[1]);
  target.searchParams.set("search_lang",loc[2]);
  target.searchParams.set("safesearch","strict");
  const res=await fetch(target,{headers:{
   "X-Subscription-Token":secret,"Accept":"application/json"
  },signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw Error("search_provider_http_"+res.status);
  const data=await res.json();
  const web=Array.isArray(data?.web?.results)?data.web.results:[];
  return web.map(item=>{
   const link=String(item.url||"");
   if(!/^https:\/\/[a-z0-9.-]+\//i.test(link)||link.length>700)return null;
   const title=String(item.title||"").replace(/<[^>]+>/g," ").slice(0,170);
   const description=String(item.description||"").replace(/<[^>]+>/g," ").slice(0,350);
   if(!/festival|fest|blues|rock|metal|showcase/i.test(title+" "+description))return null;
   if(/rock in rio|nos alive|primavera sound|edp cool jazz/i.test(title))return null;
   return {title,description,url:link,source_host:new URL(link).hostname,
    year,territory,genre_query:q,artist,status:"lead_unverified",official:false};
  }).filter(Boolean);
 });
 const results=await Promise.allSettled(tasks);
 const successes=results.filter(x=>x.status==="fulfilled");
 if(!successes.length)
  return respond({ok:false,error:"search_provider_unavailable"},502);
 const unique=new Map();
 for(const item of successes.flatMap(x=>x.value))if(!unique.has(item.url))unique.set(item.url,item);
 return respond({ok:true,year,artist,territory,checked_at:new Date().toISOString(),
  status:"search_results_require_verification",source:"Brave Search API",
  queries_succeeded:successes.length,queries_requested:queries.length,
  items:[...unique.values()].slice(0,24)});
}
