'use strict';

const game = require('../server/game');

// ─── helpers ──────────────────────────────────────────────────────────────────

function startedState() {
  const s = game.createState();
  game.setReady(s, 'p1');
  game.setReady(s, 'p2');
  return s;
}

// ─── createState ──────────────────────────────────────────────────────────────

describe('createState', () => {
  test('initialises with waiting phase', () => {
    const s = game.createState();
    expect(s.phase).toBe('waiting');
  });

  test('score starts at 0-0', () => {
    const s = game.createState();
    expect(s.score).toEqual({ p1: 0, p2: 0 });
  });

  test('ready flags start false', () => {
    const s = game.createState();
    expect(s.ready).toEqual({ p1: false, p2: false });
  });

  test('ball starts at canvas centre', () => {
    const s = game.createState();
    expect(s.ball.x).toBe(game.CANVAS_WIDTH / 2);
    expect(s.ball.y).toBe(game.CANVAS_HEIGHT / 2);
  });

  test('paddles start at vertical centre', () => {
    const s = game.createState();
    const expected = game.CANVAS_HEIGHT / 2 - game.PADDLE_HEIGHT / 2;
    expect(s.p1.y).toBe(expected);
    expect(s.p2.y).toBe(expected);
  });
});

// ─── setReady ─────────────────────────────────────────────────────────────────

describe('setReady', () => {
  test('stays waiting until both players ready', () => {
    const s = game.createState();
    game.setReady(s, 'p1');
    expect(s.phase).toBe('waiting');
  });

  test('transitions to playing when both ready', () => {
    const s = game.createState();
    game.setReady(s, 'p1');
    game.setReady(s, 'p2');
    expect(s.phase).toBe('playing');
  });

  test('calling setReady twice for same player is idempotent', () => {
    const s = game.createState();
    game.setReady(s, 'p1');
    game.setReady(s, 'p1');
    game.setReady(s, 'p2');
    expect(s.phase).toBe('playing');
  });
});

// ─── applyInput ───────────────────────────────────────────────────────────────

describe('applyInput', () => {
  test('sets p1 direction', () => {
    const s = game.createState();
    game.applyInput(s, 'p1', 'up');
    expect(s.p1.dir).toBe('up');
  });

  test('sets p2 direction', () => {
    const s = game.createState();
    game.applyInput(s, 'p2', 'down');
    expect(s.p2.dir).toBe('down');
  });

  test('ignores unknown player without throwing', () => {
    const s = game.createState();
    expect(() => game.applyInput(s, 'p3', 'up')).not.toThrow();
  });
});

// ─── tick – no-op when not playing ────────────────────────────────────────────

describe('tick – phase guards', () => {
  test('ball does not move in waiting phase', () => {
    const s = game.createState();
    const x = s.ball.x;
    game.tick(s);
    expect(s.ball.x).toBe(x);
  });

  test('ball does not move in point phase', () => {
    const s = startedState();
    s.phase = 'point';
    const x = s.ball.x;
    game.tick(s);
    expect(s.ball.x).toBe(x);
  });

  test('ball does not move in gameover phase', () => {
    const s = startedState();
    s.phase = 'gameover';
    const x = s.ball.x;
    game.tick(s);
    expect(s.ball.x).toBe(x);
  });
});

// ─── tick – ball movement ─────────────────────────────────────────────────────

describe('tick – ball movement', () => {
  test('ball advances by vx, vy each tick', () => {
    const s = startedState();
    s.ball = { x: 400, y: 300, vx: 5, vy: 3 };
    game.tick(s);
    expect(s.ball.x).toBeCloseTo(405);
    expect(s.ball.y).toBeCloseTo(303);
  });
});

// ─── tick – wall bounces ──────────────────────────────────────────────────────

