/* Deterministische Schlachtsimulation (Top-Down).
 * Gleicher Seed + gleiche Armeen => identischer Verlauf auf allen Geräten.
 * Verwendet nur + - * / und Math.sqrt (IEEE-exakt), keine Trigonometrie.
 */
const SIM_W = 1200, SIM_H = 700, SIM_DT = 0.05, SIM_MAX_TIME = 150;
const DEPLOY_ZONE = { x0: 50, x1: 330, y0: 60, y1: 640 };
const HQ_POS = [{ x: 70, y: 350 }, { x: SIM_W - 70, y: 350 }];
const HQ_HP = 4500;
const DMG_SCALE = 0.7;
const sq = (v) => v * v; // statt ** – garantiert identisch auf allen JS-Engines

function deployToWorld(team, pos) {
  let x = DEPLOY_ZONE.x0 + pos[0] * (DEPLOY_ZONE.x1 - DEPLOY_ZONE.x0);
  const y = DEPLOY_ZONE.y0 + pos[1] * (DEPLOY_ZONE.y1 - DEPLOY_ZONE.y0);
  if (team === 1) x = SIM_W - x;
  return { x, y };
}
function worldToDeploy(x, y) {
  return [
    Math.max(0, Math.min(1, (x - DEPLOY_ZONE.x0) / (DEPLOY_ZONE.x1 - DEPLOY_ZONE.x0))),
    Math.max(0, Math.min(1, (y - DEPLOY_ZONE.y0) / (DEPLOY_ZONE.y1 - DEPLOY_ZONE.y0))),
  ];
}

function generateMap(seed) {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const points = [
    { x: 600, y: 130, name: 'Nordstadt' },
    { x: 600, y: 350, name: 'Hauptstadt' },
    { x: 600, y: 570, name: 'Südhafen' },
  ];
  const forests = [], hills = [];
  const nearPoint = (x, y, r) => points.some((p) => sq(p.x - x) + sq(p.y - y) < sq(r + 55)) || Math.abs(x - 600) < r * 0.4;
  let tries = 0;
  const nF = 3 + Math.floor(rng() * 3);
  while (forests.length < nF * 2 && tries++ < 200) {
    const r = 35 + rng() * 45, x = 360 + rng() * 200, y = 60 + rng() * 580;
    if (nearPoint(x, y, r)) continue;
    forests.push({ x, y, r }, { x: SIM_W - x, y, r });
  }
  tries = 0;
  const nH = 2 + Math.floor(rng() * 2);
  while (hills.length < nH * 2 && tries++ < 200) {
    const r = 40 + rng() * 30, x = 380 + rng() * 170, y = 70 + rng() * 560;
    if (nearPoint(x, y, r)) continue;
    if (forests.some((f) => sq(f.x - x) + sq(f.y - y) < sq(f.r + r))) continue;
    hills.push({ x, y, r }, { x: SIM_W - x, y, r });
  }
  // eine zentrale Struktur in der Mitte (symmetrisch zur Achse)
  if (rng() < 0.6) {
    const y = rng() < 0.5 ? 240 : 460;
    forests.push({ x: 600, y, r: 30 + rng() * 15 });
  }
  return { seed, points, forests, hills };
}

class Battle {
  constructor(seed, armies) {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.map = generateMap(this.seed);
    this.armies = armies;
    this.units = [];
    this.bats = [];
    this.shells = [];
    this.hits = [];
    this.fx = [];
    this.fxEnabled = false;
    this.log = [];
    this.time = 0;
    this.tick = 0;
    this.score = [0, 0];
    this.over = false;
    this.winner = null;
    this.reason = '';
    this.nextId = 1;
    this.points = this.map.points.map((p) => ({ ...p, owner: -1, prog: 0 }));
    this.hq = [0, 1].map((t) => this.addUnit({ team: t, bat: -1, cls: 'hq', x: HQ_POS[t].x, y: HQ_POS[t].y, hp: HQ_HP, atk: 34, range: 170, speed: 0, cd: 1.0, r: 26, leader: false }));
    this.hqWarned = [false, false];
    armies.forEach((army, team) => this.spawnArmy(army, team));
  }

