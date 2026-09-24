/**
 * Couche de Données, Requêtes Firebase & Moteurs de Calcul
 * Direction Hub • Grey Corner
 */

// Caches mémoires
const monthDataCache    = new Map();
const monthRCMapCache   = new Map();
const empStartMapCache  = new Map();
const yearTimelineCache = new Map();
const yearPrefetchedSet = new Set();

function clearMonthCache() {
  monthDataCache.clear();
  monthRCMapCache.clear();
  empStartMapCache.clear();
  yearTimelineCache.clear();
  yearPrefetchedSet.clear();
}

/**
 * Fusion optimisée sans JSON.parse/stringify (gain 10-15x en CPU et allocation mémoire)
 */
function mergeDay(pres, punches) {
  const merged = {};
  if (pres && typeof pres === 'object') {
    for (const id in pres) {
      if (Object.prototype.hasOwnProperty.call(pres, id)) {
        merged[id] = { ...pres[id] };
      }
    }
  }
  if (punches && typeof punches === 'object') {
    for (const id in punches) {
      if (Object.prototype.hasOwnProperty.call(punches, id)) {
        if (!merged[id]) merged[id] = {};
        const pe = punches[id];
        if (pe && pe.hA) merged[id].hA = pe.hA;
        if (merged[id].hA && merged[id].off === true) merged[id].off = false;
      }
    }
  }
  return merged;
}

