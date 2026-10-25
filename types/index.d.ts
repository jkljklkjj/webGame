// TERMINAL ARCADE 类型声明。
// 手写，对应 src/main.js（1.2.0）。改了 API 记得同步这里。

/** 命名色，也可以是任意 CSS 色值；null = 默认 / 透明 */
export type Color =
  | 'accent'
  | 'accent2'
  | 'default'
  | 'white'
  | 'dim'
  | 'faint'
  | 'bg'
  | 'bg2'
  | 'bg3'
  | 'amber'
  | 'yellow'
  | 'red'
  | 'cyan'
  | 'blue'
  | 'magenta'
  | 'violet'
  | 'orange'
  | 'green'
  | (string & {})
  | null;

/** 边框样式 */
export type BoxStyle = 'single' | 'double' | 'round' | 'ascii';

/** 字符缓冲（80×36 网格） */
export interface Screen {
  readonly cols: number;
  readonly rows: number;
  /** 写一个字符；越界忽略 */
  put(x: number, y: number, ch: string, fg?: Color, bg?: Color): void;
  write(x: number, y: number, str: string, fg?: Color, bg?: Color): void;
  writeCenter(y: number, str: string, fg?: Color, bg?: Color): void;
  /** 右对齐到第 xRight 列（含） */
  writeRight(xRight: number, y: number, str: string, fg?: Color, bg?: Color): void;
  fill(x: number, y: number, w: number, h: number, ch?: string, fg?: Color, bg?: Color): void;
  hline(x: number, y: number, w: number, ch?: string, fg?: Color, bg?: Color): void;
  vline(x: number, y: number, h: number, ch?: string, fg?: Color, bg?: Color): void;
  box(
    x: number,
    y: number,
    w: number,
    h: number,
    fg?: Color,
    bg?: Color,
    style?: BoxStyle,
    title?: string
  ): void;
  clear(bg?: Color): void;
  /** 字符串占用的网格宽度（中文算 2） */
  width(str: string): number;
  /** 整屏文本，调试/快照用 */
  text(): string;
  /** 把缓冲刷到 canvas；引擎每帧自动调用 */
  flush(ctx: CanvasRenderingContext2D): void;
}

/** 合并层输入：WASD / 方向键 / hjkl 全映射到同一批名字 */
export interface InputLayer {
  isDown(name: string): boolean;
  /** 本帧是否刚按下 */
  pressed(name: string): boolean;
  anyPressed(...names: string[]): boolean;
  axisX(): -1 | 0 | 1;
  axisY(): -1 | 0 | 1;
  dir(): 'up' | 'down' | 'left' | 'right' | null;
}

/** 单个玩家的按键视图：只认自己那套键码 */
export interface Pad extends InputLayer {
  isDown(btn: 'up' | 'down' | 'left' | 'right' | 'fire'): boolean;
  pressed(btn: 'up' | 'down' | 'left' | 'right' | 'fire'): boolean;
  anyPressed(...btns: Array<'up' | 'down' | 'left' | 'right' | 'fire'>): boolean;
}

/** 指针槽 */
export interface PointerSlot {
  id: string | number;
  x: number;
  y: number;
}

export interface Input extends InputLayer {
  readonly p1: Pad;
  readonly p2: Pad;
  readonly pointers: PointerSlot[];
  readonly pointer: { x: number; y: number; down: boolean; active: boolean; pressed: boolean };
  readonly codesDown: Set<string>;
  readonly codesFresh: Set<string>;
  slot(n: number): PointerSlot | null;
  /** 第 n 位玩家可用的指针（0 号槽无触摸时回退鼠标） */
  pointAt(n: number): PointerSlot | null;
}

/** WebAudio 蜂鸣器 */
export interface Beeps {
  muted: boolean;
  beep(freq?: number, dur?: number, type?: OscillatorType, gain?: number): void;
  blip(): void;
  hit(): void;
  bounce(): void;
  score(): void;
  win(): void;
  lose(): void;
  /** 首次用户手势后恢复 AudioContext */
  resume(): void;
}

/** 游戏从 create(api) 里拿到的对象 */
export interface GameApi {
  readonly game: Game;
  readonly screen: Screen;
  readonly input: Input;
  readonly audio: Beeps;
  readonly cols: number;
  /** 可用网格宽，80 */
  readonly w: number;
  /** 可用网格高，35（第 36 行是引擎状态栏） */
  readonly h: number;
  readonly colors: Record<string, Color>;
  /** 底部状态栏左半边文字 */
  status: string;
  setStatus(text: string): void;
  /** 最高分（按 game.id 存 localStorage） */
  readonly best: number;
  /** 返回是否刷新了记录 */
  saveBest(score: number): boolean;
  /** 本局人数，1 或 2；在 reset() 里读 */
  players: 1 | 2;
  over(msg?: string): void;
  won(msg?: string): void;
  restart(): void;
  exit(): void;
  toast(text: string): void;
}

export interface GameInstance {
  reset?(): void;
  update?(dt: number): void;
  render?(screen: Screen): void;
}

export interface Game {
  /** 唯一 id，同时是最高分/双人模式的存储键 */
  id: string;
  name: string;
  cn?: string;
  desc?: string;
  /** 省略 = 单人；写 2 才允许切换双人 */
  players?: 1 | 2;
  /** 菜单底部 / 暂停层的操作提示 */
  keys?: string[];
  create(api: GameApi): GameInstance;
}

export interface MountOptions {
  /** 初始游戏 id */
  game?: string;
  /** 最大高度（px），宽度按 80:36 等比推出 */
  height?: number;
  /** 静音启动；省略时读 localStorage */
  muted?: boolean;
}

export type ArcadeState = 'menu' | 'play' | 'pause' | 'over';

export class Engine {
  readonly host: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly cols: number;
  readonly rows: number;
  readonly screen: Screen;
  readonly input: Input;
  readonly audio: Beeps;
  readonly games: Game[];
  /** 当前游戏实例 */
  cur: GameInstance | null;
  /** 当前游戏收到的 api 对象 */
  api: GameApi | null;
  state: ArcadeState;
  /** 菜单选中索引 */
  sel: number;
  readonly best: Record<string, number>;
  /** 单人/双人选择表，可直接改 */
  readonly mode: Record<string, 1 | 2>;

  startGame(index: number): void;
  restart(): void;
  start(): this;
  stop(): void;
  /** 停止循环、解绑所有监听、移除 canvas、从注册表注销 */
  destroy(): void;
  modeOf(game: Game | undefined): 1 | 2;
}

export interface ArcadeGlobal {
  readonly version: string;
  readonly games: Game[];
  readonly active: Engine | null;
  readonly instances: Engine[];
  register(game: Game): ArcadeGlobal;
  mount(host: string | HTMLElement, opts?: MountOptions): Engine;
  focus(engine: Engine): void;
}

/** 挂载一个实例；host 可以是选择器或节点 */
export function mount(host: string | HTMLElement, opts?: MountOptions): Engine;
/** 注册/替换游戏（按 id 去重） */
export function register(game: Game): ArcadeGlobal;
/** 游戏注册表（与 GAMES 是同一引用） */
export const GAMES: Game[];
/** 全局对象（默认导出），同时挂在 window.TerminalArcade */
declare const api: ArcadeGlobal;

declare global {
  interface Window {
    TerminalArcade: ArcadeGlobal;
    __terminalArcadeLoaded?: boolean;
  }
}

export default api;
