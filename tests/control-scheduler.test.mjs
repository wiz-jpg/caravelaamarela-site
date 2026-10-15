import {test} from "node:test";
import assert from "node:assert/strict";
import {runControlAutomation,triggerReadOnlySync} from "../examples/control-cron-worker.js";
const token="cron-"+"z".repeat(48);
const creds={CONTROL_CRON_TOKEN:token,CF_ACCESS_CLIENT_ID:"id.example.access",CF_ACCESS_CLIENT_SECRET:"secret-not-for-users"};
const expectedOrigin="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const json=(provider,props={})=>Response.json({ok:true,provider,read_only:true,new_records:2,...props});
test("15-minute Cron polls only Zoho, headers use Access service token",async()=>{
  const calls=[];
  const fake=async(url,options)=>{
    calls.push({url,options});
    return json("zoho");
  };
  const result=await runControlAutomation({cron:"*/15 * * * *",
    scheduledTime:Date.parse("2026-10-13T10:15:00Z")},creds,fake);
  assert.deepEqual(result.map(x=>x.provider),["zoho"]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.method,"POST");
  assert.equal(calls[0].options.headers.Authorization,"Bearer "+token);
  assert.equal(calls[0].options.headers["CF-Access-Client-Id"],creds.CF_ACCESS_CLIENT_ID);
  assert.equal(calls[0].options.headers["CF-Access-Client-Secret"],creds.CF_ACCESS_CLIENT_SECRET);
  assert.equal(calls[0].options.headers.Origin,expectedOrigin);
  assert.equal(calls[0].options.redirect,"error");
});
test("on the half-hour both Zoho and Sheets run without one blocking the other",async()=>{
  const calls=[];
  const fake=async(url)=>{
    const provider=url.endsWith("/zoho/sync")?"zoho":"sheets";
    calls.push(provider);
    return json(provider);
  };
  const result=await runControlAutomation({cron:"*/15 * * * *",
    scheduledTime:Date.parse("2026-10-13T10:30:00Z")},creds,fake);
  assert.deepEqual(new Set(calls),new Set(["zoho","sheets"]));
  assert.equal(result.every(x=>x.outcome==="complete"),true);
});
test("redirect / HTML Access login never counts as a successful cron run",async()=>{
  const html=async()=>new Response("<html>Log in</html>",{status:200,headers:{"Content-Type":"text/html"}});
  await assert.rejects(()=>triggerReadOnlySync("zoho",creds,html),/zoho_sync_http_200/);
});
test("only an explicit Sheets configuration error is skipped",async()=>{
  const missing=async()=>Response.json({ok:false,error:"sheets_credentials_required"},{status:409});
  assert.equal((await triggerReadOnlySync("sheets",creds,missing)).outcome,"configuration_pending");
  const bad=async()=>Response.json({ok:false,error:"unknown"},{status:409});
  await assert.rejects(()=>triggerReadOnlySync("sheets",creds,bad),/sheets_sync_http_409/);
});
test("scheduler refuses missing secrets, unrecognized crons and HTTP public operations",async()=>{
  await assert.rejects(()=>runControlAutomation({cron:"*/15 * * * *",
    scheduledTime:Date.parse("2026-10-13T10:15:00Z")},{CONTROL_CRON_TOKEN:token}),
    /credentials_missing/);
  await assert.rejects(()=>runControlAutomation({cron:"* * * * *",
    scheduledTime:Date.parse("2026-10-13T10:15:00Z")},creds),/unexpected_cron/);
  const mod=await import("../examples/control-cron-worker.js");
  assert.equal((await mod.default.fetch()).status,404);
});

test("scheduler reports safe HTTP error categories without leaking upstream responses",async()=>{
  const forbidden=async()=>new Response("<html>Access denied</html>",{
    status:403,headers:{"Content-Type":"text/html"}
  });
  await assert.rejects(
    ()=>runControlAutomation({cron:"*/15 * * * *",
      scheduledTime:Date.parse("2026-10-13T10:15:00Z")},creds,forbidden),
    /caravela_scheduler_sync_failed_zoho:zoho_non_json_http_403/
  );
  const unauthorized=async()=>Response.json({ok:false,error:"unauthorized"},{status:401});
  await assert.rejects(
    ()=>runControlAutomation({cron:"*/15 * * * *",
      scheduledTime:Date.parse("2026-10-13T10:15:00Z")},creds,unauthorized),
    /caravela_scheduler_sync_failed_zoho:zoho_sync_http_401_unauthorized/
  );
  const privateBody=async()=>Response.json({ok:false,error:"secret-do-not-echo"},{status:503});
  await assert.rejects(
    ()=>runControlAutomation({cron:"*/15 * * * *",
      scheduledTime:Date.parse("2026-10-13T10:15:00Z")},creds,privateBody),
    error=>error.message==="caravela_scheduler_sync_failed_zoho:zoho_sync_http_503"
  );
});
