/* Schlacht-Bildschirm: Modus-Auswahl, Aufstellung, Kampf, Ergebnis, Online-Lobby */

/* Lockstep-Synchronisation für den Kommando-Modus online:
 * Befehle werden in "Runden" à 4 Ticks gesammelt und 2 Runden später auf beiden Geräten
 * in identischer Reihenfolge angewendet. Die Simulation wartet, bis die Befehle des Gegners da sind.
 */
class Lockstep {
  constructor(battle, myTeam, send) {
    this.b = battle; this.me = myTeam; this.send = send;
    this.TURN = 4; this.DELAY = 2;
    this.local = [];
    this.inputs = [{}, {}];
    this.hashes = [{}, {}];
    for (let t = 0; t < this.DELAY; t++) { this.inputs[0][t] = []; this.inputs[1][t] = []; }
    this.sent = this.DELAY - 1;
    this.desync = false;
  }
  issue(cmd) { this.local.push(cmd); }
  receive(m) {
    const other = 1 - this.me;
    if (m.t === 'cmds' && Number.isInteger(m.turn)) this.inputs[other][m.turn] = Array.isArray(m.cmds) ? m.cmds.slice(0, 20) : [];
    if (m.t === 'hash' && Number.isInteger(m.turn)) { this.hashes[other][m.turn] = m.h; this.checkHash(m.turn); }
  }
  checkHash(turn) {
    const a = this.hashes[0][turn], b = this.hashes[1][turn];
    if (a !== undefined && b !== undefined && a !== b && !this.desync) {
      this.desync = true;
      toast('⚠️ Die Schlacht ist zwischen euren Geräten auseinandergelaufen (Desync).', 'bad');
    }
  }
  gate(b) {
    if (b.tick % this.TURN !== 0) return true;
    const turn = b.tick / this.TURN;
    if (this.sent < turn + this.DELAY) {
      const tt = turn + this.DELAY;
      const cmds = this.local.splice(0, this.local.length);
      this.inputs[this.me][tt] = cmds;
      this.send({ t: 'cmds', turn: tt, cmds });
      this.sent = tt;
    }
    const a = this.inputs[0][turn], c = this.inputs[1][turn];
    if (!a || !c) return false;
    a.forEach((cmd) => b.queueCommand(0, cmd));
    c.forEach((cmd) => b.queueCommand(1, cmd));
    delete this.inputs[0][turn]; delete this.inputs[1][turn];
    if (turn % 50 === 0) {
      const h = b.hash();
      this.hashes[this.me][turn] = h;
      this.send({ t: 'hash', turn, h });
      this.checkHash(turn);
    }
    return true;
  }
}

const PRACTICE = {
  easy: { name: 'Leicht', mult: 0.8, win: 35, icon: '🟢' },
  normal: { name: 'Normal', mult: 1.0, win: 55, icon: '🟡' },
  hard: { name: 'Schwer', mult: 1.2, win: 85, icon: '🔴' },
};

