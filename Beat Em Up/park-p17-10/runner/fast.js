// fast loader: runs the game script inside a plain function (no vm context), with the harness stubs passed as parameters
const fs = require('fs'), path = require('path'), vm = require('vm');
const RUNNER = 'C:/Users/GS/AppData/Local/Temp/claude/bp1710b';
const harnessSrc = fs.readFileSync(path.join(RUNNER, 'harness.js'), 'utf8');
const head = harnessSrc.slice(0, harnessSrc.indexOf('async function main'));
module.exports = function loadFast(gamePath) {
  const mod = { exports: {} };
  new Function('require', 'module', '__dirname', 'process', head.replace(/const gamePath = .*;/, 'const gamePath = "";') + '\nmodule.exports = { sandbox };')(require, mod, RUNNER, process);
  const { sandbox } = mod.exports;
  const names = Object.keys(sandbox).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && !['console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'queueMicrotask', 'performance', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'JSON', 'Math', 'Date', 'Number', 'String', 'Object', 'Array', 'Error', 'TypeError', 'RangeError', 'Reflect', 'Proxy', 'Float32Array', 'Float64Array', 'Int32Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'Uint16Array', 'Int16Array', 'Int8Array', 'ArrayBuffer', 'DataView', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'atob', 'btoa', 'encodeURIComponent', 'decodeURIComponent', 'isFinite', 'isNaN', 'parseFloat', 'parseInt'].includes(k));
  const code = fs.readFileSync(gamePath, 'utf8');
  const fn = new Function(...names, code + '\nreturn globalThis.__ev;');
  // globalThis inside the function is still the real global, but the game sets globalThis.__ev: read it back from there
  fn(...names.map((k) => sandbox[k]));
  const ev = sandbox.__ev;
  ev("Store.init(); Settings.init(); Keymap.init(); Keymap2.init(); Progress.init(); CustomRoster.init(); Debris.init(); FX.init(); Inputs.init(); Effects.init();");
  return { ev, sandbox };
};
