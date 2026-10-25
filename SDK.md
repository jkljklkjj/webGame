# TERMINAL ARCADE · SDK 文档

字符终端风格的小游戏框架。纯 canvas 字符网格 + 原生 ES module，零依赖、零构建（可选打包）。

版本：`1.2.0`　npm 包名：`chargrid-arcade`（`terminal-arcade` 已被他人的终端小游戏占用）
入口：`src/main.js`（ESM）、`embed.js`（经典脚本）、`dist/terminal-arcade.js`（单文件 IIFE）
类型：`types/index.d.ts`（手写，随包发布）

---

## 0. 能力边界（先看这个）

| 项目 | 现状 |
| --- | --- |
| 渲染 | 80×36 字符网格，canvas `fillText` 批量绘制，中文占两格不会串位 |
| 循环 | 固定步长 1/60 s 逻辑 + 每帧一次绘制 |
| 输入 | 键盘（合并层 + P1/P2 玩家层）+ 指针/触屏（多指分槽） |
| 声音 | WebAudio 蜂鸣器，无音频文件 |
| 存档 | `localStorage`：最高分、上次游戏、静音、单人/双人选择 |
| 网络 | **无**。没有 WebSocket、没有 WebRTC、没有服务端 |
| 双人 | 同屏同键盘、同屏双指触摸。**不支持远程联机**（见第 8 节） |

框架只做「一台设备、一份 canvas、一个 1/60 循环」。所有联网能力都需要自己接，第 9、10 节给出两条可行路线。

---

## 1. 五种接入方式

### 1.0 npm 包

```bash
npm i chargrid-arcade
```

```js
import { mount, register, GAMES } from 'chargrid-arcade';
import 'chargrid-arcade/style.css';

const arcade = mount('#arcade', { game: 'hockey' });
```

`package.json` 里的 `exports` 映射（也是能用哪些子路径的完整清单）：

| 子路径 | 指向 | 用途 |
| --- | --- | --- |
| `chargrid-arcade` | `src/main.js` | `mount` `register` `GAMES` + 默认导出的全局对象 |
| `chargrid-arcade/style.css` | `styles.css` | 终端风样式 |
| `chargrid-arcade/games` | `src/games/index.js` | 只要游戏注册表（不含引擎入口） |
| `chargrid-arcade/core/input.js` | `src/core/input.js` | `PAD_CODES` `KEY_CODES` `Input` `Pad`，接远程输入用 |
| `chargrid-arcade/core/*` | `src/core/*` | `engine` / `screen` / `palette` 等 |
| `chargrid-arcade/dist/terminal-arcade.js` | IIFE 包 | `<script>` 或 CDN |

约定：

- **ESM only**（`type: module`）。没有 CJS 入口，`require('chargrid-arcade')` 在 Node 22 之前会失败，请用 `import`。
- **SSR 安全**：无 `window` 环境下 `import` 不抛错，`mount()` 会抛 `[arcade] mount() 需要浏览器环境`。
- `sideEffects` 标了 `./src/main.js` 和 `*.css`——前者会自动挂载 `[data-arcade]`，别让摇树把它删了。
- 类型：根入口、`./games`、`./core/input.js` 三处有 `.d.ts`；`./core/*` 的其余模块无类型。

### 1.1 一行标签（`embed.js`）

```html
<link rel="stylesheet" href="styles.css">
<div data-arcade data-game="hockey" data-height="520"></div>
<script src="embed.js"></script>
```

`embed.js` 会按自身 URL 推出 `src/main.js` 的位置，再以 `type="module"` 注入，然后扫描所有 `[data-arcade]` 自动挂载。所以整个目录可以整体拷到任意静态站点下的任意子路径，不用改配置。

| 属性 | 作用 |
| --- | --- |
| `data-arcade` | 标记容器（必填，值随意） |
| `data-game="hockey"` | 初始游戏 id；省略则读取上次玩过的游戏 |
| `data-height="520"` | 最大高度（px），宽度按 80:36 等比推出，画面永不拉变形 |
| `data-muted` | 存在即静音启动（覆盖 localStorage 里的静音设置） |

> `embed.js` 依赖同目录下的 `src/`。要单文件部署，走 1.3。

### 1.2 ES module（推荐）

```html
<link rel="stylesheet" href="styles.css">
<div id="arcade"></div>
<script type="module">
  import { mount, register, GAMES } from './src/main.js';

  const arcade = mount('#arcade', { game: 'snake' });
  arcade.startGame(3);   // 切到索引 3 的游戏（不看 id 的话用 findIndex）
  arcade.restart();      // 重开当前局
  arcade.destroy();      // 卸载并解绑所有监听
</script>
```

`mount(host, opts)`：

- `host`：CSS 选择器字符串或 DOM 节点，找不到会抛错
- `opts.game`：初始游戏 `id`
- `opts.height`：最大高度（px）
- `opts.muted`：`true` / `false` / 省略（省略时读 localStorage）
- 返回 `Engine` 实例（第 2 节）

