/**
 * Contrôleur Principal & Cycle de Vie de l'Application
 * Direction Hub • Grey Corner
 */

let currentMode       = 'day';
let role              = null;
let activePresRef     = null;
let activePunchRef    = null;
let presCache         = {};
let punchCache        = {};
let midnightTimer     = null;
let sheetsSyncRunning = false;

/* ─── Synchronisation Temps Réel Firebase ─── */

function detachRealtime() {
  try {
    if (activePresRef)  { activePresRef.off();  activePresRef = null; }
    if (activePunchRef) { activePunchRef.off(); activePunchRef = null; }
  } catch (e) {}
  presCache = {}; punchCache = {};
}

function mergedDayData() {
  return mergeDay(presCache || {}, punchCache || {});
}

function setSyncOK() {
  const syncLine = document.getElementById("syncLine");
  if (!syncLine) return;
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  syncLine.innerHTML = `<span class="sync-dot"></span>Temps réel ✅ (${hh}:${mm}:${ss} GMT)`;
}
function setSyncWaiting() { const el = document.getElementById("syncLine"); if (el) el.textContent = "Sync : connexion…"; }
function setSyncStatic(d) { const el = document.getElementById("syncLine"); if (el) el.textContent = `Lecture (${fmtFR(d)})`; }
function setSyncError()   { const el = document.getElementById("syncLine"); if (el) el.textContent = "Sync : erreur réseau ⚠️"; }

function attachRealtimeForDate(dayISO, realtime) {
  detachRealtime();
  if (realtime) setSyncWaiting(); else setSyncStatic(dayISO);

  activePresRef = database.ref('presences/' + dayISO);
  activePresRef.on('value', (snap) => {
    presCache = snap.val() || {};
    if (currentMode === "day") renderDayView(mergedDayData());
    if (realtime) setSyncOK();
  }, () => setSyncError());

  activePunchRef = database.ref('punches/' + dayISO);
  activePunchRef.on('value', (snap) => {
    punchCache = snap.val() || {};
    if (currentMode === "day") renderDayView(mergedDayData());
    if (realtime) setSyncOK();
  }, () => setSyncError());
}

function switchMode(mode, btn) {
  currentMode = mode;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('chartContainer').classList.toggle('hidden', mode !== 'report');
  document.getElementById('dayPickWrap').classList.toggle('hidden', mode !== 'day');
  document.getElementById('monthPickWrap').classList.toggle('hidden', mode === 'day');
  updateDashboard();
}

async function updateDashboard() {
  if (role !== "gerant") return;
  const dateInput = document.getElementById('dashDate');
  const seedISO   = dateInput.value || isoFromMonthKey(monthKeyFromISO(todayISO()));
  const mkSeed    = monthKeyFromISO(seedISO);
  const periodLabel = document.getElementById('periodLabel');
  if (periodLabel) periodLabel.textContent = `${mkSeed} · ${seedISO.slice(0, 4)}`;

  if (currentMode === "day") {
    const dayISO = currentDayForDayMode();
    const realtime = (dayISO === todayISO());
    attachRealtimeForDate(dayISO, realtime);
    renderDayView(mergedDayData());
    return;
  }

  detachRealtime();
  const dashBody = document.getElementById('dashBody');
  if (dashBody) {
    dashBody.innerHTML = loadingCard(
      currentMode === "report" ? "Chargement du bilan…" : "Chargement des tableaux R/C…"
    );
  }

  if (currentMode === "report") await renderReportView();
  else await renderRCView();
}

/* ─── Google Sheets Webhook Export ─── */

