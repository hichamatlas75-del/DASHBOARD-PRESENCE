/**
 * Modals • Registre des Certificats, Calendrier RH, Historique, Équipe & Plannings
 * Direction Hub • Grey Corner
 */

function _modalMonthChange(newMk) {
  if (!_modalState) return;
  _modalState.mk = newMk;
  if (_modalState.mode === 'calendar') openCalendarModal(_modalState.nom, _modalState.prenom, newMk);
  else openHistory(_modalState.nom, _modalState.prenom, newMk);
}

window.switchModalTab = function(newMode) {
  if (!_modalState) return;
  if (newMode === 'calendar') {
    openCalendarModal(_modalState.nom, _modalState.prenom, _modalState.mk);
  } else {
    openHistory(_modalState.nom, _modalState.prenom, _modalState.mk);
  }
};

let _pendingMaladieCertDataUrl = "";

function compressCertImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture image impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format image non supporté"));
      img.onload = () => {
        const maxDim = 900;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.62);
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

window.handleMaladieCertFileChange = async function(inputEl) {
  const file = inputEl?.files?.[0];
  const labelEl = document.getElementById("modalMaladieCertLabel");
  if (!file) {
    _pendingMaladieCertDataUrl = "";
    if (labelEl) labelEl.textContent = "📷 Certificat";
    return;
  }
  try {
    if (labelEl) labelEl.textContent = "⏳ Compression…";
    _pendingMaladieCertDataUrl = await compressCertImageFile(file);
    if (labelEl) labelEl.textContent = "📎 Certificat prêt ✓";
  } catch (e) {
    _pendingMaladieCertDataUrl = "";
    if (labelEl) labelEl.textContent = "⚠️ Image invalide";
  }
};

window.closeCertViewerModal = function() {
  const m = document.getElementById("certViewerModal");
  if (!m) return;
  m.classList.remove("modal-active");
  m.classList.add("modal-closing");
  setTimeout(() => { m.classList.remove("modal-closing"); m.classList.add("hidden"); }, 200);
};

