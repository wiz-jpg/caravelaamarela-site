const root = document.documentElement;
const header = document.querySelector('[data-header]');
const nav = document.querySelector('[data-nav]');
const navToggle = document.querySelector('[data-nav-toggle]');
const main = document.querySelector('main');
const footer = document.querySelector('.site-footer');
const BOOKING_EMAIL = 'booking@caravelaamarela.com';
const ARTISTS_EMAIL = 'artists@caravelaamarela.com';

/* Navigation */
function closeNav(restoreFocus=false){
  nav?.classList.remove('open');
  navToggle?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded','false');
  document.body.classList.remove('nav-open');
  main?.removeAttribute('inert'); footer?.removeAttribute('inert');
  if(restoreFocus) navToggle?.focus();
}
function openNav(){
  nav?.classList.add('open'); navToggle?.classList.add('open');
  navToggle?.setAttribute('aria-expanded','true'); document.body.classList.add('nav-open');
  if(innerWidth<=760){main?.setAttribute('inert','');footer?.setAttribute('inert','')}
}
navToggle?.addEventListener('click',()=>nav?.classList.contains('open')?closeNav(true):openNav());
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closeNav()));
addEventListener('resize',()=>{if(innerWidth>760)closeNav()},{passive:true});
addEventListener('scroll',()=>header?.classList.toggle('scrolled',scrollY>10),{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav(true)});

/* Year */
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

/* Booking deep-link preselection */
const bookingArtist=document.querySelector('#bookingArtist');
if(bookingArtist){
  const wanted=new URLSearchParams(location.search).get('artist');
  if(wanted && [...bookingArtist.options].some(o=>o.value===wanted)) bookingArtist.value=wanted;
}
const eventDate=document.querySelector('#eventDate');
if(eventDate) eventDate.min=new Date().toISOString().slice(0,10);

/* Forms -> structured email */
function openMailto(to,subject,lines){location.href=`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.filter(Boolean).join('\n'))}`}
const bookingForm=document.querySelector('#bookingForm');
bookingForm?.addEventListener('submit',e=>{
  e.preventDefault(); if(!bookingForm.reportValidity())return;
  const v=id=>document.querySelector(id)?.value?.trim()||'-';
  const artist=v('#bookingArtist'),type=v('#eventType'),date=v('#eventDate'),city=v('#city'),message=v('#message');
  const pt=root.lang.toLowerCase().startsWith('pt');
  openMailto(BOOKING_EMAIL,`${pt?'Pedido de Booking':'Booking request'} — ${artist}`,pt?
    ['Olá Caravela Amarela,','','Gostaria de pedir disponibilidade para uma possível data.','',`Artista: ${artist}`,`Tipo de evento: ${type}`,`Data: ${date}`,`Cidade / Local: ${city}`,'','Informação adicional:',message,'','Obrigado.']:
    ['Hello Caravela Amarela,','','I would like to request availability for a possible date.','',`Artist: ${artist}`,`Event type: ${type}`,`Date: ${date}`,`City / Venue: ${city}`,'','Additional information:',message,'','Thank you.']);
});
const artistForm=document.querySelector('#artistContactForm');
artistForm?.addEventListener('submit',e=>{
  e.preventDefault(); if(!artistForm.reportValidity())return;
  const v=id=>document.querySelector(id)?.value?.trim()||'-'; const pt=root.lang.toLowerCase().startsWith('pt');
  const name=v('#artistName'),email=v('#artistEmail'),city=v('#artistCity'),request=v('#artistRequest'),links=v('#artistLinks'),message=v('#artistMessage');
  openMailto(ARTISTS_EMAIL,`For Artists — ${name}`,pt?
    ['Olá Caravela Amarela,','','Gostaria de apresentar o meu projeto.','',`Nome artístico: ${name}`,`Email: ${email}`,`Cidade / Região: ${city}`,`Pedido: ${request}`,'','Links:',links,'','Mensagem:',message,'','Obrigado.']:
    ['Hello Caravela Amarela,','','I would like to introduce my project.','',`Artist name: ${name}`,`Email: ${email}`,`City / Region: ${city}`,`Request: ${request}`,'','Links:',links,'','Message:',message,'','Thank you.']);
});

