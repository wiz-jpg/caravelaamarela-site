document.documentElement.classList.add("js");

// Mobile navigation
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

// Dynamic year
document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

// Horizontal press and agenda rails
function railStep(rail) {
  const card = rail.querySelector(".press-card, .agenda-event");
  if (!card) return Math.max(rail.clientWidth * 0.8, 280);
  const railStyle = getComputedStyle(rail);
  const cardStyle = getComputedStyle(card);
  const spacing = (Number.parseFloat(railStyle.columnGap) || 0) + (Number.parseFloat(cardStyle.marginRight) || 0);
  return card.getBoundingClientRect().width + spacing;
}

document.querySelectorAll(".press-section, .agenda-section").forEach((section) => {
  const rail = section.querySelector("[data-rail]");
  if (!rail) return;
  section.querySelector("[data-rail-prev]")?.addEventListener("click", () => {
    rail.scrollBy({ left: -railStep(rail), behavior: "smooth" });
  });
  section.querySelector("[data-rail-next]")?.addEventListener("click", () => {
    rail.scrollBy({ left: railStep(rail), behavior: "smooth" });
  });
  rail.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    rail.scrollBy({ left: railStep(rail) * direction, behavior: "smooth" });
  });
});

// Deep-link an artist into the booking form.
const bookingArtist = document.querySelector("#bookingArtist");
if (bookingArtist) {
  const wanted = new URLSearchParams(location.search).get("artist");
  if (wanted && [...bookingArtist.options].some((option) => option.value === wanted)) {
    bookingArtist.value = wanted;
  }
}

const eventDate = document.querySelector("#eventDate");
if (eventDate) {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  eventDate.min = localDate.toISOString().slice(0, 10);
}

const language = document.documentElement.lang || "pt-PT";
const isPortuguese = language.startsWith("pt");
const isSpanish = language.startsWith("es");

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
    ? `${isPortuguese ? "Pedido de Booking" : isSpanish ? "Solicitud de Booking" : "Booking request"} — ${fields.artist}`
    : `For Artists — ${fields.artistName}`;

  const lines = formType === "booking"
    ? [
        `Nome / Name: ${fields.contactName}`,
        `Email: ${fields.contactEmail}`,
        `Artista / Artist: ${fields.artist}`,
        `Tipo / Type: ${fields.eventType}`,
        `Data / Date: ${fields.eventDate || "—"}`,
        `Cidade / Local: ${fields.city}`,
        "",
        fields.message || "",
      ]
    : [
        `Nome artístico / Artist: ${fields.artistName}`,
        `Email: ${fields.contactEmail}`,
        `Cidade / City: ${fields.city}`,
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

const bookingForm = document.querySelector("#bookingForm");
bookingForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitContactForm(bookingForm, "booking");
});

const artistForm = document.querySelector("#artistContactForm");
artistForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitContactForm(artistForm, "artist");
});

// Compact, swipeable live-gallery carousels.
const galleryLabels = isPortuguese
  ? { rail: "Galeria de fotografias ao vivo", previous: "Fotografias anteriores", next: "Fotografias seguintes" }
  : isSpanish
    ? { rail: "Galería de fotografías en directo", previous: "Fotografías anteriores", next: "Fotografías siguientes" }
    : { rail: "Live photo gallery", previous: "Previous photographs", next: "Next photographs" };

function galleryScrollStep(rail) {
  const item = rail.querySelector(".gallery-item");
  if (!item) return Math.max(rail.clientWidth * 0.75, 240);
  const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
  return item.getBoundingClientRect().width + gap;
}

function scrollGallery(rail, direction) {
  const railLeft = rail.getBoundingClientRect().left;
  const positions = [...rail.querySelectorAll(".gallery-item")].map((item) => (
    item.getBoundingClientRect().left - railLeft + rail.scrollLeft
  ));
  const current = rail.scrollLeft;
  const target = direction > 0
    ? positions.find((position) => position > current + 4)
    : [...positions].reverse().find((position) => position < current - 4);
  if (typeof target === "number") rail.scrollTo({ left: target, behavior: "smooth" });
  else rail.scrollBy({ left: galleryScrollStep(rail) * direction, behavior: "smooth" });
}

document.querySelectorAll("[data-gallery-rail]").forEach((rail) => {
  rail.setAttribute("aria-label", galleryLabels.rail);
  rail.setAttribute("tabindex", "0");

  const controls = document.createElement("div");
  controls.className = "gallery-arrows";
  controls.innerHTML = `
    <button type="button" aria-label="${galleryLabels.previous}">←</button>
    <button type="button" aria-label="${galleryLabels.next}">→</button>
  `;

  const [previous, next] = controls.querySelectorAll("button");
  rail.closest(".live-gallery-section")?.querySelector(".gallery-head")?.append(controls);

  const updateControls = () => {
    const maxScroll = Math.max(rail.scrollWidth - rail.clientWidth, 0);
    previous.disabled = rail.scrollLeft <= 2;
    next.disabled = rail.scrollLeft >= maxScroll - 2;
  };

  previous.addEventListener("click", () => {
    scrollGallery(rail, -1);
  });
  next.addEventListener("click", () => {
    scrollGallery(rail, 1);
  });
  rail.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    scrollGallery(rail, direction);
  });

  let updateFrame = 0;
  rail.addEventListener("scroll", () => {
    cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(updateControls);
  }, { passive: true });
  window.addEventListener("resize", updateControls, { passive: true });
  updateControls();
});

