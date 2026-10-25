import { clamp, randInt } from '../core/util.js';

export default {
  id: 'runner',
  name: 'RUNNER',
  cn: '奔跑者',
  desc: '一个键的小恐龙，越跑越快',
  keys: ['空格 / ↑ 跳', '可以二段跳'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;

    const GROUND = H - 4;
    const PX = 10;
    const GRAV = 110;
    const JUMP_V = -40;

    let y, vy, jumps, obstacles, speed, score, ended, spawnGap, t;

    function reset() {
      y = GROUND;
      vy = 0;
      jumps = 0;
      obstacles = [];
      speed = 34;
      score = 0;
      ended = false;
      spawnGap = 0.9;
      t = 0;
      api.setStatus('0 m');
    }

    function jump() {
      if (jumps < 2) {
        vy = JUMP_V * (jumps === 0 ? 1 : 0.86);
        jumps++;
        audio.beep(jumps === 1 ? 520 : 660, 0.07, 'square');
      }
    }

    function update(dt) {
      if (ended) return;
      t += dt;
      speed = Math.min(72, speed + dt * 1.6);
      score += speed * dt * 0.35;

      if (input.anyPressed('space', 'up', 'w')) jump();

      vy += GRAV * dt;
      y += vy * dt;
      if (y >= GROUND) {
        if (jumps > 0) audio.beep(300, 0.05);
        y = GROUND;
        vy = 0;
        jumps = 0;
      }

      spawnGap -= dt;
      if (spawnGap <= 0) {
        const h = Math.random() < 0.25 ? 3 : randInt(1, 2);
        obstacles.push({ x: W - 1, h, w: h >= 3 ? 2 : 1 });
        spawnGap = Math.max(0.42, (randInt(55, 95) / 100) * (60 / speed) * 1.6);
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed * dt;
        if (o.x + o.w < -1) obstacles.splice(i, 1);
      }

      // 碰撞：玩家占 (PX-1..PX+1, y-1..y)
      for (const o of obstacles) {
        const oy0 = GROUND - o.h + 1;
        const px0 = PX - 1, px1 = PX + 1;
        const py0 = y - 1, py1 = y;
        if (px1 >= o.x && px0 <= o.x + o.w - 1 && py1 >= oy0 && py0 <= GROUND) {
          ended = true;
          api.saveBest(Math.round(score));
          audio.lose();
          api.over(`撞上了 · ${Math.round(score)} m`);
          return;
        }
      }

      api.setStatus(`${Math.round(score)} m   速度 ${speed.toFixed(0)}`);
    }

    function render(s) {
      s.clear('bg');

      // 地平线
      s.hline(0, GROUND + 1, W, '─', 'accent2');
      for (let x = 0; x < W; x += 7) {
        const off = Math.floor((t * speed) % 7);
        s.put((x - off + W * 2) % W, GROUND + 2, '.', 'faint');
      }

      // 远景
      const hillOff = Math.floor((t * speed * 0.15) % 40);
      for (let i = 0; i < 4; i++) {
        const hx = (i * 24 - hillOff + 80) % 80;
        s.write(hx, GROUND - 5, ' /\\  ', 'faint');
        s.write(hx, GROUND - 4, '/  \\ ', 'faint');
      }

      // 障碍
      for (const o of obstacles) {
        for (let i = 0; i < o.h; i++) {
          s.write(Math.round(o.x), GROUND - i, '#'.repeat(o.w), 'red');
        }
      }

      // 玩家
      const py = Math.round(y);
      s.write(PX - 1, py - 1, '/o\\', 'cyan');
      s.write(PX - 1, py, jumps > 0 ? '/^\\' : '/ \\', 'cyan');

      s.write(2, 0, ` ${Math.round(score)} m `, 'amber');
      s.writeRight(W - 3, 0, ` 速度 ${speed.toFixed(0)}  `, 'dim');
      if (jumps === 1) s.writeRight(W - 3, 1, ' AIR ', 'faint');
    }

    return { reset, update, render };
  },
};
