import {test} from "node:test";
import assert from "node:assert/strict";
import {handleFestivalSearch} from "../control-festival-search.js";
const base="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev/api/control/radar/festivals";
test("external festival search is explicit and rejects invalid query",async()=>{
 const request=new Request(base+"?year=2027&artist=Other");
 const response=await handleFestivalSearch(request,{},new URL(request.url));
 assert.equal(response.status,400);
 assert.equal((await response.json()).error,"invalid_search");
});
test("unconfigured external provider fails closed rather than pretending web search happened",async()=>{
 const request=new Request(base+"?year=2027&artist=WILDCHAINS");
 const response=await handleFestivalSearch(request,{},new URL(request.url));
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,"search_provider_not_configured");
});
test("festival discovery endpoint never accepts an outward send or mutation",async()=>{
 const request=new Request(base+"?year=2027&artist=WILDCHAINS",{method:"POST"});
 const response=await handleFestivalSearch(request,{},new URL(request.url));
 assert.equal(response.status,405);
});


test("readiness endpoint checks provider secret without performing a paid query",async()=>{
 const address=new URL(base+"?status=1");
 const missing=await handleFestivalSearch(new Request(address),{},address);
 assert.equal((await missing.json()).configured,false);
 const ready=await handleFestivalSearch(new Request(address),{CONTROL_BRAVE_SEARCH_API_KEY:"test-key"},address);
 const data=await ready.json();
 assert.equal(data.configured,true);
 assert.equal(data.requests_per_search,3);
 assert.equal(data.operations,"read_only");
});
test("external territory is validated, not passed as arbitrary web search parameter",async()=>{
 const address=new URL(base+"?year=2027&artist=WILDCHAINS&territory=XX");
 const response=await handleFestivalSearch(new Request(address),{},address);
 assert.equal(response.status,400);
 assert.equal((await response.json()).error,"invalid_search");
});
test("successful provider with empty festival matches returns honest empty result",async()=>{
 const url=new URL(base+"?year=2027&artist=WILDCHAINS&territory=ES");
 const original=globalThis.fetch;
 let n=0;
 globalThis.fetch=async input=>{
  n++;
  const u=new URL(input);
  assert.equal(u.searchParams.get("country"),"es");
  assert.equal(u.searchParams.get("search_lang"),"es");
  return Response.json({web:{results:[]}});
 };
 try{
  const response=await handleFestivalSearch(new Request(url),
   {CONTROL_BRAVE_SEARCH_API_KEY:"test-key"},url);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.ok,true);
  assert.equal(body.items.length,0);
  assert.equal(body.queries_succeeded,3);
  assert.equal(n,3);
 }finally{globalThis.fetch=original}
});
