/* 🌍 Weltkarte: Gebiet für Gebiet die Welt erobern */
const WORLD_TERRITORIES = [
  // Europa
  { id: 'gbr', name: 'Britische Inseln', region: 'EU', x: 466, y: 92, tier: 2, flags: ['🇬🇧','🏴'] },
  { id: 'fra', name: 'Westeuropa', region: 'EU', x: 492, y: 130, tier: 1, flags: ['🇫🇷','👑'] },
  { id: 'ibe', name: 'Iberien', region: 'EU', x: 466, y: 162, tier: 1, flags: ['🇪🇸'] },
  { id: 'deu', name: 'Mitteleuropa', region: 'EU', x: 530, y: 100, tier: 2, start: true, flags: ['🇩🇪','🇦🇹'] },
  { id: 'ita', name: 'Italien & Balkan', region: 'EU', x: 550, y: 144, tier: 1, flags: ['🇮🇹','🏛️','🏺'] },
  { id: 'sca', name: 'Skandinavien', region: 'EU', x: 548, y: 56, tier: 1, flags: ['🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇳🇱'] },
  { id: 'ost', name: 'Osteuropa', region: 'EU', x: 592, y: 108, tier: 1, flags: ['🇵🇱','🇨🇿'] },
  { id: 'rus', name: 'Russland', region: 'EU', x: 646, y: 78, tier: 3, flags: ['🇷🇺'] },
  // Afrika & Nahost
  { id: 'mag', name: 'Maghreb', region: 'AF', x: 500, y: 186, tier: 1, flags: ['🏜️'] },
  { id: 'egy', name: 'Ägypten', region: 'AF', x: 586, y: 192, tier: 2, start: true, flags: ['🇪🇬'] },
  { id: 'lev', name: 'Levante & Anatolien', region: 'AF', x: 616, y: 150, tier: 1, flags: ['🇹🇷','🇮🇱'] },
  { id: 'ara', name: 'Arabische Halbinsel', region: 'AF', x: 648, y: 206, tier: 1, flags: ['🏺','🏜️'] },
  { id: 'wes', name: 'Westafrika', region: 'AF', x: 496, y: 230, tier: 1, flags: ['🇬🇭','🇱🇷'] },
  { id: 'ofr', name: 'Ostafrika', region: 'AF', x: 606, y: 250, tier: 1, flags: ['🇹🇿','🇰🇪','🇪🇹'] },
  { id: 'sud', name: 'Südliches Afrika', region: 'AF', x: 572, y: 322, tier: 3, flags: ['🇿🇦'] },
  // Asien & Ozeanien
  { id: 'per', name: 'Persien', region: 'AS', x: 676, y: 168, tier: 1, flags: ['🏺','🇵🇰'] },
  { id: 'zen', name: 'Zentralasien', region: 'AS', x: 708, y: 124, tier: 1, flags: ['🇮🇳'] },
  { id: 'sib', name: 'Sibirien', region: 'AS', x: 760, y: 80, tier: 1, flags: ['🇷🇺'] },
  { id: 'ind', name: 'Indien', region: 'AS', x: 714, y: 184, tier: 3, start: true, flags: ['🇮🇳','🇵🇰'] },
  { id: 'chn', name: 'China', region: 'AS', x: 812, y: 142, tier: 3, flags: ['🇨🇳'] },
  { id: 'jap', name: 'Japan & Korea', region: 'AS', x: 884, y: 142, tier: 2, flags: ['🇯🇵'] },
  { id: 'sea', name: 'Südostasien', region: 'AS', x: 806, y: 248, tier: 1, flags: ['🇮🇩','🇸🇬','🇵🇭'] },
  { id: 'aus', name: 'Australien', region: 'AS', x: 904, y: 342, tier: 2, flags: ['🇦🇺'] },
  { id: 'oce', name: 'Neuseeland & Pazifik', region: 'AS', x: 974, y: 378, tier: 1, flags: ['🇳🇿'] },
  // Amerikas
  { id: 'ala', name: 'Alaska & Yukon', region: 'AM', x: 82, y: 72, tier: 1, flags: ['🇨🇦'] },
  { id: 'can', name: 'Kanada', region: 'AM', x: 262, y: 96, tier: 1, flags: ['🇨🇦'] },
  { id: 'usw', name: 'US-Westküste', region: 'AM', x: 166, y: 140, tier: 1, flags: ['🇺🇸'] },
  { id: 'usa', name: 'USA (Ostküste)', region: 'AM', x: 286, y: 140, tier: 3, start: true, flags: ['🇺🇸'] },
  { id: 'mex', name: 'Mexiko & Mittelamerika', region: 'AM', x: 214, y: 192, tier: 1, flags: ['🇲🇽'] },
  { id: 'kar', name: 'Karibik', region: 'AM', x: 288, y: 192, tier: 1, flags: ['🇻🇪'] },
  { id: 'kol', name: 'Andenstaaten', region: 'AM', x: 300, y: 244, tier: 1, flags: ['🇻🇪','🇨🇱'] },
  { id: 'bra', name: 'Brasilien', region: 'AM', x: 366, y: 292, tier: 2, flags: ['🇧🇷'] },
  { id: 'arg', name: 'Südkegel', region: 'AM', x: 334, y: 352, tier: 1, flags: ['🇨🇱','🇺🇾'] },
];
const WORLD_EDGES = `gbr-fra gbr-sca gbr-can fra-ibe fra-deu fra-ita deu-sca deu-ost deu-ita ost-rus sca-rus ost-ita ost-lev ibe-mag ita-mag rus-lev rus-zen rus-sib
mag-egy mag-wes egy-lev egy-ara egy-ofr wes-ofr ofr-sud wes-sud lev-ara lev-per ara-per ara-ofr wes-bra
per-zen per-ind zen-sib zen-chn zen-ind ind-chn ind-sea chn-sib chn-jap chn-sea jap-sib sea-aus aus-oce sib-ala jap-usw
ala-can ala-usw can-usa can-usw usw-usa usw-mex usa-mex usa-kar mex-kar mex-kol kar-kol kol-bra kol-arg bra-arg`.split(/\s+/).map((e) => e.split('-'));
const TERR = Object.fromEntries(WORLD_TERRITORIES.map((t) => [t.id, t]));
const NEIGHBORS = {};
WORLD_EDGES.forEach(([a, b]) => { (NEIGHBORS[a] = NEIGHBORS[a] || []).push(b); (NEIGHBORS[b] = NEIGHBORS[b] || []).push(a); });

