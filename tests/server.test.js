import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store, verifyPassword } from '../server/store.js';
import { createServer } from '../server.mjs';
import { CARDS, STARTER_DECK } from '../src/cards.js';

async function fixture(t, filename = ':memory:') {
  const store = new Store(filename), server = createServer(store);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); store.close(); });
  const call = async (route, data, cookie = '', headers = {}) => {
    const response = await fetch(url + route, { method: data === undefined ? 'GET' : 'POST', headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  };
  const register = async (name, admin = false) => {
    const password = randomBytes(20).toString('hex');
    const result = await call('/api/auth/register', { username: name, displayName: name, password, role: 'admin', coins: 999999 });
    assert.equal(result.status, 201); if (admin) store.grantAdmin(name);
    return { ...result, password, id: result.data.user.id };
  };
  return { store, url, call, register };
}

test('registration hashes passwords, creates isolated player accounts and HttpOnly sessions', async t => {
  const { store, register, call } = await fixture(t);
  const a = await register('alice'), b = await register('bobby');
  assert.equal(a.data.user.role, 'player'); assert.equal(a.data.profile.coins, 1200);
  assert.notEqual(a.id, b.id); assert.match(a.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const row = store.user(a.id); assert.ok(verifyPassword(a.password, row.password_hash)); assert.ok(!row.password_hash.includes(a.password));
  assert.equal(a.data.user.password_hash, undefined); assert.equal(a.data.user.password, undefined);
  assert.equal((await call('/api/me', undefined, a.cookie)).data.user.username, 'alice');
  assert.equal((await call('/api/me')).status, 401);
  const sessions = store.db.prepare('SELECT token_hash FROM sessions').all();
  assert.ok(sessions.every(s => !a.cookie.includes(s.token_hash)));
});
test('login validates credentials, forbids duplicate usernames, and logout invalidates sessions', async t => {
  const { call, register } = await fixture(t); const a = await register('alice');
  assert.equal((await call('/api/auth/login', { username: 'alice', password: 'wrong-password' })).status, 401);
  assert.equal((await call('/api/auth/register', { username: 'alice', password: a.password })).status, 409);
  assert.equal((await call('/api/auth/register', { username: 'ab', password: 'short' })).status, 400);
  const login = await call('/api/auth/login', { username: 'ALICE', password: a.password }); assert.equal(login.status, 200);
  assert.equal((await call('/api/auth/logout', {}, login.cookie)).status, 200);
  assert.equal((await call('/api/me', undefined, login.cookie)).status, 401);
  assert.equal((await call('/api/me', undefined, a.cookie)).status, 200);
});
test('server denies every admin endpoint to anonymous users and ordinary players', async t => {
  const { call, register } = await fixture(t); const a = await register('alice'), b = await register('bobby');
  for (const [route, data] of [['/api/admin/overview'], ['/api/admin/users'], [`/api/admin/users/${b.id}`], [`/api/admin/users/${b.id}/gold`, { amount: 100 }], [`/api/admin/users/${b.id}/cards`, { cardId: 'all', quantity: 2 }], [`/api/admin/users/${b.id}/ban`, { banned: true }], [`/api/admin/users/${b.id}/reset`, {}]]) {
    assert.equal((await call(route, data)).status, 401);
    assert.equal((await call(route, data, a.cookie)).status, 403);
  }
  assert.equal((await call('/api/me', undefined, b.cookie)).data.profile.coins, 1200);
});
test('admin can search accounts, adjust gold, grant cards and inspect an attributable audit trail', async t => {
  const { call, register } = await fixture(t); const owner = await register('owner', true), player = await register('alice');
  const users = await call('/api/admin/users?search=alice', undefined, owner.cookie); assert.equal(users.data.total, 1); assert.equal(users.data.users[0].id, player.id);
  assert.equal((await call('/api/admin/users?search=%25', undefined, owner.cookie)).data.total, 0);
  const gold = await call(`/api/admin/users/${player.id}/gold`, { amount: 750 }, owner.cookie); assert.equal(gold.data.profile.coins, 1950);
  assert.equal((await call('/api/me', undefined, owner.cookie)).data.profile.coins, 1200);
  await call(`/api/admin/users/${player.id}/cards`, { cardId: 'nature-12', quantity: 2 }, owner.cookie);
  const all = await call(`/api/admin/users/${player.id}/cards`, { cardId: 'all', quantity: 1 }, owner.cookie);
  assert.ok(CARDS.every(c => all.data.profile.collection[c.id] >= 1)); assert.equal(all.data.profile.collection['nature-12'], 3);
  assert.deepEqual(all.data.profile.deck, STARTER_DECK);
  const audit = (await call('/api/admin/overview', undefined, owner.cookie)).data.audit;
  assert.equal(audit[0].actorName, 'owner'); assert.equal(audit[0].targetName, 'alice'); assert.equal(audit[0].action, 'cards');
});
test('invalid admin changes roll back without corrupting resources or recording successful audit entries', async t => {
  const { call, register } = await fixture(t); const owner = await register('owner', true), p = await register('alice');
  const count = (await call('/api/admin/overview', undefined, owner.cookie)).data.audit.length;
  for (const amount of [-1201, 0, 1.5, 1_000_001, null]) assert.equal((await call(`/api/admin/users/${p.id}/gold`, { amount }, owner.cookie)).status, 400);
  for (const data of [{ cardId: '__proto__', quantity: 1 }, { cardId: 'all', quantity: -1 }, { cardId: 'nature-12', quantity: 100 }]) assert.equal((await call(`/api/admin/users/${p.id}/cards`, data, owner.cookie)).status, 400);
  assert.equal((await call('/api/me', undefined, p.cookie)).data.profile.coins, 1200);
  assert.equal((await call('/api/admin/overview', undefined, owner.cookie)).data.audit.length, count);
});
test('banning revokes all sessions, unbanning permits a new login, and admins cannot ban themselves', async t => {
  const { call, register } = await fixture(t); const owner = await register('owner', true), p = await register('alice');
  assert.equal((await call(`/api/admin/users/${owner.id}/ban`, { banned: true }, owner.cookie)).status, 400);
  assert.equal((await call(`/api/admin/users/${p.id}/ban`, { banned: true }, owner.cookie)).status, 200);
  assert.equal((await call('/api/me', undefined, p.cookie)).status, 401);
  assert.equal((await call('/api/auth/login', { username: 'alice', password: p.password })).status, 401);
  await call(`/api/admin/users/${p.id}/ban`, { banned: false }, owner.cookie);
  assert.equal((await call('/api/auth/login', { username: 'alice', password: p.password })).status, 200);
  assert.equal((await call('/api/me', undefined, p.cookie)).status, 401);
});
test('daily rewards, pack purchases and deck rules are authoritative on the server', async t => {
  const { call, register } = await fixture(t); const p = await register('alice');
  const daily = await Promise.all([call('/api/game/daily', {}, p.cookie), call('/api/game/daily', {}, p.cookie)]);
  assert.deepEqual(daily.map(r => r.status).sort(), [200, 409]);
  const pack = await call('/api/game/pack', { packId: 'origin', coins: 999999 }, p.cookie);
  assert.equal(pack.data.profile.coins, 1350); assert.equal(pack.data.cards.length, 5);
  assert.equal(Object.values(pack.data.profile.collection).reduce((a, n) => a + n), 25);
  assert.equal((await call('/api/game/deck', { deck: Array(20).fill('fire-0') }, p.cookie)).status, 400);
  assert.equal((await call('/api/game/deck', { deck: STARTER_DECK.slice(1) }, p.cookie)).status, 200);
  assert.equal((await call('/api/game/battle/start', { mode: 'ai' }, p.cookie)).status, 400);
  const prefs = await call('/api/game/preferences', { sound: true, coins: 999999, role: 'admin' }, p.cookie);
  assert.equal(prefs.data.profile.coins, 1350); assert.equal(prefs.data.user.role, 'player'); assert.equal(prefs.data.profile.sound, true);
});
test('online battles enforce legal actions, run AI, award a win once and reject replayed rewards', async t => {
  const { call, register, store } = await fixture(t); const p = await register('alice');
  let started = await call('/api/game/battle/start', { mode: 'ai' }, p.cookie); let b = started.data.profile.battle;
  const bad = await call('/api/game/battle/action', { type: 'attack', uid: 999, target: null, battleId: b.id, revision: b.revision }, p.cookie); assert.equal(bad.status, 400);
  assert.equal((await call('/api/game/battle/action', { type: 'end', battleId: 'old-battle' }, p.cookie)).status, 409);
  const next = await call('/api/game/battle/action', { type: 'end', battleId: b.id, revision: b.revision }, p.cookie);
  assert.equal(next.status, 200); assert.equal(next.data.profile.battle.turn, 0); assert.ok(next.data.frames.length >= 2);
  // Place a server-side fixture one legal fire summon from victory.
  const profile = JSON.parse(store.user(p.id).profile); profile.battle.players[1].hp = 1; profile.battle.players[0].hand = ['fire-0']; profile.battle.players[0].energy = 1; store.saveProfile(p.id, profile);
  const payload = { type: 'play', index: 0, battleId: b.id, revision: next.data.profile.battle.revision, reward: 999999 };
  const victory = await call('/api/game/battle/action', payload, p.cookie);
  assert.equal(victory.data.profile.battle.winner, 0); assert.equal(victory.data.profile.coins, 1300); assert.equal(victory.data.profile.wins, 1);
  assert.equal((await call('/api/game/battle/action', payload, p.cookie)).status, 409);
  assert.equal((await call('/api/me', undefined, p.cookie)).data.profile.coins, 1300);
});
test('admin can cancel a live battle and reset progress while preserving account and role', async t => {
  const { call, register } = await fixture(t); const owner = await register('owner', true), p = await register('alice');
  await call('/api/game/battle/start', { mode: 'local' }, p.cookie);
  const canceled = await call(`/api/admin/users/${p.id}/cancel-battle`, {}, owner.cookie);
  assert.equal(canceled.data.profile.battle, null); assert.equal(canceled.data.profile.coins, 1200);
  await call(`/api/admin/users/${p.id}/gold`, { amount: 1000 }, owner.cookie);
  const reset = await call(`/api/admin/users/${p.id}/reset`, {}, owner.cookie);
  assert.equal(reset.data.profile.coins, 1200); assert.equal(reset.data.user.username, 'alice'); assert.deepEqual(reset.data.profile.deck, STARTER_DECK);
});
test('cross-origin writes, form posts and private server files are rejected', async t => {
  const { call, url } = await fixture(t);
  assert.equal((await call('/api/auth/register', {}, '', { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await call('/api/auth/register', {}, '', { 'Content-Type': 'text/plain' })).status, 415);
  for (const file of ['/server/store.js', '/.data/linh-thu.sqlite', '/scripts/admin.mjs', '/package.json']) assert.equal((await fetch(url + file)).status, 404);
  const home = await fetch(url); assert.equal(home.status, 200); assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});
test('SQLite profiles, roles and sessions survive reopening the database', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'linh-thu-db-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'game.sqlite');
  const first = new Store(filename); const p = first.createUser('owner', 'Owner', randomBytes(20).toString('hex')); first.grantAdmin('owner');
  const session = first.newSession(p.id); const profile = JSON.parse(p.profile); profile.coins = 7777; first.saveProfile(p.id, profile); first.close();
  const reopened = new Store(filename); assert.equal(reopened.session(session).role, 'admin'); assert.equal(JSON.parse(reopened.user(p.id).profile).coins, 7777);
  reopened.db.prepare('UPDATE sessions SET expires_at=0').run(); assert.equal(reopened.session(session), undefined); reopened.close();
});
test('simultaneous actions from two devices accept one revision and reject the stale action', async t => {
  const { call, register } = await fixture(t); const p = await register('alice');
  const start = await call('/api/game/battle/start', { mode: 'local' }, p.cookie);
  const b = start.data.profile.battle;
  const payload = { type: 'end', battleId: b.id, revision: b.revision };
  const results = await Promise.all([call('/api/game/battle/action', payload, p.cookie), call('/api/game/battle/action', payload, p.cookie)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const latest = (await call('/api/me', undefined, p.cookie)).data.profile.battle;
  assert.equal(latest.turn, 1); assert.equal(latest.revision, 1);
});
test('repeated failed logins are rate limited without exposing credentials', async t => {
  const { call, register } = await fixture(t); const p = await register('alice');
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/auth/login', { username: 'alice', password: 'incorrect-input' })).status, 401);
  assert.equal((await call('/api/auth/login', { username: 'alice', password: p.password })).status, 429);
});
