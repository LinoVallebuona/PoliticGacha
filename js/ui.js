/* Oberfläche: Header, Packs, Sammlung, Kartendetails, Allianzen */
const REGION_GRAD = { EU: ['#28407a', '#111a33'], AM: ['#7a2828', '#331111'], AS: ['#7a5a1a', '#33240a'], AF: ['#1f6b4f', '#0b2a1f'] };
const STAT_COLORS = { atk: '#f87171', def: '#60a5fa', tac: '#fbbf24' };

function updateHeader() {
  const v = $('#votes');
  if (v.textContent !== fmt(S.votes)) { v.textContent = fmt(S.votes); v.parentElement.classList.remove('bump'); void v.offsetWidth; v.parentElement.classList.add('bump'); }
  $('#player-name span').textContent = S.name;
  const daily = $('#daily-btn');
  if (daily) { daily.disabled = !dailyAvailable(); daily.textContent = dailyAvailable() ? `🎁 Tagesbonus: +${DAILY_BONUS} Stimmen` : '✅ Tagesbonus abgeholt'; }
  const pity = $('#pity');
  if (pity) pity.textContent = `Legendär spätestens in ${PITY_LIMIT - S.pity} Zügen garantiert`;
}

function switchTab(tab) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + tab));
  if (tab === 'collection') renderCollection();
  if (tab === 'alliances') renderAlliances();
  if (tab === 'battle') BattleUI.showMenu();
  if (tab === 'packs') updateHeader();
  window.scrollTo({ top: 0 });
}

function statsHTML(p, level) {
  const mul = 1 + LEVEL_BONUS * (level - 1);
  const row = (k, label) => {
    const v = Math.round(p[k] * mul);
    return `<span>${label}</span><div class="bar"><i style="width:${Math.min(100, v)}%;background:${STAT_COLORS[k]}"></i></div><b>${v}</b>`;
  };
  return `<div class="stats">${row('atk', 'ANG')}${row('def', 'VER')}${row('tac', 'TAK')}</div>`;
}

function portraitHTML(p, extraClass = '') {
  const [c1, c2] = REGION_GRAD[p.region];
  return `<div class="portrait ${extraClass}" data-portrait="${p.id}" style="--pc1:${c1};--pc2:${c2}">
    <span class="ini">${esc(initials(p.name))}</span>
    <span class="flag-badge">${p.flag}</span>
    <span class="cls-badge" title="${CLASSES[p.cls].name}">${CLASSES[p.cls].icon}</span>
  </div>`;
}

function cardHTML(id, opts = {}) {
  const p = POL_BY_ID[id];
  const R = RARITIES[p.rarity];
  if (opts.missing) {
    return `<div class="card missing rar-${p.rarity}" data-id="${id}">
      <div class="card-top"><span>❔</span><span class="stars">${'★'.repeat(R.stars)}</span></div>
      <div class="portrait"><span class="ini">?</span></div>
      <div class="card-name">???</div>
      <div class="card-office">${esc(REGIONS[p.region].name)} · ${esc(ERAS[p.era].short)}</div>
    </div>`;
  }
  const level = opts.level ?? levelOf(id);
  const c = owned(id);
  return `<div class="card rar-${p.rarity} ${opts.mini ? 'mini' : ''} ${opts.cls || ''}" data-id="${id}">
    ${opts.badge ? `<div class="new-badge">${opts.badge}</div>` : ''}
    <div class="card-top"><span class="stars">${'★'.repeat(R.stars)}</span><span class="lvl">Lv ${level}</span></div>
    ${portraitHTML(p)}
    <div class="card-name">${esc(p.name)}</div>
    <div class="card-office">${esc(p.office)}</div>
    <div class="card-tags"><span class="tag">${CLASSES[p.cls].icon} ${CLASSES[p.cls].name}</span><span class="tag">${REGIONS[p.region].icon} ${esc(REGIONS[p.region].name)}</span><span class="tag">⏳ ${ERAS[p.era].short}</span></div>
    ${statsHTML(p, level)}
    ${opts.showCopies && c ? `<div class="copies">${c.copies}× gezogen${c.level < MAX_LEVEL ? ` · nächstes Level bei ${LEVEL_COPIES[c.level]}` : ' · Max-Level'}</div>` : ''}
  </div>`;
}

