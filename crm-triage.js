/* Private Zoho triage V3: static UI, data rendered only via textContent. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const footer=document.querySelector("footer");
if(!footer)return;
const section=document.createElement("section");
section.className="results";
section.id="crm-triage";
section.hidden=true;
section.innerHTML=
'<h2>Endereços Zoho por identificar — revisão privada</h2>'+
'<p class="muted" id="triage-summary"></p>'+
'<p class="note">Fotografia das 1000 mensagens analisadas. Mensagens recebidas não provam resposta a propostas. Ninguém nesta lista está autorizado para envio.</p>'+
'<div class="toolbar">'+
'<div><label for="triage-search">Pesquisar endereço ou ação</label><input type="search" id="triage-search" placeholder="Email, entidade, artista"></div>'+
'<div><label for="triage-group">Categoria</label><select id="triage-group">'+
'<option value="all">Todas</option><option value="existing_operational_action">Já nas ações</option>'+
'<option value="shared_ambiguous">Partilhados / ambíguos</option>'+
'<option value="artists_or_partners">Artistas / parceiros</option>'+
'<option value="possible_booking_or_other_business">Possível booking ou outros</option>'+
'<option value="possible_press">Possível imprensa</option>'+
'<option value="technical_automated">Técnico / administrativo</option>'+
'<option value="internal_or_own">Contas internas</option>'+
'<option value="unclassified_manual">Outros para revisão</option>'+
'</select></div>'+
'<div><label for="triage-priority">Revisão</label><select id="triage-priority">'+
'<option value="all">Todas</option><option value="high">Mais importantes</option>'+
'<option value="normal">Restantes</option></select></div></div>'+
'<p class="muted" id="triage-count"></p>'+
'<div class="tableWrap"><table><thead><tr>'+
'<th>Endereço</th><th>Emails observados</th><th>Ação Caravela / artista</th>'+
'<th>Fontes adicionais</th><th>Validação</th>'+
'</tr></thead><tbody id="triage-body"></tbody></table></div>'+
'<div class="actions"><button type="button" class="secondary" id="triage-more">Mostrar mais</button></div>';
footer.before(section);
const labels={
existing_operational_action:"Já nas ações operacionais",
shared_ambiguous:"Partilhado ou ambíguo",
artists_or_partners:"Artista / parceiro a confirmar",
possible_booking_or_other_business:"Possível booking ou outro contacto",
possible_press:"Possível imprensa",
technical_automated:"Técnico / administrativo",
internal_or_own:"Interno ou próprio",
unclassified_manual:"Sem classificação"
};
let records=[],shown=50;
const fmt=n=>new Intl.NumberFormat("pt-PT").format(n||0);
function put(target,val,classname) {
const p=document.createElement("div");
p.textContent=val===null||val===undefined||val===""?"—":String(val);
if(classname)p.className=classname;
target.appendChild(p);
}
function render(){
const term=$("triage-search").value.toLocaleLowerCase("pt-PT").trim();
const kind=$("triage-group").value;
const priority=$("triage-priority").value;
const chosen=records.filter(r=>{
if(kind!=="all"&&r.group!==kind)return false;
if(priority!=="all"&&r.review_priority!==priority)return false;
if(!term)return true;
return [r.address,...r.operational_action_refs.map(a=>a.name+" "+a.artist+" "+a.status),
...r.canonical_candidates.map(a=>a.name),...r.curated_media_refs]
.join(" ").toLocaleLowerCase("pt-PT").includes(term);
});
const frag=document.createDocumentFragment();
for(const r of chosen.slice(0,shown)){
const tr=document.createElement("tr");
const cells=Array.from({length:5},()=>document.createElement("td"));
put(cells[0],r.address,"name");
put(cells[0],labels[r.group]||"Rever","muted");
if(r.review_priority==="high")put(cells[0],"Rever primeiro","flag");
put(cells[1],fmt(r.sent)+" enviados · "+fmt(r.received)+" recebidos");
if(r.last_seen)put(cells[1],"Última ocorrência: "+new Date(r.last_seen).toLocaleDateString("pt-PT"),"muted");
for(const action of r.operational_action_refs.slice(0,4))put(cells[2],
action.name+" · "+action.artist+" · "+action.status+" [AÇÕES, linha "+action.action_origin_row+"]",
action.contact_policy==="blocked"||action.status==="Não avançar"?"flag":"");
if(!r.operational_action_refs.length)put(cells[2],"Sem ligação operacional segura","muted");
if(r.canonical_candidates.length)put(cells[2],
r.canonical_candidates.map(c=>c.name).join("; ")+" (candidatos; associação por validar)","muted");
if(r.curated_media_refs.length)put(cells[3],"Imprensa: "+r.curated_media_refs.join("; "));
if(r.legacy_source_ref_count)put(cells[3],
fmt(r.legacy_source_ref_count)+" referência(s) históricas, não confirmadas","muted");
if(!r.curated_media_refs.length&&!r.legacy_source_ref_count)put(cells[3],"Por confirmar","muted");
put(cells[4],r.classification==="ambiguous"?"Ambíguo":"Revisão humana","flag");
put(cells[4],"Não aprovado para envio","muted");
for(const c of cells)tr.appendChild(c);
frag.appendChild(tr);
}
$("triage-body").replaceChildren(frag);
$("triage-count").textContent=fmt(chosen.length)+" endereços · "+fmt(Math.min(shown,chosen.length))+" visíveis";
$("triage-more").disabled=shown>=chosen.length;
}
for(const name of ["triage-search","triage-group","triage-priority"])
$(name).addEventListener(name==="triage-search"?"input":"change",()=>{shown=50;render()});
$("triage-more").addEventListener("click",()=>{shown+=50;render()});
window.addEventListener("caravela-crm-imported",event=>{
const data=event.detail?.manifest;
const t=data?.zoho_triage;
if(!t||t.schema!=="caravela.crm.triage.enriched.v1"||
!Array.isArray(t.addresses)||t.address_count!==t.addresses.length){
records=[];section.hidden=true;return;
}
records=t.addresses;
shown=50;section.hidden=false;
$("triage-summary").textContent=fmt(records.length)+" endereços · "+
fmt(data.summary.zoho_triage_action_address_matches)+" já constam das ações · "+
fmt(data.summary.zoho_triage_groups.shared_ambiguous)+" partilhados / ambíguos · "+
fmt(data.summary.zoho_triage_groups.technical_automated)+" técnicos / administrativos.";
render();
});
})();