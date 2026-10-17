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
