// Validation of the data (reference section 13.6). DEV-02b holds only the marker-text rule; DEV-02c extends this file with the
// full validation (references, indexes, tiers). A finding is { severity, rule, kind, id, field, message: { en, el } }.
//
// The marker-text rule (13.2): no string anywhere in the data may contain a text that marks a place in the page. The data is
// inserted into the page script, and a marker inside it would make the page ambiguous for the assembler and the tests.

// Every marker text of 13.2. A match anywhere in a string is refused, not only a whole line, because the text could end up on a
// line of its own after an edit of the page.
export const MARKER_TEXTS = Object.freeze(['// RULES-BEGIN', '// RULES-END', '/*DATA-BEGIN*/', '/*DATA-END*/', '/*@@']);
export const MARKER_TEXT_RULE = 'marker-text';

function markerFinding(kind, id, field, marker) {
  return {
    severity: 'error',
    rule: MARKER_TEXT_RULE,
    kind,
    id,
    field,
    message: {
      en: `The text contains "${marker}", which marks a place in the page. Remove it.`,
      el: `Το κείμενο περιέχει «${marker}», που σημαδεύει θέση στη σελίδα. Αφαιρέστε το.`,
    },
  };
}

// The text of a key counts too: a key such as "/*@@" would be written into the page as well. path is a list of segments.
function scan(value, path, found) {
  if (typeof value === 'string') {
    for (const marker of MARKER_TEXTS) if (value.includes(marker)) found.push({ path, marker });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, [...path, `[${index}]`], found));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      for (const marker of MARKER_TEXTS) if (key.includes(marker)) found.push({ path: [...path, `{key ${JSON.stringify(key)}}`], marker });
      scan(item, [...path, key], found);
    }
  }
}

// data is the DATA object: { kind: { id: entry } } (game and world are the entries themselves). Returns the findings.
export function markerTextFindings(data) {
  const findings = [];
  for (const [kind, kindValue] of Object.entries(data)) {
    const found = [];
    scan(kindValue, [], found);
    for (const { path, marker } of found) {
      const [id = '', ...field] = path;
      findings.push(markerFinding(kind, id, field.join('.'), marker));
    }
  }
  return findings;
}

// Throws one error that names every place; used by the assembler.
export function assertNoMarkerTexts(data) {
  const findings = markerTextFindings(data);
  if (findings.length === 0) return;
  const places = findings.slice(0, 5).map((finding) => `${finding.kind}/${finding.id}${finding.field ? '.' + finding.field : ''}`);
  throw new Error(`a data string contains a marker text of the page: ${places.join('; ')}${findings.length > 5 ? ` (and ${findings.length - 5} more)` : ''}`);
}
