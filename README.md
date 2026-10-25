# TERMINAL ARCADE

> 字符终端风格的小游戏框架。纯 canvas 字符网格，零依赖，一个 `<div>` 接进任意网页。

[![npm version](https://img.shields.io/npm/v/chargrid-arcade)](https://www.npmjs.com/package/chargrid-arcade)
[![license](https://img.shields.io/npm/l/chargrid-arcade)](https://github.com/jkljklkjj/webGame/blob/main/LICENSE)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://github.com/jkljklkjj/webGame/blob/main/package.json)
[![ci](https://github.com/jkljklkjj/webGame/actions/workflows/ci.yml/badge.svg)](https://github.com/jkljklkjj/webGame/actions/workflows/ci.yml)

12 个内置游戏，4 个支持同屏双人。80×36 字符网格，固定 1/60 步长，纯 ES module，不引入任何运行时依赖。

> 包名是 `chargrid-arcade`——`terminal-arcade` 在 npm 上已被另一个终端 TUI 项目占用。项目本身仍叫 TERMINAL ARCADE。

---

## 特点

- **零依赖、零构建**：原生 ES module + canvas，没有框架、没有 CSS 框架、没有打包器要求。
- **字符网格渲染**：`screen.put(x, y, '█', 'accent')` 就是全部绘图 API。中文占两格，渲染时单独处理，不会串位。一帧约 100 次 `fillText`。
- **固定步长**：`update(dt)` 的 `dt` 恒为 `1/60`，物理直接按秒写，60Hz 和 144Hz 屏手感一致。
- **自带状态机**：`menu → play ↔ pause → over`，菜单、暂停层、结果层、最高分、上次游玩、静音全部内建。
- **同屏双人**：一套键盘两套键位，或两根手指各拖一个球拍。
- **崩了不带走框架**：`create` / `update` / `render` 都有 try/catch，一个游戏出问题只影响它自己。
- **能在终端里预览**：`node scripts/preview.mjs tetris` 直接把 80×36 网格打到终端，不装浏览器也能查排版。

## 安装

```bash
npm i chargrid-arcade
```

```js
import { mount, register, GAMES } from 'chargrid-arcade';
import 'chargrid-arcade/style.css';

const arcade = mount('#arcade', { game: 'hockey' });
arcade.startGame(3);   // 按索引切换
arcade.restart();      // 重开当前局
arcade.destroy();      // 卸载，解绑所有监听
```

不用打包器就直接引 IIFE 单文件（约 129 KB，含全部游戏）：

```html
<link rel="stylesheet" href="https://unpkg.com/chargrid-arcade/dist/terminal-arcade.css">
<div data-arcade data-game="hockey" data-height="520"></div>
<script src="https://unpkg.com/chargrid-arcade/dist/terminal-arcade.js"></script>
```

`data-game` 指定初始游戏，`data-height` 限制最大高度（宽度按 80:36 等比推出，画面不会拉变形），`data-muted` 静音启动。多个实例可以同页共存，键盘跟随最后点击的那个画面。

需要和宿主样式彻底隔离时，用 iframe 嵌 `index.html`。

## 内置游戏

| # | 游戏 | 名称 | 人数 | 玩法 |
| --- | --- | --- | --- | --- |
| 1 | `pong` | PONG 乒乓 | 2P | 先得 7 分者胜 |
| 2 | `hockey` | AIR HOCKEY 冰球 | 2P | 把冰球撞进对方球门 |
| 3 | `snake` | SNAKE 贪吃蛇 | 2P | 吃 `@` 变长，双人模式互撞 |
| 4 | `breakout` | BREAKOUT 打砖块 | 1P | 清空所有砖块，别让球落地 |
| 5 | `tetris` | TETRIS 俄罗斯方块 | 1P | 堆满一行即消除，越堆越快 |
| 6 | `2048` | 2048 数字合并 | 1P | 相同数字合并，目标 2048 |
| 7 | `mines` | MINESWEEPER 扫雷 | 1P | 清出所有安全格，别踩雷 |
| 8 | `invaders` | INVADERS 太空侵略者 | 1P | 打光外星人，别被压到底线 |
| 9 | `runner` | RUNNER 奔跑者 | 1P | 一个键的小恐龙，越跑越快 |
| 10 | `sokoban` | SOKOBAN 推箱子 | 1P | 把箱子推上目标点，`U` 撤销 |
| 11 | `lights` | LIGHTS OUT 关灯 | 1P | 点一格翻转它和四邻，全灭即胜 |
| 12 | `duel` | DUEL 双人对射 | 2P | 两台坦克互射，单人时右边是 AI |

## 操作

| 全局键 | |
| --- | --- |
| `←` `→` | 菜单里切换单人 / 双人 |
| `↑` `↓` | 选择游戏 |
| `ENTER` | 开始 / 重开 |
| `ESC` / `P` | 暂停（暂停中再按返回菜单） |
| `R` | 重开当前局 |
| `M` | 静音 |
| `/` | 帮助 |
| `1`–`9` | 菜单里直选游戏 |

移动键同时绑定 `WASD`、方向键和 `hjkl`。触屏上**滑动**=方向键，**轻点**=空格；乒乓和冰球可以直接用手指拖拍子。

## 双人：同屏可以，远程不行

两个人共用一台设备时，键位完全不重叠：

| | 移动 | 动作 |
| --- | --- | --- |
| **P1** | `W` `A` `S` `D` | `F` / `空格` / 左 `Shift` |
| **P2** | `↑` `↓` `←` `→` | `Enter` / 右 `Shift` / 小键盘 `0` |

- 菜单里按 `←→` 切换人数，标题栏显示 `1 PLAYER` / `2 PLAYERS`，选择按游戏分别记住。
- 触屏双人：**先落下的手指归 P1，第二根归 P2**。
- 暂停层同时列出两套键位，结果层直接写「P1 获胜 / P2 获胜」。

**远程联机没有实现，而且是结构性缺失**：仓库里没有任何网络代码，`Input` 直接挂在 `window` 的键盘事件和 canvas 指针事件上，两个玩家共享同一个 `Input` 和同一个 1/60 循环；另外 6 个游戏用了 `Math.random()`，没有种子化 RNG 就没有 lockstep 的确定性。

要让两个人各自在各自机器上玩，需要自己补一层。[`SDK.md`](https://github.com/jkljklkjj/webGame/blob/main/SDK.md) 第 9、10 节给了两条路：**输入桥**（host 跑游戏，远端只当 P2 遥控器，约 40 行）和**帧转发**（host 推字符网格差异，双方各自渲染，约 100 行）。

## 写一个游戏

```js
import { register } from 'chargrid-arcade';

register({
  id: 'dots',              // 唯一 id，也是最高分/双人模式的存储键
  name: 'DOTS',            // 菜单英文名
  cn: '点阵',              // 中文名
  desc: '按空格撒点',
  players: 2,              // 省略 = 单人；写 2 才能在菜单里切双人
  keys: ['空格 撒一个点'],

  create(api) {
    const { screen, input, audio } = api;
    const pts = [];

    return {
      reset() { pts.length = 0; },          // 开局、按 R 都会调用

      update(dt) {                           // dt 恒为 1/60
        if (input.pressed('space')) {
          pts.push({ x: api.w >> 1, y: api.h >> 1 });
          audio.blip();
          api.setStatus(`点 ${pts.length}`);
        }
      },

      render(s) {
        s.clear('bg');
        s.box(0, 0, api.w, api.h, 'accent2');
        pts.forEach((p, i) => s.put(p.x + i, p.y + i, '*', 'accent'));
      },
    };
  },
});
```

`reset` / `update` / `render` 都可以省略。想让游戏进默认菜单，把它加进 `src/games/index.js` 的数组。

## API 速查

| 名字 | 说明 |
| --- | --- |
| `api.screen` | 字符缓冲：`put` `write` `writeCenter` `writeRight` `fill` `hline` `vline` `box` `clear` `width` `text` |
| `api.input` | 合并层：`isDown` `pressed` `anyPressed` `axisX` `axisY` `dir` `pointAt` |
| `api.input.p1` / `.p2` | 玩家层，同样的接口但只认自己那套键（`up/down/left/right/fire`） |
| `api.players` | 本局人数 `1` / `2`，在 `reset()` 里读 |
| `api.audio` | `beep(freq, dur, type, gain)` / `blip` `hit` `bounce` `score` `win` `lose` |
| `api.w` / `api.h` | 可用网格 `80 × 35`（第 36 行是引擎状态栏） |
| `api.setStatus(str)` | 写底部状态栏 |
| `api.over(msg)` / `api.won(msg)` | 结束本局，弹结果层 |
| `api.best` / `api.saveBest(n)` | 最高分（localStorage，按 `id` 存） |
| `api.restart()` / `api.exit()` | 重开 / 回菜单 |

完整签名、颜色表、输入层细节、远程联机方案、发布流程：**[SDK.md](https://github.com/jkljklkjj/webGame/blob/main/SDK.md)**

类型声明随包发布，`import type { Game, GameApi, Screen } from 'chargrid-arcade'` 可直接用；要接远程输入桥可以从 `chargrid-arcade/core/input.js` 拿 `PAD_CODES` / `KEY_CODES`。

## 机制

```
游戏 ──写入──▶ Screen（80×36 字符网格）
                   ├─ 同色连续段合并 ──▶ ctx.fillText（一帧约 100 次绘制）
                   └─ 宽字符单独绘制 ──▶ 保证中文/ASCII 对齐
                        ▲
Engine（固定 1/60 循环 · 状态机 · 菜单 · 覆盖层 · 最高分 · 上次游玩）
                        ▲
Input（键盘 / 指针 / 触屏归一化）   Audio（WebAudio 蜂鸣器）
```

- **状态机**：`menu → play ↔ pause → over`。`over` 时画面保留最后一帧，结果层浮在上面；切走标签页自动暂停；结算画面有 0.6 秒输入锁，防止输的那方按着开火键直接跳过。
- **配色**：骨架统一用橙色 `accent` / `accent2`，其余色相留给游戏内容。改主题只需动 `src/core/palette.js` 里那两个值。`fg`/`bg` 接受颜色名或任意 CSS 色值，`null` 表示默认/透明。
- **布局**：基准 80×36（约 771×540 px），窄屏等比缩小，`devicePixelRatio` 上限 2。
- **持久化**：`terminal-arcade:best`、`:muted`、`:mode`、`:last` 四个 localStorage 键，隐私模式下自动跳过、不报错。

## 开发与自检

```bash
npm test                        # 冒烟 + 关卡可解性 + 构建 + 构建产物 + npm 包体检
node scripts/preview.mjs           # 在终端打印菜单
node scripts/preview.mjs tetris    # 打印某个游戏（含暂停/结束/帮助覆盖层）
node scripts/preview.mjs tetris --ansi   # 带真彩色
npm run build                      # 重新生成 dist/
npm run pack:check                 # 看 npm publish 会发哪些文件
```

开发时用静态服务器（`npm run dev`，或 `python -m http.server 8000`）——`file://` 下浏览器会拦截 module 加载。想直接双击打开就用 `dist/demo.html`，全部内联、离线可跑。

`scripts/` 里没有浏览器也能跑的三件套：`smoke.mjs`（每个游戏 × 单/双人各 1200 帧随机输入）、`levels.mjs`（BFS 验证推箱子每关可解）、`bundle-test.mjs`（伪 DOM 里跑一遍构建产物）。

## 目录

```
├─ index.html          demo 页面
├─ embed.js            一行接入用的加载器
├─ styles.css          终端风样式
├─ types/              手写 TypeScript 声明
├─ SDK.md              接入与 API 文档
├─ RELEASING.md        发版手册（OTP / trusted publishing）
├─ dist/               构建产物（单文件 IIFE，离线可用）
├─ scripts/            打包器 + 自检工具
└─ src/
   ├─ main.js          注册表 + mount + 自动挂载
   ├─ core/            screen / engine / input / audio / palette / util
   └─ games/           12 个游戏 + index.js
```

## 浏览器支持

任何支持 ES module 与 canvas 的现代浏览器（Chrome / Edge / Firefox / Safari 近三年版本），不支持 IE。Node 里可以 `import`（SSR 安全），但 `mount()` 会抛「需要浏览器环境」。

需要 WebAudio 才会出声；首次用户手势之前浏览器会静音，属正常现象。

## 发布

`chargrid-arcade` 走 GitHub Actions + trusted publishing（OIDC），全程不需要长驻 token。首版必须手动发一次（npm 目前不支持用 OIDC 发第一个版本），细节见 [RELEASING.md](https://github.com/jkljklkjj/webGame/blob/main/RELEASING.md)。

## License

[MIT](https://github.com/jkljklkjj/webGame/blob/main/LICENSE)
