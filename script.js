document.documentElement.classList.add("js");

const language = document.documentElement.lang || "pt-PT";
const isPortuguese = language.startsWith("pt");
const isSpanish = language.startsWith("es");
const localeKey = isPortuguese ? "pt" : isSpanish ? "es" : "en";
const localeCode = isPortuguese ? "pt-PT" : isSpanish ? "es-ES" : "en-GB";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Navigation and document utilities.
const navToggle = document.querySelector("[data-nav-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");

function closeNav() {
  mobileNav?.classList.remove("open");
  navToggle?.classList.remove("open");
  navToggle?.setAttribute("aria-expanded", "false");
}

navToggle?.addEventListener("click", () => {
  const open = mobileNav?.classList.toggle("open");
  navToggle.classList.toggle("open", Boolean(open));
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
});
mobileNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
window.addEventListener("resize", () => {
  if (innerWidth > 760) closeNav();
}, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeNav();
});
document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

function currentArtistFilter() {
  const main = document.querySelector("main.artist");
  if (main?.classList.contains("wild")) return "wild";
  if (main?.classList.contains("devil")) return "devil";
  return "all";
}

function currentArtistName() {
  const artist = currentArtistFilter();
  return artist === "wild" ? "WILDCHAINS" : artist === "devil" ? "Devil of a Woman" : "";
}

// Both contact forms continue to use the existing D1 + email endpoint.
const formMessages = isPortuguese
  ? {
      sending: "A enviar…",
      success: "Pedido enviado. Respondemos assim que possível.",
      saved: "ATENÇÃO — O pedido ficou guardado, mas a notificação por email falhou. Envia também diretamente para booking@caravelaamarela.com.",
      error: "ATENÇÃO — NÃO FOI POSSÍVEL ENVIAR O FORMULÁRIO. Envia o pedido diretamente por email.",
      fallback: "Enviar diretamente por email ↗",
    }
  : isSpanish
    ? {
        sending: "Enviando…",
        success: "Solicitud enviada. Responderemos lo antes posible.",
        saved: "ATENCIÓN — La solicitud quedó guardada, pero falló la notificación por email. Envíala también directamente a booking@caravelaamarela.com.",
        error: "ATENCIÓN — NO HA SIDO POSIBLE ENVIAR EL FORMULARIO. Envíalo directamente por email.",
        fallback: "Enviar directamente por email ↗",
      }
    : {
        sending: "Sending…",
        success: "Request sent. We will reply as soon as possible.",
        saved: "ATTENTION — The request was saved, but the email notification failed. Please also send it directly to booking@caravelaamarela.com.",
        error: "ATTENTION — THE FORM COULD NOT BE SENT. Please send the request directly by email.",
        fallback: "Send directly by email ↗",
      };

