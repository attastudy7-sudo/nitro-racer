# Nitro Racer - Independent Validation Report

Method: source read of all of server/ and public/; `npm test`; my own ws-protocol suites (scratch: `%TEMP%\qa\t1..t6.js`) against a COPY of the project on port 3100 (project data/db.json not touched by me); HTTP probes; Edge (Playwright, headless) full-flow runs at 1366x768 and 390x844@3x with human-paced typing through the real UI. Screenshots: `%TEMP%\qa\shots\`. Caveat: headless software rendering, so fps numbers are pessimistic; the real soft keyboard was not testable (emulated viewport only). The WebSearch benchmarking step was not performed; benchmark statements come from general knowledge of TypeRacer / Nitro Type / Monkeytype.

## Scores (1-10)

| Area | Score | One-line reason |
|---|---|---|
| Graphics | 7 | Cohesive neon/biome look, nice parallax, smoke, nitro, gauge. But cars are only ~150x62 px in-race, scenery is flat vector, 3 biomes. |
| Vehicle art | 7.5 | 10 distinct, genuinely hand-authored SVG vehicles (hatch, sedan, muscle, pickup, hot rod, supercar, bike+rider, monster truck, hover pod, dragster) with 12 paints. Best part of the project. Small at race scale; Comet/Nimbus look odd. |
| Gameplay feel | 5 | Core loop works, but typing text is off-screen on 1366x768 and on mobile; bots are never finishers; race ends the instant the human finishes. |
| Feature depth vs TR / NT / MT | 3.5 | No stats beyond avg/best, no daily/season, no friends, no chat, no custom text, no per-key heatmap, no themes/settings, 3 modes only, 40 quotes. |
| Robustness | 4 | Unauthenticated one-request crash; economy-corrupting NaN bug; duplicate-session orphaning; broken own test. Otherwise room lifecycle is solid. |
| Security | 3 | Remote crash via `%00`, unlimited account creation, no origin/CSP. XSS handling is actually good. |
| Anti-cheat | 2.5 | Trivially bypassed with a 3-line script; the "robotic timing" check fails even its own self-test. Honest bucket: rate cap + record check only. |

## Verdict

"Beyond standard"? Partially, and only in one dimension. The vehicle art and the garage/progression visual polish are better than TypeRacer's dated UI and comparable to or better than Nitro Type's car art. Everything else is below the benchmarks. It is a good visual prototype, not a "serious platform": the anti-cheat claim is not true (a 255 WPM teleport is paid out and tops the leaderboard), the economy is corruptible with one message, any anonymous HTTP request can kill the server, and on a typical 768px laptop or a phone the player cannot see the text they have to type without scrolling during the race. Against TypeRacer it lacks real CAPTCHA/verified anti-cheat, real quote corpus size, and history; against Nitro Type it lacks team/clan, seasons, daily rewards, and hundreds of cars; against Monkeytype it lacks any customisation or analytics. Claim "beyond standard": NOT validated.

## What passed (verified)

- `npm test`: 18/20 pass. Fails: "metronome macro flagged" and "flagged run earns nothing" (see AC-2). Test takes ~52 s and prints a libuv assertion at exit on Windows. The test also deletes and restores the real data/db.json (dangerous if a dev server is running; I saw the live server on :3000 holding in-memory state while the test ran).
- Malformed JSON, non-object JSON, unknown `t`, `__proto__` as t, oversize frame (closes 1009), unauth messages: no crash, correct `authfail`.
- Progress before GO ignored; n negative / NaN / string / null / 1e12 / Infinity / array / bool coerced harmlessly (`m.n|0`; 2^32+3 wraps to 3, harmless); n > len ignored; backwards up to 40 chars accepted.
- Join/queue/create while already in a room ignored (no duplicate membership).
- Leave mid-race, hard disconnect mid-race: survivor still gets result and payout; rooms returned to 0 in all cases (`/healthz` rooms 0 after each).
- Two humans racing: places 1/2 and payouts correct, immediate re-queue works.
- Per-IP cap of 12 sockets works (4 of 16 closed with 1013). Token bucket ~60 msg/s works.
- Token login: wrong length/type/uppercase/garbage -> authfail; 192-bit tokens, hashed storage. Not brute-forceable.
- Static traversal: encoded `..%2f`, `%2e%2e`, `%5c`, double-encoded, overlong UTF-8, `/data/db.json`, `/server/db.js`: all 403/404/400. Server source and db not reachable.
- XSS: all names go through `esc()` in lobby, results, leaderboard, garage; canvas uses fillText; server also restricts names to `[A-Za-z0-9_-]{3,16}`. No exploitable sink found. `paint` and `vehicle` strings fall back to defaults on the client.

## Bugs and findings (with reproduction)

### SEC-1 CRITICAL: one unauthenticated HTTP request crashes the whole server
server/index.js:18-20. `GET /%00` (or `/app.js%00.html`) -> `fs.readFile` throws `ERR_INVALID_ARG_VALUE` synchronously inside the request handler; no `uncaughtException` handler -> process exits. Repro: `curl --path-as-is http://localhost:PORT/%00` then `curl /healthz` -> connection refused. Every active race is lost. Fix: after decode, `if (p.includes("\0")) return 400`, and add `process.on("uncaughtException", ...)`; wrap readFile in try/catch.

