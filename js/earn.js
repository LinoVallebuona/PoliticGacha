/* Wahlkampf: weitere Wege, Stimmen zu verdienen
 * – Diäten (passives Einkommen), tägliche Aufträge, Erfolge, Politik-Quiz, Ruhestand
 */
const SALARY_CAP_H = 12;
const QUIZ_LEN = 8;
const QUIZ_FULL_ROUNDS = 5; // danach halbe Belohnung (pro Tag)

/* ---------- Zähler ---------- */
function ensureEarnState() {
  S.counters = S.counters || {};
  S.achievements = S.achievements || {};
  if (!S.lastSalary) S.lastSalary = Date.now();
  if (!S.daily || S.daily.day !== todayKey()) S.daily = { day: todayKey(), missions: rollMissions(todayKey()), allClaimed: false, quizRounds: 0, firstWin: false };
}

/* Ereignis zählen: lebenslang + für die heutigen Aufträge */
function track(ev, n = 1) {
  if (!n) return;
  ensureEarnState();
  S.counters[ev] = (S.counters[ev] || 0) + n;
  S.daily.missions.forEach((m) => { if (m.ev === ev && !m.claimed) m.progress = Math.min(m.goal, m.progress + n); });
  saveState();
  updateEarnBadge();
}

/* ---------- Tägliche Aufträge ---------- */
const MISSION_POOL = [
  { id: 'win2', ev: 'win', goal: 2, reward: 130, text: 'Gewinne 2 Schlachten' },
  { id: 'battle3', ev: 'battle', goal: 3, reward: 100, text: 'Bestreite 3 Schlachten' },
  { id: 'pack2', ev: 'pack', goal: 2, reward: 80, text: 'Öffne 2 Packs' },
  { id: 'quiz6', ev: 'quiz', goal: 6, reward: 100, text: 'Beantworte 6 Quizfragen richtig' },
  { id: 'grand1', ev: 'grand', goal: 1, reward: 140, text: 'Bestreite einen Feldzug' },
  { id: 'command1', ev: 'command', goal: 1, reward: 120, text: 'Bestreite ein Kommando-Gefecht' },
  { id: 'policy5', ev: 'policy', goal: 5, reward: 110, text: 'Setze 5 politische Maßnahmen ein' },
  { id: 'capture8', ev: 'capture', goal: 8, reward: 110, text: 'Erobere 8 Städte' },
  { id: 'resign10', ev: 'kills', goal: 60, reward: 100, text: 'Besiege 60 feindliche Einheiten' },
  { id: 'ability8', ev: 'ability', goal: 8, reward: 90, text: 'Löse 8 Fähigkeiten aus' },
  { id: 'conquer1', ev: 'conquer', goal: 1, reward: 150, text: 'Erobere ein Gebiet auf der Weltkarte' },
];
const ALL_MISSIONS_BONUS = 150;
const FIRST_WIN_BONUS = 100;

function rollMissions(day) {
  const rng = mulberry32(hashStr('missions|' + day));
  const pool = MISSION_POOL.slice();
  const out = [];
  while (out.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    out.push({ id: m.id, ev: m.ev, goal: m.goal, reward: m.reward, text: m.text, progress: 0, claimed: false });
  }
  return out;
}

function claimMission(id) {
  ensureEarnState();
  const m = S.daily.missions.find((x) => x.id === id);
  if (!m || m.claimed || m.progress < m.goal) return;
  m.claimed = true;
  addVotes(m.reward);
  toast(`📋 Auftrag erledigt: +${m.reward} 🗳️`, 'good');
  saveState();
  renderEarn();
}
function claimAllBonus() {
  ensureEarnState();
  if (S.daily.allClaimed || !S.daily.missions.every((m) => m.claimed)) return;
  S.daily.allClaimed = true;
  addVotes(ALL_MISSIONS_BONUS);
  toast(`🎉 Alle Aufträge erledigt: +${ALL_MISSIONS_BONUS} 🗳️`, 'good');
  saveState();
  renderEarn();
}

