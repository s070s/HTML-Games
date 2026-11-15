// =============================================================================
// ENGINE: everything below uses the browser (canvas, audio, input).
// =============================================================================

// ---- Screen constants (SCREEN_W and SCREEN_H are in the rules block, with the screen layout) ------------------------
const TILE = 16;
const FONT = 'bold 8px "Segoe UI", "Trebuchet MS", Verdana, Arial, sans-serif';
const FONT_SMALL = 'bold 7px "Segoe UI", "Trebuchet MS", Verdana, Arial, sans-serif';
const FONT_FILE = 'bold 7px "Courier New", Courier, monospace';
const COLOR = {
  ink: '#1b1b2f', paper: '#f6efdc', paperDark: '#e2d6b5', border: '#1b1b2f', gold: '#f4b942', white: '#ffffff', shade: 'rgba(10,10,30,0.55)',
  hpGreen: '#4fc16a', hpYellow: '#f0c93a', hpRed: '#e0483e', hpBack: '#3a3a52', blue: '#2a5fc4', red: '#c0392b', gray: '#8a8a99', black: '#000000',
};
// TYPE_COLORS (the colour of each type) is built from data/types/ in rules/02-data.js.

