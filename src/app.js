import { CARDS, CARD_MAP, ELEMENTS, RARITIES, PACKS, STARTER_DECK } from './cards.js';
import { createBattle, playCard, attack, evolve, endTurn, aiStep, botDeck } from './engine.js';
import { freshState, loadState, purchasePack, validateDeck, STORAGE_KEY } from './state.js';
import { icon, creatureArt, packArt } from './art.js';
import { request, authContent, adminContent, adminUserContent } from './online.js';

let state;
try { state = loadState(localStorage); } catch { state = freshState(); }
let page = 'home';
let filters = { search: '', element: 'all', rarity: 'all', owned: 'all', sort: 'number' };
let selectedUnit = null;
let packOpening = null;
let aiRunning = false;
let battleToken = 0;
let handoff = state.battle?.mode === 'local' && state.battle?.winner === null;
let toastTimer;
let lastFocus;
let storageWarning = false;
let audioContext;
let currentUser = null;
let remoteBusy = false;
let authBusy = false;
let displayedResult = null;
const admin = { overview: null, users: [], total: 0, page: 1, search: '', loading: false, error: '', selected: null };
const $ = (selector) => document.querySelector(selector);
const format = n => Number(n).toLocaleString('vi-VN');
const ownedCount = () => Object.keys(state.collection).filter(id => state.collection[id] > 0).length;
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function save() {
  if (currentUser) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { if (!storageWarning) { storageWarning = true; toast('Trình duyệt không cho phép lưu. Tiến trình chỉ giữ trong phiên này.'); } }
}
function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3800);
}
function sound(kind = 'click') {
  if (!state.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const notes = kind === 'reveal' ? [440, 554, 659] : kind === 'win' ? [523, 659, 784, 1046] : kind === 'attack' ? [130, 80] : [370];
    notes.forEach((f, i) => { const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); const t = audioContext.currentTime + i * .09; osc.connect(gain); gain.connect(audioContext.destination); osc.type = kind === 'attack' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(f, t); gain.gain.setValueAtTime(.055, t); gain.gain.exponentialRampToValueAtTime(.001, t + .2); osc.start(t); osc.stop(t + .22); });
  } catch { /* Audio is optional; gameplay remains available. */ }
}
function button(label, action, extra = '', cls = '', glyph = '') {
  return `<button class="button ${cls}" data-action="${action}" ${extra}>${glyph ? icon(glyph) : ''}${label}</button>`;
}
function cardView(id, options = {}) {
  const c = CARD_MAP[id], el = ELEMENTS[c.element], rarity = RARITIES[c.rarity];
  const count = state.collection[id] || 0;
  const tag = options.static ? 'div' : 'button';
  const unit = options.unit;
  const action = options.action || 'detail';
  const label = `${c.name}, ${rarity.name}, ${c.cost} năng lượng. ${c.description}`;
  return `<${tag} class="game-card ${options.unowned ? 'unowned' : ''}" style="--rarity:${rarity.color};--element:${el.color}" ${options.static ? '' : `data-action="${action}" data-id="${id}" ${options.attrs || ''} aria-label="${label}"`} title="${label}">
    <div class="art-frame">${creatureArt(c, '', true)}<span class="card-cost">${c.cost}</span><span class="card-element">${icon(el.icon)}</span></div>
    <div class="card-rarity"><span class="rarity-dot"></span>${unit?.evolved ? 'TIẾN HÓA ✦' : rarity.name.toLocaleUpperCase('vi')}</div>
    <strong class="card-name">${c.name}</strong>
    <div class="card-stats">${c.type === 'creature' ? `<span class="attack">${icon('sword')}${unit?.attack ?? c.attack}</span><span class="health">${icon('heart')}${unit?.hp ?? c.health}</span>` : `<span style="font-size:8px;color:${el.color}">${icon('spark')} PHÉP THUẬT</span>`}${options.hideCount ? '' : `<small class="card-count">${count ? `×${count}` : 'CHƯA CÓ'}</small>`}</div>
  </${tag}>`;
}
function heroCard(id) { return `<div class="hero-card">${creatureArt(CARD_MAP[id], '', true)}<div class="hero-card-title">${CARD_MAP[id].name}</div><div class="hero-card-rarity">✦ HUYỀN THOẠI ✦</div></div>`; }
function render() {
  const names = { home: 'Khám phá', packs: 'Mở túi thẻ', collection: 'Bộ sưu tập', deck: 'Bộ bài của bạn', battle: 'Đấu trường', admin: 'Quản trị' };
  const nav = [['home', 'grid', 'Khám phá'], ['packs', 'pack', 'Mở túi thẻ'], ['collection', 'cards', 'Bộ sưu tập'], ['deck', 'shield', 'Bộ bài của bạn'], ['battle', 'sword', 'Đấu trường']];
  if (currentUser?.role === 'admin') nav.push(['admin', 'users', 'Quản trị']);
  $('#app').innerHTML = `<div class="shell"><div class="mobile-overlay" data-action="close-menu"></div><aside class="sidebar">
    <button class="brand" data-action="nav" data-page="home" aria-label="Linh Thú — trang chủ"><span class="brand-symbol">${icon('bolt')}</span><span><span class="brand-name">LINH THÚ</span><span class="brand-sub">TRADING CARD GAME</span></span></button>
    <div class="nav-label">THẾ GIỚI CỦA BẠN</div><nav class="nav" aria-label="Điều hướng chính">${nav.map(([key, glyph, label]) => `<button class="nav-item ${page === key ? 'active' : ''}" data-action="nav" data-page="${key}" ${page === key ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${key === 'packs' ? '<small>MỚI</small>' : ''}</button>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="season-card"><div>${icon('trophy')} HÀNH TRÌNH KHỞI NGUYÊN</div><p>Mỗi lá bài là một câu chuyện.<br>Huyền thoại của bạn bắt đầu từ đây.</p><button data-action="daily">Quà mỗi ngày ${icon(state.daily === today() ? 'check' : 'gift')}</button></div><div class="utility"><button data-action="help">${icon('help')} Cách chơi</button><button data-action="sound" aria-label="${state.sound ? 'Tắt' : 'Bật'} âm thanh" title="${state.sound ? 'Tắt' : 'Bật'} âm thanh">${icon(state.sound ? 'volume' : 'mute')}</button></div></div>
  </aside><main class="main"><header class="topbar"><div class="breadcrumb"><button class="mobile-menu" data-action="menu" aria-label="Mở điều hướng">${icon('menu')}</button><span>Không gian triệu hồi</span>${icon('chevron')}<strong>${names[page]}</strong></div><div class="account"><button class="balance" data-action="daily" title="Nhận quà vàng mỗi ngày" style="background:none;padding:0">${icon('coin', 'coin-icon')} ${format(state.coins)} <small>VÀNG</small></button><div class="divider"></div>${currentUser ? `<button class="profile profile-button" data-action="account" aria-label="Tài khoản ${escape(currentUser.username)}"><span class="avatar">${icon(currentUser.role === 'admin' ? 'shield' : 'user')}</span><span><strong>${escape(currentUser.displayName)}</strong><small>${currentUser.role === 'admin' ? 'QUẢN TRỊ VIÊN' : `${state.wins} chiến thắng · Cấp ${Math.floor(state.wins / 3) + 1}`}</small></span></button>` : button('Đăng nhập', 'auth', '', 'small secondary', 'user')}</div></header><div class="content">${page === 'home' ? homePage() : page === 'packs' ? packsPage() : page === 'collection' ? collectionPage() : page === 'deck' ? deckPage() : page === 'admin' ? adminPage() : battlePage()}<footer class="footer"><span>© 2026 LINH THÚ · Một thế giới, vô vàn huyền thoại.</span><span>${icon('shield')} ${currentUser ? 'Tiến trình lưu trên máy chủ' : 'Đang chơi khách · Lưu trên thiết bị'}</span></footer></div></main></div>`;
  if (!currentUser && page === 'battle' && state.battle?.winner !== null && state.battle && !state.battle.rewarded) finishBattle();
}
function heading(eyebrow, title, subtitle, action = '') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
function packTiles() {
  return `<div class="packs-grid">${PACKS.map((p, i) => `<article class="pack-tile"><div class="pack-scene" style="--pack-glow:${ELEMENTS[p.element].color}25"><span class="pack-edition">${i === 0 ? 'BỘ THẺ KHỞI ĐẦU' : i === 3 ? 'PHIÊN BẢN ĐẶC BIỆT' : 'BỘ THẺ NGUYÊN TỐ'}</span><span class="pack-count">01 / 2026</span>${packArt(p)}</div><div class="pack-info"><div class="eyebrow">${p.tag}</div><h3>${p.name}</h3><p>${p.subtitle}</p><div class="pack-buy"><span class="price">${icon('coin')}${p.price}</span>${button('Mở pack', 'buy-pack', `data-pack="${p.id}"`, '', 'plus')}</div></div></article>`).join('')}</div>`;
}
function homePage() {
  return `${heading('CHÀO MỪNG ĐẾN VỚI LINH THÚ', 'Hành trình của bạn bắt đầu.', 'Sưu tầm linh thú. Kiến tạo bộ bài. Viết nên huyền thoại.', button('Vào đấu trường', 'nav', 'data-page="battle"', 'secondary', 'sword'))}
  <div class="hero-row"><section class="hero"><div class="hero-copy"><span class="hero-badge"><span></span> SERIES 01 · KỶ NGUYÊN KHỞI NGUYÊN</span><h2>KHAI MỞ<br><em>HUYỀN THOẠI.</em></h2><p>Ẩn sau mỗi lá bài là một sức mạnh chờ được đánh thức. Linh thú nào sẽ chọn bạn?</p>${button('Mở pack đầu tiên', 'buy-pack', 'data-pack="origin"', '', 'spark')}</div><div class="hero-gallery">${heroCard('shadow-12')}${heroCard('light-12')}${heroCard('nature-12')}</div><span class="hero-spark">${icon('spark')}</span></section>
    <aside class="daily-card"><div class="eyebrow">MỘT MÓN QUÀ NHỎ, MỖI NGÀY</div><div class="gift-visual">${icon('gift')}</div><h3>May mắn đang chờ!</h3><p>Nhận 300 vàng miễn phí<br>để tiếp tục hành trình của bạn.</p>${button(state.daily === today() ? 'Đã nhận hôm nay' : 'Nhận quà hôm nay', 'daily', state.daily === today() ? 'disabled' : '', '', state.daily === today() ? 'check' : 'gift')}<small>Không cần nạp tiền. Chỉ cần đam mê.</small></aside></div>
  <div class="stats-strip"><div class="stat"><span class="stat-symbol">${icon('cards')}</span><span><strong>96 thẻ độc đáo</strong><small>Khám phá bộ sưu tập đầu tiên</small></span></div><div class="stat"><span class="stat-symbol">${icon('spark')}</span><span><strong>6 hệ nguyên tố</strong><small>Vô vàn cách kết hợp sức mạnh</small></span></div><div class="stat"><span class="stat-symbol">${icon('sword')}</span><span><strong>Chiến thuật của bạn</strong><small>Mỗi lượt đi, một bước ngoặt</small></span></div></div>
  <section><div class="section-heading"><div><h2>Chọn hành trình của bạn</h2><p>Mỗi pack gồm 5 thẻ. Luôn có ít nhất 1 thẻ Hiếm trở lên.</p></div><button class="text-button" data-action="odds">Tỉ lệ xuất hiện ${icon('arrow')}</button></div>${packTiles()}</section>
  <section class="bottom-banner"><div class="banner-icon">${icon('sword')}</div><div><h3>Bộ bài đã sẵn sàng. Đấu một trận chứ?</h3><p>Bạn có sẵn 20 thẻ khởi đầu. Chiến thắng để nhận thêm vàng!</p></div>${button('Thử sức ngay', 'start-menu', '', 'secondary', 'arrow')}</section>`;
}
function packsPage() { return `${heading('SỨC MẠNH NẰM TRONG TAY BẠN', 'Một pack. Vô vàn khả năng.', 'Mở 5 thẻ ngẫu nhiên, săn tìm linh thú Huyền thoại.', button('Tỉ lệ xuất hiện', 'odds', '', 'secondary', 'help'))}${packTiles()}<div class="stats-strip"><div class="stat"><span class="stat-symbol">${icon('pack')}</span><span><strong>${state.packsOpened} pack đã mở</strong><small>Mỗi lần mở là một bất ngờ</small></span></div><div class="stat"><span class="stat-symbol">${icon('cards')}</span><span><strong>${ownedCount()} / 96 thẻ</strong><small>Bộ sưu tập đang lớn dần</small></span></div><div class="stat"><span class="stat-symbol">${icon('shield')}</span><span><strong>Bảo đảm thẻ Hiếm</strong><small>Thẻ trùng được giữ để xây bộ bài</small></span></div></div><div class="bottom-banner"><span class="banner-icon">${icon('gift')}</span><div><h3>Thêm vàng, thêm cơ hội</h3><p>Quà mỗi ngày +300 vàng. Thắng trận +100, thua trận +40.</p></div>${button('Nhận quà', 'daily', '', 'secondary', 'gift')}</div>`; }
function filterBar(deck = false) { return `<div class="filters"><div class="search-field">${icon('search')}<input id="card-search" type="search" placeholder="Tìm linh thú, phép thuật..." aria-label="Tìm thẻ bài" value="${escape(filters.search)}" autocomplete="off" /></div><select id="rarity-filter" aria-label="Độ hiếm"><option value="all">Mọi độ hiếm</option>${Object.entries(RARITIES).map(([key, r]) => `<option value="${key}" ${filters.rarity === key ? 'selected' : ''}>${r.name}</option>`).join('')}</select>${!deck ? `<select id="owned-filter" aria-label="Quyền sở hữu"><option value="all">Tất cả thẻ</option><option value="owned" ${filters.owned === 'owned' ? 'selected' : ''}>Đã sở hữu</option><option value="missing" ${filters.owned === 'missing' ? 'selected' : ''}>Chưa sở hữu</option></select>` : ''}</div><div class="filter-tabs" role="group" aria-label="Hệ nguyên tố"><button class="filter-tab ${filters.element === 'all' ? 'active' : ''}" data-action="filter-element" data-element="all">Tất cả</button>${Object.entries(ELEMENTS).map(([key, el]) => `<button class="filter-tab ${filters.element === key ? 'active' : ''}" data-action="filter-element" data-element="${key}">${icon(el.icon)}${el.name}</button>`).join('')}</div>`; }
function filteredCards(deck = false) {
  const query = filters.search.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('đ', 'd');
  return CARDS.filter(c => {
    const name = c.name.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('đ', 'd');
    return (!query || name.includes(query)) && (filters.element === 'all' || c.element === filters.element) && (filters.rarity === 'all' || c.rarity === filters.rarity) && (deck ? state.collection[c.id] > 0 : filters.owned === 'all' || (filters.owned === 'owned' ? state.collection[c.id] > 0 : !state.collection[c.id]));
  });
}
function collectionGrid(deck = false) {
  const cards = filteredCards(deck);
  return cards.length ? cards.map(c => cardView(c.id, { unowned: !state.collection[c.id], action: deck ? 'add-deck' : 'detail' })).join('') : `<div class="empty-state">${icon('search')}<h3>Chưa tìm thấy thẻ bài</h3><p>Thử đổi từ khóa hoặc bộ lọc nhé.</p></div>`;
}
function collectionPage() { return `${heading('NHỮNG ĐỒNG ĐỘI CỦA BẠN', 'Bộ sưu tập linh thú', 'Mỗi lá bài, một sức mạnh riêng. Bấm vào thẻ để khám phá.', button('Mở thêm thẻ', 'nav', 'data-page="packs"', '', 'pack'))}${filterBar()}<div class="collection-summary"><span>${ownedCount()} / 96 thẻ đã khám phá</span><div class="progress-track"><span style="width:${ownedCount() / 96 * 100}%"></span></div><span id="filter-count">${filteredCards().length} kết quả</span></div><div class="collection-grid" id="collection-grid">${collectionGrid()}</div>`; }
function deckPanel() {
  const counts = {}; state.deck.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => CARD_MAP[a[0]].cost - CARD_MAP[b[0]].cost);
  return `<aside class="deck-panel"><h3>Bộ bài chiến đấu <span>${state.deck.length}/20</span></h3><p>Tối đa 2 bản sao mỗi thẻ. Bấm thẻ bên trái để thêm.</p><div class="deck-curve"><div class="mana-curve" aria-label="Phân bố năng lượng">${Array.from({ length: 7 }, (_, i) => { const n = state.deck.filter(id => CARD_MAP[id].cost === i + 1).length; return `<div class="mana-column" data-cost="${i + 1}" style="height:${Math.max(3, n * 5)}px" title="${i + 1} năng lượng: ${n} thẻ"></div>`; }).join('')}</div></div><div class="deck-list">${entries.map(([id, n]) => `<div class="deck-row" style="--element:${ELEMENTS[CARD_MAP[id].element].color}"><strong>${CARD_MAP[id].cost}</strong><span>${CARD_MAP[id].name}</span><small>×${n}</small><button data-action="remove-deck" data-id="${id}" aria-label="Bỏ một ${CARD_MAP[id].name}">${icon('minus')}</button></div>`).join('') || '<p>Bộ bài đang trống. Chọn linh thú bên trái!</p>'}</div>${state.deck.length !== 20 ? `<p class="deck-full">Cần thêm ${20 - state.deck.length} thẻ để vào đấu trường.</p>` : ''}${button('Sẵn sàng chiến đấu', 'start-menu', validateDeck(state.deck, state.collection) ? '' : 'disabled', '', 'sword')}<button class="text-button" style="margin:13px auto 0" data-action="reset-deck">${icon('refresh')} Khôi phục bộ bài khởi đầu</button></aside>`;
}
function deckPage() { return `${heading('CHIẾN THUẬT BẮT ĐẦU TỪ ĐÂY', 'Bộ bài của bạn', 'Kết hợp linh thú và phép thuật để tạo nên lối chơi riêng.')}<div class="deck-layout"><section>${filterBar(true)}<div class="collection-summary">${icon('plus')} Bấm vào một thẻ để thêm vào bộ bài.</div><div class="collection-grid" id="collection-grid">${collectionGrid(true)}</div></section>${deckPanel()}</div>`; }
function battlePage() {
  const b = state.battle;
  if (!b) return `${heading('NƠI HUYỀN THOẠI ĐƯỢC VIẾT NÊN', 'Đấu trường linh thú', 'Triệu hồi. Tiến hóa. Làm chủ cuộc đấu.', button('Luật chiến đấu', 'help', '', 'secondary', 'help'))}<div class="battle-welcome"><div><div class="eyebrow">ĐẤU TRÍ TRONG TỪNG LÁ BÀI</div><h2>Sức mạnh là khởi đầu.<br>Chiến thuật là tất cả.</h2><p>Đưa bộ bài 20 thẻ của bạn vào đấu trường. Triệu hồi linh thú, sử dụng phép và tiến hóa để giành chiến thắng.</p><div class="actions">${button('Tìm trận đấu', 'start-menu', '', '', 'sword')}${button('Chỉnh bộ bài', 'nav', 'data-page="deck"', 'secondary', 'cards')}</div></div><div class="welcome-art">${heroCard('fire-12')}${heroCard('water-12')}</div></div><div class="battle-options"><div>${icon('bot')}<h3>Thử thách người gác đền</h3><p>Đấu với máy, luyện chiến thuật và nhận vàng sau mỗi trận.</p></div><div>${icon('users')}<h3>Cùng bạn bè so tài</h3><p>Hai người chơi luân phiên trên cùng thiết bị. Tay bài được giữ kín.</p></div><div>${icon('spark')}<h3>Tiến hóa sức mạnh</h3><p>Dùng 2 năng lượng để tiến hóa: +2 tấn công, +3 sinh lực.</p></div></div>`;
  const side = b.mode === 'local' ? b.turn : 0; const own = b.players[side]; const enemy = b.players[1 - side];
  const myTurn = b.turn === side && b.winner === null && !handoff && !remoteBusy;
  const ownName = b.mode === 'ai' ? 'Bạn' : `Người chơi ${side + 1}`;
  const enemyName = b.mode === 'ai' ? 'Người gác đền' : `Người chơi ${2 - side}`;
  const selected = own.board.find(c => c.uid === selectedUnit);
  const activeText = b.winner !== null ? 'Trận đấu đã kết thúc' : handoff ? 'Chờ người chơi tiếp theo…' : myTurn ? selected ? 'Chọn linh thú địch hoặc chân dung đối thủ để tấn công.' : 'Lượt của bạn · Chọn thẻ để triệu hồi hoặc linh thú để tấn công.' : 'Người gác đền đang tính toán…';
  return `<div class="page-heading battle-heading"><div><div class="eyebrow">${icon('sword')} ${b.mode === 'ai' ? 'ĐẤU VỚI MÁY' : 'HAI NGƯỜI CÙNG THIẾT BỊ'}</div><h1>Đấu trường Khởi Nguyên</h1><p>Lượt ${b.round} · Đánh bại đối thủ để nhận vàng.</p></div><div class="battle-toolbar">${button('<span>Cách chơi</span>', 'help', 'aria-label="Cách chơi"', 'secondary', 'help')}${button('<span>Đầu hàng</span>', 'surrender', `aria-label="Đầu hàng" ${b.winner !== null ? 'disabled' : ''}`, 'danger', 'flag')}</div></div>
  <div class="battle-layout"><section class="arena ${handoff ? 'turn-shield' : ''}" aria-label="Sân đấu">${heroBar(enemy, enemyName, true, !!selected && enemy.board.length === 0 && myTurn)}
    <div class="opponent-hand" aria-label="Đối thủ có ${enemy.hand.length} thẻ">${enemy.hand.map((_, i) => `<span class="mini-back" style="--angle:${(i - enemy.hand.length / 2) * 3}deg">✦</span>`).join('')}</div>
    ${boardRow(enemy.board, false, myTurn && !!selected)}<div class="arena-divider">${icon('spark')} LINH THÚ ARENA ${icon('spark')}</div>${boardRow(own.board, true, false, myTurn)}
    ${selected && myTurn ? `<div class="selection-bar"><span>${CARD_MAP[selected.cardId].name}${selected.ready ? ' · Chọn mục tiêu để tấn công' : ' · Đã hành động / đang chờ lượt'}</span>${button('Tiến hóa · 2', 'evolve', `data-uid="${selected.uid}" ${selected.evolved || own.energy < 2 ? 'disabled' : ''}`, 'secondary', 'spark')}${button('Bỏ chọn', 'deselect', '', 'secondary')}</div>` : ''}
    ${heroBar(own, ownName, false)}<div class="turn-label"><span>${activeText}</span>${button(b.winner !== null ? 'Trận mới' : 'Kết thúc lượt', b.winner !== null ? 'start-menu' : 'end-turn', !myTurn && b.winner === null ? 'disabled' : '', '', b.winner !== null ? 'refresh' : 'arrow')}</div>
    <div class="hand" aria-label="Bài trên tay">${own.hand.map((id, i) => { const c = CARD_MAP[id]; const playable = myTurn && own.energy >= c.cost && (c.type === 'spell' || own.board.length < 4); return `<div class="hand-card ${playable ? 'playable' : 'unplayable'}">${cardView(id, { action: 'play-card', attrs: `data-index="${i}"`, hideCount: true })}<div class="hand-caption">${c.type === 'spell' ? 'DÙNG PHÉP' : 'TRIỆU HỒI'} · ${c.cost} NĂNG LƯỢNG</div></div>`; }).join('') || '<p style="font-size:11px;color:var(--muted)">Tay bài trống. Kết thúc lượt để rút thêm thẻ.</p>'}</div></section>
    <aside class="battle-side"><div class="battle-meta"><div class="eyebrow">${icon('shield')} TỔNG QUAN TRẬN ĐẤU</div><h3>${own.deck.length} thẻ trong bộ bài</h3><p>Đối thủ còn ${enemy.deck.length} thẻ.<br>Tiến hóa: 2 năng lượng / linh thú.<br>Tối đa 4 linh thú trên sân.</p></div><div class="battle-meta battle-log" aria-live="polite"><h3>${icon('cards')} Nhật ký chiến đấu</h3>${b.log.slice(0, 12).map(line => `<div class="log-entry">${escape(line)}</div>`).join('')}</div><div class="battle-help">${icon('help')} Thú mới triệu hồi cần chờ một lượt. Hệ Lôi có thể tấn công ngay. Đánh bại thú phòng thủ trước khi tấn công đối thủ.</div></aside></div>`;
}
function heroBar(p, name, enemy, target = false) {
  return `<div class="hero-bar ${enemy ? 'enemy' : 'player'} ${target ? 'targetable' : ''}" ${target ? 'style="outline:2px dashed #d79b84;cursor:crosshair" data-action="attack-hero" role="button" tabindex="0" aria-label="Tấn công đối thủ"' : ''}><span class="hero-face">${icon(enemy ? 'bot' : 'user')}</span><div class="hero-info"><strong>${name}</strong><small>${enemy ? 'NGƯỜI THÁCH ĐẤU' : 'NHÀ TRIỆU HỒI'}</small><div class="hp-track"><span style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></span></div></div><span class="hp-value">${icon('heart')}${p.hp}<small>/${p.maxHp}</small></span><div class="energy" aria-label="${p.energy} trên ${p.maxEnergy} năng lượng">${Array.from({ length: p.maxEnergy }, (_, i) => `<i class="energy-gem ${i < p.energy ? 'full' : ''}"></i>`).join('')}<span>${p.energy}/${p.maxEnergy} ${icon('bolt')}</span></div></div>`;
}
function boardRow(units, own, targetable, myTurn = false) {
  return `<div class="board-row ${own ? 'own-board' : 'enemy-board'}">${Array.from({ length: 4 }, (_, i) => {
    const u = units[i];
    if (!u) return `<div class="slot" aria-label="Ô triệu hồi trống">${icon('spark')}</div>`;
    return `<div class="unit ${u.ready && own && myTurn ? 'ready' : ''} ${u.uid === selectedUnit && own ? 'selected' : ''} ${targetable ? 'targetable' : ''}" data-unit="${u.uid}">${cardView(u.cardId, { unit: u, action: own ? 'select-unit' : 'attack-unit', attrs: `data-uid="${u.uid}"`, hideCount: true })}<span class="unit-status">${u.shield ? icon('shield') : ''}${u.frozen ? '❄' : ''}${u.evolved ? '✦' : ''}${!u.ready && own ? 'ZZ' : ''}</span></div>`;
  }).join('')}</div>`;
}
function showModal(content, cls = '') {
  lastFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="Thông tin trò chơi"><button class="modal-close" data-action="close-modal" aria-label="Đóng">${icon('close')}</button>${content}</section></div>`;
  document.body.style.overflow = 'hidden';
  $('.modal [data-action]')?.focus();
}
function closeModal() {
  if (handoff && $('.pass-screen')) return;
  $('#modal-root').innerHTML = ''; document.body.style.overflow = ''; packOpening = null;
  if (lastFocus?.isConnected) lastFocus.focus();
}
function helpModal() {
  showModal(`<div class="eyebrow">CẨM NANG TRIỆU HỒI SƯ</div><h2>Mỗi lá bài, một nước đi.</h2><p>Đưa sinh lực đối thủ từ 24 về 0 để giành chiến thắng.</p><ol class="rules"><li><strong>Xây bộ bài:</strong> chọn đúng 20 thẻ đã sở hữu, tối đa 2 bản sao mỗi loại. Bạn đã có sẵn bộ khởi đầu.</li><li><strong>Triệu hồi & dùng phép:</strong> bấm thẻ trên tay để dùng. Tiêu hao năng lượng bằng con số trên thẻ. Mỗi lượt được hồi đầy và tăng 1 năng lượng, tối đa 10.</li><li><strong>Tấn công:</strong> chọn thú của bạn, rồi chọn thú địch. Hai thú gây sát thương đồng thời. Khi sân địch trống, bấm thanh sinh lực đối thủ.</li><li><strong>Tiến hóa:</strong> chọn thú rồi bấm Tiến hóa. Tốn 2 năng lượng, nhận +2 công và +3 sinh lực; mỗi thú một lần.</li><li><strong>Kỹ năng hệ:</strong> Hỏa gây sát thương khi gọi · Thủy hồi máu · Mộc hồi thú · Lôi tốc kích · Quang có khiên · Ám hút máu.</li><li><strong>Giới hạn:</strong> 4 thú trên sân, 9 thẻ trên tay. Cạn bộ bài sẽ mất sinh lực tăng dần mỗi lượt. Thú mới cần đợi lượt tiếp theo (trừ Lôi).</li><li><strong>Phần thưởng:</strong> thắng +100 vàng, thua +40, hai người +60. Mở pack để mở rộng bộ sưu tập. ${currentUser ? 'Tiến trình lưu trên máy chủ.' : 'Tiến trình khách lưu trên trình duyệt này.'}</li></ol>${button('Đã hiểu, vào game!', 'close-modal', '', '', 'check')}`);
}
function detailModal(id) {
  const c = CARD_MAP[id];
  showModal(`<div class="card-detail">${cardView(id, { static: true })}<div><div class="eyebrow" style="color:${RARITIES[c.rarity].color}">${RARITIES[c.rarity].name} · HỆ ${ELEMENTS[c.element].name}</div><h2>${c.name}</h2><p>${c.type === 'creature' ? 'LINH THÚ' : 'PHÉP THUẬT'} · ${c.cost} năng lượng</p><div class="description">${c.description}</div><p>Đã sở hữu: ${state.collection[id] || 0}<br>Trong bộ bài: ${state.deck.filter(x => x === id).length} / 2</p>${state.collection[id] ? button('Thêm vào bộ bài', 'add-deck', `data-id="${id}"`, '', 'plus') : button('Khám phá trong pack', 'go-packs', '', '', 'pack')}</div></div>`);
}
async function buyPack(id) {
  const ids = currentUser ? (await onlineMutation('/api/game/pack', { packId: id })).cards : purchasePack(state, id); save(); sound('reveal'); render();
  packOpening = { id, ids, revealed: new Set() };
  showPack();
}
function showPack() {
  const p = PACKS.find(p => p.id === packOpening.id);
  showModal(`<div class="eyebrow">${icon('spark')} KHOẢNH KHẮC CỦA BẠN</div><h2>${p.name}</h2><p>Bấm từng lá để hé lộ linh thú. Cả 5 thẻ đã được lưu vào bộ sưu tập.</p><div class="reveal-row">${packOpening.ids.map((id, i) => `<button class="reveal-card ${CARD_MAP[id].rarity}" data-action="flip-card" data-index="${i}" aria-label="Lật thẻ thứ ${i + 1}"><div class="reveal-card-inner"><div class="card-back">${icon('bolt')}<strong>LINH THÚ</strong><small>CHẠM ĐỂ KHÁM PHÁ</small></div><div class="card-front">${cardView(id, { static: true })}</div></div></button>`).join('')}</div><div class="actions">${button('Lật tất cả', 'flip-all', '', '', 'spark')}${button(`Mở tiếp · ${p.price} vàng`, 'buy-pack', `data-pack="${p.id}" ${state.coins < p.price ? 'disabled' : ''}`, 'secondary', 'pack')}${button('Về bộ sưu tập', 'go-collection', '', 'secondary', 'arrow')}</div>`, 'pack-modal');
}
function flipCard(i) {
  if (!packOpening || packOpening.revealed.has(i)) return;
  packOpening.revealed.add(i);
  const c = CARD_MAP[packOpening.ids[i]];
  const node = $(`.reveal-card[data-index="${i}"]`);
  node?.classList.add('flipped'); node?.setAttribute('aria-label', `${c.name}, ${RARITIES[c.rarity].name}`);
  sound('reveal'); if (c.rarity === 'legendary' || c.rarity === 'epic') confetti(c.rarity === 'legendary' ? '#edc57b' : '#c7a0ff');
  if (packOpening.revealed.size === 5) { const all = $('[data-action="flip-all"]'); if (all) { all.disabled = true; all.innerHTML = `${icon('check')} Đã lật 5 thẻ`; } }
}
function confetti(color = '#b4eb92') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 25; i++) { const el = document.createElement('i'); el.className = 'particle'; el.style.cssText = `--c:${color};--x:${40 + Math.random() * 20}vw;--y:45vh;--dx:${(Math.random() - .5) * 650}px;--dy:${(Math.random() - .3) * 450}px`; document.body.append(el); setTimeout(() => el.remove(), 1800); }
}
function battleFx(kind, element, label, targetUid) {
  if (page !== 'battle' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const arena = $('.arena'); if (!arena) return;
  const target = targetUid ? $(`[data-unit="${targetUid}"]`) : $('.hero-bar.enemy');
  const base = arena.getBoundingClientRect(); const box = target?.getBoundingClientRect();
  const x = box ? box.x + box.width / 2 - base.x : base.width / 2;
  const y = box ? box.y + box.height / 2 - base.y : base.height * .25;
  const node = document.createElement('div'); node.className = `battle-fx ${kind}`;
  node.style.cssText = `--fx-color:${ELEMENTS[element]?.color || '#b4eb92'};left:${x}px;top:${y}px`;
  node.innerHTML = `<i class="fx-ring"></i><i class="fx-ring ring-two"></i><i class="fx-slash"></i><span>${escape(label)}</span>`;
  arena.append(node); setTimeout(() => node.remove(), 1200);
}
async function addToDeck(id) {
  const inDeck = state.deck.filter(x => x === id).length;
  if (state.deck.length >= 20) throw new Error('Bộ bài đã đủ 20 thẻ. Hãy bỏ một thẻ trong mục Bộ bài trước.');
  if (inDeck >= 2) throw new Error('Mỗi bộ bài chỉ được tối đa 2 bản sao một thẻ.');
  if ((state.collection[id] || 0) <= inDeck) throw new Error('Bạn chưa sở hữu thêm bản sao của thẻ này.');
  if (currentUser) await onlineMutation('/api/game/deck', { deck: [...state.deck, id] }); else state.deck.push(id);
  save(); sound(); render(); toast(`Đã thêm ${CARD_MAP[id].name} (${state.deck.length}/20).`);
  if ($('.card-detail')) detailModal(id);
}
function startMenu() {
  if (!validateDeck(state.deck, state.collection)) { toast('Bộ bài cần đúng 20 thẻ, tối đa 2 bản sao mỗi loại.'); go('deck'); return; }
  if (state.battle?.winner === null) { showModal(`<div class="eyebrow">TRẬN ĐẤU ĐANG DIỄN RA</div><h2>Trở lại đấu trường?</h2><p>Bạn có một trận đang chơi. Bắt đầu trận mới sẽ kết thúc trận hiện tại và không nhận thưởng.</p><div class="actions">${button('Tiếp tục trận đấu', 'resume-battle', '', '', 'sword')}${button('Chọn trận mới', 'choose-mode', '', 'secondary')}</div>`); return; }
  chooseMode();
}
function chooseMode() {
  showModal(`<div class="eyebrow">ĐẤU TRƯỜNG KHỞI NGUYÊN</div><h2>Chọn đối thủ của bạn</h2><p>Bộ bài 20 thẻ của bạn đã sẵn sàng. Mỗi trận là một khởi đầu mới.</p><div class="mode-options"><button class="mode-card" data-action="new-battle" data-mode="ai">${icon('bot')}<strong>Đấu với máy</strong><p>Thách đấu Người gác đền.<br>Thắng +100 vàng · Thua +40 vàng.</p></button><button class="mode-card" data-action="new-battle" data-mode="local">${icon('users')}<strong>Đấu cùng bạn bè</strong><p>2 người luân phiên cùng thiết bị.<br>Người 2 dùng bộ khởi đầu. +60 vàng/trận.</p></button></div><p style="font-size:10px;margin-top:19px">Chế độ bạn bè chơi tại chỗ, không cần tài khoản hay kết nối mạng.</p>`);
}
async function newBattle(mode) {
  if (remoteBusy) throw new Error('Vui lòng đợi lượt đấu hiện tại được lưu xong.');
  battleToken++; aiRunning = false; handoff = false; closeModal(); selectedUnit = null;
  if (currentUser) await onlineMutation('/api/game/battle/start', { mode });
  else state.battle = createBattle(state.deck, mode === 'ai' ? botDeck() : STARTER_DECK, mode);
  displayedResult = null; save(); page = 'battle'; render(); sound();
  if (mode === 'local') { handoff = true; render(); showHandoff(); }
}
function showHandoff() {
  showModal(`<div class="pass-screen">${icon('users')}<div class="eyebrow" style="justify-content:center">CHUYỂN THIẾT BỊ CHO BẠN BÈ</div><h2>Lượt của người chơi ${state.battle.turn + 1}</h2><p>Người còn lại hãy quay đi để giữ bí mật tay bài.<br>Bấm sẵn sàng khi bạn đã nhận thiết bị.</p>${button('Tôi đã sẵn sàng', 'accept-turn', '', '', 'sword')}</div>`);
  $('.modal-close').hidden = true; $('[data-action="accept-turn"]').focus();
}
function ownSide() { return state.battle.mode === 'local' ? state.battle.turn : 0; }
function requireTurn() {
  if (remoteBusy || !state.battle || handoff || (state.battle.mode === 'ai' && state.battle.turn !== 0)) throw new Error('Đợi đến lượt của bạn nhé.');
  return ownSide();
}
function afterAction(fx, uid) {
  save(); render();
  if (uid) $(`[data-unit="${uid}"]`)?.classList.add(fx || 'hit');
  if (state.battle.winner !== null) finishBattle();
}
async function runAi() {
  if (currentUser) return;
  if (aiRunning || !state.battle || state.battle.mode !== 'ai' || state.battle.turn !== 1 || state.battle.winner !== null) return;
  aiRunning = true; const token = battleToken;
  try {
    while (token === battleToken && state.battle?.turn === 1 && state.battle.winner === null) {
      await delay(650);
      if (token !== battleToken || !state.battle || state.battle.winner !== null) break;
      const action = aiStep(state.battle); save();
      if (page === 'battle') {
        render();
        if (action.type === 'attack') { sound('attack'); if (action.target) $(`[data-unit="${action.target}"]`)?.classList.add('hit'); battleFx('strike', 'shadow', 'TẤN CÔNG', action.target); }
        else if (action.type === 'play') { sound(); const last = state.battle.players[1].board.at(-1); if (last) $(`[data-unit="${last.uid}"]`)?.classList.add('summoned'); battleFx(action.card.type === 'spell' ? 'spell' : 'summon', action.card.element, action.card.type === 'spell' ? action.card.name : 'TRIỆU HỒI', last?.uid); }
        else if (action.type === 'evolve') battleFx('evolution', 'nature', 'TIẾN HÓA', action.uid);
      }
      if (state.battle.winner !== null) { finishBattle(); break; }
    }
  } catch (error) { toast(`Lượt máy gặp lỗi: ${error.message}`); }
  finally { if (token === battleToken) aiRunning = false; }
}
function finishBattle() {
  const b = state.battle; if (!b || b.winner === null || (!currentUser && b.rewarded)) return;
  if (currentUser) { if (displayedResult === b.id) return; displayedResult = b.id; }
  const win = b.winner === 0; const draw = b.winner === 'draw';
  const reward = b.mode === 'local' ? 60 : win ? 100 : 40;
  if (!currentUser) { b.rewarded = true; state.matches++; state.coins += reward; if (win && b.mode === 'ai') state.wins++; save(); }
  if (page !== 'battle') { toast(`Trận đấu kết thúc. Bạn nhận ${reward} vàng!`); return; }
  const title = draw ? 'Trận đấu hòa!' : b.mode === 'local' ? `Người chơi ${b.winner + 1} chiến thắng!` : win ? 'Chiến thắng rực rỡ!' : 'Một bài học đáng giá.';
  showModal(`<div class="battle-result"><div class="result-icon">${icon(win || b.mode === 'local' ? 'trophy' : 'shield')}</div><div class="eyebrow" style="justify-content:center">ĐẤU TRƯỜNG KHỞI NGUYÊN</div><h2>${title}</h2><p>${win ? 'Linh thú của bạn đã viết nên một huyền thoại mới.' : 'Mỗi trận đấu là một bước tiến trên hành trình của bạn.'}</p><div class="price">${icon('coin')} +${reward} vàng</div><p>Trận đấu kết thúc ở lượt ${b.round}. Phần thưởng đã được lưu.</p><div class="actions">${button('Chơi trận mới', 'choose-mode', '', '', 'sword')}${button('Mở pack', 'go-packs', '', 'secondary', 'pack')}</div></div>`);
  if (win || b.mode === 'local') { confetti(); sound('win'); }
  const bal = $('.balance'); if (bal) bal.innerHTML = `${icon('coin', 'coin-icon')} ${format(state.coins)} <small>VÀNG</small>`;
}
function guestSession() {
  battleToken++; aiRunning = false; remoteBusy = false; handoff = false; currentUser = null; selectedUnit = null;
  try { state = loadState(localStorage); } catch { state = freshState(); }
  admin.overview = null; admin.users = []; admin.selected = null;
  closeModal(); page = 'home'; render();
}
async function apiCall(route, data) {
  try { return await request(route, data); }
  catch (error) { if (error.status === 401 && currentUser) { guestSession(); toast('Phiên đăng nhập đã kết thúc hoặc tài khoản bị khóa.'); } throw error; }
}
async function onlineMutation(route, data) {
  if (remoteBusy) throw new Error('Đang lưu dữ liệu. Vui lòng đợi một chút.');
  remoteBusy = true;
  try { const result = await apiCall(route, data); currentUser = result.user; state = result.profile; return result; }
  finally { remoteBusy = false; }
}
async function onlineBattle(payload) {
  if (remoteBusy) throw new Error('Đang xử lý lượt đấu. Vui lòng đợi một chút.');
  const token = battleToken, oldWinner = state.battle?.winner;
  const battleId = state.battle?.id, revision = state.battle?.revision; let completed = false; remoteBusy = true; selectedUnit = null; render();
  try {
    const result = await apiCall('/api/game/battle/action', { ...payload, battleId, revision });
    if (token !== battleToken || !currentUser) return;
    if (payload.type === 'end' && result.frames.length > 1) {
      for (const frame of result.frames) {
        if (token !== battleToken || !currentUser) return;
        state = { ...result.profile, battle: frame };
        if (page === 'battle') { render(); sound(); }
        await delay(400);
      }
    }
    if (token !== battleToken || !currentUser) return;
    currentUser = result.user; state = result.profile; remoteBusy = false;
    completed = true;
    if (payload.type === 'end' && state.battle.mode === 'local' && state.battle.winner === null) handoff = true;
    render(); sound(payload.type === 'attack' ? 'attack' : 'click');
    if (handoff && page === 'battle') showHandoff();
    if (state.battle.winner !== null && oldWinner === null) finishBattle();
    else if (page === 'battle') battleFx(payload.type === 'attack' ? 'strike' : payload.type === 'evolve' ? 'evolution' : 'summon', 'nature', payload.type === 'attack' ? 'TẤN CÔNG' : payload.type === 'evolve' ? 'TIẾN HÓA' : '', payload.target || payload.uid);
  } catch (error) {
    if (currentUser) { try { const result = await request('/api/me'); state = result.profile; } catch {} }
    throw error;
  } finally { if (token === battleToken) { remoteBusy = false; if (!completed && page === 'battle') render(); } }
}
function adminPage() {
  if (currentUser?.role !== 'admin') return `<div class="empty-state">${icon('shield')}<h3>Khu vực quản trị</h3><p>Đăng nhập bằng tài khoản quản trị để truy cập.</p>${button('Đăng nhập', 'auth')}</div>`;
  return adminContent(admin);
}
let adminLoad = 0;
async function loadAdmin() {
  if (currentUser?.role !== 'admin') return;
  const sequence = ++adminLoad; admin.loading = true; admin.error = '';
  if (page === 'admin') render();
  try {
    const results = await Promise.all([apiCall('/api/admin/overview'), apiCall(`/api/admin/users?search=${encodeURIComponent(admin.search)}&page=${admin.page}`)]);
    if (sequence !== adminLoad || currentUser?.role !== 'admin') return;
    admin.overview = results[0]; Object.assign(admin, results[1]);
  } catch (error) { admin.error = error.message; }
  finally { if (sequence === adminLoad) { admin.loading = false; if (page === 'admin') render(); } }
}
async function openAdminUser(id) {
  admin.selected = await apiCall(`/api/admin/users/${id}`);
  showModal(adminUserContent(admin.selected, currentUser.id), 'admin-user-modal');
}
async function adminMutation(id, operation, data) {
  if (remoteBusy) throw new Error('Đang lưu thao tác quản trị. Vui lòng đợi.');
  remoteBusy = true;
  try {
    const account = await apiCall(`/api/admin/users/${id}/${operation}`, data);
    if (id === currentUser.id) {
      state = account.profile;
      if (operation === 'reset' || operation === 'cancel-battle') { battleToken++; aiRunning = false; handoff = false; }
    }
    admin.selected = account;
    await loadAdmin(); showModal(adminUserContent(account, currentUser.id), 'admin-user-modal'); sound(); toast('Đã cập nhật và ghi nhật ký quản trị.');
  } finally { remoteBusy = false; }
}
async function refreshSession() {
  if (remoteBusy || aiRunning || document.hidden || authBusy) return;
  try {
    const result = await request('/api/me');
    const changed = !currentUser || JSON.stringify(result.profile) !== JSON.stringify(state) || result.user.role !== currentUser.role;
    if (!currentUser) { battleToken++; aiRunning = false; handoff = result.profile.battle?.mode === 'local' && result.profile.battle.winner === null; }
    currentUser = result.user;
    if (changed) { state = result.profile; if (!state.battle) { handoff = false; selectedUnit = null; } render(); }
  } catch (error) { if (error.status === 401 && currentUser) { guestSession(); toast('Phiên đăng nhập đã kết thúc hoặc tài khoản bị khóa.'); } }
}
function go(next) {
  page = next; selectedUnit = null; filters = { search: '', element: 'all', rarity: 'all', owned: 'all', sort: 'number' }; render(); window.scrollTo(0, 0);
  if (page === 'battle' && handoff) showHandoff();
  if (page === 'battle') runAi();
  if (page === 'admin' && currentUser?.role === 'admin') loadAdmin();
}

document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
  const action = target.dataset.action;
  try {
    if (currentUser) {
      let payload;
      if (action === 'play-card') { requireTurn(); payload = { type: 'play', index: Number(target.dataset.index) }; }
      if (action === 'evolve') { requireTurn(); payload = { type: 'evolve', uid: Number(target.dataset.uid) }; }
      if (action === 'attack-unit' && selectedUnit) { requireTurn(); payload = { type: 'attack', uid: selectedUnit, target: Number(target.dataset.uid) }; }
      if (action === 'attack-hero' && selectedUnit) { requireTurn(); payload = { type: 'attack', uid: selectedUnit, target: null }; }
      if (action === 'end-turn') { requireTurn(); payload = { type: 'end' }; }
      if (action === 'confirm-surrender') { payload = { type: 'surrender' }; closeModal(); }
      if (payload) { await onlineBattle(payload); return; }
    }
    switch (action) {
      case 'auth': showModal(authContent()); break;
      case 'auth-tab': if (!authBusy) showModal(authContent(target.dataset.mode === 'register')); break;
      case 'account': showModal(`<div class="eyebrow">TÀI KHOẢN CỦA BẠN</div><h2>${escape(currentUser.displayName)}</h2><p>@${escape(currentUser.username)} · ${currentUser.role === 'admin' ? 'Quản trị viên' : 'Người chơi'}<br>Tiến trình được lưu trên máy chủ.</p><div class="actions">${currentUser.role === 'admin' ? button('Vào trang quản trị', 'open-admin', '', '', 'shield') : ''}${button('Đăng xuất', 'logout', remoteBusy ? 'disabled' : '', 'secondary')}</div>`); break;
      case 'open-admin': closeModal(); go('admin'); break;
      case 'logout': if (!remoteBusy) { await apiCall('/api/auth/logout', {}); guestSession(); toast('Đã đăng xuất. Bạn đang chơi ở chế độ khách.'); } break;
      case 'admin-refresh': await loadAdmin(); break;
      case 'admin-page': admin.page = Number(target.dataset.page); await loadAdmin(); break;
      case 'admin-user': await openAdminUser(target.dataset.id); break;
      case 'admin-confirm': {
        const operation = target.dataset.operation, id = target.dataset.id;
        const label = operation === 'ban' ? admin.selected.user.banned ? 'Mở khóa tài khoản' : 'Khóa tài khoản' : operation === 'reset' ? 'Đặt lại tiến trình' : 'Hủy trận hiện tại';
        showModal(`<div class="eyebrow">XÁC NHẬN THAO TÁC QUẢN TRỊ</div><h2>${label}?</h2><p>Áp dụng cho <strong>@${escape(admin.selected.user.username)}</strong>. ${operation === 'reset' ? 'Vàng, thẻ, bộ bài và trận đấu sẽ trở về trạng thái khởi đầu.' : operation === 'ban' ? 'Trạng thái tài khoản sẽ thay đổi ngay trên mọi thiết bị.' : 'Trận đấu sẽ kết thúc mà không trao phần thưởng.'}</p><div class="actions">${button(label, 'admin-execute', `data-operation="${operation}" data-id="${id}"`, 'danger')}${button('Hủy', 'close-modal', '', 'secondary')}</div>`); break;
      }
      case 'admin-execute': await adminMutation(target.dataset.id, target.dataset.operation, target.dataset.operation === 'ban' ? { banned: !admin.selected.user.banned } : {}); break;
      case 'nav': go(target.dataset.page); break;
      case 'menu': $('.sidebar').classList.add('open'); $('.mobile-overlay').classList.add('open'); break;
      case 'close-menu': $('.sidebar').classList.remove('open'); $('.mobile-overlay').classList.remove('open'); break;
      case 'close-modal': closeModal(); break;
      case 'help': helpModal(); break;
      case 'sound': if (currentUser) await onlineMutation('/api/game/preferences', { sound: !state.sound }); else state.sound = !state.sound; save(); render(); sound(); toast(state.sound ? 'Đã bật âm thanh.' : 'Đã tắt âm thanh.'); break;
      case 'daily':
        if (currentUser) { await onlineMutation('/api/game/daily', {}); render(); sound('win'); toast('Đã nhận 300 vàng và lưu vào tài khoản.'); break; }
        if (state.daily === today()) { toast('Bạn đã nhận quà hôm nay. Hẹn gặp lại ngày mai!'); break; }
        state.coins += 300; state.daily = today(); save(); render(); sound('win'); toast('Đã nhận 300 vàng. Chúc bạn mở được thẻ Huyền thoại!'); break;
      case 'buy-pack': await buyPack(target.dataset.pack); break;
      case 'flip-card': flipCard(Number(target.dataset.index)); break;
      case 'flip-all': { const opening = packOpening; for (let i = 0; i < 5; i++) { if (!opening || packOpening !== opening) break; flipCard(i); await delay(110); } break; }
      case 'go-collection': closeModal(); go('collection'); break;
      case 'go-packs': closeModal(); go('packs'); break;
      case 'odds': showModal(`<div class="eyebrow">MINH BẠCH TỪNG LÁ BÀI</div><h2>Cơ hội tìm thấy huyền thoại</h2><p>Mỗi pack có 5 thẻ. Tỉ lệ ngẫu nhiên cơ bản trên mỗi thẻ:</p><table class="odds-table"><tbody>${[['Thường', '56%'], ['Hiếm', '30%'], ['Sử thi', '11,5%'], ['Huyền thoại', '2,5%']].map(([name, value]) => `<tr><td>${name}</td><td>${value}</td></tr>`).join('')}</tbody></table><p>Thẻ thứ 5 được nâng lên ít nhất Hiếm. Riêng pack Thiên Giới nâng lên ít nhất Sử thi. Pack nguyên tố: mỗi lần chọn thẻ có 70% ưu tiên hệ của pack, còn lại chọn trong toàn bộ các hệ.</p><p>Thẻ có thể trùng. Không dùng tiền thật. Mọi pack và vàng chỉ có giá trị trong trò chơi này.</p>${button('Đã hiểu', 'close-modal')}`); break;
      case 'detail': detailModal(target.dataset.id); break;
      case 'filter-element': filters.element = target.dataset.element; render(); break;
      case 'add-deck': await addToDeck(target.dataset.id); break;
      case 'remove-deck': { const deck = [...state.deck], index = deck.indexOf(target.dataset.id); if (index >= 0) deck.splice(index, 1); if (currentUser) await onlineMutation('/api/game/deck', { deck }); else state.deck = deck; save(); render(); break; }
      case 'reset-deck': showModal(`<div class="eyebrow">BỘ BÀI KHỞI ĐẦU</div><h2>Trở về điểm xuất phát?</h2><p>Thay bộ bài hiện tại bằng 20 thẻ khởi đầu. Tất cả thẻ trong bộ sưu tập vẫn được giữ nguyên.</p><div class="actions">${button('Khôi phục bộ bài', 'confirm-reset', '', '', 'refresh')}${button('Giữ bộ bài hiện tại', 'close-modal', '', 'secondary')}</div>`); break;
      case 'confirm-reset': if (currentUser) await onlineMutation('/api/game/deck', { deck: STARTER_DECK }); else state.deck = [...STARTER_DECK]; save(); closeModal(); render(); toast('Đã khôi phục bộ bài khởi đầu.'); break;
      case 'start-menu': startMenu(); break;
      case 'choose-mode': chooseMode(); break;
      case 'resume-battle': closeModal(); go('battle'); break;
      case 'new-battle': await newBattle(target.dataset.mode); break;
      case 'accept-turn': handoff = false; closeModal(); render(); break;
      case 'play-card': {
        const side = requireTurn(); const b = state.battle; const card = playCard(b, Number(target.dataset.index), side); selectedUnit = null; sound(); const uid = b.players[side].board.at(-1)?.uid; afterAction('summoned', uid); battleFx(card.type === 'spell' ? 'spell' : 'summon', card.element, card.type === 'spell' ? card.name : 'TRIỆU HỒI', uid); break;
      }
      case 'select-unit': { requireTurn(); const uid = Number(target.dataset.uid); selectedUnit = selectedUnit === uid ? null : uid; render(); break; }
      case 'deselect': selectedUnit = null; render(); break;
      case 'evolve': { const side = requireTurn(); const uid = Number(target.dataset.uid); evolve(state.battle, uid, side); sound('reveal'); afterAction('summoned', uid); battleFx('evolution', 'nature', 'TIẾN HÓA', uid); break; }
      case 'attack-unit': {
        if (!selectedUnit) { detailModal(target.dataset.id); break; }
        const side = requireTurn(); const uid = Number(target.dataset.uid); const attacker = state.battle.players[side].board.find(u => u.uid === selectedUnit); const victim = state.battle.players[1 - side].board.find(u => u.uid === uid); const label = victim?.shield ? 'CHẶN!' : `−${attacker?.attack}`; const element = CARD_MAP[attacker?.cardId]?.element; attack(state.battle, selectedUnit, uid, side); selectedUnit = null; sound('attack'); afterAction('hit', uid); battleFx('strike', element, label, uid); break;
      }
      case 'attack-hero': { const side = requireTurn(); if (!selectedUnit) break; const attacker = state.battle.players[side].board.find(u => u.uid === selectedUnit); const label = `−${attacker?.attack}`; const element = CARD_MAP[attacker?.cardId]?.element; attack(state.battle, selectedUnit, null, side); selectedUnit = null; sound('attack'); afterAction(); $('.hero-bar.enemy')?.classList.add('hit'); battleFx('strike', element, label); break; }
      case 'end-turn': {
        const side = requireTurn(); selectedUnit = null; endTurn(state.battle, side);
        if (state.battle.winner !== null) { afterAction(); break; }
        if (state.battle.mode === 'local') { handoff = true; save(); render(); showHandoff(); }
        else { afterAction(); runAi(); } break;
      }
      case 'surrender': showModal(`<div class="eyebrow">TRẬN ĐẤU CHƯA KẾT THÚC</div><h2>Bạn muốn đầu hàng?</h2><p>Đối thủ sẽ giành chiến thắng. Bạn vẫn nhận phần thưởng tham gia trận đấu.</p><div class="actions">${button('Tiếp tục chiến đấu', 'close-modal', '', '', 'shield')}${button('Đầu hàng', 'confirm-surrender', '', 'danger', 'flag')}</div>`); break;
      case 'confirm-surrender':
        if (state.battle && state.battle.winner === null) { battleToken++; aiRunning = false; state.battle.winner = state.battle.mode === 'ai' ? 1 : 1 - state.battle.turn; selectedUnit = null; closeModal(); afterAction(); } break;
    }
  } catch (error) { toast(error.message || 'Có lỗi xảy ra. Vui lòng thử lại.'); }
});
document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-form]'); if (!form) return; event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (form.dataset.form === 'auth') {
    if (authBusy) return; authBusy = true;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      const result = await request(`/api/auth/${form.dataset.mode}`, data);
      battleToken++; aiRunning = false; handoff = result.profile.battle?.mode === 'local' && result.profile.battle.winner === null; currentUser = result.user; state = result.profile; closeModal();
      toast('Đăng nhập thành công. Tiến trình đang lưu trên máy chủ.'); go(currentUser.role === 'admin' ? 'admin' : 'home');
    } catch (error) { if ($('#auth-error')) $('#auth-error').textContent = error.message; }
    finally { authBusy = false; submit.disabled = false; }
    return;
  }
  try {
    if (form.dataset.form === 'admin-search') { admin.search = data.search.trim(); admin.page = 1; await loadAdmin(); }
    if (form.dataset.form === 'admin-gold') await adminMutation(form.dataset.id, 'gold', { amount: Number(data.amount) * Number(event.submitter.value) });
    if (form.dataset.form === 'admin-cards') await adminMutation(form.dataset.id, 'cards', { cardId: data.cardId, quantity: Number(data.quantity) });
  } catch (error) { toast(error.message); }
});
document.addEventListener('input', event => {
  if (event.target.id !== 'card-search') return;
  filters.search = event.target.value;
  $('#collection-grid').innerHTML = collectionGrid(page === 'deck');
  if ($('#filter-count')) $('#filter-count').textContent = `${filteredCards().length} kết quả`;
});
document.addEventListener('change', event => {
  if (event.target.id === 'rarity-filter') filters.rarity = event.target.value;
  else if (event.target.id === 'owned-filter') filters.owned = event.target.value;
  else return;
  render();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if ($('#modal-root').children.length) closeModal(); else { $('.sidebar')?.classList.remove('open'); $('.mobile-overlay')?.classList.remove('open'); } }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-action="attack-hero"]')) { event.preventDefault(); event.target.click(); }
  if (event.key === 'Tab' && $('.modal')) {
    const nodes = [...$('.modal').querySelectorAll('button:not(:disabled):not([hidden]),input,select,[tabindex="0"]')].filter(n => n.offsetParent !== null);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
render();
refreshSession();
setInterval(refreshSession, 15000);
if (state.battle?.mode === 'ai' && state.battle.turn === 1 && state.battle.winner === null) runAi();