### ECON-1 HIGH: buying prototype keys corrupts coins to NaN and grants free purchases
server/index.js:82-86. `D.CATALOG[m.id]` hits Object.prototype. Repro: `{t:"buy",id:"__proto__"}` (also `constructor`, `toString`, `hasOwnProperty`, or `["sprint"]`). Result: `coins:null` (NaN), `owned:["sprint","__proto__",...]`, `vehicle:"__proto__"`. With NaN coins `u.coins < price` is always false, so every level-unlocked car is free: I then bought Cruiser (400c) for free (test t4 F). Also persisted as `null`; client `setUser()` calls `me.coins.toLocaleString()` (app.js:105) which throws on null, so the account can get stuck on the login screen after reload (by inspection; the server side was confirmed to emit `coins:null`). Fix: `Object.hasOwn(D.CATALOG, m.id)` and `typeof m.id === "string"`; use `Object.create(null)` for CATALOG/byName/queues; guard `Number.isFinite(u.coins)`.

### SEC-2 HIGH: unlimited account creation, no per-IP registration limit
index.js:59-70, db.js:44. One IP created 13,440 accounts in 25 s (538/s); db.json grew to 4.1 MB, each save rewrites the whole file synchronously (health latency 87 ms during flush), login is an O(n) scan. Also one socket may re-`hello` repeatedly (60 accounts in a burst). Name squatting is trivial; bot names (Bolt, Nova) and "admin" are registrable. Fix: limit registrations per IP/hour, one registration per socket, reserve names, move to SQLite/append-only store.

### AC-1 HIGH: anti-cheat bypassed by a single message
game.js:110-133. Wait until `el = 47 ms * len` and send `{t:"p",n:len}` once. Cap passes (cap > len), `viol` = 1 (<3), <20 gaps so timing analysis skipped, wpm 255 < 260 threshold. Result: ranked, paid (+89 coins, +150 xp), top of leaderboard (255 WPM, test t4 A). The client self-reports k/e so accuracy is always claimable as 100%.
Adversarial humanlike bot (log-normal key jitter, word pauses, 3% hesitations, 100% claimed accuracy) at target 150/175/200/240 WPM (achieved 115/138/143/193 because of my timer overhead): never flagged, paid every time. A +-20 ms-jitter bursty macro at 223 WPM: not flagged. A perfectly regular 60 ms/char metronome: not flagged either.

