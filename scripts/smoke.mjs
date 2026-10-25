// 无浏览器的冒烟测试：跑每个游戏的 reset/update/render，抓运行时错误。
// 用法: node scripts/smoke.mjs
import { Screen } from '../src/core/screen.js';
import GAMES from '../src/games/index.js';
import { makeInput } from './_input.mjs';

const ctxStub = {
  font: '', fillStyle: '', textBaseline: '', textAlign: '',
  measureText: () => ({ width: 9.63 }),
  setTransform() {}, fillRect() {}, fillText() {},
};

const KEYS = ['up', 'down', 'left', 'right', 'space', 'enter', 'esc', 'f', 'z', 'x'];
const randKey = () => KEYS[Math.floor(Math.random() * KEYS.length)];
const randBtn = () => ['up', 'down', 'left', 'right', 'fire'][Math.floor(Math.random() * 5)];

let failures = 0;

for (const game of GAMES) {
  // 支持双人的游戏要跑两条路径：单人和双人各来一遍
  const modes = game.players === 2 ? [1, 2] : [1];
  for (const mode of modes) {
    const screen = new Screen(80, 36);
    screen.layout(ctxStub);
    const input = makeInput();
    const audio = { muted: true, beep() {}, blip() {}, hit() {}, bounce() {}, score() {}, win() {}, lose() {}, resume() {} };
    let ended = null;
    let best = 0;
    const api = {
      game, screen, input, audio, players: mode,
      w: 80, h: 35,
      setStatus() {}, saveBest(n) { best = Math.max(best, n); },
      get best() { return best; },
      over(m) { ended = 'over:' + m; }, won(m) { ended = 'won:' + m; },
      restart() {}, exit() {}, toast() {},
    };

    try {
      const inst = game.create(api);
      inst.reset();
      for (let i = 0; i < 1200; i++) {
        // 合并层随机（单人路径）
        if (Math.random() < 0.5) input.press(randKey());
        // 两名玩家各自随机按键（双人路径）
        if (mode === 2) {
          if (Math.random() < 0.6) input.padDown(1, randBtn());
          if (Math.random() < 0.6) input.padDown(2, randBtn());
          if (Math.random() < 0.3) { input.padUp(1, randBtn()); input.padUp(2, randBtn()); }
        }
        input.pointer.x = Math.random() * 80;
        input.pointer.y = Math.random() * 35;
        if (!ended) inst.update(1 / 60);
        screen.clear('bg');
        inst.render(screen);
        screen.render(ctxStub);
        input.endFrame();
        if (i % 3 === 0) ended = null;
        if (i % 40 === 0) { input.codesDown.clear(); input.held.clear(); }
      }
      console.log(`ok   ${(game.id + (mode === 2 ? ' (2P)' : '')).padEnd(14)} 网格检查通过 · 结束回调: ${ended || '未触发'}`);
    } catch (err) {
      failures++;
      console.log(`FAIL ${game.id}${mode === 2 ? ' (2P)' : ''}: ${err.stack}`);
    }
  }
}

if (failures) {
  console.log('\n' + failures + ' 个用例有错误');
  process.exit(1);
}
console.log('\n全部游戏（含双人模式）渲染/更新无异常');