function fallbackEmail(formType, fields) {
  const subject = formType === "booking"
    ? `${isPortuguese ? "Pedido de Booking" : isSpanish ? "Solicitud de Booking" : "Booking request"} — ${fields.artist || "Caravela Amarela"}`
    : `For Artists — ${fields.artistName}`;
  const lines = formType === "booking"
    ? [
        `Nome / Name: ${fields.contactName}`,
        `Email: ${fields.contactEmail}`,
        `Artista / Artist: ${fields.artist}`,
        `Evento, local e data / Event, venue and date: ${fields.eventDetails}`,
        "",
        fields.message || "",
      ]
    : [
        `Nome artístico / Artist: ${fields.artistName}`,
        `Email: ${fields.contactEmail}`,
        `Pedido / Request: ${fields.request}`,
        `Links: ${fields.links}`,
        "",
        fields.message || "",
      ];
  return `mailto:booking@caravelaamarela.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function showFormStatus(form, message, type, fallbackHref = "") {
  const status = form.querySelector("[data-form-status]");
  if (!status) return;
  status.replaceChildren();
  status.className = `form-status ${type}`;
  status.append(document.createTextNode(message));
  if (fallbackHref) {
    const link = document.createElement("a");
    link.href = fallbackHref;
    link.textContent = formMessages.fallback;
    status.append(document.createElement("br"), link);
  }
}

async function submitContactForm(form, formType) {
  if (!form.reportValidity()) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalLabel = submitButton.textContent;
  const fields = Object.fromEntries(new FormData(form).entries());
  const fallbackHref = fallbackEmail(formType, fields);
  const selectedArtist = fields.artist || "";
  submitButton.disabled = true;
  submitButton.textContent = formMessages.sending;
  showFormStatus(form, "", "");

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formType, language, fields }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.error || "request_failed");
    if (result.notified) {
      showFormStatus(form, formMessages.success, "success");
      form.reset();
      if (formType === "booking" && selectedArtist) form.elements.artist.value = selectedArtist;
    } else {
      showFormStatus(form, formMessages.saved, "warning", fallbackHref);
    }
  } catch (error) {
    console.error("Contact form submission failed", error);
    showFormStatus(form, formMessages.error, "error", fallbackHref);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}

const bookingCopy = isPortuguese
  ? {
      eyebrow: "Booking",
      title: "VAMOS FALAR DE DATAS.",
      intro: "Quatro campos. Respondemos com disponibilidade, formato indicado e condições.",
      artist: "Artista",
      choose: "Selecionar",
      name: "Nome",
      email: "Email",
      details: "Evento, local e data",
      detailsPlaceholder: "Festival / sala · cidade · data prevista",
      message: "Mensagem",
      optional: "opcional",
      messagePlaceholder: "Contexto, horários ou alguma condição importante…",
      privacy: "Os dados serão usados apenas para responder ao pedido e guardados até 12 meses.",
      send: "Enviar pedido de booking",
      close: "Fechar formulário de booking",
      main: "Contacto principal",
      joao: "Booking · João Abreu",
      sergio: "Press, comunicação e booking · Sérgio Diogo",
    }
  : isSpanish
    ? {
        eyebrow: "Booking",
        title: "HABLEMOS DE FECHAS.",
        intro: "Cuatro campos. Respondemos con disponibilidad, formato recomendado y condiciones.",
        artist: "Artista",
        choose: "Seleccionar",
        name: "Nombre",
        email: "Email",
        details: "Evento, lugar y fecha",
        detailsPlaceholder: "Festival / sala · ciudad · fecha prevista",
        message: "Mensaje",
        optional: "opcional",
        messagePlaceholder: "Contexto, horarios o alguna condición importante…",
        privacy: "Los datos solo se utilizarán para responder y se conservarán durante un máximo de 12 meses.",
        send: "Enviar solicitud de booking",
        close: "Cerrar formulario de booking",
        main: "Contacto principal",
        joao: "Booking · João Abreu",
        sergio: "Prensa, comunicación y booking · Sérgio Diogo",
      }
    : {
        eyebrow: "Booking",
        title: "LET'S TALK DATES.",
        intro: "Four fields. We reply with availability, the right format and terms.",
        artist: "Artist",
        choose: "Select",
        name: "Name",
        email: "Email",
        details: "Event, venue and date",
        detailsPlaceholder: "Festival / venue · city · expected date",
        message: "Message",
        optional: "optional",
        messagePlaceholder: "Context, schedule or any important condition…",
        privacy: "Your data will only be used to answer this request and kept for up to 12 months.",
        send: "Send booking request",
        close: "Close booking form",
        main: "Main contact",
        joao: "Booking · João Abreu",
        sergio: "Press, communications & booking · Sérgio Diogo",
      };

function buildBookingDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "booking-dialog";
  dialog.setAttribute("aria-labelledby", "booking-dialog-title");
  dialog.innerHTML = `
    <header class="booking-dialog-head">
      <div><p class="eyebrow">${bookingCopy.eyebrow}</p><h2 id="booking-dialog-title">${bookingCopy.title}</h2></div>
      <button class="booking-dialog-close" type="button" aria-label="${bookingCopy.close}">×</button>
    </header>
    <div class="booking-dialog-grid">
      <div class="booking-dialog-copy">
        <p>${bookingCopy.intro}</p>
        <div class="booking-direct">
          <a href="mailto:booking@caravelaamarela.com">booking@caravelaamarela.com <small>— ${bookingCopy.main}</small></a>
          <a href="tel:+351935449151"><span>${bookingCopy.joao}</span><strong>+351 935 449 151</strong></a>
          <a href="tel:+351934751993"><span>${bookingCopy.sergio}</span><strong>+351 934 751 993</strong></a>
        </div>
      </div>
      <form class="booking-form" id="bookingForm">
        <label>${bookingCopy.artist}<select id="bookingArtist" name="artist" required><option value="">${bookingCopy.choose}</option><option>WILDCHAINS</option><option>Devil of a Woman</option><option>WILDCHAINS + Devil of a Woman</option></select></label>
        <div class="form-row"><label>${bookingCopy.name}<input autocomplete="name" maxlength="120" name="contactName" required></label><label>${bookingCopy.email}<input autocomplete="email" maxlength="254" name="contactEmail" required type="email"></label></div>
        <label class="full-field">${bookingCopy.details}<input maxlength="500" name="eventDetails" placeholder="${bookingCopy.detailsPlaceholder}" required></label>
        <label class="full-field">${bookingCopy.message} <span class="optional">${bookingCopy.optional}</span><textarea maxlength="20000" name="message" placeholder="${bookingCopy.messagePlaceholder}" rows="4"></textarea></label>
        <p class="form-privacy">${bookingCopy.privacy}</p><p aria-live="polite" class="form-status" data-form-status role="status"></p>
        <button class="btn primary" type="submit">${bookingCopy.send}</button>
      </form>
    </div>`;
  document.body.append(dialog);
  const form = dialog.querySelector("#bookingForm");
  const close = dialog.querySelector(".booking-dialog-close");
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitContactForm(form, "booking");
  });
  return dialog;
}

const bookingDialog = buildBookingDialog();

function artistFromTrigger(trigger) {
  if (trigger.dataset.artist) return trigger.dataset.artist;
  try {
    const url = new URL(trigger.getAttribute("href") || "", location.href);
    return url.searchParams.get("artist") || currentArtistName();
  } catch {
    return currentArtistName();
  }
}

function openBooking(artist = "") {
  const select = bookingDialog.querySelector("#bookingArtist");
  const available = [...select.options].some((option) => option.value === artist);
  select.value = available ? artist : "";
  bookingDialog.dataset.artist = available ? artist : "";
  if (!bookingDialog.open) bookingDialog.showModal();
  requestAnimationFrame(() => (available ? bookingDialog.querySelector('[name="contactName"]') : select).focus());
}

document.querySelectorAll("[data-booking-open], a[href*='#contact']").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    closeNav();
    openBooking(artistFromTrigger(trigger));
  });
});

const requestedArtist = new URLSearchParams(location.search).get("artist");
if (requestedArtist && (location.hash === "#contact" || !document.querySelector(".home-hero"))) {
  history.replaceState(null, "", location.pathname + location.hash);
  openBooking(requestedArtist);
}

const artistForm = document.querySelector("#artistContactForm");
artistForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitContactForm(artistForm, "artist");
});

// Accessible image viewer for the compact live galleries.
const galleryItems = document.querySelectorAll("[data-gallery-src]");
if (galleryItems.length) {
  const dialog = document.createElement("dialog");
  dialog.className = "gallery-dialog";
  dialog.innerHTML = `<button type="button" class="gallery-close" aria-label="${isPortuguese ? "Fechar imagem" : isSpanish ? "Cerrar imagen" : "Close image"}">×</button><img alt="">`;
  document.body.append(dialog);
  const dialogImage = dialog.querySelector("img");
  dialog.querySelector(".gallery-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  galleryItems.forEach((item) => {
    item.addEventListener("click", () => {
      dialogImage.src = item.dataset.gallerySrc;
      dialogImage.alt = item.dataset.galleryAlt || "";
      dialog.showModal();
    });
  });
}

// Approved news can be published from the review workflow without rebuilding.
function newsCard(item) {
  const link = document.createElement("a");
  link.className = `press-card ${item.artist === "devil" ? "devil" : "wild"}`;
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const imageWrap = document.createElement("div");
  imageWrap.className = "press-image";
  const image = document.createElement("img");
  image.alt = item.image_alt || item.title || "";
  image.decoding = "async";
  image.loading = "lazy";
  image.src = item.image_url || (item.artist === "devil" ? "/assets/media/devil-roster.webp" : "/assets/media/wildchains-roster.webp");
  imageWrap.append(image);
  const body = document.createElement("div");
  body.className = "press-body";
  const meta = document.createElement("div");
  meta.className = "press-meta";
  const source = document.createElement("span");
  source.textContent = item.source || "Press";
  const published = document.createElement("span");
  const publishedDate = item.published_at ? new Date(item.published_at) : null;
  published.textContent = publishedDate && !Number.isNaN(publishedDate.valueOf())
    ? new Intl.DateTimeFormat(localeCode, { day: "2-digit", month: "2-digit", year: "numeric" }).format(publishedDate)
    : "";
  meta.append(source, published);
  const title = document.createElement("h3");
  title.textContent = item.title || "";
  body.append(meta, title);
  if (item.excerpt) {
    const quote = document.createElement("blockquote");
    quote.textContent = item.excerpt;
    body.append(quote);
  }
  const read = document.createElement("span");
  read.className = "press-open";
  read.textContent = isPortuguese ? "Abrir artigo ↗" : isSpanish ? "Leer artículo ↗" : "Read article ↗";
  body.append(read);
  link.append(imageWrap, body);
  return link;
}

async function loadApprovedNews() {
  const rail = document.querySelector(".home-current .press-rail, .artist-press .press-rail");
  if (!rail) return;
  try {
    const response = await fetch(`/api/news?artist=${encodeURIComponent(currentArtistFilter())}&locale=${localeKey}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.items) || !data.items.length) return;
    const known = new Set([...rail.querySelectorAll("a[href]")].map((item) => item.href));
    const fragment = document.createDocumentFragment();
    data.items.forEach((item) => {
      if (!item?.url) return;
      const absolute = new URL(item.url, location.href).href;
      if (known.has(absolute)) return;
      known.add(absolute);
      fragment.append(newsCard(item));
    });
    rail.prepend(fragment);
  } catch (error) {
    console.debug("No dynamic news feed available", error);
  }
}

