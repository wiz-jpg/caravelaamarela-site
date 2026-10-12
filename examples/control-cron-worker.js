// DEPLOY SEPARATELY as a Cloudflare Worker with Cron Trigger. NOT a Pages Function.
// Required secret: CONTROL_CRON_TOKEN (different from Zoho admin and OAuth tokens).
// Target API accepts this token ONLY for read-only /zoho/sync and /sheets/sync.
const PREVIEW="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
export default {
  async scheduled(_controller,env,ctx) {
    ctx.waitUntil((async()=>{
      if(!env.CONTROL_CRON_TOKEN||env.CONTROL_CRON_TOKEN.length<43)
        throw new Error("cron_secret_missing");
      for(const route of ["zoho/sync","sheets/sync"]){
        const response=await fetch(PREVIEW+"/api/control/"+route,{
          method:"POST",redirect:"error",signal:AbortSignal.timeout(25000),
          headers:{Authorization:"Bearer "+env.CONTROL_CRON_TOKEN}
        });
        // A not-configured Sheets source does not prevent Zoho indexing.
        if(route==="sheets/sync"&&response.status===409)continue;
        if(!response.ok)throw new Error(route+"_failed_"+response.status);
      }
    })());
  }
};