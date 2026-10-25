import { COLORS, css } from './palette.js';

const FONT_STACK =
  'ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

const BOX = {
  single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', lt: '├', rt: '┤' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', lt: '╠', rt: '╣' },
  round:  { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', lt: '├', rt: '┤' },
  ascii:  { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', lt: '+', rt: '+' },
};

const CONT = '\u0000'; // 宽字符的占位格

/** 全角/宽字符判断（CJK、假名、谚文、全角标点、常见 emoji） */
export function isWide(ch) {
  if (!ch) return false;
  const c = ch.codePointAt(0);
  if (c < 0x1100) return false;
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0x303e) ||
    (c >= 0x3041 && c <= 0x33ff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0xa000 && c <= 0xa4cf) ||
    (c >= 0xa960 && c <= 0xa97f) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe10 && c <= 0xfe19) ||
    (c >= 0xfe30 && c <= 0xfe6f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1f9ff) ||
    (c >= 0x20000 && c <= 0x3fffd)
  );
}

/** 字符串占用的网格宽度 */
export function strWidth(str) {
  let n = 0;
  for (const ch of String(str)) n += isWide(ch) ? 2 : 1;
  return n;
}

/**
 * 字符缓冲层。游戏只往这个网格里写字符和颜色，
 * 渲染时按"同色连续段"批量 fillText，一帧几十次绘制即可。
 * 宽字符（中文）占两格，第二格是占位符，渲染时单独处理以保证对齐。
 */
