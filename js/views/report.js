/**
 * Vue Bilan Mensuel • Métriques, Graphiques & Exports
 * Direction Hub • Grey Corner
 */

let _currentBilanWeek = 'all';
let _lastBilanMonth = null;
const DOW_SHORT_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function fmtShortDate(iso) {
  if (!iso || !iso.includes("-")) return iso || "";
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function formatMonthNameFR(mk) {
  if (!mk) return "";
  const [y, m] = mk.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  const name = dt.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  return titleCase(name) + " " + y;
}

function getMonthWeeksList(monthDates) {
  if (!monthDates || !monthDates.length) return [];
  const weeksMap = new Map();
  monthDates.forEach(dayISO => {
    const monISO = weekStartMondayISO(dayISO);
    if (!weeksMap.has(monISO)) {
      const sunISO = addDaysISO(monISO, 6);
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDaysISO(monISO, i));
      }
      weeksMap.set(monISO, {
        id: monISO,
        monday: monISO,
        sunday: sunISO,
        days
      });
    }
  });
  return Array.from(weeksMap.values());
}

window.setBilanWeekFilter = function(weekId) {
  _currentBilanWeek = weekId;
  renderReportView();
};

/**
 * Réutilisation optimisée de l'instance Chart.js (évite recréation du canvas)
 */
function renderChart(labels, lates, presences) {
  const chartCanvas = document.getElementById('trendsChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  const ptRadius = labels.length <= 7 ? 4 : 0;
  const ptHoverRadius = labels.length <= 7 ? 6 : 4;

  if (myChart) {
    myChart.data.labels = labels;
    myChart.data.datasets[0].data = lates;
    myChart.data.datasets[1].data = presences;
    myChart.data.datasets[0].pointRadius = ptRadius;
    myChart.data.datasets[0].pointHoverRadius = ptHoverRadius;
    myChart.data.datasets[1].pointRadius = ptRadius;
    myChart.data.datasets[1].pointHoverRadius = ptHoverRadius;
    myChart.update();
    return;
  }

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: "Retards (min)", data: lates,
          borderColor: 'rgba(245,158,11,.95)', backgroundColor: 'rgba(245,158,11,.08)',
          tension: .38, borderWidth: 2.5, pointRadius: ptRadius, pointHoverRadius: ptHoverRadius, fill: true
        },
        {
          label: "Présences (nb)", data: presences,
          borderColor: 'rgba(5,150,105,.90)', backgroundColor: 'rgba(5,150,105,.08)',
          tension: .38, borderWidth: 2, pointRadius: ptRadius, pointHoverRadius: ptHoverRadius, fill: false
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(255,255,255,.96)',
          titleColor: '#0f2744',
          bodyColor: '#1e3a5f',
          borderColor: 'rgba(245,158,11,.35)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10
        }
      },
      scales: {
        y: { display: false },
        x: { grid: { display: false }, ticks: { font: { size: 9, weight: '700' }, color: 'var(--muted2)' } }
      }
    }
  });
}