async function exportYear_ToSheets() {
  if (sheetsSyncRunning) return;
  sheetsSyncRunning = true;
  const syncLine  = document.getElementById("syncLine");
  const dateInput = document.getElementById("dashDate");
  try {
    const year = dateInput.value.slice(0, 4);
    if (syncLine) syncLine.textContent = "Sheets : calcul…";
    const totalsByEmp = await buildYearSummaryOptimized(year);
    const rows = Object.values(totalsByEmp)
      .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom))
      .map(t => ({
        year,
        employe: `${t.nom} ${titleCase(t.prenom)}`.trim(),
        poste: t.poste,
        presents: t.present,
        repos: t.R,
        conge: t.C,
        solde: t.solde ?? 0,
        retard: t.lateMin
      }));

    if (syncLine) syncLine.textContent = "Sheets : envoi…";
    const res = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify({ year, rows, secret: SHEETS_SECRET })
    });
    const raw = await res.text();
    let json;
    try { json = JSON.parse(raw); } catch (_) { throw new Error("Réponse non JSON : " + raw.slice(0, 300)); }
    if (json.ok) {
      if (syncLine) syncLine.innerHTML = `<span class="sync-dot"></span>Sheets mis à jour — ${json.written || 0} lignes (${year})`;
    } else {
      if (syncLine) syncLine.textContent = `⚠️ Sheets erreur : ${json.error || "inconnue"}`;
    }
  } catch (err) {
    console.error("Sheets export error:", err);
    if (syncLine) syncLine.textContent = `⚠️ Sheets : ${err.message || "connexion échouée"}`;
  } finally {
    sheetsSyncRunning = false;
  }
}

/* ─── Exports CSV & JSON ─── */

