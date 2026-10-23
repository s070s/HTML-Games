// ==== S14 PVE: BEHAVIOURS AND ATTACKS ====
// One generic function set per behaviour kind (PveBrains, CAT.enemies brain) and per attack kind (PveAttacks, attack kind);
// rows only pick kinds and numbers. Movement by goal (PveMove) goes through the bot path follower (BotMove) and motor.
// Behaviour hooks (all optional): decide(id, row, now) -> true when it chose already; step(id, row, dt, now) every tick;
// move(id, row, dt, now) replaces the goal movement; allows(id, attack, now) filters attacks; reduce(id, amount, info);
// draw(batch, id, row). Attack hooks: begin(id, attack, now) at the end of the tell; step(id, attack, now) -> true when
// done; optional move(id, attack, dt, now) while active; lockSeconds (the aim stops following this long before the blow);
// drawTell(batch, id, attack) (the tell's progress is in pveTellGlow). Draw hooks take no float arguments (PERF-006).

const PVE_CLOSE_DIRECT = 4;            // m: inside this a seen target is approached straight, without a path
const PVE_APPROACH_SHARE = 0.8;        // approach to this share of the longest usable attack range
const PVE_STRAFE_SECONDS = 1.5;        // ranged enemies switch strafe direction this often
const PVE_STRAFE_AMOUNT = 0.5, PVE_BACK_AMOUNT = 0.7;
const PVE_ARRIVE_RADIUS = 1.2;
const PVE_PATROL_RADIUS = 6;
const PVE_SEARCH_TURN = 1.2;           // rad/s while searching
const CHARGE_CONTACT = 1.4;            // m (scaled by size): the charge hits on contact
const CHARGE_BLOCKED_SPEED = 2;        // m/s: slower than this after CHARGE_SETTLE s = it hit a wall
const CHARGE_SETTLE = 0.3;
const CHARGE_KNOCKBACK = 2.5;
const POUNCE_SPEED = 11;               // m/s horizontal; flight time clamped to POUNCE_FLIGHT
const POUNCE_FLIGHT = [0.35, 0.9];
const POUNCE_LAND_GRACE = 0.15;
const SUMMON_RADIUS = 2.5;
const BLINK_FLANK = 3;                 // m beside the target the stalker reappears
const BLINK_NODE_SLACK = 1.5;
const TURRET_SWEEP_DEG = 60, TURRET_SWEEP_RATE = 0.5;
const LASER_WIDTH = 0.03;
const HEAL_BEAM_WIDTH = 0.04;
const HEAL_BEAM_SLOT = 2;              // the row colour slot of the heal beam

const pveMoveScratch = Vec.make();
const pveTargetScratch = Vec.make();
const pveSegmentFrom = Vec.make(), pveSegmentTo = Vec.make();   // the ends of a heal beam or a laser tell (placeSegment)

