/* Hilfsfunktionen: deterministischer Zufall, Codes, DOM */
function hashStr(str) { return _hash(String(str)); }

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed() { return (Math.random() * 4294967296) >>> 0; }

function encodeCode(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'PG1.' + b64;
}
function decodeCode(code) {
  code = String(code || '').trim();
  if (!code.startsWith('PG1.')) throw new Error('Kein gültiger PoliticGacha-Code');
  let b64 = code.slice(4).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

/* Armee-Format: { name, player, members:[{id, level, pos:[nx, ny]}] } – validiert */
function sanitizeArmy(a) {
  if (!a || !Array.isArray(a.members)) throw new Error('Ungültige Allianz');
  const seen = new Set();
  const members = [];
  for (const m of a.members) {
    if (!m || !POL_BY_ID[m.id] || seen.has(m.id)) continue;
    seen.add(m.id);
    const level = Math.max(1, Math.min(MAX_LEVEL, (m.level | 0) || 1));
    const pos = Array.isArray(m.pos) ? m.pos : [0.5, 0.5];
    const nx = Math.max(0, Math.min(1, +pos[0] || 0)), ny = Math.max(0, Math.min(1, +pos[1] || 0));
    members.push({ id: m.id, level, pos: [Math.round(nx * 1000) / 1000, Math.round(ny * 1000) / 1000] });
    if (members.length >= 5) break;
  }
  if (!members.length) throw new Error('Die Allianz hat keine Mitglieder');
  return {
    name: String(a.name || 'Allianz').slice(0, 32),
    player: String(a.player || 'Unbekannt').slice(0, 24),
    members,
  };
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmt(n) { return Math.round(n).toLocaleString('de-DE'); }
function initials(name) {
  const parts = name.replace(/[^\p{L}\s-]/gu, '').split(/[\s-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toast(msg, kind = '') {
  const t = el(`<div class="toast ${kind}">${msg}</div>`);
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert 📋'); }
  catch { prompt('Code kopieren:', text); }
}
