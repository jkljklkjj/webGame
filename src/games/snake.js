import { randInt } from '../core/util.js';

const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export default {
  id: 'snake',
  name: 'SNAKE',
  cn: '贪吃蛇',
  desc: '吃 @ 变长 · 双人模式互撞',
  players: 2,
  keys: ['P1 WASD   P2 方向键', '撞墙或撞到身体就输'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;
    const twoP = api.players === 2;

    let snakes, food, acc, timer, ended, result;

    function makeSnake(pad, x, y, dir, colors) {
      return {
        pad,
        alive: true,
        score: 0,
        dir: DIRS[dir],
        queue: [],
        body: [
          { x, y },
          { x: x - DIRS[dir].x, y: y - DIRS[dir].y },
          { x: x - DIRS[dir].x * 2, y: y - DIRS[dir].y * 2 },
        ],
        color: colors[0],
        headColor: colors[1],
      };
    }

    function spawnFood() {
      const free = [];
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!snakes.some((s) => s.body.some((b) => b.x === x && b.y === y))) free.push({ x, y });
        }
      }
      if (!free.length) return null;
      return free[randInt(0, free.length - 1)];
    }

    function reset() {
      ended = false;
      result = null;
      acc = 0;
      timer = 0.11;
      if (twoP) {
        snakes = [
          makeSnake(input.p1, 10, Math.round(H * 0.28), 'right', ['cyan', 'white']),
          makeSnake(input.p2, W - 11, Math.round(H * 0.72), 'left', ['magenta', 'white']),
        ];
      } else {
        snakes = [makeSnake(null, W >> 1, H >> 1, 'right', ['accent', 'white'])];
      }
      food = spawnFood();
      sync();
    }

    function sync() {
      if (twoP) api.setStatus(`P1 ${snakes[0].score} : ${snakes[1].score} P2`);
      else api.setStatus(`长度 ${snakes[0].body.length} · 得分 ${snakes[0].score}`);
    }

    /** 把方向塞进队列，避免一帧内 180° 掉头 */
    function pushDir(s, name) {
      const nd = DIRS[name];
      if (!nd) return;
      const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
      if (nd.x === -last.x && nd.y === -last.y) return;
      if (nd.x === last.x && nd.y === last.y) return;
      if (s.queue.length < 3) s.queue.push(nd);
    }

    function readInput() {
      for (const s of snakes) {
        if (!s.alive) continue;
        if (s.pad) {
          const d = s.pad.dir();
          if (d) pushDir(s, d);
        } else {
          if (input.pressed('up')) pushDir(s, 'up');
          if (input.pressed('down')) pushDir(s, 'down');
          if (input.pressed('left')) pushDir(s, 'left');
          if (input.pressed('right')) pushDir(s, 'right');
        }
      }
    }

    function tick() {
      // 1. 结算各自的新蛇头
      const heads = snakes.map((s) => {
        if (!s.alive) return null;
        if (s.queue.length) s.dir = s.queue.shift();
        return { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y };
      });

      const doomed = snakes.map(() => false);

      // 2. 撞墙
      heads.forEach((h, i) => {
        if (!h) return;
        if (h.x < 1 || h.x > W - 2 || h.y < 1 || h.y > H - 2) doomed[i] = true;
      });

      // 3. 撞自己（尾巴这一格会移开，所以不算）
      snakes.forEach((s, i) => {
        const h = heads[i];
        if (!h || doomed[i]) return;
        const eating = food && h.x === food.x && h.y === food.y;
        const solid = eating ? s.body : s.body.slice(0, -1);
        if (solid.some((seg) => seg.x === h.x && seg.y === h.y)) doomed[i] = true;
      });

      // 4. 撞对方身体 / 头对头
      if (snakes.length === 2) {
        snakes.forEach((s, i) => {
          const h = heads[i];
          if (!h || doomed[i]) return;
          const other = snakes[1 - i];
          if (other.alive && other.body.some((seg) => seg.x === h.x && seg.y === h.y)) doomed[i] = true;
        });
        if (heads[0] && heads[1] && heads[0].x === heads[1].x && heads[0].y === heads[1].y) {
          doomed[0] = true;
          doomed[1] = true;
        }
      }

      if (doomed.some(Boolean)) {
        doomed.forEach((d, i) => { if (d) snakes[i].alive = false; });
        finish(doomed);
        return;
      }

      // 5. 前进 / 吃食物
      let ate = false;
      snakes.forEach((s, i) => {
        const h = heads[i];
        s.body.unshift(h);
        if (food && h.x === food.x && h.y === food.y) {
          s.score += 10;
          ate = true;
        } else {
          s.body.pop();
        }
      });

      if (ate) {
        audio.blip();
        food = spawnFood();
        const total = snakes.reduce((n, s) => n + s.body.length, 0);
        timer = Math.max(0.055, 0.11 - total * 0.0004);
        sync();
        if (!food) finish([true, twoP ? true : false]);
      }
    }

    function finish(doomed) {
      if (ended) return;
      ended = true;
      const s0 = snakes[0];
      if (!twoP) {
        if (!food) {
          api.won(`铺满了整个终端 · 得分 ${s0.score}`);
          return;
        }
        const why = doomed[0] ? '撞墙或咬到自己' : '结束';
        api.saveBest(s0.score);
        api.over(`${why} · 得分 ${s0.score}`);
        return;
      }

      const dead1 = doomed[0];
      const dead2 = doomed[1];
      api.saveBest(Math.max(...snakes.map((s) => s.score)));
      if (dead1 && dead2) {
        audio.lose();
        api.over(`双双阵亡 · ${s0.score} : ${snakes[1].score}`);
      } else if (dead1) {
        audio.lose();
        api.over(`P2 获胜  ${s0.score} : ${snakes[1].score}`);
      } else {
        audio.win();
        api.won(`P1 获胜  ${s0.score} : ${snakes[1].score}`);
      }
    }

    function update(dt) {
      if (ended) return;
      readInput();
      acc += dt;
      let guard = 0;
      while (acc >= timer && !ended && guard++ < 4) {
        acc -= timer;
        tick();
      }
    }

    function render(s) {
      s.clear('bg');
      s.box(0, 0, W, H, 'accent2', 'bg');
      s.write(2, 0, twoP
        ? ` P1 ${snakes[0].score} : ${snakes[1].score} P2 `
        : ` SNAKE ${snakes[0].score} `, 'amber', 'bg');

      if (food) s.put(food.x, food.y, '@', 'red');

      for (const sn of snakes) {
        if (!sn.body.length) continue;
        sn.body.forEach((seg, i) => {
          if (i === 0) s.put(seg.x, seg.y, 'O', sn.headColor);
          else s.put(seg.x, seg.y, 'o', sn.color);
        });
      }

      if (twoP) {
        s.put(2, H - 1, 'P1', 'cyan');
        s.put(W - 4, H - 1, 'P2', 'magenta');
      }
    }

    return { reset, update, render };
  },
};
