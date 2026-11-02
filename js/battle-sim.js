/* Deterministische Schlachtsimulation (Top-Down).
 * Gleicher Seed + gleiche Armeen + gleiche Befehle => identischer Verlauf auf allen Geräten.
 * Verwendet nur + - * / und Math.sqrt (IEEE-exakt), keine Trigonometrie.
 */
const SIM_DT = 0.05;
const DMG_SCALE = 0.7;
const sq = (v) => v * v; // statt ** – garantiert identisch auf allen JS-Engines

/* ---------- Schlachtmodi ---------- */
const BATTLE_MODES = {
  classic: {
    key: 'classic', name: 'Gefecht', icon: '⚔️', time: 150, map: 'standard', hqHp: 4500,
    desc: 'Die klassische Auto-Schlacht: Aufstellen, zuschauen, mitfiebern. Dauert etwa 1–2,5 Minuten.',
    reward: 1, friendCode: true,
  },
  grand: {
    key: 'grand', name: 'Feldzug', icon: '🗺️', time: 420, map: 'large', hqHp: 9000,
    supply: true, morale: true, waves: 45, forts: true,
    desc: 'Große Karte mit Fluss und Brücken, 5 befestigte Städte, Nachschublinien, Moral und Verstärkungswellen. Bis zu 7 Minuten.',
    reward: 2.2, friendCode: true,
  },
  command: {
    key: 'command', name: 'Kommando', icon: '🎖️', time: 210, map: 'standard', hqHp: 5500, command: true,
    desc: 'Du führst selbst: Bataillone auswählen und Ziele anklicken, Fähigkeiten von Hand auslösen, Einfluss für politische Maßnahmen ausgeben.',
    reward: 1.6, friendCode: false,
  },
};

/* Politische Maßnahmen (Kommando-Modus) */
const POLICIES = {
  propaganda: { key: 'propaganda', name: 'Propaganda', icon: '📢', cost: 30, cd: 10, r: 130, desc: 'Feinde im Gebiet verlieren 6 s lang 40 % Angriff.' },
  sanctions:  { key: 'sanctions',  name: 'Sanktionen', icon: '🛑', cost: 40, cd: 12, r: 150, desc: 'Feinde im Gebiet: 6 s lang halbes Tempo und halbe Feuerrate.' },
  medic:      { key: 'medic',      name: 'Feldlazarett', icon: '🚑', cost: 35, cd: 12, r: 130, desc: 'Eigene Truppen im Gebiet heilen 40 % ihrer Lebenspunkte.' },
  airstrike:  { key: 'airstrike',  name: 'Luftschlag', icon: '✈️', cost: 55, cd: 15, r: 85, desc: 'Nach 1,5 s schwere Explosion im Zielgebiet.' },
  reserves:   { key: 'reserves',   name: 'Reservisten', icon: '🚚', cost: 45, cd: 20, r: 0, needsBat: true, desc: '3 frische Einheiten für das gewählte Bataillon (starten am Regierungssitz).' },
};
const POLICY_ORDER = ['propaganda', 'sanctions', 'medic', 'airstrike', 'reserves'];
const CP_MAX = 100;

/* ---------- Karten ---------- */
function deployToWorld(map, team, pos) {
  const z = map.zone;
  let x = z.x0 + pos[0] * (z.x1 - z.x0);
  const y = z.y0 + pos[1] * (z.y1 - z.y0);
  if (team === 1) x = map.W - x;
  return { x, y };
}
function worldToDeploy(map, x, y) {
  const z = map.zone;
  return [
    Math.max(0, Math.min(1, (x - z.x0) / (z.x1 - z.x0))),
    Math.max(0, Math.min(1, (y - z.y0) / (z.y1 - z.y0))),
  ];
}

function generateMap(seed, kind = 'standard') {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  let map;
  if (kind === 'large') {
    map = {
      kind, seed, W: 1800, H: 1000,
      hq: [{ x: 80, y: 500 }, { x: 1720, y: 500 }],
      zone: { x0: 60, x1: 400, y0: 90, y1: 910 },
      points: [
        { x: 900, y: 170, name: 'Nordfurt' },
        { x: 900, y: 500, name: 'Hauptstadt' },
        { x: 900, y: 830, name: 'Südfurt' },
        { x: 560, y: 500, name: 'Westprovinz' },
        { x: 1240, y: 500, name: 'Ostprovinz' },
      ],
      river: { x: 900, half: 28 },
      bridges: [{ x: 900, y: 170, half: 48 }, { x: 900, y: 500, half: 48 }, { x: 900, y: 830, half: 48 }],
      forests: [], hills: [],
    };
  } else {
    map = {
      kind: 'standard', seed, W: 1200, H: 700,
      hq: [{ x: 70, y: 350 }, { x: 1130, y: 350 }],
      zone: { x0: 50, x1: 330, y0: 60, y1: 640 },
      points: [
        { x: 600, y: 130, name: 'Nordstadt' },
        { x: 600, y: 350, name: 'Hauptstadt' },
        { x: 600, y: 570, name: 'Südhafen' },
      ],
      river: null, bridges: [], forests: [], hills: [],
    };
  }
  const mid = map.W / 2;
  const xr = kind === 'large' ? [330, 800] : [360, 560];
  const blocked = (x, y, r) =>
    map.points.some((p) => sq(p.x - x) + sq(p.y - y) < sq(r + 60)) ||
    Math.abs(x - mid) < r + (map.river ? map.river.half + 10 : r * -0.6) ||
    map.hq.some((h) => sq(h.x - x) + sq(h.y - y) < sq(r + 120));
  const nF = (kind === 'large' ? 6 : 3) + Math.floor(rng() * 3);
  let tries = 0;
  while (map.forests.length < nF * 2 && tries++ < 400) {
    const r = 35 + rng() * 45, x = xr[0] + rng() * (xr[1] - xr[0]), y = 60 + rng() * (map.H - 120);
    if (blocked(x, y, r)) continue;
    map.forests.push({ x, y, r }, { x: map.W - x, y, r });
  }
  tries = 0;
  const nH = (kind === 'large' ? 3 : 2) + Math.floor(rng() * 2);
  while (map.hills.length < nH * 2 && tries++ < 400) {
    const r = 40 + rng() * 30, x = xr[0] + 20 + rng() * (xr[1] - xr[0] - 30), y = 70 + rng() * (map.H - 140);
    if (blocked(x, y, r)) continue;
    if (map.forests.some((f) => sq(f.x - x) + sq(f.y - y) < sq(f.r + r))) continue;
    map.hills.push({ x, y, r }, { x: map.W - x, y, r });
  }
  if (!map.river && rng() < 0.6) map.forests.push({ x: mid, y: rng() < 0.5 ? 240 : 460, r: 30 + rng() * 15 });
  return map;
}

