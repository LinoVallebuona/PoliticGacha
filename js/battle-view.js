/* Canvas-Darstellung: Karte, Aufstellung und Schlacht */
const TEAM_COLORS = [
  { main: '#3b82f6', light: '#93c5fd', dark: '#1e3a8a', name: 'Blau' },
  { main: '#ef4444', light: '#fca5a5', dark: '#7f1d1d', name: 'Rot' },
];

function setupCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = SIM_W * dpr;
  canvas.height = SIM_H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function canvasToWorld(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  const t = ev.touches ? ev.touches[0] || ev.changedTouches[0] : ev;
  return { x: ((t.clientX - r.left) / r.width) * SIM_W, y: ((t.clientY - r.top) / r.height) * SIM_H };
}

function renderBackground(map) {
  const c = document.createElement('canvas');
  c.width = SIM_W; c.height = SIM_H;
  const g = c.getContext('2d');
  const rng = mulberry32(map.seed ^ 0x1234);
  // Grasland
  const grad = g.createLinearGradient(0, 0, SIM_W, SIM_H);
  grad.addColorStop(0, '#5d7a3a'); grad.addColorStop(0.5, '#6b8a43'); grad.addColorStop(1, '#58753a');
  g.fillStyle = grad; g.fillRect(0, 0, SIM_W, SIM_H);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(255,255,220,0.05)' : 'rgba(0,30,0,0.07)';
    const s = 2 + rng() * 6;
    g.fillRect(rng() * SIM_W, rng() * SIM_H, s, s * 0.6);
  }
  // Straßen von den Hauptquartieren zu den Städten
  g.strokeStyle = 'rgba(210,190,140,0.55)'; g.lineWidth = 9; g.lineCap = 'round';
  for (const hq of HQ_POS) for (const p of map.points) {
    g.beginPath(); g.moveTo(hq.x, hq.y);
    g.quadraticCurveTo((hq.x + p.x) / 2, (hq.y + p.y) / 2 + (p.y - 350) * 0.15, p.x, p.y); g.stroke();
  }
  g.beginPath(); g.moveTo(600, 130); g.lineTo(600, 570); g.stroke();
  // Hügel
  for (const h of map.hills) {
    for (let k = 4; k >= 1; k--) {
      g.beginPath(); g.arc(h.x, h.y, (h.r * k) / 4, 0, Math.PI * 2);
      g.fillStyle = `rgba(150,120,70,${0.12 + (4 - k) * 0.05})`; g.fill();
      g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 1.5; g.stroke();
    }
  }
  // Wälder
  for (const f of map.forests) {
    g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fillStyle = 'rgba(30,60,25,0.45)'; g.fill();
    const n = Math.floor(f.r * f.r / 90);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (f.r - 6);
      const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d, r = 6 + rng() * 6;
      g.beginPath(); g.arc(x + 2, y + 3, r, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = rng() < 0.5 ? '#2f5d2a' : '#3a6d30'; g.fill();
      g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
    }
  }
  // Städte (Häuser)
  for (const p of map.points) {
    for (let i = 0; i < 9; i++) {
      const x = p.x - 30 + rng() * 60, y = p.y - 30 + rng() * 60;
      if ((x - p.x) ** 2 + (y - p.y) ** 2 > 900) continue;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 5, y - 3, 12, 10);
      g.fillStyle = '#d6cbb3'; g.fillRect(x - 6, y - 5, 11, 9);
      g.fillStyle = '#9b3d2b'; g.fillRect(x - 7, y - 7, 13, 4);
    }
  }
  return c;
}

function drawPoints(ctx, points, time) {
  for (const p of points) {
    const owner = p.owner;
    ctx.save();
    ctx.beginPath(); ctx.arc(p.x, p.y, 60, 0, Math.PI * 2);
    ctx.fillStyle = owner >= 0 ? TEAM_COLORS[owner].main + '22' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -time * 10;
    ctx.strokeStyle = owner >= 0 ? TEAM_COLORS[owner].light : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([]);
    if (p.prog) {
      const t = p.prog > 0 ? 0 : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 66, -Math.PI / 2, -Math.PI / 2 + (Math.abs(p.prog) / 100) * Math.PI * 2);
      ctx.strokeStyle = TEAM_COLORS[t].main; ctx.lineWidth = 5; ctx.stroke();
    }
    // Fahne
    ctx.fillStyle = '#333'; ctx.fillRect(p.x - 1, p.y - 34, 2, 22);
    ctx.fillStyle = owner >= 0 ? TEAM_COLORS[owner].main : '#e5e7eb';
    ctx.beginPath(); ctx.moveTo(p.x + 1, p.y - 34); ctx.lineTo(p.x + 16, p.y - 29); ctx.lineTo(p.x + 1, p.y - 24); ctx.fill();
    ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(p.name, p.x + 1, p.y + 49);
    ctx.fillStyle = '#fff'; ctx.fillText(p.name, p.x, p.y + 48);
    ctx.restore();
  }
}

