import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {handleControl} from "../control-vault.js";

const HOST="https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const ADMIN="drafts-test-admin-"+"x".repeat(50);
let db,env;
function adapter(sqlite){
 const stmt=(sql,params=[])=>({
  async first(){return sqlite.prepare(sql).get(...params)||null},
  async all(){return {results:sqlite.prepare(sql).all(...params)}},
  async run(){return sqlite.prepare(sql).run(...params)}
 });
 return {prepare(sql){return {bind(...params){return stmt(sql,params)},...stmt(sql)}},
  async batch(items){
   sqlite.exec("BEGIN");
   try{
    const result=[];for(const item of items)result.push(await item.run());
    sqlite.exec("COMMIT");return result;
   }catch(err){sqlite.exec("ROLLBACK");throw err}
  }};
}
beforeEach(()=>{
 db=new DatabaseSync(":memory:");
 db.exec(readFileSync(new URL("../migrations/0003_control_vault.sql",import.meta.url),"utf8"));
 db.exec(readFileSync(new URL("../migrations/0007_control_mail_drafts.sql",import.meta.url),"utf8"));
 env={ZOHO_DB:adapter(db),ZOHO_ENABLED:"true",CONTROL_VAULT_ENABLED:"true",
  ZOHO_ADMIN_TOKEN:ADMIN,ZOHO_TOKEN_KEY:Buffer.alloc(32,42).toString("base64")};
});
afterEach(()=>db.close());
function input(patch={}){
 return {to:"test@example.pt",subject:"Convite TEST ONLY",
  body:"CONTEUDO_CONFIDENCIAL_DE_TESTE_891324",artist:"WILDCHAINS",
  booking_id:"",source_message_id:"",context:"Validação manual",...patch};
}
async function call(method="GET",payload,options={}){
 const uri=HOST+"/api/control/mail/drafts"+(options.qs||"");
 const url=new URL(uri);
 const req=new Request(url,{method,headers:{
  Authorization:"Bearer "+(options.token||ADMIN),
  Origin:options.origin||HOST,
  ...(options.csrf===false?{}:{"X-Caravela-Request":"1"}),
  ...(payload?{"Content-Type":"application/json"}:{})
 },...(payload?{body:JSON.stringify(payload)}:{})});
 return handleControl(req,env,url);
}
test("drafts are encrypted, versioned, recoverable and no external mail is sent",async()=>{
 const saved=await call("POST",input());
 assert.equal(saved.status,201);
 const created=await saved.json();assert.equal(created.sent,false);
 const id=created.id;assert.ok(id);
 let raw=db.prepare("SELECT ciphertext FROM control_mail_draft_versions WHERE draft_id=? AND revision=1").get(id).ciphertext;
 assert.match(raw,/^v1\./);assert.ok(!raw.includes("CONFIDENCIAL"));
 assert.ok(!raw.includes("example.pt"));assert.ok(!raw.includes("Convite"));
 const first=await call("GET",null,{qs:"?id="+id});
 assert.equal(first.status,200);
 assert.deepEqual((await first.json()).draft.body,input().body);
 let changed=await call("PATCH",{...input({subject:"Segunda versão",body:"Texto alterado"}),
  id,revision:1,status:"draft"});
 assert.equal(changed.status,200);
 assert.equal((await changed.json()).revision,2);
 assert.equal((await call("PATCH",{...input(),id,revision:1,status:"draft"})).status,409);
 const previous=await (await call("GET",null,{qs:"?id="+id+"&revision=1"})).json();
 assert.equal(previous.draft.body,input().body);
 assert.equal(previous.displayed_revision,1);
 const current=await (await call("GET",null,{qs:"?id="+id})).json();
 assert.equal(current.draft.subject,"Segunda versão");
 assert.deepEqual(current.versions.map(x=>x.revision),[2,1]);
 changed=await call("PATCH",{...input({subject:"Segunda versão",body:"Texto alterado"}),
   id,revision:2,status:"archived"});
 assert.equal(changed.status,200);
 const list=await (await call()).json();
 assert.equal(list.drafts.length,1);assert.equal(list.drafts[0].status,"archived");
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_mail_draft_versions WHERE draft_id=?").get(id).n,3);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_audit").get().n,3);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_mail_headers").get().n,0);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_decision_events").get().n,0);
});
test("unknown source mail, forged booking and multi-recipient payload cannot be saved",async()=>{
 const noMail=await call("POST",input({source_message_id:"123456"}));
 assert.equal(noMail.status,409);
 assert.equal((await noMail.json()).error,"source_message_not_found");
 const forged=await call("POST",input({booking_id:"1ddf6540-9e35-4a1b-af59-99af39c7745e"}));
 assert.equal(forged.status,409);
 const multi=await call("POST",input({to:"a@example.pt,b@example.pt"}));
 assert.equal(multi.status,422);
 assert.equal((await call("POST",input({to:"nope\r\nBcc:a@example.pt"}))).status,422);
 assert.equal((await call("POST",input({body:"X".repeat(12001)}))).status,422);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_mail_drafts").get().n,0);
});
test("source message can be linked only to a real indexed received message",async()=>{
 db.prepare("INSERT INTO control_mail_headers(mailbox,folder_kind,message_id,folder_id,from_email,to_json,received_ms,thread_id,first_seen_ms) VALUES (?,?,?,?,?,?,?,?,?)")
  .run("booking@caravelaamarela.com","incoming","123456","folder","venue@example.pt","[]",1770000000000,"1",1770000000000);
 const res=await call("POST",input({source_message_id:"123456"}));
 assert.equal(res.status,201);
 const rows=(await (await call()).json()).drafts;
 assert.equal(rows[0].source_message_id,"123456");
});
test("same-origin, roles, CSRF, Preview host and missing encryption fail closed",async()=>{
 assert.equal((await call("POST",input(),{token:"invalid"})).status,401);
 assert.equal((await call("POST",input(),{csrf:false})).status,403);
 assert.equal((await call("POST",input(),{origin:"https://example.org"})).status,403);
 const old=env.ZOHO_TOKEN_KEY;env.ZOHO_TOKEN_KEY="bad";
 assert.equal((await call("POST",input())).status,503);
 env.ZOHO_TOKEN_KEY=old;
 db.exec("DROP TABLE control_mail_draft_versions");
 const missing=await call("GET");
 assert.equal(missing.status,409);
 assert.equal((await missing.json()).error,"drafts_migration_required");
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_decision_events").get().n,0);
});

