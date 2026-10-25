import { clamp, rand } from '../core/util.js';

export default {
  id: 'hockey',
  name: 'AIR HOCKEY',
  cn: '冰球',
  desc: '把冰球撞进对方球门 · 支持双人对打',
  players: 2,
  keys: ['P1 WASD 左拍   P2 方向键右拍', '鼠标/触屏可直接拖拽'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;
    const WIN = 7;
    const GOAL_H = 9;
    const GOAL_Y0 = Math.floor((H - GOAL_H) / 2);
    const GOAL_Y1 = GOAL_Y0 + GOAL_H;
    const MR = 1.6;   // 球拍半径
    const PR = 0.9;   // 冰球半径

    const twoP = api.players === 2;
    const pad1 = twoP ? input.p1 : input;

    let left, right, puck, ps, as, serveTimer, ended, stall;
    let aiTimer = 0, aiTarget = { x: 0, y: 0 };

    const bound = () => ({ x0: 2, x1: W - 3, y0: 2, y1: H - 2 });

    function reset() {
      ps = 0; as = 0; ended = false; stall = 0;
      sync();
      left = { x: 8, y: H / 2, vx: 0, vy: 0 };
      right = { x: W - 9, y: H / 2, vx: 0, vy: 0 };
      aiTimer = 0;
      aiTarget = { x: W - 14, y: H / 2 };
      serve(1);
    }

    function serve(dir) {
      serveTimer = 0.8;
      puck = { x: W / 2, y: H / 2 + rand(-4, 4), vx: 0, vy: 0, dir };
    }

    function launch() {
      const ang = rand(-0.5, 0.5);
      puck.vx = Math.cos(ang) * 34 * puck.dir;
      puck.vy = Math.sin(ang) * 34;
    }

    function moveMallet(m, tx, ty, dt, speed, isLeft) {
      const bx = bound();
      const ox = m.x, oy = m.y;
      if (tx !== null) {
        const dx = clamp(tx - m.x, -speed * 2.4 * dt, speed * 2.4 * dt);
        const dy = clamp(ty - m.y, -speed * 2.4 * dt, speed * 2.4 * dt);
        m.x += dx; m.y += dy;
      }
      // 各自只能待在自己半场
      if (isLeft) m.x = clamp(m.x, bx.x0 + MR - 1, W / 2 - MR);
      else m.x = clamp(m.x, W / 2 + MR, bx.x1 - MR + 1);
      m.y = clamp(m.y, bx.y0 + MR - 1, bx.y1 - MR + 1);
      m.vx = (m.x - ox) / Math.max(dt, 1e-4);
      m.vy = (m.y - oy) / Math.max(dt, 1e-4);
    }

    function collide(m) {
      const dx = puck.x - m.x;
      const dy = puck.y - m.y;
      const d = Math.hypot(dx, dy);
      const minD = MR + PR;
      if (d > minD || d === 0) return;
      const nx = dx / d, ny = dy / d;
      // 分离
      puck.x = m.x + nx * minD;
      puck.y = m.y + ny * minD;
      // 相对速度反射
      const rvx = puck.vx - m.vx, rvy = puck.vy - m.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const e = 1.05;
        puck.vx -= (1 + e) * vn * nx;
        puck.vy -= (1 + e) * vn * ny;
      }
      // 球拍推力
      puck.vx += m.vx * 0.35;
      puck.vy += m.vy * 0.35;
      const sp = Math.hypot(puck.vx, puck.vy);
      const maxSp = 70;
      if (sp > maxSp) { puck.vx *= maxSp / sp; puck.vy *= maxSp / sp; }
      audio.bounce();
    }

    function sync() {
      api.setStatus(twoP ? `P1 ${ps} : ${as} P2` : `你 ${ps} : ${as} 电脑`);
    }

    function scoreGoal(who) {
      if (who === 'p') { ps++; audio.score(); serve(-1); }
      else { as++; audio.score(); serve(1); }
      sync();
      if (ps >= WIN) {
        ended = true;
        if (twoP) api.won(`P1 获胜  ${ps} : ${as}`);
        else api.won('球门守住，7 分到手');
      } else if (as >= WIN) {
        ended = true;
        if (twoP) api.over(`P2 获胜  ${ps} : ${as}`);
        else api.over('电脑先进 7 球');
      }
    }

    function driveMallet(m, pad, pointer, dt, speed, isLeft) {
      if (pointer) {
        moveMallet(m, pointer.x, pointer.y, dt, speed, isLeft);
      } else {
        moveMallet(m, m.x + pad.axisX() * speed * dt, m.y + pad.axisY() * speed * dt, dt, speed, isLeft);
      }
    }

    function update(dt) {
      if (ended) return;

      driveMallet(left, pad1, input.pointAt(0), dt, 40, true);

      if (twoP) {
        // 双人：右边球拍交给 P2（键盘或第二根手指）
        driveMallet(right, input.p2, input.pointAt(1), dt, 40, false);
      } else {
        // 单人：电脑有反应延迟和抖动，否则它是个不会失球的墙
        aiTimer -= dt;
        if (aiTimer <= 0) {
          aiTimer = 0.11;
          if (puck.x > W / 2 - 6) {
            aiTarget.x = puck.x + 1.5 + rand(-0.9, 0.9);
            aiTarget.y = puck.y + rand(-1.8, 1.8);
          } else {
            aiTarget.x = W - 14;
            aiTarget.y = H / 2 + (puck.y - H / 2) * 0.4;
          }
        }
        moveMallet(right, aiTarget.x, aiTarget.y, dt, 24, false);
      }

      if (serveTimer > 0) {
        serveTimer -= dt;
        puck.x = W / 2;
        puck.y = clamp(puck.y, GOAL_Y0 + 2, GOAL_Y1 - 2);
        if (serveTimer <= 0) launch();
        return;
      }

      const bx = bound();
      const steps = 3;
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        puck.x += puck.vx * sdt;
        puck.y += puck.vy * sdt;

        if (puck.y < bx.y0 + PR) { puck.y = bx.y0 + PR; puck.vy = Math.abs(puck.vy); audio.hit(); }
        if (puck.y > bx.y1 - PR) { puck.y = bx.y1 - PR; puck.vy = -Math.abs(puck.vy); audio.hit(); }

        const inGoal = puck.y > GOAL_Y0 && puck.y < GOAL_Y1;
        if (!inGoal) {
          if (puck.x < bx.x0 + PR) { puck.x = bx.x0 + PR; puck.vx = Math.abs(puck.vx); audio.hit(); }
          if (puck.x > bx.x1 - PR) { puck.x = bx.x1 - PR; puck.vx = -Math.abs(puck.vx); audio.hit(); }
        }

        collide(left);
        collide(right);

        if (puck.x < bx.x0 - 1) { scoreGoal('a'); return; }
        if (puck.x > bx.x1 + 1) { scoreGoal('p'); return; }
      }

      // 摩擦
      const f = Math.exp(-0.9 * dt);
      puck.vx *= f;
      puck.vy *= f;
      if (Math.abs(puck.vx) < 0.4) puck.vx = 0;
      if (Math.abs(puck.vy) < 0.4) puck.vy = 0;

      // 冰球停死在角落里就重新开球，别让对局僵住
      if (Math.hypot(puck.vx, puck.vy) < 2) {
        stall += dt;
        if (stall > 3) { serve(1); stall = 0; audio.blip(); }
      } else {
        stall = 0;
      }
    }

    function drawMallet(s, m, color) {
      const x = Math.round(m.x) - 1;
      const y = Math.round(m.y) - 1;
      // 纯底色块：终端 TUI 里最常见的"实心圆"
      s.fill(x, y, 3, 2, ' ', null, color);
      s.put(x + 1, y, 'o', 'bg', color);
    }

    function render(s) {
      s.clear('bg');
      s.box(1, 1, W - 2, H - 2, 'faint', 'bg', 'single');

      // 中线 + 中圈
      for (let y = 2; y < H - 1; y += 2) s.put(W / 2 | 0, y, '┊', 'faint');
      s.writeCenter(H / 2, '  ( )  ', 'faint');

      // 球门
      s.fill(1, GOAL_Y0, 1, GOAL_H, '║', 'cyan');
      s.fill(W - 2, GOAL_Y0, 1, GOAL_H, '║', 'magenta');

      // 比分
      s.writeCenter(0, twoP ? ` P1 ${ps} : ${as} P2 ` : ` ${ps} : ${as} `, 'amber');

      drawMallet(s, left, 'cyan');
      drawMallet(s, right, 'magenta');

      if (serveTimer > 0) {
        if (Math.floor(serveTimer * 8) % 2 === 0) s.put(Math.round(puck.x), Math.round(puck.y), 'o', 'yellow');
      } else {
        s.put(Math.round(puck.x), Math.round(puck.y), 'o', 'yellow');
      }
    }

    return { reset, update, render };
  },
};