/* ---------- Modal ---------- */
function openModal(html, onClose) {
  $('#modal-box').innerHTML = `<button class="modal-close" title="Schließen">✕</button>` + html;
  $('#modal').classList.remove('hidden');
  const close = () => { $('#modal').classList.add('hidden'); if (onClose) onClose(); };
  $('#modal-box .modal-close').onclick = close;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') close(); };
  Wiki.hydrate($('#modal-box'));
  return close;
}
function closeModal() { $('#modal').classList.add('hidden'); }

function showCardDetail(id) {
  const p = POL_BY_ID[id];
  const C = CLASSES[p.cls];
  const R = RARITIES[p.rarity];
  const level = levelOf(id);
  const counters = Object.entries(COUNTERS[p.cls]).map(([k, v]) => `${CLASSES[k].icon} ${CLASSES[k].name} (+${Math.round((v - 1) * 100)} %)`).join(', ');
  const al = activeAlliance();
  const inAl = al && al.members.includes(id);
  openModal(`
    <div class="detail">
      <div>${cardHTML(id, { showCopies: true })}</div>
      <div>
        <h2>${p.flag} ${esc(p.name)}</h2>
        <div class="muted">${esc(p.office)} · ${esc(REGIONS[p.region].name)} · ${esc(ERAS[p.era].name)} · <span style="color:${R.color}">${R.name}</span></div>
        <div class="ability-box">
          <b>${C.icon} ${C.name}</b> – ${C.count} Einheiten, Reichweite ${C.range}<br>
          <b>Fähigkeit „${C.ability}“:</b> ${C.abilityDesc}<br>
          ${counters ? `<span class="muted">Stark gegen: ${counters}</span>` : '<span class="muted">Heilt Verbündete in der Nähe.</span>'}
        </div>
        <p class="extract" id="wiki-extract">Lade Wikipedia-Eintrag …</p>
        <p class="muted"><a id="wiki-link" href="https://de.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, '_'))}" target="_blank" rel="noopener">Auf Wikipedia lesen ↗</a></p>
        ${al ? `<button class="btn ${inAl ? 'danger' : 'primary'}" id="detail-al">${inAl ? '− Aus' : '＋ Zu'} „${esc(al.name)}“ ${inAl ? 'entfernen' : 'hinzufügen'}</button>` : ''}
      </div>
    </div>`);
  Wiki.get(p).then((info) => {
    const ex = $('#wiki-extract');
    if (!ex) return;
    ex.textContent = info.extract || (info.failed ? 'Wikipedia ist gerade nicht erreichbar – die Karte funktioniert trotzdem.' : 'Kein Auszug verfügbar.');
    if (info.url) $('#wiki-link').href = info.url;
  });
  const btn = $('#detail-al');
  if (btn) btn.onclick = () => { toggleMember(al, id); closeModal(); renderCollection(); };
}

