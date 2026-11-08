/**
 * Vue Table R/C • Roulements Hebdomadaires & Soldes Légaux de Repos
 * Direction Hub • Grey Corner
 */

function makeTable(rows, colR, colC, colM = 'M') {
  return `<div class="mt-4 overflow-x-auto">
    <table class="rc-table">
      <colgroup>
        <col style="width:34%" class="sm:!w-[38%] md:!w-[40%]">
        <col style="width:11%" class="sm:!w-[10%] md:!w-[10%]">
        <col style="width:10%" class="sm:!w-[10%] md:!w-[10%]">
        <col style="width:10%" class="sm:!w-[10%] md:!w-[10%]">
        <col style="width:11%" class="sm:!w-[10%] md:!w-[10%]">
        <col style="width:12%" class="sm:!w-[11%] md:!w-[10%]">
        <col style="width:12%" class="sm:!w-[11%] md:!w-[10%]">
      </colgroup>
      <thead><tr>
        <th style="text-align:left">Employé</th>
        <th style="text-align:center">Prés.</th>
        <th style="text-align:center">${esc(colR)}</th>
        <th style="text-align:center">${esc(colC)}</th>
        <th style="text-align:center" title="Arrêt Maladie (saisie manuelle)">${esc(colM)}</th>
        <th style="text-align:center" title="Repos non pris à récupérer (dû au salarié)">Solde</th>
        <th style="text-align:center">Retard</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const late = Number(r.lateMin) || 0;
          const mal = Number(r.M) || 0;
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

          const malHtml = mal > 0
            ? `<span class="maladie-badge" title="${mal} jour(s) d'arrêt maladie">${esc(mal)}</span>`
            : `<span class="muted-dash">0</span>`;

          return `<tr data-nom="${escAttr(r.nom)}" data-prenom="${escAttr(r.prenom)}" title="Cliquer pour voir le calendrier et gérer les arrêts maladie">
            <td class="col-emp">
              <div class="flex items-center gap-2.5 sm:gap-3.5">
                ${getStaffAvatarHtml(r.nom, r.prenom, 'table')}
                <div class="min-w-0">
                  <div class="emp-name-main">${esc(r.nom)} <span class="emp-prenom-sub">${esc(titleCase(r.prenom))}</span></div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span class="rc-poste-badge">${esc((r.poste || "").toLowerCase())}</span>
                    <span style="font-size:9px;color:var(--muted3);opacity:.75">📅</span>
                  </div>
                </div>
              </div>
            </td>
            <td style="text-align:center;font-weight:900;color:var(--ok)">${esc(r.present)}</td>
            <td style="text-align:center;font-weight:900;color:var(--chip-r-fg)">${esc(r.R)}</td>
            <td style="text-align:center;font-weight:900;color:var(--amber)">${esc(r.C)}</td>
            <td style="text-align:center;font-weight:900;color:#be123c">${malHtml}</td>
            <td style="text-align:center;font-weight:900">${soldeHtml}</td>
            <td style="text-align:center;font-weight:900;color:var(--crit)">
              ${late ? `<span>${esc(late)}m</span>` : '<span class="muted-dash">—</span>'}
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
  let mP = 0, mR = 0, mC = 0, mM = 0, mL = 0;
  monthRows.forEach(r => { mP += r.present; mR += r.R; mC += r.C; mM += (r.M || 0); mL += r.lateMin; });

  const yearRows = Object.values(yearSummary).sort(sortFn);
  let yP = 0, yR = 0, yC = 0, yM = 0, yL = 0;
  yearRows.forEach(r => { yP += r.present; yR += r.R; yC += r.C; yM += (r.M || 0); yL += r.lateMin; });

  const sortedEquipe = equipe.slice().sort(sortFn);
  const defaultDay = (mk === monthKeyFromISO(todayISO())) ? todayISO() : (mk + "-01");

  const html = `<div class="space-y-4">
    <!-- ─── Panneau de saisie manuelle Arrêt Maladie (M) ─── -->
    <div class="glass-card rounded-2xl p-4" style="border-color:rgba(244,63,94,.28);background:linear-gradient(160deg,rgba(255,255,255,.92),rgba(255,241,242,.75))">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <div class="flex items-center gap-2">
          <span class="text-sm">🩺</span>
          <span class="smallCaps" style="color:#be123c">Saisie manuelle · Arrêt Maladie (M)</span>
        </div>
        <span class="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full" style="background:rgba(244,63,94,.12);color:#be123c">
          Suivi exact RH
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <select id="rcMaladieEmp" class="inpt" style="font-size:11px;padding:9px 11px">
          <option value="">-- Collaborateur --</option>
          ${sortedEquipe.map(e => `<option value="${escAttr(empIdOf(e))}">${esc(e.nom)} ${esc(titleCase(e.prenom))} (${esc(e.poste)})</option>`).join("")}
        </select>
        <input type="date" id="rcMaladieStart" class="inpt" value="${escAttr(defaultDay)}" style="font-size:11px;padding:9px 11px" title="Date de début" onchange="const endEl=document.getElementById('rcMaladieEnd');if(endEl&&(!endEl.value||endEl.value<this.value))endEl.value=this.value;" />
        <input type="date" id="rcMaladieEnd" class="inpt" value="${escAttr(defaultDay)}" style="font-size:11px;padding:9px 11px" title="Date de fin (incluse)" />
        <input type="text" id="rcMaladieMotif" class="inpt" placeholder="Certificat / note (optionnel)" maxlength="120" style="font-size:11px;padding:9px 11px" />
        <label class="btn-action px-2.5 py-1.5 rounded-xl text-[10.5px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
          style="background:rgba(255,255,255,.85);border:1px dashed rgba(244,63,94,.45);color:#9f1239" title="Joindre une photo du certificat médical">
          <span id="rcMaladieCertLabel">📷 Certificat</span>
          <input type="file" id="rcMaladieCertInput" accept="image/*" class="hidden" onchange="window.handleRCMaladieCertFileChange(this)" />
        </label>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 mt-2.5">
        <div id="rcMaladieMsg" class="text-[10.5px] font-extrabold" style="color:var(--muted2)">
          Astuce : tu peux aussi cliquer sur un employé puis sur les jours de son calendrier 📅
        </div>
        <div class="flex items-center gap-2 ml-auto">
          <button type="button" onclick="openCertificatesRegistryModal()" class="btn-action px-3 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1"
            style="background:rgba(244,63,94,.10);border:1px solid rgba(244,63,94,.30);color:#9f1239" title="Ouvrir le registre de tous les arrêts et certificats médicaux">
            <span>📂</span> Registre Certificats
          </button>
          <button type="button" onclick="window.submitRCMaladieForm(true)" class="btn-action px-3.5 py-2 rounded-xl text-[11px] font-extrabold"
            style="background:rgba(244,63,94,.14);border:1px solid rgba(244,63,94,.38);color:#9f1239">
            🩺 + Marquer Maladie (M)
          </button>
          <button type="button" onclick="window.submitRCMaladieForm(false)" class="btn-action btn-neutral px-3 py-2 rounded-xl text-[11px] font-extrabold"
            style="background:rgba(255,255,255,.70);border:1px solid var(--stroke-med);color:var(--text)">
            ✕ Retirer M
          </button>
        </div>
      </div>
    </div>

    <details class="drawer" open>
      <summary>
        <div>
          <div class="smallCaps">Tableau Mois</div>
          <div class="hTitle text-xl mt-1">${esc(mk)}
            <span style="opacity:.55;font-family:'Plus Jakarta Sans';font-size:12px;font-weight:700">
              · ${esc(mP)} présents · R ${esc(mR)} · C ${esc(mC)} · M ${esc(mM)} · ${esc(mL)} min
            </span>
          </div>
        </div>
        <div class="chev">▾</div>
      </summary>
      <div class="body">${makeTable(monthRows, 'R', 'C', 'M')}</div>
    </details>

    <details class="drawer">
      <summary>
        <div>
          <div class="smallCaps">Tableau Année (cumul)</div>
          <div class="hTitle text-xl mt-1">${esc(year)}
            <span style="opacity:.55;font-family:'Plus Jakarta Sans';font-size:12px;font-weight:700">
              · ${esc(yP)} présents · Repos ${esc(yR)} · Congé ${esc(yC)} · Maladie ${esc(yM)} · ${esc(yL)} min
            </span>
          </div>
        </div>
        <div class="chev">▾</div>
      </summary>
      <div class="body">
        ${makeTable(yearRows, 'Repos', 'Congé', 'Maladie')}
        <p class="mt-3 text-[10px] font-semibold" style="color:var(--muted3)">
          Année = cumul des mois · Solde = repos non pris dus au salarié (+)
        </p>
      </div>
    </details>

    <p class="text-[10px] font-semibold" style="color:var(--muted3)">
      R = Repos hebdo · C = Congé pris / 2ᵉ repos · M = Arrêt Maladie (manuel) · Solde = Repos non pris à récupérer · 📅 cliquer sur un employé pour le calendrier
    </p>
  </div>`;

  document.getElementById('dashBody').innerHTML = html;
  document.getElementById('dashBody').querySelectorAll('tr[data-nom]').forEach(tr => {
    tr.addEventListener('click', () => openCalendarModal(tr.dataset.nom, tr.dataset.prenom));
  });
}

