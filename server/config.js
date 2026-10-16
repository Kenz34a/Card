import { DEFAULT_CARDS, DEFAULT_PACKS, ELEMENTS, RARITIES } from '../src/cards.js';

export const DEFAULT_SETTINGS = { startingGold: 1200, dailyGold: 300, winGold: 100, lossGold: 40, localGold: 60, registrationOpen: true, maintenance: false, announcement: '' };
export function defaultConfig() {
  return { version: 1, revision: 0, settings: { ...DEFAULT_SETTINGS }, cards: DEFAULT_CARDS.map(c => ({ ...c, enabled: true })), packs: DEFAULT_PACKS.map(p => ({ ...p, enabled: true, elementBias: p.id === 'origin' ? 0 : 70, weights: { common: 56, rare: 30, epic: 11.5, legendary: 2.5 } })) };
}
function must(ok, message) { if (!ok) throw new Error(message); }
const int = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v, max, min = 1) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
export function validateConfig(input) {
  must(input && input.version === 1 && input.settings && Array.isArray(input.cards) && Array.isArray(input.packs), 'Cấu hình không hợp lệ.');
  const s = input.settings, settings = {};
  for (const key of ['startingGold', 'dailyGold', 'winGold', 'lossGold', 'localGold']) { must(int(s[key], 0, 1_000_000), 'Vàng và phần thưởng phải là số nguyên từ 0 đến 1.000.000.'); settings[key] = s[key]; }
  for (const key of ['registrationOpen', 'maintenance']) { must(typeof s[key] === 'boolean', 'Trạng thái hệ thống không hợp lệ.'); settings[key] = s[key]; }
  must(text(s.announcement, 500, 0), 'Thông báo tối đa 500 ký tự.'); settings.announcement = s.announcement.trim();
  must(input.cards.length >= 96 && input.cards.length <= 500, 'Danh mục cần từ 96 đến 500 thẻ.');
  const cards = input.cards.map((c, index) => {
    must(c && /^[a-z][a-z0-9-]{1,63}$/.test(c.id) && text(c.name, 50) && text(c.description, 400, 0), 'Mã, tên hoặc mô tả thẻ không hợp lệ.');
    must(Object.hasOwn(ELEMENTS, c.element) && Object.hasOwn(RARITIES, c.rarity) && ['creature', 'spell'].includes(c.type), 'Hệ, loại hoặc độ hiếm không hợp lệ.');
    must(int(c.cost, 0, 10) && typeof c.enabled === 'boolean', 'Năng lượng hoặc trạng thái thẻ không hợp lệ.');
    const clean = { id: c.id, name: c.name.trim(), description: c.description.trim(), element: c.element, rarity: c.rarity, type: c.type, cost: c.cost, enabled: c.enabled, variant: index };
    if (c.type === 'creature') {
      must(int(c.attack, 1, 30) && int(c.health, 1, 50), 'Công cần 1–30, sinh lực cần 1–50.');
      must(['fox', 'spirit', 'wolf', 'golem', 'phoenix', 'serpent', 'dragon'].includes(c.form), 'Hình linh thú không hợp lệ.');
      must(['burn', 'heal', 'growth', 'swift', 'shield', 'drain'].includes(c.skill), 'Kỹ năng linh thú không hợp lệ.');
      Object.assign(clean, { attack: c.attack, health: c.health, form: c.form, skill: c.skill });
    } else {
      must(['damage', 'blast', 'heal', 'freeze', 'buff', 'draw', 'shield'].includes(c.effect), 'Phép thuật không hợp lệ.');
      Object.assign(clean, { form: 'rune', effect: c.effect });
    }
    return clean;
  });
  must(new Set(cards.map(c => c.id)).size === cards.length, 'Mã thẻ bị trùng.');
  must(DEFAULT_CARDS.every(base => cards.some(c => c.id === base.id && c.type === base.type)), 'Không được xóa hoặc đổi loại thẻ gốc; hãy ngừng phát hành.');
  must(Object.keys(RARITIES).every(r => cards.some(c => c.enabled && c.rarity === r)), 'Cần ít nhất một thẻ đang phát hành ở mỗi độ hiếm.');
  must(input.packs.length >= 1 && input.packs.length <= 30, 'Cho phép từ 1 đến 30 pack.');
  const packs = input.packs.map(p => {
    must(p && /^[a-z][a-z0-9-]{1,63}$/.test(p.id) && text(p.name, 50) && text(p.subtitle, 120, 0) && text(p.tag, 80, 0), 'Thông tin pack không hợp lệ.');
    must(int(p.price, 0, 1_000_000) && int(p.elementBias, 0, 100) && typeof p.enabled === 'boolean', 'Giá, ưu tiên hệ hoặc trạng thái pack không hợp lệ.');
    must(Object.hasOwn(ELEMENTS, p.element) && Object.hasOwn(RARITIES, p.guarantee), 'Hệ hoặc bảo đảm độ hiếm không hợp lệ.');
    const weights = Object.fromEntries(Object.keys(RARITIES).map(key => [key, p.weights?.[key]]));
    must(Object.values(weights).every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) && Math.abs(Object.values(weights).reduce((a, n) => a + n, 0) - 100) < .00001, 'Tổng tỉ lệ pack phải bằng 100%.');
    return { id: p.id, name: p.name.trim(), subtitle: p.subtitle.trim(), tag: p.tag.trim(), element: p.element, guarantee: p.guarantee, price: p.price, elementBias: p.elementBias, enabled: p.enabled, weights };
  });
  must(new Set(packs.map(p => p.id)).size === packs.length, 'Mã pack bị trùng.');
  must(DEFAULT_PACKS.every(base => packs.some(p => p.id === base.id)), 'Không được xóa pack gốc; hãy ngừng phát hành.');
  return { version: 1, revision: int(input.revision, 0, Number.MAX_SAFE_INTEGER) ? input.revision : 0, settings, cards, packs };
}
