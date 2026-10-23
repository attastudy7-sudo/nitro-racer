"use strict";
const crypto = require("crypto");
const { pick } = require("./texts");
const D = require("./db");

const LOBBY_MS = 9000, COUNTDOWN_MS = 5000, TAIL_MS = 20000, LAST_HUMAN_MS = 12000, HARD_CAP_MS = 120000;
const MAX_PLAYERS = 5, MAX_CPS = 25; // 25 chars/s = 300 WPM hard physical ceiling
const BOT_NAMES = ["Bolt", "Pixel", "Nova", "Turbo", "Drift", "Apex", "Rogue", "Blitz", "Zephyr", "Comet"];
const BOT_CARS = ["sprint", "cruiser", "brawler", "hauler", "ember", "wasp", "vortex", "titan"];
const BOT_PAINTS = ["race-red", "ocean", "lime", "sunset", "midnight", "pink", "purple", "gold", "mint", "cyan"];

const rooms = new Map();      // id -> Room
const queues = { quote: null, words: null, code: null }; // open public room per mode

const rid = () => crypto.randomBytes(4).toString("hex");
const code4 = () => { let c; do c = Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ"[(Math.random() * 23) | 0]).join(""); while ([...rooms.values()].some(r => r.code === c)); return c; };
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

class Room {
  constructor(mode, priv) {
    this.id = rid(); this.mode = mode; this.priv = !!priv; this.code = priv ? code4() : null;
    this.state = "lobby"; this.players = new Map(); this.host = null;
    this.lobbyEnds = 0; this.timers = [];
    rooms.set(this.id, this);
  }
  humans() { return [...this.players.values()].filter(p => !p.bot); }
  add(ws, user) {
    const p = {
      id: user.id, name: user.name, vehicle: user.vehicle, paint: user.paint, level: D.levelFor(user.xp),
      ws, user, bot: false, n: 0, keys: 0, errs: 0, arr: [], viol: 0, lastMsg: 0, finish: null, place: 0, flagged: null,
    };
    this.players.set(p.id, p); ws.room = this; ws.pid = p.id;
    if (!this.host) this.host = p.id;
    if (this.state === "lobby" && !this.priv && !this.lobbyEnds) {
      this.lobbyEnds = Date.now() + LOBBY_MS;
      this.timers.push(setTimeout(() => this.begin(), LOBBY_MS));
    }
    if (!this.priv && this.humans().length >= MAX_PLAYERS && this.state === "lobby") this.begin();
    this.broadcastLobby();
  }
  remove(pid) {
    const p = this.players.get(pid); if (!p) return;
    if (this.state === "lobby") this.players.delete(pid);
    else { p.left = true; p.ws = null; }
    if (!this.humans().some(h => !h.left)) return this.destroy();
    if (this.host === pid) this.host = (this.humans().find(h => !h.left) || {}).id;
    if (this.state === "lobby") this.broadcastLobby(); else this.maybeEnd();
  }
  roster() {
    return [...this.players.values()].map(p => ({ id: p.id, name: p.name, vehicle: p.vehicle, paint: p.paint, level: p.level, bot: p.bot }));
  }
  broadcast(o) { const s = JSON.stringify(o); for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s); }
  broadcastLobby() {
    this.broadcast({ t: "lobby", code: this.code, host: this.host, priv: this.priv, mode: this.mode, endsIn: this.lobbyEnds ? Math.max(0, this.lobbyEnds - Date.now()) : null, players: this.roster() });
  }
  fillBots() {
    const h = this.humans();
    const avg = h.reduce((a, p) => a + (p.user.avg || 38), 0) / (h.length || 1);
    const want = this.priv ? 0 : Math.max(0, 4 - h.length);
    const names = BOT_NAMES.slice().sort(() => Math.random() - .5);
    for (let i = 0; i < want; i++) {
      const id = "bot" + rid();
      this.players.set(id, {
        id, name: names[i], bot: true, vehicle: BOT_CARS[(Math.random() * BOT_CARS.length) | 0], paint: BOT_PAINTS[(Math.random() * BOT_PAINTS.length) | 0],
        level: 1 + ((Math.random() * 8) | 0), wpm: Math.max(18, avg * (0.65 + Math.random() * 0.7)), wob: Math.random() * 6,
        n: 0, keys: 0, errs: 0, finish: null, place: 0,
      });
    }
  }
  begin() {
    if (this.state !== "lobby") return;
    if (queues[this.mode] === this) queues[this.mode] = null;
    this.timers.forEach(clearTimeout); this.timers = [];
    this.state = "countdown";
    this.fillBots();
    const t = pick(this.mode); this.text = t.text; this.src = t.src;
    this.startAt = Date.now() + COUNTDOWN_MS;
    this.broadcast({ t: "start", text: this.text, src: this.src, mode: this.mode, startAt: this.startAt, now: Date.now(), players: this.roster() });
    this.timers.push(setTimeout(() => this.go(), COUNTDOWN_MS));
  }
  go() {
    this.state = "racing"; this.finished = 0; this.lastTick = Date.now();
    this.tick = setInterval(() => this.step(), 100);
    this.deadline = Date.now() + HARD_CAP_MS;   // moves earlier as racers finish, never later
  }
  step() {
    const now = Date.now(), dt = now - this.lastTick; this.lastTick = now;
    const el = now - this.startAt, len = this.text.length;
    for (const p of this.players.values()) {
      if (!p.bot || p.finish !== null) continue;
      const w = p.wpm * (1 + 0.12 * Math.sin(el / 1500 + p.wob));
      p.pos = (p.pos || 0) + (w * 5 / 60000) * dt;
      p.n = Math.min(len, Math.floor(p.pos));
      if (p.n >= len) this.finishPlayer(p, el);
    }
    this.broadcast({ t: "s", el, left: Math.max(0, this.deadline - now), r: [...this.players.values()].map(p => [p.id, p.n, Math.round(this.liveWpm(p, el)), p.place]) });
    if (now >= this.deadline) return this.end();
    this.maybeEnd();
  }
  liveWpm(p, el) { return p.finish !== null ? p.fw : el > 500 ? (p.n / 5) / (el / 60000) : 0; }
  finishPlayer(p, el) {
    p.finish = el; p.place = ++this.finished;
    p.fw = (this.text.length / 5) / (el / 60000);
    if (!p.bot) this.analyse(p, el);
    this.broadcast({ t: "fin", id: p.id, place: p.place, wpm: Math.round(p.fw * 10) / 10, time: el });
    // everyone else may keep racing to the line, but only for a bounded time
    const now = Date.now();
    if (this.finished === 1) this.deadline = Math.min(this.deadline, now + TAIL_MS);
    if (!this.humans().some(h => !h.left && h.finish === null)) this.deadline = Math.min(this.deadline, now + LAST_HUMAN_MS);
  }
  // --- anti-cheat -------------------------------------------------------------
  // The server only ever trusts its own clock. Clients report "n chars correct"; we reject
  // impossible rates, then look at inter-message timing. Humans are noisy; macros are not.
  progress(p, m) {
    if (this.state !== "racing" || p.finish !== null) return;
    const now = Date.now(), el = now - this.startAt, len = this.text.length;
    if (typeof m.n !== "number" || !Number.isFinite(m.n)) return;
    let n = Math.floor(m.n);
    if (n < 0 || n > len) return;
    if (n < p.n - 40) return;                            // backspaced a lot: ignore stale
    const cap = Math.floor(1 + (el / 1000) * MAX_CPS);
    if (n > cap) { p.viol++; n = cap; }
    // each message is one coalesced burst of keystrokes; a legitimate client never advances more than a few chars
    if (n - p.n > 10) { p.viol++; n = p.n + 10; }
    const keys = Math.max(0, Math.min(+m.k || 0, len * 8));
    p.keys = Math.max(p.keys, keys, n);                  // cannot have typed fewer keys than characters
    p.errs = Math.max(0, Math.min(+m.e || 0, p.keys - n));
    if (n > p.n) p.arr.push([now, n - p.n]);
    p.n = n;
    if (n === len) this.finishPlayer(p, el);
  }
  analyse(p, el) {
    const gaps = []; for (let i = 1; i < p.arr.length; i++) gaps.push((p.arr[i][0] - p.arr[i - 1][0]) / p.arr[i][1]);
    if (gaps.length >= 20) {
      // median/MAD instead of mean/stdev: one network or GC hiccup must not hide an otherwise perfect metronome
      const med = a => { const x = a.slice().sort((m, n) => m - n), h = x.length >> 1; return x.length % 2 ? x[h] : (x[h - 1] + x[h]) / 2; };
      const m = med(gaps), mad = med(gaps.map(g => Math.abs(g - m))) * 1.4826;
      if (mad < 6 || mad / m < 0.12) p.flagged = "unnaturally regular timing";   // human typing is bursty (CV ~0.3-0.6)
    }
    if (p.viol >= 4) p.flagged = "impossible speed";
    if (p.arr.length < Math.ceil(this.text.length / 10)) p.flagged = "progress not reported per keystroke";
    if (p.fw > 200) p.flagged = "above 200 WPM - verification required";
  }
  maybeEnd() {
    if (this.state !== "racing") return;
    if (!this.humans().some(h => !h.left)) return this.end();
    if (![...this.players.values()].some(p => !p.left && p.finish === null)) this.end();   // everyone is across the line
  }
  end() {
    if (this.state !== "racing") return;
    this.state = "done"; clearInterval(this.tick); this.timers.forEach(clearTimeout);
    const len = this.text.length;
    const rows = [...this.players.values()].map(p => {
      if (p.finish === null && !p.left) p.place = 0;
      return p;
    }).sort((a, b) => (a.place || 99) - (b.place || 99) || b.n - a.n);
    const board = rows.map((p, i) => ({ id: p.id, name: p.name, bot: p.bot, place: p.place || null, wpm: p.finish !== null ? Math.round(p.fw * 10) / 10 : null, n: p.n, flagged: p.flagged || null }));
    for (const p of this.humans()) {
      if (p.left || !p.ws) continue;
      const finished = p.finish !== null;
      const acc = p.keys ? Math.max(0, (p.keys - p.errs) / p.keys) : 1;
      let coins = 0, xp = 0, pb = false;
      const practice = this.priv && this.humans().filter(h => !h.bot).length < 2;
      if (finished && !p.flagged && !practice) {
        const bonus = [0, 25, 14, 7][p.place] || 0;
        coins = Math.round(p.fw * acc * acc / 4 + bonus);
        xp = Math.round(p.fw / 2 + 12 + (p.place === 1 ? 10 : 0));
        const u = p.user, before = D.levelFor(u.xp);
        u.coins += coins; u.xp += xp; u.races++; if (p.place === 1) u.wins++;
        pb = p.fw > u.best; if (pb) u.best = p.fw;
        u.history.push(Math.round(p.fw * 10) / 10); if (u.history.length > 200) u.history.shift();
        const h = u.history.slice(-10); u.avg = h.reduce((a, b) => a + b, 0) / h.length;
        p.leveled = D.levelFor(u.xp) > before ? D.levelFor(u.xp) : 0;
        D.save();
      }
      send(p.ws, {
        t: "result", len, board, you: { place: p.place || null, wpm: finished ? Math.round(p.fw * 10) / 10 : null, acc: Math.round(acc * 1000) / 10, time: p.finish, coins, xp, pb, flagged: p.flagged || null, leveled: p.leveled || 0 },
        user: D.publicUser(p.user),
      });
      p.ws.room = null;
    }
    this.timers.push(setTimeout(() => this.destroy(), 2000));
  }
  destroy() {
    this.timers.forEach(clearTimeout); clearInterval(this.tick);
    if (queues[this.mode] === this) queues[this.mode] = null;
    for (const p of this.players.values()) if (p.ws && p.ws.room === this) p.ws.room = null;
    rooms.delete(this.id);
  }
}

