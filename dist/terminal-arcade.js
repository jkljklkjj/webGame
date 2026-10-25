/*! TERMINAL ARCADE — 字符终端小游戏框架（单文件构建）
 *  纯 canvas 字符网格渲染，零依赖。
 *  用法：<link rel="stylesheet" href="terminal-arcade.css"> +
 *        <div data-arcade></div> + 引入本文件即可
 */
(function () {
  'use strict';
  if (window.__terminalArcadeLoaded) return;
  window.__terminalArcadeLoaded = true;

  var __defs = {};
  var __cache = {};

  function __req(id) {
    var cached = __cache[id];
    if (cached) return cached;
    var mod = (__cache[id] = {});
    var def = __defs[id];
    if (!def) throw new Error('[arcade] 模块未打包: ' + id);
    def(mod, __req);
    return mod;
  }

  // ---- src/core/palette.js ----
  __defs["src/core/palette.js"] = function (__exports, __req) {
    // 终端调色板：名字 -> CSS 颜色。游戏里直接写字符串名字。
    //
    // 主色是橙色：界面骨架（边框、标题、状态栏、按钮提示）用 accent / accent2，
    // 其余色相留给游戏内容（棋子、砖块、外星人……），保证画面不是一片橙。
    const COLORS = {
      bg:      '#0f0a06',
      bg2:     '#19110a',
      bg3:     '#2a1b0d',
    
      default: '#f0d8bd',   // 正文暖白
      dim:     '#93714f',
      faint:   '#4e3a26',
      white:   '#fff4e6',
    
      accent:  '#ff9d2e',   // 主色：橙
      accent2: '#b96c14',   // 主色暗版：边框、分隔线、次要标题
    
      amber:   '#ffc355',
      yellow:  '#ffe27a',
      red:     '#ff5a52',
      red2:    '#a83232',
      cyan:    '#5ad7e6',
      blue:    '#6d9cff',
      magenta: '#ff7ae0',
      violet:  '#b48cff',
      orange:  '#ff8a1f',
      green:   '#5fd97c',   // 留给棋子/“完成”态，保持可辨
    };
    
    function css(name, fallback) {
      if (!name) return COLORS[fallback || 'default'];
      return COLORS[name] || name;
    }
    
    __exports.COLORS = COLORS;
  __exports.css = css;
  };

  // ---- src/core/screen.js ----
  __defs["src/core/screen.js"] = function (__exports, __req) {
    const { COLORS, css } = __req("src/core/palette.js");
    
    const FONT_STACK =
      'ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
    
    const BOX = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', lt: '├', rt: '┤' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', lt: '╠', rt: '╣' },
      round:  { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', lt: '├', rt: '┤' },
      ascii:  { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', lt: '+', rt: '+' },
    };
    
    const CONT = '\u0000'; // 宽字符的占位格
    
    /** 全角/宽字符判断（CJK、假名、谚文、全角标点、常见 emoji） */
    function isWide(ch) {
      if (!ch) return false;
      const c = ch.codePointAt(0);
      if (c < 0x1100) return false;
      return (
        (c >= 0x1100 && c <= 0x115f) ||
        (c >= 0x2e80 && c <= 0x303e) ||
        (c >= 0x3041 && c <= 0x33ff) ||
        (c >= 0x3400 && c <= 0x4dbf) ||
        (c >= 0x4e00 && c <= 0x9fff) ||
        (c >= 0xa000 && c <= 0xa4cf) ||
        (c >= 0xa960 && c <= 0xa97f) ||
        (c >= 0xac00 && c <= 0xd7a3) ||
        (c >= 0xf900 && c <= 0xfaff) ||
        (c >= 0xfe10 && c <= 0xfe19) ||
        (c >= 0xfe30 && c <= 0xfe6f) ||
        (c >= 0xff00 && c <= 0xff60) ||
        (c >= 0xffe0 && c <= 0xffe6) ||
        (c >= 0x1f300 && c <= 0x1f9ff) ||
        (c >= 0x20000 && c <= 0x3fffd)
      );
    }
    
    /** 字符串占用的网格宽度 */
    function strWidth(str) {
      let n = 0;
      for (const ch of String(str)) n += isWide(ch) ? 2 : 1;
      return n;
    }
    
    /**
     * 字符缓冲层。游戏只往这个网格里写字符和颜色，
     * 渲染时按"同色连续段"批量 fillText，一帧几十次绘制即可。
     * 宽字符（中文）占两格，第二格是占位符，渲染时单独处理以保证对齐。
     */
    class Screen {
      constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        const n = cols * rows;
        this.ch = new Array(n).fill(' ');
        this.fg = new Array(n).fill(null);
        this.bg = new Array(n).fill(null);
        this.wide = new Uint8Array(n); // 1=宽字符首格 2=占位格
        this.dpr = 1;
        this.cellW = 10;
        this.cellH = 16;
        this.pxW = 800;
        this.pxH = 576;
        this.font = `16px ${FONT_STACK}`;
      }
    
      layout(ctx) {
        const size = 16;
        this.font = `${size}px ${FONT_STACK}`;
        ctx.font = this.font;
        const adv = ctx.measureText('MMMMMMMMMM').width / 10;
        this.cellW = adv;
        this.cellH = Math.round(adv * 1.58);
        this.pxW = Math.ceil(adv * this.cols);
        this.pxH = this.cellH * this.rows;
      }
    
      width(str) { return strWidth(str); }
    
      clear(bg = 'bg') {
        this.ch.fill(' ');
        this.fg.fill(null);
        this.bg.fill(bg);
        this.wide.fill(0);
      }
    
      put(x, y, ch, fg = null, bg = null) {
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
        ch = ch === '' ? ' ' : ch;
        const i = y * this.cols + x;
        const prev = this.wide[i];
    
        // 覆盖宽字符的任意一半时，把另一半擦掉，避免残影
        if (prev === 1 && x + 1 < this.cols) {
          const j = i + 1;
          this.ch[j] = ' '; this.fg[j] = fg; this.bg[j] = bg; this.wide[j] = 0;
        } else if (prev === 2 && x - 1 >= 0) {
          const j = i - 1;
          this.ch[j] = ' '; this.fg[j] = fg; this.bg[j] = bg; this.wide[j] = 0;
        }
    
        this.ch[i] = ch;
        this.fg[i] = fg;
        this.bg[i] = bg;
    
        if (isWide(ch)) {
          this.wide[i] = 1;
          if (x + 1 < this.cols) {
            const j = i + 1;
            this.ch[j] = CONT; this.fg[j] = fg; this.bg[j] = bg; this.wide[j] = 2;
          }
        } else {
          this.wide[i] = 0;
        }
      }
    
      write(x, y, str, fg = null, bg = null) {
        str = String(str);
        let cx = x | 0;
        const cy = y | 0;
        for (const ch of str) {
          this.put(cx, cy, ch, fg, bg);
          cx += isWide(ch) ? 2 : 1;
        }
      }
    
      writeCenter(y, str, fg = null, bg = null) {
        str = String(str);
        this.write(Math.floor((this.cols - strWidth(str)) / 2), y, str, fg, bg);
      }
    
      writeRight(xRight, y, str, fg = null, bg = null) {
        str = String(str);
        this.write(xRight - strWidth(str) + 1, y, str, fg, bg);
      }
    
      fill(x, y, w, h, ch = ' ', fg = null, bg = null) {
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) this.put(x + i, y + j, ch, fg, bg);
        }
      }
    
      hline(x, y, w, ch = '─', fg = null, bg = null) {
        for (let i = 0; i < w; i++) this.put(x + i, y, ch, fg, bg);
      }
    
      vline(x, y, h, ch = '│', fg = null, bg = null) {
        for (let j = 0; j < h; j++) this.put(x, y + j, ch, fg, bg);
      }
    
      /** 边框盒。title 画在顶边上，宽字符也算对。 */
      box(x, y, w, h, fg = 'dim', bg = null, style = 'single', title = '') {
        const B = BOX[style] || BOX.single;
        if (w < 2 || h < 2) return;
        this.put(x, y, B.tl, fg, bg);
        this.put(x + w - 1, y, B.tr, fg, bg);
        this.put(x, y + h - 1, B.bl, fg, bg);
        this.put(x + w - 1, y + h - 1, B.br, fg, bg);
        for (let i = 1; i < w - 1; i++) {
          this.put(x + i, y, B.h, fg, bg);
          this.put(x + i, y + h - 1, B.h, fg, bg);
        }
        for (let j = 1; j < h - 1; j++) {
          this.put(x, y + j, B.v, fg, bg);
          this.put(x + w - 1, y + j, B.v, fg, bg);
        }
        if (title) {
          const room = w - 4;
          let t = '';
          let used = 0;
          for (const ch of ` ${title} `) {
            const cw = isWide(ch) ? 2 : 1;
            if (used + cw > room) break;
            t += ch;
            used += cw;
          }
          this.write(x + 2, y, t, 'accent', bg);
        }
      }
    
      render(ctx) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, this.pxW, this.pxH);
        ctx.font = this.font;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
    
        const { cols, rows, cellW, cellH } = this;
    
        for (let y = 0; y < rows; y++) {
          const rowBase = y * cols;
          const py = y * cellH;
          const ty = py + cellH * 0.56;
          let x = 0;
    
          while (x < cols) {
            const i = rowBase + x;
            const wf = this.wide[i];
    
            // 宽字符占位格：只补背景
            if (wf === 2) {
              if (this.bg[i]) {
                ctx.fillStyle = css(this.bg[i], 'bg');
                ctx.fillRect(x * cellW, py, cellW, cellH);
              }
              x++;
              continue;
            }
    
            // 宽字符本体：单独画（它的推进宽度不等于 cellW）
            if (wf === 1) {
              if (this.bg[i]) {
                ctx.fillStyle = css(this.bg[i], 'bg');
                ctx.fillRect(x * cellW, py, cellW * 2, cellH);
              }
              ctx.fillStyle = css(this.fg[i], 'default');
              ctx.fillText(this.ch[i], x * cellW, ty);
              x += 2;
              continue;
            }
    
            // 普通字符：攒一段同色连续段，一次 fillText 画完
            const ch = this.ch[i];
            const bg = this.bg[i];
            if (ch === ' ' && !bg) { x++; continue; }
    
            const fg = this.fg[i];
            let run = '';
            const x0 = x;
            while (x < cols) {
              const j = rowBase + x;
              if (this.wide[j] !== 0) break;
              if (this.fg[j] !== fg || this.bg[j] !== bg) break;
              if (this.ch[j] === ' ' && !bg) break;
              run += this.ch[j];
              x++;
            }
    
            if (bg) {
              ctx.fillStyle = css(bg, 'bg');
              ctx.fillRect(x0 * cellW, py, (x - x0) * cellW, cellH);
            }
            if (run.trim()) {
              ctx.fillStyle = css(fg, 'default');
              ctx.fillText(run, x0 * cellW, ty);
            }
          }
        }
      }
    
      flush(ctx) { this.render(ctx); }
    
      /** 调试用：导出为纯文本 */
      text() {
        const out = [];
        for (let y = 0; y < this.rows; y++) {
          let line = '';
          for (let x = 0; x < this.cols; x++) {
            const i = y * this.cols + x;
            if (this.wide[i] === 2) continue;
            line += this.ch[i] === CONT ? ' ' : this.ch[i];
          }
          out.push(line.replace(/\s+$/, ''));
        }
        return out.join('\n');
      }
    }
    
    __exports.isWide = isWide;
  __exports.strWidth = strWidth;
  __exports.Screen = Screen;
  };

  // ---- src/core/input.js ----
  __defs["src/core/input.js"] = function (__exports, __req) {
    // 按键/指针输入。
    //
    // 两个层次：
    //   1. 合并层（this.isDown/pressed/axisX/axisY）：WASD、方向键、hjkl 全部映射到同一批
    //      名字，单人游戏用它，谁按都算数。
    //   2. 玩家层（this.p1 / this.p2）：每人一套互不干扰的键位码，双人游戏用它。
    //
    // 触屏也分槽位：先按下的手指给 P1，第二根手指给 P2（乒乓/冰球可以两人各拖一个）。
    
    const KEY_CODES = {
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
    const PAD_CODES = {
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
    class Pad {
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
    
    class Input {
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
    
    __exports.KEY_CODES = KEY_CODES;
  __exports.PAD_CODES = PAD_CODES;
  __exports.Pad = Pad;
  __exports.Input = Input;
  };

  // ---- src/core/audio.js ----
  __defs["src/core/audio.js"] = function (__exports, __req) {
    // 极简 WebAudio 音效：一个方波蜂鸣器，够"终端"了。
    class Beeps {
      constructor() {
        this.ctx = null;
        this.muted = false;
      }
    
      resume() {
        try {
          if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
          }
          if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch (e) {
          this.ctx = null;
        }
      }
    
      beep(freq = 440, dur = 0.06, type = 'square', gain = 0.035) {
        if (this.muted) return;
        this.resume();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      }
    
      blip() { this.beep(720, 0.03); }
      hit() { this.beep(240, 0.06); }
      bounce() { this.beep(520, 0.035); }
      score() { this.beep(880, 0.07); setTimeout(() => this.beep(1180, 0.08), 70); }
      lose() { this.beep(200, 0.14, 'sawtooth'); setTimeout(() => this.beep(140, 0.18, 'sawtooth'), 120); }
      win() { this.beep(660, 0.08); setTimeout(() => this.beep(880, 0.08), 80); setTimeout(() => this.beep(1320, 0.12), 160); }
    }
    
    __exports.Beeps = Beeps;
  };

  // ---- src/core/util.js ----
  __defs["src/core/util.js"] = function (__exports, __req) {
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
    const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
    const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    
    function overlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    
    function dist2(ax, ay, bx, by) {
      const dx = ax - bx, dy = ay - by;
      return dx * dx + dy * dy;
    }
    
    function pad(str, n, ch = ' ') {
      str = String(str);
      while (str.length < n) str += ch;
      return str;
    }
    
    function padStart(str, n, ch = ' ') {
      str = String(str);
      while (str.length < n) str = ch + str;
      return str;
    }
    
    function fmtTime(sec) {
      const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    }
    
    // ---- 显示宽度工具（中文占两格）----
    const { strWidth } = __req("src/core/screen.js");
    
    __exports.strWidth = strWidth;
    
    /** 按显示宽度右补空格 */
    function padW(str, w, ch = ' ') {
      str = String(str);
      let n = strWidth(str);
      while (n < w) { str += ch; n++; }
      return str;
    }
    
    /** 按显示宽度左补空格 */
    function padStartW(str, w, ch = ' ') {
      str = String(str);
      let n = strWidth(str);
      while (n < w) { str = ch + str; n++; }
      return str;
    }
    
    /** 按显示宽度截断，不会把宽字符切一半 */
    function truncW(str, w) {
      str = String(str);
      let out = '';
      let n = 0;
      for (const ch of str) {
        const cw = strWidth(ch);
        if (n + cw > w) break;
        out += ch;
        n += cw;
      }
      return out;
    }
    
    __exports.clamp = clamp;
  __exports.lerp = lerp;
  __exports.sign = sign;
  __exports.rand = rand;
  __exports.randInt = randInt;
  __exports.pick = pick;
  __exports.shuffle = shuffle;
  __exports.overlap = overlap;
  __exports.dist2 = dist2;
  __exports.pad = pad;
  __exports.padStart = padStart;
  __exports.fmtTime = fmtTime;
  __exports.padW = padW;
  __exports.padStartW = padStartW;
  __exports.truncW = truncW;
  };

  // ---- src/core/engine.js ----
  __defs["src/core/engine.js"] = function (__exports, __req) {
    const { Screen } = __req("src/core/screen.js");
    const { Input } = __req("src/core/input.js");
    const { Beeps } = __req("src/core/audio.js");
    const { padStartW, padW, strWidth, truncW } = __req("src/core/util.js");
    
    const COLS = 80;
    const ROWS = 36;
    const STEP = 1 / 60;
    
    const HINT_MENU = '[↑↓] 选择  [←→] 双人  [ENTER] 开始  [M] 静音';
    const HINT_PLAY = '[ESC] 暂停  [R] 重开  [M] 静音';
    
    class Engine {
      constructor(host, games, opts = {}) {
        this.host = host;
        this.games = games;
        this.opts = opts;
        this.cols = COLS;
        this.rows = ROWS;
    
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'ta-canvas';
        this.canvas.tabIndex = 0;
        this.canvas.setAttribute('aria-label', 'terminal arcade');
        host.classList.add('ta-root');
        host.appendChild(this.canvas);
    
        this.ctx = this.canvas.getContext('2d');
        this.screen = new Screen(COLS, ROWS);
        this.screen.layout(this.ctx);
        this._resize();
    
        this.input = new Input(this.canvas, this);
        this.input.attach();
        this.audio = new Beeps();
        this.audio.muted = opts.muted !== undefined ? !!opts.muted : this._loadMuted();
    
        this.state = 'menu';
        const wantId = opts.game || this._loadLast();
        this.sel = Math.max(0, games.findIndex((g) => g.id === wantId));
        this.cur = null;
        this.api = null;
        this.overlay = null;
        this.overDelay = 0;
        this.showHelp = false;
        this.best = this._loadBest();
        this.mode = this._loadMode();
        this.time = 0;
    
        this._onResize = () => this._resize();
        window.addEventListener('resize', this._onResize);
    
        // 切走标签页就自动暂停，回来不会突然被打死
        this._onVisibility = () => {
          if (document.hidden && this.state === 'play') this.state = 'pause';
        };
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', this._onVisibility);
        }
        this.canvas.addEventListener('pointerdown', () => {
          if (window.TerminalArcade) window.TerminalArcade.focus(this);
          this.audio.resume();
        });
    
        if (window.TerminalArcade) window.TerminalArcade._register(this);
    
        this._raf = 0;
        this._last = 0;
        this._acc = 0;
        this._loop = this._loop.bind(this);
        if (opts.game) {
          const i = games.findIndex((g) => g.id === opts.game);
          if (i >= 0) this.startGame(i);
        }
      }
    
      // ---------- 布局 / 生命周期 ----------
    
      _resize() {
        const s = this.screen;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        s.dpr = dpr;
        this.canvas.width = Math.round(s.pxW * dpr);
        this.canvas.height = Math.round(s.pxH * dpr);
    
        const st = this.canvas.style;
        st.display = 'block';
        st.margin = '0 auto';
        st.width = '100%';
        st.aspectRatio = `${s.pxW} / ${s.pxH}`;
        // 只夹宽度，高度由 aspect-ratio 推出来，画面永远不会被拉变形
        st.maxWidth = this.opts.height
          ? Math.round((this.opts.height * s.pxW) / s.pxH) + 'px'
          : s.pxW + 'px';
      }
    
      start() {
        if (this._raf) return this;
        this._last = performance.now();
        this._raf = requestAnimationFrame(this._loop);
        return this;
      }
    
      stop() {
        cancelAnimationFrame(this._raf);
        this._raf = 0;
      }
    
      destroy() {
        this.stop();
        window.removeEventListener('resize', this._onResize);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', this._onVisibility);
        }
        this.input.detach();
        this.canvas.remove();
        if (window.TerminalArcade && window.TerminalArcade._unregister) window.TerminalArcade._unregister(this);
      }
    
      _loop(now) {
        this._raf = requestAnimationFrame(this._loop);
        let dt = (now - this._last) / 1000;
        this._last = now;
        if (dt > 0.25) dt = 0.25;
        this._acc += dt;
        let steps = 0;
        while (this._acc >= STEP && steps < 6) {
          this._acc -= STEP;
          this._step(STEP);
          steps++;
        }
        if (steps >= 6) this._acc = 0;
        if (steps) this._draw();
      }
    
      /** 只推进逻辑（固定步长），绘制由 _draw() 每帧做一次 */
      _step(dt) {
        this.time += dt;
        const { input } = this;
    
        if (input.pressed('m')) {
          this.audio.muted = !this.audio.muted;
          this._saveMuted(this.audio.muted);
          if (!this.audio.muted) this.audio.blip();
        }
        if (input.pressed('/')) {
          this.showHelp = !this.showHelp;
          if (!this.showHelp) this.audio.blip();
        }
    
        if (this.showHelp) {
          if (input.anyPressed('esc', 'enter')) this.showHelp = false;
          input.endFrame();
          return;
        }
    
        switch (this.state) {
          case 'menu': this._updateMenu(); break;
          case 'play': this._updatePlay(dt); break;
          case 'pause': this._updatePause(); break;
          case 'over': this._updateOver(dt); break;
        }
    
        input.endFrame();
      }
    
      // ---------- 状态 ----------
    
      _updateMenu() {
        const { input } = this;
        const n = this.games.length;
        if (input.pressed('up')) this.sel = (this.sel - 1 + n) % n;
        if (input.pressed('down')) this.sel = (this.sel + 1) % n;
    
        // ←→ 切换单人/双人（只对支持双人的游戏有效）
        if (input.pressed('left') || input.pressed('right')) {
          const g = this.games[this.sel];
          if (g && g.players === 2) {
            this.mode[g.id] = this.modeOf(g) === 2 ? 1 : 2;
            this._saveMode();
            this.audio.blip();
          } else {
            this.audio.hit();
          }
        }
    
        if (input.pressed('enter') || input.pressed('space')) {
          this.startGame(this.sel);
          return;
        }
        for (let i = 0; i < 9; i++) {
          if (input.pressed(String(i + 1)) && i < n) {
            this.sel = i;
            this.startGame(i);
            return;
          }
        }
      }
    
      /** 某游戏当前选定的玩家人数 */
      modeOf(game) {
        if (!game || game.players !== 2) return 1;
        return this.mode[game.id] === 2 ? 2 : 1;
      }
    
      startGame(index) {
        const game = this.games[index];
        if (!game) return;
        this.sel = index;
        this.overlay = null;
        this.api = this._makeApi(game);
        this.api.players = this.modeOf(game);
        this.api.setStatus('');
        try {
          this.cur = game.create(this.api);
          this.cur.reset?.();
        } catch (err) {
          console.error('[arcade] game create failed:', game.id, err);
          this.state = 'menu';
          return;
        }
        this.state = 'play';
        this._saveLast(game.id);
        this.audio.resume();
        this.audio.blip();
      }
    
      _updatePlay(dt) {
        const { input } = this;
        if (input.pressed('esc') || input.pressed('p')) {
          this.state = 'pause';
          this.audio.blip();
          return;
        }
        if (input.pressed('r')) {
          this.restart();
          return;
        }
        this.cur?.update?.(dt);
      }
    
      restart() {
        if (!this.cur) return;
        this.overlay = null;
        this.overDelay = 0;
        this.api.setStatus('');
        this.cur.reset?.();
        this.state = 'play';
        this.audio.blip();
      }
    
      _updatePause() {
        const { input } = this;
        if (input.pressed('r')) { this.restart(); return; }
        if (input.anyPressed('p', 'enter', 'space')) { this.state = 'play'; this.audio.blip(); }
        else if (input.anyPressed('esc', 'q', 'backspace')) { this.state = 'menu'; this.cur = null; }
      }
    
      _updateOver(dt) {
        const { input } = this;
        // 双人对打时，输了那边常常还按着开火键，给结算画面留 0.6 秒
        if (this.overDelay > 0) {
          this.overDelay -= dt;
          return;
        }
        if (input.anyPressed('enter', 'r', 'space')) { this.restart(); return; }
        if (input.anyPressed('esc', 'q', 'backspace')) { this.state = 'menu'; this.cur = null; }
      }
    
      // ---------- 游戏 API ----------
    
      _makeApi(game) {
        const self = this;
        const api = {
          game,
          screen: this.screen,
          input: this.input,
          audio: this.audio,
          cols: COLS,
          w: COLS,
          h: ROWS - 1,
          colors: {
            bg: 'bg', fg: 'default', accent: 'accent', accent2: 'accent2',
            amber: 'amber', red: 'red', cyan: 'cyan', magenta: 'magenta',
            yellow: 'yellow', dim: 'dim',
          },
          status: '',
          setStatus(text) { this.status = String(text ?? ''); },
          get best() { return self.best[game.id] || 0; },
          saveBest(score) {
            const prev = self.best[game.id] || 0;
            if (score > prev) {
              self.best[game.id] = score;
              self._persistBest();
              return true;
            }
            return false;
          },
          over(msg = '游戏结束') {
            self.overlay = { title: 'GAME OVER', msg, score: this.status };
            self.state = 'over';
            self.overDelay = 0.6;
            self.audio.lose();
          },
          won(msg = '通关') {
            self.overlay = { title: 'CLEAR', msg, score: this.status };
            self.state = 'over';
            self.overDelay = 0.6;
            self.audio.win();
          },
          restart() { self.restart(); },
          exit() { self.state = 'menu'; self.cur = null; },
          toast(text) { self.overlay = null; api.setStatus(text); },
        };
        return api;
      }
    
      // ---------- 持久化 ----------
    
      _loadBest() {
        try {
          return JSON.parse(localStorage.getItem('terminal-arcade:best') || '{}');
        } catch (e) {
          return {};
        }
      }
    
      _persistBest() {
        try {
          localStorage.setItem('terminal-arcade:best', JSON.stringify(this.best));
        } catch (e) { /* 隐私模式下忽略 */ }
      }
    
      _loadMuted() {
        try {
          return localStorage.getItem('terminal-arcade:muted') === '1';
        } catch (e) {
          return false;
        }
      }
    
      _saveMuted(on) {
        try {
          localStorage.setItem('terminal-arcade:muted', on ? '1' : '0');
        } catch (e) { /* 忽略 */ }
      }
    
      _loadMode() {
        try {
          return JSON.parse(localStorage.getItem('terminal-arcade:mode') || '{}');
        } catch (e) {
          return {};
        }
      }
    
      _saveMode() {
        try {
          localStorage.setItem('terminal-arcade:mode', JSON.stringify(this.mode));
        } catch (e) { /* 忽略 */ }
      }
    
      _loadLast() {
        try {
          return localStorage.getItem('terminal-arcade:last') || null;
        } catch (e) {
          return null;
        }
      }
    
      _saveLast(id) {
        try {
          localStorage.setItem('terminal-arcade:last', id);
        } catch (e) { /* 忽略 */ }
      }
    
      // ---------- 绘制 ----------
    
      _draw() {
        const s = this.screen;
        s.clear('bg');
    
        if (this.state === 'menu' || !this.cur) {
          this._drawMenu();
        } else {
          try {
            this.cur.render?.(s);
          } catch (err) {
            console.error('[arcade] render failed:', err);
          }
          if (this.state === 'pause') this._drawPause();
          if (this.state === 'over' && this.overlay) this._drawOver();
        }
    
        this._drawBar();
        if (this.showHelp) this._drawHelp();
        s.flush(this.ctx);
      }
    
      _drawBar() {
        const s = this.screen;
        const y = ROWS - 1;
        s.fill(0, y, COLS, 1, ' ', null, 'bg2');
    
        let right = this.state === 'menu' ? HINT_MENU : HINT_PLAY;
        const best = this.cur ? this.best[this.games[this.sel]?.id] || 0 : 0;
        if (best) right = `HI ${best}  ` + right;
        if (this.audio.muted) right = '[静音]  ' + right;
        s.writeRight(COLS - 1, y, right, 'dim', 'bg2');
    
        // 左半边用剩下的宽度，塞不下就整段不要，绝不压到右边
        const room = COLS - strWidth(right) - 2;
        const left = this.state === 'menu' || !this.cur
          ? ` ARCADE · ${this.games.length} games`
          : ` ${this.games[this.sel]?.name ?? ''}  ${this.api?.status ?? ''}`;
        if (room >= 10) s.write(0, y, truncW(left, room), 'accent', 'bg2');
      }
    
      _drawMenu() {
        const s = this.screen;
        const boxW = COLS - 4;
        const boxH = this.games.length + 6;
        const totalH = 2 + 1 + boxH + 2;
        const n = this.games.length;
    
        const x0 = 2;
        const y0 = Math.max(1, Math.floor((ROWS - 1 - totalH) / 2));
    
        // 标题
        s.writeCenter(y0, 'T E R M I N A L   A R C A D E', 'accent');
        s.writeCenter(y0 + 1, '字符终端小游戏合集 · 可嵌入任意网页', 'dim');
    
        const boxY = y0 + 3;
        const curGame = this.games[this.sel];
        const twoP = curGame && curGame.players === 2;
        const modeOn = twoP && this.modeOf(curGame) === 2;
        s.box(x0, boxY, boxW, boxH, 'accent2', 'bg', 'single',
          `SELECT  ${n} GAMES` + (twoP ? (modeOn ? '   ·   2 PLAYERS' : '   ·   1 PLAYER') : ''));
    
        const listY = boxY + 2;
        const nameW = 12, cnW = 11;
        const nameX = x0 + 7;                 // 序号列留两格，10 以后也不会错位
        const cnX = nameX + nameW;
        const descX = cnX + cnW;
        const descW = boxW - 7 - nameW - cnW - 12;
    
        this.games.forEach((g, i) => {
          const y = listY + i;
          const sel = i === this.sel;
          const bg = sel ? 'bg3' : null;
          if (sel) s.fill(x0 + 1, y, boxW - 2, 1, ' ', null, 'bg3');
          s.put(x0 + 2, y, sel ? '▸' : ' ', sel ? 'yellow' : 'dim', bg);
          s.write(x0 + 4, y, padStartW(String(i + 1), 2), sel ? 'amber' : 'faint', bg);
          s.write(nameX, y, padW(g.name, nameW), sel ? 'white' : 'default', bg);
          s.write(cnX, y, padW(g.cn || '', cnW), sel ? 'cyan' : 'dim', bg);
          s.write(descX, y, truncW(g.desc || '', descW), sel ? 'default' : 'faint', bg);
          const best = this.best[g.id];
          if (best) s.writeRight(x0 + boxW - 2, y, padStartW(`HI ${best}`, 9), sel ? 'amber' : 'faint', bg);
        });
    
        // 分隔线 + 当前游戏操作
        const sepY = listY + n;
        const infoY = sepY + 1;
        s.put(x0, sepY, '├', 'accent2', 'bg');
        s.put(x0 + boxW - 1, sepY, '┤', 'accent2', 'bg');
        for (let i = 1; i < boxW - 1; i++) s.put(x0 + i, sepY, '─', 'accent2', 'bg');
    
        const g = this.games[this.sel];
        if (g) {
          s.write(x0 + 2, infoY, '按键', 'dim');
          const infoW = twoP ? boxW - 26 : boxW - 10;
          s.write(x0 + 7, infoY, truncW((g.keys || []).join('  '), infoW), 'accent2');
          if (twoP) {
            s.writeRight(x0 + boxW - 2, infoY,
              modeOn ? '[←→] 双人 ON ' : '[←→] 双人 OFF',
              modeOn ? 'yellow' : 'dim');
          } else {
            s.writeRight(x0 + boxW - 2, infoY, '单人游戏', 'faint');
          }
        }
    
        s.writeCenter(ROWS - 3, twoP
          ? '↑↓ 选择   ←→ 单人/双人   ENTER 开始'
          : '↑↓ 选择   ENTER 开始', 'dim');
      }
    
      _overlayBox(title, lines, border = 'amber') {
        const s = this.screen;
        const w = Math.max(28, ...lines.map((l) => strWidth(l.text) + 6), strWidth(title) + 8);
        const h = lines.length + 3;
        const x = Math.floor((COLS - w) / 2);
        const y = Math.max(0, Math.min(Math.floor((ROWS - 1 - h) / 2), ROWS - 1 - h));
        s.fill(x, y, w, h, ' ', null, 'bg2');
        s.box(x, y, w, h, border, 'bg2', 'double');
        s.fill(x + 2, y + 1, w - 4, 1, ' ', null, border);
        s.write(x + 2, y + 1, ` ${title} `.padEnd(w - 4), 'bg', border);
        lines.forEach((l, i) => {
          const yy = y + 2 + i;
          if (l.center) s.writeCenter(yy, l.text, l.color || 'default');
          else s.write(x + 3, yy, l.text, l.color || 'default');
        });
        return { x, y, w, h };
      }
    
      _drawPause() {
        const g = this.games[this.sel] || {};
        const twoP = this.api && this.api.players === 2;
        const keys = (g.keys || []).map((k) => ({ text: '  ' + k, color: 'accent' }));
        const pads = twoP
          ? [
              { text: 'P1  WASD 移动      F / 空格 动作', color: 'cyan' },
              { text: 'P2  方向键 移动    Enter / 右Shift 动作', color: 'magenta' },
              { text: '' },
            ]
          : [];
        this._overlayBox('PAUSED', [
          { text: `${g.name || ''} / ${g.cn || ''}`, color: 'accent' },
          { text: '' },
          ...pads,
          ...keys,
          ...(keys.length ? [{ text: '' }] : []),
          { text: 'P / ENTER   继续', color: 'default' },
          { text: 'R           重开', color: 'default' },
          { text: 'ESC         返回菜单', color: 'default' },
        ], 'cyan');
      }
    
      _drawOver() {
        const o = this.overlay;
        const best = this.api?.best || 0;
        const isClear = o.title === 'CLEAR';
        this._overlayBox(o.title, [
          { text: o.msg, color: isClear ? 'accent' : 'red' },
          { text: '' },
          { text: o.score ? `成绩  ${o.score}` : '', color: 'amber' },
          { text: best ? `最高  ${best}` : '', color: 'dim' },
          { text: '' },
          { text: 'ENTER / R 再来一局    ESC 菜单', color: 'default', center: true },
        ], isClear ? 'accent' : 'red');
      }
    
      _drawHelp() {
        const lines = [
          { text: '全局按键', color: 'accent' },
          { text: '  ↑↓ / jk     菜单选择', color: 'default' },
          { text: '  ←→          切换单人 / 双人', color: 'default' },
          { text: '  ENTER        开始 / 重开', color: 'default' },
          { text: '  ESC / P      暂停；暂停中再按返回菜单', color: 'default' },
          { text: '  R            重开当前游戏', color: 'default' },
          { text: '  M            静音开关', color: 'default' },
          { text: '  /            这个帮助', color: 'default' },
          { text: '' },
          { text: '双人键位（菜单里按 ←→ 开启）', color: 'accent' },
          { text: '  P1  WASD 移动      F / 空格 动作', color: 'cyan' },
          { text: '  P2  方向键 移动    Enter / 右Shift 动作', color: 'magenta' },
          { text: '  触屏：先按下的手指是 P1，第二根是 P2', color: 'dim' },
          { text: '' },
          { text: '按 / 或 ENTER 关闭', color: 'dim' },
        ];
        const g = this.cur ? this.games[this.sel] : null;
        const extra = g
          ? [
              { text: `${g.name} / ${g.cn}`, color: 'amber' },
              ...(g.keys || []).map((k) => ({ text: '  ' + k, color: 'cyan' })),
              { text: '' },
            ]
          : [];
        this._overlayBox('HELP', [...extra, ...lines], 'accent');
      }
    }
    
    __exports.Engine = Engine;
  };

  // ---- src/games/pong.js ----
  __defs["src/games/pong.js"] = function (__exports, __req) {
    const { clamp } = __req("src/core/util.js");
    
    __exports.default = {
      id: 'pong',
      name: 'PONG',
      cn: '乒乓',
      desc: '先得 7 分者胜 · 支持双人对打',
      players: 2,
      keys: ['P1 W/S 移动   P2 ↑/↓ 移动', '空格 发球 · 鼠标控制左拍'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
        const PW = 5;
        const WIN = 7;
        const PADDLE_SPEED = 34;
    
        const twoP = api.players === 2;
        const pad1 = twoP ? input.p1 : input;   // 单人时用合并层，谁按都算
    
        let p, a, ball, ps, as, serveTimer, serveDir, ended, aiNoise, t;
    
        function reset() {
          ps = 0; as = 0; ended = false; aiNoise = 0; t = 0;
          p = { x: 3, y: (H - PW) / 2 };
          a = { x: W - 4, y: (H - PW) / 2 };
          serve(1);
          sync();
        }
    
        function sync() {
          api.setStatus(twoP ? `P1 ${ps} : ${as} P2` : `玩家 ${ps} : ${as} 电脑`);
        }
    
        function serve(dir) {
          serveDir = dir;
          serveTimer = 0.85;
          ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 30 };
        }
    
        function launch() {
          const ang = (Math.random() * 0.6 - 0.3);
          ball.vx = Math.cos(ang) * ball.speed * serveDir;
          ball.vy = Math.sin(ang) * ball.speed;
        }
    
        function finish(p1Won) {
          ended = true;
          sync();
          if (twoP) {
            if (p1Won) api.won(`P1 获胜  ${ps} : ${as}`);
            else api.over(`P2 获胜  ${ps} : ${as}`);
          } else if (p1Won) {
            api.won('你赢了这台终端');
          } else {
            api.over('电脑赢了这一局');
          }
        }
    
        function movePaddle(pd, pad, pointer, dt, speed) {
          if (pointer) {
            const target = clamp(pointer.y - PW / 2, 1, H - PW - 1);
            pd.y += clamp(target - pd.y, -speed * 1.6 * dt, speed * 1.6 * dt);
          } else {
            pd.y += pad.axisY() * speed * dt;
          }
          pd.y = clamp(pd.y, 1, H - PW - 1);
        }
    
        function updateAi(dt) {
          let target = H / 2 - PW / 2;
          if (ball.vx > 1) {
            aiNoise = aiNoise * 0.96 + (Math.random() - 0.5) * 0.12;
            target = ball.y - PW / 2 + aiNoise * 2;
          }
          const speed = 26 + Math.min(10, (ball.speed - 30) * 0.6);
          a.y += clamp(target - a.y, -speed * dt, speed * dt);
          a.y = clamp(a.y, 1, H - PW - 1);
        }
    
        function hitPaddle(pd, dir) {
          const cy = pd.y + PW / 2;
          const off = clamp((ball.y - cy) / (PW / 2), -1, 1);
          const ang = off * 0.95;
          ball.speed = Math.min(ball.speed * 1.045, 64);
          ball.vx = Math.cos(ang) * ball.speed * dir;
          ball.vy = Math.sin(ang) * ball.speed;
          ball.x = dir > 0 ? pd.x + 1.6 : pd.x - 0.6;
          audio.bounce();
        }
    
        function update(dt) {
          if (ended) return;
          t += dt;
    
          movePaddle(p, pad1, input.pointAt(0), dt, PADDLE_SPEED);
          if (twoP) movePaddle(a, input.p2, input.pointAt(1), dt, PADDLE_SPEED);
          else updateAi(dt);
    
          if (serveTimer > 0) {
            serveTimer -= dt;
            ball.x = W / 2;
            ball.y = H / 2;
            if (serveTimer <= 0) launch();
            return;
          }
    
          const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 0.8));
          const sdt = dt / steps;
          for (let i = 0; i < steps; i++) {
            ball.x += ball.vx * sdt;
            ball.y += ball.vy * sdt;
    
            if (ball.y < 2) { ball.y = 2; ball.vy = Math.abs(ball.vy); audio.hit(); }
            if (ball.y > H - 2) { ball.y = H - 2; ball.vy = -Math.abs(ball.vy); audio.hit(); }
    
            if (ball.vx < 0 && ball.x - 0.5 <= p.x + 1 && ball.x > p.x - 1 &&
                ball.y >= p.y - 0.5 && ball.y <= p.y + PW + 0.5) {
              hitPaddle(p, 1);
            }
            if (ball.vx > 0 && ball.x + 0.5 >= a.x && ball.x < a.x + 2 &&
                ball.y >= a.y - 0.5 && ball.y <= a.y + PW + 0.5) {
              hitPaddle(a, -1);
            }
    
            if (ball.x < 0.5) { as++; audio.score(); serve(1); scoreCheck(); return; }
            if (ball.x > W - 1.5) { ps++; audio.score(); serve(-1); scoreCheck(); return; }
          }
        }
    
        function scoreCheck() {
          sync();
          if (ps >= WIN) finish(true);
          else if (as >= WIN) finish(false);
        }
    
        function render(s) {
          s.box(0, 0, W, H, 'accent2', 'bg');
    
          for (let y = 2; y < H - 2; y += 2) s.put(W / 2 | 0, y, '│', 'faint');
    
          // 比分：P1 青、P2 品红，数字统一琥珀色
          const parts = twoP
            ? [['P1', 'cyan'], [`  ${ps}`, 'amber'], ['   :   ', 'faint'], [`${as}  `, 'amber'], ['P2', 'magenta']]
            : [['', null], [` ${ps}`, 'amber'], ['   :   ', 'faint'], [`${as} `, 'amber'], ['', null]];
          const total = parts.reduce((n, q) => n + q[0].length, 0);
          let cx = Math.floor((W - total) / 2);
          for (const [txt, col] of parts) {
            if (txt) s.write(cx, 1, txt, col);
            cx += txt.length;
          }
    
          // 球拍：P1 青、P2 品红
          s.fill(p.x - 1, p.y, 2, PW, '█', 'cyan');
          s.fill(a.x, a.y, 2, PW, '█', 'magenta');
    
          if (serveTimer > 0) {
            const blink = Math.floor(t * 6) % 2 === 0;
            if (blink) s.put(ball.x | 0, ball.y | 0, 'o', 'yellow');
            if (t < 60) s.writeCenter(H / 2 + 4, 'P1 左    P2 右', 'faint');
          } else {
            s.put(ball.x | 0, ball.y | 0, 'o', 'yellow');
          }
    
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/hockey.js ----
  __defs["src/games/hockey.js"] = function (__exports, __req) {
    const { clamp, rand } = __req("src/core/util.js");
    
    __exports.default = {
      id: 'hockey',
      name: 'AIR HOCKEY',
      cn: '冰球',
      desc: '把冰球撞进对方球门 · 支持双人对打',
      players: 2,
      keys: ['P1 WASD 左拍   P2 方向键右拍', '鼠标/触屏可直接拖拽'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
        const WIN = 7;
        const GOAL_H = 9;
        const GOAL_Y0 = Math.floor((H - GOAL_H) / 2);
        const GOAL_Y1 = GOAL_Y0 + GOAL_H;
        const MR = 1.6;   // 球拍半径
        const PR = 0.9;   // 冰球半径
    
        const twoP = api.players === 2;
        const pad1 = twoP ? input.p1 : input;
    
        let left, right, puck, ps, as, serveTimer, ended, stall;
        let aiTimer = 0, aiTarget = { x: 0, y: 0 };
    
        const bound = () => ({ x0: 2, x1: W - 3, y0: 2, y1: H - 2 });
    
        function reset() {
          ps = 0; as = 0; ended = false; stall = 0;
          sync();
          left = { x: 8, y: H / 2, vx: 0, vy: 0 };
          right = { x: W - 9, y: H / 2, vx: 0, vy: 0 };
          aiTimer = 0;
          aiTarget = { x: W - 14, y: H / 2 };
          serve(1);
        }
    
        function serve(dir) {
          serveTimer = 0.8;
          puck = { x: W / 2, y: H / 2 + rand(-4, 4), vx: 0, vy: 0, dir };
        }
    
        function launch() {
          const ang = rand(-0.5, 0.5);
          puck.vx = Math.cos(ang) * 34 * puck.dir;
          puck.vy = Math.sin(ang) * 34;
        }
    
        function moveMallet(m, tx, ty, dt, speed, isLeft) {
          const bx = bound();
          const ox = m.x, oy = m.y;
          if (tx !== null) {
            const dx = clamp(tx - m.x, -speed * 2.4 * dt, speed * 2.4 * dt);
            const dy = clamp(ty - m.y, -speed * 2.4 * dt, speed * 2.4 * dt);
            m.x += dx; m.y += dy;
          }
          // 各自只能待在自己半场
          if (isLeft) m.x = clamp(m.x, bx.x0 + MR - 1, W / 2 - MR);
          else m.x = clamp(m.x, W / 2 + MR, bx.x1 - MR + 1);
          m.y = clamp(m.y, bx.y0 + MR - 1, bx.y1 - MR + 1);
          m.vx = (m.x - ox) / Math.max(dt, 1e-4);
          m.vy = (m.y - oy) / Math.max(dt, 1e-4);
        }
    
        function collide(m) {
          const dx = puck.x - m.x;
          const dy = puck.y - m.y;
          const d = Math.hypot(dx, dy);
          const minD = MR + PR;
          if (d > minD || d === 0) return;
          const nx = dx / d, ny = dy / d;
          // 分离
          puck.x = m.x + nx * minD;
          puck.y = m.y + ny * minD;
          // 相对速度反射
          const rvx = puck.vx - m.vx, rvy = puck.vy - m.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const e = 1.05;
            puck.vx -= (1 + e) * vn * nx;
            puck.vy -= (1 + e) * vn * ny;
          }
          // 球拍推力
          puck.vx += m.vx * 0.35;
          puck.vy += m.vy * 0.35;
          const sp = Math.hypot(puck.vx, puck.vy);
          const maxSp = 70;
          if (sp > maxSp) { puck.vx *= maxSp / sp; puck.vy *= maxSp / sp; }
          audio.bounce();
        }
    
        function sync() {
          api.setStatus(twoP ? `P1 ${ps} : ${as} P2` : `你 ${ps} : ${as} 电脑`);
        }
    
        function scoreGoal(who) {
          if (who === 'p') { ps++; audio.score(); serve(-1); }
          else { as++; audio.score(); serve(1); }
          sync();
          if (ps >= WIN) {
            ended = true;
            if (twoP) api.won(`P1 获胜  ${ps} : ${as}`);
            else api.won('球门守住，7 分到手');
          } else if (as >= WIN) {
            ended = true;
            if (twoP) api.over(`P2 获胜  ${ps} : ${as}`);
            else api.over('电脑先进 7 球');
          }
        }
    
        function driveMallet(m, pad, pointer, dt, speed, isLeft) {
          if (pointer) {
            moveMallet(m, pointer.x, pointer.y, dt, speed, isLeft);
          } else {
            moveMallet(m, m.x + pad.axisX() * speed * dt, m.y + pad.axisY() * speed * dt, dt, speed, isLeft);
          }
        }
    
        function update(dt) {
          if (ended) return;
    
          driveMallet(left, pad1, input.pointAt(0), dt, 40, true);
    
          if (twoP) {
            // 双人：右边球拍交给 P2（键盘或第二根手指）
            driveMallet(right, input.p2, input.pointAt(1), dt, 40, false);
          } else {
            // 单人：电脑有反应延迟和抖动，否则它是个不会失球的墙
            aiTimer -= dt;
            if (aiTimer <= 0) {
              aiTimer = 0.11;
              if (puck.x > W / 2 - 6) {
                aiTarget.x = puck.x + 1.5 + rand(-0.9, 0.9);
                aiTarget.y = puck.y + rand(-1.8, 1.8);
              } else {
                aiTarget.x = W - 14;
                aiTarget.y = H / 2 + (puck.y - H / 2) * 0.4;
              }
            }
            moveMallet(right, aiTarget.x, aiTarget.y, dt, 24, false);
          }
    
          if (serveTimer > 0) {
            serveTimer -= dt;
            puck.x = W / 2;
            puck.y = clamp(puck.y, GOAL_Y0 + 2, GOAL_Y1 - 2);
            if (serveTimer <= 0) launch();
            return;
          }
    
          const bx = bound();
          const steps = 3;
          const sdt = dt / steps;
          for (let i = 0; i < steps; i++) {
            puck.x += puck.vx * sdt;
            puck.y += puck.vy * sdt;
    
            if (puck.y < bx.y0 + PR) { puck.y = bx.y0 + PR; puck.vy = Math.abs(puck.vy); audio.hit(); }
            if (puck.y > bx.y1 - PR) { puck.y = bx.y1 - PR; puck.vy = -Math.abs(puck.vy); audio.hit(); }
    
            const inGoal = puck.y > GOAL_Y0 && puck.y < GOAL_Y1;
            if (!inGoal) {
              if (puck.x < bx.x0 + PR) { puck.x = bx.x0 + PR; puck.vx = Math.abs(puck.vx); audio.hit(); }
              if (puck.x > bx.x1 - PR) { puck.x = bx.x1 - PR; puck.vx = -Math.abs(puck.vx); audio.hit(); }
            }
    
            collide(left);
            collide(right);
    
            if (puck.x < bx.x0 - 1) { scoreGoal('a'); return; }
            if (puck.x > bx.x1 + 1) { scoreGoal('p'); return; }
          }
    
          // 摩擦
          const f = Math.exp(-0.9 * dt);
          puck.vx *= f;
          puck.vy *= f;
          if (Math.abs(puck.vx) < 0.4) puck.vx = 0;
          if (Math.abs(puck.vy) < 0.4) puck.vy = 0;
    
          // 冰球停死在角落里就重新开球，别让对局僵住
          if (Math.hypot(puck.vx, puck.vy) < 2) {
            stall += dt;
            if (stall > 3) { serve(1); stall = 0; audio.blip(); }
          } else {
            stall = 0;
          }
        }
    
        function drawMallet(s, m, color) {
          const x = Math.round(m.x) - 1;
          const y = Math.round(m.y) - 1;
          // 纯底色块：终端 TUI 里最常见的"实心圆"
          s.fill(x, y, 3, 2, ' ', null, color);
          s.put(x + 1, y, 'o', 'bg', color);
        }
    
        function render(s) {
          s.clear('bg');
          s.box(1, 1, W - 2, H - 2, 'faint', 'bg', 'single');
    
          // 中线 + 中圈
          for (let y = 2; y < H - 1; y += 2) s.put(W / 2 | 0, y, '┊', 'faint');
          s.writeCenter(H / 2, '  ( )  ', 'faint');
    
          // 球门
          s.fill(1, GOAL_Y0, 1, GOAL_H, '║', 'cyan');
          s.fill(W - 2, GOAL_Y0, 1, GOAL_H, '║', 'magenta');
    
          // 比分
          s.writeCenter(0, twoP ? ` P1 ${ps} : ${as} P2 ` : ` ${ps} : ${as} `, 'amber');
    
          drawMallet(s, left, 'cyan');
          drawMallet(s, right, 'magenta');
    
          if (serveTimer > 0) {
            if (Math.floor(serveTimer * 8) % 2 === 0) s.put(Math.round(puck.x), Math.round(puck.y), 'o', 'yellow');
          } else {
            s.put(Math.round(puck.x), Math.round(puck.y), 'o', 'yellow');
          }
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/snake.js ----
  __defs["src/games/snake.js"] = function (__exports, __req) {
    const { randInt } = __req("src/core/util.js");
    
    const DIRS = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };
    
    __exports.default = {
      id: 'snake',
      name: 'SNAKE',
      cn: '贪吃蛇',
      desc: '吃 @ 变长 · 双人模式互撞',
      players: 2,
      keys: ['P1 WASD   P2 方向键', '撞墙或撞到身体就输'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
        const twoP = api.players === 2;
    
        let snakes, food, acc, timer, ended, result;
    
        function makeSnake(pad, x, y, dir, colors) {
          return {
            pad,
            alive: true,
            score: 0,
            dir: DIRS[dir],
            queue: [],
            body: [
              { x, y },
              { x: x - DIRS[dir].x, y: y - DIRS[dir].y },
              { x: x - DIRS[dir].x * 2, y: y - DIRS[dir].y * 2 },
            ],
            color: colors[0],
            headColor: colors[1],
          };
        }
    
        function spawnFood() {
          const free = [];
          for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
              if (!snakes.some((s) => s.body.some((b) => b.x === x && b.y === y))) free.push({ x, y });
            }
          }
          if (!free.length) return null;
          return free[randInt(0, free.length - 1)];
        }
    
        function reset() {
          ended = false;
          result = null;
          acc = 0;
          timer = 0.11;
          if (twoP) {
            snakes = [
              makeSnake(input.p1, 10, Math.round(H * 0.28), 'right', ['cyan', 'white']),
              makeSnake(input.p2, W - 11, Math.round(H * 0.72), 'left', ['magenta', 'white']),
            ];
          } else {
            snakes = [makeSnake(null, W >> 1, H >> 1, 'right', ['accent', 'white'])];
          }
          food = spawnFood();
          sync();
        }
    
        function sync() {
          if (twoP) api.setStatus(`P1 ${snakes[0].score} : ${snakes[1].score} P2`);
          else api.setStatus(`长度 ${snakes[0].body.length} · 得分 ${snakes[0].score}`);
        }
    
        /** 把方向塞进队列，避免一帧内 180° 掉头 */
        function pushDir(s, name) {
          const nd = DIRS[name];
          if (!nd) return;
          const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
          if (nd.x === -last.x && nd.y === -last.y) return;
          if (nd.x === last.x && nd.y === last.y) return;
          if (s.queue.length < 3) s.queue.push(nd);
        }
    
        function readInput() {
          for (const s of snakes) {
            if (!s.alive) continue;
            if (s.pad) {
              const d = s.pad.dir();
              if (d) pushDir(s, d);
            } else {
              if (input.pressed('up')) pushDir(s, 'up');
              if (input.pressed('down')) pushDir(s, 'down');
              if (input.pressed('left')) pushDir(s, 'left');
              if (input.pressed('right')) pushDir(s, 'right');
            }
          }
        }
    
        function tick() {
          // 1. 结算各自的新蛇头
          const heads = snakes.map((s) => {
            if (!s.alive) return null;
            if (s.queue.length) s.dir = s.queue.shift();
            return { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };
          });
    
          const doomed = snakes.map(() => false);
    
          // 2. 撞墙
          heads.forEach((h, i) => {
            if (!h) return;
            if (h.x < 1 || h.x > W - 2 || h.y < 1 || h.y > H - 2) doomed[i] = true;
          });
    
          // 3. 撞自己（尾巴这一格会移开，所以不算）
          snakes.forEach((s, i) => {
            const h = heads[i];
            if (!h || doomed[i]) return;
            const eating = food && h.x === food.x && h.y === food.y;
            const solid = eating ? s.body : s.body.slice(0, -1);
            if (solid.some((seg) => seg.x === h.x && seg.y === h.y)) doomed[i] = true;
          });
    
          // 4. 撞对方身体 / 头对头
          if (snakes.length === 2) {
            snakes.forEach((s, i) => {
              const h = heads[i];
              if (!h || doomed[i]) return;
              const other = snakes[1 - i];
              if (other.alive && other.body.some((seg) => seg.x === h.x && seg.y === h.y)) doomed[i] = true;
            });
            if (heads[0] && heads[1] && heads[0].x === heads[1].x && heads[0].y === heads[1].y) {
              doomed[0] = true;
              doomed[1] = true;
            }
          }
    
          if (doomed.some(Boolean)) {
            doomed.forEach((d, i) => { if (d) snakes[i].alive = false; });
            finish(doomed);
            return;
          }
    
          // 5. 前进 / 吃食物
          let ate = false;
          snakes.forEach((s, i) => {
            const h = heads[i];
            s.body.unshift(h);
            if (food && h.x === food.x && h.y === food.y) {
              s.score += 10;
              ate = true;
            } else {
              s.body.pop();
            }
          });
    
          if (ate) {
            audio.blip();
            food = spawnFood();
            const total = snakes.reduce((n, s) => n + s.body.length, 0);
            timer = Math.max(0.055, 0.11 - total * 0.0004);
            sync();
            if (!food) finish([true, twoP ? true : false]);
          }
        }
    
        function finish(doomed) {
          if (ended) return;
          ended = true;
          const s0 = snakes[0];
          if (!twoP) {
            if (!food) {
              api.won(`铺满了整个终端 · 得分 ${s0.score}`);
              return;
            }
            const why = doomed[0] ? '撞墙或咬到自己' : '结束';
            api.saveBest(s0.score);
            api.over(`${why} · 得分 ${s0.score}`);
            return;
          }
    
          const dead1 = doomed[0];
          const dead2 = doomed[1];
          api.saveBest(Math.max(...snakes.map((s) => s.score)));
          if (dead1 && dead2) {
            audio.lose();
            api.over(`双双阵亡 · ${s0.score} : ${snakes[1].score}`);
          } else if (dead1) {
            audio.lose();
            api.over(`P2 获胜  ${s0.score} : ${snakes[1].score}`);
          } else {
            audio.win();
            api.won(`P1 获胜  ${s0.score} : ${snakes[1].score}`);
          }
        }
    
        function update(dt) {
          if (ended) return;
          readInput();
          acc += dt;
          let guard = 0;
          while (acc >= timer && !ended && guard++ < 4) {
            acc -= timer;
            tick();
          }
        }
    
        function render(s) {
          s.clear('bg');
          s.box(0, 0, W, H, 'accent2', 'bg');
          s.write(2, 0, twoP
            ? ` P1 ${snakes[0].score} : ${snakes[1].score} P2 `
            : ` SNAKE ${snakes[0].score} `, 'amber', 'bg');
    
          if (food) s.put(food.x, food.y, '@', 'red');
    
          for (const sn of snakes) {
            if (!sn.body.length) continue;
            sn.body.forEach((seg, i) => {
              if (i === 0) s.put(seg.x, seg.y, 'O', sn.headColor);
              else s.put(seg.x, seg.y, 'o', sn.color);
            });
          }
    
          if (twoP) {
            s.put(2, H - 1, 'P1', 'cyan');
            s.put(W - 4, H - 1, 'P2', 'magenta');
          }
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/breakout.js ----
  __defs["src/games/breakout.js"] = function (__exports, __req) {
    const { clamp } = __req("src/core/util.js");
    
    __exports.default = {
      id: 'breakout',
      name: 'BREAKOUT',
      cn: '打砖块',
      desc: '清空所有砖块，别让球落地',
      keys: ['←→ / AD 移动挡板', '空格 发球'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
    
        const COLS = 13, ROWS = 6, BW = 5, GAP = 1;
        const X0 = 1, Y0 = 3;
        const PADDLE_W = 9, PADDLE_Y = H - 3;
    
        const ROW_COLORS = ['red', 'magenta', 'violet', 'blue', 'cyan', 'accent'];
    
        let bricks, paddle, ball, lives, score, level, stuck, ended, bricksLeft, t;
    
        function buildBricks() {
          bricks = [];
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              bricks.push({
                x: X0 + c * (BW + GAP),
                y: Y0 + r,
                w: BW,
                h: 1,
                hp: r === 0 ? 2 : 1,
                color: ROW_COLORS[r % ROW_COLORS.length],
                alive: true,
              });
            }
          }
          bricksLeft = bricks.length;
        }
    
        function reset() {
          lives = 3;
          score = 0;
          level = 1;
          ended = false;
          t = 0;
          buildBricks();
          paddle = { x: (W - PADDLE_W) / 2, w: PADDLE_W };
          newBall();
          api.setStatus('L1  命 3  分 0');
        }
    
        function newBall() {
          const speed = 30 + (level - 1) * 5;
          ball = { x: paddle.x + paddle.w / 2, y: PADDLE_Y - 2, vx: 0, vy: 0, speed };
          stuck = true;
        }
    
        function launch() {
          const ang = (-Math.PI / 2) + (Math.random() - 0.5) * 0.7;
          ball.vx = Math.cos(ang) * ball.speed;
          ball.vy = Math.sin(ang) * ball.speed;
          stuck = false;
          audio.bounce();
        }
    
        function sync() {
          api.setStatus(`L${level}  命 ${lives}  分 ${score}`);
        }
    
        function loseLife() {
          audio.lose();
          lives--;
          sync();
          if (lives <= 0) {
            ended = true;
            api.saveBest(score);
            api.over(`球落地了 · 得分 ${score}`);
          } else {
            newBall();
          }
        }
    
        function updatePaddle(dt) {
          if (input.pointer.active) {
            paddle.x += clamp(input.pointer.x - paddle.w / 2 - paddle.x, -120 * dt, 120 * dt);
          } else {
            paddle.x += input.axisX() * 46 * dt;
          }
          paddle.x = clamp(paddle.x, 1, W - paddle.w - 1);
        }
    
        function update(dt) {
          if (ended) return;
          t += dt;
          updatePaddle(dt);
    
          if (stuck) {
            ball.x = paddle.x + paddle.w / 2;
            ball.y = PADDLE_Y - 2;
            if (input.anyPressed('space', 'enter', 'up')) launch();
            return;
          }
    
          const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 0.6));
          const sdt = dt / steps;
          for (let s = 0; s < steps; s++) {
            ball.x += ball.vx * sdt;
            ball.y += ball.vy * sdt;
    
            if (ball.x < 1) { ball.x = 1; ball.vx = Math.abs(ball.vx); audio.hit(); }
            if (ball.x > W - 2) { ball.x = W - 2; ball.vx = -Math.abs(ball.vx); audio.hit(); }
            if (ball.y < 1) { ball.y = 1; ball.vy = Math.abs(ball.vy); audio.hit(); }
    
            // 挡板
            if (ball.vy > 0 && ball.y >= PADDLE_Y - 0.5 && ball.y <= PADDLE_Y + 1 &&
                ball.x >= paddle.x - 0.5 && ball.x <= paddle.x + paddle.w + 0.5) {
              const off = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
              const ang = -Math.PI / 2 + off * 1.05;
              ball.speed = Math.min(ball.speed * 1.02, 62);
              ball.vx = Math.cos(ang) * ball.speed;
              ball.vy = Math.sin(ang) * ball.speed;
              ball.y = PADDLE_Y - 0.6;
              audio.bounce();
            }
    
            // 砖块
            for (const b of bricks) {
              if (!b.alive) continue;
              if (ball.x >= b.x - 0.5 && ball.x <= b.x + b.w + 0.5 &&
                  ball.y >= b.y - 0.5 && ball.y <= b.y + b.h + 0.5) {
                // 从更近的一侧反射：横向距离小就翻 vx，否则翻 vy
                const dx = Math.min(Math.abs(ball.x - b.x), Math.abs(ball.x - (b.x + b.w)));
                const dy = Math.min(Math.abs(ball.y - b.y), Math.abs(ball.y - (b.y + b.h)));
                if (dx < dy) ball.vx = -ball.vx;
                else ball.vy = -ball.vy;
    
                b.hp--;
                if (b.hp <= 0) {
                  b.alive = false;
                  bricksLeft--;
                  score += 10 + (level - 1) * 5;
                  audio.blip();
                } else {
                  score += 3;
                  audio.hit();
                }
                sync();
                break;
              }
            }
    
            if (ball.y > H) { loseLife(); return; }
          }
    
          if (bricksLeft <= 0) {
            level++;
            buildBricks();
            newBall();
            audio.win();
            sync();
          }
        }
    
        function render(s) {
          s.box(0, 0, W, H, 'accent2', 'bg', 'single', 'BREAKOUT');
          s.write(W - 12, 1, `L${level}`, 'cyan');
          s.writeRight(W - 3, 1, `命 ${'o'.repeat(Math.max(0, lives))}`, 'red');
    
          for (const b of bricks) {
            if (!b.alive) continue;
            const ch = b.hp > 1 ? '▓' : '▒';
            s.fill(b.x, b.y, b.w, b.h, ch, b.color);
          }
    
          s.fill(Math.round(paddle.x), PADDLE_Y, paddle.w, 1, '═', 'cyan');
    
          s.put(Math.round(ball.x), Math.round(ball.y), 'o', 'yellow');
          if (stuck && Math.floor(t * 2) % 2 === 0) {
            s.writeCenter(PADDLE_Y - 4, '空格 / ↑ 发球', 'dim');
          }
    
    
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/tetris.js ----
  __defs["src/games/tetris.js"] = function (__exports, __req) {
    const { randInt, shuffle } = __req("src/core/util.js");
    
    const SHAPES = {
      I: { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], c: 'cyan' },
      J: { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], c: 'blue' },
      L: { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], c: 'orange' },
      O: { m: [[1, 1], [1, 1]], c: 'yellow' },
      S: { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], c: 'green' },
      T: { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], c: 'magenta' },
      Z: { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], c: 'red' },
    };
    const KEYS = Object.keys(SHAPES);
    
    __exports.default = {
      id: 'tetris',
      name: 'TETRIS',
      cn: '俄罗斯方块',
      desc: '堆满一行即消除，越堆越快',
      keys: ['←→ 移动  ↑/X 旋转  Z 逆旋', '↓ 软降  空格 硬降'],
      create(api) {
        const { screen, input, audio } = api;
        const BW = 10, BH = 18;
        const CELL = 1;                 // 每格占用的屏幕行数
        const CW = 2;                   // 每格占用字符列数
        const boardW = BW * CW + 2;
        const boardH = BH * CELL + 2;
        const X0 = Math.floor((api.w - boardW - 24) / 2);
        const Y0 = Math.floor((api.h - boardH) / 2);
        const PX = X0 + boardW + 3;
    
        let board, cur, bag, next, dropTimer, dropInterval, score, lines, level, ended;
    
        function emptyBoard() {
          return Array.from({ length: BH }, () => new Array(BW).fill(null));
        }
    
        function refillBag() {
          bag = shuffle([...KEYS]);
        }
    
        function takePiece() {
          if (!bag || !bag.length) refillBag();
          const k = bag.pop();
          const s = SHAPES[k];
          const m = s.m.map((r) => [...r]);
          return { k, m, c: s.c, x: Math.floor((BW - m[0].length) / 2), y: k === 'I' ? -1 : 0 };
        }
    
        function reset() {
          board = emptyBoard();
          bag = null;
          refillBag();
          next = takePiece();
          score = 0; lines = 0; level = 1;
          ended = false;
          dropTimer = 0;
          dropInterval = 0.75;
          cur = takePiece();
          sync();
        }
    
        function sync() {
          api.setStatus(`分 ${score}  行 ${lines}  L${level}`);
        }
    
        function fits(m, px, py) {
          for (let y = 0; y < m.length; y++) {
            for (let x = 0; x < m[y].length; x++) {
              if (!m[y][x]) continue;
              const bx = px + x, by = py + y;
              if (bx < 0 || bx >= BW || by >= BH) return false;
              if (by < 0) continue;
              if (board[by][bx]) return false;
            }
          }
          return true;
        }
    
        function rotate(m, cw = true) {
          const n = m.length;
          const out = Array.from({ length: n }, () => new Array(n).fill(0));
          for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
              out[y][x] = cw ? m[n - 1 - x][y] : m[x][n - 1 - y];
            }
          }
          return out;
        }
    
        function tryRotate(cw) {
          const nm = rotate(cur.m, cw);
          const kicks = [0, -1, 1, -2, 2];
          for (const dx of kicks) {
            if (fits(nm, cur.x + dx, cur.y)) {
              cur.m = nm;
              cur.x += dx;
              audio.blip();
              return true;
            }
          }
          return false;
        }
    
        function lock() {
          cur.m.forEach((row, y) => row.forEach((v, x) => {
            if (!v) return;
            const by = cur.y + y, bx = cur.x + x;
            if (by < 0) { ended = true; return; }
            board[by][bx] = cur.c;
          }));
          if (ended) { finish(); return; }
    
          let cleared = 0;
          for (let y = BH - 1; y >= 0; y--) {
            if (board[y].every((c) => c)) {
              board.splice(y, 1);
              board.unshift(new Array(BW).fill(null));
              cleared++;
              y++;
            }
          }
          if (cleared) {
            const table = [0, 100, 300, 500, 800];
            score += table[cleared] * level;
            lines += cleared;
            level = 1 + Math.floor(lines / 10);
            dropInterval = Math.max(0.08, 0.75 - (level - 1) * 0.07);
            if (cleared >= 4) audio.win(); else audio.score();
          } else {
            audio.hit();
          }
          sync();
    
          cur = next;
          next = takePiece();
          dropTimer = 0;
          if (!fits(cur.m, cur.x, cur.y)) { ended = true; finish(); }
        }
    
        function finish() {
          api.saveBest(score);
          api.over(`得分 ${score}  消除 ${lines} 行`);
        }
    
        function ghostY() {
          let y = cur.y;
          while (fits(cur.m, cur.x, y + 1)) y++;
          return y;
        }
    
        function update(dt) {
          if (ended) return;
    
          if (input.pressed('left')) { if (fits(cur.m, cur.x - 1, cur.y)) { cur.x--; audio.blip(); } }
          if (input.pressed('right')) { if (fits(cur.m, cur.x + 1, cur.y)) { cur.x++; audio.blip(); } }
          if (input.anyPressed('up', 'x')) tryRotate(true);
          if (input.pressed('z')) tryRotate(false);
          if (input.pressed('space')) {
            let d = 0;
            while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; d++; }
            score += d * 2;
            lock();
            return;
          }
    
          const soft = input.isDown('down');
          dropTimer += dt * (soft ? 12 : 1);
          if (soft && dropTimer > dropInterval) {
            if (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; }
            dropTimer = 0;
          }
          if (dropTimer >= dropInterval) {
            dropTimer = 0;
            if (fits(cur.m, cur.x, cur.y + 1)) cur.y++;
            else lock();
          }
        }
    
        function render(s) {
          s.clear('bg');
          s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', 'TETRIS');
    
          // 已固定方块
          for (let y = 0; y < BH; y++) {
            for (let x = 0; x < BW; x++) {
              const c = board[y][x];
              if (!c) continue;
              s.write(X0 + 1 + x * CW, Y0 + 1 + y * CELL, '██', c);
            }
          }
    
          // 幽灵 + 当前块
          const gy = ghostY();
          cur.m.forEach((row, y) => row.forEach((v, x) => {
            if (!v) return;
            const bx = cur.x + x;
            const by = cur.y + y;
            const gby = gy + y;
            if (gby >= 0 && gby < BH && !(board[gby]?.[bx])) {
              s.write(X0 + 1 + bx * CW, Y0 + 1 + gby * CELL, '░░', 'faint');
            }
            if (by >= 0 && by < BH) s.write(X0 + 1 + bx * CW, Y0 + 1 + by * CELL, '██', cur.c);
          }));
    
          // 侧栏
          let y = Y0;
          s.box(PX, y, 22, 8, 'accent2', 'bg', 'single', 'NEXT');
          next.m.forEach((row, ry) => row.forEach((v, rx) => {
            if (!v) return;
            s.write(PX + 2 + rx * 2, y + 2 + ry, '██', next.c);
          }));
          y += 9;
    
          s.box(PX, y, 22, 6, 'accent2', 'bg', 'single', 'STATS');
          s.write(PX + 2, y + 2, `SCORE ${score}`, 'amber');
          s.write(PX + 2, y + 3, `LINES ${lines}`, 'default');
          s.write(PX + 2, y + 4, `LEVEL ${level}`, 'cyan');
          y += 7;
    
          s.box(PX, y, 22, 5, 'accent2', 'bg', 'single', 'KEYS');
          s.write(PX + 2, y + 1, '←→ 移动', 'dim');
          s.write(PX + 2, y + 2, '↑/X 旋转 Z 逆', 'dim');
          s.write(PX + 2, y + 3, '空格 硬降', 'dim');
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/g2048.js ----
  __defs["src/games/g2048.js"] = function (__exports, __req) {
    const { randInt } = __req("src/core/util.js");
    
    const N = 4;
    
    const COLORS = {
      2: 'default',
      4: 'accent',
      8: 'cyan',
      16: 'blue',
      32: 'violet',
      64: 'magenta',
      128: 'amber',
      256: 'yellow',
      512: 'orange',
      1024: 'red',
      2048: 'white',
    };
    
    __exports.default = {
      id: '2048',
      name: '2048',
      cn: '数字合并',
      desc: '相同数字合并，目标 2048',
      keys: ['WASD / ↑↓←→ 滑动', 'R 重开'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
    
        const CW = 7;                       // 单元格内宽
        const cellH = 3;                    // 单元格内高
        const boardW = N * CW + N + 1;      // 7*4 + 3 + 1 = 32
        const boardH = N * cellH + N + 1;   // 3*4 + 3 + 1 = 16
        const X0 = Math.floor((W - boardW) / 2);
        const Y0 = Math.floor((H - boardH) / 2);
    
        let g, score, ended, won;
    
        function reset() {
          g = Array.from({ length: N }, () => new Array(N).fill(0));
          score = 0; ended = false; won = false;
          addTile(); addTile();
          api.setStatus(`分数 ${score}`);
        }
    
        function freeCells() {
          const out = [];
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) out.push([x, y]);
          return out;
        }
    
        function addTile() {
          const f = freeCells();
          if (!f.length) return;
          const [x, y] = f[randInt(0, f.length - 1)];
          g[y][x] = Math.random() < 0.9 ? 2 : 4;
        }
    
        function compress(line) {
          const vals = line.filter((v) => v);
          const out = [];
          let gained = 0;
          for (let i = 0; i < vals.length; i++) {
            if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
              const merged = vals[i] * 2;
              out.push(merged);
              gained += merged;
              if (merged >= 2048) won = true;
              i++;
            } else {
              out.push(vals[i]);
            }
          }
          while (out.length < N) out.push(0);
          return { out, gained };
        }
    
        function slide(dir) {
          let changed = false;
          let gained = 0;
    
          for (let i = 0; i < N; i++) {
            const vertical = dir === 'up' || dir === 'down';
            const reverse = dir === 'right' || dir === 'down';
            let line = vertical ? g.map((r) => r[i]) : g[i].slice();
            if (reverse) line = line.slice().reverse();
    
            const before = line.join(',');
            const res = compress(line);
            let final = res.out.slice();
            if (reverse) final = final.reverse();
            gained += res.gained;
            if (before !== final.join(',')) changed = true;
    
            for (let j = 0; j < N; j++) {
              if (vertical) g[j][i] = final[j];
              else g[i][j] = final[j];
            }
          }
    
          if (changed) {
            score += gained;
            if (gained) audio.blip();
            addTile();
            api.setStatus(`分数 ${score}`);
            checkEnd();
          }
        }
    
        function hasMoves() {
          if (freeCells().length) return true;
          for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
              if (x + 1 < N && g[y][x] === g[y][x + 1]) return true;
              if (y + 1 < N && g[y][x] === g[y + 1][x]) return true;
            }
          }
          return false;
        }
    
        function checkEnd() {
          if (won) {
            api.saveBest(score);
            api.won(`达成 2048 · 分数 ${score}`);
            return;
          }
          if (!hasMoves()) {
            ended = true;
            api.saveBest(score);
            audio.lose();
            api.over(`没有可移动的方块 · 分数 ${score}`);
          } else if (score > api.best) {
            api.saveBest(score);
          }
        }
    
        function update() {
          if (ended) return;
          if (input.pressed('left')) slide('left');
          else if (input.pressed('right')) slide('right');
          else if (input.pressed('up')) slide('up');
          else if (input.pressed('down')) slide('down');
        }
    
        function render(s) {
          s.clear('bg');
          s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', '2048');
    
          for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
              const v = g[y][x];
              const cx = X0 + 1 + x * (CW + 1);
              const cy = Y0 + 1 + y * (cellH + 1);
              if (v) {
                s.fill(cx, cy, CW, cellH, ' ', null, 'bg2');
                const txt = String(v);
                const left = Math.floor((CW - txt.length) / 2);
                s.write(cx + left, cy + 1, txt, COLORS[v] || 'white', 'bg2');
              } else {
                s.fill(cx, cy, CW, cellH, '·', 'faint');
              }
            }
          }
    
          // 网格分隔
          for (let i = 1; i < N; i++) {
            s.vline(X0 + i * (CW + 1), Y0 + 1, boardH - 2, '│', 'accent2');
            s.hline(X0 + 1, Y0 + i * (cellH + 1), boardW - 2, '─', 'accent2');
          }
          for (let i = 1; i < N; i++) {
            for (let j = 1; j < N; j++) s.put(X0 + i * (CW + 1), Y0 + j * (cellH + 1), '┼', 'accent2');
          }
    
          const infoY = Y0 + boardH + 1;
          if (infoY < H) s.writeCenter(infoY, `分数 ${score}  最高 ${api.best}`, 'amber');
          if (infoY + 1 < H) s.writeCenter(infoY + 1, '目标：合并出 2048', 'dim');
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/mines.js ----
  __defs["src/games/mines.js"] = function (__exports, __req) {
    const { clamp, randInt } = __req("src/core/util.js");
    
    const NUM_COLORS = ['default', 'cyan', 'accent', 'yellow', 'blue', 'magenta', 'violet', 'red'];
    
    __exports.default = {
      id: 'mines',
      name: 'MINESWEEPER',
      cn: '扫雷',
      desc: '清出所有安全格，别踩到地雷',
      keys: ['WASD / ↑↓←→ 移动光标的', '空格 翻开   F 插旗'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
    
        const GW = 16, GH = 12, MINES = 32;
        const boardW = GW * 2 + 2;
        const boardH = GH + 2;
        const X0 = Math.floor((W - boardW) / 2);
        const Y0 = Math.floor((H - boardH) / 2);
    
        let cells, cursor, started, dead, flags, revealed, t;
    
        function reset() {
          cells = Array.from({ length: GH }, () => Array.from({ length: GW }, () => ({
            mine: false, open: false, flag: false, n: 0,
          })));
          cursor = { x: Math.floor(GW / 2), y: Math.floor(GH / 2) };
          started = false; dead = false; flags = 0; revealed = 0; t = 0;
          api.setStatus(`剩余雷 ${MINES - flags}`);
        }
    
        function realIndex(x, y) { return y * GW + x; }
    
        function placeMines(sx, sy) {
          const forbidden = new Set();
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const x = sx + dx, y = sy + dy;
              if (x >= 0 && x < GW && y >= 0 && y < GH) forbidden.add(realIndex(x, y));
            }
          }
          const pool = [];
          for (let i = 0; i < GW * GH; i++) if (!forbidden.has(i)) pool.push(i);
          for (let i = 0; i < MINES && pool.length; i++) {
            const j = randInt(0, pool.length - 1);
            const idx = pool.splice(j, 1)[0];
            cells[Math.floor(idx / GW)][idx % GW].mine = true;
          }
          for (let y = 0; y < GH; y++) {
            for (let x = 0; x < GW; x++) {
              let n = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if ((dx || dy) && nx >= 0 && nx < GW && ny >= 0 && ny < GH && cells[ny][nx].mine) n++;
                }
              }
              cells[y][x].n = n;
            }
          }
        }
    
        function open(x, y) {
          if (x < 0 || x >= GW || y < 0 || y >= GH) return;
          const c = cells[y][x];
          if (c.open || c.flag) return;
          c.open = true;
          revealed++;
          if (c.mine) { dead = true; return; }
          if (c.n === 0) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx || dy) open(x + dx, y + dy);
              }
            }
          }
        }
    
        function checkWin() {
          if (revealed === GW * GH - MINES) {
            api.saveBest(Math.max(1, Math.round(300 - t)));
            audio.win();
            api.won(`全部清出！用时 ${Math.round(t)} 秒`);
          }
        }
    
        function update(dt) {
          if (dead) return;
          if (started) t += dt;
    
          if (input.pressed('left')) cursor.x = clamp(cursor.x - 1, 0, GW - 1);
          if (input.pressed('right')) cursor.x = clamp(cursor.x + 1, 0, GW - 1);
          if (input.pressed('up')) cursor.y = clamp(cursor.y - 1, 0, GH - 1);
          if (input.pressed('down')) cursor.y = clamp(cursor.y + 1, 0, GH - 1);
    
          const c = cells[cursor.y][cursor.x];
    
          if (input.pressed('space')) {
            if (!started) { started = true; placeMines(cursor.x, cursor.y); }
            if (!c.flag) {
              open(cursor.x, cursor.y);
              if (dead) {
                audio.lose();
                cells.forEach((row) => row.forEach((cc) => { if (cc.mine) cc.open = true; }));
                api.saveBest(Math.max(0, Math.round(t)));
                api.over(`踩到地雷 · 存活 ${Math.round(t)} 秒`);
                return;
              }
              audio.blip();
              checkWin();
            }
          }
    
          if (input.pressed('f')) {
            if (!c.open) {
              c.flag = !c.flag;
              flags += c.flag ? 1 : -1;
              audio.hit();
            }
          }
    
          api.setStatus(`剩余雷 ${MINES - flags}  时间 ${Math.round(t)}s`);
        }
    
        function render(s) {
          s.clear('bg');
          s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', 'MINESWEEPER');
    
          for (let y = 0; y < GH; y++) {
            for (let x = 0; x < GW; x++) {
              const c = cells[y][x];
              const sx = X0 + 1 + x * 2;
              const sy = Y0 + 1 + y;
              const isCur = cursor.x === x && cursor.y === y;
              const bgc = isCur ? 'bg3' : null;
    
              if (c.open) {
                if (c.mine) s.write(sx, sy, '**', 'red', bgc);
                else if (c.n === 0) s.write(sx, sy, ' ·', 'faint', bgc);
                else s.write(sx, sy, ' ' + c.n, NUM_COLORS[c.n], bgc);
              } else if (c.flag) {
                s.write(sx, sy, ' F', 'amber', bgc);
              } else {
                s.write(sx, sy, isCur ? '▒▒' : '░░', isCur ? 'yellow' : 'dim', bgc);
              }
            }
          }
    
          const infoY = Y0 + boardH + 1;
          if (infoY < H) {
            s.writeCenter(infoY, `剩余地雷 ${MINES - flags}    已翻开 ${revealed}/${GW * GH - MINES}`, 'dim');
          }
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/invaders.js ----
  __defs["src/games/invaders.js"] = function (__exports, __req) {
    const { clamp, randInt } = __req("src/core/util.js");
    
    const ROW_CHARS = ['W', 'M', 'A', 'V'];
    const ROW_COLORS = ['magenta', 'violet', 'cyan', 'accent'];
    
    __exports.default = {
      id: 'invaders',
      name: 'INVADERS',
      cn: '太空侵略者',
      desc: '打光所有外星人，别被它们压到底线',
      keys: ['←→ / AD 移动', '空格 射击'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
    
        const COLS = 9, ROWS = 4, SPACING = 7;
        const FORM_X = Math.floor((W - (COLS - 1) * SPACING) / 2);
        const PLAYER_Y = H - 3;
        const GROUND_Y = H - 1;
    
        let player, aliens, bullets, enemyBullets, ox, oy, stepTimer, stepInterval, dir,
          lives, score, wave, ended, shootCd, killed;
    
        function makeAliens() {
          aliens = [];
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              aliens.push({
                cx: FORM_X + c * SPACING,
                row: r,
                col: c,
                alive: true,
                ch: ROW_CHARS[r],
                color: ROW_COLORS[r],
              });
            }
          }
        }
    
        function reset() {
          player = { x: W / 2 };
          makeAliens();
          bullets = [];
          enemyBullets = [];
          ox = 0; oy = 3;
          dir = 1;
          stepTimer = 0;
          stepInterval = 0.55;
          lives = 3; score = 0; wave = 1;
          ended = false; shootCd = 0; killed = 0;
          sync();
        }
    
        function sync() {
          api.setStatus(`分 ${score}  波 ${wave}  命 ${lives}`);
        }
    
        function alienScreenX(a) { return Math.round(a.cx + ox); }
        function alienScreenY(a) { return oy + a.row; }
    
        function aliveAliens() { return aliens.filter((a) => a.alive); }
    
        function hitPlayer() {
          lives--;
          audio.lose();
          sync();
          if (lives <= 0) {
            ended = true;
            api.saveBest(score);
            api.over(`被击落 · 得分 ${score}`);
          }
        }
    
        function nextWave() {
          wave++;
          oy = 3;
          ox = 0;
          dir = 1;
          killed = 0;
          stepInterval = Math.max(0.08, 0.5 - (wave - 1) * 0.06);
          makeAliens();
          bullets = [];
          enemyBullets = [];
          audio.win();
          sync();
        }
    
        function update(dt) {
          if (ended) return;
          shootCd -= dt;
    
          player.x = clamp(player.x + input.axisX() * 46 * dt, 2, W - 3);
    
          if (input.anyPressed('space') && shootCd <= 0) {
            bullets.push({ x: Math.round(player.x), y: PLAYER_Y - 2 });
            shootCd = 0.26;
            audio.blip();
          }
    
          // 外星人移动
          const alive = aliveAliens();
          if (alive.length) {
            const speedScale = 1 + (1 - alive.length / aliens.length) * 1.8 + killed * 0.02;
            stepTimer += dt * speedScale;
            const edgeHit = alive.some((a) => {
              const x = alienScreenX(a);
              return (dir > 0 && x >= W - 4) || (dir < 0 && x <= 3);
            });
    
            if (stepTimer >= stepInterval) {
              stepTimer = 0;
              if (edgeHit) {
                oy += 2;
                dir *= -1;
              } else {
                ox += dir;
              }
    
              if (alive.some((a) => alienScreenY(a) >= PLAYER_Y - 2)) {
                ended = true;
                api.saveBest(score);
                api.over(`外星人压到底线 · 得分 ${score}`);
                return;
              }
    
              if (Math.random() < 0.35) {
                const shooter = alive[randInt(0, alive.length - 1)];
                enemyBullets.push({ x: alienScreenX(shooter), y: alienScreenY(shooter) + 1 });
              }
            }
          }
    
          // 玩家子弹
          for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.y -= 52 * dt;
            let hit = false;
            for (const a of aliveAliens()) {
              if (alienScreenX(a) === b.x && alienScreenY(a) === b.y) {
                a.alive = false;
                killed++;
                score += 10 + (ROWS - a.row) * 5;
                hit = true;
                audio.hit();
                sync();
                break;
              }
            }
            if (hit || b.y < 1) bullets.splice(i, 1);
          }
    
          // 敌人子弹
          for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const b = enemyBullets[i];
            b.y += 26 * dt;
            if (b.y >= PLAYER_Y - 1 && Math.abs(b.x - player.x) <= 1.5) {
              enemyBullets.splice(i, 1);
              hitPlayer();
              if (ended) return;
              continue;
            }
            if (b.y > GROUND_Y) enemyBullets.splice(i, 1);
          }
    
          if (!aliveAliens().length) nextWave();
        }
    
        function render(s) {
          s.clear('bg');
    
          for (const a of aliens) {
            if (!a.alive) continue;
            s.put(alienScreenX(a), alienScreenY(a), a.ch, a.color);
          }
    
          for (const b of bullets) s.put(b.x, Math.round(b.y), '|', 'yellow');
          for (const b of enemyBullets) s.put(b.x, Math.round(b.y), '!', 'red');
    
          const px = Math.round(player.x);
          s.write(px - 1, PLAYER_Y, '/^\\', 'cyan');
    
          s.hline(0, GROUND_Y, W, '─', 'accent2');
          s.write(2, 0, ` SCORE ${score} `, 'amber');
          s.writeRight(W - 3, 0, ` WAVE ${wave}  `, 'cyan');
          s.writeRight(W - 3, 1, ` LIVES ${'#'.repeat(Math.max(0, lives))}  `, 'red');
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/runner.js ----
  __defs["src/games/runner.js"] = function (__exports, __req) {
    const { clamp, randInt } = __req("src/core/util.js");
    
    __exports.default = {
      id: 'runner',
      name: 'RUNNER',
      cn: '奔跑者',
      desc: '一个键的小恐龙，越跑越快',
      keys: ['空格 / ↑ 跳', '可以二段跳'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
    
        const GROUND = H - 4;
        const PX = 10;
        const GRAV = 110;
        const JUMP_V = -40;
    
        let y, vy, jumps, obstacles, speed, score, ended, spawnGap, t;
    
        function reset() {
          y = GROUND;
          vy = 0;
          jumps = 0;
          obstacles = [];
          speed = 34;
          score = 0;
          ended = false;
          spawnGap = 0.9;
          t = 0;
          api.setStatus('0 m');
        }
    
        function jump() {
          if (jumps < 2) {
            vy = JUMP_V * (jumps === 0 ? 1 : 0.86);
            jumps++;
            audio.beep(jumps === 1 ? 520 : 660, 0.07, 'square');
          }
        }
    
        function update(dt) {
          if (ended) return;
          t += dt;
          speed = Math.min(72, speed + dt * 1.6);
          score += speed * dt * 0.35;
    
          if (input.anyPressed('space', 'up', 'w')) jump();
    
          vy += GRAV * dt;
          y += vy * dt;
          if (y >= GROUND) {
            if (jumps > 0) audio.beep(300, 0.05);
            y = GROUND;
            vy = 0;
            jumps = 0;
          }
    
          spawnGap -= dt;
          if (spawnGap <= 0) {
            const h = Math.random() < 0.25 ? 3 : randInt(1, 2);
            obstacles.push({ x: W - 1, h, w: h >= 3 ? 2 : 1 });
            spawnGap = Math.max(0.42, (randInt(55, 95) / 100) * (60 / speed) * 1.6);
          }
    
          for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            o.x -= speed * dt;
            if (o.x + o.w < -1) obstacles.splice(i, 1);
          }
    
          // 碰撞：玩家占 (PX-1..PX+1, y-1..y)
          for (const o of obstacles) {
            const oy0 = GROUND - o.h + 1;
            const px0 = PX - 1, px1 = PX + 1;
            const py0 = y - 1, py1 = y;
            if (px1 >= o.x && px0 <= o.x + o.w - 1 && py1 >= oy0 && py0 <= GROUND) {
              ended = true;
              api.saveBest(Math.round(score));
              audio.lose();
              api.over(`撞上了 · ${Math.round(score)} m`);
              return;
            }
          }
    
          api.setStatus(`${Math.round(score)} m   速度 ${speed.toFixed(0)}`);
        }
    
        function render(s) {
          s.clear('bg');
    
          // 地平线
          s.hline(0, GROUND + 1, W, '─', 'accent2');
          for (let x = 0; x < W; x += 7) {
            const off = Math.floor((t * speed) % 7);
            s.put((x - off + W * 2) % W, GROUND + 2, '.', 'faint');
          }
    
          // 远景
          const hillOff = Math.floor((t * speed * 0.15) % 40);
          for (let i = 0; i < 4; i++) {
            const hx = (i * 24 - hillOff + 80) % 80;
            s.write(hx, GROUND - 5, ' /\\  ', 'faint');
            s.write(hx, GROUND - 4, '/  \\ ', 'faint');
          }
    
          // 障碍
          for (const o of obstacles) {
            for (let i = 0; i < o.h; i++) {
              s.write(Math.round(o.x), GROUND - i, '#'.repeat(o.w), 'red');
            }
          }
    
          // 玩家
          const py = Math.round(y);
          s.write(PX - 1, py - 1, '/o\\', 'cyan');
          s.write(PX - 1, py, jumps > 0 ? '/^\\' : '/ \\', 'cyan');
    
          s.write(2, 0, ` ${Math.round(score)} m `, 'amber');
          s.writeRight(W - 3, 0, ` 速度 ${speed.toFixed(0)}  `, 'dim');
          if (jumps === 1) s.writeRight(W - 3, 1, ' AIR ', 'faint');
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/sokoban.js ----
  __defs["src/games/sokoban.js"] = function (__exports, __req) {
    // 关卡：'#' 墙  ' ' 地板  '.' 目标  '$' 箱子  '*' 箱在目标  '@' 玩家  '+' 玩家在目标
    // scripts/levels.mjs 会用 BFS 校验每一关真的可解。
    const LEVELS = [
      [
        '################',
        '#              #',
        '#    $     .   #',
        '#    @         #',
        '#              #',
        '################',
      ],
      [
        '################',
        '#              #',
        '#  $       $   #',
        '#  .       .   #',
        '#      @       #',
        '#              #',
        '################',
      ],
      [
        '################',
        '#   #    .     #',
        '# $ #          #',
        '#              #',
        '#####    ######',
        '#   @  $       #',
        '#      .       #',
        '################',
      ],
      [
        '################',
        '#      #       #',
        '#  $   #   .   #',
        '#  @   #       #',
        '#      #       #',
        '####   #   #####',
        '#              #',
        '#      .   $   #',
        '################',
      ],
    ];
    
    __exports.default = {
      id: 'sokoban',
      name: 'SOKOBAN',
      cn: '推箱子',
      desc: '把箱子推上所有目标点，U 撤销',
      keys: ['方向键 / WASD 移动', 'U 撤销一步'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
    
        const CW = 2;      // 每格 2 字符宽
        let map, mw, mh, player, boxes, goals, moves, pushes, undoStack, level, cleared, solvedTimer;
    
        function load(idx) {
          const raw = LEVELS[idx % LEVELS.length];
          mh = raw.length;
          mw = Math.max(...raw.map((r) => r.length));
          map = [];
          boxes = [];
          goals = [];
          player = { x: 0, y: 0 };
          for (let y = 0; y < mh; y++) {
            const row = [];
            for (let x = 0; x < mw; x++) {
              const c = raw[y][x] || ' ';
              let cell = c;
              if (c === '@' || c === '+') { player = { x, y }; cell = c === '+' ? '.' : ' '; }
              if (c === '$' || c === '*') { boxes.push({ x, y }); cell = c === '*' ? '.' : ' '; }
              if (cell === '.') goals.push({ x, y });
              row.push(cell === '.' ? '.' : cell === '#' ? '#' : ' ');
            }
            map.push(row);
          }
          moves = 0;
          pushes = 0;
          undoStack = [];
          solvedTimer = 0;
          sync();
        }
    
        function sync() {
          api.setStatus(`第 ${level + 1}/${LEVELS.length} 关  步 ${moves}  推 ${pushes}`);
        }
    
        function reset() {
          level = 0;
          cleared = false;
          load(0);
        }
    
        function isWall(x, y) {
          if (y < 0 || y >= mh || x < 0 || x >= mw) return true;
          return map[y][x] === '#';
        }
    
        function boxAt(x, y) {
          return boxes.find((b) => b.x === x && b.y === y) || null;
        }
    
        function done() {
          return boxes.every((b) => goals.some((g) => g.x === b.x && g.y === b.y));
        }
    
        function move(dx, dy) {
          const nx = player.x + dx, ny = player.y + dy;
          if (isWall(nx, ny)) return;
    
          const b = boxAt(nx, ny);
          if (b) {
            const bx = nx + dx, by = ny + dy;
            if (isWall(bx, by) || boxAt(bx, by)) { audio.hit(); return; }
            undoStack.push({ px: player.x, py: player.y, box: b, bx: b.x, by: b.y });
            b.x = bx; b.y = by;
            pushes++;
            audio.beep(300, 0.05);
          } else {
            undoStack.push({ px: player.x, py: player.y, box: null });
            audio.blip();
          }
          player.x = nx;
          player.y = ny;
          moves++;
          sync();
    
          if (done()) {
            cleared = true;
            solvedTimer = 0.9;
            audio.win();
          }
        }
    
        function undo() {
          const last = undoStack.pop();
          if (!last) return;
          if (last.box) {
            last.box.x = last.bx;
            last.box.y = last.by;
            pushes = Math.max(0, pushes - 1);
          }
          player.x = last.px;
          player.y = last.py;
          moves = Math.max(0, moves - 1);
          cleared = false;
          solvedTimer = 0;
          sync();
          audio.beep(220, 0.04);
        }
    
        function update(dt) {
          if (solvedTimer > 0) {
            solvedTimer -= dt;
            if (solvedTimer <= 0) {
              if (level + 1 >= LEVELS.length) {
                api.saveBest(level + 1);
                api.won(`${LEVELS.length} 关全部通过 · 共 ${moves} 步`);
              } else {
                level++;
                load(level);
                audio.score();
              }
            }
            return;
          }
    
          if (input.pressed('left')) move(-1, 0);
          else if (input.pressed('right')) move(1, 0);
          else if (input.pressed('up')) move(0, -1);
          else if (input.pressed('down')) move(0, 1);
          else if (input.pressed('u') || input.pressed('z')) undo();
        }
    
        function render(s) {
          s.clear('bg');
          const boardW = mw * CW + 2;
          const boardH = mh + 2;
          const X0 = Math.floor((W - boardW) / 2);
          const Y0 = Math.floor((H - 4 - boardH) / 2) + 1;
    
          s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', `LEVEL ${level + 1}`);
    
          for (let y = 0; y < mh; y++) {
            for (let x = 0; x < mw; x++) {
              const sx = X0 + 1 + x * CW;
              const sy = Y0 + 1 + y;
              const cell = map[y][x];
              const isGoal = goals.some((g) => g.x === x && g.y === y);
              const b = boxAt(x, y);
    
              if (cell === '#') {
                s.write(sx, sy, '██', 'faint');
                continue;
              }
              if (b) {
                s.write(sx, sy, '[]', isGoal ? 'accent' : 'amber');
              } else if (isGoal) {
                s.write(sx, sy, '· ', player.x === x && player.y === y ? 'cyan' : 'dim');
              }
              if (player.x === x && player.y === y) {
                s.write(sx, sy, '@' + (b ? '' : ' '), 'cyan');
              }
            }
          }
    
          const infoY = Y0 + boardH + 1;
          if (infoY < H) {
            const left = boxes.filter((b) => goals.some((g) => g.x === b.x && g.y === b.y)).length;
            s.writeCenter(infoY, `已归位 ${left}/${boxes.length}   步数 ${moves}   推动 ${pushes}`, 'dim');
          }
          if (cleared && solvedTimer > 0) {
            s.writeCenter(Y0 + Math.floor(mh / 2), '  LEVEL CLEAR  ', 'bg', 'accent');
          }
        }
    
        return { reset, update, render };
      },
    };
    
    __exports.LEVELS = LEVELS;
  };

  // ---- src/games/lights.js ----
  __defs["src/games/lights.js"] = function (__exports, __req) {
    const { clamp, randInt } = __req("src/core/util.js");
    
    const N = 7;
    const CW = 4;   // 每格 3 字符 + 1 间隔
    
    __exports.default = {
      id: 'lights',
      name: 'LIGHTS OUT',
      cn: '关灯',
      desc: '点一格翻转它和四邻，全灭即胜',
      keys: ['方向键 / WASD 移动光标', '空格 翻转  R 重开'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
    
        const boardW = N * CW + 1;
        const boardH = N + 2;
        const X0 = Math.floor((W - boardW) / 2);
        const Y0 = Math.floor((H - 5 - boardH) / 2) + 1;
    
        let g, cursor, moves, ended, solvedTimer;
    
        function toggle(x, y) {
          if (x < 0 || x >= N || y < 0 || y >= N) return;
          g[y][x] = !g[y][x];
        }
    
        function press(x, y) {
          toggle(x, y);
          toggle(x - 1, y);
          toggle(x + 1, y);
          toggle(x, y - 1);
          toggle(x, y + 1);
          moves++;
          audio.beep(560 + y * 30, 0.035);
          api.setStatus(`步数 ${moves}`);
          if (allOff()) {
            ended = true;
            solvedTimer = 1.2;
            const score = Math.max(1, 200 - moves * 4);
            api.saveBest(score);
            audio.win();
          }
        }
    
        function allOff() {
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) return false;
          return true;
        }
    
        function scramble(steps) {
          g = Array.from({ length: N }, () => new Array(N).fill(false));
          // 从全灭状态倒着点，保证一定有解
          for (let i = 0; i < steps; i++) {
            const x = randInt(0, N - 1);
            const y = randInt(0, N - 1);
            toggle(x, y); toggle(x - 1, y); toggle(x + 1, y); toggle(x, y - 1); toggle(x, y + 1);
          }
          if (allOff()) scramble(steps);
        }
    
        function reset() {
          cursor = { x: 1, y: 3 };
          moves = 0;
          ended = false;
          solvedTimer = 0;
          scramble(9);
          api.setStatus('步数 0');
        }
    
        function update(dt) {
          if (solvedTimer > 0) {
            solvedTimer -= dt;
            if (solvedTimer <= 0) api.won(`全灭了 · ${moves} 步`);
            return;
          }
          if (ended) return;
    
          if (input.pressed('left')) cursor.x = (cursor.x + N - 1) % N;
          if (input.pressed('right')) cursor.x = (cursor.x + 1) % N;
          if (input.pressed('up')) cursor.y = (cursor.y + N - 1) % N;
          if (input.pressed('down')) cursor.y = (cursor.y + 1) % N;
    
          // 鼠标/触屏点哪翻哪
          if (input.pointer.pressed) {
            const px = Math.floor(input.pointer.x - X0 - 1);
            const py = Math.floor(input.pointer.y - Y0 - 1);
            if (px >= 0 && px < N * CW && py >= 0 && py < N) {
              cursor.x = clamp(Math.floor(px / CW), 0, N - 1);
              cursor.y = clamp(py, 0, N - 1);
              press(cursor.x, cursor.y);
              return;
            }
          }
    
          if (input.pressed('space') || input.pressed('enter')) press(cursor.x, cursor.y);
        }
    
        function render(s) {
          s.clear('bg');
          s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', 'LIGHTS OUT');
    
          for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
              const sx = X0 + 1 + x * CW;
              const sy = Y0 + 1 + y;
              const on = g[y][x];
              const isCur = cursor.x === x && cursor.y === y;
              if (on) {
                s.write(sx, sy, '███', isCur ? 'yellow' : 'amber', isCur ? 'bg3' : null);
              } else {
                s.write(sx, sy, '···', isCur ? 'accent' : 'faint', isCur ? 'bg3' : null);
              }
            }
          }
    
          // 光标框：用竖线把当前格夹住
          s.put(X0, Y0 + 1 + cursor.y, '▸', 'yellow');
          s.put(X0 + boardW - 1, Y0 + 1 + cursor.y, '◂', 'yellow');
    
          const infoY = Y0 + boardH + 1;
          s.writeCenter(infoY, `步数 ${moves}`, 'amber');
          if (infoY + 1 < H) s.writeCenter(infoY + 1, '目标：让所有格子熄灭', 'dim');
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/duel.js ----
  __defs["src/games/duel.js"] = function (__exports, __req) {
    const { clamp } = __req("src/core/util.js");
    
    const DIRS = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };
    const GLYPH = { up: '^^', down: 'vv', left: '<<', right: '>>' };
    
    // 竞技场按格子算：39 格 × 17 格，每格 2 字符宽，正好铺满 78 列
    const WC = 39;
    const HC = 17;
    
    // 墙体按 180° 旋转对称生成，两个出生点公平
    const WALLS_BASE = [
      { x: 6, y: 3, w: 2, h: 5 },
      { x: 15, y: 7, w: 3, h: 3 },
      { x: 26, y: 1, w: 4, h: 2 },
    ];
    
    __exports.default = {
      id: 'duel',
      name: 'DUEL',
      cn: '双人对射',
      desc: '两台坦克互相射击 · 单人时右边是 AI',
      players: 2,
      keys: ['P1 WASD 移动 / F 开火', 'P2 方向键移动 / Enter 开火', '打掉对方 3 格血取胜'],
      create(api) {
        const { screen, input, audio } = api;
        const W = api.w, H = api.h;
        const twoP = api.players === 2;
    
        const y0 = 2;
        const boxH = HC + 2;
    
        let walls, tanks, bullets, bulletAcc, ended, aiPad, aiTimer, aiDir, t;
    
        function mirror(r) {
          return { x: WC - r.x - r.w, y: HC - r.y - r.h, w: r.w, h: r.h };
        }
    
        function buildWalls() {
          const set = new Set();
          for (const r of WALLS_BASE) {
            for (const rect of [r, mirror(r)]) {
              for (let y = rect.y; y < rect.y + rect.h; y++) {
                for (let x = rect.x; x < rect.x + rect.w; x++) set.add(y * WC + x);
              }
            }
          }
          return set;
        }
    
        function isWall(x, y) {
          if (x < 0 || y < 0 || x >= WC || y >= HC) return true;
          return walls.has(y * WC + x);
        }
    
        function tankAt(x, y) {
          return tanks.find((t) => t.x === x && t.y === y) || null;
        }
    
        function makeTank(spawn, dir, color, label) {
          return {
            x: spawn.x, y: spawn.y, spawn, dir,
            hp: 3, cd: 0, inv: 0, moveCd: 0,
            color, label,
          };
        }
    
        // 单人模式下用这个假手柄驱动右侧坦克，走的是和 P2 完全相同的代码路径
        function makeAiPad() {
          let fire = false;
          return {
            _dir: null,
            isDown(b) { return this._dir === b; },
            pressed(b) { return b === 'fire' && fire; },
            anyPressed(...b) { return b.some((k) => this.pressed(k)); },
            dir() { return this._dir; },
            axisX() { return this._dir === 'right' ? 1 : this._dir === 'left' ? -1 : 0; },
            axisY() { return this._dir === 'down' ? 1 : this._dir === 'up' ? -1 : 0; },
            setFire(v) { fire = v; },
          };
        }
    
        function reset() {
          walls = buildWalls();
          ended = false;
          bullets = [];
          bulletAcc = 0;
          t = 0;
          tanks = [
            makeTank({ x: 1, y: HC - 2 }, 'right', 'cyan', 'P1'),
            makeTank({ x: WC - 2, y: 1 }, 'left', 'magenta', 'P2'),
          ];
          aiPad = makeAiPad();
          aiTimer = 0;
          aiDir = null;
          sync();
        }
    
        function sync() {
          api.setStatus(`P1 ${tanks[0].hp} : ${tanks[1].hp} P2`);
        }
    
        function sight(a, b) {
          if (a.x !== b.x && a.y !== b.y) return null;
          const dx = Math.sign(b.x - a.x);
          const dy = Math.sign(b.y - a.y);
          let x = a.x, y = a.y;
          for (let i = 0; i < WC + HC; i++) {
            x += dx;
            y += dy;
            if (x === b.x && y === b.y) {
              return dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
            }
            if (isWall(x, y)) return null;
          }
          return null;
        }
    
        /** 简单 AI：能对射就对射，否则绕到能对射的位置 */
        function driveAi(dt) {
          const me = tanks[1];
          const foe = tanks[0];
          aiTimer -= dt;
          if (aiTimer <= 0) {
            aiTimer = 0.16;
            const los = sight(me, foe);
            aiPad.setFire(false);
            if (los) {
              aiDir = los;
              aiPad.setFire(true);
            } else {
              // 先对齐一条轴，靠近了再拐弯
              const dx = foe.x - me.x;
              const dy = foe.y - me.y;
              const preferX = Math.abs(dx) > Math.abs(dy);
              const want = preferX
                ? (dx > 0 ? 'right' : 'left')
                : (dy > 0 ? 'down' : 'up');
              const nx = me.x + DIRS[want].x;
              const ny = me.y + DIRS[want].y;
              aiDir = (isWall(nx, ny) || tankAt(nx, ny)) ? (preferX ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left')) : want;
              if (Math.random() < 0.25) aiPad.setFire(true);
            }
            aiPad._dir = aiDir;
          }
        }
    
        function drivePad(tank, pad, dt) {
          const fresh = pad.dir();
          const held = fresh
            || (pad.isDown('left') ? 'left' : pad.isDown('right') ? 'right'
              : pad.isDown('up') ? 'up' : pad.isDown('down') ? 'down' : null);
    
          tank.moveCd -= dt;
          tank.cd -= dt;
          if (tank.inv > 0) tank.inv -= dt;
    
          if (held) {
            tank.dir = held;
            if (tank.moveCd <= 0) {
              const nx = tank.x + DIRS[held].x;
              const ny = tank.y + DIRS[held].y;
              if (!isWall(nx, ny) && !tankAt(nx, ny)) {
                tank.x = nx;
                tank.y = ny;
                tank.moveCd = 0.10;
              }
            }
          }
    
          if (pad.pressed('fire') && tank.cd <= 0) shoot(tank);
        }
    
        function shoot(tank) {
          const mine = bullets.filter((b) => b.owner === tank).length;
          if (mine >= 2) return;
          const d = DIRS[tank.dir];
          bullets.push({ x: tank.x + d.x, y: tank.y + d.y, dir: tank.dir, owner: tank, t: 0 });
          tank.cd = 0.42;
          audio.beep(660, 0.05, 'square');
        }
    
        function stepBullets() {
          for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            const d = DIRS[b.dir];
            b.x += d.x;
            b.y += d.y;
    
            if (isWall(b.x, b.y)) { bullets.splice(i, 1); continue; }
    
            const hit = tanks.find((t) => t !== b.owner && t.x === b.x && t.y === b.y);
            if (hit) {
              bullets.splice(i, 1);
              if (hit.inv > 0) continue;
              hit.hp--;
              hit.inv = 1.1;
              audio.hit();
              sync();
              if (hit.hp <= 0) {
                ended = true;
                api.saveBest(Math.max(tanks[0].hp, tanks[1].hp));
                if (hit === tanks[1]) {
                  if (twoP) api.won('P1 获胜'); else api.won('你赢了这台终端');
                } else {
                  if (twoP) api.over('P2 获胜'); else api.over('电脑赢下了对射');
                }
                return;
              }
            }
          }
        }
    
        function update(dt) {
          if (ended) return;
          t += dt;
    
          drivePad(tanks[0], twoP ? input.p1 : input, dt);
    
          if (twoP) {
            drivePad(tanks[1], input.p2, dt);
          } else {
            driveAi(dt);
            drivePad(tanks[1], aiPad, dt);
          }
    
          bulletAcc += dt;
          let guard = 0;
          while (bulletAcc >= 0.055 && !ended && guard++ < 8) {
            bulletAcc -= 0.055;
            stepBullets();
          }
        }
    
        function drawTank(s, t, blinker) {
          const sx = 1 + t.x * 2;
          const sy = y0 + 1 + t.y;
          if (t.inv > 0 && !blinker) return;
          s.write(sx, sy, GLYPH[t.dir], t.color);
        }
    
        function render(s) {
          s.clear('bg');
    
          // 血条 + 比分
          const hpBar = (t) => '█'.repeat(Math.max(0, t.hp)) + '·'.repeat(Math.max(0, 3 - t.hp));
          s.write(2, 0, 'P1', 'cyan');
          s.write(5, 0, hpBar(tanks[0]), tanks[0].hp > 1 ? 'cyan' : 'red');
          s.writeCenter(0, 'DUEL', 'accent');
          s.writeRight(W - 3, 0, hpBar(tanks[1]), tanks[1].hp > 1 ? 'magenta' : 'red');
          s.writeRight(W - 7, 0, 'P2', 'magenta');
    
          // 场地
          s.box(0, y0, W, boxH, 'accent2', 'bg');
    
          for (const key of walls) {
            const x = key % WC;
            const y = (key / WC) | 0;
            s.write(1 + x * 2, y0 + 1 + y, '▓▓', 'faint');
          }
    
          for (const b of bullets) {
            const horiz = b.dir === 'left' || b.dir === 'right';
            s.write(1 + b.x * 2, y0 + 1 + b.y, horiz ? '==' : '||', 'yellow');
          }
    
          const blink = Math.floor(t * 8) % 2 === 0;
          tanks.forEach((tk) => drawTank(s, tk, blink));
    
          const infoY = y0 + boxH + 1;
          if (infoY < H) {
            s.writeCenter(infoY, twoP
              ? 'P1 左下方   P2 右上方   打掉对方 3 格血'
              : 'WASD 移动 · F 开火 · 打掉 AI 的 3 格血', 'dim');
          }
        }
    
        return { reset, update, render };
      },
    };
    
    
  };

  // ---- src/games/index.js ----
  __defs["src/games/index.js"] = function (__exports, __req) {
    // 游戏总目录：加新游戏只要在这里 import 一次并放进数组。
    // 想让游戏进默认菜单，只改这个文件就够了。
    const pong = __req("src/games/pong.js").default;
    const hockey = __req("src/games/hockey.js").default;
    const snake = __req("src/games/snake.js").default;
    const breakout = __req("src/games/breakout.js").default;
    const tetris = __req("src/games/tetris.js").default;
    const g2048 = __req("src/games/g2048.js").default;
    const mines = __req("src/games/mines.js").default;
    const invaders = __req("src/games/invaders.js").default;
    const runner = __req("src/games/runner.js").default;
    const sokoban = __req("src/games/sokoban.js").default;
    const lights = __req("src/games/lights.js").default;
    const duel = __req("src/games/duel.js").default;
    
    const GAMES = [
      pong,
      hockey,
      snake,
      breakout,
      tetris,
      g2048,
      mines,
      invaders,
      runner,
      sokoban,
      lights,
      duel,
    ];
    
    __exports.default = GAMES;
    
    __exports.GAMES = GAMES;
  };

  // ---- src/main.js ----
  __defs["src/main.js"] = function (__exports, __req) {
    const { Engine } = __req("src/core/engine.js");
    const GAMES = __req("src/games/index.js").default;
    
    __exports.GAMES = GAMES;
    
    const instances = new Set();
    let activeEngine = null;
    
    const api = {
      version: '1.2.0',
      games: GAMES,
      get active() { return activeEngine; },
      get instances() { return [...instances]; },
    
      /** 注册自定义游戏（挂载前调用）。 */
      register(game) {
        if (!game || !game.id || typeof game.create !== 'function') {
          throw new Error('[arcade] register() 需要 { id, name, create }');
        }
        if (GAMES.some((g) => g.id === game.id)) {
          GAMES[GAMES.findIndex((g) => g.id === game.id)] = game;
        } else {
          GAMES.push(game);
        }
        return api;
      },
    
      /** 在容器上挂载一个实例。 */
      mount,
    
      /** 键盘输入聚焦到某个实例（多实例时用）。 */
      focus(engine) { activeEngine = engine; },
    
      _register(engine) {
        instances.add(engine);
        if (!activeEngine) activeEngine = engine;
      },
    
      _unregister(engine) {
        instances.delete(engine);
        if (activeEngine === engine) activeEngine = instances.values().next().value || null;
      },
    };
    
    // 允许在 Node / SSR / 打包器的静态分析阶段直接 import 而不炸（此时没有 window）。
    const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (hasDOM) window.TerminalArcade = api;
    
    /**
     * mount(el, { game?: id, height?: number, muted?: boolean })
     * el 可以是 CSS 选择器或 DOM 节点。
     */
    function mount(host, opts = {}) {
      if (!hasDOM) {
        throw new Error('[arcade] mount() 需要浏览器环境（Node/SSR 下可以 import，但无法挂载）');
      }
      const el = typeof host === 'string' ? document.querySelector(host) : host;
      if (!el) throw new Error('[arcade] 找不到挂载容器: ' + host);
      const engine = new Engine(el, GAMES, opts).start();
      return engine;
    }
    
    function autoMount() {
      document.querySelectorAll('[data-arcade]').forEach((el) => {
        if (el.dataset.arcadeMounted) return;
        el.dataset.arcadeMounted = '1';
        const opts = {};
        if (el.dataset.game) opts.game = el.dataset.game;
        if (el.dataset.height) opts.height = Number(el.dataset.height);
        if (el.hasAttribute('data-muted')) opts.muted = true;
        mount(el, opts);
      });
    }
    
    if (hasDOM) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMount);
      } else {
        autoMount();
      }
    }
    
    __exports.default = api;
    
    /** 注册/替换游戏。等价于 api.register()，供具名导入使用。 */
    function register(game) {
      return api.register(game);
    }
    
    __exports.mount = mount;
  __exports.register = register;
  };

  __req("src/main.js");
})();
