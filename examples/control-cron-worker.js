/* Caravela Control automation — SEPARATE Cloudflare Worker, Preview only.
 * Never attach these credentials to Pages Production or commit them to GitHub.
 * Cloudflare Access still protects Preview; Service Auth policy is mandatory.
 * No public HTTP actions, no emails sent. */
const PREVIEW="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const ENDPOINT=PREVIEW+"/api/control/";
const CRON="*/10 * * * *";
function assertConfigured(env){
  if(typeof env.CONTROL_CRON_TOKEN!=="string"||env.CONTROL_CRON_TOKEN.length<43||
    typeof env.CF_ACCESS_CLIENT_ID!=="string"||!env.CF_ACCESS_CLIENT_ID||
    typeof env.CF_ACCESS_CLIENT_SECRET!=="string"||!env.CF_ACCESS_CLIENT_SECRET)
    throw Error("caravela_scheduler_credentials_missing");
}
function validResponse(body,provider){
  return body&&body.ok===true&&body.provider===provider&&body.read_only===true;
}
export async function triggerReadOnlySync(provider,env,fetcher=fetch){
  if(!["zoho","sheets"].includes(provider))throw Error("invalid_source");
  assertConfigured(env);
  let response;
  try{
    response=await fetcher(ENDPOINT+provider+"/sync",{
      method:"POST",redirect:"manual",signal:AbortSignal.timeout(25000),
      headers:{
        "Authorization":"Bearer "+env.CONTROL_CRON_TOKEN,
        "CF-Access-Client-Id":env.CF_ACCESS_CLIENT_ID,
        "CF-Access-Client-Secret":env.CF_ACCESS_CLIENT_SECRET,
        "Origin":PREVIEW,"Accept":"application/json",
        "X-Caravela-Request":"1"
      }
    });
  }catch(error){
    // Only fixed diagnostic categories. Never log request headers or raw errors.
    const message=String(error?.message||"");
    const category=message.includes("1042")?"cloudflare_1042":
      message.includes("1021")?"cloudflare_1021":
      message.includes("1024")?"cloudflare_1024":
      /redirect/i.test(message)?"redirect_exception":
      /abort|timeout/i.test(message)||error?.name==="TimeoutError"?"timeout":
      error?.name==="TypeError"?"type_error":"other_exception";
    throw Error(provider+"_transport_"+category);
  }
  // A Cloudflare Access login page can return HTML 200. Never treat that as success.
  // Do not follow redirects or send credentials to another hostname.
  if(response.status>=300&&response.status<400)
    throw Error(provider+"_redirect_http_"+response.status);
  const type=response.headers.get("Content-Type")||"";
  let body=null;
  if(type.includes("application/json"))body=await response.json().catch(()=>null);
  if(provider==="sheets"&&response.status===409&&
     body?.error==="sheets_credentials_required")
    return {provider,outcome:"configuration_pending"};
  if(response.status===409&&body?.error==="sync_in_progress")
    return {provider,outcome:"already_running"};
  if(!response.ok||!validResponse(body,provider)){
    const status=String(response.status||"unknown");
    // Only stable, preselected diagnostic codes; never print credentials or provider payload.
    const reason=body?.error;
    const safeReasons=new Set(["unauthorized","invalid_origin","not_found",
      "zoho_sync_failed","sheets_sync_failed","configuration_required",
      "migration_required","vault_error"]);
    if(!type.includes("application/json"))
      throw Error(provider+"_non_json_http_"+status);
    throw Error(provider+"_sync_http_"+status+
      (safeReasons.has(reason)?"_"+reason:""));
  }
  return {provider,outcome:"complete",new_records:body.new_records??body.changed_sources?.length??0};
}
export async function runControlAutomation(controller,env,fetcher=fetch){
  assertConfigured(env);
  const expected=Number.isFinite(controller?.scheduledTime)
    ?controller.scheduledTime:Date.now();
  if(controller?.cron&&controller.cron!==CRON)throw Error("unexpected_cron");
  // Every 10 minutes: Zoho. Every 30 minutes: Google Sheets.
  const minute=new Date(expected).getUTCMinutes();
  const providers=minute%30===0?["zoho","sheets"]:["zoho"];
  const results=await Promise.allSettled(providers.map(provider=>
    triggerReadOnlySync(provider,env,fetcher)));
  const failed=results.map((result,index)=>{
    if(result.status!=="rejected")return null;
    const code=String(result.reason?.message||"");
    // Expose only a known diagnostic shape, never raw exception text.
    const safe=/^(zoho|sheets)_(transport_(?:cloudflare_1042|cloudflare_1021|cloudflare_1024|redirect_exception|timeout|type_error|other_exception)|redirect_http_3[0-9]{2}|non_json_http_[1-5][0-9]{2}|sync_http_[1-5][0-9]{2}(?:_(?:unauthorized|invalid_origin|not_found|zoho_sync_failed|sheets_sync_failed|configuration_required|migration_required|vault_error))?)$/;
    return providers[index]+":"+(safe.test(code)?code:"failed");
  }).filter(Boolean);
  if(failed.length)throw Error("caravela_scheduler_sync_failed_"+failed.join("_"));
  return results.map(result=>result.value);
}
export default {
  async fetch(){
    // No debug or manual run endpoint; Cron only.
    return new Response("Not found",{status:404});
  },
  async scheduled(controller,env,ctx){
    ctx.waitUntil(runControlAutomation(controller,env));
  }
};