/* ---------- Schlacht ---------- */
class Battle {
  /* opts: { mode: 'classic'|'grand'|'command', control: ['auto'|'player'|'ai', …] } */
  constructor(seed, armies, opts = {}) {
    this.seed = seed >>> 0;
    this.mode = BATTLE_MODES[opts.mode] ? opts.mode : 'classic';
    this.cfg = BATTLE_MODES[this.mode];
    this.control = opts.control || ['auto', 'auto'];
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.map = generateMap(this.seed, this.cfg.map);
    this.W = this.map.W; this.H = this.map.H;
    this.maxTime = this.cfg.time;
    this.hqHp = this.cfg.hqHp;
    this.armies = armies;
    this.units = [];
    this.bats = [];
    this.shells = [];
    this.strikes = [];
    this.hits = [];
    this.fx = [];
    this.fxEnabled = false;
    this.log = [];
    this.time = 0;
    this.tick = 0;
    this.score = [0, 0];
    this.morale = [100, 100];
    this.cp = [20, 20];
    this.pcd = [{}, {}];
    this.cmdQueue = [];
    this.nextWave = this.cfg.waves || 0;
    this.over = false;
    this.winner = null;
    this.reason = '';
    this.nextId = 1;
    this.points = this.map.points.map((p) => ({ ...p, owner: -1, prog: 0, cd: 0 }));
    this.hq = [0, 1].map((t) => this.addUnit({ team: t, bat: -1, cls: 'hq', x: this.map.hq[t].x, y: this.map.hq[t].y, hp: this.hqHp, atk: 34, range: 170, speed: 0, cd: 1.0, r: 26, leader: false }));
    this.hqWarned = [false, false];
    this.aiState = [{ defend: false }, { defend: false }];
    armies.forEach((army, team) => this.spawnArmy(army, team));
  }

  addUnit(o) {
    const u = Object.assign({ id: this.nextId++, alive: true, maxHp: o.hp, cdLeft: 0, target: null, retarget: 0, ceaseT: 0, weakT: 0, slowT: 0, hitT: -9, unsup: false }, o);
    u.retarget = (u.id % 7) * 0.05;
    this.units.push(u);
    return u;
  }

  spawnArmy(army, team) {
    const ids = army.members.map((m) => m.id);
    const syn = computeSynergies(ids);
    army.members.forEach((m) => {
      const p = POL_BY_ID[m.id];
      const C = CLASSES[p.cls];
      const s = syn.per[m.id];
      const lv = 1 + LEVEL_BONUS * (m.level - 1);
      const bat = {
        idx: this.bats.length, team, pid: p.id, name: p.name, cls: p.cls, level: m.level,
        atk: C.atk * (0.55 + p.atk / 100) * lv * s.atk,
        hp: C.hp * (0.55 + p.def / 100) * lv * s.hp,
        speed: C.speed * (0.85 + p.tac / 400) * s.spd,
        abilityCd: C.abilityCd * (1.25 - p.tac / 200) * Math.max(0.35, s.cd),
        leaderMul: s.leader || 1, regen: s.regen || 0,
        abilityLeft: 0, shieldT: 0, blitzT: 0,
        manual: this.control[team] === 'player',
        leaderGone: false, leaderId: 0, units: [], startCount: C.count + (s.units || 0),
        objective: null, objTimer: 0, laneY: 0, order: null,
        dmg: 0, kills: 0, heal: 0, spawned: 0, abilities: 0,
      };
      bat.abilityLeft = bat.abilityCd * (0.35 + 0.1 * (bat.idx % 3));
      const c = deployToWorld(this.map, team, m.pos);
      bat.laneY = c.y;
      this.bats.push(bat);
      for (let i = 0; i < bat.startCount; i++) {
        const leader = i === 0;
        const ring = leader ? 0 : 1 + Math.floor((i - 1) / 6);
        const k = (i - 1) % 6;
        const ox = leader ? 0 : [1, 0.5, -0.5, -1, -0.5, 0.5][k] * 16 * ring;
        const oy = leader ? 0 : [0, 0.87, 0.87, 0, -0.87, -0.87][k] * 16 * ring;
        this.addBatUnit(bat, c.x + (team === 0 ? ox : -ox), c.y + oy, leader);
      }
    });
  }

  addBatUnit(bat, x, y, leader) {
    const C = CLASSES[bat.cls];
    const u = this.addUnit({
      team: bat.team, bat: bat.idx, cls: bat.cls, x, y, hp: bat.hp * (leader ? 2.5 * bat.leaderMul : 1), atk: bat.atk * (leader ? 1.3 * bat.leaderMul : 1),
      range: C.range, speed: bat.speed, cd: C.cd, r: C.r + (leader ? 4 : 0), leader, splash: C.splash || 0,
    });
    u.cdLeft = this.rng() * C.cd;
    bat.units.push(u.id);
    if (leader) bat.leaderId = u.id;
    return u;
  }

  unitById(id) { return this.units.find((u) => u.id === id); }
  batAlive(bat) { return bat.units.some((id) => { const u = this.unitById(id); return u && u.alive; }); }
  batUnits(bat) { return this.units.filter((u) => u.alive && u.bat === bat.idx); }
  ownedPoints(team) { return this.points.filter((p) => p.owner === team).length; }

  inForest(x, y) { return this.map.forests.some((f) => sq(f.x - x) + sq(f.y - y) < f.r * f.r); }
  onHill(x, y) { return this.map.hills.some((h) => sq(h.x - x) + sq(h.y - y) < h.r * h.r); }
  inRiver(x, y) {
    const R = this.map.river;
    if (!R || Math.abs(x - R.x) > R.half) return false;
    return !this.map.bridges.some((b) => Math.abs(y - b.y) < b.half);
  }

  emit(e) { if (this.fxEnabled) this.fx.push(e); }
  say(text, team, kind = '') { this.log.push({ t: this.time, text, team, kind }); }

  centroid(units) {
    let x = 0, y = 0;
    units.forEach((u) => { x += u.x; y += u.y; });
    return { x: x / units.length, y: y / units.length };
  }

