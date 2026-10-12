import { handleControl } from "./control-vault.js";
const BOOKING_EMAIL = "booking@caravelaamarela.com";
const SENDER_EMAIL = "notifications@forms.caravelaamarela.com";
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_FIELD_LENGTH = 20_000;
const NEWS_SCAN_INTERVAL_MS = 12 * 60 * 60 * 1000;
const NEWS_QUERIES = [
  { artist: "wild", name: "WILDCHAINS", query: '"WILDCHAINS" banda OR música' },
  { artist: "devil", name: "Devil of a Woman", query: '"Devil of a Woman" banda OR blues' },
];

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
    required: ["contactName", "contactEmail", "artist", "eventDetails"],
    labels: {
      contactName: "Nome do contacto",
      contactEmail: "Email",
      artist: "Artista",
      eventDetails: "Evento, local e data",
      message: "Mensagem",
    },
  },
  artist: {
    required: ["artistName", "contactEmail", "request", "links"],
    labels: {
      artistName: "Nome artístico",
      contactEmail: "Email",
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

function publicJson(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function htmlResponse(markup, status = 200) {
  return new Response(markup, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
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
    return `[Booking] ${subjectValue(fields.artist)} — ${subjectValue(fields.eventDetails)}`;
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

async function ensureNewsDatabase(database) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS news_candidates (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        discovered_at TEXT NOT NULL,
        published_at TEXT,
        artist TEXT NOT NULL,
        title TEXT NOT NULL,
        source TEXT,
        url TEXT NOT NULL UNIQUE,
        excerpt TEXT,
        image_url TEXT,
        image_alt TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        notified_at TEXT,
        reviewed_at TEXT
      )`,
    )
    .run();
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS news_scan_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
  await database
    .prepare("CREATE INDEX IF NOT EXISTS idx_news_status_date ON news_candidates(status, published_at DESC)")
    .run();
}

async function sendNotification(env, formType, language, fields, submissionId) {
  if (!env.RESEND_API_KEY) {
    throw new Error("Email service is not configured");
  }

  const { text, html } = emailContent(formType, language, fields, submissionId);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": submissionId,
    },
    body: JSON.stringify({
      from: `Caravela Amarela — Formulários <${SENDER_EMAIL}>`,
      to: [BOOKING_EMAIL],
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
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id) {
    const detail = result?.message || `Email API returned ${response.status}`;
    throw new Error(detail);
  }
}

function decodeXml(value = "") {
  return String(value)
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripMarkup(value = "") {
  return decodeXml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] || "").trim();
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") return "";
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function parseNewsFeed(xml, artistConfig) {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.slice(0, 12).flatMap((match) => {
    const block = match[1];
    const title = stripMarkup(xmlTag(block, "title"));
    const description = stripMarkup(xmlTag(block, "description"));
    const url = safeExternalUrl(xmlTag(block, "link"));
    const source = stripMarkup(xmlTag(block, "source"));
    const haystack = `${title} ${description}`.toLocaleLowerCase("en");
    if (!url || !haystack.includes(artistConfig.name.toLocaleLowerCase("en"))) return [];
    let publishedAt = "";
    const rawDate = xmlTag(block, "pubDate");
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.valueOf())) publishedAt = parsed.toISOString();
    }
    return [{
      artist: artistConfig.artist,
      title: title.slice(0, 500),
      source: source.slice(0, 180),
      url,
      excerpt: description.slice(0, 1000),
      publishedAt,
    }];
  });
}

function htmlMeta(documentText, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const first = documentText.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"));
    if (first?.[1]) return decodeXml(first[1]).trim();
    const reversed = documentText.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"));
    if (reversed?.[1]) return decodeXml(reversed[1]).trim();
  }
  return "";
}

async function articleMetadata(candidate) {
  const safeUrl = safeExternalUrl(candidate.url);
  if (!safeUrl) return candidate;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(safeUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "CaravelaAmarela-NewsMonitor/1.0 (+https://caravelaamarela.com/)",
      },
    });
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return candidate;
    const documentText = (await response.text()).slice(0, 750_000);
    const finalUrl = safeExternalUrl(response.url) || safeUrl;
    const canonicalMatch = documentText.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
      || documentText.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
    const canonical = canonicalMatch?.[1] ? safeExternalUrl(new URL(decodeXml(canonicalMatch[1]), finalUrl).href) : "";
    const imageRaw = htmlMeta(documentText, ["og:image", "twitter:image"]);
    const imageUrl = imageRaw ? safeExternalUrl(new URL(imageRaw, finalUrl).href) : "";
    const title = htmlMeta(documentText, ["og:title", "twitter:title"]) || candidate.title;
    const excerpt = htmlMeta(documentText, ["og:description", "description", "twitter:description"]) || candidate.excerpt;
    const source = htmlMeta(documentText, ["og:site_name"]) || candidate.source || new URL(finalUrl).hostname.replace(/^www\./, "");
    return {
      ...candidate,
      url: canonical || finalUrl,
      title: stripMarkup(title).slice(0, 500),
      excerpt: stripMarkup(excerpt).slice(0, 1000),
      source: stripMarkup(source).slice(0, 180),
      imageUrl,
    };
  } catch (error) {
    console.warn("News metadata lookup failed", safeUrl, error?.message || error);
    return candidate;
  } finally {
    clearTimeout(timeout);
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function signReviewId(secret, id) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function validReviewToken(secret, id, token) {
  if (!secret || !id || !token) return false;
  const expected = await signReviewId(secret, id);
  if (expected.length !== token.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  }
  return difference === 0;
}

async function sendNewsReview(env, candidate, baseUrl) {
  if (!env.RESEND_API_KEY || !env.NEWS_REVIEW_SECRET) return false;
  const token = await signReviewId(env.NEWS_REVIEW_SECRET, candidate.id);
  const reviewUrl = new URL("/api/news/review", baseUrl);
  reviewUrl.searchParams.set("id", candidate.id);
  reviewUrl.searchParams.set("token", token);
  const artistName = candidate.artist === "devil" ? "Devil of a Woman" : "WILDCHAINS";
  const text = [
    `Nova notícia candidata — ${artistName}`,
    "",
    candidate.title,
    candidate.source || "Fonte não identificada",
    candidate.url,
    "",
    "Rever, editar e aprovar (ou ignorar):",
    reviewUrl.href,
    "",
    "A notícia só aparece no site depois de aprovação.",
  ].join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `news-${candidate.id}`,
    },
    body: JSON.stringify({
      from: `Caravela Amarela — Notícias <${SENDER_EMAIL}>`,
      to: [env.NEWS_NOTIFY_TO || BOOKING_EMAIL],
      subject: `[Notícia para rever] ${artistName} — ${candidate.title.slice(0, 90)}`,
      text,
      html: `<div style="font-family:Arial,sans-serif;color:#181818;line-height:1.5;max-width:720px"><p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#735f00"><strong>Nova notícia candidata · ${escapeHtml(artistName)}</strong></p><h1 style="font-size:24px;line-height:1.15">${escapeHtml(candidate.title)}</h1><p><strong>${escapeHtml(candidate.source || "Fonte não identificada")}</strong></p><p>${escapeHtml(candidate.excerpt || "Sem excerto disponível.")}</p><p><a href="${escapeHtml(reviewUrl.href)}" style="display:inline-block;background:#efc62f;color:#080808;padding:14px 18px;text-decoration:none;font-weight:bold">Rever antes de publicar</a></p><p style="font-size:12px;color:#666">Nada é publicado automaticamente. No ecrã de revisão podes corrigir o título, excerto, imagem e ligação, ou ignorar a peça.</p></div>`,
      headers: { "Auto-Submitted": "auto-generated", "X-News-Candidate-ID": candidate.id },
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id) throw new Error(result?.message || `Email API returned ${response.status}`);
  return true;
}

async function fetchNewsCandidates() {
  const jobs = NEWS_QUERIES.flatMap((config) => {
    const query = encodeURIComponent(config.query);
    return [
      { config, url: `https://www.bing.com/news/search?q=${query}&format=rss&mkt=pt-PT` },
      { config, url: `https://news.google.com/rss/search?q=${query}&hl=pt-PT&gl=PT&ceid=PT:pt-150` },
    ];
  });
  const results = await Promise.allSettled(jobs.map(async ({ config, url }) => {
    const response = await fetch(url, { headers: { Accept: "application/rss+xml,application/xml,text/xml" } });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    return parseNewsFeed(await response.text(), config);
  }));
  const unique = new Map();
  results.forEach((result) => {
    if (result.status !== "fulfilled") {
      console.warn("News feed failed", result.reason?.message || result.reason);
      return;
    }
    result.value.forEach((candidate) => {
      const key = candidate.url.replace(/[?#].*$/, "");
      if (!unique.has(key)) unique.set(key, candidate);
    });
  });
  return [...unique.values()].slice(0, 14);
}

async function scanNews(env, baseUrl, force = false) {
  if (!env.CONTACTS_DB || !env.NEWS_REVIEW_SECRET) return { skipped: "not_configured" };
  await ensureNewsDatabase(env.CONTACTS_DB);
  const state = await env.CONTACTS_DB.prepare("SELECT value FROM news_scan_state WHERE key = 'last_news_scan'").first();
  const lastScan = state?.value ? Date.parse(state.value) : 0;
  if (!force && lastScan && Date.now() - lastScan < NEWS_SCAN_INTERVAL_MS) return { skipped: "not_due" };

  const scannedAt = new Date().toISOString();
  await env.CONTACTS_DB
    .prepare("INSERT INTO news_scan_state (key, value, updated_at) VALUES ('last_news_scan', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(scannedAt, scannedAt)
    .run();

  const candidates = await fetchNewsCandidates();
  let inserted = 0;
  for (const rawCandidate of candidates) {
    const candidate = await articleMetadata(rawCandidate);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      const result = await env.CONTACTS_DB
        .prepare(
          `INSERT OR IGNORE INTO news_candidates
            (id, created_at, updated_at, discovered_at, published_at, artist, title, source, url, excerpt, image_url, image_alt, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        )
        .bind(
          id,
          now,
          now,
          now,
          candidate.publishedAt || now,
          candidate.artist,
          candidate.title || "Notícia sem título",
          candidate.source || "",
          candidate.url,
          candidate.excerpt || "",
          candidate.imageUrl || "",
          candidate.title || "",
        )
        .run();
      if (result.meta?.changes) inserted += 1;
    } catch (error) {
      console.warn("News candidate could not be stored", candidate.url, error?.message || error);
    }
  }

  let notified = 0;
  if (env.RESEND_API_KEY) {
    const pending = await env.CONTACTS_DB
      .prepare("SELECT * FROM news_candidates WHERE status = 'pending' AND notified_at IS NULL ORDER BY discovered_at ASC LIMIT 8")
      .all();
    for (const candidate of pending.results || []) {
      try {
        if (await sendNewsReview(env, candidate, baseUrl)) {
          await env.CONTACTS_DB
            .prepare("UPDATE news_candidates SET notified_at = ?, updated_at = ? WHERE id = ?")
            .bind(new Date().toISOString(), new Date().toISOString(), candidate.id)
            .run();
          notified += 1;
        }
      } catch (error) {
        console.error("News review notification failed", candidate.id, error?.message || error);
      }
    }
  }
  return { scanned: candidates.length, inserted, notified };
}

async function getPublishedNews(env, url) {
  if (!env.CONTACTS_DB) return publicJson({ items: [] });
  try {
    await ensureNewsDatabase(env.CONTACTS_DB);
    const artist = url.searchParams.get("artist") || "all";
    const filter = artist === "wild" || artist === "devil" ? artist : "all";
    const statement = filter === "all"
      ? env.CONTACTS_DB.prepare("SELECT id, artist, title, source, url, excerpt, image_url, image_alt, published_at FROM news_candidates WHERE status = 'published' ORDER BY datetime(published_at) DESC LIMIT 12")
      : env.CONTACTS_DB.prepare("SELECT id, artist, title, source, url, excerpt, image_url, image_alt, published_at FROM news_candidates WHERE status = 'published' AND artist = ? ORDER BY datetime(published_at) DESC LIMIT 12").bind(filter);
    const result = await statement.all();
    return publicJson({ items: result.results || [] });
  } catch (error) {
    console.error("Published news lookup failed", error);
    return publicJson({ items: [] });
  }
}

function reviewPage(candidate, id, token) {
  const statusNote = candidate.status === "pending"
    ? "Ainda não publicada. Revê o conteúdo e escolhe uma ação."
    : `Estado atual: ${candidate.status}. Podes voltar a publicar ou ignorar.`;
  return `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rever notícia · Caravela Amarela</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#050505;color:#f2efe7;font-family:Arial,sans-serif;line-height:1.5}main{width:min(820px,calc(100% - 32px));margin:40px auto 80px}header{border-top:4px solid #efc62f;padding:24px 0 18px}h1{font-size:clamp(30px,6vw,58px);line-height:.95;margin:0 0 18px}p{color:#bbb6ab}.source{color:#efc62f;font-weight:700}form{display:grid;gap:16px;margin-top:28px;padding:24px;border:1px solid #37352f;background:#0b0b0a}label{display:grid;gap:7px;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#bbb6ab}input,textarea{width:100%;padding:12px;border:1px solid #403e38;background:#141412;color:#fff;font:inherit;text-transform:none;letter-spacing:0}textarea{min-height:110px;resize:vertical}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}button{min-height:48px;padding:12px 18px;border:1px solid #efc62f;background:#efc62f;color:#080808;font-weight:800;cursor:pointer}button[name=action][value=ignore]{background:transparent;color:#ddd;border-color:#666}a{color:#efc62f;overflow-wrap:anywhere}</style><main><header><p class="source">CARAVELA AMARELA · REVISÃO EDITORIAL</p><h1>${escapeHtml(candidate.title)}</h1><p>${escapeHtml(statusNote)}</p><p><a href="${escapeHtml(candidate.url)}" rel="noopener noreferrer" target="_blank">Ler a notícia original ↗</a></p></header><form method="post" action="/api/news/review?id=${encodeURIComponent(id)}&amp;token=${encodeURIComponent(token)}"><label>Título<input name="title" maxlength="500" required value="${escapeHtml(candidate.title)}"></label><label>Fonte<input name="source" maxlength="180" value="${escapeHtml(candidate.source || "")}"></label><label>URL original<input name="url" type="url" required value="${escapeHtml(candidate.url)}"></label><label>Excerto relevante para vender o artista<textarea name="excerpt" maxlength="1000">${escapeHtml(candidate.excerpt || "")}</textarea></label><label>Imagem original da notícia<input name="image_url" type="url" value="${escapeHtml(candidate.image_url || "")}"></label><label>Data de publicação (ISO)<input name="published_at" value="${escapeHtml(candidate.published_at || "")}"></label><div class="actions"><button name="action" value="publish" type="submit">Aprovar e publicar</button><button name="action" value="ignore" type="submit">Ignorar notícia</button></div></form></main></html>`;
}

async function handleNewsReview(request, env, url) {
  if (!env.CONTACTS_DB || !env.NEWS_REVIEW_SECRET) return htmlResponse("<h1>Revisão não configurada.</h1>", 503);
  const id = cleanValue(url.searchParams.get("id"));
  const token = cleanValue(url.searchParams.get("token"));
  if (!(await validReviewToken(env.NEWS_REVIEW_SECRET, id, token))) return htmlResponse("<h1>Ligação inválida.</h1>", 403);
  await ensureNewsDatabase(env.CONTACTS_DB);
  const candidate = await env.CONTACTS_DB.prepare("SELECT * FROM news_candidates WHERE id = ?").bind(id).first();
  if (!candidate) return htmlResponse("<h1>Notícia não encontrada.</h1>", 404);
  if (request.method === "GET") return htmlResponse(reviewPage(candidate, id, token));
  if (request.method !== "POST") return htmlResponse("<h1>Método não permitido.</h1>", 405);

  const form = await request.formData();
  const action = cleanValue(form.get("action"));
  const now = new Date().toISOString();
  if (action === "ignore") {
    await env.CONTACTS_DB
      .prepare("UPDATE news_candidates SET status = 'ignored', reviewed_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, id)
      .run();
    return htmlResponse("<!doctype html><html lang=\"pt\"><meta charset=\"utf-8\"><style>body{background:#050505;color:#eee;font:18px Arial;padding:40px}a{color:#efc62f}</style><h1>Notícia ignorada.</h1><p>Não será apresentada no site.</p><p><a href=\"/\">Voltar ao site</a></p></html>");
  }
  if (action !== "publish") return htmlResponse("<h1>Ação inválida.</h1>", 400);

  const title = cleanValue(form.get("title")).slice(0, 500);
  const source = cleanValue(form.get("source")).slice(0, 180);
  const articleUrl = safeExternalUrl(cleanValue(form.get("url")));
  const excerpt = cleanValue(form.get("excerpt")).slice(0, 1000);
  const imageUrlInput = cleanValue(form.get("image_url"));
  const imageUrl = imageUrlInput ? safeExternalUrl(imageUrlInput) : "";
  const dateInput = cleanValue(form.get("published_at"));
  const parsedDate = dateInput ? new Date(dateInput) : new Date(candidate.published_at || now);
  const publishedAt = Number.isNaN(parsedDate.valueOf()) ? now : parsedDate.toISOString();
  if (!title || !articleUrl || (imageUrlInput && !imageUrl)) return htmlResponse("<h1>Revê o título e os endereços introduzidos.</h1>", 400);
  await env.CONTACTS_DB
    .prepare("UPDATE news_candidates SET title = ?, source = ?, url = ?, excerpt = ?, image_url = ?, image_alt = ?, published_at = ?, status = 'published', reviewed_at = ?, updated_at = ? WHERE id = ?")
    .bind(title, source, articleUrl, excerpt, imageUrl, title, publishedAt, now, now, id)
    .run();
  return htmlResponse("<!doctype html><html lang=\"pt\"><meta charset=\"utf-8\"><style>body{background:#050505;color:#eee;font:18px Arial;padding:40px}a{color:#efc62f}</style><h1>Notícia publicada.</h1><p>Já está disponível no feed do site.</p><p><a href=\"/\">Ver o site</a></p></html>");
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

// Zoho Mail is opt-in and isolated from the public contact/news handlers.
const ZOHO_SCOPES = 'ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.READ';
const ZOHO_COOKIE = '__Host-caravela-zoho';
const zohoEncoder = new TextEncoder();
function zohoFail(code, status = 400) { throw Object.assign(new Error(code), { zohoCode: code, status }); }
function zohoReply(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
function zohoRandom() { return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32))); }
async function zohoHash(value) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', zohoEncoder.encode(value))));
}
async function zohoEqual(a, b) {
  const [x, y] = await Promise.all([zohoHash(a), zohoHash(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
function zohoConfig(env, url) {
  // Explicit region selection: never follow callback-supplied accounts-server/api_domain.
  const suffix = { eu: 'eu', us: 'com' }[env.ZOHO_REGION];
  let redirect;
  try { redirect = new URL(env.ZOHO_REDIRECT_URI); } catch { zohoFail('configuration_required', 503); }
  if (!suffix || !env.ZOHO_DB || !env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET ||
      !/^[A-Za-z0-9+/]{43}=$/.test(env.ZOHO_TOKEN_KEY || '') ||
      (env.ZOHO_ADMIN_TOKEN || '').length < 43 || redirect.protocol !== 'https:' ||
      redirect.pathname !== '/api/zoho/callback' || redirect.search || redirect.hash ||
      redirect.username || redirect.password) zohoFail('configuration_required', 503);
  if (url.origin !== redirect.origin) zohoFail('invalid_origin', 403);
  return { accounts: `https://accounts.zoho.${suffix}`, mail: `https://mail.zoho.${suffix}`, redirect: redirect.href };
}
async function zohoCrypt(env, value, decrypt = false) {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(env.ZOHO_TOKEN_KEY), c => c.charCodeAt(0)), 'AES-GCM', false, [decrypt ? 'decrypt' : 'encrypt']);
  const aad = zohoEncoder.encode(`caravela:zoho:v1:${BOOKING_EMAIL}:${env.ZOHO_REGION}:${env.ZOHO_CLIENT_ID}`);
  if (decrypt) {
    const [version, iv, ciphertext] = value.split('.');
    if (version !== 'v1') zohoFail('storage_error', 503);
    const decode = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: aad }, key, decode(ciphertext))));
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, zohoEncoder.encode(JSON.stringify(value))));
  const encode = b => btoa(String.fromCharCode(...b));
  return `v1.${encode(iv)}.${encode(ciphertext)}`;
}
function zohoSafeTransportError(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'timeout';
  // Classify fixed causes only. Never send upstream exception text to the browser or logs.
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('redirect')) return 'redirect_blocked';
  if (/dns|resolve|lookup|name not resolved/.test(message)) return 'dns_failure';
  if (/certificate|tls|ssl/.test(message)) return 'tls_failure';
  if (/host.*cannot access|prohibit|blocked|1021|1024/.test(message)) return 'host_blocked';
  if (/abortsignal|not a function|unsupported/.test(message)) return 'runtime_incompatible';
  return 'network_failure';
}

async function zohoFetch(url, options) {
  // No automatic redirects: OAuth secrets and Mail Authorization headers must never be forwarded.
  const stage = new URL(url).pathname === '/oauth/v2/token' ? 'oauth' : 'accounts';
  let response;
  try {
    response = await fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  } catch (error) {
    zohoFail(stage + '_' + zohoSafeTransportError(error), 502);
  }
  // Manual redirect is examined safely and never followed.
  if (response.status >= 300 && response.status < 400) {
    zohoFail(stage + '_redirect_http_' + (response.status === 301 || response.status === 302 ||
      response.status === 303 || response.status === 307 || response.status === 308
      ? response.status : 'other'), 502);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    const knownStatus = [200, 400, 401, 403, 404, 405, 429, 500, 502, 503, 504];
    zohoFail(stage + '_non_json_' + (knownStatus.includes(response.status)
      ? response.status : 'other'), 502);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    zohoFail(stage + '_unexpected_response', 502);
  }
  if (!response.ok || data.error ||
      (data.status?.code != null && Number(data.status.code) !== 200)) {
    if (stage === 'oauth') {
      if (data.error === 'invalid_client') zohoFail('oauth_client_rejected', 502);
      if (data.error === 'invalid_client_secret') zohoFail('oauth_secret_rejected', 502);
      if (data.error === 'invalid_redirect_uri' || data.error === 'redirect_uri_mismatch') zohoFail('oauth_redirect_rejected', 502);
      if (data.error === 'invalid_code' || data.error === 'invalid_token') zohoFail('reauthorization_required', 502);
      zohoFail('oauth_provider_rejected', 502);
    }
    zohoFail('accounts_provider_rejected', 502);
  }
  return data;
}

async function zohoPublicConnectivityProbe(accounts) {
  // The probe never uses OAuth credentials or grant codes, and reports only HTTP codes.
  // Two fixed URLs under the configured Zoho Accounts domain are tested.
  const paths = ['/oauth/v2/token', '/'];
  const output = [];
  for (const path of paths) {
    try {
      const response = await fetch(accounts + path, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(7500),
        headers: { Accept: 'application/json' },
      });
      output.push({ path: path === '/' ? 'accounts_home' : 'token_endpoint',
        outcome: 'http', status: response.status });
    } catch (error) {
      output.push({ path: path === '/' ? 'accounts_home' : 'token_endpoint',
        outcome: zohoSafeTransportError(error) });
    }
  }
  return output;
}

async function zohoToken(env, config, grant) {
  const data = await zohoFetch(`${config.accounts}/oauth/v2/token`, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, ...grant }) });
  if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) zohoFail('invalid_token_response', 502);
  if (data.scope) {
    const granted = data.scope.split(/[ ,]+/).filter(Boolean);
    if (granted.some(s => !ZOHO_SCOPES.split(',').includes(s)) || ZOHO_SCOPES.split(',').some(s => !granted.includes(s))) zohoFail('invalid_scopes', 502);
  }
  return { access: data.access_token, refresh: data.refresh_token, expires: Date.now() + Math.min(Number(data.expires_in), 3600) * 1000 };
}
async function zohoGet(config, token, path) {
  return zohoFetch(`${config.mail}/api/accounts${path}`, { method: 'GET', headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' } });
}
function zohoAccount(data) {
  const accounts = Array.isArray(data.data) ? data.data : [];
  const matches = accounts.filter(a => a.type === 'ZOHO_ACCOUNT' &&
    String(a.primaryEmailAddress || a.mailboxAddress || '').toLowerCase() === BOOKING_EMAIL &&
    typeof a.accountId === 'string' && /^\d+$/.test(a.accountId));
  if (matches.length !== 1) zohoFail('mailbox_mismatch', 403);
  return matches[0].accountId;
}
async function zohoReadTokens(env, config) {
  const row = await env.ZOHO_DB.prepare('SELECT * FROM zoho_connection WHERE mailbox = ?').bind(BOOKING_EMAIL).first();
  if (!row) zohoFail('not_connected', 409);
  let tokens = await zohoCrypt(env, row.sealed, true);
  if (tokens.expires > Date.now() + 60000) return tokens;
  const lock = zohoRandom();
  const acquired = await env.ZOHO_DB.prepare('UPDATE zoho_connection SET lock_id = ?, lock_until = ? WHERE mailbox = ? AND lock_until < ? RETURNING mailbox')
    .bind(lock, Date.now() + 60000, BOOKING_EMAIL, Date.now()).first();
  if (!acquired) zohoFail('refresh_in_progress', 503);
  try {
    // Read again under the lock in case another request refreshed since our first read.
    const current = await env.ZOHO_DB.prepare('SELECT * FROM zoho_connection WHERE mailbox = ?').bind(BOOKING_EMAIL).first();
    tokens = await zohoCrypt(env, current.sealed, true);
    if (tokens.expires <= Date.now() + 60000) {
      const renewed = await zohoToken(env, config, { grant_type: 'refresh_token', refresh_token: tokens.refresh });
      tokens = { ...tokens, ...renewed, refresh: renewed.refresh || tokens.refresh };
      if (zohoAccount(await zohoGet(config, tokens.access, '')) !== tokens.accountId) zohoFail('mailbox_mismatch', 403);
      const saved = await env.ZOHO_DB.prepare('UPDATE zoho_connection SET sealed = ? WHERE mailbox = ? AND lock_id = ? RETURNING mailbox')
        .bind(await zohoCrypt(env, tokens), BOOKING_EMAIL, lock).first();
      if (!saved) zohoFail('connection_changed', 409);
    }
    return tokens;
  } finally {
    await env.ZOHO_DB.prepare('UPDATE zoho_connection SET lock_id = NULL, lock_until = 0 WHERE mailbox = ? AND lock_id = ?').bind(BOOKING_EMAIL, lock).run();
  }
}
async function handleZoho(request, env, url) {
  if (env.ZOHO_ENABLED !== 'true') return zohoReply({ ok: false, error: 'not_found' }, 404);
  const clearCookie = `${ZOHO_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
  try {
    const config = zohoConfig(env, url);
    const route = url.pathname.slice('/api/zoho/'.length);
    const methods = { authorize: 'POST', callback: 'GET', status: 'GET', folders: 'GET', messages: 'GET', content: 'GET', diagnose: 'POST' };
    if (!methods[route]) zohoFail('not_found', 404);
    if (request.method !== methods[route]) return zohoReply({ ok: false, error: 'method_not_allowed' }, 405, { Allow: methods[route] });
    if (route !== 'callback') {
      if (!(await zohoEqual(request.headers.get('Authorization') || '', `Bearer ${env.ZOHO_ADMIN_TOKEN}`))) zohoFail('unauthorized', 401);
      if ((request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') zohoFail('invalid_origin', 403);
    }
    if (route === 'diagnose') {
      // Admin-only Preview diagnosis. No mail read, no real OAuth grant.
      if (!url.hostname.endsWith('.caravelaamarela-site.pages.dev')) zohoFail('not_found', 404);
      try {
        await zohoToken(env, config, {
          grant_type: 'authorization_code',
          code: 'caravela_probe_intentionally_invalid_not_a_real_oauth_code',
          redirect_uri: config.redirect
        });
        return zohoReply({ ok: false, result: 'unexpected_token_response' });
      } catch (probeError) {
        const code = probeError.zohoCode || 'storage_error';
        const healthy = code === 'reauthorization_required';
        // Additional anonymous network probes only if the token request failed at transport/HTTP.
        const needsProbe = /^(oauth_(network_failure|timeout|redirect_blocked|dns_failure|tls_failure|host_blocked|runtime_incompatible|redirect_http_|non_json_))/.test(code);
        return zohoReply({
          ok: healthy,
          result: healthy ? 'oauth_endpoint_responding' : code,
          ...(needsProbe ? { connectivity: await zohoPublicConnectivityProbe(config.accounts) } : {})
        });
      }
    }
    if (route === 'authorize') {
      const state = zohoRandom(), browser = zohoRandom();
      await env.ZOHO_DB.prepare('DELETE FROM zoho_oauth_state WHERE expires_at < ?').bind(Date.now()).run();
      await env.ZOHO_DB.prepare('INSERT INTO zoho_oauth_state (state_hash, browser_hash, expires_at) VALUES (?, ?, ?)')
        .bind(await zohoHash(state), await zohoHash(browser), Date.now() + 600000).run();
      const target = new URL(`${config.accounts}/oauth/v2/auth`);
      target.search = new URLSearchParams({ client_id: env.ZOHO_CLIENT_ID, response_type: 'code', redirect_uri: config.redirect,
        scope: ZOHO_SCOPES, access_type: 'offline', prompt: 'consent', state }).toString();
      return zohoReply({ authorizationUrl: target.href }, 200, { 'Set-Cookie': `${ZOHO_COOKIE}=${browser}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600` });
    }
    if (route === 'callback') {
      const state = url.searchParams.get('state') || '';
      const browser = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${ZOHO_COOKIE}=`))?.slice(ZOHO_COOKIE.length + 1) || '';
      if (!/^[\w-]{43}$/.test(state) || !/^[\w-]{43}$/.test(browser)) zohoFail('invalid_state', 400);
      // Atomic consume prevents replay across isolates and simultaneous callbacks.
      const consumed = await env.ZOHO_DB.prepare('DELETE FROM zoho_oauth_state WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING state_hash')
        .bind(await zohoHash(state), await zohoHash(browser), Date.now()).first();
      if (!consumed) zohoFail('invalid_state', 400);
      if (url.searchParams.has('error')) zohoFail('authorization_denied', 400);
      const code = url.searchParams.get('code');
      if (!code || code.length > 4096) zohoFail('invalid_code', 400);
      const tokens = await zohoToken(env, config, { grant_type: 'authorization_code', code, redirect_uri: config.redirect });
      if (typeof tokens.refresh !== 'string' || !tokens.refresh) zohoFail('refresh_token_missing', 409);
      tokens.accountId = zohoAccount(await zohoGet(config, tokens.access, ''));
      await env.ZOHO_DB.prepare('INSERT INTO zoho_connection (mailbox, sealed) VALUES (?, ?) ON CONFLICT(mailbox) DO UPDATE SET sealed = excluded.sealed, lock_id = NULL, lock_until = 0')
        .bind(BOOKING_EMAIL, await zohoCrypt(env, tokens)).run();
      // Remove the authorization code from the visible address bar immediately.
      return new Response(null, { status: 303, headers: { Location: '/api/zoho/connected', 'Set-Cookie': clearCookie, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }
    if (route === 'status') {
      const row = await env.ZOHO_DB.prepare('SELECT mailbox FROM zoho_connection WHERE mailbox = ?').bind(BOOKING_EMAIL).first();
      return zohoReply({ ok: true, connected: !!row, mailbox: BOOKING_EMAIL });
    }
    const params = new URLSearchParams();
    const id = key => { const value = url.searchParams.get(key); if (!/^\d{1,30}$/.test(value || '')) zohoFail('invalid_parameters'); return value; };
    let path;
    if (route === 'folders') path = '/folders';
    if (route === 'messages') {
      for (const [key, fallback, max] of [['start', '1', 1000000], ['limit', '50', 100]]) {
        const value = url.searchParams.get(key) ?? fallback;
        if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) zohoFail('invalid_parameters');
        params.set(key, value);
      }
      if (url.searchParams.has('folderId')) params.set('folderId', id('folderId'));
      path = `/messages/view?${params}`;
    }
    if (route === 'content') path = `/folders/${id('folderId')}/messages/${id('messageId')}/content`;
    const tokens = await zohoReadTokens(env, config);
    const result = await zohoGet(config, tokens.access, `/${tokens.accountId}${path}`);
    return zohoReply({ ok: true, data: result.data });
  } catch (error) {
    // Never expose OAuth codes, tokens or provider bodies in a response or URL.
    const errorCode = error.zohoCode || 'storage_error';
    if (url.pathname === '/api/zoho/callback') {
      const allowed = new Set([
        'oauth_transport_error', 'accounts_transport_error',
        'oauth_network_failure', 'oauth_timeout', 'oauth_unexpected_response',
        'oauth_redirect_blocked', 'oauth_dns_failure', 'oauth_tls_failure',
        'oauth_host_blocked', 'oauth_runtime_incompatible',
        'oauth_redirect_http_301', 'oauth_redirect_http_302', 'oauth_redirect_http_303',
        'oauth_redirect_http_307', 'oauth_redirect_http_308', 'oauth_redirect_http_other',
        'oauth_non_json_200', 'oauth_non_json_301', 'oauth_non_json_302',
        'oauth_non_json_400', 'oauth_non_json_401', 'oauth_non_json_403',
        'oauth_non_json_404', 'oauth_non_json_405', 'oauth_non_json_429',
        'oauth_non_json_500', 'oauth_non_json_502', 'oauth_non_json_503',
        'oauth_non_json_504', 'oauth_non_json_other', 'oauth_secret_rejected',
        'oauth_client_rejected', 'oauth_redirect_rejected',
        'oauth_provider_rejected', 'accounts_provider_rejected',
        'reauthorization_required', 'invalid_scopes',
        'refresh_token_missing', 'mailbox_mismatch', 'invalid_state',
        'invalid_code', 'authorization_denied', 'storage_error',
      ]);
      const target = '/zoho-setup.html?result=' + encodeURIComponent(allowed.has(errorCode) ? errorCode : 'storage_error');
      return new Response(null, { status: 303, headers: {
        'Location': target, 'Set-Cookie': clearCookie,
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      } });
    }
    return zohoReply({ ok: false, error: errorCode }, error.status || 503);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/control/")) return handleControl(request, env, url);

    if (url.pathname.startsWith("/api/zoho/")) {
      if (url.pathname === "/api/zoho/connected" && env.ZOHO_ENABLED === "true" && request.method === "GET") {
        return htmlResponse("<p>Autorização concluída. Fecha esta janela e consulta o estado através da API administrativa.</p>");
      }
      return handleZoho(request, env, url);
    }
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "method_not_allowed" }, 405);
      }
      return handlePost({ request, env });
    }

    if (url.pathname === "/api/news") {
      if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
      if (env.CONTACTS_DB && env.NEWS_REVIEW_SECRET) {
        ctx?.waitUntil(scanNews(env, env.PUBLIC_SITE_URL || url.origin).catch((error) => console.error("Background news scan failed", error)));
      }
      return getPublishedNews(env, url);
    }

    if (url.pathname === "/api/news/review") {
      return handleNewsReview(request, env, url);
    }

    if (url.pathname === "/api/news/scan") {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
      const authorization = request.headers.get("authorization") || "";
      if (!env.NEWS_SCAN_TOKEN || authorization !== `Bearer ${env.NEWS_SCAN_TOKEN}`) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      try {
        return json({ ok: true, ...(await scanNews(env, env.PUBLIC_SITE_URL || url.origin, true)) });
      } catch (error) {
        console.error("Manual news scan failed", error);
        return json({ ok: false, error: "scan_failed" }, 502);
      }
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
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(scanNews(env, env.PUBLIC_SITE_URL || "https://caravelaamarela.com", true));
  },
};
