import { Engine } from './core/engine.js';
import GAMES from './games/index.js';

export { GAMES };

const instances = new Set();
let activeEngine = null;

const api = {
  version: '1.2.0',
  games: GAMES,
  get active() { return activeEngine; },
  get instances() { return [...instances]; },

  /** 注册自定义游戏（挂载前调用）。 */
  register(game) {
    if (!game || !game.id || typeof game.create !== 'function') {
      throw new Error('[arcade] register() 需要 { id, name, create }');
    }
    if (GAMES.some((g) => g.id === game.id)) {
      GAMES[GAMES.findIndex((g) => g.id === game.id)] = game;
    } else {
      GAMES.push(game);
    }
    return api;
  },

  /** 在容器上挂载一个实例。 */
  mount,

  /** 键盘输入聚焦到某个实例（多实例时用）。 */
  focus(engine) { activeEngine = engine; },

  _register(engine) {
    instances.add(engine);
    if (!activeEngine) activeEngine = engine;
  },

  _unregister(engine) {
    instances.delete(engine);
    if (activeEngine === engine) activeEngine = instances.values().next().value || null;
  },
};

// 允许在 Node / SSR / 打包器的静态分析阶段直接 import 而不炸（此时没有 window）。
const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
if (hasDOM) window.TerminalArcade = api;

/**
 * mount(el, { game?: id, height?: number, muted?: boolean })
 * el 可以是 CSS 选择器或 DOM 节点。
 */
export function mount(host, opts = {}) {
  if (!hasDOM) {
    throw new Error('[arcade] mount() 需要浏览器环境（Node/SSR 下可以 import，但无法挂载）');
  }
  const el = typeof host === 'string' ? document.querySelector(host) : host;
  if (!el) throw new Error('[arcade] 找不到挂载容器: ' + host);
  const engine = new Engine(el, GAMES, opts).start();
  return engine;
}

function autoMount() {
  document.querySelectorAll('[data-arcade]').forEach((el) => {
    if (el.dataset.arcadeMounted) return;
    el.dataset.arcadeMounted = '1';
    const opts = {};
    if (el.dataset.game) opts.game = el.dataset.game;
    if (el.dataset.height) opts.height = Number(el.dataset.height);
    if (el.hasAttribute('data-muted')) opts.muted = true;
    mount(el, opts);
  });
}

if (hasDOM) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
}

export default api;

/** 注册/替换游戏。等价于 api.register()，供具名导入使用。 */
export function register(game) {
  return api.register(game);
}
