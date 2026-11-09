// usage: node extract.js <breakpoint.html> [out=game.js]  -> inline game script with the boot(); line replaced by an eval hook
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
const start = html.indexOf('<script>');
const end = html.lastIndexOf('</script>');
if (start < 0 || end < 0) throw new Error('no inline script found');
let script = html.slice(start + '<script>'.length, end);
const bootLine = /^boot\(\);$/m;
if (!bootLine.test(script)) throw new Error('boot(); line not found');
script = script.replace(bootLine, 'globalThis.__ev = (s) => eval(s);');
const out = process.argv[3] || path.join(__dirname, 'game.js');
fs.writeFileSync(out, script);
console.log('wrote', out, script.length, 'chars');