describe('tick – wall bounces', () => {
  test('bounces off top wall', () => {
    const s = startedState();
    s.ball = { x: game.CANVAS_WIDTH / 2, y: game.BALL_RADIUS, vx: 0, vy: -3 };
    game.tick(s);
    expect(s.ball.vy).toBeGreaterThan(0);
    expect(s.ball.y).toBeGreaterThanOrEqual(game.BALL_RADIUS);
  });

  test('bounces off bottom wall', () => {
    const s = startedState();
    s.ball = { x: game.CANVAS_WIDTH / 2, y: game.CANVAS_HEIGHT - game.BALL_RADIUS, vx: 0, vy: 3 };
    game.tick(s);
    expect(s.ball.vy).toBeLessThan(0);
    expect(s.ball.y).toBeLessThanOrEqual(game.CANVAS_HEIGHT - game.BALL_RADIUS);
  });
});

// ─── tick – paddle bounces ────────────────────────────────────────────────────

describe('tick – paddle bounces', () => {
  test('bounces off P1 paddle and reverses vx to positive', () => {
    const s = startedState();
    const p1Right = game.PADDLE_MARGIN + game.PADDLE_WIDTH;
    s.ball = {
      x: p1Right + game.BALL_RADIUS + 1,
      y: s.p1.y + game.PADDLE_HEIGHT / 2,
      vx: -6,
      vy: 0,
    };
    game.tick(s);
    expect(s.ball.vx).toBeGreaterThan(0);
  });

  test('bounces off P2 paddle and reverses vx to negative', () => {
    const s = startedState();
    const p2Left = game.CANVAS_WIDTH - game.PADDLE_MARGIN - game.PADDLE_WIDTH;
    s.ball = {
      x: p2Left - game.BALL_RADIUS - 1,
      y: s.p2.y + game.PADDLE_HEIGHT / 2,
      vx: 6,
      vy: 0,
    };
    game.tick(s);
    expect(s.ball.vx).toBeLessThan(0);
  });

  test('ball speeds up linearly after paddle bounce', () => {
    const s = startedState();
    const p1Right = game.PADDLE_MARGIN + game.PADDLE_WIDTH;
    s.ball = {
      x: p1Right + game.BALL_RADIUS + 1,
      y: s.p1.y + game.PADDLE_HEIGHT / 2,
      vx: -game.BALL_SPEED_INIT,
      vy: 0,
    };
    const before = Math.hypot(s.ball.vx, s.ball.vy);
    game.tick(s);
    const after = Math.hypot(s.ball.vx, s.ball.vy);
    expect(after).toBeCloseTo(before + game.BALL_SPEED_INCREMENT, 5);
  });

  test('ball speed does not exceed BALL_SPEED_MAX', () => {
    const s = startedState();
    const p1Right = game.PADDLE_MARGIN + game.PADDLE_WIDTH;
    s.ball = {
      x: p1Right + game.BALL_RADIUS + 1,
      y: s.p1.y + game.PADDLE_HEIGHT / 2,
      vx: -game.BALL_SPEED_MAX,
      vy: 0,
    };
    game.tick(s);
    const speed = Math.hypot(s.ball.vx, s.ball.vy);
    expect(speed).toBeLessThanOrEqual(game.BALL_SPEED_MAX + 1e-9);
  });

  test('ball misses paddle (above) – no bounce', () => {
    const s = startedState();
    const p1Right = game.PADDLE_MARGIN + game.PADDLE_WIDTH;
    s.ball = {
      x: p1Right + game.BALL_RADIUS + 1,
      y: s.p1.y - game.PADDLE_HEIGHT,   // clearly above paddle
      vx: -6,
      vy: 0,
    };
    game.tick(s);
    // vx stays negative (no bounce happened before potential scoring)
    // The ball may have scored; just ensure no vx sign flip from a paddle
    const scored = s.score.p2 > 0 || s.phase === 'point';
    const bounced = s.ball.vx > 0;
    expect(scored || !bounced).toBe(true);
  });
});

// ─── tick – scoring ───────────────────────────────────────────────────────────

