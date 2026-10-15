/* Preview-only transitional admin session. No token is ever placed in browser storage.
 * Cloudflare Access remains the outer authentication boundary.
 * Prefer CONTROL_AUTH_ENABLED individual accounts once configured. */
const COOKIE="__Host-caravela_preview_session";
const DURATION_MS=12*60*60*1000;
const enc=new TextEncoder();
const response=(value,status=200,headers={})=>Response.json(value,{status,headers:{
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers
}});
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const decode=value=>Uint8Array.from(atob(value.replaceAll("-","+").replaceAll("_","/")),x=>x.charCodeAt(0));
async function signingKey(env){
  const seed=enc.encode("caravela-control-preview-session-v1:"+env.ZOHO_ADMIN_TOKEN);
  const material=await crypto.subtle.digest("SHA-256",seed);
  return crypto.subtle.importKey("raw",material,{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
function getCookie(request){
  const entry=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim())
    .find(x=>x.startsWith(COOKIE+"="));
  return entry?.slice(COOKIE.length+1)||"";
}
export async function checkLegacySession(request,env){
  const token=getCookie(request);
  const parts=/^(\d{13})\.([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if(!parts)return false;
  const expires=Number(parts[1]),now=Date.now();
  if(!Number.isSafeInteger(expires)||expires<=now||expires>now+DURATION_MS)return false;
  try{
    return await crypto.subtle.verify("HMAC",await signingKey(env),decode(parts[3]),
      enc.encode("legacy:v1:"+parts[1]+":"+parts[2]));
  }catch{return false;}
}
function cookie(value,age){
  return COOKIE+"="+value+"; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age="+age;
}
export async function handleLegacySession(request,env,url,isAdmin){
  if(request.method==="GET"){
    return response({ok:true,authenticated:await checkLegacySession(request,env)});
  }
  if(!["POST","DELETE"].includes(request.method))return response({ok:false,error:"method_not_allowed"},405);
  if(request.headers.get("Origin")!==url.origin||
    request.headers.get("Sec-Fetch-Site")==="cross-site"||
    request.headers.get("X-Caravela-Request")!=="1")
    return response({ok:false,error:"invalid_origin"},403);
  if(request.method==="DELETE"){
    return response({ok:true},200,{"Set-Cookie":cookie("",0)});
  }
  if(!isAdmin)return response({ok:false,error:"unauthorized"},401);
  const expires=String(Date.now()+DURATION_MS);
  const nonce=encode(crypto.getRandomValues(new Uint8Array(24)));
  const tag=encode(new Uint8Array(await crypto.subtle.sign("HMAC",await signingKey(env),
    enc.encode("legacy:v1:"+expires+":"+nonce))));
  return response({ok:true,authenticated:true,expires_ms:Number(expires)},200,
    {"Set-Cookie":cookie(expires+"."+nonce+"."+tag,Math.floor(DURATION_MS/1000))});
}