function initializeAutoRails() {
  if (reducedMotion) return;
  document.querySelectorAll("[data-auto-rail]").forEach((rail) => {
    const items = [...rail.children];
    if (items.length < 2) return;
    const group = document.createElement("div");
    group.className = "press-motion-group";
    group.append(...items);
    const duplicate = group.cloneNode(true);
    duplicate.setAttribute("aria-hidden", "true");
    duplicate.querySelectorAll("a,button").forEach((element) => element.setAttribute("tabindex", "-1"));
    rail.append(group, duplicate);
    rail.classList.add("is-auto-moving");
    rail.setAttribute("tabindex", "0");
    let paused = false;
    let inView = true;
    let previous = performance.now();
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    }, { rootMargin: "120px 0px" });
    observer.observe(rail);
    const frame = (now) => {
      const elapsed = Math.min(now - previous, 50);
      previous = now;
      if (!paused && inView && !document.hidden) {
        rail.scrollLeft += elapsed * 0.018;
        const loopAt = group.scrollWidth + gap;
        if (rail.scrollLeft >= loopAt) rail.scrollLeft -= loopAt;
      }
      requestAnimationFrame(frame);
    };
    rail.addEventListener("mouseenter", () => { paused = true; });
    rail.addEventListener("mouseleave", () => { paused = false; });
    rail.addEventListener("focusin", () => { paused = true; });
    rail.addEventListener("focusout", (event) => { if (!rail.contains(event.relatedTarget)) paused = false; });
    rail.addEventListener("pointerdown", () => { paused = true; });
    window.addEventListener("pointerup", () => { paused = false; }, { passive: true });
    requestAnimationFrame(frame);
  });
}