describe('tick – scoring', () => {
  test('P2 scores when ball exits left', () => {
    const s = startedState();
    s.ball = { x: 1, y: game.CANVAS_HEIGHT / 2, vx: -5, vy: 0 };
    game.tick(s);
    expect(s.score.p2).toBe(1);
  });

  test('P1 scores when ball exits right', () => {
    const s = startedState();
    s.ball = { x: game.CANVAS_WIDTH - 1, y: game.CANVAS_HEIGHT / 2, vx: 5, vy: 0 };
    game.tick(s);
    expect(s.score.p1).toBe(1);
  });

  test('phase becomes point (not gameover) for non-final point', () => {
    const s = startedState();
    s.ball = { x: 1, y: game.CANVAS_HEIGHT / 2, vx: -5, vy: 0 };
    game.tick(s);
    expect(s.phase).toBe('point');
  });

  test('phase becomes gameover when score reaches WIN_SCORE', () => {
    const s = startedState();
    s.score.p1 = game.WIN_SCORE - 1;
    s.ball = { x: game.CANVAS_WIDTH - 1, y: game.CANVAS_HEIGHT / 2, vx: 5, vy: 0 };
    game.tick(s);
    expect(s.phase).toBe('gameover');
  });

  test('ball resets to centre after a non-final point', () => {
    const s = startedState();
    s.ball = { x: 1, y: game.CANVAS_HEIGHT / 2, vx: -5, vy: 0 };
    game.tick(s);
    expect(s.ball.x).toBe(game.CANVAS_WIDTH / 2);
    expect(s.ball.y).toBe(game.CANVAS_HEIGHT / 2);
  });
});

// ─── tick – paddle movement ───────────────────────────────────────────────────

describe('tick – paddle movement', () => {
  test('paddle moves up when dir is up', () => {
    const s = startedState();
    const before = s.p1.y;
    game.applyInput(s, 'p1', 'up');
    game.tick(s);
    expect(s.p1.y).toBeLessThan(before);
  });

  test('paddle moves down when dir is down', () => {
    const s = startedState();
    const before = s.p1.y;
    game.applyInput(s, 'p1', 'down');
    game.tick(s);
    expect(s.p1.y).toBeGreaterThan(before);
  });

  test('paddle stops at top boundary', () => {
    const s = startedState();
    s.p1.y = 0;
    game.applyInput(s, 'p1', 'up');
    game.tick(s);
    expect(s.p1.y).toBeGreaterThanOrEqual(0);
  });

  test('paddle stops at bottom boundary', () => {
    const s = startedState();
    s.p1.y = game.CANVAS_HEIGHT - game.PADDLE_HEIGHT;
    game.applyInput(s, 'p1', 'down');
    game.tick(s);
    expect(s.p1.y).toBeLessThanOrEqual(game.CANVAS_HEIGHT - game.PADDLE_HEIGHT);
  });

  test('paddle does not move when dir is stop', () => {
    const s = startedState();
    s.p2.y = 200;
    game.applyInput(s, 'p2', 'stop');
    game.tick(s);
    expect(s.p2.y).toBe(200);
  });
});

// ─── resumeAfterPoint ─────────────────────────────────────────────────────────

describe('resumeAfterPoint', () => {
  test('transitions point phase back to playing', () => {
    const s = startedState();
    s.phase = 'point';
    game.resumeAfterPoint(s);
    expect(s.phase).toBe('playing');
  });

  test('does nothing in other phases', () => {
    const s = startedState();
    s.phase = 'gameover';
    game.resumeAfterPoint(s);
    expect(s.phase).toBe('gameover');
  });
});

// ─── startRematch ─────────────────────────────────────────────────────────────

describe('startRematch', () => {
  test('resets score to 0-0', () => {
    const s = startedState();
    s.score = { p1: 7, p2: 11 };
    s.phase = 'gameover';
    const fresh = game.startRematch(s);
    expect(fresh.score).toEqual({ p1: 0, p2: 0 });
  });

  test('resets phase to waiting', () => {
    const s = startedState();
    s.phase = 'gameover';
    const fresh = game.startRematch(s);
    expect(fresh.phase).toBe('waiting');
  });

  test('resets ready flags', () => {
    const s = startedState();
    const fresh = game.startRematch(s);
    expect(fresh.ready).toEqual({ p1: false, p2: false });
  });
});