注意：`file://` 打开时浏览器会拦截模块加载，必须走静态服务器（`npm run dev` 或 `python -m http.server 8000`）。

### 1.3 单文件包（离线/单文件部署）

```bash
npm run build     # 产出 dist/terminal-arcade.js + dist/terminal-arcade.css
```

```html
<link rel="stylesheet" href="terminal-arcade.css">
<div data-arcade></div>
<script src="terminal-arcade.js"></script>
```

IIFE 内部已经包含 `src/main.js` 的自动挂载逻辑，用法与 1.1 完全一致，但不再需要 `src/` 目录。`dist/demo.html` 是全部内联的样例。

### 1.4 iframe（样式完全隔离）

宿主页面样式不可控时（`* { font-family: ... }`、全局 reset、`line-height` 异常），把 `index.html` 塞进 iframe：

```html
<iframe src="/arcade/index.html" style="width:100%;height:560px;border:0"></iframe>
```

代价是键盘焦点、音量和布局都要由 iframe 自己管理，跨文档通信只能靠 `postMessage`。

### 1.5 多个实例

同一个页面可以挂多个，互不干扰。键盘只跟随「最后被点击/按下的那个实例」——点击时框架会把该实例设为 `TerminalArcade.active`，非活动实例的键盘事件直接丢弃（`Window blur` 时全部清空）。

```js
mount('#a', { game: 'pong' });
mount('#b', { game: 'tetris' });
TerminalArcade.active;      // 当前吃键盘的实例
TerminalArcade.focus(b);    // 手动切焦点
```

---

## 2. 实例 API（`Engine`）

`mount()` 的返回值。字段带 `_` 前缀的是内部实现，别依赖。

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `startGame(index)` | `void` | 按数组索引启动游戏；`index` 越界直接返回 |
| `restart()` | `void` | 重开当前游戏（等价于按 `R`） |
| `start()` / `stop()` | `Engine` / `void` | 暂停/恢复 rAF 循环，不销毁 |
| `destroy()` | `void` | 停止循环、解绑 window/document 监听、移除 canvas、从注册表注销 |
| `modeOf(game)` | `1 \| 2` | 该游戏当前选定的人数（只有 `players: 2` 的游戏会返回 2） |
| `state` | `'menu' \| 'play' \| 'pause' \| 'over'` | 当前状态机状态，只读 |
| `sel` | `number` | 菜单选中索引 |
| `cur` | `object \| null` | 当前游戏实例（`create()` 的返回值） |
| `api` | `object \| null` | 当前游戏收到的 api 对象（第 5 节） |
| `games` | `Game[]` | 注册表数组 |
| `screen` | `Screen` | 字符缓冲（第 5.1 节） |
| `input` | `Input` | 输入层（第 5.2 节） |
| `audio` | `Beeps` | 蜂鸣器 |
| `canvas` / `ctx` | `HTMLCanvasElement` / `CanvasRenderingContext2D` | 渲染目标 |
| `cols` / `rows` | `80` / `36` | 网格尺寸 |
| `best` | `{[id]: number}` | 最高分表 |
| `mode` | `{[id]: 1 \| 2}` | 单人/双人选择表，可直接改（见 8.2） |

**程序化控制示例**（做外部 UI、遥控器、演示循环）：

```js
arcade.state;                    // 'menu'
arcade.sel = 4;                  // 选中 TETRIS
arcade.startGame(arcade.sel);    // 开始
arcade.state;                    // 'play'
arcade.audio.muted = true;
```

---

## 3. 全局对象 `TerminalArcade`

`src/main.js` 与 IIFE 包都会把同一份对象挂到 `window.TerminalArcade`。经典脚本（非 module）只能用这个入口。

| 成员 | 说明 |
| --- | --- |
| `TerminalArcade.register(game)` | 注册/替换游戏（按 `id` 去重），返回自身，可链式 |
| `TerminalArcade.mount(host, opts)` | 同 `mount()` |
| `TerminalArcade.games` | 游戏注册表数组（与 `GAMES` 是同一引用） |
| `TerminalArcade.active` | 当前吃键盘的实例 |
| `TerminalArcade.instances` | 所有已挂载实例的数组副本 |
| `TerminalArcade.focus(engine)` | 手动指定键盘归属 |
| `TerminalArcade.version` | `'1.2.0'` |

```html
<div data-arcade></div>
<script src="terminal-arcade.js"></script>
<script>
  var a = TerminalArcade.instances[0];
  TerminalArcade.register({ /* ... */ });   // 注意：注册需在 mount 之前才进菜单
</script>
```

`register()` 在挂载之后调用也不会崩，但菜单列表已经渲染过，`games` 数组变了之后菜单会自然刷新（菜单每帧都从 `games` 读）。

---

