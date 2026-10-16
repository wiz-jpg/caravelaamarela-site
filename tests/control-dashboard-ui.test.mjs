import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const get=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");

test("all private dashboard scripts remain valid JavaScript",()=>{
 for(const file of ["control-app.js","control-native-ui.js","control-operations-ui.js",
  "control-review-tasks-ui.js","control-review-ui.js","control-contact-window.js"]){
  assert.doesNotThrow(()=>new Function(get(file)),file);
 }
});

test("the daily booking queues exclude archival claims without verified status",()=>{
 const source=get("control-native-ui.js");
 assert.match(source,/archiveFollowups=\[\],archiveLeads=\[\]/);
 assert.match(source,/if\(isFollowup\)archiveFollowups\.push\(task\);else archiveLeads\.push\(task\)/);
 assert.doesNotMatch(source,/if\(isFollowup\)followups\.push\(task\)/);
 assert.match(source,/const archive=make\("details"/);
 assert.match(source,/const visibleBuckets=buckets\.filter\(x=>x\.items\.length>0\)/);
 assert.match(source,/task\.source==="arquivo"\?"archive":bookingTone\(stage\)/);
 assert.match(source,/metrics\.hidden=true/); // Duplicate counter tiles are not shown.
});

test("critical Zoho reviews precede booking and technical health is collapsed",()=>{
 const source=get("control-review-tasks-ui.js");
 assert.match(source,/home\.querySelector\("\.cc-panel-head"\)\?\.after\(compact\)/);
 assert.match(source,/const technical=make\("details"/);
 assert.match(source,/compact\.append\(technical\)/);
 assert.match(source,/home\.querySelector\("\.cc-mail-automation-status"\)/);
});

test("action choices are named and decisions continue to be manual",()=>{
 const source=get("control-native-ui.js");
 assert.match(source,/make\("details",undefined,"cc-home-decision"\)/);
 assert.match(source,/make\("button",opt\.label/);
 assert.doesNotMatch(source,/make\("button",opt\.symbol,"cc-home-status/);
 assert.match(source,/createFastAction\(row,task,opt\.key\)/);
});

test("Preview loads cache-busted current assets and never modifies main",()=>{
 const html=get("crm-control.html");
 assert.match(html,/control-native-ui\.js\?v=20261016business1/);
 assert.match(html,/control-review-tasks-ui\.js\?v=20261016drafts1/);
 assert.match(html,/control-native\.css\?v=20261016focus1/);
 assert.match(html,/control-mail-drafts-ui\.js\?v=20261016drafts1/);
 assert.match(html,/noindex,nofollow/);
});


test("daily focus is read-only and the complete queues remain accessible",()=>{
 const html=get("crm-control.html"),source=get("control-native-ui.js");
 assert.match(html,/control-workflow-priorities\.js\?v=20261016business1/);
 assert.match(source,/selectDailyActions\(live,\{today,limit:5\}\)/);
 assert.match(source,/const allQueues=make\("details"/);
 assert.match(source,/allQueues\.append\(board\)/);
 assert.match(source,/root\.append\(focus\)/);
});

test("commercial details are explicit and do not recalculate historic cashflows",()=>{
 const source=get("control-native-ui.js");
 assert.match(source,/Cachet registado \(base por confirmar\)/);
 assert.match(source,/r\.fee_basis==="artist_base"/);
 assert.match(source,/Condições excecionais/);
 assert.match(source,/Faturação individual prevista/);
});
