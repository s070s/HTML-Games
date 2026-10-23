// ==== S12 FLOOR SURFACES (HP-005) ====
// Wet floor, oil and burning oil patches on the floor (CAT.surfaces rows) as a pooled struct of arrays. Sources: a
// breakable prop whose material a row names ('world.break': oil drums, water tanks) and a Freeze thawed by Burn (12f
// meltIce: the ice turns into a wet patch). Reactions (a Damage.statusHooks entry that runs after the 12f combos): a
// status the patch `spreads` landing on someone in it lands on everyone in it (wet floor + Shock), and its igniteStatus
// on someone in it or an igniteElement explosion over it lights it (oil + Burn = a 6 s fire area that lights touching
// oil too, also oil spilled against it later; smoke puts it out like a G04 fire area). A29 / A30 with no enemy in the aim
// cone reach the patch at the aimed floor point (FloorSurfaces.boltFloor).

const SURFACE_CAP = 16;                  // a full pool replaces the patch that ends first
const SURFACE_TICK_STEPS = Math.round(AREA_TICK_SECONDS * TICK_RATE);   // burning patches hurt on the G04 fire area tick (12c)
const SURFACE_FEET_REACH = 0.6;          // feet this close above or below a patch stand in it
const SURFACE_BLAST_REACH = 1.5;         // an igniting explosion this far above a patch (plus its own radius) still lights it
const SURFACE_SPILL_DROP = 4;            // a spill lands on the floor up to this far below where it started
const SURFACE_DRAW_HEIGHT = 0.03;
const SPILL_BY_MATERIAL = new Map(CAT.surfaces.filter((row) => row.spillFrom).map((row) => [row.spillFrom, row]));
const surfacePoint = Vec.make();
const surfaceInstance = makeShapeInstance();