## 4. 写一个游戏

游戏是一个普通对象，`create(api)` 返回带 `reset` / `update` / `render` 的对象。

```js
import { register } from './src/main.js';

register({
  id: 'dots',              // 唯一，同时是最高分/双人模式的存储键
  name: 'DOTS',            // 菜单英文名（建议 ≤12 字符宽）
  cn: '点阵',              // 菜单中文名
  desc: '按空格撒点',       // 菜单右侧一句话说明
  players: 2,              // 省略 = 1；写 2 才允许在菜单里按 ←→ 切双人
  keys: ['空格 撒一个点'],  // 菜单底部/暂停层的操作提示数组

  create(api) {
    const { screen, input, audio } = api;
    const pts = [];

    return {
      reset() { pts.length = 0; },     // 开局、按 R、重开都会调用

      update(dt) {                     // dt 恒为 1/60
        if (input.pressed('space')) {
          pts.push({ x: api.w >> 1, y: api.h >> 1 });
          audio.blip();
          api.setStatus(`点 ${pts.length}`);
        }
      },

      render(s) {                      // s 就是 api.screen
        s.clear('bg');
        s.box(0, 0, api.w, api.h, 'accent2');
        pts.forEach((p, i) => s.put(p.x + i, p.y + i, '*', 'accent'));
      },
    };
  },
});
```

契约：

- `reset` / `update` / `render` **都可以省略**（静态画面也合法，`update` 缺省时什么都不做）。
- `update(dt)` 的 `dt` 永远是 `1/60`，物理直接按秒写（`x += v * dt`），不要读 `performance.now()`。
- `render(s)` 每帧调用一次；不要在里面做布局计算。
- `create()` / `update()` / `render()` 抛异常会被引擎捕获并 `console.error`，**一个游戏崩了不会带死框架**，`create` 失败会退回菜单，`render` 失败会画出黑屏但不中断循环。
- 想进默认菜单，把 import 加进 `src/games/index.js` 的数组；只在运行时注册就只在本页生效。

---

## 5. API 参考

### 5.1 `api.screen`（Screen）

坐标是字符格，左上角 `(0, 0)`；`api.h` 是 `35`，第 36 行（`y = 35`）是引擎状态栏，别往那儿画。越界写入自动忽略。

| 方法 | 说明 |
| --- | --- |
| `put(x, y, ch, fg, bg)` | 写一个字符。覆盖宽字符的任意一半会把另一半擦掉 |
| `write(x, y, str, fg, bg)` | 写字符串，中文自动占两格 |
| `writeCenter(y, str, fg, bg)` | 水平居中 |
| `writeRight(xRight, y, str, fg, bg)` | 右对齐到第 `xRight` 列（含） |
| `fill(x, y, w, h, ch, fg, bg)` | 矩形填充 |
| `hline(x, y, w, ch, fg, bg)` | 横线 |
| `vline(x, y, h, ch, fg, bg)` | 竖线 |
| `box(x, y, w, h, fg, bg, style, title)` | 边框盒。`style`：`'single'` `'double'` `'round'` `'ascii'`；`title` 画在顶边 |
| `clear(bg)` | 清屏并铺底色 |
| `width(str)` / `text()` | 字符串网格宽度 / 当前整屏文本（调试、快照用） |

`fg` / `bg` 传 `null` 表示默认（`bg = null` 时保留原底色）。

### 5.2 `api.input`（Input）

两层语义：

**合并层**——`WASD`、方向键、`hjkl` 全映射到同一批名字，单人游戏用它，谁按都算。

| 方法 | 说明 |
| --- | --- |
| `isDown(name)` | 是否按住 |
| `pressed(name)` | 本帧是否刚按下（每步结束自动清空） |
| `anyPressed(...names)` | 任意一个刚按下 |
| `axisX()` / `axisY()` | `-1 / 0 / 1` |
| `dir()` | 本帧新方向 `'up' \| 'down' \| 'left' \| 'right' \| null` |
| `pointAt(n)` | 第 n 位可用的指针 `{x, y}`，没有则 `null`（0 号槽在无触摸时回退鼠标） |
| `slot(n)` | 第 n 个原始指针槽 |
| `pointer` | `{x, y, down, active, pressed}` 合并视图 |

**玩家层**——`input.p1` / `input.p2`，接口同上，但只认自己那套键码。

| | 移动 | 动作 `fire` |
| --- | --- | --- |
| P1 | `KeyW` `KeyA` `KeyS` `KeyD` | `KeyF` / `Space` / `ShiftLeft` |
| P2 | 方向键 | `Enter` / 小键盘 `Enter` / 小键盘 `0` / `ShiftRight` |

双人游戏的标准写法：

```js
const twoP = api.players === 2;          // 只有 reset() 里能读到准确的
const pad1 = twoP ? input.p1 : input;    // 单人时退化成合并层，谁按都算
const pad2 = input.p2;
```

