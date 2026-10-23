"use strict";
// Tiny JSON-file store. Tokens are stored hashed; fine for a single-node deployment.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = process.env.NR_DB || path.join(__dirname, "..", "data", "db.json");
let db = { users: {}, byName: {} };
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}

let timer = null;
function flush() {
  clearTimeout(timer);
  timer = null;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE + ".tmp", JSON.stringify(db));
    fs.renameSync(FILE + ".tmp", FILE);
  } catch (e) { console.error("db save failed", e.message); }
}
const save = () => { if (!timer) timer = setTimeout(flush, 1000); };
process.on("exit", () => { if (timer) flush(); });

const sha = s => crypto.createHash("sha256").update(s).digest("hex");

// Vehicle catalogue must stay in sync with public/vehicles.js (id, price, level).
const CATALOG = {
  sprint: [0, 1], cruiser: [400, 2], brawler: [900, 4], hauler: [1500, 6], ember: [2400, 8],
  vortex: [3800, 11], wasp: [5200, 14], titan: [7500, 18], nimbus: [11000, 22], comet: [16000, 27],
};
const levelFor = xp => Math.floor(Math.sqrt(xp / 60)) + 1;

function publicUser(u) {
  return {
    id: u.id, name: u.name, coins: u.coins, xp: u.xp, level: levelFor(u.xp),
    nextXp: Math.pow(levelFor(u.xp), 2) * 60, curXp: Math.pow(levelFor(u.xp) - 1, 2) * 60,
    vehicle: u.vehicle, paint: u.paint, owned: u.owned,
    races: u.races, wins: u.wins, best: u.best, avg: u.avg, history: u.history.slice(-40),
  };
}

function validName(n) { return typeof n === "string" && /^[A-Za-z0-9_-]{3,16}$/.test(n); }

function register(name) {
  if (!validName(name)) return { error: "Name must be 3-16 letters, numbers, _ or -" };
  if (Object.hasOwn(db.byName, name.toLowerCase())) return { error: "That name is taken" };
  if (Object.keys(db.users).length >= 20000) return { error: "Server is full" };
  const token = crypto.randomBytes(24).toString("hex");
  const id = crypto.randomBytes(6).toString("hex");
  const u = {
    id, name, hash: sha(token), coins: 100, xp: 0, vehicle: "sprint", paint: "race-red", owned: ["sprint"],
    races: 0, wins: 0, best: 0, avg: 0, history: [], created: Date.now(),
  };
  db.users[id] = u; db.byName[name.toLowerCase()] = id; save();
  return { user: u, token };
}
function login(token) {
  if (typeof token !== "string" || token.length !== 48) return null;
  const h = sha(token);
  for (const id in db.users) if (db.users[id].hash === h) return db.users[id];
  return null;
}
function leaderboard() {
  const all = Object.values(db.users).filter(u => u.races > 0);
  const row = u => ({ name: u.name, level: levelFor(u.xp), best: Math.round(u.best), avg: Math.round(u.avg), wins: u.wins, races: u.races, vehicle: u.vehicle, paint: u.paint });
  return {
    speed: all.slice().sort((a, b) => b.best - a.best).slice(0, 25).map(row),
    wins: all.slice().sort((a, b) => b.wins - a.wins).slice(0, 25).map(row),
  };
}
module.exports = { register, login, publicUser, leaderboard, save, CATALOG, levelFor, db };
