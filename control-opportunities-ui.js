/* Radar da Caravela: official discovery sources + human-managed calls.
 * No background scraping, no inferred open status, no application submission. */
(()=>{"use strict";
 const view=document.getElementById("cc-view-opportunities");if(!view)return;
 const mk=(tag,t,cls)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=t;if(cls)x.className=cls;return x};
 const official=[
  {title:"DGARTES · Apoio a Projetos – Internacionalização",provider:"DGARTES",
   kind:"international",url:"https://www.dgartes.gov.pt/pt/apoio/9487",
   note:"O concurso de 2026 já teve decisão final. Verificar novo aviso e elegibilidade antes de planear qualquer candidatura.",
   tags:"internacionalização música circulação projetos"},
  {title:"DGARTES · Concursos e candidaturas",provider:"DGARTES",kind:"grant",
   url:"https://www.dgartes.gov.pt/pt/vnode/1",
   note:"Consulta geral de avisos oficiais. Nem todos os concursos se aplicam a bandas de rock ou a pessoas singulares.",
   tags:"candidaturas avisos apoio financeiro música"},
  {title:"Fundação GDA · Showcases Internacionais",provider:"Fundação GDA",kind:"showcase",
   url:"https://www.fundacaogda.pt/internacionalizacao/showcases-internacionais/",
   note:"Programa para apresentação em festivais internacionais de showcase. Confirmar orçamento disponível e regras atuais.",
   tags:"showcase internacional música bandas"},
  {title:"Europa Criativa Portugal · Concursos",provider:"Europa Criativa Portugal",
   kind:"international",url:"https://europacriativa.eu/",
   note:"Pesquisar concursos de cultura e mobilidade e ler critérios específicos antes de candidatar.",
   tags:"mobilidade culture moves europe financiamento circulação"},
  {title:"Culture Moves Europe",provider:"Comissão Europeia",
   kind:"international",url:"https://culture.ec.europa.eu/culture-moves-europe",
   note:"Fonte europeia de oportunidades de mobilidade; confirmar elegibilidade e calendário na convocatória oficial.",
   tags:"europa mobilidade profissionais artistas"}
 ];
 const kindLabels={international:"Internacionalização / mobilidade",grant:"Apoio / financiamento",
  showcase:"Showcase",contest:"Concurso",program:"Programa",other:"Outro"};
 const states={research:"A investigar",interesting:"Relevante",preparing:"A preparar candidatura",
  submitted:"Submetida (declarado)",awarded:"Aprovada (declarado)",declined:"Recusada",closed:"Fechada / arquivada"};
 const box=mk("div",undefined,"cc-radar");
 box.append(mk("h2","Radar de oportunidades"),
  mk("p","Encontrar apoios, showcases e candidaturas relevantes para o roster. As fontes são pontos de pesquisa, não provas de candidaturas abertas.","cc-lead"));
 const tools=mk("div",undefined,"cc-radar-tools");
 const query=mk("input");query.type="search";query.placeholder="Pesquisar apoios, programas, países, artistas…";
 query.setAttribute("aria-label","Pesquisar fontes e oportunidades");
 const create=mk("button","+ Guardar oportunidade","cc-primary");create.type="button";
 const reload=mk("button","Atualizar registos","cc-neutral");reload.type="button";
 tools.append(query,create,reload);box.append(tools);
 const sources=mk("section",undefined,"cc-radar-sources");
 sources.append(mk("h3","Fontes para procurar"));
 const sourceList=mk("div",undefined,"cc-radar-grid");sources.append(sourceList);
 const tracked=mk("section",undefined,"cc-radar-tracked");
 tracked.append(mk("h3","Oportunidades guardadas"));
 const status=mk("p","","cc-lead");status.setAttribute("role","status");
 const trackedList=mk("div",undefined,"cc-radar-grid");tracked.append(status,trackedList);
 const editShell=mk("div",undefined,"cc-radar-editor");editShell.hidden=true;
 box.append(sources,tracked,editShell);
 view.querySelector(".cc-panel-head")?.after(box);
 let rows=[],busy=false,ready=false;
 const search=()=>query.value.trim().toLocaleLowerCase("pt-PT");
 const includes=(s,q)=>!q||s.toLocaleLowerCase("pt-PT").includes(q);
 function externalLink(url,label){
  const a=mk("a",label,"cc-radar-source-link");
  a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;
 }
 function render(){
  const q=search();sourceList.replaceChildren();trackedList.replaceChildren();
  const matches=official.filter(s=>includes([s.title,s.provider,s.note,s.tags].join(" "),q));
  for(const source of matches){
   const card=mk("article",undefined,"cc-radar-item");
   card.append(mk("strong",source.title),mk("small",kindLabels[source.kind]),
    mk("p",source.note,"cc-lead"));
   const acts=mk("div",undefined,"cc-radar-actions");
   acts.append(externalLink(source.url,"Consultar fonte oficial"));
   const capture=mk("button","Registar oportunidade","cc-neutral");capture.type="button";
   capture.onclick=()=>edit({title:source.title,provider:source.provider,kind:source.kind,
    source_url:source.url,status:"research"});
   acts.append(capture);card.append(acts);sourceList.append(card);
  }
  if(!matches.length)sourceList.append(mk("p","Nenhuma fonte coincide com a pesquisa.","cc-lead"));
  const filtered=rows.filter(r=>includes([r.title,r.provider,r.artist,r.country,r.next_step,
    r.status,r.notes,r.eligibility_note].join(" "),q));
  const sorted=filtered.sort((a,b)=>{
   const live=x=>["closed","declined","awarded"].includes(x.status)?1:0;
   return live(a)-live(b)||(a.review_date||a.deadline||"9999").localeCompare(b.review_date||b.deadline||"9999")||
     a.title.localeCompare(b.title,"pt-PT")
  });
  for(const row of sorted){
   const card=mk("article",undefined,"cc-radar-item cc-radar-saved");
   card.append(mk("strong",row.title),mk("small",row.provider+" · "+(kindLabels[row.kind]||row.kind)));
   const flag=mk("span",states[row.status]||row.status,"cc-radar-state");card.append(flag);
   if(row.artist)card.append(mk("small","Artista: "+row.artist));
   if(row.deadline)card.append(mk("small","Prazo registado: "+row.deadline));
   if(row.review_date)card.append(mk("small","Rever: "+row.review_date));
   if(row.verified_on)card.append(mk("small","Fonte confirmada pela equipa em: "+row.verified_on));
   card.append(mk("p",row.next_step,"cc-lead"));
   const acts=mk("div",undefined,"cc-radar-actions");
   acts.append(externalLink(row.source_url,"Consultar fonte"));
   const button=mk("button","Editar acompanhamento","cc-neutral");button.type="button";
   button.onclick=()=>edit(row);acts.append(button);card.append(acts);trackedList.append(card);
  }
  if(!sorted.length)trackedList.append(mk("p","Ainda não há oportunidades guardadas neste filtro. Regista uma candidatura apenas depois de confirmar a fonte.","cc-lead"));
  if(ready)status.textContent=rows.length+" oportunidades operacionais guardadas. Não existem candidaturas submetidas automaticamente.";
 }
 function field(form,name,title,type="text",opts=null,val=""){
  const label=mk("label",title),element=mk(type==="select"?"select":type==="textarea"?"textarea":"input");
  element.name=name;if(!["select","textarea"].includes(type))element.type=type;
  if(type==="select")for(const [v,l] of Object.entries(opts||{})){
   const opt=mk("option",l);opt.value=v;element.append(opt);
  }
  element.value=val||"";label.append(element);form.append(label);return element;
 }
 function edit(entry={}){
  editShell.hidden=false;editShell.replaceChildren();
  const form=mk("form",undefined,"cc-radar-form");
  form.append(mk("h3",entry.revision?"Editar oportunidade":"Nova oportunidade"));
  field(form,"title","Oportunidade / programa","text",null,entry.title).required=true;
  field(form,"provider","Entidade responsável","text",null,entry.provider).required=true;
  field(form,"kind","Categoria","select",kindLabels,entry.kind||"international");
  field(form,"source_url","Link oficial de referência","url",null,entry.source_url).required=true;
  field(form,"artist","Artista / projeto (se aplicável)","text",null,entry.artist);
  field(form,"country","País / território","text",null,entry.country);
  field(form,"status","Estado confirmado pela equipa","select",states,entry.status||"research");
  field(form,"deadline","Prazo do edital (se confirmado)","date",null,entry.deadline);
  field(form,"review_date","Próxima revisão","date",null,entry.review_date);
  field(form,"verified_on","Data em que a equipa verificou a fonte","date",null,entry.verified_on);
  field(form,"owner","Responsável","text",null,entry.owner);
  field(form,"next_step","Próxima ação","textarea",null,entry.next_step||"Verificar elegibilidade e prazo no edital oficial").required=true;
  field(form,"eligibility_note","Requisitos / elegibilidade por confirmar","textarea",null,entry.eligibility_note);
  field(form,"notes","Notas internas","textarea",null,entry.notes);
  const buttons=mk("div",undefined,"cc-radar-actions");
  const save=mk("button","Guardar no cofre","cc-primary");save.type="submit";
  const cancel=mk("button","Cancelar","cc-neutral");cancel.type="button";cancel.onclick=()=>{
   editShell.hidden=true;editShell.replaceChildren()
  };
  buttons.append(save,cancel);
  const notice=mk("p","","cc-lead");notice.setAttribute("role","status");
  form.append(buttons,notice);
  form.onsubmit=async event=>{
   event.preventDefault();
   if(busy)return;
   const record=Object.fromEntries(new FormData(form).entries());
   if(entry.id)record.id=entry.id;
   if(entry.revision)record.revision=entry.revision;
   busy=true;save.disabled=true;notice.textContent="A guardar com histórico…";
   try{
    const t=window.CaravelaNativeTransport;
    if(!t)throw Error("Sessão privada indisponível");
    const response=await t.request("opportunities",entry.revision?"PATCH":"POST",record);
    const data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||"Registo rejeitado");
    editShell.hidden=true;editShell.replaceChildren();await load();
   }catch(e){notice.textContent="Erro: "+e.message}
   finally{busy=false;save.disabled=false}
  };
  editShell.append(form);editShell.scrollIntoView({behavior:"smooth",block:"start"});
 }
 async function load(){
  const t=window.CaravelaNativeTransport;if(!t){status.textContent="Inicia sessão para consultar as candidaturas.";return}
  status.textContent="A consultar o cofre privado…";
  try{
   const response=await t.request("opportunities","GET");
   if(!response.ok)throw Error("Acesso indisponível");
   const data=await response.json();if(!data.ok)throw Error("Leitura indisponível");
   rows=data.records||[];ready=true;render();
  }catch(e){status.textContent="Não foi possível consultar candidaturas: "+e.message}
 }
 query.oninput=render;create.onclick=()=>edit();reload.onclick=()=>void load();
 window.addEventListener("caravela-control-view-opened",e=>{if(e.detail?.view==="opportunities")void load()});
 window.addEventListener("caravela-control-token-ready",()=>void load());
 window.addEventListener("caravela-control-authenticated",()=>void load());
 window.addEventListener("caravela-control-signed-out",()=>{rows=[];ready=false;render();status.textContent="Sessão terminada";});
 render();
})();
