# TERMINAL ARCADE

字符终端风格的小游戏框架。纯 canvas + 原生 ES module，**零依赖**。

内置 12 个游戏，其中 4 个支持同屏双人：

| 游戏 | 双人 |
| --- | --- |
| PONG 乒乓 | 左右对打 |
| AIR HOCKEY 冰球 | 左右对打 |
| SNAKE 贪吃蛇 | 互撞对战 |
| DUEL 双人对射 | 坦克互射（单人时右边是 AI） |
| BREAKOUT / TETRIS / 2048 / MINESWEEPER / INVADERS / RUNNER / SOKOBAN / LIGHTS OUT | 单人 |

---

## 跑起来

开发时用 ES module，需要静态服务器（`file://` 下浏览器会拦截模块加载）：

```bash
python -m http.server 8000     # 或 npm run dev
# 打开 http://localhost:8000/
```

想直接双击打开，就打包成单文件：

```bash
npm run build                  # 产出 dist/
open dist/demo.html           # 全内联，离线可跑
```

## 接入（五种）

**0. npm 安装**（已按可发布包装好，包名 `chargrid-arcade`——`terminal-arcade` 已被他人的终端小游戏占用）

```bash
npm i chargrid-arcade
```

```js
import { mount, register, GAMES } from 'chargrid-arcade';
import 'chargrid-arcade/style.css';

const arcade = mount('#arcade', { game: 'hockey' });   // 挂载
arcade.mode.pong = 2;                                  // 需要时直接改人数
```

- ESM only（`type: module`），无 `require()` 入口；打包器（Vite / webpack / Rollup / esbuild）直接吃，Node ≥ 16 里可以 `import` 但 `mount()` 会明确报错（无 DOM）。
- 自带 TypeScript 声明：`types/index.d.ts`，以及 `chargrid-arcade/core/input.js`（`PAD_CODES` `KEY_CODES`，接线远程输入用）和 `chargrid-arcade/games`。
- CDN 直出单文件：`unpkg.com/chargrid-arcade/dist/terminal-arcade.js`（IIFE，配 `dist/terminal-arcade.css`）。
- 完整 API、发布清单、远程双人方案见 [`SDK.md`](./SDK.md)。

**1. 一行标签**

```html
<link rel="stylesheet" href="styles.css">
<div data-arcade data-game="hockey" data-height="520"></div>
<script src="embed.js"></script>
```

`data-game` 指定初始游戏（任意 `id`），`data-height` 限制最大高度，`data-muted` 静音启动。

**2. ES module**

```js
import { mount, register, GAMES } from './src/main.js';

const arcade = mount('#arcade', { game: 'snake' });
arcade.startGame(3);   // 切到第 4 个游戏
arcade.restart();      // 重开当前局
arcade.destroy();      // 卸载，解绑所有监听
```

**3. 单文件包**（`dist/terminal-arcade.js`，一个 IIFE，约 129 KB）

```html
<link rel="stylesheet" href="terminal-arcade.css">
<div data-arcade></div>
<script src="terminal-arcade.js"></script>
```

**4. iframe** —— 需要完全隔离宿主样式时嵌 `index.html`。

多个实例可以同时挂载，键盘跟随最后一次点击的那个画面。

## 机制

```
游戏  ──写入──▶  Screen（80×36 字符网格）
                     │
                     ├─ 同色连续段合并 ──▶ ctx.fillText   （一帧约 100 次绘制）
                     └─ 宽字符单独绘制 ──▶ 保证中文/ASCII 对齐
                          ▲
Engine（固定 1/60s 循环 · 状态机 · 菜单 · 覆盖层 · 最高分 · 上次游玩）
                          ▲
Input（键盘 / 指针 / 触屏滑动归一化）   Audio（WebAudio 蜂鸣器）
```

- **固定步长**：`update(dt)` 的 `dt` 恒为 `1/60`，物理直接按秒写，不同刷新率下手感一致。
- **字符网格**：`screen.put(x, y, '█', 'accent')` 就是全部绘图 API。中文占两格，渲染时单独处理，不会串位。
- **状态机**：`menu → play ↔ pause → over`。`over` 时画面保留最后一帧，结果层浮在上面。切走标签页会自动暂停。
- **配色**：主色是橙（`accent` / `accent2`），界面骨架统一用它；其余色相留给游戏内容（棋子、砖块、外星人），画面不会糊成一片橙。颜色用名字即可，也可以直接给十六进制；`null` 表示默认/透明。

| 名字 | 用途 |
| --- | --- |
| `accent` `accent2` | 主色橙 / 暗橙：标题、边框、状态栏、提示 |
| `default` `white` `dim` `faint` | 暖白正文到几乎不可见的四级 |
| `bg` `bg2` `bg3` | 暖黑背景三档（画布 / 状态栏 / 选中行） |
| `amber` `yellow` `red` `cyan` `blue` `magenta` `violet` `orange` `green` | 游戏内容色 |

改主色只需要动 `src/core/palette.js` 里 `accent` 和 `accent2` 两个值。

## 双人

一台键盘两个人玩，键位完全分开，互不干扰：

| | 移动 | 动作 |
| --- | --- | --- |
| **P1** | `W` `A` `S` `D` | `F` / `空格` / 左 `Shift` |
| **P2** | `↑` `↓` `←` `→` | `Enter` / 右 `Shift` / 小键盘 `0` |

