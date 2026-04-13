'use strict';

const WebSocket = require('ws');

// Each test gets a fresh server instance so state never bleeds between tests.
let srv, wssRef, stopFn;

beforeEach((done) => {
  jest.resetModules();
  const mod = require('../server/ws-server');
  srv    = mod.server;
  wssRef = mod.wss;
  stopFn = mod.stop;
  mod.start(0, done);
});

afterEach((done) => {
  // Force-terminate every open WebSocket so server.close() resolves promptly.
  for (const ws of wssRef.clients) {
    ws.terminate();
  }
  stopFn(done);
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function serverUrl() {
  return `ws://127.0.0.1:${srv.address().port}`;
}

/**
 * Opens a WebSocket and attaches a message queue immediately (before 'open'
 * fires) so no messages are ever lost to a race between server send and
 * listener registration.  The returned socket has an extra `nextMsg()`
 * method that drains the queue.
 */
function connect() {
  return new Promise((resolve, reject) => {
    const ws     = new WebSocket(serverUrl());
    const queue  = [];          // buffered messages not yet consumed
    const waiters = [];         // pending nextMsg() promises

    ws.on('message', (data) => {
      let parsed;
      try { parsed = JSON.parse(data.toString()); } catch { return; }
      if (waiters.length > 0) {
        waiters.shift()(parsed);
      } else {
        queue.push(parsed);
      }
    });

    ws.nextMsg = () =>
      queue.length > 0
        ? Promise.resolve(queue.shift())
        : new Promise((res) => waiters.push(res));

    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

/** Alias kept for readability in tests. */
function nextMessage(ws) {
  return ws.nextMsg();
}

function send(ws, obj) {
  ws.send(JSON.stringify(obj));
}

function closeAll(...sockets) {
  return Promise.all(
    sockets.map(
      (ws) =>
        new Promise((resolve) => {
          if (ws.readyState === WebSocket.CLOSED) { resolve(); return; }
          ws.once('close', resolve);
          ws.close();
        })
    )
  );
}

// ─── connection and player assignment ────────────────────────────────────────

describe('connection and player assignment', () => {
  test('first client is assigned p1', async () => {
    const ws = await connect();
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('assign');
    expect(msg.player).toBe('p1');
    expect(msg.config).toHaveProperty('width');
    await closeAll(ws);
  });

  test('second client is assigned p2', async () => {
    const ws1 = await connect();
    const ws2 = await connect();
    const msg1 = await nextMessage(ws1);
    const msg2 = await nextMessage(ws2);
    expect(msg1.player).toBe('p1');
    expect(msg2.player).toBe('p2');
    await closeAll(ws1, ws2);
  });

  test('assign message includes game config', async () => {
    const ws = await connect();
    const msg = await nextMessage(ws);
    expect(msg.config).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
      paddleHeight: expect.any(Number),
      paddleWidth: expect.any(Number),
      paddleMargin: expect.any(Number),
      ballRadius: expect.any(Number),
    });
    await closeAll(ws);
  });

  test('third client receives Room full error and is closed', async () => {
    const ws1 = await connect();
    const ws2 = await connect();
    await nextMessage(ws1);
    await nextMessage(ws2);

    const ws3 = await connect();
    const err = await nextMessage(ws3);
    expect(err.type).toBe('error');
    expect(err.message).toBe('Room full');

    // Server closes ws3 after sending the error
    await new Promise((resolve) => {
      if (ws3.readyState === WebSocket.CLOSED) { resolve(); return; }
      ws3.once('close', resolve);
    });

    await closeAll(ws1, ws2);
  });
});

// ─── game start ───────────────────────────────────────────────────────────────

describe('game start via ready messages', () => {
  test('state phase becomes playing after both clients send ready', async () => {
    const ws1 = await connect();
    const ws2 = await connect();
    await nextMessage(ws1); // assign
    await nextMessage(ws2); // assign

    send(ws1, { type: 'ready' });
    send(ws2, { type: 'ready' });

    // Drain state messages until we see phase === 'playing'
    let phase = 'waiting';
    while (phase !== 'playing') {
      const msg = await nextMessage(ws1);
      if (msg.type === 'state') phase = msg.phase;
    }
    expect(phase).toBe('playing');
    await closeAll(ws1, ws2);
  });
});

// ─── input handling ───────────────────────────────────────────────────────────

describe('input handling', () => {
  test('invalid input dir is silently ignored', async () => {
    const ws1 = await connect();
    const ws2 = await connect();
    await nextMessage(ws1);
    await nextMessage(ws2);

    // Should not throw or kill the server
    send(ws1, { type: 'input', dir: 'sideways' });
    send(ws1, { type: 'ready' });
    send(ws2, { type: 'ready' });

    // Server still responds with state messages
    let gotState = false;
    for (let i = 0; i < 15; i++) {
      const msg = await nextMessage(ws1);
      if (msg.type === 'state') { gotState = true; break; }
    }
    expect(gotState).toBe(true);
    await closeAll(ws1, ws2);
  });
});

// ─── disconnect handling ──────────────────────────────────────────────────────

describe('disconnect handling', () => {
  test('remaining client receives disconnect notification when opponent leaves', async () => {
    const ws1 = await connect();
    const ws2 = await connect();
    await nextMessage(ws1);
    await nextMessage(ws2);

    await closeAll(ws2);

    // Drain messages on ws1 until we receive the disconnect notice
    let gotDisconnect = false;
    for (let i = 0; i < 20; i++) {
      try {
        const msg = await Promise.race([
          nextMessage(ws1),
          new Promise((_, rej) => setTimeout(rej, 500)),
        ]);
        if (msg.type === 'disconnect') { gotDisconnect = true; break; }
      } catch { break; }
    }
    expect(gotDisconnect).toBe(true);
    await closeAll(ws1);
  });
});

// ─── HTTP static file serving ─────────────────────────────────────────────────

describe('HTTP static file serving', () => {
  function httpGet(reqPath) {
    const http = require('http');
    const port = srv.address().port;
    return new Promise((resolve, reject) => {
      // Use options-object form so Node.js does NOT normalise the path —
      // important for the path-traversal test.
      const req = http.request(
        { hostname: '127.0.0.1', port, path: reqPath, method: 'GET' },
        (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  test('GET / serves index.html with 200', async () => {
    const res = await httpGet('/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.headers['content-type']).toContain('text/html');
  });

  test('GET /mobile.html serves mobile client', async () => {
    const res = await httpGet('/mobile.html');
    expect(res.status).toBe(200);
    expect(res.body).toContain('LAN-Pong Mobile');
  });

  test('GET /renderer.js serves JavaScript', async () => {
    const res = await httpGet('/renderer.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
  });

  test('GET /missing.html returns 404', async () => {
    const res = await httpGet('/missing.html');
    expect(res.status).toBe(404);
  });

  test('path traversal attempt returns 403', async () => {
    const res = await httpGet('/../package.json');
    expect(res.status).toBe(403);
  });
});
