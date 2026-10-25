// 游戏总目录：加新游戏只要在这里 import 一次并放进数组。
// 想让游戏进默认菜单，只改这个文件就够了。
import pong from './pong.js';
import hockey from './hockey.js';
import snake from './snake.js';
import breakout from './breakout.js';
import tetris from './tetris.js';
import g2048 from './g2048.js';
import mines from './mines.js';
import invaders from './invaders.js';
import runner from './runner.js';
import sokoban from './sokoban.js';
import lights from './lights.js';
import duel from './duel.js';

export const GAMES = [
  pong,
  hockey,
  snake,
  breakout,
  tetris,
  g2048,
  mines,
  invaders,
  runner,
  sokoban,
  lights,
  duel,
];

export default GAMES;
