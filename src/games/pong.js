import { clamp } from '../core/util.js';

export default {
  id: 'pong',
  name: 'PONG',
  cn: '乒乓',
  desc: '先得 7 分者胜 · 支持双人对打',
  players: 2,
  keys: ['P1 W/S 移动   P2 ↑/↓ 移动', '空格 发球 · 鼠标控制左拍'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;
    const PW = 5;
    const WIN = 7;
    const PADDLE_SPEED = 34;

    const twoP = api.players === 2;
    const pad1 = twoP ? input.p1 : input;   // 单人时用合并层，谁按都算

    let p, a, ball, ps, as, serveTimer, serveDir, ended, aiNoise, t;

    function reset() {
      ps = 0; as = 0; ended = false; aiNoise = 0; t = 0;
      p = { x: 3, y: (H - PW) / 2 };
      a = { x: W - 4, y: (H - PW) / 2 };
      serve(1);
      sync();
    }

    function sync() {
      api.setStatus(twoP ? `P1 ${ps} : ${as} P2` : `玩家 ${ps} : ${as} 电脑`);
    }

    function serve(dir) {
      serveDir = dir;
      serveTimer = 0.85;
      ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 30 };
    }

    function launch() {
      const ang = (Math.random() * 0.6 - 0.3);
      ball.vx = Math.cos(ang) * ball.speed * serveDir;
      ball.vy = Math.sin(ang) * ball.speed;
    }

    function finish(p1Won) {
      ended = true;
      sync();
      if (twoP) {
        if (p1Won) api.won(`P1 获胜  ${ps} : ${as}`);
        else api.over(`P2 获胜  ${ps} : ${as}`);
      } else if (p1Won) {
        api.won('你赢了这台终端');
      } else {
        api.over('电脑赢了这一局');
      }
    }

    function movePaddle(pd, pad, pointer, dt, speed) {
      if (pointer) {
        const target = clamp(pointer.y - PW / 2, 1, H - PW - 1);
        pd.y += clamp(target - pd.y, -speed * 1.6 * dt, speed * 1.6 * dt);
      } else {
        pd.y += pad.axisY() * speed * dt;
      }
      pd.y = clamp(pd.y, 1, H - PW - 1);
    }

    function updateAi(dt) {
      let target = H / 2 - PW / 2;
      if (ball.vx > 1) {
        aiNoise = aiNoise * 0.96 + (Math.random() - 0.5) * 0.12;
        target = ball.y - PW / 2 + aiNoise * 2;
      }
      const speed = 26 + Math.min(10, (ball.speed - 30) * 0.6);
      a.y += clamp(target - a.y, -speed * dt, speed * dt);
      a.y = clamp(a.y, 1, H - PW - 1);
    }

    function hitPaddle(pd, dir) {
      const cy = pd.y + PW / 2;
      const off = clamp((ball.y - cy) / (PW / 2), -1, 1);
      const ang = off * 0.95;
      ball.speed = Math.min(ball.speed * 1.045, 64);
      ball.vx = Math.cos(ang) * ball.speed * dir;
      ball.vy = Math.sin(ang) * ball.speed;
      ball.x = dir > 0 ? pd.x + 1.6 : pd.x - 0.6;
      audio.bounce();
    }

    function update(dt) {
      if (ended) return;
      t += dt;

      movePaddle(p, pad1, input.pointAt(0), dt, PADDLE_SPEED);
      if (twoP) movePaddle(a, input.p2, input.pointAt(1), dt, PADDLE_SPEED);
      else updateAi(dt);

      if (serveTimer > 0) {
        serveTimer -= dt;
        ball.x = W / 2;
        ball.y = H / 2;
        if (serveTimer <= 0) launch();
        return;
      }

      const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 0.8));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        ball.x += ball.vx * sdt;
        ball.y += ball.vy * sdt;

        if (ball.y < 2) { ball.y = 2; ball.vy = Math.abs(ball.vy); audio.hit(); }
        if (ball.y > H - 2) { ball.y = H - 2; ball.vy = -Math.abs(ball.vy); audio.hit(); }

        if (ball.vx < 0 && ball.x - 0.5 <= p.x + 1 && ball.x > p.x - 1 &&
            ball.y >= p.y - 0.5 && ball.y <= p.y + PW + 0.5) {
          hitPaddle(p, 1);
        }
        if (ball.vx > 0 && ball.x + 0.5 >= a.x && ball.x < a.x + 2 &&
            ball.y >= a.y - 0.5 && ball.y <= a.y + PW + 0.5) {
          hitPaddle(a, -1);
        }

        if (ball.x < 0.5) { as++; audio.score(); serve(1); scoreCheck(); return; }
        if (ball.x > W - 1.5) { ps++; audio.score(); serve(-1); scoreCheck(); return; }
      }
    }

    function scoreCheck() {
      sync();
      if (ps >= WIN) finish(true);
      else if (as >= WIN) finish(false);
    }

    function render(s) {
      s.box(0, 0, W, H, 'accent2', 'bg');

      for (let y = 2; y < H - 2; y += 2) s.put(W / 2 | 0, y, '│', 'faint');

      // 比分：P1 青、P2 品红，数字统一琥珀色
      const parts = twoP
        ? [['P1', 'cyan'], [`  ${ps}`, 'amber'], ['   :   ', 'faint'], [`${as}  `, 'amber'], ['P2', 'magenta']]
        : [['', null], [` ${ps}`, 'amber'], ['   :   ', 'faint'], [`${as} `, 'amber'], ['', null]];
      const total = parts.reduce((n, q) => n + q[0].length, 0);
      let cx = Math.floor((W - total) / 2);
      for (const [txt, col] of parts) {
        if (txt) s.write(cx, 1, txt, col);
        cx += txt.length;
      }

      // 球拍：P1 青、P2 品红
      s.fill(p.x - 1, p.y, 2, PW, '█', 'cyan');
      s.fill(a.x, a.y, 2, PW, '█', 'magenta');

      if (serveTimer > 0) {
        const blink = Math.floor(t * 6) % 2 === 0;
        if (blink) s.put(ball.x | 0, ball.y | 0, 'o', 'yellow');
        if (t < 60) s.writeCenter(H / 2 + 4, 'P1 左    P2 右', 'faint');
      } else {
        s.put(ball.x | 0, ball.y | 0, 'o', 'yellow');
      }

    }

    return { reset, update, render };
  },
};
