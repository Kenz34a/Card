import { ELEMENTS } from './cards.js';
let serial = 0;
const paths = {
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  pack: '<path d="m4 7 8-4 8 4v13H4V7Z"/><path d="m4 7 8 4 8-4M12 11v9"/>',
  cards: '<rect x="7" y="3" width="13" height="17" rx="2"/><path d="M4 7H3v14h12v-1M12 7h3M11 11h5M11 15h5"/>',
  sword: '<path d="m14 3 7-1-1 7L9 20l-5-5L14 3ZM3 14l7 7M6 18l-3 3M14 5l5 5"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m12 6 4 6-4 6-4-6 4-6Z"/>',
  star: '<path d="m12 3 2.8 5.8 6.4 1-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-1L12 3Z"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  gift: '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v8h14v-8M12 9v12M12 9H8a3 3 0 1 1 3-3l1 3ZM12 9h4a3 3 0 1 0-3-3l-1 3Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  flame: '<path d="M12 2c2 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 4-7 0 4 1 4 2 5 2-3 2-6 1-11Z"/>',
  drop: '<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13ZM9 16c0 2 1 3 3 3"/>',
  leaf: '<path d="M20 3C8 2 2 9 6 16s17 2 14-13ZM5 21 16 9M9 15l-1-4M12 12h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  heart: '<path d="M20 5c-3-3-7-1-8 2-1-3-5-5-8-2s-2 7 1 10l7 6 7-6c3-3 4-7 1-10Z"/>',
  trophy: '<path d="M7 3h10v5c0 5-2 7-5 7s-5-2-5-7V3ZM7 5H3v3c0 3 2 4 5 4M17 5h4v3c0 3-2 4-5 4M12 15v5M7 21h10"/>',
  volume: '<path d="M11 4 6 8H3v8h3l5 4V4ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16"/>',
  mute: '<path d="M11 4 6 8H3v8h3l5 4V4ZM16 9l6 6M16 15l6-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17v.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 5a3 3 0 0 1 0 6M19 14c2 1 3 3 3 5v2"/>',
  bot: '<rect x="3" y="7" width="18" height="14" rx="4"/><path d="M12 7V3M9 3h6M7 12v2M17 12v2M9 17h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  flag: '<path d="M5 22V3c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
};
export function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`; }

const bodies = {
  dragon: `<path d="M160 249C48 286 42 188 95 172c-38 42-10 72 36 49L111 179 68 158 28 174 40 107 91 125 113 162l14-53 22-40 46 7 17 23-29 14-12 40 32 24 26 59 39 18-11 14-54-8-29-33-14 22Z"/><path d="m114 162-19-54-39-32 5 51-21-20 28 51 43 21M181 139l29-40 40-31-5 54 26-15-25 48-43 22M143 84l-7-36 27 25M174 75l19-39 2 45M128 209l-29 23M191 209l29 21"/><path d="m180 93 22 3-24 13-13-1 15-15Z" fill="EYE"/><path d="m139 119 16 21-15 25 23 25-10 25" fill="none"/><path d="m154 93 6 3" stroke="EYE" stroke-width="4"/>`,
  fox: `<path d="M146 260C48 279 29 216 45 174c3 43 31 61 58 46-57-17-52-64-25-95-8 42 11 55 30 52-19-41 3-66 22-84-7 40 3 61 18 67l9-48 16-40 38 21 11 52 20 33-24 29 3 47 25 15-5 12-43-2-22-40-5 40-25 13-19-1 9-15Z"/><path d="m157 112-4-56 34 30M199 92l33-40-10 93M172 133l17 11 24-6-14 25-21 3-6-33ZM148 177l25 24 36-10M126 239l13-43"/><path d="m174 135 11 9-10 3M202 140l11-2-7 11" stroke="EYE" stroke-width="3" fill="EYE"/><path d="m187 160 9-1-4 5Z" fill="EYE"/>`,
  wolf: `<path d="m89 201 31-51 19-48 25-12 20-47 18 42 21 9 4 27 31 14-17 19-26 2-15 42 20 43-6 21-28-4-6-57-18 18-8 49-39-1 9-16 2-41-20 5-19 39-34 1 7-19 17-32-17-7-14-31 14-32 1 29 20 12Z"/><path d="m139 102-2-37 27 25M120 150l34 25 18-18 28 41M152 108l28 17-13 27M211 112l13 4-13 7"/><path d="m192 107 14 4-12 7Z" fill="EYE"/>`,
  golem: `<path d="m127 72 38-14 36 19 8 44-26 22-44-5-23-27 11-39ZM124 145l56-5 34 22 5 58-30 30-65-5-19-51 19-49ZM101 150l-33 16-19 52 20 18 25-21 13-39M221 156l30 17 20 49-20 17-28-24-4-39M131 246l-12 28h35l10-25M186 248l12 25h35l-17-38"/><path d="m132 94 24 7-17 11M187 99l-19 5 15 9" stroke="EYE" stroke-width="4"/><path d="m156 167 24 16-18 34-21-30 15-20Z" fill="EYE"/><path d="m140 127 33-3M115 199l24 10M196 220l20-10"/>`,
  phoenix: `<path d="M153 163C100 139 102 83 48 61l24 54-38-16 44 55-39-2 63 42-38 3 64 22-40 43 58-21-9 44 30-35 20 23 2-45 46 31-17-44 49 3-45-39 43-7-44-24 49-32-42-1 33-48-33 10 20-48c-54 22-49 81-95 103l18-39-13-37-20-15 3-30-25 30 3 37 19 31-12 25Z"/><path d="m153 163 9 37-16 41M159 205l28 23M126 188 79 148M188 182l43-42M155 91l10 3" stroke="EYE" stroke-width="3"/>`,
  serpent: `<path d="M86 259c-76-40-10-96 40-83 55 15 57 63 4 64-44 0-46-30-20-39-14 28 45 21 26 2-31-32-72 1-43 32 43 45 115 5 114-40-2-44-53-48-54-85l-9-30 22-26 36 8 16 29-24 22-16 2c-6 25 55 30 57 79 4 74-83 120-149 65Z"/><path d="m151 76-15-33 31 17M186 57l18-22 4 35M173 93l28-2M181 131l-14 8M201 151l-12 11M219 180l-17 6M218 215l-17-5"/><path d="m175 77 9-1" stroke="EYE" stroke-width="4"/>`,
  spirit: `<path d="M146 67c44-9 78 34 60 74-5 12-11 24-3 41l19 18-23 3 12 30-30-6-8 35-20-24-31 18 1-33-34 7 16-32-25-13 29-17c-37-45-16-91 37-101Z"/><path d="m99 74-19-22M218 104l29-12M104 231l-16 22M132 61l-6-27M179 43l11-15"/><path d="m130 119 10 3M169 118l10-3" stroke="EYE" stroke-width="7"/><path d="M142 141q12 12 24-2" fill="none" stroke="EYE" stroke-width="3"/><path d="m151 183 10 12-12 18-10-15 12-15Z" fill="EYE"/>`,
  rune: `<circle cx="150" cy="165" r="77" fill="none"/><circle cx="150" cy="165" r="59" fill="none"/><path d="m150 66 85 148H65l85-148Zm0 197-85-147h170l-85 147Z" fill="none"/><path d="m150 119 27 46-27 46-27-46 27-46Z" fill="EYE"/><path d="M150 40v20M150 270v20M25 165h20M255 165h20"/>`,
};
export function creatureArt(card, cls = '', decorative = false) {
  const el = ELEMENTS[card.element]; const uid = `art${++serial}`;
  const eye = card.element === 'light' ? '#fff9e2' : '#efffd7';
  const body = (bodies[card.form] || bodies.dragon).replaceAll('EYE', eye);
  const particles = Array.from({ length: 15 }, (_, i) => { const x = (i * 67 + card.variant * 13) % 280 + 10; const y = (i * 47 + card.variant * 7) % 290 + 15; return `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 2}" opacity="${.2 + (i % 4) * .12}"/>`; }).join('');
  return `<svg class="creature-art ${cls}" viewBox="0 0 300 320" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${card.name}"`} xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${uid}bg"><stop stop-color="${el.dark}"/><stop offset="1" stop-color="#101b1c"/></radialGradient><linearGradient id="${uid}body" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${el.color}"/><stop offset=".45" stop-color="${el.dark}"/><stop offset="1" stop-color="#192a29"/></linearGradient><filter id="${uid}glow"><feGaussianBlur stdDeviation="10"/></filter></defs><rect width="300" height="320" fill="url(#${uid}bg)"/><circle cx="153" cy="134" r="89" fill="${el.color}" opacity=".08" filter="url(#${uid}glow)"/><circle cx="153" cy="134" r="83" fill="none" stroke="${el.color}" stroke-width=".6" opacity=".35"/><circle cx="153" cy="134" r="95" fill="none" stroke="${el.color}" stroke-width=".4" stroke-dasharray="2 8" opacity=".35"/><path d="M0 275 68 233l46 34 74-37 112 40v50H0Z" fill="#0a1215" opacity=".55"/><g fill="${el.color}">${particles}</g><ellipse cx="154" cy="268" rx="90" ry="15" fill="${el.color}" opacity=".13" filter="url(#${uid}glow)"/><g fill="url(#${uid}body)" stroke="${el.color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${body}</g><path d="m26 288 13-10 7 5 21-11M231 284l14-9 18 12" fill="none" stroke="${el.color}" opacity=".4"/></svg>`;
}
export function packArt(pack, small = false) {
  const card = { name: pack.name, element: pack.element, form: pack.element === 'nature' ? 'dragon' : pack.element === 'fire' ? 'phoenix' : pack.element === 'shadow' ? 'fox' : 'dragon', variant: 10 };
  return `<div class="pack-art ${small ? 'small' : ''}" style="--pack-color:${ELEMENTS[pack.element].color}"><div class="pack-edge"></div><div class="pack-inner">${creatureArt(card, '', true)}<div class="pack-brand">LINH THÚ <span>TRADING CARD GAME</span></div><div class="pack-title">${pack.name}</div><div class="pack-bottom"><span>5 THẺ BÀI</span><span>✦</span><span>SERIES 01</span></div></div></div>`;
}
