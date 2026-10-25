// 终端调色板：名字 -> CSS 颜色。游戏里直接写字符串名字。
//
// 主色是橙色：界面骨架（边框、标题、状态栏、按钮提示）用 accent / accent2，
// 其余色相留给游戏内容（棋子、砖块、外星人……），保证画面不是一片橙。
export const COLORS = {
  bg:      '#0f0a06',
  bg2:     '#19110a',
  bg3:     '#2a1b0d',

  default: '#f0d8bd',   // 正文暖白
  dim:     '#93714f',
  faint:   '#4e3a26',
  white:   '#fff4e6',

  accent:  '#ff9d2e',   // 主色：橙
  accent2: '#b96c14',   // 主色暗版：边框、分隔线、次要标题

  amber:   '#ffc355',
  yellow:  '#ffe27a',
  red:     '#ff5a52',
  red2:    '#a83232',
  cyan:    '#5ad7e6',
  blue:    '#6d9cff',
  magenta: '#ff7ae0',
  violet:  '#b48cff',
  orange:  '#ff8a1f',
  green:   '#5fd97c',   // 留给棋子/“完成”态，保持可辨
};

export function css(name, fallback) {
  if (!name) return COLORS[fallback || 'default'];
  return COLORS[name] || name;
}