  addUnit(o) {
    const u = Object.assign({ id: this.nextId++, alive: true, maxHp: o.hp, cdLeft: 0, target: null, retarget: 0, ceaseT: 0, vx: 0, vy: 0 }, o);
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
        abilityCd: C.abilityCd * (1.25 - p.tac / 200) * s.cd,
        abilityLeft: 0, shieldT: 0, blitzT: 0,
        leaderGone: false, leaderId: 0, units: [],
        objective: null, objTimer: 0, laneY: 0,
        dmg: 0, kills: 0, heal: 0, spawned: 0, abilities: 0,
      };
      bat.abilityLeft = bat.abilityCd * (0.35 + 0.1 * (bat.idx % 3));
      const c = deployToWorld(team, m.pos);
      bat.laneY = c.y;
      this.bats.push(bat);
      const n = C.count;
      for (let i = 0; i < n; i++) {
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
    const hp = bat.hp * (leader ? 2.5 : 1);
    const u = this.addUnit({
      team: bat.team, bat: bat.idx, cls: bat.cls, x, y, hp, atk: bat.atk * (leader ? 1.3 : 1),
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

  inForest(x, y) { return this.map.forests.some((f) => sq(f.x - x) + sq(f.y - y) < f.r * f.r); }
  onHill(x, y) { return this.map.hills.some((h) => sq(h.x - x) + sq(h.y - y) < h.r * h.r); }

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
    const dx = tx - u.x, dy = ty - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return;
    let sp = u.speed * mult * SIM_DT;
    if (this.inForest(u.x, u.y)) sp *= 0.65;
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
        this.say(`${tb.name} tritt zurück! Das Bataillon kämpft führungslos weiter.`, tb.team, 'resign');
        this.emit({ type: 'text', x: target.x, y: target.y - 20, text: 'Rücktritt!', team: tb.team });
      }
      if (!this.batAlive(tb)) this.say(`Das Bataillon von ${tb.name} wurde aufgerieben.`, tb.team, 'wiped');
    } else if (target.cls === 'hq' && !this.hqWarned[target.team] && target.hp < HQ_HP * 0.5) {
      this.hqWarned[target.team] = true;
      this.say(`Der Regierungssitz von ${this.armies[target.team].name} wankt!`, target.team, 'hq');
    }
  }

