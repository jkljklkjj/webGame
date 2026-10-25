import { Screen } from './screen.js';
import { Input } from './input.js';
import { Beeps } from './audio.js';
import { padStartW, padW, strWidth, truncW } from './util.js';

const COLS = 80;
const ROWS = 36;
const STEP = 1 / 60;

const HINT_MENU = '[↑↓] 选择  [←→] 双人  [ENTER] 开始  [M] 静音';
const HINT_PLAY = '[ESC] 暂停  [R] 重开  [M] 静音';

export class Engine {
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
