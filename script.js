import { renderSiteLayout } from "./components/layout.js";

renderSiteLayout();

const root = document.documentElement;
const langToggle = document.querySelector("[data-lang-toggle]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const header = document.querySelector("[data-header]");

/* =========================
   LANGUAGE
   ========================= */

function setLanguage(lang) {
  root.setAttribute("lang", lang);
  localStorage.setItem("caravela-lang", lang);

  const flag = document.querySelector("[data-lang-flag]");
  const label = document.querySelector("[data-lang-label]");

  if (flag && label) {
    if (lang === "pt") {
      flag.textContent = "🇬🇧";
      label.textContent = "EN";
      langToggle?.setAttribute("aria-label", "Switch to English");
    } else {
      flag.textContent = "🇵🇹";
      label.textContent = "PT";
      langToggle?.setAttribute("aria-label", "Mudar para português");
    }
  }
}

setLanguage(localStorage.getItem("caravela-lang") || "pt");

langToggle?.addEventListener("click", () => {
  const next = root.getAttribute("lang") === "pt" ? "en" : "pt";
  setLanguage(next);
});

/* =========================
   NAV
   ========================= */

navToggle?.addEventListener("click", () => {
  nav?.classList.toggle("open");
  navToggle.classList.toggle("open");
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav?.classList.remove("open");
    navToggle?.classList.remove("open");
  });
});

window.addEventListener("scroll", () => {
  header?.classList.toggle("scrolled", window.scrollY > 20);
});

/* =========================
   YEAR
   ========================= */

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

/* =========================
   REVEAL ANIMATION
   ========================= */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((el) => {
  revealObserver.observe(el);
});

/* =========================
   COPY BUTTONS
   ========================= */

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.getAttribute("data-copy");

    try {
      await navigator.clipboard.writeText(value);

      const original = button.textContent;
      button.textContent =
        root.getAttribute("lang") === "pt" ? "Email copiado" : "Email copied";

      setTimeout(() => {
        button.textContent = original;
      }, 1600);
    } catch {
      window.location.href = `mailto:${value}`;
    }
  });
});

/* =========================
   BOOKING FORM — HOMEPAGE
   ========================= */

const bookingForm = document.querySelector("#bookingForm");

if (bookingForm) {
  bookingForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const eventType = document.querySelector("#eventType")?.value || "-";
    const eventDate = document.querySelector("#eventDate")?.value || "-";
    const city = document.querySelector("#city")?.value || "-";
    const message = document.querySelector("#message")?.value || "-";

    const subject = "Pedido de Booking — Caravela Amarela";

    const body = `
Olá Caravela Amarela,

Gostaria de pedir disponibilidade para uma possível data.

Tipo de evento: ${eventType}
Data: ${eventDate}
Cidade / Local: ${city}

Mensagem:
${message}

Obrigado.
`.trim();

    const mailto = `mailto:geral@caravelaamarela.pt?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  });
}

/* =========================
   ARTIST CONTACT FORM — FOR ARTISTS
   ========================= */

const artistContactForm = document.querySelector("#artistContactForm");

if (artistContactForm) {
  artistContactForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const artistName = document.querySelector("#artistName")?.value || "-";
    const artistEmail = document.querySelector("#artistEmail")?.value || "-";
    const artistCity = document.querySelector("#artistCity")?.value || "-";
    const artistRequest = document.querySelector("#artistRequest")?.value || "-";
    const artistLinks = document.querySelector("#artistLinks")?.value || "-";
    const artistMessage = document.querySelector("#artistMessage")?.value || "-";

    const subject = `For Artists — ${artistName}`;

    const body = `
Olá Caravela Amarela,

Gostaria de apresentar o meu projeto.

Nome artístico: ${artistName}
Email: ${artistEmail}
Cidade / Região: ${artistCity}
Pedido: ${artistRequest}

Links:
${artistLinks}

Mensagem:
${artistMessage}

Obrigado.
`.trim();

    const mailto = `mailto:geral@caravelaamarela.pt?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  });
}