const TIER_INFO = {
  1: { name: 'Provinz', icon: '🏘️', mode: 'classic' },
  2: { name: 'Festung', icon: '🏰', mode: 'grand' },
  3: { name: 'Großmacht', icon: '👑', mode: 'grand' },
};

/* Stilisierte Kontinente (equirektangulär, 1000×500) */
const CONTINENT_SHAPES = [
  'M40,60 L120,38 L250,28 L340,40 L360,92 L322,122 L304,162 L262,176 L242,202 L216,214 L196,186 L160,162 L128,122 L80,96 Z',
  'M330,18 L402,12 L424,38 L382,70 L342,56 Z',
  'M268,214 L322,212 L392,250 L402,292 L372,332 L342,382 L322,404 L310,362 L298,302 L278,262 Z',
  'M478,84 L500,52 L532,32 L596,36 L668,46 L672,118 L630,130 L596,142 L572,160 L532,166 L496,174 L472,160 L480,120 Z',
  'M452,80 L478,74 L482,106 L460,110 Z',
  'M466,160 L540,150 L602,156 L622,190 L652,216 L632,252 L612,302 L590,342 L560,352 L540,312 L520,262 L480,242 L458,202 Z',
  'M604,160 L662,164 L668,202 L636,216 L614,192 Z',
  'M642,58 L722,38 L852,38 L962,58 L992,90 L932,122 L902,162 L862,202 L822,222 L792,230 L762,212 L722,212 L692,192 L662,190 L642,170 L622,150 L644,112 Z',
  'M872,122 L896,128 L892,162 L878,160 Z',
  'M768,238 L832,238 L852,270 L792,276 Z',
  'M858,308 L922,298 L962,330 L952,372 L902,382 L858,362 Z',
  'M962,362 L986,366 L982,392 L964,388 Z',
];

