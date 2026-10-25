// 按键/指针输入。
//
// 两个层次：
//   1. 合并层（this.isDown/pressed/axisX/axisY）：WASD、方向键、hjkl 全部映射到同一批
//      名字，单人游戏用它，谁按都算数。
//   2. 玩家层（this.p1 / this.p2）：每人一套互不干扰的键位码，双人游戏用它。
//
// 触屏也分槽位：先按下的手指给 P1，第二根手指给 P2（乒乓/冰球可以两人各拖一个）。

export const KEY_CODES = {
  ArrowUp: ['up'], ArrowDown: ['down'], ArrowLeft: ['left'], ArrowRight: ['right'],
  KeyW: ['w', 'up'], KeyA: ['a', 'left'], KeyS: ['s', 'down'], KeyD: ['d', 'right'],
  KeyK: ['k', 'up'], KeyJ: ['j', 'down'], KeyH: ['h', 'left'], KeyL: ['l', 'right'],
  Space: ['space'], Enter: ['enter'], NumpadEnter: ['enter'],
  Escape: ['esc'], Tab: ['tab'], Backspace: ['backspace'],
  ShiftLeft: ['shift'], ShiftRight: ['shift'],
  KeyQ: ['q'], KeyP: ['p'], KeyR: ['r'], KeyM: ['m'], KeyF: ['f'],
  KeyZ: ['z'], KeyX: ['x'], KeyC: ['c'], KeyN: ['n'], KeyE: ['e'],
  KeyG: ['g'], KeyI: ['i'], KeyT: ['t'], KeyU: ['u'], KeyV: ['v'],
  KeyB: ['b'], KeyO: ['o'], KeyY: ['y'],
  Slash: ['/'], F1: ['f1'],
  Digit1: ['1'], Digit2: ['2'], Digit3: ['3'], Digit4: ['4'], Digit5: ['5'],
  Digit6: ['6'], Digit7: ['7'], Digit8: ['8'], Digit9: ['9'], Digit0: ['0'],
  Numpad1: ['1'], Numpad2: ['2'], Numpad3: ['3'], Numpad4: ['4'], Numpad5: ['5'],
  Numpad6: ['6'], Numpad7: ['7'], Numpad8: ['8'], Numpad9: ['9'], Numpad0: ['0'],
};

// 两名玩家的键位码。互不重叠是双人能同框操作的前提：
// P1 左手区（WASD + F），P2 右手区（方向键 + Enter）。
export const PAD_CODES = {
  1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    fire: ['KeyF', 'Space', 'ShiftLeft'],
  },
  2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    fire: ['Enter', 'NumpadEnter', 'Numpad0', 'ShiftRight'],
  },
};

const SWALLOW = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

/** 单个玩家的按键视图：只认自己那套码。 */
export class Pad {
  constructor(input, map) {
    this.input = input;
    this.map = map;
  }

  _codes(btn) { return this.map[btn] || []; }

  isDown(btn) { return this._codes(btn).some((c) => this.input.codesDown.has(c)); }
  pressed(btn) { return this._codes(btn).some((c) => this.input.codesFresh.has(c)); }
  anyPressed(...btns) { return btns.some((b) => this.pressed(b)); }

  axisX() { return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0); }
  axisY() { return (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0); }

  /** 方向：返回 'up'/'down'/'left'/'right'/null，取最新按下的那个 */
  dir() {
    if (this.pressed('up')) return 'up';
    if (this.pressed('down')) return 'down';
    if (this.pressed('left')) return 'left';
    if (this.pressed('right')) return 'right';
    return null;
  }
}

export class Input {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.engine = engine;

    // 合并层
    this.held = new Set();
    this.fresh = new Set();

    // 原始键码层（玩家层用）
    this.codesDown = new Set();
    this.codesFresh = new Set();

    this.p1 = new Pad(this, PAD_CODES[1]);
    this.p2 = new Pad(this, PAD_CODES[2]);

    // 指针槽位：先按下的手指给 P1
    this.pointers = [];
    this._mouseHover = false;
    this.pointer = { x: 0, y: 0, down: false, active: false, pressed: false };
    this._startX = null;
    this._startY = null;

