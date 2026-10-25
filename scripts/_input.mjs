// 测试用的假输入：形状和真 Input 一致（合并层 + p1/p2 双层 + 指针槽），
// 这样同一批游戏代码在 Node 里能同时跑单人和双人两条路径。
import { Pad, PAD_CODES, KEY_CODES } from '../src/core/input.js';

export function makeInput() {
  const input = {
    // 原始键码层（玩家层读这个）
    codesDown: new Set(),
    codesFresh: new Set(),
    // 合并层
    held: new Set(),
    fresh: new Set(),

    pointers: [],
    pointer: { x: 40, y: 17, down: false, active: false, pressed: false },

    p1: null,
    p2: null,

    /** 按下一个物理键（同时更新两层，和真实实现一致） */
    keyDown(code) {
      this.codesDown.add(code);
      this.codesFresh.add(code);
      for (const n of KEY_CODES[code] || []) {
        this.held.add(n);
        this.fresh.add(n);
      }
    },

    keyUp(code) {
      this.codesDown.delete(code);
      for (const n of KEY_CODES[code] || []) this.held.delete(n);
    },

    /** 让第 n 号玩家按某个按钮：fire/up/down/left/right */
    padDown(n, btn) {
      for (const c of (PAD_CODES[n] || {})[btn] || []) this.keyDown(c);
    },
    padUp(n, btn) {
      for (const c of (PAD_CODES[n] || {})[btn] || []) this.keyUp(c);
    },
    /** 只写合并层，模拟“单人游戏随便哪个键都算” */
    press(name) { this.fresh.add(name); },
    hold(name) { this.held.add(name); },

    isDown(n) { return this.held.has(n); },
    pressed(n) { return this.fresh.has(n); },
    anyPressed(...n) { return n.some((k) => this.fresh.has(k)); },
    axisX() { return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0); },
    axisY() { return (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0); },
    dir() {
      if (this.pressed('up')) return 'up';
      if (this.pressed('down')) return 'down';
      if (this.pressed('left')) return 'left';
      if (this.pressed('right')) return 'right';
      return null;
    },

    slot(n) { return this.pointers[n] || null; },
    pointAt(n) {
      const p = this.pointers[n];
      if (p) return p;
      if (n === 0 && this.pointers.length === 0 && this.pointer.active) return this.pointer;
      return null;
    },

    /** 模拟第 n 个手指按下 */
    touch(n, x, y) {
      this.pointers[n] = { id: n, x, y };
      this.pointer.active = true;
    },
    clearTouch() {
      this.pointers.length = 0;
      this.pointer.active = false;
    },

    endFrame() {
      this.fresh.clear();
      this.codesFresh.clear();
      this.pointer.pressed = false;
    },
  };

  input.p1 = new Pad(input, PAD_CODES[1]);
  input.p2 = new Pad(input, PAD_CODES[2]);
  return input;
}