- `PAD_CODES`、`KEY_CODES` 从 `src/core/input.js` 导出，想改键位或做输入桥直接 import。
- 引擎全局消费的键：`esc` `p` `r` `m` `/` `enter` `space` `↑↓←→`。游戏里再用这些名字会和框架按键冲突（`r` 重开、`m` 静音会被先截走）。
- `ArrowUp/Down/Left/Right`、`Space`、`Tab` 的默认行为被 `preventDefault()` 拦掉，页面不会滚动。
- `window.blur` 时所有按键状态清空，切窗口回来不会「幽灵按住」。

### 5.3 `api.audio`（Beeps）

| 方法 | 说明 |
| --- | --- |
| `beep(freq, dur, type, gain)` | 默认 `440 / 0.06 / 'square' / 0.035` |
| `blip()` `hit()` `bounce()` `score()` `win()` `lose()` | 预设音效 |
| `muted` | 读写布尔值 |
| `resume()` | 首次用户手势后恢复 AudioContext（框架已在 pointerdown 里调用） |

浏览器要求首次用户交互后才能出声，所以启动时的音效可能被静音，属于正常现象。

### 5.4 其余 api 字段

| 名字 | 说明 |
| --- | --- |
| `api.w` / `api.h` | 可用网格 `80 × 35` |
| `api.cols` | `80` |
| `api.players` | 本局人数，`1` 或 `2`（`startGame` 时按 `modeOf()` 定下，`reset` 里读） |
| `api.game` | 游戏自身的 manifest 对象 |
| `api.setStatus(str)` / `api.status` | 底部状态栏左半边文字 |
| `api.best` / `api.saveBest(n)` | 最高分（按 `id` 存 localStorage），`saveBest` 返回是否刷新了记录 |
| `api.over(msg)` | 结束本局，弹 `GAME OVER` 层（延迟 0.6 s 才接受按键） |
| `api.won(msg)` | 结束本局，弹 `CLEAR` 层（同上） |
| `api.restart()` / `api.exit()` | 重开 / 回菜单 |
| `api.toast(text)` | 清掉覆盖层、只更新状态栏 |
| `api.colors` | 命名色常量对象（`bg fg accent accent2 amber red cyan magenta yellow dim`） |

### 5.5 颜色

`src/core/palette.js` 里定义，`fg` / `bg` 传名字或任何 CSS 色值，`null` 表示默认/透明。

| 名字 | 用途 |
| --- | --- |
| `accent` `accent2` | 主色橙 / 暗橙：标题、边框、状态栏、提示 |
| `default` `white` `dim` `faint` | 暖白正文到几乎不可见的四级 |
| `bg` `bg2` `bg3` | 暖黑背景三档（画布 / 状态栏 / 选中行） |
| `amber` `yellow` `red` `cyan` `blue` `magenta` `violet` `orange` `green` | 游戏内容色 |

改主题只改 `palette.js` 的 `accent` 与 `accent2` 两个值；界面骨架统一用它，其余色相留给游戏内容。

---

## 6. 引擎行为契约

| 项 | 行为 |
| --- | --- |
| 步长 | 逻辑固定 `1/60`；`requestAnimationFrame` 累加器最多补 6 步，单帧 `dt` 上限 0.25 s（切标签页回来不会瞬移） |
| 状态机 | `menu → play ↔ pause → over`；`over` 时保留最后一帧，结果层浮在上面 |
| 自动暂停 | `document.hidden` 时若在 `play` 直接转 `pause` |
| 输入清理 | 每个逻辑步结束清空 `pressed` 集合；`window.blur` 清空全部 |
| 异常隔离 | `create` / `update` / `render` 全部 try/catch |
| 布局 | canvas 宽度 100%，`aspect-ratio: 80/36`，`max-width` 由 `height` 推出；`devicePixelRatio` 上限 2 |
| 持久化 | `terminal-arcade:best`（最高分表）、`:muted`、`:mode`（每人数的选择）、`:last`（上次游戏）。隐私模式下自动跳过，不抛错 |
| 多实例 | 键盘归属唯一（`active`），点击任一实例即切过去 |

---

## 7. 自检工具

```bash
npm test                       # 冒烟 + 关卡可解性 + 构建 + 构建产物回归
node scripts/preview.mjs          # 在终端里画出菜单（80×36 字符网格）
node scripts/preview.mjs tetris   # 画某个游戏（含暂停/结束/帮助覆盖层）
node scripts/preview.mjs tetris --ansi   # 带真彩色
```

`smoke.mjs` 对每个游戏 × 单人/双人各跑 1200 帧随机输入，`levels.mjs` 用 BFS 验证推箱子每关可解，`bundle-test.mjs` 在伪 DOM 里跑一遍构建产物。没有浏览器也能验证排版。

---

## 8. 双人：本地可以，远程不行

### 8.1 现在支持什么

