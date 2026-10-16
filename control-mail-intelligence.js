/* Preview-only Zoho mail interpretation, based on explicit readable content.
 * Never store bodies, subjects, snippets or attachments. Heuristic signals
 * require operator review; do not update booking status or authorize outreach. */
const ADDRESS=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const firstMessage=text=>{
  const s=String(text||"").slice(0,120000)
   .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi," ")
   .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi," ")
   .replace(/<(?:br|p|div|li|tr|h[1-6])\b[^>]*>/gi,"\n")
   .replace(/<[^>]*>/g," ")
   .replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&")
   .replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
   .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'");
  return s.split(/\n\s*(?:de:\s|from:\s|on\s.+\swrote:|em\s.+\sescreveu:|[-]{4,}\s*(?:original|forwarded)|mensagem original|original message)/i)[0]
    .slice(0,16000).replace(/\s+/g," ").trim();
};
export function interpretMailContent({content="",subject="",direction="incoming"}={}){
  const body=firstMessage(content);
  // Reject empty and oversized content rather than guess from a disclaimer.
  if(body.length<12)return {topic:"unclear",signal:"ambiguous",confidence:"insufficient",reason_code:"no_readable_content"};
  // The subject is used in memory only, never persisted.
  const raw=(String(subject||"").slice(0,200)+" "+body).normalize("NFD")
   .replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const topic=/\b(booking|concerto|concert|festival|palco|cach[eê]t|show|gig|atua[cç]ao|live music|tour|tournee|touring|agenda de espetaculos)\b/.test(raw)?"booking":
   /\b(parceria|patrocin|sponsor|partnership|colaboracao|apoio cultural|apoio de transporte)\b/.test(raw)?"partnership":
   /\b(entrevista|imprensa|press release|radio|reportagem|review|editorial|noticia|divulgacao)\b/.test(raw)?"press":"other";
  if(direction!=="incoming")return {topic,signal:"none",confidence:"insufficient",reason_code:"outgoing_context"};
  // Only classify the new message, not quoted earlier exchanges.
  const current=body.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(/\b(nao temos interesse|sem interesse|nao estamos interessados|nao sera possivel|nao conseguimos receber|infelizmente nao|proposta recusada|not interested|unfortunately we cannot|we have to decline|unable to accommodate|no availability)\b/.test(current))
    return {topic,signal:"decline",confidence:"rule_based",reason_code:"negative_expression"};
  if(/\b(confirmamos (?:a |o |esta |este )?(?:data|concerto|evento|show|contratacao)|fica confirmado|esta confirmado|contrato (?:assinado|fechado)|we confirm the booking|booking is confirmed)\b/.test(current))
    return {topic,signal:"possible_confirmation",confidence:"rule_based",reason_code:"confirmation_expression"};
  if(/\b(temos interesse|estamos interessados|gostariamos de|teremos todo o gosto|vamos analisar|gostavamos de|we are interested|we would love|happy to discuss|sounds interesting)\b/.test(current))
    return {topic,signal:"interest",confidence:"rule_based",reason_code:"interest_expression"};
  if(topic!=="other"&&/\?/.test(current))
    return {topic,signal:"needs_reply",confidence:"rule_based",reason_code:"business_question"};
  return {topic,signal:"ambiguous",confidence:"insufficient",reason_code:topic==="other"?"unrelated_or_unclear":"context_needs_review"};
}
const isId=x=>typeof x==="string"&&/^\d{1,35}$/.test(x);
export async function interpretIndexedMessages(db,mailbox,readContent,{limit=12}={}){
  const enabled=typeof readContent==="function";
  if(!enabled)return {enabled:false,reason:"content_reader_unavailable",examined:0,new_signals:0,failures:0};
  const table=await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='control_mail_signals'").first();
  if(!table)return {enabled:false,reason:"migration_required",examined:0,new_signals:0,failures:0};
  const rows=await db.prepare(
    "SELECT h.mailbox,h.folder_kind,h.message_id,h.folder_id,h.thread_id,h.from_email,h.to_json,h.received_ms "+
    "FROM control_mail_headers h LEFT JOIN control_mail_signals s "+
    "ON h.mailbox=s.mailbox AND h.folder_kind=s.folder_kind AND h.message_id=s.message_id "+
    "WHERE h.mailbox=? AND h.folder_kind='incoming' AND s.message_id IS NULL "+
    "ORDER BY COALESCE(h.received_ms,h.first_seen_ms) DESC LIMIT ?"
  ).bind(mailbox,Math.min(20,Math.max(1,Math.trunc(limit)))).all();
  let examined=0,newSignals=0,failures=0;
  for(const msg of rows.results||[]){
    if(!isId(msg.folder_id)||!isId(msg.message_id))continue;
    examined++;
    try{
      const result=await readContent({folderId:msg.folder_id,messageId:msg.message_id});
      const content=typeof result?.content==="string"?result.content:"";
      const finding=interpretMailContent({content,direction:"incoming"});
      const address=String(msg.from_email||"").toLowerCase();
      // Keep only the exact source address. Never persist internal mailbox aliases as a lead.
      const outside=ADDRESS.test(address)&&address!==mailbox?address:null;
      const saved=await db.prepare(
        "INSERT OR IGNORE INTO control_mail_signals("+
        "mailbox,folder_kind,message_id,thread_id,external_email,message_ms,topic,signal,"+
        "confidence,reason_code,classifier_version,observed_ms) "+
        "VALUES (?,?,?,?,?,?,?,?,?,?,1,?)"
      ).bind(msg.mailbox,msg.folder_kind,msg.message_id,msg.thread_id||null,outside,
        msg.received_ms||null,finding.topic,finding.signal,finding.confidence,
        finding.reason_code,Date.now()).run();
      newSignals+=Number(saved.meta?.changes??saved.changes??0);
    }catch{
      // A failed read is retried on the next cycle; never pretend it was classified.
      failures++;
    }
  }
  return {enabled:true,examined,new_signals:newSignals,failures,read_only:true};
}
