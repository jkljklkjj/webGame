import { randInt } from '../core/util.js';

const N = 4;

const COLORS = {
  2: 'default',
  4: 'accent',
  8: 'cyan',
  16: 'blue',
  32: 'violet',
  64: 'magenta',
  128: 'amber',
  256: 'yellow',
  512: 'orange',
  1024: 'red',
  2048: 'white',
};

export default {
  id: '2048',
  name: '2048',
  cn: '数字合并',
  desc: '相同数字合并，目标 2048',
  keys: ['WASD / ↑↓←→ 滑动', 'R 重开'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;

    const CW = 7;                       // 单元格内宽
    const cellH = 3;                    // 单元格内高
    const boardW = N * CW + N + 1;      // 7*4 + 3 + 1 = 32
    const boardH = N * cellH + N + 1;   // 3*4 + 3 + 1 = 16
    const X0 = Math.floor((W - boardW) / 2);
    const Y0 = Math.floor((H - boardH) / 2);

    let g, score, ended, won;

    function reset() {
      g = Array.from({ length: N }, () => new Array(N).fill(0));
      score = 0; ended = false; won = false;
      addTile(); addTile();
      api.setStatus(`分数 ${score}`);
    }

    function freeCells() {
      const out = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) out.push([x, y]);
      return out;
    }

    function addTile() {
      const f = freeCells();
      if (!f.length) return;
      const [x, y] = f[randInt(0, f.length - 1)];
      g[y][x] = Math.random() < 0.9 ? 2 : 4;
    }

    function compress(line) {
      const vals = line.filter((v) => v);
      const out = [];
      let gained = 0;
      for (let i = 0; i < vals.length; i++) {
        if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
          const merged = vals[i] * 2;
          out.push(merged);
          gained += merged;
          if (merged >= 2048) won = true;
          i++;
        } else {
          out.push(vals[i]);
        }
      }
      while (out.length < N) out.push(0);
      return { out, gained };
    }

    function slide(dir) {
      let changed = false;
      let gained = 0;

      for (let i = 0; i < N; i++) {
        const vertical = dir === 'up' || dir === 'down';
        const reverse = dir === 'right' || dir === 'down';
        let line = vertical ? g.map((r) => r[i]) : g[i].slice();
        if (reverse) line = line.slice().reverse();

        const before = line.join(',');
        const res = compress(line);
        let final = res.out.slice();
        if (reverse) final = final.reverse();
        gained += res.gained;
        if (before !== final.join(',')) changed = true;

        for (let j = 0; j < N; j++) {
          if (vertical) g[j][i] = final[j];
          else g[i][j] = final[j];
        }
      }

      if (changed) {
        score += gained;
        if (gained) audio.blip();
        addTile();
        api.setStatus(`分数 ${score}`);
        checkEnd();
      }
    }

    function hasMoves() {
      if (freeCells().length) return true;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          if (x + 1 < N && g[y][x] === g[y][x + 1]) return true;
          if (y + 1 < N && g[y][x] === g[y + 1][x]) return true;
        }
      }
      return false;
    }

    function checkEnd() {
      if (won) {
        api.saveBest(score);
        api.won(`达成 2048 · 分数 ${score}`);
        return;
      }
      if (!hasMoves()) {
        ended = true;
        api.saveBest(score);
        audio.lose();
        api.over(`没有可移动的方块 · 分数 ${score}`);
      } else if (score > api.best) {
        api.saveBest(score);
      }
    }

    function update() {
      if (ended) return;
      if (input.pressed('left')) slide('left');
      else if (input.pressed('right')) slide('right');
      else if (input.pressed('up')) slide('up');
      else if (input.pressed('down')) slide('down');
    }

    function render(s) {
      s.clear('bg');
      s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', '2048');

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const v = g[y][x];
          const cx = X0 + 1 + x * (CW + 1);
          const cy = Y0 + 1 + y * (cellH + 1);
          if (v) {
            s.fill(cx, cy, CW, cellH, ' ', null, 'bg2');
            const txt = String(v);
            const left = Math.floor((CW - txt.length) / 2);
            s.write(cx + left, cy + 1, txt, COLORS[v] || 'white', 'bg2');
          } else {
            s.fill(cx, cy, CW, cellH, '·', 'faint');
          }
        }
      }

      // 网格分隔
      for (let i = 1; i < N; i++) {
        s.vline(X0 + i * (CW + 1), Y0 + 1, boardH - 2, '│', 'accent2');
        s.hline(X0 + 1, Y0 + i * (cellH + 1), boardW - 2, '─', 'accent2');
      }
      for (let i = 1; i < N; i++) {
        for (let j = 1; j < N; j++) s.put(X0 + i * (CW + 1), Y0 + j * (cellH + 1), '┼', 'accent2');
      }

      const infoY = Y0 + boardH + 1;
      if (infoY < H) s.writeCenter(infoY, `分数 ${score}  最高 ${api.best}`, 'amber');
      if (infoY + 1 < H) s.writeCenter(infoY + 1, '目标：合并出 2048', 'dim');
    }

    return { reset, update, render };
  },
};
