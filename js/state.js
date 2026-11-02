/* Spielstand, Wirtschaft und Gacha-Logik */
const SAVE_KEY = 'politgacha_save_v1';
const PITY_LIMIT = 60;       // spätestens nach 60 Zügen ohne Legendär -> garantiert
const DAILY_BONUS = 200;
const MAX_ALLIANCES = 6;
const ALLIANCE_SIZE = 5;

const PACKS = [
  { id: 'basic', name: 'Wahlkampf-Pack', icon: '📣', cost: 100, cards: 3, desc: '3 Politiker, normale Chancen.' },
  { id: 'coalition', name: 'Koalitions-Pack', icon: '🤝', cost: 280, cards: 5, minRarity: 'E', desc: '5 Politiker, mindestens 1× Episch oder besser.' },
  { id: 'region', name: 'Regional-Pack', icon: '🌍', cost: 160, cards: 3, minRarity: 'R', filter: 'region', desc: '3 Politiker aus einer Region, mind. 1× Selten.' },
  { id: 'era', name: 'Epochen-Pack', icon: '⏳', cost: 160, cards: 3, minRarity: 'R', filter: 'era', desc: '3 Politiker aus einer Epoche, mind. 1× Selten.' },
  { id: 'party', name: 'Partei-Pack', icon: '🏛️', cost: 180, cards: 3, minRarity: 'R', filter: 'party', desc: '3 Politiker einer Parteienfamilie, mind. 1× Selten. Ideal für Fraktions-Synergien.' },
];

function defaultState() {
  return {
    version: 1,
    name: 'Spieler' + Math.floor(Math.random() * 900 + 100),
    votes: 600,
    collection: {}, // id -> { copies, level, firstSeen }
    alliances: [],
    activeAlliance: null,
    pity: 0,
    stages: { classic: 1, grand: 1, command: 1 },
    battleMode: 'classic',
    lastDaily: '',
    stats: { pulls: 0, wins: 0, losses: 0, draws: 0, pvpWins: 0, pvpLosses: 0 },
    starterGiven: false,
    level: 1,
    xp: 0,
  };
}

let S = defaultState();

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      S = Object.assign(defaultState(), saved);
      if (!saved.stages) S.stages = { classic: saved.stage || 1, grand: 1, command: 1 };
      delete S.stage;
    }
  } catch { S = defaultState(); }
}
function saveState() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} }

function addVotes(n) { S.votes = Math.max(0, Math.round(S.votes + n)); saveState(); updateHeader(); }

function levelFromCopies(c) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_COPIES.length; i++) if (c >= LEVEL_COPIES[i]) lvl = i + 1;
  return lvl;
}
function owned(id) { return S.collection[id]; }
function levelOf(id) { return owned(id) ? owned(id).level : 1; }

/* Karte gutschreiben -> Ergebnisinfo für die Pack-Animation */
function grantCard(id) {
  const p = POL_BY_ID[id];
  let c = S.collection[id];
  const info = { id, isNew: false, levelUp: false, refund: 0 };
  if (!c) {
    c = S.collection[id] = { copies: 1, level: 1, firstSeen: Date.now() };
    info.isNew = true;
  } else {
    if (c.level >= MAX_LEVEL) {
      info.refund = RARITIES[p.rarity].refund;
      S.votes += info.refund;
    }
    c.copies++;
    const lvl = levelFromCopies(c.copies);
    if (lvl > c.level) { c.level = lvl; info.levelUp = true; }
  }
  info.level = c.level;
  info.copies = c.copies;
  return info;
}

function rollRarity(rng, minRarity) {
  if (S.pity >= PITY_LIMIT - 1) return 'L';
  let r = rng();
  let rarity = 'C';
  let acc = 0;
  for (const k of ['L', 'E', 'R', 'C']) {
    acc += RARITIES[k].weight;
    if (r < acc) { rarity = k; break; }
  }
  if (minRarity && RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(minRarity)) rarity = minRarity;
  return rarity;
}

function pickFrom(pool, rarity, rng) {
  let cands = pool.filter((p) => p.rarity === rarity);
  // Fallback, falls die Region/Epoche diese Seltenheit nicht hat
  let idx = RARITY_ORDER.indexOf(rarity);
  while (!cands.length && idx >= 0) { cands = pool.filter((p) => p.rarity === RARITY_ORDER[idx]); idx--; }
  if (!cands.length) cands = pool;
  return cands[Math.floor(rng() * cands.length)];
}

function openPack(packId, filterValue) {
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) return null;
  if (S.votes < pack.cost) { toast('Nicht genug Stimmen 🗳️', 'bad'); return null; }
  S.votes -= pack.cost;
  let pool = POLITICIANS;
  if (pack.filter === 'region') pool = POLITICIANS.filter((p) => p.region === filterValue);
  if (pack.filter === 'era') pool = POLITICIANS.filter((p) => p.era === filterValue);
  if (pack.filter === 'party') pool = POLITICIANS.filter((p) => p.party === filterValue);
  if (!pool.length) pool = POLITICIANS;
  const rng = Math.random;
  const results = [];
  const guaranteeIdx = pack.minRarity ? pack.cards - 1 : -1;
  for (let i = 0; i < pack.cards; i++) {
    const rarity = rollRarity(rng, i === guaranteeIdx ? pack.minRarity : null);
    const p = pickFrom(pool, rarity, rng);
    S.stats.pulls++;
    if (p.rarity === 'L') S.pity = 0; else S.pity++;
    results.push(grantCard(p.id));
  }
  saveState();
  updateHeader();
  if (typeof track === 'function') { track('pack'); gainXp(5 * pack.cards); }
  return results;
}