  nearestEnemy(u, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const e of this.units) {
      if (!e.alive || e.team === u.team) continue;
      const d = sq(e.x - u.x) + sq(e.y - u.y) - (e.cls === 'hq' ? 600 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  moraleHit(team, amount, text) {
    if (!this.cfg.morale) return;
    const before = this.morale[team];
    this.morale[team] = Math.max(0, Math.min(100, this.morale[team] - amount));
    if (text && amount > 0) this.say(`${text} (Moral −${amount})`, team, 'morale');
    if (before >= 30 && this.morale[team] < 30) this.say(`Die Moral von ${this.armies[team].name} bricht ein!`, team, 'morale');
  }

  updateObjective(bat, units) {
    const cen = this.centroid(units);
    const team = bat.team;
    const enemyHq = this.hq[1 - team];
    const ownHq = this.hq[team];
    if (bat.cls === 'art' || bat.cls === 'dip') {
      let best = null, bd = Infinity;
      for (const b of this.bats) {
        if (b.team !== team || b === bat || b.cls === 'art' || b.cls === 'dip') continue;
        const us = this.batUnits(b);
        if (!us.length) continue;
        const c = this.centroid(us);
        const d = sq(c.x - cen.x) + sq(c.y - cen.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        const back = bat.cls === 'art' ? 90 : 35;
        const dir = ownHq.x < enemyHq.x ? -1 : 1;
        bat.objective = { x: best.x + dir * back, y: best.y };
        return;
      }
    }
    let target = null, bd = Infinity;
    for (const p of this.points) {
      if (p.owner === team) continue;
      const d = Math.sqrt(sq(p.x - cen.x) + sq(p.y - cen.y)) + Math.abs(p.y - bat.laneY) * 0.8;
      if (d < bd) { bd = d; target = p; }
    }
    bat.objective = target ? { x: target.x + (this.rng() - 0.5) * 30, y: target.y + (this.rng() - 0.5) * 30 } : { x: enemyHq.x, y: enemyHq.y };
  }

  moveToward(u, tx, ty, mult = 1) {
    // Flussüberquerung: über die nächste Brücke umleiten
    const R = this.map.river;
    if (R && Math.abs(u.x - R.x) > R.half - 4 && (u.x - R.x) * (tx - R.x) < 0) {
      let best = null, bd = Infinity;
      for (const b of this.map.bridges) {
        const d = Math.abs(u.y - b.y) + Math.abs(ty - b.y) * 0.5;
        if (d < bd) { bd = d; best = b; }
      }
      if (best && Math.abs(u.y - best.y) > best.half * 0.6) {
        tx = best.x + (u.x < R.x ? -R.half - 12 : R.half + 12);
        ty = best.y;
      } else if (best) {
        ty = best.y + Math.max(-best.half * 0.6, Math.min(best.half * 0.6, u.y - best.y));
      }
    }
    const dx = tx - u.x, dy = ty - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return;
    let sp = u.speed * mult * SIM_DT;
    if (this.inForest(u.x, u.y)) sp *= 0.65;
    if (this.inRiver(u.x, u.y)) sp *= 0.3;
    if (u.slowT > 0) sp *= 0.5;
    const bat = this.bats[u.bat];
    if (bat && bat.blitzT > 0) sp *= 2;
    if (sp > d) sp = d;
    u.x += (dx / d) * sp;
    u.y += (dy / d) * sp;
  }

  damage(target, amount, src) {
    if (!target.alive) return;
    if (target.cls !== 'hq') {
      if (this.inForest(target.x, target.y)) amount *= 0.7;
      const tb = this.bats[target.bat];
      if (tb.shieldT > 0) amount *= 0.4;
    }
    target.hp -= amount;
    target.hitT = this.time;
    const sb = src && src.bat >= 0 ? this.bats[src.bat] : null;
    if (sb) sb.dmg += Math.min(amount, amount + target.hp);
    if (target.hp <= 0) {
      target.alive = false;
      target.hp = 0;
      if (sb) sb.kills++;
      this.emit({ type: 'death', x: target.x, y: target.y, team: target.team, cls: target.cls, leader: target.leader });
      if (target.cls === 'hq') return;
      const tb = this.bats[target.bat];
      if (target.leader && !tb.leaderGone) {
        tb.leaderGone = true;
        tb.order = null;
        this.say(`${tb.name} tritt zurück! Das Bataillon kämpft führungslos weiter.`, tb.team, 'resign');
        this.emit({ type: 'text', x: target.x, y: target.y - 20, text: 'Rücktritt!', team: tb.team });
        this.moraleHit(tb.team, 5);
      }
      if (!this.batAlive(tb)) {
        this.say(`Das Bataillon von ${tb.name} wurde aufgerieben.`, tb.team, 'wiped');
        this.moraleHit(tb.team, 4);
      }
    } else if (target.cls === 'hq' && !this.hqWarned[target.team] && target.hp < this.hqHp * 0.5) {
      this.hqWarned[target.team] = true;
      this.say(`Der Regierungssitz von ${this.armies[target.team].name} wankt!`, target.team, 'hq');
      this.moraleHit(target.team, 10);
    }
  }

  attack(u, t) {
    const C = CLASSES[u.cls];
    let dmg = u.atk * DMG_SCALE * (0.85 + 0.3 * this.rng());
    if (u.cls !== 'hq') {
      const bat = this.bats[u.bat];
      if (bat.leaderGone) dmg *= 0.85;
      if (bat.blitzT > 0) dmg *= 1.6;
      if (u.weakT > 0) dmg *= 0.6;
      if (u.unsup) dmg *= 0.75;
      if (this.cfg.morale && this.morale[u.team] < 30) dmg *= 0.85;
      const ctr = COUNTERS[u.cls] && COUNTERS[u.cls][t.cls];
      if (ctr) dmg *= ctr;
    }
    if (u.cls === 'art') {
      const d = Math.sqrt(sq(t.x - u.x) + sq(t.y - u.y));
      this.shells.push({ team: u.team, src: u.id, bat: u.bat, x0: u.x, y0: u.y, x: t.x, y: t.y, t: 0, dur: 0.25 + d / 380, delay: 0, dmg, splash: C.splash });
    } else {
      this.hits.push([t, dmg, u]); // gleichzeitige Auflösung – kein Erstschlag-Vorteil
    }
    this.emit({ type: 'shot', x1: u.x, y1: u.y, x2: t.x, y2: t.y, team: u.team, cls: u.cls });
  }

  /* manual = vom Spieler ausgelöst: wirkt auch ohne Feindkontakt (außer Artillerie ohne Ziel) */
  useAbility(bat, units, manual = false) {
    const leader = this.unitById(bat.leaderId);
    if (!leader || !leader.alive) return false;
    const C = CLASSES[bat.cls];
    const near = (r) => this.units.filter((e) => e.alive && e.team !== bat.team && e.cls !== 'hq' && sq(e.x - leader.x) + sq(e.y - leader.y) < r * r);
    let used = false;
    if (bat.cls === 'inf') {
      if (units.length < C.count + 8 && (manual || near(320).length || this.time > 8)) {
        for (let i = 0; i < 2; i++) this.addBatUnit(bat, leader.x + (this.rng() - 0.5) * 30, leader.y + (this.rng() - 0.5) * 30, false);
        bat.spawned += 2;
        used = true;
      }
    } else if (bat.cls === 'tank') {
      if (manual || near(170).length) { bat.shieldT = 5; used = true; }
    } else if (bat.cls === 'cav') {
      if (manual || near(230).length) { bat.blitzT = 3; used = true; }
    } else if (bat.cls === 'art') {
      const cands = near(manual ? 380 : 340);
      if (cands.length) {
        let best = cands[0], bc = -1;
        for (const c of cands) {
          let k = 0;
          for (const o of cands) if (sq(o.x - c.x) + sq(o.y - c.y) < 3600) k++;
          if (k > bc) { bc = k; best = c; }
        }
        for (let i = 0; i < 5; i++) {
          const tx = best.x + (this.rng() - 0.5) * 60, ty = best.y + (this.rng() - 0.5) * 60;
          const d = Math.sqrt(sq(tx - leader.x) + sq(ty - leader.y));
          this.shells.push({ team: bat.team, src: leader.id, bat: bat.idx, x0: leader.x, y0: leader.y, x: tx, y: ty, t: 0, dur: 0.3 + d / 380, delay: i * 0.22, dmg: bat.atk * DMG_SCALE * 1.4, splash: 45, big: true });
        }
        used = true;
      }
    } else if (bat.cls === 'dip') {
      const enemies = near(170);
      const allies = this.units.filter((a) => a.alive && a.team === bat.team && a.cls !== 'hq' && sq(a.x - leader.x) + sq(a.y - leader.y) < 170 * 170);
      const hurt = allies.filter((a) => a.hp < a.maxHp * 0.8);
      if (manual || enemies.length || hurt.length >= 3) {
        enemies.forEach((e) => (e.ceaseT = 3));
        allies.forEach((a) => { const h = Math.min(a.maxHp - a.hp, a.maxHp * 0.25); a.hp += h; bat.heal += h; });
        used = true;
      }
    }
    if (used) {
      bat.abilityLeft = bat.abilityCd;
      bat.abilities++;
      this.emit({ type: 'ability', x: leader.x, y: leader.y, team: bat.team, cls: bat.cls, name: C.ability, bat: bat.idx });
      this.say(`${bat.name}: ${C.ability}!`, bat.team, 'ability');
    } else if (!manual) {
      bat.abilityLeft = 0.5;
    } else {
      this.emit({ type: 'text', x: leader.x, y: leader.y - 24, text: 'Kein Ziel in Reichweite', team: bat.team });
    }
    return used;
  }

  /* ---------- Befehle (Kommando-Modus) ---------- */
  queueCommand(team, cmd) { this.cmdQueue.push({ team, cmd }); }

  canPolicy(team, key) {
    const P = POLICIES[key];
    return this.cfg.command && P && this.cp[team] >= P.cost && !(this.pcd[team][key] > 0);
  }

  surrender(team) {
    if (this.over) return;
    this.say(`${this.armies[team].name} gibt auf.`, team, 'end');
    this.end(1 - team, `${this.armies[team].name} hat aufgegeben`);
  }

  applyCommand(team, cmd) {
    if (cmd && cmd.c === 'surrender') { this.surrender(team); return; }
    if (!cmd || typeof cmd !== 'object' || this.control[team] === 'auto') return;
    const bat = Number.isInteger(cmd.b) ? this.bats[cmd.b] : null;
    if (bat && bat.team !== team) return;
    const cx = (v) => Math.max(10, Math.min(this.W - 10, +v || 0));
    const cy = (v) => Math.max(10, Math.min(this.H - 10, +v || 0));
    if (cmd.c === 'move' && bat) {
      const us = this.batUnits(bat);
      if (!us.length) return;
      bat.order = { x: cx(cmd.x), y: cy(cmd.y), arrived: false };
    } else if (cmd.c === 'hold' && bat) {
      const us = this.batUnits(bat);
      if (!us.length) return;
      const c = this.centroid(us);
      bat.order = { x: c.x, y: c.y, arrived: true };
    } else if (cmd.c === 'free' && bat) {
      bat.order = null;
      bat.objTimer = 0;
    } else if (cmd.c === 'ability' && bat) {
      if (bat.leaderGone || bat.abilityLeft > 0) return;
      this.useAbility(bat, this.batUnits(bat), true);
    } else if (cmd.c === 'policy') {
      this.castPolicy(team, cmd.p, cx(cmd.x), cy(cmd.y), bat);
    }
  }

  castPolicy(team, key, x, y, bat) {
    if (!this.canPolicy(team, key)) return false;
    const P = POLICIES[key];
    const enemiesIn = (r) => this.units.filter((e) => e.alive && e.team !== team && e.cls !== 'hq' && sq(e.x - x) + sq(e.y - y) < r * r);
    if (key === 'reserves') {
      if (!bat || !this.batUnits(bat).length) return false;
      const hq = this.map.hq[team];
      for (let i = 0; i < 3; i++) this.addBatUnit(bat, hq.x + (team === 0 ? 40 : -40) + (this.rng() - 0.5) * 30, hq.y + (this.rng() - 0.5) * 60, false);
      bat.spawned += 3;
      x = hq.x; y = hq.y;
    } else if (key === 'propaganda') {
      enemiesIn(P.r).forEach((e) => (e.weakT = 6));
    } else if (key === 'sanctions') {
      enemiesIn(P.r).forEach((e) => (e.slowT = 6));
    } else if (key === 'medic') {
      this.units.forEach((a) => {
        if (!a.alive || a.team !== team || a.cls === 'hq' || sq(a.x - x) + sq(a.y - y) >= P.r * P.r) return;
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.4);
      });
    } else if (key === 'airstrike') {
      this.strikes.push({ team, x, y, r: P.r, delay: 1.5, dmg: 150 });
    }
    this.cp[team] -= P.cost;
    this.pcd[team][key] = P.cd;
    this.emit({ type: 'policy', key, x, y, r: P.r, team });
    this.say(`${this.armies[team].name}: ${P.icon} ${P.name}!`, team, 'policy');
    return true;
  }

  /* KI für den Kommando-Modus (deterministisch, läuft in der Simulation) */
  aiThink(team) {
    const enemies = this.units.filter((e) => e.alive && e.team !== team && e.cls !== 'hq');
    const own = this.units.filter((e) => e.alive && e.team === team && e.cls !== 'hq');
    const cluster = (list, r) => {
      let best = null, bc = 0;
      for (let i = 0; i < list.length; i += 2) {
        const c = list[i];
        let k = 0;
        for (const o of list) if (sq(o.x - c.x) + sq(o.y - c.y) < r * r) k++;
        if (k > bc) { bc = k; best = c; }
      }
      return { at: best, n: bc };
    };
    if (this.canPolicy(team, 'airstrike')) {
      const c = cluster(enemies, 80);
      if (c.n >= 6) { this.castPolicy(team, 'airstrike', c.at.x, c.at.y); return; }
    }
    if (this.canPolicy(team, 'medic')) {
      const c = cluster(own.filter((u) => u.hp < u.maxHp * 0.6), 120);
      if (c.n >= 5) { this.castPolicy(team, 'medic', c.at.x, c.at.y); return; }
    }
    if (this.canPolicy(team, 'propaganda')) {
      const engaged = enemies.filter((e) => own.some((o) => sq(o.x - e.x) + sq(o.y - e.y) < 150 * 150));
      const c = cluster(engaged, 120);
      if (c.n >= 5) { this.castPolicy(team, 'propaganda', c.at.x, c.at.y); return; }
    }
    const hq = this.map.hq[team];
    const threat = enemies.filter((e) => sq(e.x - hq.x) + sq(e.y - hq.y) < 340 * 340);
    if (this.canPolicy(team, 'sanctions') && threat.length >= 4) {
      const c = this.centroid(threat);
      this.castPolicy(team, 'sanctions', c.x, c.y); return;
    }
    if (this.cp[team] >= 80 && this.canPolicy(team, 'reserves')) {
      let best = null, bm = 0;
      for (const b of this.bats) {
        if (b.team !== team) continue;
        const n = this.batUnits(b).length;
        if (n && b.startCount - n > bm) { bm = b.startCount - n; best = b; }
      }
      if (best) { this.castPolicy(team, 'reserves', 0, 0, best); return; }
    }
    // Verteidigung des Regierungssitzes
    const st = this.aiState[team];
    if (threat.length >= 4 && !st.defend) {
      st.defend = true;
      const tc = this.centroid(threat);
      const cands = this.bats.filter((b) => b.team === team && b.cls !== 'art' && this.batUnits(b).length)
        .map((b) => ({ b, d: sq(this.centroid(this.batUnits(b)).x - hq.x) + sq(this.centroid(this.batUnits(b)).y - hq.y) }))
        .sort((a, b) => a.d - b.d).slice(0, 2);
      cands.forEach(({ b }) => (b.order = { x: tc.x, y: tc.y, arrived: false, ai: true }));
    } else if (threat.length < 2 && st.defend) {
      st.defend = false;
      this.bats.forEach((b) => { if (b.team === team && b.order && b.order.ai) b.order = null; });
    }
  }

  /* ---------- Simulationsschritt ---------- */
  step() {
    if (this.over) return;
    // Befehle anwenden (Reihenfolge: Team 0, dann Team 1 – auf allen Geräten gleich)
    if (this.cmdQueue.length) {
      const q = this.cmdQueue;
      this.cmdQueue = [];
      q.filter((c) => c.team === 0).forEach((c) => this.applyCommand(0, c.cmd));
      q.filter((c) => c.team === 1).forEach((c) => this.applyCommand(1, c.cmd));
    }
    this.time += SIM_DT;
    this.tick++;

    if (this.cfg.command) {
      for (const t of [0, 1]) {
        this.cp[t] = Math.min(CP_MAX, this.cp[t] + SIM_DT * (1.2 + 0.5 * this.ownedPoints(t)));
        for (const k in this.pcd[t]) this.pcd[t][k] = Math.max(0, this.pcd[t][k] - SIM_DT);
        if (this.control[t] === 'ai' && this.tick % 20 === 0) this.aiThink(t);
      }
    }

    // Bataillone: Ziele, Fähigkeiten, Timer
    for (const bat of this.bats) {
      bat.shieldT = Math.max(0, bat.shieldT - SIM_DT);
      bat.blitzT = Math.max(0, bat.blitzT - SIM_DT);
      const units = this.batUnits(bat);
      if (!units.length) continue;
      if (bat.order && !bat.order.arrived) {
        const c = this.centroid(units);
        if (sq(c.x - bat.order.x) + sq(c.y - bat.order.y) < 45 * 45) bat.order.arrived = true;
      }
      bat.objTimer -= SIM_DT;
      if (bat.objTimer <= 0 || !bat.objective) { bat.objTimer = 1; this.updateObjective(bat, units); }
      if (!bat.leaderGone) {
        bat.abilityLeft -= SIM_DT;
        if (bat.manual) bat.abilityLeft = Math.max(0, bat.abilityLeft);
        else if (bat.abilityLeft <= 0) this.useAbility(bat, units);
      }
    }

    // Regeneration (Fraktionsbonus Grüne)
    if (this.tick % 10 === 0) {
      for (const u of this.units) {
        if (!u.alive || u.cls === 'hq') continue;
        const bat = this.bats[u.bat];
        if (bat.regen > 0 && this.time - u.hitT > 2) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * bat.regen * 0.5);
      }
    }

    // Nachschub (Feldzug)
    if (this.cfg.supply && this.tick % 10 === 0) {
      for (const u of this.units) {
        if (!u.alive || u.cls === 'hq') continue;
        const hq = this.map.hq[u.team];
        const dh = sq(u.x - hq.x) + sq(u.y - hq.y);
        let supplied = dh < 330 * 330, healing = dh < 160 * 160;
        for (const p of this.points) {
          if (p.owner !== u.team) continue;
          const d = sq(u.x - p.x) + sq(u.y - p.y);
          if (d < 300 * 300) supplied = true;
          if (d < 110 * 110) healing = true;
        }
        u.unsup = !supplied;
        if (healing && this.time - u.hitT > 3) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.005); // 1 % pro Sekunde
      }
    }

    // Moral erholt sich langsam durch gehaltene Städte (Feldzug)
    if (this.cfg.morale) for (const t of [0, 1]) this.morale[t] = Math.min(100, this.morale[t] + SIM_DT * 0.06 * this.ownedPoints(t));

    // Verstärkungswellen (Feldzug)
    if (this.cfg.waves && this.time >= this.nextWave) {
      this.nextWave += this.cfg.waves;
      for (const t of [0, 1]) {
        const owned = this.ownedPoints(t);
        let total = 0;
        const hq = this.map.hq[t];
        const spawnX = () => hq.x + (t === 0 ? 45 : -45) + (this.rng() - 0.5) * 40;
        const spawnY = () => hq.y + (this.rng() - 0.5) * 120;
        for (const bat of this.bats) {
          if (bat.team !== t) continue;
          if (bat.leaderGone) {
            // Comeback: Der Politiker kehrt aus dem Ruhestand zurück (kostet Moral, solange sie reicht)
            if (this.morale[t] < 15) continue;
            bat.leaderGone = false;
            bat.abilityLeft = bat.abilityCd * 0.5;
            this.addBatUnit(bat, spawnX(), spawnY(), true);
            this.say(`${bat.name} feiert ein politisches Comeback!`, t, 'comeback');
            total++;
          }
          const missing = bat.startCount - this.batUnits(bat).length;
          const n = Math.max(0, Math.min(missing, 2 + owned));
          for (let i = 0; i < n; i++) this.addBatUnit(bat, spawnX(), spawnY(), false);
          total += n;
        }
        if (total) this.say(`Verstärkung für ${this.armies[t].name}: ${total} Einheiten rücken aus.`, t, 'wave');
      }
    }

    // Einheiten
    for (const u of this.units) {
      if (!u.alive) continue;
      u.cdLeft -= SIM_DT * (u.slowT > 0 ? 0.5 : 1);
      if (u.ceaseT > 0) u.ceaseT -= SIM_DT;
      if (u.weakT > 0) u.weakT -= SIM_DT;
      if (u.slowT > 0) u.slowT -= SIM_DT;
      u.retarget -= SIM_DT;
      const rangeMul = u.cls !== 'hq' && this.onHill(u.x, u.y) ? (u.cls === 'art' ? 1.3 : 1.2) : 1;
      const range = u.range * rangeMul;
      if (u.retarget <= 0 || (u.target && !u.target.alive)) {
        u.retarget = 0.4;
        const aggro = u.cls === 'hq' ? range : u.cls === 'art' ? range + 40 : Math.max(range + 140, 200);
        u.target = this.nearestEnemy(u, aggro);
      }
      const t = u.target && u.target.alive ? u.target : null;

      // Diplomaten heilen bevorzugt
      if (u.cls === 'dip' && u.cdLeft <= 0) {
        let best = null, bf = 0.92;
        for (const a of this.units) {
          if (!a.alive || a.team !== u.team || a.cls === 'hq') continue;
          if (sq(a.x - u.x) + sq(a.y - u.y) > range * range) continue;
          const f = a.hp / a.maxHp;
          if (f < bf) { bf = f; best = a; }
        }
        if (best) {
          const h = Math.min(best.maxHp - best.hp, CLASSES.dip.heal * (u.atk / CLASSES.dip.atk));
          best.hp += h;
          this.bats[u.bat].heal += h;
          u.cdLeft = u.cd;
          this.emit({ type: 'heal', x1: u.x, y1: u.y, x2: best.x, y2: best.y, team: u.team });
        }
      }

      if (u.cls === 'hq') {
        if (t && u.cdLeft <= 0) {
          const d2 = sq(t.x - u.x) + sq(t.y - u.y);
          if (d2 <= sq(range + t.r)) { this.attack(u, t); u.cdLeft = u.cd; }
        }
        continue;
      }

      const bat = this.bats[u.bat];
      const order = bat.order;
      if (order) {
        const ox = u.leader ? 0 : (((u.id * 37) % 41) - 20) * (u.team === 0 ? 1 : -1);
        const oy = u.leader ? 0 : ((u.id * 53) % 41) - 20;
        if (t) {
          const d = Math.sqrt(sq(t.x - u.x) + sq(t.y - u.y));
          if (d <= range + t.r) {
            if (u.cdLeft <= 0 && u.ceaseT <= 0) { this.attack(u, t); u.cdLeft = u.cd; }
            if (!order.arrived) this.moveToward(u, order.x + ox, order.y + oy, 0.85);
            continue;
          }
          if (order.arrived && sq(t.x - order.x) + sq(t.y - order.y) < 170 * 170) { this.moveToward(u, t.x, t.y); continue; }
        }
        if (sq(u.x - order.x - ox) + sq(u.y - order.y - oy) > 36) this.moveToward(u, order.x + ox, order.y + oy);
        continue;
      }

      if (t) {
        const d = Math.sqrt(sq(t.x - u.x) + sq(t.y - u.y));
        if (d > range + t.r) {
          this.moveToward(u, t.x, t.y);
        } else if (u.cdLeft <= 0 && u.ceaseT <= 0) {
          this.attack(u, t);
          u.cdLeft = u.cd;
        }
      } else if (bat.objective) {
        const leader = this.unitById(bat.leaderId);
        let ox = 0, oy = 0;
        if (!u.leader && leader && leader.alive) { ox = (((u.id * 37) % 41) - 20) * (u.team === 0 ? 1 : -1); oy = ((u.id * 53) % 41) - 20; }
        this.moveToward(u, bat.objective.x + ox, bat.objective.y + oy, 0.9);
      }
    }

    // Befestigte Städte schießen (Feldzug)
    if (this.cfg.forts) {
      for (const p of this.points) {
        if (p.owner < 0) continue;
        p.cd -= SIM_DT;
        if (p.cd > 0) continue;
        let best = null, bd = 125 * 125;
        for (const e of this.units) {
          if (!e.alive || e.team === p.owner || e.cls === 'hq') continue;
          const d = sq(e.x - p.x) + sq(e.y - p.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          p.cd = 1.1;
          this.hits.push([best, 20 * DMG_SCALE, null]);
          this.emit({ type: 'shot', x1: p.x, y1: p.y - 20, x2: best.x, y2: best.y, team: p.owner, cls: 'fort' });
        }
      }
    }

    for (const [t, dmg, src] of this.hits) this.damage(t, dmg, src);
    this.hits.length = 0;

    // Separation (keine Überlappung)
    const live = this.units.filter((u) => u.alive);
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        const min = a.r + b.r + 1;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) / 2;
        const nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
        if (a.cls === 'hq') { b.x += nx * push * 2; b.y += ny * push * 2; }
        else if (b.cls === 'hq') { a.x -= nx * push * 2; a.y -= ny * push * 2; }
        else { a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
      }
    }
    for (const u of live) {
      if (u.x < 10) u.x = 10; if (u.x > this.W - 10) u.x = this.W - 10;
      if (u.y < 10) u.y = 10; if (u.y > this.H - 10) u.y = this.H - 10;
    }