window.openMaladieCertPreview = function(empId, dayISO, endDayISO) {
  let cert = typeof getMaladieCertForEmpDay === "function" ? getMaladieCertForEmpDay(empId, dayISO) : "";
  if (!cert && typeof getLocalMaladieCert === "function") {
    cert = getLocalMaladieCert(empId, dayISO);
  }
  if (!cert && _modalState?.mk) {
    const md = monthDataCache.get(_modalState.mk);
    const merged = md ? mergeDay(md.presByDay?.[dayISO], md.punchByDay?.[dayISO], md.motifsByDay?.[dayISO]) : {};
    cert = merged?.[empId]?.certificat || "";
  }
  if (!cert) {
    alert("Aucune image de certificat trouvée pour ce jour.");
    return;
  }

  const modal = document.getElementById("certViewerModal");
  const imgEl = document.getElementById("certViewerImg");
  const titleEl = document.getElementById("certViewerTitle");
  const subEl = document.getElementById("certViewerSub");
  const btnDownload = document.getElementById("btnDownloadCert");
  const btnPrint = document.getElementById("btnPrintCert");
  const btnDelete = document.getElementById("btnDeleteCert");

  const emp = getEmpById(empId);
  const fullName = `${emp.nom || empId} ${titleCase(emp.prenom || "")}`.trim();
  const endDay = endDayISO || dayISO;
  const periodTxt = (dayISO === endDay) ? fmtFR(dayISO) : `du ${fmtFR(dayISO)} au ${fmtFR(endDay)}`;

  if (imgEl) imgEl.src = cert;
  if (titleEl) titleEl.textContent = fullName + (emp.poste ? ` · ${emp.poste}` : "");
  if (subEl) subEl.textContent = `Arrêt Maladie (M) · Période : ${periodTxt}`;

  if (btnDownload) {
    btnDownload.onclick = () => {
      const a = document.createElement("a");
      a.href = cert;
      a.download = `Certificat_${empId}_${dayISO}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  }

  if (btnPrint) {
    btnPrint.onclick = () => {
      const pWin = window.open("", "_blank");
      if (pWin) {
        pWin.document.write(`<!DOCTYPE html><html><head><title>Certificat · ${fullName}</title><style>body{margin:20px;text-align:center;font-family:sans-serif}img{max-width:100%;max-height:90vh;object-fit:contain}</style></head><body><h2>Certificat Médical · ${fullName}</h2><p>Arrêt maladie ${periodTxt}</p><img src="${cert}" onload="window.print();window.close();" /></body></html>`);
        pWin.document.close();
      }
    };
  }

  if (btnDelete) {
    btnDelete.onclick = () => window.confirmDeleteMaladieCert(empId, dayISO, endDay);
  }

  if (modal) {
    modal.classList.remove("hidden", "modal-closing");
    modal.classList.add("modal-active");
  }
};

window.confirmDeleteMaladieCert = async function(empId, startDay, endDay) {
  const emp = getEmpById(empId);
  const fullName = `${emp.nom || empId} ${titleCase(emp.prenom || "")}`.trim();
  const periodTxt = (startDay === endDay) ? `du ${fmtFR(startDay)}` : `du ${fmtFR(startDay)} au ${fmtFR(endDay)}`;
  if (!confirm(`Supprimer le certificat médical de ${fullName} (${periodTxt}) ?\n\nRemarque : L'arrêt maladie restera enregistré (M), seule la photo du certificat sera retirée.`)) {
    return;
  }
  try {
    if (typeof removeMaladieCert === "function") {
      await removeMaladieCert(empId, startDay, endDay);
    }
    if (typeof closeCertViewerModal === "function") closeCertViewerModal();
    const picker = document.getElementById("certRegistryMonthPicker");
    const mk = picker?.value || monthKeyFromISO(startDay);
    await renderCertificatesRegistry(mk);
    if (_modalState && _modalState.nom) {
      if (_modalState.mode === "calendar") await openCalendarModal(_modalState.nom, _modalState.prenom, _modalState.mk);
      else await openHistory(_modalState.nom, _modalState.prenom, _modalState.mk);
    }
    if (typeof currentMode !== "undefined") {
      if (currentMode === "rc") renderRCView();
      else if (currentMode === "report") renderReportView();
    }
  } catch (e) {
    alert("Erreur lors du retrait du certificat : " + (e?.message || "Erreur"));
  }
};

window.openCertificatesRegistryModal = async function(mk) {
  const dateInput = document.getElementById("dashDate");
  mk = mk || (dateInput?.value ? monthKeyFromISO(dateInput.value) : monthKeyFromISO(todayISO()));
  const m = document.getElementById("certRegistryModal");
  if (!m) return;
  m.classList.remove("hidden", "modal-closing");
  m.classList.add("modal-active");
  const picker = document.getElementById("certRegistryMonthPicker");
  if (picker) picker.value = mk;
  await renderCertificatesRegistry(mk);
};

window.closeCertificatesRegistryModal = function() {
  const m = document.getElementById("certRegistryModal");
  if (!m) return;
  m.classList.remove("modal-active");
  m.classList.add("modal-closing");
  setTimeout(() => { m.classList.remove("modal-closing"); m.classList.add("hidden"); }, 240);
};

window.handleRegistryAttachCert = async function(empId, startDay, endDay, inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  try {
    const parentBtn = inputEl.closest("label");
    if (parentBtn) parentBtn.innerHTML = "⏳ Compression…";
    const certDataUrl = await compressCertImageFile(file);
    await setEmpMaladieRange(empId, startDay, endDay, true, "", certDataUrl);
    const picker = document.getElementById("certRegistryMonthPicker");
    const mk = picker?.value || monthKeyFromISO(startDay);
    await renderCertificatesRegistry(mk);
    if (_modalState && _modalState.nom) {
      if (_modalState.mode === "calendar") await openCalendarModal(_modalState.nom, _modalState.prenom, _modalState.mk);
      else await openHistory(_modalState.nom, _modalState.prenom, _modalState.mk);
    }
  } catch (e) {
    alert("Erreur lors de l'ajout du certificat : " + (e?.message || "Erreur"));
  }
};

window.renderCertificatesRegistry = async function(mk) {
  const body = document.getElementById("certRegistryBody");
  if (!body) return;
  body.innerHTML = loadingCard("Recherche des certificats médicaux…");

  try {
    const records = await scanAllMaladieRecords(mk);
    if (!records.length) {
      body.innerHTML = `
        <div class="glass-card p-6 rounded-2xl text-center" style="background:rgba(244,63,94,.04);border-color:rgba(244,63,94,.18)">
          <div class="text-3xl mb-2">✨</div>
          <div class="hTitle text-lg">Aucun arrêt maladie enregistré</div>
          <p class="text-[11px] font-semibold text-slate-500 mt-1">
            Aucun collaborateur n'a d'arrêt maladie (M) posé pour le mois <b>${esc(mk)}</b>.
          </p>
        </div>`;
      return;
    }

    const nWithCert = records.filter(r => !!r.certificat).length;
    const nMissing = records.length - nWithCert;

    let html = `
      <div class="flex items-center justify-between gap-2 p-3 rounded-2xl mb-3" style="background:rgba(255,241,242,.70);border:1px solid rgba(244,63,94,.25)">
        <div class="flex items-center gap-2">
          <span class="text-base">📋</span>
          <div>
            <div class="text-[11px] font-black" style="color:#9f1239">${records.length} arrêt(s) maladie répertorié(s) en ${esc(mk)}</div>
            <div class="text-[9.5px] font-bold text-slate-500">Contrôle des justificatifs et conformité RH</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-black" style="background:rgba(16,185,129,.14);color:#065f46">✓ ${nWithCert} avec certificat</span>
          ${nMissing > 0 ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-black" style="background:rgba(245,158,11,.15);color:#b45309">⚠️ ${nMissing} sans pièce</span>` : ""}
        </div>
      </div>
      <div class="space-y-2.5">
    `;

    records.forEach(r => {
      const emp = r.emp || getEmpById(r.empId);
      const isPeriod = (r.startDay !== r.endDay);
      const periodLabel = isPeriod
        ? `Du ${fmtFR(r.startDay)} au ${fmtFR(r.endDay)} (${r.days.length} jours)`
        : `${fmtFR(r.startDay)} (1 jour)`;

      const hasCert = !!r.certificat;
      const certThumbHtml = hasCert
        ? `
          <div class="relative shrink-0 cursor-pointer group" onclick="openMaladieCertPreview('${escAttr(r.empId)}','${escAttr(r.startDay)}','${escAttr(r.endDay)}')">
            <img src="${escAttr(r.certificat)}" alt="Certificat" class="w-14 h-14 rounded-xl object-cover border border-rose-200 shadow-sm transition-transform group-hover:scale-105" />
            <div class="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black transition-opacity">
              🔍 Voir
            </div>
          </div>
        `
        : `
          <div class="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 text-center p-1"
               style="background:rgba(245,158,11,.10);border:1px dashed rgba(245,158,11,.35);color:#b45309">
            <span class="text-base">📄</span>
            <span class="text-[8px] font-extrabold uppercase">Sans photo</span>
          </div>
        `;

      html += `
        <div class="glass-card p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all hover:shadow-md"
             style="background:rgba(255,255,255,.85);border-color:${hasCert ? 'rgba(16,185,129,.30)' : 'rgba(245,158,11,.30)'}">
          <div class="flex items-center gap-3 min-w-0">
            ${certThumbHtml}
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[11.5px] font-black uppercase text-slate-900">${esc(emp.nom)}</span>
                <span class="text-[11px] font-bold text-slate-600">${esc(titleCase(emp.prenom))}</span>
                <span class="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase" style="background:rgba(59,130,246,.10);color:#2563eb">${esc(emp.poste || "—")}</span>
              </div>
              <div class="text-[10.5px] font-extrabold mt-0.5" style="color:#0f2744">
                🗓️ ${esc(periodLabel)}
              </div>
              ${r.motif ? `<div class="text-[10px] font-bold text-slate-500 italic mt-0.5 truncate">« ${esc(r.motif)} »</div>` : `<div class="text-[9.5px] text-slate-400 italic mt-0.5">Aucun motif texte saisi</div>`}
            </div>
          </div>
          <div class="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
            ${hasCert ? `
              <button type="button" onclick="openMaladieCertPreview('${escAttr(r.empId)}','${escAttr(r.startDay)}','${escAttr(r.endDay)}')"
                class="btn-action px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold"
                style="background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.35);color:#065f46">
                👁️ Contrôler
              </button>
              <label class="btn-action px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                style="background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.32);color:#1d4ed8" title="Remplacer par une autre photo">
                <span>🔄 Remplacer</span>
                <input type="file" accept="image/*" class="hidden" onchange="window.handleRegistryAttachCert('${escAttr(r.empId)}','${escAttr(r.startDay)}','${escAttr(r.endDay)}',this)" />
              </label>
              <button type="button" onclick="window.confirmDeleteMaladieCert('${escAttr(r.empId)}','${escAttr(r.startDay)}','${escAttr(r.endDay)}')"
                class="btn-action btn-danger px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold"
                style="background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.30);color:#dc2626"
                title="Supprimer la photo du certificat">
                🗑️ Retirer
              </button>
            ` : `
              <label class="btn-action px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                style="background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.35);color:#b45309" title="Joindre une photo du certificat médical">
                <span>📎 Joindre justificatif</span>
                <input type="file" accept="image/*" class="hidden" onchange="window.handleRegistryAttachCert('${escAttr(r.empId)}','${escAttr(r.startDay)}','${escAttr(r.endDay)}',this)" />
              </label>
            `}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = errorCard("Erreur chargement registre : " + (e?.message || "inconnue"));
  }
};

