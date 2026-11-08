/**
 * Rendu de l Interface Utilisateur (Socle Commun, États Partagés & Utilitaires)
 * Direction Hub • Grey Corner
 */

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