let _pendingRCMaladieCertDataUrl = "";

window.handleRCMaladieCertFileChange = async function(inputEl) {
  const file = inputEl?.files?.[0];
  const labelEl = document.getElementById("rcMaladieCertLabel");
  if (!file) {
    _pendingRCMaladieCertDataUrl = "";
    if (labelEl) labelEl.textContent = "📷 Certificat";
    return;
  }
  try {
    if (labelEl) labelEl.textContent = "⏳ Compression…";
    _pendingRCMaladieCertDataUrl = await compressCertImageFile(file);
    if (labelEl) labelEl.textContent = "📎 Certificat prêt ✓";
  } catch (e) {
    _pendingRCMaladieCertDataUrl = "";
    if (labelEl) labelEl.textContent = "⚠️ Image invalide";
  }
};

window.submitRCMaladieForm = async function(isMaladie) {
  const empId = document.getElementById('rcMaladieEmp')?.value || "";
  const startISO = document.getElementById('rcMaladieStart')?.value || "";
  const endISO = document.getElementById('rcMaladieEnd')?.value || startISO;
  const motif = document.getElementById('rcMaladieMotif')?.value || "";
  const msgEl = document.getElementById('rcMaladieMsg');

  if (!empId) {
    if (msgEl) { msgEl.style.color = 'var(--crit)'; msgEl.textContent = "⚠️ Sélectionne un collaborateur."; }
    return;
  }
  if (!startISO) {
    if (msgEl) { msgEl.style.color = 'var(--crit)'; msgEl.textContent = "⚠️ Sélectionne une date."; }
    return;
  }
  try {
    if (msgEl) { msgEl.style.color = 'var(--muted2)'; msgEl.textContent = "Enregistrement…"; }
    const count = await setEmpMaladieRange(empId, startISO, endISO, isMaladie, motif, _pendingRCMaladieCertDataUrl);
    _pendingRCMaladieCertDataUrl = "";
    const certLbl = document.getElementById("rcMaladieCertLabel");
    if (certLbl) certLbl.textContent = "📷 Certificat";
    if (msgEl) {
      msgEl.style.color = 'var(--ok)';
      msgEl.textContent = isMaladie
        ? `✅ Arrêt maladie (M) enregistré sur ${count} jour(s).`
        : `✅ Statut maladie retiré sur ${count} jour(s).`;
    }
    await renderRCView();
  } catch (e) {
    if (msgEl) { msgEl.style.color = 'var(--crit)'; msgEl.textContent = "⚠️ Erreur : " + (e?.message || "Permission refusée"); }
  }
};