  attack(u, t) {
    const C = CLASSES[u.cls];
    let dmg = u.atk * DMG_SCALE * (0.85 + 0.3 * this.rng());
    if (u.cls !== 'hq') {
      const bat = this.bats[u.bat];
      if (bat.leaderGone) dmg *= 0.85;
      if (bat.blitzT > 0) dmg *= 1.6;
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

  useAbility(bat, units) {
    const leader = this.unitById(bat.leaderId);
    if (!leader || !leader.alive) return;
    const C = CLASSES[bat.cls];
    const near = (r) => this.units.filter((e) => e.alive && e.team !== bat.team && e.cls !== 'hq' && sq(e.x - leader.x) + sq(e.y - leader.y) < r * r);
    let used = false;
    if (bat.cls === 'inf') {
      if (units.length < C.count + 8 && (near(320).length || this.time > 8)) {
        for (let i = 0; i < 2; i++) this.addBatUnit(bat, leader.x + (this.rng() - 0.5) * 30, leader.y + (this.rng() - 0.5) * 30, false);
        bat.spawned += 2;
        used = true;
      }
    } else if (bat.cls === 'tank') {
      if (near(170).length) { bat.shieldT = 5; used = true; }
    } else if (bat.cls === 'cav') {
      if (near(230).length) { bat.blitzT = 3; used = true; }
    } else if (bat.cls === 'art') {
      const cands = near(340);
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
      if (enemies.length || hurt.length >= 3) {
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
    } else {
      bat.abilityLeft = 0.5;
    }
  }

  step() {
    if (this.over) return;
    this.time += SIM_DT;
    this.tick++;

    // Bataillone: Ziele, Fähigkeiten, Timer
    for (const bat of this.bats) {
      bat.shieldT = Math.max(0, bat.shieldT - SIM_DT);
      bat.blitzT = Math.max(0, bat.blitzT - SIM_DT);
      const units = this.batUnits(bat);
      if (!units.length) continue;
      bat.objTimer -= SIM_DT;
      if (bat.objTimer <= 0 || !bat.objective) { bat.objTimer = 1; this.updateObjective(bat, units); }
      if (!bat.leaderGone) {
        bat.abilityLeft -= SIM_DT;
        if (bat.abilityLeft <= 0) this.useAbility(bat, units);
      }
    }

    // Einheiten
    for (const u of this.units) {
      if (!u.alive) continue;
      u.cdLeft -= SIM_DT;
      if (u.ceaseT > 0) u.ceaseT -= SIM_DT;
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

      if (t) {
        const d = Math.sqrt(sq(t.x - u.x) + sq(t.y - u.y));
        if (d > range + t.r) {
          this.moveToward(u, t.x, t.y);
        } else if (u.cdLeft <= 0 && u.ceaseT <= 0) {
          this.attack(u, t);
          u.cdLeft = u.cd;
        }
      } else {
        const bat = this.bats[u.bat];
        if (bat.objective) {
          const leader = this.unitById(bat.leaderId);
          let ox = 0, oy = 0;
          if (!u.leader && leader && leader.alive) { ox = (((u.id * 37) % 41) - 20) * (u.team === 0 ? 1 : -1); oy = ((u.id * 53) % 41) - 20; }
          this.moveToward(u, bat.objective.x + ox, bat.objective.y + oy, 0.9);
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
      if (u.x < 10) u.x = 10; if (u.x > SIM_W - 10) u.x = SIM_W - 10;
      if (u.y < 10) u.y = 10; if (u.y > SIM_H - 10) u.y = SIM_H - 10;
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
        if (before !== p.owner && p.owner >= 0) this.say(`${this.armies[p.owner].name} erobert ${p.name}!`, p.owner, 'capture');
        if (before !== p.owner && p.owner < 0) this.say(`${p.name} ist wieder neutral.`, before, 'neutral');
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
    return this.score[team] + (this.hq[team].hp / HQ_HP) * 40 + this.armyHpFrac(team) * 40;
  }

  checkEnd() {
    const alive = [0, 1].map((t) => this.units.some((u) => u.alive && u.team === t && u.cls !== 'hq'));
    if (!this.hq[0].alive || !this.hq[1].alive) {
      this.end(this.hq[0].alive ? 0 : this.hq[1].alive ? 1 : -1, 'Regierungssitz eingenommen');
    } else if (!alive[0] || !alive[1]) {
      this.end(alive[0] ? 0 : alive[1] ? 1 : -1, 'Gegnerische Truppen aufgerieben');
    } else if (this.time >= SIM_MAX_TIME) {
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

  runToEnd() { let guard = 0; while (!this.over && guard++ < 10000) this.step(); }

  summary() {
    return {
      winner: this.winner, reason: this.reason, time: this.time,
      scores: [this.finalScore(0), this.finalScore(1)],
      points: [this.score[0], this.score[1]],
      bats: this.bats.map((b) => ({ team: b.team, pid: b.pid, name: b.name, cls: b.cls, dmg: b.dmg, kills: b.kills, heal: b.heal, alive: this.batAlive(b), leaderGone: b.leaderGone })),
    };
  }
}

/* KI-Gegner für die Kampagne */
const AI_NAMES = ['Schattenkabinett', 'Lobby-Verband', 'Hinterbänkler-Front', 'Bürgerinitiative', 'Ausschuss für Alles', 'Die Opposition', 'Partei der Unentschlossenen', 'Filibuster-Liga', 'Koalition der Willigen', 'Ständiger Vermittlungsausschuss'];
function makeAiArmy(stage, seed) {
  const rng = mulberry32(seed ^ 0xa11ce);
  const size = Math.min(5, 3 + Math.floor(stage / 2));
  const weights = { C: Math.max(0.15, 0.7 - stage * 0.05), R: 0.25, E: Math.min(0.4, 0.05 + stage * 0.03), L: Math.min(0.25, Math.max(0, (stage - 3) * 0.02)) };
  const chosen = [];
  let guard = 0;
  while (chosen.length < size && guard++ < 500) {
    let r = rng() * (weights.C + weights.R + weights.E + weights.L);
    let rar = 'C';
    for (const k of ['C', 'R', 'E', 'L']) { if (r < weights[k]) { rar = k; break; } r -= weights[k]; }
    const pool = POLITICIANS.filter((p) => p.rarity === rar && !chosen.includes(p.id) && chosen.filter((c) => POL_BY_ID[c].cls === p.cls).length < 2);
    if (pool.length) chosen.push(pool[Math.floor(rng() * pool.length)].id);
  }
  const level = Math.max(1, Math.min(MAX_LEVEL, 1 + Math.floor((stage - 1) / 3)));
  const members = chosen.map((id, i) => {
    const cls = POL_BY_ID[id].cls;
    const front = cls === 'art' || cls === 'dip' ? 0.2 + rng() * 0.2 : 0.5 + rng() * 0.4;
    return { id, level, pos: [front, 0.08 + (0.84 * (i + rng() * 0.6)) / size] };
  });
  return sanitizeArmy({ name: AI_NAMES[Math.floor(rng() * AI_NAMES.length)], player: `KI · Stufe ${stage}`, members });
}