- **在菜单里按 `←→` 切换单人/双人**，标题栏会显示当前是 `1 PLAYER` 还是 `2 PLAYERS`，选择会按游戏记住。
- 触屏也可以双人：**先按下的手指归 P1，第二根归 P2**，两人的手指同时拖各自的球拍。
- 暂停层会同时列出两人的键位，结果层直接写「P1 获胜 / P2 获胜」。

## 操作

| 全局键 | |
| --- | --- |
| `←→` | 菜单里切换单人 / 双人 |
| `ENTER` | 开始 / 重开 |
| `ESC` / `P` | 暂停（暂停中再按返回菜单） |
| `R` | 重开当前局 |
| `M` | 静音 |
| `/` | 帮助 |
| `1`–`9` | 菜单里直选游戏 |
| 方向键 | 同时绑定 `WASD` 和 `hjkl` |

触屏：**滑动** = 方向键，**轻点** = 空格；乒乓和冰球可以直接用手指拖。

## 加一个游戏

```js
import { register } from './src/main.js';

register({
  id: 'dots',              // 唯一 id，也用于最高分存储
  name: 'DOTS',            // 菜单里的英文名
  cn: '点阵',              // 中文名
  desc: '按空格撒点',
  keys: ['空格 撒一个点'],

  create(api) {
    const { screen, input, audio } = api;
    const pts = [];

    return {
      reset() { pts.length = 0; },            // 开局 / 按 R 重开时调用

      update(dt) {                             // dt 恒为 1/60
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

想让它默认出现在菜单里，再把它加进 `src/games/index.js` 的数组即可。`create()` 可以省略 `update` / `render`（静态画面也行），引擎会兜住异常，一个游戏崩了不会带死框架。

## API

| 名字 | 说明 |
| --- | --- |
| `api.screen` | 字符缓冲，见下表 |
| `api.input` | 合并层：`isDown(n)` `pressed(n)` `anyPressed(...n)` `axisX()` `axisY()` `dir()` `pointAt(n)` |
| `api.input.p1` / `.p2` | 玩家层：同样的接口，但只认自己那套键（`up/down/left/right/fire`） |
| `api.players` | 本局人数，`1` 或 `2`；游戏在 `reset()` 里读它 |
| `api.audio` | `beep(freq, dur, type, gain)` / `blip hit bounce score win lose` |
| `api.w` `api.h` | 可用网格尺寸，`80 × 35`（第 36 行是引擎状态栏） |
| `api.setStatus(str)` | 写底部状态栏 |
| `api.over(msg)` / `api.won(msg)` | 结束本局，弹结果层 |
| `api.best` / `api.saveBest(n)` | 最高分（localStorage，按 id 存） |
| `api.restart()` / `api.exit()` | 重开 / 回菜单 |

**Screen**：`put(x,y,ch,fg,bg)` `write` `writeCenter` `writeRight` `fill` `hline` `vline` `box(x,y,w,h,fg,bg,style,title)` `clear(bg)` `width(str)` `text()`

**按键名**：`up down left right enter space esc tab backspace shift`，字母 `a`–`z`，数字 `0`–`9`，以及 `/` `f1`。

## 目录

```
webGame/
├─ index.html          demo 页面
├─ embed.js            一行接入用的加载器
├─ styles.css          终端风样式
├─ types/              手写 TypeScript 声明（index / games / core-input）
├─ SDK.md              接入与 API 文档（含远程双人方案、发布清单）
├─ LICENSE             MIT
├─ dist/               npm run build 产物（单文件，离线可用）
├─ scripts/
│  ├─ build.mjs        极简 ESM → IIFE 打包器
│  ├─ _dom.mjs         测试用伪 DOM
│  ├─ _input.mjs       测试用假输入（含 p1/p2 双层）
│  ├─ smoke.mjs        每个游戏 × 单人/双人 各跑 1200 帧随机输入
│  ├─ levels.mjs       BFS 校验推箱子每关可解
│  ├─ bundle-test.mjs  伪 DOM 里跑一遍构建产物
│  ├─ pkg-test.mjs     校验 npm 包：SSR import / exports 映射 / 类型声明 / files
│  └─ preview.mjs      把字符网格打到终端看排版
└─ src/
   ├─ main.js          注册表 + mount + 自动挂载
   ├─ core/            screen / engine / input（合并层 + p1/p2 两层）/ audio / palette / util
   └─ games/           12 个游戏 + index.js（游戏总目录）
```

## 自检

```bash
npm test                           # 冒烟 + 关卡可解性 + 构建 + 构建产物 + npm 包体检
node scripts/preview.mjs           # 打印菜单
node scripts/preview.mjs tetris    # 打印某个游戏画面（含暂停/结束/帮助覆盖层）
node scripts/preview.mjs tetris --ansi   # 用真彩把配色也打出来
npm run pack:check                 # 看看 npm publish 会传哪些文件
```

发布流程（含 OTP 是什么、GitHub Actions trusted publishing 四步）见 [`RELEASING.md`](./RELEASING.md)。

没有浏览器也能验证：`preview.mjs` 直接在终端里画出 80×36 的字符网格，排版问题一眼就能看出来。

## 说明

- 设计基准是 80×36 字符（约 771×540 px），窄屏会等比缩小，手机建议横屏。
- 最高分与"上次玩的游戏"存在 `localStorage`，隐私模式下会自动跳过。