// ---- Movement by goal ----
const PveMove = {
  approach: new Float32Array(MAX_ACTORS),   // metres the enemy closes to (set at each think from its usable attacks)

  run(id, row, dt, now, brain) {
    const phase = Pve.phase[id];
    if (phase === ATTACK_PHASE.ACTIVE) {
      const kind = PveAttacks[row.attackRows[Pve.attack[id]].kind];
      if (kind.move) { kind.move(id, row.attackRows[Pve.attack[id]], dt, now); return; }
    }
    if (phase !== ATTACK_PHASE.IDLE) { this.hold(id); Bots.lookAt(id, Pve.aimX[id], Pve.aimY[id], Pve.aimZ[id]); return; }
    if (brain.move) brain.move(id, row, dt, now); else this.byGoal(id, row, dt, now);
    Bots.wishAmount[id] *= row.cruise;
  },
  byGoal(id, row, dt, now) {
    const goal = Pve.goal[id];
    if (goal === PVE_GOAL.PURSUE || goal === PVE_GOAL.ATTACK) { this.pursue(id, row, dt, now); return; }
    if (goal === PVE_GOAL.FLEE) { this.flee(id, dt, now); return; }
    if (goal === PVE_GOAL.DODGE) { this.dodge(id); return; }
    if (goal === PVE_GOAL.SEARCH) { this.search(id, dt, now); return; }
    if (goal === PVE_GOAL.IDLE) { this.idle(id, dt, now); return; }
    this.travel(id, Pve.goalX[id], Pve.goalY[id], Pve.goalZ[id], PVE_ARRIVE_RADIUS, dt, now);   // cover, objective, lure, patrol
  },
  hold(id) { BotMove.stop(id); Bots.wish(id, 0, 0, 0); },
  travel(id, x, y, z, radius, dt, now) {
    BotMove.goTo(id, x, y, z, radius);
    BotMove.update(id, dt, now);
  },
  // Close to the approach distance, keep at least keepRange[0], strafe (ranged) inside the band; face a seen target.
  pursue(id, row, dt, now) {
    const target = Pve.target[id];
    if (target < 0) { this.hold(id); return; }
    const seen = BotSense.sees(id, target), at = BotSense.perceivedPosition(id, target, pveTargetScratch);
    const dx = at.x - Actors.x[id], dz = at.z - Actors.z[id], distance = length2(dx, dz);
    if (distance > this.approach[id]) this.close(id, at, distance, seen, dt, now);
    else if (distance < row.keepRange[0]) { BotMove.stop(id); Bots.wish(id, -dx, -dz, PVE_BACK_AMOUNT); }
    else this.band(id, row, dx, dz, now);
    if (seen) { Hitbox.point(target, ZONE.BODY, pveMoveScratch); Bots.lookAt(id, pveMoveScratch.x, pveMoveScratch.y, pveMoveScratch.z); }
  },
  close(id, at, distance, seen, dt, now) {
    if (seen && distance < PVE_CLOSE_DIRECT) { BotMove.stop(id); Bots.wish(id, at.x - Actors.x[id], at.z - Actors.z[id], 1); return; }
    this.travel(id, at.x, at.y, at.z, Math.max(PVE_ARRIVE_RADIUS, this.approach[id] * 0.5), dt, now);
  },
  band(id, row, dx, dz, now) {
    BotMove.stop(id);
    if (row.keepRange[1] - row.keepRange[0] < 2) { Bots.wish(id, 0, 0, 0); return; }
    const side = Math.floor(now / PVE_STRAFE_SECONDS + id) % 2 === 0 ? 1 : -1;
    Bots.wish(id, -dz * side, dx * side, PVE_STRAFE_AMOUNT);
  },
  flee(id, dt, now) {
    const target = Pve.target[id];
    if (target < 0) { this.hold(id); return; }
    BotSense.perceivedPosition(id, target, pveTargetScratch);
    const dx = Actors.x[id] - pveTargetScratch.x, dz = Actors.z[id] - pveTargetScratch.z, length = length2(dx, dz) || 1;
    this.travel(id, Actors.x[id] + dx / length * PVE_FLEE_DISTANCE, Actors.y[id], Actors.z[id] + dz / length * PVE_FLEE_DISTANCE, PVE_ARRIVE_RADIUS, dt, now);
  },
  dodge(id) {
    BotMove.stop(id);
    const dx = Actors.x[id] - Pve.goalX[id], dz = Actors.z[id] - Pve.goalZ[id];
    Bots.wish(id, dx - dz * 0.5, dz + dx * 0.5, 1);   // away and a little to the side
  },
  search(id, dt, now) {
    const target = Pve.target[id];
    if (target < 0) { this.hold(id); return; }
    BotSense.perceivedPosition(id, target, pveTargetScratch);
    this.travel(id, pveTargetScratch.x, pveTargetScratch.y, pveTargetScratch.z, PVE_ARRIVE_RADIUS * 2, dt, now);
    if (BotMove.arrived(id)) Bots.lookYaw[id] += PVE_SEARCH_TURN * dt;
  },
  // Idle: stand (or patrol around home in stealth: a new point every patrolSeconds).
  idle(id, dt, now) {
    if (!Pve.stealth || Pve.rowOf(id).speed <= 0) { this.hold(id); return; }
    if (now >= Pve.goalUntil[id]) this.pickPatrol(id, now);
    this.travel(id, Pve.goalX[id], Pve.goalY[id], Pve.goalZ[id], PVE_ARRIVE_RADIUS, dt, now);
  },
  pickPatrol(id, now) {
    Pve.goalUntil[id] = now + Rng.pve.range(PVE_CONTRACT.patrolSeconds[0], PVE_CONTRACT.patrolSeconds[1]);
    const node = Nav.nearestNode(Pve.homeX[id] + Rng.pve.range(-PVE_PATROL_RADIUS, PVE_PATROL_RADIUS), Pve.homeY[id], Pve.homeZ[id] + Rng.pve.range(-PVE_PATROL_RADIUS, PVE_PATROL_RADIUS));
    if (node < 0) { Pve.setGoalPoint(id, Pve.homeX[id], Pve.homeY[id], Pve.homeZ[id]); return; }
    Nav.nodePosition(node, pveMoveScratch);
    Pve.setGoalPoint(id, pveMoveScratch.x, pveMoveScratch.y, pveMoveScratch.z);
  },
  // Approach distance: the longest attack range the behaviour allows now x 0.8, at most keepRange[1].
  updateApproach(id, row, brain, now) {
    let longest = 0;
    for (const attack of row.attackRows) if (!brain.allows || brain.allows(id, attack, now)) longest = Math.max(longest, attack.range[1]);
    this.approach[id] = Math.min(row.keepRange[1], longest > 0 ? longest * PVE_APPROACH_SHARE : row.keepRange[1]);
  },
};

