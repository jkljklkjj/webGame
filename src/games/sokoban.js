// 关卡：'#' 墙  ' ' 地板  '.' 目标  '$' 箱子  '*' 箱在目标  '@' 玩家  '+' 玩家在目标
// scripts/levels.mjs 会用 BFS 校验每一关真的可解。
export const LEVELS = [
  [
    '################',
    '#              #',
    '#    $     .   #',
    '#    @         #',
    '#              #',
    '################',
  ],
  [
    '################',
    '#              #',
    '#  $       $   #',
    '#  .       .   #',
    '#      @       #',
    '#              #',
    '################',
  ],
  [
    '################',
    '#   #    .     #',
    '# $ #          #',
    '#              #',
    '#####    ######',
    '#   @  $       #',
    '#      .       #',
    '################',
  ],
  [
    '################',
    '#      #       #',
    '#  $   #   .   #',
    '#  @   #       #',
    '#      #       #',
    '####   #   #####',
    '#              #',
    '#      .   $   #',
    '################',
  ],
];

export default {
  id: 'sokoban',
  name: 'SOKOBAN',
  cn: '推箱子',
  desc: '把箱子推上所有目标点，U 撤销',
  keys: ['方向键 / WASD 移动', 'U 撤销一步'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;

    const CW = 2;      // 每格 2 字符宽
    let map, mw, mh, player, boxes, goals, moves, pushes, undoStack, level, cleared, solvedTimer;

    function load(idx) {
      const raw = LEVELS[idx % LEVELS.length];
      mh = raw.length;
      mw = Math.max(...raw.map((r) => r.length));
      map = [];
      boxes = [];
      goals = [];
      player = { x: 0, y: 0 };
      for (let y = 0; y < mh; y++) {
        const row = [];
        for (let x = 0; x < mw; x++) {
          const c = raw[y][x] || ' ';
          let cell = c;
          if (c === '@' || c === '+') { player = { x, y }; cell = c === '+' ? '.' : ' '; }
          if (c === '$' || c === '*') { boxes.push({ x, y }); cell = c === '*' ? '.' : ' '; }
          if (cell === '.') goals.push({ x, y });
          row.push(cell === '.' ? '.' : cell === '#' ? '#' : ' ');
        }
        map.push(row);
      }
      moves = 0;
      pushes = 0;
      undoStack = [];
      solvedTimer = 0;
      sync();
    }

    function sync() {
      api.setStatus(`第 ${level + 1}/${LEVELS.length} 关  步 ${moves}  推 ${pushes}`);
    }

    function reset() {
      level = 0;
      cleared = false;
      load(0);
    }

    function isWall(x, y) {
      if (y < 0 || y >= mh || x < 0 || x >= mw) return true;
      return map[y][x] === '#';
    }

    function boxAt(x, y) {
      return boxes.find((b) => b.x === x && b.y === y) || null;
    }

    function done() {
      return boxes.every((b) => goals.some((g) => g.x === b.x && g.y === b.y));
    }

    function move(dx, dy) {
      const nx = player.x + dx, ny = player.y + dy;
      if (isWall(nx, ny)) return;

      const b = boxAt(nx, ny);
      if (b) {
        const bx = nx + dx, by = ny + dy;
        if (isWall(bx, by) || boxAt(bx, by)) { audio.hit(); return; }
        undoStack.push({ px: player.x, py: player.y, box: b, bx: b.x, by: b.y });
        b.x = bx; b.y = by;
        pushes++;
        audio.beep(300, 0.05);
      } else {
        undoStack.push({ px: player.x, py: player.y, box: null });
        audio.blip();
      }
      player.x = nx;
      player.y = ny;
      moves++;
      sync();

      if (done()) {
        cleared = true;
        solvedTimer = 0.9;
        audio.win();
      }
    }

    function undo() {
      const last = undoStack.pop();
      if (!last) return;
      if (last.box) {
        last.box.x = last.bx;
        last.box.y = last.by;
        pushes = Math.max(0, pushes - 1);
      }
      player.x = last.px;
      player.y = last.py;
      moves = Math.max(0, moves - 1);
      cleared = false;
      solvedTimer = 0;
      sync();
      audio.beep(220, 0.04);
    }

    function update(dt) {
      if (solvedTimer > 0) {
        solvedTimer -= dt;
        if (solvedTimer <= 0) {
          if (level + 1 >= LEVELS.length) {
            api.saveBest(level + 1);
            api.won(`${LEVELS.length} 关全部通过 · 共 ${moves} 步`);
          } else {
            level++;
            load(level);
            audio.score();
          }
        }
        return;
      }

      if (input.pressed('left')) move(-1, 0);
      else if (input.pressed('right')) move(1, 0);
      else if (input.pressed('up')) move(0, -1);
      else if (input.pressed('down')) move(0, 1);
      else if (input.pressed('u') || input.pressed('z')) undo();
    }

    function render(s) {
      s.clear('bg');
      const boardW = mw * CW + 2;
      const boardH = mh + 2;
      const X0 = Math.floor((W - boardW) / 2);
      const Y0 = Math.floor((H - 4 - boardH) / 2) + 1;

      s.box(X0, Y0, boardW, boardH, 'accent2', 'bg', 'single', `LEVEL ${level + 1}`);

      for (let y = 0; y < mh; y++) {
        for (let x = 0; x < mw; x++) {
          const sx = X0 + 1 + x * CW;
          const sy = Y0 + 1 + y;
          const cell = map[y][x];
          const isGoal = goals.some((g) => g.x === x && g.y === y);
          const b = boxAt(x, y);

          if (cell === '#') {
            s.write(sx, sy, '██', 'faint');
            continue;
          }
          if (b) {
            s.write(sx, sy, '[]', isGoal ? 'accent' : 'amber');
          } else if (isGoal) {
            s.write(sx, sy, '· ', player.x === x && player.y === y ? 'cyan' : 'dim');
          }
          if (player.x === x && player.y === y) {
            s.write(sx, sy, '@' + (b ? '' : ' '), 'cyan');
          }
        }
      }

      const infoY = Y0 + boardH + 1;
      if (infoY < H) {
        const left = boxes.filter((b) => goals.some((g) => g.x === b.x && g.y === b.y)).length;
        s.writeCenter(infoY, `已归位 ${left}/${boxes.length}   步数 ${moves}   推动 ${pushes}`, 'dim');
      }
      if (cleared && solvedTimer > 0) {
        s.writeCenter(Y0 + Math.floor(mh / 2), '  LEVEL CLEAR  ', 'bg', 'accent');
      }
    }

    return { reset, update, render };
  },
};