/* ---------- Erfolge ---------- */
const ACHIEVEMENTS = [];
[[10, 100], [25, 250], [50, 500], [75, 800], [POLITICIANS.length, 2000]].forEach(([n, r]) =>
  ACHIEVEMENTS.push({ id: 'coll' + n, icon: '📚', name: n === POLITICIANS.length ? 'Komplettes Kabinett' : `Sammler (${n})`, text: `Entdecke ${n} Politiker`, reward: r, goal: n, value: () => Object.keys(S.collection).length }));
[[10, 150], [50, 400], [100, 800]].forEach(([n, r]) =>
  ACHIEVEMENTS.push({ id: 'wins' + n, icon: '🏆', name: `Wahlsieger (${n})`, text: `Gewinne ${n} Schlachten`, reward: r, goal: n, value: () => S.counters.win || 0 }));
[[5, 200], [10, 400], [20, 800]].forEach(([n, r]) =>
  ACHIEVEMENTS.push({ id: 'stage' + n, icon: '📈', name: `Aufsteiger (Stufe ${n})`, text: `Erreiche in einem Modus Kampagnenstufe ${n}`, reward: r, goal: n, value: () => Math.max(...Object.values(S.stages || { a: 1 })) }));
ACHIEVEMENTS.push(
  { id: 'legend', icon: '✨', name: 'Legende', text: 'Ziehe deinen ersten legendären Politiker', reward: 200, goal: 1, value: () => POLITICIANS.filter((p) => p.rarity === 'L' && S.collection[p.id]).length },
  { id: 'maxlvl', icon: '⬆️', name: 'Dauerbrenner', text: 'Bringe einen Politiker auf Level 5', reward: 300, goal: 1, value: () => Object.values(S.collection).filter((c) => c.level >= MAX_LEVEL).length },
  { id: 'grandwin', icon: '🗺️', name: 'Feldherr', text: 'Gewinne einen Feldzug', reward: 250, goal: 1, value: () => S.counters.grandWin || 0 },
  { id: 'cmdwin', icon: '🎖️', name: 'Stratege', text: 'Gewinne ein Kommando-Gefecht', reward: 200, goal: 1, value: () => S.counters.commandWin || 0 },
  { id: 'pvpwin', icon: '🤝', name: 'Freundschaftsspiel', text: 'Besiege einen Freund (live oder per Code)', reward: 250, goal: 1, value: () => S.counters.pvpWin || 0 },
  { id: 'quiz50', icon: '🧠', name: 'Politikexperte', text: 'Beantworte 50 Quizfragen richtig', reward: 300, goal: 50, value: () => S.counters.quiz || 0 },
  { id: 'packs25', icon: '🎴', name: 'Packsüchtig', text: 'Öffne 25 Packs', reward: 250, goal: 25, value: () => S.counters.pack || 0 },
  { id: 'cap100', icon: '🏙️', name: 'Städtebauer', text: 'Erobere 100 Städte', reward: 400, goal: 100, value: () => S.counters.capture || 0 },
);

// Sammel-Sets: komplette Parteienfamilien und Regionen
for (const [k, P] of Object.entries(PARTIES)) {
  const ids = POLITICIANS.filter((p) => p.party === k).map((p) => p.id);
  ACHIEVEMENTS.push({ id: 'party' + k, icon: P.icon, name: `Fraktion komplett: ${P.short}`, text: `Sammle alle ${ids.length} Politiker der Familie „${P.name}“`, reward: 150 + 25 * ids.length, goal: ids.length, value: () => ids.filter((id) => S.collection[id]).length });
}
for (const [k, R] of Object.entries(REGIONS)) {
  const ids = POLITICIANS.filter((p) => p.region === k).map((p) => p.id);
  ACHIEVEMENTS.push({ id: 'region' + k, icon: R.icon, name: `Weltreise: ${R.name}`, text: `Sammle alle ${ids.length} Politiker aus ${R.name}`, reward: 100 + 20 * ids.length, goal: ids.length, value: () => ids.filter((id) => S.collection[id]).length });
}
[[5, 250], [10, 600], [20, 1500]].forEach(([n, r]) =>
  ACHIEVEMENTS.push({ id: 'lvl' + n, icon: '🎓', name: `Karriere: ${rankName(n)}`, text: `Erreiche Spieler-Level ${n}`, reward: r, goal: n, value: () => S.level || 1 }));