function drawHQ(ctx, team, hp, name) {
  const { x, y } = HQ_POS[team];
  const col = TEAM_COLORS[team];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 30, y - 18, 64, 46);
  // Regierungsgebäude mit Kuppel
  ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x - 32, y - 20, 64, 44);
  ctx.fillStyle = col.main; ctx.fillRect(x - 32, y - 24, 64, 7);
  for (let i = -3; i <= 3; i++) { ctx.fillStyle = '#b9b09a'; ctx.fillRect(x + i * 8 - 2, y - 14, 4, 34); }
  ctx.beginPath(); ctx.arc(x, y - 24, 14, Math.PI, 0); ctx.fillStyle = col.light; ctx.fill(); ctx.strokeStyle = col.dark; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#333'; ctx.fillRect(x - 1, y - 52, 2, 16);
  ctx.fillStyle = col.main; ctx.fillRect(x + 1, y - 52, 14, 8);
  if (hp !== undefined) {
    const f = Math.max(0, hp / HQ_HP);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 34, y + 30, 68, 7);
    ctx.fillStyle = f > 0.5 ? '#22c55e' : f > 0.25 ? '#eab308' : '#ef4444'; ctx.fillRect(x - 33, y + 31, 66 * f, 5);
  }
  if (name) {
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(name, x + 1, y + 50);
    ctx.fillStyle = '#fff'; ctx.fillText(name, x, y + 49);
  }
  ctx.restore();
}

function drawPortraitDisc(ctx, x, y, r, pid, team) {
  const col = TEAM_COLORS[team];
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fillStyle = col.main; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col.dark; ctx.fill();
  ctx.clip();
  const img = Wiki.image(pid);
  if (img) {
    const s = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, x - w / 2, y - r * 1.05, w, h);
  } else {
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r * 0.9)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(POL_BY_ID[pid].name), x, y + 1);
  }
  ctx.restore();
}

