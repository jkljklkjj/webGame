// 校验单文件构建：在 Node 里伪造 DOM 跑一遍，确认能挂载、能开局、能渲染。
// 用法: node scripts/bundle-test.mjs（需先 node scripts/build.mjs）
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDom } from './_dom.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(resolve(ROOT, 'dist/terminal-arcade.js'), 'utf8');

let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed++;
};

// 1) 转换是否彻底
check('没有残留 import 语句', !/^\s*import\s.+\sfrom\s/m.test(bundle));
check('没有残留 export 语句', !/^\s*export\s/m.test(bundle));

// 2) 伪 DOM 里执行
const env = installDom();
const drawCalls = env.draw;

vm.runInThisContext(bundle, { filename: 'terminal-arcade.js' });

const TA = globalThis.window.TerminalArcade;
check('window.TerminalArcade 已导出', !!TA);
check('游戏数量 = 12', TA && TA.games.length === 12, TA ? TA.games.map((g) => g.id).join(',') : '');
check('可双人的游戏至少 4 个', TA && TA.games.filter((g) => g.players === 2).length >= 4,
  TA ? TA.games.filter((g) => g.players === 2).map((g) => g.id).join(',') : '');

if (TA) {
  const el = env.makeEl();
  const engine = TA.mount(el, { game: 'tetris' });
  check('mount 能开局', engine.state === 'play' && TA.games[engine.sel].id === 'tetris');
  engine._step(1 / 60);
  engine._draw();
  check('渲染确实画了东西', drawCalls.fillText > 100, `fillText=${drawCalls.fillText} fillRect=${drawCalls.fillRect}`);
  engine.startGame(TA.games.length - 1);
  check('切换到最后一个游戏', engine.state === 'play' && engine.sel === TA.games.length - 1);
  engine.destroy();
  check('destroy 不抛异常', true);
}

// 3) demo.html 内联版能自洽（没有把模块路径留下来）
const html = readFileSync(resolve(ROOT, 'dist/demo.html'), 'utf8');
check('demo.html 内联了脚本', html.includes('__terminalArcadeLoaded'));
check('demo.html 内联了样式', html.includes('.ta-canvas'));
check('demo.html 没有外链 src/main.js', !html.includes('src="./src/main.js"'));

if (failed) {
  console.log(`\n${failed} 项失败`);
  process.exit(1);
}
console.log('\n单文件构建可用');
