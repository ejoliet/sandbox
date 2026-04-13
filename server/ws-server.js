'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const game = require('./game');
const { printQR } = require('./qr');

const PORT = parseInt(process.env.PORT || '3000', 10);
const TICK_RATE = parseInt(process.env.TICK_RATE || '60', 10);
const TICK_INTERVAL = Math.floor(1000 / TICK_RATE);
const POINT_PAUSE_MS = 2000;

const CLIENT_DIR = path.join(__dirname, '..', 'client');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const filePath = urlPath === '/' ? '/index.html' : urlPath;
  const fullPath = path.resolve(CLIENT_DIR, '.' + filePath);

  // Prevent path traversal outside client dir
  if (!fullPath.startsWith(path.resolve(CLIENT_DIR))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// Room state
let state = game.createState();
const clients = {};   // { p1: WebSocket | null, p2: WebSocket | null }
let tickTimer = null;
let pointTimer = null;

function broadcast(msg) {
  const json = JSON.stringify(msg);
  for (const ws of Object.values(clients)) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

function stateMsg() {
  return {
    type: 'state',
    ball: { x: state.ball.x, y: state.ball.y, vx: state.ball.vx, vy: state.ball.vy },
    p1: { y: state.p1.y },
    p2: { y: state.p2.y },
    score: { p1: state.score.p1, p2: state.score.p2 },
    phase: state.phase,
  };
}

function configMsg(player) {
  return {
    type: 'assign',
    player,
    config: {
      width: game.CANVAS_WIDTH,
      height: game.CANVAS_HEIGHT,
      paddleHeight: game.PADDLE_HEIGHT,
      paddleWidth: game.PADDLE_WIDTH,
      paddleMargin: game.PADDLE_MARGIN,
      ballRadius: game.BALL_RADIUS,
    },
  };
}

function startLoop() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    game.tick(state);

    if (state.phase === 'point' && !pointTimer) {
      pointTimer = setTimeout(() => {
        pointTimer = null;
        game.resumeAfterPoint(state);
      }, POINT_PAUSE_MS);
    }

    broadcast(stateMsg());
  }, TICK_INTERVAL);
}

function stopLoop() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  if (pointTimer) { clearTimeout(pointTimer); pointTimer = null; }
}

function resetRoom() {
  stopLoop();
  state = game.createState();
  delete clients.p1;
  delete clients.p2;
}

function assignSlot(ws) {
  if (!clients.p1) { clients.p1 = ws; return 'p1'; }
  if (!clients.p2) { clients.p2 = ws; return 'p2'; }
  return null;
}

wss.on('connection', (ws) => {
  const player = assignSlot(ws);

  if (!player) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room full' }));
    ws.close();
    return;
  }

  ws.send(JSON.stringify(configMsg(player)));

  // Once both seats are filled, start the game loop
  if (clients.p1 && clients.p2) {
    startLoop();
  }

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {
      case 'input':
        if (['up', 'down', 'stop'].includes(msg.dir)) {
          game.applyInput(state, player, msg.dir);
        }
        break;

      case 'ready':
        game.setReady(state, player);
        break;

      case 'rematch':
        if (state.phase === 'gameover') {
          stopLoop();
          state = game.startRematch(state);
          broadcast({ type: 'rematch' });
          startLoop();
        }
        break;
    }
  });

  ws.on('close', () => {
    if (clients[player] === ws) {
      delete clients[player];
    }
    broadcast({ type: 'disconnect', message: 'Opponent disconnected' });

    // If both gone, reset for next session
    if (!clients.p1 && !clients.p2) {
      resetRoom();
    }
  });
});

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function start(port, callback) {
  server.listen(port, '0.0.0.0', callback);
}

function stop(callback) {
  stopLoop();
  wss.close(() => server.close(callback));
}

/* istanbul ignore next */
if (require.main === module) {
  start(PORT, () => {
    const lanIP = getLanIP();
    const url = `http://${lanIP}:${PORT}`;
    console.log(`LAN-Pong listening on port ${PORT}`);
    console.log(`Player 1 (desktop): http://localhost:${PORT}`);
    console.log(`Player 2 (mobile):  ${url}/mobile.html`);
    printQR(`${url}/mobile.html`);
  });
}

module.exports = { server, wss, start, stop, resetRoom };