function worldState() {
  if (!S.world) S.world = { start: null, owned: {}, conquests: 0, attempts: {}, uprisings: {}, continents: {}, lastTribute: Date.now(), done: false };
  return S.world;
}
function isOwned(id) { return !!worldState().owned[id]; }
function attackable(id) {
  const w = worldState();
  return !isOwned(id) && (NEIGHBORS[id] || []).some((n) => w.owned[n]);
}
function ownedCount() { return Object.keys(worldState().owned).length; }

function worldMult(t) {
  const tier = TERR[t].tier;
  return Math.min(1.65, 0.9 + 0.022 * ownedCount() + 0.07 * (tier - 1));
}
function conquestReward(t) { return 150 + 60 * TERR[t].tier + 12 * ownedCount(); }
function tributeRate() {
  const w = worldState();
  return Object.keys(w.owned).filter((id) => !w.uprisings[id]).reduce((a, id) => a + 6 + 4 * TERR[id].tier, 0);
}
function tributePending() {
  const w = worldState();
  const h = Math.min(12, (Date.now() - w.lastTribute) / 3600000);
  return Math.floor(h * tributeRate());
}
function claimTribute() {
  const v = tributePending();
  if (v < 1) { toast('Noch kein Tribut angefallen'); return; }
  worldState().lastTribute = Date.now();
  addVotes(v);
  toast(`💰 Tribut eingesammelt: +${v} 🗳️`, 'good');
  saveState();
  renderWorld();
}

/* Verteidiger eines Gebiets: Politiker der Region, Stärke relativ zum Spieler */
function worldDefender(tid, playerPower, kind) {
  const t = TERR[tid];
  const w = worldState();
  const attempt = w.attempts[tid] || 0;
  const seed = hashStr(`world|${tid}|${attempt}|${w.conquests}`);
  const mult = kind === 'uprising' ? Math.max(0.85, worldMult(tid) - 0.1) : worldMult(tid);
  const stage = 1 + ownedCount();
  const army = makeAiArmy(stage, seed, playerPower, mult, { region: t.region, flags: t.flags || [] });
  army.name = kind === 'uprising' ? `Aufständische · ${t.name}` : `Regierung von ${t.name}`;
  army.player = `${TIER_INFO[t.tier].icon} ${TIER_INFO[t.tier].name} · ${Math.round(mult * 100)} % deiner Stärke`;
  return army;
}

