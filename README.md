# Nitro Racer

Real-time multiplayer typing races. Pick a vehicle, race people (or bots), earn coins, level up, unlock the garage.

    npm install
    npm start            # http://localhost:3000   (PORT env var to change)
    npm test             # end-to-end protocol + anti-cheat self-test

## Architecture
- `server/index.js` – static files, WebSocket endpoint `/ws`, per-socket rate limiting, heartbeat.
- `server/game.js` – rooms (public matchmaking + private codes), countdown, bots, authoritative scoring, anti-cheat.
- `server/db.js` – JSON-file accounts/stats (tokens stored hashed). Swap for a real DB to scale past one node.
- `public/` – vanilla JS client: `render.js` (canvas race scene), `vehicles.js` (10 SVG vehicles, 12 paints), `app.js` (UI/network).

## Anti-cheat (what it does and does not do)
The server owns the clock and the score. Clients only report "N correct chars". The server rejects impossible rates
(>300 WPM ceiling), flags speed above 260 WPM, and flags metronome-regular timing. Flagged runs earn nothing.
It does **not** stop a determined bot that adds human-like jitter; that needs per-keystroke replay analysis and
CAPTCHA gating like typeracer.com. Rewards are cosmetic-only, so the incentive to cheat is low.
