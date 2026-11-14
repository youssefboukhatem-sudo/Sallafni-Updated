const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');

process.env.DB_FILE = path.join(os.tmpdir(), `sallafni-test-${Date.now()}.db`);
const app = require('../src/server');

let base, server;
test.before(async () => { server = app.listen(0); base = `http://localhost:${server.address().port}/api`; });
test.after(() => server.close());

const call = async (method, url, { token, body } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};
const login = async (email) => (await call('POST', '/auth/login', { body: { email, password: 'password123' } })).json.token;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

test('auth: register validation, duplicate, login, me', async () => {
  assert.equal((await call('POST', '/auth/register', { body: { email: 'bad', password: '12345678' } })).status, 400);
  assert.equal((await call('POST', '/auth/register', { body: { email: 'a@b.tn', password: 'short' } })).status, 400);
  const ok = await call('POST', '/auth/register', { body: { email: 'new@user.tn', password: 'longenough' } });
  assert.equal(ok.status, 201);
  assert.equal((await call('POST', '/auth/register', { body: { email: 'NEW@user.tn', password: 'longenough' } })).status, 409);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'new@user.tn', password: 'wrongpass' } })).status, 401);
  const me = await call('GET', '/auth/me', { token: ok.json.token });
  assert.equal(me.json.complete, false);
  assert.equal((await call('GET', '/auth/me')).status, 401);
});

test('profile update validates required fields', async () => {
  const token = (await call('POST', '/auth/register', { body: { email: 'p@user.tn', password: 'longenough' } })).json.token;
  assert.equal((await call('PUT', '/auth/me', { token, body: { fn: 'A' } })).status, 400);
  const ok = await call('PUT', '/auth/me', { token, body: { fn: 'Pat', ln: 'Lee', phone: '+216 1', street: '1 Rue X', city: 'Tunis' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.complete, true);
});

test('items: public list, filters, never leaks private data', async () => {
  const all = await call('GET', '/items');
  assert.ok(all.json.length >= 9);
  assert.ok(all.json.every((i) => !('street' in i.owner) && !('email' in i.owner)));
  const free = await call('GET', '/items?free=1&category=Tools');
  assert.ok(free.json.length > 0 && free.json.every((i) => i.p === 0 && i.c === 'Tools'));
  assert.ok((await call('GET', '/items?q=ipad')).json.some((i) => i.n === 'iPad Pro'));
});

test('items: create requires auth + validates', async () => {
  assert.equal((await call('POST', '/items', { body: {} })).status, 401);
  const token = await login('demo@sallafni.tn');
  const fd = new FormData(); fd.set('name', ''); fd.set('category', 'Tools');
  const bad = await fetch(base + '/items', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  assert.equal(bad.status, 400);
  const good = new FormData(); good.set('name', 'Test saw'); good.set('category', 'Tools'); good.set('price', '3'); good.set('condition', 'Good');
  const res = await fetch(base + '/items', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: good });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.owner.name, 'Amine');
  assert.equal((await call('DELETE', `/items/${created.id}`, { token })).status, 204);
});

test('full lifecycle: request → accept → return → rate (and rules)', async () => {
  const demo = await login('demo@sallafni.tn');
  const sara = await login('sara@sallafni.tn');
  const items = (await call('GET', '/items')).json;
  const bbq = items.find((i) => i.n === 'BBQ grill');

  // can't borrow own item, invalid dates
  const own = items.find((i) => i.n === 'Ladder');
  assert.equal((await call('POST', '/requests', { token: demo, body: { itemId: own.id, from: day(1), to: day(2) } })).status, 400);
  assert.equal((await call('POST', '/requests', { token: demo, body: { itemId: bbq.id, from: day(-3), to: day(2) } })).status, 400);
  assert.equal((await call('POST', '/requests', { token: demo, body: { itemId: bbq.id, from: day(5), to: day(2) } })).status, 400);

  const req = await call('POST', '/requests', { token: demo, body: { itemId: bbq.id, from: day(1), to: day(3) } });
  assert.equal(req.status, 201);
  assert.equal(req.json.total, 30);
  assert.equal(req.json.address, null, 'address hidden while pending');
  assert.equal((await call('POST', '/requests', { token: demo, body: { itemId: bbq.id, from: day(1), to: day(3) } })).status, 409, 'duplicate');

  // only the lender can accept
  const jeff = await login('jeff@sallafni.tn');
  assert.equal((await call('POST', `/requests/${req.json.id}/accept`, { token: sara })).status, 403);
  assert.equal((await call('POST', `/requests/${req.json.id}/accept`, { token: jeff })).status, 200);

  // address now revealed to borrower
  const out = (await call('GET', '/requests/outgoing', { token: demo })).json.find((r) => r.id === req.json.id);
  assert.equal(out.status, 'accepted');
  assert.match(out.address.street, /Ali Bach Hamba/);

  // double booking blocked
  assert.equal((await call('POST', '/requests', { token: sara, body: { itemId: bbq.id, from: day(2), to: day(4) } })).status, 409);

  // rate before return is rejected
  assert.equal((await call('POST', `/requests/${req.json.id}/rate`, { token: demo, body: { score: 9 } })).status, 409);
  assert.equal((await call('POST', `/requests/${req.json.id}/return`, { token: demo })).status, 200);
  assert.equal((await call('POST', `/requests/${req.json.id}/rate`, { token: demo, body: { score: 11 } })).status, 400);

  const before = (await call('GET', '/users/' + bbq.ownerId)).json;
  const rated = await call('POST', `/requests/${req.json.id}/rate`, { token: demo, body: { score: 10, comment: 'Great' } });
  assert.equal(rated.status, 201);
  assert.equal(rated.json.ratee.n, before.n + 1);
  assert.equal((await call('POST', `/requests/${req.json.id}/rate`, { token: demo, body: { score: 10 } })).status, 409, 'rate once');

  // lender rates borrower too
  assert.equal((await call('POST', `/requests/${req.json.id}/rate`, { token: jeff, body: { score: 7 } })).status, 201);
});

test('lender dashboard: incoming, decline, stats', async () => {
  const demo = await login('demo@sallafni.tn');
  const inc = (await call('GET', '/requests/incoming', { token: demo })).json;
  const pending = inc.filter((r) => r.status === 'pending');
  assert.ok(pending.length >= 2);
  assert.equal((await call('POST', `/requests/${pending[0].id}/decline`, { token: demo })).status, 200);
  assert.equal((await call('POST', `/requests/${pending[0].id}/accept`, { token: demo })).status, 409);
  const stats = (await call('GET', '/requests/stats', { token: demo })).json;
  assert.ok(stats.listed >= 3 && typeof stats.earned === 'number');
});