/* =========================
   OPTIONAL LEGACY CONTACT FORM SUPPORT
   ========================= */

const contactForm = document.querySelector("[data-contact-form]");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(contactForm);
    const name = data.get("name") || "";
    const email = data.get("email") || "";
    const context = data.get("context") || "";
    const message = data.get("message") || "";

    const subject = `Pedido de Booking — ${context || name || "Caravela Amarela"}`;

    const body = `
Nome: ${name}
Email: ${email}
Contexto: ${context}

Mensagem:
${message}
`.trim();

    window.location.href = `mailto:geral@caravelaamarela.pt?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  });
}

/* =========================
   PRESS SLIDER
   Safer version for multiple sliders
   ========================= */

document.querySelectorAll("[data-press-slider]").forEach((slider) => {
  const section = slider.closest(".press-slider-section") || document;
  const track = slider.querySelector("[data-press-track]");
  const slides = Array.from(slider.querySelectorAll(".press-slide"));
  const prev = section.querySelector("[data-press-prev]");
  const next = section.querySelector("[data-press-next]");
  const dotsWrap = slider.querySelector("[data-press-dots]");

  if (!track || slides.length === 0 || !dotsWrap) return;

  dotsWrap.innerHTML = "";

  let current = 0;

  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Press quote ${index + 1}`);
    dot.addEventListener("click", () => goTo(index));
    dotsWrap.appendChild(dot);
  });

  const dots = Array.from(dotsWrap.querySelectorAll("button"));

  function update() {
    track.style.transform = `translateX(-${current * 100}%)`;

    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index === current);
    });
  }

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    update();
  }

  prev?.addEventListener("click", () => goTo(current - 1));
  next?.addEventListener("click", () => goTo(current + 1));

  update();
});

/* =========================
   PRESS ARTICLE MODAL
   ========================= */

const pressModal = document.querySelector("[data-press-modal]");
const pressModalTitle = document.querySelector("[data-press-modal-title]");
const pressModalSource = document.querySelector("[data-press-modal-source]");
const pressModalDate = document.querySelector("[data-press-modal-date]");
const pressModalHighlight = document.querySelector("[data-press-modal-highlight]");
const pressModalLink = document.querySelector("[data-press-modal-link]");

function closePressModal() {
  if (!pressModal) return;

  pressModal.hidden = true;
  document.body.style.overflow = "";
}

document.querySelectorAll("[data-press-open]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!pressModal) return;

    const lang = document.documentElement.getAttribute("lang") || "pt";

    const highlight =
      lang === "en"
        ? button.getAttribute("data-highlight-en")
        : button.getAttribute("data-highlight-pt");

    if (pressModalTitle) {
      pressModalTitle.textContent = button.getAttribute("data-title") || "";
    }

    if (pressModalSource) {
      pressModalSource.textContent = button.getAttribute("data-source") || "";
    }

    if (pressModalDate) {
      pressModalDate.textContent = button.getAttribute("data-date") || "";
    }

    if (pressModalHighlight) {
      pressModalHighlight.textContent = highlight || "";
    }

    if (pressModalLink) {
      pressModalLink.href = button.getAttribute("data-url") || "#";
    }

    pressModal.hidden = false;
    document.body.style.overflow = "hidden";
  });
});

document.querySelectorAll("[data-press-close]").forEach((button) => {
  button.addEventListener("click", closePressModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePressModal();
  }
});

/* For Artists — service chips click/tap descriptions */
document.querySelectorAll(".service-chip-panel").forEach((panel) => {
  const buttons = Array.from(panel.querySelectorAll("[data-service]"));
  const descBox = panel.querySelector("[data-service-desc-box]");
  const descriptions = Array.from(panel.querySelectorAll("[data-service-desc]"));

  if (!buttons.length || !descBox || !descriptions.length) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedService = button.getAttribute("data-service");

      buttons.forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });

      descriptions.forEach((description) => {
        description.classList.toggle(
          "is-active",
          description.getAttribute("data-service-desc") === selectedService
        );
      });

      descBox.classList.add("is-active");
    });
  });
});