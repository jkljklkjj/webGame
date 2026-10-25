import { clamp, randInt } from '../core/util.js';

const N = 7;
const CW = 4;   // 每格 3 字符 + 1 间隔

export default {
  id: 'lights',
  name: 'LIGHTS OUT',
  cn: '关灯',
  desc: '点一格翻转它和四邻，全灭即胜',
  keys: ['方向键 / WASD 移动光标', '空格 翻转  R 重开'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;

    const boardW = N * CW + 1;
    const boardH = N + 2;
    const X0 = Math.floor((W - boardW) / 2);
    const Y0 = Math.floor((H - 5 - boardH) / 2) + 1;

    let g, cursor, moves, ended, solvedTimer;

    function toggle(x, y) {
      if (x < 0 || x >= N || y < 0 || y >= N) return;
      g[y][x] = !g[y][x];
    }

    function press(x, y) {
      toggle(x, y);
      toggle(x - 1, y);
      toggle(x + 1, y);
      toggle(x, y - 1);
      toggle(x, y + 1);
      moves++;
      audio.beep(560 + y * 30, 0.035);
      api.setStatus(`步数 ${moves}`);
      if (allOff()) {
        ended = true;
        solvedTimer = 1.2;
        const score = Math.max(1, 200 - moves * 4);
        api.saveBest(score);
        audio.win();
      }
    }

    function allOff() {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) return false;
      return true;
    }

    function scramble(steps) {
      g = Array.from({ length: N }, () => new Array(N).fill(false));
      // 从全灭状态倒着点，保证一定有解
      for (let i = 0; i < steps; i++) {
        const x = randInt(0, N - 1);
        const y = randInt(0, N - 1);
        toggle(x, y); toggle(x - 1, y); toggle(x + 1, y); toggle(x, y - 1); toggle(x, y + 1);
      }
      if (allOff()) scramble(steps);
    }

    function reset() {
      cursor = { x: 1, y: 3 };
      moves = 0;
      ended = false;
      solvedTimer = 0;
      scramble(9);
      api.setStatus('步数 0');
    }

    function update(dt) {
      if (solvedTimer > 0) {
        solvedTimer -= dt;
        if (solvedTimer <= 0) api.won(`全灭了 · ${moves} 步`);
        return;
      }
      if (ended) return;

      if (input.pressed('left')) cursor.x = (cursor.x + N - 1) % N;
      if (input.pressed('right')) cursor.x = (cursor.x + 1) % N;
      if (input.pressed('up')) cursor.y = (cursor.y + N - 1) % N;
      if (input.pressed('down')) cursor.y = (cursor.y + 1) % N;

      // 鼠标/触屏点哪翻哪
      if (input.pointer.pressed) {
        const px = Math.floor(input.pointer.x - X0 - 1);
        const py = Math.floor(input.pointer.y - Y0 - 1);
        if (px >= 0 && px < N * CW && py >= 0 && py < N) {
          cursor.x = clamp(Math.floor(px / CW), 0, N - 1);
          cursor.y = clamp(py, 0, N - 1);
          press(cursor.x, cursor.y);
          return;
        }
      }

      if (input.pressed('space') || input.pressed('enter')) press(cursor.x, cursor.y);
    }

    function render(s) {
      s.clear('bg');
      s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', 'LIGHTS OUT');

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const sx = X0 + 1 + x * CW;
          const sy = Y0 + 1 + y;
          const on = g[y][x];
          const isCur = cursor.x === x && cursor.y === y;
          if (on) {
            s.write(sx, sy, '███', isCur ? 'yellow' : 'amber', isCur ? 'bg3' : null);
          } else {
            s.write(sx, sy, '···', isCur ? 'accent' : 'faint', isCur ? 'bg3' : null);
          }
        }
      }

      // 光标框：用竖线把当前格夹住
      s.put(X0, Y0 + 1 + cursor.y, '▸', 'yellow');
      s.put(X0 + boardW - 1, Y0 + 1 + cursor.y, '◂', 'yellow');

      const infoY = Y0 + boardH + 1;
      s.writeCenter(infoY, `步数 ${moves}`, 'amber');
      if (infoY + 1 < H) s.writeCenter(infoY + 1, '目标：让所有格子熄灭', 'dim');
    }

    return { reset, update, render };
  },
};
