import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {interpretMailContent,interpretIndexedMessages} from "../control-mail-intelligence.js";

function setup(){
 const sql=new DatabaseSync(":memory:");
 sql.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
 sql.exec(readFileSync(new URL("../migrations/0005_control_mail_signals.sql",import.meta.url),"utf8"));
 const query=(statement,args=[])=>({
  async first(){return sql.prepare(statement).get(...args)||null},
  async all(){return {results:sql.prepare(statement).all(...args)}},
  async run(){return sql.prepare(statement).run(...args)}
 });
 return {sql,db:{prepare(q){return {bind(...a){return query(q,a)},...query(q)}}}};
}
const ADDRESS="booking@caravelaamarela.com";
function insert(sql,id,from){
 sql.prepare("INSERT INTO control_mail_headers"+
  "(mailbox,folder_kind,message_id,folder_id,from_email,to_json,received_ms,thread_id,first_seen_ms) "+
  "VALUES (?,?,?,?,?,?,?,?,?)").run(ADDRESS,"incoming",id,"11",from,
    '["booking@caravelaamarela.com"]',1790000000000,"901",1790000000000);
}
test("Zoho content interpretation suggests interest, denial, potential confirmation but never approves a deal",()=>{
 assert.deepEqual(interpretMailContent({
  content:"Temos interesse em receber a banda no festival, podemos falar?",
  direction:"incoming"
 }),{topic:"booking",signal:"interest",confidence:"rule_based",reason_code:"interest_expression"});
 assert.equal(interpretMailContent({
  content:"Infelizmente não será possível incluir a banda no festival este ano.",
  direction:"incoming"
 }).signal,"decline");
 assert.equal(interpretMailContent({
  content:"Confirmamos a data do concerto, aguardamos o contrato.",
  direction:"incoming"
 }).signal,"possible_confirmation");
 assert.equal(interpretMailContent({
  content:"Bom dia, teremos todo o gosto em discutir uma parceria de mobilidade.",
  direction:"incoming"
 }).topic,"partnership");
 assert.equal(interpretMailContent({
  content:"Gostaríamos de saber se têm disponibilidade para o festival.",
  direction:"outgoing"
 }).signal,"none");
});
test("quote/history and HTML tags are excluded from first-message signal",()=>{
 const x=interpretMailContent({
  content:"<p>Obrigado pelo contacto, vamos responder em breve.</p>"+
   "<blockquote><p>Não temos interesse em nenhum concerto.</p></blockquote>",
  direction:"incoming"
 });
 assert.notEqual(x.signal,"decline");
});
test("bounded persistent signals are idempotent and never include subject or body",async()=>{
 const {sql,db}=setup();
 try{
  insert(sql,"200","festival@example.test");
  let hits=0;
  const reader=async()=>{hits++;return {content:"Boa tarde, temos interesse no concerto. Podem confirmar valores?"}};
  const first=await interpretIndexedMessages(db,ADDRESS,reader);
  assert.equal(first.enabled,true);assert.equal(first.new_signals,1);assert.equal(hits,1);
  const again=await interpretIndexedMessages(db,ADDRESS,reader);
  assert.equal(again.new_signals,0);assert.equal(hits,1);
  const stored=sql.prepare("SELECT * FROM control_mail_signals").all();
  assert.equal(stored.length,1);assert.equal(stored[0].external_email,"festival@example.test");
  assert.equal(stored[0].topic,"booking");assert.equal(stored[0].signal,"interest");
  const raw=JSON.stringify(stored);
  assert.ok(!raw.includes("Boa tarde"));assert.ok(!raw.includes("confirmar valores"));
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM control_decision_events").get().n,0);
 }finally{sql.close()}
});
test("read failures retry and absent schema does not affect mailbox indexing",async()=>{
 const {sql,db}=setup();
 try{
  insert(sql,"200","festival@example.test");
  const failed=await interpretIndexedMessages(db,ADDRESS,async()=>{throw Error("secrets or provider detail");});
  assert.equal(failed.failures,1);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM control_mail_signals").get().n,0);
  const ok=await interpretIndexedMessages(db,ADDRESS,async()=>({content:"Podemos agendar uma entrevista?"}));
  assert.equal(ok.new_signals,1);
  sql.exec("DROP TABLE control_mail_signals");
  const missing=await interpretIndexedMessages(db,ADDRESS,async()=>({content:"reply"}));
  assert.equal(missing.reason,"migration_required");
 }finally{sql.close()}
});
