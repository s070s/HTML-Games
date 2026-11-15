// The one writer of data files (reference section 13.1): UTF-8 without BOM, LF, 2-space indent, keys in schema order, a final
// newline. Every data file is made by formatEntry (or formatJson for an index), so a diff shows only real changes. Pure text, no
// file access.
//
// Layout: an object or list that fits on one line (at most MAX_INLINE characters, and no deeper than two levels of
// containers) is written on one line, as in `[1, "promise"]` or `{ "x": 4, "y": 7 }`; a list the schema marks `as: 'rows'` (the
// rows of a map picture) always has one row per line; everything else is indented. The top level is always indented.
import { orderBySchema, schemaProblems } from './schemas.mjs';

export const MAX_INLINE = 120;
const INDENT = '  ';

function containerDepth(value) {
  if (value === null || typeof value !== 'object') return 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  return 1 + children.reduce((deepest, child) => Math.max(deepest, containerDepth(child)), 0);
}

function primitiveText(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('a data file cannot hold NaN or Infinity');
  return JSON.stringify(value);
}

function inlineText(value) {
  if (value === null || typeof value !== 'object') return primitiveText(value);
  if (Array.isArray(value)) return value.length === 0 ? '[]' : `[${value.map(inlineText).join(', ')}]`;
  const entries = Object.entries(value);
  return entries.length === 0 ? '{}' : `{ ${entries.map(([key, item]) => `${JSON.stringify(key)}: ${inlineText(item)}`).join(', ')} }`;
}

function childNode(node, key, index) {
  if (!node) return null;
  if (node.type === 'list') return node.item;
  if (node.type === 'tuple') return node.items[index] ?? null;
  if (node.type === 'dict') return node.value;
  if (node.type === 'object' && !node.open) return node.fields[key] ?? null;
  return null;
}

function render(value, node, level) {
  if (value === null || typeof value !== 'object') return primitiveText(value);
  const isList = Array.isArray(value);
  const keepRows = isList && node && node.as === 'rows';
  if (level > 0 && !keepRows && containerDepth(value) <= 2) {
    const line = inlineText(value);
    if (line.length <= MAX_INLINE) return line;
  }
  const pad = INDENT.repeat(level + 1);
  const closePad = INDENT.repeat(level);
  if (isList) {
    if (value.length === 0) return '[]';
    const lines = value.map((item, index) => pad + render(item, childNode(node, null, index), level + 1));
    return `[\n${lines.join(',\n')}\n${closePad}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  const lines = entries.map(([key, item]) => `${pad}${JSON.stringify(key)}: ${render(item, childNode(node, key, 0), level + 1)}`);
  return `{\n${lines.join(',\n')}\n${closePad}}`;
}

// Text of a JSON value; schema (optional) tells which lists are pictures.
export function formatJson(value, schema = null) {
  return `${render(value, schema, 0)}\n`;
}

// Text of one data entry of a kind: checked against its schema, keys in schema order.
export function formatEntry(schema, value) {
  const problems = schemaProblems(schema, value);
  if (problems.length > 0) throw new Error(`the entry does not fit its schema: ${problems.slice(0, 5).join('; ')}`);
  return formatJson(orderBySchema(schema, value), schema);
}
