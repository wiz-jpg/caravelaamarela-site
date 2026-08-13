const root = document.documentElement;
const header = document.querySelector('[data-header]');
const nav = document.querySelector('[data-nav]');
const navToggle = document.querySelector('[data-nav-toggle]');
const pageMain = document.querySelector('main');
const pageFooter = document.querySelector('.site-footer');

const BOOKING_EMAIL = 'booking@caravelaamarela.com';
const ARTISTS_EMAIL = 'artists@caravelaamarela.com';

/* ---------- Navigation ---------- */
function closeNav({ restoreFocus = false } = {}) {
  nav?.classList.remove('open');
  navToggle?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
  pageMain?.removeAttribute('inert');
  pageFooter?.removeAttribute('inert');
  if (restoreFocus) navToggle?.focus();
}

function openNav() {
  nav?.classList.add('open');
  navToggle?.classList.add('open');
  navToggle?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('nav-open');
  if (window.innerWidth <= 760) {
    pageMain?.setAttribute('inert', '');
    pageFooter?.setAttribute('inert', '');
  }
}

navToggle?.addEventListener('click', () => {
  nav?.classList.contains('open') ? closeNav() : openNav();
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeNav()));

window.addEventListener('resize', () => {
  if (window.innerWidth > 760) closeNav();
}, { passive: true });

window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 12);
}, { passive: true });

/* ---------- Year ---------- */
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

/* ---------- Forms -> structured email ---------- */
function openMailto(to, subject, lines) {
  const body = lines.filter(Boolean).join('\n');
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const bookingForm = document.querySelector('#bookingForm');
bookingForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!bookingForm.reportValidity()) return;

  const artist = document.querySelector('#bookingArtist')?.value || '-';
  const eventType = document.querySelector('#eventType')?.value || '-';
  const eventDate = document.querySelector('#eventDate')?.value || '-';
  const city = document.querySelector('#city')?.value?.trim() || '-';
  const message = document.querySelector('#message')?.value?.trim() || '-';

  const isPt = root.lang.toLowerCase().startsWith('pt');
  openMailto(
    BOOKING_EMAIL,
    `${isPt ? 'Pedido de Booking' : 'Booking request'} — ${artist}`,
    isPt
      ? ['Olá Caravela Amarela,', '', 'Gostaria de pedir disponibilidade para uma possível data.', '', `Artista: ${artist}`, `Tipo de evento: ${eventType}`, `Data: ${eventDate}`, `Cidade / Local: ${city}`, '', 'Informação adicional:', message, '', 'Obrigado.']
      : ['Hello Caravela Amarela,', '', 'I would like to request availability for a possible date.', '', `Artist: ${artist}`, `Event type: ${eventType}`, `Date: ${eventDate}`, `City / Venue: ${city}`, '', 'Additional information:', message, '', 'Thank you.']
  );
});

const artistContactForm = document.querySelector('#artistContactForm');
artistContactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!artistContactForm.reportValidity()) return;

  const artistName = document.querySelector('#artistName')?.value?.trim() || '-';
  const artistEmail = document.querySelector('#artistEmail')?.value?.trim() || '-';
  const artistCity = document.querySelector('#artistCity')?.value?.trim() || '-';
  const artistRequest = document.querySelector('#artistRequest')?.value || '-';
  const artistLinks = document.querySelector('#artistLinks')?.value?.trim() || '-';
  const artistMessage = document.querySelector('#artistMessage')?.value?.trim() || '-';
  const isPt = root.lang.toLowerCase().startsWith('pt');

  openMailto(
    ARTISTS_EMAIL,
    `For Artists — ${artistName}`,
    isPt
      ? ['Olá Caravela Amarela,', '', 'Gostaria de apresentar o meu projeto.', '', `Nome artístico: ${artistName}`, `Email: ${artistEmail}`, `Cidade / Região: ${artistCity}`, `Pedido: ${artistRequest}`, '', 'Links:', artistLinks, '', 'Mensagem:', artistMessage, '', 'Obrigado.']
      : ['Hello Caravela Amarela,', '', 'I would like to introduce my project.', '', `Artist name: ${artistName}`, `Email: ${artistEmail}`, `City / Region: ${artistCity}`, `Request: ${artistRequest}`, '', 'Links:', artistLinks, '', 'Message:', artistMessage, '', 'Thank you.']
  );
});

/* ---------- Video facades ---------- */
document.querySelectorAll('.video-frame[data-youtube-id]').forEach((frame) => {
  const button = frame.querySelector('.video-poster');
  button?.addEventListener('click', () => {
    const id = frame.dataset.youtubeId;
    const title = frame.dataset.videoTitle || 'YouTube video';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    iframe.title = title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    frame.replaceChildren(iframe);
  }, { once: true });
});