// ---- Attack kinds ----
const PveAttacks = {
  // One blow at the end of the tell: in reach and in front, unless parried (green tells).
  melee: {
    lockSeconds: 0,
    begin() {},
    step(id, attack) {
      const target = Pve.attackTarget[id];
      if (!Pve.targetValid(id) || Pve.parried(id, target, attack)) return true;
      if (target === PVE_CORE_TARGET || inFront(id, target, attack.range[1] + PVE_MELEE_SLACK)) Pve.hitTarget(id, target, attack, attack.damage, 'melee');
      return true;
    },
  },
  // Hitscan shots with spread, `gap` s apart, following the target with the turn-rate-limited look (strafing dodges).
  burst: {
    lockSeconds: 0,
    begin() {},
    step(id, attack, now) {
      if (Pve.shotsLeft[id] === 0 || !Pve.targetValid(id)) return true;
      if (now + TIME_EPSILON < Pve.nextShotAt[id]) return false;
      Pve.aimAt(id, Pve.attackTarget[id]);
      Pve.shoot(id, attack, attack.spreadDeg);
      Pve.shotsLeft[id]--;
      Pve.nextShotAt[id] = now + attack.gap;
      return Pve.shotsLeft[id] === 0;
    },
  },
  // One exact shot along the laser the tell showed; the aim locks 0.3 s before it fires (side-step to dodge).
  laser: {
    lockSeconds: 0.3,
    begin(id, attack) { Pve.shoot(id, attack, 0); },
    step() { return true; },
    drawTell(batch, id) {
      Vec.set(pveSegmentFrom, Actors.x[id], Actors.y[id] + Actors.eye[id], Actors.z[id]);
      Vec.set(pveSegmentTo, Pve.aimX[id], Pve.aimY[id], Pve.aimZ[id]);
      const instance = placeSegment(LASER_WIDTH);
      if (!instance) return;
      writeColor(pveTellColor, 0, PVE_TELL_COLORS.unblockable);
      instance.r = pveTellColor[0]; instance.g = pveTellColor[1]; instance.b = pveTellColor[2]; instance.emissive = 0.5 + pveTellGlow.progress * 0.5;
      batch.meshFrom('box', instance);
    },
  },
  // Projectiles of a weapon row (rockets splash, plasma bolts are parryable), `shots` in a fan of fanDeg.
  projectile: {
    lockSeconds: 0.15,
    begin() {},
    step(id, attack, now) {
      if (Pve.shotsLeft[id] === 0) return true;
      if (now + TIME_EPSILON < Pve.nextShotAt[id]) return false;
      const shot = attack.shots - Pve.shotsLeft[id];
      const fan = attack.shots > 1 ? lerp(-attack.fanDeg / 2, attack.fanDeg / 2, shot / (attack.shots - 1)) : 0;
      launchProjectile(id, attack, fan * DEG);
      Pve.shotsLeft[id]--;
      Pve.nextShotAt[id] = now + attack.gap;
      return Pve.shotsLeft[id] === 0;
    },
  },
  // A ground shockwave around the enemy: foes on the ground inside the radius (jump it, or stay out of reach).
  slam: {
    lockSeconds: 0,
    track: false,
    begin(id, attack) {
      const x = Actors.x[id], y = Actors.y[id], z = Actors.z[id], radius = attack.radius * Pve.rowOf(id).size / 2 + attack.radius / 2;
      if (!Game.headless) { Fx.burst('explosion', x, y + 0.2, z, 0, 1, 0, 24, tellColor(attack)); Fx.light(x, y + 0.5, z, tellColor(attack), radius * 2, 0.3); }
      emitSound(x, y, z, radius * 10, 'explosion', id);
      for (let other = 0; other < Actors.count; other++) {
        if (!Pve.isFoe(id, other) || !(Actors.flags[other] & ACTOR_FLAG.ON_GROUND)) continue;
        if (length2(Actors.x[other] - x, Actors.z[other] - z) <= radius && Math.abs(Actors.y[other] - y) < 2) Pve.hitTarget(id, other, attack, attack.damage, 'splash');
      }
      if (Pve.core.active && Pve.distanceTo(id, PVE_CORE_TARGET) <= radius) Pve.hitTarget(id, PVE_CORE_TARGET, attack, attack.damage);
    },
    step() { return true; },
  },
  // The bomber's blast: everybody in the radius (other enemies too), then the bomber dies.
  explode: {
    lockSeconds: 0,
    track: false,
    begin(id, attack) {
      if (Pve.attackTarget[id] === PVE_CORE_TARGET) Pve.hitTarget(id, PVE_CORE_TARGET, attack, attack.damage);
      this.blast(id, attack);
      const info = Damage.info();
      info.amount = 0; info.kind = 'self'; info.weapon = attack.id; info.element = attack.element;
      Damage.kill(id, id, info);
    },
    step() { return true; },
    blast(id, attack) {
      Pve.hitDone[id] = 1;
      const blast = Damage.blast();
      blast.x = Actors.x[id]; blast.y = Actors.y[id] + 0.8; blast.z = Actors.z[id]; blast.owner = id; blast.radius = attack.radius;
      blast.damage = attack.damage; blast.exclude = id; blast.weapon = attack.id; blast.element = attack.element;
      Damage.explode(blast);
    },
  },
  // A straight rush along the locked direction for `seconds`: contact hits and knocks down; a wall stuns the charger.
  charge: {
    lockSeconds: 0.2,
    begin(id, attack, now) {
      const dx = Pve.aimX[id] - Actors.x[id], dz = Pve.aimZ[id] - Actors.z[id], length = length2(dx, dz) || 1;
      Pve.goalX[id] = dx / length; Pve.goalZ[id] = dz / length;   // the locked direction
      Pve.phaseEndsAt[id] = now + attack.seconds;
    },
    step(id, attack, now) {
      if (now >= Pve.phaseEndsAt[id]) return true;
      if (now - Pve.tellStart[id] - attack.tell > CHARGE_SETTLE && Move.horizontalSpeed(id) < CHARGE_BLOCKED_SPEED) {
        Pve.stagger(id, PVE_DIRECTOR.staggerSeconds + attack.knockdown, STAGGER_CAUSE.WALL);   // ran into a wall
        return true;
      }
      const contact = CHARGE_CONTACT * Pve.rowOf(id).size;
      for (let other = 0; other < Actors.count; other++) {
        if (!Pve.isFoe(id, other) || length2(Actors.x[other] - Actors.x[id], Actors.z[other] - Actors.z[id]) > contact) continue;
        chargeHit(id, other, attack);
        return true;
      }
      if (Pve.core.active && Pve.distanceTo(id, PVE_CORE_TARGET) <= contact) { Pve.hitTarget(id, PVE_CORE_TARGET, attack, attack.damage); return true; }
      return false;
    },
    move(id) {
      BotMove.stop(id);
      Bots.wish(id, Pve.goalX[id], Pve.goalZ[id], 1);
      Bots.lookYaw[id] = Math.atan2(Pve.goalX[id], Pve.goalZ[id]);
    },
  },
  // A ballistic leap at the locked point; foes within `radius` during the flight or landing take the hit.
  pounce: {
    lockSeconds: 0.2,
    begin(id, attack, now) {
      const dx = Pve.aimX[id] - Actors.x[id], dy = Pve.aimY[id] - 1 - Actors.y[id], dz = Pve.aimZ[id] - Actors.z[id];
      const flight = clamp(length2(dx, dz) / POUNCE_SPEED, POUNCE_FLIGHT[0], POUNCE_FLIGHT[1]);
      Actors.vx[id] = dx / flight; Actors.vz[id] = dz / flight;
      Actors.vy[id] = (dy + 0.5 * Move.gravity(id) * flight * flight) / flight;
      unground(id);
      Pve.phaseEndsAt[id] = now + flight + POUNCE_LAND_GRACE * 2;
    },
    step(id, attack, now) {
      for (let other = 0; other < Actors.count; other++) {
        if (!Pve.isFoe(id, other) || length3(Actors.x[other] - Actors.x[id], Actors.y[other] - Actors.y[id], Actors.z[other] - Actors.z[id]) > attack.radius) continue;
        Pve.hitTarget(id, other, attack, attack.damage, 'melee');
        return true;
      }
      const landed = Move.isGrounded(id) && now - Pve.tellStart[id] - attack.tell > POUNCE_LAND_GRACE;
      return landed || now >= Pve.phaseEndsAt[id];
    },
    move(id) { BotMove.stop(id); Bots.wish(id, 0, 0, 0); },
  },
  // Calls the listed enemies (a swarm row brings its whole group) around the summoner, up to `limit` of its summons alive.
  summon: {
    lockSeconds: 0,
    track: false,
    begin(id, attack) {
      const options = pveSummonOptions, radius = SUMMON_RADIUS * Pve.rowOf(id).size;
      options.team = Actors.team[id]; options.side = Pve.side[id]; options.huntTeam = Pve.huntTeam[id]; options.summoner = id;
      let alive = countSummons(id);
      for (let k = 0; k < attack.summon.length && alive < attack.limit; k++) {
        const angle = (k / attack.summon.length) * Math.PI * 2 + Actors.yaw[id];
        alive += Pve.spawnGroup(CAT.enemies.byId(attack.summon[k]), Actors.x[id] + Math.sin(angle) * radius, Actors.y[id], Actors.z[id] + Math.cos(angle) * radius, Actors.yaw[id], options);
      }
    },
    step() { return true; },
  },
};
const pveSummonOptions = { team: ENEMY_TEAM, side: NO_TEAM, huntTeam: NO_TEAM, scale: 1, champion: -1, wave: 0, summoner: -1 };