[[5, 300], [15, 800], [33, 3000]].forEach(([n, r]) =>
  ACHIEVEMENTS.push({ id: 'world' + n, icon: '🌍', name: n === 33 ? 'Weltherrschaft' : `Expansion (${n} Gebiete)`, text: `Besitze ${n} Gebiete auf der Weltkarte`, reward: r, goal: n, value: () => (S.world ? Object.keys(S.world.owned).length : 0) }));

function claimAchievement(id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || S.achievements[id] || a.value() < a.goal) return;
  S.achievements[id] = Date.now();
  addVotes(a.reward);
  toast(`🏅 Erfolg „${esc(a.name)}“: +${a.reward} 🗳️`, 'good');
  saveState();
  renderEarn();
}

/* ---------- Diäten ---------- */
function salaryRate() { return 40 + 3 * Object.keys(S.collection).length; } // pro Stunde
function salaryPending() {
  ensureEarnState();
  const h = Math.min(SALARY_CAP_H, (Date.now() - S.lastSalary) / 3600000);
  return Math.floor(h * salaryRate());
}
function claimSalary() {
  const v = salaryPending();
  if (v < 1) { toast('Noch keine Diäten angefallen'); return; }
  S.lastSalary = Date.now();
  addVotes(v);
  toast(`💼 Diäten ausgezahlt: +${v} 🗳️`, 'good');
  saveState();
  renderEarn();
}

/* ---------- Ruhestand ---------- */
function retireValue(id) {
  const c = S.collection[id];
  return c ? RARITIES[POL_BY_ID[id].rarity].refund * 2 * c.copies : 0;
}
function retirePolitician(id) {
  const p = POL_BY_ID[id];
  const v = retireValue(id);
  if (!v) return false;
  if (!confirm(`${p.name} in den Ruhestand schicken?\nDie Karte (${S.collection[id].copies} Kopien, Level ${S.collection[id].level}) verlässt deine Sammlung, dafür bekommst du ${v} Stimmen.`)) return false;
  delete S.collection[id];
  S.alliances.forEach((a) => { a.members = a.members.filter((m) => m !== id); delete a.deploy[id]; });
  addVotes(v);
  track('retire');
  saveState();
  toast(`🏖️ ${esc(p.name)} genießt den Ruhestand: +${v} 🗳️`, 'good');
  return true;
}

/* ---------- Badge ---------- */
function claimableCount() {
  ensureEarnState();
  let n = S.daily.missions.filter((m) => !m.claimed && m.progress >= m.goal).length;
  if (!S.daily.allClaimed && S.daily.missions.every((m) => m.claimed)) n++;
  n += ACHIEVEMENTS.filter((a) => !S.achievements[a.id] && a.value() >= a.goal).length;
  if (salaryPending() >= salaryRate()) n++;
  if (dailyAvailable()) n++;
  if (typeof tributeRate === 'function' && S.world && S.world.start && tributeRate() && tributePending() >= tributeRate()) n++;
  return n;
}
function updateEarnBadge() {
  const b = $('#earn-badge');
  if (!b) return;
  const n = claimableCount();
  b.textContent = n;
  b.classList.toggle('hidden', !n);
}

