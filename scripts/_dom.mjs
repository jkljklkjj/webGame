// 测试共用的伪 DOM。浏览器里没有的东西这里都塞一份最小实现。
export function installDom() {
  const draw = { fillText: 0, fillRect: 0 };

  const ctxStub = {
    font: '', fillStyle: '', textBaseline: '', textAlign: '',
    measureText: () => ({ width: 9.63 }),
    setTransform() {},
    fillRect() { draw.fillRect++; },
    fillText() { draw.fillText++; },
  };

  const makeEl = () => ({
    style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {} },
    appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 771, height: 540 }),
    getContext: () => ctxStub,
    clientWidth: 860,
    querySelectorAll: () => [],
  });

  const store = {};

  globalThis.window = {
    devicePixelRatio: 2,
    addEventListener() {}, removeEventListener() {},
    AudioContext: null, webkitAudioContext: null,
  };
  globalThis.document = {
    readyState: 'complete', hidden: false,
    createElement: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  globalThis.performance = { now: () => 0 };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  return { makeEl, ctxStub, draw, store };
}
