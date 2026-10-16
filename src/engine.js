import { CARD_MAP, CARDS, STARTER_DECK } from './cards.js';

const MAX_HP = 24;
const cardFor = (b, id) => b.cardMap?.[id] || CARD_MAP[id];
function shuffled(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function player(deck, rng) { return { hp: MAX_HP, maxHp: MAX_HP, energy: 0, maxEnergy: 0, deck: shuffled(deck, rng), hand: [], board: [], fatigue: 0 }; }
export function createBattle(deck = STARTER_DECK, enemyDeck = STARTER_DECK, mode = 'ai', rng = Math.random, catalog = CARDS) {
  const allCards = Object.fromEntries(catalog.map(c => [c.id, c]));
  for (const d of [deck, enemyDeck]) if (d.length !== 20 || d.some(id => !Object.hasOwn(allCards, id))) throw new Error('Bộ bài cần đúng 20 thẻ hợp lệ.');
  const cardMap = Object.fromEntries([...new Set([...deck, ...enemyDeck])].map(id => [id, structuredClone(allCards[id])]));
  const battle = { cardMap, players: [player(deck, rng), player(enemyDeck, rng)], turn: 0, round: 1, winner: null, mode, log: ['Trận đấu bắt đầu! Mỗi người có 24 sinh lực.'], serial: 0, rewarded: false };
  for (let side = 0; side < 2; side++) for (let i = 0; i < 4; i++) draw(battle, side);
  startTurn(battle);
  return battle;
}
export function log(b, text) { b.log.unshift(text); b.log = b.log.slice(0, 40); }
function draw(b, side) {
  const p = b.players[side];
  if (!p.deck.length) { p.fatigue++; p.hp = Math.max(0, p.hp - p.fatigue); log(b, `Người chơi ${side + 1} cạn bài: mất ${p.fatigue} sinh lực.`); }
  else { const id = p.deck.pop(); if (p.hand.length < 9) p.hand.push(id); else log(b, `${cardFor(b, id).name} bị bỏ do đầy tay (9 thẻ).`); }
}
function checkWinner(b) {
  b.players.forEach(p => { p.hp = Math.max(0, Math.min(p.maxHp, p.hp)); p.board = p.board.filter(c => c.hp > 0); });
  if (b.players[0].hp <= 0 && b.players[1].hp <= 0) b.winner = 'draw';
  else if (b.players[0].hp <= 0) b.winner = 1;
  else if (b.players[1].hp <= 0) b.winner = 0;
}
function active(b, side) {
  if (b.winner !== null) throw new Error('Trận đấu đã kết thúc.');
  if (b.turn !== side) throw new Error('Chưa đến lượt của bạn.');
  return b.players[side];
}
function damage(unit, amount) { if (unit.shield) unit.shield = false; else unit.hp -= amount; }
function startTurn(b) {
  const p = b.players[b.turn];
  p.maxEnergy = Math.min(10, p.maxEnergy + 1); p.energy = p.maxEnergy;
  for (const unit of p.board) { unit.ready = !unit.frozen; unit.frozen = false; }
  draw(b, b.turn); checkWinner(b);
}
export function playCard(b, index, side = b.turn) {
  const p = active(b, side); const enemy = b.players[1 - side]; const card = cardFor(b, p.hand[index]);
  if (!card) throw new Error('Không tìm thấy thẻ.');
  if (p.energy < card.cost) throw new Error('Không đủ năng lượng để dùng thẻ này.');
  if (card.type === 'creature' && p.board.length >= 4) throw new Error('Sân đã đầy. Tối đa 4 linh thú.');
  p.hand.splice(index, 1); p.energy -= card.cost;
  if (card.type === 'creature') {
    const unit = { uid: ++b.serial, cardId: card.id, attack: card.attack, hp: card.health, maxHp: card.health, ready: card.skill === 'swift', shield: card.skill === 'shield', frozen: false, evolved: false };
    p.board.push(unit);
    if (card.skill === 'burn') enemy.hp--;
    if (card.skill === 'heal') p.hp = Math.min(p.maxHp, p.hp + 2);
    if (card.skill === 'growth') p.board.forEach(c => { c.hp = Math.min(c.maxHp, c.hp + 1); });
    log(b, `Người chơi ${side + 1} triệu hồi ${card.name}.`);
  } else {
    if (card.effect === 'damage') {
      const target = [...enemy.board].sort((a, c) => c.attack - a.attack)[0];
      if (target) damage(target, 4); else enemy.hp -= 4;
    }
    if (card.effect === 'blast') enemy.board.forEach(c => damage(c, 2));
    if (card.effect === 'heal') p.hp = Math.min(p.maxHp, p.hp + 6);
    if (card.effect === 'draw') { draw(b, side); draw(b, side); }
    if (card.effect === 'buff') p.board.forEach(c => { c.attack++; c.maxHp += 2; c.hp += 2; });
    if (card.effect === 'shield') p.board.forEach(c => { c.shield = true; });
    if (card.effect === 'freeze') enemy.board.forEach(c => { c.frozen = true; c.ready = false; });
    log(b, `Người chơi ${side + 1} sử dụng ${card.name}.`);
  }
  checkWinner(b); return card;
}
export function attack(b, uid, targetUid = null, side = b.turn) {
  const p = active(b, side); const enemy = b.players[1 - side];
  const unit = p.board.find(c => c.uid === uid);
  if (!unit || !unit.ready) throw new Error('Linh thú này chưa thể tấn công.');
  if (targetUid === null && enemy.board.length) throw new Error('Hãy đánh bại linh thú phòng thủ trước.');
  const target = targetUid === null ? null : enemy.board.find(c => c.uid === targetUid);
  if (targetUid !== null && !target) throw new Error('Mục tiêu không hợp lệ.');
  unit.ready = false;
  if (target) { damage(target, unit.attack); damage(unit, target.attack); }
  else enemy.hp -= unit.attack;
  if (cardFor(b, unit.cardId).skill === 'drain') p.hp = Math.min(p.maxHp, p.hp + 1);
  log(b, `${cardFor(b, unit.cardId).name} tấn công ${target ? cardFor(b, target.cardId).name : 'đối thủ'} (${unit.attack} sát thương).`);
  checkWinner(b);
}
export function evolve(b, uid, side = b.turn) {
  const p = active(b, side); const unit = p.board.find(c => c.uid === uid);
  if (!unit || unit.evolved) throw new Error('Linh thú chỉ có thể tiến hóa một lần.');
  if (p.energy < 2) throw new Error('Cần 2 năng lượng để tiến hóa.');
  p.energy -= 2; unit.evolved = true; unit.attack += 2; unit.maxHp += 3; unit.hp += 3;
  log(b, `${cardFor(b, unit.cardId).name} tiến hóa! +2 công, +3 sinh lực.`);
}
export function endTurn(b, side = b.turn) {
  active(b, side); b.turn = 1 - b.turn; if (b.turn === 0) b.round++;
  log(b, `Lượt ${b.round} · Người chơi ${b.turn + 1}.`); startTurn(b);
}
export function aiStep(b) {
  if (b.winner !== null || b.turn !== 1) return { type: 'done' };
  const p = b.players[1]; const enemy = b.players[0];
  const index = p.hand.findIndex(id => cardFor(b, id).cost <= p.energy && (cardFor(b, id).type === 'spell' || p.board.length < 4));
  if (index >= 0) { const card = playCard(b, index, 1); return { type: 'play', card }; }
  const evolvable = p.board.find(c => !c.evolved);
  if (p.energy >= 2 && evolvable) { evolve(b, evolvable.uid, 1); return { type: 'evolve', uid: evolvable.uid }; }
  const unit = p.board.find(c => c.ready);
  if (unit) {
    const target = [...enemy.board].sort((a, c) => (a.shield ? 100 : a.hp) - (c.shield ? 100 : c.hp))[0];
    attack(b, unit.uid, target?.uid ?? null, 1); return { type: 'attack', uid: unit.uid, target: target?.uid ?? null };
  }
  endTurn(b, 1); return { type: 'end' };
}
export function botDeck() {
  return ['shadow-0', 'shadow-0', 'lightning-0', 'lightning-0', 'fire-1', 'fire-1', 'water-2', 'water-2', 'nature-4', 'nature-4', 'light-5', 'light-5', 'shadow-6', 'shadow-6', 'lightning-8', 'fire-8', 'spell-0', 'spell-2', 'spell-5', 'spell-6'];
}