const FloorSurfaces = {
  active: new Uint8Array(SURFACE_CAP), row: new Int8Array(SURFACE_CAP), owner: new Int8Array(SURFACE_CAP),
  x: new Float32Array(SURFACE_CAP), y: new Float32Array(SURFACE_CAP), z: new Float32Array(SURFACE_CAP),
  radius: new Float32Array(SURFACE_CAP), endTick: new Int32Array(SURFACE_CAP),

  clear() { this.active.fill(0); },
  rowOf(slot) { return CAT.surfaces[this.row[slot]]; },
  // Spills a patch of the row onto the floor under (x, y, z); returns its slot.
  spill(row, owner, x, y, z) {
    const slot = this.freeSlot(), floor = World.floorBelow(x, y + 0.1, z, SURFACE_SPILL_DROP);
    this.active[slot] = 1; this.radius[slot] = row.radius;
    this.x[slot] = x; this.y[slot] = Number.isNaN(floor) ? y : floor; this.z[slot] = z;
    this.become(slot, row, owner);
    this.catchFire(slot, row);
    return slot;
  },
  spillUnder(id, key, owner) { return this.spill(CAT.surfaces.byId(key), owner, Actors.x[id], Actors.y[id], Actors.z[id]); },
  become(slot, row, owner) {
    this.row[slot] = row.index; this.owner[slot] = owner;
    this.endTick[slot] = Sim.tick + Math.round(row.seconds * TICK_RATE);
  },
  freeSlot() {
    let oldest = 0;
    for (let slot = 0; slot < SURFACE_CAP; slot++) {
      if (!this.active[slot]) return slot;
      if (this.endTick[slot] < this.endTick[oldest]) oldest = slot;
    }
    return oldest;
  },
  covers(slot, x, y, z) {
    if (!this.active[slot] || Math.abs(y - this.y[slot]) > SURFACE_FEET_REACH) return false;
    return (x - this.x[slot]) ** 2 + (z - this.z[slot]) ** 2 <= this.radius[slot] * this.radius[slot];
  },
  stands(slot, id) { return Actors.alive[id] === 1 && this.covers(slot, Actors.x[id], Actors.y[id], Actors.z[id]); },

  // ---- Reactions ----
  // A status landed on the actor: every patch under its feet reacts.
  onStatus(id, status, source, seconds) {
    for (let slot = 0; slot < SURFACE_CAP; slot++) if (this.stands(slot, id)) this.react(slot, status, source, seconds);
  },
  // The patch meets a status: it hands it to everyone standing in it, or it lights. True when it reacted.
  react(slot, status, source, seconds) {
    if (!status) return false;
    const row = this.rowOf(slot);
    if (row.spreads === status) { this.spread(slot, status, source, seconds); return true; }
    if (row.igniteStatus !== status) return false;
    this.ignite(slot, source);
    return true;
  },
  spread(slot, status, source, seconds) {
    ComboState.spreading = true;   // statuses a combo hands out never combo again (12f)
    try {
      for (let id = 0; id < Actors.count; id++) if (this.stands(slot, id)) Damage.addStatus(id, status, source, seconds, 1);
    } finally { ComboState.spreading = false; }
  },
  // The patch turns into its burning row and lights every touching patch that can burn.
  ignite(slot, source) {
    const row = this.rowOf(slot);
    if (!row.becomes) return;
    this.become(slot, CAT.surfaces.byId(row.becomes), source);
    for (let other = 0; other < SURFACE_CAP; other++) if (this.active[other] && this.rowOf(other).becomes && this.touching(slot, other)) this.ignite(other, source);
  },
  // A patch that can burn, spilled against a burning one, lights at once (credited to whoever lit that one).
  catchFire(slot, row) {
    if (!row.becomes) return;
    const burning = CAT.surfaces.byId(row.becomes).index;
    for (let other = 0; other < SURFACE_CAP; other++) {
      if (other !== slot && this.active[other] && this.row[other] === burning && this.touching(slot, other)) { this.ignite(slot, this.owner[other]); return; }
    }
  },
  touching(a, b) {
    const reach = this.radius[a] + this.radius[b];
    if (Math.abs(this.y[a] - this.y[b]) > SURFACE_FEET_REACH) return false;
    return (this.x[a] - this.x[b]) ** 2 + (this.z[a] - this.z[b]) ** 2 <= reach * reach;
  },
  // An explosion of a patch's igniteElement over it (G04 Cinder Jar, rockets) lights it.
  onExplosion(event) { this.igniteNear(event.element, event.x, event.y, event.z, event.radius, event.owner); },
  // Lights every patch whose igniteElement is the element and that a blast or fire area of the radius at (x, y, z) reaches.
  igniteNear(element, x, y, z, radius, owner) {
    for (let slot = 0; slot < SURFACE_CAP; slot++) {
      if (!this.active[slot] || this.rowOf(slot).igniteElement !== element) continue;
      const reach = this.radius[slot] + radius;
      if (Math.abs(y - this.y[slot]) > radius + SURFACE_BLAST_REACH) continue;
      if ((x - this.x[slot]) ** 2 + (z - this.z[slot]) ** 2 <= reach * reach) this.ignite(slot, owner);
    }
  },
  onBreak(event) {
    const row = SPILL_BY_MATERIAL.get(event.material);
    if (row) this.spill(row, event.source, event.x, event.y, event.z);
  },
  // A29 / A30 with no enemy in the aim cone: the bolt's status reaches the patches at the aimed floor point.
  boltFloor(id, row) {
    const at = aimedFloor(id, row.range, surfacePoint);
    let reacted = false;
    for (let slot = 0; slot < SURFACE_CAP; slot++) if (this.covers(slot, at.x, at.y, at.z) && this.react(slot, row.params.status, id, row.params.seconds)) reacted = true;
    return reacted;
  },

  // ---- Step and drawing ----
  step() {
    const due = Sim.tick % SURFACE_TICK_STEPS === 0;
    for (let slot = 0; slot < SURFACE_CAP; slot++) {
      if (!this.active[slot]) continue;
      if (Sim.tick >= this.endTick[slot]) { this.active[slot] = 0; continue; }
      if (due && this.rowOf(slot).dps > 0) this.burn(slot);
    }
  },
  // Burning oil hurts everyone standing in it, credited to whoever lit it (the G04 fire area tick, 12c fireAreaHit);
  // smoke puts it out, as it does a G04 fire area.
  burn(slot) {
    if (Smoke.covers(this.x[slot], this.y[slot] + 0.5, this.z[slot])) { this.active[slot] = 0; return; }
    const row = this.rowOf(slot), amount = row.dps * SURFACE_TICK_STEPS * TICK_SECONDS;
    for (let id = 0; id < Actors.count; id++) if (this.stands(slot, id)) fireAreaHit(this.owner[slot], id, amount, row, null);
    if (!Game.headless && row.fx) Fx.burst(row.fx, this.x[slot], this.y[slot] + 0.1, this.z[slot], 0, 1, 0, FIRE_FX_COUNT, null);
  },
  draw(batch) {
    const instance = surfaceInstance;
    for (let slot = 0; slot < SURFACE_CAP; slot++) {
      if (!this.active[slot]) continue;
      const row = this.rowOf(slot), size = this.radius[slot] * 2;
      instance.x = this.x[slot]; instance.y = this.y[slot] + SURFACE_DRAW_HEIGHT; instance.z = this.z[slot];
      instance.sx = instance.sz = size; instance.sy = SURFACE_DRAW_HEIGHT;
      instance.r = ((row.color >> 16) & 255) / 255; instance.g = ((row.color >> 8) & 255) / 255; instance.b = (row.color & 255) / 255;
      instance.emissive = row.glow;
      batch.meshFrom('cylinder', instance);
    }
  },
};

// Runs after the 12f combo hook; a status a combo hands out (ComboState.spreading) never reacts with a patch.
function surfaceCombo(id, row, source, seconds) {
  if (!ComboState.spreading) FloorSurfaces.onStatus(id, row.id, source, seconds);
}
Damage.statusHooks.push(surfaceCombo);
World.addPart({ load: () => FloorSurfaces.clear(), clear: () => FloorSurfaces.clear() });
Sim.addSystem('surfaces', 57, () => FloorSurfaces.step());
Render.addSource('surfaces', (batch) => FloorSurfaces.draw(batch));
Bus.on('round', (event) => { if (event.phase === 'start') FloorSurfaces.clear(); });
Bus.on('world.break', (event) => FloorSurfaces.onBreak(event));
Bus.on('explosion', (event) => FloorSurfaces.onExplosion(event));
// A G04 fire area lights the oil it overlaps, not only oil its pop lands on (the pop is announced with radius 0, 12c).
const stepGadgetFireArea = GadgetAreas.steps.fire;
GadgetAreas.steps.fire = (area, row, dt) => {
  stepGadgetFireArea(area, row, dt);
  if (GadgetAreas.active[area]) FloorSurfaces.igniteNear(row.element, GadgetAreas.x[area], GadgetAreas.y[area], GadgetAreas.z[area], row.radius, GadgetAreas.owner[area]);
};