### AC-2 HIGH: "robotic timing" detector is ineffective
`sd < 6 ms` on server-arrival gaps. Network and OS timer jitter alone exceeds 6 ms (it already fails the author's own selftest on localhost). It also measures message arrival, not keystrokes; the client coalesces sends at 35 ms (app.js:235). A flagged-but-undetected state is the norm. What the system CAN catch: crude teleports (n > 25 cps cap x elapsed), >12-char jumps three times, and >260 WPM average. What it cannot: any paced script, memory-injected input, replayed human traces, or lying about accuracy. Realistic fix path: send per-key events (key, timestamp) and verify on the server, server-side accuracy, CAPTCHA/challenge on outlier races or on first ranked win like TypeRacer, statistical profile per account, shadow-ban leaderboard for >200 WPM until reviewed.

### AC-3 MEDIUM: solo private rooms are a rewards farm
Private room with one human has no bots but pays full coins/xp and the 1st-place bonus (+25 coins, +10 xp). Repro: create room, Start, type. Also private rooms never time out (memory held while the socket is open).

### BUG-1 MEDIUM: same account on two sockets orphans one of them
game.js:28-32 keys players by `user.id`. Repro (t6): token login on socket B while A hosts a private room; B `join` -> the Map entry is overwritten by B, A never receives `start`/`result`. A leaves later -> `remove(pid)` deletes B's entry. Two browser tabs trigger it. Fix: reject join if `room.players.has(user.id)` or kick the older socket.

### BUG-2 LOW: `byName["__proto__"]`/`constructor` are "taken"
db.js:46 plain-object lookup. Harmless but another prototype-pollution-class smell (see ECON-1).

### SEC-3 LOW/MEDIUM: other hardening gaps
- WebSocket accepts any `Origin` (`https://evil.example` accepted). Auth token is in-message so CSWSH risk is low, but registration spam from any web page is possible. Check `req.headers.origin`.
- No CSP, no X-Frame-Options/frame-ancestors, token in localStorage (XSS would steal it; no XSS found).
- Per-IP cap uses `remoteAddress`: behind a reverse proxy all players share one IP, so the whole site is capped at 12 sockets. Use a trusted `X-Forwarded-For`.
- Room codes: 23^4 ~ 280k; 60 guesses/s/socket x 12 sockets finds an open private room in minutes. Low-impact, add per-socket failed-join backoff.
- `/app.js::$DATA` and `/app.js/` return 200 on Windows (NTFS quirk, public files only).
- Unbounded `m.paint` strings stored (24 chars max, regex-checked) - fine.

### UX-1 HIGH: the text to type is off-screen at 1366x768 and on mobile
Screenshots `desk-09/10`, `mob-10`. The track (up to ~430 px), HUD (~170 px) and banner fill the viewport; the typing panel starts at y~710 and the actual text is below the fold. A browser with chrome has only ~650 px of viewport. The player must scroll mid-race, or race blind. On mobile the whole race view is ~2000 px tall. Fix: in `.screen#s-race` use a compact layout: cap track height (sceneH/laneH smaller when `innerHeight < 800`), put the text panel directly under the track, hide gauge on small screens, `scrollIntoView` on start. Repro: open at 1366x768, quick race, start.

### UX-2 HIGH: mobile HUD gauge is broken/enormous
`mob-10`: the speedometer renders as a huge cropped half-arc with no WPM number. `.gauge{width:150px}` inside `.hud{flex-direction:column}` while `drawGauge` sizes from clientWidth; canvas stretches. Fix: `.gauge{align-self:center}` and explicit canvas CSS width/height or hide on narrow screens.

### UX-3 MEDIUM: leaderboard overflows horizontally on mobile
`[board] scrollWidth=407 > 390`; WINS column clipped (`mob-04`). Wrap table in `overflow-x:auto` or hide Avg on narrow screens.

### UX-4 MEDIUM: mobile header consumes ~45% of the first screen
Nav wraps onto three rows (`mob-*`: ~375 px of 844). Collapse nav to icons or a bottom tab bar.

### UX-5 MEDIUM: coin emoji renders as a tofu box on Windows 10
`🪙` (U+1FA99) shows as "▯ 100" in the header, Buy buttons, and all screens on Win10 Edge (every screenshot). Replace with an inline SVG coin.

### UX-6 MEDIUM: results screen misleads
After you finish, the race ends immediately (all humans done) and bots are listed as "-  61% (still racing)". Place-based rewards are computed against bots that never finish; you can't tell if a bot would have beaten you. Let bots finish (simulate) or show their projected time.

### UX-7 LOW: assorted
- Two 404s on every page load (favicon, likely) - console is otherwise clean, no page errors.
- Reduced-motion: CSS animations disabled, but the canvas keeps scrolling/particles; `prefers-reduced-motion` not honoured in render.js.
- Locked "Buy" buttons low-contrast dark-on-dim; garage left panel leaves a big empty area under the paint swatches (desktop).
- Nameplates sit on lane boundaries; readable but ambiguous which car they label. No overlap seen with 4 racers; not tested with 5.
- Speed lines and nitro use `Math.random()` per frame, fine.
- Garage/lobby preview wheels do not rotate; only the race view does (render.js separates wheels and rotates them; wheel alignment to arches looked correct in screenshots).
- Headlight glow ellipses extend to x=240+ on Cruiser/Nimbus/Vortex (viewBox edge, ~1-2 px clipping risk); not visibly clipped at screenshot scale.
- Race text uses mouse-down preventDefault and a hidden fixed input at top:0: works in emulation; real iOS keyboard behaviour is unverified (resizing viewport not tested).
- Caret and error highlight behave correctly: wrong char highlights red, caret stays, Backspace clears, max 8 wrong chars. Keyboard-only: Enter on Home starts a race, Esc quits. Paste/drop blocked.

### PERF
Headless Edge (software GPU): avg 36-40 fps, p95 frame 42-50 ms, max hitch 233-350 ms (first-frame SVG image decode). Likely 60 fps on real GPU but not proven. Candidates: per-frame `shadowBlur=14` on own car (render.js:174), `createLinearGradient` per lane per frame (render.js:132), 400-particle cap with `splice`.
DPR: the canvas is scaled to min(dpr,2); I captured only 1x desktop and 3x mobile; the mobile 3x canvas looked sharp.

## Top 10 fixes (impact order)

1. server/index.js:18-20: reject `\0` in decoded path, try/catch readFile, add `process.on("uncaughtException"/"unhandledRejection")`. (SEC-1, one-request kill.)
2. server/index.js:82-86: `Object.hasOwn(D.CATALOG, id) && typeof id === "string"`; make CATALOG/byName/queues null-prototype. (ECON-1.)
3. server/game.js:110-133: replace self-reported `n` trust: client sends per-key `{k, t}` batches, server rebuilds the typed string against its own text, computes accuracy and WPM, and checks inter-key distribution (not arrival gaps). Until then do not rank/payout >200 WPM automatically. (AC-1/AC-2.)
4. server/index.js:59-70 + db.js:44: per-IP registration rate limit, one registration per socket, reserved names, persistent store that is not rewritten whole. (SEC-2.)
5. public/style.css:106-117 / render.js:45-55: make the race screen fit 768 px (cap track height, text panel under it, scroll text into view on start). (UX-1.)
6. public/style.css:107,116 + render.js:213: fix mobile gauge sizing. (UX-2.)
7. server/game.js:28-32,191-196: reject join when `room.players.has(user.id)` or evict the old socket. (BUG-1.)
8. server/game.js:34-40/187: no rewards for rooms with fewer than 2 humans in private mode, or flat reduced payout; idle-timeout private lobbies. (AC-3.)
9. server/selftest.js:9-15: use a temp db path (add `DB_FILE` env in db.js:7) instead of deleting data/db.json; make the macro check use bursty timing that actually exercises the detector; fix exit assertion by awaiting kill.
10. public/app.js (garage/header): replace the 🪙 emoji with SVG; wrap leaderboard table for mobile; add Origin check and CSP on the server. (UX-5, UX-3, SEC-3.)

## Beyond-standard scorecard vs benchmarks

- Beats TypeRacer: visuals, vehicle personalisation, mobile-friendly intent, private rooms with codes.
- Roughly at Nitro Type: vehicle art (fewer cars, nicer detail per car), progression curve exists, but no teams/seasons/daily goals, economy exploitable.
- Behind Monkeytype: no customisation (themes, fonts, caret styles, punctuation/number modes, languages), no per-race analytics beyond one WPM line, no keymap/heat data.
- Behind both racing sites on trust: TypeRacer uses real verification; Nitro Type's known cheating problem is exactly what this server's check would not stop.