const BattleUI = (() => {
  let ctx = {};          // aktueller Kampfkontext
  let deployView = null, battleView = null, lockstep = null;
  let live = { opponent: '', myReady: false, oppReady: false, oppArmy: null, seed: 0, mode: 'classic', phase: 'idle' };
  let unbind = [];

  const show = (which) => {
    ['menu', 'prep', 'fight'].forEach((k) => $('#battle-' + k).classList.toggle('hidden', k !== which));
  };
  const cleanup = () => {
    if (deployView) { deployView.destroy(); deployView = null; }
    if (battleView) { battleView.stop(); battleView = null; }
    lockstep = null;
    unbind.forEach((f) => f()); unbind = [];
  };
  const listen = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); unbind.push(() => target.removeEventListener(ev, fn, opt)); };

  const curMode = () => (BATTLE_MODES[S.battleMode] ? S.battleMode : 'classic');
  const stageOf = (mode) => (S.stages && S.stages[mode]) || 1;
  const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function miniRow(id, level) {
    const p = POL_BY_ID[id];
    return `<div class="mini-row">
      <div class="mini-por" data-portrait="${id}" style="--rc:${RARITIES[p.rarity].color}"><span>${esc(initials(p.name))}</span></div>
      <div style="flex:1"><b>${esc(p.name)}</b> <span class="help">Lv ${level}</span><br><span class="help">${CLASSES[p.cls].icon} ${CLASSES[p.cls].name} · ${REGIONS[p.region].icon}</span></div>
    </div>`;
  }

  function armySynergyHTML(army) {
    const syn = computeSynergies(army.members.map((m) => m.id));
    return syn.list.length ? syn.list.map((s) => `<div class="help">${s.icon} ${esc(s.name)}: <b style="color:#86efac">${s.text}</b></div>`).join('') : '<div class="help">Keine Synergien</div>';
  }

  function armyPower(army) {
    return alliancePower(army.members.map((m) => m.id), Object.fromEntries(army.members.map((m) => [m.id, m.level])));
  }

  function modeHelp(mode) {
    if (mode === 'grand') return `<b>Feldzug:</b> Ein Fluss teilt die Karte, überqueren lässt er sich nur an drei Brücken (im Wasser kommen Truppen kaum voran).
      Eroberte Städte sind <b>Festungen</b>, die auf Feinde feuern, und versorgen Truppen im Umkreis mit <b>Nachschub</b>. Ohne Nachschub sinkt der Angriff um 25 % (⚠️), nahe eigener Städte heilen die Truppen.
      Alle 45 s rückt <b>Verstärkung</b> an, und zurückgetretene Politiker feiern ein Comeback. Rücktritte und Stadtverluste kosten <b>Moral</b>. Fällt sie auf 0, kapituliert die Armee.`;
    if (mode === 'command') return `<b>Kommando:</b> <b>Klicke ein eigenes Bataillon an</b> (oder drücke 1–5) und dann einen Punkt auf der Karte, um es dorthin zu schicken. Mit <b>H</b> hält es die Stellung, mit <b>F</b> handelt es wieder frei.
      Fähigkeiten löst du selbst aus (⚡-Button oder <b>Q</b>). Mit <b>Einfluss</b>, der durch gehaltene Städte schneller wächst, setzt du <b>politische Maßnahmen</b> ein: Maßnahme wählen, dann Zielgebiet anklicken. Rechtsklick oder Esc bricht ab.`;
    return `<b>Gefecht:</b> Jeder Politiker deiner Allianz führt ein Bataillon. Die Truppen kämpfen selbstständig um drei Städte und den gegnerischen Regierungssitz. Fällt keine Entscheidung, gewinnt nach 2:30 die bessere Punktwertung.`;
  }

  /* ---------- Menü ---------- */
  function showMenu() {
    cleanup();
    if (Net.connected && live.phase !== 'idle') { showLiveLobby(); return; }
    show('menu');
    const al = activeAlliance();
    const mode = curMode();
    const cfg = BATTLE_MODES[mode];
    const m = $('#battle-menu');
    m.innerHTML = `
      <div class="battle-top">
        <div class="row">
          <label class="help">Aktive Allianz:</label>
          <select id="bm-alliance">${S.alliances.map((a) => `<option value="${a.id}" ${al && a.id === al.id ? 'selected' : ''}>${esc(a.name)} (${a.members.length}/5 · Stärke ${fmt(alliancePower(a.members))})</option>`).join('')}</select>
          <button class="btn small" id="bm-edit">Bearbeiten</button>
        </div>
        <div class="record">Siege <b>${S.stats.wins}</b> · Niederlagen <b>${S.stats.losses}</b> · PvP <b>${S.stats.pvpWins}:${S.stats.pvpLosses}</b></div>
      </div>
      <h3 class="step-title">1. Schlachtmodus</h3>
      <div class="mode-pick">${Object.values(BATTLE_MODES).map((c) => `
        <button class="mode-tile ${c.key === mode ? 'sel' : ''}" data-mode="${c.key}">
          <div class="mode-icon">${c.icon}</div><b>${c.name}</b>
          <span class="help">${c.desc}</span>
          <span class="mode-meta">⏱ bis ${fmtTime(c.time)} · Belohnung ×${c.reward} · Kampagne Stufe ${stageOf(c.key)}</span>
        </button>`).join('')}</div>
      <h3 class="step-title">2. Gegner</h3>
      <div class="mode-grid">
        <div class="mode mode-ai"><div class="mode-icon">🤖</div><h3>Kampagne gegen KI</h3>
          <p>Die KI stellt eine Allianz passend zu deiner Stärke auf und wird mit jeder Stufe stärker (aktuell ${Math.round(aiDifficulty(stageOf(mode)) * 100)} % deiner Stärke). Jeder Sieg bringt Stimmen.${mode === 'command' ? ' Die KI setzt ebenfalls politische Maßnahmen ein.' : ''}</p>
          <button class="btn primary" id="bm-ai">${cfg.icon} ${cfg.name} · Stufe ${stageOf(mode)} starten</button></div>
        <div class="mode mode-practice"><div class="mode-icon">🎯</div><h3>Übungsgefecht</h3>
          <p>Freies Gefecht gegen die KI mit wählbarer Schwierigkeit. Es zählt nicht für die Kampagne, bringt aber immer Stimmen, Erfahrung und Fortschritt bei den Aufträgen.</p>
          <div class="row"><select id="bm-diff">${Object.entries(PRACTICE).map(([k, d]) => `<option value="${k}" ${S.practiceDiff === k ? 'selected' : ''}>${d.icon} ${d.name} (${Math.round(d.mult * 100)} % · Sieg +${Math.round(d.win * cfg.reward)})</option>`).join('')}</select>
          <button class="btn primary" id="bm-practice">Starten</button></div></div>
        <div class="mode mode-live"><div class="mode-icon">🌐</div><h3>Live gegen Freunde</h3>
          <p>Erstelle einen Raum und schicke den Code an einen Freund. Ihr stellt gleichzeitig auf und erlebt dieselbe Schlacht live.${mode === 'command' ? ' Im Kommando-Modus gebt ihr beide in Echtzeit Befehle.' : ''}</p>
          <button class="btn primary" id="bm-live">Online-Raum öffnen</button></div>
        <div class="mode mode-code"><div class="mode-icon">📨</div><h3>Freundes-Code</h3>
          <p>${cfg.friendCode ? 'Kein gemeinsamer Termin? Tauscht Allianz-Codes per Messenger aus. Wenn ihr denselben Modus wählt, seht ihr beide exakt dieselbe Schlacht.' : 'Im Kommando-Modus gibst du live Befehle. Das geht nicht per Code, nutze dafür „Live gegen Freunde“.'}</p>
          <button class="btn primary" id="bm-code" ${cfg.friendCode ? '' : 'disabled'}>Codes tauschen</button></div>
      </div>
      <div class="side-box" style="margin-top:18px">
        <h3>So funktioniert die Schlacht</h3>
        <div class="help">${modeHelp(mode)}<br><br>Überall gilt: Wälder schützen (−30 % Schaden) und bremsen, Hügel erhöhen die Reichweite. Fällt der Anführer, <i>tritt er zurück</i>: Das Bataillon verliert seine Fähigkeit und kämpft schwächer weiter.</div>
        <div class="legend">${Object.entries(CLASSES).map(([k, c]) => `<span>${c.icon} <b>${c.name}</b>: ${c.ability}${Object.keys(COUNTERS[k]).length ? ' · stark gg. ' + Object.keys(COUNTERS[k]).map((x) => CLASSES[x].icon).join('') : ''}</span>`).join('')}</div>
        ${mode === 'command' ? `<div class="legend">${POLICY_ORDER.map((k) => `<span>${POLICIES[k].icon} <b>${POLICIES[k].name}</b> (${POLICIES[k].cost}): ${POLICIES[k].desc}</span>`).join('')}</div>` : ''}
      </div>`;
    $$('.mode-tile', m).forEach((b) => (b.onclick = () => { S.battleMode = b.dataset.mode; saveState(); showMenu(); }));
    $('#bm-alliance').onchange = (e) => { S.activeAlliance = e.target.value; saveState(); showMenu(); };
    $('#bm-edit').onclick = () => switchTab('alliances');
    const need = () => { const a = activeAlliance(); if (!a || !a.members.length) { toast('Stelle zuerst eine Allianz mit mindestens einem Politiker auf!', 'bad'); switchTab('alliances'); return null; } return a; };
    $('#bm-ai').onclick = () => { if (need()) startAI(); };
    $('#bm-practice').onclick = () => { S.practiceDiff = $('#bm-diff').value; saveState(); if (need()) startAI(S.practiceDiff); };
    $('#bm-live').onclick = () => { if (need()) showLiveLobby(); };
    $('#bm-code').onclick = () => { if (need()) showCodeMode(); };
  }

  /* ---------- Aufstellung ---------- */
  function myArmy() { return allianceToArmy(activeAlliance()); }

  function persistDeploy(army) {
    const al = activeAlliance();
    if (!al) return;
    army.members.forEach((m) => (al.deploy[m.id] = m.pos.slice()));
    saveState();
  }

  function startAI(practice) {
    if (typeof practice !== 'string' || !PRACTICE[practice]) practice = null;
    const mode = curMode();
    const stage = stageOf(mode);
    const seed = randomSeed();
    const army = myArmy();
    const enemy = makeAiArmy(practice ? Math.max(1, stage - 1) : stage, seed, armyPower(army), practice ? PRACTICE[practice].mult : 0);
    if (practice) enemy.player = `KI · Übung (${PRACTICE[practice].name})`;
    showPrep({
      title: `${BATTLE_MODES[mode].icon} ${BATTLE_MODES[mode].name} · ${practice ? `🎯 Übungsgefecht (${PRACTICE[practice].name})` : `Kampagne Stufe ${stage}`}`,
      seed, mode, army, myTeam: 0, enemy, enemyVisible: true,
      actions: `<button class="btn" id="pr-back">← Zurück</button><button class="btn primary big" id="pr-go">⚔️ Schlacht beginnen</button>`,
      bind: () => {
        $('#pr-back').onclick = showMenu;
        $('#pr-go').onclick = () => startFight({ seed, armies: [deployView.army, enemy], myTeam: 0, opp: 'ai', mode, practice });
      },
    });
  }

  function startWorld(tid, kind, mode) {
    const t = TERR[tid];
    const seed = randomSeed();
    const army = myArmy();
    const enemy = worldDefender(tid, armyPower(army), kind);
    showPrep({
      title: `🌍 ${kind === 'uprising' ? `Aufstand: ${esc(t.name)}` : `Angriff auf ${esc(t.name)}`} · ${BATTLE_MODES[mode].icon} ${BATTLE_MODES[mode].name}`,
      seed, mode, army, myTeam: 0, enemy, enemyVisible: true,
      actions: `<button class="btn" id="pr-back">← Weltkarte</button><button class="btn primary big" id="pr-go">⚔️ Angriff!</button>`,
      bind: () => {
        $('#pr-back').onclick = () => switchTab('world');
        $('#pr-go').onclick = () => startFight({ seed, armies: [deployView.army, enemy], myTeam: 0, opp: 'ai', mode, world: { tid, kind } });
      },
    });
  }

  function showPrep(o) {
    cleanup();
    show('prep');
    const cfg = BATTLE_MODES[o.mode];
    const map = generateMap(o.seed, cfg.map);
    const enemyName = o.enemy ? o.enemy.name : o.enemyName || 'Gegner';
    const left = o.myTeam === 0 ? o.army.name : enemyName, right = o.myTeam === 0 ? enemyName : o.army.name;
    $('#battle-prep').innerHTML = `
      <div class="prep-head">
        <div><h2>${o.title}</h2><div class="vs"><span class="t0">${esc(left)}</span><span>vs</span><span class="t1">${esc(right)}</span></div></div>
        <div class="row">${o.actions}</div>
      </div>
      <div class="prep-cols">
        <div>
          <div class="canvas-wrap"><canvas id="deploy-canvas"></canvas></div>
          <p class="help" style="margin-top:8px">${modeHelp(o.mode)}</p>
        </div>
        <div class="prep-side">
          ${o.extraSide || ''}
          <div class="side-box"><h3 style="color:${TEAM_COLORS[o.myTeam].light}">Deine Allianz: ${esc(o.army.name)}</h3>
            <div class="help">Stärke ${fmt(armyPower(o.army))}</div>
            ${o.army.members.map((m) => miniRow(m.id, m.level)).join('')}<div style="margin-top:6px">${armySynergyHTML(o.army)}</div></div>
          ${o.enemy && o.enemyVisible ? `<div class="side-box"><h3 style="color:${TEAM_COLORS[1 - o.myTeam].light}">${esc(o.enemy.name)}</h3><div class="help">${esc(o.enemy.player)} · Stärke ${fmt(armyPower(o.enemy))}</div>
            ${o.enemy.members.map((m) => miniRow(m.id, m.level)).join('')}<div style="margin-top:6px">${armySynergyHTML(o.enemy)}</div></div>` : ''}
        </div>
      </div>`;
    deployView = new DeployView($('#deploy-canvas'), map, {
      army: o.army, myTeam: o.myTeam,
      enemy: o.enemyVisible ? o.enemy : null, enemyName, forts: cfg.forts,
      onChange: persistDeploy,
    });
    Wiki.hydrate($('#battle-prep'));
    o.bind();
  }

  /* ---------- Kampf ---------- */
  function startFight({ seed, armies, myTeam, opp, mode, practice, world }) {
    cleanup();
    closeModal();
    armies = armies.map((a) => sanitizeArmy(JSON.parse(JSON.stringify(a))));
    const cfg = BATTLE_MODES[mode];
    let control = ['auto', 'auto'];
    if (cfg.command) control = opp === 'live' ? ['player', 'player'] : myTeam === 0 ? ['player', 'ai'] : ['ai', 'player'];
    ctx = { mode, seed, myTeam, armies, opp, cfg, practice: practice || null, world: world || null };
    show('fight');
    const battle = new Battle(seed, armies, { mode, control });
    ctx.battle = battle;
    if (cfg.command && opp === 'live') lockstep = new Lockstep(battle, myTeam, (m) => Net.send(m));

    [0, 1].forEach((t) => {
      $('#hud-n' + t).innerHTML = `${esc(armies[t].name)}${t === myTeam ? ' (Du)' : ''}<small>${esc(armies[t].player)}</small>`;
      $('#hud-m' + t).classList.toggle('hidden', !cfg.morale);
      const list = $('#bat-list-' + t);
      list.innerHTML = battle.bats.filter((b) => b.team === t).map((b, i) => `
        <div class="bat ${cfg.command && t === myTeam ? 'clickable' : ''}" data-b="${b.idx}">
          <div class="bat-top"><div class="mini-por" data-portrait="${b.pid}" style="--rc:${TEAM_COLORS[t].main}"><span>${esc(initials(b.name))}</span></div>
          <div class="bat-name">${cfg.command && t === myTeam ? `<kbd>${i + 1}</kbd> ` : ''}${esc(b.name)}</div><span>${CLASSES[b.cls].icon}</span></div>
          <div class="hpbar"><i></i></div><div class="cdbar"><i></i></div>
          <div class="bat-sub"><span class="bs-units"></span><span class="bs-dmg"></span></div>
        </div>`).join('');
    });
    Wiki.hydrate($('#battle-fight'));

    const initHp = battle.bats.map((b) => battle.batUnits(b).reduce((a, u) => a + u.maxHp, 0));
    let frame = 0, logLen = -1;
    battleView = new BattleView($('#battle-canvas'), battle, {
      myTeam,
      gate: lockstep ? (b) => lockstep.gate(b) : null,
      onStall: (t) => $('#stall').classList.toggle('hidden', t < 0.6),
      onTick: (B) => {
        if (frame++ % 6 && !B.over) return;
        const rem = Math.max(0, B.maxTime - B.time);
        $('#hud-time').textContent = fmtTime(rem);
        [0, 1].forEach((t) => {
          const owned = B.ownedPoints(t);
          $('#hud-s' + t).innerHTML = `🏙️ ${owned}/${B.points.length} · ${Math.floor(B.score[t])} Pkt<br>🏛️ ${Math.ceil((B.hq[t].hp / B.hqHp) * 100)} %`;
          if (cfg.morale) {
            const mo = $('#hud-m' + t);
            $('i', mo).style.width = B.morale[t] + '%';
            $('i', mo).style.background = B.morale[t] < 30 ? '#ef4444' : B.morale[t] < 60 ? '#eab308' : '#22c55e';
            $('span', mo).textContent = `Moral ${Math.ceil(B.morale[t])}`;
          }
        });
        B.bats.forEach((b) => {
          const node = $(`.bat[data-b="${b.idx}"]`);
          if (!node) return;
          const us = B.batUnits(b);
          const hp = us.reduce((a, u) => a + u.hp, 0);
          $('.hpbar i', node).style.width = Math.min(100, (hp / initHp[b.idx]) * 100) + '%';
          $('.cdbar i', node).style.width = b.leaderGone ? '0%' : Math.max(0, Math.min(100, (1 - b.abilityLeft / b.abilityCd) * 100)) + '%';
          const unsup = us.filter((u) => u.unsup).length > us.length / 2;
          $('.bs-units', node).textContent = us.length ? `${us.length} Einh.${b.leaderGone ? ' · zurückgetreten' : ''}${unsup ? ' · ⚠️ kein Nachschub' : ''}${b.order && b.team === myTeam ? (b.order.arrived ? ' · ✋ hält' : ' · ➜ marschiert') : ''}` : 'aufgerieben';
          $('.bs-dmg', node).textContent = `💥 ${fmt(b.dmg)}`;
          node.classList.toggle('dead', !us.length);
          node.classList.toggle('sel', battleView && battleView.selected === b.idx);
          node.classList.toggle('ready', b.manual && b.team === myTeam && !b.leaderGone && b.abilityLeft <= 0 && us.length > 0);
        });
        if (cfg.command) updateCommandBar(B);
        if (B.log.length !== logLen) {
          logLen = B.log.length;
          $('#battle-log').innerHTML = B.log.slice(-7).map((l) => `<div class="${l.team >= 0 ? 't' + l.team : ''} k-${l.kind}"><time>${fmtTime(l.t)}</time>${esc(l.text)}</div>`).join('');
        }
      },
      onEnd: (B) => showResult(B),
    });
    battleView.start();

    // Tempo
    const speedLocked = !!lockstep;
    $('.hud-ctrl').classList.toggle('hidden', speedLocked);
    $$('.hud-ctrl [data-speed]').forEach((b) => {
      b.classList.toggle('active', b.dataset.speed === '1');
      b.classList.toggle('hidden', b.dataset.speed === '0' && opp === 'live');
      b.onclick = () => {
        const s = +b.dataset.speed;
        battleView.paused = s === 0;
        if (s) battleView.speed = s;
        $$('.hud-ctrl [data-speed]').forEach((x) => x.classList.toggle('active', x === b));
      };
    });
    $('#hud-surrender').onclick = () => {
      if (battle.over || !confirm('Wirklich aufgeben? Das zählt als Niederlage.')) return;
      if (lockstep) lockstep.issue({ c: 'surrender' });
      else { battle.surrender(myTeam); if (opp === 'live') Net.send({ t: 'surrender' }); }
    };

    $('#command-bar').classList.toggle('hidden', !cfg.command);
    if (cfg.command) setupCommandInput(battle, myTeam);
    window.scrollTo({ top: $('#battle-fight').offsetTop - 70, behavior: 'smooth' });
  }

  /* ---------- Kommando-Steuerung ---------- */
  function issue(cmd) {
    if (!ctx.battle || ctx.battle.over) return;
    if (lockstep) lockstep.issue(cmd); else ctx.battle.queueCommand(ctx.myTeam, cmd);
  }

  function ownBats() { return ctx.battle.bats.filter((b) => b.team === ctx.myTeam); }

  function select(idx) {
    if (!battleView) return;
    const b = ctx.battle.bats[idx];
    if (!b || b.team !== ctx.myTeam || !ctx.battle.batUnits(b).length) return;
    battleView.selected = idx;
    if (battleView.aim && !POLICIES[battleView.aim].needsBat) battleView.aim = null;
    updateCommandBar(ctx.battle, true);
  }

  function armPolicy(key) {
    const B = ctx.battle, P = POLICIES[key];
    if (!B.canPolicy(ctx.myTeam, key)) { toast(B.pcd[ctx.myTeam][key] > 0 ? `${P.name} lädt noch nach` : `Zu wenig Einfluss (${P.cost} nötig)`, 'bad'); return; }
    if (P.needsBat) {
      if (battleView.selected < 0) { toast('Wähle zuerst ein Bataillon für die Reservisten', 'bad'); return; }
      issue({ c: 'policy', p: key, b: battleView.selected, x: 0, y: 0 });
      return;
    }
    battleView.aim = battleView.aim === key ? null : key;
    updateCommandBar(B, true);
  }

  function setupCommandInput(battle, myTeam) {
    const canvas = $('#battle-canvas');
    const pos = (ev) => canvasToWorld(canvas, ev, battle.W, battle.H);
    listen(canvas, 'mousemove', (ev) => { if (battleView) battleView.mouse = pos(ev); });
    listen(canvas, 'mouseleave', () => { if (battleView) battleView.mouse = null; });
    listen(canvas, 'contextmenu', (ev) => { ev.preventDefault(); if (battleView) { battleView.aim = null; battleView.selected = -1; updateCommandBar(battle, true); } });
    const click = (ev) => {
      if (!battleView || battle.over || (ev.button !== undefined && ev.button !== 0)) return;
      ev.preventDefault();
      const p = pos(ev);
      battleView.mouse = p;
      if (battleView.aim) {
        issue({ c: 'policy', p: battleView.aim, x: Math.round(p.x), y: Math.round(p.y) });
        battleView.aim = null;
        updateCommandBar(battle, true);
        return;
      }
      const hit = battleView.batAt(p.x, p.y);
      if (hit >= 0) { select(hit); return; }
      if (battleView.selected >= 0) issue({ c: 'move', b: battleView.selected, x: Math.round(p.x), y: Math.round(p.y) });
    };
    listen(canvas, 'mousedown', click);
    listen(canvas, 'touchstart', click, { passive: false });
    listen(document, 'keydown', (ev) => {
      if ($('#battle-fight').classList.contains('hidden') || ev.target.tagName === 'INPUT') return;
      const k = ev.key.toLowerCase();
      const own = ownBats();
      if (k >= '1' && k <= '5' && own[+k - 1]) select(own[+k - 1].idx);
      else if ((k === 'q' || k === ' ') && battleView.selected >= 0) { ev.preventDefault(); issue({ c: 'ability', b: battleView.selected }); }
      else if (k === 'h' && battleView.selected >= 0) issue({ c: 'hold', b: battleView.selected });
      else if (k === 'f' && battleView.selected >= 0) issue({ c: 'free', b: battleView.selected });
      else if (k === 'escape') { battleView.aim = null; battleView.selected = -1; updateCommandBar(battle, true); }
      else { const i = POLICY_ORDER.findIndex((p, j) => k === ['z', 'x', 'c', 'v', 'b'][j]); if (i >= 0) armPolicy(POLICY_ORDER[i]); }
    });
    $$('#bat-list-' + myTeam + ' .bat').forEach((n) => (n.onclick = () => select(+n.dataset.b)));
    renderCommandBar();
  }

  function renderCommandBar() {
    $('#command-bar').innerHTML = `
      <div class="cp"><div class="cp-label">🗳️ Einfluss <b id="cp-val">0</b></div><div class="cp-bar"><i id="cp-fill"></i></div></div>
      <div class="policies">${POLICY_ORDER.map((k, j) => `<button class="policy" data-p="${k}" title="${esc(POLICIES[k].desc)} (Taste ${'ZXCVB'[j]})">
        <span class="pi">${POLICIES[k].icon}</span><span class="pn">${POLICIES[k].name}</span><span class="pc">${POLICIES[k].cost}</span><i class="pcd"></i></button>`).join('')}</div>
      <div class="sel-panel" id="sel-panel"></div>`;
    $$('#command-bar .policy').forEach((b) => (b.onclick = () => armPolicy(b.dataset.p)));
  }

  function updateCommandBar(B, force) {
    if (!$('#cp-val') || !battleView) return;
    const t = ctx.myTeam;
    $('#cp-val').textContent = Math.floor(B.cp[t]);
    $('#cp-fill').style.width = (B.cp[t] / CP_MAX) * 100 + '%';
    $$('#command-bar .policy').forEach((b) => {
      const k = b.dataset.p, P = POLICIES[k];
      const cd = B.pcd[t][k] || 0;
      b.classList.toggle('armed', battleView.aim === k);
      b.classList.toggle('off', !B.canPolicy(t, k));
      $('.pcd', b).style.height = cd > 0 ? (cd / P.cd) * 100 + '%' : '0';
    });
    const panel = $('#sel-panel');
    const bat = B.bats[battleView.selected];
    const key = bat ? `${bat.idx}|${bat.leaderGone}|${bat.abilityLeft <= 0}|${!!bat.order}|${B.batUnits(bat).length > 0}` : 'none';
    if (!force && panel.dataset.key === key) return;
    panel.dataset.key = key;
    if (!bat || !B.batUnits(bat).length) {
      if (bat) battleView.selected = -1;
      panel.innerHTML = `<span class="help">👆 Klicke ein eigenes Bataillon an (oder Taste 1–5), dann einen Zielort auf der Karte.${battleView.aim ? ` <b style="color:#fde047">Zielgebiet für ${POLICIES[battleView.aim].name} wählen …</b>` : ''}</span>`;
      return;
    }
    const C = CLASSES[bat.cls];
    const ready = !bat.leaderGone && bat.abilityLeft <= 0;
    panel.innerHTML = `
      <div class="sel-name">${C.icon} <b>${esc(bat.name)}</b></div>
      <button class="btn small ${ready ? 'gold' : ''}" id="sp-ab" ${ready ? '' : 'disabled'} title="${esc(C.abilityDesc)}">⚡ ${C.ability} (Q)${bat.leaderGone ? ' – zurückgetreten' : ''}</button>
      <button class="btn small" id="sp-hold">✋ Halten (H)</button>
      <button class="btn small" id="sp-free" ${bat.order ? '' : 'disabled'}>🔓 Frei (F)</button>
      ${battleView.aim ? `<span class="help" style="color:#fde047">Zielgebiet für ${POLICIES[battleView.aim].name} wählen …</span>` : ''}`;
    $('#sp-ab').onclick = () => issue({ c: 'ability', b: bat.idx });
    $('#sp-hold').onclick = () => issue({ c: 'hold', b: bat.idx });
    $('#sp-free').onclick = () => issue({ c: 'free', b: bat.idx });
  }

  /* ---------- Ergebnis ---------- */
  function showResult(B) {
    const sum = B.summary();
    const me = ctx.myTeam;
    const cfg = ctx.cfg;
    const outcome = sum.winner === -1 ? 'draw' : sum.winner === me ? 'win' : 'lose';
    let reward = 0;
    const stage = stageOf(ctx.mode);
    let worldRes = null;
    if (ctx.world) {
      worldRes = resolveWorldBattle(ctx.world.tid, ctx.world.kind, outcome);
      reward = worldRes.reward;
      if (outcome === 'win') S.stats.wins++; else if (outcome === 'lose') S.stats.losses++; else S.stats.draws++;
    } else if (ctx.opp === 'ai' && ctx.practice) {
      const d = PRACTICE[ctx.practice];
      reward = outcome === 'win' ? d.win : outcome === 'draw' ? Math.round(d.win / 2) : 15;
      if (outcome === 'win') S.stats.wins++; else if (outcome === 'lose') S.stats.losses++; else S.stats.draws++;
    } else if (ctx.opp === 'ai') {
      reward = outcome === 'win' ? 80 + 20 * stage : outcome === 'draw' ? 40 : 25;
      if (outcome === 'win') { S.stats.wins++; S.stages[ctx.mode] = stage + 1; } else if (outcome === 'lose') S.stats.losses++; else S.stats.draws++;
    } else {
      reward = outcome === 'win' ? 120 : outcome === 'draw' ? 70 : 50;
      if (outcome === 'win') S.stats.pvpWins++; else if (outcome === 'lose') S.stats.pvpLosses++; else S.stats.draws++;
    }
    if (!ctx.world) reward = Math.round(reward * cfg.reward);
    if (/aufgegeben/.test(sum.reason) && outcome === 'lose') reward = 0;
    if (ctx.opp === 'code') {
      S.codeFights = S.codeFights || {};
      const k = String(ctx.seed);
      if (S.codeFights[k]) reward = 0; else S.codeFights[k] = 1;
    }
 // Aufträge, Erfahrung, erster Sieg des Tages
    const surrendered = /aufgegeben/.test(sum.reason) && outcome === 'lose';
    let firstWin = 0;
    if (!surrendered) {
      ensureEarnState();
      track('battle');
      track(ctx.mode);
      const mine = (k) => B.log.filter((l) => l.kind === k && l.team === me).length;
      track('capture', mine('capture'));
      track('policy', mine('policy'));
      track('ability', B.bats.filter((b) => b.team === me).reduce((a, b) => a + b.abilities, 0));
      track('kills', sum.bats.filter((b) => b.team === me).reduce((a, b) => a + b.kills, 0));
      if (outcome === 'win') {
        track('win');
        if (ctx.mode === 'grand') track('grandWin');
        if (ctx.mode === 'command') track('commandWin');
        if (ctx.opp !== 'ai') track('pvpWin');
        if (!S.daily.firstWin) { S.daily.firstWin = true; firstWin = FIRST_WIN_BONUS; reward += firstWin; }
      }
    }
    addVotes(reward);
    saveState();
    const xp = surrendered ? 0 : Math.round((outcome === 'win' ? 40 : 15) * cfg.reward) + (worldRes ? worldRes.xp : 0);
    const mvp = sum.bats.reduce((a, b) => (b.dmg + b.heal > a.dmg + a.heal ? b : a), sum.bats[0]);
    const rows = (t) => sum.bats.filter((b) => b.team === t).map((b) => `<tr>
        <td>${b === mvp ? '⭐ ' : ''}${CLASSES[b.cls].icon} ${esc(b.name)}</td><td class="n">${fmt(b.dmg)}</td><td class="n">${b.kills}</td><td class="n">${fmt(b.heal)}</td>
        <td>${b.alive ? (b.leaderGone ? '🏳️ zurückgetreten' : '✅ im Amt') : '💀 aufgerieben'}</td></tr>`).join('');
    const title = { win: '🏆 Wahlsieg!', lose: '📉 Niederlage', draw: '🤝 Große Koalition' }[outcome];
    const actions = ctx.world
      ? `<button class="btn primary" id="rs-world">🌍 Zur Weltkarte</button>`
      : ctx.opp === 'ai'
      ? `<button class="btn" id="rs-menu">Zum Menü</button><button class="btn primary" id="rs-next">${ctx.practice ? 'Neues Übungsgefecht' : outcome === 'win' ? `Weiter zu Stufe ${stageOf(ctx.mode)}` : 'Nochmal versuchen'}</button>`
      : ctx.opp === 'live'
        ? `<button class="btn" id="rs-leave">Raum verlassen</button><button class="btn primary" id="rs-rematch">🔁 Revanche</button>`
        : `<button class="btn" id="rs-menu">Zum Menü</button>`;
    openModal(`
      <div class="result-title ${outcome}">${title}</div>
      <div class="result-sub">${cfg.icon} ${cfg.name} · ${esc(sum.reason)} · ${fmtTime(sum.time)} · Wertung ${sum.scores[0].toFixed(0)} : ${sum.scores[1].toFixed(0)}</div>
      ${[0, 1].map((t) => `<h3 style="color:${TEAM_COLORS[t].light}">${esc(ctx.armies[t].name)}${t === me ? ' (Du)' : ''}</h3>
        <table class="result-table"><tr><th>Bataillon</th><th>Schaden</th><th>Besiegt</th><th>Heilung</th><th>Status</th></tr>${rows(t)}</table>`).join('')}
      ${worldRes ? `<div class="world-news">${worldRes.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      <div class="reward">${reward ? `+${reward} 🗳️ Stimmen${firstWin ? ` <small>(inkl. ${firstWin} für den ersten Sieg des Tages)</small>` : ''}` : ctx.opp === 'code' ? 'Keine Belohnung (Code-Paarung bereits gewertet)' : 'Keine Belohnung'}${xp ? `<div class="help">+${xp} Erfahrung</div>` : ''}</div>
      <div class="row" style="justify-content:center">${actions}</div>`);
    if (xp) gainXp(xp);
    const go = (fn) => () => { closeModal(); fn(); };
    if ($('#rs-menu')) $('#rs-menu').onclick = go(showMenu);
    if ($('#rs-world')) $('#rs-world').onclick = go(() => switchTab('world'));
    if ($('#rs-next')) $('#rs-next').onclick = go(() => startAI(ctx.practice));
    if ($('#rs-leave')) $('#rs-leave').onclick = go(() => { Net.close(); live.phase = 'idle'; showMenu(); });
    if ($('#rs-rematch')) $('#rs-rematch').onclick = go(() => {
      if (Net.role === 'host') newLiveRound(); else { Net.send({ t: 'rematch' }); showLiveLobby('Revanche angefragt – warte auf den Host …'); }
    });
  }

  /* ---------- Freundes-Code ---------- */
  function showCodeMode() {
    cleanup();
    show('prep');
    const mode = curMode();
    const cfg = BATTLE_MODES[mode];
    const army = myArmy();
    const code = encodeCode(army);
    $('#battle-prep').innerHTML = `
      <div class="prep-head"><h2>📨 Freundes-Code · ${cfg.icon} ${cfg.name}</h2><button class="btn" id="cm-back">← Zurück</button></div>
      <div class="prep-cols">
        <div class="side-box">
          <h3>1. Schicke deinem Freund deinen Allianz-Code</h3>
          <p class="help">Der Code enthält deine aktive Allianz „${esc(army.name)}“ mit Levels und Aufstellung. Die Aufstellung änderst du in der KI- oder Live-Vorbereitung. <b>Sagt euch, welchen Modus ihr spielt:</b> ${cfg.icon} ${cfg.name}.</p>
          <textarea id="cm-mine" rows="4" readonly>${code}</textarea>
          <div class="row" style="margin-top:8px"><button class="btn" id="cm-copy">📋 Code kopieren</button><button class="btn" id="cm-share">📤 Teilen</button></div>
          <h3 style="margin-top:18px">2. Füge den Code deines Freundes ein</h3>
          <textarea id="cm-theirs" rows="4" placeholder="PG1.…"></textarea>
          <div class="row" style="margin-top:8px"><button class="btn primary big" id="cm-go">⚔️ Schlacht starten</button></div>
          <p class="help" id="cm-preview"></p>
        </div>
        <div class="prep-side"><div class="side-box"><h3>Fair für beide</h3>
          <p class="help">Die Schlacht ist deterministisch. Aus beiden Codes und dem Modus werden dieselbe Karte und derselbe Zufall berechnet, egal wer startet. Ihr seht also beide exakt dasselbe Gefecht. 😉</p>
          <p class="help">Belohnung: Pro Code-Paarung gibt es einmal Stimmen.</p></div>
          <div class="side-box"><h3>Deine Allianz</h3>${army.members.map((m) => miniRow(m.id, m.level)).join('')}</div>
        </div>
      </div>`;
    Wiki.hydrate($('#battle-prep'));
    $('#cm-back').onclick = showMenu;
    $('#cm-copy').onclick = () => copyText(code);
    $('#cm-share').onclick = () => {
      const text = `Fordere mich in PoliticGacha heraus (Modus: ${cfg.name})! Mein Allianz-Code:\n${code}`;
      if (navigator.share) navigator.share({ title: 'PoliticGacha', text }).catch(() => {}); else copyText(text);
    };
    const parse = () => {
      const raw = $('#cm-theirs').value.trim();
      if (!raw) return null;
      try { return sanitizeArmy(decodeCode(raw)); } catch (e) { return { error: e.message }; }
    };
    $('#cm-theirs').oninput = () => {
      const a = parse();
      $('#cm-preview').innerHTML = !a ? '' : a.error ? `⚠️ ${esc(a.error)}` : `Gegner: <b>${esc(a.name)}</b> von ${esc(a.player)}: ${a.members.map((m) => esc(POL_BY_ID[m.id].name) + ' Lv' + m.level).join(', ')}`;
    };
    $('#cm-go').onclick = () => {
      const theirs = parse();
      if (!theirs || theirs.error) { toast('Bitte einen gültigen Code einfügen', 'bad'); return; }
      const theirCode = encodeCode(theirs);
      const mine = sanitizeArmy(decodeCode(code));
      const myCode = encodeCode(mine);
      if (theirCode === myCode) { toast('Das ist dein eigener Code 🙂', 'bad'); return; }
      const iAmFirst = myCode < theirCode;
      const pair = iAmFirst ? [myCode, theirCode] : [theirCode, myCode];
      const seed = hashStr(mode + '|' + pair.join('|'));
      startFight({ seed, armies: iAmFirst ? [mine, theirs] : [theirs, mine], myTeam: iAmFirst ? 0 : 1, opp: 'code', mode });
    };
  }

  /* ---------- Live (PeerJS) ---------- */
  function setupNetHandlers() {
    Net.on({
      hosting: () => { live.phase = 'hosting'; showLiveLobby(); },
      open: () => Net.send({ t: 'hello', name: S.name, v: 2 }),
      message: (m) => onNetMessage(m),
      close: () => {
        toast('Verbindung zum Gegner beendet', 'bad');
        const inFight = !$('#battle-fight').classList.contains('hidden');
        live.phase = 'idle';
        if (!inFight) showMenu();
        else if (lockstep && ctx.battle && !ctx.battle.over) { ctx.battle.end(ctx.myTeam, 'Gegner hat die Verbindung getrennt'); }
      },
      error: (e) => {
        toast('Online: ' + esc(netErrorText(e)), 'bad');
        if (!Net.connected) { live.phase = 'idle'; Net.close(); showLiveLobby(); }
      },
    });
  }

  function onNetMessage(m) {
    if (!m || typeof m !== 'object') return;
    if ((m.t === 'cmds' || m.t === 'hash') && lockstep) { lockstep.receive(m); return; }
    if (m.t === 'full') { toast('Der Raum ist bereits voll', 'bad'); Net.close(); live.phase = 'idle'; showLiveLobby(); return; }
    if (m.t === 'hello') {
      live.opponent = String(m.name || 'Gegner').slice(0, 24);
      if (m.v !== 2) toast('⚠️ Dein Gegner nutzt eine andere Spielversion. Bitte beide die Seite neu laden.', 'bad');
      toast(`🤝 Verbunden mit ${esc(live.opponent)}`, 'good');
      live.phase = 'connected';
      if (Net.role === 'host') newLiveRound(); else showLiveLobby('Verbunden – warte auf die Karte des Hosts …');
    } else if (m.t === 'round') {
      live.seed = m.seed >>> 0;
      live.mode = BATTLE_MODES[m.mode] ? m.mode : 'classic';
      enterLivePrep();
    } else if (m.t === 'ready') {
      try { live.oppArmy = sanitizeArmy(m.army); } catch { return; }
      live.oppReady = true;
      updateLiveStatus();
      maybeStartLive();
    } else if (m.t === 'unready') {
      live.oppReady = false; updateLiveStatus();
    } else if (m.t === 'start') {
      if (Net.role !== 'guest') return;
      try {
        const armies = m.armies.map(sanitizeArmy);
        startFight({ seed: m.seed >>> 0, armies, myTeam: 1, opp: 'live', mode: BATTLE_MODES[m.mode] ? m.mode : 'classic' });
      } catch { toast('Ungültige Startdaten', 'bad'); }
    } else if (m.t === 'surrender') {
      if (ctx.battle && !lockstep) ctx.battle.surrender(1 - ctx.myTeam);
    } else if (m.t === 'rematch') {
      if (Net.role === 'host') { closeModal(); toast(`${esc(live.opponent)} will eine Revanche!`); newLiveRound(); }
    }
  }

  function newLiveRound() {
    live.seed = randomSeed();
    live.mode = curMode();
    Net.send({ t: 'round', seed: live.seed, mode: live.mode });
    enterLivePrep();
  }

  function enterLivePrep() {
    closeModal();
    live.myReady = false; live.oppReady = false; live.oppArmy = null; live.phase = 'prep';
    const army = myArmy();
    const myTeam = Net.role === 'host' ? 0 : 1;
    const cfg = BATTLE_MODES[live.mode];
    showPrep({
      title: `🌐 ${cfg.icon} ${cfg.name} live gegen ${esc(live.opponent)}`,
      seed: live.seed, mode: live.mode, army, myTeam, enemyVisible: false, enemyName: live.opponent,
      extraSide: `<div class="side-box"><h3>Status</h3><div id="live-status" class="status"></div></div>`,
      actions: `<button class="btn" id="pr-leave">Raum verlassen</button><button class="btn primary big" id="pr-ready">✅ Bereit</button>`,
      bind: () => {
        $('#pr-leave').onclick = () => { Net.close(); live.phase = 'idle'; showMenu(); };
        $('#pr-ready').onclick = () => {
          live.myReady = !live.myReady;
          deployView.locked = live.myReady;
          if (live.myReady) { persistDeploy(deployView.army); Net.send({ t: 'ready', army: deployView.army }); }
          else Net.send({ t: 'unready' });
          updateLiveStatus();
          maybeStartLive();
        };
        updateLiveStatus();
      },
    });
  }

  function updateLiveStatus() {
    const st = $('#live-status');
    if (st) st.innerHTML = `Du: ${live.myReady ? '<span class="status ok">bereit ✓</span>' : 'stellst auf …'}<br>${esc(live.opponent)}: ${live.oppReady ? '<span class="status ok">bereit ✓</span>' : 'stellt auf …'}
      <p class="help">Modus: ${BATTLE_MODES[live.mode].icon} ${BATTLE_MODES[live.mode].name} (wählt der Host im Schlacht-Menü). Der Gegner bleibt bis zum Start verdeckt. Sobald beide bereit sind, beginnt die Schlacht.</p>`;
    const b = $('#pr-ready');
    if (b) b.textContent = live.myReady ? '✋ Doch nicht bereit' : '✅ Bereit';
  }

  function maybeStartLive() {
    if (Net.role !== 'host' || !live.myReady || !live.oppReady || !deployView) return;
    const armies = [sanitizeArmy(deployView.army), live.oppArmy];
    Net.send({ t: 'start', seed: live.seed, armies, mode: live.mode });
    startFight({ seed: live.seed, armies, myTeam: 0, opp: 'live', mode: live.mode });
  }

  function showLiveLobby(statusText) {
    cleanup();
    show('prep');
    setupNetHandlers();
    const hosting = Net.role === 'host' && live.phase === 'hosting';
    const link = Net.code ? `${location.origin}${location.pathname}?join=${Net.code}` : '';
    const cfg = BATTLE_MODES[curMode()];
    $('#battle-prep').innerHTML = `
      <div class="prep-head"><h2>🌐 Live gegen Freunde</h2><button class="btn" id="lv-back">← Zurück</button></div>
      <div class="mode-grid" style="margin-top:0">
        <div class="side-box">
          <h3>Raum erstellen</h3>
          ${hosting ? `<p class="help">Gib diesen Code an deinen Freund weiter:</p><div class="code-big">${Net.code}</div>
            <div class="row" style="margin-top:10px"><button class="btn" id="lv-copy">📋 Einladungslink kopieren</button></div>
            <p class="status warn" style="margin-top:10px">⏳ Warte auf Mitspieler …</p>`
            : `<p class="help">Du wirst Host (blaue Seite) und bestimmst den Modus: <b>${cfg.icon} ${cfg.name}</b> (änderbar im Schlacht-Menü).</p><button class="btn primary" id="lv-host">Raum erstellen</button>`}
        </div>
        <div class="side-box">
          <h3>Raum beitreten</h3>
          <p class="help">Code vom Freund eingeben (du spielst auf der roten Seite):</p>
          <div class="row"><input id="lv-code" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:4px;font-weight:800;width:140px">
          <button class="btn primary" id="lv-join">Beitreten</button></div>
        </div>
      </div>
      <p class="status" id="lv-status" style="margin-top:12px">${statusText || (Net.available() ? '' : '⚠️ PeerJS konnte nicht geladen werden, der Online-Modus ist nicht verfügbar. Nutze den Freundes-Code.')}</p>
      <p class="help">Die Verbindung läuft direkt zwischen euren Browsern (WebRTC über PeerJS). Nur der Verbindungsaufbau nutzt den öffentlichen PeerJS-Server.</p>`;
    $('#lv-back').onclick = () => { Net.close(); live.phase = 'idle'; showMenu(); };
    if ($('#lv-host')) $('#lv-host').onclick = () => { $('#lv-status').textContent = 'Erstelle Raum …'; Net.host(); };
    if ($('#lv-copy')) $('#lv-copy').onclick = () => copyText(link);
    $('#lv-join').onclick = () => {
      const c = $('#lv-code').value.trim();
      if (c.length < 5) { toast('Der Code hat 5 Zeichen', 'bad'); return; }
      $('#lv-status').textContent = 'Verbinde …';
      live.phase = 'joining';
      Net.join(c);
    };
    $('#lv-code').onkeydown = (e) => { if (e.key === 'Enter') $('#lv-join').click(); };
  }

  function autoJoin(code) {
    switchTab('battle');
    if (!activeAlliance() || !activeAlliance().members.length) return;
    showLiveLobby('Verbinde mit Raum ' + esc(code) + ' …');
    $('#lv-code').value = code;
    live.phase = 'joining';
    Net.join(code);
  }

  /* für Tests */
  const _debug = { get ctx() { return ctx; }, get view() { return battleView; }, onNetMessage, get lockstep() { return lockstep; } };

  return { showMenu, autoJoin, startWorld, _debug };
})();
