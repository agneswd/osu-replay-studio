/* Each component renders a complete snapshot. No network, polling, or wall clock. */
(() => {
  let graphValues;
  let graphColor;
  const id = location.pathname.split("/").at(-2);
  const el = (name) => document.getElementById(name);
  const text = (name, value) => {
    const node = el(name);
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  };
  const width = (name, value) => {
    const node = el(name);
    if (node) node.style.width = `${value}%`;
  };

  let healthRanks;
  function fitRankLayout(profile) {
    const labels = [profile?.countryRank, profile?.rank].map(value => value > 0 ? `#${value.toLocaleString()}` : "");
    const key = labels.join("|");
    if (key === healthRanks) return;
    healthRanks = key;
    const measure = document.createElement("span");
    measure.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
    document.body.append(measure);
    const widths = labels.map(label => {
      measure.textContent = label;
      return measure.getBoundingClientRect().width;
    });
    measure.remove();
    // Follow each rank independently. Keep the curves clear of map stats and score.
    const left = Math.round(Math.max(440, Math.min(540, 560 - widths[0] - 6)));
    const right = Math.round(Math.min(840, Math.max(740, 724 + widths[1] + 6)));
    if (id === "player-info") {
      document.documentElement.style.setProperty("--left-arch", `${left - 86}px`);
      document.documentElement.style.setProperty("--right-arch", `${right + 86}px`);
      return;
    }
    const leftCurve = `C${left - 40} 12 ${left - 40} 54 ${left} 54`;
    const rightCurve = `C${right + 40} 54 ${right + 40} 12 ${right + 80} 12`;
    document.querySelector(".hp-track").setAttribute("d", `M18 12 H${left - 80} ${leftCurve} H${right} ${rightCurve} H1262`);
    el("healthFill").setAttribute("d", `M640 54 H${left} C${left - 40} 54 ${left - 40} 12 ${left - 80} 12 H18`);
    el("healthFillRight").setAttribute("d", `M640 54 H${right} ${rightCurve} H1262`);
  }

  const gradeLabel = (grade) => ({ SSH: "SS", SH: "S", X: "SS", XH: "SS" })[grade] || grade;
  const getGradeColor = (grade, mods) => {
    if (["SS", "S", "SSH", "SH", "X", "XH"].includes(grade)) {
      return grade.endsWith("H") || /HD|FL/.test(mods || "") ? "#D8D8D8" : "#FFD700";
    }
    const colors = {
      A: "#91ed95",
      B: "#2196F3",
      C: "#9C27B0",
      D: "#F44336",
    };
    return colors[grade] || "#999";
  };

  const MOD_ASSET_NAMES = {
    EZ: "easy",
    NF: "no-fail",
    HT: "half-time",
    HR: "hard-rock",
    SD: "sudden-death",
    PF: "perfect",
    DT: "double-time",
    NC: "nightcore",
    HD: "hidden",
    FL: "flashlight",
    RX: "relax",
    AP: "autopilot",
    SO: "spun-out",
    MR: "mirror",
    FI: "fade-in",
    TD: "touch-device",
    CL: "classic",
    V2: "score-v2",
    NM: "no-mod",
    DA: "difficulty-adjust",
    AS: "adaptive-speed",
    CS: "constant-speed",
  };

  const MOD_CATEGORY_COLORS = {
    EZ: { bg: "#99FF4D", fg: "dark" },
    NF: { bg: "#99FF4D", fg: "dark" },
    HT: { bg: "#99FF4D", fg: "dark" },
    DC: { bg: "#99FF4D", fg: "dark" },
    HR: { bg: "#FF4D4D", fg: "light" },
    SD: { bg: "#FF4D4D", fg: "light" },
    PF: { bg: "#FF4D4D", fg: "light" },
    DT: { bg: "#FF4D4D", fg: "light" },
    NC: { bg: "#7A5CFF", fg: "light" },
    FL: { bg: "#FF4D4D", fg: "light" },
    HD: { bg: "#FFCC22", fg: "dark" },
    RX: { bg: "#4DC3FF", fg: "light" },
    AP: { bg: "#4DC3FF", fg: "light" },
    MR: { bg: "#8C5CFF", fg: "light" },
    V2: { bg: "#8C5CFF", fg: "light" },
    FI: { bg: "#FF4D9A", fg: "light" },
  };

  const getAdapterBaseUrl = () => {
    try {
      const script =
        document.currentScript ||
        Array.from(document.querySelectorAll("script")).find(
          (s) => s.src && s.src.includes("overlay-adapter.js"),
        );
      if (script && script.src) {
        return new URL(".", script.src).href;
      }
    } catch (_) {}
    return location.href;
  };

  const formatSpaces = (value) =>
    Math.round(Number(value) || 0)
      .toLocaleString("en-US")
      .replaceAll(",", " ");

  // Fixed digit columns. Every position comes from the supplied replay snapshot.
  const odometer = (name, value, counter, decimals = 0) => {
    const node = el(name);
    if (!node) return;
    const format = (n) => decimals ? n.toFixed(decimals) : formatSpaces(n);
    const next = format(value);
    const previous = format(counter?.from ?? value).padStart(next.length, " ").slice(-next.length);
    const progress = counter?.to === Number(value.toFixed(decimals)) ? counter.progress : 1;
    const key = `${next}|${previous}|${progress}`;
    if (node.dataset.valueKey === key) return;
    node.dataset.valueKey = key;
    const eased = 1 - (1 - Math.max(0, Math.min(1, progress))) ** 3;
    const measure = value => [...value].reduce((width, char) => width + (/\d/.test(char) ? .62 : .25), 0);
    const fromWidth = measure(format(counter?.from ?? value));
    node.style.width = `${fromWidth + (measure(next) - fromWidth) * eased}em`;
    node.classList.add("odometer");
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", next);
    node.replaceChildren();
    [...next].forEach((char, i) => {
      const cell = document.createElement("span");
      cell.className = /\d/.test(char) ? "odometer-digit" : "odometer-mark";
      cell.setAttribute("aria-hidden", "true");
      if (/\d/.test(char) && previous[i] !== char && eased < 1) {
        const ribbon = document.createElement("span");
        ribbon.className = "odometer-ribbon";
        const up = value >= counter.from;
        for (const digit of up ? [previous[i], char] : [char, previous[i]]) {
          const face = document.createElement("span");
          face.textContent = digit;
          ribbon.append(face);
        }
        ribbon.style.transform = `translateY(${-100 * (up ? eased : 1 - eased)}%)`;
        cell.append(ribbon);
      } else {
        cell.textContent = char;
      }
      node.append(cell);
    });
  };

  const formatScore = (score) => {
    if (score >= 1000000) {
      return (score / 1000000).toFixed(2) + "M";
    }
    if (score >= 10000) {
      return (score / 1000).toFixed(1) + "K";
    }
    return formatSpaces(score);
  };

  const setAvatar = (node, url) => {
    if (!node) return;
    if (url) {
      if (node.getAttribute("src") !== url) node.src = url;
      node.hidden = false;
    } else {
      node.removeAttribute("src");
      node.hidden = true;
    }
  };

  const renderModBadges = (container, modStr) => {
    if (!container) return;
    container.innerHTML = "";
    if (!modStr || modStr === "NM" || modStr === "None") return;
    const mods = modStr.match(/.{1,2}/g) || [];
    const baseUrl = getAdapterBaseUrl();
    for (let i = 0; i < mods.length; i++) {
      const mod = mods[i].toUpperCase();
      const asset = MOD_ASSET_NAMES[mod];
      const color = MOD_CATEGORY_COLORS[mod] || { bg: "#8C5CFF", fg: "light" };

      const badge = document.createElement("div");
      badge.className = "mod-badge";
      badge.style.backgroundColor = color.bg;
      badge.style.zIndex = i;
      badge.title = mod;

      if (asset) {
        const img = document.createElement("img");
        img.src = new URL(`assets/mods/mod-${asset}.svg`, baseUrl).href;
        img.alt = mod;
        if (color.fg === "dark") {
          img.style.filter = "brightness(0.15)";
        }
        badge.appendChild(img);
      } else {
        badge.textContent = mod;
        badge.style.color = color.fg === "dark" ? "#221510" : "#fff";
      }
      container.appendChild(badge);
    }
  };

  window.renderReplayFrame = (data) => {
    const g = data.gameplay;
    const hp =
      g.hp.normal === null ? null : Math.max(0, Math.min(100, g.hp.normal));
    const health = el("healthContainer");
    if (health) {
      health.classList.toggle("unavailable", hp === null);
      if (el("healthValue")) {
        el("healthValue").style.display = hp === null ? "block" : "none";
      }
      health.setAttribute(
        "aria-label",
        hp === null ? "HP unavailable" : `Health ${Math.round(hp)} percent`,
      );
      if (el("healthFill")) {
        fitRankLayout(data.userProfile);
        for (const id of ["healthFill", "healthFillRight"]) {
          el(id).style.strokeDasharray = `${hp ?? 0} 100`;
          el(id).style.opacity = hp > 0 ? "1" : "0";
        }
      }
    }
    document
      .querySelectorAll(".hidden")
      .forEach((node) => node.classList.remove("hidden"));

    odometer("ppCurrent", g.pp.current, data.counters?.pp);
    odometer("ppMax", g.pp.fc);
    odometer("comboValue", g.combo.current, data.counters?.combo);
    odometer("comboMax", g.combo.max, data.counters?.maxCombo);
    if (el("comboPeak")) el("comboPeak").hidden = g.combo.current >= g.combo.max;
    odometer("accuracyValue", g.accuracy, data.counters?.accuracy, 2);
    odometer("hit100", g.hits["100"], data.counters?.hit100);
    odometer("hit50", g.hits["50"], data.counters?.hit50);
    odometer("hitMiss", g.hits["0"], data.counters?.hitMiss);
    odometer("hitSB", g.hits.sliderBreaks, data.counters?.hitSB);
    for (const name of ["hit100", "hit50", "hitMiss", "hitSB"]) {
      const count = el(name);
      if (count) count.parentElement.classList.toggle("empty", Number(count.textContent) === 0);
    }

    width("healthBarFill", g.hp.normal ?? 0);
    text("healthValue", hp === null ? "HP unavailable" : `${Math.round(hp)}%`);
    text("playerName", g.name);
    text("scoreValue", formatSpaces(g.score));
    text("gradeLabel", gradeLabel(g.grade));
    const gradeNode = el("gradeLabel");
    if (gradeNode) gradeNode.style.color = getGradeColor(g.grade, data.menu?.mods?.str);
    text("starValue", data.menu.bm.stats.SR.toFixed(2));
    text("bpmValue", Math.round(data.menu.bm.stats.BPM.common));

    // Player Info
    if (id === "player-info") {
      fitRankLayout(data.userProfile);
      setAvatar(el("playerAvatar"), data.userProfile?.avatar);
      for (const [target, value, container] of [
        ["playerCountryRank", data.userProfile?.countryRank, "playerCountryRank"],
        ["playerRank", data.userProfile?.rank, "playerGlobalRank"],
      ]) {
        el(container).hidden = !(value > 0);
        text(target, value > 0 ? `#${value.toLocaleString()}` : "");
      }
      const country = el("playerCountry");
      const code = data.userProfile?.country?.toUpperCase();
      country.hidden = !/^[A-Z]{2}$/.test(code || "");
      country.textContent = country.hidden ? "" : String.fromCodePoint(...[...code].map((c) => c.charCodeAt(0) + 127397));
    }

    // Keep DOM rows stable while their score values and positions change.
    if (id === "leaderboard") {
      const rows = data.leaderboard?.rows || [];
      const container = el("leaderRows");
      const pinned = rows.some(row => row.current && row.slot === 7);
      const existing = new Map([...container.children].map(node => [node.dataset.id, node]));
      for (const row of rows) {
        let node = existing.get(row.id);
        if (!node) {
          node = document.createElement("div");
          node.dataset.id = row.id;
          node.innerHTML = '<div class="score-content"><div class="rank"></div><div class="avatar-container"><img class="player-avatar" alt=""><div class="grade"></div></div><div class="name-stats-section"><div class="name"></div><div class="stats-row"><span class="score"></span><span class="combo"></span><span class="misses"></span></div></div><div class="pp-acc-section"><div class="pp"></div><div class="accuracy"></div></div></div><div class="mods"></div>';
        }
        existing.delete(row.id);
        node.className = `score-entry${row.current ? " replay" : ""}`;
        const put = (selector, value) => { const child = node.querySelector(selector); if (child.textContent !== String(value)) child.textContent = value; };
        put(".rank", row.position || "");
        put(".name", row.name);
        put(".score", formatScore(row.score));
        put(".combo", `${row.combo}x`);
        put(".misses", row.misses || "");
        put(".pp", row.pp == null ? "" : `${Math.round(row.pp)}pp`);
        put(".accuracy", `${row.accuracy.toFixed(2)}%`);
        put(".grade", gradeLabel(row.grade));
        node.querySelector(".grade").style.color = getGradeColor(row.grade, row.mods);
        setAvatar(node.querySelector(".player-avatar"), row.avatar);
        if (node.dataset.mods !== row.mods) {
          renderModBadges(node.querySelector(".mods"), row.mods);
          node.dataset.mods = row.mods;
        }
        node.style.transform = `translateY(${(row.slot ?? rows.indexOf(row)) * 48}px)`;
        node.style.opacity = String((row.opacity ?? 1) * (row.current ? 1 : .52) *
          (pinned && !row.current ? Math.max(0, Math.min(1, 7 - row.slot)) : 1));
        node.style.zIndex = row.current ? "1" : "0";
        if (node.parentElement !== container) container.append(node);
      }
      for (const node of existing.values()) node.remove();
      document.querySelector(".leaderboard-caption").textContent = data.leaderboard?.caption || "Online scores unavailable";
    }

    if (id === "key-overlay") {
      for (const [index, lane] of (data.keys || []).entries()) {
        const node = el(`key${index + 1}`);
        node.classList.toggle("pressed", lane.pressed);
        node.querySelector(".key-count").textContent = lane.count;
        node.querySelector(".key-bpm").textContent = lane.bpm;
        const history = node.querySelector(".key-holds");
        history.replaceChildren(...lane.holds.map(hold => {
          const bar = document.createElement("div");
          bar.className = "key-hold";
          bar.style.left = `${hold.start * 100}%`;
          bar.style.width = `${Math.max(.012, hold.end - hold.start) * 100}%`;
          return bar;
        }));
      }
    }

    // Hit Error Bar
    if (id === "hit-error-bar") {
      const errors = data.hitErrors;
      const windows = data.timing?.windows ?? { great: 40, ok: 120, meh: 200, inclusive: true };
      const scale = 192 / windows.meh;
      const edges = [0, 50 - windows.ok / windows.meh * 50, 50 - windows.great / windows.meh * 50,
        50 + windows.great / windows.meh * 50, 50 + windows.ok / windows.meh * 50, 100];
      document.querySelector(".timing-zones").style.background = `linear-gradient(to right, ${
        ["#e7c80b", "#09ec39", "#2499bc", "#09ec39", "#e7c80b"].map((color, i) => `${color} ${edges[i]}% ${edges[i + 1]}%`).join(",")})`;
      const within = (error, limit) => windows.inclusive ? error <= limit : error < limit;
      const average = data.timing?.average ?? errors.reduce((a, b) => a + b, 0) / (errors.length || 1);
      document.querySelector(".pointer").style.left = `${Math.max(0, Math.min(100, 50 + average / windows.meh * 50))}%`;
      odometer("urValue", Math.round(data.play.unstableRate), data.counters?.ur);
      text("earlyValue", errors.filter((e) => e < 0).length);
      text("lateValue", errors.filter((e) => e >= 0).length);
      text(
        "avgValue",
        `${(errors.reduce((a, b) => a + b, 0) / (errors.length || 1)).toFixed(1)}ms`,
      );
      const canvas = el("timingTicks");
      const context = canvas.getContext("2d");
      const ticks = data.timing?.ticks ?? errors.map(error => ({ error, opacity: .7, height: 1 }));
      context.setTransform(2, 0, 0, 2, 0, 0);
      context.clearRect(0, 0, 384, 32);
      const shape = tick => {
        const x = Math.max(2, Math.min(382, 192 + tick.error * scale));
        const height = 22 * (tick.height ?? 1);
        context.beginPath(); context.roundRect(x - 2, 16 - height / 2, 4, height, 1);
      };
      // Shadows separate ticks from the bar. Additive color makes overlapping ticks approach white.
      context.globalCompositeOperation = "source-over";
      context.shadowColor = "#000"; context.shadowBlur = 3; context.shadowOffsetY = 1;
      context.fillStyle = "#000";
      // Remove the shadow's solid center before adding color. Fading ticks keep their hue.
      for (const tick of ticks) { context.globalAlpha = tick.opacity ** 2; shape(tick); context.fill(); }
      context.shadowBlur = 0; context.shadowOffsetY = 0;
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = 1;
      for (const tick of ticks) { shape(tick); context.fill(); }
      context.globalCompositeOperation = "lighter";
      for (const tick of ticks) {
        const error = Math.abs(tick.error);
        context.fillStyle = within(error, windows.great) ? "#45a8c6" : within(error, windows.ok) ? "#30e157" : "#ebd132";
        context.globalAlpha = tick.opacity; shape(tick); context.fill();
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    }

    // Progress Graph
    if (id === "progress-graph") {
      const values = data.menu.pp.strains,
        max = Math.max(1, ...values);
      const rgb =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent-rgb")
          .trim() || "212, 215, 222";
      if (graphValues !== values || graphColor !== rgb) {
      graphValues = values; graphColor = rgb;
      for (const [name, color] of [
        ["strainCanvas", `rgba(${rgb}, 0.32)`],
        ["progressCanvas", `rgba(${rgb}, 0.92)`],
      ]) {
        const canvas = el(name);
        canvas.width = 300;
        canvas.height = 160;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 160);
        values.forEach((v, i) =>
          ctx.lineTo(
            (i / Math.max(1, values.length - 1)) * 300,
            158 - (v / max) * 154,
          ),
        );
        ctx.lineTo(300, 160);
        ctx.closePath();
        ctx.fill();
      }
      }
      const history = el("judgementHistory");
      const historyData = data.judgementHistory;
      history.style.opacity = String(historyData?.progress ?? 0);
      history.style.transform = `scaleX(${historyData?.progress ?? 0})`;
      history.replaceChildren(...(historyData?.markers ?? []).map(marker => {
        const node = document.createElement("i");
        node.className = "judgement-mark";
        const color = marker.grade === "0" ? "miss" : marker.grade === "50" ? "meh" : "ok";
        node.style.cssText = `left:${Math.max(0, Math.min(100, marker.position * 100))}%;background:var(--hit-${color});opacity:${marker.progress};transform:scaleY(${marker.progress})`;
        return node;
      }));
      width(
        "progressOverlay",
        Math.max(
          0,
          Math.min(
            100,
            Math.max(0, (data.menu.bm.time.current / data.menu.bm.time.mp3) * 100),
          ),
        ),
      );
    }
  };
})();
