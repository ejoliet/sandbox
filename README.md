# lan-pong

> Browser and mobile Ping-Pong game for 2 local players on the same LAN — no install, no account, just scan and play.

![CI](https://github.com/ejoliet/lan-pong/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-20+-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

-----

## Purpose

**Problem**: Playing a quick 2-player game requires either a shared screen or a cloud service with accounts, latency, and setup friction.

**Solution**: A self-hosted WebSocket server that runs on one machine; both players join via browser URL (desktop or mobile). No install on client devices — scan QR code, play immediately.

**Scope**: Local network only. One host machine runs the server. Two clients connect via browser. Game logic lives on the server; clients render and send input only.

-----

## Architecture

```
Host machine
┌─────────────────────────────────────────┐
│  Node.js WebSocket Server (port 3000)   │
│  ┌──────────┐   ┌─────────────────────┐ │
│  │ game.js  │◄──│ ws-server.js        │ │
│  │ (physics)│   │ (room, state sync)  │ │
│  └──────────┘   └──────┬──────────────┘ │
│                        │ WebSocket      │
└────────────────────────┼────────────────┘
                         │ LAN
          ┌──────────────┴─────────────┐
          ▼                            ▼
   Player 1 Browser             Player 2 Browser
   (desktop or mobile)          (desktop or mobile)
   canvas + input               canvas + input
```

**Data flow**:

- Player browser → `{ type: "input", dir: "up"|"down" }` → server
- Server runs game loop at 60 Hz → broadcasts `{ type: "state", ball, p1, p2, score }` → both clients
- Client renders state on `<canvas>`; never owns game logic

**Key components**:

|Component            |Responsibility                                   |
|---------------------|-------------------------------------------------|
|`server/ws-server.js`|WebSocket lifecycle, room management, input relay|
|`server/game.js`     |Ball physics, paddle movement, collision, scoring|
|`client/index.html`  |Canvas renderer, input handler, WebSocket client |
|`client/mobile.html` |Touch-optimized UI with on-screen up/down buttons|

-----

## Repository Layout

```
lan-pong/
├── server/
│   ├── ws-server.js       # WebSocket server + room logic
│   ├── game.js            # Game loop, physics, state
│   └── qr.js              # Prints QR code of server URL on startup
├── client/
│   ├── index.html         # Desktop browser client
│   ├── mobile.html        # Mobile touch client
│   ├── renderer.js        # Canvas draw functions
│   └── input.js           # Keyboard + touch input → WebSocket send
├── tests/
│   ├── game.test.js       # Physics unit tests (no network)
│   └── ws.test.js         # WebSocket integration tests (mock clients)
├── Makefile
├── package.json
├── .env.example
└── README.md              # This file
```

-----

## Prerequisites

|Requirement   |Version|Notes                                      |
|--------------|-------|-------------------------------------------|
|Node.js       |20+    |LTS recommended                            |
|npm           |10+    |Bundled with Node 20                       |
|Modern browser|Any    |Chrome, Safari, Firefox — desktop or mobile|
|LAN           |Any    |Both players on same Wi-Fi or wired network|

No AWS, no DB, no cloud dependencies.

-----

## Quick Start

```bash
# 1. Clone
git clone https://github.com/ejoliet/lan-pong.git
cd lan-pong

# 2. Install
npm install

# 3. Configure (optional — defaults work out of the box)
cp .env.example .env

# 4. Start server
make run
# Server starts on http://0.0.0.0:3000
# QR code printed to terminal — scan with Player 2's phone
```

Player 1 opens `http://localhost:3000` in their browser.
Player 2 scans the QR code (or opens `http://<host-ip>:3000`) on their phone.

Game starts automatically when both players are connected.

-----

## Configuration Reference

All configuration via environment variables.

|Variable         |Type   |Default|Required|Description                           |
|-----------------|-------|-------|--------|--------------------------------------|
|`PORT`           |`int`  |`3000` |        |WebSocket + static file server port   |
|`TICK_RATE`      |`int`  |`60`   |        |Game loop frequency in Hz             |
|`WIN_SCORE`      |`int`  |`11`   |        |Points to win a game                  |
|`BALL_SPEED_INIT`|`float`|`4.0`  |        |Initial ball speed (canvas units/tick)|
|`BALL_SPEED_MAX` |`float`|`12.0` |        |Max ball speed after acceleration     |
|`PADDLE_HEIGHT`  |`int`  |`80`   |        |Paddle height in canvas pixels        |
|`CANVAS_WIDTH`   |`int`  |`800`  |        |Logical canvas width                  |
|`CANVAS_HEIGHT`  |`int`  |`600`  |        |Logical canvas height                 |

-----

## API / Interface Contract

### WebSocket Messages

All messages are JSON. Client → Server:

```json
{ "type": "input", "dir": "up" | "down" | "stop" }
{ "type": "ready" }
{ "type": "rematch" }
```

Server → Client (broadcast every tick):

```json
{
  "type": "state",
  "ball":  { "x": 400, "y": 300, "vx": 4.0, "vy": 2.5 },
  "p1":    { "y": 260 },
  "p2":    { "y": 260 },
  "score": { "p1": 3, "p2": 5 },
  "phase": "waiting" | "playing" | "point" | "gameover"
}
```

Server → Client (events):

```json
{ "type": "assign",  "player": 1 | 2 }
{ "type": "start" }
{ "type": "point",   "scorer": 1 | 2 }
{ "type": "gameover","winner": 1 | 2 }
{ "type": "error",   "message": "Room full" }
```

### Game State Schema (server-side)

```javascript
// game.js exports this shape every tick
{
  ball:   { x, y, vx, vy },         // floats
  p1:     { y, score },              // y: float, score: int
  p2:     { y, score },
  phase:  "waiting"|"playing"|"point"|"gameover",
  winner: null | 1 | 2
}
```

-----

## Data Model

No database. Full game state held in memory per room.

```javascript
// Room object (ws-server.js)
const room = {
  players: [ws1, ws2],          // WebSocket connections
  state:   GameState,           // live game state from game.js
  loop:    IntervalID | null,   // setInterval handle
};
```

One room per server instance (single active game). Second connection beyond 2 players receives `{ type: "error", message: "Room full" }` and is closed.

-----

## Error Handling

|Condition                  |Server behavior                              |Client behavior                     |
|---------------------------|---------------------------------------------|------------------------------------|
|3rd player tries to join   |Send `error` msg, close socket               |Show “Room full, try again later”   |
|Player disconnects mid-game|Stop loop, broadcast `{ type: "disconnect" }`|Show “Opponent disconnected” overlay|
|Invalid message format     |Log warning, ignore                          |—                                   |
|Server crash               |Process exits; client shows reconnect prompt |Auto-reconnect after 3s (3 attempts)|

All server errors log to stdout: `[ERROR] <timestamp> <message>`.

-----

## Testing

```bash
make test          # All tests (unit + integration)
make test-unit     # Physics only — no network
make test-int      # WebSocket integration with mock clients
make lint          # ESLint
```

|Suite         |What it covers                                      |Fixtures       |
|--------------|----------------------------------------------------|---------------|
|`game.test.js`|Ball physics, collision, paddle clamp, scoring      |None           |
|`ws.test.js`  |Room join/full/disconnect, message relay, game start|Mock WS clients|

-----

## Deployment

### Local (development)

```bash
make run
# Prints: "Server running at http://0.0.0.0:3000  [QR code]"
```

### Docker (share on LAN without Node install)

```bash
docker build -t lan-pong .
docker run -p 3000:3000 --env-file .env lan-pong
```

### Raspberry Pi / always-on host

```bash
npm install --production
PORT=3000 node server/ws-server.js
# Or use pm2: pm2 start server/ws-server.js --name lan-pong
```

> ⚠️ Do not expose port 3000 to the public internet — no auth, no rate limiting.

-----

## Non-Goals (v1)

- **Spectators** — only 2 players per room; deferred to v2
- **Multiple concurrent rooms** — single room per server instance
- **Accounts / leaderboards** — no persistence, no DB
- **AI opponent** — human vs human only
- **Sound** — no audio in v1
- **HTTPS / WSS** — LAN only; TLS deferred to v2

-----

## Open Questions

- [ ] **Q1**: Should mobile client use portrait (tap left/right half) or landscape (on-screen buttons)? — owner: ejoliet, due: before Phase 3
- [ ] **Q2**: Ball acceleration on each paddle hit — linear increment or multiply by factor? — owner: ejoliet, due: before Phase 2

-----

## Agent Build Instructions

> This section is the authoritative build specification.
> A coding agent should implement this tool end-to-end using only this README.
> No clarifying questions needed — all ambiguity is in Open Questions above.

### Build Order

|Phase|Deliverable                                                                          |Done when                                        |
|-----|-------------------------------------------------------------------------------------|-------------------------------------------------|
|0    |Repo scaffold: `package.json`, `Makefile`, `.env.example`, ESLint config, CI workflow|`make lint` passes on empty project              |
|1    |`server/game.js` — physics, state, game loop                                         |`game.test.js` passes (ball, collisions, scoring)|
|2    |`server/ws-server.js` — WebSocket server, room, input relay, state broadcast         |`ws.test.js` passes with 2 mock clients          |
|3    |`client/index.html` + `client/renderer.js` + `client/input.js` — desktop client      |Two browser tabs can play a full game            |
|4    |`client/mobile.html` — touch UI with on-screen buttons                               |Game playable on iOS Safari + Android Chrome     |
|5    |`server/qr.js` — print QR of server LAN IP on startup                                |QR visible in terminal; scan opens game on phone |

### File Map

|File                 |Purpose                   |Key symbols                                           |
|---------------------|--------------------------|------------------------------------------------------|
|`server/game.js`     |Physics engine + game loop|`createGame()`, `tick()`, `applyInput()`, `getState()`|
|`server/ws-server.js`|WebSocket server + room   |`startServer()`, `room`, message handler              |
|`server/qr.js`       |QR code on startup        |`printQR(url)`                                        |
|`client/index.html`  |Desktop client entrypoint |Imports `renderer.js`, `input.js`                     |
|`client/mobile.html` |Mobile touch client       |Touch buttons, same WS logic as desktop               |
|`client/renderer.js` |Canvas draw               |`render(state, canvas)`                               |
|`client/input.js`    |Input → WebSocket         |`setupInput(ws)` — keyboard + touch                   |
|`tests/game.test.js` |Physics unit tests        |`describe("ball physics")`, `describe("scoring")`     |
|`tests/ws.test.js`   |WS integration tests      |`describe("room management")`                         |
|`Makefile`           |Dev commands              |`run`, `test`, `test-unit`, `test-int`, `lint`        |
|`package.json`       |Dependencies + scripts    |`ws`, `qrcode-terminal`, `jest`, `eslint`             |
|`Dockerfile`         |Container                 |Multi-stage, node:20-alpine, non-root                 |
|`.env.example`       |All env vars              |Matches Configuration Reference table exactly         |

### Constraints

- Node.js 20+, ES modules (`"type": "module"` in `package.json`)
- Game logic lives **only** in `server/game.js` — clients never compute physics
- `game.js` must be pure (no I/O, no `require('ws')`) so unit tests run without network
- Canvas size is logical (800×600); clients scale to viewport via CSS
- All WebSocket messages are valid JSON — validate with `JSON.parse` in try/catch
- Mobile client must work with no keyboard — touch buttons only
- `make lint` (ESLint) must pass with zero warnings
- Tests must not open real network ports — mock WebSocket in `ws.test.js`

### Acceptance Criteria

- [ ] `make test` passes, coverage ≥ 80% on `game.js`
- [ ] `make lint` passes
- [ ] Two browser tabs on localhost can complete a full 11-point game
- [ ] Mobile client playable on iOS Safari (no keyboard)
- [ ] QR code printed to terminal on server start; scan opens game
- [ ] Third connection attempt receives `"Room full"` error and is closed
- [ ] Player disconnect mid-game shows overlay on remaining client
- [ ] All Open Questions resolved or moved to v2
- [ ] No `TODO` / `FIXME` in production paths

-----

## Next Steps

1. [ ] Resolve Open Questions (Q1 mobile orientation, Q2 ball acceleration)
1. [ ] Agent: Phase 0 — scaffold repo, CI, lint
1. [ ] Agent: Phase 1 — `game.js` + unit tests
1. [ ] Agent: Phase 2 — `ws-server.js` + integration tests
1. [ ] Agent: Phase 3 — desktop browser client
1. [ ] Agent: Phase 4 — mobile touch client
1. [ ] Agent: Phase 5 — QR code on startup
1. [ ] Human: smoke test on real LAN with two devices
1. [ ] Human: deploy to Raspberry Pi or always-on machine

-----

## References

- [ws — Node.js WebSocket library](https://github.com/websockets/ws)
- [qrcode-terminal](https://github.com/gtanner/qrcode-terminal)
- [HTML Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