function buildModalMaladieBarHtml(empId, mk) {
  _pendingMaladieCertDataUrl = "";
  const defaultDay = (mk === monthKeyFromISO(todayISO())) ? todayISO() : (mk + "-01");
  return `
    <div class="p-3 rounded-2xl mb-3" style="background:rgba(255,241,242,.75);border:1px solid rgba(244,63,94,.28)">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-1.5">
          <span class="text-xs">🩺</span>
          <span class="smallCaps" style="color:#be123c;font-size:9.5px">Saisie manuelle Arrêt Maladie (M)</span>
        </div>
        <span class="text-[9px] font-bold" style="color:#9f1239">Clique aussi sur un jour ci-dessous</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-1.5">
        <input type="date" id="modalMaladieStart" class="inpt" value="${escAttr(defaultDay)}" style="font-size:11px;padding:7px 10px;border-radius:10px" title="Date début" onchange="const endEl=document.getElementById('modalMaladieEnd');if(endEl&&(!endEl.value||endEl.value<this.value))endEl.value=this.value;" />
        <input type="date" id="modalMaladieEnd" class="inpt" value="${escAttr(defaultDay)}" style="font-size:11px;padding:7px 10px;border-radius:10px" title="Date fin" />
        <input type="text" id="modalMaladieMotif" class="inpt" placeholder="Certificat / motif (optionnel)" maxlength="120" style="font-size:11px;padding:7px 10px;border-radius:10px" />
        <label class="btn-action px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
          style="background:rgba(255,255,255,.85);border:1px dashed rgba(244,63,94,.45);color:#9f1239" title="Joindre une photo du certificat médical (compressée automatiquement)">
          <span id="modalMaladieCertLabel">📷 Certificat</span>
          <input type="file" id="modalMaladieCertInput" accept="image/*" class="hidden" onchange="window.handleMaladieCertFileChange(this)" />
        </label>
      </div>
      <div class="flex items-center justify-between gap-2 mt-2">
        <div id="modalMaladieMsg" class="text-[10px] font-extrabold truncate" style="color:var(--muted2)"></div>
        <div class="flex items-center gap-1.5 shrink-0 ml-auto">
          <button type="button" data-emp-id="${escAttr(empId)}" onclick="window.submitModalMaladieForm(this.dataset.empId, true)" class="btn-action px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold"
            style="background:rgba(244,63,94,.15);border:1px solid rgba(244,63,94,.38);color:#9f1239">
            🩺 + Maladie (M)
          </button>
          <button type="button" data-emp-id="${escAttr(empId)}" onclick="window.submitModalMaladieForm(this.dataset.empId, false)" class="btn-action btn-neutral px-2.5 py-1.5 rounded-xl text-[10.5px] font-extrabold"
            style="background:rgba(255,255,255,.75);border:1px solid var(--stroke-med);color:var(--text)">
            ✕ Retirer M
          </button>
        </div>
      </div>
    </div>
  `;
}

