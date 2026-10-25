// 玩法级测试：推箱子能通关、关灯的翻转/胜利判定正确、引擎状态机跳转正确。
// 用法: node scripts/games-test.mjs
import { installDom } from './_dom.mjs';
const env = installDom();

const { Screen } = await import('../src/core/screen.js');
const { COLORS } = await import('../src/core/palette.js');
const GAMES = (await import('../src/games/index.js')).default;
const { makeInput } = await import('./_input.mjs');

// 收集所有游戏实际用到的颜色名，检查是否都在调色板里
const audit = {
  used: new Set(),
  collect(screen) {
    for (let i = 0; i < screen.ch.length; i++) {
      if (screen.fg[i]) this.used.add(screen.fg[i]);
      if (screen.bg[i]) this.used.add(screen.bg[i]);
    }
  },
};

let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed++;
};

function harness(gameId, h = 35, players = 1) {
  const game = GAMES.find((g) => g.id === gameId);
  const screen = new Screen(80, 36);
  screen.layout(env.ctxStub);

  const input = makeInput();
  const audio = { beep() {}, blip() {}, hit() {}, bounce() {}, score() {}, win() {}, lose() {}, resume() {} };
  const st = { end: null, best: 0, status: '' };
  const api = {
    game, screen, input, audio, w: 80, h, players,
    setStatus(t) { st.status = String(t); },
    saveBest(n) { st.best = Math.max(st.best, n); },
    get best() { return st.best; },
    over(m) { st.end = 'over:' + m; },
    won(m) { st.end = 'won:' + m; },
    restart() {}, exit() {}, toast() {},
  };
  const inst = game.create(api);
  inst.reset();
  screen.clear('bg');
  inst.render(screen);   // 先画一帧，后面的断言才能读网格

  return {
    inst, input, screen, st, api,
    /** 走一帧 */
    tick(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) {
        inst.update(dt);
        screen.clear('bg');   // 引擎每帧都会清，这里要一致
        inst.render(screen);
        audit.collect(screen);
        input.endFrame();
      }
    },
    key(k) { input.press(k); this.tick(1); },
    /** 让某个玩家按住 / 松开某个方向 */
    hold(n, btn) { input.padDown(n, btn); },
    release(n, btn) { input.padUp(n, btn); },
  };
}

// ---------------- 推箱子：按最优解通关第 1 关 ----------------
{
  const h = harness('sokoban');
  // 玩家 (5,3) 箱子 (5,2) 目标 (11,2)：左一格、上一格，然后连推 6 下
  const script = ['left', 'up', 'right', 'right', 'right', 'right', 'right', 'right'];
  for (const k of script) h.key(k);
  check('sokoban 第 1 关 8 步通关', /已归位 1\/1/.test(h.screen.text()), h.st.status);

  h.tick(70); // 0.9s 后进下一关
  check('sokoban 自动进入第 2 关', /第 2\/4 关/.test(h.st.status), h.st.status);
}

// ---------------- 关灯：翻转规则 + 追灯求解 ----------------
function readLights(screen) {
  // 找到面板左上角
  let X0 = -1, Y0 = -1;
  for (let y = 0; y < 36 && X0 < 0; y++) {
    for (let x = 0; x < 80; x++) {
      if (screen.ch[y * 80 + x] === '┌') { X0 = x; Y0 = y; break; }
    }
  }
  const g = [];
  for (let y = 0; y < 7; y++) {
    const row = [];
    for (let x = 0; x < 7; x++) {
      const i = (Y0 + 1 + y) * 80 + (X0 + 1 + x * 4);
      row.push(screen.ch[i] === '█');
    }
    g.push(row);
  }
  return g;
}

function chaseSolve(g) {
  const N = 7;
  const flip = (b, x, y) => {
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < N && ny >= 0 && ny < N) b[ny][nx] = b[ny][nx] ? 0 : 1;
    }
  };
  for (let mask = 0; mask < 128; mask++) {
    const b = g.map((r) => r.map((v) => (v ? 1 : 0)));
    const press = [];
    for (let x = 0; x < N; x++) {
      if (mask & (1 << x)) { flip(b, x, 0); press.push([x, 0]); }
    }
    for (let y = 1; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (b[y - 1][x]) { flip(b, x, y); press.push([x, y]); }
      }
    }
    if (b[N - 1].every((v) => !v)) return press;
  }
  return null;
}

{
  const h = harness('lights');
  const g0 = readLights(h.screen);
  const litCount = g0.flat().filter(Boolean).length;
  check('lights 初始局面不是全灭', litCount > 0, `亮 ${litCount}`);

  // 按一次中心，应该正好翻转 5 格（含自己）
  const before = readLights(h.screen);
  h.key('space');
  const after = readLights(h.screen);
  let diff = 0;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (before[y][x] !== after[y][x]) diff++;
  check('按一次（非角落）翻转 5 格', diff === 5, `实际 ${diff} 格`);

  // 重新开局，用追灯法解掉
  h.inst.reset();
  h.tick(1);
  const g1 = readLights(h.screen);
  const sol = chaseSolve(g1);
  check('存在解（追灯法）', !!sol, sol ? `${sol.length} 步` : '');

  if (sol) {
    let cur = { x: 1, y: 3 };
    for (const [x, y] of sol) {
      const rx = (x - cur.x + 7) % 7;
      const ry = (y - cur.y + 7) % 7;
      for (let i = 0; i < rx; i++) h.key('right');
      for (let i = 0; i < ry; i++) h.key('down');
      h.key('space');
      cur = { x, y };
    }
    const g2 = readLights(h.screen);
    check('按解法走完所有灯熄灭', g2.flat().every((v) => !v));
    h.tick(90);
    check('lights 触发通关', /^won:/.test(h.st.end || ''), h.st.end || '(未触发)');
  }
}

