import { clamp, randInt } from '../core/util.js';

const NUM_COLORS = ['default', 'cyan', 'accent', 'yellow', 'blue', 'magenta', 'violet', 'red'];

export default {
  id: 'mines',
  name: 'MINESWEEPER',
  cn: '扫雷',
  desc: '清出所有安全格，别踩到地雷',
  keys: ['WASD / ↑↓←→ 移动光标的', '空格 翻开   F 插旗'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;

    const GW = 16, GH = 12, MINES = 32;
    const boardW = GW * 2 + 2;
    const boardH = GH + 2;
    const X0 = Math.floor((W - boardW) / 2);
    const Y0 = Math.floor((H - boardH) / 2);

    let cells, cursor, started, dead, flags, revealed, t;

    function reset() {
      cells = Array.from({ length: GH }, () => Array.from({ length: GW }, () => ({
        mine: false, open: false, flag: false, n: 0,
      })));
      cursor = { x: Math.floor(GW / 2), y: Math.floor(GH / 2) };
      started = false; dead = false; flags = 0; revealed = 0; t = 0;
      api.setStatus(`剩余雷 ${MINES - flags}`);
    }

    function realIndex(x, y) { return y * GW + x; }

    function placeMines(sx, sy) {
      const forbidden = new Set();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = sx + dx, y = sy + dy;
          if (x >= 0 && x < GW && y >= 0 && y < GH) forbidden.add(realIndex(x, y));
        }
      }
      const pool = [];
      for (let i = 0; i < GW * GH; i++) if (!forbidden.has(i)) pool.push(i);
      for (let i = 0; i < MINES && pool.length; i++) {
        const j = randInt(0, pool.length - 1);
        const idx = pool.splice(j, 1)[0];
        cells[Math.floor(idx / GW)][idx % GW].mine = true;
      }
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if ((dx || dy) && nx >= 0 && nx < GW && ny >= 0 && ny < GH && cells[ny][nx].mine) n++;
            }
          }
          cells[y][x].n = n;
        }
      }
    }

    function open(x, y) {
      if (x < 0 || x >= GW || y < 0 || y >= GH) return;
      const c = cells[y][x];
      if (c.open || c.flag) return;
      c.open = true;
      revealed++;
      if (c.mine) { dead = true; return; }
      if (c.n === 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx || dy) open(x + dx, y + dy);
          }
        }
      }
    }

    function checkWin() {
      if (revealed === GW * GH - MINES) {
        api.saveBest(Math.max(1, Math.round(300 - t)));
        audio.win();
        api.won(`全部清出！用时 ${Math.round(t)} 秒`);
      }
    }

    function update(dt) {
      if (dead) return;
      if (started) t += dt;

      if (input.pressed('left')) cursor.x = clamp(cursor.x - 1, 0, GW - 1);
      if (input.pressed('right')) cursor.x = clamp(cursor.x + 1, 0, GW - 1);
      if (input.pressed('up')) cursor.y = clamp(cursor.y - 1, 0, GH - 1);
      if (input.pressed('down')) cursor.y = clamp(cursor.y + 1, 0, GH - 1);

      const c = cells[cursor.y][cursor.x];

      if (input.pressed('space')) {
        if (!started) { started = true; placeMines(cursor.x, cursor.y); }
        if (!c.flag) {
          open(cursor.x, cursor.y);
          if (dead) {
            audio.lose();
            cells.forEach((row) => row.forEach((cc) => { if (cc.mine) cc.open = true; }));
            api.saveBest(Math.max(0, Math.round(t)));
            api.over(`踩到地雷 · 存活 ${Math.round(t)} 秒`);
            return;
          }
          audio.blip();
          checkWin();
        }
      }

      if (input.pressed('f')) {
        if (!c.open) {
          c.flag = !c.flag;
          flags += c.flag ? 1 : -1;
          audio.hit();
        }
      }

      api.setStatus(`剩余雷 ${MINES - flags}  时间 ${Math.round(t)}s`);
    }

    function render(s) {
      s.clear('bg');
      s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', 'MINESWEEPER');

      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const c = cells[y][x];
          const sx = X0 + 1 + x * 2;
          const sy = Y0 + 1 + y;
          const isCur = cursor.x === x && cursor.y === y;
          const bgc = isCur ? 'bg3' : null;

          if (c.open) {
            if (c.mine) s.write(sx, sy, '**', 'red', bgc);
            else if (c.n === 0) s.write(sx, sy, ' ·', 'faint', bgc);
            else s.write(sx, sy, ' ' + c.n, NUM_COLORS[c.n], bgc);
          } else if (c.flag) {
            s.write(sx, sy, ' F', 'amber', bgc);
          } else {
            s.write(sx, sy, isCur ? '▒▒' : '░░', isCur ? 'yellow' : 'dim', bgc);
          }
        }
      }

      const infoY = Y0 + boardH + 1;
      if (infoY < H) {
        s.writeCenter(infoY, `剩余地雷 ${MINES - flags}    已翻开 ${revealed}/${GW * GH - MINES}`, 'dim');
      }
    }

    return { reset, update, render };
  },
};