window.submitModalMaladieForm = async function(empId, isMaladie) {
  const startISO = document.getElementById('modalMaladieStart')?.value || "";
  const endISO = document.getElementById('modalMaladieEnd')?.value || startISO;
  const motif = document.getElementById('modalMaladieMotif')?.value || "";
  const msgEl = document.getElementById('modalMaladieMsg');
  if (!startISO) {
    if (msgEl) { msgEl.style.color = 'var(--crit)'; msgEl.textContent = "⚠️ Choisis une date."; }
    return;
  }
  try {
    if (msgEl) { msgEl.style.color = 'var(--muted2)'; msgEl.textContent = "Enregistrement…"; }
    await setEmpMaladieRange(empId, startISO, endISO, isMaladie, motif, _pendingMaladieCertDataUrl);
    _pendingMaladieCertDataUrl = "";
    if (_modalState) {
      if (_modalState.mode === 'calendar') await openCalendarModal(_modalState.nom, _modalState.prenom, _modalState.mk);
      else await openHistory(_modalState.nom, _modalState.prenom, _modalState.mk);
    }
    if (typeof currentMode !== 'undefined') {
      if (currentMode === 'rc') renderRCView();
      else if (currentMode === 'report') renderReportView();
    }
  } catch (e) {
    if (msgEl) { msgEl.style.color = 'var(--crit)'; msgEl.textContent = "⚠️ " + (e?.message || "Erreur"); }
  }
};

window.quickToggleMaladieDay = async function(empId, dayISO, currentlyMaladie) {
  if (!empId || !dayISO) return;
  try {
    await setEmpMaladieRange(empId, dayISO, dayISO, !currentlyMaladie, "");
    if (_modalState) {
      if (_modalState.mode === 'calendar') await openCalendarModal(_modalState.nom, _modalState.prenom, _modalState.mk);
      else await openHistory(_modalState.nom, _modalState.prenom, _modalState.mk);
    }
    if (typeof currentMode !== 'undefined') {
      if (currentMode === 'rc') renderRCView();
      else if (currentMode === 'report') renderReportView();
    }
  } catch (e) {
    alert("Erreur lors de la mise à jour de l'arrêt maladie : " + (e?.message || "Permission refusée"));
  }
};

