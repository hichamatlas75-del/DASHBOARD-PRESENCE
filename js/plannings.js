/**
 * Logique Métier & Plannings de Shifts
 * Direction Hub • Grey Corner
 */

// ─── PLANNING FIXE CUISINE (Hebdomadaire) ───
// 0 = Dimanche, 1 = Lundi, 2 = Mardi, 3 = Mercredi, 4 = Jeudi, 5 = Vendredi, 6 = Samedi
const PLANNING_CUISINE = {
  1: { // Lundi
    NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
    KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
    FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
    JIHANE:  { hP: "12:00", off: false, shift: "12h — 21h" },
    IMANE:   { hP: "",      off: true,  shift: "OFF" },
    ANAS:    { hP: "14:00", off: false, shift: "14h — F.S" },
    JAWAD:   { hP: "",      off: true,  shift: "OFF" },
    SAAD:    { hP: "14:00", off: false, shift: "14h — F.S" }
  },
  2: { // Mardi
    NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
    KHAOULA: { hP: "",      off: true,  shift: "OFF" },
    FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
    JIHANE:  { hP: "15:00", off: false, shift: "15h — F.S" },
    IMANE:   { hP: "07:00", off: false, shift: "07h — 14h" },
    ANAS:    { hP: "12:00", off: false, shift: "12h — 21h" },
    JAWAD:   { hP: "12:00", off: false, shift: "12h — 15h / 17h - F.S" },
    SAAD:    { hP: "",      off: true,  shift: "OFF" }
  },
  3: { // Mercredi
    NAOUAL:  { hP: "",      off: true,  shift: "OFF" },
    KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
    FATIMA:  { hP: "",      off: true,  shift: "OFF" },
    JIHANE:  { hP: "14:00", off: false, shift: "14h — F.S" },
    IMANE:   { hP: "07:00", off: false, shift: "07h — 14h" },
    ANAS:    { hP: "",      off: true,  shift: "OFF" },
    JAWAD:   { hP: "15:00", off: false, shift: "15h — F.S" },
    SAAD:    { hP: "12:00", off: false, shift: "12h — 15h / 17h - F.S" }
  },
  4: { // Jeudi
    NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
    KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
    FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
    JIHANE:  { hP: "",      off: true,  shift: "OFF" },
    IMANE:   { hP: "12:00", off: false, shift: "12h — 21h" },
    ANAS:    { hP: "15:00", off: false, shift: "15h — F.S" },
    JAWAD:   { hP: "12:00", off: false, shift: "12h — 21h" },
    SAAD:    { hP: "14:00", off: false, shift: "14h — F.S" }
  },
  5: { // Vendredi
    NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
    KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
    FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
    JIHANE:  { hP: "12:00", off: false, shift: "12h — 15h / 17h - F.S" },
    IMANE:   { hP: "12:00", off: false, shift: "12h — 21h" },
    ANAS:    { hP: "13:00", off: false, shift: "13h — F.S" },
    JAWAD:   { hP: "14:00", off: false, shift: "14h — F.S" },
    SAAD:    { hP: "15:00", off: false, shift: "15h — F.S" }
  },
  6: { // Samedi
    NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
    KHAOULA: { hP: "07:00", off: false, shift: "07h — 15h" },
    FATIMA:  { hP: "07:00", off: false, shift: "07h — 15h" },
    JIHANE:  { hP: "14:00", off: false, shift: "14h — F.S" },
    IMANE:   { hP: "10:00", off: false, shift: "10h — 18h" },
    ANAS:    { hP: "14:00", off: false, shift: "14h — F.S" },
    JAWAD:   { hP: "14:00", off: false, shift: "14h — F.S" },
    SAAD:    { hP: "13:00", off: false, shift: "13h — F.S" }
  },
  0: { // Dimanche
    NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
    KHAOULA: { hP: "07:00", off: false, shift: "07h — 15h" },
    FATIMA:  { hP: "07:00", off: false, shift: "07h — 15h" },
    JIHANE:  { hP: "14:00", off: false, shift: "14h — F.S" },
    IMANE:   { hP: "10:00", off: false, shift: "10h — 18h" },
    ANAS:    { hP: "14:00", off: false, shift: "14h — F.S" },
    JAWAD:   { hP: "14:00", off: false, shift: "14h — F.S" },
    SAAD:    { hP: "14:00", off: false, shift: "14h — 21h" }
  }
};

function matchCuisineStaffKey(nameOrKey) {
  if (!nameOrKey) return null;
  const s = String(nameOrKey).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("NAOUAL") || s.includes("BOUCHNAK")) return "NAOUAL";
  if (s.includes("KHAOULA") || s.includes("BELQAS")) return "KHAOULA";
  if (s.includes("FATIMA") || s.includes("ZAIR")) return "FATIMA";
  if (s.includes("JIHANE") || s.includes("MAJDOUB")) return "JIHANE";
  if (s.includes("IMANE") || s.includes("MOUJAHID")) return "IMANE";
  if (s.includes("ANAS") || s.includes("BOURAHMA")) return "ANAS";
  if (s.includes("JAWAD") || s.includes("JAOUAD") || s.includes("LEMSSIEH") || s.includes("LAMSSIAH")) return "JAWAD";
  if (s.includes("SAAD") || s.includes("IDRISSI")) return "SAAD";
  return null;
}

function getCuisinePlanning(empKeyOrName, dateISO) {
  if (!dateISO) return null;
  const member = matchCuisineStaffKey(empKeyOrName);
  if (!member) return null;
  const [yy, mm, dd] = String(dateISO).split("-").map(Number);
  if (!yy || !mm || !dd) return null;
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  const dayOfWeek = dt.getUTCDay();
  return PLANNING_CUISINE[dayOfWeek]?.[member] || null;
}

