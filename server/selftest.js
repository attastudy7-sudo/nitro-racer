"use strict";
// End-to-end protocol test: boots the server on a spare port, runs a human-like racer, a macro cheater
// and a speed-hacker, and asserts the server's verdicts. Run: npm test
const { spawn } = require("child_process");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = 3999;
const DB = path.join(require("os").tmpdir(), "nr-selftest-" + process.pid + ".json");
const backup = null;

const srv = spawn(process.execPath, [path.join(__dirname, "index.js")], { env: { ...process.env, PORT, NR_DB: DB }, stdio: "inherit" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// sub-millisecond metronome (Windows timers jitter by ~15ms, which would make a perfect macro look human)
const preciseSleep = async ms => { const end = performance.now() + ms; if (ms > 25) await sleep(ms - 20); while (performance.now() < end); };
let fails = 0;
const ok = (c, msg) => { console.log((c ? "  PASS " : "  FAIL ") + msg); if (!c) fails++; };

function client(name) {
  return new Promise(res => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`), c = { ws, name, msgs: [], on: {} };
    ws.on("message", d => { const m = JSON.parse(d); c.msgs.push(m); (c.on[m.t] || []).forEach(f => f(m)); });
    c.send = o => ws.send(JSON.stringify(o));
    c.wait = (t, ms = 30000) => new Promise((ok, no) => { const f = c.msgs.find(m => m.t === t); if (f) return ok(f); const to = setTimeout(() => no(new Error("timeout waiting " + t)), ms); (c.on[t] = c.on[t] || []).push(m => { clearTimeout(to); ok(m); }); });
    ws.on("open", () => { c.send({ t: "hello", name }); res(c); });
  });
}
// types `text` at ~wpm; jitter=0 → perfectly regular (macro)
async function type(c, start, text, wpm, jitter, burst = 1) {
  const per = 60000 / (wpm * 5);
  let n = 0;
  while (n < text.length) {
    const wait = start - Date.now(); if (wait > 0) { await sleep(wait); start = 0; }
    n = Math.min(text.length, n + burst); c.send({ t: "p", n, k: n, e: 0 });
    const d = Math.max(1, per * burst * (1 + (Math.random() - .5) * 2 * jitter));
    await (jitter === 0 ? preciseSleep(d) : sleep(d));
  }
}

(async () => {
  try {
    await sleep(800);
    console.log("auth & lobby");
    const a = await client("HumanA"), b = await client("MacroB"), z = await client("ZoomC");
    const wa = await a.wait("welcome"); await b.wait("welcome"); await z.wait("welcome");
    ok(wa.token && wa.token.length === 48 && wa.user.coins === 100, "register issues token and starter coins");
    const dup = await client("humana"); const e = await dup.wait("err"); ok(/taken/.test(e.msg), "duplicate name (case-insensitive) rejected"); dup.ws.close();
    const bad = await client("x!"); ok((await bad.wait("err")).field === "name", "invalid name rejected"); bad.ws.close();
    a.send({ t: "queue", mode: "quote" }); b.send({ t: "queue", mode: "quote" }); z.send({ t: "queue", mode: "quote" });
    const lob = await a.wait("lobby"); ok(lob.endsIn > 0, "queue joins a public lobby with a start timer");
    const st = await a.wait("start"); await b.wait("start"); await z.wait("start");
    ok(st.players.length === 4 && st.players.filter(p => p.bot).length === 1, "lobby filled with bots to 4 racers (3 humans + 1 bot)");
    ok(st.startAt > Date.now(), "start time is in the future (server clock)");
    console.log("racing: " + st.text.length + " chars");
    // cheater before GO should be ignored
    z.send({ t: "p", n: st.text.length, k: st.text.length, e: 0 });
    const t0 = st.startAt;
    // use slow-ish human so test is quicker: 140 wpm
    const long = st.text.length;
    await Promise.all([
      type(a, t0, st.text, 140, 0.5),               // human: noisy timing
      type(b, t0, st.text, 140, 0),                 // macro: metronome
      (async () => { await sleep(Math.max(0, t0 - Date.now()) + 300); z.send({ t: "p", n: long, k: long, e: 0 }); })(), // teleport
    ]);
    const ra = await a.wait("result"), rb = await b.wait("result"), rz = await z.wait("result", 40000);
    ok(ra.you.place && !ra.you.flagged && ra.you.coins > 0 && ra.you.xp > 0, `human run ranked, paid out (${ra.you.wpm} wpm, +${ra.you.coins} coins)`);
    ok(/regular timing/.test(rb.you.flagged || ""), `metronome macro flagged: ${rb.you.flagged}`);
    ok(rb.you.coins === 0, "flagged run earns nothing");
    ok(rz.you.flagged || rz.you.place === null || rz.you.wpm === null || rz.you.coins === 0, `teleport hack not rewarded (${JSON.stringify(rz.you)})`);
    ok(ra.user.races === 1 && ra.user.best > 0, "stats persisted to profile");
    console.log("garage");
    a.send({ t: "buy", id: "comet" }); ok((await a.wait("err")).msg.includes("level"), "cannot buy above your level");
    a.send({ t: "buy", id: "nope" }); await sleep(150);
    a.send({ t: "equip", vehicle: "comet" }); await sleep(150);
    ok(!a.msgs.filter(m => m.t === "user").some(m => m.user.vehicle === "comet"), "cannot equip unowned vehicle");
    for (const bad of ["__proto__", "constructor", "toString", ["sprint"], 5]) { a.send({ t: "buy", id: bad }); }
    await sleep(250);
    ok(!a.msgs.some(m => m.t === "user" && (m.user.coins == null || Number.isNaN(m.user.coins))), "prototype-key / non-string buy ids cannot corrupt coins");
    console.log("reconnect with token");
    const a2 = await new Promise(res => { const ws = new WebSocket(`ws://localhost:${PORT}/ws`); const c = { ws }; ws.on("open", () => ws.send(JSON.stringify({ t: "hello", token: wa.token }))); ws.on("message", d => { const m = JSON.parse(d); if (m.t === "welcome") res(m); }); });
    ok(a2.user.name === "HumanA" && a2.user.races === 1, "token login restores account");
    console.log("private room");
    const h = await client("HostD"); await h.wait("welcome"); h.send({ t: "create", mode: "words" });
    const pl = await h.wait("lobby"); ok(pl.priv && /^[A-Z]{4}$/.test(pl.code), "private room gets a 4-letter code");
    const g = await client("GuestE"); await g.wait("welcome"); g.send({ t: "join", code: pl.code });
    await sleep(300); ok(h.msgs.filter(m => m.t === "lobby").pop().players.length === 2, "guest joins by code");
    g.send({ t: "start" }); await sleep(300); ok(!h.msgs.some(m => m.t === "start"), "non-host cannot start");
    h.send({ t: "start" }); const ps = await h.wait("start"); ok(ps.players.every(p => !p.bot), "private rooms have no bots");
    console.log("http");
    const r = await fetch(`http://localhost:${PORT}/../server/db.js`).catch(() => ({ status: 0 })); ok(r.status !== 200, "no path traversal to server files");
    const CRLF = String.fromCharCode(13, 10);
    const raw = await new Promise(res => { const s = require("net").connect(PORT, "localhost", () => s.write(["GET /%00 HTTP/1.1", "Host: x", "", ""].join(CRLF))); let d = ""; s.on("data", c => d += c); s.on("close", () => res(d)); s.on("error", () => res("")); setTimeout(() => s.destroy(), 800); });
    ok(/400/.test(raw.split(CRLF)[0]), "null-byte path is rejected with 400 (no crash)");
    const hz = await (await fetch(`http://localhost:${PORT}/healthz`)).json(); ok(hz.ok, "healthz ok");
  } catch (e) { console.error(e); fails++; }
  srv.kill();
  await sleep(300);
  try { fs.unlinkSync(DB); } catch { }
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
  process.exit(fails ? 1 : 0);
})();
