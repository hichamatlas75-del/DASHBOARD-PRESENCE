/**
 * Rendu de l'Interface Utilisateur (Vues Jour, Bilan, Table R/C, Modals, Graphiques)
 * Direction Hub • Grey Corner
 */

let myChart = null;
let _modalState = null; // { mode: 'calendar'|'history', nom, prenom }
let lastRenderedDate = null;

function errorCard(text) {
  return `<div class="glass-card p-5 rounded-2xl" style="border-color:rgba(248,113,113,.28);background:rgba(248,113,113,.06)">
    <div class="text-[11px] font-extrabold" style="color:rgba(220,38,38,.90)">${esc(text)}</div>
  </div>`;
}

function loadingCard(text) {
  return `<div class="glass-card p-6 rounded-2xl flex items-center justify-center gap-3">
    <div class="spin"></div>
    <div class="text-[11px] font-extrabold" style="color:var(--muted2)">${esc(text)}</div>
  </div>`;
}

function currentDayForDayMode() {
  const dayPicker = document.getElementById('dayPicker');
  return dayPicker?.value || todayISO();
}

/**
 * Rendu ou mise à jour ciblée (in-place) de la vue du jour
 * Évite le re-rendu complet du DOM lors de chaque pointage temps réel
 */
function renderDayView(data) {
  const container = document.getElementById('dashBody');
  if (!container) return;

  const selectedDay = currentDayForDayMode();
  const isPastDay   = (selectedDay < todayISO());
  const needsFullRebuild = (lastRenderedDate !== selectedDay || !container.querySelector('[data-empid]'));

  const groups = {};
  equipe.forEach(e => (groups[e.poste] || (groups[e.poste] = [])).push(e));

  if (needsFullRebuild) {
    lastRenderedDate = selectedDay;
    let html = '';
    POSTES_ORDER.filter(p => groups[p]).forEach(poste => {
      html += `<div class="mb-6">
        <div class="flex items-center gap-3 mb-3">
          <div class="smallCaps">${esc(poste)}</div>
          <div class="accent-bar" style="flex:1"></div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">`;

      groups[poste].slice().sort((a, b) => {
        const A = empIdOf(a), B = empIdOf(b);
        if (A === "BOUCHNAK_NAOUAL") return -1;
        if (B === "BOUCHNAK_NAOUAL") return 1;
        return (a.nom + a.prenom).localeCompare(b.nom + b.prenom);
      }).forEach(emp => {
        const id = empIdOf(emp);
        const cardProps = calculateEmpCardProps(emp, id, data[id] || {}, selectedDay, isPastDay);
        html += `
          <button id="card-${escAttr(id)}" data-empid="${escAttr(id)}" class="staff-card ${escAttr(cardProps.finalSClass)} glass-card p-4 rounded-2xl text-left flex flex-col justify-between" style="min-height:7rem">
            <span class="status-dot" style="background:${escAttr(cardProps.finalDot)}"></span>
            <div class="arrive-time">${esc(cardProps.ha)}</div>
            <div>
              <p class="text-[11px] font-extrabold uppercase truncate pr-4" style="color:#0f2744">${esc(emp.nom)}</p>
              <p class="text-[10px] font-semibold mt-0.5" style="color:var(--muted3)">${esc(titleCase(emp.prenom))}</p>
            </div>
            <p class="status-text text-[11px] font-extrabold mt-2" style="${escAttr(cardProps.statusColor)}">${esc(cardProps.statusText)}</p>
          </button>`;
      });
      html += `</div></div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('[data-empid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const emp = getEmpById(btn.dataset.empid);
        openHistory(emp.nom, emp.prenom);
      });
    });
  } else {
    // Mise à jour fluide in-place sans détruire le DOM
    equipe.forEach(emp => {
      const id = empIdOf(emp);
      const card = document.getElementById(`card-${id}`);
      if (!card) return;
      const cardProps = calculateEmpCardProps(emp, id, data[id] || {}, selectedDay, isPastDay);

      card.className = `staff-card ${cardProps.finalSClass} glass-card p-4 rounded-2xl text-left flex flex-col justify-between`;
      const dot = card.querySelector('.status-dot');
      if (dot) dot.style.background = cardProps.finalDot;

      const arriveTime = card.querySelector('.arrive-time');
      if (arriveTime) arriveTime.textContent = cardProps.ha;

      const statusText = card.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = cardProps.statusText;
        statusText.setAttribute('style', cardProps.statusColor);
      }
    });
  }
}

function calculateEmpCardProps(emp, id, d, selectedDay, isPastDay) {
  const isSec = (emp.poste === "SECURITE" || emp.poste === "SÉCURITÉ");
  const isCuisine = (emp.poste === "CUISINE");
  const isSoumia = isSoumiaStaff(id);
  const isMenage = isMenageStaff(emp) || isMenageStaff(id);
  const caissePlan = (isSalilStaff(id) || isBenkhadaStaff(id)) ? getCaisseAlternance(id, selectedDay) : null;
  const { y: ySel, m: mSel, d: dDay } = parseISO(selectedDay);
  const dtSel = new Date(Date.UTC(ySel, mSel - 1, dDay));
  const isMonday = (dtSel.getUTCDay() === 1);
  const cuisinePlan = isCuisine ? getCuisinePlanning(id, selectedDay) : null;
  const soumiaPlan = isSoumia ? getSoumiaPlanning(selectedDay) : null;

  const hp = safeTime(d.hP) || (soumiaPlan && !soumiaPlan.off ? soumiaPlan.hP : (caissePlan ? caissePlan.hP : (isSec ? "09:00" : (cuisinePlan && !cuisinePlan.off ? cuisinePlan.hP : ""))));
  const ha = safeTime(d.hA) || "";
  const diff = diffFromEntry({ hA: ha, hP: hp }, id, selectedDay);
  const sClass = getStatusClass(diff, !!d.off, !!ha);
  const dot = getDotColor(diff, !!d.off, !!ha);

  const isCuisinePlanOff = (isCuisine && cuisinePlan?.off);
  const isSoumiaPlanOff = (isSoumia && soumiaPlan?.off);
  const isAbsent = (!ha && !d.off && isPastDay && !(isSec && isMonday) && !isCuisinePlanOff && !isSoumiaPlanOff && !isMenage);
  const finalSClass = (isSec && isMonday && !ha || isCuisinePlanOff && !ha || isSoumiaPlanOff && !ha || (isMenage && !ha && isPastDay))
    ? 'status-off' : (isAbsent ? 'status-absent' : sClass);
  const finalDot = (isSec && isMonday && !ha || isCuisinePlanOff && !ha || isSoumiaPlanOff && !ha || (isMenage && !ha && isPastDay))
    ? 'rgba(168,85,247,.80)' : (isAbsent ? 'rgba(234,88,12,.80)' : dot);

  let statusText = 'Attente', statusColor = 'color:var(--muted3)';
  if (ha) {
    if (isMenage) {
      statusText = "Présent"; statusColor = 'color:var(--ok)';
    } else if (hp || isSec || cuisinePlan || soumiaPlan || caissePlan) {
      if (diff > 0) { statusText = `+${diff} min`; statusColor = 'color:var(--crit)'; }
      else { statusText = "À l'heure"; statusColor = 'color:var(--ok)'; }
    } else {
      statusText = "OK"; statusColor = 'color:var(--ok)';
    }
  } else if (d.off) {
    statusText = "OFF"; statusColor = 'color:rgba(148,163,184,.80)';
  } else if (isMenage) {
    if (isPastDay) {
      statusText = "Repos / Congé"; statusColor = 'color:var(--chip-r-fg)';
    } else {
      statusText = "Saisie manuelle"; statusColor = 'color:var(--muted3)';
    }
  } else if (isSoumia && soumiaPlan?.off) {
    statusText = "OFF (Mardi)"; statusColor = 'color:rgba(168,85,247,.80)';
  } else if (caissePlan) {
    statusText = `Rot. ${caissePlan.shift}`; statusColor = 'color:#4338ca';
  } else if (isSec && isMonday) {
    statusText = "Repos Lundi"; statusColor = 'color:var(--chip-r-fg)';
  } else if (isCuisinePlanOff) {
    statusText = "Repos (Plan)"; statusColor = 'color:var(--chip-r-fg)';
  } else if (isAbsent) {
    statusText = "⚠ Absent"; statusColor = 'color:rgba(234,88,12,.90)';
  }

  return { ha, diff, finalSClass, finalDot, statusText, statusColor };
}

/**
 * Réutilisation optimisée de l'instance Chart.js (évite recréation du canvas)
 */
function renderChart(labels, lates, presences) {
  const chartCanvas = document.getElementById('trendsChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');

  if (myChart) {
    myChart.data.labels = labels;
    myChart.data.datasets[0].data = lates;
    myChart.data.datasets[1].data = presences;
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
          tension: .38, borderWidth: 2.5, pointRadius: 0, fill: true
        },
        {
          label: "Présences (nb)", data: presences,
          borderColor: 'rgba(5,150,105,.90)', backgroundColor: 'rgba(5,150,105,.08)',
          tension: .38, borderWidth: 2, pointRadius: 0, fill: false
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
        x: { grid: { display: false }, ticks: { font: { size: 8, weight: '600' }, color: 'var(--muted2)' } }
      }
    }
  });
}

async function renderReportView() {
  const dateInput = document.getElementById('dashDate');
  const mk = monthKeyFromISO(dateInput.value);
  const md = await getMonthData(mk);
  if (md.anyFail) {
    document.getElementById('dashBody').innerHTML = errorCard("Réseau instable : certaines journées manquantes. Change de mois puis reviens, ou vérifie ta connexion.");
    return;
  }
  const { dates, presByDay, punchByDay } = md;
  const today = todayISO();
  const stats = {};
  equipe.forEach(e => { const id = empIdOf(e); stats[id] = { info: e, present: 0, lateMin: 0, R: 0, C: 0 }; });
  const { rcByEmpDay, startMap } = await getMonthRCMap(mk);
  const dailyLates = [], dailyPresence = [], labels = [];

  dates.forEach(dayISO => {
    labels.push(dayISO.split('-')[2]);
    if (dayISO > today || isExcluded(dayISO)) { dailyLates.push(0); dailyPresence.push(0); return; }
    const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO]);
    let tL = 0, tP = 0;
    Object.keys(stats).forEach(id => {
      const start = startMap[id];
      if (!start || dayISO < start) return;
      const e = merged[id] || null;
      const hp = safeTime(e?.hP) || "";
      const ha = safeTime(e?.hA) || "";
      if (ha) {
        const diff = diffFromEntry({ hA: ha, hP: hp }, id, dayISO);
        stats[id].present++; stats[id].lateMin += diff; tL += diff; tP++;
        return;
      }
      const rc = rcByEmpDay[id]?.[dayISO];
      if (rc) stats[id][rc]++;
    });
    dailyLates.push(tL); dailyPresence.push(tP);
  });

  renderChart(labels, dailyLates, dailyPresence);

  function isRankedPoste(poste) {
    const p = String(poste || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return p === "SERVICE" || p === "BAR";
  }

  const rankedStats = Object.values(stats).filter(s => isRankedPoste(s.info?.poste));
  const lateList = rankedStats.filter(s => s.lateMin > 0).sort((a, b) => b.lateMin - a.lateMin);
  const goodList = rankedStats.filter(s => s.lateMin === 0 && s.present > 0).sort((a, b) => b.present - a.present);
  const maxLate = lateList.length ? lateList[0].lateMin : 0;

  let html = '<div class="space-y-6">';

  html += `<div>
    <div class="flex items-center gap-3 mb-3">
      <div class="smallCaps" style="color:rgba(220,38,38,.80)">Top retardataires · Service & Bar</div>
      <div style="flex:1;height:2px;border-radius:999px;background:linear-gradient(90deg,rgba(220,38,38,.40),transparent)"></div>
    </div>`;
  if (!lateList.length) {
    html += `<div class="glass-card p-5 rounded-2xl text-center text-[12px] font-extrabold" style="color:var(--muted3)">Aucun retard enregistré 🎉</div>`;
  } else {
    lateList.slice(0, 6).forEach(s => {
      const pct = maxLate ? Math.max(6, Math.round((s.lateMin / maxLate) * 100)) : 0;
      html += `<div class="glass-card p-4 rounded-2xl mb-3">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[12px] font-extrabold truncate" style="color:#0f2744">${esc(s.info.nom)} <span style="opacity:.55;font-size:11px">${esc(titleCase(s.info.prenom))}</span></span>
            <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex-shrink-0" style="background:rgba(59,130,246,.10);color:#2563eb">${esc(s.info.poste)}</span>
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
    <div class="flex items-center gap-3 mb-3">
      <div class="smallCaps" style="color:rgba(5,150,105,.85)">Les plus disciplinés · Service & Bar</div>
      <div style="flex:1;height:2px;border-radius:999px;background:linear-gradient(90deg,rgba(5,150,105,.40),transparent)"></div>
    </div>`;
  if (!goodList.length) {
    html += `<div class="glass-card p-5 rounded-2xl text-center text-[12px] font-extrabold" style="color:var(--muted3)">Aucune présence "OK" trouvée</div>`;
  } else {
    goodList.slice(0, 6).forEach(s => {
      html += `<div class="glass-card p-4 rounded-2xl mb-3 flex justify-between items-center">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-[12px] font-extrabold truncate" style="color:#0f2744">${esc(s.info.nom)} <span style="opacity:.55;font-size:11px">${esc(titleCase(s.info.prenom))}</span></span>
          <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex-shrink-0" style="background:rgba(59,130,246,.10);color:#2563eb">${esc(s.info.poste)}</span>
        </div>
        <span class="text-[12px] font-extrabold flex-shrink-0 ml-2" style="color:var(--ok)">${esc(s.present)} j ✓</span>
      </div>`;
    });
  }
  html += `</div></div>`;
  document.getElementById('dashBody').innerHTML = html;
}

function makeTable(rows, colR, colC) {
  return `<div class="mt-4 overflow-x-auto">
    <table class="rc-table">
      <colgroup>
        <col style="width:35%">
        <col style="width:13%">
        <col style="width:10%">
        <col style="width:10%">
        <col style="width:16%">
        <col style="width:16%">
      </colgroup>
      <thead><tr>
        <th style="text-align:left">Employé</th>
        <th style="text-align:center">Prés.</th>
        <th style="text-align:center">${esc(colR)}</th>
        <th style="text-align:center">${esc(colC)}</th>
        <th style="text-align:center" title="Repos non pris à récupérer (dû au salarié)">Solde</th>
        <th style="text-align:center">Retard</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const late = Number(r.lateMin) || 0;
          const solde = Math.max(0, Number(r.solde) || 0);
          const isNoRepos = noReposIds.has(r.empId);

          let soldeHtml = '<span class="muted-dash">—</span>';
          if (!isNoRepos) {
            if (solde > 0) {
              soldeHtml = `<span class="solde-badge solde-plus" title="${solde} jour(s) de repos à récupérer">+${solde}</span>`;
            } else {
              soldeHtml = `<span class="solde-badge solde-zero" title="Aucun repos en retard">0</span>`;
            }
          }

          return `<tr data-nom="${escAttr(r.nom)}" data-prenom="${escAttr(r.prenom)}" title="Cliquer pour voir le calendrier">
            <td class="col-emp">
              <span style="font-weight:900;font-size:11px;color:#0f2744">${esc(r.nom)}</span><br>
              <span style="opacity:.55;font-weight:700;font-size:10px;color:#0f2744">${esc(titleCase(r.prenom))}</span>
              <br><span class="rc-poste-badge">${esc((r.poste || "").toLowerCase())}</span>
              <span style="font-size:9px;color:var(--muted3);margin-left:4px">📅</span>
            </td>
            <td style="text-align:center;font-weight:900;color:var(--ok)">${esc(r.present)}</td>
            <td style="text-align:center;font-weight:900;color:var(--chip-r-fg)">${esc(r.R)}</td>
            <td style="text-align:center;font-weight:900;color:var(--amber)">${esc(r.C)}</td>
            <td style="text-align:center;font-weight:900">${soldeHtml}</td>
            <td style="text-align:center;font-weight:900;color:var(--crit)">
              ${late ? `<span style="font-size:10px">${esc(late)}m</span>` : '<span class="muted-dash">—</span>'}
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

async function renderRCView() {
  const dateInput = document.getElementById('dashDate');
  const mk = monthKeyFromISO(dateInput.value);
  const year = dateInput.value.slice(0, 4);
  const md = await getMonthData(mk);
  if (md.anyFail) {
    document.getElementById('dashBody').innerHTML = errorCard("Réseau instable : certaines journées manquantes. Réessaie ou vérifie la connexion.");
    return;
  }
  const monthSummary = await buildMonthlySummary(mk);
  const yearSummary  = await buildYearSummaryOptimized(year, { [mk]: monthSummary });

  const sortFn = (a, b) => {
    if (a.poste !== b.poste) return POSTES_ORDER.indexOf(a.poste) - POSTES_ORDER.indexOf(b.poste);
    return (a.nom + a.prenom).localeCompare(b.nom + b.prenom);
  };

  const monthRows = Object.values(monthSummary).sort(sortFn);
  let mP = 0, mR = 0, mC = 0, mL = 0;
  monthRows.forEach(r => { mP += r.present; mR += r.R; mC += r.C; mL += r.lateMin; });

  const yearRows = Object.values(yearSummary).sort(sortFn);
  let yP = 0, yR = 0, yC = 0, yL = 0;
  yearRows.forEach(r => { yP += r.present; yR += r.R; yC += r.C; yL += r.lateMin; });

  const html = `<div class="space-y-4">
    <details class="drawer" open>
      <summary>
        <div>
          <div class="smallCaps">Tableau Mois</div>
          <div class="hTitle text-xl mt-1">${esc(mk)}
            <span style="opacity:.55;font-family:'Plus Jakarta Sans';font-size:12px;font-weight:700">
              · ${esc(mP)} présents · R ${esc(mR)} · C ${esc(mC)} · ${esc(mL)} min
            </span>
          </div>
        </div>
        <div class="chev">▾</div>
      </summary>
      <div class="body">${makeTable(monthRows, 'R', 'C')}</div>
    </details>

    <details class="drawer">
      <summary>
        <div>
          <div class="smallCaps">Tableau Année (cumul)</div>
          <div class="hTitle text-xl mt-1">${esc(year)}
            <span style="opacity:.55;font-family:'Plus Jakarta Sans';font-size:12px;font-weight:700">
              · ${esc(yP)} présents · Repos ${esc(yR)} · Congé ${esc(yC)} · ${esc(yL)} min
            </span>
          </div>
        </div>
        <div class="chev">▾</div>
      </summary>
      <div class="body">
        ${makeTable(yearRows, 'Repos', 'Congé')}
        <p class="mt-3 text-[10px] font-semibold" style="color:var(--muted3)">
          Année = cumul des mois · Solde = repos non pris dus au salarié (+)
        </p>
      </div>
    </details>

    <p class="text-[10px] font-semibold" style="color:var(--muted3)">
      R = Repos hebdo · C = Congé pris / 2ᵉ repos · Solde = Repos non pris à récupérer · 📅 cliquer sur un employé pour le calendrier
    </p>
  </div>`;

  document.getElementById('dashBody').innerHTML = html;
  document.getElementById('dashBody').querySelectorAll('tr[data-nom]').forEach(tr => {
    tr.addEventListener('click', () => openCalendarModal(tr.dataset.nom, tr.dataset.prenom));
  });
}

function _modalMonthChange(newMk) {
  if (!_modalState) return;
  if (_modalState.mode === 'calendar') openCalendarModal(_modalState.nom, _modalState.prenom, newMk);
  else openHistory(_modalState.nom, _modalState.prenom, newMk);
}

async function openCalendarModal(nom, prenom, mk) {
  const dateInput = document.getElementById('dashDate');
  mk = mk || monthKeyFromISO(dateInput.value);
  _modalState = { mode: 'calendar', nom, prenom };
  const modal = document.getElementById('historyModal');
  modal.classList.remove("hidden", "modal-closing");
  modal.classList.add('modal-active');
  document.getElementById('modalSubtitle').textContent = 'Calendrier';
  document.getElementById('modalTitle').innerText = nom + " " + titleCase(prenom);
  document.getElementById('modalMonthPicker').value = mk;
  document.getElementById('modalList').innerHTML = loadingCard("Chargement calendrier…");

  const md = await getMonthData(mk);
  if (md.anyFail) {
    document.getElementById('modalList').innerHTML = errorCard("Réseau instable : calendrier partiel.");
    return;
  }
  const { dates, presByDay, punchByDay } = md;
  const { rcByEmpDay, startMap, soldeByEmpMonth, currentSoldeByEmp } = await getMonthRCMap(mk);
  const today = todayISO();
  const emp = equipe.find(e => e.nom === nom && e.prenom === prenom);
  const empId = emp ? empIdOf(emp) : (nom + "_" + prenom);
  const empStart = startMap[empId];
  const curSolde = soldeByEmpMonth?.[empId]?.[mk] ?? currentSoldeByEmp?.[empId] ?? 0;
  const isNoRepos = noReposIds.has(empId);

  const TYPES = {
    future:  { bg: 'rgba(148,163,184,.06)', color: 'rgba(148,163,184,.45)', label: '·' },
    exclu:   { bg: 'rgba(148,163,184,.06)', color: 'rgba(148,163,184,.35)', label: '—' },
    avant:   { bg: 'rgba(148,163,184,.04)', color: 'rgba(148,163,184,.30)', label: '·' },
    present: { bg: 'rgba(5,150,105,.11)',   color: '#065f46',               label: '✓' },
    retard:  { bg: 'rgba(220,38,38,.08)',   color: '#991b1b',               label: '⚡' },
    repos:   { bg: 'rgba(99,102,241,.12)',  color: '#3730a3',               label: 'R' },
    conge:   { bg: 'rgba(245,158,11,.13)',  color: '#92400e',               label: 'C' },
    off:     { bg: 'rgba(148,163,184,.11)', color: 'rgba(100,116,139,.75)', label: 'OFF' },
    absent:  { bg: 'rgba(234,88,12,.09)',   color: '#9a3412',               label: '⚠' }
  };

  let nPresent = 0, nR = 0, nC = 0, nOff = 0, nAbsent = 0;
  const dayMap = {};

  dates.forEach(dayISO => {
    if (dayISO > today) { dayMap[dayISO] = { type: 'future' }; return; }
    if (isExcluded(dayISO)) { dayMap[dayISO] = { type: 'exclu' }; return; }
    if (!empStart || dayISO < empStart) { dayMap[dayISO] = { type: 'avant' }; return; }
    const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO]);
    const e = merged[empId] || null;
    const isSec = (emp && (emp.poste === "SECURITE" || emp.poste === "SÉCURITÉ"));
    const isMenage = (emp && (emp.poste === "MENAGE" || emp.poste === "MÉNAGE")) || isMenageStaff(empId);
    const [yY, mM, dD] = dayISO.split('-').map(Number);
    const dtD = new Date(Date.UTC(yY, mM - 1, dD));
    const isMonday = (dtD.getUTCDay() === 1);

    const hp = safeTime(e?.hP) || (isSec ? "09:00" : "");
    const ha = safeTime(e?.hA) || "";
    if (ha) {
      const diff = diffFromEntry({ hA: ha, hP: hp }, empId, dayISO);
      if (diff > 0 && !isMenage) { dayMap[dayISO] = { type: 'retard', ha, hp, diff }; nPresent++; }
      else { dayMap[dayISO] = { type: 'present', ha, hp }; nPresent++; }
      return;
    }
    if (isSec && isMonday) {
      dayMap[dayISO] = { type: 'repos' }; nR++; return;
    }
    const rc = rcByEmpDay[empId]?.[dayISO];
    if (rc === 'R') { dayMap[dayISO] = { type: 'repos' }; nR++; return; }
    if (rc === 'C') { dayMap[dayISO] = { type: 'conge' }; nC++; return; }
    if (e && e.off) { dayMap[dayISO] = { type: 'off' }; nOff++; return; }
    if (isMenage) { dayMap[dayISO] = { type: 'repos' }; nR++; return; }
    dayMap[dayISO] = { type: 'absent' }; nAbsent++;
  });

  const badge = (bg, bd, fg, txt) => `<span style="background:${bg};border:1px solid ${bd};color:${fg};font-weight:900;font-size:10px;padding:3px 9px;border-radius:999px;white-space:nowrap">${txt}</span>`;
  let recapHtml = `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">`;
  if (nPresent) recapHtml += badge('rgba(5,150,105,.11)', 'rgba(5,150,105,.28)', '#065f46', `✓ ${nPresent} présents`);
  if (nR)       recapHtml += badge('rgba(99,102,241,.12)', 'rgba(99,102,241,.25)', '#3730a3', `R ${nR} repos`);
  if (nC)       recapHtml += badge('rgba(245,158,11,.13)', 'rgba(245,158,11,.28)', '#92400e', `C ${nC} congés`);
  if (!isNoRepos) {
    if (curSolde > 0) {
      recapHtml += badge('rgba(16,185,129,.14)', 'rgba(16,185,129,.35)', '#065f46', `📌 Solde : +${curSolde} à récupérer`);
    } else {
      recapHtml += badge('rgba(30,41,59,.06)', 'rgba(30,41,59,.14)', 'var(--muted2)', `Solde : 0`);
    }
  }
  if (nOff)    recapHtml += badge('rgba(148,163,184,.12)', 'rgba(148,163,184,.28)', '#475569', `OFF ${nOff}`);
  if (nAbsent) recapHtml += badge('rgba(234,88,12,.10)', 'rgba(234,88,12,.28)', '#9a3412', `⚠ ${nAbsent} absents`);
  recapHtml += `</div>`;

  const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  let calHtml = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:3px">`;
  DAYS_FR.forEach(d => { calHtml += `<div style="text-align:center;font-size:8px;font-weight:800;color:var(--muted2);padding:2px 0;text-transform:uppercase;letter-spacing:.06em">${d}</div>`; });
  calHtml += `</div>`;

  const firstDay = dates[0];
  const lastDay  = dates[dates.length - 1];
  let cursor     = weekStartMondayISO(firstDay);
  calHtml += `<div style="display:flex;flex-direction:column;gap:2px">`;
  while (cursor <= lastDay) {
    calHtml += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
    for (let i = 0; i < 7; i++) {
      const inMonth = dates.includes(cursor);
      if (!inMonth) {
        calHtml += `<div class="cal-cell cal-out"></div>`;
      } else {
        const info = dayMap[cursor] || { type: 'avant' };
        const t = TYPES[info.type] || TYPES.avant;
        const isToday = (cursor === today);
        const { d } = parseISO(cursor);
        let sub = t.label;
        if (info.type === 'present') sub = info.ha || '✓';
        if (info.type === 'retard')  sub = `+${info.diff}m`;
        calHtml += `<div class="cal-cell${isToday ? ' cal-today' : ''}" style="background:${t.bg};border-color:${isToday ? 'rgba(245,158,11,.65)' : 'rgba(148,163,184,.10)'}">
          <div style="font-size:11px;font-weight:900;color:#0f2744">${d}</div>
          <div style="font-size:9px;font-weight:800;color:${t.color};text-align:center;line-height:1.1">${sub}</div>
        </div>`;
      }
      cursor = addDaysISO(cursor, 1);
    }
    calHtml += `</div>`;
  }
  calHtml += `</div>`;

  const legHtml = `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--stroke-med);padding-top:10px">
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">✓ Présent</span>
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">⚡ Retard</span>
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">R Repos</span>
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">C Congé</span>
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">OFF jour de repos</span>
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">⚠ Absent non justifié</span>
  </div>`;

  document.getElementById('modalList').innerHTML = recapHtml + calHtml + legHtml;
}

function rowHistory(dayISO, statut, hp, ha, retard, cls, rc) {
  const rcTxt = rc ? ` · <span style="font-family:'Plus Jakarta Sans';font-weight:900">${esc(rc)}</span>` : "";
  return `<div class="p-4 rounded-2xl" style="background:rgba(255,255,255,.50);border:1px solid var(--stroke-med)">
    <div class="flex justify-between items-center">
      <span class="smallCaps" style="font-size:10px">${esc(fmtFR(dayISO))}</span>
      <span class="text-[11px] font-extrabold" style="${escAttr(cls)}">${esc(statut)}${rcTxt}</span>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2">
      <div class="text-[10px] font-bold" style="color:var(--muted3)">HP <span style="color:#0f2744;font-weight:900">${esc(hp || "—")}</span></div>
      <div class="text-[10px] font-bold" style="color:var(--muted3)">HA <span style="color:#0f2744;font-weight:900">${esc(ha || "—")}</span></div>
      <div class="text-[10px] font-bold" style="color:var(--muted3)">Ret <span style="color:#0f2744;font-weight:900">${esc(retard || "—")}</span></div>
    </div>
  </div>`;
}

async function openHistory(nom, prenom, mk) {
  const dateInput = document.getElementById('dashDate');
  mk = mk || monthKeyFromISO(dateInput.value);
  _modalState = { mode: 'history', nom, prenom };
  const modal = document.getElementById('historyModal');
  modal.classList.remove("hidden", "modal-closing");
  modal.classList.add('modal-active');
  document.getElementById('modalSubtitle').textContent = 'Historique';
  document.getElementById('modalTitle').innerText = nom + " " + titleCase(prenom);
  document.getElementById('modalMonthPicker').value = mk;
  document.getElementById('modalList').innerHTML = loadingCard("Chargement historique…");

  const md = await getMonthData(mk);
  if (md.anyFail) {
    document.getElementById('modalList').innerHTML = errorCard("Réseau instable : historique partiel.");
    return;
  }
  const { dates, presByDay, punchByDay } = md;
  const { rcByEmpDay, startMap } = await getMonthRCMap(mk);
  const today = todayISO();
  const emp = equipe.find(e => e.nom === nom && e.prenom === prenom);
  const empId = emp ? empIdOf(emp) : (nom + "_" + prenom);

  let html = "";
  let absCount = 0;
  dates.slice().reverse().forEach(dayISO => {
    if (dayISO > today) { html += rowHistory(dayISO, "À venir", "", "", "", "color:var(--muted3)"); return; }
    if (isExcluded(dayISO)) { html += rowHistory(dayISO, "Exclu", "", "", "", "color:var(--muted3)"); return; }
    const empStart = startMap[empId];
    if (!empStart || dayISO < empStart) { html += rowHistory(dayISO, "Non commencé", "", "", "", "color:var(--muted3)"); return; }
    const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO]);
    const e = merged[empId] || null;
    const [yY, mM, dD] = dayISO.split('-').map(Number);
    const dtD = new Date(Date.UTC(yY, mM - 1, dD));
    const isMonday = (dtD.getUTCDay() === 1);

    const isSec = (emp && (emp.poste === "SECURITE" || emp.poste === "SÉCURITÉ"));
    const isCuisine = (emp && (emp.poste === "CUISINE"));
    const isSoumia = isSoumiaStaff(empId);
    const isMenage = (emp && (emp.poste === "MENAGE" || emp.poste === "MÉNAGE")) || isMenageStaff(empId);
    const caissePlan = (isSalilStaff(empId) || isBenkhadaStaff(empId)) ? getCaisseAlternance(empId, dayISO) : null;
    const cuisinePlan = isCuisine ? getCuisinePlanning(empId, dayISO) : null;
    const soumiaPlan = isSoumia ? getSoumiaPlanning(dayISO) : null;

    const hp = safeTime(e?.hP) || (soumiaPlan && !soumiaPlan.off ? soumiaPlan.hP : (caissePlan ? caissePlan.hP : (isSec ? "09:00" : (cuisinePlan && !cuisinePlan.off ? cuisinePlan.hP : ""))));
    const ha = safeTime(e?.hA) || "";
    if (ha) {
      const diff = diffFromEntry({ hA: ha, hP: hp }, empId, dayISO);
      if (diff > 0 && !isMenage) html += rowHistory(dayISO, "Retard", hp, ha, `+${diff} min`, "color:var(--crit)");
      else html += rowHistory(dayISO, "À l'heure", hp, ha, "0", "color:var(--ok)");
      return;
    }
    if (isSoumia && soumiaPlan?.off) {
      html += rowHistory(dayISO, "Repos Mardi", hp, ha, "", "color:var(--chip-r-fg)", "R");
      return;
    }
    if (isSec && isMonday) {
      html += rowHistory(dayISO, "Repos Lundi", hp, ha, "", "color:var(--chip-r-fg)", "R");
      return;
    }
    if (isCuisine && cuisinePlan?.off) {
      html += rowHistory(dayISO, "Repos (Plan)", hp, ha, "", "color:var(--chip-r-fg)", "R");
      return;
    }
    const rc = rcByEmpDay[empId]?.[dayISO];
    if (rc) {
      html += rowHistory(dayISO, rc === "R" ? "Repos" : "Congé", hp, ha, "", "color:var(--muted2)", rc);
    } else if (isMenage) {
      html += rowHistory(dayISO, "Repos", hp, ha, "", "color:var(--muted2)", "R");
    } else if (e && e.off) {
      html += rowHistory(dayISO, "OFF", hp, ha, "", "color:var(--muted2)", "OFF");
    } else {
      absCount++;
      html += rowHistory(dayISO, "⚠ Absent", hp, ha, "", "color:rgba(234,88,12,.90)");
    }
  });

  const absBanner = absCount > 0
    ? `<div style="background:rgba(234,88,12,.08);border:1px solid rgba(234,88,12,.28);border-radius:16px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">⚠️</span>
        <div>
          <div style="font-weight:900;font-size:12px;color:#9a3412">${absCount} absence${absCount > 1 ? 's' : ''} non justifiée${absCount > 1 ? 's' : ''} ce mois</div>
          <div style="font-size:10px;font-weight:600;color:rgba(154,52,18,.70);margin-top:2px">Ni pointage (HA) ni case OFF cochée</div>
        </div>
      </div>`
    : '';
  document.getElementById('modalList').innerHTML = (absBanner + html) ||
    `<p class="text-center py-10 text-[12px] font-extrabold" style="color:var(--muted3)">Aucune donnée ce mois</p>`;
}

function openStaffAdmin() {
  const m = document.getElementById("staffAdminModal");
  m.classList.remove("hidden", "modal-closing");
  m.classList.add("modal-active");
}

function closeStaffAdmin() {
  const m = document.getElementById("staffAdminModal");
  m.classList.remove("modal-active");
  m.classList.add("modal-closing");
  setTimeout(() => { m.classList.remove("modal-closing"); m.classList.add("hidden"); }, 260);
}

function closeModal() {
  const m = document.getElementById('historyModal');
  m.classList.remove("modal-active");
  m.classList.add("modal-closing");
  setTimeout(() => { m.classList.remove("modal-closing"); m.classList.add("hidden"); }, 260);
}
