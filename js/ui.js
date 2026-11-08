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

// ─────────────────────────────────────────────────────────────────────────
// F1 : SERVICE D'ALERTE EN DIRECT (RETARDS IMPORTANTS & BIPS SONORES)
// ─────────────────────────────────────────────────────────────────────────
const LateAlertService = (() => {
  const SEUIL_GRAVE = 15; // minutes de retard considérées comme graves
  const _alertedToday = new Set();
  let _soundEnabled = true;

  try {
    const s = localStorage.getItem("gc_dash_sound_alert");
    if (s !== null) _soundEnabled = (s === "1");
  } catch (e) {}

  let audioCtx = null;
  let cachedBeepWav = null;

  function makeBeepWav(freq1, freq2) {
    try {
      const sampleRate = 22050;
      const duration = 0.35;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);
      function writeStr(offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, numSamples * 2, true);

      const half = Math.floor(numSamples / 2);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const f = i < half ? freq1 : freq2;
        const envelope = Math.sin(Math.PI * (i / numSamples));
        const sample = Math.sin(2 * Math.PI * f * t) * envelope * 0.75;
        view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
      }
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return 'data:audio/wav;base64,' + btoa(binary);
    } catch (e) {
      return null;
    }
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function unlock() {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") ctx.resume();
      if (!cachedBeepWav) cachedBeepWav = makeBeepWav(880, 659.25);
    } catch (e) {}
  }

  if (typeof document !== "undefined") {
    const doUnlock = () => {
      unlock();
      document.removeEventListener("pointerdown", doUnlock);
      document.removeEventListener("click", doUnlock);
    };
    document.addEventListener("pointerdown", doUnlock, { passive: true });
    document.addEventListener("click", doUnlock, { passive: true });
  }

  function isSoundEnabled() { return _soundEnabled; }

  function toggleSound() {
    _soundEnabled = !_soundEnabled;
    try { localStorage.setItem("gc_dash_sound_alert", _soundEnabled ? "1" : "0"); } catch (e) {}
    updateSoundBtnUI();
    if (_soundEnabled) {
      unlock();
      playBeep();
      requestNotificationPermission();
    }
  }

  function updateSoundBtnUI() {
    const btn = document.getElementById("btnToggleSound");
    if (!btn) return;
    if (_soundEnabled) {
      btn.innerHTML = `<span>🔊</span> Alertes ON`;
      btn.style.color = "var(--ok)";
      btn.style.borderColor = "rgba(5,150,105,.35)";
      btn.style.background = "rgba(5,150,105,.08)";
    } else {
      btn.innerHTML = `<span>🔇</span> Alertes OFF`;
      btn.style.color = "var(--muted3)";
      btn.style.borderColor = "var(--stroke-med)";
      btn.style.background = "rgba(255,255,255,.50)";
    }
  }

  function playBeep() {
    if (!_soundEnabled) return;
    let played = false;
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state !== "suspended") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        const t = ctx.currentTime;
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(659.25, t + 0.14);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
        played = true;
      }
    } catch (e) {}

    if (!played) {
      try {
        if (!cachedBeepWav) cachedBeepWav = makeBeepWav(880, 659.25);
        if (cachedBeepWav) {
          const a = new Audio(cachedBeepWav);
          a.volume = 1.0;
          const p = a.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch (e) {}
    }
  }

  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function sendDesktopNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      new Notification(title, {
        body,
        icon: "images/LOGO GREY CORNER.png",
        tag: "gc-late-alert"
      });
    } catch (e) {}
  }

  function checkAndAlert(data) {
    const today = todayISO();
    const latesGrave = [];

    equipe.forEach(emp => {
      const id = empIdOf(emp);
      const d = data[id] || {};
      const ha = safeTime(d.hA);
      const hp = safeTime(d.hP);
      if (!ha) return;

      const diff = diffFromEntry({ hA: ha, hP: hp }, id, today);
      if (diff >= SEUIL_GRAVE) {
        const motif = String(d.motif || "").trim();
        latesGrave.push({ emp, diff, ha, motif });
        const keyAlert = `${today}_${id}_${diff}`;
        if (!_alertedToday.has(keyAlert)) {
          _alertedToday.add(keyAlert);
          playBeep();
          const notifMsg = `${emp.nom} ${emp.prenom} (${emp.poste}) : arrivée à ${ha} (+${diff} min de retard)` +
            (motif ? `\nMotif : « ${motif} »` : '');
          sendDesktopNotification(
            "🚨 Alerte Retard — Grey Corner",
            notifMsg
          );
        }
      }
    });

    renderAlertBanner(latesGrave);
  }

  function renderAlertBanner(lates) {
    const banner = document.getElementById("liveAlertBanner");
    if (!banner) return;
    if (!lates.length) {
      banner.classList.add("hidden");
      banner.innerHTML = "";
      return;
    }

    banner.classList.remove("hidden");
    const items = lates.map(l => `
      <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
           style="background:rgba(220,38,38,.12);color:var(--crit);border:1px solid rgba(220,38,38,.30)"
           data-nom="${escAttr(l.emp.nom)}" data-prenom="${escAttr(l.emp.prenom)}"
           onclick="openHistory(this.dataset.nom, this.dataset.prenom)"
           title="${l.motif ? 'Motif : « ' + escAttr(l.motif) + ' »' : 'Cliquer pour inspecter l\'historique'}">
        <span class="animate-pulse">🚨</span>
        <span>${esc(l.emp.nom)} ${esc(titleCase(l.emp.prenom))}</span>
        <span class="px-1.5 py-0.5 rounded-md font-black" style="background:rgba(220,38,38,.18)">+${l.diff}m</span>
        <span class="opacity-75 text-[10px]">(${esc(l.ha)})</span>
        ${l.motif ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold max-w-[170px] truncate" style="background:rgba(245,158,11,.22);color:#92400e" title="Motif : « ${escAttr(l.motif)} »">💬 ${esc(l.motif)}</span>` : ''}
      </div>
    `).join("");

    banner.innerHTML = `
      <div class="glass-card p-3 rounded-2xl border-red-300" style="background:rgba(254,242,242,.92);border-color:rgba(239,68,68,.38);box-shadow:0 4px 14px rgba(220,38,38,.10)">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-sm animate-bounce">🔔</span>
            <span class="smallCaps text-[10px]" style="color:var(--crit)">Retards importants en direct (${lates.length}) :</span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">${items}</div>
        </div>
      </div>
    `;
  }

  return {
    checkAndAlert,
    toggleSound,
    updateSoundBtnUI,
    isSoundEnabled,
    requestNotificationPermission
  };
})();

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
  const activeDayEquipe = typeof getActiveEquipeForDate === 'function' ? getActiveEquipeForDate(selectedDay) : equipe;
  activeDayEquipe.forEach(e => (groups[e.poste] || (groups[e.poste] = [])).push(e));

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
        const motifBadgeHtml = (cardProps.isMaladie && cardProps.motifMaladie)
          ? `<div class="motif-badge text-[9.5px] font-bold mt-1.5 p-1 px-2 rounded-lg bg-rose-50/90 border border-rose-200/80 text-rose-900 truncate" title="Motif : « ${escAttr(cardProps.motifMaladie)} »">🩺 « ${esc(cardProps.motifMaladie)} »</div>`
          : (cardProps.diff > 0 && cardProps.motif)
          ? `<div class="motif-badge text-[9.5px] font-bold mt-1.5 p-1 px-2 rounded-lg bg-amber-50/90 border border-amber-200/80 text-amber-900 truncate" title="Motif : « ${escAttr(cardProps.motif)} »">💬 « ${esc(cardProps.motif)} »</div>`
          : (cardProps.diff >= 15 ? `<div class="motif-badge text-[9px] font-semibold mt-1 px-1.5 py-0.5 rounded text-amber-700/70 italic">⚠️ Sans motif saisi</div>` : `<div class="motif-badge hidden"></div>`);
        html += `
          <button id="card-${escAttr(id)}" data-empid="${escAttr(id)}" class="staff-card ${escAttr(cardProps.finalSClass)} glass-card p-3.5 rounded-2xl text-left flex flex-col justify-between" style="min-height:7.5rem">
            <span class="status-dot" style="background:${escAttr(cardProps.finalDot)}"></span>
            <div class="arrive-time flex items-center justify-end gap-1">
              <span>${esc(cardProps.ha)}</span>
              ${(cardProps.ha && !cardProps.isMaladie && cardProps.dist !== null) ? `<span class="text-[9px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300/80 px-1 py-0.2 rounded" title="GPS certifié à ${cardProps.dist}m (±${cardProps.acc || 0}m)">📍${cardProps.dist}m</span>` : ""}
            </div>
            <div class="flex items-center gap-2.5 min-w-0 pr-4">
              ${getStaffAvatarHtml(emp.nom, emp.prenom, 'md')}
              <div class="min-w-0">
                <p class="text-[11px] font-extrabold uppercase truncate" style="color:#0f2744">${esc(emp.nom)}</p>
                <p class="text-[10px] font-semibold truncate mt-0.5" style="color:var(--muted3)">${esc(titleCase(emp.prenom))}</p>
              </div>
            </div>
            <div>
              <p class="status-text text-[11px] font-extrabold mt-2" style="${escAttr(cardProps.statusColor)}">${esc(cardProps.statusText)}</p>
              ${motifBadgeHtml}
            </div>
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

      card.className = `staff-card ${cardProps.finalSClass} glass-card p-3.5 rounded-2xl text-left flex flex-col justify-between`;
      const dot = card.querySelector('.status-dot');
      if (dot) dot.style.background = cardProps.finalDot;

      const arriveTime = card.querySelector('.arrive-time');
      if (arriveTime) {
        arriveTime.innerHTML = `<span>${esc(cardProps.ha)}</span>${(cardProps.ha && !cardProps.isMaladie && cardProps.dist !== null) ? `<span class="text-[9px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300/80 px-1 py-0.2 rounded" title="GPS certifié à ${cardProps.dist}m (±${cardProps.acc || 0}m)">📍${cardProps.dist}m</span>` : ""}`;
      }

      const statusText = card.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = cardProps.statusText;
        statusText.setAttribute('style', cardProps.statusColor);
      }

      const motifEl = card.querySelector('.motif-badge');
      if (motifEl) {
        if (cardProps.isMaladie && cardProps.motifMaladie) {
          motifEl.className = 'motif-badge text-[9.5px] font-bold mt-1.5 p-1 px-2 rounded-lg bg-rose-50/90 border border-rose-200/80 text-rose-900 truncate';
          motifEl.setAttribute('title', `Motif : « ${cardProps.motifMaladie} »`);
          motifEl.textContent = `🩺 « ${cardProps.motifMaladie} »`;
        } else if (cardProps.diff > 0 && cardProps.motif) {
          motifEl.className = 'motif-badge text-[9.5px] font-bold mt-1.5 p-1 px-2 rounded-lg bg-amber-50/90 border border-amber-200/80 text-amber-900 truncate';
          motifEl.setAttribute('title', `Motif : « ${cardProps.motif} »`);
          motifEl.textContent = `💬 « ${cardProps.motif} »`;
        } else if (cardProps.diff >= 15) {
          motifEl.className = 'motif-badge text-[9px] font-semibold mt-1 px-1.5 py-0.5 rounded text-amber-700/70 italic';
          motifEl.removeAttribute('title');
          motifEl.textContent = '⚠️ Sans motif saisi';
        } else {
          motifEl.className = 'motif-badge hidden';
          motifEl.textContent = '';
          motifEl.removeAttribute('title');
        }
      }
    });
  }

  // Déclenchement de la surveillance des alertes directes
  if (selectedDay === todayISO()) {
    LateAlertService.checkAndAlert(data || {});
  } else {
    LateAlertService.checkAndAlert({});
  }
}