    // Granaten
    for (const s of this.shells) {
      if (s.delay > 0) { s.delay -= SIM_DT; continue; }
      s.t += SIM_DT;
      if (s.t >= s.dur && !s.done) {
        s.done = true;
        const src = { bat: s.bat, team: s.team };
        for (const e of this.units) {
          if (!e.alive || e.team === s.team) continue;
          const d = Math.sqrt(sq(e.x - s.x) + sq(e.y - s.y));
          if (d < s.splash + e.r) this.damage(e, s.dmg * (1 - (0.5 * d) / (s.splash + e.r)), src);
        }
        this.emit({ type: 'boom', x: s.x, y: s.y, r: s.splash, team: s.team, big: !!s.big });
      }
    }
    this.shells = this.shells.filter((s) => !s.done);

    // Luftschläge
    for (const s of this.strikes) {
      s.delay -= SIM_DT;
      if (s.delay <= 0 && !s.done) {
        s.done = true;
        for (const e of this.units) {
          if (!e.alive || e.team === s.team) continue;
          const d = Math.sqrt(sq(e.x - s.x) + sq(e.y - s.y));
          if (d < s.r + e.r) this.damage(e, (e.cls === 'hq' ? 0.4 : 1) * s.dmg * (1 - (0.5 * d) / (s.r + e.r)), null);
        }
        this.emit({ type: 'boom', x: s.x, y: s.y, r: s.r, team: s.team, big: true });
      }
    }
    this.strikes = this.strikes.filter((s) => !s.done);

