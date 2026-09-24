/**
 * Configuration, Initialisation Firebase et Utilitaires Globaux
 * Direction Hub • Grey Corner
 */

const firebaseConfig = {
  apiKey: "AIzaSyC5al_6xWbJC8S0FAvaEnRmx9BvYtGgnAM",
  authDomain: "grey-corner-presence.firebaseapp.com",
  databaseURL: "https://grey-corner-presence-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "grey-corner-presence",
  storageBucket: "grey-corner-presence.firebasestorage.app",
  messagingSenderId: "730206093359",
  appId: "1:730206093359:web:59e3c145120807f29e46da",
  measurementId: "G-4HCKPGNED7"
};

// Initialisation Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const auth     = firebase.auth();

// Constantes
const EQUIPE_PATH        = "settings/equipe";
const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzL2egvy20cb5ItNaA5P1hZHRe6L2cTyzq2mMVgN0R8pn563N9DwpFKQ5AhG2VK59y9/exec";
const SHEETS_SECRET      = "GC_SECRET_2026";
const EXCL_START         = "2026-01-01";
const EXCL_END           = "2026-01-31";

const POSTES_ORDER = ['SERVICE', 'BAR', 'CUISINE', 'CAISSE', 'MENAGE', 'SECURITE', 'ECONOMAT'];
const haOnlyIds    = new Set(["SBAI_HAKIMA", "ELGORRAMY_ANISSA", "ELGORRAMY_SOUAD", "ABOUARSA_EDDRISSIA"]);
const noReposIds   = new Set(["SALIL_HOUDA", "BENKHADA_ABDESLAM"]);

/* ─── Utilitaires sécurité & sanitisation ─── */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escAttr(s) { return esc(s); }

function safeTime(t) {
  const s = String(t ?? "").trim();
  const core = s.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1');
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(core)) return "";
  const [h, m] = core.split(':');
  return h.padStart(2, '0') + ":" + m;
}

function escapeCSV(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* ─── Utilitaires de dates (ISO, GMT, Format FR) ─── */
function parseISO(iso) { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; }
function toISO(y, m, d) { return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

function addDaysISO(iso, delta) {
  const { y, m, d } = parseISO(iso);
  const t = Date.UTC(y, m - 1, d) + delta * 86400000;
  const dt = new Date(t);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function weekStartMondayISO(iso) {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  return addDaysISO(iso, -(dow === 0 ? 6 : dow - 1));
}

function todayISO() {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'GMT', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function fmtFR(iso) {
  if (!iso || !iso.includes("-")) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function monthKeyFromISO(iso) { return (iso || "").slice(0, 7); }
function isoFromMonthKey(mk) { return mk + "-01"; }

function titleCase(s) {
  const t = String(s || "").toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

function isExcluded(d) { return d >= EXCL_START && d <= EXCL_END; }

/* ─── Identifiants & gestion équipe ─── */
function normName(s) {
  return (s || "").trim().toUpperCase().replace(/\s+/g, ' ').replace(/['']/g, "'");
}

function makeEmpId(nom, prenom) {
  return `${normName(nom)}_${normName(prenom)}`.replace(/\s+/g, '_');
}

function empIdOf(emp) {
  const nom    = String(emp?.nom    || "").trim().toUpperCase().replace(/\s+/g, "_");
  const prenom = String(emp?.prenom || "").trim().toUpperCase().replace(/\s+/g, "_");
  return `${nom}_${prenom}`;
}

let equipe = [
  { nom: 'BOUCHNAK',   prenom: 'NAOUAL',    poste: 'CUISINE' },
  { nom: 'ALAOUI',     prenom: 'LAZIZ',     poste: 'SERVICE' },
  { nom: 'BELQASSE',   prenom: 'KHAOULA',   poste: 'CUISINE' },
  { nom: 'BENKHADA',   prenom: 'ABDESLAM',  poste: 'CAISSE' },
  { nom: 'BOURAHMA',   prenom: 'ANAS',      poste: 'CUISINE' },
  { nom: 'CHKAIRI',    prenom: 'YOUSSEF',   poste: 'BAR' },
  { nom: 'ELKOBBI',    prenom: 'MOSTAFA',   poste: 'BAR' },
  { nom: 'ELGORRAMY',  prenom: 'ANISSA',    poste: 'MENAGE' },
  { nom: 'ELGORRAMY',  prenom: 'SOUAD',     poste: 'MENAGE' },
  { nom: 'ENNHAILI',   prenom: 'SOUMIA',    poste: 'CAISSE' },
  { nom: 'FILALI',     prenom: 'ABDERAFI',  poste: 'BAR' },
  { nom: 'HATTAF',     prenom: 'MOHAMED',   poste: 'SERVICE' },
  { nom: 'HIDARA',     prenom: 'YOUSSEF',   poste: 'SERVICE' },
  { nom: 'IDRISSI',    prenom: 'SAAD',      poste: 'CUISINE' },
  { nom: 'KAFOUNI',    prenom: 'ZAKARIAE',  poste: 'SERVICE' },
  { nom: 'KHALOUQ',    prenom: 'RACHID',    poste: 'BAR' },
  { nom: 'KTAMI',      prenom: 'EL MOKHTAR',poste: 'SERVICE' },
  { nom: 'LEMSSIEH',   prenom: 'JAWAD',     poste: 'CUISINE' },
  { nom: 'MAJDOUB',    prenom: 'JIHANE',    poste: 'CUISINE' },
  { nom: 'MOHSINE',    prenom: 'YOUNESS',   poste: 'SERVICE' },
  { nom: 'MOUJAHID',   prenom: 'IMANE',     poste: 'CUISINE' },
  { nom: 'SALIL',      prenom: 'HOUDA',     poste: 'CAISSE' },
  { nom: 'SBAI',       prenom: 'HAKIMA',    poste: 'MENAGE' },
  { nom: 'ZAIR',       prenom: 'FATIMA',    poste: 'CUISINE' }
];

function getEmpById(empId) {
  return equipe.find(e => empIdOf(e) === empId) || { nom: empId, prenom: "", poste: "", dateDebut: "" };
}

function setEquipe(next) {
  equipe = Array.isArray(next) ? next.slice() : [];
  if (typeof clearMonthCache === 'function') clearMonthCache();
}
