import { clamp, randInt } from '../core/util.js';

const ROW_CHARS = ['W', 'M', 'A', 'V'];
const ROW_COLORS = ['magenta', 'violet', 'cyan', 'accent'];

export default {
  id: 'invaders',
  name: 'INVADERS',
  cn: '太空侵略者',
  desc: '打光所有外星人，别被它们压到底线',
  keys: ['←→ / AD 移动', '空格 射击'],
  create(api) {
    const { screen, input, audio } = api;
    const W = api.w, H = api.h;

    const COLS = 9, ROWS = 4, SPACING = 7;
    const FORM_X = Math.floor((W - (COLS - 1) * SPACING) / 2);
    const PLAYER_Y = H - 3;
    const GROUND_Y = H - 1;

    let player, aliens, bullets, enemyBullets, ox, oy, stepTimer, stepInterval, dir,
      lives, score, wave, ended, shootCd, killed;

    function makeAliens() {
      aliens = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          aliens.push({
            cx: FORM_X + c * SPACING,
            row: r,
            col: c,
            alive: true,
            ch: ROW_CHARS[r],
            color: ROW_COLORS[r],
          });
        }
      }
    }

    function reset() {
      player = { x: W / 2 };
      makeAliens();
      bullets = [];
      enemyBullets = [];
      ox = 0; oy = 3;
      dir = 1;
      stepTimer = 0;
      stepInterval = 0.55;
      lives = 3; score = 0; wave = 1;
      ended = false; shootCd = 0; killed = 0;
      sync();
    }

    function sync() {
      api.setStatus(`分 ${score}  波 ${wave}  命 ${lives}`);
    }

    function alienScreenX(a) { return Math.round(a.cx + ox); }
    function alienScreenY(a) { return oy + a.row; }

    function aliveAliens() { return aliens.filter((a) => a.alive); }

    function hitPlayer() {
      lives--;
      audio.lose();
      sync();
      if (lives <= 0) {
        ended = true;
        api.saveBest(score);
        api.over(`被击落 · 得分 ${score}`);
      }
    }

    function nextWave() {
      wave++;
      oy = 3;
      ox = 0;
      dir = 1;
      killed = 0;
      stepInterval = Math.max(0.08, 0.5 - (wave - 1) * 0.06);
      makeAliens();
      bullets = [];
      enemyBullets = [];
      audio.win();
      sync();
    }

    function update(dt) {
      if (ended) return;
      shootCd -= dt;

      player.x = clamp(player.x + input.axisX() * 46 * dt, 2, W - 3);

      if (input.anyPressed('space') && shootCd <= 0) {
        bullets.push({ x: Math.round(player.x), y: PLAYER_Y - 2 });
        shootCd = 0.26;
        audio.blip();
      }

      // 外星人移动
      const alive = aliveAliens();
      if (alive.length) {
        const speedScale = 1 + (1 - alive.length / aliens.length) * 1.8 + killed * 0.02;
        stepTimer += dt * speedScale;
        const edgeHit = alive.some((a) => {
          const x = alienScreenX(a);
          return (dir > 0 && x >= W - 4) || (dir < 0 && x <= 3);
        });

        if (stepTimer >= stepInterval) {
          stepTimer = 0;
          if (edgeHit) {
            oy += 2;
            dir *= -1;
          } else {
            ox += dir;
          }

          if (alive.some((a) => alienScreenY(a) >= PLAYER_Y - 2)) {
            ended = true;
            api.saveBest(score);
            api.over(`外星人压到底线 · 得分 ${score}`);
            return;
          }

          if (Math.random() < 0.35) {
            const shooter = alive[randInt(0, alive.length - 1)];
            enemyBullets.push({ x: alienScreenX(shooter), y: alienScreenY(shooter) + 1 });
          }
        }
      }

      // 玩家子弹
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y -= 52 * dt;
        let hit = false;
        for (const a of aliveAliens()) {
          if (alienScreenX(a) === b.x && alienScreenY(a) === b.y) {
            a.alive = false;
            killed++;
            score += 10 + (ROWS - a.row) * 5;
            hit = true;
            audio.hit();
            sync();
            break;
          }
        }
        if (hit || b.y < 1) bullets.splice(i, 1);
      }

      // 敌人子弹
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.y += 26 * dt;
        if (b.y >= PLAYER_Y - 1 && Math.abs(b.x - player.x) <= 1.5) {
          enemyBullets.splice(i, 1);
          hitPlayer();
          if (ended) return;
          continue;
        }
        if (b.y > GROUND_Y) enemyBullets.splice(i, 1);
      }

      if (!aliveAliens().length) nextWave();
    }

    function render(s) {
      s.clear('bg');

      for (const a of aliens) {
        if (!a.alive) continue;
        s.put(alienScreenX(a), alienScreenY(a), a.ch, a.color);
      }

      for (const b of bullets) s.put(b.x, Math.round(b.y), '|', 'yellow');
      for (const b of enemyBullets) s.put(b.x, Math.round(b.y), '!', 'red');

      const px = Math.round(player.x);
      s.write(px - 1, PLAYER_Y, '/^\\', 'cyan');

      s.hline(0, GROUND_Y, W, '─', 'accent2');
      s.write(2, 0, ` SCORE ${score} `, 'amber');
      s.writeRight(W - 3, 0, ` WAVE ${wave}  `, 'cyan');
      s.writeRight(W - 3, 1, ` LIVES ${'#'.repeat(Math.max(0, lives))}  `, 'red');
    }

    return { reset, update, render };
  },
};