- **同屏同键盘**：P1 左手区（WASD + F/空格/左Shift），P2 右手区（方向键 + Enter/右Shift/小键盘0），键码完全不重叠。
- **同屏双指触摸**：先落下的手指归 P1，第二根归 P2，两人各拖自己的球拍（乒乓/冰球）。
- 菜单里 `←→` 切换单人/双人，标题栏显示 `1 PLAYER` / `2 PLAYERS`，按游戏分别记住。
- 暂停层同时列出两套键位；结果层直接写 `P1 获胜 / P2 获胜`。

### 8.2 程序化强制双人

`mode` 表是 `engine` 上的普通对象，`startGame` 时由 `modeOf()` 读出并写进 `api.players`：

```js
const arcade = mount('#arcade', { game: 'pong' });
arcade.mode.pong = 2;                        // 强制双人
arcade.startGame(arcade.games.findIndex(g => g.id === 'pong'));
arcade.api.players;                          // 2
```

### 8.3 为什么不支持远程

远程联机在这个代码库里**没有实现**，而且是结构性的缺失，不是开关没开：

1. **没有传输层**。全仓没有 WebSocket / WebRTC / fetch 调用。`net` 层不存在，`Engine` 也不向外暴露任何输入事件流。
2. **输入是设备级的**。`Input` 直接挂在 `window` 的 `keydown/keyup` 和 canvas 的 pointer 事件上，两个玩家共享同一个 `Input` 实例、同一个 `1/60` 循环，物理和渲染都在同一台机器上跑。P2 的「按键」就是那台机器上的方向键。
3. **两边的世界会分叉**。即便把远端输入转发过来，两个浏览器各自跑一份逻辑也不一定一致：`pong` `breakout` `invaders` `runner` `duel` `2048` 里都用了 `Math.random()`（发球角度、掉落物、敌人选路等）。没有种子化 RNG，就没有 lockstep 的确定性。

所以要远程玩，得自己补一层。下面两条路线按工作量从低到高。

---

## 9. 附录 A：远程输入桥（最小可用，约 40 行）

思路：**主机（host）跑完整游戏，远端（guest）只当 P2 的遥控器**。guest 发方向/开火，host 把这些码注入 `input.codesDown` / `input.codesFresh`。P2 的键码与 host 本机 P1 的键码不重叠，所以两边可以同时操作，互不干扰。

guest 上不渲染画面（只显示一个虚拟摇杆），画面留在 host 屏幕上——这等价于「游戏机 + 无线手柄」，是最快能跑起来的形态。

```js
import { mount } from './src/main.js';
import { PAD_CODES } from './src/core/input.js';

const arcade = mount('#arcade', { game: 'pong' });
arcade.mode.pong = 2;
arcade.startGame(arcade.games.findIndex((g) => g.id === 'pong'));

// ---- 远端 P2 的键码（每组取第一个，够用）----
const BTNS = ['up', 'down', 'left', 'right', 'fire'];
const CODE = Object.fromEntries(BTNS.map((b) => [b, PAD_CODES[2][b][0]]));

const heldCodes = new Set();   // 远端当前按住
const freshCodes = new Set();  // 远端本帧新按下

function applyRemote(msg) {
  const next = new Set();
  for (const b of BTNS) if (msg[b]) next.add(CODE[b]);
  for (const c of next) if (!heldCodes.has(c)) freshCodes.add(c);
  heldCodes.clear();
  for (const c of next) heldCodes.add(c);
}

// ---- 接传输层（换成 WebRTC DataChannel 也行）----
const ws = new WebSocket('wss://your-host/room/ABC123');
ws.onmessage = (e) => applyRemote(JSON.parse(e.data));

// ---- 把远端输入注入引擎的每一步 ----
// 官方没有输入注入 API；唯一稳定的缝是 _step 和 input 上的两个 Set。
// 升级到 1.2 之类的小版本后请重新确认这两处还在。
const step = arcade._step.bind(arcade);
arcade._step = function (dt) {
  const inp = this.input;
  for (const c of heldCodes) inp.codesDown.add(c);
  for (const c of freshCodes) inp.codesFresh.add(c);
  freshCodes.clear();
  step(dt);
  // 步末摘掉远端码：endFrame() 只清 codesFresh，codesDown 会残留
  for (const c of heldCodes) { inp.codesDown.delete(c); inp.codesFresh.delete(c); }
};
```

guest 侧（一个只有方向键和开火键的页面）：

```js
const state = { up: 0, down: 0, left: 0, right: 0, fire: 0 };
const ws = new WebSocket('wss://your-host/room/ABC123');
const send = () => ws.readyState === 1 && ws.send(JSON.stringify(state));

// keydown/keyup 或 pointerdown/up 里改 state，变了再 send（60 Hz 全量也就 ~200 B/s）
addEventListener('keydown', (e) => { map(e.code, 1); send(); });
addEventListener('keyup',   (e) => { map(e.code, 0); send(); });
```

