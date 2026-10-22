// ==== S14 PVE: BOSS (E13 Overlord) ====
// Three phases by health share (row.phases: slam; then the green parryable barrage; then summons of E01 / E07). Crossing a
// threshold starts a short invulnerable transition (announced by 'pve.boss'), so a burst cannot skip a phase. The head
// is the core weak point (clear hit box at the boss size): head hits deal row.weakPoint.mult and drain a pool; an empty
// pool disables the phase's signature attack (its first) for weakPoint.seconds and refills.

const BOSS_TRANSITION_SECONDS = 2;
const bossEventPayload = { id: -1, phase: 0, phases: 0, kind: '' };

const PveBoss = {
  phase: new Int8Array(MAX_ACTORS),
  transitionUntil: new Float64Array(MAX_ACTORS),
  hud: { active: false, id: -1, name: '', health: 0, phase: 0, phases: 0, weakDisabled: false },

  phaseFor(row, share) {
    for (let index = 0; index < row.phases.length; index++) if (share > row.phases[index].until) return index;
    return row.phases.length - 1;
  },
  onSpawn(id) { this.phase[id] = 0; this.transitionUntil[id] = 0; },
  // Phase switches happen here (every tick), not in the 4 Hz think, so the transition starts on the hit that crossed.
  check(id, row, now) {
    const share = Actors.health[id] / Math.max(1, Actors.maxHealth[id]);
    const phase = this.phaseFor(row, share);
    if (phase <= this.phase[id]) return;
    this.phase[id] = phase;
    this.transitionUntil[id] = now + BOSS_TRANSITION_SECONDS;
    Pve.cancelAttack(id);
    Pve.weakPool[id] = row.weakPoint.pool;
    Pve.disabledUntil[id] = 0;
    this.announce(id, row, 'phase');
  },
  announce(id, row, kind) {
    const event = bossEventPayload;
    event.id = id; event.phase = this.phase[id] + 1; event.phases = row.phases.length; event.kind = kind;
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
  step(id, row, dt, now) { PveBoss.check(id, row, now); },
  decide(id) { return PveBoss.inTransition(id); },   // no attack while the phase changes
  allows(id, attack, now) {
    const row = Pve.rowOf(id), phase = row.phases[PveBoss.phase[id]];
    if (!phase.attacks.includes(attack.id)) return false;
    return !(now < Pve.disabledUntil[id] && attack.id === PveBoss.signature(id, row));
  },
  // Transition: no damage. Head (core) hits: x mult, and drain the pool that disables the signature attack.
  reduce(id, amount, info) {
    if (PveBoss.inTransition(id)) return 0;
    if (info.zone !== 'head') return amount;
    const row = Pve.rowOf(id), weak = row.weakPoint, scaled = amount * weak.mult;
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
Sim.addSystem('pveBoss', 81, () => PveBoss.updateHud());
