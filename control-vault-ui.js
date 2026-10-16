/* Caravela Control — private Preview vault controls. Secret stays in memory only. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const target=document.querySelector(".bars");
  if(!target)return;
  const area=document.createElement("section");
  area.className="panel";
  area.innerHTML=
    '<h2>Cofre permanente — Caravela Control</h2>'+
    '<p class="muted">Guarda a base original com versões recuperáveis no D1 de testes. Depois da primeira importação, abre a base guardada sem voltar a carregar JSON. Tudo exige autenticação.</p>'+
    '<div class="actions">'+
    '<button type="button" class="secondary" id="vault-status">Verificar cofre</button>'+
    '<button type="button" id="vault-save" disabled>Guardar versão importada</button>'+
    '<button type="button" class="secondary" id="vault-load">Abrir base guardada</button>'+
    '<button type="button" class="secondary" id="vault-backup">Descarregar cópia de segurança</button>'+
    '<button type="button" class="secondary" id="vault-r2-backup">Descarregar backup R2</button>'+
    '<button type="button" class="secondary" id="vault-native-export">Exportar registos operacionais</button>'+
    '<button type="button" class="secondary" id="vault-zoho">Atualizar histórico Zoho</button>'+
    '<button type="button" class="secondary" id="vault-sheets">Atualizar Google Sheets</button>'+
    '<button type="button" class="secondary" id="vault-live">Ver AÇÕES e artistas atuais</button>'+
    '</div><div class="status" id="vault-result" role="status" aria-live="polite">Base permanente ainda não verificada. Inicia sessão para consultar o cofre. No modo de transição usa o token técnico.</div>'+
    '<div id="vault-summary" class="muted"></div>'+
    '<p class="muted" style="margin-top:12px">Esta fase não substitui backups externos; a sincronização automática de Sheets e Gmail ainda exige ligações próprias. Não são efetuados envios de email.</p>';
  target.appendChild(area);
  let transientToken="",busy=false,currentFile=null;
  const PART_SIZE=128*1024;
  const hex=buf=>Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,"0")).join("");
  const hash=bytes=>crypto.subtle.digest("SHA-256",bytes).then(hex);
  function say(message,isError=false){
    const el=$("vault-result");
    el.textContent=message;
    el.classList.toggle("error",isError);
    el.classList.toggle("ok",!isError&&/^(Concluído|Cofre pronto)/.test(message));
  }
  function token(){
    const given=$("admin-token").value.trim();
    if(given){transientToken=given;$("admin-token").value="";window.dispatchEvent(new Event("caravela-control-token-ready"));}
    if(!transientToken)throw Error("Introduz o token técnico no painel Comunicações.");
    return transientToken;
  }
  async function api(path,options={}){
    const authenticated=!!window.CaravelaControlSession?.authenticated;
    const headers=authenticated
      ? {...options.headers,"X-Caravela-Request":"1"}
      : {...options.headers,Authorization:"Bearer "+token()};
    const response=await fetch("/api/control/"+path,{
      ...options,cache:"no-store",credentials:"same-origin",redirect:"error",headers
    });
    if(response.status===401){transientToken="";throw Error("Token administrativo inválido. Introduz novamente.");}
    if(response.status===503)throw Error("A migração do cofre ainda não foi aplicada ao D1 Preview.");
    if(!response.ok){
      const detail=await response.json().catch(()=>({}));
      throw Error("Operação interrompida ("+(detail.error||response.status)+"). Nenhum dado anterior foi apagado.");
    }
    return response;
  }
  // Narrow partner transport: reuse this session's in-memory admin credential.
  // No credentials are persisted in localStorage or exposed through this API.
  // One session-limited transport for private operational widgets.
  // It reuses the in-memory legacy token or individual login session.
  window.CaravelaControlRead={request(path){
    if(path!=="ops/overview")throw Error("Vista não autorizada.");
    return api(path);
  }};
  // Native contacts/booking use the same in-memory, authenticated Preview transport.
  // They cannot access arbitrary API routes or expose credentials to the UI.
  window.CaravelaContactReview={
    request(){return api("contacts/review",{method:"GET"});},
    sync(){return api("zoho/sync",{method:"POST",headers:{"X-Caravela-Request":"1"}});}
  };
  // Private human-review queue; no send, mail-body access or booking mutation.
  window.CaravelaMailReviewTasks={
    list(){return api("mail/review-tasks",{method:"GET"});},
    resolveBooking(message_id,task_revision,booking_method,record){
      return api("mail/resolve-booking",{
        method:"POST",headers:{"Content-Type":"application/json","X-Caravela-Request":"1"},
        body:JSON.stringify({message_id,task_revision,booking_method,record,review_confirmed:true})
      });
    },
    update(message_id,revision,status,note=""){
      if(!["reviewed","dismissed"].includes(status))throw Error("Ação de revisão inválida.");
      return api("mail/review-tasks",{
        method:"PATCH",headers:{"Content-Type":"application/json","X-Caravela-Request":"1"},
        body:JSON.stringify({message_id,revision,status,note})
      });
    }
  };
  // Private, encrypted mail drafts. This transport intentionally exposes no SEND action.
  window.CaravelaDraftTransport={
    list(){return api("mail/drafts",{method:"GET"});},
    read(id,revision){
      const qs=new URLSearchParams({id});
      if(revision)qs.set("revision",String(revision));
      return api("mail/drafts?"+qs.toString(),{method:"GET"});
    },
    save(record){
      return api("mail/drafts",{
        method:record.id?"PATCH":"POST",
        headers:{"Content-Type":"application/json","X-Caravela-Request":"1"},
        body:JSON.stringify(record)
      });
    }
  };
  window.CaravelaNativeTransport={
    request(kind,method="GET",entry=null){
      if(!["contacts","booking","finance","archive","export"].includes(kind)||!["GET","POST","PATCH","DELETE"].includes(method)||
         (method==="DELETE"&&!["booking","contacts"].includes(kind))||
         ((kind==="archive"||kind==="export")&&method!=="GET"))
        throw Error("Operação CRM inválida.");
      return api("native/"+kind,{
        method,
        ...(method!=="GET"?{
          headers:{"Content-Type":"application/json","X-Caravela-Request":"1"},
          body:JSON.stringify(entry)
        }:{})
      });
    }
  };
  window.CaravelaPartnershipTransport={
    setToken(value){
      if(typeof value!=="string"||value.length<43)return false;
      transientToken=value.trim();return true;
    },
    request(method,entry){
      if(!["GET","POST","PATCH"].includes(method))throw Error("Operação inválida.");
      return api("partnerships",{
        method,
        ...(method!=="GET"?{
          headers:{"Content-Type":"application/json","X-Caravela-Request":"1"},
          body:JSON.stringify(entry)
        }:{})
      });
    }
  };
    function busyMode(value){
    busy=value;
    for(const id of ["vault-status","vault-save","vault-load","vault-backup","vault-r2-backup","vault-native-export","vault-zoho","vault-sheets","vault-live"])$(id).disabled=value;
    if(!value)$("vault-save").disabled=!currentFile;
  }
  async function action(work){
    if(busy)return;
    busyMode(true);
    try{await work();}catch(e){say(e?.message||"Não foi possível concluir a operação.",true);}
    finally{busyMode(false);}
  }
  async function info(){
    const data=await (await api("status")).json();
    if(!data.schema_ready){
      say("A migração do cofre ainda não foi aplicada ao D1 Preview.",true);return;
    }
    const completed=(data.snapshots||[]).filter(s=>s.state==="sealed");
    $("vault-summary").textContent="Versões verificadas: "+completed.length+
      " · Ativa: "+(data.active_snapshot?"sim":"não")+
      " · Zoho indexado no D1: "+(data.mail||[]).reduce((v,x)=>v+x.count,0)+
      " mensagens · Sheets: "+(data.sources||[]).length+
      " fontes capturadas · Backup R2: "+(data.offsite_backup_configured?((data.verified_offsite_copies||0)+" cópia(s) verificadas"):"não configurado")+".";
    say("Cofre pronto. "+(data.active_snapshot?
      "Existe uma base persistente que podes abrir.":"Ainda não existe uma base ativa."));
    return data;
  }
  async function restore(shouldDownload=false){
    say("A recuperar a base imutável do D1…");
    const response=await api("snapshot/active");
    const bytes=await response.arrayBuffer();
    const check=await hash(bytes);
    if(check!==response.headers.get("X-Control-SHA256"))
      throw Error("Falha na integridade SHA-256 do backup. Nada foi carregado.");
    const file=new File([bytes],"caravela_crm_guardado.json",{type:"application/json"});
    if(shouldDownload){
      const objectUrl=URL.createObjectURL(file);
      const link=document.createElement("a");
      link.href=objectUrl;link.download="caravela_crm_backup_privado.json";
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),5000);
      say("Concluído: backup integral descarregado e verificado.");
    }else{
      await window.CaravelaControlLoadFile(file,true);
      currentFile=file;
      say("Concluído: base guardada restaurada e verificada. Não foi necessário importar outro JSON.");
    }
  }
  async function save(){
    const file=currentFile||window.CaravelaControlCurrentImportFile;
    if(!file)throw Error("Importa primeiro o JSON V3 ou abre uma versão do cofre.");
    if(!window.confirm("Guardar uma versão integral e privada do ficheiro no D1 de testes? Não substitui outras versões."))
      return;
    const bytes=await file.arrayBuffer();
    if(bytes.byteLength>12*1024*1024)throw Error("O JSON ultrapassa o limite de 12 MB.");
    // CRM already verified the manifest SHA-256 before exposing this File.
    const parsed=JSON.parse(new TextDecoder().decode(bytes));
    if(parsed.schema!=="caravela.crm.import.v1"||
      !/^[a-f0-9]{64}$/.test(parsed.manifest_sha256))throw Error("Importação CRM não reconhecida.");
    const rawSha=await hash(bytes),parts=Math.ceil(bytes.byteLength/PART_SIZE);
    let result=await (await api("snapshot/start",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({raw_sha256:rawSha,manifest_sha256:parsed.manifest_sha256,
        bytes:bytes.byteLength,parts})
    })).json();
    if(result.state!=="sealed"){
      for(let i=0;i<parts;i++){
        const start=i*PART_SIZE;
        const part=bytes.slice(start,Math.min(start+PART_SIZE,bytes.byteLength));
        const digest=await hash(part);
        await api("snapshot/"+result.id+"/part/"+i,{
          method:"PUT",headers:{"Content-Type":"application/octet-stream","X-Part-SHA256":digest},
          body:part
        });
        say("A guardar o original por partes: "+(i+1)+"/"+parts+". Não feches esta página.");
      }
      result=await (await api("snapshot/"+result.id+"/seal",{method:"POST"})).json();
    }
    if(!window.confirm("A versão ficou guardada e verificada. Queres defini-la como base ativa? As anteriores continuam recuperáveis.")){
      say("Concluído: versão preservada no D1. Não foi alterada a versão ativa.");return;
    }
    await api("snapshot/"+result.id+"/activate",{method:"POST"});
    say("Concluído: a base está guardada, verificada e ativa. De futuro abre-a diretamente do cofre.");
    await info();
  }
  window.addEventListener("caravela-crm-imported",event=>{
    currentFile=window.CaravelaControlCurrentImportFile||$("source-file").files?.[0]||null;
    $("vault-save").disabled=busy||!currentFile;
  });
  let autoRestoreStarted=false;
  async function autoRestore(){
    if(autoRestoreStarted)return;
    autoRestoreStarted=true;
    try{
      const data=await info();
      if(data?.active_snapshot)await restore(false);
    }catch(e){
      autoRestoreStarted=false;
      say("Não foi possível abrir automaticamente a base: "+(e?.message||"erro"),true);
    }
  }
  window.addEventListener("caravela-control-token-ready",()=>{void action(autoRestore)});
  window.addEventListener("caravela-control-authenticated",()=>{void action(autoRestore)});
    $("vault-status").addEventListener("click",()=>action(info));
  $("vault-save").addEventListener("click",()=>action(save));
  $("vault-load").addEventListener("click",()=>action(()=>restore(false)));
  $("vault-backup").addEventListener("click",()=>action(()=>restore(true)));
  $("vault-r2-backup").addEventListener("click",()=>action(async()=>{
    const details=await (await api("status")).json();
    if(!details.active_snapshot)throw Error("Ainda não existe uma versão ativa.");
    const result=await api("snapshot/"+details.active_snapshot+"/backup-download");
    const bytes=await result.arrayBuffer();
    if(await hash(bytes)!==result.headers.get("X-Control-SHA256"))
      throw Error("O backup R2 não passou a verificação SHA-256.");
    const objectUrl=URL.createObjectURL(new Blob([bytes],{type:"application/json"}));
    const link=document.createElement("a");link.href=objectUrl;
    link.download="caravela_crm_backup_r2_privado.json";
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),5000);
    say("Concluído: cópia R2 independente recuperada e verificada.");
  }));
  $("vault-native-export").addEventListener("click",()=>action(async()=>{
    const response=await api("native/export");
    const payload=await response.json();
    if(payload.schema!=="caravela.crm.native-backup.v1")
      throw Error("A exportação não passou a validação de estrutura.");
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="caravela_control_registos_operacionais.json";
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    say("Concluído: "+payload.count+" revisões operacionais exportadas. Guarda a cópia num local seguro.");
  }));
  async function sync(provider) {
    say("A sincronizar "+provider+" em modo de leitura. Nenhuma mensagem será modificada…");
    const payload=await (await api(provider+"/sync",{method:"POST"})).json();
    await info();
    if(provider==="zoho"){
      say("Concluído: "+payload.scanned+" mensagens consultadas, "+
        payload.new_records+" novos registos de metadados preservados, "+
        payload.total_indexed+" no histórico D1.");
    }else{
      say("Concluído: "+payload.sources_scanned+" fontes Sheets verificadas. "+
        payload.changed_sources.length+" com nova revisão preservada.");
    }
  }
  $("vault-zoho").addEventListener("click",()=>action(()=>sync("zoho")));
  $("vault-sheets").addEventListener("click",()=>action(()=>sync("sheets")));
  $("vault-live").addEventListener("click",()=>action(async()=>{
    const actions=await (await api("source/latest?key=control_actions")).json();
    const artists=await (await api("source/latest?key=artist_pipeline")).json();
    window.dispatchEvent(new CustomEvent("caravela-control-live-sources",{detail:{actions,artists}}));
    say("Concluído: AÇÕES atuais e fichas artísticas apresentadas em modo de leitura.");
    $("control-live-sheets")?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
})();