服务端只需要一个两人房间的中继（`ws` 包，约 25 行）：

```js
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8787 });
const rooms = new Map();

wss.on('connection', (socket, req) => {
  const room = req.url.slice(1) || 'lobby';
  if (!rooms.has(room)) rooms.set(room, []);
  const peers = rooms.get(room);
  if (peers.length >= 2) { socket.close(4001, 'room full'); return; }
  peers.push(socket);
  peers[0].send(JSON.stringify({ role: peers.length === 1 ? 'host' : 'guest' }));

  socket.on('message', (data) => {
    // host 收输入；guest 的消息转给 host，host 的广播转给 guest
    const target = peers.find((p) => p !== socket);
    if (target && target.readyState === 1) target.send(data.toString());
  });

  socket.on('close', () => {
    rooms.set(room, peers.filter((p) => p !== socket));
  });
});
```

部署注意：

- 页面是 `https://` 时只能用 `wss://`（混合内容会被浏览器拦）。
- 同浏览器多标签页可以先不写服务端，用 `BroadcastChannel('arcade-room')` 两个标签互相发，零依赖。
- 这条路线**只有 host 看到画面**。要让两个人各自看到画面，走附录 B。
- 断线重连时记得清 `heldCodes`，否则会卡住一个方向键。

---

## 10. 附录 B：帧转发（各自都看到画面，约 100 行）

思路：host 仍是唯一权威，guest 只是「显示器 + 遥控器」。host 每帧把**字符网格的差异**推给 guest，guest 画到自己的 canvas 上。因为坐标系是字符格，一格 `{ch, fg, bg}` 就够，不需要传像素。

host 侧采集（一个天然的缝：`_draw()` 最后会调用 `screen.flush(ctx)`）：

```js
const s = arcade.screen;
const flush = s.flush.bind(s);
let prev = null;

s.flush = function (ctx) {
  const cells = new Array(s.cols * s.rows);
  const diff = [];
  for (let i = 0; i < cells.length; i++) {
    const k = (s.fg[i] ?? '') + '\u0001' + (s.bg[i] ?? '') + '\u0001' + s.ch[i];
    cells[i] = k;
    if (k !== prev?.[i]) diff.push(i, k);
  }
  prev = cells;
  if (diff.length) ws.send(JSON.stringify(diff));   // 乒乓每帧几十格，<1 KB
  flush(ctx);
};
```

guest 侧只需一个空实例当画布（不需要跑逻辑）：

```js
import { mount } from './src/main.js';

const view = mount('#view');
view.stop();                       // 关掉它自己的 1/60 循环，只借用 canvas 和 Screen
const s = view.screen;

ws.onmessage = (e) => {
  const diff = JSON.parse(e.data);
  for (let i = 0; i < diff.length; i += 2) {
    const idx = diff[i], [fg, bg, ch] = diff[i + 1].split('\u0001');
    s.ch[idx] = ch; s.fg[idx] = fg || null; s.bg[idx] = bg || null;
  }
  s.flush(view.ctx);
};
```

要点：

- 只传 `fg/bg/ch` 三件事，宽字符的「占位格」在 `s.ch` 里本来就是 `\u0000`，会原样同步过去，中文对齐不会坏。
- 状态栏（第 36 行）不属于 `cur.render()`，`_drawBar()` 也要经过 `flush`，所以上面这段天然把状态栏一起转发了。
- 全量一帧约 `2880 × 3` 字段，别每帧发全量；差异法在乒乓/贪吃蛇这类游戏里通常 < 100 格。
- guest 收到的网格需要**自己重排指针/键盘输入**（附录 A 的注入逻辑），两条路线可以叠加：画面 host→guest，输入 guest→host。
- 插值/丢帧：字符网格帧率降到 20–30 Hz 一般看不出来卡，但乒乓高球会顿；要顺滑就在 guest 上做 1 帧延迟平滑，或者直接提到 60 Hz（乒乓差异量撑得住）。
- 想更彻底，可以改成「host 只算逻辑、双方都渲染」+ 种子化 RNG（把 `Math.random` 换成 `mulberry32(seed)`，seed 由 host 在开局时下发）。这是路线 C，改动会渗进每个游戏，工作量最大，但延迟最低。

---