/* ---------- Press sliders ---------- */
document.querySelectorAll('[data-press-slider]').forEach((slider) => {
  const section = slider.closest('.press-slider-section') || document;
  const track = slider.querySelector('[data-press-track]');
  const slides = Array.from(slider.querySelectorAll('.press-slide'));
  const prev = section.querySelector('[data-press-prev]');
  const next = section.querySelector('[data-press-next]');
  const dotsWrap = slider.querySelector('[data-press-dots]');
  if (!track || !slides.length || !dotsWrap) return;

  slider.tabIndex = 0;
  dotsWrap.innerHTML = '';
  let current = 0;
  let touchStartX = null;

  const dots = slides.map((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Media ${index + 1}`);
    dot.addEventListener('click', () => goTo(index));
    dotsWrap.appendChild(dot);
    return dot;
  });

  function update() {
    track.style.transform = `translate3d(-${current * 100}%, 0, 0)`;
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === current);
      dot.setAttribute('aria-current', index === current ? 'true' : 'false');
    });
    slides.forEach((slide, index) => {
      const active = index === current;
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      slide.toggleAttribute('inert', !active);
    });
  }

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    update();
  }

  prev?.addEventListener('click', () => goTo(current - 1));
  next?.addEventListener('click', () => goTo(current + 1));
  slider.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
  });
  slider.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
  slider.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (Math.abs(delta) > 45) goTo(current + (delta < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });
  update();
});

/* ---------- Press modal ---------- */
const pressModal = document.querySelector('[data-press-modal]');
const pressModalTitle = pressModal?.querySelector('[data-press-modal-title]');
const pressModalSource = pressModal?.querySelector('[data-press-modal-source]');
const pressModalDate = pressModal?.querySelector('[data-press-modal-date]');
const pressModalHighlight = pressModal?.querySelector('[data-press-modal-highlight]');
const pressModalLink = pressModal?.querySelector('[data-press-modal-link]');
let modalTrigger = null;
let modalInertTargets = [];

function setModalBackgroundInert(active) {
  if (!pressModal) return;
  if (active) {
    modalInertTargets = Array.from(document.body.children).filter((el) => el !== pressModal && el.tagName !== 'SCRIPT');
    modalInertTargets.forEach((el) => el.setAttribute('inert', ''));
  } else {
    modalInertTargets.forEach((el) => el.removeAttribute('inert'));
    modalInertTargets = [];
  }
}

function modalFocusable() {
  if (!pressModal) return [];
  return Array.from(pressModal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((el) => !el.hasAttribute('hidden'));
}

function closePressModal() {
  if (!pressModal || pressModal.hidden) return;
  pressModal.hidden = true;
  document.body.classList.remove('modal-open');
  setModalBackgroundInert(false);
  modalTrigger?.focus?.();
}

function openPressModal(button) {
  if (!pressModal) return;
  modalTrigger = button;
  const lang = root.lang || 'pt';
  const highlight = button.getAttribute(lang === 'en' ? 'data-highlight-en' : 'data-highlight-pt');
  if (pressModalTitle) pressModalTitle.textContent = button.getAttribute('data-title') || '';
  if (pressModalSource) pressModalSource.textContent = button.getAttribute('data-source') || '';
  if (pressModalDate) pressModalDate.textContent = button.getAttribute('data-date') || '';
  if (pressModalHighlight) pressModalHighlight.textContent = highlight || '';
  if (pressModalLink) pressModalLink.href = button.getAttribute('data-url') || '#';
  pressModal.hidden = false;
  document.body.classList.add('modal-open');
  setModalBackgroundInert(true);
  requestAnimationFrame(() => pressModal.querySelector('.press-modal-close')?.focus());
}

document.querySelectorAll('[data-press-open]').forEach((button) => button.addEventListener('click', () => openPressModal(button)));
pressModal?.querySelectorAll('[data-press-close]').forEach((button) => button.addEventListener('click', closePressModal));

/* ---------- For Artists service details ---------- */
document.querySelectorAll('.service-chip-panel').forEach((panel) => {
  const buttons = Array.from(panel.querySelectorAll('[data-service]'));
  const descBox = panel.querySelector('[data-service-desc-box]');
  const descriptions = Array.from(panel.querySelectorAll('[data-service-desc]'));
  if (!buttons.length || !descBox || !descriptions.length) return;

  function choose(button) {
    const selected = button.dataset.service;
    buttons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    descriptions.forEach((description) => description.classList.toggle('is-active', description.dataset.serviceDesc === selected));
    descBox.classList.add('is-active');
  }

  buttons.forEach((button) => button.addEventListener('click', () => choose(button)));
  choose(buttons.find((button) => button.classList.contains('is-active')) || buttons[0]);
});

/* ---------- Escape handling ---------- */
document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && pressModal && !pressModal.hidden) {
    const focusable = modalFocusable();
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  if (event.key !== 'Escape') return;
  closePressModal();
  if (nav?.classList.contains('open')) closeNav({ restoreFocus: true });
});