    // Eroberungspunkte
    for (const p of this.points) {
      const c = [0, 0];
      for (const u of live) if (u.alive && u.cls !== 'hq' && sq(u.x - p.x) + sq(u.y - p.y) < 3600) c[u.team]++;
      let rate = 0;
      if (c[0] && !c[1]) rate = Math.min(30, 10 + 4 * c[0]);
      if (c[1] && !c[0]) rate = -Math.min(30, 10 + 4 * c[1]);
      if (rate) {
        p.prog = Math.max(-100, Math.min(100, p.prog + rate * SIM_DT));
        const before = p.owner;
        if (p.prog >= 100) p.owner = 0;
        else if (p.prog <= -100) p.owner = 1;
        else if ((p.owner === 0 && p.prog <= 0) || (p.owner === 1 && p.prog >= 0)) p.owner = -1;
        if (before !== p.owner && p.owner >= 0) {
          this.say(`${this.armies[p.owner].name} erobert ${p.name}!`, p.owner, 'capture');
          if (this.cfg.morale) this.morale[p.owner] = Math.min(100, this.morale[p.owner] + 5);
        }
        if (before !== p.owner && p.owner < 0) {
          this.say(`${p.name} ist wieder neutral.`, before, 'neutral');
          this.moraleHit(before, 5);
        }
      }
      if (p.owner >= 0) this.score[p.owner] += SIM_DT;
    }

