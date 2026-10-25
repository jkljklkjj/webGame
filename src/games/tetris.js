import { randInt, shuffle } from '../core/util.js';

const SHAPES = {
  I: { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], c: 'cyan' },
  J: { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], c: 'blue' },
  L: { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], c: 'orange' },
  O: { m: [[1, 1], [1, 1]], c: 'yellow' },
  S: { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], c: 'green' },
  T: { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], c: 'magenta' },
  Z: { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], c: 'red' },
};
const KEYS = Object.keys(SHAPES);

export default {
  id: 'tetris',
  name: 'TETRIS',
  cn: '俄罗斯方块',
  desc: '堆满一行即消除，越堆越快',
  keys: ['←→ 移动  ↑/X 旋转  Z 逆旋', '↓ 软降  空格 硬降'],
  create(api) {
    const { screen, input, audio } = api;
    const BW = 10, BH = 18;
    const CELL = 1;                 // 每格占用的屏幕行数
    const CW = 2;                   // 每格占用字符列数
    const boardW = BW * CW + 2;
    const boardH = BH * CELL + 2;
    const X0 = Math.floor((api.w - boardW - 24) / 2);
    const Y0 = Math.floor((api.h - boardH) / 2);
    const PX = X0 + boardW + 3;

    let board, cur, bag, next, dropTimer, dropInterval, score, lines, level, ended;

    function emptyBoard() {
      return Array.from({ length: BH }, () => new Array(BW).fill(null));
    }

    function refillBag() {
      bag = shuffle([...KEYS]);
    }

    function takePiece() {
      if (!bag || !bag.length) refillBag();
      const k = bag.pop();
      const s = SHAPES[k];
      const m = s.m.map((r) => [...r]);
      return { k, m, c: s.c, x: Math.floor((BW - m[0].length) / 2), y: k === 'I' ? -1 : 0 };
    }

    function reset() {
      board = emptyBoard();
      bag = null;
      refillBag();
      next = takePiece();
      score = 0; lines = 0; level = 1;
      ended = false;
      dropTimer = 0;
      dropInterval = 0.75;
      cur = takePiece();
      sync();
    }

    function sync() {
      api.setStatus(`分 ${score}  行 ${lines}  L${level}`);
    }

    function fits(m, px, py) {
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
          if (!m[y][x]) continue;
          const bx = px + x, by = py + y;
          if (bx < 0 || bx >= BW || by >= BH) return false;
          if (by < 0) continue;
          if (board[by][bx]) return false;
        }
      }
      return true;
    }

    function rotate(m, cw = true) {
      const n = m.length;
      const out = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          out[y][x] = cw ? m[n - 1 - x][y] : m[x][n - 1 - y];
        }
      }
      return out;
    }

    function tryRotate(cw) {
      const nm = rotate(cur.m, cw);
      const kicks = [0, -1, 1, -2, 2];
      for (const dx of kicks) {
        if (fits(nm, cur.x + dx, cur.y)) {
          cur.m = nm;
          cur.x += dx;
          audio.blip();
          return true;
        }
      }
      return false;
    }

    function lock() {
      cur.m.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const by = cur.y + y, bx = cur.x + x;
        if (by < 0) { ended = true; return; }
        board[by][bx] = cur.c;
      }));
      if (ended) { finish(); return; }

      let cleared = 0;
      for (let y = BH - 1; y >= 0; y--) {
        if (board[y].every((c) => c)) {
          board.splice(y, 1);
          board.unshift(new Array(BW).fill(null));
          cleared++;
          y++;
        }
      }
      if (cleared) {
        const table = [0, 100, 300, 500, 800];
        score += table[cleared] * level;
        lines += cleared;
        level = 1 + Math.floor(lines / 10);
        dropInterval = Math.max(0.08, 0.75 - (level - 1) * 0.07);
        if (cleared >= 4) audio.win(); else audio.score();
      } else {
        audio.hit();
      }
      sync();

      cur = next;
      next = takePiece();
      dropTimer = 0;
      if (!fits(cur.m, cur.x, cur.y)) { ended = true; finish(); }
    }

    function finish() {
      api.saveBest(score);
      api.over(`得分 ${score}  消除 ${lines} 行`);
    }

    function ghostY() {
      let y = cur.y;
      while (fits(cur.m, cur.x, y + 1)) y++;
      return y;
    }

    function update(dt) {
      if (ended) return;

      if (input.pressed('left')) { if (fits(cur.m, cur.x - 1, cur.y)) { cur.x--; audio.blip(); } }
      if (input.pressed('right')) { if (fits(cur.m, cur.x + 1, cur.y)) { cur.x++; audio.blip(); } }
      if (input.anyPressed('up', 'x')) tryRotate(true);
      if (input.pressed('z')) tryRotate(false);
      if (input.pressed('space')) {
        let d = 0;
        while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; d++; }
        score += d * 2;
        lock();
        return;
      }

      const soft = input.isDown('down');
      dropTimer += dt * (soft ? 12 : 1);
      if (soft && dropTimer > dropInterval) {
        if (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; }
        dropTimer = 0;
      }
      if (dropTimer >= dropInterval) {
        dropTimer = 0;
        if (fits(cur.m, cur.x, cur.y + 1)) cur.y++;
        else lock();
      }
    }

    function render(s) {
      s.clear('bg');
      s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', 'TETRIS');

      // 已固定方块
      for (let y = 0; y < BH; y++) {
        for (let x = 0; x < BW; x++) {
          const c = board[y][x];
          if (!c) continue;
          s.write(X0 + 1 + x * CW, Y0 + 1 + y * CELL, '██', c);
        }
      }

      // 幽灵 + 当前块
      const gy = ghostY();
      cur.m.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const bx = cur.x + x;
        const by = cur.y + y;
        const gby = gy + y;
        if (gby >= 0 && gby < BH && !(board[gby]?.[bx])) {
          s.write(X0 + 1 + bx * CW, Y0 + 1 + gby * CELL, '░░', 'faint');
        }
        if (by >= 0 && by < BH) s.write(X0 + 1 + bx * CW, Y0 + 1 + by * CELL, '██', cur.c);
      }));

      // 侧栏
      let y = Y0;
      s.box(PX, y, 22, 8, 'accent2', 'bg', 'single', 'NEXT');
      next.m.forEach((row, ry) => row.forEach((v, rx) => {
        if (!v) return;
        s.write(PX + 2 + rx * 2, y + 2 + ry, '██', next.c);
      }));
      y += 9;

      s.box(PX, y, 22, 6, 'accent2', 'bg', 'single', 'STATS');
      s.write(PX + 2, y + 2, `SCORE ${score}`, 'amber');
      s.write(PX + 2, y + 3, `LINES ${lines}`, 'default');
      s.write(PX + 2, y + 4, `LEVEL ${level}`, 'cyan');
      y += 7;

      s.box(PX, y, 22, 5, 'accent2', 'bg', 'single', 'KEYS');
      s.write(PX + 2, y + 1, '←→ 移动', 'dim');
      s.write(PX + 2, y + 2, '↑/X 旋转 Z 逆', 'dim');
      s.write(PX + 2, y + 3, '空格 硬降', 'dim');
    }

    return { reset, update, render };
  },
};
