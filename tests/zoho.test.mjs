import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../_worker.js';
const origin = 'https://control.example.test';
let db, env, calls, realFetch, account, tokenReply;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_zoho.sql', import.meta.url), 'utf8'));
  env = { ZOHO_ENABLED: 'true', ZOHO_REGION: 'eu', ZOHO_REDIRECT_URI: origin + '/api/zoho/callback',
    ZOHO_CLIENT_ID: 'test-client', ZOHO_CLIENT_SECRET: 'test-secret', ZOHO_ADMIN_TOKEN: 'a'.repeat(43),
    ZOHO_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64'),
    ZOHO_DB: { prepare(sql) { return { bind(...args) { return {
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async run() { return db.prepare(sql).run(...args); }
    }; } }; } }, ASSETS: { fetch: async () => new Response('public asset') } };
  calls = []; account = 'booking@caravelaamarela.com';
  tokenReply = { access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600 };
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/oauth/v2/token')) return Response.json(tokenReply);
    if (String(url).endsWith('/api/accounts')) return Response.json({ data: [{ type: 'ZOHO_ACCOUNT', primaryEmailAddress: account, accountId: '1234567890123456789' }] });
    return Response.json({ data: [{ messageId: '777', subject: 'Test' }] });
  };
});
afterEach(() => { globalThis.fetch = realFetch; db.close(); });
function request(path, { method = 'GET', admin = true, headers = {}, ...options } = {}) {
  return worker.fetch(new Request(origin + path, { method, headers: { ...(admin ? { Authorization: `Bearer ${env.ZOHO_ADMIN_TOKEN}` } : {}), ...headers }, ...options }), env, {});
}
async function start() {
  const response = await request('/api/zoho/authorize', { method: 'POST' });
  assert.equal(response.status, 200);
  const target = new URL((await response.json()).authorizationUrl);
  return { state: target.searchParams.get('state'), cookie: response.headers.get('set-cookie').split(';')[0], target };
}
async function connect() {
  const flow = await start();
  const response = await request(`/api/zoho/callback?state=${flow.state}&code=fake-code`, { admin: false, headers: { Cookie: flow.cookie } });
  return { flow, response };
}
test('disabled integration and missing config fail closed without network calls', async () => {
  env.ZOHO_ENABLED = 'false'; assert.equal((await request('/api/zoho/status')).status, 404);
  env.ZOHO_ENABLED = 'true'; delete env.ZOHO_TOKEN_KEY;
  assert.equal((await request('/api/zoho/status')).status, 503); assert.equal(calls.length, 0);
});
test('all administrative routes reject missing credentials and unsafe methods', async () => {
  for (const path of ['status', 'folders', 'messages', 'content']) {
    assert.equal((await request('/api/zoho/' + path, { admin: false })).status, 401);
    assert.equal((await request('/api/zoho/' + path, { method: 'DELETE' })).status, 405);
  }
  assert.equal((await request('/api/zoho/authorize', { method: 'POST', admin: false })).status, 401);
  assert.equal(calls.length, 0);
});
test('authorization rejects cross-origin requests and unknown host', async () => {
  assert.equal((await request('/api/zoho/authorize', { method: 'POST', headers: { Origin: 'https://evil.test' } })).status, 403);
  const r = await worker.fetch(new Request('https://evil.test/api/zoho/status'), env, {});
  assert.equal(r.status, 403);
});
test('authorization requests only read scopes and stores hashes, secure browser cookie', async () => {
  const { state, cookie, target } = await start();
  assert.equal(target.origin, 'https://accounts.zoho.eu');
  assert.equal(target.searchParams.get('scope'), 'ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.READ');
  assert.equal(target.searchParams.get('access_type'), 'offline');
  const stored = JSON.stringify(db.prepare('SELECT * FROM zoho_oauth_state').all());
  assert.ok(!stored.includes(state)); assert.ok(!stored.includes(cookie.split('=')[1]));
  const response = await request('/api/zoho/authorize', { method: 'POST' });
  assert.match(response.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax; Max-Age=600/);
});
test('callback consumes state atomically, encrypts tokens, redirects without code and prevents replay', async () => {
  const { flow, response } = await connect(); assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/api/zoho/connected');
  const stored = JSON.stringify(db.prepare('SELECT * FROM zoho_connection').all());
  assert.ok(!stored.includes('access-secret')); assert.ok(!stored.includes('refresh-secret'));
  const replay = await request(`/api/zoho/callback?state=${flow.state}&code=fake`, { admin: false, headers: { Cookie: flow.cookie } });
  assert.equal(replay.status, 303);
  assert.match(replay.headers.get('location'), /result=invalid_state/);
  assert.equal(calls.length, 2);
  const status = await request('/api/zoho/status'); assert.equal((await status.json()).connected, true);
});
test('callback requires matching browser cookie and unexpired state', async () => {
  const flow = await start();
  assert.match((await request(`/api/zoho/callback?state=${flow.state}&code=fake`, { admin: false })).headers.get('location'), /result=invalid_state/);
  db.exec('UPDATE zoho_oauth_state SET expires_at = 0');
  assert.match((await request(`/api/zoho/callback?state=${flow.state}&code=fake`, { admin: false, headers: { Cookie: flow.cookie } })).headers.get('location'), /result=invalid_state/);
  assert.equal(calls.length, 0);
});
test('wrong mailbox and missing refresh token never persist a connection', async () => {
  account = 'other@example.test'; assert.match((await connect()).response.headers.get('location'), /result=mailbox_mismatch/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM zoho_connection').get().n, 0);
  delete tokenReply.refresh_token; assert.match((await connect()).response.headers.get('location'), /result=refresh_token_missing/);
});
test('broader scopes are refused and provider errors never leak', async () => {
  tokenReply.scope = 'ZohoMail.messages.ALL'; assert.match((await connect()).response.headers.get('location'), /result=invalid_scopes/);
  tokenReply = { error: 'invalid_code', error_description: 'secret upstream diagnostic' };
  const { response } = await connect(); assert.equal(response.status, 303);
  assert.match(response.headers.get('location'), /result=reauthorization_required/);
  assert.ok(!response.headers.get('location').includes('secret'));
});
test('read routes pin account and region, validate IDs/pagination, never write Zoho mail', async () => {
  await connect(); calls.length = 0;
  for (const path of ['folders', 'messages?limit=10&accountId=999', 'content?folderId=5&messageId=7']) {
    const response = await request('/api/zoho/' + path); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  for (const call of calls) {
    assert.equal(call.options.method, 'GET'); assert.match(call.url, /^https:\/\/mail.zoho.eu\/api\/accounts\/1234567890123456789\//);
    assert.equal(call.options.redirect, 'error');
  }
  for (const path of ['messages?limit=101', 'messages?start=0', 'content?folderId=../&messageId=2']) assert.equal((await request('/api/zoho/' + path)).status, 400);
});
test('expired token refreshes once, preserves refresh token and releases database lock', async () => {
  tokenReply.expires_in = 1; await connect(); calls.length = 0;
  tokenReply = { access_token: 'renewed', expires_in: 3600 };
  assert.equal((await request('/api/zoho/folders')).status, 200);
  assert.equal((await request('/api/zoho/folders')).status, 200);
  const refreshes = calls.filter(c => c.url.endsWith('/token'));
  assert.equal(refreshes.length, 1); assert.equal(refreshes[0].options.body.get('refresh_token'), 'refresh-secret');
  assert.equal(db.prepare('SELECT lock_until FROM zoho_connection').get().lock_until, 0);
});
test('refresh contention and tampered encrypted tokens fail closed', async () => {
  tokenReply.expires_in = 1; await connect(); calls.length = 0;
  db.prepare('UPDATE zoho_connection SET lock_until = ?').run(Date.now() + 60000);
  assert.equal((await request('/api/zoho/folders')).status, 503); assert.equal(calls.length, 0);
  db.exec("UPDATE zoho_connection SET sealed = 'v1.bad.bad'");
  assert.equal((await request('/api/zoho/folders')).status, 503);
});
test('public static and contact method behavior remains intact', async () => {
  const publicResponse = await request('/'); assert.equal(await publicResponse.text(), 'public asset');
  assert.equal((await request('/api/contact')).status, 405);
  assert.equal((await request('/index.html')).status, 301);
});

test('OAuth client rejection is distinguished from a Mail account request error without exposing codes', async () => {
  tokenReply = { error: 'invalid_client', error_description: 'provider confidential diagnostic' };
  const first = await connect();
  assert.equal(first.response.status, 303);
  assert.match(first.response.headers.get('location'), /result=oauth_client_rejected/);
  assert.ok(!first.response.headers.get('location').includes('confidential'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM zoho_connection').get().n, 0);
  tokenReply = { access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600 };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/api/accounts')) return Response.json({ status: { code: 403, description: 'private diagnostic' } }, { status: 403 });
    return original(url, options);
  };
  const second = await connect();
  assert.equal(second.response.status, 303);
  assert.match(second.response.headers.get('location'), /result=accounts_provider_rejected/);
  assert.ok(!second.response.headers.get('location').includes('private'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM zoho_connection').get().n, 0);
});

test('Zoho account responses with numeric or string success code are accepted', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/api/accounts')) return Response.json({status: {code: '200'}, data: [{
      type: 'ZOHO_ACCOUNT', primaryEmailAddress: 'booking@caravelaamarela.com', accountId: '1234567890123456789'
    }]});
    return original(url, options);
  };
  const result = await connect();
  assert.equal(result.response.status, 303);
  assert.equal(result.response.headers.get('location'), '/api/zoho/connected');
});