test("encrypted offsite R2 copies are verified before storing draft revisions",async()=>{
 const objects=new Map();
 env.CONTROL_R2_BACKUP_ENABLED="true";
 env.CONTROL_BACKUP_BUCKET={
  async head(key){
   const value=objects.get(key);
   return value?{customMetadata:{sha256:value.hash}}:null;
  },
  async put(key,data,options){
   const bytes=new Uint8Array(data);
   objects.set(key,{bytes,hash:options.customMetadata.sha256});
  },
  async get(key){
   const value=objects.get(key);
   return value?{async arrayBuffer(){return value.bytes.slice().buffer}}:null;
  }
 };
 const result=await (await call("POST",input())).json();
 assert.equal(result.ok,true);
 assert.equal(result.independent_backup_verified,true);
 const copy=objects.get("mail-drafts/v1/"+result.id+"/1.json");
 assert.ok(copy);
 assert.ok(!new TextDecoder().decode(copy.bytes).includes(input().body));
 const amended=await (await call("PATCH",{
  ...input({body:"Body newer"}),id:result.id,revision:1,status:"draft"
 })).json();
 assert.equal(amended.independent_backup_verified,true);
 assert.equal(objects.size,2);
 // Failing external backup does not alter existing content or increment a revision.
 env.CONTROL_BACKUP_BUCKET.put=async()=>{throw Error("r2_unavailable")};
 assert.equal((await call("PATCH",{
  ...input({body:"Unsaved changed text"}),id:result.id,revision:2,status:"draft"
 })).status,503);
 const latest=(await (await call("GET",null,{qs:"?id="+result.id})).json()).draft;
 assert.equal(latest.body,"Body newer");
 assert.equal(latest.revision,2);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM control_mail_draft_versions WHERE draft_id=?").get(result.id).n,2);
});
