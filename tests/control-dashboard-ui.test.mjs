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
 assert.match(html,/control-native-ui\.js\?v=20261017other1/);
 assert.match(html,/control-review-tasks-ui\.js\?v=20261016atomic1/);
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


test("opening a booking never silently schedules a follow-up",()=>{
 const source=get("control-native-ui.js");
 assert.match(source,/suggest\.onclick=\(\)=>/);
 assert.doesNotMatch(source,/suggestFollowup\(\)/);
 assert.match(source,/Não inventamos prazos ao abrir a ficha/);
});


test("one-window Zoho workflow uses a single human-approved operation",()=>{
 const ui=get("control-review-tasks-ui.js"),transport=get("control-vault-ui.js");
 assert.match(ui,/CaravelaMailReviewTasks\.resolveBooking\(/);
 assert.doesNotMatch(ui,/transport\.request\("booking",old\?"PATCH":"POST"/);
 assert.match(transport,/mail\/resolve-booking/);
});


test("year-based booking and opportunities dashboard assets are loaded",()=>{
 const html=get("crm-control.html"),app=get("control-app.js");
 assert.match(html,/control-booking-board\.js\?v=20261017verify2/);
 assert.match(html,/control-booking-board-ui\.js\?v=20261017agenda2/);
 assert.match(html,/control-opportunities-ui\.js\?v=20261017focus2/);
 assert.match(app,/data-view="opportunities"/);
 assert.match(app,/\["opportunities", "Oportunidades"/);
 assert.match(get("control-native-ui.js"),/cc-booking-advanced/);
});


test("editing an old booking does not automatically assign the selected year",()=>{
 const ui=get("control-native-ui.js");
 assert.match(ui,/booking_year:entry\.revision\?"":/);
 assert.match(ui,/contact_window_target:"unknown"/);
 assert.match(ui,/caravela-control-contacts-updated/);
});


test("essential dashboard, press and contact categories are loaded",()=>{
 const html=get("crm-control.html"),app=get("control-app.js");
 for(const token of ["control-home-focus-ui.js","control-press-ui.js",
   "control-opportunity-availability.js"])assert.ok(html.includes(token));
 for(const section of ["press","other-contacts"])assert.ok(app.includes('data-view="'+section+'"'));
 for(const file of ["control-home-focus-ui.js","control-press-ui.js",
   "control-opportunity-availability.js","control-opportunities-ui.js",
   "control-booking-board-ui.js"])assert.doesNotThrow(()=>new Function(get(file)),file);
});


test("automatic action review is visible on Inicio and only opens a manual proposal",()=>{
 const html=get("crm-control.html"),ui=get("control-auto-review-ui.js"),
   native=get("control-native-ui.js");
 assert.match(html,/control-auto-review\.js\?v=20261017autowork1/);
 assert.match(html,/control-auto-review-ui\.js\?v=20261017autowork1/);
 assert.match(ui,/t\.request\("archive","GET"\)/);
 assert.match(ui,/t\.request\("booking","GET"\)/);
 assert.match(ui,/caravela-auto-review-open/);
 assert.match(native,/window\.addEventListener\("caravela-auto-review-open"/);
 assert.match(native,/booking_year:""/);
 assert.doesNotMatch(ui,/sendEmail|mail\/send|stage:"sent_verified"/);
});


test("historical actions may enter proposed operational lanes without mutating deal state",()=>{
 const board=get("control-booking-board.js");
 const ui=get("control-booking-board-ui.js");
 const native=get("control-native-ui.js");
 const html=get("crm-control.html");
 assert.match(board,/Classificação sugerida a partir de AÇÕES/);
 assert.match(board,/provisional:true/);
 assert.match(ui,/Por validar/);
 assert.match(ui,/booking_year:item\.archive\?"":years\.value/);
 assert.match(native,/booking_year:d\.booking_year===undefined\?/);
 assert.match(html,/control-booking-board\.css\?v=20261017other1/);
 assert.doesNotMatch(ui,/mail\/send|status="confirmed"/);
});


test("press grouping, published agenda and one-click triage exist in the Booking UI",()=>{
 const html=get("crm-control.html"),ui=get("control-booking-board-ui.js");
 assert.match(html,/control-press-geography\.js\?v=20261017pressdistrict1/);
 assert.match(ui,/booking_reviews/);
 assert.match(ui,/reviewItem\(item,key,"confirmed"\)/);
 assert.match(ui,/reviewItem\(item,move\.value,"moved"\)/);
 assert.match(ui,/assets\/data\/agenda\.json/);
 assert.match(ui,/Promotores/);
 assert.match(get("control-press-ui.js"),/CaravelaPressGeography/);
});


test("Booking reports the public agenda years and one-click access to actual Fechados",()=>{
 const ui=get("control-booking-board-ui.js"),html=get("crm-control.html");
 assert.match(ui,/publicAgendaStatus/);
 assert.match(ui,/Agenda pública/);
 assert.match(ui,/Ver Fechados/);
 assert.match(ui,/Não foi possível ler a agenda pública/);
 assert.match(ui,/Outros registos/);
 assert.match(html,/control-booking-board-ui\.js\?v=20261017agenda2/);
});


test("press directory is collapsible by location and, for Portugal, by district; each has CSV",()=>{
 const html=get("crm-control.html"),ui=get("control-press-ui.js"),
  geo=get("control-press-geography.js"),csv=get("control-press-csv.js");
 assert.match(html,/control-press-geography\.js\?v=20261017pressdistrict1/);
 assert.match(html,/control-press-csv\.js\?v=20261017pressdistrict1/);
 assert.match(html,/control-press-ui\.js\?v=20261017other1/);
 assert.match(ui,/mk\("details",undefined,nested\?/);
 assert.match(ui,/const isPortugal=key==="portugal"/);
 assert.match(ui,/CaravelaPressGeography\?\.districtsWithin\(group\.rows\)/);
 assert.match(ui,/action\.onclick=\(\)=>\{/);
 assert.match(ui,/exportRegion\(group\)/);
 assert.match(ui,/for\(const c of group\.rows\)/);
 assert.match(csv,/CaravelaPressCsv/);
 assert.match(geo,/districtsWithin/);
 for(const asset of [ui,geo,csv])assert.doesNotThrow(()=>new Function(asset));
});


test("other contacts exclude promoters and show evidence-based specific types",()=>{
 const html=get("crm-control.html"),ui=get("control-press-ui.js"),
  classifier=get("control-other-contacts.js"),editor=get("control-native-ui.js");
 assert.match(html,/control-other-contacts\.js\?v=20261017other1/);
 assert.match(ui,/\["festival","venue","press","promoter"\]/);
 assert.match(ui,/CaravelaOtherContacts/);
 assert.match(ui,/mk\("details",undefined,"cc-other-category"\)/);
 assert.match(ui,/Identificar tipo na ficha/);
 assert.match(editor,/contact_subtype/);
 for(const code of [ui,classifier])assert.doesNotThrow(()=>new Function(code));
});
