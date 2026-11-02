/* Start */
(function init() {
  loadState();
  initFilters();
  renderPacks();
  updateHeader();

  $$('.tabs button').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
  $('#daily-btn').onclick = () => { if (claimDaily()) toast(`🎁 +${DAILY_BONUS} Stimmen!`, 'good'); updateHeader(); };
  $('#player-name').onclick = () => {
    const n = prompt('Dein Spielername:', S.name);
    if (n && n.trim()) { S.name = n.trim().slice(0, 24); saveState(); updateHeader(); }
  };
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
