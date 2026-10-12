/* Caravela Control: private, Preview-only username/password accounts.
 * Cloudflare Access remains the outer gate. Never log passwords or session tokens.
 * Tables: migrations/0004_control_auth.sql. */
const HOST = "feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const COOKIE = "__Host-caravela_session";
const TTL = 24 * 60 * 60 * 1000;
const ITERATIONS = 310000;
const encoder = new TextEncoder();
const roles = new Set(["admin", "manager", "viewer"]);
const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
});
const fail = (error, status = 400) => json({ ok: false, error }, status);
const normalized = s => String(s || "").trim().toLowerCase();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const random = n => crypto.getRandomValues(new Uint8Array(n));
const base64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const digest = async input => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(input))));
const cookieHeader = (token, age) =>
  COOKIE + "=" + token + "; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + age;
const publicUser = u => ({
  id: u.id, username: u.username, display_name: u.display_name,
  role: u.role, enabled: !!u.enabled, must_change_password: !!u.must_change_password,
  created_ms: u.created_ms
});
const usernameValid = s => /^[a-z0-9][a-z0-9._-]{2,39}$/.test(s);
const passwordValid = s => typeof s === "string" && s.length >= 12 && s.length <= 128;
function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  return (!origin || origin === url.origin) && (!site || site === "same-origin") &&
    request.headers.get("X-Caravela-Request") === "1";
}
function previewEnabled(env, url) {
  return url.protocol === "https:" && url.hostname === HOST &&
    env.CONTROL_AUTH_ENABLED === "true" && env.CONTROL_VAULT_ENABLED === "true" && !!env.ZOHO_DB;
}
async function body(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 4096) throw Error("invalid_request");
  const text = await request.text();
  if (text.length > 4096) throw Error("invalid_request");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_request");
  return value;
}
async function pbkdf2(password, salt, rounds = ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds
  }, key, 256)));
}
function constantHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function fromBase64(text) {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(padded), ch => ch.charCodeAt(0));
}
async function hashedPassword(password) {
  const salt = random(16);
  return { salt: base64(salt), hash: await pbkdf2(password, salt), rounds: ITERATIONS };
}
async function issueSession(db, userId) {
  const token = base64(random(32));
  const now = Date.now();
  await db.prepare("INSERT INTO control_sessions(token_sha256,user_id,created_ms,expires_ms) VALUES(?,?,?,?)")
    .bind(await digest(token), userId, now, now + TTL).run();
  return token;
}
async function sessionUser(request, env) {
  if (env.CONTROL_AUTH_ENABLED !== "true" || !env.ZOHO_DB) return null;
  const cookie = (request.headers.get("Cookie") || "").split(";").map(x => x.trim())
    .find(x => x.startsWith(COOKIE + "="));
  const token = cookie?.slice(COOKIE.length + 1) || "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const user = await env.ZOHO_DB.prepare(
      "SELECT u.id,u.username,u.display_name,u.role,u.enabled,u.must_change_password,u.created_ms " +
      "FROM control_sessions s JOIN control_users u ON s.user_id=u.id " +
      "WHERE s.token_sha256=? AND s.expires_ms>? AND u.enabled=1"
    ).bind(await digest(token), Date.now()).first();
    return user && roles.has(user.role) ? publicUser(user) : null;
  } catch {
    return null; // The auth migration is not yet installed.
  }
}
export { sessionUser };
export function roleAllows(user, required) {
  if (!user || user.must_change_password) return false;
  return ({ viewer: 1, manager: 2, admin: 3 })[user.role] >=
    ({ viewer: 1, manager: 2, admin: 3 })[required];
}
async function recentAttempts(db, key) {
  const row = await db.prepare("SELECT attempts,reset_ms FROM control_login_attempts WHERE bucket=?")
    .bind(key).first();
  return row && row.reset_ms > Date.now() ? row.attempts : 0;
}
async function failedAttempt(db, key) {
  const now = Date.now();
  await db.prepare(
    "INSERT INTO control_login_attempts(bucket,attempts,reset_ms) VALUES(?,1,?) " +
    "ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN reset_ms<? THEN 1 ELSE attempts+1 END, " +
    "reset_ms=CASE WHEN reset_ms<? THEN excluded.reset_ms ELSE reset_ms END"
  ).bind(key, now + 15 * 60 * 1000, now, now).run();
}
async function clearAttempt(db, key) {
  await db.prepare("DELETE FROM control_login_attempts WHERE bucket=?").bind(key).run();
}
async function userList(db) {
  const rows = await db.prepare(
    "SELECT id,username,display_name,role,enabled,must_change_password,created_ms " +
    "FROM control_users ORDER BY created_ms ASC"
  ).all();
  return (rows.results || []).map(publicUser);
}
function audit(db, actor, operation, target) {
  return db.prepare(
    "INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) VALUES(?,?,?,?,?)"
  ).bind(crypto.randomUUID(), Date.now(), operation, target, JSON.stringify({ actor }));
}
async function login(request, env) {
  const db = env.ZOHO_DB, data = await body(request), name = normalized(data.username);
  if (!usernameValid(name) || typeof data.password !== "string" || data.password.length > 128)
    return fail("invalid_credentials", 401);
  const address = request.headers.get("CF-Connecting-IP") || "unknown";
  const userBucket = "user:" + await digest(name);
  const ipBucket = "ip:" + await digest(address);
  if (await recentAttempts(db, userBucket) >= 6 || await recentAttempts(db, ipBucket) >= 30)
    return fail("temporarily_locked", 429);
  const user = await db.prepare("SELECT * FROM control_users WHERE username=?").bind(name).first();
  let valid = false;
  if (user && user.enabled === 1 && Number.isSafeInteger(user.rounds) &&
      user.rounds >= 200000 && user.rounds <= 1000000 && passwordValid(data.password)) {
    valid = constantHex(await pbkdf2(data.password, fromBase64(user.password_salt), user.rounds), user.password_hash);
  }
  if (!valid) {
    await Promise.all([failedAttempt(db, userBucket), failedAttempt(db, ipBucket)]);
    return fail("invalid_credentials", 401);
  }
  await clearAttempt(db, userBucket);
  const token = await issueSession(db, user.id);
  await db.batch([
    db.prepare("UPDATE control_users SET last_login_ms=? WHERE id=?").bind(Date.now(), user.id),
    audit(db, user.id, "auth_login", user.id)
  ]);
  return json({ ok: true, user: publicUser(user) }, 200, { "Set-Cookie": cookieHeader(token, 86400) });
}
async function bootstrap(request, env) {
  const db = env.ZOHO_DB;
  const count = await db.prepare("SELECT COUNT(*) AS n FROM control_users").first();
  if (count.n) return fail("already_initialized", 409);
  const bearer = request.headers.get("Authorization") || "";
  const expected = "Bearer " + (env.ZOHO_ADMIN_TOKEN || "");
  if (env.ZOHO_ADMIN_TOKEN?.length < 43 ||
      !constantHex(await digest(bearer), await digest(expected))) return fail("unauthorized", 401);
  const data = await body(request);
  const name = normalized(data.username);
  if (!usernameValid(name) || !passwordValid(data.password) || !String(data.display_name || "").trim())
    return fail("invalid_account", 400);
  const pw = await hashedPassword(data.password);
  const id = crypto.randomUUID();
  // The unique owner marker and account are inserted in one D1 transaction.
  // If a write fails, neither persists: there is no half-configured owner.
  let applied;
  try {
    applied = await db.batch([
      db.prepare("INSERT OR IGNORE INTO control_auth_settings(key,value) VALUES('owner_created',?)")
        .bind(id),
      db.prepare(
        "INSERT INTO control_users(id,username,display_name,role,enabled,must_change_password,password_salt,password_hash,rounds,created_ms) " +
        "SELECT ?,?,?,'admin',1,0,?,?,?,? WHERE EXISTS " +
        "(SELECT 1 FROM control_auth_settings WHERE key='owner_created' AND value=?)"
      ).bind(id, name, String(data.display_name).trim().slice(0, 80), pw.salt, pw.hash, pw.rounds, Date.now(), id),
      db.prepare(
        "INSERT INTO control_audit(id,occurred_ms,operation,target,details_json) " +
        "SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM control_users WHERE id=?)"
      ).bind(crypto.randomUUID(), Date.now(), "auth_bootstrap", id, JSON.stringify({ actor: id }), id)
    ]);
  } catch { return fail("bootstrap_incomplete_contact_admin", 503); }
  if ((applied[0].meta?.changes ?? applied[0].changes) !== 1) return fail("already_initialized", 409);
  const token = await issueSession(db, id);
  return json({ ok: true, user: { id, username: name, display_name: String(data.display_name).trim().slice(0, 80), role: "admin", enabled: true, must_change_password: false } },
    201, { "Set-Cookie": cookieHeader(token, 86400) });
}
async function changePassword(request, env, user) {
  if (!user) return fail("unauthorized", 401);
  const data = await body(request);
  if (!passwordValid(data.new_password) || typeof data.old_password !== "string") return fail("invalid_password", 400);
  const db = env.ZOHO_DB;
  const stored = await db.prepare("SELECT password_salt,password_hash,rounds FROM control_users WHERE id=?")
    .bind(user.id).first();
  if (!stored || !constantHex(await pbkdf2(data.old_password, fromBase64(stored.password_salt), stored.rounds), stored.password_hash))
    return fail("invalid_credentials", 401);
  const pw = await hashedPassword(data.new_password);
  await db.batch([
    db.prepare("UPDATE control_users SET password_salt=?,password_hash=?,rounds=?,must_change_password=0 WHERE id=?")
      .bind(pw.salt, pw.hash, pw.rounds, user.id),
    db.prepare("DELETE FROM control_sessions WHERE user_id=?").bind(user.id),
    audit(db, user.id, "auth_password_changed", user.id)
  ]);
  const token = await issueSession(db, user.id);
  return json({ ok: true, user: { ...user, must_change_password: false } }, 200,
    { "Set-Cookie": cookieHeader(token, 86400) });
}
async function createUser(request, env, actor) {
  const data = await body(request), db = env.ZOHO_DB;
  const name = normalized(data.username), display = String(data.display_name || "").trim();
  if (!usernameValid(name) || !display || display.length > 80 || !roles.has(data.role) ||
      !passwordValid(data.password)) return fail("invalid_account", 400);
  const pw = await hashedPassword(data.password);
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare(
        "INSERT INTO control_users(id,username,display_name,role,enabled,must_change_password,password_salt,password_hash,rounds,created_ms) " +
        "VALUES(?,?,?,?,1,1,?,?,?,?)"
      ).bind(id, name, display, data.role, pw.salt, pw.hash, pw.rounds, Date.now()),
      audit(db, actor.id, "auth_user_created", id)
    ]);
  } catch { return fail("username_unavailable", 409); }
  return json({ ok: true, users: await userList(db) }, 201);
}
async function modifyUser(request, env, actor, id) {
  const db = env.ZOHO_DB, data = await body(request);
  const target = await db.prepare("SELECT id,role,enabled FROM control_users WHERE id=?")
    .bind(id).first();
  if (!target) return fail("user_not_found", 404);
  if (data.role !== undefined && !roles.has(data.role)) return fail("invalid_role");
  if (data.enabled !== undefined && typeof data.enabled !== "boolean") return fail("invalid_state");
  if (data.password !== undefined && !passwordValid(data.password)) return fail("invalid_password");
  if (data.role === undefined && data.enabled === undefined && data.password === undefined)
    return fail("no_changes");
  const nextRole = data.role ?? target.role;
  const nextEnabled = data.enabled === undefined ? !!target.enabled : data.enabled;
  if (id === actor.id && (nextRole !== "admin" || !nextEnabled))
    return fail("cannot_remove_own_admin_access", 409);
  if (target.role === "admin" && !!target.enabled && (nextRole !== "admin" || !nextEnabled)) {
    const admins = await db.prepare("SELECT COUNT(*) AS n FROM control_users WHERE role='admin' AND enabled=1").first();
    if (admins.n <= 1) return fail("last_admin_required", 409);
  }
  const pw = data.password === undefined ? null : await hashedPassword(data.password);
  const operations = [
    db.prepare("UPDATE control_users SET role=?,enabled=?,must_change_password=CASE WHEN ? THEN 1 ELSE must_change_password END," +
      "password_salt=COALESCE(?,password_salt),password_hash=COALESCE(?,password_hash),rounds=COALESCE(?,rounds) WHERE id=?")
      .bind(nextRole, nextEnabled ? 1 : 0, pw ? 1 : 0, pw?.salt || null, pw?.hash || null, pw?.rounds || null, id),
    audit(db, actor.id, "auth_user_updated", id)
  ];
  if (pw || nextRole !== target.role || nextEnabled !== !!target.enabled)
    operations.push(db.prepare("DELETE FROM control_sessions WHERE user_id=?").bind(id));
  await db.batch(operations);
  return json({ ok: true, users: await userList(db) });
}
export async function handleControlAuth(request, env, url, route) {
  if (!previewEnabled(env, url)) return fail("not_found", 404);
  const db = env.ZOHO_DB;
  try {
    const schema = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='control_users'").first();
    if (!schema) return fail("auth_migration_required", 503);
    if (request.method !== "GET" && !sameOrigin(request, url)) return fail("invalid_origin", 403);
    if (route === "auth/bootstrap-status" && request.method === "GET") {
      const count = await db.prepare("SELECT COUNT(*) AS n FROM control_users").first();
      return json({ ok: true, needs_bootstrap: count.n === 0 });
    }
    if (route === "auth/bootstrap" && request.method === "POST") return bootstrap(request, env);
    if (route === "auth/login" && request.method === "POST") return login(request, env);
    const actor = await sessionUser(request, env);
    if (route === "auth/me" && request.method === "GET")
      return json({ ok: true, authenticated: !!actor, user: actor });
    if (route === "auth/logout" && request.method === "POST") {
      const cookie = (request.headers.get("Cookie") || "").split(";").map(x => x.trim())
        .find(x => x.startsWith(COOKIE + "="));
      const token = cookie?.slice(COOKIE.length + 1) || "";
      if (/^[A-Za-z0-9_-]{43}$/.test(token))
        await db.prepare("DELETE FROM control_sessions WHERE token_sha256=?").bind(await digest(token)).run();
      return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
    }
    if (!actor) return fail("unauthorized", 401);
    if (route === "auth/change-password" && request.method === "POST")
      return changePassword(request, env, actor);
    if (!roleAllows(actor, "admin")) return fail("forbidden", 403);
    if (route === "auth/users" && request.method === "GET") return json({ ok: true, users: await userList(db) });
    if (route === "auth/users" && request.method === "POST") return createUser(request, env, actor);
    const match = /^auth\/users\/([0-9a-f-]{36})$/.exec(route);
    if (match && request.method === "PATCH") return modifyUser(request, env, actor, match[1]);
    return fail("not_found", 404);
  } catch (error) {
    if (error?.message === "invalid_request") return fail("invalid_request", 400);
    return fail("auth_operation_failed", 503);
  }
}
