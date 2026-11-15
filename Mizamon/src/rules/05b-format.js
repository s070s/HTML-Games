// ---- Formatting helpers (strings table is below) ------------------------------------
// Template syntax: {name} is replaced from vars; {m|f} picks the masculine or feminine
// wording of the player's gender ("m" or "f").
function formatText(template, vars, gender) {
  return template
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, function (all, masculine, feminine) { return gender === 'f' ? feminine : masculine; })
    .replace(/\{(\w+)\}/g, function (all, name) { return vars && vars[name] !== undefined ? String(vars[name]) : all; });
}
function lookupString(key, lang) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const text = lang === 'en' ? entry[1] : entry[0];
  return text === undefined || text === '' ? entry[0] : text;
}

