import { randomUUID } from 'node:crypto';
import { hashPassword } from './store.js';
import { freshState, validateDeck } from '../src/state.js';

function check(ok, message, status = 400) { if (!ok) { const error = new Error(message); error.status = status; throw error; } }
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
function protectAdmin(store, actor, target) {
  check(target.id !== actor.id, 'Không thể xóa, khóa hoặc hạ quyền chính mình.');
  if (target.role === 'admin' && !target.banned) check(store.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND banned=0").get().n > 1, 'Phải giữ ít nhất một quản trị viên đang hoạt động.');
}
export async function management(store, actor, route, method, readBody) {
  if (route === '/api/admin/config' && method === 'GET') return store.config();
  if (route === '/api/admin/config' && method === 'POST') {
    const data = await readBody();
    return store.transaction(() => { const result = store.saveConfig(data.config, data.revision); store.audit(actor.id, 'system', 'config', 'Cập nhật/khôi phục cấu hình game'); return result; });
  }
  if (/^\/api\/admin\/(cards|packs)$/.test(route) && method === 'POST') {
    const data = await readBody(), kind = route.endsWith('cards') ? 'cards' : 'packs';
    return store.transaction(() => {
      const config = store.config(); check(data.revision === config.revision, 'Danh mục đã thay đổi. Hãy tải lại trước khi lưu.', 409);
      const item = data.item; check(item && typeof item === 'object', 'Thiếu dữ liệu danh mục.');
      const id = data.id || `${kind === 'cards' ? 'card' : 'pack'}-${randomUUID()}`;
      const index = config[kind].findIndex(c => c.id === id);
      check(!data.id || index >= 0, 'Không tìm thấy mục cần sửa.', 404);
      if (index >= 0) config[kind][index] = { ...config[kind][index], ...item, id };
      else config[kind].push({ ...item, id });
      const saved = store.saveConfig(config, data.revision);
      store.audit(actor.id, id, kind, `${index >= 0 ? 'Sửa' : 'Tạo'} ${kind === 'cards' ? 'thẻ' : 'pack'}: ${saved[kind].find(c => c.id === id).name}`);
      return { config: saved, id };
    });
  }
  if (route === '/api/admin/users' && method === 'POST') {
    const data = await readBody();
    check(typeof data.username === 'string' && /^[a-z0-9_]{3,24}$/.test(data.username), 'Tên đăng nhập cần 3–24 ký tự thường, số hoặc _.');
    check(typeof data.displayName === 'string' && data.displayName.trim().length >= 1 && data.displayName.length <= 32, 'Tên hiển thị cần 1–32 ký tự.');
    check(typeof data.password === 'string' && data.password.length >= 8 && data.password.length <= 128, 'Mật khẩu cần 8–128 ký tự.');
    check(['player', 'admin'].includes(data.role), 'Vai trò không hợp lệ.');
    return store.transaction(() => {
      check(!store.byUsername(data.username), 'Tên đăng nhập đã tồn tại.', 409);
      const user = store.createUser(data.username, data.displayName.trim(), data.password);
      store.db.prepare('UPDATE users SET role=? WHERE id=?').run(data.role, user.id);
      store.audit(actor.id, user.id, 'create-user', `Tạo @${data.username} (${data.role})`); return store.account(store.user(user.id));
    });
  }
  const accountMatch = /^\/api\/admin\/users\/([a-f0-9-]+)\/(account|password|delete|inventory|deck)$/.exec(route);
  if (accountMatch && method === 'POST') {
    const [, id, operation] = accountMatch, data = await readBody();
    return store.transaction(() => {
      const row = store.user(id); check(row, 'Tài khoản không tồn tại.', 404);
      const config = store.config(), cards = Object.fromEntries(config.cards.map(c => [c.id, c]));
      const profile = JSON.parse(row.profile); let detail;
      if (operation === 'account') {
        check(typeof data.displayName === 'string' && data.displayName.trim().length >= 1 && data.displayName.length <= 32, 'Tên hiển thị cần 1–32 ký tự.');
        check(['player', 'admin'].includes(data.role), 'Vai trò không hợp lệ.');
        if (row.role === 'admin' && data.role !== 'admin') protectAdmin(store, actor, row);
        store.db.prepare('UPDATE users SET display_name=?,role=? WHERE id=?').run(data.displayName.trim(), data.role, id);
        detail = `Sửa @${row.username}: tên hiển thị và vai trò ${data.role}`;
      } else if (operation === 'password') {
        check(id !== actor.id, 'Dùng mục Tài khoản để đổi mật khẩu của bạn.');
        check(typeof data.password === 'string' && data.password.length >= 8 && data.password.length <= 128, 'Mật khẩu cần 8–128 ký tự.');
        store.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(data.password), id); store.revokeSessions(id);
        detail = `Đặt lại mật khẩu @${row.username} và thu hồi phiên đăng nhập`;
      } else if (operation === 'delete') {
        protectAdmin(store, actor, row); check(data.confirm === row.username, 'Nhập đúng tên đăng nhập để xác nhận xóa.');
        store.audit(actor.id, id, 'delete', `Xóa tài khoản @${row.username}`);
        store.db.prepare('DELETE FROM users WHERE id=?').run(id); return { deleted: true, userId: id };
      } else if (operation === 'inventory') {
        check(typeof data.cardId === 'string' && Object.hasOwn(cards, data.cardId) && integer(data.quantity, 0, 999999), 'Thẻ hoặc số lượng không hợp lệ.');
        if (data.quantity) profile.collection[data.cardId] = data.quantity; else delete profile.collection[data.cardId];
        let copies = 0; profile.deck = profile.deck.filter(key => key !== data.cardId || ++copies <= Math.min(2, data.quantity));
        store.saveProfile(id, profile); detail = `Đặt số lượng ${cards[data.cardId].name} = ${data.quantity}; đồng bộ bộ bài`;
      } else {
        check(Array.isArray(data.deck) && data.deck.length === 20 && validateDeck(data.deck, profile.collection, cards), 'Bộ bài cần 20 thẻ đã sở hữu, tối đa 2 bản sao mỗi loại.');
        profile.deck = [...data.deck]; store.saveProfile(id, profile); detail = 'Cập nhật bộ bài chiến đấu';
      }
      store.audit(actor.id, id, operation, detail); return store.account(store.user(id));
    });
  }
  if (route === '/api/admin/bulk' && method === 'POST') {
    const data = await readBody();
    return store.transaction(() => {
      const config = store.config(), catalog = Object.fromEntries(config.cards.map(c => [c.id, c]));
      const ids = data.scope === 'players' ? store.db.prepare("SELECT id FROM users WHERE role='player'").all().map(u => u.id) : data.userIds;
      check(Array.isArray(ids) && ids.length >= 1 && ids.length <= 1000 && new Set(ids).size === ids.length, 'Chọn từ 1 đến 1.000 tài khoản, không trùng.');
      check(['gold', 'cards', 'ban', 'unban', 'reset', 'cancel-battle'].includes(data.action), 'Thao tác hàng loạt không hợp lệ.');
      check(data.confirm === 'XÁC NHẬN', 'Cần xác nhận thao tác hàng loạt.');
      if (data.action === 'gold') check(integer(data.amount, -1_000_000, 1_000_000) && data.amount !== 0, 'Số vàng không hợp lệ.');
      if (data.action === 'cards') check((data.cardId === 'all' || Object.hasOwn(catalog, data.cardId)) && integer(data.quantity, 1, 99), 'Thẻ hoặc số lượng không hợp lệ.');
      for (const id of ids) {
        const row = store.user(id); check(row, 'Có tài khoản không còn tồn tại.', 409);
        let p = JSON.parse(row.profile);
        if (data.action === 'gold') { check(integer(p.coins + data.amount, 0, 1_000_000_000), `Số vàng của @${row.username} sẽ vượt giới hạn.`); p.coins += data.amount; }
        if (data.action === 'cards') for (const key of data.cardId === 'all' ? config.cards.map(c => c.id) : [data.cardId]) { check((p.collection[key] || 0) + data.quantity <= 999999, 'Số thẻ vượt giới hạn.'); p.collection[key] = (p.collection[key] || 0) + data.quantity; }
        if (data.action === 'ban') { protectAdmin(store, actor, row); store.db.prepare('UPDATE users SET banned=1 WHERE id=?').run(id); store.revokeSessions(id); }
        if (data.action === 'unban') store.db.prepare('UPDATE users SET banned=0 WHERE id=?').run(id);
        if (data.action === 'reset') p = { ...freshState(), coins: config.settings.startingGold };
        if (data.action === 'cancel-battle') p.battle = null;
        store.saveProfile(id, p); store.audit(actor.id, id, `bulk-${data.action}`, `Hàng loạt @${row.username}: ${data.action}${data.action === 'gold' ? ` ${data.amount}` : data.action === 'cards' ? ` ${data.cardId} ×${data.quantity}` : ''}`);
      }
      return { ok: true, count: ids.length };
    });
  }
  if (route === '/api/admin/export' && method === 'GET') {
    const users = store.db.prepare('SELECT * FROM users ORDER BY username').all().map(row => ({ ...store.publicUser(row), profile: { ...JSON.parse(row.profile), battle: null } }));
    store.audit(actor.id, 'system', 'export', 'Xuất dữ liệu trò chơi (không gồm mật khẩu hoặc phiên đăng nhập)');
    return { format: 'linh-thu-export', version: 1, exportedAt: new Date().toISOString(), config: store.config(), users };
  }
  return undefined;
}