function getDatesInMonth(seedISO) {
  const { y, m } = parseISO(seedISO);
  const dates = [];
  let t = Date.UTC(y, m - 1, 1);
  while (true) {
    const dt = new Date(t);
    if (dt.getUTCMonth() !== (m - 1)) break;
    dates.push(toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
    t += 86400000;
  }
  return dates;
}

function getDatesInMonthKey(mk) {
  return getDatesInMonth(mk + "-01");
}

/**
 * Requête de plage ultra-rapide (2 requêtes parallèles)
 */
async function fetchRangePresPunch(startDate, endDate) {
  try {
    const [presSnap, punchSnap] = await Promise.all([
      database.ref('presences').orderByKey().startAt(startDate).endAt(endDate).once('value'),
      database.ref('punches').orderByKey().startAt(startDate).endAt(endDate).once('value')
    ]);
    return {
      presByDay: presSnap.val() || {},
      punchByDay: punchSnap.val() || {},
      anyFail: false
    };
  } catch (e) {
    console.error("fetchRangePresPunch error:", e);
    return { presByDay: {}, punchByDay: {}, anyFail: true, fatal: true, err: e };
  }
}

/**
 * Pré-chargement de l'année entière en seulement 2 requêtes globales
 */
async function prefetchYearData(year) {
  if (yearPrefetchedSet.has(year)) return;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const res = await fetchRangePresPunch(startDate, endDate);
  if (!res.anyFail) {
    yearPrefetchedSet.add(year);
    for (let i = 1; i <= 12; i++) {
      const mk = `${year}-${String(i).padStart(2, "0")}`;
      const dates = getDatesInMonthKey(mk);
      const presByDay = {}, punchByDay = {};
      dates.forEach(d => {
        if (res.presByDay[d]) presByDay[d] = res.presByDay[d];
        if (res.punchByDay[d]) punchByDay[d] = res.punchByDay[d];
      });
      monthDataCache.set(mk, {
        monthKey: mk,
        dates,
        presByDay,
        punchByDay,
        anyFail: false
      });
    }
  }
}

async function getMonthData(mk) {
  if (monthDataCache.has(mk)) return monthDataCache.get(mk);
  const dates = getDatesInMonthKey(mk);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const pack = { monthKey: mk, dates, presByDay: {}, punchByDay: {}, anyFail: false };
  const res = await fetchRangePresPunch(startDate, endDate);
  pack.presByDay = res.presByDay || {};
  pack.punchByDay = res.punchByDay || {};
  pack.anyFail = !!res.anyFail;
  monthDataCache.set(mk, pack);
  return pack;
}

function hasAnyEmpActivity(e) {
  if (!e) return false;
  return !!(safeTime(e.hP) || safeTime(e.hA) || e.off === true);
}

function getConfiguredEmpStart(emp) {
  const d = String(emp?.dateDebut || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

async function getEmpStartMapForYear(year) {
  if (empStartMapCache.has(year)) return empStartMapCache.get(year);
  await prefetchYearData(year);
  const currentMk = monthKeyFromISO(todayISO());
  const startMap = {};
  equipe.forEach(emp => {
    const configured = getConfiguredEmpStart(emp);
    startMap[empIdOf(emp)] = configured || null;
  });
  for (let i = 1; i <= 12; i++) {
    const mk = `${year}-${String(i).padStart(2, "0")}`;
    if (mk > currentMk) break;
    const md = await getMonthData(mk);
    const { dates, presByDay, punchByDay } = md;
    for (const dayISO of dates) {
      if (dayISO > todayISO()) continue;
      const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO]);
      equipe.forEach(emp => {
        const id = empIdOf(emp);
        if (startMap[id]) return;
        if (hasAnyEmpActivity(merged[id] || null)) startMap[id] = dayISO;
      });
    }
  }
  empStartMapCache.set(year, startMap);
  return startMap;
}

/**
 * Calcul accéléré de la timeline annuelle (mémoïsation de mergeDay par jour)
 */
async function getYearTimeline(year) {
  if (yearTimelineCache.has(year)) return yearTimelineCache.get(year);
  await prefetchYearData(year);
  const startMap = await getEmpStartMapForYear(year);
  const currentMk = monthKeyFromISO(todayISO());
  const today = todayISO();

  for (let i = 1; i <= 12; i++) {
    const mk = `${year}-${String(i).padStart(2, "0")}`;
    if (mk > currentMk) break;
    await getMonthData(mk);
  }

  const firstDayYear = `${year}-01-01`;
  const lastDayYear  = `${year}-12-31`;
  const startMonday  = weekStartMondayISO(firstDayYear);
  const endLimit     = (year === today.slice(0, 4)) ? today : lastDayYear;

  const rcByEmpDay        = {};
  const soldeByEmpMonth   = {};
  const currentSoldeByEmp = {};
  const empBalances       = {};

  equipe.forEach(emp => {
    const id = empIdOf(emp);
    rcByEmpDay[id]        = {};
    soldeByEmpMonth[id]   = {};
    currentSoldeByEmp[id] = 0;
    empBalances[id]       = 0;
  });

  // Cache des fusions journalières pour éviter de fusionner 24x le même jour
  const dayMergedMap = {};

  let curWeekMonday = startMonday;
  while (curWeekMonday <= endLimit) {
    const weekDays = [];
    for (let d = 0; d < 7; d++) {
      weekDays.push(addDaysISO(curWeekMonday, d));
    }
    const sundayOfCurWeek = weekDays[6];
    const isWeekCompleted = (sundayOfCurWeek <= today);

    // Pré-calculer la fusion des 7 jours de la semaine une seule fois
    for (const d of weekDays) {
      if (!dayMergedMap[d] && d <= today) {
        const mk = monthKeyFromISO(d);
        const md = monthDataCache.get(mk);
        dayMergedMap[d] = md ? mergeDay(md.presByDay[d] || {}, md.punchByDay[d] || {}) : {};
      }
    }

    for (const emp of equipe) {
      const id = empIdOf(emp);
      const start = startMap[id];
      if (!start) continue;

      const isSpecialNoRepos = noReposIds.has(id);
      if (sundayOfCurWeek < start) continue;

      const offDaysInWeek = [];
      let hadAnyActivity = false;
      const isMenage = isMenageStaff(emp) || isMenageStaff(id);

      for (const d of weekDays) {
        if (d < start || d > today || isExcluded(d)) continue;
        const merged = dayMergedMap[d] || {};
        const e = merged[id] || null;
        const ha = safeTime(e?.hA);
        if (ha) {
          hadAnyActivity = true;
        } else if (e && e.off === true) {
          hadAnyActivity = true;
          offDaysInWeek.push(d);
        } else if (isMenage) {
          hadAnyActivity = true;
          offDaysInWeek.push(d);
        }
      }

      if (!hadAnyActivity && curWeekMonday < start) {
        continue;
      }

      const allExcluded = weekDays.every(d => isExcluded(d));
      if (allExcluded) continue;

      if (isSpecialNoRepos) {
        for (const d of offDaysInWeek) {
          rcByEmpDay[id][d] = "C";
        }
        continue;
      }

      const nOffs = offDaysInWeek.length;
      if (nOffs >= 1) {
        rcByEmpDay[id][offDaysInWeek[0]] = "R";
        for (let k = 1; k < nOffs; k++) {
          rcByEmpDay[id][offDaysInWeek[k]] = "C";
        }
      }

      // Repos non pris = +1 à récupérer, 2ème repos = déduit (min 0)
      if (isWeekCompleted) {
        if (nOffs === 0) {
          if (hadAnyActivity || curWeekMonday >= start) {
            empBalances[id] += 1;
          }
        } else if (nOffs >= 2) {
          empBalances[id] = Math.max(0, empBalances[id] - (nOffs - 1));
        }
      } else {
        if (nOffs >= 2) {
          empBalances[id] = Math.max(0, empBalances[id] - (nOffs - 1));
        }
      }

      for (const d of weekDays) {
        if (d <= today) {
          const mk = monthKeyFromISO(d);
          soldeByEmpMonth[id][mk] = empBalances[id];
        }
      }
      currentSoldeByEmp[id] = empBalances[id];
    }

    curWeekMonday = addDaysISO(curWeekMonday, 7);
  }

  const result = { rcByEmpDay, soldeByEmpMonth, currentSoldeByEmp, startMap };
  yearTimelineCache.set(year, result);
  return result;
}

async function getMonthRCMap(mk) {
  if (monthRCMapCache.has(mk)) return monthRCMapCache.get(mk);
  const year = mk.slice(0, 4);
  const timeline = await getYearTimeline(year);
  const out = {
    rcByEmpDay: timeline.rcByEmpDay,
    startMap: timeline.startMap,
    soldeByEmpMonth: timeline.soldeByEmpMonth,
    currentSoldeByEmp: timeline.currentSoldeByEmp
  };
  monthRCMapCache.set(mk, out);
  return out;
}

async function buildMonthlySummary(mk) {
  const year = mk.slice(0, 4);
  const timeline = await getYearTimeline(year);
  const { rcByEmpDay, soldeByEmpMonth, startMap } = timeline;
  const md = await getMonthData(mk);
  const { dates, presByDay, punchByDay } = md;
  const today = todayISO();
  const out = {};
  equipe.forEach(emp => {
    const id = empIdOf(emp);
    const solde = soldeByEmpMonth[id]?.[mk] ?? timeline.currentSoldeByEmp[id] ?? 0;
    out[id] = { empId: id, nom: emp.nom, prenom: emp.prenom, poste: emp.poste, present: 0, R: 0, C: 0, lateMin: 0, solde };
  });
  dates.forEach(dayISO => {
    if (dayISO > today || isExcluded(dayISO)) return;
    const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO]);
    Object.keys(out).forEach(id => {
      const start = startMap[id];
      if (!start || dayISO < start) return;
      const e = merged[id] || null;
      const hp = safeTime(e?.hP) || "";
      const ha = safeTime(e?.hA) || "";
      if (ha) {
        out[id].present++;
        out[id].lateMin += diffFromEntry({ hA: ha, hP: hp }, id, dayISO);
        return;
      }
      const rc = rcByEmpDay[id]?.[dayISO];
      if (!rc) return;
      if (rc === "R") out[id].R++; else out[id].C++;
    });
  });
  return out;
}