/* ---------- Oberfläche ---------- */
function renderEarn() {
  ensureEarnState();
  const root = $('#earn-root');
  if (!root) return;
  const pend = salaryPending();
  const capped = (Date.now() - S.lastSalary) / 3600000 >= SALARY_CAP_H;
  const allDone = S.daily.missions.every((m) => m.claimed);
  const quizLeft = Math.max(0, QUIZ_FULL_ROUNDS - S.daily.quizRounds);
  const achs = ACHIEVEMENTS.map((a) => ({ a, v: Math.min(a.goal, a.value()), done: !!S.achievements[a.id] }))
    .sort((x, y) => (x.done - y.done) || ((y.v >= y.a.goal) - (x.v >= x.a.goal)) || (y.v / y.a.goal - x.v / x.a.goal));
  root.innerHTML = `
    <div class="earn-grid">
      <div class="side-box earn-card">
        <h3>💼 Diäten</h3>
        <p class="help">Als Abgeordnete:r kassierst du passiv <b>${salaryRate()} Stimmen pro Stunde</b> (+3 pro entdecktem Politiker), höchstens ${SALARY_CAP_H} Stunden lang.</p>
        <div class="big-num">${fmt(pend)} 🗳️</div>
        ${capped ? '<p class="status warn">Das Konto ist voll, jetzt abholen!</p>' : ''}
        <button class="btn gold" id="earn-salary" ${pend < 1 ? 'disabled' : ''}>Diäten abholen</button>
      </div>
      <div class="side-box earn-card">
        <h3>🎁 Tagesbonus</h3>
        <p class="help">Einmal pro Tag gibt es ${DAILY_BONUS} Stimmen geschenkt. Der <b>erste Sieg des Tages</b> bringt zusätzlich ${FIRST_WIN_BONUS} Stimmen.</p>
        <div class="big-num">${dailyAvailable() ? `+${DAILY_BONUS} 🗳️` : '✅'}</div>
        <p class="help">Erster Sieg heute: ${S.daily.firstWin ? '✅ erhalten' : `⏳ noch offen (+${FIRST_WIN_BONUS})`}</p>
        <button class="btn gold" id="earn-daily" ${dailyAvailable() ? '' : 'disabled'}>${dailyAvailable() ? 'Tagesbonus abholen' : 'Morgen wieder'}</button>
      </div>
      <div class="side-box earn-card quiz-card">
        <h3>❓ Politik-Quiz „Wer war's?“</h3>
        <p class="help">${QUIZ_LEN} Fragen zu Porträts, Wikipedia-Auszügen und Ämtern. <b>12 Stimmen pro richtige Antwort</b> plus Serienbonus, für eine perfekte Runde +50.</p>
        <p class="help">${quizLeft ? `Heute noch <b>${quizLeft}</b> Runden mit voller Belohnung` : 'Volle Belohnung für heute aufgebraucht, weitere Runden bringen die Hälfte'}.</p>
        <button class="btn primary big" id="earn-quiz">Quiz starten</button>
      </div>
    </div>
    <div class="earn-grid two">
      <div class="side-box">
        <h3>📋 Tägliche Aufträge <small class="help">· neu ab Mitternacht</small></h3>
        ${S.daily.missions.map((m) => `
          <div class="mission ${m.claimed ? 'done' : ''}">
            <div class="m-text"><b>${esc(m.text)}</b><div class="pbar"><i style="width:${(m.progress / m.goal) * 100}%"></i></div><span class="help">${m.progress}/${m.goal}</span></div>
            ${m.claimed ? '<span class="status ok">✓</span>' : `<button class="btn small ${m.progress >= m.goal ? 'gold' : ''}" data-mission="${m.id}" ${m.progress >= m.goal ? '' : 'disabled'}>+${m.reward} 🗳️</button>`}
          </div>`).join('')}
        <div class="mission bonus ${S.daily.allClaimed ? 'done' : ''}">
          <div class="m-text"><b>🎉 Alle drei Aufträge erledigt</b></div>
          ${S.daily.allClaimed ? '<span class="status ok">✓</span>' : `<button class="btn small ${allDone ? 'gold' : ''}" id="earn-allbonus" ${allDone ? '' : 'disabled'}>+${ALL_MISSIONS_BONUS} 🗳️</button>`}
        </div>
        <p class="help" style="margin-top:10px">🎓 Karriere: <b>Level ${S.level || 1} · ${esc(rankName(S.level || 1))}</b>. Schlachten, Packs und Quiz bringen Erfahrung, jeder Aufstieg bringt Stimmen.</p>
        <p class="help">💡 Weitere Quellen: <b>🎯 Übungsgefechte</b> im Schlacht-Menü (immer mit passendem Schwierigkeitsgrad) und der <b>🏖️ Ruhestand</b> überzähliger Politiker in der Kartenansicht der Sammlung.</p>
      </div>
      <div class="side-box">
        <h3>🏅 Erfolge <small class="help">· ${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}</small></h3>
        <div class="ach-list">${achs.map(({ a, v, done }) => `
          <div class="mission ${done ? 'done' : ''}">
            <span class="ach-icon">${a.icon}</span>
            <div class="m-text"><b>${esc(a.name)}</b> <span class="help">${esc(a.text)}</span><div class="pbar"><i style="width:${(v / a.goal) * 100}%"></i></div><span class="help">${v}/${a.goal}</span></div>
            ${done ? '<span class="status ok">✓</span>' : `<button class="btn small ${v >= a.goal ? 'gold' : ''}" data-ach="${a.id}" ${v >= a.goal ? '' : 'disabled'}>+${a.reward} 🗳️</button>`}
          </div>`).join('')}</div>
      </div>
    </div>`;
  $('#earn-salary').onclick = claimSalary;
  $('#earn-daily').onclick = () => { if (claimDaily()) toast(`🎁 +${DAILY_BONUS} Stimmen!`, 'good'); renderEarn(); };
  $('#earn-quiz').onclick = startQuiz;
  $$('[data-mission]', root).forEach((b) => (b.onclick = () => claimMission(b.dataset.mission)));
  $$('[data-ach]', root).forEach((b) => (b.onclick = () => claimAchievement(b.dataset.ach)));
  if ($('#earn-allbonus')) $('#earn-allbonus').onclick = claimAllBonus;
  updateEarnBadge();
}