async function exportCSV_RC_Month() {
  const dateInput = document.getElementById('dashDate');
  const mk = monthKeyFromISO(dateInput.value);
  const summary = await buildMonthlySummary(mk);
  const header = ["Mois", "Employe", "Poste", "Presents", "ReposTotal", "CongeTotal", "SoldeRecup", "RetardMin"];
  const lines = [header.join(",")];
  Object.values(summary).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom)).forEach(s => {
    lines.push([mk, escapeCSV(`${s.nom} ${titleCase(s.prenom)}`), escapeCSV(s.poste), s.present, s.R, s.C, s.solde ?? 0, s.lateMin].join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `GC_RC_MOIS_${mk}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function exportCSV_RC_Year() {
  const dateInput = document.getElementById('dashDate');
  const year = dateInput.value.slice(0, 4);
  const totalsByEmp = await buildYearSummaryOptimized(year);
  const header = ["Annee", "Employe", "Poste", "PresentsTotal", "ReposTotal", "CongeCumuleAnnee", "SoldeRecupActuel", "RetardTotalMin"];
  const lines = [header.join(",")];
  Object.values(totalsByEmp).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom)).forEach(t => {
    lines.push([year, escapeCSV(`${t.nom} ${titleCase(t.prenom)}`.trim()), escapeCSV(t.poste), t.present, t.R, t.C, t.solde ?? 0, t.lateMin].join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `GC_RC_ANNEE_RESUME_${year}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function exportEquipeJSON() {
  let list = equipe;
  try { list = await loadEquipeFromDB(); } catch (e) {}
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GC_EQUIPE_${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ─── Administration Équipe ─── */

function fillDelEmpSelectByPoste(poste) {
  const sel = document.getElementById("delEmpSelect");
  if (!sel) return;
  if (!poste) { sel.innerHTML = `<option value="">Choisir poste d'abord</option>`; return; }
  const list = equipe.filter(e => e.poste === poste).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
  sel.innerHTML = list.length
    ? list.map(e => `<option value="${escAttr(empIdOf(e))}">${esc(e.nom)} ${esc(titleCase(e.prenom))}</option>`).join("")
    : `<option value="">Aucun collaborateur</option>`;
}

async function initStaffAdminUI() {
  document.getElementById("btnOpenStaffAdmin").onclick = () => openStaffAdmin();
  document.getElementById("btnExportEquipe").onclick    = () => exportEquipeJSON();

  const posteSelect = document.getElementById("delPosteSelect");
  if (posteSelect) {
    posteSelect.onchange = () => fillDelEmpSelectByPoste(posteSelect.value);
    fillDelEmpSelectByPoste("");
  }

  const btnAddStaff = document.getElementById("btnAddStaff");
  if (btnAddStaff) {
    btnAddStaff.onclick = async () => {
      const addMsg = document.getElementById("addMsg");
      addMsg.textContent = "";
      const nom       = normName(document.getElementById("addNom").value);
      const prenom    = normName(document.getElementById("addPrenom").value);
      const poste     = (document.getElementById("addPoste").value || "").trim().toUpperCase();
      const dateDebut = (document.getElementById("addDateDebut").value || "").trim();

      if (!nom || !prenom || !poste) { addMsg.textContent = "⚠️ Remplis NOM, Prénom et Poste."; return; }
      const id = makeEmpId(nom, prenom);
      if (equipe.some(e => empIdOf(e) === id)) { addMsg.textContent = "⚠️ Déjà existant."; return; }

      addMsg.textContent = "Ajout…";
      const next = equipe.slice();
      next.push({ nom, prenom, poste, dateDebut: dateDebut || "" });

      try {
        await saveEquipeToDB(next);
        setEquipe(next);
        addMsg.textContent = "✅ Ajouté.";
        document.getElementById("addNom").value = "";
        document.getElementById("addPrenom").value = "";
        document.getElementById("addDateDebut").value = "";
        closeStaffAdmin();
        updateDashboard();
      } catch (e) {
        addMsg.textContent = "⚠️ Erreur : " + (e?.message || "Permission denied");
      }
    };
  }

  const btnDeleteStaff = document.getElementById("btnDeleteStaff");
  if (btnDeleteStaff) {
    btnDeleteStaff.onclick = async () => {
      const delMsg = document.getElementById("delAnyMsg");
      delMsg.textContent = "";
      const empId = document.getElementById("delEmpSelect").value;
      if (!empId) { delMsg.textContent = "⚠️ Choisis un collaborateur."; return; }
      if (!confirm(`Confirmer suppression de ${empId} ?`)) return;
      delMsg.textContent = "Suppression…";
      const next = equipe.filter(e => empIdOf(e) !== empId);
      try {
        await saveEquipeToDB(next);
        setEquipe(next);
        delMsg.textContent = "✅ Supprimé.";
        fillDelEmpSelectByPoste(document.getElementById("delPosteSelect").value || "");
        closeStaffAdmin();
        updateDashboard();
      } catch (e) {
        delMsg.textContent = "⚠️ Erreur : " + (e?.message || "Permission denied");
      }
    };
  }
}

/* ─── Authentification & Permissions ─── */

async function fetchRole(uid) {
  const s = await database.ref("users/" + uid).once("value");
  return s.val() || null;
}

function showLoginUI(msg) {
  detachRealtime();
  role = null;
  if (midnightTimer) { clearInterval(midnightTimer); midnightTimer = null; }
  document.getElementById("appWrap")?.classList.add("hidden");
  document.getElementById("loginWrap")?.classList.remove("hidden");
  const loginMsg = document.getElementById("loginMsg");
  if (loginMsg) loginMsg.textContent = msg || "";
}

function showAppUI() {
  document.getElementById("loginWrap")?.classList.add("hidden");
  document.getElementById("appWrap")?.classList.remove("hidden");
  const roleLabel = document.getElementById("roleLabel");
  const syncLine  = document.getElementById("syncLine");
  if (roleLabel) roleLabel.textContent = role || "—";
  if (syncLine) syncLine.innerHTML = "Sync : en attente…";
}

document.getElementById("btnLogin")?.addEventListener('click', async () => {
  const email = (document.getElementById("loginEmail").value || "").trim();
  const pass  = (document.getElementById("loginPass").value || "").trim();
  const msgEl = document.getElementById("loginMsg");
  if (msgEl) msgEl.textContent = "";
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    showLoginUI("Identifiants invalides.");
  }
});

document.getElementById("btnLogout")?.addEventListener('click', async () => {
  if (midnightTimer) { clearInterval(midnightTimer); midnightTimer = null; }
  try { await auth.signOut(); } catch (e) {}
  location.reload();
});

auth.onAuthStateChanged(async (user) => {
  if (!user) { showLoginUI(""); return; }
  try {
    role = await fetchRole(user.uid);
    const isMasterGrt = (user.email || "").toLowerCase().includes("hicham");
    if (!role && isMasterGrt) {
      role = "gerant";
      try { await database.ref("users/" + user.uid).set("gerant"); } catch (_) {}
    }
    if (role !== "gerant") {
      if (isMasterGrt) {
        role = "gerant";
        try { await database.ref("users/" + user.uid).set("gerant"); } catch (_) {}
      } else {
        await auth.signOut();
        showLoginUI("Accès refusé : compte non gérant.");
        return;
      }
    }
  } catch (e) {
    if ((user.email || "").toLowerCase().includes("hicham")) {
      role = "gerant";
    } else {
      try { await auth.signOut(); } catch (_) {}
      showLoginUI("Erreur d'accès.");
      return;
    }
  }
  showAppUI();
  bootDashboard();
});

/* ─── Surveillance du Minuit (Changement de date & Resync avec Anti-doublon) ─── */

function startMidnightWatcher() {
  if (midnightTimer) clearInterval(midnightTimer);
  let lastDay = todayISO();
  midnightTimer = setInterval(async () => {
    const nowDay = todayISO();
    if (nowDay !== lastDay) {
      lastDay = nowDay;
      const mkToday = monthKeyFromISO(nowDay);
      const dayPicker   = document.getElementById('dayPicker');
      const monthPicker = document.getElementById('monthPicker');
      const dateInput   = document.getElementById('dashDate');
      const syncLine    = document.getElementById('syncLine');

      if (dayPicker)   dayPicker.value   = nowDay;
      if (monthPicker) monthPicker.value = mkToday;
      if (dateInput)   dateInput.value   = isoFromMonthKey(mkToday);

      clearMonthCache();
      if (syncLine) syncLine.textContent = "Sheets : resync après minuit…";
      try {
        await updateDashboard();
        // Protection anti-concurrence : éviter que plusieurs onglets ouverts n'envoient en même temps
        const lastSyncKey = `gc_last_sheets_sync_${nowDay}`;
        if (!localStorage.getItem(lastSyncKey)) {
          localStorage.setItem(lastSyncKey, String(Date.now()));
          await exportYear_ToSheets();
        }
      } catch (err) {
        console.error("Midnight resync error:", err);
        if (syncLine) syncLine.textContent = "⚠️ Sheets : erreur resync minuit";
      }
    }
  }, 30000);
}

/* ─── Démarrage du Tableau de Bord ─── */

async function bootDashboard() {
  const today       = todayISO();
  const mkToday     = monthKeyFromISO(today);
  const dayPicker   = document.getElementById('dayPicker');
  const monthPicker = document.getElementById('monthPicker');
  const dateInput   = document.getElementById('dashDate');

  if (dayPicker)   dayPicker.value   = today;
  if (monthPicker) monthPicker.value = mkToday;
  if (dateInput)   dateInput.value   = isoFromMonthKey(mkToday);

  dayPicker?.addEventListener('change', async () => { await updateDashboard(); });
  monthPicker?.addEventListener('change', async () => {
    const mk = monthPicker.value || mkToday;
    if (dateInput) dateInput.value = isoFromMonthKey(mk);
    clearMonthCache();
    await updateDashboard();
  });

  try {
    const list = await loadEquipeFromDB();
    setEquipe(list);
  } catch (e) {}

  await initStaffAdminUI();
  await updateDashboard();
  startMidnightWatcher();
}
