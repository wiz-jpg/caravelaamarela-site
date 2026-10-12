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
    '</div><div class="status" id="vault-result" role="status" aria-live="polite">Base permanente ainda não verificada. Para todas as operações, usa o token administrativo acima.</div>'+
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
    if(given){transientToken=given;$("admin-token").value="";}
    if(!transientToken)throw Error("Introduz primeiro o token administrativo acima.");
    return transientToken;
  }
  async function api(path,options={}){
    const response=await fetch("/api/control/"+path,{
      ...options,cache:"no-store",credentials:"same-origin",redirect:"error",
      headers:{...options.headers,Authorization:"Bearer "+token()}
    });
    if(response.status===401){transientToken="";throw Error("Token administrativo inválido. Introduz novamente.");}
    if(response.status===503)throw Error("A migração do cofre ainda não foi aplicada ao D1 Preview.");
    if(!response.ok){
      const detail=await response.json().catch(()=>({}));
      throw Error("Operação interrompida ("+(detail.error||response.status)+"). Nenhum dado anterior foi apagado.");
    }
    return response;
  }
  function busyMode(value){
    busy=value;
    for(const id of ["vault-status","vault-save","vault-load","vault-backup"])$(id).disabled=value;
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
      " fontes capturadas · Backups externos: por configurar.";
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
  $("vault-status").addEventListener("click",()=>action(info));
  $("vault-save").addEventListener("click",()=>action(save));
  $("vault-load").addEventListener("click",()=>action(()=>restore(false)));
  $("vault-backup").addEventListener("click",()=>action(()=>restore(true)));
})();
