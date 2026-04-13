/* exported Input */
'use strict';

class Input {
  constructor(ws) {
    this.ws = ws;
    this._dir = 'stop';
  }

  _send(dir) {
    if (dir !== this._dir) {
      this._dir = dir;
      this.ws.send(JSON.stringify({ type: 'input', dir }));
    }
  }

  setupKeyboard() {
    const held = {};
    const update = () => {
      if (held['ArrowUp'] || held['w'] || held['W']) {
        this._send('up');
      } else if (held['ArrowDown'] || held['s'] || held['S']) {
        this._send('down');
      } else {
        this._send('stop');
      }
    };

    document.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        held[e.key] = true;
        update();
      }
    });

    document.addEventListener('keyup', (e) => {
      delete held[e.key];
      update();
    });
  }

  setupButtons(upBtn, downBtn) {
    const press = (dir) => () => this._send(dir);
    const release = () => this._send('stop');

    ['touchstart', 'mousedown'].forEach((evt) => {
      upBtn.addEventListener(evt, press('up'), { passive: true });
      downBtn.addEventListener(evt, press('down'), { passive: true });
    });

    ['touchend', 'touchcancel', 'mouseup'].forEach((evt) => {
      upBtn.addEventListener(evt, release, { passive: true });
      downBtn.addEventListener(evt, release, { passive: true });
    });
  }

  sendReady() {
    this.ws.send(JSON.stringify({ type: 'ready' }));
  }

  sendRematch() {
    this.ws.send(JSON.stringify({ type: 'rematch' }));
  }
}