function inFront(id, target, reach) {
  const dx = Actors.x[target] - Actors.x[id], dz = Actors.z[target] - Actors.z[id], distance = length2(dx, dz);
  if (distance > reach * Math.max(1, Pve.rowOf(id).size) || Math.abs(Actors.y[target] - Actors.y[id]) > 2) return false;
  if (distance < 0.3) return true;
  return (Math.sin(Actors.yaw[id]) * dx + Math.cos(Actors.yaw[id]) * dz) / distance > PVE_FACING_COS;
}

function chargeHit(id, target, attack) {
  const info = Damage.info();
  info.amount = attack.damage; info.kind = 'melee'; info.weapon = attack.id; info.element = attack.element; info.knockback = CHARGE_KNOCKBACK;
  info.x = Actors.x[target]; info.y = Actors.y[target] + 1; info.z = Actors.z[target];
  info.dx = Pve.goalX[id]; info.dy = 0; info.dz = Pve.goalZ[id];
  Damage.apply(id, target, info);
  if (attack.knockdown > 0) Damage.addStatus(target, 'stun', id, attack.knockdown, 1);
}

// The attack's weapon row decides the projectile (rocket splash, parryable plasma); speed x difficulty projectileSpeed.
function launchProjectile(id, attack, yawOffset) {
  const weapon = CAT.weapons.byId(attack.weapon), mode = weapon.primary, row = CAT.projectiles.byId(mode.projectile);
  const ex = Actors.x[id], ey = Actors.eyeY(id), ez = Actors.z[id];
  const yaw = Math.atan2(Pve.aimX[id] - ex, Pve.aimZ[id] - ez) + yawOffset;
  const pitch = Math.atan2(Pve.aimY[id] - ey, length2(Pve.aimX[id] - ex, Pve.aimZ[id] - ez));
  const speed = (mode.speed || row.speed) * Pve.skill().projectileSpeed;
  Vec.fromAngles(pveMoveScratch, yaw, pitch);
  // Projectiles scale direct and splash damage by `multiplier`: pass the direct damage pre-divided so the direct hit stays attack.damage.
  const slot = Projectiles.spawn(row, id, weapon.index, 0, ex + pveMoveScratch.x * 0.6, ey, ez + pveMoveScratch.z * 0.6,
    pveMoveScratch.x * speed, pveMoveScratch.y * speed, pveMoveScratch.z * speed, attack.damage / attack.splashScale);
  Projectiles.multiplier[slot] = attack.splashScale;
}

