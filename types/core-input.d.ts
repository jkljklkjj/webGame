// 对应 src/core/input.js —— 需要自己接线（远程输入桥、自定义键位）时用。
// 自包含声明，不跨文件 import，避免与类名/接口名撞车。

/** KeyboardEvent.code -> 合并层的名字数组 */
export declare const KEY_CODES: Record<string, string[]>;

/** 两名玩家的键位码。P1 左手区，P2 右手区，互不重叠 */
export declare const PAD_CODES: {
  readonly 1: {
    readonly up: string[];
    readonly down: string[];
    readonly left: string[];
    readonly right: string[];
    readonly fire: string[];
  };
  readonly 2: {
    readonly up: string[];
    readonly down: string[];
    readonly left: string[];
    readonly right: string[];
    readonly fire: string[];
  };
};

/** 单个玩家的按键视图 */
export declare class Pad {
  constructor(input: Input, map: Record<string, string[]>);
  readonly input: Input;
  readonly map: Record<string, string[]>;
  isDown(btn: 'up' | 'down' | 'left' | 'right' | 'fire'): boolean;
  pressed(btn: 'up' | 'down' | 'left' | 'right' | 'fire'): boolean;
  anyPressed(...btns: Array<'up' | 'down' | 'left' | 'right' | 'fire'>): boolean;
  axisX(): -1 | 0 | 1;
  axisY(): -1 | 0 | 1;
  dir(): 'up' | 'down' | 'left' | 'right' | null;
}

export declare class Input {
  constructor(canvas: HTMLCanvasElement, engine: unknown);
  readonly canvas: HTMLCanvasElement;
  readonly p1: Pad;
  readonly p2: Pad;
  readonly pointers: Array<{ id: string | number; x: number; y: number }>;
  readonly pointer: { x: number; y: number; down: boolean; active: boolean; pressed: boolean };
  /** 原始键码层：远程输入桥直接往里写 */
  readonly codesDown: Set<string>;
  readonly codesFresh: Set<string>;
  isDown(name: string): boolean;
  pressed(name: string): boolean;
  anyPressed(...names: string[]): boolean;
  axisX(): -1 | 0 | 1;
  axisY(): -1 | 0 | 1;
  dir(): 'up' | 'down' | 'left' | 'right' | null;
  slot(n: number): { id: string | number; x: number; y: number } | null;
  pointAt(n: number): { id: string | number; x: number; y: number } | null;
  attach(): void;
  detach(): void;
  endFrame(): void;
}