## 11. 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| 控制台报 `Failed to fetch dynamically imported module` 或模块加载被拒 | `file://` 打开。用静态服务器，或改用 `dist/` 单文件包 |
| 画面出来了但按键盘没反应 | 焦点不在该实例。点一下画面；或 `TerminalArcade.focus(engine)`。多个实例时只有 `active` 吃键盘 |
| 容器高度为 0 / 布局跳动 | 给容器 `min-height`；`embed.js` 会预填占位高度，手写挂载时自己加 |
| 中文错位、串格 | 宿主 CSS 改了 `font-family` 或字体不支持等宽。别改 `.ta-canvas` 的字体，或改用 iframe 隔离 |
| 没有声音 | AudioContext 需要用户手势；点一下画面。`M` 键或 `muted` 选项检查一下 |
| `mount()` 抛 `找不到挂载容器` | 选择器写错，或脚本在 DOM 之前执行。`type="module"` 默认延迟执行，普通 script 记得放 `</body>` 前 |
| 手机竖屏画面很小 | 设计基准是 80×36（约 771×540 px），窄屏等比缩小，建议横屏 |
| 换了游戏但菜单没变 | `register()` 之后 `games` 变了，菜单每帧重画会自然刷新；若用了 `dist/` 包，重新 `npm run build` |

---

## 12. 发布到 npm

### 12.1 包名

`terminal-arcade` 已被 `tigerabrodioss` 的终端 CLI 小游戏占用（0.1.0），不能再用。当前 `package.json` 用的是 **`chargrid-arcade`**（已查过，2026 年时无主）。改名只需动一处：

```bash
npm pkg set name=your-name
node scripts/pkg-test.mjs      # 会重新校验名字、exports、自引用解析
```

备选名（同样查过未被占用）：`terminal-arcade-js`、`canvas-terminal-arcade`、`ascii-arcade-canvas`。用 scope 也可以：`@you/terminal-arcade`，但要加 `--access public` 才能公开安装。

### 12.2 发布流程

```bash
npm login                      # 一次性
npm test                       # 6 组自检，含 pkg-test
npm run pack:check             # 看清楚会传哪些文件（32 个，约 118 KB 压缩后）
npm publish                    # prepublishOnly 会自动再跑一遍 npm test
```

`npm publish` 之前会跑的检查项（`scripts/pkg-test.mjs`）：

- 名字合法、不是 `terminal-arcade`、没有 `private: true`
- `files` 清单与 `exports` 目标在磁盘上都存在
- 三处 `types` 指向真实 `.d.ts`
- **Node 无 DOM 下 `import` 不炸**，`mount()` 报「需要浏览器环境」
- 包自引用 `import 'chargrid-arcade'` / `/core/input.js` / `/games` / `/style.css` 都能解析
- `dist/` 产物存在且不是空壳（>60 KB）

### 12.3 本地先装一遍

```bash
npm pack --pack-destination /tmp             # 出 chargrid-arcade-1.2.0.tgz
mkdir -p /tmp/consumer && cd /tmp/consumer
npm init -y && npm i /tmp/chargrid-arcade-1.2.0.tgz
node -e "import('chargrid-arcade').then(m=>console.log(m.GAMES.length))"   # 12
npx tsc --noEmit --strict --moduleResolution bundler your-test.ts          # 类型声明
```

`npm link` 也行，但它绕过 `files` 白名单，验不出「漏发文件」这类问题，压测发布请用 tarball。

### 12.4 发版约定

- 改 API 或行为 → `npm version minor`；修 bug → `patch`；改包名/exports 布局 → `major`。
- 改了 `src/` 记得 `npm run build`：`dist/` 是提交进仓库的，`files` 会原样发给用户，忘了构建就会发出旧产物（`pkg-test` 只查大小，查不出内容过期）。
- `types/*.d.ts` 是手写的，不是从 JS 生成的；改 `api` 字段时同步改它，CI 里用 `tsc --noEmit` 跑一个消费端样例最稳。
- 没有 CJS 入口是刻意的：双份产物会让 `instanceof` 和模块单例（`window.TerminalArcade`、`GAMES` 注册表）出现两份。

### 12.5 国内网络、镜像与"cnpm 注册"

先说结论：**cnpm 不是一个可以注册账号的公共源**。`cnpm` 只是命令行客户端（`npm i -g cnpm`），背后是阿里 `npmmirror.com`，它是 npmjs.org 的**只读镜像**（实测 `registry.npmmirror.com/<pkg>` 返回的 `_rev` 与 npmjs 完全一致）。它的作用是「下载加速」，不能发布、没有用户体系。

三种需求对应三种做法：

| 需求 | 做法 |
| --- | --- |
| 国内安装慢 | 换源，不需要任何账号：`npm config set registry https://registry.npmmirror.com`（或用 `nrm` 切换） |
| 要把包发出去 | 注册 npmjs.com（`npm adduser`），发布必须指向官方源 |
| 要一个能注册账号的私有源 | 自建 `cnpmcore`（cnpm 官方开源，npmmirror 的实现，`Private NPM Registry for Enterprise`），按官方 README 用 Docker 或源码部署 |

发布时的正确姿势（避免全局镜像源导致 403/404）：

```bash
npm publish --registry=https://registry.npmjs.org
# 开了 2FA 的账号：
npm publish --registry=https://registry.npmjs.org --otp=123456
```

