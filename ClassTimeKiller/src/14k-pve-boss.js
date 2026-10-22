// ==== S14 PVE: BOSS (E13 Overlord) ====
// Three phases by health share (row.phases: slam; then the green parryable barrage; then summons of E01 / E07). A hit never
// takes the boss below the current phase's threshold; reaching it starts a short invulnerable transition (announced by
// 'pve.boss'), so neither a burst nor a frozen boss skips a phase. The head is the core weak point: the row's glowing
// 'weak' head part sits exactly on the head hit sphere (row.headScale at the boss size); head hits deal
// row.weakPoint.mult and drain a pool; an empty pool disables the phase's signature attack (its first) for
// weakPoint.seconds and refills.

const BOSS_TRANSITION_SECONDS = 2;
const BOSS_FLOOR_SLACK = 1e-3;          // health within this of the threshold counts as reaching it (float rounding)
const bossEventPayload = { id: -1, phase: 0, phases: 0, kind: '', seconds: 0, final: false };

const PveBoss = {
  phase: new Int8Array(MAX_ACTORS),
  transitionUntil: new Float64Array(MAX_ACTORS),
  spawnedAt: new Float64Array(MAX_ACTORS),
  hud: { active: false, id: -1, name: '', health: 0, phase: 0, phases: 0, weakDisabled: false },

  // A boss row announces its fight ('start': boss music, AUD-006) and its defeat ('defeated' with the fight's seconds: music,
  // card unlocks), or 'gone' when a living boss is removed without a kill (a failed wave or a round clear: music only).
  onSpawn(id) {
    this.phase[id] = 0; this.transitionUntil[id] = 0;
    const row = Pve.rowOf(id);
    if (!row || !row.boss) return;
    this.spawnedAt[id] = Sim.time;
    this.announce(id, row, 'start');
  },
  onKill(victim) {
    const row = victim >= 0 && Pve.isEnemy(victim) ? Pve.rowOf(victim) : null;
    if (row && row.boss) this.announce(victim, row, 'defeated');
  },
  // A dead boss was announced at its kill; its corpse is removed later (PVE_CORPSE_SECONDS).
  onRemove(id) {
    const row = Pve.isEnemy(id) && Actors.alive[id] ? Pve.rowOf(id) : null;
    if (row && row.boss) this.announce(id, row, 'gone');
  },
  // Health a hit may not take the boss below: the threshold that ends its current phase (0 in the last phase).
  floorHealth(id, row) { return row.phases[this.phase[id]].until * Actors.maxHealth[id]; },
  // Every tick (also while frozen or staggered): health down to the phase threshold starts the next phase (one at a time).
  check(id, row, now) {
    if (this.phase[id] >= row.phases.length - 1 || Actors.health[id] > this.floorHealth(id, row) + BOSS_FLOOR_SLACK) return;
    this.phase[id]++;
    this.transitionUntil[id] = now + BOSS_TRANSITION_SECONDS;
    Pve.cancelAttack(id);
    Pve.weakPool[id] = row.weakPoint.pool;
    Pve.disabledUntil[id] = 0;
    this.announce(id, row, 'phase');
  },
  announce(id, row, kind) {
    const event = bossEventPayload;
    event.id = id; event.phase = this.phase[id] + 1; event.phases = row.phases.length; event.kind = kind;
    event.seconds = Sim.time - this.spawnedAt[id];
    event.final = kind === 'defeated' && pveFinalBoss(id);
    Bus.emit('pve.boss', event);
  },
  inTransition(id) { return Sim.time < this.transitionUntil[id]; },
  signature(id, row) { return row.phases[this.phase[id]].attacks[0]; },
  // The HUD bar of the strongest living boss (UI: name, health share, phase n / 3).
  updateHud() {
    const hud = this.hud;
    hud.active = false; hud.id = -1;
    for (let id = 0; id < Actors.count; id++) {
      const row = Pve.rowOf(id);
      if (!row || !row.boss || !Actors.alive[id]) continue;
      hud.active = true; hud.id = id; hud.name = row.name; hud.health = Actors.health[id] / Math.max(1, Actors.maxHealth[id]);
      hud.phase = this.phase[id] + 1; hud.phases = row.phases.length; hud.weakDisabled = Sim.time < Pve.disabledUntil[id];
      return;
    }
  },
};

PveBrains.boss = {
  always(id, row, now) { PveBoss.check(id, row, now); },
  decide(id) { return PveBoss.inTransition(id); },   // no attack while the phase changes
  allows(id, attack, now) {
    const row = Pve.rowOf(id), phase = row.phases[PveBoss.phase[id]];
    if (!phase.attacks.includes(attack.id)) return false;
    return !(now < Pve.disabledUntil[id] && attack.id === PveBoss.signature(id, row));
  },
  // Transition: no damage. Head (core) hits: x mult, and drain the pool that disables the signature attack. Every hit
  // stops at the phase threshold.
  reduce(id, amount, info) {
    if (PveBoss.inTransition(id)) return 0;
    const row = Pve.rowOf(id), room = Math.max(0, Actors.health[id] + Actors.shield[id] + Actors.armor[id] - PveBoss.floorHealth(id, row));
    return Math.min(room, info.zone === 'head' ? this.weakHit(id, row, amount) : amount);
  },
  weakHit(id, row, amount) {
    const weak = row.weakPoint, scaled = amount * weak.mult;
    Pve.weakPool[id] -= scaled;
    if (Pve.weakPool[id] <= 0) {
      Pve.weakPool[id] = weak.pool;
      Pve.disabledUntil[id] = Sim.time + weak.seconds;
      if (Pve.attack[id] >= 0 && row.attackRows[Pve.attack[id]].id === PveBoss.signature(id, row)) Pve.cancelAttack(id);
      PveBoss.announce(id, row, 'weak');
    }
    return scaled;
  },
};

PVE_HUD.boss = PveBoss.hud;
Bus.on('actor.spawn', (payload) => PveBoss.onSpawn(payload.id));
Bus.on('kill', (payload) => PveBoss.onKill(payload.victim));
Bus.on('actor.remove', (id) => PveBoss.onRemove(id));
Sim.addSystem('pveBoss', 81, () => PveBoss.updateHud());