/* Ergebnis einer Weltkarten-Schlacht anwenden */
function resolveWorldBattle(tid, kind, outcome) {
  const w = worldState();
  const t = TERR[tid];
  const res = { reward: 0, xp: 0, lines: [] };
  if (kind === 'uprising') {
    if (outcome === 'win') {
      delete w.uprisings[tid];
      res.reward = 100 + 30 * t.tier;
      res.xp = 40;
      res.lines.push(`✊ Aufstand niedergeschlagen: ${t.name} ist wieder sicher.`);
    } else res.lines.push(`⚠️ Der Aufstand (${t.name}) geht weiter.`);
    saveState();
    return res;
  }
  if (outcome !== 'win') {
    w.attempts[tid] = (w.attempts[tid] || 0) + 1;
    res.reward = 20;
    res.lines.push(`${t.name} konnte sich verteidigen. Beim nächsten Versuch tritt eine neue Regierung an.`);
    saveState();
    return res;
  }
  res.reward = conquestReward(tid);
  res.xp = 50 + 30 * t.tier;
  w.owned[tid] = { since: Date.now() };
  w.conquests++;
  if (typeof track === 'function') track('conquer');
  res.lines.push(`🚩 ${t.name} gehört jetzt zu deinem Reich!`);

  // Aufstände: ignorierte Aufstände kosten Gebiete
  for (const [id, deadline] of Object.entries(w.uprisings)) {
    if (w.conquests >= deadline) {
      delete w.uprisings[id];
      delete w.owned[id];
      res.lines.push(`💥 ${TERR[id].name} ist nach dem Aufstand verloren gegangen!`);
    }
  }
  if (w.conquests % 3 === 0 && ownedCount() >= 4) {
    const cands = Object.keys(w.owned).filter((id) => id !== w.start && id !== tid && !w.uprisings[id] && (NEIGHBORS[id] || []).some((n) => !w.owned[n]));
    if (cands.length) {
      const id = cands[Math.floor(Math.random() * cands.length)];
      w.uprisings[id] = w.conquests + 3;
      res.lines.push(`🔥 Aufstand: ${TERR[id].name}! Schlage ihn innerhalb von 3 Eroberungen nieder, sonst geht das Gebiet verloren.`);
    }
  }
  // Kontinente
  for (const r of Object.keys(REGIONS)) {
    if (w.continents[r]) continue;
    const all = WORLD_TERRITORIES.filter((x) => x.region === r);
    if (all.every((x) => w.owned[x.id])) {
      w.continents[r] = Date.now();
      const bonus = 1000;
      res.reward += bonus;
      const pool = POLITICIANS.filter((p) => p.region === r && (p.rarity === 'L' || p.rarity === 'E'));
      const fresh = pool.filter((p) => !S.collection[p.id]);
      const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
      const info = grantCard(pick.id);
      res.lines.push(`🏆 ${REGIONS[r].name} vollständig erobert! +${bonus} 🗳️ und ${pick.name} schließt sich dir an${info.isNew ? ' (neu!)' : ` (Lv ${info.level})`}.`);
    }
  }
  if (!w.done && ownedCount() === WORLD_TERRITORIES.length) {
    w.done = true;
    res.reward += 5000;
    res.lines.push('🌍 WELTHERRSCHAFT! Du regierst den ganzen Planeten. +5000 🗳️');
  }
  saveState();
  return res;
}

/* ---------- Oberfläche ---------- */
let worldSel = null;

function chooseStart(id) {
  const w = worldState();
  w.start = id;
  w.owned[id] = { since: Date.now() };
  w.lastTribute = Date.now();
  saveState();
  worldSel = null;
  toast(`🏠 ${TERR[id].name} ist deine Heimat. Erobere die Welt!`, 'good');
  renderWorld();
}

