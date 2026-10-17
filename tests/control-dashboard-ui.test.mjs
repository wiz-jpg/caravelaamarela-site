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
 assert.match(html,/control-native-ui\.js\?v=20261017workflow3/);
 assert.match(html,/control-review-tasks-ui\.js\?v=20261016atomic1/);
 assert.match(html,/control-native\.css\?v=20261016focus1/);
 assert.match(html,/control-mail-drafts-ui\.js\?v=20261017workflow3/);
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
 assert.match(html,/control-booking-board\.js\?v=20261017closed3/);
 assert.match(html,/control-booking-board-ui\.js\?v=20261017workflow3/);
 assert.match(html,/control-opportunities-ui\.js\?v=20261017workflow3/);
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
 assert.match(html,/control-auto-review-ui\.js\?v=20261017workflow3/);
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
 assert.match(html,/control-booking-board\.css\?v=20261017workflow3/);
 assert.doesNotMatch(ui,/mail\/send|status="confirmed"/);
});


test("press grouping, published agenda and one-click triage exist in the Booking UI",()=>{
 const html=get("crm-control.html"),ui=get("control-booking-board-ui.js");
 assert.match(html,/control-press-geography\.js\?v=20261017workflow3/);
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
 assert.match(ui,/Concertos já realizados/);
 assert.match(ui,/Não foi possível ler a agenda pública/);
 assert.match(ui,/Outros registos/);
 assert.match(html,/control-booking-board-ui\.js\?v=20261017workflow3/);
});