async function openCalendarModal(nom, prenom, mk) {
  const dateInput = document.getElementById('dashDate');
  mk = mk || _modalState?.mk || monthKeyFromISO(dateInput.value);
  _modalState = { mode: 'calendar', nom, prenom, mk };
  const modal = document.getElementById('historyModal');
  modal.classList.remove("hidden", "modal-closing");
  modal.classList.add('modal-active');
  document.getElementById('modalSubtitle').textContent = 'Calendrier';
  document.getElementById('modalTitle').innerText = nom + " " + titleCase(prenom);
  const calAvatarSlot = document.getElementById('modalAvatarSlot');
  if (calAvatarSlot) calAvatarSlot.innerHTML = getStaffAvatarHtml(nom, prenom, 'lg');
  document.getElementById('modalMonthPicker').value = mk;

  // Mise à jour visuelle des onglets
  document.getElementById('modalTabCal')?.classList.add('active');
  document.getElementById('modalTabHist')?.classList.remove('active');

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
    maladie: { bg: 'rgba(244,63,94,.14)',   color: '#be123c',               label: 'M' },
    off:     { bg: 'rgba(148,163,184,.11)', color: 'rgba(100,116,139,.75)', label: 'OFF' },
    absent:  { bg: 'rgba(234,88,12,.09)',   color: '#9a3412',               label: '⚠' }
  };

  let nPresent = 0, nR = 0, nC = 0, nM = 0, nOff = 0, nAbsent = 0;
  const dayMap = {};

  dates.forEach(dayISO => {
    const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO], md.motifsByDay?.[dayISO]);
    const ev = evaluateEmployeeDay(emp || empId, dayISO, merged[empId] || null, rcByEmpDay[empId]?.[dayISO], empStart);
    dayMap[dayISO] = ev;
    if (ev.type === 'maladie') nM++;
    else if (ev.isPresent) nPresent++;
    else if (ev.type === 'repos') nR++;
    else if (ev.type === 'conge') nC++;
    else if (ev.type === 'off') nOff++;
    else if (ev.type === 'absent') nAbsent++;
  });

  const badge = (bg, bd, fg, txt) => `<span style="background:${bg};border:1px solid ${bd};color:${fg};font-weight:900;font-size:10px;padding:3px 9px;border-radius:999px;white-space:nowrap">${txt}</span>`;
  let recapHtml = `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">`;
  if (nPresent) recapHtml += badge('rgba(5,150,105,.11)', 'rgba(5,150,105,.28)', '#065f46', `✓ ${nPresent} présents`);
  if (nR)       recapHtml += badge('rgba(99,102,241,.12)', 'rgba(99,102,241,.25)', '#3730a3', `R ${nR} repos`);
  if (nC)       recapHtml += badge('rgba(245,158,11,.13)', 'rgba(245,158,11,.28)', '#92400e', `C ${nC} congés`);
  if (nM)       recapHtml += badge('rgba(244,63,94,.13)', 'rgba(244,63,94,.30)', '#be123c', `🩺 M ${nM} maladie`);
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
        const isMaladieCell = (info.type === 'maladie');
        const { d } = parseISO(cursor);
        let sub = t.label;
        if (info.type === 'present') sub = info.ha || '✓';
        if (info.type === 'retard')  sub = `+${info.diff}m`;
        if (isMaladieCell)           sub = '🩺 M';
        const baseTooltip = isMaladieCell
          ? `${cursor} · Arrêt Maladie (M)${info.motif ? ' · « ' + info.motif + ' »' : ''} — Cliquer pour retirer M`
          : (info.type === 'retard' && info.motif)
          ? `${cursor} · Retard +${info.diff}m · Motif : « ${info.motif} » — Cliquer pour marquer Maladie (M)`
          : `${cursor} — Cliquer pour basculer Arrêt Maladie (M)`;
        calHtml += `<div class="cal-cell${isToday ? ' cal-today' : ''} cursor-pointer hover:scale-[1.03] transition-transform"
          data-emp-id="${escAttr(empId)}" data-day="${escAttr(cursor)}"
          onclick="window.quickToggleMaladieDay(this.dataset.empId, this.dataset.day, ${isMaladieCell})"
          title="${escAttr(baseTooltip)}"
          style="background:${t.bg};border-color:${isToday ? 'rgba(245,158,11,.65)' : (isMaladieCell ? 'rgba(244,63,94,.38)' : 'rgba(148,163,184,.10)')}">
          <div style="font-size:11px;font-weight:900;color:#0f2744">${d}</div>
          <div style="font-size:9px;font-weight:800;color:${t.color};text-align:center;line-height:1.1">${sub}</div>
          ${(info.motif || info.certificat) ? `<div style="font-size:7.5px;line-height:1;margin-top:1px;color:${isMaladieCell ? '#be123c' : '#b45309'}" title="Motif : « ${escAttr(info.motif || 'Certificat joint')} »">${info.certificat ? `<span data-emp-id="${escAttr(empId)}" data-day="${escAttr(cursor)}" onclick="event.stopPropagation();window.openMaladieCertPreview(this.dataset.empId,this.dataset.day)" title="Voir le certificat médical">📎</span>` : '💬'}</div>` : ''}
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
    <span style="font-size:9px;font-weight:700;color:#be123c">🩺 M Arrêt Maladie (clic sur un jour)</span>
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">OFF jour de repos</span>
    <span style="font-size:9px;font-weight:700;color:var(--muted3)">⚠ Absent non justifié</span>
  </div>`;

  document.getElementById('modalList').innerHTML = buildModalMaladieBarHtml(empId, mk) + recapHtml + calHtml + legHtml;
}

