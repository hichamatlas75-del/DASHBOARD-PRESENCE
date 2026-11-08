/**
 * Vue Jour • Supervision en Direct & Alertes Retards
 * Direction Hub • Grey Corner
 */

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
