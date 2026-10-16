import {test} from "node:test";
import assert from "node:assert/strict";
import "../control-workflow-priorities.js";

const select=globalThis.CaravelaWorkflowPriority.selectDailyActions;
const base=(id,more={})=>({id,revision:1,stage:"research",contact_name:"Festival X",
 artist:"WILDCHAINS",priority:"medium",owner:"João",due_date:"",...more});

test("deadlines rank by real date; a distant date is not an urgent task",()=>{
 const rows=[
  base("later",{due_date:"2026-11-10"}),
  base("upcoming",{due_date:"2026-10-20"}),
  base("today",{due_date:"2026-10-16"}),
  base("overdue",{due_date:"2026-10-15"})
 ];
 assert.deepEqual(select(rows,{today:"2026-10-16"}).map(x=>x.id),
  ["overdue","today","upcoming"]);
 assert.equal(select(rows,{today:"2026-10-16"})[0].category,"overdue");
});

test("no imaginary overdue status for an undated offer or reported reply",()=>{
 const rows=[
  base("research"),
  base("reply",{stage:"reply_reported"}),
  base("negotiation",{stage:"negotiating"}),
  base("owner",{owner:""}),
  base("paused",{stage:"paused"}),
  base("closed",{stage:"confirmed",due_date:"2026-10-01"}),
  base("declined",{stage:"declined",due_date:"2026-10-01"})
 ];
 const result=select(rows,{today:"2026-10-16"});
 assert.deepEqual(result.map(x=>x.id),["negotiation","reply","owner"]);
 assert.ok(result.every(x=>!x.dueDate&&!["overdue","today"].includes(x.category)));
});

test("different proposals for one entity remain separate; IDs dedupe by newest revision",()=>{
 const rows=[
  base("a",{subject:"Festival 2026",due_date:"2026-10-16",revision:1}),
  base("a",{subject:"Festival 2026",due_date:"2026-10-19",revision:2}),
  base("b",{subject:"Festival 2027",due_date:"2026-10-18"})
 ];
 assert.deepEqual(select(rows,{today:"2026-10-16"}).map(x=>x.id),["b","a"]);
 assert.equal(select(rows,{today:"2026-10-16"}).length,2);
});

test("invalid dates, stages, bounds and input do not manufacture actionable tasks",()=>{
 const rows=[
  base("bad-date",{due_date:"2026-02-30"}),
  base("bad-format",{due_date:"16/10/2026"}),
  base("long-future",{due_date:"2027-04-01"}),
  base("paused",{stage:"paused"}),
  base("good",{due_date:"2026-10-16"})
 ];
 assert.deepEqual(select(rows,{today:"2026-10-16"}).map(x=>x.id),["good"]);
 assert.deepEqual(select(rows,{today:"2026-10-99"}),[]);
 assert.deepEqual(select(null,{today:"2026-10-16"}),[]);
 assert.equal(select(Array.from({length:15},(_,i)=>base(String(i),{due_date:"2026-10-16"})),{
  today:"2026-10-16",limit:100}).length,10);
});

test("original booking records are never mutated or promoted to confirmed",()=>{
 const row=Object.freeze(base("immutable",{stage:"contact_reported",owner:"",
  evidence_type:"user_report",due_date:"2026-10-16"}));
 const before={...row};
 const result=select([row],{today:"2026-10-16"});
 assert.equal(result.length,1);
 assert.equal(result[0].missingOwner,true);
 assert.deepEqual(row,before);
 assert.equal(row.stage,"contact_reported");
});


test("roster priority and documented fit break ties but cannot override real due dates",()=>{
 const rows=[
  base("external",{artist:"Other Project",due_date:"2026-10-17",fit_level:"strong",priority:"high"}),
  base("roster",{artist:"Devil of a Woman",due_date:"2026-10-17",fit_level:"possible",priority:"low"}),
  base("fitted",{artist:"WILDCHAINS",due_date:"2026-10-17",fit_level:"strong",priority:"low"}),
  base("due-now",{artist:"Other Project",due_date:"2026-10-16",fit_level:"weak",priority:"low"})
 ];
 assert.deepEqual(select(rows,{today:"2026-10-16"}).map(x=>x.id),
  ["due-now","fitted","roster","external"]);
});