function calculateEmpCardProps(emp, id, d, selectedDay, isPastDay) {
  const isMaladie = isExplicitMaladie(d);
  if (isMaladie) {
    const motifMaladie = String(d.motifMaladie || d.motif || "").trim();
    return {
      ha: "M",
      diff: 0,
      finalSClass: "status-maladie",
      finalDot: "#e11d48",
      statusText: "🩺 Arrêt Maladie",
      statusColor: "color:#be123c",
      motif: "",
      isMaladie: true,
      motifMaladie,
      dist: null,
      acc: null
    };
  }

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
  const menagePlan = isMenage ? getMenagePlanningInfo(emp, selectedDay) : null;

  const isExplicitOut = isExplicitOffOrOut(d);
  const rawHa = (isMenage && isExplicitOut) ? "" : safeTime(d.hA);
  const ha = rawHa || "";
  const hp = safeTime(d.hP) || (soumiaPlan && !soumiaPlan.off ? soumiaPlan.hP : (caissePlan ? caissePlan.hP : (isSec ? "09:00" : (cuisinePlan && !cuisinePlan.off ? cuisinePlan.hP : (menagePlan && !menagePlan.off ? menagePlan.hP : "")))));
  const diff = diffFromEntry({ hA: ha, hP: hp }, id, selectedDay);
  const sClass = getStatusClass(diff, !!d.off, !!ha);
  const dot = getDotColor(diff, !!d.off, !!ha);

  const isCuisinePlanOff = (isCuisine && cuisinePlan?.off);
  const isSoumiaPlanOff = (isSoumia && soumiaPlan?.off);
  const isMenagePlanOff = (isMenage && menagePlan?.off);

  // Règle Ménage : exclure 1 jour de repos OFF par semaine
  let menageIsRest = false;
  let menageIsAbsent = false;
  let menageStatusLabel = "";

  if (isMenage) {
    if (ha) {
      // Présent
    } else if (isMenagePlanOff) {
      // Repos prévu au planning S1/S2
      menageIsRest = true;
      menageStatusLabel = "Repos (Plan)";
    } else if (isExplicitOut) {
      // Vérifier si un autre jour de la semaine est son repos prévu
      const mon = weekStartMondayISO(selectedDay);
      let otherPlannedRest = false;
      for (let i = 0; i < 7; i++) {
        const curD = addDaysISO(mon, i);
        if (curD === selectedDay) continue;
        const curPlan = typeof getMenagePlanningInfo === 'function' ? getMenagePlanningInfo(emp, curD) : null;
        if (curPlan && curPlan.off) {
          otherPlannedRest = true;
          break;
        }
      }
      if (otherPlannedRest) {
        menageIsAbsent = true;
        menageStatusLabel = "⚠ Absent";
      } else {
        menageIsRest = true;
        menageStatusLabel = "Repos (OFF)";
      }
    } else if (isPastDay) {
      menageIsAbsent = true;
      menageStatusLabel = "⚠ Absent";
    }
  }

  const isAbsent = isMenage ? menageIsAbsent : (!ha && !d.off && isPastDay && !(isSec && isMonday) && !isCuisinePlanOff && !isSoumiaPlanOff);
  const finalSClass = isAbsent ? 'status-absent'
    : (isSec && isMonday && !ha || isCuisinePlanOff && !ha || isSoumiaPlanOff && !ha || (isMenage && menageIsRest))
    ? 'status-off' : sClass;
  const finalDot = isAbsent ? 'rgba(234,88,12,.90)'
    : (isSec && isMonday && !ha || isCuisinePlanOff && !ha || isSoumiaPlanOff && !ha || (isMenage && menageIsRest))
    ? 'rgba(168,85,247,.80)' : dot;

  let statusText = 'Attente', statusColor = 'color:var(--muted3)';
  if (isMenage) {
    if (ha) {
      statusText = "Présent"; statusColor = 'color:var(--ok)';
    } else if (menageIsRest) {
      statusText = menageStatusLabel; statusColor = 'color:var(--chip-r-fg)';
    } else if (menageIsAbsent) {
      statusText = "⚠ Absent"; statusColor = 'color:rgba(234,88,12,.90)';
    } else {
      statusText = menagePlan?.hP ? `Prévu ${menagePlan.hP}` : "Saisie manuelle";
      statusColor = 'color:var(--muted3)';
    }
  } else if (ha) {
    if (hp || isSec || cuisinePlan || soumiaPlan || caissePlan) {
      if (diff > 0) { statusText = `+${diff} min`; statusColor = 'color:var(--crit)'; }
      else { statusText = "À l'heure"; statusColor = 'color:var(--ok)'; }
    } else {
      statusText = "OK"; statusColor = 'color:var(--ok)';
    }
  } else if (d.off) {
    statusText = "OFF"; statusColor = 'color:rgba(148,163,184,.80)';
  } else if (isMenage) {
    if (menagePlan && menagePlan.off) {
      statusText = "Repos (Plan)"; statusColor = 'color:var(--chip-r-fg)';
    } else if (isPastDay) {
      statusText = "⚠ Absent"; statusColor = 'color:rgba(234,88,12,.90)';
    } else {
      statusText = menagePlan?.hP ? `Prévu ${menagePlan.hP}` : "Saisie manuelle";
      statusColor = 'color:var(--muted3)';
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

  const motif = (diff > 0 && !isMenage) ? String(d.motif || "").trim() : "";
  const dist = (typeof d.dist === "number") ? d.dist : null;
  const acc = (typeof d.acc === "number") ? d.acc : null;

  return { ha, diff, finalSClass, finalDot, statusText, statusColor, motif, dist, acc };
}

let _currentBilanWeek = 'all';
let _lastBilanMonth = null;
const DOW_SHORT_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function fmtShortDate(iso) {
  if (!iso || !iso.includes("-")) return iso || "";
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function formatMonthNameFR(mk) {
  if (!mk) return "";
  const [y, m] = mk.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  const name = dt.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  return titleCase(name) + " " + y;
}

function getMonthWeeksList(monthDates) {
  if (!monthDates || !monthDates.length) return [];
  const weeksMap = new Map();
  monthDates.forEach(dayISO => {
    const monISO = weekStartMondayISO(dayISO);
    if (!weeksMap.has(monISO)) {
      const sunISO = addDaysISO(monISO, 6);
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDaysISO(monISO, i));
      }
      weeksMap.set(monISO, {
        id: monISO,
        monday: monISO,
        sunday: sunISO,
        days
      });
    }
  });
  return Array.from(weeksMap.values());
}

window.setBilanWeekFilter = function(weekId) {
  _currentBilanWeek = weekId;
  renderReportView();
};

/**
 * Réutilisation optimisée de l'instance Chart.js (évite recréation du canvas)
 */
function renderChart(labels, lates, presences) {
  const chartCanvas = document.getElementById('trendsChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  const ptRadius = labels.length <= 7 ? 4 : 0;
  const ptHoverRadius = labels.length <= 7 ? 6 : 4;

  if (myChart) {
    myChart.data.labels = labels;
    myChart.data.datasets[0].data = lates;
    myChart.data.datasets[1].data = presences;
    myChart.data.datasets[0].pointRadius = ptRadius;
    myChart.data.datasets[0].pointHoverRadius = ptHoverRadius;
    myChart.data.datasets[1].pointRadius = ptRadius;
    myChart.data.datasets[1].pointHoverRadius = ptHoverRadius;
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
          tension: .38, borderWidth: 2.5, pointRadius: ptRadius, pointHoverRadius: ptHoverRadius, fill: true
        },
        {
          label: "Présences (nb)", data: presences,
          borderColor: 'rgba(5,150,105,.90)', backgroundColor: 'rgba(5,150,105,.08)',
          tension: .38, borderWidth: 2, pointRadius: ptRadius, pointHoverRadius: ptHoverRadius, fill: false
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
        x: { grid: { display: false }, ticks: { font: { size: 9, weight: '700' }, color: 'var(--muted2)' } }
      }
    }
  });
}

