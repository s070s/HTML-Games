var setStrings = (s, text) => { MOVE_STYLE[s].strings = text; for (const k in STYLE_STRING_TABLES) delete STYLE_STRING_TABLES[k]; };
var setAiw = (s, text) => { MOVE_STYLE[s].aiw = text; const w = AIW_WEIGHTS[s]; for (const k in w) delete w[k]; for (const e of text.split(' ').filter(Boolean)) w[e.split('@')[0]] = Number(e.split(':')[1]); };
var setSkin = (s, row, skin) => { if (skin) SKINS[s][row] = skin; else delete SKINS[s][row]; delete SKIN_CACHE[s]; };
var setRow = (id, over) => { Object.assign(ATTACKS[id], over); for (const s in SKIN_CACHE) delete SKIN_CACHE[s]; };
var setDef = (s, d) => { MOVE_STYLE[s].defense = d; };