async function buildYearSummaryOptimized(year, monthPrefetch) {
  const timeline = await getYearTimeline(year);
  const currentMk = monthKeyFromISO(todayISO());
  const totalsByEmp = {};
  equipe.forEach(emp => {
    const id = empIdOf(emp);
    totalsByEmp[id] = {
      empId: id,
      nom: emp.nom,
      prenom: emp.prenom,
      poste: emp.poste,
      present: 0,
      R: 0,
      C: 0,
      lateMin: 0,
      solde: timeline.currentSoldeByEmp[id] ?? 0
    };
  });
  for (let i = 1; i <= 12; i++) {
    const mk = `${year}-${String(i).padStart(2, "0")}`;
    if (mk > currentMk) break;
    const month = (monthPrefetch && monthPrefetch[mk]) ? monthPrefetch[mk] : await buildMonthlySummary(mk);
    Object.values(month).forEach(s => {
      if (!totalsByEmp[s.empId]) {
        totalsByEmp[s.empId] = {
          empId: s.empId,
          nom: s.nom || s.empId,
          prenom: s.prenom || "",
          poste: s.poste || "",
          present: 0,
          R: 0,
          C: 0,
          lateMin: 0,
          solde: timeline.currentSoldeByEmp[s.empId] ?? 0
        };
      }
      totalsByEmp[s.empId].present += Number(s.present) || 0;
      totalsByEmp[s.empId].R       += Number(s.R) || 0;
      totalsByEmp[s.empId].C       += Number(s.C) || 0;
      totalsByEmp[s.empId].lateMin += Number(s.lateMin) || 0;
    });
  }
  return totalsByEmp;
}

async function loadEquipeFromDB() {
  const snap = await database.ref(EQUIPE_PATH).once("value");
  const arr = snap.val();
  return (Array.isArray(arr) && arr.length) ? arr : equipe;
}

async function saveEquipeToDB(list) {
  try {
    await database.ref(EQUIPE_PATH).set(list);
    const hint = document.getElementById("teamPermHint");
    if (hint) hint.innerHTML = `Stocké dans Firebase: <b>settings/equipe</b> ✅`;
    return true;
  } catch (e) {
    const hint = document.getElementById("teamPermHint");
    if (hint) {
      hint.innerHTML = `<span style="color:var(--crit);font-weight:900">⚠️ PERMISSION_DENIED</span> :
       Vérifie les règles Firebase pour autoriser l'écriture sur <b>settings/equipe</b>.`;
    }
    throw e;
  }
}