const inRoom = user => [...rooms.values()].some(r => { const p = r.players.get(user.id); return p && !p.left; });
function queue(ws, user, mode) {
  if (inRoom(user)) return send(ws, { t: "err", msg: "You are already in a race" });
  if (!queues.hasOwnProperty(mode)) mode = "quote";
  let r = queues[mode];
  if (!r || r.state !== "lobby") { r = queues[mode] = new Room(mode, false); }
  r.add(ws, user);
}
function createPrivate(ws, user, mode) {
  if (inRoom(user)) return send(ws, { t: "err", msg: "You are already in a race" });
  const r = new Room(["quote", "words", "code"].includes(mode) ? mode : "quote", true);
  r.add(ws, user);
}
function joinCode(ws, user, code) {
  if (inRoom(user)) return send(ws, { t: "err", msg: "You are already in a race" });
  const r = [...rooms.values()].find(x => x.code === String(code || "").toUpperCase());
  if (!r || r.state !== "lobby") return send(ws, { t: "err", msg: "Room not found or already racing" });
  if (r.players.size >= MAX_PLAYERS) return send(ws, { t: "err", msg: "Room is full" });
  r.add(ws, user);
}
function leave(ws) { if (ws.room) { const r = ws.room; ws.room = null; r.remove(ws.pid); } }
function stats() { return { rooms: rooms.size }; }

module.exports = { queue, createPrivate, joinCode, leave, stats, send, rooms };