// Accessible image viewer for the live galleries.
const galleryItems = document.querySelectorAll("[data-gallery-src]");
if (galleryItems.length) {
  const dialog = document.createElement("dialog");
  dialog.className = "gallery-dialog";
  dialog.innerHTML = `
    <button type="button" class="gallery-close" aria-label="${isPortuguese ? "Fechar imagem" : isSpanish ? "Cerrar imagen" : "Close image"}">×</button>
    <img alt="">
  `;
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

// Site-wide agenda: one compact rotating date above the footer, with the full
// chronological calendar available in an accessible dialog.
const localeKey = isPortuguese ? "pt" : isSpanish ? "es" : "en";
const localeCode = isPortuguese ? "pt-PT" : isSpanish ? "es-ES" : "en-GB";
const agendaLabels = isPortuguese
  ? {
      kicker: "Agenda",
      open: "Ver agenda completa",
      title: "Próximas datas",
      close: "Fechar agenda",
      pause: "Pausar rotação da agenda",
      play: "Retomar rotação da agenda",
      empty: "Não existem datas anunciadas neste momento.",
    }
  : isSpanish
    ? {
        kicker: "Agenda",
        open: "Ver agenda completa",
        title: "Próximas fechas",
        close: "Cerrar agenda",
        pause: "Pausar rotación de la agenda",
        play: "Reanudar rotación de la agenda",
        empty: "No hay fechas anunciadas en este momento.",
      }
    : {
        kicker: "Live",
        open: "View full calendar",
        title: "Upcoming dates",
        close: "Close calendar",
        pause: "Pause calendar rotation",
        play: "Resume calendar rotation",
        empty: "There are no announced dates at the moment.",
      };

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

function injectEventSchema(events) {
  if (!events.length) return;
  const schema = events.map((event) => {
    const performers = event.artist === "wild"
      ? [{ "@type": "MusicGroup", name: "WILDCHAINS" }]
      : event.artist === "devil"
        ? [{ "@type": "MusicGroup", name: "Devil of a Woman" }]
        : [
            { "@type": "MusicGroup", name: "WILDCHAINS" },
            { "@type": "MusicGroup", name: "Devil of a Woman" },
          ];
    return {
      "@context": "https://schema.org",
      "@type": "MusicEvent",
      name: localizedValue(event.title),
      startDate: event.date,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: {
        "@type": "MusicVenue",
        name: localizedValue(event.venue),
        address: localizedValue(event.city),
      },
      performer: performers,
      organizer: { "@id": "https://caravelaamarela.com/#organization" },
    };
  });
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
  const headingWrap = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = agendaLabels.kicker;
  const heading = document.createElement("h2");
  heading.id = "agenda-modal-title";
  heading.textContent = agendaLabels.title;
  headingWrap.append(eyebrow, heading);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "agenda-modal-close";
  close.setAttribute("aria-label", agendaLabels.close);
  close.textContent = "×";
  head.append(headingWrap, close);

  const body = document.createElement("div");
  body.className = "agenda-modal-body";
  const grouped = new Map();
  events.forEach((event) => {
    const key = event.date.slice(0, 7);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  });

  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "agenda-empty";
    empty.textContent = agendaLabels.empty;
    body.append(empty);
  }

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
      const time = document.createElement("time");
      time.dateTime = event.date;
      time.textContent = new Intl.DateTimeFormat(localeCode, { day: "2-digit" }).format(dateAtNoon(event.date));
      const copy = document.createElement("div");
      const label = document.createElement("small");
      label.textContent = localizedValue(event.label);
      const title = document.createElement("h4");
      title.textContent = localizedValue(event.title);
      const place = document.createElement("p");
      place.textContent = venueLine(event);
      copy.append(label, title, place);
      item.append(time, copy);
      list.append(item);
    });

    month.append(monthTitle, list);
    body.append(month);
  });

  dialog.append(head, body);
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  return dialog;
}

