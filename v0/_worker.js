const BOOKING_EMAIL = "booking@caravelaamarela.com";
const SENDER_EMAIL = "forms@caravelaamarela.com";
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_FIELD_LENGTH = 20_000;

const STATIC_REDIRECTS = new Map([
  ["/index.html", "/"],
  ["/wildchains.html", "/wildchains"],
  ["/devil-of-a-woman.html", "/devil-of-a-woman"],
  ["/for-artists.html", "/for-artists"],
  ["/en/index.html", "/en/"],
  ["/en/wildchains.html", "/en/wildchains"],
  ["/en/devil-of-a-woman.html", "/en/devil-of-a-woman"],
  ["/en/for-artists.html", "/en/for-artists"],
  ["/es/index.html", "/es/"],
  ["/es/wildchains.html", "/es/wildchains"],
  ["/es/devil-of-a-woman.html", "/es/devil-of-a-woman"],
  ["/es/para-artistas.html", "/es/para-artistas"],
]);

const STATIC_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; media-src 'self' https:; frame-src https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com; connect-src 'self' https://static.cloudflareinsights.com https://*.cloudflareinsights.com; form-action 'self'; upgrade-insecure-requests",
};

const FORM_DEFINITIONS = {
  booking: {
    required: ["contactName", "contactEmail", "artist", "eventType", "city"],
    labels: {
      contactName: "Nome do contacto",
      contactEmail: "Email",
      artist: "Artista",
      eventType: "Tipo de evento",
      eventDate: "Data",
      city: "Cidade / Local",
      message: "Mensagem",
    },
  },
  artist: {
    required: ["artistName", "contactEmail", "city", "request", "links"],
    labels: {
      artistName: "Nome artístico",
      contactEmail: "Email",
      city: "Cidade / Região",
      request: "Pedido",
      links: "Links",
      message: "Mensagem",
    },
  },
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanValue(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\r\n?/g, "\n");
}

function subjectValue(value) {
  return cleanValue(value).replace(/\s*\n\s*/g, " ").slice(0, 160);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function subjectFor(formType, fields) {
  if (formType === "booking") {
    return `[Booking] ${subjectValue(fields.artist)} — ${subjectValue(fields.city)}`;
  }
  return `[For Artists] ${subjectValue(fields.artistName)} — ${subjectValue(fields.request)}`;
}

function emailContent(formType, language, fields, submissionId) {
  const definition = FORM_DEFINITIONS[formType];
  const rows = Object.entries(definition.labels).map(([key, label]) => {
    const value = fields[key] || "—";
    return { label, value };
  });

  const text = [
    formType === "booking" ? "Novo pedido de booking" : "Novo contacto For Artists",
    `Referência: ${submissionId}`,
    `Idioma do formulário: ${language}`,
    "",
    ...rows.map(({ label, value }) => `${label}: ${value}`),
  ].join("\n");

  const htmlRows = rows
    .map(
      ({ label, value }) =>
        `<tr><th style="padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #ddd">${escapeHtml(label)}</th><td style="padding:8px 12px;white-space:pre-wrap;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#181818;line-height:1.5">
      <h1 style="font-size:22px">${formType === "booking" ? "Novo pedido de booking" : "Novo contacto For Artists"}</h1>
      <p><strong>Referência:</strong> ${escapeHtml(submissionId)}<br><strong>Idioma:</strong> ${escapeHtml(language)}</p>
      <table style="width:100%;max-width:760px;border-collapse:collapse;border:1px solid #ddd">${htmlRows}</table>
      <p style="margin-top:18px">Responde diretamente a este email para contactar ${escapeHtml(fields.contactEmail)}.</p>
    </div>`;

  return { text, html };
}

async function ensureDatabase(database) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS contact_submissions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        form_type TEXT NOT NULL,
        language TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        payload TEXT NOT NULL,
        email_status TEXT NOT NULL DEFAULT 'pending',
        email_error TEXT
      )`,
    )
    .run();

  await database
    .prepare(
      "DELETE FROM contact_submissions WHERE datetime(created_at) < datetime('now', '-12 months')",
    )
    .run();
}

async function sendNotification(env, formType, language, fields, submissionId) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_EMAIL_API_TOKEN) {
    throw new Error("Email service is not configured");
  }

  const { text, html } = emailContent(formType, language, fields, submissionId);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: BOOKING_EMAIL,
        from: { address: SENDER_EMAIL, name: "Caravela Amarela — Formulários" },
        reply_to: fields.contactEmail,
        subject: subjectFor(formType, fields),
        text,
        html,
        headers: {
          "Auto-Submitted": "auto-generated",
          "Content-Language": language,
          "X-Submission-ID": submissionId,
        },
      }),
    },
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    const detail = result?.errors?.[0]?.message || `Email API returned ${response.status}`;
    throw new Error(detail);
  }
}

async function handlePost({ request, env }) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ ok: false, error: "request_too_large" }, 413);
  }

  let body;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ ok: false, error: "request_too_large" }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const formType = cleanValue(body.formType);
  const definition = FORM_DEFINITIONS[formType];
  if (!definition) return json({ ok: false, error: "invalid_form" }, 400);

  const language = cleanValue(body.language) || "pt-PT";
  const rawFields = body.fields && typeof body.fields === "object" ? body.fields : {};
  const fields = {};

  for (const key of Object.keys(definition.labels)) {
    const value = cleanValue(rawFields[key]);
    if (value.length > MAX_FIELD_LENGTH) {
      return json({ ok: false, error: "field_too_long", field: key }, 400);
    }
    fields[key] = value;
  }

  const missing = definition.required.filter((key) => !fields[key]);
  if (missing.length) {
    return json({ ok: false, error: "missing_fields", fields: missing }, 400);
  }
  if (!isValidEmail(fields.contactEmail)) {
    return json({ ok: false, error: "invalid_email" }, 400);
  }
  if (!env.CONTACTS_DB) {
    return json({ ok: false, error: "storage_unavailable" }, 503);
  }

  const submissionId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const name = formType === "booking" ? fields.contactName : fields.artistName;

  try {
    await ensureDatabase(env.CONTACTS_DB);
    await env.CONTACTS_DB
      .prepare(
        `INSERT INTO contact_submissions
          (id, created_at, form_type, language, name, email, payload, email_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(
        submissionId,
        createdAt,
        formType,
        language,
        name,
        fields.contactEmail,
        JSON.stringify(fields),
      )
      .run();
  } catch (error) {
    console.error("Contact form storage failed", error);
    return json({ ok: false, error: "storage_failed" }, 503);
  }

  let notified = false;
  let emailError = "";
  try {
    await sendNotification(env, formType, language, fields, submissionId);
    notified = true;
  } catch (error) {
    console.error("Contact form email failed", error);
    emailError = String(error?.message || error).slice(0, 1000);
  }

  try {
    await env.CONTACTS_DB
      .prepare(
        "UPDATE contact_submissions SET email_status = ?, email_error = ? WHERE id = ?",
      )
      .bind(notified ? "sent" : "failed", emailError || null, submissionId)
      .run();
  } catch (error) {
    console.error("Contact form delivery status update failed", error);
  }

  return json({ ok: true, saved: true, notified, submissionId }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "method_not_allowed" }, 405);
      }
      return handlePost({ request, env });
    }

    const redirectPath = STATIC_REDIRECTS.get(url.pathname);
    if (redirectPath) {
      const destination = new URL(redirectPath, url);
      destination.search = url.search;
      return Response.redirect(destination, 301);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const response = new Response(assetResponse.body, assetResponse);
    for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }
    return response;
  },
};
