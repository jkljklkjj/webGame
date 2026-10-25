// 极简 ESM -> 单文件 IIFE 打包器。只支持本项目用到的语法：
//   import {a, b} from './x.js' / import X from './x.js'
//   export const / export function / export class / export {a,b} / export default
// 产出 dist/terminal-arcade.js、dist/terminal-arcade.css、dist/demo.html（全内联，file:// 可直开）
// 用法: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'src/main.js';

function norm(p) {
  return posix.normalize(p.replace(/\\/g, '/'));
}

function resolveSpec(fromId, spec) {
  return norm(posix.join(posix.dirname(fromId), spec));
}

function read(id) {
  return readFileSync(join(ROOT, id), 'utf8');
}

/** 把一个模块转成 IIFE 函数体 */
function transform(id, src) {
  const deps = [];
  let out = src;

  // import ... from '...'
  out = out.replace(
    /^[ \t]*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (m, clause, spec) => {
      const dep = resolveSpec(id, spec);
      deps.push(dep);
      const c = clause.trim();
      if (c.startsWith('{')) {
        const names = c.slice(1, c.lastIndexOf('}')).trim();
        return `const { ${names} } = __req(${JSON.stringify(dep)});`;
      }
      return `const ${c} = __req(${JSON.stringify(dep)}).default;`;
    }
  );

  const exported = [];

  // export default
  out = out.replace(/^[ \t]*export\s+default\s+/m, '__exports.default = ');

  // export { a, b as c };
  out = out.replace(/^[ \t]*export\s*\{([^}]*)\};?[ \t]*$/gm, (m, body) => {
    return body
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [local, alias] = s.split(/\s+as\s+/).map((x) => x.trim());
        return `__exports.${alias || local} = ${local};`;
      })
      .join(' ');
  });

  // export const / let / function / class / async function
  out = out.replace(
    /^[ \t]*export\s+(const|let|var|function\*?|async\s+function|class)\s+([A-Za-z_$][\w$]*)/gm,
    (m, kind, name) => {
      exported.push(name);
      return m.replace(/^([ \t]*)export\s+/, '$1');
    }
  );

  const tail = exported.map((n) => `__exports.${n} = ${n};`).join('\n  ');
  return { code: out, deps, tail };
}

// ---- 从入口抓模块图 ----
const modules = new Map();
const order = [];

function visit(id) {
  if (modules.has(id)) return;
  modules.set(id, null);
  const src = read(id);
  const { code, deps, tail } = transform(id, src);
  modules.set(id, { code, tail });
  for (const d of deps) visit(d);
  order.push(id); // 后序：依赖先入列
}

visit(ENTRY);

const body = order
  .map((id) => {
    const m = modules.get(id);
    const code = m.code.split('\n').map((l) => '    ' + l).join('\n');
    return `  // ---- ${id} ----\n  __defs[${JSON.stringify(id)}] = function (__exports, __req) {\n${code}\n    ${m.tail}\n  };`;
  })
  .join('\n\n');

const BANNER = `/*! TERMINAL ARCADE — 字符终端小游戏框架（单文件构建）
 *  纯 canvas 字符网格渲染，零依赖。
 *  用法：<link rel="stylesheet" href="terminal-arcade.css"> +
 *        <div data-arcade></div> + 引入本文件即可
 */`;

const bundle = `${BANNER}
(function () {
  'use strict';
  if (window.__terminalArcadeLoaded) return;
  window.__terminalArcadeLoaded = true;

  var __defs = {};
  var __cache = {};

  function __req(id) {
    var cached = __cache[id];
    if (cached) return cached;
    var mod = (__cache[id] = {});
    var def = __defs[id];
    if (!def) throw new Error('[arcade] 模块未打包: ' + id);
    def(mod, __req);
    return mod;
  }

${body}

  __req(${JSON.stringify(ENTRY)});
})();
`;

// ---- 输出 ----
const outDir = join(ROOT, 'dist');
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'terminal-arcade.js'), bundle, 'utf8');

const css = read('styles.css');
writeFileSync(join(outDir, 'terminal-arcade.css'), css, 'utf8');

// demo：把 index.html 的 link/script 换成内联，双击即可运行
let html = read('index.html');
html = html.replace(
  /<link rel="stylesheet" href="\.\/styles\.css" \/>/,
  () => `<style>\n${css}\n</style>`
);
html = html.replace(
  /<script type="module" src="\.\/src\/main\.js"><\/script>/,
  () => `<script>\n${bundle}\n</script>`
);
html = html.replace(
  /<div id="arcade" data-arcade><\/div>/,
  '<div id="arcade" data-arcade></div>'
);
writeFileSync(join(outDir, 'demo.html'), html, 'utf8');

const kb = (p) => (statSync(join(outDir, p)).size / 1024).toFixed(1) + ' KB';
console.log(`打包完成：${order.length} 个模块`);
for (const f of ['terminal-arcade.js', 'terminal-arcade.css', 'demo.html']) {
  console.log(`  dist/${f.padEnd(22)} ${kb(f)}`);
}
console.log('\n双击 dist/demo.html 即可离线运行（无需服务器）。');