/* ---------- Quiz ---------- */
function maskName(text, p) {
  const parts = new Set([...p.name.split(/[\s,.-]+/), ...p.wiki.split(/[\s,().-]+/)].filter((w) => w.length >= 3 && !/^(der|die|das|von|von|und|duc|de|da)$/i.test(w)));
  let t = text;
  parts.forEach((w) => { t = t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'gi'), '▇▇▇'); });
  const sentences = t.split(/(?<=[.!?])\s+/);
  let out = '';
  for (const s of sentences) { if ((out + s).length > 280 && out) break; out += (out ? ' ' : '') + s; }
  return out;
}

async function buildQuestion(rng, used) {
  const pool = POLITICIANS.filter((p) => !used.has(p.id));
  const p = pool[Math.floor(rng() * pool.length)];
  used.add(p.id);
  const info = await Promise.race([Wiki.get(p), new Promise((r) => setTimeout(() => r({}), 1500))]);
  const kinds = ['fact'];
  if (info && info.img) kinds.push('portrait', 'portrait');
  if (info && info.extract && info.extract.length > 80) kinds.push('extract', 'extract');
  const kind = kinds[Math.floor(rng() * kinds.length)];
  // Ablenker: ähnliche Politiker (gleiche Region oder Epoche), aber anderes Amt
  const similar = POLITICIANS.filter((o) => o.id !== p.id && o.office !== p.office && (o.region === p.region || o.era === p.era));
  const others = similar.length >= 3 ? similar : POLITICIANS.filter((o) => o.id !== p.id && o.office !== p.office);
  const opts = [p];
  while (opts.length < 4) { const o = others[Math.floor(rng() * others.length)]; if (!opts.includes(o)) opts.push(o); }
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  let prompt;
  if (kind === 'portrait') prompt = `<div class="quiz-img" style="background-image:url('${info.img}')"></div><h3>Wer ist das?</h3>`;
  else if (kind === 'extract') prompt = `<h3>Über wen steht das in der Wikipedia?</h3><blockquote class="quiz-quote">${esc(maskName(info.extract, p))}</blockquote>`;
  else prompt = `<h3>Wer war ${esc(p.office)}?</h3><p class="help">Hinweise: ${p.flag} ${esc(REGIONS[p.region].name)} · ${esc(ERAS[p.era].name)}</p>`;
  return { p, opts, prompt, kind };
}

