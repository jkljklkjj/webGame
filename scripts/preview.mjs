// 终端预览：把引擎的字符网格打印到 stdout，方便在没有浏览器时检查排版。
// 用法: node scripts/preview.mjs            -> 菜单
//       node scripts/preview.mjs tetris     -> 某个游戏的若干帧
const ctxStub = {
  font: '', fillStyle: '', textBaseline: '', textAlign: '',
  measureText: () => ({ width: 9.63 }),
  setTransform() {}, fillRect() {}, fillText() {},
};

function makeEl() {
  const el = {
    style: {}, dataset: {}, classList: { add() {}, remove() {} },
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 771, height: 540 }),
    getContext: () => ctxStub,
    querySelectorAll: () => [],
  };
  return el;
}

const listeners = {};
global.window = {
  devicePixelRatio: 1,
  addEventListener(k, fn) { (listeners[k] ||= []).push(fn); },
  removeEventListener() {},
  AudioContext: null,
  webkitAudioContext: null,
  TerminalArcade: null,
};
global.document = {
  readyState: 'complete',
  createElement: () => makeEl(),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
};
global.localStorage = { getItem: () => '{}', setItem() {} };
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

const { Engine } = await import('../src/core/engine.js');
const { COLORS } = await import('../src/core/palette.js');
const { default: games } = await import('../src/games/index.js');

global.window.TerminalArcade = { active: null, focus() {}, _register() {} };

const host = makeEl();
const engine = new Engine(host, games, {});
global.window.TerminalArcade.active = engine;

// --ansi：用 24 位真彩把每个字符的前景/背景打到终端，能直接看到配色
const ANSI = process.argv.includes('--ansi');
const rgb = (hex) => {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const paint = (name, isBg, fallback) => {
  const c = rgb(COLORS[name] || name || '') || rgb(COLORS[fallback]);
  if (!c) return '';
  return `\x1b[${isBg ? 48 : 38};2;${c[0]};${c[1]};${c[2]}m`;
};

function dumpAnsi(label) {
  const s = engine.screen;
  const out = [`\n=== ${label} ===`];
  for (let y = 0; y < s.rows; y++) {
    let line = '';
    let lastFg = null, lastBg = null;
    for (let x = 0; x < s.cols; x++) {
      const i = y * s.cols + x;
      if (s.wide[i] === 2) continue;
      const fg = s.fg[i] || 'default';
      const bg = s.bg[i] || 'bg';
      if (fg !== lastFg) { line += paint(fg, false, 'default'); lastFg = fg; }
      if (bg !== lastBg) { line += paint(bg, true, 'bg'); lastBg = bg; }
      line += s.ch[i] === '\u0000' ? ' ' : s.ch[i];
    }
    out.push(line + '\x1b[0m');
  }
  out.push('\x1b[0m');
  console.log(out.join('\n'));
}

function dump(label) {
  if (ANSI) return dumpAnsi(label);
  console.log(`\n=== ${label} ===`);
  console.log(engine.screen.text());
}

// 强制步进，绕过 rAF
function tick(n, dt = 1 / 60) {
  for (let i = 0; i < n; i++) engine._step(dt);
  engine._draw();
}

const which = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!which) {
  tick(1);
  dump('MENU');
} else {
  const idx = games.findIndex((g) => g.id === which);
  if (idx < 0) { console.error('no such game:', which, games.map((g) => g.id)); process.exit(1); }
  engine.startGame(idx);
  tick(Number(process.argv.slice(2).find((a, i) => i > 0 && !a.startsWith('--')) || 30));
  dump(which);
  engine.state = 'pause';
  tick(1);
  dump(which + ' / PAUSED');

  // 结束覆盖层
  engine.state = 'over';
  engine.overlay = { title: 'GAME OVER', msg: '撞上了 · 128 m', score: '128 m' };
  tick(1);
  dump(which + ' / OVER');

  // 帮助覆盖层
  engine.state = 'menu';
  engine.showHelp = true;
  tick(1);
  dump('HELP');
}