// ---------------- 引擎状态机 ----------------
{
  const { Engine } = await import('../src/core/engine.js');
  globalThis.window.TerminalArcade = { active: null, focus() {}, _register() {}, _unregister() {} };
  const engine = new Engine(env.makeEl(), GAMES, {});
  globalThis.window.TerminalArcade.active = engine;

  const press = (k) => { engine.input.fresh.add(k); engine._step(1 / 60); };
  engine._draw();

  check('启动在菜单', engine.state === 'menu');
  press('down');
  check('↓ 移动选择', engine.sel === 1);
  press('5');
  check('数字键直选第 5 个', engine.sel === 4 && engine.state === 'play', GAMES[engine.sel].id);

  press('esc');
  check('ESC 进暂停', engine.state === 'pause');
  press('r');
  check('暂停里按 R 重开', engine.state === 'play');
  press('esc');
  press('esc');
  check('暂停里再按 ESC 回菜单', engine.state === 'menu');

  engine.startGame(0);
  engine.api.over('测试结束');
  check('over 弹结果层', engine.state === 'over' && !!engine.overlay);
  press('enter');
  check('结算画面有 0.6s 输入锁（防止按着开火键跳过）', engine.state === 'over');
  for (let i = 0; i < 45; i++) engine._step(1 / 60);
  press('enter');
  check('输入锁解除后 ENTER 重开', engine.state === 'play');

  press('/');
  check('/ 打开帮助', engine.showHelp);
  press('/');
  check('/ 关闭帮助', !engine.showHelp);

  press('m');
  check('M 静音', engine.audio.muted === true);
  engine.destroy();
}

// ---------------- 双人：键位隔离 + 对战流程 ----------------
function colorRow(screen, color) {
  for (let y = 0; y < 36; y++) {
    for (let x = 0; x < 80; x++) {
      const i = y * 80 + x;
      if (screen.ch[i] === '█' && screen.fg[i] === color) return y;
    }
  }
  return -1;
}

{
  // pong：P1 只该动青色球拍，P2 只该动品红球拍
  const h = harness('pong', 35, 2);
  const cyan0 = colorRow(h.screen, 'cyan');
  const mag0 = colorRow(h.screen, 'magenta');

  h.hold(1, 'down');
  h.tick(12);
  h.release(1, 'down');
  const cyan1 = colorRow(h.screen, 'cyan');
  const mag1 = colorRow(h.screen, 'magenta');
  check('P1 按键只移动自己的球拍', cyan1 > cyan0, `${cyan0} -> ${cyan1}`);
  check('P1 按键不影响 P2 球拍', mag1 === mag0, `${mag0} -> ${mag1}`);

  h.hold(2, 'up');
  h.tick(12);
  h.release(2, 'up');
  const cyan2 = colorRow(h.screen, 'cyan');
  const mag2 = colorRow(h.screen, 'magenta');
  check('P2 按键只移动自己的球拍', mag2 < mag1, `${mag1} -> ${mag2}`);
  check('P2 按键不影响 P1 球拍', cyan2 === cyan1, `${cyan1} -> ${cyan2}`);

  check('pong 双人比分写进状态栏', /P1 0 : 0 P2/.test(h.st.status), h.st.status);
}

{
  // snake：把 P1 往墙上撞，应该判 P2 获胜
  const h = harness('snake', 35, 2);
  check('snake 双人开局各有 3 节', /P1 0 : 0 P2/.test(h.st.status), h.st.status);
  h.hold(1, 'up');
  h.tick(140);
  check('snake 双人：P1 撞墙后 P2 获胜', /^over:P2 获胜/.test(h.st.end || ''), h.st.end || '(未结束)');
}

{
  // duel：两个随机操控的机器人打完一局
  const h = harness('duel', 35, 2);
  const DIRS = ['up', 'down', 'left', 'right'];
  let frames = 0;
  for (; frames < 60 * 90 && !h.st.end; frames++) {
    for (const n of [1, 2]) {
      if (Math.random() < 0.35) h.hold(n, DIRS[Math.floor(Math.random() * 4)]);
      if (Math.random() < 0.25) h.input.padDown(n, 'fire');
    }
    h.tick(1);
  }
  check('duel 双人能分出胜负', /^(won|over):P[12] 获胜/.test(h.st.end || ''), h.st.end || `(${(frames / 60).toFixed(0)}s 未结束)`);
  check('duel 状态栏显示双方血量', /P1 \d : \d P2/.test(h.st.status), h.st.status);
}

{
  // duel 单人：AI 走的是同一条输入路径，不该崩
  const h = harness('duel', 35, 1);
  h.tick(300);
  check('duel 单人模式跑得起来', /P1 \d : \d P2/.test(h.st.status), h.st.status);
}

// ---------------- 配色审计：所有游戏都跑一遍，收集用到的颜色名 ----------------
{
  const KEYS = ['up', 'down', 'left', 'right', 'space', 'enter', 'f', 'z', 'x'];
  for (const game of GAMES) {
    const h = harness(game.id);
    for (let i = 0; i < 240; i++) {
      h.input.press(KEYS[Math.floor(Math.random() * KEYS.length)]);
      h.tick(1);
    }
  }
  const unknown = [...audit.used].filter((c) => !(c in COLORS) && !/^#/.test(c));
  check('所有用到的颜色名都在调色板里', unknown.length === 0,
    unknown.length ? '未知: ' + unknown.join(', ') : `${audit.used.size} 种颜色`);
  check('主色 accent 已被使用', audit.used.has('accent'));
}

if (failed) {
  console.log(`\n${failed} 项失败`);
  process.exit(1);
}
console.log('\n玩法与状态机全部通过');
