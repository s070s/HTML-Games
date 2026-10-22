// ==== S03 DATA CATALOGUES ====
// Every catalogue is declared once with Data.define(name, schema, rows). Rows are plain object literals;
// missing optional fields take the schema default (DATA-004). Files 03-data-*.js hold the catalogues.

const REQUIRED = Symbol('required');   // schema marker: field has no default and must be present
const CAT = {};                        // CAT.<name> = normalized rows, CAT.<name>.byId(id) for lookup

const Data = {
  schemas: {},
  // schema: { field: defaultValue | REQUIRED }. A default of null means "any type, optional".
  define(name, schema, rows) {
    if (CAT[name]) throw new Error('catalogue defined twice: ' + name);
    this.schemas[name] = schema;
    const normalized = rows.map((row) => this.normalize(schema, row));
    const index = new Map(normalized.map((row) => [row.id, row]));
    normalized.byId = (id) => index.get(id) || null;
    CAT[name] = normalized;
    return normalized;
  },
  normalize(schema, row) {
    const result = {};
    for (const field in schema) {
      const fallback = schema[field];
      if (row[field] !== undefined) result[field] = row[field];
      else if (fallback !== REQUIRED) result[field] = cloneDefault(fallback);
    }
    for (const field in row) if (!(field in schema)) result[field] = row[field]; // validate() reports these
    return result;
  },
  // Returns a list of problem strings for one catalogue (used by the data self-test, ARC-031).
  validate(name) {
    const schema = this.schemas[name], rows = CAT[name], problems = [], seen = new Set();
    rows.forEach((row, index) => {
      const label = name + '[' + index + '] ' + (row.id || '?');
      if (seen.has(row.id)) problems.push(label + ': duplicate id');
      seen.add(row.id);
      for (const field in schema) {
        const fallback = schema[field];
        if (fallback === REQUIRED && row[field] === undefined) problems.push(label + ': missing ' + field);
        if (fallback !== REQUIRED && fallback !== null && row[field] !== undefined && row[field] !== null && typeof row[field] !== typeof fallback) {
          problems.push(label + ': ' + field + ' should be ' + typeof fallback + ', got ' + typeof row[field]);
        }
      }
      for (const field in row) if (!(field in schema)) problems.push(label + ': unknown field ' + field);
    });
    return problems;
  },
};

function cloneDefault(value) {
  if (Array.isArray(value)) return value.slice();
  if (value && typeof value === 'object') return Object.assign({}, value);
  return value;
}

// Quality presets (PERF-004, PERF-007..PERF-010, REN-008). Every system that scales by quality reads this table.
// modelDetail: false skips the small detail parts of near models (actor body `detail` parts, static model lod 0 parts).
Data.define('quality', {
  id: REQUIRED, name: REQUIRED, renderScaleMin: 0.5, renderScaleMax: 1, drawCalls: 110, triangles: 250000,
  bots: 15, enemies: 24, particles: 1024, decals: 64, lights: 2, props: 16, shadows: 'blob', msaa: 0, post: true,
  lodNear: 30, lodFar: 80, viewDistance: 160, voices: 24, music: true, modelDetail: true,
}, [
  { id: 'ultra', name: 'Ultra', drawCalls: 200, triangles: 600000, bots: 23, enemies: 40, particles: 4096, decals: 128, lights: 8, props: 32, shadows: 'sun', msaa: 2, lodNear: 50, lodFar: 140, viewDistance: 260 },
  { id: 'high', name: 'High', drawCalls: 150, triangles: 400000, bots: 19, enemies: 32, particles: 2048, decals: 96, lights: 4, props: 24, shadows: 'sun', msaa: 2, lodNear: 40, lodFar: 110, viewDistance: 220 },
  { id: 'medium', name: 'Medium', drawCalls: 110, triangles: 250000, bots: 15, enemies: 24, particles: 1024, decals: 64, lights: 2, props: 16 },
  { id: 'low', name: 'Low', drawCalls: 80, triangles: 120000, bots: 11, enemies: 18, particles: 512, decals: 32, lights: 0, props: 8, post: false, lodNear: 22, lodFar: 60, viewDistance: 130 },
  { id: 'potato', name: 'Potato', renderScaleMin: 0.4, renderScaleMax: 0.8, drawCalls: 50, triangles: 60000, bots: 7, enemies: 12, particles: 256, decals: 0, lights: 0, props: 4, post: false, lodNear: 15, lodFar: 40, viewDistance: 100, voices: 12, music: false, modelDetail: false },
]);