test("press directory is collapsible by location and, for Portugal, by district; each has CSV",()=>{
 const html=get("crm-control.html"),ui=get("control-press-ui.js"),
  geo=get("control-press-geography.js"),csv=get("control-press-csv.js");
 assert.match(html,/control-press-geography\.js\?v=20261017workflow3/);
 assert.match(html,/control-press-csv\.js\?v=20261017pressscope2/);
 assert.match(html,/control-press-ui\.js\?v=20261017pressscope2/);
 assert.match(ui,/mk\("details",undefined,nested\?/);
 assert.doesNotMatch(ui,/const isPortugal=key==="portugal"/);
 assert.doesNotMatch(ui,/if\(isPortugal\)/);
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


test("removing a native Other contact requires confirmation, verified server tombstone, and cross-view refresh",()=>{
 const html=get("crm-control.html"),ui=get("control-press-ui.js"),
  native=get("control-native-ui.js"),app=get("control-app.js");
 assert.match(html,/control-press-ui\.js\?v=20261017pressscope2/);
 assert.match(html,/control-app\.js\?v=20261017workflow3/);
 assert.match(ui,/async function removeNativeContact\(c\)/);
 assert.match(ui,/!c\?\.revision\|\|c\.origin_id\|\|c\.historical/);
 assert.match(ui,/window\.confirm\(/);
 assert.match(ui,/t\.request\("contacts","DELETE",\{id:c\.id,revision:c\.revision\}\)/);
 assert.match(ui,/t\.request\("contacts","GET"\)/);
 assert.match(ui,/current\.records\.some\(x=>x\.id===c\.id\)/);
 assert.match(ui,/caravela-control-contacts-updated/);
 assert.match(ui,/pendingReload/);
 assert.match(native,/removed_id:r\.id/);
 assert.match(native,/window\.addEventListener\("caravela-control-contacts-updated"/);
 assert.doesNotMatch(app,/Promotores, parceiros e entidades sem duplicar fichas/);
 for(const code of [ui,native])assert.doesNotThrow(()=>new Function(code));
});


test("2026 FNAC and Devil published gigs live inside Fechados with past grey",()=>{
 const ui=get("control-booking-board-ui.js"),html=get("crm-control.html");
 assert.doesNotMatch(ui,/confirmedIndex/);
 assert.match(ui,/cc-board-past/);
 assert.match(ui,/renderExternalRadar\(year\)/);
 assert.match(html,/control-booking-radar\.js\?v=20261017closed3/);
 assert.match(ui,/Radar externo de festivais/);
 assert.doesNotThrow(()=>new Function(get("control-booking-radar.js")));
});
test("press navigation is district-first for all Portuguese contacts",()=>{
 const source=get("control-press-ui.js"),geo=get("control-press-geography.js");
 assert.match(source,/Cultura portuguesa para meios nacionais/);
 assert.doesNotMatch(source,/if\(isPortugal\)/);
 assert.match(source,/CaravelaPressGeography\?\.district\(event\)/);
 assert.match(geo,/key:"district:"\+norm\(place\)/);
});


test("external search uses authorized in-memory transport and does not alter CRM bookings",()=>{
 const control=get("control-vault.js"),transport=get("control-vault-ui.js"),search=get("control-festival-search.js");
 assert.match(control,/festivalRadarRoute=route==="radar\/festivals"/);
 assert.match(transport,/CaravelaFestivalSearch/);
 assert.match(search,/CONTROL_BRAVE_SEARCH_API_KEY/);
 assert.doesNotMatch(search,/crm_booking|INSERT INTO|UPDATE control/);
});
test("closed concerts are in their native lanes, past styled grey, radar below booking body",()=>{
 const ui=get("control-booking-board-ui.js"), board=get("control-booking-board.js");
 assert.match(ui,/section\.append\(head,status,publishedInfo,body,radar\)/);
 assert.match(ui,/cc-board-past/);
 assert.match(ui,/Concertos já realizados/);
 assert.match(board,/festival\.confirmed\.sort\(sortConfirmed\)/);
 assert.match(board,/venue\.confirmed\.sort\(sortConfirmed\)/);
 assert.match(get("control-booking-board.css"),/\.cc-board-past/);
});


test("Culture editorial reach, verified districts and the rest of Portugal are separate sections",()=>{
 const geo=get("control-press-geography.js"),editorial=get("control-press-editorial.js"),
  ui=get("control-press-ui.js"),html=get("crm-control.html");
 assert.match(html,/control-press-editorial\.js\?v=20261017workflow3/);
 assert.match(geo,/key:"culture",label:"Cultura portuguesa"/);
 assert.match(geo,/key:"pt-unspecified",label:"Portugal — sem distrito especificado"/);
 assert.match(editorial,/musicfest pt/);
 assert.match(editorial,/blitz/);
 assert.match(editorial,/arte e cultura/);
 assert.match(ui,/block\.dataset\.pressKey=key/);
 assert.match(ui,/focusPressRegion\(target\.key\)/);
});
test("home press summaries link to Culture and district sections instead of copying media contacts",()=>{
 const home=get("control-home-focus-ui.js"),ui=get("control-press-ui.js");
 assert.match(home,/cc-home-press-links/);
 assert.match(home,/caravela-press-focus-region/);
 assert.match(ui,/function pressTargets\(event\)/);
 assert.match(ui,/caravela-press-focus-region/);
 assert.match(get("crm-control.html"),/control-home-focus-ui\.js\?v=20261017workflow3/);
});


test("daily Zoho messages are visible, not buried under historical action reviews",()=>{
 const home=get("control-home-focus-ui.js"),auto=get("control-auto-review-ui.js");
 assert.match(home,/columns\.prepend\(zohoQueue\)/);
 assert.match(home,/if\(zohoQueue\)/);
 assert.match(auto,/cc-auto-review-drawer/);
 assert.match(auto,/Arquivo histórico por validar/);
 assert.match(auto,/não urgências confirmadas/);
 assert.doesNotMatch(auto,/Revisões vencidas/);
});
test("booking foregrounds actionable lanes and Fechados, not hundreds of historic cards",()=>{
 const board=get("control-booking-board-ui.js"),css=get("control-booking-board.css");
 assert.match(board,/cc-board-focus-rail/);
 assert.match(board,/cc-board-secondary/);
 assert.match(board,/Planeamento e arquivo/);
 assert.match(board,/const cap=key==="confirmed"\?12:6/);
 assert.match(board,/Ver contexto e origem/);
 assert.match(board,/Promotores · /);
 assert.match(css,/\.cc-board-focus-rail/);
 assert.match(css,/\.cc-board-card-meta/);
});
test("empty drafts and static opportunity source catalogs are collapsed by default",()=>{
 const drafts=get("control-mail-drafts-ui.js"),radar=get("control-opportunities-ui.js");
 assert.match(drafts,/cc-drafts-drawer/);
 assert.match(drafts,/drawer\.open=true/);
 assert.match(radar,/cc-radar-source-drawer/);
 const html=get("crm-control.html");
 for(const asset of [
  "control-booking-board-ui.js","control-home-focus-ui.js",
  "control-auto-review-ui.js","control-mail-drafts-ui.js",
  "control-opportunities-ui.js","control-vault-ui.js"
 ])assert.match(html,new RegExp(asset.replaceAll(".","\\.")+"\\?v=20261017workflow3"));
});
test("live festival radar displays provider readiness and supports PT, ES, FR",()=>{
 const ui=get("control-booking-board-ui.js"),transport=get("control-vault-ui.js"),
  backend=get("control-festival-search.js");
 assert.match(ui,/checkRadarConnection/);
 assert.match(ui,/radarTerritory="PT"/);
 assert.match(ui,/CONTROL_BRAVE_SEARCH_API_KEY/);
 assert.match(transport,/status\(\)\{return api\("radar\/festivals\?status=1"\)\}/);
 assert.match(backend,/queries_succeeded/);
 assert.match(backend,/territory/);
 assert.doesNotMatch(backend,/site:pt/);
});


test("administrative AÇÕES table lives in Dados e backups, not daily Booking",()=>{
 const app=get("control-app.js");
 assert.match(app,/viewMap\.get\("sources"\)\.appendChild\(oldBooking\)/);
 assert.doesNotMatch(app,/viewMap\.get\("booking"\)\.appendChild\(oldBooking\)/);
 const css=get("control-booking-board.css");
 assert.match(css,/#cc-view-booking>\.cc-panel-head/);
});
test("Portuguese-sheet press provenance never overwrites a contact source address",()=>{
 const editorial=get("control-press-editorial.js"),geography=get("control-press-geography.js");
 assert.match(editorial,/portugueseCatalogue/);
 assert.match(editorial,/districtCatalogue/);
 assert.match(editorial,/confirmedPortuguese/);
 assert.match(geography,/country-unknown/);
 assert.match(geography,/country-multi/);
 assert.match(geography,/Portugal — sem distrito especificado/);
});


test("external festival shortlist can open an unsaved native contact in review mode",()=>{
 const ui=get("control-booking-board-ui.js"),native=get("control-native-ui.js");
 assert.match(ui,/caravela-board-research-contact/);
 assert.match(ui,/Rever e criar contacto/);
 assert.match(native,/window\.addEventListener\("caravela-board-research-contact"/);
 assert.match(native,/contact_policy:"review"/);
 assert.match(native,/Confirmar o nome, país, programação, contacto e adequação/);
 assert.doesNotMatch(native,/radar\/festivals.*POST/);
});


test("workspace navigation always resets the previous view scroll",()=>{
 const app=get("control-app.js");
 assert.match(app,/const changing=active!==view/);
 assert.match(app,/main\.scrollTop=0/);
 assert.match(app,/window\.scrollTo\(\{top:0,behavior:"auto"\}\)/);
});