function drawUnitShape(ctx, u, col, dirX) {
  const r = u.r;
  ctx.beginPath();
  if (u.cls === 'tank') {
    ctx.rect(u.x - r, u.y - r * 0.75, r * 2, r * 1.5);
  } else if (u.cls === 'art') {
    ctx.moveTo(u.x, u.y - r); ctx.lineTo(u.x + r, u.y); ctx.lineTo(u.x, u.y + r); ctx.lineTo(u.x - r, u.y); ctx.closePath();
  } else if (u.cls === 'cav') {
    ctx.moveTo(u.x + dirX * r * 1.2, u.y); ctx.lineTo(u.x - dirX * r, u.y - r); ctx.lineTo(u.x - dirX * r, u.y + r); ctx.closePath();
  } else {
    ctx.arc(u.x, u.y, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = col.main; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = col.dark; ctx.stroke();
  if (u.cls === 'tank') { ctx.fillStyle = col.dark; ctx.fillRect(u.x, u.y - 1.5, dirX * r * 1.3, 3); }
  if (u.cls === 'dip') { ctx.fillStyle = '#fff'; ctx.fillRect(u.x - 1, u.y - 4, 2, 8); ctx.fillRect(u.x - 4, u.y - 1, 8, 2); }
}

class BattleView {
  constructor(canvas, battle, opts = {}) {
    this.canvas = canvas;
    this.ctx = setupCanvas(canvas);
    this.battle = battle;
    battle.fxEnabled = true;
    this.myTeam = opts.myTeam ?? 0;
    this.speed = 1;
    this.bg = renderBackground(battle.map);
    this.decals = document.createElement('canvas');
    this.decals.width = SIM_W; this.decals.height = SIM_H;
    this.effects = [];
    this.prev = {};
    this.acc = 0;
    this.running = false;
    this.onTick = opts.onTick || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.endFired = false;
    battle.bats.forEach((b) => Wiki.image(b.pid));
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) {
        this.acc += dt * this.speed;
        let n = 0;
        while (this.acc >= SIM_DT && n < 40 && !this.battle.over) { this.battle.step(); this.acc -= SIM_DT; n++; }
        if (this.battle.over) this.acc = 0;
      }
      this.consumeFx();
      this.draw(dt);
      this.onTick(this.battle);
      if (this.battle.over && !this.endFired) {
        this.endFired = true;
        setTimeout(() => this.onEnd(this.battle), 1600);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }

  skip() {
    this.battle.fxEnabled = false;
    this.battle.runToEnd();
    this.battle.fxEnabled = true;
  }

  consumeFx() {
    const d = this.decals.getContext('2d');
    for (const e of this.battle.fx) {
      if (e.type === 'death') {
        d.fillStyle = 'rgba(40,30,20,0.35)';
        d.beginPath(); d.arc(e.x, e.y, e.cls === 'tank' ? 9 : 5, 0, Math.PI * 2); d.fill();
        this.effects.push({ ...e, life: 0.6, max: 0.6 });
      } else if (e.type === 'boom') {
        d.fillStyle = 'rgba(30,25,15,0.22)';
        d.beginPath(); d.arc(e.x, e.y, e.r * 0.6, 0, Math.PI * 2); d.fill();
        this.effects.push({ ...e, life: 0.5, max: 0.5 });
      } else if (e.type === 'shot') {
        this.effects.push({ ...e, life: e.cls === 'hq' ? 0.2 : 0.12, max: 0.12 });
      } else if (e.type === 'heal') {
        this.effects.push({ ...e, life: 0.35, max: 0.35 });
      } else if (e.type === 'ability') {
        this.effects.push({ ...e, life: 1.4, max: 1.4 });
      } else if (e.type === 'text') {
        this.effects.push({ ...e, life: 1.6, max: 1.6 });
      }
    }
    this.battle.fx.length = 0;
  }

  draw(dt) {
    const ctx = this.ctx, B = this.battle;
    ctx.drawImage(this.bg, 0, 0);
    ctx.drawImage(this.decals, 0, 0);
    drawPoints(ctx, B.points, B.time);
    drawHQ(ctx, 0, B.hq[0].hp, B.armies[0].name);
    drawHQ(ctx, 1, B.hq[1].hp, B.armies[1].name);

    // Fähigkeits-Auren
    for (const bat of B.bats) {
      if (bat.shieldT <= 0 && bat.blitzT <= 0) continue;
      for (const u of B.batUnits(bat)) {
        ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = bat.shieldT > 0 ? 'rgba(125,211,252,0.9)' : 'rgba(253,224,71,0.9)';
        ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // Einheiten (Anführer zuletzt)
    const units = B.units.filter((u) => u.alive && u.cls !== 'hq').sort((a, b) => a.leader - b.leader);
    for (const u of units) {
      const prev = this.prev[u.id];
      let dirX = u.team === 0 ? 1 : -1;
      if (prev && Math.abs(u.x - prev.x) > 0.05) dirX = u.x > prev.x ? 1 : -1;
      this.prev[u.id] = { x: u.x, y: u.y };
      const col = TEAM_COLORS[u.team];
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(u.x + 2, u.y + 3, u.r, u.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      if (u.leader) {
        const bat = B.bats[u.bat];
        drawPortraitDisc(ctx, u.x, u.y, u.r + 2, bat.pid, u.team);
        const f = u.hp / u.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(u.x - 14, u.y - u.r - 10, 28, 4);
        ctx.fillStyle = f > 0.5 ? '#22c55e' : f > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(u.x - 14, u.y - u.r - 10, 28 * f, 4);
        ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(bat.name.split(' ').slice(-1)[0], u.x + 1, u.y + u.r + 13);
        ctx.fillStyle = '#fff'; ctx.fillText(bat.name.split(' ').slice(-1)[0], u.x, u.y + u.r + 12);
      } else {
        drawUnitShape(ctx, u, col, dirX);
        if (u.hp < u.maxHp * 0.99) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(u.x - 6, u.y - u.r - 5, 12, 2);
          ctx.fillStyle = col.light; ctx.fillRect(u.x - 6, u.y - u.r - 5, 12 * (u.hp / u.maxHp), 2);
        }
      }
      if (u.ceaseT > 0) {
        ctx.fillStyle = '#fff'; ctx.fillRect(u.x + 4, u.y - u.r - 12, 1.5, 9);
        ctx.fillRect(u.x + 5.5, u.y - u.r - 12, 6, 4);
      }
    }

    // Granaten
    for (const s of B.shells) {
      if (s.delay > 0) continue;
      const p = Math.min(1, s.t / s.dur);
      const x = s.x0 + (s.x - s.x0) * p, y = s.y0 + (s.y - s.y0) * p;
      const h = Math.sin(Math.PI * p) * (30 + s.dur * 30);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.big ? '#fde047' : '#111'; ctx.beginPath(); ctx.arc(x, y - h, s.big ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }

    // Effekte
    for (const e of this.effects) {
      e.life -= dt * Math.max(1, this.speed * 0.7);
      const a = Math.max(0, e.life / e.max);
      if (e.type === 'shot') {
        if (e.cls === 'cav') {
          ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(e.x2 - 5, e.y2 - 5); ctx.lineTo(e.x2 + 5, e.y2 + 5); ctx.stroke();
        } else if (e.cls !== 'art') {
          ctx.strokeStyle = e.cls === 'hq' ? `rgba(255,240,150,${a})` : (e.team === 0 ? `rgba(191,219,254,${a})` : `rgba(254,202,202,${a})`);
          ctx.lineWidth = e.cls === 'tank' || e.cls === 'hq' ? 2.5 : 1.2;
          ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
          ctx.fillStyle = `rgba(255,220,120,${a})`; ctx.beginPath(); ctx.arc(e.x1, e.y1, 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255,200,80,${a})`; ctx.beginPath(); ctx.arc(e.x1, e.y1, 6 * a, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === 'heal') {
        ctx.strokeStyle = `rgba(134,239,172,${a})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.fillStyle = `rgba(134,239,172,${a})`; ctx.font = 'bold 12px sans-serif'; ctx.fillText('+', e.x2 + 4, e.y2 - 6 - (1 - a) * 8);
      } else if (e.type === 'boom') {
        const r = e.r * (1.1 - a * 0.6);
        ctx.fillStyle = `rgba(255,${120 + 100 * a},40,${a * 0.8})`; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.3, 0, Math.PI * 2); ctx.stroke();
      } else if (e.type === 'death') {
        ctx.fillStyle = `rgba(80,80,80,${a * 0.6})`; ctx.beginPath(); ctx.arc(e.x, e.y - (1 - a) * 10, 6 + (1 - a) * 8, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'ability') {
        const col = TEAM_COLORS[e.team];
        const r = 30 + (1 - a) * 140;
        ctx.strokeStyle = col.light; ctx.globalAlpha = a; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(`${CLASSES[e.cls].icon} ${e.name}!`, e.x + 1, e.y - 30 - (1 - a) * 20 + 1);
        ctx.fillStyle = '#fff'; ctx.fillText(`${CLASSES[e.cls].icon} ${e.name}!`, e.x, e.y - 30 - (1 - a) * 20);
        ctx.globalAlpha = 1;
      } else if (e.type === 'text') {
        ctx.globalAlpha = a; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(e.text, e.x + 1, e.y - (1 - a) * 30 + 1);
        ctx.fillStyle = '#fde047'; ctx.fillText(e.text, e.x, e.y - (1 - a) * 30);
        ctx.globalAlpha = 1;
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
  }
}

/* Aufstellungs-Editor: eigene Bataillone in der eigenen Zone verschieben */
class DeployView {
  constructor(canvas, map, opts) {
    this.canvas = canvas;
    this.ctx = setupCanvas(canvas);
    this.map = map;
    this.bg = renderBackground(map);
    this.army = opts.army;           // eigene Armee (wird verändert)
    this.myTeam = opts.myTeam ?? 0;
    this.enemy = opts.enemy || null; // optional sichtbar
    this.enemyName = opts.enemyName || '';
    this.onChange = opts.onChange || (() => {});
    this.drag = null;
    this.locked = false;
    this.army.members.forEach((m) => Wiki.image(m.id));
    if (this.enemy) this.enemy.members.forEach((m) => Wiki.image(m.id));
    const down = (ev) => {
      if (this.locked) return;
      const p = canvasToWorld(canvas, ev);
      let best = null, bd = 30 * 30;
      this.army.members.forEach((m) => {
        const w = deployToWorld(this.myTeam, m.pos);
        const d = (w.x - p.x) ** 2 + (w.y - p.y) ** 2;
        if (d < bd) { bd = d; best = m; }
      });
      if (best) { this.drag = best; ev.preventDefault(); }
    };
    const move = (ev) => {
      if (!this.drag) return;
      ev.preventDefault();
      const p = canvasToWorld(canvas, ev);
      const x = this.myTeam === 0 ? p.x : SIM_W - p.x;
      this.drag.pos = worldToDeploy(x, p.y).map((v) => Math.round(v * 1000) / 1000);
    };
    const up = () => { if (this.drag) { this.drag = null; this.onChange(this.army); } };
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    this._cleanup = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move, { passive: false });
      window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
    };
    this.running = true;
    const loop = (t) => { if (!this.running) return; this.draw(t / 1000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  destroy() { this.running = false; this._cleanup(); }

  drawArmy(ctx, army, team, faded) {
    army.members.forEach((m) => {
      const p = POL_BY_ID[m.id];
      const C = CLASSES[p.cls];
      const w = deployToWorld(team, m.pos);
      ctx.globalAlpha = faded ? 0.75 : 1;
      for (let i = 1; i < C.count; i++) {
        const ring = 1 + Math.floor((i - 1) / 6), k = (i - 1) % 6;
        const ox = [1, 0.5, -0.5, -1, -0.5, 0.5][k] * 16 * ring * (team === 0 ? 1 : -1);
        const oy = [0, 0.87, 0.87, 0, -0.87, -0.87][k] * 16 * ring;
        drawUnitShape(ctx, { x: w.x + ox, y: w.y + oy, r: C.r, cls: p.cls }, TEAM_COLORS[team], team === 0 ? 1 : -1);
      }
      drawPortraitDisc(ctx, w.x, w.y, C.r + 6, m.id, team);
      ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(`${C.icon} ${p.name}`, w.x + 1, w.y + 34);
      ctx.fillStyle = '#fff'; ctx.fillText(`${C.icon} ${p.name}`, w.x, w.y + 33);
      ctx.globalAlpha = 1;
    });
  }

  draw(time) {
    const ctx = this.ctx;
    ctx.drawImage(this.bg, 0, 0);
    drawPoints(ctx, this.map.points.map((p) => ({ ...p, owner: -1, prog: 0 })), time);
    // Zonen
    for (const team of [0, 1]) {
      const x0 = team === 0 ? DEPLOY_ZONE.x0 : SIM_W - DEPLOY_ZONE.x1;
      const isMine = team === this.myTeam;
      ctx.fillStyle = isMine ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x0 - 20, DEPLOY_ZONE.y0 - 30, DEPLOY_ZONE.x1 - DEPLOY_ZONE.x0 + 40, DEPLOY_ZONE.y1 - DEPLOY_ZONE.y0 + 60);
      ctx.setLineDash([8, 6]); ctx.lineDashOffset = -time * 12;
      ctx.strokeStyle = isMine ? TEAM_COLORS[team].light : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
      ctx.strokeRect(x0 - 20, DEPLOY_ZONE.y0 - 30, DEPLOY_ZONE.x1 - DEPLOY_ZONE.x0 + 40, DEPLOY_ZONE.y1 - DEPLOY_ZONE.y0 + 60);
      ctx.setLineDash([]);
    }
    drawHQ(ctx, 0); drawHQ(ctx, 1);
    if (this.enemy) this.drawArmy(ctx, this.enemy, 1 - this.myTeam, true);
    else {
      const x = this.myTeam === 0 ? SIM_W - 190 : 190;
      ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(this.enemyName ? `${this.enemyName} stellt sich auf…` : 'Gegner verdeckt', x, 340);
    }
    this.drawArmy(ctx, this.army, this.myTeam, false);
    if (!this.locked) {
      const x = this.myTeam === 0 ? 190 : SIM_W - 190;
      ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('↕ Porträts ziehen, um Bataillone aufzustellen', x, 30);
    }
  }
}
