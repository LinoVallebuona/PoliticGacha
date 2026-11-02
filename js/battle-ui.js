/* Schlacht-Bildschirm: Modus-Auswahl, Aufstellung, Kampf, Ergebnis, Online-Lobby */
const BattleUI = (() => {
  let ctx = {};          // aktueller Kampfkontext
  let deployView = null, battleView = null;
  let live = { opponent: '', myReady: false, oppReady: false, oppArmy: null, seed: 0, phase: 'idle' };

  const show = (which) => {
    ['menu', 'prep', 'fight'].forEach((k) => $('#battle-' + k).classList.toggle('hidden', k !== which));
  };
  const cleanup = () => {
    if (deployView) { deployView.destroy(); deployView = null; }
    if (battleView) { battleView.stop(); battleView = null; }
  };

  function miniRow(id, level, team) {
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

  /* ---------- Menü ---------- */
  function showMenu() {
    cleanup();
    if (Net.connected && live.phase !== 'idle') { showLiveLobby(); return; }
    show('menu');
    const al = activeAlliance();
    const m = $('#battle-menu');
    m.innerHTML = `
      <div class="battle-top">
        <div class="row">
          <label class="help">Aktive Allianz:</label>
          <select id="bm-alliance">${S.alliances.map((a) => `<option value="${a.id}" ${al && a.id === al.id ? 'selected' : ''}>${esc(a.name)} (${a.members.length}/5 · ${fmt(alliancePower(a.members))})</option>`).join('')}</select>
          <button class="btn small" id="bm-edit">Bearbeiten</button>
        </div>
        <div class="record">Kampagne: <b>Stufe ${S.stage}</b> · Siege <b>${S.stats.wins}</b> · Niederlagen <b>${S.stats.losses}</b> · PvP <b>${S.stats.pvpWins}:${S.stats.pvpLosses}</b></div>
      </div>
      <div class="mode-grid">
        <div class="mode mode-ai"><div class="mode-icon">🤖</div><h3>Kampagne gegen KI</h3>
          <p>Kämpfe dich durch immer stärkere Oppositionen. Jeder Sieg bringt Stimmen und schaltet die nächste Stufe frei.</p>
          <button class="btn primary" id="bm-ai">Stufe ${S.stage} starten</button></div>
        <div class="mode mode-live"><div class="mode-icon">🌐</div><h3>Live gegen Freunde</h3>
          <p>Erstelle einen Raum und schicke den Code an einen Freund. Ihr stellt eure Truppen gleichzeitig auf und schaut dieselbe Schlacht live.</p>
          <button class="btn primary" id="bm-live">Online-Raum öffnen</button></div>
        <div class="mode mode-code"><div class="mode-icon">📨</div><h3>Freundes-Code</h3>
          <p>Kein gemeinsamer Termin? Tauscht eure Allianz-Codes per Messenger aus. Beide sehen garantiert exakt dieselbe Schlacht.</p>
          <button class="btn primary" id="bm-code">Codes tauschen</button></div>
      </div>
      <div class="side-box" style="margin-top:18px">
        <h3>So funktioniert die Schlacht</h3>
        <div class="help">Jeder Politiker deiner Allianz führt ein Bataillon. Die Truppen kämpfen selbstständig. Sie erobern die drei Städte in der Mitte und greifen den gegnerischen Regierungssitz an.
        Du gewinnst, wenn der feindliche Regierungssitz fällt oder alle feindlichen Truppen aufgerieben sind. Fällt keine Entscheidung, gewinnt nach 2:30 die bessere Punktwertung: gehaltene Städte, Zustand des Regierungssitzes und verbliebene Truppen.
        Wälder schützen (−30 % Schaden) und bremsen, Hügel erhöhen die Reichweite. Fällt der Anführer, <i>tritt er zurück</i>: Das Bataillon verliert seine Fähigkeit und kämpft schwächer weiter.</div>
        <div class="legend">${Object.entries(CLASSES).map(([k, c]) => `<span>${c.icon} <b>${c.name}</b>: ${c.ability}${Object.keys(COUNTERS[k]).length ? ' · stark gg. ' + Object.keys(COUNTERS[k]).map((x) => CLASSES[x].icon).join('') : ''}</span>`).join('')}</div>
      </div>`;
    $('#bm-alliance').onchange = (e) => { S.activeAlliance = e.target.value; saveState(); showMenu(); };
    $('#bm-edit').onclick = () => switchTab('alliances');
    const need = () => { const a = activeAlliance(); if (!a || !a.members.length) { toast('Stelle zuerst eine Allianz mit mindestens einem Politiker auf!', 'bad'); switchTab('alliances'); return null; } return a; };
    $('#bm-ai').onclick = () => { if (need()) startAI(); };
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

  function startAI() {
    const seed = randomSeed();
    const enemy = makeAiArmy(S.stage, seed);
    const army = myArmy();
    ctx = { mode: 'ai', seed, myTeam: 0 };
    showPrep({
      title: `Kampagne · Stufe ${S.stage}`,
      seed, army, myTeam: 0, enemy, enemyVisible: true,
      actions: `<button class="btn" id="pr-back">← Zurück</button><button class="btn primary big" id="pr-go">⚔️ Schlacht beginnen</button>`,
      bind: () => {
        $('#pr-back').onclick = showMenu;
        $('#pr-go').onclick = () => startFight(seed, [deployView.army, enemy], 0, 'ai');
      },
    });
  }

  function showPrep(o) {
    cleanup();
    show('prep');
    const map = generateMap(o.seed);
    const enemyName = o.enemy ? o.enemy.name : o.enemyName || 'Gegner';
    const left = o.myTeam === 0 ? o.army.name : enemyName, right = o.myTeam === 0 ? enemyName : o.army.name;
    $('#battle-prep').innerHTML = `
      <div class="prep-head">
        <div><h2>${o.title}</h2><div class="vs"><span class="t0">${esc(left)}</span><span>vs</span><span class="t1">${esc(right)}</span></div></div>
        <div class="row">${o.actions}</div>
      </div>
      <div class="prep-cols">
        <div class="canvas-wrap"><canvas id="deploy-canvas"></canvas></div>
        <div class="prep-side">
          ${o.extraSide || ''}
          <div class="side-box"><h3 style="color:${TEAM_COLORS[o.myTeam].light}">Deine Allianz: ${esc(o.army.name)}</h3>
            ${o.army.members.map((m) => miniRow(m.id, m.level)).join('')}<div style="margin-top:6px">${armySynergyHTML(o.army)}</div></div>
          ${o.enemy && o.enemyVisible ? `<div class="side-box"><h3 style="color:${TEAM_COLORS[1 - o.myTeam].light}">${esc(o.enemy.name)}</h3><div class="help">${esc(o.enemy.player)}</div>
            ${o.enemy.members.map((m) => miniRow(m.id, m.level)).join('')}<div style="margin-top:6px">${armySynergyHTML(o.enemy)}</div></div>` : ''}
        </div>
      </div>`;
    deployView = new DeployView($('#deploy-canvas'), map, {
      army: o.army, myTeam: o.myTeam,
      enemy: o.enemyVisible ? o.enemy : null, enemyName,
      onChange: persistDeploy,
    });
    Wiki.hydrate($('#battle-prep'));
    o.bind();
  }

  /* ---------- Kampf ---------- */
  function startFight(seed, armies, myTeam, mode) {
    cleanup();
    armies = armies.map((a) => sanitizeArmy(JSON.parse(JSON.stringify(a))));
    ctx = { mode, seed, myTeam, armies };
    show('fight');
    const battle = new Battle(seed, armies);
    ctx.battle = battle;
    [0, 1].forEach((t) => {
      $('#hud-n' + t).innerHTML = `${esc(armies[t].name)}${t === myTeam ? ' (Du)' : ''}<small>${esc(armies[t].player)}</small>`;
      const list = $('#bat-list-' + t);
      list.innerHTML = battle.bats.filter((b) => b.team === t).map((b) => `
        <div class="bat" data-b="${b.idx}">
          <div class="bat-top"><div class="mini-por" data-portrait="${b.pid}" style="--rc:${TEAM_COLORS[t].main}"><span>${esc(initials(b.name))}</span></div>
          <div class="bat-name">${esc(b.name)}</div><span>${CLASSES[b.cls].icon}</span></div>
          <div class="hpbar"><i></i></div><div class="cdbar"><i></i></div>
          <div class="bat-sub"><span class="bs-units"></span><span class="bs-dmg"></span></div>
        </div>`).join('');
    });
    Wiki.hydrate($('#battle-fight'));
    const initHp = battle.bats.map((b) => battle.batUnits(b).reduce((a, u) => a + u.maxHp, 0));
    let frame = 0, logLen = -1;
    battleView = new BattleView($('#battle-canvas'), battle, {
      myTeam,
      onTick: (B) => {
        if (frame++ % 6 && !B.over) return;
        const rem = Math.max(0, SIM_MAX_TIME - B.time);
        $('#hud-time').textContent = `${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, '0')}`;
        [0, 1].forEach((t) => {
          const owned = B.points.filter((p) => p.owner === t).length;
          $('#hud-s' + t).innerHTML = `🏙️ ${owned}/3 · ${Math.floor(B.score[t])} Pkt<br>🏛️ ${Math.ceil((B.hq[t].hp / HQ_HP) * 100)} %`;
        });
        B.bats.forEach((b) => {
          const node = $(`.bat[data-b="${b.idx}"]`);
          if (!node) return;
          const us = B.batUnits(b);
          const hp = us.reduce((a, u) => a + u.hp, 0);
          $('.hpbar i', node).style.width = Math.min(100, (hp / initHp[b.idx]) * 100) + '%';
          $('.cdbar i', node).style.width = b.leaderGone ? '0%' : Math.max(0, Math.min(100, (1 - b.abilityLeft / b.abilityCd) * 100)) + '%';
          $('.bs-units', node).textContent = us.length ? `${us.length} Einheiten${b.leaderGone ? ' · zurückgetreten' : ''}` : 'aufgerieben';
          $('.bs-dmg', node).textContent = `💥 ${fmt(b.dmg)}`;
          node.classList.toggle('dead', !us.length);
        });
        if (B.log.length !== logLen) {
          logLen = B.log.length;
          $('#battle-log').innerHTML = B.log.slice(-7).map((l) => `<div class="${l.team >= 0 ? 't' + l.team : ''} ${l.kind}"><time>${Math.floor(l.t / 60)}:${String(Math.floor(l.t % 60)).padStart(2, '0')}</time>${esc(l.text)}</div>`).join('');
        }
      },
      onEnd: (B) => showResult(B),
    });
    battleView.start();
    $$('.hud-ctrl [data-speed]').forEach((b) => {
      b.classList.toggle('active', b.dataset.speed === '1');
      b.onclick = () => {
        const s = +b.dataset.speed;
        battleView.paused = s === 0;
        if (s) battleView.speed = s;
        $$('.hud-ctrl [data-speed]').forEach((x) => x.classList.toggle('active', x === b));
      };
    });
    $('#hud-skip').onclick = () => battleView && battleView.skip();
    window.scrollTo({ top: $('#battle-fight').offsetTop - 70, behavior: 'smooth' });
  }

  function showResult(B) {
    const sum = B.summary();
    const me = ctx.myTeam;
    const outcome = sum.winner === -1 ? 'draw' : sum.winner === me ? 'win' : 'lose';
    let reward = 0;
    if (ctx.mode === 'ai') {
      reward = outcome === 'win' ? 80 + 20 * S.stage : outcome === 'draw' ? 40 : 25;
      if (outcome === 'win') { S.stats.wins++; S.stage++; } else if (outcome === 'lose') S.stats.losses++; else S.stats.draws++;
    } else {
      reward = outcome === 'win' ? 120 : outcome === 'draw' ? 70 : 50;
      if (outcome === 'win') S.stats.pvpWins++; else if (outcome === 'lose') S.stats.pvpLosses++; else S.stats.draws++;
    }
    if (ctx.mode === 'code') {
      // Belohnung pro Code-Paarung nur einmal
      S.codeFights = S.codeFights || {};
      const k = String(ctx.seed);
      if (S.codeFights[k]) reward = 0; else S.codeFights[k] = 1;
    }
    addVotes(reward);
    saveState();
    const mvp = sum.bats.reduce((a, b) => (b.dmg + b.heal > a.dmg + a.heal ? b : a), sum.bats[0]);
    const rows = (t) => sum.bats.filter((b) => b.team === t).map((b) => `<tr>
        <td>${b === mvp ? '⭐ ' : ''}${CLASSES[b.cls].icon} ${esc(b.name)}</td><td class="n">${fmt(b.dmg)}</td><td class="n">${b.kills}</td><td class="n">${fmt(b.heal)}</td>
        <td>${b.alive ? (b.leaderGone ? '🏳️ zurückgetreten' : '✅ im Amt') : '💀 aufgerieben'}</td></tr>`).join('');
    const title = { win: '🏆 Wahlsieg!', lose: '📉 Niederlage', draw: '🤝 Große Koalition' }[outcome];
    const actions = ctx.mode === 'ai'
      ? `<button class="btn" id="rs-menu">Zum Menü</button><button class="btn primary" id="rs-next">${outcome === 'win' ? `Weiter zu Stufe ${S.stage}` : 'Nochmal versuchen'}</button>`
      : ctx.mode === 'live'
        ? `<button class="btn" id="rs-leave">Raum verlassen</button><button class="btn primary" id="rs-rematch">🔁 Revanche</button>`
        : `<button class="btn" id="rs-menu">Zum Menü</button>`;
    openModal(`
      <div class="result-title ${outcome}">${title}</div>
      <div class="result-sub">${esc(sum.reason)} · ${Math.floor(sum.time / 60)}:${String(Math.floor(sum.time % 60)).padStart(2, '0')} · Wertung ${sum.scores[0].toFixed(0)} : ${sum.scores[1].toFixed(0)}</div>
      ${[0, 1].map((t) => `<h3 style="color:${TEAM_COLORS[t].light}">${esc(ctx.armies[t].name)}${t === me ? ' (Du)' : ''}</h3>
        <table class="result-table"><tr><th>Bataillon</th><th>Schaden</th><th>Besiegt</th><th>Heilung</th><th>Status</th></tr>${rows(t)}</table>`).join('')}
      <div class="reward">${reward ? `+${reward} 🗳️ Stimmen` : 'Keine Belohnung (Code-Paarung bereits gewertet)'}</div>
      <div class="row" style="justify-content:center">${actions}</div>`);
    const go = (fn) => () => { closeModal(); fn(); };
    if ($('#rs-menu')) $('#rs-menu').onclick = go(showMenu);
    if ($('#rs-next')) $('#rs-next').onclick = go(startAI);
    if ($('#rs-leave')) $('#rs-leave').onclick = go(() => { Net.close(); live.phase = 'idle'; showMenu(); });
    if ($('#rs-rematch')) $('#rs-rematch').onclick = go(() => {
      if (Net.role === 'host') newLiveRound(); else { Net.send({ t: 'rematch' }); showLiveLobby('Revanche angefragt – warte auf den Host …'); }
    });
  }

  /* ---------- Freundes-Code ---------- */
  function showCodeMode() {
    cleanup();
    show('prep');
    const army = myArmy();
    const code = encodeCode(army);
    $('#battle-prep').innerHTML = `
      <div class="prep-head"><h2>📨 Freundes-Code</h2><button class="btn" id="cm-back">← Zurück</button></div>
      <div class="prep-cols">
        <div class="side-box">
          <h3>1. Schicke deinem Freund deinen Allianz-Code</h3>
          <p class="help">Der Code enthält deine aktive Allianz „${esc(army.name)}“ mit Levels und Aufstellung. Die Aufstellung änderst du in der KI- oder Live-Vorbereitung.</p>
          <textarea id="cm-mine" rows="4" readonly>${code}</textarea>
          <div class="row" style="margin-top:8px"><button class="btn" id="cm-copy">📋 Code kopieren</button><button class="btn" id="cm-share">📤 Teilen</button></div>
          <h3 style="margin-top:18px">2. Füge den Code deines Freundes ein</h3>
          <textarea id="cm-theirs" rows="4" placeholder="PG1.…"></textarea>
          <div class="row" style="margin-top:8px"><button class="btn primary big" id="cm-go">⚔️ Schlacht simulieren</button></div>
          <p class="help" id="cm-preview"></p>
        </div>
        <div class="prep-side"><div class="side-box"><h3>Fair für beide</h3>
          <p class="help">Die Schlacht ist deterministisch. Aus beiden Codes wird dieselbe Karte und derselbe Zufall berechnet, egal wer sie startet. Ihr seht also beide exakt dasselbe Gefecht und könnt danach über das Ergebnis diskutieren. 😉</p>
          <p class="help">Belohnung: Pro Code-Paarung gibt es einmal Stimmen.</p></div>
          <div class="side-box"><h3>Deine Allianz</h3>${army.members.map((m) => miniRow(m.id, m.level)).join('')}</div>
        </div>
      </div>`;
    Wiki.hydrate($('#battle-prep'));
    $('#cm-back').onclick = showMenu;
    $('#cm-copy').onclick = () => copyText(code);
    $('#cm-share').onclick = () => {
      const text = `Fordere mich in PoliticGacha heraus! Mein Allianz-Code:\n${code}`;
      if (navigator.share) navigator.share({ title: 'PoliticGacha', text }).catch(() => {}); else copyText(text);
    };
    const parse = () => {
      const raw = $('#cm-theirs').value.trim();
      if (!raw) return null;
      try { return sanitizeArmy(decodeCode(raw)); } catch (e) { return { error: e.message }; }
    };
    $('#cm-theirs').oninput = () => {
      const a = parse();
      $('#cm-preview').innerHTML = !a ? '' : a.error ? `⚠️ ${esc(a.error)}` : `Gegner: <b>${esc(a.name)}</b> von ${esc(a.player)} – ${a.members.map((m) => esc(POL_BY_ID[m.id].name) + ' Lv' + m.level).join(', ')}`;
    };
    $('#cm-go').onclick = () => {
      const theirs = parse();
      if (!theirs || theirs.error) { toast('Bitte einen gültigen Code einfügen', 'bad'); return; }
      const theirCode = encodeCode(theirs);
      const mine = sanitizeArmy(decodeCode(code));
      if (theirCode === encodeCode(mine)) { toast('Das ist dein eigener Code 🙂', 'bad'); return; }
      const iAmFirst = encodeCode(mine) < theirCode;
      const pair = iAmFirst ? [encodeCode(mine), theirCode] : [theirCode, encodeCode(mine)];
      const seed = hashStr(pair.join('|'));
      const armies = iAmFirst ? [mine, theirs] : [theirs, mine];
      startFight(seed, armies, iAmFirst ? 0 : 1, 'code');
    };
  }

  /* ---------- Live (PeerJS) ---------- */
  function setupNetHandlers() {
    Net.on({
      hosting: (code) => { live.phase = 'hosting'; showLiveLobby(); },
      open: () => {
        Net.send({ t: 'hello', name: S.name, v: 1 });
      },
      message: (m) => onNetMessage(m),
      close: () => {
        toast('Verbindung zum Gegner beendet', 'bad');
        const inFight = !$('#battle-fight').classList.contains('hidden');
        live.phase = 'idle';
        if (!inFight) showMenu();
      },
      error: (e) => {
        toast('Online: ' + esc(netErrorText(e)), 'bad');
        if (!Net.connected) { live.phase = 'idle'; Net.close(); showLiveLobby(); }
      },
    });
  }

  function onNetMessage(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'full') { toast('Der Raum ist bereits voll', 'bad'); Net.close(); live.phase = 'idle'; showLiveLobby(); return; }
    if (m.t === 'hello') {
      live.opponent = String(m.name || 'Gegner').slice(0, 24);
      toast(`🤝 Verbunden mit ${esc(live.opponent)}`, 'good');
      live.phase = 'connected';
      if (Net.role === 'host') newLiveRound(); else showLiveLobby('Verbunden – warte auf die Karte des Hosts …');
    } else if (m.t === 'round') {
      live.seed = m.seed >>> 0;
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
        closeModal();
        startFight(m.seed >>> 0, armies, 1, 'live');
      } catch { toast('Ungültige Startdaten', 'bad'); }
    } else if (m.t === 'rematch') {
      if (Net.role === 'host') { closeModal(); toast(`${esc(live.opponent)} will eine Revanche!`); newLiveRound(); }
    }
  }

  function newLiveRound() {
    live.seed = randomSeed();
    Net.send({ t: 'round', seed: live.seed });
    enterLivePrep();
  }

  function enterLivePrep() {
    closeModal();
    live.myReady = false; live.oppReady = false; live.oppArmy = null; live.phase = 'prep';
    const army = myArmy();
    const myTeam = Net.role === 'host' ? 0 : 1;
    showPrep({
      title: `🌐 Live gegen ${esc(live.opponent)}`,
      seed: live.seed, army, myTeam, enemyVisible: false, enemyName: live.opponent,
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
      <p class="help">Der Gegner ist bis zum Start verdeckt. Wenn beide bereit sind, beginnt die Schlacht automatisch.</p>`;
    const b = $('#pr-ready');
    if (b) b.textContent = live.myReady ? '✋ Doch nicht bereit' : '✅ Bereit';
  }

  function maybeStartLive() {
    if (Net.role !== 'host' || !live.myReady || !live.oppReady || !deployView) return;
    const armies = [sanitizeArmy(deployView.army), live.oppArmy];
    Net.send({ t: 'start', seed: live.seed, armies });
    startFight(live.seed, armies, 0, 'live');
  }

  function showLiveLobby(statusText) {
    cleanup();
    show('prep');
    setupNetHandlers();
    const hosting = Net.role === 'host' && live.phase === 'hosting';
    const link = Net.code ? `${location.origin}${location.pathname}?join=${Net.code}` : '';
    $('#battle-prep').innerHTML = `
      <div class="prep-head"><h2>🌐 Live gegen Freunde</h2><button class="btn" id="lv-back">← Zurück</button></div>
      <div class="mode-grid" style="margin-top:0">
        <div class="side-box">
          <h3>Raum erstellen</h3>
          ${hosting ? `<p class="help">Gib diesen Code an deinen Freund weiter:</p><div class="code-big">${Net.code}</div>
            <div class="row" style="margin-top:10px"><button class="btn" id="lv-copy">📋 Einladungslink kopieren</button></div>
            <p class="status warn" style="margin-top:10px">⏳ Warte auf Mitspieler …</p>`
            : `<p class="help">Du wirst Host (blaue Seite) und bekommst einen 5-stelligen Raumcode.</p><button class="btn primary" id="lv-host">Raum erstellen</button>`}
        </div>
        <div class="side-box">
          <h3>Raum beitreten</h3>
          <p class="help">Code vom Freund eingeben (du spielst auf der roten Seite):</p>
          <div class="row"><input id="lv-code" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:4px;font-weight:800;width:140px">
          <button class="btn primary" id="lv-join">Beitreten</button></div>
        </div>
      </div>
      <p class="status" id="lv-status" style="margin-top:12px">${statusText || (Net.available() ? '' : '⚠️ PeerJS konnte nicht geladen werden – Online-Modus nicht verfügbar. Nutze den Freundes-Code.')}</p>
      <p class="help">Die Verbindung läuft direkt zwischen euren Browsern (WebRTC über PeerJS). Nur der Verbindungsaufbau nutzt den öffentlichen PeerJS-Server. Falls euer Netzwerk das blockiert, nehmt den Freundes-Code-Modus.</p>`;
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

  return { showMenu, autoJoin };
})();