async function initializeAgenda() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;

  try {
    const response = await fetch("/assets/data/agenda.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("agenda_unavailable");
    const data = await response.json();
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const events = (Array.isArray(data.events) ? data.events : [])
      .filter((event) => event?.date && event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    injectEventSchema(events);
    const dialog = buildAgendaDialog(events);
    const section = document.createElement("section");
    section.className = "footer-agenda";
    section.setAttribute("aria-label", agendaLabels.title);
    const live = document.createElement("div");
    live.className = "agenda-live shell";
    const kicker = document.createElement("div");
    kicker.className = "agenda-kicker";
    kicker.textContent = agendaLabels.kicker;
    const current = document.createElement("div");
    current.className = "agenda-current";
    current.setAttribute("aria-live", "off");
    const controls = document.createElement("div");
    controls.className = "agenda-controls";
    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "agenda-pause";
    pause.setAttribute("aria-label", agendaLabels.pause);
    pause.textContent = "Ⅱ";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "agenda-open";
    open.textContent = agendaLabels.open;
    controls.append(pause, open);
    live.append(kicker, current, controls);
    section.append(live);
    footer.before(section);

    let index = 0;
    let timer = 0;
    let manuallyPaused = false;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      current.replaceChildren();
      if (!events.length) {
        const message = document.createElement("p");
        message.className = "agenda-empty";
        message.textContent = agendaLabels.empty;
        current.append(message);
        pause.hidden = true;
        return;
      }
      const event = events[index];
      section.style.setProperty("--agenda-accent", agendaAccent(event));
      const date = dateAtNoon(event.date);
      const time = document.createElement("time");
      time.className = "agenda-date";
      time.dateTime = event.date;
      const day = document.createElement("strong");
      day.textContent = new Intl.DateTimeFormat(localeCode, { day: "2-digit" }).format(date);
      const month = document.createElement("span");
      month.textContent = new Intl.DateTimeFormat(localeCode, { month: "short" }).format(date).replace(".", "");
      time.append(day, month);
      const copy = document.createElement("div");
      copy.className = "agenda-event-copy";
      const nameWrap = document.createElement("div");
      const label = document.createElement("small");
      label.textContent = localizedValue(event.label);
      const title = document.createElement("strong");
      title.textContent = localizedValue(event.title);
      nameWrap.append(label, title);
      const place = document.createElement("p");
      place.textContent = venueLine(event);
      copy.append(nameWrap, place);
      current.append(time, copy);
      current.classList.remove("agenda-fade");
      requestAnimationFrame(() => current.classList.add("agenda-fade"));
    };

    const stop = () => {
      clearInterval(timer);
      timer = 0;
    };
    const start = () => {
      stop();
      if (reducedMotion || manuallyPaused || events.length < 2) return;
      timer = window.setInterval(() => {
        index = (index + 1) % events.length;
        render();
      }, 6000);
    };

    pause.addEventListener("click", () => {
      manuallyPaused = !manuallyPaused;
      pause.textContent = manuallyPaused ? "▶" : "Ⅱ";
      pause.setAttribute("aria-label", manuallyPaused ? agendaLabels.play : agendaLabels.pause);
      manuallyPaused ? stop() : start();
    });
    section.addEventListener("mouseenter", stop);
    section.addEventListener("mouseleave", start);
    section.addEventListener("focusin", stop);
    section.addEventListener("focusout", (event) => {
      if (!section.contains(event.relatedTarget)) start();
    });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    open.addEventListener("click", () => {
      stop();
      dialog.showModal();
    });
    dialog.addEventListener("close", start);
    render();
    start();
  } catch (error) {
    console.error("Agenda could not be loaded", error);
  }
}

// Published news can be added after editorial approval without rebuilding the
// static pages. DOM nodes are built with textContent to keep remote data inert.
function currentArtistFilter() {
  const main = document.querySelector("main.artist");
  if (main?.classList.contains("wild")) return "wild";
  if (main?.classList.contains("devil")) return "devil";
  return "all";
}

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
  const rail = document.querySelector(".press-section .press-rail, .home-current .press-rail");
  if (!rail) return;
  const artist = currentArtistFilter();
  try {
    const response = await fetch(`/api/news?artist=${encodeURIComponent(artist)}&locale=${localeKey}`, { headers: { Accept: "application/json" } });
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

function initializeMobileBookingAction() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;
  const action = document.createElement("a");
  action.className = "mobile-booking-cta";
  const isArtistsPage = Boolean(document.querySelector("#artistContactForm"));
  const artist = currentArtistFilter();
  if (isArtistsPage) {
    action.href = "#artist-form";
    action.textContent = isPortuguese ? "Enviar projeto" : isSpanish ? "Enviar proyecto" : "Send project";
  } else if (artist === "wild" || artist === "devil") {
    const prefix = isPortuguese ? "/" : isSpanish ? "/es/" : "/en/";
    const artistName = artist === "wild" ? "WILDCHAINS" : "Devil of a Woman";
    action.href = `${prefix}?artist=${encodeURIComponent(artistName)}#contact`;
    action.textContent = isPortuguese ? "Pedir booking" : isSpanish ? "Solicitar booking" : "Request booking";
  } else {
    action.href = "#contact";
    action.textContent = isPortuguese ? "Pedir booking" : isSpanish ? "Solicitar booking" : "Request booking";
  }
  document.body.append(action);

  const update = () => {
    const footerVisible = footer.getBoundingClientRect().top < innerHeight;
    action.classList.toggle("visible", innerWidth <= 760 && scrollY > 260 && !footerVisible);
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
}

initializeAgenda();
loadApprovedNews();
initializeMobileBookingAction();
