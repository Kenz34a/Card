import { CARD_MAP, PACKS, STARTER_DECK, rollPack } from './cards.js';
export const STORAGE_KEY = 'linh-thu-save-v1';
export function freshState() {
  const collection = {};
  for (const id of STARTER_DECK) collection[id] = (collection[id] || 0) + 1;
  return { version: 1, coins: 1200, collection, deck: [...STARTER_DECK], packsOpened: 0, wins: 0, matches: 0, daily: '', sound: false, battle: null };
}
export function validateDeck(deck, collection, catalog = CARD_MAP) {
  if (deck.length !== 20) return false;
  const counts = {};
  return deck.every(id => { counts[id] = (counts[id] || 0) + 1; return Object.hasOwn(catalog, id) && counts[id] <= Math.min(2, collection[id] || 0); });
}
export function purchasePack(state, packId, rng = Math.random, options = {}) {
  const pack = (options.packs || PACKS).find(p => p.id === packId);
  if (!pack) throw new Error('Pack không tồn tại.');
  if (pack.enabled === false) throw new Error('Pack này đang ngừng phát hành.');
  if (state.coins < pack.price) throw new Error('Bạn chưa đủ vàng. Đấu một trận hoặc nhận quà mỗi ngày nhé!');
  const ids = rollPack(pack, rng, options.cards);
  state.coins -= pack.price; state.packsOpened++;
  ids.forEach(id => { state.collection[id] = (state.collection[id] || 0) + 1; });
  return ids;
}
export function loadState(storage) {
  try {
    const s = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!s || s.version !== 1 || !Number.isFinite(s.coins) || s.coins < 0 || !s.collection || !Array.isArray(s.deck)) return freshState();
    if (Object.entries(s.collection).some(([id, n]) => !CARD_MAP[id] || !Number.isInteger(n) || n < 0) || s.deck.some(id => !CARD_MAP[id])) return freshState();
    return { ...freshState(), ...s };
  } catch { return freshState(); }
}
