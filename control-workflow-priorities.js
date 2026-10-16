/* Caravela Control: deterministic, read-only shortlist of next booking decisions.
 * No guessed deadlines, Zoho classification, commercial-state mutation or outbound messages. */
(function(root){
"use strict";
const CLOSED=new Set(["confirmed","declined","closed"]);
const NO_DATE_REVIEW=new Set(["reply_reported","negotiating"]);
const NEEDS_OWNER=new Set(["research","draft","contact_reported","sent_verified"]);
const ONE_DAY=86400000;

function utcDay(raw){
 if(typeof raw!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
 const value=Date.parse(raw+"T12:00:00Z");
 if(!Number.isFinite(value)||new Date(value).toISOString().slice(0,10)!==raw)return null;
 return value;
}

// Pure function. The caller supplies a Lisbon-local ISO calendar day.
function selectDailyActions(records,{today,limit=5}={}){
 const now=utcDay(today);
 if(now===null||!Array.isArray(records))return [];
 const bound=Math.max(0,Math.min(10,Number.isFinite(limit)?Math.trunc(limit):5));
 const unique=new Map();
 for(const row of records){
  if(!row||typeof row.id!=="string"||!row.id)continue;
  const prev=unique.get(row.id);
  if(!prev||Number(row.revision||0)>Number(prev.revision||0))unique.set(row.id,row);
 }
 const result=[];
 for(const row of unique.values()){
  const stage=String(row.stage||"");
  if(CLOSED.has(stage))continue;
  const due=utcDay(row.due_date||"");
  if(stage==="paused"&&due===null)continue;
  const owner=String(row.owner||"").trim();
  let rank,reason,category;
  if(due!==null){
   const days=Math.round((due-now)/ONE_DAY);
   if(days<0){rank=0;reason="Revisão vencida ("+(-days)+" dia"+(days===-1?"":"s")+")";category="overdue"}
   else if(days===0){rank=1;reason="Revisão marcada para hoje";category="today"}
   else if(days<=7){rank=2;reason="Revisão marcada para os próximos 7 dias";category="upcoming"}
   else continue; // Future work is available in the full booking queue.
  }else if(NO_DATE_REVIEW.has(stage)){
   rank=3;reason="Negociação ou resposta registada sem data de revisão";category="schedule_review";
  }else if(!owner&&NEEDS_OWNER.has(stage)){
   rank=4;reason="Oportunidade sem responsável e sem data de revisão";category="assign_owner";
  }else continue; // An unplanned prospect is not a proven urgent task.
  result.push({id:row.id,reason,category,dueDate:due===null?"":row.due_date,
   missingOwner:!owner,rank,manualPriority:row.priority==="high"?0:row.priority==="medium"?1:2,
   title:String(row.contact_name||"Entidade por identificar")+" · "+String(row.artist||"Artista por definir")});
 }
 result.sort((a,b)=>a.rank-b.rank||
  (a.dueDate||"9999").localeCompare(b.dueDate||"9999")||
  a.manualPriority-b.manualPriority||
  a.title.localeCompare(b.title,"pt-PT")||
  a.id.localeCompare(b.id));
 return result.slice(0,bound).map(({rank,manualPriority,...value})=>value);
}
root.CaravelaWorkflowPriority=Object.freeze({selectDailyActions});
})(typeof window!=="undefined"?window:globalThis);
