import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleControlAuth } from "../control-auth.js";
import { handleControl } from "../control-vault.js";

const BASE = "https://feature-zoho-mail-readonly-o.caravelaamarela-site.pages.dev";
const TOKEN = "admin-test-token-" + "x".repeat(48);
let sqlite, env;
function adapter(db) {
  const statement = (sql, args = []) => ({
    async first() { return db.prepare(sql).get(...args) || null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async run() { const result = db.prepare(sql).run(...args); return { ...result, meta: { changes: result.changes } }; }
  });
  return {
    prepare(sql) { return { bind(...args) { return statement(sql, args); }, ...statement(sql) }; },
    async batch(queries) {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const query of queries) results.push(await query.run());
        db.exec("COMMIT");
        return results;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
  };
}
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  for (const file of ["../migrations/0003_control_vault.sql", "../migrations/0004_control_auth.sql"])
    sqlite.exec(readFileSync(new URL(file, import.meta.url), "utf8"));
  env = {
    CONTROL_AUTH_ENABLED: "true", CONTROL_VAULT_ENABLED: "true",
    ZOHO_ENABLED: "true", ZOHO_ADMIN_TOKEN: TOKEN, ZOHO_DB: adapter(sqlite)
  };
});
afterEach(() => sqlite.close());
async function auth(path, { method = "GET", cookie = "", data = null, token = "" } = {}) {
  const headers = { Origin: BASE, "X-Caravela-Request": "1" };
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = "Bearer " + token;
  if (data) headers["Content-Type"] = "application/json";
  const request = new Request(BASE + "/api/control/auth/" + path, {
    method, headers, ...(data ? { body: JSON.stringify(data) } : {})
  });
  return handleControlAuth(request, env, new URL(request.url), "auth/" + path);
}
async function route(path, { method = "GET", cookie = "", data = null } = {}) {
  const headers = { Origin: BASE, "X-Caravela-Request": "1" };
  if (cookie) headers.Cookie = cookie;
  if (data) headers["Content-Type"] = "application/json";
  const request = new Request(BASE + "/api/control/" + path, {
    method, headers, ...(data ? { body: JSON.stringify(data) } : {})
  });
  return handleControl(request, env, new URL(request.url));
}
function cookieOf(response) {
  const cookie = response.headers.get("Set-Cookie");
  assert.ok(cookie && cookie.startsWith("__Host-caravela_session="));
  assert.ok(cookie.includes("HttpOnly") && cookie.includes("Secure") && cookie.includes("SameSite=Strict"));
  return cookie.split(";")[0];
}
async function owner() {
  const response = await auth("bootstrap", {
    method: "POST", token: TOKEN,
    data: { username: "sergio", display_name: "Sérgio", password: "initial-very-long-password" }
  });
  assert.equal(response.status, 201);
  return cookieOf(response);
}
async function makeUser(cookie, username, role) {
  const response = await auth("users", {
    method: "POST", cookie,
    data: { username, display_name: username, role, password: "temporary-long-password-123" }
  });
  assert.equal(response.status, 201);
  const json = await response.json();
  return json.users.find(u => u.username === username);
}
test("bootstrap requires the existing Preview admin token and happens only once", async () => {
  assert.equal((await auth("bootstrap-status")).status, 200);
  assert.equal((await auth("bootstrap", { method: "POST", data: { username: "bad", password: "long-password-123" } })).status, 401);
  const cookie = await owner();
  assert.equal((await auth("bootstrap-status").then(r => r.json())).needs_bootstrap, false);
  assert.equal((await auth("bootstrap", { method: "POST", token: TOKEN, data: {
    username: "another", display_name: "Another", password: "other-long-password-123"
  } })).status, 409);
  const me = await auth("me", { cookie });
  assert.equal((await me.json()).user.role, "admin");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM control_users").get().n, 1);
});
test("sessions allow CRM reads; viewers cannot change snapshots or manage team", async () => {
  const admin = await owner();
  const viewer = await makeUser(admin, "observer", "viewer");
  assert.equal(viewer.must_change_password, true);
  const login = await auth("login", { method: "POST", data: {
    username: "observer", password: "temporary-long-password-123"
  } });
  assert.equal(login.status, 200);
  const firstCookie = cookieOf(login);
  assert.equal((await route("status", { cookie: firstCookie })).status, 401);
  const changed = await auth("change-password", { method: "POST", cookie: firstCookie, data: {
    old_password: "temporary-long-password-123", new_password: "independent-strong-password-456"
  } });
  assert.equal(changed.status, 200);
  const viewerCookie = cookieOf(changed);
  // Aggregated activity is readable; raw snapshots, origins and secrets never are.
  assert.equal((await route("ops/overview", { cookie: viewerCookie })).status, 200);
  assert.equal((await route("status", { cookie: viewerCookie })).status, 403);
  assert.equal((await route("snapshot/active", { cookie: viewerCookie })).status, 403);
  assert.equal((await route("source/latest?key=control_actions", { cookie: viewerCookie })).status, 403);
  assert.equal((await route("partnerships", { cookie: viewerCookie })).status, 403);
  assert.equal((await route("snapshot/start", { method: "POST", cookie: viewerCookie, data: {} })).status, 403);
  assert.equal((await auth("users", { cookie: viewerCookie })).status, 403);
  assert.equal((await route("status", { cookie: firstCookie })).status, 401);
});
test("manager can synchronize, but cannot perform admin-only operations", async () => {
  const admin = await owner();
  await makeUser(admin, "bookingmanager", "manager");
  const login = await auth("login", { method: "POST", data: {
    username: "bookingmanager", password: "temporary-long-password-123"
  } });
  const cookie = cookieOf(login);
  const changed = await auth("change-password", { method: "POST", cookie, data: {
    old_password: "temporary-long-password-123", new_password: "another-long-password-1234"
  } });
  const manager = cookieOf(changed);
  assert.equal((await route("ops/overview", { cookie: manager })).status, 200);
  assert.equal((await route("status", { cookie: manager })).status, 403);
  assert.equal((await route("source/latest?key=control_actions", { cookie: manager })).status, 403);
  assert.equal((await route("snapshot/active", { cookie: manager })).status, 403);
  assert.equal((await route("sheets/sync", { method: "POST", cookie: manager })).status, 409);
  assert.equal((await route("snapshot/start", { method: "POST", cookie: manager, data: {} })).status, 403);
});
test("admin can disable accounts and revoke existing sessions", async () => {
  const admin = await owner();
  const viewer = await makeUser(admin, "viewer2", "viewer");
  const login = await auth("login", { method: "POST", data: {
    username: "viewer2", password: "temporary-long-password-123"
  } });
  const viewerCookie = cookieOf(login);
  assert.equal((await auth("users/" + viewer.id, { method: "PATCH", cookie: admin, data: { enabled: false } })).status, 200);
  assert.equal((await auth("me", { cookie: viewerCookie }).then(r => r.json())).authenticated, false);
  assert.equal((await auth("users/" + (await auth("me", { cookie: admin }).then(r => r.json())).user.id,
    { method: "PATCH", cookie: admin, data: { enabled: false } })).status, 409);
});
test("invalid credentials are throttled and no password hashes appear in API responses", async () => {
  await owner();
  for (let i = 0; i < 6; i++) assert.equal((await auth("login", { method: "POST", data: {
    username: "sergio", password: "incorrect-password-xxxxxxxx"
  } })).status, 401);
  assert.equal((await auth("login", { method: "POST", data: {
    username: "sergio", password: "incorrect-password-xxxxxxxx"
  } })).status, 429);
  const response = await auth("users", { cookie: await auth("login", { method: "POST", data: {
    username: "otheruser", password: "incorrect-password-xxxxxxxx"
  } }).then(r => r.headers.get("Set-Cookie") || "") });
  assert.equal(response.status, 401);
  assert.ok(!JSON.stringify(await auth("bootstrap-status").then(r => r.json())).includes("password_hash"));
});
test("authentication is strictly Preview-only and fails closed without migration", async () => {
  const req = new Request("https://caravelaamarela.com/api/control/auth/me");
  assert.equal((await handleControlAuth(req, env, new URL(req.url), "auth/me")).status, 404);
  sqlite.exec("DROP TABLE control_users");
  assert.equal((await auth("me")).status, 503);
});