async function startQuiz() {
  ensureEarnState();
  const rng = mulberry32(randomSeed());
  const used = new Set();
  const full = S.daily.quizRounds < QUIZ_FULL_ROUNDS;
  S.daily.quizRounds++;
  saveState();
  let i = 0, correct = 0, streak = 0, earned = 0;
  const factor = full ? 1 : 0.5;
  const next = async () => {
    if (i >= QUIZ_LEN) return finish();
    openModal(`<div class="quiz"><div class="help">Frage ${i + 1}/${QUIZ_LEN} · Serie ${streak} · +${earned} 🗳️</div><p class="help">Lade Frage …</p></div>`);
    const q = await buildQuestion(rng, used);
    i++;
    openModal(`<div class="quiz">
      <div class="help">Frage ${i}/${QUIZ_LEN} · Serie ${streak}🔥 · bisher +${earned} 🗳️</div>
      ${q.prompt}
      <div class="quiz-opts">${q.opts.map((o) => `<button class="btn quiz-opt" data-id="${o.id}"><span class="mini-por" data-portrait="${q.kind === 'portrait' ? '' : o.id}" style="--rc:${RARITIES[o.rarity].color}"><span>${esc(initials(o.name))}</span></span>${esc(o.name)}</button>`).join('')}</div>
      <div id="quiz-fb" class="quiz-fb"></div>
    </div>`, () => { i = QUIZ_LEN + 1; });
    $$('.quiz-opt').forEach((b) => (b.onclick = () => {
      const ok = b.dataset.id === q.p.id;
      $$('.quiz-opt').forEach((x) => { x.disabled = true; if (x.dataset.id === q.p.id) x.classList.add('right'); });
      if (ok) {
        correct++; streak++;
        const gain = Math.round((12 + Math.min(10, (streak - 1) * 2)) * factor);
        earned += gain;
        track('quiz');
        $('#quiz-fb').innerHTML = `<span class="status ok">✅ Richtig! +${gain} 🗳️</span>`;
      } else {
        streak = 0;
        b.classList.add('wrong');
        $('#quiz-fb').innerHTML = `<span class="status warn">❌ Leider falsch, gesucht war <b>${esc(q.p.name)}</b> (${esc(q.p.office)}).</span>`;
      }
      $('#quiz-fb').innerHTML += ` <button class="btn small primary" id="quiz-next">${i >= QUIZ_LEN ? 'Auswertung' : 'Weiter →'}</button>`;
      $('#quiz-next').onclick = next;
    }));
  };
  const finish = () => {
    if (i > QUIZ_LEN) { // abgebrochen
      if (earned) addVotes(earned);
      saveState(); renderEarn(); return;
    }
    const perfect = correct === QUIZ_LEN ? Math.round(50 * factor) : 0;
    earned += perfect;
    addVotes(earned);
    gainXp(correct * 3);
    saveState();
    openModal(`<div class="quiz" style="text-align:center">
      <div class="result-title ${correct >= QUIZ_LEN / 2 ? 'win' : 'lose'}">${correct === QUIZ_LEN ? '🧠 Perfekt!' : correct >= QUIZ_LEN / 2 ? '👏 Gut gemacht!' : '📚 Nachsitzen!'}</div>
      <p class="result-sub">${correct} von ${QUIZ_LEN} richtig${perfect ? ` · Perfektionsbonus +${perfect}` : ''}${full ? '' : ' · halbe Belohnung (Tageslimit erreicht)'}</p>
      <div class="reward">+${earned} 🗳️ Stimmen</div>
      <div class="row" style="justify-content:center"><button class="btn" id="quiz-close">Schließen</button><button class="btn primary" id="quiz-again">Noch eine Runde</button></div>
    </div>`);
    $('#quiz-close').onclick = () => { closeModal(); renderEarn(); };
    $('#quiz-again').onclick = () => { closeModal(); startQuiz(); };
    renderEarn();
  };
  next();
}
