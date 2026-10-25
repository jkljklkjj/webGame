// 用 BFS 校验推箱子每一关都可解，并给出最少步数。
// 用法: node scripts/levels.mjs
import { LEVELS } from '../src/games/sokoban.js';

function parse(raw) {
  const h = raw.length;
  const w = Math.max(...raw.map((r) => r.length));
  let player = null;
  const boxes = [];
  const goals = new Set();
  const walls = new Set();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = raw[y][x] || ' ';
      if (c === '#') walls.add(y * w + x);
      if (c === '.' || c === '*' || c === '+') goals.add(y * w + x);
      if (c === '$' || c === '*') boxes.push(y * w + x);
      if (c === '@' || c === '+') player = y * w + x;
    }
  }
  return { w, h, walls, goals, boxes, player };
}

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function solve({ w, h, walls, goals, boxes, player }) {
  const goalArr = [...goals];
  const isGoalSet = (arr) => arr.every((b) => goals.has(b));
  const key = (p, bs) => p + '|' + [...bs].sort((a, b) => a - b).join(',');

  const start = { p: player, bs: boxes.slice() };
  if (isGoalSet(start.bs)) return { ok: true, steps: 0 };
  const seen = new Set([key(start.p, start.bs)]);
  let frontier = [start];
  let steps = 0;
  while (frontier.length && seen.size < 800000) {
    steps++;
    const next = [];
    for (const st of frontier) {
      const px = st.p % w, py = (st.p / w) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (walls.has(ni)) continue;
        const bi = st.bs.indexOf(ni);
        let nbs = st.bs;
        if (bi >= 0) {
          const bx = nx + dx, by = ny + dy;
          if (bx < 0 || by < 0 || bx >= w || by >= h) continue;
          const nbi = by * w + bx;
          if (walls.has(nbi) || st.bs.includes(nbi)) continue;
          nbs = st.bs.slice();
          nbs[bi] = nbi;
        }
        const k = key(ni, nbs);
        if (seen.has(k)) continue;
        seen.add(k);
        const ns = { p: ni, bs: nbs };
        if (isGoalSet(nbs)) return { ok: true, steps, visited: seen.size };
        next.push(ns);
      }
    }
    frontier = next;
  }
  return { ok: false, visited: seen.size };
}

let bad = 0;
LEVELS.forEach((raw, i) => {
  const lvl = parse(raw);
  const r = solve(lvl);
  const boxes = lvl.boxes.length;
  const tag = r.ok ? 'ok  ' : 'FAIL';
  if (!r.ok) bad++;
  console.log(`${tag} 第 ${i + 1} 关  箱子 ${boxes}  目标 ${lvl.goals.size}  ` +
    (r.ok ? `最少 ${r.steps} 步（搜索 ${r.visited} 态）` : `无解（搜索 ${r.visited} 态）`));
});
if (bad) { console.log(`\n${bad} 关不可解`); process.exit(1); }
console.log('\n全部关卡可解');