function rowHistory(dayISO, statut, hp, ha, retard, cls, rc, motif, empId = "", isMaladie = false, dist = null, certificat = "") {
  const rcTxt = rc ? ` · <span style="font-family:'Plus Jakarta Sans';font-weight:900">${esc(rc)}</span>` : "";
  const certBtnHtml = (isMaladie && certificat && empId) ? `
    <button type="button" data-emp-id="${escAttr(empId)}" data-day="${escAttr(dayISO)}"
      onclick="window.openMaladieCertPreview(this.dataset.empId, this.dataset.day)"
      class="btn-action px-2 py-0.5 rounded-lg text-[9.5px] font-extrabold ml-1.5"
      style="background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.35);color:#065f46"
      title="Voir le certificat médical joint">
      📎 Certificat
    </button>
  ` : "";
  const toggleBtnHtml = empId ? `
    <button type="button" data-emp-id="${escAttr(empId)}" data-day="${escAttr(dayISO)}"
      onclick="window.quickToggleMaladieDay(this.dataset.empId, this.dataset.day, ${isMaladie})"
      class="btn-action px-2 py-0.5 rounded-lg text-[9.5px] font-extrabold ml-2"
      style="${isMaladie ? 'background:rgba(244,63,94,.16);border:1px solid rgba(244,63,94,.38);color:#be123c' : 'background:rgba(255,255,255,.75);border:1px solid var(--stroke-med);color:var(--muted2)'}"
      title="${isMaladie ? 'Retirer Arrêt Maladie (M)' : 'Marquer en Arrêt Maladie (M)'}">
      ${isMaladie ? '✕ Retirer M' : '🩺 M'}
    </button>
  ` : "";
  const motifHtml = motif ? `
    <div class="mt-2.5 p-2 px-3 rounded-xl text-[11px] font-bold flex items-start gap-1.5" style="background:${isMaladie ? 'rgba(244,63,94,.09);border-left:3px solid #e11d48;color:#9f1239' : 'rgba(245,158,11,.10);border-left:3px solid var(--accent);color:#78350f'}">
      <span>${isMaladie ? '🩺' : '💬'}</span>
      <span class="italic font-semibold break-words">« ${esc(motif)} »</span>
    </div>
  ` : "";
  return `<div class="p-4 rounded-2xl" style="background:${isMaladie ? 'rgba(255,241,242,.65)' : 'rgba(255,255,255,.50)'};border:1px solid ${isMaladie ? 'rgba(244,63,94,.30)' : 'var(--stroke-med)'}">
    <div class="flex justify-between items-center gap-2">
      <span class="smallCaps" style="font-size:10px">${esc(fmtFR(dayISO))}</span>
      <div class="flex items-center">
        <span class="text-[11px] font-extrabold" style="${escAttr(cls)}">${esc(statut)}${rcTxt}</span>
        ${certBtnHtml}
        ${toggleBtnHtml}
      </div>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2">
      <div class="text-[10px] font-bold" style="color:var(--muted3)">HP <span style="color:#0f2744;font-weight:900">${esc(hp || "—")}</span></div>
      <div class="text-[10px] font-bold" style="color:var(--muted3)">HA <span style="color:#0f2744;font-weight:900">${esc(ha || "—")}</span>${(typeof dist === "number") ? `<span class="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded ml-1" title="Pointé à ${dist}m du café">📍${dist}m</span>` : ""}</div>
      <div class="text-[10px] font-bold" style="color:var(--muted3)">Ret <span style="color:#0f2744;font-weight:900">${esc(retard || "—")}</span></div>
    </div>
    ${motifHtml}
  </div>`;
}