function countSummons(id) {
  let count = 0;
  for (let other = 0; other < Actors.count; other++) if (Pve.summoner[other] === id && Actors.alive[other] && Pve.isEnemy(other)) count++;
  return count;
}

// ---- Behaviour kinds ----
const BLINK = { at: new Float64Array(MAX_ACTORS), readyAt: new Float64Array(MAX_ACTORS) };
const PveBrains = {
  melee: {},
  ranged: {},
  heavy: {},
  shielded: {},
  sniper: {},
  bomber: {},
  beast: {},
  leaper: {},
  charger: {},
  // E05: cloaked until it attacks or is shocked; blinks beside its target after a 0.4 s shimmer (the tell).
  stalker: {
    decide(id, row, now) {
      const target = Pve.target[id], blink = row.blink;
      if (BLINK.at[id] > 0 || target < 0 || now < BLINK.readyAt[id] || !BotSense.sees(id, target)) return false;
      const distance = Pve.distanceTo(id, target);
      if (distance < PVE_CLOSE_DIRECT || distance > blink.range + PVE_CLOSE_DIRECT) return false;
      BLINK.at[id] = now + blink.tell;
      BLINK.readyAt[id] = now + blink.cooldown;
      Pve.revealedUntil[id] = now + blink.tell * 2;   // the shimmer before and the landing after the blink
      Bus.emit('pve.tell', pveEvent(id, 'blink', 'blink', blink.tell, PVE_TELL_COLORS.normal, target));
      return true;
    },
    step(id, row, dt, now) {
      if (BLINK.at[id] <= 0 || now < BLINK.at[id]) return;
      BLINK.at[id] = 0;
      blinkBeside(id, Pve.target[id]);
    },
  },
  // E09: heals the other enemies of its team inside the radius; keeps its distance from the players.
  support: {
    step(id, row, dt) {
      for (let other = 0; other < Actors.count; other++) {
        if (!healable(id, other, row.heal.radius)) continue;
        Actors.health[other] = Math.min(Actors.maxHealth[other], Actors.health[other] + row.heal.rate * dt);
      }
    },
    draw(batch, id, row) {
      for (let other = 0; other < Actors.count; other++) {
        if (!healable(id, other, row.heal.radius) || Actors.health[other] >= Actors.maxHealth[other]) continue;
        drawHealBeam(batch, id, other, row);
      }
    },
  },
  // E11: does not move; follows a seen target, watches the last known place searchSeconds, then sweeps.
  turret: {
    move(id, row, dt, now) {
      PveMove.hold(id);
      const target = Pve.target[id];
      if (target >= 0) {
        BotSense.perceivedPosition(id, target, pveTargetScratch);
        const searching = now - BotSense.seenAt[BotSense.pair(id, target)] < row.attackRows[0].searchSeconds;
        if (BotSense.sees(id, target) || searching) { Bots.lookAt(id, pveTargetScratch.x, pveTargetScratch.y + 1.2, pveTargetScratch.z); return; }
      }
      Bots.lookYaw[id] = Pve.homeYaw[id] + Math.sin(now * TURRET_SWEEP_RATE) * TURRET_SWEEP_DEG * DEG;
      Bots.lookPitch[id] = 0;
    },
  },
  // R01..R03 range dummies: never chase; the strafe dummy walks its lane, the fire-back dummy shoots when it sees the player.
  dummy: {
    decide(id, row, now) { Pve.tryAttack(id, row, now); return true; },
    move(id, row, dt, now) {
      BotMove.stop(id);
      const target = Pve.target[id];
      if (target >= 0 && BotSense.sees(id, target)) { Hitbox.point(target, ZONE.BODY, pveMoveScratch); Bots.lookAt(id, pveMoveScratch.x, pveMoveScratch.y, pveMoveScratch.z); }
      if (row.speed <= 0) { Bots.wish(id, 0, 0, 0); return; }
      const yaw = Pve.homeYaw[id], rightX = -Math.cos(yaw), rightZ = Math.sin(yaw);
      const offset = (Actors.x[id] - Pve.homeX[id]) * rightX + (Actors.z[id] - Pve.homeZ[id]) * rightZ;
      const wanted = Math.sin(now * row.speed / PVE_RANGE.strafeSpan) * PVE_RANGE.strafeSpan;
      Bots.wish(id, rightX * (wanted - offset), rightZ * (wanted - offset), clamp(Math.abs(wanted - offset), 0, 1));
    },
  },
};