async function renderReportView() {
  const dateInput = document.getElementById('dashDate');
  const mk = monthKeyFromISO(dateInput.value);
  if (_lastBilanMonth !== mk) {
    _currentBilanWeek = 'all';
    _lastBilanMonth = mk;
  }

  const md = await getMonthData(mk);
  if (md.anyFail) {
    document.getElementById('dashBody').innerHTML = errorCard("Réseau instable : certaines journées manquantes. Change de mois puis reviens, ou vérifie ta connexion.");
    return;
  }

  const today = todayISO();
  const weeksList = getMonthWeeksList(md.dates);

  // Vérifier si la semaine existe toujours
  if (_currentBilanWeek !== 'all' && !weeksList.some(w => w.id === _currentBilanWeek)) {
    _currentBilanWeek = 'all';
  }

  // Affichage des filtres par semaine
  const chipsContainer = document.getElementById('bilanWeekChips');
  const activeBadge = document.getElementById('bilanFilterActiveBadge');
  if (chipsContainer) {
    const isAllActive = (_currentBilanWeek === 'all');
    let chipsHtml = `
      <button type="button" onclick="setBilanWeekFilter('all')"
        class="bilan-week-btn ${isAllActive ? 'active' : ''}">
        <span class="week-indicator"></span>
        <span>Tout le mois</span>
      </button>
    `;
    weeksList.forEach((w, idx) => {
      const isActive = (_currentBilanWeek === w.id);
      const isCurrent = (today >= w.monday && today <= w.sunday);
      chipsHtml += `
        <button type="button" data-week-id="${escAttr(w.id)}" onclick="setBilanWeekFilter(this.dataset.weekId)"
          class="bilan-week-btn ${isActive ? 'active' : ''}"
          title="Du Lundi ${fmtShortDate(w.monday)} au Dimanche ${fmtShortDate(w.sunday)}">
          <span class="week-indicator"></span>
          <span>Sem. ${idx + 1}</span>
          <span class="text-[9.5px] opacity-75 font-semibold">(${fmtShortDate(w.monday)}–${fmtShortDate(w.sunday)})</span>
          ${isCurrent ? '<span class="text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded-full font-black ml-0.5" style="background:rgba(5,150,105,.15);color:#065f46">En cours</span>' : ''}
        </button>
      `;
    });
    chipsContainer.innerHTML = chipsHtml;
  }

  let targetDays = md.dates;
  let labels = [];
  let chartTitleText = `Tendances du mois (${formatMonthNameFR(mk)})`;
  let rankingPeriodLabel = `Tout le mois`;
  let rankingPeriodSub = formatMonthNameFR(mk);

  if (_currentBilanWeek !== 'all') {
    const curW = weeksList.find(w => w.id === _currentBilanWeek);
    const curIdx = weeksList.findIndex(w => w.id === _currentBilanWeek);
    if (curW) {
      targetDays = curW.days;
      labels = curW.days.map(d => {
        const { y, m, d: day } = parseISO(d);
        const dt = new Date(Date.UTC(y, m - 1, day));
        return `${DOW_SHORT_FR[dt.getUTCDay()]} ${String(day).padStart(2, '0')}`;
      });
      chartTitleText = `Tendances · Semaine ${curIdx + 1} (Lun ${fmtShortDate(curW.monday)} ➔ Dim ${fmtShortDate(curW.sunday)})`;
      rankingPeriodLabel = `Semaine ${curIdx + 1}`;
      rankingPeriodSub = `Lun ${fmtShortDate(curW.monday)} – Dim ${fmtShortDate(curW.sunday)}`;
    }
  } else {
    labels = md.dates.map(d => d.split('-')[2]);
  }

  const chartTitleEl = document.getElementById('chartTitle');
  if (chartTitleEl) chartTitleEl.textContent = chartTitleText;

  if (activeBadge) {
    activeBadge.textContent = (_currentBilanWeek === 'all')
      ? "Tout le mois"
      : `${rankingPeriodLabel} (${rankingPeriodSub})`;
  }

  // Pré-charger mois et timelines nécessaires pour targetDays
  const monthsNeeded = new Set([mk]);
  targetDays.forEach(d => monthsNeeded.add(monthKeyFromISO(d)));
  const monthDataPacks = {};
  for (const m of monthsNeeded) {
    monthDataPacks[m] = (m === mk) ? md : await getMonthData(m);
  }

  const yearsNeeded = new Set([mk.slice(0, 4)]);
  targetDays.forEach(d => yearsNeeded.add(d.slice(0, 4)));
  const yearTimelinePacks = {};
  for (const y of yearsNeeded) {
    yearTimelinePacks[y] = await getMonthRCMap(y + '-01');
  }

  const activeBilanEquipe = typeof getActiveEquipeForMonth === 'function' ? getActiveEquipeForMonth(mk) : equipe;
  const stats = {};
  activeBilanEquipe.forEach(e => { const id = empIdOf(e); stats[id] = { info: e, present: 0, lateMin: 0, R: 0, C: 0, M: 0, ABSENT: 0 }; });
  const dailyLates = [], dailyPresence = [];

  targetDays.forEach(dayISO => {
    if (dayISO > today || isExcluded(dayISO)) {
      dailyLates.push(0);
      dailyPresence.push(0);
      return;
    }
    const dMk = monthKeyFromISO(dayISO);
    const dYr = dayISO.slice(0, 4);
    const curPack = monthDataPacks[dMk] || { presByDay: {}, punchByDay: {}, motifsByDay: {} };
    const curTimeline = yearTimelinePacks[dYr] || { rcByEmpDay: {}, startMap: {} };

    const merged = mergeDay(curPack.presByDay?.[dayISO], curPack.punchByDay?.[dayISO], curPack.motifsByDay?.[dayISO]);
    let tL = 0, tP = 0;

    activeBilanEquipe.forEach(emp => {
      const id = empIdOf(emp);
      const ev = evaluateEmployeeDay(emp, dayISO, merged[id] || null, curTimeline.rcByEmpDay?.[id]?.[dayISO], curTimeline.startMap?.[id]);
      if (ev.type === "maladie") {
        stats[id].M++;
      } else if (ev.isPresent) {
        stats[id].present++;
        stats[id].lateMin += ev.diff;
        tL += ev.diff;
        tP++;
      } else if (ev.rc && stats[id][ev.rc] !== undefined) {
        stats[id][ev.rc]++;
      }
    });

    dailyLates.push(tL);
    dailyPresence.push(tP);
  });

  renderChart(labels, dailyLates, dailyPresence);

  function isRankedPoste(poste) {
    const p = String(poste || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return p === "SERVICE" || p === "BAR";
  }

  // ─── F8 : CALCUL ET DÉTECTION DES ANOMALIES RH (ABSENCES & RETARDS CHRONIQUES) ───
  const anomalies = [];
  activeBilanEquipe.forEach(emp => {
    const id = empIdOf(emp);
    const isMenage = isMenageStaff(emp) || isMenageStaff(id);

    let consecutiveAbsent = 0;
    let maxConsecutiveAbsent = 0;
    let presentCount = 0;
    let lateCount = 0;
    let totalLateMin = 0;

    targetDays.forEach(dayISO => {
      if (dayISO > today || isExcluded(dayISO)) return;
      const dMk = monthKeyFromISO(dayISO);
      const dYr = dayISO.slice(0, 4);
      const curPack = monthDataPacks[dMk] || { presByDay: {}, punchByDay: {}, motifsByDay: {} };
      const curTimeline = yearTimelinePacks[dYr] || { rcByEmpDay: {}, startMap: {} };

      const merged = mergeDay(curPack.presByDay?.[dayISO], curPack.punchByDay?.[dayISO], curPack.motifsByDay?.[dayISO]);
      const ev = evaluateEmployeeDay(emp, dayISO, merged[id] || null, curTimeline.rcByEmpDay?.[id]?.[dayISO], curTimeline.startMap?.[id]);
      if (ev.type === "avant" || ev.type === "future" || ev.type === "exclu") return;

      if (ev.isPresent) {
        presentCount++;
        consecutiveAbsent = 0;
        if (ev.isLate) {
          lateCount++;
          totalLateMin += ev.diff;
        }
      } else if (ev.type === "repos" || ev.type === "conge" || ev.type === "maladie") {
        // Le jour de repos OFF, congé ou arrêt maladie réinitialise les absences consécutives
        consecutiveAbsent = 0;
      } else {
        consecutiveAbsent++;
        if (consecutiveAbsent > maxConsecutiveAbsent) {
          maxConsecutiveAbsent = consecutiveAbsent;
        }
      }
    });

    // 1. Alerte Absences Consécutives / Inexpliquées (>= 2 jours)
    if (maxConsecutiveAbsent >= 2) {
      anomalies.push({
        emp,
        severity: maxConsecutiveAbsent >= 3 ? "crit" : "amber",
        type: "absences",
        title: `${maxConsecutiveAbsent} absences consécutives`,
        detail: `Ni pointage ni repos posé sur ${maxConsecutiveAbsent} jours consécutifs`,
        metric: `${maxConsecutiveAbsent} j`,
        badgeText: maxConsecutiveAbsent >= 3 ? "🚨 Critique" : "⚠️ Attention"
      });
    }

    // 2. Alerte Retard Chronique (Taux de retard >= 35% avec au moins 2 retards)
    const lateRate = presentCount > 0 ? (lateCount / presentCount) : 0;
    if (presentCount >= 3 && lateCount >= 2 && lateRate >= 0.35 && !isMenage) {
      const pct = Math.round(lateRate * 100);
      anomalies.push({
        emp,
        severity: lateRate >= 0.50 ? "crit" : "amber",
        type: "retards",
        title: `Retard chronique (${pct}%)`,
        detail: `${lateCount} retards sur ${presentCount} présences (cumul +${totalLateMin}m)`,
        metric: `+${totalLateMin}m`,
        badgeText: lateRate >= 0.50 ? "🚨 Récidive" : "⚠️ À surveiller"
      });
    }
  });

  anomalies.sort((a, b) => (a.severity === "crit" ? -1 : 1));

  const rankedStats = Object.values(stats).filter(s => isRankedPoste(s.info?.poste));
  const lateList = rankedStats.filter(s => s.lateMin > 0).sort((a, b) => b.lateMin - a.lateMin);
  const goodList = rankedStats.filter(s => s.lateMin === 0 && s.present > 0).sort((a, b) => b.present - a.present);
  const maxLate = lateList.length ? lateList[0].lateMin : 0;

  let html = '<div class="space-y-6">';

  // ─── AFFICHAGE EN-TÊTE F8 : DÉTECTION ANOMALIES RH ───
  html += `<div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="smallCaps" style="color:var(--text)">⚠️ Alertes RH & Détection d'Anomalies</div>
        <div style="width:20px;height:2px;border-radius:999px;background:var(--accent)"></div>
      </div>
      <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full"
            style="background:${anomalies.length ? 'rgba(220,38,38,.12)' : 'rgba(5,150,105,.12)'};color:${anomalies.length ? 'var(--crit)' : 'var(--ok)'}">
        ${anomalies.length ? `${anomalies.length} alerte(s)` : 'Régulier ✓'}
      </span>
    </div>`;

  if (!anomalies.length) {
    html += `
      <div class="glass-card p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm"
           style="background:rgba(5,150,105,.06);border-color:rgba(5,150,105,.22);color:var(--ok)">
        <div class="flex items-center gap-2.5">
          <span class="text-base">✨</span>
          <span class="text-[11px] font-extrabold">Aucune absence consécutive anormale ni retard chronique détecté sur cette période.</span>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black shrink-0" style="background:rgba(5,150,105,.15)">Conforme</span>
      </div>`;
  } else {
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;
    anomalies.forEach(a => {
      const isCrit = (a.severity === "crit");
      const bgCard = isCrit ? "rgba(254,242,242,.88)" : "rgba(255,251,235,.88)";
      const bdrCard = isCrit ? "rgba(239,68,68,.32)" : "rgba(245,158,11,.32)";
      const colorTitle = isCrit ? "var(--crit)" : "var(--amber)";
      const badgeBg = isCrit ? "rgba(220,38,38,.14)" : "rgba(245,158,11,.14)";

      html += `
        <div class="glass-card p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between"
             style="background:${bgCard};border-color:${bdrCard};box-shadow:0 3px 12px rgba(0,0,0,.03)"
             data-nom="${escAttr(a.emp.nom)}" data-prenom="${escAttr(a.emp.prenom)}"
             onclick="openCalendarModal(this.dataset.nom, this.dataset.prenom)"
             title="Cliquer pour inspecter le calendrier">
          <div class="flex items-start justify-between gap-2.5 mb-2">
            <div class="flex items-center gap-2.5 min-w-0">
              ${getStaffAvatarHtml(a.emp.nom, a.emp.prenom, 'sm')}
              <div class="min-w-0">
                <div class="text-[11px] font-extrabold truncate" style="color:#0f2744">
                  ${esc(a.emp.nom)} <span style="opacity:.6;font-size:10.5px">${esc(titleCase(a.emp.prenom))}</span>
                </div>
                <div class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md inline-block mt-0.5" style="background:rgba(59,130,246,.10);color:#2563eb">
                  ${esc(a.emp.poste)}
                </div>
              </div>
            </div>
            <span class="text-[9.5px] font-black px-2 py-0.5 rounded-full whitespace-nowrap" style="background:${badgeBg};color:${colorTitle}">
              ${esc(a.badgeText)}
            </span>
          </div>

          <div class="pt-2 border-t" style="border-color:${bdrCard}">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10.5px] font-extrabold" style="color:${colorTitle}">
                ${a.type === 'absences' ? '🛑' : '⏰'} ${esc(a.title)}
              </span>
              <span class="text-[11px] font-black" style="color:${colorTitle}">${esc(a.metric)}</span>
            </div>
            <div class="text-[9.5px] font-semibold mt-0.5 leading-snug" style="color:var(--muted3)">
              ${esc(a.detail)}
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="smallCaps" style="color:rgba(220,38,38,.80)">Top retardataires · Service & Bar</div>
        <div style="width:20px;height:2px;border-radius:999px;background:rgba(220,38,38,.40)"></div>
      </div>
      <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full" style="background:rgba(220,38,38,.10);color:var(--crit)">
        ${esc(rankingPeriodLabel)} · ${esc(rankingPeriodSub)}
      </span>
    </div>`;
  if (!lateList.length) {
    html += `<div class="glass-card p-5 rounded-2xl text-center text-[12px] font-extrabold" style="color:var(--muted3)">
      ${_currentBilanWeek === 'all' ? 'Aucun retard enregistré ce mois 🎉' : 'Aucun retard enregistré cette semaine 🎉'}
    </div>`;
  } else {
    lateList.slice(0, 6).forEach(s => {
      const pct = maxLate ? Math.max(6, Math.round((s.lateMin / maxLate) * 100)) : 0;
      html += `<div class="glass-card p-4 rounded-2xl mb-3">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2.5 min-w-0">
            ${getStaffAvatarHtml(s.info.nom, s.info.prenom, 'sm')}
            <div class="min-w-0">
              <span class="text-[12px] font-extrabold truncate" style="color:#0f2744">${esc(s.info.nom)} <span style="opacity:.55;font-size:11px">${esc(titleCase(s.info.prenom))}</span></span>
              <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ml-1" style="background:rgba(59,130,246,.10);color:#2563eb">${esc(s.info.poste)}</span>
            </div>
          </div>
          <span class="text-[12px] font-extrabold flex-shrink-0 ml-2" style="color:var(--crit)">${esc(s.lateMin)} min</span>
        </div>
        <div style="height:5px;border-radius:999px;background:rgba(245,158,11,.10);margin-top:10px;overflow:hidden">
          <div style="height:5px;width:${escAttr(pct)}%;background:linear-gradient(90deg,rgba(220,38,38,.65),rgba(220,38,38,.35));border-radius:999px;transition:width .4s ease"></div>
        </div>
      </div>`;
    });
  }
  html += `</div>`;

  html += `<div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="smallCaps" style="color:rgba(5,150,105,.85)">Les plus disciplinés · Service & Bar</div>
        <div style="width:20px;height:2px;border-radius:999px;background:rgba(5,150,105,.40)"></div>
      </div>
      <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full" style="background:rgba(5,150,105,.10);color:var(--ok)">
        ${esc(rankingPeriodLabel)} · ${esc(rankingPeriodSub)}
      </span>
    </div>`;
  if (!goodList.length) {
    html += `<div class="glass-card p-5 rounded-2xl text-center text-[12px] font-extrabold" style="color:var(--muted3)">
      ${_currentBilanWeek === 'all' ? 'Aucune présence "OK" trouvée ce mois' : 'Aucune présence "OK" trouvée cette semaine'}
    </div>`;
  } else {
    goodList.slice(0, 6).forEach(s => {
      html += `<div class="glass-card p-4 rounded-2xl mb-3 flex justify-between items-center">
        <div class="flex items-center gap-2.5 min-w-0">
          ${getStaffAvatarHtml(s.info.nom, s.info.prenom, 'sm')}
          <div class="min-w-0">
            <span class="text-[12px] font-extrabold truncate" style="color:#0f2744">${esc(s.info.nom)} <span style="opacity:.55;font-size:11px">${esc(titleCase(s.info.prenom))}</span></span>
            <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ml-1" style="background:rgba(59,130,246,.10);color:#2563eb">${esc(s.info.poste)}</span>
          </div>
        </div>
        <span class="text-[12px] font-extrabold flex-shrink-0 ml-2" style="color:var(--ok)">${esc(s.present)} j ✓</span>
      </div>`;
    });
  }
  html += `</div></div>`;
  document.getElementById('dashBody').innerHTML = html;
}
