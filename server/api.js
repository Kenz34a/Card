import { randomUUID } from 'node:crypto';
import { Store, hashToken, verifyPassword, hashPassword } from './store.js';
import { CARDS, CARD_MAP, STARTER_DECK } from '../src/cards.js';
import { freshState, purchasePack, validateDeck } from '../src/state.js';
import { createBattle, playCard, attack, evolve, endTurn, aiStep, botDeck } from '../src/engine.js';

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const check = (condition, status, message) => { if (!condition) throw new ApiError(status, message); };
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const cardExists = id => typeof id === 'string' && Object.hasOwn(CARD_MAP, id);
const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
function settle(profile) {
  const b = profile.battle;
  if (!b || b.winner === null || b.rewarded) return;
  b.rewarded = true; profile.matches++;
  if (b.mode === 'ai' && b.winner === 0) profile.wins++;
  profile.coins += b.mode === 'local' ? 60 : b.winner === 0 ? 100 : 40;
}
async function body(req) {
  check(req.headers['content-type']?.split(';')[0] === 'application/json', 415, 'Yêu cầu dữ liệu JSON.');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; check(size <= 65536, 413, 'Dữ liệu quá lớn.'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); check(value && typeof value === 'object' && !Array.isArray(value), 400, 'Dữ liệu không hợp lệ.'); return value; }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'Dữ liệu JSON không hợp lệ.'); }
}
function cookieToken(req) { return /(?:^|;\s*)linh_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
function sessionCookie(req, token) {
  return `linh_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 604800 : 0}${process.env.COOKIE_SECURE === 'true' || req.socket.encrypted ? '; Secure' : ''}`;
}
export function createApi(store = new Store()) {
  const attempts = new Map(), dummyHash = hashPassword('unused-account-verification');
  function limited(key, max, windowMs) {
    const now = Date.now();
    if (attempts.size > 10000) for (const [k, value] of attempts) if (value.until < now) attempts.delete(k);
    let entry = attempts.get(key);
    if (!entry || entry.until < now) { entry = { count: 0, until: now + windowMs }; attempts.set(key, entry); }
    check(++entry.count <= max, 429, 'Bạn thử quá nhiều lần. Vui lòng thử lại sau.');
  }
  return async function handleApi(req, res) {
    const send = (status, value, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost'), route = url.pathname, method = req.method;
      if (method !== 'GET') {
        check(method === 'POST', 405, 'Phương thức không được hỗ trợ.');
        let sameOrigin = true;
        if (req.headers.origin) { try { sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch { sameOrigin = false; } }
        check(sameOrigin && req.headers['sec-fetch-site'] !== 'cross-site', 403, 'Nguồn yêu cầu không hợp lệ.');
      }
      if (method === 'POST' && ['/api/auth/register', '/api/auth/login'].includes(route)) {
        const data = await body(req), username = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
        check(/^[a-z0-9_]{3,24}$/.test(username), 400, 'Tên đăng nhập cần 3–24 ký tự: chữ thường, số hoặc dấu gạch dưới.');
        check(typeof data.password === 'string' && data.password.length >= 8 && data.password.length <= 128, 400, 'Mật khẩu cần từ 8 đến 128 ký tự.');
        const ip = req.socket.remoteAddress; let user;
        if (route.endsWith('/register')) {
          limited(`register:${ip}`, 30, 3600_000);
          check(!store.byUsername(username), 409, 'Tên đăng nhập đã được sử dụng.');
          const name = typeof data.displayName === 'string' ? data.displayName.trim() : username;
          check(name.length >= 1 && name.length <= 32, 400, 'Tên hiển thị cần từ 1 đến 32 ký tự.');
          user = store.createUser(username, name, data.password);
        } else {
          limited(`login-ip:${ip}`, 200, 15 * 60_000);
          const key = `login:${ip}:${username}`; limited(key, 10, 15 * 60_000);
          user = store.byUsername(username);
          const valid = verifyPassword(data.password, user?.password_hash || dummyHash);
          check(user && valid && !user.banned, 401, 'Sai thông tin đăng nhập hoặc tài khoản đang bị khóa.');
          attempts.delete(key);
        }
        const token = store.newSession(user.id);
        store.db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(Date.now(), user.id);
        send(route.endsWith('/register') ? 201 : 200, store.account(store.user(user.id)), { 'Set-Cookie': sessionCookie(req, token) }); return;
      }
      const token = cookieToken(req), user = store.session(token);
      check(user && !user.banned, 401, 'Vui lòng đăng nhập để tiếp tục.');
      store.db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(Date.now(), user.id);
      if (route === '/api/auth/logout' && method === 'POST') {
        store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
        send(200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '') }); return;
      }
      if (route === '/api/me' && method === 'GET') { send(200, store.account(store.user(user.id))); return; }
      if (route.startsWith('/api/admin/')) {
        check(user.role === 'admin', 403, 'Chỉ quản trị viên mới có quyền thực hiện thao tác này.');
        if (route === '/api/admin/overview' && method === 'GET') {
          const stats = store.db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(banned),0) AS banned,
            COALESCE(SUM(CASE WHEN last_seen>? AND banned=0 THEN 1 ELSE 0 END),0) AS online FROM users`).get(Date.now() - 300_000);
          const audit = store.db.prepare(`SELECT audit.*, COALESCE(a.username,audit.actor) AS actorName, COALESCE(t.username,audit.target) AS targetName
            FROM audit LEFT JOIN users a ON a.id=audit.actor LEFT JOIN users t ON t.id=audit.target ORDER BY audit.id DESC LIMIT 30`).all();
          send(200, { stats, audit }); return;
        }
        if (route === '/api/admin/users' && method === 'GET') {
          const search = (url.searchParams.get('search') || '').slice(0, 64), page = Math.floor(Math.max(1, Math.min(100000, Number(url.searchParams.get('page')) || 1)));
          const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`, where = "username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\'";
          const total = store.db.prepare(`SELECT COUNT(*) AS total FROM users WHERE ${where}`).get(pattern, pattern).total;
          const rows = store.db.prepare(`SELECT * FROM users WHERE ${where} ORDER BY created_at DESC,id LIMIT 12 OFFSET ?`).all(pattern, pattern, (page - 1) * 12);
          send(200, { users: rows.map(row => { const p = JSON.parse(row.profile); return { ...store.publicUser(row), coins: p.coins, cards: Object.values(p.collection).reduce((a, n) => a + n, 0), wins: p.wins, matches: p.matches }; }), total, page }); return;
        }
        const match = /^\/api\/admin\/users\/([a-f0-9-]+)(?:\/(gold|cards|ban|reset|cancel-battle))?$/.exec(route);
        check(match, 404, 'Không tìm thấy chức năng quản trị.');
        const [, id, operation] = match, target = store.user(id); check(target, 404, 'Người chơi không tồn tại.');
        if (!operation && method === 'GET') { send(200, store.account(target)); return; }
        check(operation && method === 'POST', 405, 'Phương thức không được hỗ trợ.');
        const data = await body(req);
        const account = store.transaction(() => {
          const row = store.user(id); let profile = JSON.parse(row.profile), detail = '';
          if (operation === 'gold') {
            check(integer(data.amount, -1_000_000, 1_000_000) && data.amount !== 0, 400, 'Mỗi lần điều chỉnh cần từ 1 đến 1.000.000 vàng.');
            check(integer(profile.coins + data.amount, 0, 1_000_000_000), 400, 'Số vàng sau điều chỉnh phải từ 0 đến 1 tỷ.');
            profile.coins += data.amount; detail = `Điều chỉnh ${data.amount > 0 ? '+' : ''}${data.amount} vàng`;
          } else if (operation === 'cards') {
            check(integer(data.quantity, 1, 99) && (data.cardId === 'all' || cardExists(data.cardId)), 400, 'Thẻ hoặc số lượng không hợp lệ (1–99).');
            const ids = data.cardId === 'all' ? CARDS.map(c => c.id) : [data.cardId];
            check(ids.every(key => (profile.collection[key] || 0) + data.quantity <= 999999), 400, 'Số lượng thẻ vượt giới hạn.');
            ids.forEach(key => { profile.collection[key] = (profile.collection[key] || 0) + data.quantity; });
            detail = `Cấp ${data.quantity} bản sao ${data.cardId === 'all' ? 'mỗi thẻ trong 96 thẻ' : CARD_MAP[data.cardId].name}`;
          } else if (operation === 'ban') {
            check(typeof data.banned === 'boolean', 400, 'Trạng thái khóa không hợp lệ.');
            check(id !== user.id, 400, 'Bạn không thể khóa tài khoản của chính mình.');
            if (data.banned && row.role === 'admin') check(store.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND banned=0").get().n > 1, 400, 'Cần giữ lại ít nhất một quản trị viên hoạt động.');
            store.db.prepare('UPDATE users SET banned=? WHERE id=?').run(data.banned ? 1 : 0, id);
            if (data.banned) store.revokeSessions(id);
            detail = data.banned ? 'Khóa tài khoản và thu hồi phiên đăng nhập' : 'Mở khóa tài khoản';
          } else if (operation === 'reset') { profile = freshState(); detail = 'Đặt lại tiến trình về bộ khởi đầu'; }
          else { profile.battle = null; detail = 'Hủy trận đang chơi, không trao thưởng'; }
          store.saveProfile(id, profile); store.audit(user.id, id, operation, detail); return store.account(store.user(id));
        });
        send(200, account); return;
      }
      check(route.startsWith('/api/game/') && method === 'POST', 404, 'Không tìm thấy chức năng.');
      const data = await body(req), frames = [];
      const account = store.transaction(() => {
        const profile = JSON.parse(store.user(user.id).profile); let cards;
        if (route === '/api/game/pack') cards = purchasePack(profile, data.packId);
        else if (route === '/api/game/daily') {
          check(profile.daily !== day(), 409, 'Bạn đã nhận quà hôm nay. Hẹn gặp lại ngày mai!'); profile.daily = day(); profile.coins += 300;
        } else if (route === '/api/game/deck') {
          check(Array.isArray(data.deck) && data.deck.length <= 20 && data.deck.every(cardExists), 400, 'Bộ bài không hợp lệ.');
          const counts = {}; check(data.deck.every(id => { counts[id] = (counts[id] || 0) + 1; return counts[id] <= Math.min(2, profile.collection[id] || 0); }), 400, 'Chỉ được dùng thẻ đã sở hữu, tối đa 2 bản sao mỗi loại.');
          profile.deck = [...data.deck];
        } else if (route === '/api/game/preferences') {
          check(typeof data.sound === 'boolean', 400, 'Tùy chọn âm thanh không hợp lệ.'); profile.sound = data.sound;
        } else if (route === '/api/game/battle/start') {
          check(validateDeck(profile.deck, profile.collection), 400, 'Bộ bài cần đúng 20 thẻ đã sở hữu.'); check(['ai', 'local'].includes(data.mode), 400, 'Chế độ không hợp lệ.');
          profile.battle = createBattle(profile.deck, data.mode === 'ai' ? botDeck() : STARTER_DECK, data.mode); profile.battle.id = randomUUID(); profile.battle.revision = 0;
        } else if (route === '/api/game/battle/action') {
          const b = profile.battle; check(b && b.winner === null, 409, 'Trận đấu không tồn tại hoặc đã kết thúc.'); check(data.battleId === b.id, 409, 'Trận đấu đã thay đổi. Vui lòng tải lại.');
          check(data.revision === b.revision, 409, 'Lượt đấu đã thay đổi trên thiết bị khác. Vui lòng thử lại.'); b.revision++;
          const side = b.mode === 'local' ? b.turn : 0; check(b.turn === side, 409, 'Chưa đến lượt của bạn.');
          if (data.type === 'play') { check(integer(data.index, 0, 8), 400, 'Vị trí thẻ không hợp lệ.'); playCard(b, data.index, side); }
          else if (data.type === 'attack') { check(integer(data.uid, 1, 10000) && (data.target === null || integer(data.target, 1, 10000)), 400, 'Mục tiêu không hợp lệ.'); attack(b, data.uid, data.target, side); }
          else if (data.type === 'evolve') { check(integer(data.uid, 1, 10000), 400, 'Linh thú không hợp lệ.'); evolve(b, data.uid, side); }
          else if (data.type === 'end') endTurn(b, side);
          else if (data.type === 'surrender') b.winner = 1 - side;
          else throw new ApiError(400, 'Hành động không hợp lệ.');
          frames.push(structuredClone(b));
          if (b.mode === 'ai') { let steps = 0; while (b.turn === 1 && b.winner === null) { check(++steps <= 50, 500, 'Không thể hoàn tất lượt máy.'); aiStep(b); frames.push(structuredClone(b)); } }
          settle(profile);
        } else throw new ApiError(404, 'Không tìm thấy chức năng.');
        store.saveProfile(user.id, profile); return { ...store.account(store.user(user.id)), ...(cards ? { cards } : {}) };
      });
      send(200, { ...account, frames });
    } catch (error) { const status = error.status || 400; send(status, { error: status >= 500 ? 'Máy chủ gặp lỗi. Vui lòng thử lại.' : error.message || 'Yêu cầu không hợp lệ.' }); }
  };
}
