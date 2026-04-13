'use strict';

const CANVAS_WIDTH = parseInt(process.env.CANVAS_WIDTH || '800', 10);
const CANVAS_HEIGHT = parseInt(process.env.CANVAS_HEIGHT || '600', 10);
const WIN_SCORE = parseInt(process.env.WIN_SCORE || '11', 10);
const BALL_SPEED_INIT = parseFloat(process.env.BALL_SPEED_INIT || '4.0');
const BALL_SPEED_MAX = parseFloat(process.env.BALL_SPEED_MAX || '12.0');
const BALL_SPEED_INCREMENT = 0.5; // linear increase per paddle bounce

const PADDLE_HEIGHT = 80;
const PADDLE_WIDTH = 12;
const PADDLE_SPEED = 5;
const BALL_RADIUS = 8;
const PADDLE_MARGIN = 20;

function _makeBall(dirX) {
  // Serve at a small random vertical angle (-22.5° to +22.5°)
  const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
  const dir = dirX >= 0 ? 1 : -1;
  return {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: Math.cos(angle) * BALL_SPEED_INIT * dir,
    vy: Math.sin(angle) * BALL_SPEED_INIT,
  };
}

function createState() {
  return {
    ball: _makeBall(1),
    p1: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, dir: 'stop' },
    p2: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, dir: 'stop' },
    score: { p1: 0, p2: 0 },
    phase: 'waiting',
    ready: { p1: false, p2: false },
  };
}

function tick(state) {
  if (state.phase !== 'playing') return;

  _movePaddle(state.p1);
  _movePaddle(state.p2);

  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;

  // Top wall
  if (state.ball.y - BALL_RADIUS <= 0) {
    state.ball.y = BALL_RADIUS;
    state.ball.vy = Math.abs(state.ball.vy);
  }

  // Bottom wall
  if (state.ball.y + BALL_RADIUS >= CANVAS_HEIGHT) {
    state.ball.y = CANVAS_HEIGHT - BALL_RADIUS;
    state.ball.vy = -Math.abs(state.ball.vy);
  }

  // P1 paddle (left side)
  const p1Right = PADDLE_MARGIN + PADDLE_WIDTH;
  if (
    state.ball.vx < 0 &&
    state.ball.x - BALL_RADIUS <= p1Right &&
    state.ball.x + BALL_RADIUS >= PADDLE_MARGIN &&
    state.ball.y + BALL_RADIUS >= state.p1.y &&
    state.ball.y - BALL_RADIUS <= state.p1.y + PADDLE_HEIGHT
  ) {
    state.ball.x = p1Right + BALL_RADIUS;
    state.ball.vx = Math.abs(state.ball.vx);
    _accelerate(state.ball);
  }

  // P2 paddle (right side)
  const p2Left = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH;
  if (
    state.ball.vx > 0 &&
    state.ball.x + BALL_RADIUS >= p2Left &&
    state.ball.x - BALL_RADIUS <= CANVAS_WIDTH - PADDLE_MARGIN &&
    state.ball.y + BALL_RADIUS >= state.p2.y &&
    state.ball.y - BALL_RADIUS <= state.p2.y + PADDLE_HEIGHT
  ) {
    state.ball.x = p2Left - BALL_RADIUS;
    state.ball.vx = -Math.abs(state.ball.vx);
    _accelerate(state.ball);
  }

  // Ball exits left → P2 scores
  if (state.ball.x < 0) {
    state.score.p2 += 1;
    _afterPoint(state, 1);
  }

  // Ball exits right → P1 scores
  if (state.ball.x > CANVAS_WIDTH) {
    state.score.p1 += 1;
    _afterPoint(state, -1);
  }
}

function _accelerate(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  const newSpeed = Math.min(speed + BALL_SPEED_INCREMENT, BALL_SPEED_MAX);
  const scale = newSpeed / speed;
  ball.vx *= scale;
  ball.vy *= scale;
}

function _afterPoint(state, serveDir) {
  if (state.score.p1 >= WIN_SCORE || state.score.p2 >= WIN_SCORE) {
    state.phase = 'gameover';
  } else {
    state.phase = 'point';
    Object.assign(state.ball, _makeBall(serveDir));
  }
}

function _movePaddle(paddle) {
  if (paddle.dir === 'up') {
    paddle.y = Math.max(0, paddle.y - PADDLE_SPEED);
  } else if (paddle.dir === 'down') {
    paddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, paddle.y + PADDLE_SPEED);
  }
}

function applyInput(state, player, dir) {
  if (state[player]) {
    state[player].dir = dir;
  }
}

function setReady(state, player) {
  if (!state.ready[player]) {
    state.ready[player] = true;
  }
  if (state.ready.p1 && state.ready.p2 && state.phase === 'waiting') {
    state.phase = 'playing';
  }
}

function resumeAfterPoint(state) {
  if (state.phase === 'point') {
    state.phase = 'playing';
  }
}

function startRematch(_state) {
  const fresh = createState();
  // Preserve player identities; both must re-ready
  return fresh;
}

module.exports = {
  createState,
  tick,
  applyInput,
  setReady,
  resumeAfterPoint,
  startRematch,
  // Constants exported for renderer and tests
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WIN_SCORE,
  BALL_SPEED_INIT,
  BALL_SPEED_MAX,
  BALL_SPEED_INCREMENT,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_SPEED,
  BALL_RADIUS,
  PADDLE_MARGIN,
};