function localizedValue(value) {
  if (value && typeof value === "object") return value[localeKey] || value.pt || Object.values(value)[0] || "";
  return value || "";
}

function dateAtNoon(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function venueLine(event) {
  return [localizedValue(event.venue), localizedValue(event.city)].filter(Boolean).join(" · ");
}

function agendaAccent(event) {
  return event.artist === "wild" ? "var(--wild)" : event.artist === "devil" ? "var(--red)" : "var(--gold)";
}

const agendaLabels = isPortuguese
  ? { kicker: "Agenda", open: "Ver agenda completa", title: "Próximas datas", close: "Fechar agenda", empty: "Não existem datas anunciadas neste momento." }
  : isSpanish
    ? { kicker: "Agenda", open: "Ver agenda completa", title: "Próximas fechas", close: "Cerrar agenda", empty: "No hay fechas anunciadas en este momento." }
    : { kicker: "Live", open: "View full calendar", title: "Upcoming dates", close: "Close calendar", empty: "There are no announced dates at the moment." };

function injectEventSchema(events) {
  if (!events.length) return;
  const schema = events.map((event) => ({
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: localizedValue(event.title),
    startDate: event.date,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "MusicVenue", name: localizedValue(event.venue), address: localizedValue(event.city) },
    performer: event.artist === "wild"
      ? [{ "@type": "MusicGroup", name: "WILDCHAINS" }]
      : event.artist === "devil"
        ? [{ "@type": "MusicGroup", name: "Devil of a Woman" }]
        : [{ "@type": "MusicGroup", name: "WILDCHAINS" }, { "@type": "MusicGroup", name: "Devil of a Woman" }],
    organizer: { "@id": "https://caravelaamarela.com/#organization" },
  }));
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.append(script);
}

