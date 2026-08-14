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

// Horizontal press rails
function railStep(rail) {
  const card = rail.querySelector(".press-card");
  if (!card) return Math.max(rail.clientWidth * 0.8, 280);
  return card.getBoundingClientRect().width + 14;
}

document.querySelectorAll(".press-section").forEach((section) => {
  const rail = section.querySelector("[data-rail]");
  if (!rail) return;
  section.querySelector("[data-rail-prev]")?.addEventListener("click", () => {
    rail.scrollBy({ left: -railStep(rail), behavior: "smooth" });
  });
  section.querySelector("[data-rail-next]")?.addEventListener("click", () => {
    rail.scrollBy({ left: railStep(rail), behavior: "smooth" });
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
      saved: "O pedido ficou guardado, mas a notificação por email falhou. Envia também diretamente para booking@caravelaamarela.com.",
      error: "Não foi possível enviar o formulário. Envia o pedido diretamente por email.",
      fallback: "Abrir email alternativo ↗",
    }
  : isSpanish
    ? {
        sending: "Enviando…",
        success: "Solicitud enviada. Responderemos lo antes posible.",
        saved: "La solicitud quedó guardada, pero falló la notificación por email. Envíala también directamente a booking@caravelaamarela.com.",
        error: "No ha sido posible enviar el formulario. Envíalo directamente por email.",
        fallback: "Abrir email alternativo ↗",
      }
    : {
        sending: "Sending…",
        success: "Request sent. We will reply as soon as possible.",
        saved: "The request was saved, but the email notification failed. Please also send it directly to booking@caravelaamarela.com.",
        error: "The form could not be sent. Please send the request directly by email.",
        fallback: "Open fallback email ↗",
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

// Accessible image viewer for the compact live galleries.
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
