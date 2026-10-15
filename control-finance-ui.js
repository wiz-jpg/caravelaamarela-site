/* Agency finances. Private Preview, manual ledger; no invoicing or banking claims. */
(()=>{"use strict";
const root=document.getElementById("cc-view-finance");if(!root)return;
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const fmt=value=>Number(value||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"});
const types={income:"Entrada",expense:"Despesa"};
const categories={agency_commission:"Comissão da Caravela",creative_service:"Serviço criativo",other_income:"Outra receita",
 travel:"Deslocação",production:"Produção",marketing:"Comunicação",other_expense:"Outra despesa"};
const statuses={planned:"Previsto",due:"Por receber / pagar",settled:"Liquidado",cancelled:"Cancelado"};
let rows=[],bookings=[],busy=false,editing=null;
const panel=el("section",undefined,"cc-finance");
panel.innerHTML='<div class="cc-finance-head"><div><h2>Controlo financeiro</h2><p class="cc-lead">Dinheiro da agência, não cachets totais dos artistas. Registos manuais, sem ligação bancária ou emissão de faturas.</p></div><button class="cc-primary" id="cc-finance-new" type="button">+ Movimento</button></div>'+
'<div id="cc-finance-metrics" class="cc-finance-metrics" aria-live="polite"></div>'+
'<div class="cc-finance-tools"><label>Pesquisar <input type="search" id="cc-finance-search" placeholder="Artista, entidade, responsável..."></label><label>Estado <select id="cc-finance-filter"><option value="all">Todos</option><option value="due">Por receber / pagar</option><option value="planned">Previstos</option><option value="settled">Liquidados</option></select></label></div>'+
'<p id="cc-finance-status" class="status" role="status"></p><div id="cc-finance-editor" hidden></div><div id="cc-finance-list"></div>'+
'<details class="cc-archive-toggle"><summary>Como interpretar estes valores</summary><p class="cc-finance-help">O cachet é o valor acordado com o artista/promotor; não é automaticamente receita da agência. Regista como entrada apenas a comissão que cabe à Caravela ou um serviço faturável da agência. Despesas devem ser registadas separadamente. Valores liquidados requerem data e comprovativo manual. O estado é declarado pela equipa, não confirmado pelo banco.</p></details>';
root.append(panel);
const money=(value)=>Math.round(Number(value)*100)/100;
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
async function call(kind,method,data){
 const t=window.CaravelaNativeTransport;
 if(!t)throw Error("Sessão de trabalho indisponível.");
 const res=await t.request(kind,method,data),json=await res.json();
 if(!res.ok)throw Error(({invalid_record:"Confirma campos, montante e comprovativos.",revision_conflict:"Este registo mudou noutra sessão. Atualiza antes de guardar.",finance_booking_not_found:"A proposta associada não existe.",finance_artist_mismatch:"O artista não coincide com a proposta associada."})[json.error]||json.error||"HTTP "+res.status);
 return json;
}
function render(){
 const box=$("cc-finance-metrics");box.replaceChildren();
 const totals=[
  ["A receber",rows.filter(x=>x.type==="income"&&x.status==="due").reduce((a,x)=>a+x.amount,0)],
  ["Recebido",rows.filter(x=>x.type==="income"&&x.status==="settled").reduce((a,x)=>a+x.amount,0)],
  ["A pagar",rows.filter(x=>x.type==="expense"&&x.status==="due").reduce((a,x)=>a+x.amount,0)],
  ["Pago",rows.filter(x=>x.type==="expense"&&x.status==="settled").reduce((a,x)=>a+x.amount,0)]
 ];
 for(const [label,value] of totals){const c=el("div",undefined,"cc-finance-metric");c.append(el("small",label),el("strong",fmt(value)));box.append(c);}
 const q=$("cc-finance-search").value.trim().toLocaleLowerCase("pt-PT"),status=$("cc-finance-filter").value;
 const list=$("cc-finance-list");list.replaceChildren();
 const selected=rows.filter(x=>(status==="all"||x.status===status)&&
  (!q||[x.title,x.artist,x.owner,x.category_note].join(" ").toLocaleLowerCase("pt-PT").includes(q)));
 if(!selected.length)list.append(el("p","Sem movimentos neste filtro. Cria um registo apenas quando existir um valor concreto a acompanhar.","cc-notice"));
 for(const x of selected){
  const card=el("article",undefined,"cc-finance-card");
  const header=el("div",undefined,"cc-finance-item-head");header.append(el("strong",x.title),el("span",statuses[x.status],"cc-native-stage"));card.append(header);
  const detail=el("p",types[x.type]+" · "+categories[x.category]+" · "+(x.artist||"Caravela")+(x.due_date?" · "+x.due_date:""),"cc-finance-detail");
  const amount=el("div",fmt(x.amount),x.type==="income"?"cc-finance-positive":"cc-finance-negative");
  card.append(detail,amount);
  if(x.owner)card.append(el("small","Responsável: "+x.owner));
  const act=el("button","Editar","cc-neutral");act.type="button";act.onclick=()=>openEditor(x);card.append(act);list.append(card);
 }
}
function addField(form,key,title,type,options,required=false){
 const label=el("label",title);const field=el(type==="select"?"select":"input");
 field.name=key;field.id="cc-finance-"+key;field.required=required;
 if(type==="select")for(const [value,name] of Object.entries(options)){const option=el("option",name);option.value=value;field.append(option)}
 else{field.type=type;if(type==="number"){field.min="0.01";field.step="0.01";field.max="10000000"}}
 label.append(field);form.append(label);return field;
}
function openEditor(entry=null){
 editing=entry;const shell=$("cc-finance-editor");shell.replaceChildren();shell.hidden=false;
 const form=el("form",undefined,"cc-finance-form");
 form.append(el("h3",entry?"Editar movimento":"Novo movimento"));
 const fields={};
 fields.title=addField(form,"title","Descrição","text",null,true);
 fields.type=addField(form,"type","Natureza","select",types,true);
 fields.category=addField(form,"category","Categoria","select",categories,true);
 fields.amount=addField(form,"amount","Montante (€)","number",null,true);
 fields.status=addField(form,"status","Situação","select",statuses,true);
 fields.artist=addField(form,"artist","Artista / projeto","text");
 fields.booking_id=addField(form,"booking_id","Associar a booking","select",{"":"Sem associação",...Object.fromEntries(bookings.map(x=>[x.id,x.contact_name+" · "+x.artist+" · "+x.subject]))});
 fields.due_date=addField(form,"due_date","Vencimento","date");
 fields.settled_date=addField(form,"settled_date","Data de liquidação","date");
 fields.reference=addField(form,"reference","Referência do comprovativo","text");
 fields.owner=addField(form,"owner","Responsável","text");
 fields.category_note=addField(form,"category_note","Nota de categoria","text");
 fields.notes=addField(form,"notes","Notas internas","text");
 for(const [key,input] of Object.entries(fields))input.value=entry?.[key]??({type:"income",category:"agency_commission",status:"planned"}[key]||"");
 const hint=el("p","Seleciona «Liquidado» apenas quando confirmaste manualmente o pagamento. Nesse estado, data e referência são obrigatórias.","cc-lead");
 form.append(hint);
 const save=el("button","Guardar movimento","cc-primary");save.type="submit";
 const cancel=el("button","Cancelar","cc-neutral");cancel.type="button";cancel.onclick=()=>{shell.hidden=true;shell.replaceChildren()};
 const buttons=el("div",undefined,"cc-actions");buttons.append(save,cancel);form.append(buttons);
 const feedback=el("p",undefined,"status");feedback.setAttribute("role","status");form.append(feedback);
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const record=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value.trim()]));
  record.amount=money(record.amount);record.currency="EUR";
  if(entry){record.id=entry.id;record.revision=entry.revision}
  if(record.status==="settled"&&(!record.settled_date||!record.reference)){feedback.textContent="Indica a data e referência da liquidação.";return}
  busy=true;save.disabled=true;feedback.textContent="A guardar...";
  try{await call("finance",entry?"PATCH":"POST",record);shell.hidden=true;shell.replaceChildren();await load();$("cc-finance-status").textContent="Movimento guardado com histórico de alterações."}
  catch(err){feedback.textContent=err.message}
  finally{busy=false;save.disabled=false}
 };
 shell.append(form);shell.scrollIntoView({behavior:"smooth",block:"start"});
}
async function load(){
 try{const [finance,booking]=await Promise.all([call("finance","GET"),call("booking","GET")]);rows=finance.records||[];bookings=booking.records||[];render();$("cc-finance-status").textContent="Movimentos manuais guardados no D1."}
 catch(err){$("cc-finance-status").textContent="Não foi possível consultar as finanças: "+err.message}
}
$("cc-finance-new").onclick=()=>openEditor();
$("cc-finance-search").oninput=render;$("cc-finance-filter").onchange=render;
window.addEventListener("caravela-control-view-opened",e=>{if(e.detail?.view==="finance")void load()});
window.addEventListener("caravela-control-signed-out",()=>{rows=[];bookings=[];render()});
render();
})();