    this._onKeyDown = (e) => {
      if (window.TerminalArcade && window.TerminalArcade.active !== this.engine) return;
      if (KEY_CODES[e.code]) {
        if (SWALLOW.has(e.code)) e.preventDefault();
        const names = KEY_CODES[e.code];
        const wasHeld = names.some((n) => this.held.has(n));
        names.forEach((n) => this.held.add(n));
        if (!e.repeat && !wasHeld) names.forEach((n) => this.fresh.add(n));
      }
      // 即使不在 CODES 里，玩家层也要能看到（便于自定义键位）
      this.codesDown.add(e.code);
      if (!e.repeat) this.codesFresh.add(e.code);
    };

    this._onKeyUp = (e) => {
      const names = KEY_CODES[e.code];
      if (names) {
        if (SWALLOW.has(e.code)) e.preventDefault();
        names.forEach((n) => this.held.delete(n));
      }
      this.codesDown.delete(e.code);
    };

    this._onBlur = () => {
      this.held.clear();
      this.fresh.clear();
      this.codesDown.clear();
      this.codesFresh.clear();
      this.pointers.length = 0;
      this.pointer.down = false;
      this.pointer.active = false;
    };

    this._onPointer = (e) => this._handlePointer(e);
  }

  _handlePointer(e) {
    const canvas = this.canvas;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const gx = ((e.clientX - r.left) / r.width) * this.engine.cols;
    const gy = ((e.clientY - r.top) / r.height) * this.engine.rows;
    const isMouse = !e.pointerType || e.pointerType === 'mouse';
    const id = isMouse ? 'mouse' : e.pointerId;
    const idx = this.pointers.findIndex((p) => p.id === id);

    if (e.type === 'pointerdown') {
      if (idx < 0) this.pointers.push({ id, x: gx, y: gy });
      else { this.pointers[idx].x = gx; this.pointers[idx].y = gy; }
      canvas.focus();
      this.pointer.pressed = true;
      this._startX = gx;
      this._startY = gy;
    } else if (e.type === 'pointermove') {
      if (idx >= 0) { this.pointers[idx].x = gx; this.pointers[idx].y = gy; }
    } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
      // 触屏：单指滑动 -> 方向键，单指轻点 -> 空格。两指时不做手势，避免干扰双人。
      const touchLike = !isMouse;
      if (touchLike && this._startX !== null && this.pointers.length === 1) {
        const dx = gx - this._startX;
        const dy = gy - this._startY;
        if (Math.hypot(dx, dy) >= 2.5) {
          const dir = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
          this.fresh.add(dir);
        } else {
          this.fresh.add('space');
        }
      }
      if (idx >= 0) this.pointers.splice(idx, 1);
      this._startX = null;
      this._startY = null;
    }

    if (isMouse && e.type === 'pointermove') this._mouseHover = true;

    const first = this.pointers[0];
    this.pointer.x = first ? first.x : gx;
    this.pointer.y = first ? first.y : gy;
    // 鼠标：悬停就算激活（旧行为）；触屏：必须按着
    this.pointer.active = isMouse ? !!this._mouseHover : this.pointers.length > 0;
    if (e.type === 'pointerdown') this.pointer.down = true;
    if (e.type === 'pointerup' || e.type === 'pointercancel') this.pointer.down = false;
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp, { passive: false });
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('pointermove', this._onPointer);
    this.canvas.addEventListener('pointerdown', this._onPointer);
    this.canvas.addEventListener('pointerup', this._onPointer);
    this.canvas.addEventListener('pointercancel', this._onPointer);
    this.canvas.addEventListener('pointerleave', () => {
      this._mouseHover = false;
      this.pointers.length = 0;
      this.pointer.active = false;
      this.pointer.down = false;
    });
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  /** 第 n 个指针槽（0 = P1，1 = P2），没有就返回 null */
  slot(n) { return this.pointers[n] || null; }

  /** 第 n 位玩家可用的指针：0 号槽在没有触摸时回退给鼠标悬停 */
  pointAt(n) {
    const p = this.pointers[n];
    if (p) return p;
    if (n === 0 && this.pointers.length === 0 && this.pointer.active) return this.pointer;
    return null;
  }

  isDown(name) { return this.held.has(name); }
  pressed(name) { return this.fresh.has(name); }
  anyPressed(...names) { return names.some((n) => this.fresh.has(n)); }

  axisX() { return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0); }
  axisY() { return (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0); }

  /** 本帧新按下的方向，没有就返回 null */
  dir() {
    if (this.pressed('up')) return 'up';
    if (this.pressed('down')) return 'down';
    if (this.pressed('left')) return 'left';
    if (this.pressed('right')) return 'right';
    return null;
  }

  endFrame() {
    this.fresh.clear();
    this.codesFresh.clear();
    this.pointer.pressed = false;
  }
}