本仓库的 `.npmrc` 反过来固定成官方源——因为**发布/登录只对 registry.npmjs.org 生效**，而镜像只做下载加速：

```
registry=https://registry.npmjs.org/
```

这样全局留着 `registry=npmmirror`（别的项目下载快）也不影响本目录 `npm login` / `npm publish`。诊断一行就够：

```bash
npm config get registry     # 在本目录应输出 https://registry.npmjs.org/
```

`.npmrc` 永远不会进 tarball（npm 硬性排除），不用担心泄漏 token。

其他要点：

- 在 npmjs 发布一次，国内用户从 npmmirror 装也能装到（镜像自动同步；新包可能要等几分钟，必要时在 npmmirror 页面手动触发 sync）。
- `cnpm publish` 不推荐：客户端语义与 npm 有差异，主流做法是 `npm`/`pnpm` + 镜像源配置。
- 发布前确认当前源：`npm config get registry`。这一条能省掉绝大多数"发不上去"的排查时间。

### 12.6 2FA、token 与 2027 年的变化（重要）

npm 从 2025 年起强制「发布必须 2FA」，随后一路收紧 token 能力。**以下是 2026-10 的实际情况**，别照抄老教程：

| 时间 | 变化 |
| --- | --- |
| 2025-11 | 经典（legacy）token 全部下线，只剩 granular access token（GAT）。所以「Classic Token → Automation」这条老路**已经不存在** |
| 2026-08（已生效） | bypass-2FA 的 GAT **不能再做账号/包/组织管理**：建删 token、改密码/邮箱/2FA、改包的可访问性、maintainer、trusted publishing 配置、组织成员，都必须交互式 2FA |
| 2027-01（预计） | bypass-2FA 的 GAT **不能直接 `npm publish`**，只剩「读私有包 + 暂存发布（stage）」，公开前需要人工 2FA 批准 |

结论：bypass-2FA token 现在还能直接发布，但它只剩约三个月的窗口，不要再把它当成长期方案。三条可持续的路：

**A. 手动发布 + OTP（最简单，长期有效）**

```bash
npm publish --otp=123456     # 每次发版敲一次 6 位码
```

适合人肉发版。**注意：如果账号 2FA 用的是 passkey / 安全密钥而不是 TOTP，就拿不到 6 位码**，只能走 B 或 C。

**B. Trusted publishing（OIDC，自动化首选）**

npm 官方的长期答案，CI 里发布不需要任何 token，还会自动生成 provenance。

- 要求：npm CLI **≥ 11.5.1**、Node **≥ 22.14.0**
- 支持：GitHub Actions（GitHub-hosted runner）、GitLab.com shared runner、CircleCI cloud。**自托管 runner 暂不支持**
- 配置：npmjs.com → 包 → Settings → Trusted Publisher，填 org/user、repo、workflow 文件名（含 `.yml`）、可选 environment、可选允许的动作（`npm stage publish` 永远允许，`npm publish` / `npm dist-tag` 需单独勾）
- workflow 必须给 `permissions: id-token: write`；`package.json` 的 `repository.url` 必须与仓库**完全一致**
- 配置建好后 **2 天内必须完成首次成功发布**，否则配置过期，只能删掉重建

```yaml
# .github/workflows/publish.yml（片段）
on:
  push:
    tags: ['v*']
permissions:
  id-token: write
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
          package-manager-cache: false
      - run: npm ci
      - run: npm run build --if-present
      - run: npm test
      - run: npm publish          # CLI 自动检测 OIDC，无需 NODE_AUTH_TOKEN
```

**C. Stage-only token + `npm stage publish`（还不能上 OIDC 时的过渡）**

建 GAT 时权限选 **Read and write (stage only)**，CI 里用 `npm stage publish` 提交版本，维护者本地 `npm stage approve` 用 2FA 批准后才公开。要求 npm CLI **≥ 11.15.0**、Node ≥ 22.14.0。用这种 token 直接 `npm publish` 会被拒绝，即使它勾了 bypass 2FA。

两个容易踩的点：

- 本机 npm **10.2.3** 太旧，B 和 C 都跑不了（A 的 `--otp` 可以）。升级装 **npm 11** 而不是 `@latest`：
  `npm i -g npm@11` → 11.21.1，要求 `node ^20.17.0 || >=22.9.0`，已覆盖 trusted publishing（≥11.5.1）、staged publishing（≥11.15.0）、OIDC dist-tag（≥11.21.0）。
  `npm i -g npm@latest` 现在会装 npm 12.2.1，它要求 `node ^22.22.2 || ^24.15.0 || >=26.0.0`，node 24.14.1 会被 EBADENGINE 拒绝；要上 12 得先把 Node 抬到 24.15+，并接受 `allowScripts` 等 install-time 默认值变化。
- `npm whoami` **不能**用来判断能不能发布；官方文档明确说它不是权限检查。要验证就真发一个版本，或看包 Settings 里的 publishing access。
