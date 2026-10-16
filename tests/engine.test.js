import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, CARD_MAP, PACKS, STARTER_DECK, RARITIES, rollPack } from '../src/cards.js';
import { createBattle, playCard, attack, evolve, endTurn, aiStep, botDeck } from '../src/engine.js';
import { freshState, validateDeck, purchasePack, loadState } from '../src/state.js';

function rng(seed = 1) { return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
function fixture() {
  const b = createBattle(STARTER_DECK, botDeck(), 'ai', rng());
  b.players.forEach(p => { p.hand = []; p.board = []; p.energy = 10; p.maxEnergy = 10; });
  return b;
}
function summon(b, id, side = 0) { b.turn = side; b.players[side].hand.push(id); playCard(b, b.players[side].hand.length - 1, side); return b.players[side].board.at(-1); }

test('catalog contains 96 unique, complete cards and a legal starter deck', () => {
  assert.equal(CARDS.length, 96); assert.equal(new Set(CARDS.map(c => c.id)).size, 96);
  for (const c of CARDS) { assert.ok(c.cost > 0); assert.ok(c.name && c.description); assert.ok(RARITIES[c.rarity]); }
  const s = freshState(); assert.ok(validateDeck(s.deck, s.collection)); assert.equal(s.coins, 1200);
});
test('every pack provides exactly five valid cards and honors its guarantee across 2000 rolls', () => {
  const random = rng(44);
  for (const p of PACKS) for (let i = 0; i < 500; i++) {
    const cards = rollPack(p, random).map(id => CARD_MAP[id]);
    assert.equal(cards.length, 5); assert.ok(cards.every(Boolean));
    assert.ok(RARITIES[cards[4].rarity].rank >= RARITIES[p.guarantee].rank);
  }
});
test('pack purchase deducts gold once and saves all five cards including duplicates', () => {
  const s = freshState(); const before = Object.values(s.collection).reduce((a, n) => a + n, 0);
  const cards = purchasePack(s, 'origin', rng());
  assert.equal(s.coins, 1050); assert.equal(s.packsOpened, 1); assert.equal(cards.length, 5);
  assert.equal(Object.values(s.collection).reduce((a, n) => a + n, 0), before + 5);
});
test('insufficient gold and unknown packs leave the entire save unchanged', () => {
  const s = freshState(); s.coins = 10; const before = structuredClone(s);
  assert.throws(() => purchasePack(s, 'origin')); assert.deepEqual(s, before);
  assert.throws(() => purchasePack(s, 'missing')); assert.deepEqual(s, before);
});
test('deck validation rejects unowned cards, excess copies, missing and extra cards', () => {
  const s = freshState(); assert.ok(validateDeck(s.deck, s.collection));
  assert.equal(validateDeck(s.deck.slice(1), s.collection), false);
  assert.equal(validateDeck([...s.deck, 'fire-0'], s.collection), false);
  assert.equal(validateDeck(['nature-12', ...s.deck.slice(1)], s.collection), false);
  assert.equal(validateDeck(['fire-0', ...s.deck.slice(1, 19), 'fire-0'], s.collection), false);
});
test('corrupted storage recovers a legal starter save; valid storage round-trips', () => {
  for (const value of ['{', 'null', '{}', JSON.stringify({ ...freshState(), coins: -10 }), JSON.stringify({ ...freshState(), deck: ['unknown'] })]) {
    assert.ok(validateDeck(loadState({ getItem: () => value }).deck, freshState().collection));
  }
  const s = freshState(); purchasePack(s, 'origin', rng());
  assert.deepEqual(loadState({ getItem: () => JSON.stringify(s) }), s);
});
test('battle starts with shuffled decks, five cards for player one and increasing energy', () => {
  const b = createBattle(STARTER_DECK, botDeck(), 'ai', rng());
  assert.equal(b.players[0].hand.length, 5); assert.equal(b.players[0].deck.length, 15);
  assert.equal(b.players[1].hand.length, 4); assert.equal(b.players[0].energy, 1);
  endTurn(b, 0); assert.equal(b.turn, 1); assert.equal(b.players[1].energy, 1);
  endTurn(b, 1); assert.equal(b.turn, 0); assert.equal(b.players[0].energy, 2); assert.equal(b.round, 2);
});
test('insufficient energy, invalid turn, full board, and invalid hand do not consume cards', () => {
  const b = fixture(); b.players[0].hand = ['fire-12']; b.players[0].energy = 1;
  assert.throws(() => playCard(b, 0)); assert.equal(b.players[0].hand.length, 1); assert.equal(b.players[0].energy, 1);
  assert.throws(() => playCard(b, 0, 1)); assert.throws(() => playCard(b, 9));
  b.players[0].energy = 10; for (let i = 0; i < 4; i++) summon(b, 'nature-0');
  b.players[0].hand.push('nature-0'); assert.throws(() => playCard(b, b.players[0].hand.length - 1)); assert.equal(b.players[0].board.length, 4);
});
test('summoning sickness prevents attacks until next own turn', () => {
  const b = fixture(); const u = summon(b, 'nature-0'); assert.equal(u.ready, false);
  assert.throws(() => attack(b, u.uid)); endTurn(b); endTurn(b); assert.equal(u.ready, true);
  attack(b, u.uid); assert.equal(u.ready, false); assert.equal(b.players[1].hp, 24 - u.attack);
  assert.throws(() => attack(b, u.uid));
});
test('lightning attacks immediately, fire burns on summon, water heals without exceeding max', () => {
  const b = fixture(); const u = summon(b, 'lightning-0'); assert.equal(u.ready, true); attack(b, u.uid);
  summon(b, 'fire-0'); assert.equal(b.players[1].hp, 24 - u.attack - 1);
  b.players[0].hp = 23; summon(b, 'water-0'); assert.equal(b.players[0].hp, 24);
});
test('defenders block hero attacks; combat deals simultaneous damage and removes defeated units', () => {
  const b = fixture(); const a = summon(b, 'lightning-0'); const t = summon(b, 'water-0', 1); b.turn = 0;
  assert.throws(() => attack(b, a.uid)); assert.throws(() => attack(b, a.uid, 999));
  const initial = [a.hp, t.hp]; attack(b, a.uid, t.uid);
  assert.equal(a.hp, initial[0] - t.attack); assert.equal(t.hp, initial[1] - a.attack);
  assert.equal(a.ready, false);
});
test('light shields block exactly one hit; shadow attacks heal the owner', () => {
  const b = fixture(); const a = summon(b, 'shadow-0'); const t = summon(b, 'light-0', 1); b.turn = 0; a.ready = true; b.players[0].hp = 18;
  const hp = t.hp; attack(b, a.uid, t.uid); assert.equal(t.hp, hp); assert.equal(t.shield, false); assert.equal(b.players[0].hp, 19);
  a.ready = true; attack(b, a.uid, t.uid); assert.equal(t.hp, hp - a.attack);
});
test('evolution costs two energy, increases stats once, and never refreshes an attack', () => {
  const b = fixture(); const u = summon(b, 'nature-0'); const before = { attack: u.attack, hp: u.hp, energy: b.players[0].energy };
  evolve(b, u.uid); assert.equal(u.attack, before.attack + 2); assert.equal(u.hp, before.hp + 3); assert.equal(u.ready, false);
  assert.equal(b.players[0].energy, before.energy - 2); assert.throws(() => evolve(b, u.uid));
  const other = summon(b, 'water-0'); b.players[0].energy = 1; assert.throws(() => evolve(b, other.uid));
});
test('damage spell selects strongest defender, then can hit the hero on an empty board', () => {
  const b = fixture(); const u = summon(b, 'nature-0', 1); b.turn = 0;
  b.players[0].hand = ['spell-0']; playCard(b, 0); assert.equal(b.players[1].board.length, 0); assert.ok(u.hp <= 0);
  b.players[0].hand = ['spell-0']; playCard(b, 0); assert.equal(b.players[1].hp, 20);
});
test('freeze skips the next enemy turn and thaws on the following turn', () => {
  const b = fixture(); const u = summon(b, 'lightning-0', 1); b.turn = 0;
  b.players[0].hand = ['spell-3']; playCard(b, 0); assert.ok(u.frozen); endTurn(b); assert.equal(u.ready, false); assert.equal(u.frozen, false);
  endTurn(b); endTurn(b); assert.equal(u.ready, true);
});
test('heal, draw, buff, shield and blast spells apply their documented effects', () => {
  const b = fixture(); const u = summon(b, 'nature-0'); b.players[0].hp = 14;
  b.players[0].hand = ['spell-2']; playCard(b, 0); assert.equal(b.players[0].hp, 20);
  b.players[0].hand = ['spell-5']; const deck = b.players[0].deck.length; playCard(b, 0); assert.equal(b.players[0].hand.length, 2); assert.equal(b.players[0].deck.length, deck - 2);
  b.players[0].energy = 10; b.players[0].hand = ['spell-4']; const hp = u.hp, atk = u.attack; playCard(b, 0); assert.equal(u.hp, hp + 2); assert.equal(u.attack, atk + 1);
  b.players[0].hand = ['spell-8']; playCard(b, 0); assert.ok(u.shield);
  const enemy = summon(b, 'water-0', 1); b.turn = 0; b.players[0].energy = 10; b.players[0].hand = ['spell-1']; const enemyHp = enemy.hp; playCard(b, 0); assert.equal(enemy.hp, enemyHp - 2);
});
test('hand limit burns excess drawn cards; empty decks trigger increasing fatigue and a winner', () => {
  const b = fixture(); b.players[1].hand = Array(9).fill('nature-0'); const size = b.players[1].deck.length;
  endTurn(b); assert.equal(b.players[1].hand.length, 9); assert.equal(b.players[1].deck.length, size - 1);
  b.players[0].deck = []; b.players[0].hp = 2; endTurn(b); assert.equal(b.players[0].hp, 1);
  endTurn(b); endTurn(b); assert.equal(b.winner, 1); assert.equal(b.players[0].hp, 0);
  assert.throws(() => endTurn(b));
});
test('energy caps at ten and AI completes 40 seeded games without illegal actions or stalemates', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const b = createBattle(STARTER_DECK, botDeck(), 'ai', rng(seed)); let actions = 0;
    while (b.winner === null && actions++ < 1500) {
      if (b.turn === 1) { aiStep(b); continue; }
      const p = b.players[0]; const index = p.hand.findIndex(id => CARD_MAP[id].cost <= p.energy && (CARD_MAP[id].type === 'spell' || p.board.length < 4));
      if (index >= 0) { playCard(b, index); continue; }
      const u = p.board.find(c => c.ready);
      if (u) { attack(b, u.uid, b.players[1].board[0]?.uid ?? null); continue; }
      endTurn(b);
      assert.ok(b.players.every(p => p.maxEnergy <= 10 && p.board.length <= 4 && p.hand.length <= 9));
    }
    assert.notEqual(b.winner, null, `game ${seed} must finish`);
  }
});
