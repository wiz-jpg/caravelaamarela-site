document.documentElement.classList.add('js');

// Mobile navigation
const navToggle=document.querySelector('[data-nav-toggle]');
const mobileNav=document.querySelector('[data-mobile-nav]');
function closeNav(){
  mobileNav?.classList.remove('open');
  navToggle?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded','false');
}
navToggle?.addEventListener('click',()=>{
  const open=mobileNav?.classList.toggle('open');
  navToggle.classList.toggle('open',!!open);
  navToggle.setAttribute('aria-expanded',open?'true':'false');
});
mobileNav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeNav));
window.addEventListener('resize',()=>{if(innerWidth>760)closeNav()},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav()});

// Year
 document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

// Horizontal rails
function railStep(rail){
  const card=rail.querySelector('.press-card');
  if(!card)return Math.max(rail.clientWidth*.8,280);
  return card.getBoundingClientRect().width+14;
}
document.querySelectorAll('.press-section').forEach(section=>{
  const rail=section.querySelector('[data-rail]');
  if(!rail)return;
  section.querySelector('[data-rail-prev]')?.addEventListener('click',()=>rail.scrollBy({left:-railStep(rail),behavior:'smooth'}));
  section.querySelector('[data-rail-next]')?.addEventListener('click',()=>rail.scrollBy({left:railStep(rail),behavior:'smooth'}));
});

// Deep link artist into booking form
const bookingArtist=document.querySelector('#bookingArtist');
if(bookingArtist){
  const wanted=new URLSearchParams(location.search).get('artist');
  if(wanted&&[...bookingArtist.options].some(o=>o.value===wanted))bookingArtist.value=wanted;
}
const eventDate=document.querySelector('#eventDate');
if(eventDate)eventDate.min=new Date().toISOString().slice(0,10);

function mail(to,subject,lines){
  location.href=`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.filter(Boolean).join('\n'))}`;
}

const bookingForm=document.querySelector('#bookingForm');
bookingForm?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!bookingForm.reportValidity())return;
  const val=id=>document.querySelector(id)?.value?.trim()||'-';
  const lang=document.documentElement.lang;
  const pt=lang.startsWith('pt'), es=lang.startsWith('es');
  const artist=val('#bookingArtist'),type=val('#eventType'),date=val('#eventDate'),city=val('#city'),message=val('#message');
  mail('booking@caravelaamarela.com',`${pt?'Pedido de Booking':es?'Solicitud de Booking':'Booking request'} — ${artist}`,
    pt?['Olá Caravela Amarela,','',`Artista: ${artist}`,`Tipo: ${type}`,`Data: ${date}`,`Cidade / Local: ${city}`,'',message]:
    es?['Hola Caravela Amarela,','',`Artista: ${artist}`,`Tipo: ${type}`,`Fecha: ${date}`,`Ciudad / Sala: ${city}`,'',message]:
       ['Hello Caravela Amarela,','',`Artist: ${artist}`,`Type: ${type}`,`Date: ${date}`,`City / Venue: ${city}`,'',message]);
});

const artistForm=document.querySelector('#artistContactForm');
artistForm?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!artistForm.reportValidity())return;
  const val=id=>document.querySelector(id)?.value?.trim()||'-';
  const lang=document.documentElement.lang;
  const pt=lang.startsWith('pt'), es=lang.startsWith('es');
  const name=val('#artistName'),email=val('#artistEmail'),city=val('#artistCity'),request=val('#artistRequest'),links=val('#artistLinks'),message=val('#artistMessage');
  mail('artists@caravelaamarela.com',`For Artists — ${name}`,
    pt?['Olá Caravela Amarela,','',`Nome artístico: ${name}`,`Email: ${email}`,`Cidade / Região: ${city}`,`Pedido: ${request}`,'',`Links: ${links}`,'',`Mensagem: ${message}`]:
    es?['Hola Caravela Amarela,','',`Nombre artístico: ${name}`,`Email: ${email}`,`Ciudad / Región: ${city}`,`Solicitud: ${request}`,'',`Links: ${links}`,'',`Mensaje: ${message}`]:
       ['Hello Caravela Amarela,','',`Artist: ${name}`,`Email: ${email}`,`City / Region: ${city}`,`Request: ${request}`,'',`Links: ${links}`,'',`Message: ${message}`]);
});
