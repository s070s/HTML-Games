// STUB until the items helper lands (S12 gadgets and grenades).

const Gadgets = {
  // Fills out { grenade, grenadeCount, gadget, gadgetCount, gadgetCooldown 0..1 } for the HUD; returns out.
  hudState(id, out) { out.grenade = ''; out.grenadeCount = 0; out.gadget = ''; out.gadgetCount = 0; out.gadgetCooldown = 0; return out; },
};

// Smoke volumes (REN-007): bots and aim assist ask whether a segment passes through smoke.
const Smoke = {
  lineBlocked(ax, ay, az, bx, by, bz) { return false; },
};
