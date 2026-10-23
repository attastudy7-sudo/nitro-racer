"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const store = { get: k => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch { } } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const paintOf = id => PAINTS.find(p => p.id === id) || PAINTS[0];
  const carOf = id => VEHICLES.find(v => v.id === id) || VEHICLES[0];
  const carSVG = (vid, pid) => { const p = paintOf(pid); return VehicleArt.previewSVG(vid, p.paint, p.accent); };
  const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || "th");

  // ---------------------------------------------------------------- audio (synth, no assets)
  const sfx = (() => {
    let ctx = null, muted = store.get("nr.mute") === "1";
    const ac = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
    function tone(f, d, type = "sine", vol = .06, slide = 0) {
      if (muted) return;
      try {
        const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
        o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d);
      } catch { }
    }
    return {
      key: () => {
        if (muted) return;
        try {
          const c = ac();
          if (!sfx._b) { const n = Math.floor(c.sampleRate * .022), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * .14)); sfx._b = b; }
          const s = c.createBufferSource(), g = c.createGain(); s.buffer = sfx._b; s.playbackRate.value = .85 + Math.random() * .3; g.gain.value = .09; s.connect(g).connect(c.destination); s.start();
        } catch { }
      },
      err: () => tone(120, .12, "sawtooth", .05),
      beep: () => tone(520, .18, "square", .05),
      go: () => tone(1040, .4, "square", .06),
      nitro: () => tone(300, .35, "sawtooth", .04, 4),
      fin: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, .25, "triangle", .07), i * 110)); },
      get muted() { return muted }, toggle() { muted = !muted; store.set("nr.mute", muted ? "1" : "0"); return muted; },
    };
  })();

  // ---------------------------------------------------------------- state
  let ws, me = null, token = store.get("nr.token"), clockOff = 0, bestRtt = Infinity, retry = 0, mode = "quote";
  let lobby = null, race = null, view = null, rafId = 0, screen = "login", lbKind = "speed", lastLB = null, selCar = null, selPaint = null;

  const toast = (m) => { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600); };
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  // ---------------------------------------------------------------- connection
  function connect() {
    ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");
    ws.onopen = () => {
      retry = 0; $("conn").hidden = true;
      if (token) send({ t: "hello", token }); else show("login");
      for (let i = 0; i < 4; i++) setTimeout(() => send({ t: "ping", c: performance.now() }), i * 250);
      clearInterval(connect.pi); connect.pi = setInterval(() => send({ t: "ping", c: performance.now() }), 5000);
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data) } catch { return } onMsg(m); };
    ws.onclose = () => {
      clearInterval(connect.pi); $("conn").hidden = false;
      if (race && !race.over) { endRaceLocal(); toast("Disconnected from race"); }
      if (screen === "lobby" || screen === "race") show(me ? "home" : "login");
      setTimeout(connect, Math.min(8000, 500 * 2 ** retry++));
    };
  }

  function onMsg(m) {
    switch (m.t) {
      case "pong": {
        const rtt = performance.now() - m.c;
        $("ping").textContent = Math.round(rtt) + " ms"; $("ping").className = "ping " + (rtt < 80 ? "good" : rtt > 200 ? "bad" : "");
        if (rtt < bestRtt + 40) { bestRtt = Math.min(bestRtt, rtt); clockOff = m.now + rtt / 2 - Date.now(); }
        break;
      }
      case "welcome":
        if (m.token) { token = m.token; store.set("nr.token", token); }
        me = m.user; setUser(); $("top").hidden = false;
        if (screen === "login") show("home");
        break;
      case "authfail": token = null; store.set("nr.token", ""); me = null; $("top").hidden = true; show("login"); break;
      case "user": me = m.user; setUser(); if (screen === "garage") renderGarage(); if (screen === "home") renderHome(); break;
      case "err":
        if (m.field === "name") $("loginErr").textContent = m.msg; else { $("homeErr").textContent = m.msg; toast(m.msg); }
        break;
      case "lobby": lobby = m; lobby.at = performance.now(); show("lobby"); renderLobby(); break;
      case "left": show("home"); break;
      case "start": startRace(m); break;
      case "s": if (race) onState(m); break;
      case "fin": if (race) onFin(m); break;
      case "result": onResult(m); break;
      case "lb": lastLB = m; renderBoard(); break;
    }
  }

  // ---------------------------------------------------------------- navigation / screens
  function show(id) {
    if (screen === "race" && id !== "race" && view) { view.destroy(); view = null; }
    screen = id;
    document.querySelectorAll(".screen").forEach(s => s.hidden = s.id !== "s-" + id);
    document.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("on", b.dataset.nav === id && b.tagName === "BUTTON"));
    if (id === "home") renderHome();
    if (id === "garage") renderGarage();
    if (id === "board") { send({ t: "lb" }); renderBoard(); }
    scrollTo(0, 0);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-nav]"); if (!b) return; e.preventDefault();
    if (!me) return; if (screen === "race" || screen === "lobby") return toast("Leave the race first");
    show(b.dataset.nav);
  });

  function setUser() {
    $("chipName").textContent = me.name; $("chipLvl").textContent = me.level; $("chipCoins").textContent = Number(me.coins || 0).toLocaleString();
    $("chipXp").style.width = Math.min(100, (me.xp - me.curXp) / (me.nextXp - me.curXp) * 100) + "%";
  }

  // ---------------------------------------------------------------- login
  (function parade() {
    const el = $("parade"); const picks = VEHICLES.slice(0, 8);
    el.innerHTML = picks.map((v, i) => { const p = PAINTS[(i * 3) % PAINTS.length]; return `<div style="position:absolute;inset:0;animation:none">${VehicleArt.previewSVG(v.id, p.paint, p.accent).replace("<svg", `<svg style="animation-duration:${9 + (i * 1.7) % 6}s;animation-delay:${-i * 2.3}s"`)}</div>`; }).join("");
  })();
  $("loginForm").addEventListener("submit", e => { e.preventDefault(); $("loginErr").textContent = ""; send({ t: "hello", name: $("nameIn").value.trim() }); });

  // ---------------------------------------------------------------- home
  function renderHome() {
    if (!me) return;
    $("homeCar").innerHTML = carSVG(me.vehicle, me.paint);
    const h = me.history, acc = me.races;
    $("statRow").innerHTML = [["Best", Math.round(me.best)], ["Avg (10)", Math.round(me.avg)], ["Races", me.races], ["Wins", me.wins], ["Level", me.level]]
      .map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join("");
    requestAnimationFrame(() => drawLine($("histChart"), h));
    $("homeErr").textContent = "";
  }
  $("modeSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.mode; [...$("modeSeg").children].forEach(x => x.classList.toggle("on", x === b)); });
  $("quick").onclick = () => { sfx.beep(); send({ t: "queue", mode }); };
  $("createRoom").onclick = () => send({ t: "create", mode });
  $("joinForm").addEventListener("submit", e => { e.preventDefault(); const c = $("codeIn").value.trim(); if (c.length === 4) send({ t: "join", code: c }); });

  // ---------------------------------------------------------------- lobby
  function renderLobby() {
    const L = lobby, isHost = L.host === me.id;
    $("lobbyTitle").textContent = L.priv ? "Private room" : "Finding racers…";
    $("roomCode").hidden = !L.priv; $("roomCode").textContent = L.code || "";
    $("roomCode").title = "Click to copy"; $("startRoom").hidden = !(L.priv && isHost);
    const cards = L.players.map(p => `<div class="rcard${p.id === me.id ? " me" : ""}">${carSVG(p.vehicle, p.paint)}<b>${esc(p.name)}</b><small>Lv ${p.level}${p.id === L.host && L.priv ? " · host" : ""}</small></div>`);
    while (cards.length < 5) cards.push(`<div class="rcard empty">${L.priv ? "Waiting…" : "Open slot"}</div>`);
    $("roster").innerHTML = cards.join("");
    tickLobby();
  }
  function tickLobby() {
    clearTimeout(tickLobby.t); if (screen !== "lobby" || !lobby) return;
    if (lobby.endsIn != null) {
      const left = Math.max(0, lobby.endsIn - (performance.now() - lobby.at));
      $("lobbySub").textContent = `Race starts in ${Math.ceil(left / 1000)}s — empty slots are filled with bots`;
    } else $("lobbySub").textContent = lobby.priv ? "Share the code with friends, then start when ready" : "";
    tickLobby.t = setTimeout(tickLobby, 250);
  }
  $("roomCode").onclick = () => { navigator.clipboard && navigator.clipboard.writeText($("roomCode").textContent).then(() => toast("Code copied")); };
  $("leaveLobby").onclick = () => send({ t: "leave" });
  $("startRoom").onclick = () => send({ t: "start" });

  // ---------------------------------------------------------------- race
  function startRace(m) {
    const text = m.text, len = text.length;
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
    race = {
      text, len, src: m.src, startAt: m.startAt - clockOff, ok: 0, keys: 0, errs: 0, streak: 0, nitroOn: false, started: false, over: false,
      place: 0, typedLen: 0, prevOk: 0, prevLen: 0, lastHud: 0, lastGauge: 0, samples: [], lastSend: 0, lastSample: 0, fin: {}, lastSentN: -1, players: m.players,
    };
    show("race"); $("result").hidden = true; $("typing").classList.remove("done");
    view = new RaceView($("track")); view.setBiome(Math.abs(h) % BIOMES.length); view.setPlayers(m.players, me.id); view.start();
    $("biome").textContent = view.biome.name;
    $("srcLine").textContent = m.src;
    buildText(text);
    const inp = $("hidden"); inp.value = ""; inp.disabled = true;
    $("banner").className = "banner"; $("banner").textContent = "Get ready";
    ["hPlace", "hAcc", "hTime", "hProg"].forEach((k, i) => $(k).textContent = ["—", "100%", "0.0", "0%"][i]);
    $("nBar").style.width = "0"; moveCaret(0);
    // countdown driven by wall clock so late joiners stay in sync
    cancelAnimationFrame(rafId); let lastLights = -2;
    const loop = () => {
      if (!race) return;
      const toGo = race.startAt - Date.now();
      if (!race.started) {
        const lights = toGo > 3000 ? 0 : toGo > 2000 ? 1 : toGo > 1000 ? 2 : 3;
        if (lights !== lastLights) { lastLights = lights; view.lights = lights; if (lights) sfx.beep(); }
        $("banner").textContent = toGo > 3000 ? `Get ready… ${Math.ceil(toGo / 1000 - 3)}` : "Set…";
        if (toGo <= 0) go();
      }
      if (race.started && !race.over) hudTick();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    $("typing").focus({ preventScroll: true });
  }
  function go() {
    race.started = true; view.lights = 99; view.goFlash = 1; sfx.go();
    setTimeout(() => { if (view) view.lights = -1; }, 700);
    $("banner").textContent = "GO!"; $("banner").className = "banner go";
    const inp = $("hidden"); inp.disabled = false; inp.value = ""; inp.focus({ preventScroll: true });
  }
  function buildText(t) {
    $("text").innerHTML = [...t].map(c => `<span>${esc(c)}</span>`).join("");
    race.spans = $("text").children;
  }
  // the "cursor" is a thin underline beneath the current character, so it never covers a glyph
  function moveCaret(i) {
    const sp = race && race.spans, c = $("caret");
    if (!sp || !sp.length) { c.style.transform = "translate(0,26px)"; return; }
    const s = sp[Math.min(i, sp.length - 1)], atEnd = i >= sp.length;
    c.style.width = s.offsetWidth + "px";
    c.style.transform = `translate(${s.offsetLeft + (atEnd ? s.offsetWidth : 0)}px,${s.offsetTop + s.offsetHeight + 1}px)`;
    c.classList.add("live"); clearTimeout(moveCaret.t); moveCaret.t = setTimeout(() => c.classList.remove("live"), 700);
  }
  $("textBox").addEventListener("mousedown", e => { e.preventDefault(); if (!$("hidden").disabled) $("hidden").focus({ preventScroll: true }); });
  addEventListener("resize", () => { if (race && screen === "race") moveCaret(race.typedLen || 0); });

  $("hidden").addEventListener("paste", e => e.preventDefault());
  $("hidden").addEventListener("drop", e => e.preventDefault());
  $("hidden").addEventListener("input", e => {
    if (!race || !race.started || race.over) return;
    const v = e.target.value, t = race.text, sp = race.spans;
    // limit runaway wrong input
    let ok = 0; while (ok < v.length && v[ok] === t[ok]) ok++;
    let val = v; if (val.length > ok + 8) { val = val.slice(0, ok + 8); e.target.value = val; }
    if (e.inputType && e.inputType.startsWith("insert") && v.length > race.typedLen) {
      race.keys++;
      if (v[v.length - 1] !== t[v.length - 1] || v.length - 1 > race.ok) { race.errs++; race.streak = 0; sfx.err(); } else { race.streak++; sfx.key(); }
    }
    race.typedLen = val.length;
    const lo = Math.max(0, Math.min(race.prevOk, ok, race.prevLen, val.length)), hi = Math.min(t.length, Math.max(race.prevOk, ok, race.prevLen, val.length));
    for (let i = lo; i < hi; i++) {
      const cl = i < ok ? "ok" : i < val.length ? "err" : "";
      if (sp[i].className !== cl) sp[i].className = cl;
    }
    race.prevOk = ok; race.prevLen = val.length;
    race.ok = ok; moveCaret(val.length);
    const nitro = race.streak >= 15;
    if (nitro !== race.nitroOn) { race.nitroOn = nitro; view.setNitro(me.id, nitro); $("nBar").parentElement.classList.toggle("on", nitro); if (nitro) sfx.nitro(); }
    $("nBar").style.width = Math.min(100, race.streak / 15 * 100) + "%";
    view.update(me.id, ok, race.len, curWpm(), race.place);
    const now = performance.now();
    if (ok !== race.lastSentN) flushProgress(ok === race.len);
  });
  // progress is cumulative, so coalescing is safe; the trailing flush guarantees the final state is sent
  function flushProgress(force) {
    const now = performance.now(); clearTimeout(race.flushT);
    if (!force && now - race.lastSend < 35) { race.flushT = setTimeout(() => race && flushProgress(true), 40); return; }
    race.lastSentN = race.ok; race.lastSend = now; send({ t: "p", n: race.ok, k: race.keys, e: race.errs });
  }
  const elapsed = () => Math.max(0, Date.now() - race.startAt);
  const curWpm = () => { const el = elapsed(); return el > 800 ? (race.ok / 5) / (el / 60000) : 0; };
  function hudTick() {
    const nowp = performance.now(), el = elapsed(), w = race.over ? race.finalWpm : curWpm();
    if (nowp - race.lastHud > 100) {
      race.lastHud = nowp;
      $("hTime").textContent = (el / 1000).toFixed(1); $("hProg").textContent = Math.floor(race.ok / race.len * 100) + "%";
      $("hAcc").textContent = (race.keys ? Math.max(0, (race.keys - race.errs) / race.keys * 100) : 100).toFixed(0) + "%";
    }
    if (nowp - race.lastGauge > 33) { race.lastGauge = nowp; drawGauge($("gauge"), w, 160, race.nitroOn); }
    if (nowp - race.lastSample > 500) { race.lastSample = nowp; race.samples.push(w); }
    if (nowp - race.lastSend > 700) { race.lastSend = nowp; send({ t: "p", n: race.ok, k: race.keys, e: race.errs }); }
  }
  function onState(m) {
    if (!race) return;
    race.left = m.left;
    if (race.over && !race.resultShown) { $("banner").textContent = `Waiting for the others… ${Math.ceil(m.left / 1000)}s`; }
    else if (!race.over && m.left < 20000 && m.left < 120000 - 1000 && race.anyFin) { $("banner").textContent = `Finish before time runs out – ${Math.ceil(m.left / 1000)}s`; $("banner").className = "banner"; }
    for (const [id, n, wpm, place] of m.r) {
      if (id === me.id) { if (place) race.place = place; view.update(id, race.over ? race.len : Math.max(n, race.ok), race.len, race.over ? race.finalWpm : curWpm(), place); }
      else view.update(id, n, race.len, wpm, place);
    }
    if (!race.over) {
      const mine = race.ok, rank = 1 + m.r.filter(r => r[0] !== me.id && (r[3] ? true : r[1] > mine)).length;
      $("hPlace").textContent = ord(rank);
    }
  }
  function onFin(m) {
    race.fin[m.id] = m; race.anyFin = true;
    if (m.id !== me.id) view.update(m.id, race.len, race.len, m.wpm, m.place);
    if (m.id === me.id) {
      race.over = true; race.place = m.place; race.finalWpm = m.wpm;
      $("hidden").disabled = true; $("hidden").blur(); view.setNitro(me.id, false); view.burst(me.id);
      sfx.fin(); $("hPlace").textContent = ord(m.place);
      $("banner").textContent = m.place === 1 ? "🏆 You win!" : `Finished ${ord(m.place)}`; $("banner").className = "banner go";
      $("hTime").textContent = (m.time / 1000).toFixed(1); drawGauge($("gauge"), m.wpm, 160, false);
    }
  }
  function endRaceLocal() { cancelAnimationFrame(rafId); if (race) race.over = true; }
  $("quitRace").onclick = quit;
  function quit() { if (!race) return show("home"); endRaceLocal(); race = null; send({ t: "leave" }); show("home"); }

  function onResult(m) {
    if (!race) return;
    cancelAnimationFrame(rafId); const you = m.you; me = m.user; setUser();
    // same view as the race: the track stays, every racer's final speed sits on top of their car
    for (const r of m.board) {
      if (r.id !== me.id && r.wpm != null) view.update(r.id, race.len, race.len, r.wpm, r.place || 0);
      view.setFinal(r.id, r.wpm != null ? r.wpm : null, r.place || 0);
    }
    $("result").hidden = false; $("typing").classList.add("done"); race.resultShown = true; race.over = true;
    $("banner").textContent = "Race complete"; $("banner").className = "banner go";
    $("rPlace").textContent = you.place ? (you.place === 1 ? "1st - Victory!" : ord(you.place) + " place") : "Did not finish";
    $("rSub").textContent = `${m.board.length} racers - ${view.biome.name}`;
    $("rWpm").textContent = you.wpm != null ? Math.round(you.wpm) : "-"; $("rPB").hidden = !you.pb;
    $("rStats").innerHTML = [["Accuracy", you.acc + "%"], ["Time", you.time ? (you.time / 1000).toFixed(2) + "s" : "-"], ["Coins", "+" + you.coins], ["XP", "+" + you.xp]]
      .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join("");
    const f = $("rFlag"); f.hidden = !you.flagged; if (you.flagged) f.textContent = `Run not ranked - flagged by anti-cheat (${you.flagged}). No rewards were granted.`;
    if (you.leveled) setTimeout(() => toast(`Level up! You are now level ${you.leveled}`), 600);
    $("rAgain").focus({ preventScroll: true });
  }
  function closeResult(next) {
    $("result").hidden = true; $("typing").classList.remove("done"); race = null; if (view) { view.destroy(); view = null; }
    if (next === "again") send({ t: "queue", mode }); else show("home");
  }
  $("rHome").onclick = () => closeResult("home"); $("rAgain").onclick = () => closeResult("again");

  // ---------------------------------------------------------------- garage
  function renderGarage() {
    if (!me) return;
    selCar = selCar || me.vehicle; selPaint = selPaint || me.paint;
    const v = carOf(selCar);
    $("stageCar").innerHTML = carSVG(selCar, selPaint); $("stageName").textContent = v.name; $("stageTag").textContent = v.tagline;
    $("paints").innerHTML = PAINTS.map(p => `<button class="sw" role="radio" aria-checked="${p.id === selPaint}" aria-label="${esc(p.name)}" title="${esc(p.name)}" data-p="${p.id}" style="background:${p.paint};color:${p.paint}"></button>`).join("");
    $("cars").innerHTML = VEHICLES.map(c => {
      const owned = me.owned.includes(c.id), eq = me.vehicle === c.id, locked = me.level < c.level;
      const status = eq ? `<div class="st eq">✓ Equipped</div>` : owned ? `<div class="st">Owned</div>` : locked ? `<div class="st lock">🔒 Level ${c.level}</div>` : `<div class="st buy"><i class="coin"></i>${c.price.toLocaleString()}</div>`;
      const btn = eq ? "" : owned ? `<button class="btn" data-eq="${c.id}">Equip</button>` : `<button class="btn primary" data-buy="${c.id}" ${locked || me.coins < c.price ? "disabled" : ""}>Buy</button>`;
      return `<div class="car${selCar === c.id ? " sel" : ""}" data-sel="${c.id}">${carSVG(c.id, selPaint)}<b>${esc(c.name)}</b>${status}${btn}</div>`;
    }).join("");
  }
  $("paints").addEventListener("click", e => {
    const b = e.target.closest("[data-p]"); if (!b) return; selPaint = b.dataset.p;
    if (me.owned.includes(selCar)) send({ t: "equip", vehicle: selCar, paint: selPaint }); else renderGarage();
    send({ t: "equip", paint: selPaint });
  });
  $("cars").addEventListener("click", e => {
    const buy = e.target.closest("[data-buy]"), eq = e.target.closest("[data-eq]"), sel = e.target.closest("[data-sel]");
    if (buy) { send({ t: "buy", id: buy.dataset.buy }); selCar = buy.dataset.buy; sfx.fin(); return; }
    if (eq) { send({ t: "equip", vehicle: eq.dataset.eq, paint: selPaint }); selCar = eq.dataset.eq; return; }
    if (sel) { selCar = sel.dataset.sel; renderGarage(); }
  });

  // ---------------------------------------------------------------- leaderboard
  $("boardSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; lbKind = b.dataset.k; [...$("boardSeg").children].forEach(x => x.classList.toggle("on", x === b)); renderBoard(); });
  function renderBoard() {
    const rows = lastLB ? lastLB[lbKind] : [];
    $("lbTable").innerHTML = "<tr><th>#</th><th></th><th>Racer</th><th>Lv</th><th>Best</th><th>Avg</th><th>Wins</th></tr>" +
      (rows.length ? rows.map((r, i) => `<tr class="${me && r.name === me.name ? "me" : ""}"><td>${i + 1}</td><td>${carSVG(r.vehicle, r.paint)}</td><td>${esc(r.name)}</td><td>${r.level}</td><td>${r.best}</td><td>${r.avg}</td><td>${r.wins}</td></tr>`).join("") : `<tr><td colspan="7" class="fine">No ranked races yet — be the first.</td></tr>`);
  }

  // ---------------------------------------------------------------- global keys
  $("mute").onclick = () => { $("mute").textContent = sfx.toggle() ? "🔇" : "🔊"; }; $("mute").textContent = sfx.muted ? "🔇" : "🔊";
  addEventListener("keydown", e => {
    if (e.key === "Escape" && screen === "race") { e.preventDefault(); if (race && race.resultShown) closeResult("home"); else quit(); }
    if (e.key === "Enter" && screen === "home" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "BUTTON") send({ t: "queue", mode });
    if (screen === "race" && race && race.started && !race.over && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== $("hidden")) $("hidden").focus({ preventScroll: true });
  });

  connect();
  // dev/test hook (read-only introspection)
  window.__nr = { get race() { return race }, get view() { return view }, get me() { return me } };
})();