async function renderReportView() {
  const dateInput = document.getElementById('dashDate');
  const mk = monthKeyFromISO(dateInput.value);
  if (_lastBilanMonth !== mk) {
    _currentBilanWeek = 'all';
    _lastBilanMonth = mk;
  }

  const md = await getMonthData(mk);
  if (md.anyFail) {
    document.getElementById('dashBody').innerHTML = errorCard("Réseau instable : certaines journées manquantes. Change de mois puis reviens, ou vérifie ta connexion.");
    return;
  }

  const today = todayISO();
  const weeksList = getMonthWeeksList(md.dates);

  // Vérifier si la semaine existe toujours
  if (_currentBilanWeek !== 'all' && !weeksList.some(w => w.id === _currentBilanWeek)) {
    _currentBilanWeek = 'all';
  }

  // Affichage des filtres par semaine
  const chipsContainer = document.getElementById('bilanWeekChips');
  const activeBadge = document.getElementById('bilanFilterActiveBadge');
  if (chipsContainer) {
    const isAllActive = (_currentBilanWeek === 'all');
    let chipsHtml = `
      <button type="button" onclick="setBilanWeekFilter('all')"
        class="bilan-week-btn ${isAllActive ? 'active' : ''}">
        <span class="week-indicator"></span>
        <span>Tout le mois</span>
      </button>
    `;
    weeksList.forEach((w, idx) => {
      const isActive = (_currentBilanWeek === w.id);
      const isCurrent = (today >= w.monday && today <= w.sunday);
      chipsHtml += `
        <button type="button" data-week-id="${escAttr(w.id)}" onclick="setBilanWeekFilter(this.dataset.weekId)"
          class="bilan-week-btn ${isActive ? 'active' : ''}"
          title="Du Lundi ${fmtShortDate(w.monday)} au Dimanche ${fmtShortDate(w.sunday)}">
          <span class="week-indicator"></span>
          <span>Sem. ${idx + 1}</span>
          <span class="text-[9.5px] opacity-75 font-semibold">(${fmtShortDate(w.monday)}–${fmtShortDate(w.sunday)})</span>
          ${isCurrent ? '<span class="text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded-full font-black ml-0.5" style="background:rgba(5,150,105,.15);color:#065f46">En cours</span>' : ''}
        </button>
      `;
    });
    chipsContainer.innerHTML = chipsHtml;
  }

  let targetDays = md.dates;
  let labels = [];
  let chartTitleText = `Tendances du mois (${formatMonthNameFR(mk)})`;
  let rankingPeriodLabel = `Tout le mois`;
  let rankingPeriodSub = formatMonthNameFR(mk);

  if (_currentBilanWeek !== 'all') {
    const curW = weeksList.find(w => w.id === _currentBilanWeek);
    const curIdx = weeksList.findIndex(w => w.id === _currentBilanWeek);
    if (curW) {
      targetDays = curW.days;
      labels = curW.days.map(d => {
        const { y, m, d: day } = parseISO(d);
        const dt = new Date(Date.UTC(y, m - 1, day));
        return `${DOW_SHORT_FR[dt.getUTCDay()]} ${String(day).padStart(2, '0')}`;
      });
      chartTitleText = `Tendances · Semaine ${curIdx + 1} (Lun ${fmtShortDate(curW.monday)} ➔ Dim ${fmtShortDate(curW.sunday)})`;
      rankingPeriodLabel = `Semaine ${curIdx + 1}`;
      rankingPeriodSub = `Lun ${fmtShortDate(curW.monday)} – Dim ${fmtShortDate(curW.sunday)}`;
    }
  } else {
    labels = md.dates.map(d => d.split('-')[2]);
  }

  const chartTitleEl = document.getElementById('chartTitle');
  if (chartTitleEl) chartTitleEl.textContent = chartTitleText;

  if (activeBadge) {
    activeBadge.textContent = (_currentBilanWeek === 'all')
      ? "Tout le mois"
      : `${rankingPeriodLabel} (${rankingPeriodSub})`;
  }

  // Pré-charger mois et timelines nécessaires pour targetDays
  const monthsNeeded = new Set([mk]);
  targetDays.forEach(d => monthsNeeded.add(monthKeyFromISO(d)));
  const monthDataPacks = {};
  for (const m of monthsNeeded) {
    monthDataPacks[m] = (m === mk) ? md : await getMonthData(m);
  }

  const yearsNeeded = new Set([mk.slice(0, 4)]);
  targetDays.forEach(d => yearsNeeded.add(d.slice(0, 4)));
  const yearTimelinePacks = {};
  for (const y of yearsNeeded) {
    yearTimelinePacks[y] = await getMonthRCMap(y + '-01');
  }

  const activeBilanEquipe = typeof getActiveEquipeForMonth === 'function' ? getActiveEquipeForMonth(mk) : equipe;
  const stats = {};
  activeBilanEquipe.forEach(e => { const id = empIdOf(e); stats[id] = { info: e, present: 0, lateMin: 0, R: 0, C: 0, M: 0, ABSENT: 0 }; });
  const dailyLates = [], dailyPresence = [];

  targetDays.forEach(dayISO => {
    if (dayISO > today || isExcluded(dayISO)) {
      dailyLates.push(0);
      dailyPresence.push(0);
      return;
    }
    const dMk = monthKeyFromISO(dayISO);
    const dYr = dayISO.slice(0, 4);
    const curPack = monthDataPacks[dMk] || { presByDay: {}, punchByDay: {}, motifsByDay: {} };
    const curTimeline = yearTimelinePacks[dYr] || { rcByEmpDay: {}, startMap: {} };

    const merged = mergeDay(curPack.presByDay?.[dayISO], curPack.punchByDay?.[dayISO], curPack.motifsByDay?.[dayISO]);
    let tL = 0, tP = 0;

    activeBilanEquipe.forEach(emp => {
      const id = empIdOf(emp);
      const ev = evaluateEmployeeDay(emp, dayISO, merged[id] || null, curTimeline.rcByEmpDay?.[id]?.[dayISO], curTimeline.startMap?.[id]);
      if (ev.type === "maladie") {
        stats[id].M++;
      } else if (ev.isPresent) {
        stats[id].present++;
        stats[id].lateMin += ev.diff;
        tL += ev.diff;
        tP++;
      } else if (ev.rc && stats[id][ev.rc] !== undefined) {
        stats[id][ev.rc]++;
      }
    });

    dailyLates.push(tL);
    dailyPresence.push(tP);
  });

  renderChart(labels, dailyLates, dailyPresence);

  function isRankedPoste(poste) {
    const p = String(poste || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return p === "SERVICE" || p === "BAR";
  }

  // ─── F8 : CALCUL ET DÉTECTION DES ANOMALIES RH (ABSENCES & RETARDS CHRONIQUES) ───
  const anomalies = [];
  activeBilanEquipe.forEach(emp => {
    const id = empIdOf(emp);
    const isMenage = isMenageStaff(emp) || isMenageStaff(id);

    let consecutiveAbsent = 0;
    let maxConsecutiveAbsent = 0;
    let presentCount = 0;
    let lateCount = 0;
    let totalLateMin = 0;

    targetDays.forEach(dayISO => {
      if (dayISO > today || isExcluded(dayISO)) return;
      const dMk = monthKeyFromISO(dayISO);
      const dYr = dayISO.slice(0, 4);
      const curPack = monthDataPacks[dMk] || { presByDay: {}, punchByDay: {}, motifsByDay: {} };
      const curTimeline = yearTimelinePacks[dYr] || { rcByEmpDay: {}, startMap: {} };

      const merged = mergeDay(curPack.presByDay?.[dayISO], curPack.punchByDay?.[dayISO], curPack.motifsByDay?.[dayISO]);
      const ev = evaluateEmployeeDay(emp, dayISO, merged[id] || null, curTimeline.rcByEmpDay?.[id]?.[dayISO], curTimeline.startMap?.[id]);
      if (ev.type === "avant" || ev.type === "future" || ev.type === "exclu") return;

      if (ev.isPresent) {
        presentCount++;
        consecutiveAbsent = 0;
        if (ev.isLate) {
          lateCount++;
          totalLateMin += ev.diff;
        }
      } else if (ev.type === "repos" || ev.type === "conge" || ev.type === "maladie") {
        // Le jour de repos OFF, congé ou arrêt maladie réinitialise les absences consécutives
        consecutiveAbsent = 0;
      } else {
        consecutiveAbsent++;
        if (consecutiveAbsent > maxConsecutiveAbsent) {
          maxConsecutiveAbsent = consecutiveAbsent;
        }
      }
    });

    // 1. Alerte Absences Consécutives / Inexpliquées (>= 2 jours)
    if (maxConsecutiveAbsent >= 2) {
      anomalies.push({
        emp,
        severity: maxConsecutiveAbsent >= 3 ? "crit" : "amber",
        type: "absences",
        title: `${maxConsecutiveAbsent} absences consécutives`,
        detail: `Ni pointage ni repos posé sur ${maxConsecutiveAbsent} jours consécutifs`,
        metric: `${maxConsecutiveAbsent} j`,
        badgeText: maxConsecutiveAbsent >= 3 ? "🚨 Critique" : "⚠️ Attention"
      });
    }

    // 2. Alerte Retard Chronique (Taux de retard >= 35% avec au moins 2 retards)
    const lateRate = presentCount > 0 ? (lateCount / presentCount) : 0;
    if (presentCount >= 3 && lateCount >= 2 && lateRate >= 0.35 && !isMenage) {
      const pct = Math.round(lateRate * 100);
      anomalies.push({
        emp,
        severity: lateRate >= 0.50 ? "crit" : "amber",
        type: "retards",
        title: `Retard chronique (${pct}%)`,
        detail: `${lateCount} retards sur ${presentCount} présences (cumul +${totalLateMin}m)`,
        metric: `+${totalLateMin}m`,
        badgeText: lateRate >= 0.50 ? "🚨 Récidive" : "⚠️ À surveiller"
      });
    }
  });

  anomalies.sort((a, b) => (a.severity === "crit" ? -1 : 1));

  const rankedStats = Object.values(stats).filter(s => isRankedPoste(s.info?.poste));
  const lateList = rankedStats.filter(s => s.lateMin > 0).sort((a, b) => b.lateMin - a.lateMin);
  const goodList = rankedStats.filter(s => s.lateMin === 0 && s.present > 0).sort((a, b) => b.present - a.present);
  const maxLate = lateList.length ? lateList[0].lateMin : 0;

  let html = '<div class="space-y-6">';

  // ─── AFFICHAGE EN-TÊTE F8 : DÉTECTION ANOMALIES RH ───
  html += `<div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="smallCaps" style="color:var(--text)">⚠️ Alertes RH & Détection d'Anomalies</div>
        <div style="width:20px;height:2px;border-radius:999px;background:var(--accent)"></div>
      </div>
      <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full"
            style="background:${anomalies.length ? 'rgba(220,38,38,.12)' : 'rgba(5,150,105,.12)'};color:${anomalies.length ? 'var(--crit)' : 'var(--ok)'}">
        ${anomalies.length ? `${anomalies.length} alerte(s)` : 'Régulier ✓'}
      </span>
    </div>`;

  if (!anomalies.length) {
    html += `
      <div class="glass-card p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm"
           style="background:rgba(5,150,105,.06);border-color:rgba(5,150,105,.22);color:var(--ok)">
        <div class="flex items-center gap-2.5">
          <span class="text-base">✨</span>
          <span class="text-[11px] font-extrabold">Aucune absence consécutive anormale ni retard chronique détecté sur cette période.</span>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black shrink-0" style="background:rgba(5,150,105,.15)">Conforme</span>
      </div>`;
  } else {
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;
    anomalies.forEach(a => {
      const isCrit = (a.severity === "crit");
      const bgCard = isCrit ? "rgba(254,242,242,.88)" : "rgba(255,251,235,.88)";
      const bdrCard = isCrit ? "rgba(239,68,68,.32)" : "rgba(245,158,11,.32)";
      const colorTitle = isCrit ? "var(--crit)" : "var(--amber)";
      const badgeBg = isCrit ? "rgba(220,38,38,.14)" : "rgba(245,158,11,.14)";

      html += `
        <div class="glass-card p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between"
             style="background:${bgCard};border-color:${bdrCard};box-shadow:0 3px 12px rgba(0,0,0,.03)"
             data-nom="${escAttr(a.emp.nom)}" data-prenom="${escAttr(a.emp.prenom)}"
             onclick="openCalendarModal(this.dataset.nom, this.dataset.prenom)"
             title="Cliquer pour inspecter le calendrier">
          <div class="flex items-start justify-between gap-2.5 mb-2">
            <div class="flex items-center gap-2.5 min-w-0">
              ${getStaffAvatarHtml(a.emp.nom, a.emp.prenom, 'sm')}
              <div class="min-w-0">
                <div class="text-[11px] font-extrabold truncate" style="color:#0f2744">
                  ${esc(a.emp.nom)} <span style="opacity:.6;font-size:10.5px">${esc(titleCase(a.emp.prenom))}</span>
                </div>
                <div class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md inline-block mt-0.5" style="background:rgba(59,130,246,.10);color:#2563eb">
                  ${esc(a.emp.poste)}
                </div>
              </div>
            </div>
            <span class="text-[9.5px] font-black px-2 py-0.5 rounded-full whitespace-nowrap" style="background:${badgeBg};color:${colorTitle}">
              ${esc(a.badgeText)}
            </span>
          </div>

          <div class="pt-2 border-t" style="border-color:${bdrCard}">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10.5px] font-extrabold" style="color:${colorTitle}">
                ${a.type === 'absences' ? '🛑' : '⏰'} ${esc(a.title)}
              </span>
              <span class="text-[11px] font-black" style="color:${colorTitle}">${esc(a.metric)}</span>
            </div>
            <div class="text-[9.5px] font-semibold mt-0.5 leading-snug" style="color:var(--muted3)">
              ${esc(a.detail)}
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="smallCaps" style="color:rgba(220,38,38,.80)">Top retardataires · Service & Bar</div>
        <div style="width:20px;height:2px;border-radius:999px;background:rgba(220,38,38,.40)"></div>
      </div>
      <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full" style="background:rgba(220,38,38,.10);color:var(--crit)">
        ${esc(rankingPeriodLabel)} · ${esc(rankingPeriodSub)}
      </span>
    </div>`;
  if (!lateList.length) {
    html += `<div class="glass-card p-5 rounded-2xl text-center text-[12px] font-extrabold" style="color:var(--muted3)">
      ${_currentBilanWeek === 'all' ? 'Aucun retard enregistré ce mois 🎉' : 'Aucun retard enregistré cette semaine 🎉'}
    </div>`;
  } else {
    lateList.slice(0, 6).forEach(s => {
      const pct = maxLate ? Math.max(6, Math.round((s.lateMin / maxLate) * 100)) : 0;
      html += `<div class="glass-card p-4 rounded-2xl mb-3">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2.5 min-w-0">
            ${getStaffAvatarHtml(s.info.nom, s.info.prenom, 'sm')}
            <div class="min-w-0">
              <span class="text-[12px] font-extrabold truncate" style="color:#0f2744">${esc(s.info.nom)} <span style="opacity:.55;font-size:11px">${esc(titleCase(s.info.prenom))}</span></span>
              <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ml-1" style="background:rgba(59,130,246,.10);color:#2563eb">${esc(s.info.poste)}</span>
            </div>
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
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="smallCaps" style="color:rgba(5,150,105,.85)">Les plus disciplinés · Service & Bar</div>
        <div style="width:20px;height:2px;border-radius:999px;background:rgba(5,150,105,.40)"></div>
      </div>
      <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full" style="background:rgba(5,150,105,.10);color:var(--ok)">
        ${esc(rankingPeriodLabel)} · ${esc(rankingPeriodSub)}
      </span>
    </div>`;
  if (!goodList.length) {
    html += `<div class="glass-card p-5 rounded-2xl text-center text-[12px] font-extrabold" style="color:var(--muted3)">
      ${_currentBilanWeek === 'all' ? 'Aucune présence "OK" trouvée ce mois' : 'Aucune présence "OK" trouvée cette semaine'}
    </div>`;
  } else {
    goodList.slice(0, 6).forEach(s => {
      html += `<div class="glass-card p-4 rounded-2xl mb-3 flex justify-between items-center">
        <div class="flex items-center gap-2.5 min-w-0">
          ${getStaffAvatarHtml(s.info.nom, s.info.prenom, 'sm')}
          <div class="min-w-0">
            <span class="text-[12px] font-extrabold truncate" style="color:#0f2744">${esc(s.info.nom)} <span style="opacity:.55;font-size:11px">${esc(titleCase(s.info.prenom))}</span></span>
            <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ml-1" style="background:rgba(59,130,246,.10);color:#2563eb">${esc(s.info.poste)}</span>
          </div>
        </div>
        <span class="text-[12px] font-extrabold flex-shrink-0 ml-2" style="color:var(--ok)">${esc(s.present)} j ✓</span>
      </div>`;
    });
  }
  html += `</div></div>`;
  document.getElementById('dashBody').innerHTML = html;
}

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

window.openMaladieCertPreview = function(empId, dayISO) {
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

  const emp = getEmpById(empId);
  const fullName = `${emp.nom || empId} ${titleCase(emp.prenom || "")}`.trim();

  if (imgEl) imgEl.src = cert;
  if (titleEl) titleEl.textContent = fullName + (emp.poste ? ` · ${emp.poste}` : "");
  if (subEl) subEl.textContent = `Arrêt Maladie (M) · Date : ${fmtFR(dayISO)}`;

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
        pWin.document.write(`<!DOCTYPE html><html><head><title>Certificat · ${fullName}</title><style>body{margin:20px;text-align:center;font-family:sans-serif}img{max-width:100%;max-height:90vh;object-fit:contain}</style></head><body><h2>Certificat Médical · ${fullName}</h2><p>Arrêt maladie du ${fmtFR(dayISO)}</p><img src="${cert}" onload="window.print();window.close();" /></body></html>`);
        pWin.document.close();
      }
    };
  }

  if (modal) {
    modal.classList.remove("hidden", "modal-closing");
    modal.classList.add("modal-active");
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
          <div class="relative shrink-0 cursor-pointer group" onclick="openMaladieCertPreview('${escAttr(r.empId)}','${escAttr(r.startDay)}')">
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
              <button type="button" onclick="openMaladieCertPreview('${escAttr(r.empId)}','${escAttr(r.startDay)}')"
                class="btn-action px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold"
                style="background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.35);color:#065f46">
                👁️ Contrôler
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

