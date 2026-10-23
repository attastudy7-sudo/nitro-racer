"use strict";
// Canvas renderer: parallax scenery, scrolling lanes, rotating wheels, smoke, nitro flames.
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const BIOMES = [
    { name: "Neon Dusk", sky: ["#1a0b3d", "#5b1a78", "#ff4f81", "#ffb36b"], sun: ["#ffe36b", "#ff4f81"], far: "#2a1252", mid: "#1b0c3a", near: "#0f0723", win: "#ffd36b", road: ["#23233a", "#1a1a2e"], line: "#f5f5ff", glow: "#ff4f81", stars: true },
    { name: "Desert Run", sky: ["#2a6ec4", "#6fb4ee", "#ffd9a0", "#ffb36b"], sun: ["#fff6c8", "#ffd36b"], far: "#c9794a", mid: "#a95a35", near: "#7c3f25", win: null, road: ["#4a4040", "#3a3232"], line: "#fff4d6", glow: "#ffb36b", stars: false },
    { name: "Arctic Night", sky: ["#050d24", "#0e2a5c", "#2f7fa8", "#9fe6e0"], sun: ["#e8fbff", "#9fe6e0"], far: "#1b4a7a", mid: "#12345a", near: "#0b2240", win: "#bff3ff", road: ["#2a3446", "#1f2838"], line: "#e8fbff", glow: "#7fe3ff", stars: true },
  ];

  const imgCache = new Map();
  function svgImage(key, svg) {
    if (imgCache.has(key)) return imgCache.get(key);
    const im = new Image(); im.decoding = "async";
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    imgCache.set(key, im); return im;
  }
  function wheelImg(r) { return svgImage("w" + r, VehicleArt.wheelSVG(r)); }
  function bodyImg(id, paint, accent) { return svgImage(`b|${id}|${paint}|${accent}`, VEHICLES.find(v => v.id === id).body(paint, accent)); }
  function paintOf(id) { return PAINTS.find(p => p.id === id) || PAINTS[0]; }

  class RaceView {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext("2d");
      this.racers = []; this.me = null; this.parts = []; this.t = 0; this.last = 0;
      this.biome = BIOMES[0]; this.final = false; this.lights = -1; this.goFlash = 0; this.scroll = 0; this.sceneCache = null;
      this.running = false;
      this._resize = () => this.resize(); addEventListener("resize", this._resize);
      this.setBiome(0); this.resize();
    }
    setBiome(i) { this.biome = BIOMES[i % BIOMES.length]; this.sceneCache = null; }
    setPlayers(list, meId) {
      this.me = meId;
      this.racers = list.map(p => {
        const v = VEHICLES.find(x => x.id === p.vehicle) || VEHICLES[0], pt = paintOf(p.paint);
        return { id: p.id, name: p.name, bot: p.bot, v, pt, body: bodyImg(v.id, pt.paint, pt.accent), frac: 0, tgt: 0, wpm: 0, place: 0, ang: 0, vis: 0, nitro: false, boost: 0, bob: Math.random() * 6 };
      });
      this.resize();
    }
    update(id, n, len, wpm, place) { const r = this.racers.find(x => x.id === id); if (r) { r.tgt = n / len; r.wpm = wpm; r.place = place; } }
    setNitro(id, on) { const r = this.racers.find(x => x.id === id); if (r) r.nitro = on; }
    setFinal(id, wpm, place) { const r = this.racers.find(x => x.id === id); if (r) { if (wpm) r.wpm = wpm; r.place = place || 0; } this.final = true; }
    resetRace() { for (const r of this.racers) { r.frac = r.tgt = 0; r.wpm = 0; r.place = 0; r.nitro = false; } this.parts.length = 0; }
    resize() {
      const W = this.c.clientWidth || 900, dpr = Math.min(devicePixelRatio || 1, 2);
      const n = Math.max(this.racers.length, 1);
      // fit the whole track into ~40% of the viewport so the typing box always stays on screen
      const maxH = clamp(innerHeight * 0.44, 210, 420);
      this.sceneH = Math.round(clamp(maxH * 0.16, 36, 90));
      const carH = (maxH - this.sceneH - 6) / n - 8;
      this.carW = clamp(Math.min(carH * 2.4, W * 0.17), 60, 150); this.carH = this.carW * 100 / 240;
      this.W = W; this.laneH = Math.round(this.carH + 8);
      this.H = this.sceneH + n * this.laneH + 6;
      this.c.style.height = this.H + "px";
      this.c.width = Math.round(W * dpr); this.c.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.sceneCache = null;
    }
    start() { if (this.running) return; this.running = true; this.last = performance.now(); const f = now => { if (!this.running) return; this.frame(now); requestAnimationFrame(f); }; requestAnimationFrame(f); }
    stop() { this.running = false; }
    destroy() { this.stop(); removeEventListener("resize", this._resize); }

    // --- scenery, pre-rendered to a tile twice the canvas width so it can scroll seamlessly
    buildScene() {
      const B = this.biome, W = this.W, H = this.sceneH, dpr = 1;
      const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
      const layers = { sky: mk(), far: mk(), mid: mk(), near: mk() };
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      // sky
      let g = layers.sky.getContext("2d"), grd = g.createLinearGradient(0, 0, 0, H);
      B.sky.forEach((c, i) => grd.addColorStop(i / (B.sky.length - 1), c));
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      if (B.stars) { g.fillStyle = "#fff"; for (let i = 0; i < 50; i++) { g.globalAlpha = rnd() * .8; g.fillRect(rnd() * W, rnd() * H * .55, 1.4, 1.4); } g.globalAlpha = 1; }
      const sx = W * .72, sy = H * .78, sr = H * .5; grd = g.createLinearGradient(0, sy - sr, 0, sy + sr);
      grd.addColorStop(0, B.sun[0]); grd.addColorStop(1, B.sun[1]);
      g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
      g.fillStyle = B.sky[2]; for (let i = 0; i < 6; i++) g.fillRect(sx - sr, sy - 2 + i * sr * .2, sr * 2, 1.5 + i * .7);
      // looped silhouettes (width W so the pattern tiles)
      const ridge = (c, col, base, amp, step) => {
        const x = c.getContext("2d"); x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
        for (let i = 0; i <= W; i += step) { const a = Math.sin(i / W * Math.PI * 4 + base) * amp + Math.sin(i / W * Math.PI * 10 + base * 2) * amp * .35; x.lineTo(i, H * .58 - a); }
        x.lineTo(W, H); x.closePath(); x.fill();
      };
      ridge(layers.far, B.far, 1, H * .16, 6);
      // city / dunes
      const x = layers.mid.getContext("2d"); x.fillStyle = B.mid;
      if (B.win) {
        for (let i = 0; i < W; i += 0) { const bw = 14 + rnd() * 26, bh = H * (.22 + rnd() * .38); x.fillStyle = B.mid; x.fillRect(i, H - bh, bw, bh);
          x.fillStyle = B.win; for (let wy = H - bh + 5; wy < H - 6; wy += 7) for (let wx = i + 3; wx < i + bw - 3; wx += 6) if (rnd() > .62) { x.globalAlpha = .35 + rnd() * .5; x.fillRect(wx, wy, 2.4, 3); } x.globalAlpha = 1; i += bw + 2; }
      } else ridge(layers.mid, B.mid, 3, H * .13, 5);
      // near: poles / cacti
      const n = layers.near.getContext("2d"); n.fillStyle = B.near; n.fillRect(0, H - 8, W, 8);
      for (let i = 30; i < W; i += 110 + rnd() * 80) { n.fillRect(i, H - 34, 3, 28); if (B.win) { n.fillRect(i - 6, H - 36, 15, 3); n.fillStyle = B.glow; n.globalAlpha = .9; n.fillRect(i - 6, H - 33, 5, 2); n.globalAlpha = 1; n.fillStyle = B.near; } }
      this.sceneCache = layers;
    }
    tile(layer, off, y) {
      const W = this.W, ctx = this.ctx; off = ((off % W) + W) % W;
      ctx.drawImage(layer, -off, y); ctx.drawImage(layer, W - off, y);
    }

    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
      const ctx = this.ctx, W = this.W, B = this.biome;
      if (!this.sceneCache) this.buildScene();
      const L = this.sceneCache, me = this.racers.find(r => r.id === this.me);
      const mySpeed = me ? me.vis : 0;
      this.scroll += mySpeed * dt;
      ctx.clearRect(0, 0, W, this.H);
      ctx.drawImage(L.sky, 0, 0);
      this.tile(L.far, this.scroll * .05, 0); this.tile(L.mid, this.scroll * .14, 0); this.tile(L.near, this.scroll * .5, 0);
      this.drawRoad(dt);
      this.drawFinish();   // under the cars so nameplates at the line stay readable
      // racers: draw back lanes first
      const x0 = 18, x1 = W - 56 - this.carW + 6;
      this.racers.forEach((r, i) => {
        r.frac += (r.tgt - r.frac) * Math.min(1, dt * (r.id === this.me ? 22 : 7));
        const targetVis = this.final ? (r.frac >= 1 ? 30 : 0) : r.wpm > 0 && r.frac < 1 ? 70 + r.wpm * 5.2 : r.frac >= 1 ? 40 : 0;
        r.vis += (targetVis - r.vis) * Math.min(1, dt * 4);
        const rad = (r.v.wheels[0] ? r.v.wheels[0].r : 14) * (this.carW / 240);
        r.ang += (r.vis * dt) / Math.max(rad, 4);
        r.boost += ((r.nitro ? 1 : 0) - r.boost) * Math.min(1, dt * 8);
        r.x = lerp(x0, x1, clamp(r.frac, 0, 1));
        r.y = this.sceneH + i * this.laneH + this.laneH - this.carH - 4;
        this.drawCar(r, dt);
      });
      this.drawParticles(dt);
      this.drawLights();
      // speed lines for high WPM
      if (me && me.vis > 330) { ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1; for (let i = 0; i < 10; i++) { const y = this.sceneH + Math.random() * (this.H - this.sceneH), l = 30 + Math.random() * 90, x = Math.random() * W; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l, y); ctx.stroke(); } }
    }
    drawRoad(dt) {
      const ctx = this.ctx, B = this.biome, W = this.W, n = this.racers.length;
      for (let i = 0; i < n; i++) {
        const y = this.sceneH + i * this.laneH, r = this.racers[i];
        this.laneGrad = this.laneGrad && this.laneGrad.sc === this.sceneCache && this.laneGrad.n === n ? this.laneGrad : { sc: this.sceneCache, n, g: [] };
        let g = this.laneGrad.g[i];
        if (!g) { g = this.laneGrad.g[i] = ctx.createLinearGradient(0, y, 0, y + this.laneH); g.addColorStop(0, B.road[0]); g.addColorStop(1, B.road[1]); }
        ctx.fillStyle = g; ctx.fillRect(0, y, W, this.laneH);
        // per-lane scrolling dashes at that racer's own speed
        r.dash = ((r.dash || 0) + r.vis * dt) % 56;
        ctx.fillStyle = B.line; ctx.globalAlpha = .55;
        for (let x = -56 + r.dash; x < W; x += 56) ctx.fillRect(x, y + this.laneH - 3, 28, 2);
        ctx.globalAlpha = 1;
        if (r.id === this.me) { ctx.fillStyle = B.glow; ctx.globalAlpha = .08 + .04 * Math.sin(this.t * 3); ctx.fillRect(0, y, W, this.laneH); ctx.globalAlpha = 1; }
      }
      ctx.fillStyle = B.line; ctx.globalAlpha = .9; ctx.fillRect(0, this.sceneH, W, 2); ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(0, this.sceneH - 2, W, 2);
    }
    drawFinish() {
      const ctx = this.ctx, fx = this.W - 56, s = 7, rows = Math.ceil((this.H - this.sceneH) / s);
      for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? "#111" : "#fff"; ctx.fillRect(fx + c * s, this.sceneH + r * s, s, s); }
      ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(18, this.sceneH, 2, this.H - this.sceneH);
    }
    drawCar(r, dt) {
      const ctx = this.ctx, s = this.carW / 240, v = r.v, isMe = r.id === this.me;
      const bob = Math.sin(this.t * (6 + r.vis / 60) + r.bob) * (r.vis > 5 ? 0.8 : 0.25) + (v.hover ? Math.sin(this.t * 2.4 + r.bob) * 3 - 3 : 0);
      const x = r.x, y = r.y + bob;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x + this.carW * .5, r.y + this.carH + 1, this.carW * .42 * (v.hover ? .8 : 1), 4, 0, 0, 7); ctx.fill();
      // nitro flame / hover glow
      if (v.exhaust) {
        const ex = x + v.exhaust.x * s, ey = y + v.exhaust.y * s;
        if (r.boost > .05) {
          const len = (28 + Math.random() * 14) * r.boost * (this.carW / 150);
          const g = ctx.createLinearGradient(ex, 0, ex - len, 0); g.addColorStop(0, "#fff"); g.addColorStop(.25, "#7fe3ff"); g.addColorStop(1, "rgba(80,120,255,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ex, ey - 4 * r.boost - 1); ctx.lineTo(ex - len, ey + (Math.random() - .5) * 3); ctx.lineTo(ex, ey + 4 * r.boost + 1); ctx.fill();
          if (Math.random() < .6) this.parts.push({ x: ex - len * .6, y: ey, vx: -60 - Math.random() * 80, vy: (Math.random() - .5) * 30, life: .35, max: .35, c: "#9fe6ff", s: 2, g: 0 });
        }
        if (r.vis > 20 && Math.random() < dt * (14 + r.vis / 25)) this.parts.push({ x: ex, y: ey, vx: -20 - Math.random() * 30 - r.vis * .1, vy: -8 - Math.random() * 14, life: .8, max: .8, c: "rgba(190,190,205,", s: 3 + Math.random() * 3, g: -10, smoke: true });
      }
      if (v.hover) { const g = ctx.createRadialGradient(x + this.carW * .5, r.y + this.carH, 2, x + this.carW * .5, r.y + this.carH, this.carW * .45); g.addColorStop(0, "rgba(127,227,255,.55)"); g.addColorStop(1, "rgba(127,227,255,0)"); ctx.fillStyle = g; ctx.fillRect(x, r.y + this.carH - 12, this.carW, 16); }
      // wheels behind body? bodies leave wheel wells, so wheels first
      for (const w of v.wheels) {
        const im = wheelImg(w.r), d = w.r * 2 * s;
        if (!im.complete || !im.naturalWidth) continue;
        ctx.save(); ctx.translate(x + w.x * s, y + w.y * s); ctx.rotate(r.ang); ctx.drawImage(im, -d / 2, -d / 2, d, d); ctx.restore();
      }
      if (r.body.complete && r.body.naturalWidth) {
        if (isMe) { const g = ctx.createRadialGradient(x + this.carW * .5, y + this.carH * .6, 4, x + this.carW * .5, y + this.carH * .6, this.carW * .62); g.addColorStop(0, "rgba(255,255,255,.16)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(x - 10, y - 8, this.carW + 20, this.carH + 16); }
        ctx.drawImage(r.body, x, y, this.carW, this.carH);
      }
      // nameplate: name + live/final speed sit directly on top of the car
      const big = this.final, wp = r.wpm > 0 ? Math.round(r.wpm) : 0;
      ctx.textBaseline = "alphabetic";
      const nameF = `600 ${isMe ? 12 : 11}px "Chakra Petch", system-ui, sans-serif`, wpmF = `700 ${big ? 15 : 12}px "Chakra Petch", system-ui, sans-serif`;
      const name = (r.bot ? "\u2699 " : "") + r.name + (r.place ? `  #${r.place}` : ""), speed = wp ? `${wp} WPM` : "";
      ctx.font = nameF; const w1 = ctx.measureText(name).width; ctx.font = wpmF; const w2 = speed ? ctx.measureText(speed).width + 10 : 0;
      const tw = w1 + w2 + 14, lx = clamp(x + this.carW * .5 - tw / 2, 4, this.W - tw - 4), ly = r.y - 1, th = big ? 20 : 17;
      ctx.fillStyle = isMe ? this.biome.glow : "rgba(10,10,20,.72)"; ctx.beginPath(); ctx.roundRect(lx, ly - th, tw, th, th / 2); ctx.fill();
      ctx.fillStyle = isMe ? "#0b0714" : "#fff"; ctx.font = nameF; ctx.fillText(name, lx + 7, ly - th / 2 + 4);
      if (speed) { ctx.font = wpmF; ctx.fillStyle = isMe ? "#0b0714" : "#ffd36b"; ctx.fillText(speed, lx + 7 + w1 + 10, ly - th / 2 + (big ? 5 : 4)); }
    }
    drawParticles(dt) {
      const ctx = this.ctx;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i]; p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
        const a = p.life / p.max;
        if (p.smoke) { ctx.fillStyle = p.c + (a * .35).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (2 - a), 0, 7); ctx.fill(); }
        else { ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); ctx.globalAlpha = 1; }
      }
      if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    }
    burst(id, color) {
      const r = this.racers.find(x => x.id === id); if (!r) return;
      for (let i = 0; i < 60; i++) { const a = Math.random() * 7, sp = 60 + Math.random() * 220; this.parts.push({ x: this.W - 50, y: r.y + this.carH / 2, vx: Math.cos(a) * sp - 40, vy: Math.sin(a) * sp, life: .9, max: .9, c: color || ["#ffd36b", "#ff4f81", "#7fe3ff", "#fff"][i % 4], s: 3, g: 260 }); }
    }
    drawLights() {
      if (this.lights < 0 && this.goFlash <= 0) return;
      const ctx = this.ctx, cx = this.W / 2, cy = this.sceneH * .45;
      if (this.goFlash > 0) this.goFlash -= 0.016;
      ctx.fillStyle = "rgba(8,6,20,.75)"; ctx.beginPath(); ctx.roundRect(cx - 74, cy - 24, 148, 48, 14); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const on = this.lights > i || this.lights === 99, green = this.lights === 99;
        ctx.fillStyle = on ? (green ? "#4ade80" : "#ff3b4e") : "#2a2438"; ctx.shadowColor = on ? ctx.fillStyle : "transparent"; ctx.shadowBlur = on ? 16 : 0;
        ctx.beginPath(); ctx.arc(cx - 40 + i * 40, cy, 13, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      }
    }
  }

  // Dashboard speedometer
  function drawGauge(cv, wpm, max, boost) {
    const dpr = Math.min(devicePixelRatio || 1, 2), s = cv.clientWidth || 160;
    if (cv.width !== s * dpr) { cv.width = s * dpr; cv.height = s * dpr; }
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, R = s * .42, a0 = Math.PI * .75, a1 = Math.PI * 2.25, f = clamp(wpm / max, 0, 1);
    c.lineCap = "round"; c.lineWidth = s * .07;
    c.strokeStyle = "rgba(255,255,255,.1)"; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    const g = c.createLinearGradient(0, s, s, 0); g.addColorStop(0, "#7fe3ff"); g.addColorStop(.6, "#ffd36b"); g.addColorStop(1, "#ff4f81");
    c.strokeStyle = g; c.beginPath(); c.arc(cx, cy, R, a0, a0 + (a1 - a0) * f); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - s * .07), cy + Math.sin(a) * (R - s * .07)); c.lineTo(cx + Math.cos(a) * (R - s * (i % 5 ? .1 : .12)), cy + Math.sin(a) * (R - s * (i % 5 ? .1 : .12))); c.stroke(); }
    const an = a0 + (a1 - a0) * f; c.strokeStyle = boost ? "#7fe3ff" : "#ff4f81"; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(an) * (R - s * .1), cy + Math.sin(an) * (R - s * .1)); c.stroke();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
    c.fillStyle = "#fff"; c.textAlign = "center"; c.font = `700 ${s * .22}px "Chakra Petch", system-ui`; c.fillText(Math.round(wpm), cx, cy + s * .27);
    c.fillStyle = "rgba(255,255,255,.55)"; c.font = `600 ${s * .075}px "Chakra Petch", system-ui`; c.fillText("WPM", cx, cy + s * .36);
  }

  function drawLine(cv, data, color) {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.fillStyle = "rgba(255,255,255,.55)"; c.font = "11px system-ui"; c.strokeStyle = "rgba(255,255,255,.1)";
    if (data.length < 2) { c.fillText("Not enough data yet", 8, 18); return; }
    const mx = Math.max(...data) * 1.15 || 1, pad = 28;
    for (let g = 0; g <= 3; g++) { const y = 8 + (h - 16) * g / 3; c.beginPath(); c.moveTo(pad, y); c.lineTo(w, y); c.stroke(); c.fillText(Math.round(mx * (1 - g / 3)), 0, y + 4); }
    const X = i => pad + (w - pad - 6) * i / (data.length - 1), Y = v => 8 + (h - 16) * (1 - v / mx);
    c.beginPath(); data.forEach((v, i) => i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)));
    c.strokeStyle = color || "#7fe3ff"; c.lineWidth = 2.5; c.lineJoin = "round"; c.stroke();
    c.lineTo(X(data.length - 1), h - 8); c.lineTo(X(0), h - 8); c.closePath(); c.globalAlpha = .14; c.fillStyle = c.strokeStyle; c.fill(); c.globalAlpha = 1;
  }

  window.RaceView = RaceView; window.drawGauge = drawGauge; window.drawLine = drawLine; window.BIOMES = BIOMES;
})();