async function openHistory(nom, prenom, mk) {
  const dateInput = document.getElementById('dashDate');
  mk = mk || _modalState?.mk || monthKeyFromISO(dateInput.value);
  _modalState = { mode: 'history', nom, prenom, mk };
  const modal = document.getElementById('historyModal');
  modal.classList.remove("hidden", "modal-closing");
  modal.classList.add('modal-active');
  document.getElementById('modalSubtitle').textContent = 'Historique détaillé';
  document.getElementById('modalTitle').innerText = nom + " " + titleCase(prenom);
  const histAvatarSlot = document.getElementById('modalAvatarSlot');
  if (histAvatarSlot) histAvatarSlot.innerHTML = getStaffAvatarHtml(nom, prenom, 'lg');
  document.getElementById('modalMonthPicker').value = mk;

  // Mise à jour visuelle des onglets
  document.getElementById('modalTabHist')?.classList.add('active');
  document.getElementById('modalTabCal')?.classList.remove('active');

  document.getElementById('modalList').innerHTML = loadingCard("Chargement historique…");

  const md = await getMonthData(mk);
  if (md.anyFail) {
    document.getElementById('modalList').innerHTML = errorCard("Réseau instable : historique partiel.");
    return;
  }
  const { dates, presByDay, punchByDay, motifsByDay } = md;
  const { rcByEmpDay, startMap } = await getMonthRCMap(mk);
  const emp = equipe.find(e => e.nom === nom && e.prenom === prenom);
  const empId = emp ? empIdOf(emp) : (nom + "_" + prenom);
  const empStart = startMap[empId];

  let html = "";
  let absCount = 0;
  dates.slice().reverse().forEach(dayISO => {
    const merged = mergeDay(presByDay[dayISO], punchByDay[dayISO], motifsByDay?.[dayISO]);
    const ev = evaluateEmployeeDay(emp || empId, dayISO, merged[empId] || null, rcByEmpDay[empId]?.[dayISO], empStart);
    if (ev.type === "maladie") {
      html += rowHistory(dayISO, "🩺 Arrêt Maladie", ev.hp, "", "", "color:#be123c", "M", ev.motif, empId, true, null, ev.certificat);
    } else if (ev.type === "future") {
      html += rowHistory(dayISO, "À venir", "", "", "", "color:var(--muted3)", "", "", empId, false);
    } else if (ev.type === "exclu") {
      html += rowHistory(dayISO, "Exclu", "", "", "", "color:var(--muted3)");
    } else if (ev.type === "avant") {
      html += rowHistory(dayISO, "Non commencé", "", "", "", "color:var(--muted3)", "", "", empId, false);
    } else if (ev.isPresent) {
      if (ev.isLate) html += rowHistory(dayISO, "Retard", ev.hp, ev.ha, `+${ev.diff} min`, "color:var(--crit)", "", ev.motif, empId, false, ev.dist);
      else html += rowHistory(dayISO, "À l'heure", ev.hp, ev.ha, "0", "color:var(--ok)", "", "", empId, false, ev.dist);
    } else if (ev.type === "repos") {
      html += rowHistory(dayISO, "Repos", ev.hp, "", "", "color:var(--chip-r-fg)", "R", "", empId, false);
    } else if (ev.type === "conge") {
      html += rowHistory(dayISO, "Congé", ev.hp, "", "", "color:var(--amber)", "C", "", empId, false);
    } else if (ev.type === "off") {
      html += rowHistory(dayISO, "OFF", ev.hp, "", "", "color:var(--muted2)", "OFF", "", empId, false);
    } else {
      absCount++;
      html += rowHistory(dayISO, "⚠ Absent", ev.hp, "", "", "color:rgba(234,88,12,.90)", "", "", empId, false);
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
  document.getElementById('modalList').innerHTML = buildModalMaladieBarHtml(empId, mk) + (absBanner + html);
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

/* ─── Éditeur de Plannings (Amélioration #3 : Cuisine & Ménage S1/S2) ─── */
const CUISINE_MEMBERS_ORDER = ["NAOUAL", "KHAOULA", "FATIMA", "JIHANE", "IMANE", "ANAS", "JAWAD", "SAAD"];
const CUISINE_DAYS_ORDER = [
  { dow: 1, label: "Lundi" },
  { dow: 2, label: "Mardi" },
  { dow: 3, label: "Mercredi" },
  { dow: 4, label: "Jeudi" },
  { dow: 5, label: "Vendredi" },
  { dow: 6, label: "Samedi" },
  { dow: 0, label: "Dimanche" }
];

function renderPlanningAdminBody() {
  const wrap = document.getElementById("planningAdminBody");
  if (!wrap) return;

  let html = `<div class="space-y-4">
    <div class="p-3.5 rounded-2xl" style="background:rgba(255,255,255,.55);border:1px solid var(--stroke-med)">
      <div class="smallCaps mb-2">🍳 Planning Cuisine (Hebdomadaire — Heure prévue ou OFF)</div>
      <div class="overflow-x-auto">
        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          <thead>
            <tr>
              <th style="text-align:left;padding:4px 6px">Membre</th>
              ${CUISINE_DAYS_ORDER.map(d => `<th style="text-align:center;padding:4px">${d.label.slice(0, 3)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>`;

  CUISINE_MEMBERS_ORDER.forEach(member => {
    html += `<tr style="border-top:1px solid var(--stroke-med)">
      <td style="font-weight:900;padding:5px 6px;color:#0f2744">${esc(member)}</td>`;
    CUISINE_DAYS_ORDER.forEach(d => {
      const slot = PLANNING_CUISINE?.[d.dow]?.[member] || { hP: "", off: true };
      const val = slot.off ? "OFF" : (slot.hP || "07:00");
      html += `<td style="padding:3px">
        <input type="text" data-plan-cuisine-dow="${d.dow}" data-plan-cuisine-member="${escAttr(member)}"
          value="${escAttr(val)}" class="inpt"
          style="padding:4px 5px;font-size:10px;text-align:center;border-radius:8px;min-width:52px"
          title="Heure HH:MM ou OFF" />
      </td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>
    <p class="mt-2 text-[9.5px] font-semibold" style="color:var(--muted3)">Saisir une heure au format <b>HH:MM</b> (ex: 07:00, 14:00) ou <b>OFF</b> pour un jour de repos.</p>
  </div>`;

  // Ménage S1 & S2
  ["S1", "S2"].forEach(wk => {
    const wData = MENAGE_PLANNING_DATA?.[wk] || { title: wk, schedules: [] };
    html += `<div class="p-3.5 rounded-2xl" style="background:rgba(255,255,255,.55);border:1px solid var(--stroke-med)">
      <div class="smallCaps mb-2">🧹 Planning Ménage · ${esc(wData.title || wk)}</div>
      <div class="space-y-1.5">`;
    (wData.schedules || []).forEach((row, idx) => {
      html += `<div class="grid grid-cols-3 gap-2 items-center">
        <div class="text-[10.5px] font-extrabold uppercase" style="color:#0f2744">${esc(row.day)}</div>
        <input type="text" data-plan-menage-wk="${wk}" data-plan-menage-idx="${idx}" data-plan-menage-slot="matin"
          value="${escAttr(row.matin?.staff || "")}" class="inpt" style="padding:5px 8px;font-size:10.5px;border-radius:9px" placeholder="Matin (06:30)" />
        <input type="text" data-plan-menage-wk="${wk}" data-plan-menage-idx="${idx}" data-plan-menage-slot="soir"
          value="${escAttr(row.soir?.staff || "")}" class="inpt" style="padding:5px 8px;font-size:10.5px;border-radius:9px" placeholder="Soir (12:00/14:00)" />
      </div>`;
    });
    html += `</div></div>`;
  });

  html += `</div>`;
  wrap.innerHTML = html;
}

function openPlanningAdminModal() {
  renderPlanningAdminBody();
  const m = document.getElementById("planningAdminModal");
  if (!m) return;
  m.classList.remove("hidden", "modal-closing");
  m.classList.add("modal-active");
}

function closePlanningAdminModal() {
  const m = document.getElementById("planningAdminModal");
  if (!m) return;
  m.classList.remove("modal-active");
  m.classList.add("modal-closing");
  setTimeout(() => { m.classList.remove("modal-closing"); m.classList.add("hidden"); }, 260);
}

window.savePlanningAdminChanges = async function() {
  const msgEl = document.getElementById("planningAdminMsg");
  if (msgEl) { msgEl.style.color = "var(--muted2)"; msgEl.textContent = "Enregistrement des plannings…"; }

  const nextCuisine = JSON.parse(JSON.stringify(PLANNING_CUISINE));
  document.querySelectorAll("[data-plan-cuisine-dow]").forEach(inp => {
    const dow = Number(inp.dataset.planCuisineDow);
    const member = inp.dataset.planCuisineMember;
    const raw = String(inp.value || "").trim().toUpperCase();
    if (!nextCuisine[dow]) nextCuisine[dow] = {};
    if (raw === "OFF" || raw === "") {
      nextCuisine[dow][member] = { hP: "", off: true, shift: "OFF" };
    } else {
      const cleanHp = safeTime(raw) || "07:00";
      nextCuisine[dow][member] = { hP: cleanHp, off: false, shift: `${cleanHp.slice(0, 2)}h — F.S` };
    }
  });

  const nextMenage = JSON.parse(JSON.stringify(MENAGE_PLANNING_DATA));
  document.querySelectorAll("[data-plan-menage-wk]").forEach(inp => {
    const wk = inp.dataset.planMenageWk;
    const idx = Number(inp.dataset.planMenageIdx);
    const slot = inp.dataset.planMenageSlot;
    if (nextMenage[wk]?.schedules?.[idx]?.[slot]) {
      nextMenage[wk].schedules[idx][slot].staff = String(inp.value || "").trim();
    }
  });

  try {
    const res = await savePlanningsToDB({ cuisine: nextCuisine, menage: nextMenage });
    if (msgEl) {
      msgEl.style.color = "var(--ok)";
      msgEl.textContent = res.savedToFirebase
        ? "✅ Plannings sauvegardés dans Firebase (settings/plannings) !"
        : "✅ Plannings appliqués et sauvegardés localement !";
    }
    if (typeof updateDashboard === "function") await updateDashboard();
  } catch (e) {
    if (msgEl) {
      msgEl.style.color = "var(--crit)";
      msgEl.textContent = "⚠️ Erreur : " + (e?.message || "Impossible de sauvegarder");
    }
  }
};