/* ---------- Packs ---------- */
function renderPacks() {
  $('#pol-count').textContent = POLITICIANS.length;
  const grid = $('#pack-grid');
  grid.innerHTML = PACKS.map((pk) => {
    let sel = '';
    if (pk.filter === 'region') sel = `<select data-filter>${Object.entries(REGIONS).map(([k, r]) => `<option value="${k}">${r.icon} ${r.name}</option>`).join('')}</select>`;
    if (pk.filter === 'era') sel = `<select data-filter>${Object.entries(ERAS).map(([k, e]) => `<option value="${k}">${e.name}</option>`).join('')}</select>`;
    return `<div class="pack pack-${pk.id}" data-pack="${pk.id}">
      <div><div class="pack-icon">${pk.icon}</div><h3>${pk.name}</h3><p>${pk.desc}</p></div>
      <div>${sel}<button class="btn gold" style="width:100%">Öffnen · 🗳️ ${pk.cost}</button></div>
    </div>`;
  }).join('');
  $$('.pack', grid).forEach((node) => {
    $('button', node).onclick = () => {
      const f = $('[data-filter]', node);
      const res = openPack(node.dataset.pack, f && f.value);
      if (res) showPackOpening(res, PACKS.find((p) => p.id === node.dataset.pack));
    };
  });
  const total = Object.values(RARITIES).reduce((a, r) => a + r.weight, 0);
  $('#odds-table').innerHTML = `<table><tr><th>Seltenheit</th><th>Chance</th><th>Basiswerte</th><th>Bei Max-Level: Rückerstattung</th></tr>
    ${RARITY_ORDER.map((k) => { const r = RARITIES[k]; return `<tr><td style="color:${r.color}">${'★'.repeat(r.stars)} ${r.name}</td><td>${((r.weight / total) * 100).toFixed(1)} %</td><td>~${r.base}</td><td>${r.refund} 🗳️</td></tr>`; }).join('')}
    </table>
    <p>Duplikate erhöhen das Level (Level 2/3/4/5 bei ${LEVEL_COPIES.slice(1).join('/')} Kopien, je +${LEVEL_BONUS * 100} % Werte). Nach ${PITY_LIMIT} Zügen ohne Legendär ist der nächste Zug garantiert legendär.</p>`;
  updateHeader();
}

function showPackOpening(results, pack, title) {
  const ov = $('#pack-overlay');
  ov.classList.remove('hidden');
  ov.innerHTML = `<h2>${title || `${pack.icon} ${pack.name}`}</h2>
    <div class="reveal-row">${results.map((r, i) => {
      const p = POL_BY_ID[r.id];
      const badge = r.isNew ? 'NEU!' : r.levelUp ? `Lv ${r.level}!` : r.refund ? `+${r.refund} 🗳️` : '';
      return `<div><div class="flip" data-i="${i}" style="animation-delay:${i * 0.12}s">
          <div class="face-back"><div class="card-back glow-${p.rarity}" style="height:100%">🏛️</div></div>
          <div class="face-front">${cardHTML(r.id, { level: r.level, badge })}</div>
        </div><div class="reveal-info" id="ri-${i}"></div></div>`;
    }).join('')}</div>
    <div class="reveal-actions"><button class="btn" id="reveal-all">Alle aufdecken</button><button class="btn primary hidden" id="reveal-done">Weiter</button></div>`;
  Wiki.hydrate(ov);
  const flip = (node) => {
    if (node.classList.contains('flipped')) return;
    const r = results[+node.dataset.i];
    const p = POL_BY_ID[r.id];
    node.classList.add('flipped');
    if (p.rarity === 'L') node.classList.add('burst-L');
    const info = r.isNew ? `<span style="color:#86efac">Neu in deiner Sammlung</span>` : r.levelUp ? `<span style="color:#fde047">Duplikat → Level ${r.level}</span>` : r.refund ? `Max-Level – ${r.refund} Stimmen erstattet` : `Duplikat (${r.copies}×)`;
    $('#ri-' + node.dataset.i).innerHTML = info;
    if ($$('.flip:not(.flipped)', ov).length === 0) { $('#reveal-all').classList.add('hidden'); $('#reveal-done').classList.remove('hidden'); }
  };
  $$('.flip', ov).forEach((n) => (n.onclick = () => flip(n)));
  $('#reveal-all').onclick = () => $$('.flip', ov).forEach((n, i) => setTimeout(() => flip(n), i * 180));
  $('#reveal-done').onclick = () => { ov.classList.add('hidden'); ov.innerHTML = ''; updateHeader(); };
}

/* ---------- Sammlung ---------- */
function initFilters() {
  $('#f-rarity').innerHTML += RARITY_ORDER.map((k) => `<option value="${k}">${'★'.repeat(RARITIES[k].stars)} ${RARITIES[k].name}</option>`).join('');
  $('#f-region').innerHTML += Object.entries(REGIONS).map(([k, r]) => `<option value="${k}">${r.icon} ${r.name}</option>`).join('');
  $('#f-era').innerHTML += Object.entries(ERAS).map(([k, e]) => `<option value="${k}">${e.name}</option>`).join('');
  $('#f-class').innerHTML += Object.entries(CLASSES).map(([k, c]) => `<option value="${k}">${c.icon} ${c.name}</option>`).join('');
  $$('.filters select, .filters input').forEach((n) => (n.onchange = renderCollection));
}