/* Starter: 5 Karten mit unterschiedlichen Klassen (Gewöhnlich/Selten) */
function giveStarter() {
  const rng = Math.random;
  const results = [];
  const classes = Object.keys(CLASSES);
  classes.forEach((cls, i) => {
    const rarity = i === 0 ? 'R' : 'C';
    const pool = POLITICIANS.filter((p) => p.cls === cls && p.rarity === rarity && !S.collection[p.id]);
    const p = pool[Math.floor(rng() * pool.length)];
    results.push(grantCard(p.id));
  });
  S.starterGiven = true;
  const ids = results.map((r) => r.id);
  const a = newAlliance('Erste Koalition', ids);
  S.activeAlliance = a.id;
  saveState();
  return results;
}

function defaultDeploy(i, n) {
  const ny = n <= 1 ? 0.5 : 0.12 + (0.76 * i) / (n - 1);
  return [0.55, Math.round(ny * 1000) / 1000];
}

function newAlliance(name, ids = []) {
  const a = { id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000), name, members: ids.slice(0, ALLIANCE_SIZE), deploy: {} };
  a.members.forEach((id, i) => {
    const cls = POL_BY_ID[id].cls;
    const pos = defaultDeploy(i, a.members.length);
    if (cls === 'art' || cls === 'dip') pos[0] = 0.25;
    a.deploy[id] = pos;
  });
  S.alliances.push(a);
  saveState();
  return a;
}

function getAlliance(id) { return S.alliances.find((a) => a.id === id); }
function activeAlliance() { return getAlliance(S.activeAlliance) || S.alliances[0] || null; }

function allianceToArmy(a) {
  return sanitizeArmy({
    name: a.name,
    player: S.name,
    members: a.members.map((id, i) => ({ id, level: levelOf(id), pos: a.deploy[id] || defaultDeploy(i, a.members.length) })),
  });
}

/* Kampfstärke einer Allianz – bildet die Simulation nach (Angriff × Rückhalt, Level, Synergien) */
function memberStrength(p, lvl, s) {
  const lv = 1 + LEVEL_BONUS * (lvl - 1);
  const a = (0.55 + p.atk / 100) * lv * s.atk, d = (0.55 + p.def / 100) * lv * s.hp;
  return 100 * Math.sqrt(a * d) * (0.92 + 0.08 * s.spd) * (0.9 + p.tac / 500);
}
function alliancePower(ids, levels) {
  const syn = computeSynergies(ids);
  let total = 0;
  ids.forEach((id) => {
    const p = POL_BY_ID[id]; if (!p) return;
    total += memberStrength(p, levels ? levels[id] : levelOf(id), syn.per[id]);
  });
  return Math.round(total);
}

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function dailyAvailable() { return S.lastDaily !== todayKey(); }
function claimDaily() {
  if (!dailyAvailable()) return false;
  S.lastDaily = todayKey();
  addVotes(DAILY_BONUS);
  return true;
}

/* ---------- Karriere-Rang (Erfahrung) ---------- */
const RANKS = [
  'Gemeinderat', 'Ortsvorsteher:in', 'Bürgermeister:in', 'Kreistagsmitglied', 'Landtagsabgeordnete:r', 'Staatssekretär:in',
  'Landesminister:in', 'Ministerpräsident:in', 'Bundestagsabgeordnete:r', 'Fraktionschef:in', 'Bundesminister:in', 'Vizekanzler:in',
  'Kanzler:in', 'EU-Kommissar:in', 'Kommissionspräsident:in', 'UN-Generalsekretär:in', 'Weltstaatsoberhaupt',
];
function xpForLevel(l) { return 80 + 40 * l; }
function rankName(level) { return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))]; }
function gainXp(n) {
  S.xp = (S.xp || 0) + Math.round(n);
  S.level = S.level || 1;
  let ups = 0, reward = 0;
  while (S.xp >= xpForLevel(S.level)) {
    S.xp -= xpForLevel(S.level);
    S.level++;
    ups++;
    reward += 100 + 25 * S.level;
  }
  if (ups) {
    S.votes += reward;
    toast(`⬆️ Aufstieg! Level ${S.level}: ${esc(rankName(S.level))} · +${reward} 🗳️`, 'good');
  }
  saveState();
  updateHeader();
}

/* ---------- Spielstand sichern ---------- */
function exportSave() { return 'PGS1.' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function importSave(code) {
  code = String(code || '').trim();
  if (!code.startsWith('PGS1.')) throw new Error('Kein gültiger Spielstand-Code');
  const data = JSON.parse(decodeURIComponent(escape(atob(code.slice(5)))));
  if (!data || typeof data !== 'object' || !data.collection) throw new Error('Spielstand unvollständig');
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
