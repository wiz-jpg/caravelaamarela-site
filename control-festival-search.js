/* Preview-only festival search. Requires BRAVE_SEARCH_API_KEY secret.
 * No scraping and no search provider data retained. Public source references only.
 * Search results are leads, NOT verified festival identities or open calls. */
export async function handleFestivalSearch(request,env,url){
 const fail=(error,status=400)=>Response.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}});
 if(request.method!=="GET")return fail("method_not_allowed",405);
 const year=Number(url.searchParams.get("year")||2027);
 const artist=url.searchParams.get("artist")||"WILDCHAINS";
 if(!Number.isInteger(year)||year<2026||year>2031||
   !["WILDCHAINS","Devil of a Woman"].includes(artist))return fail("invalid_search",400);
 const secret=env.CONTROL_BRAVE_SEARCH_API_KEY||env.BRAVE_SEARCH_API_KEY;
 if(!secret)return fail("search_provider_not_configured",503);
 const genre=artist==="WILDCHAINS"?
  ['"festival rock" bandas Portugal','"festival hard rock" Portugal','"festival rock alternativo" Portugal']:
  ['"festival blues" Portugal bandas','"festival blues rock" Portugal','"festival roots" Portugal concertos'];
 const tasks=genre.map(async query=>{
  const target=new URL("https://api.search.brave.com/res/v1/web/search");
  target.searchParams.set("q",query+" "+year+" site:pt");
  target.searchParams.set("count","12");
  target.searchParams.set("country","pt");
  target.searchParams.set("search_lang","pt");
  target.searchParams.set("safesearch","strict");
  const res=await fetch(target,{headers:{"X-Subscription-Token":secret,
   "Accept":"application/json"},signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw Error("provider_unavailable");
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
    year,genre_query:query,artist,
    status:"lead_unverified",official:false};
  }).filter(Boolean);
 });
 const batches=await Promise.allSettled(tasks);
 const successes=batches.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
 if(!successes.length)return fail("search_provider_unavailable",502);
 const distinct=new Map();
 for(const item of successes)if(!distinct.has(item.url))distinct.set(item.url,item);
 return Response.json({ok:true,year,artist,checked_at:new Date().toISOString(),
  status:"search_results_require_verification",source:"Brave Search API",
  items:[...distinct.values()].slice(0,24)},{
  headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
 });
}
