// 校验这个仓库作为 npm 包是否成立：Node 里能不能 import、exports 映射能不能解析、
// 类型声明和 files 清单是否对得上。不联网、不需要浏览器。
// 用法: node scripts/pkg-test.mjs
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

let fail = 0;
async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  ok    ${name}${detail ? `  (${detail})` : ''}`);
  } catch (err) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log(`pkg-test: ${pkg.name}@${pkg.version}`);

// ---- 1. 包元信息 ----
await check('name 合法且不是已被占用的 terminal-arcade', () => {
  assert(/^[a-z0-9][a-z0-9._-]*$/.test(pkg.name) && pkg.name.length <= 214, '名字不合法');
  assert(pkg.name !== 'terminal-arcade', 'terminal-arcade 已归属他人');
  return pkg.name;
});

await check('version 是语义化版本', () => {
  assert(/^\d+\.\d+\.\d+/.test(pkg.version), pkg.version);
  return pkg.version;
});

await check('没有 private 标记', () => {
  assert(!pkg.private, 'private:true 会阻止 npm publish');
  return 'ok';
});

await check('type=module', () => {
  assert(pkg.type === 'module', pkg.type);
  return 'ok';
});

// ---- 2. files 清单里的东西都真的存在 ----
await check('files 清单全部存在', () => {
  const missing = pkg.files.filter((f) => !existsSync(join(ROOT, f)));
  assert(!missing.length, `缺失: ${missing.join(', ')}`);
  return `${pkg.files.length} 项`;
});

// ---- 3. exports 映射的目标都存在 ----
await check('exports 目标全部存在', () => {
  const targets = [];
  const walk = (v) => {
    if (typeof v === 'string') targets.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(pkg.exports);
  const bad = targets.filter((t) => !t.includes('*') && !existsSync(join(ROOT, t)));
  assert(!bad.length, `缺失: ${bad.join(', ')}`);
  return `${targets.length} 个入口`;
});

await check('exports.types 指向 .d.ts 且文件存在', () => {
  for (const key of ['.', './games', './core/input.js']) {
    const t = pkg.exports[key]?.types;
    assert(t && t.endsWith('.d.ts'), `${key} 缺少 types`);
    assert(existsSync(join(ROOT, t)), `${key} 的 ${t} 不存在`);
  }
  return '3 个带类型声明';
});

await check('类型声明文件可被解析（非空 + 有 export + 括号配对）', () => {
  const files = [pkg.types, './types/games.d.ts', './types/core-input.d.ts'];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert(src.trim().length > 50, `${f} 内容太短`);
    assert(/export\s/.test(src), `${f} 没有 export`);
    const open = (src.match(/\{/g) || []).length;
    const close = (src.match(/\}/g) || []).length;
    assert(open === close, `${f} 括号不配对 (${open} vs ${close})`);
  }
  return files.join(', ');
});

// ---- 4. Node 里 import 不应该炸（无 DOM 环境）----
await check('Node 无 DOM 下可以 import（SSR 安全）', async () => {
  assert(typeof globalThis.window === 'undefined', '本测试要求无 window 环境');
  const m = await import('../src/main.js');
  for (const k of ['mount', 'register', 'GAMES', 'default']) assert(k in m, `缺少导出 ${k}`);
  assert(typeof m.default.mount === 'function', 'default 导出上没有 mount');
  assert(m.GAMES.length === 12, `内置游戏数量应为 12，实际 ${m.GAMES.length}`);
  return `${m.GAMES.length} games`;
});

await check('无 DOM 时 mount() 给出明确报错', async () => {
  const { mount } = await import('../src/main.js');
  let msg = '';
  try {
    mount('#arcade');
  } catch (err) {
    msg = err.message;
  }
  assert(/浏览器环境/.test(msg), `报错信息不明确: ${msg}`);
  return 'ok';
});

await check('包自引用 import 能走通 exports 映射', async () => {
  const m = await import(pkg.name);
  assert(typeof m.mount === 'function', '自引用拿不到 mount');
  const input = await import(`${pkg.name}/core/input.js`);
  assert(input.PAD_CODES?.[1]?.up?.[0] === 'KeyW', 'PAD_CODES 不对');
  return `${pkg.name} + ${pkg.name}/core/input.js`;
});

await check('自引用能解析 style.css 与 ./games', async () => {
  const css = import.meta.resolve(`${pkg.name}/style.css`);
  assert(css.endsWith('/styles.css'), css);
  const g = await import(`${pkg.name}/games`);
  assert(g.GAMES?.length === 12 || g.default?.length === 12, 'games 入口拿不到注册表');
  return 'style.css + games';
});

// ---- 5. 构建产物 ----
await check('dist 产物存在且不像空壳', () => {
  const js = join(ROOT, 'dist/terminal-arcade.js');
  assert(existsSync(js), '缺少 dist/terminal-arcade.js，先 npm run build');
  const size = statSync(js).size;
  assert(size > 60 * 1024, `产物只有 ${(size / 1024).toFixed(1)} KB，疑似不完整`);
  assert(existsSync(join(ROOT, 'dist/terminal-arcade.css')), '缺少 css 产物');
  return `${(size / 1024).toFixed(1)} KB`;
});

// ---- 6. 发布前的琐碎约定 ----
await check('LICENSE 与 README 就位', () => {
  assert(existsSync(join(ROOT, 'LICENSE')), '缺 LICENSE');
  assert(existsSync(join(ROOT, 'README.md')), '缺 README');
  return 'ok';
});

console.log(fail ? `\npkg-test 失败 ${fail} 项` : '\npkg-test 全部通过');
process.exit(fail ? 1 : 0);
