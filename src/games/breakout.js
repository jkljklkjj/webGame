import { clamp } from '../core/util.js';

export default {
  id: 'breakout',
  name: 'BREAKOUT',
  cn: '打砖块',
  desc: '清空所有砖块，别让球落地',
  keys: ['←→ / AD 移动挡板', '空格 发球'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;

    const COLS = 13, ROWS = 6, BW = 5, GAP = 1;
    const X0 = 1, Y0 = 3;
    const PADDLE_W = 9, PADDLE_Y = H - 3;

    const ROW_COLORS = ['red', 'magenta', 'violet', 'blue', 'cyan', 'accent'];

    let bricks, paddle, ball, lives, score, level, stuck, ended, bricksLeft, t;

    function buildBricks() {
      bricks = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          bricks.push({
            x: X0 + c * (BW + GAP),
            y: Y0 + r,
            w: BW,
            h: 1,
            hp: r === 0 ? 2 : 1,
            color: ROW_COLORS[r % ROW_COLORS.length],
            alive: true,
          });
        }
      }
      bricksLeft = bricks.length;
    }

    function reset() {
      lives = 3;
      score = 0;
      level = 1;
      ended = false;
      t = 0;
      buildBricks();
      paddle = { x: (W - PADDLE_W) / 2, w: PADDLE_W };
      newBall();
      api.setStatus('L1  命 3  分 0');
    }

    function newBall() {
      const speed = 30 + (level - 1) * 5;
      ball = { x: paddle.x + paddle.w / 2, y: PADDLE_Y - 2, vx: 0, vy: 0, speed };
      stuck = true;
    }

    function launch() {
      const ang = (-Math.PI / 2) + (Math.random() - 0.5) * 0.7;
      ball.vx = Math.cos(ang) * ball.speed;
      ball.vy = Math.sin(ang) * ball.speed;
      stuck = false;
      audio.bounce();
    }

    function sync() {
      api.setStatus(`L${level}  命 ${lives}  分 ${score}`);
    }

    function loseLife() {
      audio.lose();
      lives--;
      sync();
      if (lives <= 0) {
        ended = true;
        api.saveBest(score);
        api.over(`球落地了 · 得分 ${score}`);
      } else {
        newBall();
      }
    }

    function updatePaddle(dt) {
      if (input.pointer.active) {
        paddle.x += clamp(input.pointer.x - paddle.w / 2 - paddle.x, -120 * dt, 120 * dt);
      } else {
        paddle.x += input.axisX() * 46 * dt;
      }
      paddle.x = clamp(paddle.x, 1, W - paddle.w - 1);
    }

    function update(dt) {
      if (ended) return;
      t += dt;
      updatePaddle(dt);

      if (stuck) {
        ball.x = paddle.x + paddle.w / 2;
        ball.y = PADDLE_Y - 2;
        if (input.anyPressed('space', 'enter', 'up')) launch();
        return;
      }

      const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 0.6));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        ball.x += ball.vx * sdt;
        ball.y += ball.vy * sdt;

        if (ball.x < 1) { ball.x = 1; ball.vx = Math.abs(ball.vx); audio.hit(); }
        if (ball.x > W - 2) { ball.x = W - 2; ball.vx = -Math.abs(ball.vx); audio.hit(); }
        if (ball.y < 1) { ball.y = 1; ball.vy = Math.abs(ball.vy); audio.hit(); }

        // 挡板
        if (ball.vy > 0 && ball.y >= PADDLE_Y - 0.5 && ball.y <= PADDLE_Y + 1 &&
            ball.x >= paddle.x - 0.5 && ball.x <= paddle.x + paddle.w + 0.5) {
          const off = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
          const ang = -Math.PI / 2 + off * 1.05;
          ball.speed = Math.min(ball.speed * 1.02, 62);
          ball.vx = Math.cos(ang) * ball.speed;
          ball.vy = Math.sin(ang) * ball.speed;
          ball.y = PADDLE_Y - 0.6;
          audio.bounce();
        }

        // 砖块
        for (const b of bricks) {
          if (!b.alive) continue;
          if (ball.x >= b.x - 0.5 && ball.x <= b.x + b.w + 0.5 &&
              ball.y >= b.y - 0.5 && ball.y <= b.y + b.h + 0.5) {
            // 从更近的一侧反射：横向距离小就翻 vx，否则翻 vy
            const dx = Math.min(Math.abs(ball.x - b.x), Math.abs(ball.x - (b.x + b.w)));
            const dy = Math.min(Math.abs(ball.y - b.y), Math.abs(ball.y - (b.y + b.h)));
            if (dx < dy) ball.vx = -ball.vx;
            else ball.vy = -ball.vy;

            b.hp--;
            if (b.hp <= 0) {
              b.alive = false;
              bricksLeft--;
              score += 10 + (level - 1) * 5;
              audio.blip();
            } else {
              score += 3;
              audio.hit();
            }
            sync();
            break;
          }
        }

        if (ball.y > H) { loseLife(); return; }
      }

      if (bricksLeft <= 0) {
        level++;
        buildBricks();
        newBall();
        audio.win();
        sync();
      }
    }

    function render(s) {
      s.box(0, 0, W, H, 'accent2', 'bg', 'single', 'BREAKOUT');
      s.write(W - 12, 1, `L${level}`, 'cyan');
      s.writeRight(W - 3, 1, `命 ${'o'.repeat(Math.max(0, lives))}`, 'red');

      for (const b of bricks) {
        if (!b.alive) continue;
        const ch = b.hp > 1 ? '▓' : '▒';
        s.fill(b.x, b.y, b.w, b.h, ch, b.color);
      }

      s.fill(Math.round(paddle.x), PADDLE_Y, paddle.w, 1, '═', 'cyan');

      s.put(Math.round(ball.x), Math.round(ball.y), 'o', 'yellow');
      if (stuck && Math.floor(t * 2) % 2 === 0) {
        s.writeCenter(PADDLE_Y - 4, '空格 / ↑ 发球', 'dim');
      }


    }

    return { reset, update, render };
  },
};
