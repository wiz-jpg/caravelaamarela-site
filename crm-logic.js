/* Caravela Control — privacy-preserving CRM matching, version 1.
   This file contains NO contacts, credentials or email contents. */
(function (root) {
  "use strict";
  const EMAIL_RE=/[a-z0-9.!#$%&'*+/=?^_{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const VALID_EMAIL=/^[a-z0-9.!#$%&'*+/=?^_{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  const KINDS=new Set(["festival","venue","promoter","press"]);
  const BOOKING="booking@caravelaamarela.com";
  const clean=value=>String(value===null||value===undefined?"":value).trim();
  const lower=value=>clean(value).toLowerCase();

  function extractEmails(input) {
    const found=[];
    function scan(value) {
      if(typeof value==="string")found.push(...(value.match(EMAIL_RE)||[]));
      else if(Array.isArray(value))value.slice(0,200).forEach(scan);
      else if(value&&typeof value==="object"){
        for(const key of ["emailAddress","mailId","email","address"])if(value[key])scan(value[key]);
      }
    }
    scan(input);
    return [...new Set(found.map(lower).filter(email=>email.length<=254&&VALID_EMAIL.test(email)))];
  }

  function validateImport(data) {
    if(!data||typeof data!=="object"||data.schema!=="caravela.crm.import.v1"||
       !/^[a-f0-9]{64}$/.test(clean(data.manifest_sha256))||
       !Array.isArray(data.entities)||!Array.isArray(data.suppressions)||
       data.entities.length<1||data.entities.length>10000)throw new Error("Ficheiro CRM inválido ou incompatível.");
    if(data.summary?.total!==data.entities.length)throw new Error("O número de registos não coincide com o resumo.");
    const ids=new Set();
    for(const item of data.entities) {
      if(!item||!KINDS.has(item.kind)||typeof item.name!=="string"||!item.name.trim()||
         typeof item.id!=="string"||!/^(festival|venue|promoter|press)_[a-f0-9]{22}$/.test(item.id)||
         ids.has(item.id)||!Array.isArray(item.emails)||item.emails.length>15||
         item.emails.some(email=>extractEmails(email).length!==1||lower(email)!==extractEmails(email)[0]))
        throw new Error("Um dos contactos importados tem dados inválidos.");
      ids.add(item.id);
    }
    for(const row of data.suppressions)if(extractEmails(row.email).length!==1)throw new Error("Lista de supressão inválida.");
    return data;
  }

  function indexContacts(data) {
    const index=new Map(), byId=new Map();
    for(const entity of data.entities) {
      byId.set(entity.id,entity);
      for(const email of entity.emails) {
        if(email===BOOKING)continue;
        if(!index.has(email))index.set(email,new Set());
        index.get(email).add(entity.id);
      }
    }
    return {index,byId,suppressed:new Set(data.suppressions.map(x=>lower(x.email)))};
  }

  function messageDate(mail) {
    for(const x of [mail.receivedTime,mail.sentDateInGMT,mail.sentDate,mail.date,mail.time]) {
      if(typeof x==="number"&&Number.isFinite(x))return x<100000000000?x*1000:x;
      if(typeof x==="string"&&/^\d{10,13}$/.test(x))return x.length===10?Number(x)*1000:Number(x);
      if(typeof x==="string"&&x.length<70){const n=Date.parse(x);if(Number.isFinite(n))return n;}
    }
    return null;
  }

  function matchMail(mail,direction,lookup) {
    if(!["incoming","outgoing"].includes(direction))throw new Error("Direção inválida.");
    const from=extractEmails(mail.fromAddress)[0]||"";
    const to=extractEmails(mail.toAddress);
    // Exact-address matching, never fuzzy names, inferred thread partners or string similarity.
    const targets=direction==="incoming"?(from?[from]:[]):to.filter(e=>e!==BOOKING);
    const candidates=new Map();
    for(const email of targets)for(const id of lookup.index.get(email)||[])candidates.set(id,email);
    const ids=[...candidates.keys()];
    const status=ids.length===1?"unique":ids.length>1?"ambiguous":"unmatched";
    return {
      message_id:clean(mail.messageId).slice(0,40),
      thread_id:clean(mail.threadId).slice(0,70),
      direction,from,to,subject:clean(mail.subject).slice(0,300),
      timestamp:messageDate(mail),status,
      entity_id:status==="unique"?ids[0]:null,
      matched_email:status==="unique"?candidates.get(ids[0]):null,
      candidate_count:ids.length
    };
  }

  function reconcile(data,messages) {
    const lookup=indexContacts(data);
    const perEntity=new Map(data.entities.map(e=>[e.id,{sent:0,received:0,last_sent:null,last_received:null,observed:[]}]));
    const classified=[],seen=new Set();
    const totals={unique:0,ambiguous:0,unmatched:0,incoming:0,outgoing:0};
    for(const record of messages) {
      const key=record.direction+":"+clean(record.message?.messageId);
      if(!record.message?.messageId||seen.has(key))continue;
      seen.add(key);
      const result=matchMail(record.message,record.direction,lookup);
      totals[result.status]++;
      totals[result.direction]++;
      classified.push(result);
      if(result.status!=="unique")continue;
      const item=perEntity.get(result.entity_id);
      if(!item)continue;
      const sent=result.direction==="outgoing";
      if(sent){item.sent++;if(result.timestamp!==null)item.last_sent=Math.max(item.last_sent||0,result.timestamp);}
      else {item.received++;if(result.timestamp!==null)item.last_received=Math.max(item.last_received||0,result.timestamp);}
      // Keep minimal evidence (IDs only); subject is never embedded in exported review data.
      item.observed.push({message_id:result.message_id,direction:result.direction,timestamp:result.timestamp});
    }
    return {lookup,perEntity,classified,totals};
  }

  function followUpCandidate(entity,stats,now=Date.now()) {
    // A candidate for HUMAN REVIEW only. Never treat an inbound message as proof of a reply.
    if(!stats||entity.suppressed||entity.shared_email||entity.review_required)return false;
    if(!stats.last_sent||stats.last_sent>now||now-stats.last_sent<14*86400000||now-stats.last_sent>180*86400000)return false;
    return !stats.last_received||stats.last_received<stats.last_sent;
  }

  function exportReview(data,result) {
    // Explicit user export. Never includes OAuth credentials, full message bodies or previews.
    return {
      schema:"caravela.crm.review.v1",source_manifest:data.manifest_sha256,
      created_at:new Date().toISOString(),totals:result.totals,
      entities:data.entities.map(e=>{
        const t=result.perEntity.get(e.id)||{};
        return {id:e.id,kind:e.kind,name:e.name,city:e.city,priority:e.priority,
          original_status_2027:e.status_2027,original_history:e.historical,
          verification:e.verification,source_review:!!e.review_required,
          shared_email:!!e.shared_email,suppressed:!!e.suppressed,
          sent_observed:t.sent||0,incoming_observed:t.received||0,
          last_sent:t.last_sent||null,last_incoming:t.last_received||null,
          suggested_review:followUpCandidate(e,t)};
      }),
      ambiguous_message_ids:result.classified.filter(m=>m.status==="ambiguous").map(m=>({id:m.message_id,direction:m.direction,count:m.candidate_count}))
    };
  }
  const api={extractEmails,validateImport,indexContacts,messageDate,matchMail,reconcile,followUpCandidate,exportReview};
  root.CaravelaCRMLogic=Object.freeze(api);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
