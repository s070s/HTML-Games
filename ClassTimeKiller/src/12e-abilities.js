// STUB until the abilities helper lands (S12 abilities, hero kits, meters).

const Abilities = {
  // Fills out { slots: [{ id, name, ready, cooldown 0..1, charges, active }], meter: { kind, value 0..1, ready } } for the HUD.
  hudState(id, out) { out.slots.length = 0; out.meter.kind = 'none'; out.meter.value = 0; out.meter.ready = false; return out; },
};