function filteredPoliticians() {
  const fr = $('#f-rarity').value, fg = $('#f-region').value, fe = $('#f-era').value, fc = $('#f-class').value, sort = $('#f-sort').value;
  const showMissing = $('#f-missing').checked;
  let list = POLITICIANS.filter((p) => (!fr || p.rarity === fr) && (!fg || p.region === fg) && (!fe || p.era === fe) && (!fc || p.cls === fc));
  if (!showMissing) list = list.filter((p) => owned(p.id));
  const rk = (p) => RARITY_ORDER.indexOf(p.rarity);
  list.sort((a, b) => {
    const oa = owned(a.id) ? 1 : 0, ob = owned(b.id) ? 1 : 0;
    if (oa !== ob) return ob - oa;
    if (sort === 'name') return a.name.localeCompare(b.name, 'de');
    if (sort === 'rarity') return rk(b) - rk(a) || cardPower(b, levelOf(b.id)) - cardPower(a, levelOf(a.id));
    return cardPower(b, levelOf(b.id)) - cardPower(a, levelOf(a.id));
  });
  return list;
}

function renderCollection() {
  const n = Object.keys(S.collection).length;
  $('#coll-progress').textContent = `${n} / ${POLITICIANS.length} entdeckt (${Math.round((n / POLITICIANS.length) * 100)} %)`;
  const grid = $('#coll-grid');
  const list = filteredPoliticians();
  const al = activeAlliance();
  grid.innerHTML = list.length ? list.map((p) => owned(p.id) ? cardHTML(p.id, { showCopies: true, cls: al && al.members.includes(p.id) ? 'in-alliance' : '' }) : cardHTML(p.id, { missing: true })).join('')
    : `<p class="help">Noch keine Karten in dieser Auswahl. Öffne Packs im Tab „Packs“!</p>`;
  $$('.card:not(.missing)', grid).forEach((c) => (c.onclick = () => showCardDetail(c.dataset.id)));
  Wiki.hydrate(grid);
}

/* ---------- Allianzen ---------- */
let selectedAlliance = null;

function toggleMember(al, id) {
  const i = al.members.indexOf(id);
  if (i >= 0) { al.members.splice(i, 1); delete al.deploy[id]; }
  else {
    if (al.members.length >= ALLIANCE_SIZE) { toast(`Eine Allianz hat höchstens ${ALLIANCE_SIZE} Mitglieder`, 'bad'); return; }
    al.members.push(id);
    const cls = POL_BY_ID[id].cls;
    // freien Platz in der Aufstellung suchen
    const used = Object.values(al.deploy);
    let best = [0.55, 0.5], bd = -1;
    for (let k = 0; k < 9; k++) {
      const cand = [cls === 'art' || cls === 'dip' ? 0.25 : 0.6, 0.08 + k * 0.105];
      const d = Math.min(...used.map((u) => Math.abs(u[1] - cand[1]) + Math.abs(u[0] - cand[0]) * 0.5), 9);
      if (d > bd) { bd = d; best = cand; }
    }
    al.deploy[id] = best;
  }
  saveState();
}

function renderAlliances() {
  if (!selectedAlliance || !getAlliance(selectedAlliance)) selectedAlliance = (activeAlliance() || {}).id;
  const list = $('#alliance-list');
  list.innerHTML = S.alliances.map((a) => `<div class="al-item ${a.id === selectedAlliance ? 'sel' : ''}" data-id="${a.id}">
      <div><b>${esc(a.name)}</b><small>${a.members.length}/${ALLIANCE_SIZE} · Stärke ${fmt(alliancePower(a.members))}</small></div>
      ${a.id === S.activeAlliance ? '<span class="active-dot">● AKTIV</span>' : ''}
    </div>`).join('') || '<p class="help">Noch keine Allianz.</p>';
  $$('.al-item', list).forEach((n) => (n.onclick = () => { selectedAlliance = n.dataset.id; renderAlliances(); }));
  $('#new-alliance').disabled = S.alliances.length >= MAX_ALLIANCES;
  renderAllianceEditor();
}