function buildAgendaDialog(events) {
  const dialog = document.createElement("dialog");
  dialog.className = "agenda-dialog";
  dialog.setAttribute("aria-labelledby", "agenda-modal-title");
  const head = document.createElement("header");
  head.className = "agenda-modal-head";
  head.innerHTML = `<div><p class="eyebrow">${agendaLabels.kicker}</p><h2 id="agenda-modal-title">${agendaLabels.title}</h2></div><button type="button" class="agenda-modal-close" aria-label="${agendaLabels.close}">×</button>`;
  const body = document.createElement("div");
  body.className = "agenda-modal-body";
  const grouped = new Map();
  events.forEach((event) => {
    const key = event.date.slice(0, 7);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  });
  if (!events.length) body.innerHTML = `<p class="agenda-empty">${agendaLabels.empty}</p>`;
  grouped.forEach((monthEvents) => {
    const month = document.createElement("section");
    month.className = "agenda-month";
    const monthTitle = document.createElement("h3");
    monthTitle.textContent = new Intl.DateTimeFormat(localeCode, { month: "long", year: "numeric" }).format(dateAtNoon(monthEvents[0].date));
    const list = document.createElement("div");
    list.className = "agenda-list";
    monthEvents.forEach((event) => {
      const item = document.createElement("article");
      item.className = event.artist;
      item.style.setProperty("--agenda-accent", agendaAccent(event));
      item.innerHTML = `<time datetime="${event.date}">${new Intl.DateTimeFormat(localeCode, { day: "2-digit" }).format(dateAtNoon(event.date))}</time><div><small></small><h4></h4><p></p></div>`;
      item.querySelector("small").textContent = localizedValue(event.label);
      item.querySelector("h4").textContent = localizedValue(event.title);
      item.querySelector("p").textContent = venueLine(event);
      list.append(item);
    });
    month.append(monthTitle, list);
    body.append(month);
  });
  dialog.append(head, body);
  head.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  return dialog;
}