// Healable: another living enemy of the healer's team inside the radius.
function healable(id, other, radius) {
  if (other === id || !Pve.isEnemy(other) || !Actors.alive[other] || Actors.team[other] !== Actors.team[id]) return false;
  return length2(Actors.x[other] - Actors.x[id], Actors.z[other] - Actors.z[id]) <= radius;
}

// Heal beam from the healer's head to the healed enemy's body, in the row's third colour slot.
function drawHealBeam(batch, id, other, row) {
  Vec.set(pveSegmentFrom, Actors.x[id], Actors.y[id] + 2 * row.size, Actors.z[id]);
  Vec.set(pveSegmentTo, Actors.x[other], Actors.y[other] + 1, Actors.z[other]);
  const instance = placeSegment(HEAL_BEAM_WIDTH), colors = row.colors;
  if (!instance) return;
  instance.r = colors[HEAL_BEAM_SLOT * 3]; instance.g = colors[HEAL_BEAM_SLOT * 3 + 1]; instance.b = colors[HEAL_BEAM_SLOT * 3 + 2]; instance.emissive = 0.8;
  batch.meshFrom('box', instance);
}
// A thin box from pveSegmentFrom to pveSegmentTo in the parts' instance record (the caller sets colour and glow);
// null when the ends meet. The ends come through the scratch, not as float arguments (PERF-006).
function placeSegment(width) {
  const from = pveSegmentFrom, dx = pveSegmentTo.x - from.x, dy = pveSegmentTo.y - from.y, dz = pveSegmentTo.z - from.z;
  const length = length3(dx, dy, dz), instance = pvePartInstance;
  if (length < 1e-3) return null;
  instance.x = from.x + dx / 2; instance.y = from.y + dy / 2; instance.z = from.z + dz / 2;
  instance.yaw = Math.atan2(dx, dz); instance.pitch = Math.atan2(dy, length2(dx, dz));
  instance.sx = width; instance.sy = width; instance.sz = length;
  return instance;
}

// Blink to a navigable spot BLINK_FLANK m beside the target (left or right by Rng); stays put when none is near.
function blinkBeside(id, target) {
  if (target < 0 || !Actors.alive[target]) return;
  const side = Rng.pve.sign(), yaw = Actors.yaw[target];
  const x = Actors.x[target] - Math.cos(yaw) * BLINK_FLANK * side, z = Actors.z[target] + Math.sin(yaw) * BLINK_FLANK * side;
  const node = Nav.nearestNode(x, Actors.y[target], z);
  if (node < 0) return;
  Nav.nodePosition(node, pveMoveScratch);
  if (length2(pveMoveScratch.x - x, pveMoveScratch.z - z) > BLINK_FLANK + BLINK_NODE_SLACK) return;
  relocateActor(id, pveMoveScratch.x, pveMoveScratch.y, pveMoveScratch.z, Actors.yaw[id]);
  BotMove.reset(id);
  if (!Game.headless) Fx.burst('shock', pveMoveScratch.x, pveMoveScratch.y + 1, pveMoveScratch.z, 0, 1, 0, 12, Pve.rowOf(id).glow);
}

Bus.on('actor.create', (id) => { BLINK.at[id] = 0; BLINK.readyAt[id] = 0; });
