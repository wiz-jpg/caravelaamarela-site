/* Caravela Control Preview — no user data is uploaded, persisted, logged or embedded. */
(() => {
  "use strict";
  const logic=window.CaravelaCRMLogic;
  if(!logic)return;
  const $=id=>document.getElementById(id);
  const source=$("source-file"), tokenField=$("admin-token"), scanButton=$("scan-mail");
  const search=$("search"),kind=$("kind"),filter=$("filter");
  let manifest=null, reconciled=null, visible=50;
  const MAILBOX="booking@caravelaamarela.com";
  const fmt=new Intl.NumberFormat("pt-PT");
  const date=x=>typeof x==="number"&&Number.isFinite(x)?new Date(x).toLocaleDateString("pt-PT"):"—";
  function status(id,message,isError=false) {
    const el=$(id);el.textContent=message;el.classList.toggle("error",isError);
    el.classList.toggle("ok",!isError&&message.startsWith("Concluído"));
  }
  function setText(el,value){el.textContent=value===null||value===undefined||value===""?"—":String(value);}
  function cell(row,contents,classname) {
    const td=document.createElement("td");
    if(classname)td.className=classname;
    if(typeof contents==="string")setText(td,contents);
    else contents(td);
    row.appendChild(td);
  }
  function operationalActionsFor(entity) {
    return (manifest?.actions||[]).filter(action=>
      action.matched_entity_id===entity.id ||
      (Array.isArray(action.candidate_entity_ids) && action.candidate_entity_ids.includes(entity.id))
    );
  }
  function blockedActionsFor(entity) {
    return operationalActionsFor(entity).filter(action=>
      action.contact_policy==="blocked" || action.status==="Não avançar");
  }
  function renderStats() {
    $("stat-records").textContent=manifest?fmt.format(manifest.entities.length):"—";
    $("stat-mails").textContent=reconciled?fmt.format(reconciled.classified.length):"—";
    $("stat-matched").textContent=reconciled?fmt.format(reconciled.totals.unique):"—";
    $("stat-ambiguous").textContent=reconciled?fmt.format(reconciled.totals.ambiguous):"—";
    $("stat-review").textContent=manifest?fmt.format(manifest.entities.filter(e=>e.review_required).length):"—";
  }
  function currentRows() {
    if(!manifest)return [];
    const query=search.value.trim().toLocaleLowerCase("pt-PT");
    return manifest.entities.filter(e=>{
      if(kind.value!=="all"&&kind.value!==e.kind)return false;
      if(query&&!([e.name,e.city,...e.emails].join(" ").toLocaleLowerCase("pt-PT").includes(query)))return false;
      const stats=reconciled?.perEntity.get(e.id);
      const mode=filter.value;
      if(mode==="matched"&&!(stats&&(stats.sent||stats.received)))return false;
      if(mode==="sent"&&!(stats&&stats.sent))return false;
      if(mode==="review"&&!e.review_required)return false;
      if(mode==="shared"&&!e.shared_email)return false;
      if(mode==="missing"&&e.emails.length)return false;
      if(mode==="followup"&&!logic.followUpCandidate(e,stats))return false;
      return true;
    });
  }
  function render() {
    $("filters").style.display=manifest?"block":"none";
    renderStats();
    if(!manifest)return;
    const list=currentRows();
    $("result-total").textContent=fmt.format(list.length)+" registos nesta seleção. Apenas os primeiros "+Math.min(visible,list.length)+" são apresentados.";
    const tbody=$("results-body");tbody.replaceChildren();
    const fragment=document.createDocumentFragment();
    for(const e of list.slice(0,visible)) {
      const row=document.createElement("tr");
      cell(row,td=>{
        const name=document.createElement("div");name.className="name";
        setText(name,e.name);td.appendChild(name);
        const origin=document.createElement("small");
        setText(origin,e.kind+" · "+(e.city||"—")+" · "+e.origin.file+" / "+e.origin.sheet+" / "+e.origin.row);
        td.appendChild(origin);
      });
      cell(row,e.emails.length?e.emails.join(", "):"Sem email na fonte");
      cell(row,td=>{
        const original=document.createElement("div");
        setText(original,"Planeamento 2027 (fonte): "+(e.status_2027||e.contacted_source||"Sem estado específico"));
        td.appendChild(original);
        const related=operationalActionsFor(e);
        const blocked=related.filter(action=>action.contact_policy==="blocked"||action.status==="Não avançar");
        for(const action of blocked.slice(0,3)){
          const p=document.createElement("div");
          p.className="flag";
          setText(p,"NÃO AVANÇAR · "+(action.artist||"Artista não indicado")+
            " — decisão registada no Caravela Control (ligação da entidade a confirmar)");
          td.appendChild(p);
        }
        if(related.length&&!blocked.length) {
          const operational=document.createElement("small");
          setText(operational,"AÇÕES operacionais relacionadas: "+
            related.slice(0,3).map(a=>(a.artist||"Artista não indicado")+": "+a.status).join(" · ")+
            (related.length>3?" +"+(related.length-3):"")+
            " (correspondência a confirmar)");
          td.appendChild(operational);
        }
        if(e.control_action) {
          const control=document.createElement("small");
          setText(control,"Control operacional (a verificar no Zoho): "+
            e.control_action.status+" · "+(e.control_action.last_contact_iso||e.control_action.last_contact||"sem data"));
          td.appendChild(control);
        }
        if(e.historical) {
          const hist=document.createElement("small");setText(hist,"Histórico: "+e.historical.slice(0,260));
          td.appendChild(hist);
        }
      });
      cell(row,td=>{
        const activity=reconciled?.perEntity.get(e.id);
        const top=document.createElement("div");
        setText(top,activity?(activity.sent+" envios encontrados · "+activity.received+" entradas encontradas"):"Ainda não analisado");
        td.appendChild(top);
        if(activity&&(activity.last_sent||activity.last_received)){
          const last=document.createElement("small");
          setText(last,"Último envio: "+date(activity.last_sent)+" | Última entrada: "+date(activity.last_received));
          td.appendChild(last);
        }
      });
      cell(row,td=>{
        const warnings=[];
        if(e.suppressed)warnings.push("Não contactar");
        const operationalBlocks=blockedActionsFor(e);
        if(operationalBlocks.length)warnings.push("Não avançar: "+
          [...new Set(operationalBlocks.map(a=>a.artist||"artista não indicado"))].join(", ")+
          " (AÇÕES; rever associação)");
        else if(e.control_blocked_possible)warnings.push("Possível bloqueio operacional; rever");
        if(e.shared_email)warnings.push("Email partilhado");
        if(e.review_required)warnings.push("Rever fonte");
        const stat=reconciled?.perEntity.get(e.id);
        if(logic.followUpCandidate(e,stat))warnings.push("Avaliar follow-up");
        const flag=document.createElement("div");flag.className=warnings.length?"flag":"";
        setText(flag,warnings.join(" · ")||"Sem alertas adicionais");
        td.appendChild(flag);
        if(e.verification){const small=document.createElement("small");setText(small,e.verification);td.appendChild(small);}
      });
      fragment.appendChild(row);
    }
    tbody.appendChild(fragment);
    $("load-more").disabled=visible>=list.length;
    $("export-review").disabled=!reconciled;
  }
  source.addEventListener("change",async()=>{
    const file=source.files?.[0];
    if(!file)return;
    manifest=null;reconciled=null;visible=50;scanButton.disabled=true;
    status("file-status","A validar os contactos…");
    try {
      if(file.size>12*1024*1024)throw new Error("O ficheiro ultrapassa o limite de 12 MB.");
      const contents=JSON.parse(await file.text());
      const candidate=logic.validateImport(contents);
      // Verify full source snapshot integrity before trusting imported state.
      const digestCopy={...contents};
      delete digestCopy.manifest_sha256;
      const bytes=new TextEncoder().encode(JSON.stringify(digestCopy));
      const digest=await crypto.subtle.digest("SHA-256",bytes);
      const fingerprint=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
      if(fingerprint!==contents.manifest_sha256)throw new Error("O ficheiro foi alterado ou ficou incompleto (SHA-256 não coincide).");
      manifest=candidate;
      window.dispatchEvent(new CustomEvent("caravela-crm-imported",{detail:{manifest}}));
      // Preview is local only: no fetch/upload of the import JSON.
      scanButton.disabled=false;
      status("file-status","Concluído: "+fmt.format(manifest.entities.length)+
        " registos, "+fmt.format(manifest.summary.shared_emails||0)+
        " emails partilhados. Nenhum dado foi enviado ao servidor.");
      status("mail-status","Contactos prontos. Introduz o token administrativo e carrega em «Analisar histórico Zoho».");
    } catch(error) {
      status("file-status",error.message||"O ficheiro não foi aceite.",true);
    }
    render();
  });
  for(const control of [search,kind,filter])control.addEventListener(control===search?"input":"change",()=>{visible=50;render();});
  $("load-more").addEventListener("click",()=>{visible+=50;render();});
  function zohoFolderKind(folder) {
    const names=[folder.folderType,folder.folderName,folder.name].filter(Boolean)
      .map(x=>String(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase());
    if(names.some(n=>["inbox","caixa de entrada","recebidos"].includes(n)))return "incoming";
    if(names.some(n=>["sent","sent items","enviados","enviadas"].includes(n)))return "outgoing";
    return "";
  }
  scanButton.addEventListener("click",async()=>{
    if(!manifest||scanButton.disabled)return;
    const token=tokenField.value.trim();tokenField.value="";
    if(!token)return status("mail-status","Introduz o token administrativo.",true);
    scanButton.disabled=true;
    const limit=Number($("mail-limit").value)||200;
    const opts={method:"GET",headers:{Authorization:"Bearer "+token},cache:"no-store",
      credentials:"same-origin",redirect:"error"};
    async function fromAPI(path) {
      const response=await fetch(path,opts);
      let data;
      try{data=await response.json();}catch{throw new Error("A API Zoho devolveu uma resposta inválida.");}
      if(!response.ok){
        if(data.error==="unauthorized")throw new Error("Token administrativo incorreto.");
        if(data.error==="reauthorization_required")throw new Error("É necessária uma nova autorização Zoho.");
        if(data.error==="not_connected")throw new Error("A conta Zoho ainda não está ligada.");
        throw new Error("Zoho recusou a leitura ("+response.status+"; "+String(data.error||"erro") +").");
      }
      return data;
    }
    try {
      status("mail-status","A confirmar a autorização e as pastas do Zoho…");
      const info=await fromAPI("/api/zoho/status");
      if(!info.connected||info.mailbox!==MAILBOX)throw new Error("Caixa de booking não está autorizada.");
      const result=await fromAPI("/api/zoho/folders");
      const folders=Array.isArray(result.data)?result.data:result.folders;
      if(!Array.isArray(folders))throw new Error("Resposta de pastas inválida.");
      const targets=[{kind:"incoming",label:"Recebidos"},{kind:"outgoing",label:"Enviados"}];
      const messages=[];
      const counts={incoming:0,outgoing:0};
      for(const target of targets) {
        const folder=folders.find(f=>zohoFolderKind(f)===target.kind);
        if(!folder)throw new Error("Não foi encontrada a pasta "+target.label+".");
        const folderId=String(folder.folderId||folder.id||"");
        if(!/^\d{1,30}$/.test(folderId))throw new Error("Identificador de pasta inválido.");
        for(let start=1;start<=limit;start+=50) {
          const batchSize=Math.min(50,limit-start+1);
          status("mail-status","A consultar "+target.label+": "+counts[target.kind]+" mensagens até agora…");
          const params=new URLSearchParams({folderId,start:String(start),limit:String(batchSize)});
          const data=await fromAPI("/api/zoho/messages?" + params); // replaced below with actual route
          const items=Array.isArray(data.data)?data.data:data.messages;
          if(!Array.isArray(items))throw new Error("O Zoho devolveu uma lista de mensagens inválida.");
          for(const message of items) messages.push({direction:target.kind,message});
          counts[target.kind]+=items.length;
          if(items.length<batchSize)break;
        }
      }
      reconciled=logic.reconcile(manifest,messages);
      visible=50;
      render();
      status("mail-status","Concluído: "+counts.incoming+" recebidos e "+counts.outgoing+
        " enviados consultados. "+reconciled.totals.unique+
        " correspondências inequívocas, "+reconciled.totals.ambiguous+
        " mensagens ambíguas. Sem alterações no Zoho ou nos Sheets.");
    }catch(error) {
      status("mail-status",error.message||"Não foi possível concluir a análise.",true);
    }finally{scanButton.disabled=false;}
  });
  $("export-review").addEventListener("click",()=>{
    if(!manifest||!reconciled)return;
    const payload=logic.exportReview(manifest,reconciled);
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="caravela_crm_auditoria.json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  render();
})();
