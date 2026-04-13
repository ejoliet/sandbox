/* exported Renderer */
'use strict';

class Renderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = config;
  }

  draw(state) {
    const { ctx, cfg } = this;
    const W = cfg.width;
    const H = cfg.height;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Centre dashed line
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.restore();

    // Scores
    ctx.fillStyle = '#fff';
    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.score.p1, W / 4, 60);
    ctx.fillText(state.score.p2, (3 * W) / 4, 60);

    // P1 paddle (left)
    ctx.fillStyle = '#fff';
    ctx.fillRect(cfg.paddleMargin, state.p1.y, cfg.paddleWidth, cfg.paddleHeight);

    // P2 paddle (right)
    ctx.fillRect(W - cfg.paddleMargin - cfg.paddleWidth, state.p2.y, cfg.paddleWidth, cfg.paddleHeight);

    // Ball
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, cfg.ballRadius, 0, Math.PI * 2);
    ctx.fill();

    // Phase overlays
    if (state.phase === 'gameover') {
      this._drawOverlay(
        state.score.p1 > state.score.p2 ? 'Player 1 wins!' : 'Player 2 wins!',
        `${state.score.p1} – ${state.score.p2}`
      );
    } else if (state.phase === 'point') {
      this._drawOverlay('Point!', `${state.score.p1} – ${state.score.p2}`);
    }
  }

  _drawOverlay(line1, line2) {
    const { ctx, cfg } = this;
    const W = cfg.width;
    const H = cfg.height;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(line1, W / 2, H / 2 - 20);

    ctx.font = '28px monospace';
    ctx.fillText(line2, W / 2, H / 2 + 24);
  }
}