    this.checkEnd();
  }

  armyHpFrac(team) {
    let hp = 0, max = 0;
    for (const u of this.units) if (u.team === team && u.cls !== 'hq') { hp += Math.max(0, u.hp); max += u.maxHp; }
    return max ? hp / max : 0;
  }

  finalScore(team) {
    return this.score[team] + (this.hq[team].hp / this.hqHp) * 40 + this.armyHpFrac(team) * 40 + (this.cfg.morale ? this.morale[team] * 0.4 : 0);
  }

  checkEnd() {
    const alive = [0, 1].map((t) => this.units.some((u) => u.alive && u.team === t && u.cls !== 'hq'));
    if (!this.hq[0].alive || !this.hq[1].alive) {
      this.end(this.hq[0].alive ? 0 : this.hq[1].alive ? 1 : -1, 'Regierungssitz eingenommen');
    } else if ((!alive[0] || !alive[1]) && !(this.cfg.waves && [0, 1].every((t) => alive[t] || this.morale[t] >= 15))) {
      this.end(alive[0] ? 0 : alive[1] ? 1 : -1, 'Gegnerische Truppen aufgerieben');
    } else if (this.cfg.morale && (this.morale[0] <= 0 || this.morale[1] <= 0)) {
      this.end(this.morale[0] > 0 ? 0 : this.morale[1] > 0 ? 1 : -1, 'Kapitulation – die Moral ist gebrochen');
    } else if (this.time >= this.maxTime) {
      const a = this.finalScore(0), b = this.finalScore(1);
      this.end(Math.abs(a - b) < 0.5 ? -1 : a > b ? 0 : 1, 'Wahltag – Punktwertung');
    }
  }

  end(winner, reason) {
    this.over = true;
    this.winner = winner;
    this.reason = reason;
    this.say(winner < 0 ? 'Unentschieden – Große Koalition!' : `${this.armies[winner].name} gewinnt! (${reason})`, winner, 'end');
  }

  runToEnd() { let guard = 0; while (!this.over && guard++ < 20000) this.step(); }

  /* Prüfsumme zur Erkennung von Desyncs im Online-Modus */
  hash() {
    let h = this.tick | 0;
    for (const u of this.units) {
      if (!u.alive) continue;
      h = (Math.imul(h, 31) + Math.round(u.x * 10) + Math.round(u.y * 10) * 7 + Math.round(u.hp)) | 0;
    }
    return h >>> 0;
  }

  summary() {
    return {
      mode: this.mode, winner: this.winner, reason: this.reason, time: this.time,
      scores: [this.finalScore(0), this.finalScore(1)],
      points: [this.score[0], this.score[1]],
      bats: this.bats.map((b) => ({ team: b.team, pid: b.pid, name: b.name, cls: b.cls, dmg: b.dmg, kills: b.kills, heal: b.heal, alive: this.batAlive(b), leaderGone: b.leaderGone })),
    };
  }
}