function renderWorld() {
  const root = $('#world-root');
  if (!root) return;
  const w = worldState();
  const choosing = !w.start;
  const n = ownedCount();
  const terrClass = (t) => {
    if (choosing) return t.start ? 'start' : 'locked';
    if (w.uprisings[t.id]) return 'uprising';
    if (w.owned[t.id]) return 'owned';
    if (attackable(t.id)) return 'target';
    return 'locked';
  };
  const edgeSvg = WORLD_EDGES.map(([a, b]) => {
    const A = TERR[a], B = TERR[b];
    let x2 = B.x, y2 = B.y, extra = '';
    // Pazifik-Verbindungen um die Kartenkante herum
    if (Math.abs(A.x - B.x) > 500) {
      const [L, R] = A.x < B.x ? [A, B] : [B, A];
      return `<line x1="${L.x}" y1="${L.y}" x2="0" y2="${(L.y + R.y) / 2}" class="edge sea"/><line x1="${R.x}" y1="${R.y}" x2="1000" y2="${(L.y + R.y) / 2}" class="edge sea"/>`;
    }
    const sea = (a === 'gbr' && b === 'can') || (a === 'wes' && b === 'bra');
    const both = w.owned[a] && w.owned[b];
    return `<line x1="${A.x}" y1="${A.y}" x2="${x2}" y2="${y2}" class="edge ${sea ? 'sea' : ''} ${both ? 'own' : ''}"/>${extra}`;
  }).join('');
  const nodes = WORLD_TERRITORIES.map((t) => {
    const cls = terrClass(t);
    const r = 9 + t.tier * 2;
    return `<g class="terr ${cls} ${worldSel === t.id ? 'sel' : ''}" data-t="${t.id}" transform="translate(${t.x},${t.y})">
      <circle r="${r + 5}" class="halo"/><circle r="${r}" class="dot" style="--rc:${REGIONS[t.region].color}"/>
      <text class="ico" y="4">${cls === 'uprising' ? '🔥' : w.owned[t.id] ? (t.id === w.start ? '🏠' : '🚩') : TIER_INFO[t.tier].icon}</text>
      <text class="lbl ${t.tier === 1 ? 'small' : ''}" y="${r + 12}">${esc(t.name)}</text></g>`;
  }).join('');
  const cont = Object.entries(REGIONS).map(([k, R]) => {
    const all = WORLD_TERRITORIES.filter((t) => t.region === k);
    const own = all.filter((t) => w.owned[t.id]).length;
    return `<div class="cont"><span>${R.icon} ${R.name}</span><div class="pbar"><i style="width:${(own / all.length) * 100}%;background:${R.color}"></i></div><small>${own}/${all.length}${w.continents[k] ? ' ✅' : ''}</small></div>`;
  }).join('');
  root.innerHTML = `
    <div class="world-top">
      <div><h2>🌍 Weltkarte <small>${choosing ? 'Wähle deine Heimat' : `${n}/${WORLD_TERRITORIES.length} Gebiete · ${w.conquests} Eroberungen`}</small></h2>
        <div class="conts">${cont}</div></div>
      ${choosing ? '' : `<div class="side-box tribute"><div class="help">💰 Tribut: <b>${tributeRate()} 🗳️/h</b> (max. 12 h)</div><div class="big-num">${fmt(tributePending())} 🗳️</div><button class="btn gold" id="w-tribute" ${tributePending() < 1 ? 'disabled' : ''}>Tribut einsammeln</button></div>`}
    </div>
    <div class="world-layout">
      <div class="world-map"><svg viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid meet">
        <rect width="1000" height="420" class="ocean"/>
        ${CONTINENT_SHAPES.map((d) => `<path d="${d}" class="land"/>`).join('')}
        ${edgeSvg}${nodes}
      </svg></div>
      <div class="world-side" id="world-side"></div>
    </div>`;
  if ($('#w-tribute')) $('#w-tribute').onclick = claimTribute;
  $$('.terr', root).forEach((g) => (g.onclick = () => { worldSel = g.dataset.t; renderWorld(); }));
  renderWorldSide();
}

