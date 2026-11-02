/* Start */
function showProfile() {
  const owned = Object.keys(S.collection).length;
  const lvl = S.level || 1;
  openModal(`
    <h2>👤 Profil</h2>
    <div class="row"><input id="pf-name" value="${esc(S.name)}" maxlength="24"><button class="btn" id="pf-save">Namen speichern</button></div>
    <div class="profile-stats">
      <div><b>Level ${lvl}</b><span>${esc(rankName(lvl))}</span></div>
      <div><b>${owned}/${POLITICIANS.length}</b><span>Politiker</span></div>
      <div><b>${S.stats.wins}</b><span>Siege</span></div>
      <div><b>${S.stats.pvpWins}:${S.stats.pvpLosses}</b><span>PvP</span></div>
      <div><b>${Object.values(S.stages).map((v) => v).join(' / ')}</b><span>Stufen (Gef./Feldz./Komm.)</span></div>
      <div><b>${S.stats.pulls}</b><span>Züge</span></div>
    </div>
    <h3>💾 Spielstand übertragen</h3>
    <p class="help">Der Spielstand liegt nur in diesem Browser. Mit dem Code nimmst du ihn auf ein anderes Gerät mit oder legst ein Backup an.</p>
    <div class="row"><button class="btn" id="pf-export">📋 Spielstand-Code kopieren</button></div>
    <textarea id="pf-import" rows="3" placeholder="PGS1.… Spielstand-Code einfügen" style="margin-top:8px"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn primary" id="pf-load">Spielstand laden</button><button class="btn danger" id="pf-reset">Neu beginnen</button></div>`);
  $('#pf-save').onclick = () => { const n = $('#pf-name').value.trim(); if (n) { S.name = n.slice(0, 24); saveState(); updateHeader(); toast('Name gespeichert', 'good'); } };
  $('#pf-export').onclick = () => copyText(exportSave());
  $('#pf-load').onclick = () => {
    try { importSave($('#pf-import').value); toast('Spielstand geladen – Seite wird neu geladen …', 'good'); setTimeout(() => location.reload(), 700); }
    catch (e) { toast(esc(e.message), 'bad'); }
  };
  $('#pf-reset').onclick = () => {
    if (!confirm('Wirklich alles löschen und neu beginnen? Exportiere vorher deinen Spielstand, falls du ihn behalten willst.')) return;
    localStorage.removeItem(SAVE_KEY); location.reload();
  };
}

(function init() {
  loadState();
  ensureEarnState();
  saveState();
  setInterval(updateEarnBadge, 30000);
  initFilters();
  renderPacks();
  updateHeader();

  $$('.tabs button').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
  $('#daily-btn').onclick = () => { if (claimDaily()) toast(`🎁 +${DAILY_BONUS} Stimmen!`, 'good'); updateHeader(); };
  $('#player-name').onclick = showProfile;
  $('#rank').onclick = showProfile;
  $('#new-alliance').onclick = () => {
    if (S.alliances.length >= MAX_ALLIANCES) return;
    const a = newAlliance('Neue Allianz ' + (S.alliances.length + 1));
    if (!S.activeAlliance) S.activeAlliance = a.id;
    selectedAlliance = a.id;
    saveState();
    renderAlliances();
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  const params = new URLSearchParams(location.search);
  const join = params.get('join');

  if (!S.starterGiven) {
    const res = giveStarter();
    showPackOpening(res, null, '🎉 Willkommen! Dein Starter-Kabinett');
    toast('Deine erste Allianz wurde automatisch gebildet. Viel Erfolg!', 'good');
  }
  if (join) {
    history.replaceState(null, '', location.pathname);
    BattleUI.autoJoin(join);
  }
})();