function agendaTickerItem(event) {
  const item = document.createElement("article");
  item.className = `agenda-ticker-item ${event.artist}`;
  item.style.setProperty("--agenda-accent", agendaAccent(event));
  const date = dateAtNoon(event.date);
  const day = new Intl.DateTimeFormat(localeCode, { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat(localeCode, { month: "short" }).format(date).replace(".", "");
  item.innerHTML = `<time datetime="${event.date}"><strong>${day}</strong><span>${month}</span></time><div><small></small><h3></h3><p></p></div>`;
  item.querySelector("small").textContent = localizedValue(event.label);
  item.querySelector("h3").textContent = localizedValue(event.title);
  item.querySelector("p").textContent = venueLine(event);
  return item;
}

async function initializeAgenda() {
  if (!document.body.classList.contains("home-page")) return;
  const footer = document.querySelector(".site-footer");
  if (!footer) return;
  try {
    const response = await fetch("/assets/data/agenda.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("agenda_unavailable");
    const data = await response.json();
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const events = (Array.isArray(data.events) ? data.events : []).filter((event) => event?.date && event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    injectEventSchema(events);
    const dialog = buildAgendaDialog(events);
    const section = document.createElement("section");
    section.className = "footer-agenda";
    section.setAttribute("aria-label", agendaLabels.title);
    const shell = document.createElement("div");
    shell.className = "shell agenda-ticker";
    const label = document.createElement("div");
    label.className = "agenda-ticker-label";
    label.textContent = agendaLabels.kicker;
    const windowElement = document.createElement("div");
    windowElement.className = "agenda-ticker-window";
    const track = document.createElement("div");
    track.className = "agenda-ticker-track";
    track.style.setProperty("--agenda-duration", `${Math.max(48, events.length * 7)}s`);
    const group = document.createElement("div");
    group.className = "agenda-ticker-group";
    if (events.length) events.forEach((event) => group.append(agendaTickerItem(event)));
    else group.innerHTML = `<p class="agenda-empty">${agendaLabels.empty}</p>`;
    track.append(group);
    if (events.length && !reducedMotion) {
      const duplicate = group.cloneNode(true);
      duplicate.setAttribute("aria-hidden", "true");
      track.append(duplicate);
    }
    windowElement.append(track);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "agenda-open";
    open.textContent = agendaLabels.open;
    open.addEventListener("click", () => dialog.showModal());
    shell.append(label, windowElement, open);
    section.append(shell);
    footer.before(section);
  } catch (error) {
    console.error("Agenda could not be loaded", error);
  }
}

function initializeMobileBookingAction() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;
  const isArtistsPage = Boolean(document.querySelector("#artistContactForm"));
  const action = document.createElement(isArtistsPage ? "a" : "button");
  action.className = "mobile-booking-cta";
  if (isArtistsPage) {
    action.href = "#artist-form";
    action.textContent = isPortuguese ? "Enviar projeto" : isSpanish ? "Enviar proyecto" : "Send project";
  } else {
    action.type = "button";
    action.textContent = isPortuguese ? "Pedir booking" : isSpanish ? "Solicitar booking" : "Request booking";
    action.addEventListener("click", () => openBooking(currentArtistName()));
  }
  document.body.append(action);
  const update = () => {
    const footerVisible = footer.getBoundingClientRect().top < innerHeight;
    action.classList.toggle("visible", innerWidth <= 760 && scrollY > 260 && !footerVisible && !bookingDialog.open);
  };
  bookingDialog.addEventListener("close", update);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
}

initializeAgenda();
loadApprovedNews().finally(initializeAutoRails);
initializeMobileBookingAction();