function renderWorldSide() {
  const side = $('#world-side');
  const w = worldState();
  const choosing = !w.start;
  if (!worldSel) {
    const ups = Object.entries(w.uprisings);
    side.innerHTML = `<div class="side-box"><h3>${choosing ? '🏠 Wähle deine Heimat' : '🗺️ Feldzugsplan'}</h3>
      <p class="help">${choosing
        ? 'Wähle eines der vier Startgebiete (👑/🏰 mit hellem Rand). Von dort eroberst du Nachbargebiet für Nachbargebiet die ganze Welt.'
        : 'Klicke ein <b>gold umrandetes Gebiet</b> an, um es anzugreifen. Angreifen kannst du nur Nachbarn deines Reiches. Jede Eroberung macht die Verteidiger stärker, 🏰 Festungen und 👑 Großmächte sind besonders hart. Eroberte Gebiete zahlen Tribut, ganze Kontinente bringen 1000 Stimmen und einen epischen oder legendären Politiker.'}</p>
      ${ups.length ? `<h3>🔥 Aufstände</h3>${ups.map(([id, d]) => `<div class="mini-row"><b>${esc(TERR[id].name)}</b><span class="help">noch ${d - w.conquests} Eroberung(en)</span><button class="btn small danger" data-up="${id}">Niederschlagen</button></div>`).join('')}` : ''}
      </div>`;
    $$('[data-up]', side).forEach((b) => (b.onclick = () => launchWorldBattle(b.dataset.up, 'uprising')));
    return;
  }
  const t = TERR[worldSel];
  const owned = w.owned[t.id];
  const tier = TIER_INFO[t.tier];
  let body;
  if (choosing) {
    body = t.start ? `<p class="help">Ein starker Ausgangspunkt in ${REGIONS[t.region].name}.</p><button class="btn primary big" id="w-start">🏠 Hier beginnen</button>` : '<p class="help">Kein Startgebiet. Wähle eines der vier hervorgehobenen Gebiete.</p>';
  } else if (w.uprisings[t.id]) {
    body = `<p class="status warn">🔥 Aufstand! Noch ${w.uprisings[t.id] - w.conquests} Eroberung(en), bevor das Gebiet verloren geht. Während des Aufstands zahlt es keinen Tribut.</p>
      <button class="btn danger big" id="w-up">✊ Aufstand niederschlagen</button>`;
  } else if (owned) {
    body = `<p class="status ok">🚩 Teil deines Reiches${t.id === w.start ? ' (Heimat)' : ''}.</p><p class="help">Tribut: ${6 + 4 * t.tier} 🗳️ pro Stunde.</p>`;
  } else if (attackable(t.id)) {
    const pw = alliancePower(activeAlliance() ? activeAlliance().members : []);
    const def = worldDefender(t.id, pw || 500);
    const sel = S.worldMode && BATTLE_MODES[S.worldMode] ? S.worldMode : tier.mode;
    body = `<p class="help">Verteidiger: <b>${esc(def.name)}</b>, ${Math.round(worldMult(t.id) * 100)} % deiner Stärke</p>
      <div class="def-list">${def.members.map((m) => { const p = POL_BY_ID[m.id]; return `<div class="mini-row"><div class="mini-por" data-portrait="${p.id}" style="--rc:${RARITIES[p.rarity].color}"><span>${esc(initials(p.name))}</span></div><div><b>${esc(p.name)}</b> <span class="help">Lv ${m.level} · ${CLASSES[p.cls].icon}</span></div></div>`; }).join('')}</div>
      <p class="help">Belohnung: <b>${conquestReward(t.id)} 🗳️</b> + ${6 + 4 * t.tier} 🗳️/h Tribut</p>
      <div class="row"><label class="help">Schlachtart:</label><select id="w-mode">${Object.values(BATTLE_MODES).map((c) => `<option value="${c.key}" ${c.key === sel ? 'selected' : ''}>${c.icon} ${c.name}${c.key === tier.mode ? ' (empfohlen)' : ''}</option>`).join('')}</select></div>
      <button class="btn primary big" id="w-attack" style="margin-top:10px">⚔️ ${esc(t.name)} angreifen</button>`;
  } else {
    body = '<p class="help">🔒 Noch nicht erreichbar. Erobere zuerst ein Nachbargebiet.</p>';
  }
  side.innerHTML = `<div class="side-box"><h3>${tier.icon} ${esc(t.name)}</h3>
    <div class="help">${REGIONS[t.region].icon} ${REGIONS[t.region].name} · ${tier.name} · Nachbarn: ${(NEIGHBORS[t.id] || []).map((n) => esc(TERR[n].name)).join(', ')}</div>
    ${body}
    <button class="btn small" id="w-close" style="margin-top:10px">← Übersicht</button></div>`;
  Wiki.hydrate(side);
  $('#w-close').onclick = () => { worldSel = null; renderWorld(); };
  if ($('#w-start')) $('#w-start').onclick = () => chooseStart(t.id);
  if ($('#w-up')) $('#w-up').onclick = () => launchWorldBattle(t.id, 'uprising');
  if ($('#w-attack')) $('#w-attack').onclick = () => { S.worldMode = $('#w-mode').value; saveState(); launchWorldBattle(t.id, 'attack', S.worldMode); };
}

function launchWorldBattle(tid, kind, mode) {
  const al = activeAlliance();
  if (!al || !al.members.length) { toast('Stelle zuerst eine Allianz auf!', 'bad'); switchTab('alliances'); return; }
  switchTab('battle');
  BattleUI.startWorld(tid, kind, mode || (kind === 'uprising' ? 'classic' : TIER_INFO[TERR[tid].tier].mode));
}