/* ---------- KI-Gegner für die Kampagne ----------
 * Die KI stellt eine Allianz zusammen, deren Stärke zur Spielerstärke × Stufenfaktor passt,
 * sucht gezielt Synergien und stellt taktisch auf.
 */
const AI_NAMES = ['Schattenkabinett', 'Lobby-Verband', 'Hinterbänkler-Front', 'Bürgerinitiative', 'Ausschuss für Alles', 'Die Opposition', 'Partei der Unentschlossenen', 'Filibuster-Liga', 'Koalition der Willigen', 'Ständiger Vermittlungsausschuss', 'Sondervermögen-Bund', 'Fraktion Fundamental'];

function aiDifficulty(stage) { return Math.min(1.6, 1.0 + 0.04 * (stage - 1)); }

function makeAiArmy(stage, seed, playerPower, multOverride, forceTheme) {
  const rng = mulberry32(seed ^ 0xa11ce);
  const size = 5;
  const weights = { C: Math.max(0.1, 0.6 - stage * 0.05), R: 0.3, E: Math.min(0.45, 0.1 + stage * 0.035), L: Math.min(0.3, Math.max(0.02, (stage - 2) * 0.025)) };
  // Thema für Synergien
  const roll = rng();
  const regionKeys = Object.keys(REGIONS), eraKeys = Object.keys(ERAS);
  const theme = forceTheme ? forceTheme : roll < 0.4 ? { region: regionKeys[Math.floor(rng() * regionKeys.length)] } : roll < 0.7 ? { era: eraKeys[Math.floor(rng() * eraKeys.length)] } : null;
  const inTheme = (p) => !theme || (theme.region ? p.region === theme.region : p.era === theme.era);
  const classOk = (p, chosen) => chosen.filter((c) => POL_BY_ID[c].cls === p.cls).length < 2;
  const chosen = [];
  let guard = 0;
  while (chosen.length < size && guard++ < 800) {
    let r = rng() * (weights.C + weights.R + weights.E + weights.L);
    let rar = 'C';
    for (const k of ['C', 'R', 'E', 'L']) { if (r < weights[k]) { rar = k; break; } r -= weights[k]; }
    let pool = POLITICIANS.filter((p) => p.rarity === rar && !chosen.includes(p.id) && classOk(p, chosen));
    const themed = pool.filter(inTheme);
    const local = forceTheme && forceTheme.flags ? pool.filter((p) => forceTheme.flags.includes(p.flag)) : [];
    if (local.length && rng() < 0.7) pool = local;
    else if (themed.length && rng() < (forceTheme ? 0.92 : 0.75)) pool = themed;
    if (pool.length) chosen.push(pool[Math.floor(rng() * pool.length)].id);
  }
  const levels = {};
  const base = Math.max(1, Math.min(MAX_LEVEL, 1 + Math.floor((stage - 1) / 3)));
  chosen.forEach((id) => (levels[id] = base));

  // An Spielerstärke anpassen
  if (playerPower) {
    const target = playerPower * (multOverride || aiDifficulty(stage));
    const rk = (id) => RARITY_ORDER.indexOf(POL_BY_ID[id].rarity);
    for (let it = 0; it < 60; it++) {
      const pw = alliancePower(chosen, levels);
      if (pw < target * 0.97) {
        const low = chosen.filter((id) => levels[id] < MAX_LEVEL).sort((a, b) => levels[a] - levels[b] || rk(a) - rk(b))[0];
        if (low && rng() < 0.6) { levels[low]++; continue; }
        // schwächste Karte gegen eine seltenere tauschen
        const weakest = chosen.slice().sort((a, b) => rk(a) - rk(b) || levels[a] - levels[b])[0];
        let better = POLITICIANS.filter((p) => rk(p.id) > rk(weakest) && !chosen.includes(p.id) && classOk(p, chosen.filter((c) => c !== weakest)));
        if (forceTheme && better.some(inTheme)) better = better.filter(inTheme);
        if (better.length) {
          const nb = better[Math.floor(rng() * better.length)].id;
          chosen[chosen.indexOf(weakest)] = nb; levels[nb] = levels[weakest]; delete levels[weakest];
        } else if (low) levels[low]++;
        else break;
      } else if (pw > target * 1.08) {
        const high = chosen.filter((id) => levels[id] > 1).sort((a, b) => levels[b] - levels[a])[0];
        if (high) { levels[high]--; continue; }
        const strongest = chosen.slice().sort((a, b) => rk(b) - rk(a))[0];
        let weaker = POLITICIANS.filter((p) => rk(p.id) < rk(strongest) && !chosen.includes(p.id) && classOk(p, chosen.filter((c) => c !== strongest)));
        if (forceTheme && weaker.some(inTheme)) weaker = weaker.filter(inTheme);
        if (!weaker.length) break;
        const nw = weaker[Math.floor(rng() * weaker.length)].id;
        chosen[chosen.indexOf(strongest)] = nw; levels[nw] = 1; delete levels[strongest];
      } else break;
    }
  }

  // Taktische Aufstellung: Panzer/Infanterie vorne mittig, Kavallerie an den Flanken, Artillerie/Diplomaten hinten
  const flank = [0.1, 0.9], front = [0.38, 0.62, 0.5, 0.25, 0.75];
  let fi = 0, ci = 0, bi = 0;
  const members = chosen.map((id) => {
    const cls = POL_BY_ID[id].cls;
    let pos;
    if (cls === 'cav') pos = [0.75 + rng() * 0.2, flank[ci++ % 2]];
    else if (cls === 'art' || cls === 'dip') pos = [0.15 + rng() * 0.15, [0.4, 0.6, 0.3, 0.7][bi++ % 4]];
    else pos = [0.6 + rng() * 0.25, front[fi++ % front.length]];
    pos[1] = Math.max(0.02, Math.min(0.98, pos[1] + (rng() - 0.5) * 0.08));
    return { id, level: levels[id], pos };
  });
  return sanitizeArmy({ name: AI_NAMES[Math.floor(rng() * AI_NAMES.length)], player: `KI · Stufe ${stage}`, members });
}