/* YouTube facade */
function playVideo(frame){
  const id=frame.dataset.youtubeId,title=frame.dataset.videoTitle||'YouTube video'; if(!id)return;
  const iframe=document.createElement('iframe');
  iframe.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
  iframe.title=title; iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.referrerPolicy='strict-origin-when-cross-origin'; iframe.allowFullscreen=true;
  frame.replaceChildren(iframe);
}
function bindVideoPoster(frame){frame?.querySelector('.video-poster')?.addEventListener('click',()=>playVideo(frame));}
document.querySelectorAll('.video-frame[data-youtube-id]').forEach(bindVideoPoster);

/* WILDCHAINS media selector */
document.querySelectorAll('[data-media-switcher]').forEach(switcher=>{
  const frame=switcher.querySelector('.video-frame'); const choices=[...switcher.querySelectorAll('[data-media-choice]')];
  const pt=root.lang.toLowerCase().startsWith('pt');
  function rebuild(choice){
    choices.forEach(b=>{const active=b===choice;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false')});
    frame.dataset.youtubeId=choice.dataset.videoId; frame.dataset.videoTitle=choice.dataset.videoTitle;
    const button=document.createElement('button'); button.type='button'; button.className='video-poster'; button.setAttribute('aria-label',`${pt?'Reproduzir':'Play'} ${choice.dataset.label}`);
    const img=document.createElement('img'); img.className='media-feature-img'; img.src=choice.dataset.poster; img.alt=choice.dataset.label; img.loading='lazy'; img.decoding='async';
    const scrim=document.createElement('span'); scrim.className='video-scrim';
    const play=document.createElement('span'); play.className='video-play'; play.setAttribute('aria-hidden','true'); play.textContent='▶';
    const text=document.createElement('span'); text.className='media-feature-text';
    const b=document.createElement('b'); b.textContent=choice.dataset.label; const sm=document.createElement('small'); sm.textContent=choice.dataset.meta; text.append(b,sm);
    button.append(img,scrim,play,text); frame.replaceChildren(button); bindVideoPoster(frame);
  }
  choices.forEach(choice=>choice.addEventListener('click',()=>rebuild(choice)));
});

/* Proof tabs */
document.querySelectorAll('[data-proof-tabs]').forEach(group=>{
  const tabs=[...group.querySelectorAll('[data-proof-tab]')]; const panels=[...group.querySelectorAll('[data-proof-panel]')];
  function select(tab,focus=false){const key=tab.dataset.proofTab;tabs.forEach(t=>{const a=t===tab;t.classList.toggle('is-active',a);t.setAttribute('aria-selected',a?'true':'false');t.tabIndex=a?0:-1});panels.forEach(p=>p.classList.toggle('is-active',p.dataset.proofPanel===key));if(focus)tab.focus()}
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();const n=(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(tabs[n],true)})});
  select(tabs.find(t=>t.classList.contains('is-active'))||tabs[0]);
});

/* Sticky artist subnav current section */
const subnavLinks=[...document.querySelectorAll('[data-subnav]')];
if(subnavLinks.length && 'IntersectionObserver' in window){
  const map=new Map(subnavLinks.map(a=>[a.getAttribute('href').slice(1),a]));
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0]; if(!visible)return;
    map.forEach(a=>a.classList.remove('is-active')); map.get(visible.target.id)?.classList.add('is-active');
  },{rootMargin:'-30% 0px -55% 0px',threshold:[0,.1,.3]});
  map.forEach((_,id)=>{const sec=document.getElementById(id);if(sec)observer.observe(sec)});
}

/* For Artists services */
document.querySelectorAll('.service-chip-panel').forEach(panel=>{
  const buttons=[...panel.querySelectorAll('[data-service]')],descs=[...panel.querySelectorAll('[data-service-desc]')];
  function choose(button){const key=button.dataset.service;buttons.forEach(b=>{const a=b===button;b.classList.toggle('is-active',a);b.setAttribute('aria-pressed',a?'true':'false')});descs.forEach(d=>d.classList.toggle('is-active',d.dataset.serviceDesc===key))}
  buttons.forEach(b=>b.addEventListener('click',()=>choose(b))); if(buttons[0])choose(buttons.find(b=>b.classList.contains('is-active'))||buttons[0]);
});
