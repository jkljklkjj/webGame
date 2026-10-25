/**
 * embed.js —— 一行接入用的经典脚本加载器。
 *
 *   <link rel="stylesheet" href="styles.css">
 *   <div data-arcade data-game="pong" data-height="520"></div>
 *   <script src="embed.js"></script>
 *
 * 它会按自身路径推出 src/main.js 的位置，再以 module 方式加载，
 * 所以整个目录可以整体搬到任意静态站点下。
 */
(function () {
  var me = document.currentScript;
  if (!me) return;
  var base = me.src.replace(/[^/]*$/, '');
  if (window.__terminalArcadeLoaded) return;
  window.__terminalArcadeLoaded = true;

  var s = document.createElement('script');
  s.type = 'module';
  s.src = base + 'src/main.js';
  s.onerror = function () {
    console.error('[arcade] 无法加载 src/main.js，请检查 embed.js 与 src/ 是否在同一目录下');
  };
  document.head.appendChild(s);

  // 提前给容器一个占位高度，避免布局跳动
  document.querySelectorAll('[data-arcade]').forEach(function (el) {
    if (!el.style.minHeight) el.style.minHeight = (el.dataset.height ? el.dataset.height / 1.8 : 320) + 'px';
  });
})();
