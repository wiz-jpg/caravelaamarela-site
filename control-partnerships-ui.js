/* Private partnership pipeline. No contact lists or confidential proposals in source code. */
(()=>{"use strict";
const root=document.getElementById("cc-view-partnerships");if(!root)return;
const $=id=>document.getElementById(id);
const choices={
category:{marca:"Marca",institucional:"Institucional",mobilidade:"Mobilidade",equipamento:"Equipamento",producao:"Produção",comunicacao:"Comunicação",circuito:"Circuito",outra:"Outra"},
stage:{idea:"Ideia",draft:"Proposta preparada",contact_reported:"Contacto referido · por verificar",sent_verified:"Envio verificado",reply_reported:"Resposta referida",negotiating:"Em negociação",collaboration_reported:"Colaboração realizada · reportada",confirmed:"Parceria confirmada",paused:"Em pausa",closed:"Fechada"},
priority:{alta:"Alta",media:"Média",baixa:"Baixa",a_definir:"Por definir"},
scope:{agencia:"Agência",wildchains:"WILDCHAINS",devil:"Devil of a Woman",ambos:"Ambas",outro:"Outro"},
evidence_type:{none:"Sem evidência",discussion:"Discussão anterior",user_report:"Relato do responsável",sent_message:"Mensagem enviada",received_message:"Resposta recebida",agreement:"Acordo/documento"}};
const fields={name:["Entidade",140,"text"],category:["Área",30,"select"],scope:["Âmbito",30,"select"],stage:["Estado",40,"select"],priority:["Prioridade",30,"select"],objective:["Objetivo",350,"text"],next_step:["Próximo passo",400,"text"],contact_name:["Pessoa de contacto",110,"text"],contact_email:["Email",250,"email"],channel:["Canal",80,"text"],last_contact_iso:["Último contacto",10,"date"],next_review_iso:["Rever em",10,"date"],evidence_type:["Tipo de evidência",30,"select"],evidence_reference:["Referência da evidência",450,"text"],source_label:["Origem do registo",160,"text"],notes:["Notas",1600,"textarea"]};
root.insertAdjacentHTML("beforeend",
'<div class="cc-partners-intro"><strong>Parcerias estratégicas, separadas do booking.</strong> Proposta preparada não equivale a email enviado. Representação artística continua no Artist Pipeline.</div>'+
'<div id="cc-partners-stats" class="cc-partners-stats"></div>'+
'<div class="cc-partners-toolbar"><div><label for="cc-partners-search">Pesquisar</label><input type="search" id="cc-partners-search" placeholder="Marca, proposta..."></div><div><label for="cc-partners-filter">Estado</label><select id="cc-partners-filter"></select></div><button type="button" id="cc-partners-refresh" class="cc-neutral">Atualizar</button></div>'+
'<p id="cc-partners-status" class="status" role="status"></p>'+
'<div id="cc-partners-auth" class="cc-partners-auth" hidden><label for="cc-partners-token">Token do Preview (apenas se ainda não autorizaste esta sessão)</label><div><input type="password" id="cc-partners-token" autocomplete="off"><button type="button" id="cc-partners-connect" class="cc-neutral">Autorizar</button></div><small>O token fica apenas na memória da página.</small></div>'+
'<div id="cc-partners-list" class="cc-partners-list"></div>'+
'<div class="cc-partners-actions"><button type="button" id="cc-partners-new" class="cc-primary">+ Nova parceria</button><label for="cc-partners-import">Importar levantamento JSON (opcional)<input type="file" id="cc-partners-import" accept=".json,application/json"></label></div>'+
'<form id="cc-partners-form" class="cc-partners-editor" hidden><h2 id="cc-partners-form-title">Nova parceria</h2><p class="cc-lead">Registos com histórico; não são enviados emails.</p><div class="cc-field-grid" id="cc-partners-fields"></div><div class="cc-actions"><button type="submit" class="cc-primary">Guardar ficha</button><button type="button" id="cc-partners-cancel" class="cc-neutral">Cancelar</button></div><p class="status" id="cc-partners-form-status"></p></form>');
let partners=[],editing="",busy=false;
function populate(select,options,all=false){if(all){let x=document.createElement("option");x.value="all";x.textContent="Todos";select.append(x)}
for(const [value,label] of Object.entries(options)){let x=document.createElement("option");x.value=value;x.textContent=label;select.append(x)}}
populate($("cc-partners-filter"),choices.stage,true);
for(const [key,[label,max,type]] of Object.entries(fields)){
const wrap=document.createElement("div");if(["objective","next_step","notes","evidence_reference"].includes(key))wrap.className="wide";
const l=document.createElement("label");l.textContent=label;l.htmlFor="cc-p-"+key;
let input;if(type==="select"){input=document.createElement("select");populate(input,choices[key])}else if(type==="textarea"){input=document.createElement("textarea");input.rows=3;input.maxLength=max}else{input=document.createElement("input");input.type=type;input.maxLength=max}
input.id="cc-p-"+key;input.required=["name","objective","next_step"].includes(key);wrap.append(l,input);$("cc-partners-fields").append(wrap)}
const names=Object.keys(fields);
function canEdit(){return !window.CaravelaControlSession?.authenticated ||
  ["admin","manager"].includes(window.CaravelaControlSession.user?.role)}
function syncEditControls(){
  $("cc-partners-new").hidden=!canEdit();
  $("cc-partners-import").parentElement.hidden=!canEdit();
  if(!canEdit())$("cc-partners-form").hidden=true;
}
function message(s,bad=false){$("cc-partners-status").textContent=s;$("cc-partners-status").classList.toggle("error",bad)}
async function api(method,entry){
 if(!window.CaravelaPartnershipTransport)throw Error("O cofre ainda não carregou.");
 const response=await window.CaravelaPartnershipTransport.request(method,entry);
 const payload=await response.json();
 if(!response.ok||!payload.ok)throw Error(payload.error||"Falha ao consultar ou guardar parceria");
 return payload;
}
function line(card,key,value){if(!value)return;const p=document.createElement("p"),label=document.createElement("strong"),v=document.createElement("span");label.textContent=key+": ";v.textContent=value;p.append(label,v);card.append(p)}
function render(){
let stats=$("cc-partners-stats");stats.replaceChildren();
for(const [name,n] of [["Oportunidades",partners.length],["Contacto / negociação",partners.filter(p=>["contact_reported","sent_verified","reply_reported","negotiating"].includes(p.stage)).length],["Colaborações",partners.filter(p=>["confirmed","collaboration_reported"].includes(p.stage)).length],["Ideias / propostas",partners.filter(p=>["idea","draft"].includes(p.stage)).length]]){
const div=document.createElement("div"),label=document.createElement("small"),num=document.createElement("strong");label.textContent=name;num.textContent=n;div.append(label,num);stats.append(div)}
const query=$("cc-partners-search").value.toLocaleLowerCase("pt-PT").trim(),state=$("cc-partners-filter").value;
const list=$("cc-partners-list");list.replaceChildren();
const records=partners.filter(p=>(state==="all"||p.stage===state)&&(!query||[p.name,p.objective,p.notes,p.next_step].join(" ").toLocaleLowerCase("pt-PT").includes(query)));
if(!records.length){const empty=document.createElement("p");empty.className="cc-notice";empty.textContent=partners.length?"Sem resultados neste filtro.":"Ainda não existem fichas. Adiciona uma oportunidade ou importa o levantamento para revisão.";list.append(empty);return}
for(const p of records){
const card=document.createElement("article");card.className="cc-partners-card";
const head=document.createElement("div");head.className="cc-partners-head";
const h=document.createElement("h3");h.textContent=p.name;const state=document.createElement("span");state.className="cc-partner-stage";state.textContent=choices.stage[p.stage]||p.stage;head.append(h,state);card.append(head);
line(card,"Âmbito",(choices.scope[p.scope]||p.scope)+" · "+(choices.category[p.category]||p.category)+" · Prioridade "+(choices.priority[p.priority]||p.priority));
line(card,"Objetivo",p.objective);line(card,"Próximo passo",p.next_step);
line(card,"Contacto",[p.contact_name,p.contact_email].filter(Boolean).join(" · "));
line(card,"Origem",[p.source_label,choices.evidence_type[p.evidence_type],p.evidence_reference].filter(Boolean).join(" · "));
if(p.notes){let details=document.createElement("details"),summary=document.createElement("summary"),body=document.createElement("p");summary.textContent="Contexto";body.textContent=p.notes;details.append(summary,body);card.append(details)}
let foot=document.createElement("div");foot.className="cc-partners-foot";let date=document.createElement("small");date.textContent=p.next_review_iso?"Rever "+p.next_review_iso:"Sem prazo definido";let edit=document.createElement("button");edit.type="button";edit.className="cc-neutral";edit.textContent="Atualizar";edit.hidden=!canEdit();edit.onclick=()=>editPartner(p);foot.append(date,edit);card.append(foot);list.append(card)}}
function editPartner(record){editing=record?.id||"";$("cc-partners-form").reset();
for(const key of names)if(record&&typeof record[key]==="string")$("cc-p-"+key).value=record[key];
if(!record){$("cc-p-category").value="marca";$("cc-p-scope").value="agencia";$("cc-p-stage").value="idea";$("cc-p-priority").value="media";$("cc-p-evidence_type").value="none"}
$("cc-partners-form-title").textContent=record?"Atualizar parceria":"Nova parceria";$("cc-partners-form").hidden=false;$("cc-partners-form-status").textContent="";$("cc-partners-form").scrollIntoView({behavior:"smooth",block:"start"})}
async function load(){if(busy)return;busy=true;message("A consultar o histórico...");
try{const result=await api("GET");partners=result.partners||[];render();$("cc-partners-auth").hidden=true;message("Registo atualizado · "+partners.length+" oportunidades.")}
catch(error){message(error.message,true);if(!window.CaravelaControlSession?.authenticated)$("cc-partners-auth").hidden=false}
finally{busy=false}}
$("cc-partners-refresh").onclick=load;
$("cc-partners-connect").onclick=()=>{const input=$("cc-partners-token");if(!window.CaravelaPartnershipTransport?.setToken(input.value))return message("Token inválido ou incompleto.",true);input.value="";load()};
$("cc-partners-new").onclick=()=>editPartner(null);
$("cc-partners-cancel").onclick=()=>{$("cc-partners-form").hidden=true;editing=""};
$("cc-partners-search").oninput=render;$("cc-partners-filter").onchange=render;
$("cc-partners-form").onsubmit=async e=>{
e.preventDefault();if(busy)return;
const record=Object.fromEntries(names.map(key=>[key,$("cc-p-"+key).value]));if(editing)record.id=editing;
if(["sent_verified","confirmed"].includes(record.stage)&&(!record.evidence_reference||!["sent_message","received_message","agreement"].includes(record.evidence_type))){$("cc-partners-form-status").textContent="Para validar envio/parceria, identifica a prova e referência.";return}
busy=true;$("cc-partners-form-status").textContent="A guardar...";
try{await api(editing?"PATCH":"POST",record);busy=false;$("cc-partners-form").hidden=true;editing="";await load()}
catch(error){busy=false;$("cc-partners-form-status").textContent=error.message}};
$("cc-partners-import").onchange=async e=>{
const file=e.target.files?.[0];if(!file||busy)return;
try{if(file.size>80000)throw Error("O ficheiro deve ter menos de 80 KB.");
const data=JSON.parse(await file.text());if(data.schema!=="caravela.partnerships.review.v1"||!Array.isArray(data.partners)||data.partners.length<1||data.partners.length>40)throw Error("Levantamento inválido.");
if(!confirm("Importar "+data.partners.length+" oportunidades para revisão? Não serão apagados registos anteriores."))return;
busy=true;let added=0,skipped=0;const normalized=name=>String(name||"").trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-PT");
const seen=new Set(partners.map(p=>normalized(p.name)));
for(let i=0;i<data.partners.length;i++){let row=data.partners[i];message("A importar "+(i+1)+"/"+data.partners.length);
if(seen.has(normalized(row.name))){skipped++;continue}
try{await api("POST",row);added++;seen.add(normalized(row.name))}
catch(error){if(/partnership_already_exists/.test(error.message))skipped++;else throw Error("Ficha "+(i+1)+": "+error.message)}}
busy=false;await load();message("Importação concluída: "+added+" novas; "+skipped+" existentes. Estados referidos permanecem por validar.")}
catch(error){busy=false;message(error.message,true)}finally{e.target.value=""}};
window.addEventListener("caravela-control-partnerships-opened",load);
window.addEventListener("caravela-control-signed-out",()=>{partners=[];syncEditControls();render()});
window.addEventListener("caravela-control-authenticated",()=>{syncEditControls();render()});
syncEditControls();render();
})();