function renderAllianceEditor() {
  const ed = $('#alliance-editor');
  const al = getAlliance(selectedAlliance);
  if (!al) { ed.innerHTML = '<p class="help">Erstelle links eine neue Allianz.</p>'; return; }
  const syn = computeSynergies(al.members);
  const slots = [];
  for (let i = 0; i < ALLIANCE_SIZE; i++) {
    const id = al.members[i];
    slots.push(id ? cardHTML(id, { mini: true }) : `<div class="slot-empty">Freier Platz<br>Wähle unten einen Politiker</div>`);
  }
  const ownedList = POLITICIANS.filter((p) => owned(p.id)).sort((a, b) => cardPower(b, levelOf(b.id)) - cardPower(a, levelOf(a.id)));
  ed.innerHTML = `
    <div class="al-head">
      <input id="al-name" value="${esc(al.name)}" maxlength="32">
      <div class="power">Stärke <b>${fmt(alliancePower(al.members))}</b></div>
      <button class="btn ${al.id === S.activeAlliance ? '' : 'primary'}" id="al-activate" ${al.id === S.activeAlliance ? 'disabled' : ''}>${al.id === S.activeAlliance ? '✓ Aktiv' : 'Als aktiv setzen'}</button>
      <button class="btn" id="al-auto" title="Wählt die stärkste Kombination inkl. Synergien">✨ Beste Allianz</button>
      <button class="btn danger" id="al-delete">Löschen</button>
    </div>
    <div class="slots" id="al-slots">${slots.join('')}</div>
    <h3>Synergien</h3>
    <div class="synergies">${syn.list.length ? syn.list.map((s) => `<div class="syn">${s.icon} ${esc(s.name)} (${s.count}) – <b>${s.text}</b></div>`).join('') : '<div class="syn none">Keine Synergien. Tipp: gleiche Region (+Rückhalt), gleiche Epoche (+Angriff), 4+ verschiedene Klassen (+Tempo), 3+ gleiche Klasse (Doktrin).</div>'}</div>
    <h3>Deine Politiker <small class="help">– Klicken zum Hinzufügen/Entfernen</small></h3>
    <div class="card-grid mini-grid" id="al-pool">${ownedList.map((p) => cardHTML(p.id, { mini: true, cls: al.members.includes(p.id) ? 'in-alliance' : '' })).join('')}</div>`;
  $('#al-name').onchange = (e) => { al.name = e.target.value.trim() || 'Allianz'; saveState(); renderAlliances(); };
  $('#al-activate').onclick = () => { S.activeAlliance = al.id; saveState(); renderAlliances(); toast(`„${esc(al.name)}“ ist jetzt aktiv`, 'good'); };
  $('#al-delete').onclick = () => {
    if (!confirm(`Allianz „${al.name}“ wirklich löschen?`)) return;
    S.alliances = S.alliances.filter((a) => a !== al);
    if (S.activeAlliance === al.id) S.activeAlliance = S.alliances[0] ? S.alliances[0].id : null;
    selectedAlliance = null; saveState(); renderAlliances();
  };
  $('#al-auto').onclick = () => { al.members.slice().forEach((id) => toggleMember(al, id)); autoFillAlliance(al); renderAlliances(); toast('Stärkste Kombination gewählt ✨', 'good'); };
  $$('#al-slots .card, #al-pool .card', ed).forEach((c) => (c.onclick = () => { toggleMember(al, c.dataset.id); renderAlliances(); }));
  Wiki.hydrate(ed);
}

/* Füllt freie Plätze mit den stärksten Karten, bevorzugt Synergien */
function autoFillAlliance(al) {
  const pool = POLITICIANS.filter((p) => owned(p.id) && !al.members.includes(p.id));
  while (al.members.length < ALLIANCE_SIZE && pool.length) {
    let best = null, bv = -1;
    for (const p of pool) {
      const v = alliancePower([...al.members, p.id]);
      if (v > bv) { bv = v; best = p; }
    }
    toggleMember(al, best.id);
    pool.splice(pool.indexOf(best), 1);
  }
  saveState();
}
