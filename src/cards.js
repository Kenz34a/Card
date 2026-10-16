export const ELEMENTS = {
  fire: { name: 'Hỏa', color: '#fa9566', dark: '#742e29', icon: 'flame', skill: 'burn', description: 'Gây 1 sát thương lên đối thủ khi được triệu hồi.' },
  water: { name: 'Thủy', color: '#75c9ed', dark: '#194c72', icon: 'drop', skill: 'heal', description: 'Hồi 2 sinh lực cho bạn khi được triệu hồi.' },
  nature: { name: 'Mộc', color: '#afe18b', dark: '#2d6246', icon: 'leaf', skill: 'growth', description: 'Hồi 1 sinh lực cho mọi đồng minh khi được triệu hồi.' },
  lightning: { name: 'Lôi', color: '#e5cc75', dark: '#716026', icon: 'bolt', skill: 'swift', description: 'Tốc kích: có thể tấn công ngay trong lượt triệu hồi.' },
  light: { name: 'Quang', color: '#e8dfb9', dark: '#756541', icon: 'sun', skill: 'shield', description: 'Khiên sáng chặn lần sát thương đầu tiên.' },
  shadow: { name: 'Ám', color: '#b7a2ed', dark: '#4c346f', icon: 'moon', skill: 'drain', description: 'Hút hồn: mỗi lần tấn công hồi 1 sinh lực cho bạn.' },
};
export const RARITIES = {
  common: { name: 'Thường', color: '#b5bdb6', rank: 0 },
  rare: { name: 'Hiếm', color: '#75bdf4', rank: 1 },
  epic: { name: 'Sử thi', color: '#c7a0ff', rank: 2 },
  legendary: { name: 'Huyền thoại', color: '#edc57b', rank: 3 },
};
const names = {
  fire: ['Hỏa Hồ', 'Than Tinh', 'Hỏa Lang', 'Thạch Nham', 'Diễm Điểu', 'Xích Xà', 'Lửa Linh', 'Hồ Ly Dung Nham', 'Viêm Long', 'Phượng Hoàng Lửa', 'Hỏa Thần Vệ', 'Xích Long Vương', 'Bạo Long Diệt Thế', 'Phượng Hoàng Bất Diệt'],
  water: ['Thủy Hồ', 'Giọt Ngọc', 'Băng Lang', 'Băng Thạch', 'Lam Điểu', 'Thủy Xà', 'Sóng Linh', 'Hồ Ly Tuyết', 'Hải Long', 'Phượng Hoàng Băng', 'Thủy Thần Vệ', 'Băng Long Vương', 'Thần Long Đại Dương', 'Băng Phượng Vĩnh Cửu'],
  nature: ['Mộc Hồ', 'Mầm Tinh', 'Lâm Lang', 'Cổ Thạch', 'Lục Điểu', 'Mộc Xà', 'Rừng Linh', 'Hồ Ly Ngàn Lá', 'Lục Long', 'Phượng Hoàng Rừng', 'Mộc Thần Vệ', 'Thanh Long Vương', 'Cổ Long Thiên Mộc', 'Linh Hồ Cửu Vĩ'],
  lightning: ['Lôi Hồ', 'Điện Tinh', 'Lôi Lang', 'Lôi Thạch', 'Sấm Điểu', 'Điện Xà', 'Chớp Linh', 'Hồ Ly Sấm Sét', 'Lôi Long', 'Phượng Hoàng Sấm', 'Lôi Thần Vệ', 'Lôi Long Vương', 'Thiên Long Lôi Đình', 'Lôi Điểu Thiên Kiếp'],
  light: ['Quang Hồ', 'Sao Tinh', 'Ngân Lang', 'Quang Thạch', 'Nhật Điểu', 'Ngân Xà', 'Nắng Linh', 'Hồ Ly Ánh Trăng', 'Thánh Long', 'Phượng Hoàng Bình Minh', 'Quang Thần Vệ', 'Bạch Long Vương', 'Thánh Long Thiên Giới', 'Thần Điểu Mặt Trời'],
  shadow: ['Ảnh Hồ', 'Hắc Tinh', 'Ám Lang', 'Hắc Thạch', 'Dạ Điểu', 'Ảnh Xà', 'Đêm Linh', 'Hồ Ly Bóng Đêm', 'Ám Long', 'Phượng Hoàng Bóng Tối', 'Ám Thần Vệ', 'Hắc Long Vương', 'Ma Long Hư Không', 'Dạ Hồ Nguyệt Thực'],
};
const forms = ['fox', 'spirit', 'wolf', 'golem', 'phoenix', 'serpent', 'spirit', 'fox', 'dragon', 'phoenix', 'golem', 'dragon', 'dragon', 'fox'];
export const CARDS = Object.entries(names).flatMap(([element, list], elementIndex) => list.map((name, i) => {
  const cost = i < 4 ? 1 + i % 3 : i < 8 ? 2 + i % 3 : i < 12 ? 4 + i % 2 : 6 + i % 2;
  return { id: `${element}-${i}`, name, element, type: 'creature', rarity: i < 4 ? 'common' : i < 8 ? 'rare' : i < 12 ? 'epic' : 'legendary', cost, attack: cost + (i % 3 === 0 ? 1 : 0), health: cost + 2 + i % 2, form: i === 13 && !['nature', 'shadow'].includes(element) ? 'phoenix' : forms[i], variant: elementIndex * 14 + i, skill: ELEMENTS[element].skill, description: ELEMENTS[element].description };
}));
const spells = [
  ['Bão Lửa', 'fire', 'damage', 3, 'Gây 4 sát thương lên linh thú mạnh nhất của địch, hoặc đối thủ nếu sân trống.'],
  ['Tàn Tro Rực Cháy', 'fire', 'blast', 4, 'Gây 2 sát thương lên toàn bộ linh thú đối phương.'],
  ['Suối Nguồn Sự Sống', 'water', 'heal', 2, 'Hồi 6 sinh lực cho bạn.'],
  ['Phong Ấn Băng Giá', 'water', 'freeze', 2, 'Đóng băng toàn bộ linh thú địch trong lượt tiếp theo.'],
  ['Sức Mạnh Rừng Già', 'nature', 'buff', 3, 'Toàn bộ linh thú đồng minh nhận +1 công và +2 sinh lực.'],
  ['Tiếng Gọi Rừng Xanh', 'nature', 'draw', 2, 'Rút thêm 2 lá bài.'],
  ['Thiên Lôi', 'lightning', 'damage', 3, 'Gây 4 sát thương lên linh thú mạnh nhất của địch, hoặc đối thủ nếu sân trống.'],
  ['Tia Chớp Tri Thức', 'lightning', 'draw', 2, 'Rút thêm 2 lá bài.'],
  ['Kết Giới Thiên Quang', 'light', 'shield', 2, 'Trao khiên chặn sát thương cho toàn bộ linh thú đồng minh.'],
  ['Ánh Sáng Phục Hồi', 'light', 'heal', 2, 'Hồi 6 sinh lực cho bạn.'],
  ['Mưa Bóng Tối', 'shadow', 'blast', 4, 'Gây 2 sát thương lên toàn bộ linh thú đối phương.'],
  ['Khế Ước Hư Không', 'shadow', 'draw', 2, 'Rút thêm 2 lá bài.'],
];
CARDS.push(...spells.map(([name, element, effect, cost, description], i) => ({ id: `spell-${i}`, name, element, type: 'spell', rarity: i % 3 === 0 ? 'epic' : 'rare', cost, effect, description, form: 'rune', variant: 90 + i })));
export const CARD_MAP = Object.fromEntries(CARDS.map(card => [card.id, card]));
export const PACKS = [
  { id: 'origin', name: 'Khởi Nguyên', subtitle: 'Mỗi huyền thoại có một khởi đầu', price: 150, element: 'nature', tag: 'DÀNH CHO MỌI TRIỆU HỒI SƯ', featured: true, guarantee: 'rare' },
  { id: 'inferno', name: 'Hỏa Long Trỗi Dậy', subtitle: 'Đánh thức ngọn lửa bên trong', price: 200, element: 'fire', tag: 'SỨC MẠNH BÙNG NỔ', guarantee: 'rare' },
  { id: 'abyss', name: 'Tiếng Gọi Hư Không', subtitle: 'Sức mạnh từ phía bên kia ánh sáng', price: 200, element: 'shadow', tag: 'BÍ ẨN CHƯA KHAI PHÁ', guarantee: 'rare' },
  { id: 'celestial', name: 'Thiên Giới Vĩnh Hằng', subtitle: 'Nơi những huyền thoại hội tụ', price: 350, element: 'light', tag: 'BẢO ĐẢM 1 THẺ SỬ THI', guarantee: 'epic' },
];
export const STARTER_DECK = ['fire-0', 'fire-0', 'water-0', 'water-0', 'nature-0', 'nature-0', 'lightning-0', 'lightning-0', 'light-1', 'light-1', 'shadow-2', 'shadow-2', 'nature-4', 'nature-4', 'fire-8', 'water-8', 'spell-2', 'spell-2', 'spell-5', 'spell-0'];
export const DEFAULT_CARDS = structuredClone(CARDS);
export const DEFAULT_PACKS = structuredClone(PACKS);
export function applyCatalog(cards, packs) {
  CARDS.splice(0, CARDS.length, ...structuredClone(cards));
  for (const id of Object.keys(CARD_MAP)) delete CARD_MAP[id];
  Object.assign(CARD_MAP, Object.fromEntries(CARDS.map(c => [c.id, c])));
  PACKS.splice(0, PACKS.length, ...structuredClone(packs));
}
export function rollPack(pack, rng = Math.random, catalog = CARDS) {
  const active = catalog.filter(c => c.enabled !== false);
  return Array.from({ length: 5 }, (_, i) => {
    const weights = pack.weights || { legendary: 2.5, epic: 11.5, rare: 30, common: 56 };
    let roll = rng() * 100, rarity = 'common';
    for (const key of ['legendary', 'epic', 'rare', 'common']) { roll -= weights[key]; if (roll < 0) { rarity = key; break; } }
    if (i === 4 && RARITIES[rarity].rank < RARITIES[pack.guarantee].rank) rarity = pack.guarantee;
    let pool = active.filter(c => c.rarity === rarity);
    const bias = pack.elementBias ?? (pack.id === 'origin' ? 0 : 70);
    if (bias > 0 && rng() < bias / 100) { const elemental = pool.filter(c => c.element === pack.element); if (elemental.length) pool = elemental; }
    if (!pool.length) throw new Error('Pack chưa có đủ thẻ theo độ hiếm.');
    return pool[Math.floor(rng() * pool.length)].id;
  });
}
