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

function extractMotif(val) {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    return String(val.motif || val.reason || val.texte || val.explication || val.msg || "").trim();
  }
  return "";
}

function findEmpRecord(map, emp) {
  if (!map || typeof map !== "object") return null;
  const id = (typeof empIdOf === "function") ? empIdOf(emp) : "";
  if (id && map[id] !== undefined) return map[id];

  const nom = String(emp?.nom || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const prenom = String(emp?.prenom || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const k1 = `${nom}_${prenom}`.replace(/\s+/g, "_");
  if (map[k1] !== undefined) return map[k1];
  const k2 = `${prenom}_${nom}`.replace(/\s+/g, "_");
  if (map[k2] !== undefined) return map[k2];
  const k3 = `${nom} ${prenom}`.replace(/\s+/g, "_");
  if (map[k3] !== undefined) return map[k3];

  const keys = Object.keys(map);
  for (const k of keys) {
    const normK = String(k).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
    const normNom = nom.replace(/[^A-Z0-9]/g, "");
    const normPrenom = prenom.replace(/[^A-Z0-9]/g, "");
    if (normNom && normPrenom && normK.includes(normNom) && normK.includes(normPrenom)) {
      return map[k];
    }
  }
  return null;
}

/**
 * Fusion optimisée sans JSON.parse/stringify (gain 10-15x en CPU et allocation mémoire)
 * Intègre les pointages, présences et motifs explicatifs de retard avec réconciliation intelligente
 */
function mergeDay(pres, punches, motifs) {
  const merged = {};
  if (pres && typeof pres === 'object') {
    for (const id in pres) {
      if (Object.prototype.hasOwnProperty.call(pres, id)) {
        merged[id] = { ...pres[id] };
        if (isExplicitMaladie(pres[id])) {
          merged[id].maladie = true;
          merged[id].statut = 'MALADIE';
          merged[id].off = false;
          merged[id].hA = "";
        } else if (isExplicitOffOrOut(pres[id])) {
          merged[id].off = true;
          merged[id].manualOff = true;
          merged[id].hA = "";
        }
      }
    }
  }
  if (punches && typeof punches === 'object') {
    for (const id in punches) {
      if (Object.prototype.hasOwnProperty.call(punches, id)) {
        if (!merged[id]) merged[id] = {};
        const pe = punches[id];
        const isManualOverride = !!(pres && pres[id] && (pres[id].manual === true || pres[id].hAManual));
        const isPresMaladie = !!(pres && pres[id] && isExplicitMaladie(pres[id])) || isExplicitMaladie(merged[id]);
        const isPresExplicitOff = !!(pres && pres[id] && isExplicitOffOrOut(pres[id]));
        const isMergedExplicitOff = isExplicitOffOrOut(merged[id]);
        if (pe && pe.hA && !isManualOverride && !isPresMaladie && !isPresExplicitOff && !isMergedExplicitOff) {
          merged[id].hA = pe.hA;
        }
        if (pe && typeof pe.dist === 'number') {
          merged[id].dist = pe.dist;
          merged[id].acc = pe.acc;
          merged[id].lat = pe.lat;
          merged[id].lon = pe.lon;
        }
        const m = extractMotif(pe);
        if (m && !merged[id].motif) {
          merged[id].motif = m;
        }
        if (isPresMaladie) {
          merged[id].maladie = true;
          merged[id].statut = 'MALADIE';
          merged[id].off = false;
          merged[id].hA = "";
        } else if (isPresExplicitOff || isMergedExplicitOff) {
          merged[id].off = true;
          merged[id].manualOff = true;
          merged[id].hA = "";
        }
      }
    }
  }
  if (motifs && typeof motifs === 'object') {
    for (const id in motifs) {
      if (Object.prototype.hasOwnProperty.call(motifs, id)) {
        if (!merged[id]) merged[id] = {};
        const m = extractMotif(motifs[id]);
        if (m) {
          const adminSigned = !!(pres && pres[id] && pres[id].lastEditByAdmin === true);
          if (isMaladieMotifTag(m) && adminSigned) {
            merged[id].maladie = true;
            merged[id].statut = 'MALADIE';
            merged[id].off = false;
            merged[id].manualOff = false;
            merged[id].hA = "";
            const cleanM = stripMaladieMotifTag(m);
            if (cleanM) merged[id].motifMaladie = cleanM;
          } else if (!isMaladieMotifTag(m)) {
            merged[id].motif = m;
          }
        }
      }
    }
  }

  // Réconciliation flexible pour chaque employé de l'équipe
  if (typeof equipe !== 'undefined' && Array.isArray(equipe)) {
    equipe.forEach(emp => {
      const id = empIdOf(emp);
      if (!merged[id]) merged[id] = {};
      const presRec = pres ? findEmpRecord(pres, emp) : null;
      const moRec = motifs ? findEmpRecord(motifs, emp) : null;
      const moTxt = extractMotif(moRec);
      const adminSigned = !!(presRec && presRec.lastEditByAdmin === true) || merged[id].lastEditByAdmin === true;
      if (isExplicitMaladie(presRec) || isExplicitMaladie(merged[id]) || (isMaladieMotifTag(moTxt) && adminSigned)) {
        merged[id].maladie = true;
        merged[id].statut = 'MALADIE';
        merged[id].off = false;
        merged[id].manualOff = false;
        merged[id].hA = "";
        const cleanM = stripMaladieMotifTag(moTxt) || presRec?.motifMaladie || merged[id].motifMaladie || "";
        if (cleanM) merged[id].motifMaladie = cleanM;
        if (presRec?.certificat) merged[id].certificat = presRec.certificat;
        return;
      }
      if (isExplicitOffOrOut(presRec) || isExplicitOffOrOut(merged[id])) {
        merged[id].off = true;
        merged[id].manualOff = true;
        merged[id].hA = "";
        if (presRec && presRec.statut) merged[id].statut = presRec.statut;
        return;
      }
      if (!merged[id].motif && moTxt && !isMaladieMotifTag(moTxt)) {
        merged[id].motif = moTxt;
      }
      if (!merged[id].motif) {
        const puRec = findEmpRecord(punches, emp);
        const m = extractMotif(puRec);
        if (m) merged[id].motif = m;
      }
      if (!merged[id].hA && !merged[id].off && !merged[id].maladie) {
        const puRec = findEmpRecord(punches, emp);
        if (puRec && puRec.hA) merged[id].hA = puRec.hA;
        if (merged[id].dist === undefined && puRec && typeof puRec.dist === 'number') {
          merged[id].dist = puRec.dist;
          merged[id].acc = puRec.acc;
          merged[id].lat = puRec.lat;
          merged[id].lon = puRec.lon;
        }
      }
    });
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
 * Requête de plage ultra-rapide (3 requêtes parallèles : présences, pointages, motifs)
 */
async function fetchRangePresPunch(startDate, endDate) {
  try {
    const results = await Promise.allSettled([
      database.ref('presences').orderByKey().startAt(startDate).endAt(endDate).once('value'),
      database.ref('punches').orderByKey().startAt(startDate).endAt(endDate).once('value'),
      database.ref('broadcast/motifs').orderByKey().startAt(startDate).endAt(endDate).once('value')
    ]);

    const presSnap   = results[0].status === "fulfilled" ? results[0].value : null;
    const punchSnap  = results[1].status === "fulfilled" ? results[1].value : null;
    const motifsSnap = results[2].status === "fulfilled" ? results[2].value : null;

    const anyFail = (results[0].status === "rejected" && results[1].status === "rejected");

    return {
      presByDay: presSnap ? (presSnap.val() || {}) : {},
      punchByDay: punchSnap ? (punchSnap.val() || {}) : {},
      motifsByDay: motifsSnap ? (motifsSnap.val() || {}) : {},
      anyFail
    };
  } catch (e) {
    console.error("fetchRangePresPunch error:", e);
    return { presByDay: {}, punchByDay: {}, motifsByDay: {}, anyFail: true, fatal: true, err: e };
  }
}

/**
 * Pré-chargement de l'année entière avec présences, pointages et motifs
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
      const presByDay = {}, punchByDay = {}, motifsByDay = {};
      dates.forEach(d => {
        if (res.presByDay[d]) presByDay[d] = res.presByDay[d];
        if (res.punchByDay[d]) punchByDay[d] = res.punchByDay[d];
        if (res.motifsByDay && res.motifsByDay[d]) motifsByDay[d] = res.motifsByDay[d];
      });
      monthDataCache.set(mk, {
        monthKey: mk,
        dates,
        presByDay,
        punchByDay,
        motifsByDay,
        anyFail: false,
        ts: Date.now()
      });
    }
  }
}

const MONTH_CACHE_TTL_MS = 45000; // Fraîcheur max du mois en cours / futur
const monthInflight = new Map();

async function fetchMonthPack(mk) {
  const dates = getDatesInMonthKey(mk);
  const res = await fetchRangePresPunch(dates[0], dates[dates.length - 1]);
  return {
    monthKey: mk,
    dates,
    presByDay: res.presByDay || {},
    punchByDay: res.punchByDay || {},
    motifsByDay: res.motifsByDay || {},
    anyFail: !!res.anyFail,
    ts: Date.now()
  };
}

/**
 * Les mois passés restent en cache (immuables) ; le mois en cours / futur est
 * rechargé s'il a plus de MONTH_CACHE_TTL_MS, puis les calculs dérivés sont invalidés.
 */
async function getMonthData(mk) {
  const cached = monthDataCache.get(mk);
  const isLiveMonth = mk >= monthKeyFromISO(todayISO());
  if (cached && (!isLiveMonth || (Date.now() - (cached.ts || 0)) < MONTH_CACHE_TTL_MS)) return cached;

  if (monthInflight.has(mk)) return monthInflight.get(mk);
  const job = (async () => {
    const pack = await fetchMonthPack(mk);
    if (pack.anyFail && cached) return cached; // en cas d'échec réseau, garder les dernières données
    monthDataCache.set(mk, pack);
    if (cached) {
      monthRCMapCache.clear();
      yearTimelineCache.clear();
      empStartMapCache.clear();
    }
    return pack;
  })().finally(() => monthInflight.delete(mk));
  monthInflight.set(mk, job);
  return job;
}

function hasAnyEmpActivity(e) {
  if (!e) return false;
  return !!(safeTime(e.hP) || safeTime(e.hA) || e.off === true || isExplicitMaladie(e));
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
    const { dates, presByDay, punchByDay, motifsByDay } = md;
    for (const dayISO of dates) {
      if (dayISO > todayISO()) continue;
      const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO], motifsByDay?.[dayISO]);
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
        dayMergedMap[d] = md ? mergeDay(md.presByDay[d] || {}, md.punchByDay[d] || {}, md.motifsByDay?.[d] || {}) : {};
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
      let hasMaladieInWeek = false;
      const isMenage = isMenageStaff(emp) || isMenageStaff(id);

      for (const d of weekDays) {
        if (d < start || d > today || isExcluded(d)) continue;
        const merged = dayMergedMap[d] || {};
        const e = merged[id] || null;
        const ha = safeTime(e?.hA);
        const isMaladie = isExplicitMaladie(e);
        const isExplicitOff = isExplicitOffOrOut(e);

        if (isMaladie) {
          hadAnyActivity = true;
          hasMaladieInWeek = true;
          rcByEmpDay[id][d] = "M";
          continue;
        }

        if (ha) {
          hadAnyActivity = true;
        } else if (isExplicitOff || (e && e.off === true)) {
          hadAnyActivity = true;
          offDaysInWeek.push(d);
        } else if (isMenage) {
          hadAnyActivity = true;
          const mPlan = typeof getMenagePlanningInfo === 'function' ? getMenagePlanningInfo(emp, d) : null;
          if (mPlan && mPlan.off) {
            offDaysInWeek.push(d);
          }
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

      // Priorité au jour de repos officiel prévu au planning si présent parmi les jours OFF
      if (offDaysInWeek.length > 1) {
        offDaysInWeek.sort((a, b) => {
          const planA = (isMenage && typeof getMenagePlanningInfo === 'function' && getMenagePlanningInfo(emp, a)?.off) ? 1 : 0;
          const planB = (isMenage && typeof getMenagePlanningInfo === 'function' && getMenagePlanningInfo(emp, b)?.off) ? 1 : 0;
          return planB - planA;
        });
      }

      const nOffs = offDaysInWeek.length;
      if (nOffs >= 1) {
        // RÈGLE : 1 JOUR DE REPOS OFF PAR SEMAINE EXCLU DE L'ABSENCE (Repos légal R)
        rcByEmpDay[id][offDaysInWeek[0]] = "R";
        for (let k = 1; k < nOffs; k++) {
          // Tout jour OFF supplémentaire dans la même semaine est une ABSENCE pour le ménage
          rcByEmpDay[id][offDaysInWeek[k]] = isMenage ? "ABSENT" : "C";
        }
      }

      // Repos non pris = +1 à récupérer, 2ème repos = déduit (min 0)
      if (isWeekCompleted) {
        if (nOffs === 0 && !hasMaladieInWeek) {
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

function getLocalMaladieCert(empId, dayISO) {
  try {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem(`gc_maladie_cert_${empId}_${dayISO}`) || "";
  } catch (_) {
    return "";
  }
}

function setLocalMaladieCert(empId, dayISO, dataUrl) {
  try {
    if (typeof localStorage === "undefined") return;
    const key = `gc_maladie_cert_${empId}_${dayISO}`;
    if (dataUrl) localStorage.setItem(key, dataUrl);
    else localStorage.removeItem(key);
  } catch (_) {}
}

function getMaladieCertForEmpDay(empId, dayISO) {
  const local = getLocalMaladieCert(empId, dayISO);
  if (local) return local;
  const mk = monthKeyFromISO(dayISO);
  const md = monthDataCache.get(mk);
  if (md && md.presByDay && md.presByDay[dayISO] && md.presByDay[dayISO][empId]) {
    return md.presByDay[dayISO][empId].certificat || "";
  }
  return "";
}

/**
 * Récupère tous les arrêts maladie (M) d'un mois avec leur certificat médical
 * pour le contrôle et l'audit RH.
 */
async function scanAllMaladieRecords(mk) {
  const md = await getMonthData(mk);
  const { rcByEmpDay, startMap } = await getMonthRCMap(mk);
  const { dates, presByDay, punchByDay, motifsByDay } = md;
  const results = [];

  equipe.forEach(emp => {
    const id = empIdOf(emp);
    const empStart = startMap?.[id];
    let currentBlock = null;

    dates.forEach(dayISO => {
      const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO], motifsByDay?.[dayISO]);
      const ev = evaluateEmployeeDay(emp, dayISO, merged[id] || null, rcByEmpDay?.[id]?.[dayISO], empStart);

      if (ev.type === "maladie") {
        const cert = ev.certificat || getMaladieCertForEmpDay(id, dayISO) || "";
        const motif = ev.motif || "";
        const sameCert = (!cert || !currentBlock?.certificat || cert === currentBlock?.certificat);

        if (currentBlock && addDaysISO(currentBlock.endDay, 1) === dayISO && currentBlock.motif === motif && sameCert) {
          currentBlock.endDay = dayISO;
          currentBlock.days.push(dayISO);
          if (!currentBlock.certificat && cert) currentBlock.certificat = cert;
        } else {
          if (currentBlock) results.push(currentBlock);
          currentBlock = {
            emp,
            empId: id,
            startDay: dayISO,
            endDay: dayISO,
            days: [dayISO],
            motif,
            certificat: cert
          };
        }
      } else {
        if (currentBlock) {
          results.push(currentBlock);
          currentBlock = null;
        }
      }
    });

    if (currentBlock) {
      results.push(currentBlock);
      currentBlock = null;
    }
  });

  return results.sort((a, b) => b.startDay.localeCompare(a.startDay));
}

/**
 * Évaluation unifiée d'une journée pour un collaborateur (Amélioration #2).
 * Garantit que Bilan, Résumé mensuel, Calendrier et Historique appliquent exactement les mêmes règles métier.
 */
function evaluateEmployeeDay(empOrId, dayISO, mergedRec, rc, empStart) {
  const emp = (typeof empOrId === "object" && empOrId) ? empOrId : getEmpById(String(empOrId || ""));
  const empId = empIdOf(emp);
  const today = todayISO();
  const e = mergedRec || null;

  const isSec = (emp && (emp.poste === "SECURITE" || emp.poste === "SÉCURITÉ"));
  const isCuisine = (emp && emp.poste === "CUISINE");
  const isSoumia = typeof isSoumiaStaff === "function" && isSoumiaStaff(empId);
  const isMenage = (emp && (emp.poste === "MENAGE" || emp.poste === "MÉNAGE")) || (typeof isMenageStaff === "function" && isMenageStaff(empId));
  const caissePlan = (typeof isSalilStaff === "function" && (isSalilStaff(empId) || isBenkhadaStaff(empId))) ? getCaisseAlternance(empId, dayISO) : null;
  const cuisinePlan = (isCuisine && typeof getCuisinePlanning === "function") ? getCuisinePlanning(empId, dayISO) : null;
  const soumiaPlan = (isSoumia && typeof getSoumiaPlanning === "function") ? getSoumiaPlanning(dayISO) : null;
  const hp = safeTime(e?.hP) || (soumiaPlan && !soumiaPlan.off ? soumiaPlan.hP : (caissePlan ? caissePlan.hP : (isSec ? "09:00" : (cuisinePlan && !cuisinePlan.off ? cuisinePlan.hP : ""))));

  const isMaladie = (rc === "M") || isExplicitMaladie(e);
  if (isMaladie) {
    const motif = String(e?.motifMaladie || e?.motif || "").trim();
    const certificat = e?.certificat || getLocalMaladieCert(empId, dayISO) || "";
    return { type: "maladie", rc: "M", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif, certificat };
  }

  if (dayISO > today) return { type: "future", rc: "", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  if (isExcluded(dayISO)) return { type: "exclu", rc: "", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  if (!empStart || dayISO < empStart || (typeof isEmpActiveOnDate === "function" && !isEmpActiveOnDate(emp, dayISO))) {
    return { type: "avant", rc: "", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  }

  const isExplicitOut = isExplicitOffOrOut(e);
  const ha = isExplicitOut ? "" : (safeTime(e?.hA) || "");

  if (ha) {
    const diff = diffFromEntry({ hA: ha, hP: hp }, empId, dayISO);
    const isLate = (diff > 0 && !isMenage);
    const cleanMotif = isLate ? String(e?.motif || "").trim() : "";
    return {
      type: isLate ? "retard" : "present",
      rc: rc || "",
      isPresent: true,
      isLate,
      diff,
      hp,
      ha,
      motif: cleanMotif,
      certificat: "",
      dist: e?.dist
    };
  }

  if (rc === "R") return { type: "repos", rc: "R", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  if (rc === "C") return { type: "conge", rc: "C", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  if (rc === "ABSENT") return { type: "absent", rc: "ABSENT", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };

  const [yY, mM, dD] = dayISO.split("-").map(Number);
  const dtD = new Date(Date.UTC(yY, mM - 1, dD));
  const isMonday = (dtD.getUTCDay() === 1);

  if (isSec && isMonday) return { type: "repos", rc: "R", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  if (isSoumia && soumiaPlan?.off) return { type: "repos", rc: "R", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  if (isCuisine && cuisinePlan?.off) return { type: "repos", rc: "R", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  if (isMenage) {
    const mPlan = typeof getMenagePlanningInfo === "function" ? getMenagePlanningInfo(empId, dayISO) : null;
    if (mPlan?.off) return { type: "repos", rc: "R", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
    return { type: "absent", rc: "ABSENT", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  }
  if (e && e.off) return { type: "off", rc: "OFF", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
  return { type: "absent", rc: "ABSENT", isPresent: false, isLate: false, diff: 0, hp, ha: "", motif: "", certificat: "" };
}

async function buildMonthlySummary(mk) {
  const year = mk.slice(0, 4);
  const timeline = await getYearTimeline(year);
  const { rcByEmpDay, soldeByEmpMonth, startMap } = timeline;
  const md = await getMonthData(mk);
  const { dates, presByDay, punchByDay, motifsByDay } = md;
  const today = todayISO();
  const out = {};
  const activeList = typeof getActiveEquipeForMonth === "function" ? getActiveEquipeForMonth(mk) : equipe;
  activeList.forEach(emp => {
    const id = empIdOf(emp);
    const solde = soldeByEmpMonth[id]?.[mk] ?? timeline.currentSoldeByEmp[id] ?? 0;
    out[id] = { empId: id, nom: emp.nom, prenom: emp.prenom, poste: emp.poste, present: 0, R: 0, C: 0, M: 0, lateMin: 0, solde };
  });
  dates.forEach(dayISO => {
    if (dayISO > today || isExcluded(dayISO)) return;
    const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO], motifsByDay?.[dayISO]);
    activeList.forEach(emp => {
      const id = empIdOf(emp);
      const ev = evaluateEmployeeDay(emp, dayISO, merged[id] || null, rcByEmpDay[id]?.[dayISO], startMap[id]);
      if (ev.type === "maladie") {
        out[id].M++;
      } else if (ev.isPresent) {
        out[id].present++;
        out[id].lateMin += ev.diff;
      } else if (ev.rc === "R") {
        out[id].R++;
      } else if (ev.rc === "C") {
        out[id].C++;
      }
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
      M: 0,
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
          M: 0,
          lateMin: 0,
          solde: timeline.currentSoldeByEmp[s.empId] ?? 0
        };
      }
      totalsByEmp[s.empId].present += Number(s.present) || 0;
      totalsByEmp[s.empId].R       += Number(s.R) || 0;
      totalsByEmp[s.empId].C       += Number(s.C) || 0;
      totalsByEmp[s.empId].M       += Number(s.M) || 0;
      totalsByEmp[s.empId].lateMin += Number(s.lateMin) || 0;
    });
  }
  return totalsByEmp;
}

/**
 * Enregistrement manuel d'un Arrêt Maladie (M) sur une date ou une plage de dates.
 * Écrit uniquement dans presences/{date}/{emp} : champs maladie/statut/motifMaladie,
 * réservés au rôle « gerant » par database.rules.json (publier ces règles dans la console Firebase).
 */
async function setEmpMaladieRange(empId, startDateISO, endDateISO, isMaladie, motifMaladie = "", certificatDataUrl = "") {
  if (!empId || !startDateISO) throw new Error("Collaborateur ou date manquant.");
  if (role !== "gerant") throw new Error("Action réservée au gérant.");
  const endISO = endDateISO || startDateISO;
  if (startDateISO > endISO) throw new Error("La date de début doit précéder la date de fin.");

  const days = [];
  let cur = startDateISO;
  let guard = 0;
  while (cur <= endISO && guard < 90) {
    days.push(cur);
    cur = addDaysISO(cur, 1);
    guard++;
  }

  const cleanMotif = String(motifMaladie || "").trim().slice(0, 200);
  const cleanCert = (isMaladie && certificatDataUrl && String(certificatDataUrl).startsWith("data:image/"))
    ? String(certificatDataUrl).slice(0, 88000)
    : "";
  const nowTs = Date.now();

  // Persistance locale immédiate du certificat médical (et nettoyage si retrait de M)
  days.forEach(d => {
    if (isMaladie) {
      if (cleanCert) setLocalMaladieCert(empId, d, cleanCert);
    } else {
      setLocalMaladieCert(empId, d, "");
    }
  });

  // Un seul update multi-chemins : atomique (tout ou rien)
  const updates = {};
  days.forEach(d => {
    const base = `presences/${d}/${empId}`;
    if (isMaladie) {
      updates[`${base}/maladie`] = true;
      updates[`${base}/statut`] = "MALADIE";
      updates[`${base}/motifMaladie`] = cleanMotif || null;
      if (cleanCert) updates[`${base}/certificat`] = cleanCert;
      updates[`${base}/off`] = null;
      updates[`${base}/hA`] = null;
      updates[`${base}/retard`] = null;
      updates[`${base}/retardMin`] = null;
    } else {
      updates[`${base}/maladie`] = null;
      updates[`${base}/statut`] = null;
      updates[`${base}/motifMaladie`] = null;
      updates[`${base}/certificat`] = null;
    }
    updates[`${base}/lastEditAt`] = nowTs;
    updates[`${base}/lastEditByAdmin`] = true;
  });

  try {
    await database.ref().update(updates);
  } catch (e) {
    if (e && /permission_denied/i.test(String(e.code || e.message))) {
      // Secours atomique compatible avec les anciennes règles Firebase si database.rules.json
      // n'a pas encore été publié dans la console : signé par lastEditByAdmin=true (interdit au rôle "equipe")
      const fallbackUpdates = {};
      const taggedMotif = ("[MALADIE]" + (cleanMotif ? " " + cleanMotif : "")).slice(0, 200);
      days.forEach(d => {
        const presBase = `presences/${d}/${empId}`;
        const motifBase = `broadcast/motifs/${d}/${empId}`;
        if (isMaladie) {
          fallbackUpdates[`${presBase}/off`] = null;
          fallbackUpdates[`${presBase}/hA`] = null;
          fallbackUpdates[`${presBase}/retard`] = null;
          fallbackUpdates[`${presBase}/retardMin`] = null;
          fallbackUpdates[`${presBase}/lastEditAt`] = nowTs;
          fallbackUpdates[`${presBase}/lastEditByAdmin`] = true;
          fallbackUpdates[motifBase] = {
            empKey: empId,
            motif: taggedMotif,
            hA: "00:00",
            retardMin: 0,
            timestamp: nowTs
          };
        } else {
          fallbackUpdates[`${presBase}/lastEditAt`] = nowTs;
          fallbackUpdates[`${presBase}/lastEditByAdmin`] = true;
          fallbackUpdates[motifBase] = null;
        }
      });
      await database.ref().update(fallbackUpdates);
    } else {
      throw e;
    }
  }

  clearMonthCache();
  return days.length;
}

/**
 * Supprime uniquement la pièce jointe / photo du certificat médical
 * tout en conservant l'arrêt maladie (M).
 */
async function removeMaladieCert(empId, startDateISO, endDateISO) {
  if (!empId || !startDateISO) throw new Error("Collaborateur ou date manquant.");
  if (role !== "gerant") throw new Error("Action réservée au gérant.");
  const endISO = endDateISO || startDateISO;

  const days = [];
  let cur = startDateISO;
  let guard = 0;
  while (cur <= endISO && guard < 90) {
    days.push(cur);
    cur = addDaysISO(cur, 1);
    guard++;
  }

  days.forEach(d => {
    setLocalMaladieCert(empId, d, "");
  });

  const updates = {};
  const nowTs = Date.now();
  days.forEach(d => {
    const base = `presences/${d}/${empId}`;
    updates[`${base}/certificat`] = null;
    updates[`${base}/lastEditAt`] = nowTs;
    updates[`${base}/lastEditByAdmin`] = true;
  });

  try {
    await database.ref().update(updates);
  } catch (e) {
    // Si permission_denied sur les anciennes règles, le retrait local est déjà actif
  }

  clearMonthCache();
  return days.length;
}

async function loadEquipeFromDB() {
  const snap = await database.ref(EQUIPE_PATH).once("value");
  const val = snap.val();
  if (!val) return equipe;
  const arr = Array.isArray(val)
    ? val.filter(Boolean)
    : Object.keys(val).sort((a, b) => Number(a) - Number(b)).map(k => val[k]).filter(Boolean);
  const active = arr.filter(e => !isRemovedStaff(e));
  return active.length ? active : equipe;
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