// ─── PLANNING FIXE SOUMIA (CAISSE) ───
function isSoumiaStaff(idOrName) {
  if (!idOrName) return false;
  const s = String(idOrName).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s.includes("SOUMIA") || s.includes("NHAILI") || s.includes("NHAJLI") || s.includes("ENNHAILI");
}

function getSoumiaPlanning(dateISO) {
  if (!dateISO) return null;
  const [yy, mm, dd] = String(dateISO).split("-").map(Number);
  if (!yy || !mm || !dd) return null;
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  const dayOfWeek = dt.getUTCDay();
  if (dayOfWeek === 2) {
    return { off: true, hP: null, shift: "OFF" };
  }
  return { off: false, hP: "09:00", shift: "09:00" };
}

// ─── PLANNING FIXE CAISSE (SALIL HOUDA & BENKHADA ABDESLAM) ───
function isSalilStaff(idOrName) {
  if (!idOrName) return false;
  const s = String(idOrName).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s.includes("SALIL") || s.includes("SALIH") || s.includes("HOUDA");
}

function isBenkhadaStaff(idOrName) {
  if (!idOrName) return false;
  const s = String(idOrName).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s.includes("BENKHADA") || s.includes("ABDESLAM") || s.includes("ABDESSLAM") || s.includes("ABDELSSAM");
}

function getCaisseAlternance(idOrName, dateISO) {
  if (!dateISO) return null;
  const [yy, mm, dd] = String(dateISO).split("-").map(Number);
  if (!yy || !mm || !dd) return null;
  const isSal = isSalilStaff(idOrName);
  const isBen = isBenkhadaStaff(idOrName);
  if (!isSal && !isBen) return null;

  // Ancre : 24 Septembre 2026 (mois 8 = Septembre)
  const dAnchor = Date.UTC(2026, 8, 24);
  const dTarget = Date.UTC(yy, mm - 1, dd);
  const diffDays = Math.round((dTarget - dAnchor) / 86400000);
  const mod = ((diffDays % 2) + 2) % 2;

  if (mod === 0) {
    return isSal
      ? { hP: "07:30", off: false, shift: "07:30" }
      : { hP: "15:00", off: false, shift: "15:00" };
  } else {
    return isSal
      ? { hP: "15:00", off: false, shift: "15:00" }
      : { hP: "07:30", off: false, shift: "07:30" };
  }
}

function isMenageStaff(empOrId) {
  if (!empOrId) return false;
  if (typeof empOrId === "object") {
    const p = String(empOrId.poste || "").toUpperCase();
    return p === "MENAGE" || p === "MÉNAGE";
  }
  const emp = getEmpById(empOrId);
  if (emp && emp.poste) {
    const p = String(emp.poste).toUpperCase();
    return p === "MENAGE" || p === "MÉNAGE";
  }
  const s = String(empOrId).toUpperCase();
  return s.includes("SBAI") || s.includes("ELGORRAMY") || s.includes("ABOUARSA");
}

function getEffectiveHP(hp, empId, dateISO) {
  if (hp) return hp;
  const emp = getEmpById(empId);
  if (emp && (emp.poste === "SECURITE" || emp.poste === "SÉCURITÉ")) return "09:00";
  if (dateISO) {
    if (isSoumiaStaff(empId)) {
      const sp = getSoumiaPlanning(dateISO);
      if (sp && !sp.off && sp.hP) return sp.hP;
    }
    if (isSalilStaff(empId) || isBenkhadaStaff(empId)) {
      const cp = getCaisseAlternance(empId, dateISO);
      if (cp && cp.hP) return cp.hP;
    }
    if (emp && emp.poste === "CUISINE") {
      const cp = getCuisinePlanning(empId, dateISO);
      if (cp && !cp.off && cp.hP) return cp.hP;
    }
  }
  return "";
}

function getTimeDiff(a, p, id, dateISO) {
  if (!a) return 0;
  if (id && (haOnlyIds.has(id) || isMenageStaff(id))) return 0;
  const effectiveP = getEffectiveHP(p, id, dateISO);
  if (!effectiveP) return 0;
  const [ha, ma] = a.split(':').map(Number), [hp, mp] = effectiveP.split(':').map(Number);
  const d = (ha * 60 + ma) - (hp * 60 + mp);
  return d > 0 ? d : 0;
}

function diffFromEntry(entry, empId, dateISO) {
  return entry ? getTimeDiff(entry.hA, entry.hP, empId, dateISO) : 0;
}

function getStatusClass(diff, isOff, hasArrived) {
  if (hasArrived) {
    if (diff <= 0)  return 'status-green';
    if (diff < 30)  return 'status-orange';
    if (diff < 60)  return 'status-red';
    return 'status-flash';
  }
  if (isOff) return 'status-off';
  return '';
}

function getDotColor(diff, isOff, hasArrived) {
  if (hasArrived) {
    if (diff <= 0)  return 'var(--ok)';
    if (diff < 30)  return 'var(--amber)';
    return 'var(--crit)';
  }
  if (isOff) return 'rgba(148,163,184,.65)';
  return 'rgba(255,255,255,.22)';
}

function classifyOffDay(empId, dayISO, weekRC) {
  if (noReposIds.has(empId)) return "C";
  const wk = weekStartMondayISO(dayISO);
  weekRC[wk] ||= {};
  weekRC[wk][empId] ||= 0;
  if (weekRC[wk][empId] === 0) { weekRC[wk][empId] = 1; return "R"; }
  return "C";
}