export class Screen {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.ch = new Array(n).fill(' ');
    this.fg = new Array(n).fill(null);
    this.bg = new Array(n).fill(null);
    this.wide = new Uint8Array(n); // 1=宽字符首格 2=占位格
    this.dpr = 1;
    this.cellW = 10;
    this.cellH = 16;
    this.pxW = 800;
    this.pxH = 576;
    this.font = `16px ${FONT_STACK}`;
  }

  layout(ctx) {
    const size = 16;
    this.font = `${size}px ${FONT_STACK}`;
    ctx.font = this.font;
    const adv = ctx.measureText('MMMMMMMMMM').width / 10;
    this.cellW = adv;
    this.cellH = Math.round(adv * 1.58);
    this.pxW = Math.ceil(adv * this.cols);
    this.pxH = this.cellH * this.rows;
  }

  width(str) { return strWidth(str); }

  clear(bg = 'bg') {
    this.ch.fill(' ');
    this.fg.fill(null);
    this.bg.fill(bg);
    this.wide.fill(0);
  }

  put(x, y, ch, fg = null, bg = null) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    ch = ch === '' ? ' ' : ch;
    const i = y * this.cols + x;
    const prev = this.wide[i];

    // 覆盖宽字符的任意一半时，把另一半擦掉，避免残影
    if (prev === 1 && x + 1 < this.cols) {
      const j = i + 1;
      this.ch[j] = ' '; this.fg[j] = fg; this.bg[j] = bg; this.wide[j] = 0;
    } else if (prev === 2 && x - 1 >= 0) {
      const j = i - 1;
      this.ch[j] = ' '; this.fg[j] = fg; this.bg[j] = bg; this.wide[j] = 0;
    }

    this.ch[i] = ch;
    this.fg[i] = fg;
    this.bg[i] = bg;

    if (isWide(ch)) {
      this.wide[i] = 1;
      if (x + 1 < this.cols) {
        const j = i + 1;
        this.ch[j] = CONT; this.fg[j] = fg; this.bg[j] = bg; this.wide[j] = 2;
      }
    } else {
      this.wide[i] = 0;
    }
  }

  write(x, y, str, fg = null, bg = null) {
    str = String(str);
    let cx = x | 0;
    const cy = y | 0;
    for (const ch of str) {
      this.put(cx, cy, ch, fg, bg);
      cx += isWide(ch) ? 2 : 1;
    }
  }

  writeCenter(y, str, fg = null, bg = null) {
    str = String(str);
    this.write(Math.floor((this.cols - strWidth(str)) / 2), y, str, fg, bg);
  }

  writeRight(xRight, y, str, fg = null, bg = null) {
    str = String(str);
    this.write(xRight - strWidth(str) + 1, y, str, fg, bg);
  }

  fill(x, y, w, h, ch = ' ', fg = null, bg = null) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) this.put(x + i, y + j, ch, fg, bg);
    }
  }

  hline(x, y, w, ch = '─', fg = null, bg = null) {
    for (let i = 0; i < w; i++) this.put(x + i, y, ch, fg, bg);
  }

  vline(x, y, h, ch = '│', fg = null, bg = null) {
    for (let j = 0; j < h; j++) this.put(x, y + j, ch, fg, bg);
  }

  /** 边框盒。title 画在顶边上，宽字符也算对。 */
  box(x, y, w, h, fg = 'dim', bg = null, style = 'single', title = '') {
    const B = BOX[style] || BOX.single;
    if (w < 2 || h < 2) return;
    this.put(x, y, B.tl, fg, bg);
    this.put(x + w - 1, y, B.tr, fg, bg);
    this.put(x, y + h - 1, B.bl, fg, bg);
    this.put(x + w - 1, y + h - 1, B.br, fg, bg);
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, B.h, fg, bg);
      this.put(x + i, y + h - 1, B.h, fg, bg);
    }
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, B.v, fg, bg);
      this.put(x + w - 1, y + j, B.v, fg, bg);
    }
    if (title) {
      const room = w - 4;
      let t = '';
      let used = 0;
      for (const ch of ` ${title} `) {
        const cw = isWide(ch) ? 2 : 1;
        if (used + cw > room) break;
        t += ch;
        used += cw;
      }
      this.write(x + 2, y, t, 'accent', bg);
    }
  }

  render(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.pxW, this.pxH);
    ctx.font = this.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const { cols, rows, cellW, cellH } = this;

    for (let y = 0; y < rows; y++) {
      const rowBase = y * cols;
      const py = y * cellH;
      const ty = py + cellH * 0.56;
      let x = 0;

      while (x < cols) {
        const i = rowBase + x;
        const wf = this.wide[i];

        // 宽字符占位格：只补背景
        if (wf === 2) {
          if (this.bg[i]) {
            ctx.fillStyle = css(this.bg[i], 'bg');
            ctx.fillRect(x * cellW, py, cellW, cellH);
          }
          x++;
          continue;
        }

        // 宽字符本体：单独画（它的推进宽度不等于 cellW）
        if (wf === 1) {
          if (this.bg[i]) {
            ctx.fillStyle = css(this.bg[i], 'bg');
            ctx.fillRect(x * cellW, py, cellW * 2, cellH);
          }
          ctx.fillStyle = css(this.fg[i], 'default');
          ctx.fillText(this.ch[i], x * cellW, ty);
          x += 2;
          continue;
        }

        // 普通字符：攒一段同色连续段，一次 fillText 画完
        const ch = this.ch[i];
        const bg = this.bg[i];
        if (ch === ' ' && !bg) { x++; continue; }

        const fg = this.fg[i];
        let run = '';
        const x0 = x;
        while (x < cols) {
          const j = rowBase + x;
          if (this.wide[j] !== 0) break;
          if (this.fg[j] !== fg || this.bg[j] !== bg) break;
          if (this.ch[j] === ' ' && !bg) break;
          run += this.ch[j];
          x++;
        }

        if (bg) {
          ctx.fillStyle = css(bg, 'bg');
          ctx.fillRect(x0 * cellW, py, (x - x0) * cellW, cellH);
        }
        if (run.trim()) {
          ctx.fillStyle = css(fg, 'default');
          ctx.fillText(run, x0 * cellW, ty);
        }
      }
    }
  }

  flush(ctx) { this.render(ctx); }

  /** 调试用：导出为纯文本 */
  text() {
    const out = [];
    for (let y = 0; y < this.rows; y++) {
      let line = '';
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        if (this.wide[i] === 2) continue;
        line += this.ch[i] === CONT ? ' ' : this.ch[i];
      }
      out.push(line.replace(/\s+$/, ''));
    }
    return out.join('\n');
  }
}
