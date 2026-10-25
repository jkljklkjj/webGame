import { clamp } from '../core/util.js';

const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const GLYPH = { up: '^^', down: 'vv', left: '<<', right: '>>' };

// 竞技场按格子算：39 格 × 17 格，每格 2 字符宽，正好铺满 78 列
const WC = 39;
const HC = 17;

// 墙体按 180° 旋转对称生成，两个出生点公平
const WALLS_BASE = [
  { x: 6, y: 3, w: 2, h: 5 },
  { x: 15, y: 7, w: 3, h: 3 },
  { x: 26, y: 1, w: 4, h: 2 },
];

export default {
  id: 'duel',
  name: 'DUEL',
  cn: '双人对射',
  desc: '两台坦克互相射击 · 单人时右边是 AI',
  players: 2,
  keys: ['P1 WASD 移动 / F 开火', 'P2 方向键移动 / Enter 开火', '打掉对方 3 格血取胜'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;
    const twoP = api.players === 2;

    const y0 = 2;
    const boxH = HC + 2;

    let walls, tanks, bullets, bulletAcc, ended, aiPad, aiTimer, aiDir, t;

    function mirror(r) {
      return { x: WC - r.x - r.w, y: HC - r.y - r.h, w: r.w, h: r.h };
    }

    function buildWalls() {
      const set = new Set();
      for (const r of WALLS_BASE) {
        for (const rect of [r, mirror(r)]) {
          for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) set.add(y * WC + x);
          }
        }
      }
      return set;
    }

    function isWall(x, y) {
      if (x < 0 || y < 0 || x >= WC || y >= HC) return true;
      return walls.has(y * WC + x);
    }

    function tankAt(x, y) {
      return tanks.find((t) => t.x === x && t.y === y) || null;
    }

    function makeTank(spawn, dir, color, label) {
      return {
        x: spawn.x, y: spawn.y, spawn, dir,
        hp: 3, cd: 0, inv: 0, moveCd: 0,
        color, label,
      };
    }

    // 单人模式下用这个假手柄驱动右侧坦克，走的是和 P2 完全相同的代码路径
    function makeAiPad() {
      let fire = false;
      return {
        _dir: null,
        isDown(b) { return this._dir === b; },
        pressed(b) { return b === 'fire' && fire; },
        anyPressed(...b) { return b.some((k) => this.pressed(k)); },
        dir() { return this._dir; },
        axisX() { return this._dir === 'right' ? 1 : this._dir === 'left' ? -1 : 0; },
        axisY() { return this._dir === 'down' ? 1 : this._dir === 'up' ? -1 : 0; },
        setFire(v) { fire = v; },
      };
    }

    function reset() {
      walls = buildWalls();
      ended = false;
      bullets = [];
      bulletAcc = 0;
      t = 0;
      tanks = [
        makeTank({ x: 1, y: HC - 2 }, 'right', 'cyan', 'P1'),
        makeTank({ x: WC - 2, y: 1 }, 'left', 'magenta', 'P2'),
      ];
      aiPad = makeAiPad();
      aiTimer = 0;
      aiDir = null;
      sync();
    }

    function sync() {
      api.setStatus(`P1 ${tanks[0].hp} : ${tanks[1].hp} P2`);
    }

    function sight(a, b) {
      if (a.x !== b.x && a.y !== b.y) return null;
      const dx = Math.sign(b.x - a.x);
      const dy = Math.sign(b.y - a.y);
      let x = a.x, y = a.y;
      for (let i = 0; i < WC + HC; i++) {
        x += dx;
        y += dy;
        if (x === b.x && y === b.y) {
          return dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        }
        if (isWall(x, y)) return null;
      }
      return null;
    }

    /** 简单 AI：能对射就对射，否则绕到能对射的位置 */
    function driveAi(dt) {
      const me = tanks[1];
      const foe = tanks[0];
      aiTimer -= dt;
      if (aiTimer <= 0) {
        aiTimer = 0.16;
        const los = sight(me, foe);
        aiPad.setFire(false);
        if (los) {
          aiDir = los;
          aiPad.setFire(true);
        } else {
          // 先对齐一条轴，靠近了再拐弯
          const dx = foe.x - me.x;
          const dy = foe.y - me.y;
          const preferX = Math.abs(dx) > Math.abs(dy);
          const want = preferX
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
          const nx = me.x + DIRS[want].x;
          const ny = me.y + DIRS[want].y;
          aiDir = (isWall(nx, ny) || tankAt(nx, ny)) ? (preferX ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left')) : want;
          if (Math.random() < 0.25) aiPad.setFire(true);
        }
        aiPad._dir = aiDir;
      }
    }

    function drivePad(tank, pad, dt) {
      const fresh = pad.dir();
      const held = fresh
        || (pad.isDown('left') ? 'left' : pad.isDown('right') ? 'right'
          : pad.isDown('up') ? 'up' : pad.isDown('down') ? 'down' : null);

      tank.moveCd -= dt;
      tank.cd -= dt;
      if (tank.inv > 0) tank.inv -= dt;

      if (held) {
        tank.dir = held;
        if (tank.moveCd <= 0) {
          const nx = tank.x + DIRS[held].x;
          const ny = tank.y + DIRS[held].y;
          if (!isWall(nx, ny) && !tankAt(nx, ny)) {
            tank.x = nx;
            tank.y = ny;
            tank.moveCd = 0.10;
          }
        }
      }

      if (pad.pressed('fire') && tank.cd <= 0) shoot(tank);
    }

    function shoot(tank) {
      const mine = bullets.filter((b) => b.owner === tank).length;
      if (mine >= 2) return;
      const d = DIRS[tank.dir];
      bullets.push({ x: tank.x + d.x, y: tank.y + d.y, dir: tank.dir, owner: tank, t: 0 });
      tank.cd = 0.42;
      audio.beep(660, 0.05, 'square');
    }

    function stepBullets() {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const d = DIRS[b.dir];
        b.x += d.x;
        b.y += d.y;

        if (isWall(b.x, b.y)) { bullets.splice(i, 1); continue; }

        const hit = tanks.find((t) => t !== b.owner && t.x === b.x && t.y === b.y);
        if (hit) {
          bullets.splice(i, 1);
          if (hit.inv > 0) continue;
          hit.hp--;
          hit.inv = 1.1;
          audio.hit();
          sync();
          if (hit.hp <= 0) {
            ended = true;
            api.saveBest(Math.max(tanks[0].hp, tanks[1].hp));
            if (hit === tanks[1]) {
              if (twoP) api.won('P1 获胜'); else api.won('你赢了这台终端');
            } else {
              if (twoP) api.over('P2 获胜'); else api.over('电脑赢下了对射');
            }
            return;
          }
        }
      }
    }

    function update(dt) {
      if (ended) return;
      t += dt;

      drivePad(tanks[0], twoP ? input.p1 : input, dt);

      if (twoP) {
        drivePad(tanks[1], input.p2, dt);
      } else {
        driveAi(dt);
        drivePad(tanks[1], aiPad, dt);
      }

      bulletAcc += dt;
      let guard = 0;
      while (bulletAcc >= 0.055 && !ended && guard++ < 8) {
        bulletAcc -= 0.055;
        stepBullets();
      }
    }

    function drawTank(s, t, blinker) {
      const sx = 1 + t.x * 2;
      const sy = y0 + 1 + t.y;
      if (t.inv > 0 && !blinker) return;
      s.write(sx, sy, GLYPH[t.dir], t.color);
    }

    function render(s) {
      s.clear('bg');

      // 血条 + 比分
      const hpBar = (t) => '█'.repeat(Math.max(0, t.hp)) + '·'.repeat(Math.max(0, 3 - t.hp));
      s.write(2, 0, 'P1', 'cyan');
      s.write(5, 0, hpBar(tanks[0]), tanks[0].hp > 1 ? 'cyan' : 'red');
      s.writeCenter(0, 'DUEL', 'accent');
      s.writeRight(W - 3, 0, hpBar(tanks[1]), tanks[1].hp > 1 ? 'magenta' : 'red');
      s.writeRight(W - 7, 0, 'P2', 'magenta');

      // 场地
      s.box(0, y0, W, boxH, 'accent2', 'bg');

      for (const key of walls) {
        const x = key % WC;
        const y = (key / WC) | 0;
        s.write(1 + x * 2, y0 + 1 + y, '▓▓', 'faint');
      }

      for (const b of bullets) {
        const horiz = b.dir === 'left' || b.dir === 'right';
        s.write(1 + b.x * 2, y0 + 1 + b.y, horiz ? '==' : '||', 'yellow');
      }

      const blink = Math.floor(t * 8) % 2 === 0;
      tanks.forEach((tk) => drawTank(s, tk, blink));

      const infoY = y0 + boxH + 1;
      if (infoY < H) {
        s.writeCenter(infoY, twoP
          ? 'P1 左下方   P2 右上方   打掉对方 3 格血'
          : 'WASD 移动 · F 开火 · 打掉 AI 的 3 格血', 'dim');
      }
    }

    return { reset, update, render };
  },
};
