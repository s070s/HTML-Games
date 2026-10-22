// ==== S12 ABILITIES / ITEMS ====
// STUB until the items helper lands: hook surface used by the HUD and bots (docs/ARCHITECTURE.md "Batch 2 surfaces").

const Items = {
  // Fills out (array of { id, name, remaining, duration, color }) with the actor's active powerups; returns the count.
  activePowerups(id, out) { out.length = 0; return 0; },
  // Fills out (array of { item, x, y, z, remaining, group }) with item spots that are respawning; returns the count.
  timers(out) { out.length = 0; return 0; },
};
