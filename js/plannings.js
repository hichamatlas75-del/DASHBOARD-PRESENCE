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

// ─────────────────────────────────────────────────────────────────────────
// GESTION DES PHOTOS DES COLLABORATEURS
// ─────────────────────────────────────────────────────────────────────────

const StaffPhotoService = (() => {
  const PHOTO_MAP = {
    // Cuisine
    "BELQASSE_KHAOULA": "images/BELQASIM_KHAOULA.jpg",
    "BELQASIM_KHAOULA": "images/BELQASIM_KHAOULA.jpg",
    "BELQASSE": "images/BELQASIM_KHAOULA.jpg",
    "BELQASIM": "images/BELQASIM_KHAOULA.jpg",
    "BOUCHNAK_NAOUAL": "images/BOUCHNAK_NAOUAL.jpg",
    "BOUCHNAK": "images/BOUCHNAK_NAOUAL.jpg",
    "BOURAHMA_ANAS": "images/BOURAHMA_ANAS.jpg",
    "BOURAHMA": "images/BOURAHMA_ANAS.jpg",
    "IDRISSI_SAAD": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "IDRISSI_OUDGHRI_SAAD": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "IDRISSI_OUDGHRISSAAD": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "IDRISSI": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "LEMSSIEH_JAWAD": "images/LAMSSIAH_JAOUAD.jpg",
    "LAMSSIAH_JAOUAD": "images/LAMSSIAH_JAOUAD.jpg",
    "LEMSSIEH": "images/LAMSSIAH_JAOUAD.jpg",
    "LAMSSIAH": "images/LAMSSIAH_JAOUAD.jpg",
    "MAJDOUB_JIHANE": "images/MAJDOUB_JIHANE.jpg",
    "MAJDOUB": "images/MAJDOUB_JIHANE.jpg",
    "MOUJAHID_IMANE": "images/MOUJAHID_IMANE.jpg",
    "MOUJAHID": "images/MOUJAHID_IMANE.jpg",
    "ZAIR_FATIMA": "images/ZAIR_FATIMA.jpg",
    "ZAIR": "images/ZAIR_FATIMA.jpg",

    // Service
    "ALAOUI_LAZIZ": "images/HAMID_ALAOUI_ABDELAZIZ.jpg",
    "HAMID_ALAOUI_ABDELAZIZ": "images/HAMID_ALAOUI_ABDELAZIZ.jpg",
    "ALAOUI": "images/HAMID_ALAOUI_ABDELAZIZ.jpg",
    "HATTAF_MOHAMED": "images/HATTAF_MOHAMMED.jpg",
    "HATTAF_MOHAMMED": "images/HATTAF_MOHAMMED.jpg",
    "HATIAF_MOHAMMED": "images/HATTAF_MOHAMMED.jpg",
    "HATTAF": "images/HATTAF_MOHAMMED.jpg",
    "HIDARA_YOUSSEF": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "HIDARA_LACHKAR_YOUSSEF": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "HIDARA-LACHKAR_YOUSSEF": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "HIDARA": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "KAFOUNI_ZAKARIAE": "images/KAFOUNI_ZAKARIAE.jpg",
    "KAFQUNI_ZAKARIAE": "images/KAFOUNI_ZAKARIAE.jpg",
    "KAFOUNI": "images/KAFOUNI_ZAKARIAE.jpg",
    "KTAMI_EL_MOKHTAR": "images/Mokhtar.jpg",
    "EL_MOKHTAR": "images/Mokhtar.jpg",
    "MOKHTAR": "images/Mokhtar.jpg",
    "KTAMI": "images/Mokhtar.jpg",
    "MOHSINE_YOUNESS": "images/MOHSSINE_YOUNESS.jpg",
    "MOHSSINE_YOUNESS": "images/MOHSSINE_YOUNESS.jpg",
    "MOHSINE": "images/MOHSSINE_YOUNESS.jpg",
    "MOHSSINE": "images/MOHSSINE_YOUNESS.jpg",

    // Caisse
    "BENKHADA_ABDESLAM": "images/BENKHADA_ABDESSLAM.jpg",
    "BENKHADA_ABDESSLAM": "images/BENKHADA_ABDESSLAM.jpg",
    "BENKHADA_ABDELSSAM": "images/BENKHADA_ABDESSLAM.jpg",
    "BENKHADA": "images/BENKHADA_ABDESSLAM.jpg",
    "ENNHAILI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN_NHAILI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN_NHAJLI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN-NHAILI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN-NHAJLI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "NHAILI": "images/EN-NHAILI_SOUMIA.jpg",
    "NHAJLI": "images/EN-NHAILI_SOUMIA.jpg",
    "SALIL_HOUDA": "images/SALIL_HOUDA.jpg",
    "SALIH_HOUDA": "images/SALIL_HOUDA.jpg",
    "SALIL": "images/SALIL_HOUDA.jpg",
    "SALIH": "images/SALIL_HOUDA.jpg",

    // Bar / Autres
    "EL_KOBBI_MOSTAFA": "images/EL_KOBBI_MOSTAFA.jpg",
    "ELKOBBI_MOSTAFA": "images/EL_KOBBI_MOSTAFA.jpg",
    "KOBBI": "images/EL_KOBBI_MOSTAFA.jpg",
    "EL_MOBARAKI_MOHAMED": "images/EL_MOBARAKI_MOHAMED.jpg",
    "ELMOBARAKI_MOHAMED": "images/EL_MOBARAKI_MOHAMED.jpg",
    "MOBARAKI": "images/EL_MOBARAKI_MOHAMED.jpg",
    "ELGORRAMY_SOUAD": "images/ELGORRAMY_SOUAD.jpg",
    "EL_GORRAMY_SOUAD": "images/ELGORRAMY_SOUAD.jpg",
    "GORRAMY": "images/ELGORRAMY_SOUAD.jpg",
    "CHKAIRI_YOUSSEF": "images/CHKAIRI_YOUSSEF.jpg",
    "CH_KAIRI_YOUSSEF": "images/CHKAIRI_YOUSSEF.jpg",
    "CHKAIRI": "images/CHKAIRI_YOUSSEF.jpg",
    "JIRA_MOHAMED": "images/JIRA_MOHAMED.jpg",
    "JRA_MOHAMED": "images/JIRA_MOHAMED.jpg",
    "JIRA": "images/JIRA_MOHAMED.jpg",
    "JRA": "images/JIRA_MOHAMED.jpg",
    "KHALOUQ_RACHID": "images/KHALOUQ_RACHID.jpg",
    "KHALOUQ": "images/KHALOUQ_RACHID.jpg",
    "QUASSIR_HICHAM": "images/QUASSIR_HICHAM.jpg",
    "OUASSIR_HICHAM": "images/QUASSIR_HICHAM.jpg",
    "QUASSIR": "images/QUASSIR_HICHAM.jpg",
    "OUASSIR": "images/QUASSIR_HICHAM.jpg",
    "SBAI_HAKIMA": "images/SBAI_HAKIMA.jpg",
    "SBAI": "images/SBAI_HAKIMA.jpg",
    "WALID": "images/WALID.jpg",
    "BAJJOU": "images/BAJJOU.jpeg",
    "FOUZIA": "images/FOUZIA.jpg",
    "FOUZIA6ZHAR": "images/FOUZIA6ZHAR.jpg",
    "FOUZIA_ZHAR": "images/FOUZIA6ZHAR.jpg",
    "FOUZIA_EZHAR": "images/FOUZIA6ZHAR.jpg"
  };

  function normalize(str) {
    return String(str || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function simplify(str) {
    return normalize(str)
      .replace(/SS/g, "S")
      .replace(/MM/g, "M")
      .replace(/TT/g, "T")
      .replace(/LL/g, "L")
      .replace(/BB/g, "B")
      .replace(/DD/g, "D")
      .replace(/FF/g, "F")
      .replace(/OU/g, "U")
      .replace(/_/g, "");
  }

  function getInitials(name) {
    if (!name) return "GC";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getPhotoUrl(name) {
    if (!name) return null;
    const clean = normalize(name);
    if (PHOTO_MAP[clean]) return PHOTO_MAP[clean];

    const simpleClean = simplify(clean);
    for (const [key, url] of Object.entries(PHOTO_MAP)) {
      if (simplify(key) === simpleClean) return url;
    }

    for (const [key, url] of Object.entries(PHOTO_MAP)) {
      if (clean.includes(key) || key.includes(clean)) return url;
    }

    const words = clean.split("_").filter(w => w.length >= 4);
    for (const w of words) {
      if (PHOTO_MAP[w]) return PHOTO_MAP[w];
      const sw = simplify(w);
      for (const [key, url] of Object.entries(PHOTO_MAP)) {
        if (simplify(key).includes(sw) || sw.includes(simplify(key))) {
          return url;
        }
      }
    }

    return null;
  }

  return { getPhotoUrl, getInitials, normalize };
})();

function getStaffAvatarHtml(nom, prenom, size = 'md') {
  const fullName = `${nom || ''} ${prenom || ''}`.trim();
  const photoUrl = StaffPhotoService.getPhotoUrl(fullName) || StaffPhotoService.getPhotoUrl(nom);
  const initials = StaffPhotoService.getInitials(fullName || nom);

  let dimClass = 'w-9 h-9 text-[11px]';
  if (size === 'sm') dimClass = 'w-7 h-7 text-[9px]';
  if (size === 'lg') dimClass = 'w-12 h-12 text-[14px]';

  if (photoUrl) {
    return `<div class="relative shrink-0 ${dimClass}">
      <img src="${escAttr(photoUrl)}" alt="${escAttr(nom)}" loading="lazy" class="staff-avatar ${dimClass}" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" />
      <div class="staff-avatar-fallback ${dimClass}" style="display:none">${esc(initials)}</div>
    </div>`;
  }
  return `<div class="staff-avatar-fallback ${dimClass} shrink-0">${esc(initials)}</div>`;
}

