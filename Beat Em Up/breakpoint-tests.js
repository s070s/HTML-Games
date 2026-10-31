/* BREAKPOINT self-tests: the acceptance checks of the game, kept out of breakpoint.html (owner decision 2026-10-29) so the game file
   stays inside its 1.2 MB budget (P1-05). This is not part of the game: breakpoint.html loads it with a script element only when a run is
   asked for (Menu > About & Help > Run self-test, or BREAKPOINT.selfTest() in the console). Keep it in the same folder as breakpoint.html.
   It registers one function, window.BREAKPOINT_TESTS. The game calls it with testApi() (every internal binding the tests use) and gets
   the SelfTest object back. Everything below the destructuring is the code that used to sit inside the game closure, unchanged except that
   controlsChanged (the one binding the tests reassign) is read and written through api.get / api.set. */
window.BREAKPOINT_TESTS = function (api) {
'use strict';
const {
  ACTIONS, ACTION_LABELS, AGE_DEFAULT, AGE_MARK, AGE_MAX, AGE_MIN, AGE_OLD_FROM, AIController, AI_EDGE_PATIENCE, ALL_MOVES,
  ARCADE_ARENAS, ARCADE_LEVELS, ARCADE_STAGES, ARCHETYPES, ARCHETYPE_IDS, ARCHETYPE_MOVE_STYLE, ARENAS, ARENA_ORDER,
  ASSIST_STRING_WINDOW, ATTACKS, ATTACK_STRING_TICKS, ATTR_KEYS, ATTR_KNEE, ATTR_MAX, ATTR_MIN, Arena, BINDABLE_CODE, BODY,
  BOOST_DAMAGE_MULT, BOOST_TICKS, BRAWL_MAX_ENEMIES, BUILD_MAX, BUILD_MIN, BUILD_STEP, CAMERA_CHEST, CAMERA_EDGE_PAD,
  CAMERA_FIGHTER_HEIGHT, CAMERA_OCCLUSION_GRACE, CAMERA_THREAT_LEAVE, CAMERA_THREAT_RANGE, CB, CLASSIC_STYLE_IDS, CLINCH_MOVES,
  CLINCH_STRIKE_ANIM_TICKS, CLINCH_STRIKE_COOLDOWN, CLINCH_STRIKE_MAX, CLINCH_STRIKE_POSES, CONTROL_CARD_KINDS, COOP_MAX_PLAYERS,
  COOP_REVIVE_HP, CUSTOM_SLOTS, CY, Camera, Combat, CreatorUI, CustomRoster, DEBRIS_MAX, DEFAULT_KEYS, DEFAULT_KEYS_P2, DEFAULT_UNLOCKED,
  DEFENSE_TYPES, DIFFICULTY, Debris, Diag, DummyController, ESCAPE_STAMINA, Events, FACE_CELL, FACE_EXPR, FACE_GRID, FACE_POOL_FIRST,
  FACE_ROWS, FALL_DAMAGE_FREE_DROP, FALL_DAMAGE_MAX, FALL_DAMAGE_PER_METER, FALL_STATE_DROP, FIXED_DT, FX, FaceTex, Fighter,
  GAMEPAD_LABELS, GRIP_POSES, GS, GUARD_ORTHO, Game, HAIR_CAP, HAIR_SWATCHES, HOLD_POSES, HUMAN_CONTROLLERS, IMPACT_SRC_BASE, ITEMS,
  Input, Input2, Input3, Input4, Inputs, J, JUGGLE_LIMIT, KEYMAPS, KEYS_REVISION, KEY_BINDINGS, KEY_BINDINGS_P2, KEY_CUSTOM,
  KEY_PROGRESS, KEY_SETTINGS, KO_DELAY_TICKS, Keymap, Keymap2, LAYER, LEGACY_STYLE_MAP, LOCK_FLICK_TICKS, LOCK_RANGE, LOCK_RELEASE_RANGE,
  LOCK_SWITCH_COOLDOWN, LOOK_CHOICES, LOOK_CHOICE_KEYS, LOOK_CLASSIC, LOOK_ITEM_KEYS, MODE_INFO, MODE_ORDER, MOMENTUM_MAX,
  MOMENTUM_PERFECT, MOMENTUM_PER_DAMAGE, MOMENTUM_TAKEN_RATIO, MOVE_STYLE, MOVE_STYLE_IDS, Match, MatchSim, NEW_ITEMS, NP,
  OUTFIT_SWATCHES, PAD_BUTTONS, PAD_SELECT_BUTTON, PAD_SELECT_HOLD_MS, PHOTO_MAX_CHARS, PHOTO_ROW, PHOTO_URL, POINT_BUDGET,
  PREVIEW_POSES, Player2Controller, Player3Controller, PlayerController, PlayerInput, Progress, QUALITY_PRESETS, Quality, R,
  REFRESH_SETTLE_FRAMES, RETREAT_EXTRA, ROSTER, ROSTER_BY_ID, ROUND_BANNER_TICKS, RUMBLE_KO, S, SCALE_MAX, SCALE_MIN, SETTINGS_REVISION,
  SETTING_DEFS, SHARE_FIELD_COUNT, SHARE_FIELD_COUNT_BODY, SHARE_FIELD_COUNT_DEFENSE, SHARE_FIELD_COUNT_FACE, SHARE_FIELD_COUNT_ITEMS,
  SHARE_FIELD_COUNT_STYLE, SHARE_LOOK_KEYS, SHARE_MAX_LENGTH, SHARE_PREFIX, SIDESTEP_COST, SKIN_SWATCHES, SKIP_ARM_TICKS, SP,
  STEP_HEIGHT, STORE_MAX_LENGTH, STRIKE_BUILDERS, STRINGS, STRING_MAX_STEPS, STYLE_TECH, STYLE_FAMILY_LABEL, STYLE_STRINGS, STYLE_THROWS,
  SUBMISSION_STYLES, SUBMIT_MAX_TICKS, SUBMIT_RANGE, SURVIVAL_PEAK, SURVIVAL_TIMER, SWAY_COST, SWAY_IFRAME_TICKS, SWAY_PERFECT_TICKS,
  SWAY_RECOVERY_TICKS, SWAY_TOTAL_TICKS, Settings, Showcase, SimRunner, Store, TACKLE_BLOCK_STUN, TACKLE_MIN_GAP, TACKLE_MOVE,
  TACKLE_STOP_LOCK, TARGET_FRAME_MS, TEAM_ENEMIES, TEAM_PLAYERS, THIGH, THROW_DIRS, THROW_POSES, THROW_SETS, TOKEN_PATIENCE_TICKS,
  TOUCH_BUTTONS, TOUCH_CONTEXT_ACTIONS, TOUCH_LABELS, TOUCH_LAYOUT, TOUCH_RUN_TICKS, TRANSITIONS, UI, UNLOCK_RULES, VETERAN_BUDGET,
  VICTORY_POSES, WAKEUP_GRACE_TICKS, WEIGHT_CLASS_BOUNDS, WEIGHT_CLASS_NAMES, arcadeDifficulty, attrCost, attrTotal, canSetAttr,
  canTransition, clamp, clearIntent, cloneCustom, coopEnemyCount, customProfile, decodeCustom, defaultCustom, defaultDefense,
  deriveStats, encodeCustom, esc, escapeStartFor, faceExpression, fnv1a, frameAdvantage, frameScale, fromBase64Url, handScale,
  hasUnlockRule, headbandSize, hexToHsl, isBlockState, keyLabel, makeIntent, makeMotion, moveStyleFor, presetBuild, randomBody,
  randomCustom, randomItems, resolveLook, shareChecksum, stringsFor, styleFor, submissionStyleText, throwFor, toBase64Url,
  touchLayoutCss, touchLockVisible, touchUseVisible, trimToBudget, unlockRuleText, validateCustom, weightClass, weightFromBuild,
  wrapAngle,
  CRUSH_BASE, CRUSH_MAX, CRUSH_PER_METER, DECK_PIECES_MAX, LOAD_CREAK_TICKS, LOAD_HOLD_TICKS, LOOKS, PICKUP_LOW_BELOW, RAMP_RISE, SCAFFOLD_TIER, STAIR_RISE, STAIR_RUN, builtOf, kindOf, MATERIALS,
  BLIND_TICKS, CARRY_WALK, ITEM_MAX, PICKUP_MOVES, PICKUP_TAKE_TICK, PICKUP_TICKS, SHATTER_STUN, SPRAY_CHARGES, THROW_LOCK_TICKS, WEAPONS, WEAPON_MOVES, WEAPON_STEPS, WEAPON_SWINGS, THROW_HAND, THROW_ANIM_TICKS, GROUND_NOTES, HOLD_PROMPT_RANGE, SCENARIOS, SUBMIT_CONTEST_FLOOR, SUBMIT_ESCAPE_GOAL, SUBMIT_MIN_STAMINA, SUBMIT_GAP, SUBMIT_ESCAPE_TAP, SUBMIT_HOLD_TAP, SUBMIT_STAM_FLOOR, SUBMIT_TAP_COST, SUBMIT_DRIFT, SUBMIT_DMG_START, SUBMIT_DMG_END, SUBMIT_STAM_DRAIN, SUBMIT_FLASH_TICKS, SUBMIT_REST_TICKS, SUBMIT_AFTER_LOCK, SUBMIT_ESCAPE_LOCK, SUBMIT_LEVEL_GAP, HOLD_PROMPT_STACK_PX, ITEM_BREAK_AHEAD, POSE_SCRATCH, heldLabel, moveById, weaponTable,
  AI_HAZARD_RANGE, BOTTLE_SHARD_R, HAZARDS, HAZARD_LAND_TICKS, HAZARD_SHARD_MAX, HAZARD_SHARD_TICKS, RING_APRON, WAVE_SPREAD, AI_HAZARD_BAIT, WAVE_WAIT_MAX,
  LINEUP_DEALS, LINEUP_HANDICAP, LINEUP_HUMANS_MAX, LINEUP_LIVE_STATES, LINEUP_MAX, LINEUP_MIN, LINEUP_TEAM_LETTERS, LINEUP_TIMERS, MatchLineup, SETUP_LABEL, TEAM_TINTS, CrowdDirector,
} = api;

const FACE_MIN_TEXELS = 100;   // a painted face has at least this many visible texels of its 64 x 64 (the self-test reads them back)
const STATE_LABEL = {
  IDLE: 'Idle', WALK: 'Walking', RUN: 'Running', SIDESTEP: 'Sidestep', SWAY: 'Swaying', CROUCH: 'Crouching', JUMP: 'Jumping',
  ATTACK: 'Attacking', BLOCK_H: 'High block', BLOCK_L: 'Low block', HIT: 'Hit reaction', STAGGER: 'Staggered', STUN: 'Stunned',
  CLINCH: 'Clinched', GRAPPLE: 'Grappling', SUBMIT: 'Holding', THROWN: 'Thrown', FALL: 'Falling', DOWN: 'Knocked down', GETUP: 'Recovering', KO: 'Knocked out', VICTORY: 'Victory', DEFEAT: 'Defeat',
};
const STYLE_STANCE_KEYS = ['guardHands', 'guardTight', 'guardTwist', 'guardLean', 'guardCrouch', 'guardWidth', 'guardSplit', 'guardTuck'];
const STYLE_FOOTWORK_KEYS = ['bounce', 'bounceHz', 'sway', 'swayHz', 'headBob', 'stride', 'armSwing', 'walkBounce'];
const ScriptedController = {
  make(fn) { return { think(f, opp, match, it) { clearIntent(it); fn(it, f, opp, match); return it; }, reset() {} }; },
};
const TOUCH_BUTTON_SCALE ={ '': 1, lg: 1.25, sm: 0.8 };   // button size in tbs units (one standard button)
/* The pixels of a TOUCH_LAYOUT offset; units = pixels per unit (vmin, vw, vh, px, tbs). */
function touchOffsetPx(text, units) {
  const tokens = text.match(/max\(|[\d.]+[a-z]+|[,)+]/g);
  let at = 0;
  const sum = () => { let total = term(); while (tokens[at] === '+') { at++; total += term(); } return total; };
  const term = () => {
    const token = tokens[at++];
    if (token === 'max(') { const values = [sum()]; while (tokens[at] === ',') { at++; values.push(sum()); } at++; return Math.max(...values); }
    const part = /^([\d.]+)([a-z]+)$/.exec(token);
    return parseFloat(part[1]) * units[part[2]];
  };
  return sum();
}
/* The pixel rectangles ({ x0, y0, x1, y1 }) of the stick and every touch button for a window: view = { w, h, sat, sar, sab, sal }
   (size and safe-area insets in px), orientation = 'landscape' or 'portrait'. */
function touchLayoutRects(orientation, view) {
  const layout = TOUCH_LAYOUT[orientation];
  const units = { vmin: Math.min(view.w, view.h) / 100, vw: view.w / 100, vh: view.h / 100, px: 1 };
  units.tbs = touchOffsetPx(layout.tbs, units);
  const area = { left: view.sal, top: view.sat, right: view.w - view.sar, bottom: view.h - view.sab };   // the box #touch fills
  const rects = {};
  const stickSize = touchOffsetPx(layout.stick[2], units);
  const stickX = area.left + touchOffsetPx(layout.stick[0], units), stickY = area.bottom - touchOffsetPx(layout.stick[1], units) - stickSize;
  rects.stick = { x0: stickX, y0: stickY, x1: stickX + stickSize, y1: stickY + stickSize };
  for (const [action, , size] of TOUCH_BUTTONS) {
    const [edgeX, offsetX, edgeY, offsetY] = layout.slots[action];
    const side = TOUCH_BUTTON_SCALE[size] * units.tbs;
    const x0 = edgeX === 'left' ? area.left + touchOffsetPx(offsetX, units) : area.right - touchOffsetPx(offsetX, units) - side;
    const y0 = edgeY === 'top' ? area.top + touchOffsetPx(offsetY, units) : area.bottom - touchOffsetPx(offsetY, units) - side;
    rects[action] = { x0, y0, x1: x0 + side, y1: y0 + side };
  }
  return rects;
}

const SELFTEST_STORE_KEYS = [KEY_SETTINGS, KEY_PROGRESS, KEY_BINDINGS, KEY_BINDINGS_P2, KEY_CUSTOM];
const SelfTest = {
  scripted(fn) { return ScriptedController.make(fn); },
  /* Saved data and the in-memory copies the tests may change, so a run in a real browser leaves no trace
     (it would otherwise mark the first-match controls card as seen, for example). */
  snapshot() {
    return {
      raw: SELFTEST_STORE_KEYS.map((key) => Store.get(key)), settings: Object.assign({}, Settings.v), progress: JSON.parse(JSON.stringify(Progress.d)),
      keys: KEYMAPS.map((keymap) => JSON.stringify(keymap.bindings)), selection: Object.assign({}, Game.selection), devices: Inputs.players.map((p) => p.lastDevice),
      controlsChanged: api.get.controlsChanged(), customs: JSON.parse(JSON.stringify(CustomRoster.slots)),
    };
  },
  restore(saved) {
    SELFTEST_STORE_KEYS.forEach((key, i) => { if (saved.raw[i] === null) Store.remove(key); else Store.set(key, saved.raw[i]); });
    CustomRoster.slots = saved.customs;   // a test that threw halfway must not leave its fighters in memory for the next save to write
    CustomRoster.register();
    Settings.v = saved.settings;
    Settings.apply();
    Progress.d = saved.progress;
    KEYMAPS.forEach((keymap, i) => { keymap.bindings = JSON.parse(saved.keys[i]); });
    Inputs.rebuildMaps();
    Object.assign(Game.selection, saved.selection);
    Inputs.players.forEach((p, i) => { p.lastDevice = saved.devices[i]; });   // Versus tests switch pads between players
    api.set.controlsChanged(saved.controlsChanged);   // the migration tests set it
  },
  made: [],   // every match make / makeBrawl built since the last test ended: the test wrapper disposes them all
  make(opts, s1, s2) {
    const m = new MatchSim(Object.assign({ mode: 'free', countdown: false, timer: 0, seed: 11, winsNeeded: 2 }, opts));
    m.controllers[0] = this.scripted(s1 || (() => {}));
    m.controllers[1] = this.scripted(s2 || (() => {}));
    this.made.push(m);
    return m;
  },
  /* A brawl (P4-01) with scripted controllers: scripts[i] drives fighter i (default: stands still). */
  makeBrawl(opts, ...scripts) {
    const m = new MatchSim(Object.assign({ mode: 'brawl', enemies: 2, countdown: false, timer: 0, seed: 11 }, opts));
    m.fighters.forEach((f, i) => { m.controllers[i] = this.scripted(scripts[i] || (() => {})); });
    this.made.push(m);
    return m;
  },
  /* Puts fighter f at (x, z) facing (lookX, lookZ), at rest. */
  stand(f, x, z, lookX, lookZ) {
    f.x = f.prevX = x; f.z = f.prevZ = z;
    f.yaw = f.prevYaw = Math.atan2(lookX - x, lookZ - z);
  },
  place(m, gap, x0) {
    const a = m.fighters[0], b = m.fighters[1], c = x0 === undefined ? 0 : x0;
    a.x = c - gap / 2; b.x = c + gap / 2; a.z = b.z = 0;
    a.prevX = a.x; b.prevX = b.x; a.prevZ = b.prevZ = 0;
  },
  run(m, n) { for (let i = 0; i < n; i++) m.step(); },
  /* Block vs Sway balance (P3-02): two copies of KAI that differ only in their defense type play AI vs AI for `seeds` seeds, each seed
     on both sides so the spawn side cancels out. opts go to SimRunner.run. Returns { block, sway, none } match wins (none = time cap). */
  defenseSplit(seeds, opts) {
    const blockId = 'dsplit_block', swayId = 'dsplit_sway';
    ROSTER_BY_ID[blockId] = Object.assign({}, ROSTER_BY_ID.kai, { id: blockId, name: 'BLOCKER', defense: 'block' });
    ROSTER_BY_ID[swayId] = Object.assign({}, ROSTER_BY_ID.kai, { id: swayId, name: 'SWAYER', defense: 'sway' });
    const wins = { block: 0, sway: 0, none: 0 };
    try {
      for (let seed = 1; seed <= seeds; seed++) {
        for (const swapped of [false, true]) {   // swapped: the Sway fighter is player 1
          const r = SimRunner.run(Object.assign({ playerId: swapped ? swayId : blockId, opponentId: swapped ? blockId : swayId, seed }, opts));
          if (r.error) return { error: r.error };
          if (r.winner < 0) wins.none++; else if ((r.winner === 0) !== swapped) wins.block++; else wins.sway++;
        }
      }
    } finally {
      delete ROSTER_BY_ID[blockId]; delete ROSTER_BY_ID[swayId];
    }
    return wins;
  },
  /* Attack-string damage shares (P3-10): AI vs AI matches over `seeds` seeds for every pair of fighters in opts.pairs (default: each pair of
     the six presets; even seeds swap the seats), counting each hit's damage under the string step that threw it ('cPP' = the crouch string's
     step 2; a move outside the strings, such as a counter, a lunge or a clinch strike, counts under its own id). A throw counts as 'throw:<name>'
     and a hold as 'hold'. opts go to SimRunner.run (difficulty, timer, winsNeeded).
     Returns { fighters: { id: { total, keys: { key: dmg }, punch, kick, unused: [rows never thrown] } }, worst: { id, key, share }, punch, kick }:
     punch / kick are the shares of strike damage thrown with a punch button (or clinch elbow) and a kick button (or clinch knee). */
  stringShare(seeds, opts) {
    const runOpts = Object.assign({}, opts);
    const ids = ROSTER.map((r) => r.id), list = runOpts.pairs || [];
    if (!runOpts.pairs) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) list.push([ids[i], ids[j]]);
    delete runOpts.pairs;
    const fighters = {};
    const tally = (id) => fighters[id] || (fighters[id] = { total: 0, keys: {}, punch: 0, kick: 0 });
    const addKey = (id, key, dmg) => { const t = tally(id); t.total += dmg; t.keys[key] = (t.keys[key] || 0) + dmg; };
    const listeners = {
      hit: (e) => {
        const att = e.att, onString = att.move === e.mv && att.stringKeys !== '' && e.kind !== 'ground';
        addKey(att.id, onString ? (att.stringLow ? 'c' : '') + att.stringKeys : e.mv.id, e.dmg);
        const punch = e.mv.btn ? e.mv.btn[1] === 'p' : e.mv.cat === 'punch';
        tally(att.id)[punch ? 'punch' : 'kick'] += e.dmg;
      },
      throw: (e) => addKey(e.att.id, 'throw:' + e.name, e.dmg),
      submissionEnd: (e) => addKey(e.att.id, 'hold', e.damage),
    };
    for (let seed = 1; seed <= seeds; seed++) {
      for (const [a, b] of list) {
        const swap = seed % 2 === 0;
        const r = SimRunner.run(Object.assign({ playerId: swap ? b : a, opponentId: swap ? a : b, seed, listeners }, runOpts));
        if (r.error) return { error: r.error };
      }
    }
    const out = { fighters, worst: { id: '', key: '', share: 0 }, punch: 0, kick: 0 };
    for (const id in fighters) {
      const t = fighters[id];
      out.punch += t.punch; out.kick += t.kick;
      for (const key in t.keys) {
        const share = t.total > 0 ? t.keys[key] / t.total : 0;
        if (share > out.worst.share) out.worst = { id, key, share };
      }
      const table = stringsFor(moveStyleFor(ROSTER_BY_ID[id]));
      t.unused = [];
      for (const side of ['stand', 'crouch']) for (const keys in table[side]) if (!t.keys[(side === 'crouch' ? 'c' : '') + keys]) t.unused.push((side === 'crouch' ? 'c' : '') + keys);
    }
    const strikes = out.punch + out.kick;
    out.punch = strikes > 0 ? out.punch / strikes : 0; out.kick = strikes > 0 ? out.kick / strikes : 0;
    return out;
  },
  capture(names) {
    const log = {};
    const offs = names.map((n) => { log[n] = []; return Events.on(n, (e) => log[n].push(e)); });
    log.stop = () => offs.forEach((off) => off());
    return log;
  },

  run_all() {
    const results = [];
    const self = this;
    const test = (name, fn) => {
      let m = null;
      try { const r = fn(); results.push({ name, pass: r === true, detail: r === true ? '' : String(r) }); } catch (e) { results.push({ name, pass: false, detail: 'exception: ' + e.message }); }
      self.made.splice(0).forEach((made) => made.dispose());
      if (Match.current) Match.current.dispose();
      void m;
    };
    const mk = (...a) => self.make(...a);
    const track = (m) => { self.made.push(m); return m; };   // a match built with `new MatchSim` directly: the wrapper disposes it even if the test throws
    /* A match whose second fighter (MARA, a Sway fighter by default) holds Defend as a Block fighter: for the block tests. */
    const mkBlock = (...a) => { const m = self.make(...a); m.fighters[1].defense = 'block'; return m; };
    const once = (tick, key, extra) => (it, f, o, m) => { if (m.tick === tick) { it[key] = true; if (extra) Object.assign(it, extra); } };
    /* Presses an attack string ('P' / 'K' letters) on fighter 1: the first press at tick 2, each next press right after the previous move connected.
       extra = fields set on every press tick (height: true = Crouch held). */
    const pressString = (letters, extra) => {
      let next = 0, from = 0;
      return (it, f, o, m) => {
        const ready = next === 0 ? m.tick === 2 : f.moveConnected && f.moveId !== from;
        if (next >= letters.length || !ready) return;
        it[letters[next] === 'P' ? 'punch' : 'kick'] = true;
        if (extra) Object.assign(it, extra);
        from = f.moveId; next++;
      };
    };
    /* Plays a string on a fresh match with the defender kept in reach, so every step makes contact. fill(it, f, o, kind) feeds one tick of
       input: kind is 'punch' or 'kick' on a press tick, else null. Returns the ids of the moves fighter 1 started. */
    const playString = (letters, fill, attackerId) => {
      const log = self.capture(['attackStart']);
      let next = 0, from = 0;
      const m = mk(attackerId ? { playerId: attackerId } : {}, (it, f, o, mm) => {
        o.x = f.x + 1.0; o.z = f.z; o.prevX = o.x; o.prevZ = o.z;
        const ready = next === 0 ? mm.tick === 2 : f.moveConnected && f.moveId !== from;
        let kind = null;
        if (next < letters.length && ready) { kind = letters[next] === 'P' ? 'punch' : 'kick'; from = f.moveId; next++; }
        fill(it, f, o, kind);
      });
      self.place(m, 1.2); self.run(m, 100 + 40 * letters.length); log.stop(); m.dispose();
      return log.attackStart.filter((e) => e.f.index === 0).map((e) => e.mv.id);
    };
    const stringRows = [];   // every row of both tables: { keys, low, moves }
    for (const table of ['stand', 'crouch']) for (const keys in STRINGS[table]) stringRows.push({ keys, low: table === 'crouch', moves: STRINGS[table][keys] });

    test('Deterministic simulation (same seed, same result)', () => {
      const play = () => {
        const m = mk({ seed: 5, difficulty: 'hard' }, (it, f, o, mm) => { if (mm.tick % 40 === 3) it.punch = true; if (mm.tick % 90 === 20) it.kick = true; it.fwd = mm.tick % 120 < 60 ? 1 : -0.5; });
        m.controllers[1] = new AIController(ROSTER_BY_ID.mara, 'hard');
        self.run(m, 500);
        const r = [m.fighters[0].hp, m.fighters[1].hp, m.fighters[0].x, m.fighters[1].z].join('|');
        m.dispose();
        return r;
      };
      const a = play(), b = play();
      return a === b ? true : a + ' != ' + b;
    });
    test('Jab connects once and deals damage', () => {
      const log = self.capture(['hit']);
      const m = mk({}, once(2, 'punch')); self.place(m, 1.2); self.run(m, 60); log.stop();
      const d = m.fighters[1].maxHp - m.fighters[1].hp;
      return log.hit.length === 1 && d >= 2 && d <= 8 ? true : 'hits ' + log.hit.length + ' dmg ' + d;
    });
    test('Attack out of range whiffs', () => {
      const log = self.capture(['hit', 'block']);
      const m = mk({}, once(2, 'punch')); self.place(m, 3.2); self.run(m, 60); log.stop();
      return log.hit.length === 0 && log.block.length === 0 ? true : 'unexpected contact';
    });
    test('A first Punch / Kick press plays jab / front kick; with Crouch held, body jab / low kick; Crouch alone fires nothing', () => {
      const want = [['punch', {}, 'jab'], ['kick', {}, 'front_kick'], ['punch', { height: true }, 'body_jab'], ['kick', { height: true }, 'low_kick']];
      for (const [k, mods, id] of want) {
        const m = mk({}, once(2, k, mods)); self.place(m, 3); self.run(m, 3);
        const got = m.fighters[0].move ? m.fighters[0].move.id : 'none';
        m.dispose();
        if (got !== id) return k + '+' + JSON.stringify(mods) + ' -> ' + got;
      }
      const m = mk({}, (it) => { it.height = true; it.crouch = true; }); self.place(m, 3); self.run(m, 40);
      return m.fighters[0].state === S.CROUCH && !m.fighters[0].move ? true : 'crouch alone started ' + m.fighters[0].state;
    });
    test('Every row of both string tables plays its moves, each step after the previous one made contact', () => {
      const problems = [];
      for (const row of stringRows) {
        const got = playString(row.keys, (it, f, o, kind) => { if (kind) { it[kind] = true; it.height = row.low; } }).join();
        if (got !== row.moves.join()) problems.push((row.low ? 'crouch ' : '') + row.keys + ': ' + got);
      }
      const known = Object.keys(ATTACKS).filter((id) => ATTACKS[id].tier === 3 && !ATTACKS[id].ctx);
      const inStrings = known.every((id) => stringRows.filter((r) => r.moves[r.moves.length - 1] === id).length === 1);   // each strong move ends exactly one string row
      return stringRows.length === 18 && known.length === 8 && inStrings && !problems.length ? true : 'rows ' + stringRows.length + ' strong ' + known.length + ' once ' + inStrings + ' ' + problems.join('; ');
    });
    /* ----- per-style strings, punishable enders, damage shares (P3-10) ----- */
    const STRING_SHARE_LIMIT = 0.35;          // no string above this share of a fighter's damage (owner decision 2026-10-28: the limit stays); measured worst case 0.24 (0.33 before P3-10)
    const PUNCH_SHARE_BAND = [0.35, 0.65];    // punches and kicks each carry this share of strike damage; measured 0.39 Normal and 0.40 Hard (0.27 and 0.22 before P3-10)
    const STRING_SHARE_SEEDS = 3;             // seeds x 15 preset pairs per difficulty
    const STYLE_TESTERS = { boxer: 'yuki', karateka: 'zero', capoeira: 'mara', wrestler: 'dmitri', judoka: 'ptest', wingchun: 'rosa', muaythai: 'pranee', taekwondo: 'sora', hapkido: 'vikram', kali: 'nia', kravmaga: 'yoav', mma: 'cruz' };   // a preset of each move style that has string rows (the Judoka has none in the base roster: a KAI copy)
    const withJudoka = (fn) => {
      ROSTER_BY_ID.ptest = Object.assign({}, ROSTER_BY_ID.kai, { id: 'ptest', name: 'PTEST', moveStyle: 'judoka' });
      try { return fn(); } finally { delete ROSTER_BY_ID.ptest; }
    };
    test('Every move style plays its own string rows (each step after the previous one made contact); a removed row starts a new string', () => {
      const problems = [];
      withJudoka(() => {
        for (const styleId of Object.keys(STYLE_STRINGS)) {
          const table = stringsFor(styleId);
          for (const side of ['stand', 'crouch']) for (const keys in table[side]) {
            const low = side === 'crouch';
            const got = playString(keys, (it, f, o, kind) => { if (kind) { it[kind] = true; it.height = low; } }, STYLE_TESTERS[styleId]).join();
            if (got !== table[side][keys].join()) problems.push(styleId + ' ' + (low ? 'crouch ' : '') + keys + ': ' + got);
          }
        }
        const third = playString('PPP', (it, f, o, kind) => { if (kind) it[kind] = true; }, STYLE_TESTERS.wrestler).join();   // the Wrestler has no P P P row: the string ends on the hook, a third press does not continue it
        if (third !== 'jab,hook') problems.push('wrestler PPP: ' + third);
      });
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Every string table (default and per style) keeps the owner rules: Punch plays a punch and Kick a kick, at most 3 steps, strong moves only after a light first step, every prefix is a row', () => {
      const problems = [];
      for (const styleId of ['kickboxer'].concat(Object.keys(STYLE_STRINGS))) {
        const table = stringsFor(styleId);
        for (const side of ['stand', 'crouch']) {
          for (const keys in table[side]) {
            const moves = table[side][keys], name = styleId + ' ' + side + ' ' + keys;
            if (keys.length > STRING_MAX_STEPS || moves.length !== keys.length) problems.push(name + ' length');
            moves.forEach((id, i) => { if (!ATTACKS[id] || ATTACKS[id].btn[1] !== keys[i].toLowerCase()) problems.push(name + ' step ' + (i + 1) + ' is not a ' + keys[i]); });
            if (ATTACKS[moves[0]] && ATTACKS[moves[0]].tier === 3) problems.push(name + ' starts on a strong move');
            if (keys.length > 1 && table[side][keys.slice(0, -1)].join() !== moves.slice(0, -1).join()) problems.push(name + ' prefix differs');
          }
          for (const first of ['P', 'K']) if (!table[side][first]) problems.push(styleId + ' ' + side + ' lacks ' + first);
        }
        const strong = new Set();
        for (const side of ['stand', 'crouch']) for (const keys in table[side]) table[side][keys].forEach((id) => { if (ATTACKS[id].tier === 3) strong.add(id); });
        if (!strong.size) problems.push(styleId + ' has no strong move');
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Every strong string move is punishable on block: its block advantage is at least as negative as the jab startup (a perfect block or a sway then hands the defender a counter)', () => {
      const jabStartup = ATTACKS.jab.startup, problems = [];
      for (const styleId of ['kickboxer'].concat(Object.keys(STYLE_STRINGS))) {
        const table = stringsFor(styleId);
        for (const side of ['stand', 'crouch']) for (const keys in table[side]) table[side][keys].forEach((id) => {
          const mv = ATTACKS[id], onBlock = frameAdvantage(mv).onBlock;
          if (mv.tier === 3 && onBlock > -jabStartup) problems.push(styleId + ' ' + keys + ' ' + id + ' ' + onBlock);
        });
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Attack-string shares: over every pair of the six ranked presets at Normal and Hard no string tops ' + STRING_SHARE_LIMIT * 100 + '% of a fighter\'s damage and punches and kicks each carry ' + PUNCH_SHARE_BAND[0] * 100 + '-' + PUNCH_SHARE_BAND[1] * 100 + '% of the strike damage', () => {
      const problems = [], ranked = ROSTER.filter((r) => Number.isInteger(r.rank)).map((r) => r.id), pairs = [];
      // the six ranked presets cover every string table; all 32 presets (P5-04) would take 40 s here: the full roster is P14-01's balance run
      for (let i = 0; i < ranked.length; i++) for (let j = i + 1; j < ranked.length; j++) pairs.push([ranked[i], ranked[j]]);
      for (const difficulty of ['normal', 'hard']) {
        const r = self.stringShare(STRING_SHARE_SEEDS, { difficulty, timer: 60, winsNeeded: 1, pairs: pairs.slice() });
        if (r.error) return r.error;
        if (r.worst.share > STRING_SHARE_LIMIT) problems.push(difficulty + ': ' + r.worst.id + ' ' + r.worst.key + ' ' + Math.round(r.worst.share * 100) + '%');
        if (r.punch < PUNCH_SHARE_BAND[0] || r.punch > PUNCH_SHARE_BAND[1]) problems.push(difficulty + ': punches ' + Math.round(r.punch * 100) + '%');
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Fast presses keep their order: P K P and K K K typed 3 ticks apart play the whole string', () => {
      const problems = [];
      for (const keys of ['PKP', 'KKK']) {
        const log = self.capture(['attackStart']);
        let next = 0;
        const m = mk({}, (it, f, o, mm) => {
          if (next < keys.length && mm.tick >= 2 + next * 3) { it[keys[next] === 'P' ? 'punch' : 'kick'] = true; next++; }   // >=: a press during hit-stop is read right after it
        });
        self.place(m, 1.1); self.run(m, 200); log.stop(); m.dispose();
        const got = log.attackStart.filter((e) => e.f.index === 0).map((e) => e.mv.id).join();
        if (got !== STRINGS.stand[keys].join()) problems.push(keys + ': ' + got);
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('A crouch string with no crouch row starts over (Crouch P, Crouch K: body jab, then low kick)', () => {
      const got = playString('PK', (it, f, o, kind) => { if (kind) { it[kind] = true; it.height = true; } }).join();
      return got === 'body_jab,low_kick' ? true : got;
    });
    test('Punch / Kick presses reach the fight in press order, even when two arrive in the same frame', () => {
      const p = new PlayerInput(1);
      p.press('kick'); p.press('punch');
      const first = p.takeAttack(), second = p.takeAttack(), none = p.takeAttack();
      return first === 'kick' && second === 'punch' && none === null && !p.latch.punch && !p.latch.kick ? true : [first, second, none].join();
    });
    test('A whiffed string step restarts the string (K P, then P: a new jab, not the Heavy Uppercut)', () => {
      const log = self.capture(['attackStart']);
      let step = 0;
      const m = mk({}, (it, f, o, mm) => {
        if (mm.tick === 2) { it.kick = true; step = 1; }
        else if (step === 1 && f.moveConnected) { o.x = f.x + 3; o.prevX = o.x; it.punch = true; step = 2; }   // the front kick hit; the jab that follows whiffs
        else if (step === 2 && f.state !== S.ATTACK && f.lastMoveId === 'jab' && !f.moveConnected) { it.punch = true; step = 3; }
      });
      self.place(m, 1.2); self.run(m, 90); log.stop();
      const ids = log.attackStart.filter((e) => e.f.index === 0).map((e) => e.mv.id).join();
      return ids === 'front_kick,jab,jab' ? true : 'moves ' + ids;
    });
    test('A press within the string window continues the string, one tick later it restarts (counted in simulation ticks)', () => {
      const run = (gap) => {   // gap = fighter ticks between the two presses (hit-stop pauses the fighters, so the match tick is not the clock)
        const log = self.capture(['attackStart']);
        let first = -1, second = false;
        const m = mk({}, (it, f, o, mm) => {
          if (mm.tick === 2) { it.kick = true; first = f.age; } else if (first >= 0 && !second && f.age - first === gap) { it.kick = true; second = true; }
        });
        self.place(m, 1.2); self.run(m, 2 + gap + 40); log.stop();
        return log.attackStart.filter((e) => e.f.index === 0).map((e) => e.mv.id).join();
      };
      const edge = run(ATTACK_STRING_TICKS), late = run(ATTACK_STRING_TICKS + 1);
      return ATTACK_STRING_TICKS === 48 && edge === 'front_kick,roundhouse' && late === 'front_kick,front_kick' ? true : 'edge ' + edge + ' late ' + late;
    });
    test('Being hit, clinched, thrown or knocked down ends the string; walking and blocking keep it', () => {
      const f = new Fighter(ROSTER_BY_ID.kai, 0);
      const ended = [S.HIT, S.STAGGER, S.STUN, S.CLINCH, S.THROWN].map((next) => { f.reset(0, 0, 0); f.stringKeys = 'PK'; f.setState(next); return f.stringKeys === ''; });
      f.reset(0, 0, 0); f.setState(S.HIT); f.stringKeys = 'PK'; f.setState(S.DOWN); ended.push(f.stringKeys === '');
      f.reset(0, 0, 0); f.stringKeys = 'PK'; f.setState(S.WALK); f.setState(S.BLOCK_H);
      return ended.every(Boolean) && f.stringKeys === 'PK' ? true : 'ended ' + ended.join() + ' keys "' + f.stringKeys + '"';
    });
    test('Strong attacks cost more stamina and have longer recovery', () => {
      const l = ATTACKS.jab, h = ATTACKS.heavy_roundhouse;
      const m = mk({}); const f = m.fighters[0];
      const full = f.stam; f.startAttack(h);
      const spent = full - f.stam;
      return h.stam > l.stam && h.recovery > l.recovery && spent >= h.stam - 1 ? true : 'spent ' + spent;
    });
    test('Defend: standing stops high + mid, with Crouch it stops low, mids beat the low guard', () => {
      const trial = (k, mods, low) => {
        const log = self.capture(['hit', 'block']);
        const m = mkBlock({}, (it, f, o, mm) => { if (mm.tick === 2) { it[k] = true; } if (mm.tick >= 1) Object.assign(it, mods); }, (it, f, o, mm) => { if (mm.tick >= 1) { it.defend = true; it.crouch = low; } });
        self.place(m, 1.2); self.run(m, 50); log.stop(); m.dispose();
        return { hit: log.hit.length, block: log.block.length };
      };
      const a = trial('punch', {}, false), b = trial('kick', { height: true }, true), c = trial('kick', {}, true), d = trial('kick', { height: true }, false);
      return a.block === 1 && a.hit === 0 && b.block === 1 && c.hit === 1 && d.hit === 1 ? true : JSON.stringify([a, b, c, d]);
    });
    test('Defend picks the guard: standing = high, Crouch held = low, Crouch alone = crouch (no guard)', () => {
      const stateFor = (defend, crouch) => {
        const m = mkBlock({}, null, (it, f, o, mm) => { it.defend = defend; it.crouch = crouch; }); self.place(m, 3); self.run(m, 8);
        const state = m.fighters[1].state; m.dispose(); return state;
      };
      const standing = stateFor(true, false), low = stateFor(true, true), crouch = stateFor(false, true), idle = stateFor(false, false);
      // the keyboard path: the Defend key alone, then with the Crouch key held
      const device = Input.lastDevice, it = makeIntent(), f = new Fighter(ROSTER_BY_ID.kai, 0), o = new Fighter(ROSTER_BY_ID.mara, 1);
      Input.reset(); Input.releaseAll(); Input.lastDevice = 'keyboard';
      Input.kb.add(Keymap.bindings.defend[0]); Input.update(); Input.fillIntent(it, f, o);
      const keyHigh = it.defend && !it.crouch;
      Input.kb.add(Keymap.bindings.crouch[0]); Input.update(); Input.fillIntent(it, f, o);
      const keyLow = it.defend && it.crouch;
      Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device;
      const r = { standing: standing === S.BLOCK_H, low: low === S.BLOCK_L, crouch: crouch === S.CROUCH, idle: idle === S.IDLE, keyHigh, keyLow };
      return Object.values(r).every(Boolean) ? true : JSON.stringify(r);
    });
    test('Crouching avoids a high attack', () => {
      const log = self.capture(['hit']);
      const m = mk({}, once(2, 'punch'), (it) => { it.crouch = true; }); self.place(m, 1.2); self.run(m, 50); log.stop();
      return log.hit.length === 0 ? true : 'jab hit a crouching fighter';
    });
    test('Perfect block window, guard pressure and guard break', () => {
      let log = self.capture(['block']);
      let m = mkBlock({}, once(2, 'punch'), (it, f, o, mm) => { if (mm.tick >= 5) it.defend = true; }); self.place(m, 1.2); self.run(m, 40); log.stop();
      const perfect = log.block.length === 1 && log.block[0].perfect;
      m.dispose();
      log = self.capture(['block']);
      m = mkBlock({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.power_jab); }, (it) => { it.defend = true; }); self.place(m, 1.2); m.fighters[1].stam = 4; self.run(m, 60); log.stop();   // a strong move straight from the move table (the string path is tested above)
      const broke = log.block.some((b) => b.broke) && m.fighters[1].state === S.STUN;
      return perfect && broke ? true : 'perfect ' + perfect + ' broke ' + broke;
    });
    test('A thrown fighter lifted onto support without an airborne tick still lands, gets up and plays on (rubble softlock)', () => {
      const m = mk({}, () => {}); self.place(m, 2.5);
      const f = m.fighters[1], path = [];
      f.setState(S.THROWN); f.y = f.groundY; f.vy = 0;   // what rubble does: the rising fighter is set on its top with vy 0
      for (let i = 0; i < 400 && !(path.includes(S.DOWN) && f.state === S.IDLE); i++) { m.step(); if (path[path.length - 1] !== f.state) path.push(f.state); }
      m.dispose();
      return path.includes(S.DOWN) && f.state === S.IDLE ? true : 'path ' + path.join('>');
    });
    /* ----- Falling (P3-07). The shipped levels only give footing at crate tops (0.9-0.95) and rubble (0.22 / 0.55), so most of these tests add a standable box of their own:
       after the match exists (a new match rebuilds the arena), and always taken out again. ----- */
    const withLedge = (top, half, fn, x = 0) => {
      const ledge = { x, z: 0, hx: half, hz: half, top, standable: true, active: true, obj: null, temp: false, timer: 0, thin: false };
      Arena.colliders.push(ledge);
      try { return fn(ledge); } finally { const at = Arena.colliders.indexOf(ledge); if (at >= 0) Arena.colliders.splice(at, 1); }
    };
    const putAt = (f, x, z, y) => { f.x = x; f.z = z; f.y = y; f.prevX = x; f.prevZ = z; f.prevY = y; f.vy = 0; };
    /* Sets a fighter down on footing and steps once, so that height is recorded as the footing it last stood on. */
    const standAt = (m, f, x, z, y) => { putAt(f, x, z, y); m.step(); };
    /* Steps n ticks and reports: the state path, ticks spent above the footing, whether the fighter ever hovered (above it, not rising, yet no lower than the tick before,
       two ticks running: the tick the footing goes still holds the old height) and the fall damage events that hit it (count, and the HP those ticks took). */
    const watchFall = (m, f, n) => {
      const r = { path: [f.state], air: 0, hover: false, fallEvents: 0, fallLoss: 0 };
      let fired = false, still = 0;
      const off = Events.on('fallDamage', (e) => { if (e.f === f) { fired = true; r.fallEvents++; } });
      for (let i = 0; i < n; i++) {
        const y0 = f.y, hp0 = f.hp;
        fired = false;
        m.step();
        if (fired) r.fallLoss += hp0 - f.hp;
        if (f.y > f.groundY + 0.02) { r.air++; still = f.y >= y0 && f.vy <= 0 ? still + 1 : 0; if (still >= 2) r.hover = true; } else still = 0;
        if (r.path[r.path.length - 1] !== f.state) r.path.push(f.state);
      }
      off();
      return r;
    };
    /* Fighter 0 stands on a ledge of height `top` and walks off its +x edge (fighter 1 waits out on the floor, in front of it); hp = a starting HP to set. */
    const walkOff = (top, hp) => {
      const m = mk({}, (it, f, o, mm) => { if (mm.tick >= 3) it.fwd = 1; });
      const f = m.fighters[0], o = m.fighters[1];
      return withLedge(top, 0.6, () => {
        o.x = 4; o.z = 0; o.prevX = 4; o.prevZ = 0;
        f.yaw = Math.PI / 2;
        if (hp !== undefined) f.hp = hp;
        standAt(m, f, 0.3, 0, top);
        const hp0 = f.hp, w = watchFall(m, f, 160);
        const res = { w, hpLoss: hp0 - f.hp, y: f.y, alive: f.alive, momentum: f.momentum + o.momentum, scale: Combat.comboScale(f.gotHits) * f.stats.taken * f.stats.impact };
        m.dispose();
        return res;
      });
    };
    test('Falling: walking off a crate top drops the fighter in the Falling state under gravity (no floating), lands it with a stagger and charges the fall damage', () => {
      const illegal = Diag.illegalTransitions, log = self.capture(['fall']);
      const r = walkOff(0.95);
      log.stop();
      const expected = Combat.fallDamageFor(0.95) * r.scale, w = r.w;
      const ok = w.path.includes(S.FALL) && w.path.indexOf(S.STAGGER) > w.path.indexOf(S.FALL) && !w.hover && w.air > 5 && Math.abs(r.y) < 1e-6
        && log.fall.length === 1 && Math.abs(log.fall[0].drop - 0.95) < 1e-6 && w.fallEvents === 1 && expected > 1 && Math.abs(r.hpLoss - expected) < 1e-6 && Diag.illegalTransitions === illegal;
      return ok ? true : JSON.stringify({ path: w.path, hover: w.hover, air: w.air, y: r.y, falls: log.fall.length, events: w.fallEvents, hpLoss: r.hpLoss, expected, illegal: Diag.illegalTransitions - illegal });
    });
    test('Falling: scenery that breaks under a standing fighter drops the fighter onto the rubble', () => {
      const m = mk({ arenaId: 'warehouse' }), log = self.capture(['fall']);
      try {
        const crate = Arena.objects.find((q) => q.id === 'crateA'), f = m.fighters[0], o = m.fighters[1];
        o.x = 3; o.z = 3; o.prevX = 3; o.prevZ = 3;
        standAt(m, f, crate.x, crate.z, crate.h);
        for (let i = 0; i < 5; i++) m.step();
        const stood = f.state === S.IDLE && Math.abs(f.y - crate.h) < 1e-6;
        Arena.damageObject(crate, 999, 'heavy', 4242, 1, 0, crate.x, 0.5, crate.z, 1);
        const rubble = crate.rubble ? crate.rubble.top : -1, w = watchFall(m, f, 120);
        log.stop();
        const ok = stood && rubble > 0 && w.path.includes(S.FALL) && !w.hover && w.air > 5 && Math.abs(f.y - rubble) < 1e-6 && f.state !== S.FALL
          && log.fall.length === 1 && Math.abs(log.fall[0].drop - (crate.h - rubble)) < 1e-6;
        return ok ? true : JSON.stringify({ stood, rubble, path: w.path, hover: w.hover, air: w.air, y: f.y, falls: log.fall.length });
      } finally { log.stop(); Arena.reset(); }
    });
    test('Falling: a knockback off a pillar top drops the fighter to the floor, and the fall damage follows the formula', () => {
      const m = mk({ arenaId: 'warehouse' });
      try {
        const pillar = Arena.objects.find((q) => q.id === 'pillarL'), a = m.fighters[0], d = m.fighters[1];
        Arena.damageObject(pillar, 999, 'heavy', 4243, 1, 0, pillar.x, 1, pillar.z, 0);
        const top = pillar.rubble.top;
        a.yaw = Math.PI / 2; d.yaw = -Math.PI / 2;
        putAt(a, pillar.x - 0.2, pillar.z, top); putAt(d, pillar.x + 0.55, pillar.z, top);
        m.step();
        const stood = d.groundY === top && a.groundY === top;
        a.startAttack(ATTACKS.roundhouse);   // the knock carries d past the rubble's edge
        const w = watchFall(m, d, 200), expected = Combat.fallDamageFor(top) * Combat.comboScale(d.gotHits) * d.stats.taken * d.stats.impact;
        const ok = stood && top > STEP_HEIGHT && w.air > 3 && !w.hover && Math.abs(d.y) < 1e-6 && w.fallEvents === 1 && expected > 0 && expected < 1 && Math.abs(w.fallLoss - expected) < 1e-6;
        return ok ? true : JSON.stringify({ stood, top, air: w.air, hover: w.hover, y: d.y, events: w.fallEvents, loss: w.fallLoss, expected, path: w.path });
      } finally { Arena.reset(); }
    });
    test('Falling: a drop under the threshold keeps the state and costs nothing; just past it the fighter switches to Falling (still free of damage below the free drop)', () => {
      const shallow = [0.22, FALL_STATE_DROP - 0.02].map((top) => walkOff(top)), past = walkOff(FALL_STATE_DROP + 0.05);
      const kept = shallow.every((r) => r.w.air > 0 && !r.w.hover && r.w.path.every((s) => s === S.IDLE || s === S.WALK) && r.w.fallEvents === 0 && r.hpLoss === 0 && Math.abs(r.y) < 1e-6);
      const switched = past.w.path.includes(S.FALL) && past.w.fallEvents === 0 && past.hpLoss === 0 && Math.abs(past.y) < 1e-6 && !past.w.hover;
      return kept && switched ? true : JSON.stringify({ shallow: shallow.map((r) => [r.w.path.join('>'), r.w.air, r.hpLoss]), past: [past.w.path.join('>'), past.w.air, past.hpLoss] });
    });
    test('Falling: fall damage grows with the height and is capped; a tall drop knocks the fighter down, a deadly one knocks it out, neither feeds the momentum gauge', () => {
      const heights = [0, 0.3, 0.5, 0.55, 0.95, 2, 3, 6, 50], dmg = heights.map((h) => Combat.fallDamageFor(h));
      const shape = dmg[0] === 0 && dmg[1] === 0 && dmg[2] === 0 && dmg[3] > 0 && dmg[3] < 1 && dmg.every((v, i) => i === 0 || v >= dmg[i - 1]) && dmg[8] === FALL_DAMAGE_MAX
        && Math.abs(dmg[5] - (2 - FALL_DAMAGE_FREE_DROP) * FALL_DAMAGE_PER_METER) < 1e-9;
      const tall = walkOff(2.4), expected = Combat.fallDamageFor(2.4) * tall.scale;
      const knockedDown = tall.w.path.includes(S.FALL) && tall.w.path.includes(S.DOWN) && Math.abs(tall.w.fallLoss - expected) < 1e-6 && tall.momentum === 0;
      const log = self.capture(['ko']), dead = walkOff(0.95, 1);
      log.stop();
      const knockedOut = dead.w.path.includes(S.KO) && !dead.alive && log.ko.length === 1 && dead.momentum === 0;
      return shape && knockedDown && knockedOut ? true : JSON.stringify({ dmg, tall: [tall.w.path.join('>'), tall.w.fallLoss, expected, tall.momentum], dead: [dead.w.path.join('>'), dead.alive, log.ko.length, dead.momentum] });
    });
    test('Falling: the CPU does not walk off a high ledge on its own, climbs off a crate only after AI_EDGE_PATIENCE, and a hit still carries it off', () => {
      const alone = (guard, top = 3) => {
        const m = mk({}), ai = new AIController(ROSTER_BY_ID.kai, 'hard');
        if (!guard) ai.holdAtEdge = () => {};   // the control run: the same scene with the edge check off
        m.controllers[1] = ai;
        const a = m.fighters[0], d = m.fighters[1];
        return withLedge(top, 0.6, () => {
          a.x = 3.5; a.z = 0; a.prevX = 3.5; a.prevZ = 0;
          d.yaw = Math.PI / 2;
          standAt(m, d, 0.3, 0, top);
          let lowest = d.y, fell = false, edge = 0, fellAt = -1;
          for (let i = 0; i < 600; i++) { m.step(); lowest = Math.min(lowest, d.y); if (d.state === S.FALL && !fell) { fell = true; fellAt = i; } if (d.x > 0.45) edge++; }
          m.dispose();
          return { lowest, fell, edge, fellAt };
        });
      };
      const guarded = alone(true), control = alone(false), crate = alone(true, 0.95);   // 0.95 m costs 3.6 hp (cheap), 3 m costs 20
      const m = mk({}), ai = new AIController(ROSTER_BY_ID.kai, 'hard');
      ai.navigate = () => false;   // this scene watches the fall, not the way back up (the CPU would now jump back onto the ledge to its foe)
      m.controllers[1] = ai;
      const a = m.fighters[0], d = m.fighters[1], log = self.capture(['fallDamage']);
      const hit = withLedge(0.95, 0.6, () => {
        a.yaw = Math.PI / 2; d.yaw = -Math.PI / 2;
        putAt(a, -0.3, 0, 0.95); putAt(d, 0.4, 0, 0.95);
        m.step();
        Combat.landHit({ type: 'strike', att: a, def: d, mv: ATTACKS.roundhouse, block: 'none' }, m);
        const w = watchFall(m, d, 150);
        return { w, y: d.y };
      });
      log.stop(); m.dispose();
      const ok = !guarded.fell && guarded.lowest > 2.9 && guarded.edge > 0 && control.fell && control.lowest < 0.5 && crate.fell && crate.fellAt >= AI_EDGE_PATIENCE && hit.w.air > 5 && Math.abs(hit.y) < 1e-6 && log.fallDamage.length === 1;
      return ok ? true : JSON.stringify({ guarded, control, crate, hit: [hit.w.air, hit.y, log.fallDamage.length] });
    });
    test('Falling: a clinch ends cleanly when one fighter drops off the edge, and a hold ends when the footing goes (no illegal transitions)', () => {
      const illegal = Diag.illegalTransitions;
      const m = mk({}), a = m.fighters[0], b = m.fighters[1];
      const clinch = withLedge(0.95, 0.6, () => {
        a.yaw = Math.PI / 2; b.yaw = -Math.PI / 2;
        putAt(a, 0.4, 0, 0.95); putAt(b, -0.4, 0, 0.95);
        m.step();
        a.setState(S.ATTACK); Combat.startClinch(a, b, m);   // the front grip puts b 0.78 ahead of a: well past the +x edge
        const held = a.state === S.GRAPPLE && b.state === S.CLINCH;
        const w = watchFall(m, b, 120);
        return { held, w, ended: a.partner === null && b.partner === null && a.state !== S.GRAPPLE && b.state !== S.CLINCH, aStayed: Math.abs(a.y - 0.95) < 1e-6, bY: b.y };
      });
      m.dispose();
      // a hold: the victim lies on one ledge, the holder stands on another; the footing under one of them goes (dropVictim: the victim's, else the holder's)
      const holdCase = (dropVictim) => {
        const m2 = mk({}), h = m2.fighters[0], v = m2.fighters[1], ends = self.capture(['submissionEnd']);
        const res = withLedge(0.95, 0.4, (under) => withLedge(0.95, 0.6, (beside) => {   // under: narrow, so the holder (0.8 m away) stands on the other one only
          h.yaw = Math.PI / 2; v.yaw = -Math.PI / 2;
          putAt(h, -0.2, 0, 0.95); putAt(v, -1.0, 0, 0.95);
          m2.step();
          v.setState(S.HIT); v.setState(S.DOWN);
          Combat.startSubmission(h, v, m2);
          for (let i = 0; i < 4; i++) m2.step();
          const held = h.state === S.SUBMIT && v.pinnedBy === h;
          (dropVictim ? under : beside).active = false;
          const w = watchFall(m2, dropVictim ? v : h, 120);
          return { held, w, released: v.pinnedBy === null && h.partner === null && h.state !== S.SUBMIT, hY: h.y, vY: v.y, hState: h.state, vState: v.state };
        }, 0.3), -1.0);
        ends.stop(); m2.dispose();
        return Object.assign(res, { ends: ends.submissionEnd.map((e) => e.reason).join() });
      };
      const victimFalls = holdCase(true), holderFalls = holdCase(false);
      const ok = clinch.held && clinch.w.path.includes(S.FALL) && clinch.ended && clinch.aStayed && Math.abs(clinch.bY) < 1e-6
        && victimFalls.held && victimFalls.released && victimFalls.ends === 'broken' && Math.abs(victimFalls.vY) < 1e-6 && Math.abs(victimFalls.hY - 0.95) < 1e-6 && victimFalls.hState === S.IDLE
        && holderFalls.held && holderFalls.released && holderFalls.ends === 'broken' && holderFalls.w.path.includes(S.FALL) && Math.abs(holderFalls.hY) < 1e-6 && Math.abs(holderFalls.vY - 0.95) < 1e-6
        && Diag.illegalTransitions === illegal;
      const brief = (c) => [c.held, c.released, c.ends, c.hState, c.vState, c.hY, c.vY];
      return ok ? true : JSON.stringify({ clinch: [clinch.held, clinch.w.path.join('>'), clinch.ended, clinch.aStayed, clinch.bY], victimFalls: brief(victimFalls), holderFalls: [...brief(holderFalls), holderFalls.w.path.join('>')], illegal: Diag.illegalTransitions - illegal });
    });
    test('Guarding or crouching while moving steps the legs (walk legs with the guard up; crouch walk), slower than walking', () => {
      const legSwing = (fill) => {
        const m = mk({}, fill); self.place(m, 4);
        const f = m.fighters[0], hips = [], states = new Set(), speeds = [];
        for (let i = 0; i < 70; i++) { m.step(); f.animate(FIXED_DT); if (i > 20) { hips.push(f.tp[J.hipLx]); states.add(f.state); speeds.push(Math.hypot(f.vx, f.vz)); } }
        m.dispose();
        return { swing: Math.max(...hips) - Math.min(...hips), states: [...states].join(), speed: Math.max(...speeds) };
      };
      const walk = legSwing((it) => { it.fwd = -1; });
      const guard = legSwing((it) => { it.defend = true; it.fwd = -1; });
      const crouch = legSwing((it) => { it.crouch = true; it.fwd = -1; });
      const ok = guard.states === S.BLOCK_H && crouch.states === S.CROUCH && guard.swing > 0.15 && crouch.swing > 0.15 && guard.speed < walk.speed && crouch.speed < walk.speed;
      return ok ? true : JSON.stringify({ walk, guard, crouch });
    });
    test('Every strong string move breaks a full-stamina block (not a perfect one); a normal move does not', () => {
      const strong = Object.keys(ATTACKS).filter((id) => ATTACKS[id].tier === 3 && !ATTACKS[id].ctx);
      const tryBreak = (id) => {
        const log = self.capture(['block']);
        const m = mkBlock({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS[id]); }, (it) => { it.defend = true; it.crouch = ATTACKS[id].h === 'L'; });   // held from the start: never a perfect block
        self.place(m, 1.2); self.run(m, 60); log.stop(); m.dispose();
        return log.block.length > 0 && log.block.every((b) => !b.perfect) && log.block.some((b) => b.broke);
      };
      const missed = strong.filter((id) => !tryBreak(id));
      return strong.length === 8 && !missed.length && !tryBreak('cross') ? true : 'no break: ' + missed.join(',') + ' strong ' + strong.length;
    });
    test('Perfect block opens one counter, the next press is a normal move', () => {
      const log = self.capture(['attackStart']);
      let first = 0, second = false;
      const m = mkBlock({}, once(2, 'punch'), (it, f, o, mm) => {
        if (!first && f.counterWindow > 0) { it.punch = true; first = mm.tick; } else if (first && !second && mm.tick >= first + 30) { it.punch = true; second = true; } else if (!first && mm.tick >= 5) it.defend = true;
      });
      self.place(m, 1.2); self.run(m, 90); log.stop();
      const moves = log.attackStart.filter((e) => e.f.index === 1).map((e) => e.mv.id).join();
      return moves === 'counter_strike,jab' ? true : 'moves ' + moves;
    });
    test('Mashing block never gives a perfect block', () => {
      const log = self.capture(['block']);
      const m = mkBlock({}, once(40, 'punch'), (it, f, o, mm) => { it.defend = mm.tick % 8 !== 0; });
      self.place(m, 1.2); self.run(m, 80); log.stop();
      return log.block.length === 1 && !log.block[0].perfect ? true : 'blocks ' + log.block.length + ' perfect ' + log.block.some((b) => b.perfect);
    });
    test('Combo chain: legal transitions, scaling, count', () => {
      const log = self.capture(['hit']);
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2 || mm.tick === 14) it.punch = true; }); self.place(m, 1.1); self.run(m, 90); log.stop();   // the second press waits out the jab's hit-stop
      const ok = log.hit.length === 2 && log.hit[1].combo === 2;
      const rules = Combat.canChain(ATTACKS.jab, ATTACKS.cross, m.fighters[0]) && !Combat.canChain(ATTACKS.power_jab, ATTACKS.jab, m.fighters[0]) && !Combat.canChain(ATTACKS.cross, ATTACKS.jab, m.fighters[0]);
      return ok && rules ? true : 'hits ' + log.hit.length + ' rules ' + rules;
    });
    test('Grapple: clinch, escape inside window, early escape fails', () => {
      let log = self.capture(['clinch', 'escape', 'throw']);
      let m = mk({}, once(2, 'grapple'), (it, f) => { if (f.state === S.CLINCH && f.clinchTick === 14) it.grapple = true; }); self.place(m, 1.0); self.run(m, 80); log.stop();
      const escaped = log.clinch.length === 1 && log.escape.length === 1 && log.throw.length === 0;
      m.dispose();
      log = self.capture(['escapeFail', 'escape']);
      m = mk({}, once(2, 'grapple'), (it, f) => { if (f.state === S.CLINCH && f.clinchTick === 4) it.grapple = true; }); self.place(m, 1.0); self.run(m, 30); log.stop();
      const failed = log.escapeFail.length === 1 && log.escape.length === 0 && m.fighters[1].state === S.CLINCH;
      return escaped && failed ? true : 'escaped ' + escaped + ' failed ' + failed;
    });
    test('Grapple: an escape pressed just before the window is kept, the hint says when to press', () => {
      const log = self.capture(['escapeFail', 'escape']);
      let hints = '';
      const m = mk({}, once(2, 'grapple'), (it, f) => {
        if (f.state !== S.CLINCH) return;
        const h = UI.clinchHint(f).split('!')[0].split(' ')[0];
        if (!hints.endsWith(h)) hints += (hints ? '>' : '') + h;
        if (f.clinchTick === escapeStartFor(f) - 3) it.grapple = true;
      });
      self.place(m, 1.0); self.run(m, 40); log.stop();
      return log.escape.length === 1 && log.escapeFail.length === 0 && hints === 'CLINCHED>ESCAPE' ? true : 'escapes ' + log.escape.length + ' fails ' + log.escapeFail.length + ' hints ' + hints;
    });
    test('Clinch: at most two strikes per clinch, then it times out', () => {
      const log = self.capture(['hit']);
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.grapple = true; if (f.state === S.GRAPPLE && mm.tick % 5 === 0) it.punch = true; });
      self.place(m, 1.0); self.run(m, 220); log.stop();
      const elbows = log.hit.filter((h) => h.mv.id === 'elbow').length;
      return elbows === CLINCH_STRIKE_MAX && m.fighters[1].state !== S.CLINCH ? true : 'elbows ' + elbows + ' defender ' + m.fighters[1].state;
    });
    test('Clinch: Punch is the elbow, Kick is the knee, only Grapple throws', () => {
      const log = self.capture(['hit', 'throw']);
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.grapple = true; if (f.state === S.GRAPPLE && f.clinchTick === 8) it.kick = true; if (f.state === S.GRAPPLE && f.clinchTick === 30) it.punch = true; });
      self.place(m, 1.0); self.run(m, 80); log.stop();
      const strikes = log.hit.filter((h) => h.mv.id === 'knee' || h.mv.id === 'elbow').map((h) => h.mv.id).join();
      return strikes === 'knee,elbow' && log.throw.length === 0 ? true : 'strikes ' + strikes + ' throws ' + log.throw.length;
    });
    test('Throw: damage, thrown flight, knockdown and recovery', () => {
      const states = new Set();
      const log = self.capture(['throw']);
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.grapple = true; if (f.state === S.GRAPPLE && f.clinchTick === 10 && !f.throwPending) it.grapple = true; }); self.place(m, 1.0, 0);
      for (let i = 0; i < 260; i++) { m.step(); states.add(m.fighters[1].state); }
      log.stop();
      const d = m.fighters[1].maxHp - m.fighters[1].hp;
      return log.throw.length === 1 && states.has(S.THROWN) && states.has(S.DOWN) && states.has(S.GETUP) && m.fighters[1].state === S.IDLE && d >= 10 ? true : 'throws ' + log.throw.length + ' dmg ' + d + ' ' + [...states].join(',');
    });
    test('One air attack per jump', () => {
      const log = self.capture(['attackStart']);
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.jump = true; if (mm.tick === 4 || mm.tick === 28) it.kick = true; });
      self.place(m, 4); self.run(m, 90); log.stop();
      const air = log.attackStart.filter((e) => e.mv.ctx === 'air').length;
      return air === 1 && m.fighters[0].state === S.IDLE && !m.fighters[0].airAttackUsed ? true : 'air attacks ' + air + ' state ' + m.fighters[0].state;
    });
    test('Buffered presses: a later grapple wins, a clinch strike waits for its cooldown', () => {
      let log = self.capture(['attackStart']);
      let m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.punch = true; if (mm.tick === 4) it.grapple = true; });
      self.place(m, 1.0); m.fighters[0].blockStun = 8; self.run(m, 12); log.stop();
      const grabbed = log.attackStart.map((e) => e.mv.id).join() === 'grab';
      m.dispose();
      log = self.capture(['hit']);
      m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.grapple = true; if (f.state === S.GRAPPLE && (f.clinchTick === 8 || f.clinchTick === 22)) it.punch = true; });
      self.place(m, 1.0); self.run(m, 60); log.stop();
      const elbows = log.hit.filter((h) => h.mv.id === 'elbow').length;
      return grabbed && elbows === 2 ? true : 'grabbed ' + grabbed + ' elbows ' + elbows;
    });
    test('Grab fails against an airborne target', () => {
      const log = self.capture(['clinch']);
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 14) it.grapple = true; }, (it, f, o, mm) => { if (mm.tick === 2) it.jump = true; }); self.place(m, 1.0); self.run(m, 40); log.stop();
      return log.clinch.length === 0 ? true : 'clinched an airborne fighter';
    });
    test('Sweep knockdown (Crouch + Kick, Kick, Kick), quick recovery with a Defend press', () => {
      const m = mk({}, pressString('KKK', { height: true }), (it, f, o) => { f.x = o.x + 1.0; f.prevX = f.x; f.z = o.z; it.defend = f.state === S.DOWN && f.stateTicks === 17; }); self.place(m, 1.2);   // the defender stays in reach of every step; one press
      let rose = -1;
      for (let i = 0; i < 200; i++) { m.step(); if (rose < 0 && m.fighters[1].state === S.GETUP) rose = i; }
      return rose > 0 && rose < 110 && m.fighters[1].quickRise ? true : 'getup at ' + rose;   // three string steps first; a normal get-up would come at 130 or later
    });
    test('Quick recovery: a fresh Defend press while knocked down gets up early; a held Defend, a press too early or too little stamina does not', () => {
      const rises = (defendAt, stam, held) => {
        const m = mk({}, (it, f) => { it.defend = !!held || f.stateTicks === defendAt; });
        self.place(m, 4);
        const f = m.fighters[0];
        f.setState(S.HIT); f.setState(S.DOWN); f.stam = stam;   // a knockdown always follows a hit or a throw
        let got = false;
        for (let i = 0; i < 40; i++) { m.step(); if (f.state === S.GETUP && f.quickRise) got = true; }   // a normal get-up starts after about 52 ticks
        m.dispose();
        return got;
      };
      const fresh = rises(17, 60), held = rises(-1, 60, true), early = rises(6, 60), tired = rises(17, 0);   // a little regenerates while down, but not the 8 needed by tick 17
      return fresh && !held && !early && !tired ? true : JSON.stringify({ fresh, held, early, tired });
    });
    /* Submission tests: DMITRI (Wrestler, may hold) stands 1 m from KAI, who is knocked down; holder / victim script the two fighters. */
    const holdMatch = (opts, holder, victim) => {
      const m = mk(Object.assign({ playerId: 'dmitri', opponentId: 'kai' }, opts), holder, victim);
      self.place(m, 1.0);
      m.fighters[1].setState(S.HIT); m.fighters[1].setState(S.DOWN);
      return m;
    };
    const holdAt2 = once(2, 'grapple');
    /* A victim that taps Defend every `every` ticks from tick 5. */
    const tapDefend = (every) => (it, f, o, m) => { it.defend = m.tick >= 5 && m.tick % every === 0; };
    /* Ticks from the hold start until the victim is free (-1 = still held after `limit` ticks), plus the match for more checks. */
    const escapeTicks = (victim, holder, setup, limit) => {
      const m = holdMatch({}, holder || holdAt2, victim);
      if (setup) setup(m);
      const v = m.fighters[1];
      let start = -1, free = -1;
      for (let i = 0; i < limit; i++) { m.step(); if (start < 0 && m.fighters[0].state === S.SUBMIT) start = i; if (start >= 0 && free < 0 && !v.pinnedBy) free = i - start; }
      return { start, free, m };
    };
    test('Submission: Grapple next to a downed foe holds them for the allowed styles only; a standing or far foe gets a plain grab', () => {
      const started = {};
      for (const style of MOVE_STYLE_IDS) {
        const m = holdMatch({}, holdAt2);
        const a = m.fighters[0], v = m.fighters[1];
        a.profile = Object.assign({}, a.profile, { moveStyle: style });
        const log = self.capture(['submission']); self.run(m, 6); log.stop();
        started[style] = a.state === S.SUBMIT && v.pinnedBy === a && v.state === S.DOWN && a.partner === v && log.submission.length === 1 && Math.hypot(a.x - v.x, a.z - v.z) < SUBMIT_RANGE;
        m.dispose();
      }
      const wrong = MOVE_STYLE_IDS.filter((style) => started[style] !== SUBMISSION_STYLES.has(style));
      const standing = mk({ playerId: 'dmitri', opponentId: 'kai' }, holdAt2); self.place(standing, 1.0); self.run(standing, 6);
      const far = holdMatch({}, holdAt2); self.place(far, 2.6); self.run(far, 6);
      const ok = wrong.length === 0 && SUBMISSION_STYLES.has('wrestler') && SUBMISSION_STYLES.has('judoka') && [...SUBMISSION_STYLES].every((id) => MOVE_STYLE[id]) &&
        standing.fighters[0].state === S.ATTACK && standing.fighters[1].pinnedBy === null && far.fighters[0].state !== S.SUBMIT && far.fighters[1].pinnedBy === null;
      return ok ? true : JSON.stringify({ wrong, started, standing: standing.fighters[0].state, far: far.fighters[0].state });
    });
    test('Submission: damage builds while the hold lasts, the hold ends by itself after 240 ticks, both fighters end sane', () => {
      const log = self.capture(['submissionEnd']);
      const m = holdMatch({}, holdAt2);
      const a = m.fighters[0], v = m.fighters[1], hp = [];
      let start = -1, end = -1;
      for (let i = 0; i < 520; i++) {
        m.step(); hp.push(v.hp);
        if (start < 0 && a.state === S.SUBMIT) start = i;
        if (start >= 0 && end < 0 && a.state !== S.SUBMIT) end = i;
      }
      log.stop();
      const early = hp[start] - hp[start + 60], late = hp[end - 61] - hp[end - 1], total = v.maxHp - v.hp;
      const ok = start > 0 && SUBMIT_MAX_TICKS === 240 && end - start >= 238 && end - start <= 242 && late > early * 1.8 && early > 0.5 && total > 12 && total < 40 &&
        log.submissionEnd.length === 1 && log.submissionEnd[0].reason === 'time' && Math.abs(log.submissionEnd[0].damage - total) < 0.01 && a.hp === a.maxHp &&
        a.state === S.IDLE && v.state === S.IDLE && !v.pinnedBy && !a.partner;
      m.dispose();
      return ok ? true : JSON.stringify({ start, end, early, late, total, a: a.state, v: v.state, ends: log.submissionEnd.map((e) => e.reason) });
    });
    test('Submission: the victim escapes with fast Defend taps (stamina tips it); held Defend, no taps or a mashing holder keep the hold', () => {
      const fresh = escapeTicks(tapDefend(6), null, null, 200);
      const tired = escapeTicks(tapDefend(6), null, (m) => { m.fighters[1].stam = 0; }, 200);
      const heldDefend = escapeTicks((it) => { it.defend = true; }, null, null, 120);
      const noTaps = escapeTicks(() => {}, null, null, 120);
      const mashing = escapeTicks(tapDefend(6), (it, f, o, m) => { if (m.tick === 2 || (m.tick > 4 && m.tick % 5 === 0)) it.grapple = true; }, null, 150);
      const log = self.capture(['submissionEscape', 'quickRise']);
      const m = holdMatch({}, holdAt2, tapDefend(6));
      let rose = false; for (let i = 0; i < 90; i++) { m.step(); if (m.fighters[1].state === S.GETUP) rose = true; }
      log.stop();
      const a = m.fighters[0], v = m.fighters[1];
      const mashQuick = mashing.m.fighters[1].state === S.DOWN && mashing.m.fighters[1].pinnedBy === mashing.m.fighters[0];
      const ok = fresh.free > 0 && fresh.free <= 60 && tired.free > fresh.free && heldDefend.free < 0 && noTaps.free < 0 && mashing.free < 0 && mashQuick &&
        log.submissionEscape.length === 1 && log.quickRise.length === 0 && a.state === S.IDLE && rose && v.quickRise && !v.pinnedBy && !a.partner;
      [fresh, tired, heldDefend, noTaps, mashing].forEach((r) => r.m.dispose()); m.dispose();
      return ok ? true : JSON.stringify({ fresh: fresh.free, tired: tired.free, held: heldDefend.free, none: noTaps.free, mash: mashing.free, mashQuick, escapes: log.submissionEscape.length, quick: log.quickRise.length, a: a.state, v: v.state });
    });
    test('Submission: any hit on the holder breaks it (a strike or scenery damage); the victim then gets up through DOWN / GETUP', () => {
      const log = self.capture(['submissionEnd']);
      const m = holdMatch({}, holdAt2);
      const a = m.fighters[0], v = m.fighters[1];
      self.run(m, 30);
      const held = a.state === S.SUBMIT;
      Combat.landHit({ type: 'strike', att: v, def: a, mv: ATTACKS.jab, block: 'none' }, m);   // a strike from somebody else (in 1v1 the victim stands in for them)
      const reacting = a.state === S.HIT || a.state === S.STAGGER;
      const freed = v.pinnedBy === null && a.partner === null;
      const path = []; for (let i = 0; i < 200; i++) { m.step(); if (path[path.length - 1] !== v.state) path.push(v.state); }
      const m2 = holdMatch({}, holdAt2);
      self.run(m2, 30); const held2 = m2.fighters[0].state === S.SUBMIT;
      Combat.envDamage(m2.fighters[0], 3, m2); self.run(m2, 2);
      const ok = held && reacting && freed && log.submissionEnd[0] && log.submissionEnd[0].reason === 'broken' && path.join('>') === 'DOWN>GETUP>IDLE' && a.state === S.IDLE &&
        held2 && m2.fighters[0].state !== S.SUBMIT && m2.fighters[1].pinnedBy === null && log.submissionEnd.length === 2;
      log.stop(); m.dispose(); m2.dispose();
      return ok ? true : JSON.stringify({ held, reacting, freed, path: path.join('>'), held2, ends: log.submissionEnd.map((e) => e.reason), a: a.state });
    });
    test('Submission: a third fighter can neither grab the holder or the held fighter nor start a second hold on the victim', () => {
      const m = holdMatch({}, holdAt2);
      self.run(m, 30);
      const a = m.fighters[0], v = m.fighters[1];
      const third = new Fighter(Object.assign({}, ROSTER_BY_ID.brutus, { moveStyle: 'wrestler' }), 2);
      third.reset(a.x + 0.5, a.z + 0.2, 0);
      third.yaw = Math.atan2(a.x - third.x, a.z - third.z);
      third.startAttack(ATTACKS.grab); third.moveTick = third.mStartup + 1;
      const control = new Fighter(ROSTER_BY_ID.kai, 3); control.reset(third.x + third.fwdX * 0.9, third.z + third.fwdZ * 0.9, 0);   // proof the grab itself reaches a standing fighter
      const reachesStanding = Combat.evaluate(third, control);
      const grabHolder = Combat.evaluate(third, a), grabVictim = Combat.evaluate(third, v);
      third.yaw = Math.atan2(v.x - third.x, v.z - third.z);
      const grabVictim2 = Combat.evaluate(third, v);
      Combat.startClinch(third, a, m);
      const canHold = Combat.canSubmit(third, v, m);
      const intact = a.state === S.SUBMIT && v.pinnedBy === a && third.state === S.ATTACK;
      m.dispose();
      const ok = reachesStanding && reachesStanding.type === 'grab' && !grabHolder && !grabVictim && !grabVictim2 && !canHold && intact;
      return ok ? true : JSON.stringify({ reachesStanding: !!reachesStanding, grabHolder: !!grabHolder, grabVictim: !!grabVictim, grabVictim2: !!grabVictim2, canHold, intact });
    });
    test('Submission: a KO during the hold ends the round normally; the round timer ending it stops the damage', () => {
      const before = Diag.illegalTransitions;
      const ends = self.capture(['submissionEnd']);
      const ko = holdMatch({}, holdAt2); ko.fighters[1].hp = 3;
      const events = self.capture(['roundEnd']);
      self.run(ko, 400);
      const kv = ko.fighters[1];
      const koOk = kv.state === S.KO && !kv.alive && ko.fighters[0].state !== S.SUBMIT && !ko.fighters[0].partner && ko.phase !== 'fight' && ko.roundWinner === 0 && events.roundEnd.length === 1 && ends.submissionEnd[0].reason === 'ko';
      const timed = holdMatch({ timer: 2 }, holdAt2);
      self.run(timed, 125);
      const tv = timed.fighters[1], hpAtEnd = tv.hp, phase = timed.phase;
      self.run(timed, 40);
      const timeOk = phase !== 'fight' && timed.fighters[0].state !== S.SUBMIT && tv.pinnedBy === null && tv.hp === hpAtEnd && timed.roundWinner === 0 && ends.submissionEnd[1].reason === 'round' && tv.hp < tv.maxHp;
      ends.stop(); events.stop(); ko.dispose(); timed.dispose();
      return koOk && timeOk && Diag.illegalTransitions === before ? true : JSON.stringify({ koOk, timeOk, kv: kv.state, phase, ends: ends.submissionEnd.map((e) => e.reason), illegal: Diag.illegalTransitions - before });
    });
    test('Submission AI: an allowed style holds a downed foe sometimes, other styles never; an AI victim taps Defend by difficulty, a Stand dummy never escapes', () => {
      const holds = (holderId, difficulty) => {
        let n = 0;
        for (let seed = 1; seed <= 8; seed++) {
          const m = holdMatch({ seed, playerId: holderId, opponentId: 'kai' });
          m.controllers[0] = new AIController(ROSTER_BY_ID[holderId], difficulty);
          m.fighters[1].downMult = 3;
          const log = self.capture(['submission']); self.run(m, 100); log.stop(); m.dispose();
          if (log.submission.length > 0) n++;
        }
        return n;
      };
      const wrestler = holds('dmitri', 'expert'), easy = holds('dmitri', 'easy'), kickboxer = holds('kai', 'expert'), boxer = holds('yuki', 'expert');
      const escapes = (make, seeds) => {
        let n = 0;
        for (let seed = 1; seed <= seeds; seed++) {
          const m = holdMatch({ seed }, holdAt2);
          m.controllers[1] = make();
          const log = self.capture(['submissionEscape']); self.run(m, 260); log.stop(); m.dispose();
          n += log.submissionEscape.length;
        }
        return n;
      };
      const hard = escapes(() => new AIController(ROSTER_BY_ID.kai, 'hard'), 6), easyVictim = escapes(() => new AIController(ROSTER_BY_ID.kai, 'easy'), 6);
      const standDummy = escapes(() => new DummyController(ROSTER_BY_ID.kai, 'stand'), 4), aiDummy = escapes(() => new DummyController(ROSTER_BY_ID.kai, 'expert'), 4);
      const ok = wrestler >= 3 && wrestler > easy && kickboxer === 0 && boxer === 0 && hard >= 5 && hard > easyVictim && standDummy === 0 && aiDummy >= 3;
      return ok ? true : JSON.stringify({ wrestler, easy, kickboxer, boxer, hard, easyVictim, standDummy, aiDummy });
    });
    /* ----- submissions made clear (P5-08): the prompt, the meter, the Move list / Help entry per style and Training scenario 6 ----- */
    const idle = () => {};
    test('Submission prompt: a fighter whose style can hold is told so over a knocked-down foe: HOLD in reach, STEP CLOSER up to 2.7 m, TOO TIRED with no stamina, ANOTHER LEVEL when the foe lies higher or lower, the foe is the fighter\'s target, nothing while the fighter is busy, a second human (Versus) gets one too; nothing for a style without holds, a standing foe, a held foe or a foe farther away', () => {
      const problems = [], m = holdMatch({}, idle, idle), a = m.fighters[0], v = m.fighters[1];
      a.target = v;   // the foe a Grapple press acts on (MatchSim.assignTargets sets it every tick)
      const prompt = () => { const foe = UI.holdTarget(m, a); return foe ? UI.holdPromptFor(m, a, foe) : null; };
      const near = prompt();
      if (!near || near.kind !== 'ready' || !near.html.includes('HOLD') || !near.html.includes('PIN')) problems.push('in reach: ' + JSON.stringify(near));
      self.place(m, 2.0); const step = prompt();
      if (!step || step.kind !== 'near' || !step.html.includes('STEP CLOSER')) problems.push('step closer: ' + JSON.stringify(step));
      self.place(m, HOLD_PROMPT_RANGE + 0.3); if (prompt()) problems.push('beyond ' + HOLD_PROMPT_RANGE + ' m');
      self.place(m, 1.0); a.stam = SUBMIT_MIN_STAMINA - 1; const tired = prompt();
      if (!tired || !tired.html.includes('TOO TIRED')) problems.push('tired: ' + JSON.stringify(tired));
      a.stam = a.maxStam; v.submitDone = true; if (prompt()) problems.push('a foe that was held this knockdown'); v.submitDone = false;
      v.pinnedBy = m.fighters[0]; if (prompt()) problems.push('a foe being held'); v.pinnedBy = null;
      a.profile = Object.assign({}, a.profile, { moveStyle: 'kickboxer' }); if (UI.holdTarget(m, a)) problems.push('a style without holds sees a prompt');
      a.profile = Object.assign({}, a.profile, { moveStyle: 'bjj' }); if (!UI.holdTarget(m, a) || !UI.holdPromptFor(m, a, v).html.includes('ARMBAR')) problems.push('BJJ prompt names the hold');
      const standing = mk({ playerId: 'dmitri', opponentId: 'kai' }, idle, idle); self.place(standing, 1.0);
      if (UI.holdTarget(standing, standing.fighters[0])) problems.push('a standing foe');
      a.target = null; if (UI.holdTarget(m, a)) problems.push('the prompt is about a foe that is not the fighter\'s target'); a.target = v;   // the Grapple press acts on the target, so the prompt follows it
      for (const [state, lock] of [[S.HIT, 0], [S.ATTACK, 0], [S.STAGGER, 0], [S.IDLE, 8]]) { a.state = state; a.lock = lock; if (prompt()) problems.push('a prompt while busy (' + state + ' lock ' + lock + ')'); }
      a.state = S.IDLE; a.lock = 0; if (!prompt()) problems.push('no prompt once free');
      v.y = a.y + SUBMIT_LEVEL_GAP + 0.2; const level = prompt(); v.y = a.y;
      if (!level || !level.html.includes('ANOTHER LEVEL') || level.html.includes('STEP CLOSER')) problems.push('level gap: ' + JSON.stringify(level));
      m.dispose();
      const vs = holdMatch({}, idle, idle); vs.versus = true;
      vs.controllers[0].human = true; vs.controllers[1].human = true;
      const p2 = vs.fighters[1], p1 = vs.fighters[0];   // the second human holds, the first lies on the floor
      p1.setState(S.IDLE); p1.state = S.DOWN; p2.state = S.IDLE; p2.profile = Object.assign({}, p2.profile, { moveStyle: 'wrestler' }); p2.target = p1; p1.target = p2;
      const prompts = UI.holdPrompts(vs);
      if (prompts[0] || !prompts[1] || !prompts[1].html.includes('2P') || prompts[1].dy !== HOLD_PROMPT_STACK_PX) problems.push('versus P2 prompt: ' + JSON.stringify(prompts[1] && { html: prompts[1].html, dy: prompts[1].dy }));
      vs.dispose();
      if (UI.dom.holdPrompt && (!UI.dom.holdPrompt2 || !UI.dom.holdMeter || !UI.dom.holdMeter2)) problems.push('prompt and meter elements');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Submission meter: a hold in progress shows how close the held fighter is to free (empty at the holder\'s lead cap, full at the escape goal), the seconds left, the hold name and who taps what; the HUD update runs through a hold without error', () => {
      const problems = [], m = holdMatch({}, once(2, 'grapple'), idle), a = m.fighters[0], v = m.fighters[1];
      self.run(m, 8);
      if (a.state !== S.SUBMIT) problems.push('no hold');
      m.controllers[0].human = true; m.controllers[1].human = true;
      a.holdContest = SUBMIT_CONTEST_FLOOR; const low = UI.holdMeterFor(m, a);
      a.holdContest = SUBMIT_ESCAPE_GOAL; const full = UI.holdMeterFor(m, a);
      a.holdContest = (SUBMIT_CONTEST_FLOOR + SUBMIT_ESCAPE_GOAL) / 2; const mid = UI.holdMeterFor(m, a);
      if (low.progress !== 0 || full.progress !== 1 || Math.abs(mid.progress - 0.5) > 1e-9) problems.push('progress ' + [low.progress, mid.progress, full.progress]);
      if (!(low.left > 3.5 && low.left <= SUBMIT_MAX_TICKS / 60) || !mid.html.includes('width:50%') || !mid.html.includes('ESCAPE') || !mid.html.includes('HELD') || !mid.html.includes('PIN')) problems.push('html ' + mid.html);
      if (!mid.html.includes('TO ESCAPE') || !mid.html.includes('TO SQUEEZE') || (mid.html.match(/class="tap"/g) || []).length !== 2) problems.push('who taps what, a line each');
      m.controllers[0].human = false; if (UI.holdMeterFor(m, a).html.includes('TO SQUEEZE')) problems.push('a CPU holder is told to squeeze');
      try { if (UI.dom.holdPrompt) UI.holdUi(m); a.holdTicks = SUBMIT_MAX_TICKS; UI.holdMeterFor(m, a); } catch (e) { problems.push('holdUi ' + e.message); }
      if (v.pinnedBy !== a) problems.push('victim not held');
      m.dispose();
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Training scenario 6: the dummy lies on the floor within reach for longer than a hold lasts, a hold style can start one at once, and the training panel says what to do (or that the style has no holds)', () => {
      const problems = [];
      if (SCENARIOS.length !== 6 || !SCENARIOS[5].startsWith('6:')) problems.push('scenario list');
      const m = mk({ mode: 'training', playerId: 'dmitri', opponentId: 'kai' }, once(14, 'grapple'), idle);
      m.scenario(6);
      const a = m.fighters[0], b = m.fighters[1];
      if (b.state !== S.DOWN || Math.hypot(a.x - b.x, a.z - b.z) > SUBMIT_RANGE || m.scenarioNo !== 6) problems.push('set up: ' + b.state);
      self.run(m, 30);
      if (a.state !== S.SUBMIT || b.pinnedBy !== a) problems.push('no hold from the scenario (' + a.state + ')');
      if (UI.dom.training) { UI.trainingPanel(m); if (!UI.dom.training.innerHTML.includes('HOLD PRACTICE') || !UI.dom.training.innerHTML.includes('press Grapple') || !UI.dom.training.innerHTML.includes('stays down')) problems.push('panel text'); }
      m.dispose();
      const lone = mk({ mode: 'training', playerId: 'dmitri', opponentId: 'kai' }, idle, idle); lone.scenario(6); self.run(lone, SUBMIT_MAX_TICKS + 60);
      if (lone.fighters[1].state !== S.DOWN) problems.push('the dummy got up after ' + (SUBMIT_MAX_TICKS + 60) + ' ticks');
      lone.dispose();
      for (const level of ['easy', 'normal', 'hard', 'expert']) {   // a CPU dummy presses Defend: that used to get it up in about 0.4 s
        const m2 = mk({ mode: 'training', playerId: 'dmitri', opponentId: 'kai' }, idle); m2.controllers[1] = new DummyController(ROSTER_BY_ID.kai, level); m2.scenario(6); self.run(m2, SUBMIT_MAX_TICKS);
        if (m2.fighters[1].state !== S.DOWN) problems.push('the ' + level + ' dummy got up (' + m2.fighters[1].state + ')');
        m2.dispose();
      }
      const later = mk({ mode: 'training', playerId: 'dmitri', opponentId: 'kai' }, idle); later.controllers[1] = new DummyController(ROSTER_BY_ID.kai, 'expert'); later.scenario(6);   // keepDown lasts one knockdown
      const dummy = later.fighters[1]; dummy.stam = dummy.maxStam; dummy.downMult = 1; dummy.stateTicks = dummy.downTicks();   // the scenario's knockdown ends
      self.run(later, 4);
      if (dummy.keepDown || dummy.state === S.DOWN) problems.push('keepDown outlives the knockdown (' + dummy.keepDown + ' ' + dummy.state + ')');
      self.run(later, 80); dummy.stam = dummy.maxStam; dummy.setState(S.HIT); dummy.setState(S.DOWN); dummy.groundHits = 0; dummy.downMult = 1;   // knocked down again later, a CPU dummy that presses Defend gets up quickly
      let rose = -1; for (let i = 0; i < 40 && rose < 0; i++) { later.step(); if (dummy.state !== S.DOWN) rose = i; }
      if (rose < 0) problems.push('a later knockdown: the dummy cannot quick-rise');
      later.dispose();
      const escape = mk({ mode: 'training', playerId: 'dmitri', opponentId: 'kai' }, once(14, 'grapple')); escape.controllers[1] = new DummyController(ROSTER_BY_ID.kai, 'expert'); escape.scenario(6);
      const log = self.capture(['submissionEscape']); self.run(escape, SUBMIT_MAX_TICKS); log.stop();
      if (log.submissionEscape.length < 1) problems.push('the expert dummy never escaped the hold');
      escape.dispose();
      const striker = mk({ mode: 'training', playerId: 'kai', opponentId: 'dmitri' }, idle, idle); striker.scenario(6);
      if (UI.dom.training) { UI.trainingPanel(striker); if (!UI.dom.training.innerHTML.includes('no holds')) problems.push('striker panel text'); }
      striker.dispose();
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Submission help: the Move list and About & Help both explain how a hold works with a line for each of the 16 styles (holds and ground game); the six hold styles have their own line, the others say they have no hold', () => {
      const problems = [];
      if (Object.keys(GROUND_NOTES).sort().join() !== [...SUBMISSION_STYLES].sort().join()) problems.push('a note per hold style');
      for (const [name, html] of [['Move list', UI.screen_moves()], ['About & Help', UI.screen_credits()]]) {
        if (!html.includes('Holds on a downed opponent') || !html.includes('scenario 6') || !html.includes('STEP CLOSER') || !html.includes('Press Grapple') || !html.includes('Every hold plays the same way')) problems.push(name + ' text');
        for (const id of MOVE_STYLE_IDS) {
          const s = MOVE_STYLE[id];
          if (!html.includes(esc(s.label)) || (s.submit.length ? !html.includes(esc(GROUND_NOTES[id])) || !html.includes(esc(s.submit.join(', '))) : !html.includes('No hold. Let the foe stand up'))) problems.push(name + ' line for ' + id);
        }
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Weight classes: derived from height and build, 5 classes, the heaviest presets are 2+ classes above the lightest', () => {
      const classes = {}; for (const r of ROSTER) classes[r.id] = weightClass(r);
      const values = Object.values(classes);
      const low = weightClass({ look: { scale: SCALE_MIN, build: BUILD_MIN } }), high = weightClass({ look: { scale: SCALE_MAX, build: BUILD_MAX } });
      const f = new Fighter(ROSTER_BY_ID.brutus, 0);
      const ok = WEIGHT_CLASS_BOUNDS.length === 4 && WEIGHT_CLASS_NAMES.length === 5 && Math.max(...values) - Math.min(...values) >= 2 && classes.brutus - classes.yuki >= 2 && classes.dmitri - classes.mara >= 2 &&
        low === 0 && high === 4 && weightClass(ROSTER_BY_ID.kai) === 1 && weightClass(null) === 1 && weightClass({ look: { scale: 'x', build: NaN } }) === 1 && f.weight === classes.brutus &&
        weightClass({ look: { scale: 1, build: 1.1 } }) >= weightClass({ look: { scale: 1, build: 1 } });
      return ok ? true : JSON.stringify({ classes, low, high });
    });
    /* Tackle tests: the runner (fighter 0) holds run toward the other fighter 3 m away. */
    const runAt = (it) => { it.fwd = 1; it.run = true; };
    const tackleMatch = (runnerId, targetId, victim, opts, runner) => {
      const m = (opts && opts.block ? mkBlock : mk)({ playerId: runnerId, opponentId: targetId }, runner || runAt, victim);
      self.place(m, 3.0);
      return m;
    };
    test('Heavy tackle: a runner 2+ classes heavier knocks the lighter fighter back once per run; 1 class apart, walking or a lighter runner do nothing', () => {
      const play = (runnerId, targetId, runner, ticks) => {
        const log = self.capture(['tackle', 'hit']);
        const m = tackleMatch(runnerId, targetId, null, null, runner);
        const b = m.fighters[1], x0 = b.x, hp0 = b.hp;
        let reacted = false;
        for (let i = 0; i < (ticks || 100); i++) { m.step(); if (b.state === S.STAGGER || b.state === S.HIT) reacted = true; }
        log.stop();
        const r = { tackles: log.tackle.map((e) => e.result), hits: log.hit.filter((e) => e.mv.id === 'tackle').length, dmg: hp0 - b.hp, pushed: b.x - x0, reacted, runnerHp: m.fighters[0].hp, runnerMax: m.fighters[0].maxHp };
        m.dispose();
        return r;
      };
      const heavy = play('brutus', 'yuki'), edge = play('zero', 'yuki'), oneClass = play('kai', 'yuki'), walking = play('brutus', 'yuki', (it) => { it.fwd = 1; }), lighter = play('yuki', 'brutus');
      const long = play('brutus', 'yuki', runAt, 220);
      const hitOk = (r) => r.tackles.length === 1 && r.tackles[0] === 'hit' && r.hits === 1 && r.dmg >= 5 && r.dmg <= 25 && r.reacted && r.pushed > 0.5 && r.runnerHp === r.runnerMax;
      const idle = (r) => r.tackles.length === 0 && r.hits === 0 && r.dmg === 0;
      const ok = hitOk(heavy) && hitOk(edge) && hitOk(long) && idle(oneClass) && idle(walking) && idle(lighter) && weightClass(ROSTER_BY_ID.zero) - weightClass(ROSTER_BY_ID.yuki) === TACKLE_MIN_GAP;
      return ok ? true : JSON.stringify({ heavy, edge, oneClass, walking, lighter, long });
    });
    test('Heavy tackle counters: Block stops it (no damage, blocker pushed back, tackler stopped); Sway i-frames and a Sidestep let it run past', () => {
      const log = self.capture(['tackle', 'hit']);
      const block = tackleMatch('brutus', 'yuki', (it) => { it.defend = true; }, { block: true }, (it, f, o, m) => { if (m.tick < 45) runAt(it); });   // one run: it stops after the charge
      const blocker = block.fighters[1], runner = block.fighters[0], bx0 = blocker.x;
      let runnerRan = false, blockerBlocked = false;
      for (let i = 0; i < 100; i++) { block.step(); if (runner.state === S.RUN) runnerRan = true; if (isBlockState(blocker.state)) blockerBlocked = true; }
      const blockLog = { tackles: log.tackle.map((e) => e.result), hits: log.hit.length };
      const blockOk = blockLog.tackles.join() === 'blocked' && blockLog.hits === 0 && blocker.hp === blocker.maxHp && blocker.x - bx0 > 0.3 && runnerRan && blockerBlocked && runner.state !== S.RUN && runner.tackleUsed;
      log.tackle.length = 0;
      /* The dodge starts when the runner is `lead` m away. */
      const dodge = (react, lead) => {
        const l2 = self.capture(['tackle', 'hit']);
        let did = false;
        const m = tackleMatch('brutus', 'yuki', (it, f, o) => { if (!did && Math.hypot(o.x - f.x, o.z - f.z) < lead) { did = true; react(it); } });
        const v = m.fighters[1];
        let ran = false;
        for (let i = 0; i < 110; i++) { m.step(); if (m.fighters[0].state === S.RUN) ran = true; }
        l2.stop();
        const r = { tackles: l2.tackle.map((e) => e.result), hits: l2.hit.length, hp: v.hp === v.maxHp, ran };
        m.dispose();
        return r;
      };
      const sway = dodge((it) => { it.defend = true; }, 1.25), side = dodge((it) => { it.sidestep = 1; }, 1.25);
      const dodged = (r) => r.tackles.join() === 'dodged' && r.hits === 0 && r.hp && r.ran;
      log.stop(); block.dispose();
      return blockOk && dodged(sway) && dodged(side) ? true : JSON.stringify({ blockLog, blockOk, hp: blocker.hp, pushed: blocker.x - bx0, runner: runner.state, sway, side });
    });
    test('Heavy tackle: AI fighters that run into each other (all difficulties) keep legal states and finish the round', () => {
      const before = Diag.illegalTransitions;
      let tackles = 0, ended = 0, bad = '';
      for (const difficulty of ['easy', 'normal', 'hard', 'expert']) {
        for (let seed = 1; seed <= 3; seed++) {
          const m = mk({ playerId: 'brutus', opponentId: 'yuki', seed, difficulty, timer: 20 });   // a 20 s round always ends inside the 1500 ticks
          m.controllers[0] = new AIController(ROSTER_BY_ID.brutus, difficulty); m.controllers[1] = new AIController(ROSTER_BY_ID.yuki, difficulty);
          const log = self.capture(['tackle']);
          self.run(m, 1500); log.stop(); tackles += log.tackle.length;
          for (const f of m.fighters) if (!Number.isFinite(f.x + f.z + f.hp + f.stam)) bad = 'NaN ' + difficulty + seed;
          if (m.fighters.some((f) => f.state === S.RUN && f.stateTicks > 600)) bad = 'stuck run';
          if (m.fighters.some((f) => !f.alive) || m.phase !== 'fight') ended++;   // the round got past the fight (a KO or the end of the round)
          m.dispose();
        }
      }
      // tackles is reported, not required: the AI has no tackle logic (the scripted tackle tests above cover the rules)
      return Diag.illegalTransitions === before && !bad && ended === 12 ? true : JSON.stringify({ illegal: Diag.illegalTransitions - before, bad, tackles, ended });
    });
    test('Wake-up invulnerability lasts the whole get-up and ends when standing (then only the strike grace remains)', () => {
      const problems = [];
      for (const id of ['brutus', 'yuki']) {
        const m = mk({ opponentId: id }, pressString('KKK', { height: true }), (it, f, o) => { if (f.state !== S.DOWN && f.state !== S.GETUP) { f.x = o.x + 1.0; f.prevX = f.x; f.z = o.z; } });   // in reach for every step, free once knocked down
        self.place(m, 1.2);
        const b = m.fighters[1];
        let exposed = 0, rose = false;
        for (let i = 0; i < 260; i++) { m.step(); if (b.state === S.GETUP) { rose = true; if (b.invuln === 0) exposed++; } }
        if (!rose || exposed || b.state !== S.IDLE || b.invuln !== 0) problems.push(id + ' rose ' + rose + ' exposed ' + exposed + ' state ' + b.state + ' invuln ' + b.invuln);
        m.dispose();
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Knock-out stops all further combat', () => {
      const log = self.capture(['hit', 'ko', 'roundEnd']);
      const m = mk({ winsNeeded: 2 }, (it, f, o, mm) => { if (mm.tick % 25 === 2) it.punch = true; }, (it, f, o, mm) => { if (mm.tick % 15 === 0) it.punch = true; });
      self.place(m, 1.1); m.fighters[1].hp = 3; self.run(m, 400); log.stop();
      const f = m.fighters[1];
      return log.ko.length === 1 && f.state === S.KO && !f.alive && f.hp === 0 && log.roundEnd.length === 1 && m.wins[0] === 1 && log.hit.length >= 1 && log.hit.every((h) => h.att.index === 0) ? true : 'ko ' + log.ko.length + ' state ' + f.state + ' wins ' + m.wins;
    });
    test('Timeout awards round to the fighter with more health', () => {
      const m = mk({ timer: 2 }); m.fighters[0].hp = 40; self.run(m, 135);
      return m.phase === 'roundEnd' && m.roundWinner === 1 ? true : m.phase + ' winner ' + m.roundWinner;
    });
    test('Stamina stays within 0..max and regenerates', () => {
      const m = mk({}, (it, f, o, mm) => { if (mm.tick % 4 === 2) it.kick = true; }); self.place(m, 3);
      let bad = false;
      for (let i = 0; i < 600; i++) { m.step(); const s = m.fighters[0].stam; if (!(s >= 0 && s <= m.fighters[0].maxStam)) bad = true; }
      const low = m.fighters[0].stam;
      m.controllers[0] = self.scripted(() => {});
      self.run(m, 300);
      return !bad && m.fighters[0].stam > low + 10 ? true : 'bad ' + bad + ' low ' + low + ' after ' + m.fighters[0].stam;
    });
    test('State machine rejects illegal transitions', () => {
      const f = new Fighter(ROSTER_BY_ID.kai, 0);
      f.setState(S.KO);
      const before = Diag.illegalTransitions;
      const r = f.setState(S.IDLE);
      return r === false && f.state === S.KO && Diag.illegalTransitions === before + 1 && !canTransition(S.DOWN, S.IDLE) && canTransition(S.DOWN, S.GETUP) ? true : 'transition accepted';
    });
    test('Game-state manager rejects invalid transitions', () => {
      const keep = Game.state;
      Game.state = GS.MENU;
      const r = Game.go(GS.FIGHT);
      const ok = r === false && Game.state === GS.MENU;
      Game.state = keep;
      return ok ? true : 'MENU -> FIGHT accepted';
    });
    test('Destruction: progressive stages, one break event, collider replaced', () => {
      const log = self.capture(['objBreak', 'objStage']);
      const m = mk({ arenaId: 'warehouse' });
      const o = Arena.objects.find((q) => q.id === 'crateA');
      const stages = [o.stage];
      for (let i = 0; i < 12; i++) { Arena.damageObject(o, 10, 'kick', 500 + i, 1, 0, o.x, 0.5, o.z); if (stages[stages.length - 1] !== o.stage) stages.push(o.stage); }
      const again = Arena.damageObject(o, 50, 'kick', 999, 1, 0, o.x, 0.5, o.z);
      log.stop();
      return o.destroyed && log.objBreak.length === 1 && !o.collider.active && !!o.rubble && stages.join() === '0,1,2,3,4' && again === false && Debris.pool.some((d) => d.on) ? true : 'stages ' + stages + ' breaks ' + log.objBreak.length;
    });
    test('Material thresholds: glass shatters, concrete pillar survives a heavy kick', () => {
      const m = mk({ arenaId: 'warehouse' });
      const glass = Arena.objects.find((q) => q.mat === 'glass'), pillar = Arena.objects.find((q) => q.id === 'pillarL');
      Arena.damageObject(glass, 12, 'kick', 1, 1, 0, 0, 1, 0);
      Arena.damageObject(pillar, 18, 'heavy', 2, 1, 0, 0, 1, 0);
      return glass.destroyed && !pillar.destroyed && pillar.hp < pillar.maxHp && pillar.hp > pillar.maxHp * 0.7 ? true : 'glass ' + glass.destroyed + ' pillar hp ' + pillar.hp;
    });
    test('Attacks damage scenery', () => {
      const m = mk({ arenaId: 'warehouse' }, (it, f, o, mm) => { if (mm.tick % 30 === 2) it.kick = true; });
      const o = Arena.objects.find((q) => q.id === 'crateB');
      const a = m.fighters[0]; a.x = o.x - 1.4; a.z = o.z; a.yaw = Math.PI / 2; m.fighters[1].x = o.x + 3.5; m.fighters[1].z = o.z; self.run(m, 130);
      return o.hp < o.maxHp ? true : 'crate untouched';
    });
    test('Thrown fighter damages scenery', () => {
      const m = mk({ arenaId: 'warehouse' }, (it, f, o, mm) => { if (mm.tick === 2) it.grapple = true; if (f.state === S.GRAPPLE && f.clinchTick === 8 && !f.throwPending) it.grapple = true; });
      const o = Arena.objects.find((q) => q.id === 'crateB');
      const a = m.fighters[0], b = m.fighters[1]; a.x = o.x - 3.0; a.z = o.z; b.x = o.x - 2.1; b.z = o.z; a.yaw = Math.PI / 2; b.yaw = -Math.PI / 2;
      self.run(m, 140);
      return o.hp < o.maxHp ? true : 'crate untouched';
    });
    test('Debris stays bounded, sleeps and expires', () => {
      mk({});
      for (let i = 0; i < 500; i++) Debris.spawn('wood', 0, 1, 0, Math.random() * 4 - 2, 3, Math.random() * 4 - 2, 0.3, 0.1, 0.2, '#aa7744', 1);
      let active = 0; for (const d of Debris.pool) if (d.on) active++;
      const cap = Math.min(DEBRIS_MAX, Quality.limits.debris);
      for (let i = 0; i < 60 * 30; i++) Debris.update(1 / 60);
      let left = 0; for (const d of Debris.pool) if (d.on) left++;
      return active <= cap && left === 0 ? true : 'active ' + active + ' cap ' + cap + ' left ' + left;
    });
    test('Arena: no object traps a fighter, even by a wall or as rubble (every arena, every side)', () => {
      const problems = [];
      const f = new Fighter(ROSTER_BY_ID.brutus, 0);
      const probe = (label) => {
        const b = Arena.def.bounds;
        for (const c of Arena.colliders) {
          if (!c.active || c.top <= STEP_HEIGHT || c.top - (c.up || 0.25) <= 0) continue;   // a step that can be stood on from the floor is no obstacle
          for (let gx = -1.4; gx <= 1.4; gx += 0.2) {
            for (let gz = -1.4; gz <= 1.4; gz += 0.2) {
              f.x = c.x + gx * (c.hx + f.radius); f.z = c.z + gz * (c.hz + f.radius); f.y = 0;
              if (c.deck && Math.abs(f.x - c.x) < c.hx && Math.abs(f.z - c.z) < c.hz) continue;   // a deck is too big to be entered: it is probed from outside only
              if (Arena.colliders.some((q) => q !== c && q.active && q.top > STEP_HEIGHT && !q.base && Math.abs(f.x - q.x) < q.hx && Math.abs(f.z - q.z) < q.hz)) continue;   // a start point inside another obstacle is no place a body can be
              if (Math.abs(f.x) > b.x - f.radius || Math.abs(f.z) > b.z - f.radius) continue;   // objects now stand flush against a wall: a fighter is never past it (the wall case is the last check below)
              for (let i = 0; i < 4; i++) Arena.resolveFighter(f);
              const nx = clamp(f.x, c.x - c.hx, c.x + c.hx), nz = clamp(f.z, c.z - c.hz, c.z + c.hz);
              const inside = Math.abs(f.x - c.x) < c.hx && Math.abs(f.z - c.z) < c.hz;
              const depth = inside ? 9 : f.radius - Math.hypot(f.x - nx, f.z - nz);
              const out = Math.abs(f.x) > b.x - f.radius + 1e-6 || Math.abs(f.z) > b.z - f.radius + 1e-6;
              if (depth > 0.02 || out) { problems.push(label + ' ' + (c.obj ? c.obj.id : 'rubble') + ' depth ' + depth.toFixed(2) + (out ? ' outside' : '')); return; }
            }
          }
        }
      };
      for (const id of ARENA_ORDER) {
        Arena.build(ARENAS[id]);
        probe(id);
        for (const o of Arena.objects) Arena.breakObject(o, 0, 0);
        probe(id + ' broken');
      }
      // pushed a little past the back wall beside a pillar: slide off its side, never a jump to its far side
      Arena.build(ARENAS.warehouse);
      const pillar = Arena.colliders.find((c) => c.obj && c.obj.id === 'pillarL'), bz = Arena.def.bounds.z;
      f.x = pillar.x + pillar.hx + f.radius - 0.1; f.z = -(bz - f.radius) - 0.04; f.y = 0;
      const sx = f.x, sz = f.z;
      Arena.resolveFighter(f);
      const moved = Math.hypot(f.x - sx, f.z - sz);
      if (moved > 0.4 || !f.wallHit) problems.push('wall beside pillarL: moved ' + moved.toFixed(2) + ' wallHit ' + f.wallHit);
      Arena.build(ARENAS.warehouse); Debris.clear(); FX.clear();
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Debris: pieces land on intact objects or bounce off their sides, never rest inside; they fall when the object breaks', () => {
      Arena.build(ARENAS.warehouse); Debris.clear();
      const crate = Arena.objects.find((o) => o.id === 'crateA'), pillar = Arena.objects.find((o) => o.id === 'pillarL');
      const onTop = Debris.spawn('wood', crate.x, crate.h + 0.6, crate.z, 0, 0, 0, 0.3, 0.08, 0.17, '#9a6a35', 1);
      const side = Debris.spawn('concrete', pillar.x - pillar.hx - 0.5, 0.6, pillar.z, 6, 0, 0, 0.2, 0.2, 0.2, '#8d9096', 1);
      for (let i = 0; i < 240; i++) Debris.update(1 / 60);
      const rests = onTop.asleep && Math.abs(onTop.y - crate.h) < 0.12;
      const bounced = side.x < pillar.x - pillar.hx + 1e-6 && side.y < 0.2;
      Arena.breakObject(crate, 0, 0);
      for (let i = 0; i < 240; i++) Debris.update(1 / 60);
      const fell = !onTop.on || onTop.y < 0.2;
      let inside = 0;
      for (const d of Debris.pool) {
        if (!d.on) continue;
        for (const c of Arena.colliders) if (c.active && c.obj && Math.abs(d.x - c.x) < c.hx - 0.01 && Math.abs(d.z - c.z) < c.hz - 0.01 && d.y < c.top - 0.05) inside++;
      }
      Arena.build(ARENAS.warehouse);
      const r = { rests, bounced, fell, inside: inside === 0 };
      return Object.values(r).every(Boolean) ? true : JSON.stringify(r);
    });
    test('Arena reset restores every object, collider and clears debris', () => {
      mk({ arenaId: 'pit' });
      for (const o of Arena.objects) Arena.damageObject(o, 999, 'heavy', 77, 1, 0, o.x, 0.5, o.z);
      const wrecked = Arena.objects.every((o) => o.destroyed || o.fixed) && Arena.objects.some((o) => o.destroyed);   // fixed decks, stairs and ropes take no damage
      Arena.reset();
      const clean = Arena.objects.every((o) => !o.destroyed && o.hp === o.maxHp && o.stage === 0 && o.collider.active && !o.rubble) && Debris.pool.every((d) => !d.on) && Arena.colliders.length === Arena.objects.length;
      return wrecked && clean ? true : 'wrecked ' + wrecked + ' clean ' + clean;
    });
    test('Fighters cannot be trapped inside obstacles', () => {
      const m = mk({ arenaId: 'warehouse' });
      const o = Arena.objects.find((q) => q.id === 'crateA'), f = m.fighters[0];
      f.x = o.x + 0.05; f.z = o.z; f.y = 0;
      self.run(m, 6);
      return !Arena.blockedAt(f.x, f.z, f.radius - 0.02) ? true : 'still inside at ' + f.x.toFixed(2);
    });
    test('Rubble from a destroyed pillar is walkable after it expires', () => {
      mk({ arenaId: 'pit' });
      const p = Arena.objects.find((q) => q.id === 'pillarA');
      Arena.damageObject(p, 999, 'heavy', 5, 1, 0, p.x, 1, p.z);
      const before = p.rubble.top;
      for (let i = 0; i < 60 * 16; i++) Arena.update(1 / 60);
      return before > STEP_HEIGHT && p.rubble.top <= STEP_HEIGHT ? true : 'top ' + before + ' -> ' + p.rubble.top;
    });
    test('AI approaches and attacks an idle player', () => {
      const m = mk({ difficulty: 'normal' });
      m.controllers[1] = new AIController(ROSTER_BY_ID.mara, 'normal');
      self.run(m, 900);
      return m.fighters[0].hp < m.fighters[0].maxHp ? true : 'AI never landed a hit';
    });
    test('The AI and the Training dummy reach strong moves only as steps of an attack string', () => {
      const fresh = new Fighter(ROSTER_BY_ID.kai, 0);
      const firstPresses = new AIController(ROSTER_BY_ID.kai, 'expert').reachable(fresh).map((c) => c.mv.id).sort().join();
      let strong = 0, asFirstStep = 0;
      const off = Events.on('attackStart', (e) => {   // the string state is set before the event, so a strong move at step 1 shows as a key list shorter than 2
        if (e.mv.tier === 3 && !e.mv.ctx && e.mv.type === 'strike') { strong++; if (e.f.stringKeys.length < 2) asFirstStep++; }
      });
      for (const [seed, diff] of [[3, 'expert'], [4, 'hard'], [5, 'normal']]) {
        const m = mk({ seed });
        m.controllers[0] = new AIController(ROSTER_BY_ID.mara, diff);
        m.controllers[1] = new AIController(ROSTER_BY_ID.kai, diff);
        self.run(m, 2400);
        m.dispose();
      }
      for (const mode of ['attackHigh', 'attackLow', 'attackMix']) {
        const m = mk({ mode: 'training', dummy: mode });
        m.controllers[1] = new DummyController(ROSTER_BY_ID.mara, mode);
        self.place(m, 3.5); self.run(m, 900);
        m.dispose();
      }
      off();
      return firstPresses === 'body_jab,front_kick,jab,low_kick' && strong >= 1 && asFirstStep === 0 ? true : 'first presses ' + firstPresses + ' strong ' + strong + ' as step 1: ' + asFirstStep;
    });
    test('AI difficulty changes defensive quality', () => {
      const trial = (diff, seed) => {
        const log = self.capture(['hit', 'block']);
        const m = mkBlock({ seed }, (it, f, o, mm) => { if (mm.tick % 80 === 20 && f.state === S.IDLE) f.startAttack(ATTACKS.heavy_roundhouse); });   // a slow, readable attack straight from the move table
        const ai = new AIController(ROSTER_BY_ID.kai, diff);
        ai.nextDecision = Infinity; ai.d = Object.assign({}, ai.d, { punish: 0, counter: 0, sidestep: 0 });
        m.controllers[1] = ai;
        self.place(m, 1.3);
        for (let i = 0; i < 1600; i++) { m.step(); if (m.fighters[0].state === S.IDLE) { m.fighters[0].x = m.fighters[1].x - 1.3; m.fighters[0].prevX = m.fighters[0].x; } }
        log.stop(); m.dispose();
        const mine = log.block.filter((q) => q.def.index === 1).length;
        const tot = mine + log.hit.filter((h) => h.def.index === 1).length;
        return tot ? mine / tot : 0;
      };
      let easy = 0, expert = 0;
      for (const s of [3, 4, 5]) { easy += trial('easy', s) / 3; expert += trial('expert', s) / 3; }
      return expert > easy + 0.3 ? true : 'easy ' + easy.toFixed(2) + ' expert ' + expert.toFixed(2);
    });
    test('AI reaction blocks are only sometimes perfect blocks', () => {
      const log = self.capture(['block']);
      for (const seed of [3, 4, 5]) {
        const m = mkBlock({ seed }, (it, f, o, mm) => { if (mm.tick % 60 === 20 && f.state === S.IDLE) f.startAttack(ATTACKS.cross); });
        const ai = new AIController(ROSTER_BY_ID.kai, 'expert');
        ai.nextDecision = Infinity; ai.d = Object.assign({}, ai.d, { punish: 0, counter: 0, sidestep: 0 });
        m.controllers[1] = ai;
        self.place(m, 1.2);
        for (let i = 0; i < 1600; i++) { m.step(); if (m.fighters[0].state === S.IDLE) { m.fighters[0].x = m.fighters[1].x - 1.2; m.fighters[0].prevX = m.fighters[0].x; } }
        m.dispose();
      }
      log.stop();
      const blocks = log.block.filter((b) => b.def.index === 1), perfect = blocks.filter((b) => b.perfect).length;
      return blocks.length >= 20 && perfect / blocks.length < 0.6 ? true : 'blocks ' + blocks.length + ' perfect ' + perfect;
    });
    test('AI adapt guards low only against a mostly-low opponent', () => {
      const ai = new AIController(ROSTER_BY_ID.kai, 'expert');
      const guess = (adapt, recent) => { ai.d = Object.assign({}, DIFFICULTY.expert, { adapt }); ai.oppRecent = recent; return ai.guessHeight(); };
      const lowReader = guess(1, ['L', 'L', 'M', 'L']) === 'L', mixed = guess(1, ['L', 'H', 'M']) === 'H', naive = guess(0, ['L', 'L', 'L']) === 'H', fresh = guess(1, []) === 'H';
      return lowReader && mixed && naive && fresh ? true : JSON.stringify({ lowReader, mixed, naive, fresh });
    });
    test('AI punishes a whiffed grab', () => {
      const log = self.capture(['hit']);
      const m = mk({ seed: 7 }, once(2, 'grapple'));
      const ai = new AIController(ROSTER_BY_ID.kai, 'expert');
      ai.nextDecision = Infinity; ai.d = Object.assign({}, ai.d, { punish: 1 });
      m.controllers[1] = ai;
      self.place(m, 1.75); self.run(m, 60); log.stop();
      return log.hit.some((h) => h.def.index === 0) ? true : 'whiffed grab went unpunished';
    });
    test('AI on Hard breaks some grabs that clinch before it can react', () => {
      const log = self.capture(['escape']);
      let clinches = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const m = mk({ seed }, once(2, 'grapple'));
        const ai = new AIController(ROSTER_BY_ID.kai, 'hard');
        ai.nextDecision = Infinity; ai.d = Object.assign({}, ai.d, { escape: 0 });   // only the break roll can free it
        m.controllers[1] = ai;
        self.place(m, 0.9);
        let held = false;
        for (let i = 0; i < 40; i++) { m.step(); held = held || m.fighters[1].state === S.CLINCH; }
        if (held) clinches++;
        m.dispose();
      }
      log.stop();
      const breaks = log.escape.length;
      return clinches === 30 && breaks >= 3 && breaks <= 12 ? true : 'clinches ' + clinches + ' breaks ' + breaks;
    });
    test('AI routes around an obstacle', () => {
      const m = mk({ arenaId: 'warehouse', hazards: false, items: false });   // the load hazard now hangs near here; this checks the path around a crate, not a hazard
      m.controllers[1] = new AIController(ROSTER_BY_ID.kai, 'hard');
      const o = Arena.objects.find((q) => q.id === 'crateA');
      const a = m.fighters[0], b = m.fighters[1]; a.x = o.x - 2.0; a.z = o.z; b.x = o.x + 2.0; b.z = o.z;
      const blocked = Arena.pathBlocked(b.x, b.z, a.x, a.z, 0.4);
      let best = 99;
      for (let i = 0; i < 400; i++) { m.step(); best = Math.min(best, Math.hypot(a.x - b.x, a.z - b.z)); }
      return blocked && best < 1.8 ? true : 'blocked ' + blocked + ' closest ' + best.toFixed(2);
    });
    test('Input: presses are latched once, modifiers never fire alone', () => {
      const it = makeIntent();
      Input.reset(); Input.press('punch'); Input.press('crouch');
      Input.fillIntent(it, null, null);
      const first = it.punch && !it.height;   // a Crouch edge on its own is not an attack, and with no Crouch held the press is a standing one
      Input.fillIntent(it, null, null);
      return first && !it.punch && !it.kick ? true : 'edge repeated';
    });
    test('Keys and gamepad: Punch and Kick fire on press, Crouch held at the press is the height; both pad buttons work', () => {
      const f = new Fighter(ROSTER_BY_ID.kai, 0), o = new Fighter(ROSTER_BY_ID.mara, 1), it = makeIntent();
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      const pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), device = Input.lastDevice;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
      const key = (action) => { Input.press(action); return Input.fillIntent(it, f, o); };
      const padTap = (button) => { buttons[button].pressed = true; Input.pollPad(); buttons[button].pressed = false; Input.pollPad(); return Input.fillIntent(it, f, o); };
      let r;
      try {
        Input.reset(); Input.lastDevice = 'keyboard'; Input.kb.clear(); Input.update();
        key('punch'); const punch = it.punch && !it.kick && !it.height;
        key('punch'); const again = it.punch && !it.kick && !it.height;   // the same press every time: the string is the fighter's job
        key('kick'); const kick = it.kick && !it.punch && !it.height;
        Input.kb.add(Keymap.bindings.crouch[0]); Input.update();
        key('punch'); const lowPunch = it.punch && it.height;
        key('kick'); const lowKick = it.kick && it.height;
        Input.kb.clear(); Input.update();
        padTap(3); const triangle = it.punch && !it.height;   // either punch button punches, either kick button kicks
        padTap(2); const square = it.punch;
        padTap(1); const circle = it.kick;
        padTap(0); const cross = it.kick;
        Input.padCrouch = true; Input.update();
        padTap(2); const padLow = it.punch && it.height;
        Input.padCrouch = false; Input.update();
        const actions = !['lp', 'rp', 'lk', 'rk', 'stance', 'strong', 'height'].some((a) => ACTIONS.includes(a)) && ACTIONS.includes('punch') && ACTIONS.includes('kick');
        const res = { punch, again, kick, lowPunch, lowKick, triangle, square, circle, cross, padLow, actions };
        r = Object.values(res).every(Boolean) ? true : JSON.stringify(res);
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Input.releasePad(); Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device;
      }
      return r;
    });
    test('Screen-relative movement follows the camera', () => {
      const keep = Settings.v.movement, kr = Camera.dirRight.slice(), kf = Camera.dirFwd.slice();
      Settings.v.movement = 'screen';
      Camera.dirRight[0] = 1; Camera.dirRight[1] = 0; Camera.dirFwd[0] = 0; Camera.dirFwd[1] = -1; // camera looks toward -z
      const f = new Fighter(ROSTER_BY_ID.kai, 0);
      f.yaw = Math.PI / 2; // facing +x, opponent to the screen right
      const it = makeIntent();
      Input.reset();
      Input.analog.fwd = 0; Input.analog.side = 1; Input.fillIntent(it, f, null);
      const right = [it.fwd, it.side];
      Input.analog.fwd = 1; Input.analog.side = 0; Input.fillIntent(it, f, null);
      const up = [it.fwd, it.side];
      Input.analog.fwd = 0; Input.analog.side = 0;
      Input.reset(); Input.press('right'); Input.press('right'); Input.fillIntent(it, f, null);
      const runArmed = Input.runDir === 'right';
      Input.reset(); Input.press('left'); Input.press('left'); Input.fillIntent(it, f, null);
      const awayDoesNothing = !it.sidestep && Input.runDir === null && it.fwd === 0;   // a double tap away from the opponent is no longer a back-dash
      Settings.v.movement = keep;
      Camera.dirRight[0] = kr[0]; Camera.dirRight[1] = kr[1]; Camera.dirFwd[0] = kf[0]; Camera.dirFwd[1] = kf[1];
      Input.reset();
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      return near(right[0], 1) && near(right[1], 0) && near(up[0], 0) && near(up[1], -1) && runArmed && awayDoesNothing ? true : JSON.stringify({ right, up, runArmed, awayDoesNothing });
    });
    test('Opponent-relative double taps: run, sidestep; a double tap away does nothing', () => {
      const keep = Settings.v.movement;
      Settings.v.movement = 'opponent';
      const f = new Fighter(ROSTER_BY_ID.kai, 0), it = makeIntent();
      Input.reset(); Input.press('up'); Input.press('up'); Input.fillIntent(it, f, null);
      const run = Input.runDir === 'up';
      Input.reset(); Input.press('down'); Input.press('down'); Input.fillIntent(it, f, null);
      const awayDoesNothing = !it.sidestep && Input.runDir === null && it.fwd === 0;
      Input.reset(); Input.press('left'); Input.press('left'); Input.fillIntent(it, f, null);
      const side = it.sidestep === -1;
      Settings.v.movement = keep; Input.reset();
      return run && awayDoesNothing && side ? true : JSON.stringify({ run, awayDoesNothing, side });
    });
    test('Touch: double flicks sidestep, holding toward the opponent runs (screen movement)', () => {
      const keep = Settings.v.movement, kr = Camera.dirRight.slice(), kf = Camera.dirFwd.slice(), device = Input.lastDevice;
      Settings.v.movement = 'screen';
      Camera.dirRight[0] = 1; Camera.dirRight[1] = 0; Camera.dirFwd[0] = 0; Camera.dirFwd[1] = -1;
      const f = new Fighter(ROSTER_BY_ID.kai, 0), it = makeIntent();
      f.yaw = Math.PI / 2;                              // opponent to the screen right, screen up = the fighter's left
      Input.reset();
      const flick = (x, y) => { Input.touchStickSet(x, y, true); Input.update(); Input.touchStickSet(0, 0, false); Input.update(); };
      flick(0, -1); flick(0, -1);
      Input.fillIntent(it, f, null);
      const side = it.sidestep === -1;
      Input.reset();
      Input.touchStickSet(1, 0, true); Input.update();
      for (let i = 0; i <= TOUCH_RUN_TICKS; i++) Input.fillIntent(it, f, null);
      const run = it.run;
      Input.touchStickSet(0, 1, true); Input.update(); Input.fillIntent(it, f, null);
      const stop = !it.run;
      Input.touchStickSet(0, 0, false); Input.update(); Input.reset();
      Settings.v.movement = keep; Input.lastDevice = device;
      Camera.dirRight[0] = kr[0]; Camera.dirRight[1] = kr[1]; Camera.dirFwd[0] = kf[0]; Camera.dirFwd[1] = kf[1];
      return side && run && stop ? true : JSON.stringify({ side, run, stop });
    });
    test('Touch: PUNCH / KICK fire on press (no hold), DUCK gives the low version, the automatic height aims where the attack lands; DEFEND + DUCK guards low', () => {
      const device = Input.lastDevice;
      const f = new Fighter(ROSTER_BY_ID.kai, 0), o = new Fighter(ROSTER_BY_ID.mara, 1), it = makeIntent();
      Input.reset(); Input.releaseAll();
      const press = (kind) => {   // the finger goes down and stays down: the attack is in the intent already
        Input.touchSet(kind, true);
        Input.fillIntent(it, f, o);
        const fired = it[kind];
        Input.touchSet(kind, false);
        return fired;
      };
      const jab = press('punch') && !it.height;
      const front = press('kick') && !it.height;
      Input.touchSet('crouch', true); Input.update();
      const duckPunch = press('punch') && it.height;                 // DUCK held: the low version
      Input.touchSet('crouch', false); Input.update();
      o.state = S.CROUCH;
      const body = press('punch') && it.height;                      // the jab would pass over a crouching opponent
      const frontKick = press('kick') && !it.height;                  // the front kick is a mid already
      o.state = S.BLOCK_H;
      const low = press('kick') && it.height;                         // under a high guard
      o.state = S.IDLE; f.state = S.GRAPPLE;
      const elbow = press('punch') && !it.height;
      const knee = press('kick') && !it.height;
      f.state = S.IDLE;
      Input.touchSet('defend', true); Input.update(); Input.fillIntent(it, f, o);
      const high = it.defend && !it.crouch;
      Input.touchSet('crouch', true); Input.update(); Input.fillIntent(it, f, o);
      const lowGuard = it.defend && it.crouch;
      Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device;
      const r = { jab, front, duckPunch, body, frontKick, low, elbow, knee, high, lowGuard };
      return Object.values(r).every(Boolean) ? true : JSON.stringify(r);
    });
    test('Keyboard: every string row plays its moves through the key path (Crouch key held = the crouch rows)', () => {
      const device = Input.lastDevice, problems = [];
      try {
        for (const row of stringRows) {
          Input.reset(); Input.releaseAll(); Input.lastDevice = 'keyboard';
          const got = playString(row.keys, (it, f, o, kind) => {
            if (row.low) Input.kb.add(Keymap.bindings.crouch[0]);
            Input.update();
            if (kind) Input.press(kind);
            Input.fillIntent(it, f, o);
          }).join();
          if (got !== row.moves.join()) problems.push((row.low ? 'crouch ' : '') + row.keys + ': ' + got);
        }
      } finally { Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device; }
      return problems.length ? problems.join('; ') : true;
    });
    test('Gamepad: every string row plays its moves through the pad path (Square / Cross, crouch held = the crouch rows)', () => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      const pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), device = Input.lastDevice;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
      const problems = [];
      try {
        for (const row of stringRows) {
          Input.reset(); Input.releaseAll(); Input.lastDevice = 'gamepad';
          const got = playString(row.keys, (it, f, o, kind) => {
            Input.padCrouch = row.low;   // the pad's tap-down-then-hold gesture is tested with the movement checks
            const button = kind === 'punch' ? 2 : 0;
            if (kind) buttons[button].pressed = true;
            Input.update();
            Input.fillIntent(it, f, o);
            if (kind) buttons[button].pressed = false;
          }).join();
          if (got !== row.moves.join()) problems.push((row.low ? 'crouch ' : '') + row.keys + ': ' + got);
        }
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Input.padCrouch = false; Input.releasePad(); Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device;
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Touch: every string row plays its moves and PUNCH / KICK fire on press (DUCK held = the crouch rows)', () => {
      const device = Input.lastDevice, problems = [];
      let late = 0;
      try {
        for (const row of stringRows) {
          Input.reset(); Input.releaseAll();
          const got = playString(row.keys, (it, f, o, kind) => {
            if (row.low) Input.touchSet('crouch', true);
            if (kind) Input.touchSet(kind, true);
            Input.update();
            Input.fillIntent(it, f, o);
            if (kind) { if (!it[kind]) late++; Input.touchSet(kind, false); }   // the finger is still down: the attack must be in the intent already
          }).join();
          if (got !== row.moves.join()) problems.push((row.low ? 'crouch ' : '') + row.keys + ': ' + got);
        }
      } finally { Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device; }
      return !problems.length && late === 0 ? true : 'late presses ' + late + ' ' + problems.join('; ');
    });
    /* Presses Punch / Kick with the defender out of reach, so every step whiffs. Press n+1 comes once the fighter is free again and at least
       spacing ticks (fighter age) after press n. fill(it, f, o, kind) feeds one tick like playString. Returns the ids of the moves fighter 1 started. */
    const playWhiffs = (letters, spacing, fill) => {
      const log = self.capture(['attackStart']);
      let next = 0, from = 0, pressedAt = 0;
      const m = mk({}, (it, f, o, mm) => {
        o.x = f.x + 3.2; o.z = f.z; o.prevX = o.x; o.prevZ = o.z;
        const ready = next === 0 ? mm.tick === 2 : f.state !== S.ATTACK && f.moveId !== from && f.age - pressedAt >= spacing;
        let kind = null;
        if (next < letters.length && ready) { kind = letters[next] === 'P' ? 'punch' : 'kick'; from = f.moveId; pressedAt = f.age; next++; }
        fill(it, f, o, kind);
      });
      self.place(m, 3.2); self.run(m, 60 + (spacing + 40) * letters.length); log.stop(); m.dispose();
      return log.attackStart.filter((e) => e.f.index === 0).map((e) => e.mv.id);
    };
    test('Touch: when the pad hides (pause, round end) every held button and the stick are let go', () => {
      const keep = { touch: Settings.v.touch, state: Game.state, device: Input.lastDevice }, hadDom = !!UI.dom.touch;
      if (!hadDom) UI.dom.touch = { hidden: true };   // no page behind a headless run
      try {
        Settings.v.touch = 'on'; Game.state = GS.FIGHT; UI.applyTouchVisibility();
        const shown = !UI.dom.touch.hidden;
        Input.touchSet('defend', true); Input.touchSet('punch', true); Input.touchStickSet(1, 0, true);
        const held = Input.touchHeld.defend && Input.touchStick.active;
        Game.state = GS.PAUSED; UI.applyTouchVisibility();
        const free = UI.dom.touch.hidden && !Input.touchHeld.defend && !Input.touchHeld.punch && !Input.touchStick.active;
        return shown && held && free ? true : JSON.stringify({ shown, held, free });
      } finally {
        Settings.v.touch = keep.touch; Game.state = keep.state; Input.lastDevice = keep.device; Input.releaseAll();
        if (hadDom) UI.applyTouchVisibility(); else delete UI.dom.touch;
      }
    });
    test('Touch layout: no button overlaps another, the stick or the HUD bars at 640x360 and 844x390, and every action is in thumb reach', () => {
      const none = { sat: 0, sar: 0, sab: 0, sal: 0 }, notch = { sat: 0, sar: 47, sab: 21, sal: 47 };
      const views = [['landscape', 640, 360, none], ['landscape', 844, 390, none], ['landscape', 844, 390, notch], ['landscape', 568, 320, none], ['portrait', 360, 640, none], ['portrait', 390, 844, { sat: 47, sar: 0, sab: 34, sal: 0 }]];
      const MIN_GAP = 4, HUD_BARS_EM = 4.8, THUMB_REACH_TBS = 3.5;   // HUD bars: 0.6em margin + name + bar + stamina bar, at UI scale 1 and 16px
      const problems = [];
      for (const [orientation, w, h, insets] of views) {
        const view = Object.assign({ w, h }, insets), label = orientation + ' ' + w + 'x' + h + (insets.sar || insets.sat ? ' notch' : '');
        const rects = touchLayoutRects(orientation, view), names = Object.keys(rects);
        const tbs = touchOffsetPx(TOUCH_LAYOUT[orientation].tbs, { vmin: Math.min(w, h) / 100, vw: w / 100, vh: h / 100, px: 1 });
        const center = (name) => [(rects[name].x0 + rects[name].x1) / 2, (rects[name].y0 + rects[name].y1) / 2];
        if (names.length !== TOUCH_BUTTONS.length + 1) problems.push(label + ': ' + names.length + ' rectangles');
        for (const name of names) {
          const r = rects[name];
          if (r.x0 < view.sal || r.x1 > w - view.sar || r.y0 < view.sat || r.y1 > h - view.sab) problems.push(label + ': ' + name + ' leaves the safe area');
          if (r.y0 < view.sat + HUD_BARS_EM * 16) problems.push(label + ': ' + name + ' reaches the HUD bars');
          if (orientation === 'landscape' && name !== 'stick' && r.x1 - r.x0 < 44) problems.push(label + ': ' + name + ' is under 44px');
        }
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
          const a = rects[names[i]], b = rects[names[j]];
          const gap = Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);   // negative = overlap
          if (gap < MIN_GAP) problems.push(label + ': ' + names[i] + ' / ' + names[j] + ' gap ' + Math.round(gap));
        }
        if (orientation !== 'landscape') continue;
        // two thumbs: the stick and DUCK in the left half; every other fight button in the right half, close to the KICK corner
        for (const name of ['stick', 'crouch']) if (center(name)[0] > w / 2) problems.push(label + ': ' + name + ' is not under the left thumb');
        const [kickX, kickY] = center('kick');
        for (const [action] of TOUCH_BUTTONS) {
          if (action === 'crouch') continue;
          const [x, y] = center(action);
          if (x < w / 2) problems.push(label + ': ' + action + ' is not under the right thumb');
          if (action !== 'pause' && Math.hypot(x - kickX, y - kickY) > THUMB_REACH_TBS * tbs) problems.push(label + ': ' + action + ' is out of reach');
        }
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Touch layout: USE and LOCK have fixed slots in both orientations, the CSS comes from the same table, offsets are evaluated right', () => {
      const problems = [];
      const actions = TOUCH_BUTTONS.map((b) => b[0]);
      if (actions.join() !== 'punch,kick,defend,grapple,jump,crouch,pause,use,lock' || TOUCH_CONTEXT_ACTIONS.join() !== 'use,lock') problems.push('buttons ' + actions.join());
      if (!actions.every((a) => ACTIONS.includes(a))) problems.push('a button is not an action');
      const css = touchLayoutCss();
      for (const orientation in TOUCH_LAYOUT) {
        const slots = TOUCH_LAYOUT[orientation].slots;
        if (Object.keys(slots).sort().join() !== actions.slice().sort().join()) problems.push(orientation + ' slots ' + Object.keys(slots).join());
        const places = Object.values(slots).map((s) => s.join('|'));
        if (new Set(places).size !== places.length) problems.push(orientation + ' shares a slot');
      }
      for (const action of actions) if (!css.includes('.tb[data-a=' + action + ']{')) problems.push('no CSS for ' + action);
      if (!css.includes('@media (orientation:portrait){') || !css.includes(':root{--tbs:max(58px,14vmin)}') || !css.includes('#stickBase{left:calc(max(4vmin,20px))')) problems.push('CSS shape');
      if (!css.includes('.tb[data-a=jump]{right:calc(5vmin + 1.5*var(--tbs));bottom:calc(8vmin + 1.7*var(--tbs))}')) problems.push('CSS jump rule');
      const units = { vmin: 3.6, vw: 6.4, vh: 3.6, px: 1, tbs: 58 };
      const a = touchOffsetPx('max(4vmin,20px) + 2vmin + max(30vmin,130px)', units), b = touchOffsetPx('5vmin + 1.3tbs', units), c = touchOffsetPx('max(23vmin,80px)', units);
      if (Math.abs(a - 157.2) > 0.01 || Math.abs(b - 93.4) > 0.01 || Math.abs(c - 82.8) > 0.01) problems.push('offsets ' + [a, b, c].join());
      // visibility: USE needs an item (none exist yet), LOCK needs 2 or more hostile fighters alive
      const player = { alive: true }, foe = { alive: true }, third = { alive: true }, dead = { alive: false };
      const lock = (...fighters) => touchLockVisible(player, { fighters: [player, ...fighters] });
      if (touchUseVisible(player, { fighters: [player, foe] })) problems.push('USE shown without items');
      if (lock(foe) || lock(foe, dead) || !lock(foe, third) || lock(dead, dead)) problems.push('LOCK rule');
      // the buttons hide and show without moving, and a hidden one lets go of a held finger
      const keep = UI.touchButtons, released = [];
      const stand = (action) => ({ el: { hidden: true }, release: () => released.push(action) });
      UI.touchButtons = { use: stand('use'), lock: stand('lock') };
      try {
        UI.touchContextUpdate({ fighters: [player, foe, third] });
        if (UI.touchButtons.lock.el.hidden || !UI.touchButtons.use.el.hidden || released.length) problems.push('3 fighters: LOCK shows, USE stays hidden');
        UI.touchContextUpdate({ fighters: [player, foe] });
        if (!UI.touchButtons.lock.el.hidden || released.join() !== 'lock') problems.push('1v1: LOCK hides and lets go ' + released.join());
        UI.touchContextUpdate({ fighters: [player, foe] });
        if (released.length !== 1) problems.push('a hidden button released twice');
      } finally { UI.touchButtons = keep; }
      return problems.length ? problems.join('; ') : true;
    });
    test('Auto-assist: a setting that is off by default, saved with the others, and only human input carries it', () => {
      const keep = Settings.v.autoAssist, problems = [];
      try {
        if (SETTING_DEFS.autoAssist.def !== false || !SETTING_DEFS.autoAssist.hint || SETTING_DEFS.autoAssist.hint.length > 140) problems.push('definition');
        if (Settings.validate('autoAssist', 'yes') !== false || Settings.validate('autoAssist', true) !== true) problems.push('validation');
        Settings.set('autoAssist', true);
        if (JSON.parse(Store.get(KEY_SETTINGS)).autoAssist !== true) problems.push('not saved');
        const it = makeIntent();
        Input.fillIntent(it, null, null);
        if (!it.assist) problems.push('human intent lacks assist');
        Settings.set('autoAssist', false);
        Input.fillIntent(it, null, null);
        if (it.assist || makeIntent().assist || clearIntent(it).assist) problems.push('assist set while off');
        // the AI never gets it, even with the setting on
        Settings.v.autoAssist = true;
        const m = mk({ seed: 3 });
        m.controllers[0] = new AIController(ROSTER_BY_ID.kai, 'hard'); m.controllers[1] = new AIController(ROSTER_BY_ID.mara, 'hard');
        self.run(m, 120);
        if (m.fighters.some((f) => f.assist) || m.intents.some((i) => i.assist)) problems.push('AI fighter assisted');
        m.dispose();
      } finally { Settings.v.autoAssist = keep; Settings.save(); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Auto-assist on: Punch x3 and Kick x3 out of reach still play the whole string on keyboard, gamepad and touch; off, a miss restarts it', () => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      const pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), device = Input.lastDevice, keepAssist = Settings.v.autoAssist;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
      const paths = {   // one tick of input for each device, then the intent
        keyboard: (it, f, o, kind) => { Input.update(); if (kind) Input.press(kind); Input.fillIntent(it, f, o); },
        gamepad: (it, f, o, kind) => { const button = kind === 'punch' ? 2 : 0; if (kind) buttons[button].pressed = true; Input.update(); Input.fillIntent(it, f, o); if (kind) buttons[button].pressed = false; },
        touch: (it, f, o, kind) => { if (kind) Input.touchSet(kind, true); Input.update(); Input.fillIntent(it, f, o); if (kind) Input.touchSet(kind, false); },
      };
      const near = ATTACK_STRING_TICKS + 10, far = ATTACK_STRING_TICKS * ASSIST_STRING_WINDOW + 10;   // between the two windows / past both
      const problems = [];
      try {
        for (const path in paths) {
          const play = (letters, spacing, assist) => {
            Input.reset(); Input.releaseAll(); Input.lastDevice = path; Settings.v.autoAssist = assist;
            return playWhiffs(letters, spacing, paths[path]).join();
          };
          const want = { PPP: 'jab,cross,hook', KKK: 'front_kick,roundhouse,heavy_roundhouse' };
          for (const letters in want) {
            const on = play(letters, 0, true), off = play(letters, 0, false);
            if (on !== want[letters]) problems.push(path + ' ' + letters + ' on: ' + on);
            const first = STRINGS.stand[letters[0]][0];
            if (off !== [first, first, first].join()) problems.push(path + ' ' + letters + ' off: ' + off);   // a miss starts step 1 again
          }
          const slow = play('PP', near, true), slowOff = play('PP', near, false), tooSlow = play('PP', far, true);
          if (slow !== 'jab,cross') problems.push(path + ' doubled window: ' + slow);
          if (slowOff !== 'jab,jab') problems.push(path + ' normal window: ' + slowOff);
          if (tooSlow !== 'jab,jab') problems.push(path + ' past the doubled window: ' + tooSlow);
        }
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Settings.v.autoAssist = keepAssist; Input.releasePad(); Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device;
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Gamepad: firm taps jump but double taps do not, R3 grapples, a Select tap does nothing and a hold resets', () => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      const pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), device = Input.lastDevice;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
      const poll = (ay) => { pad.axes[1] = ay; Input.pollPad(); };
      const tap = (ay) => { poll(ay); poll(0); };
      let r;
      try {
        Input.reset(); tap(-1);
        const firm = Input.take('jump');
        Input.reset(); tap(-0.75);
        const light = !Input.take('jump');
        Input.reset(); tap(-1); Input.take('jump'); tap(-1);
        const double = !Input.take('jump') && Input.latch.dtap === 'up';
        Input.reset(); buttons[11].pressed = true; Input.pollPad(); buttons[11].pressed = false; Input.pollPad();
        const grab = Input.take('grapple');
        Input.reset(); buttons[8].pressed = true; Input.pollPad(); buttons[8].pressed = false; Input.pollPad();
        const tapIgnored = !Input.take('reset');
        buttons[8].pressed = true; Input.pollPad(); Input.padSelectAt -= PAD_SELECT_HOLD_MS; Input.pollPad(); buttons[8].pressed = false; Input.pollPad();
        const reset = Input.take('reset');
        r = firm && light && double && grab && tapIgnored && reset ? true : JSON.stringify({ firm, light, double, grab, tapIgnored, reset });
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Input.releasePad(); Input.reset(); Input.lastDevice = device;
      }
      return r;
    });
    test('Gamepad rumbles on hits taken and on a KO, only while the pad is in use', () => {
      const calls = [];
      const pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [], vibrationActuator: { playEffect: (type, p) => { calls.push(p.strongMagnitude); return Promise.resolve(); } } };
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), device = Input.lastDevice, index = Input.padIndex, reduced = Settings.v.reducedMotion;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
      let r;
      try {
        Input.lastDevice = 'gamepad'; Input.padIndex = 0; Settings.v.reducedMotion = false;
        const m = mk({}, null, (it, f, o, mm) => { if (mm.tick === 2) it.punch = true; });
        self.place(m, 1.2); self.run(m, 40);
        const onHit = calls.length;
        Combat.knockOut(m.fighters[0], m.fighters[1], null, m);
        const onKo = calls.length === onHit + 1 && Math.abs(calls[calls.length - 1] - RUMBLE_KO * Settings.v.shake) < 1e-6;
        Input.lastDevice = 'keyboard'; Input.rumble(1, 100);
        const quiet = calls.length === onHit + 1;
        r = onHit >= 1 && onKo && quiet ? true : JSON.stringify({ calls });
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Input.lastDevice = device; Input.padIndex = index; Settings.v.reducedMotion = reduced;
      }
      return r;
    });
    test('Gamepads: a browser that refuses getGamepads (it throws, as in an embed without the permission) counts as no pads and nothing errors', () => {
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), device = Input.lastDevice, index = Input.padIndex;
      Object.defineProperty(navigator, 'getGamepads', { value: () => { throw new Error('SecurityError'); }, configurable: true });
      try {
        Input.lastDevice = 'gamepad'; Input.padIndex = 0;
        Inputs.players.forEach((p) => p.pollPad());
        Inputs.pollLobby(); Input.rumble(1, 100);
        const none = Inputs.padId('pad0') === null && !Inputs.anyPadMenu().ok;
        return none ? true : 'a pad was found';
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Input.lastDevice = device; Input.padIndex = index;
      }
    });
    test('Gamepads: P1 keeps a lone pad outside Versus; in Versus it plays P2, two pads split, and rumble reaches only the hurt player', () => {
      const calls = [];
      const pad = (id) => ({ id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [], vibrationActuator: { playEffect: () => { calls.push(id); return Promise.resolve(); } } });
      const one = [pad('a')], two = [pad('a'), null, pad('b')];
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), versus = Inputs.versus, reduced = Settings.v.reducedMotion;
      const devices = Inputs.players.map((p) => p.lastDevice), indexes = Inputs.players.map((p) => p.padIndex), slots = Inputs.padSlots;
      let r;
      try {
        Inputs.versus = false; Inputs.resetPads();
        const solo = Inputs.padFor(0, one) === 0 && Inputs.padFor(1, two) === -1;
        Inputs.versus = true; Inputs.resetPads();
        const lone = Inputs.padFor(0, one) === -1 && Inputs.padFor(1, one) === 0;
        Inputs.resetPads();
        const split = Inputs.padFor(0, two) === 0 && Inputs.padFor(1, two) === 2;
        Object.defineProperty(navigator, 'getGamepads', { value: () => two, configurable: true });
        Input.lastDevice = Input2.lastDevice = 'gamepad'; Input.padIndex = 0; Input2.padIndex = 2; Settings.v.reducedMotion = false;
        const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.punch = true; });   // P1 hits P2
        self.place(m, 1.2); self.run(m, 40);
        const p2Felt = calls.length >= 1 && calls.every((id) => id === 'b');
        r = solo && lone && split && p2Felt ? true : JSON.stringify({ solo, lone, split, calls });
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Inputs.versus = versus; Settings.v.reducedMotion = reduced; Inputs.padSlots = slots;
        Inputs.players.forEach((p, i) => { p.lastDevice = devices[i]; p.padIndex = indexes[i]; });
      }
      return r;
    });
    test('Gamepads: in Versus a pad stays with its player; a new pad fills only a free slot, a disconnect frees only its own', () => {
      const pad = (id) => ({ id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] });
      const versus = Inputs.versus, slots = Inputs.padSlots, indexes = Inputs.players.map((p) => p.padIndex);
      let r;
      try {
        Inputs.versus = true; Inputs.resetPads();
        const pads = [pad('a'), null, null];
        const lone = Inputs.padFor(0, pads) === -1 && Inputs.padFor(1, pads) === 0;
        pads[1] = pad('b');                                   // a second pad joins: P1 takes it, P2 keeps its own
        const joined = Inputs.padFor(0, pads) === 1 && Inputs.padFor(1, pads) === 0;
        pads[0] = null;                                       // P2's pad drops out: P1 keeps playing on pad b
        const dropped = Inputs.padFor(0, pads) === 1 && Inputs.padFor(1, pads) === -1;
        pads[2] = pad('c');                                   // a new pad fills P2's free slot
        const refilled = Inputs.padFor(0, pads) === 1 && Inputs.padFor(1, pads) === 2;
        Input.padIndex = 1; Input2.padIndex = 2;
        Inputs.freePad(2);                                    // the disconnect event for pad c
        const freed = Inputs.padSlots.join() === '1,-1' && Input.padIndex === 1 && Input2.padIndex === -1;
        r = lone && joined && dropped && refilled && freed ? true : JSON.stringify({ lone, joined, dropped, refilled, freed, slots: Inputs.padSlots });
      } finally {
        Inputs.versus = versus; Inputs.padSlots = slots;
        Inputs.players.forEach((p, i) => { p.padIndex = indexes[i]; });
      }
      return r;
    });
    test('A clinch strike that knocks out sends the KO flag with the hit', () => {
      const m = mk({});
      self.place(m, 0.8);
      const [a, b] = m.fighters;
      b.hp = 1;
      const log = self.capture(['hit', 'ko']);
      Combat.clinchStrike(a, b, CLINCH_MOVES.elbow, m);
      log.stop();
      const hit = log.hit[0];
      return hit && hit.ko && log.ko.length === 1 && m.hitStop >= 16 ? true : JSON.stringify({ hit: !!hit, ko: hit && hit.ko, kos: log.ko.length, stop: m.hitStop });
    });
    test('Hints name the control of the device in use', () => {
      const device = Input.lastDevice;
      Input.lastDevice = 'keyboard'; const kb = UI.keyName('grapple') === keyLabel(Keymap.bindings.grapple[0]);
      Input.lastDevice = 'gamepad'; const pad = UI.keyName('grapple') === GAMEPAD_LABELS.grapple;
      Input.lastDevice = 'touch'; const touch = UI.keyName('grapple') === TOUCH_LABELS.grapple;
      Input.lastDevice = device;
      return kb && pad && touch ? true : JSON.stringify({ kb, pad, touch });
    });
    test('Old saved key bindings merge the left / right attacks, drop removed actions, customised keys stay', () => {
      const raw = Store.get(KEY_BINDINGS), keep = JSON.stringify(Keymap.bindings);
      Store.set(KEY_BINDINGS, JSON.stringify({ lp: ['KeyH'], rp: ['KeyN'], lk: ['KeyU'], rk: ['KeyI'], strong: ['ShiftLeft'], height: ['ControlLeft'], dash: ['KeyV'], grapple: ['KeyO'] }));
      Keymap.init();
      const b = Keymap.bindings;
      const moved = b.punch[0] === 'KeyH' && b.kick[0] === 'KeyK' && !('dash' in b) && !('lp' in b) && !('rk' in b);   // the untouched old left kick takes the new default
      const clash = b.grapple[0] === 'KeyO' && !('strong' in b) && !('height' in b) && !JSON.stringify(b).includes('ControlLeft');   // the removed Strong / Height / Dash actions load without errors and their keys vanish
      Store.set(KEY_BINDINGS, JSON.stringify({ revision: 2, lk: ['KeyU'], grapple: ['KeyK'] }));
      Keymap.init();
      const kickKept = Keymap.bindings.kick[0] === 'KeyU' && Keymap.bindings.grapple[0] === 'KeyK';   // K is the user's grapple key
      api.set.controlsChanged(false);
      Store.set(KEY_BINDINGS, JSON.stringify({ revision: KEYS_REVISION, blockHigh: ['KeyH'], punch: ['KeyN'] }));
      Keymap.init();
      const current = Keymap.bindings.punch[0] === 'KeyN' && Keymap.bindings.defend[0] === 'KeyL' && !api.get.controlsChanged();   // a current save is never migrated: the old action name is ignored
      const defaults = ACTIONS.every((a) => DEFAULT_KEYS[a].every((c) => !/^(Shift|Control|Alt)/.test(c)));
      if (raw === null) Store.remove(KEY_BINDINGS); else Store.set(KEY_BINDINGS, raw);
      Keymap.bindings = JSON.parse(keep); Input.rebuildMap();
      return moved && clash && kickKept && current && defaults ? true : JSON.stringify({ moved, clash, kickKept, current, defaults, b });
    });
    test('Controls revision 4: a 1.0.0 save keeps its keys and gains Defend, Use and Lock for P1 and P2, saved once with one notice', () => {
      const raw = [Store.get(KEY_BINDINGS), Store.get(KEY_BINDINGS_P2)], keep = KEYMAPS.map((k) => JSON.stringify(k.bindings));
      const old1 = { revision: 3, up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], punch: ['KeyH'], kick: ['KeyK'], blockHigh: ['KeyQ'], blockLow: ['KeyE'], jump: ['Space'], crouch: ['KeyC'], grapple: ['KeyG'], dash: ['KeyF'], pause: ['Escape', 'KeyP'] };
      const old2 = { revision: 3, up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], punch: ['Numpad8'], kick: ['Numpad5'], blockHigh: ['Numpad1'], blockLow: ['Numpad2'], jump: ['Numpad0'], crouch: ['NumpadDecimal'], grapple: ['Numpad3'], dash: ['NumpadAdd'], pause: ['NumpadEnter'] };
      Store.set(KEY_BINDINGS, JSON.stringify(old1)); Store.set(KEY_BINDINGS_P2, JSON.stringify(old2));
      api.set.controlsChanged(false);
      Keymap.init(); Keymap2.init();
      const p1 = Keymap.bindings, p2 = Keymap2.bindings;
      const kept1 = ['up', 'down', 'left', 'right', 'kick', 'jump', 'crouch', 'grapple', 'pause'].every((a) => JSON.stringify(p1[a]) === JSON.stringify(old1[a])) && p1.punch[0] === 'KeyH';
      const kept2 = ['up', 'down', 'left', 'right', 'kick', 'jump', 'crouch', 'grapple', 'pause'].every((a) => JSON.stringify(p2[a]) === JSON.stringify(old2[a])) && p2.punch[0] === 'Numpad8';
      const new1 = p1.defend[0] === 'KeyL' && p1.use[0] === 'KeyE' && p1.lock[0] === 'KeyQ';   // the untouched 1.0.0 block keys Q / E now mean Lock / Use
      const new2 = p2.defend[0] === 'Numpad6' && p2.use[0] === 'Numpad1' && p2.lock[0] === 'Numpad2';
      const gone = !JSON.stringify([p1, p2]).match(/blockHigh|blockLow|dash/);
      const saved = JSON.parse(Store.get(KEY_BINDINGS)).revision === KEYS_REVISION && JSON.parse(Store.get(KEY_BINDINGS_P2)).revision === KEYS_REVISION;
      const flagged = api.get.controlsChanged();
      api.set.controlsChanged(false); Keymap.init(); Keymap2.init();
      const quiet = !api.get.controlsChanged() && Keymap.bindings.punch[0] === 'KeyH' && Keymap.bindings.lock[0] === 'KeyQ' && Keymap2.bindings.punch[0] === 'Numpad8';   // the second load reads the saved revision 4 and has nothing to migrate
      raw.forEach((value, i) => { const storeKey = KEYMAPS[i].storeKey; if (value === null) Store.remove(storeKey); else Store.set(storeKey, value); });
      KEYMAPS.forEach((k, i) => { k.bindings = JSON.parse(keep[i]); });
      Inputs.rebuildMaps();
      return kept1 && kept2 && new1 && new2 && gone && saved && flagged && quiet ? true : JSON.stringify({ kept1, kept2, new1, new2, gone, saved, flagged, quiet });
    });
    test('Controls revision 4: a customised High block key carries over to Defend, a customised Low block key is dropped, a taken default falls back', () => {
      const raw = [Store.get(KEY_BINDINGS), Store.get(KEY_BINDINGS_P2)], keep = KEYMAPS.map((k) => JSON.stringify(k.bindings));
      const run = (p1, p2) => { Store.set(KEY_BINDINGS, JSON.stringify(Object.assign({ revision: 3 }, p1))); Store.set(KEY_BINDINGS_P2, JSON.stringify(Object.assign({ revision: 3 }, p2))); Keymap.init(); Keymap2.init(); return [Keymap.bindings, Keymap2.bindings]; };
      let [a1, a2] = run({ blockHigh: ['KeyH'], blockLow: ['KeyE'] }, { blockHigh: ['Numpad9'] });
      const carried = a1.defend[0] === 'KeyH' && a1.use[0] === 'KeyE' && a1.lock[0] === 'KeyQ' && a2.defend[0] === 'Numpad9' && a2.use[0] === 'Numpad1' && a2.lock[0] === 'Numpad2';
      [a1, a2] = run({ blockLow: ['KeyU'] }, {});
      const lowDropped = a1.defend[0] === 'KeyL' && !JSON.stringify(a1).includes('KeyU');   // only Low block was customised: Defend takes its default
      [a1, a2] = run({ punch: ['KeyL'], blockHigh: ['KeyQ'], lock: ['KeyZ'] }, { kick: ['Numpad6'] });
      const free = (b) => { const all = ACTIONS.reduce((acc, a) => acc.concat(b[a]), []); return new Set(all).size === all.length && ACTIONS.every((a) => b[a].length >= 1); };
      const fallback = a1.punch[0] === 'KeyL' && a1.defend[0] !== 'KeyL' && a1.lock[0] === 'KeyZ' && a2.kick[0] === 'Numpad6' && a2.defend[0] !== 'Numpad6' && free(a1) && free(a2);   // a key the player moved onto L or Numpad6 wins over the new default
      [a1, a2] = run({}, { punch: ['KeyL'] });
      const p2Kept = a2.punch[0] === 'KeyL' && a1.defend[0] !== 'KeyL' && free(a1);   // P2's key from before Defend existed stays with P2
      Store.set(KEY_BINDINGS, JSON.stringify({ revision: 2, lk: ['KeyU'], blockHigh: ['KeyK'] })); Store.remove(KEY_BINDINGS_P2);
      Keymap.init(); Keymap2.init();
      const olderSave = Keymap.bindings.kick[0] === 'KeyU' && Keymap.bindings.defend[0] === 'KeyK';   // a revision-2 High block on K keeps Kick on its old U
      raw.forEach((value, i) => { const storeKey = KEYMAPS[i].storeKey; if (value === null) Store.remove(storeKey); else Store.set(storeKey, value); });
      KEYMAPS.forEach((k, i) => { k.bindings = JSON.parse(keep[i]); });
      Inputs.rebuildMaps();
      return carried && lowDropped && fallback && p2Kept && olderSave ? true : JSON.stringify({ carried, lowDropped, fallback, p2Kept, olderSave, a1, a2 });
    });
    test('Controls: every action has a key for P1 and P2, the defaults have no conflicts, the old actions are gone', () => {
      const list = (defaults) => ACTIONS.reduce((acc, a) => acc.concat(defaults[a]), []);
      const unique = (all) => new Set(all).size === all.length;
      const p1 = list(DEFAULT_KEYS), p2 = list(DEFAULT_KEYS_P2);
      const p1Spares = ACTIONS.filter((a) => a !== 'pause').map((a) => DEFAULT_KEYS[a][1]).filter(Boolean);   // P1's spare arrows switch off in Versus
      const p1Main = p1.filter((c) => !p1Spares.includes(c));
      const everyAction = ACTIONS.every((a) => DEFAULT_KEYS[a].length >= 1 && DEFAULT_KEYS_P2[a].length >= 1 && DEFAULT_KEYS[a].concat(DEFAULT_KEYS_P2[a]).every((c) => BINDABLE_CODE.test(c) || c === 'Escape') && ACTION_LABELS[a] && GAMEPAD_LABELS[a] && TOUCH_LABELS[a]);   // Escape is pause's reserved key
      const noClash = unique(p1) && unique(p2) && p2.every((c) => !p1Main.includes(c)) && Object.keys(DEFAULT_KEYS).length === ACTIONS.length && Object.keys(DEFAULT_KEYS_P2).length === ACTIONS.length;
      const list13 = ACTIONS.length === 13 && ['defend', 'use', 'lock'].every((a) => ACTIONS.includes(a)) && ['blockHigh', 'blockLow', 'dash', 'strong', 'height'].every((a) => !ACTIONS.includes(a));
      const exact = DEFAULT_KEYS.defend[0] === 'KeyL' && DEFAULT_KEYS.use[0] === 'KeyE' && DEFAULT_KEYS.lock[0] === 'KeyQ' && DEFAULT_KEYS_P2.defend[0] === 'Numpad6' && DEFAULT_KEYS_P2.use[0] === 'Numpad1' && DEFAULT_KEYS_P2.lock[0] === 'Numpad2';
      const live = KEYMAPS.every((k) => ACTIONS.every((a) => k.bindings[a].length >= 1) && unique(ACTIONS.reduce((acc, a) => acc.concat(k.bindings[a]), [])));
      const r = { everyAction, noClash, list13, exact, live };
      return Object.values(r).every(Boolean) ? true : JSON.stringify(r);
    });
    test('Gamepad: every fight action has a button, no button has two fight meanings, L3 does nothing, menus still read buttons 4 to 7', () => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      const pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), device = Input.lastDevice;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
      const f = new Fighter(ROSTER_BY_ID.kai, 0), o = new Fighter(ROSTER_BY_ID.mara, 1), it = makeIntent();
      let r;
      try {
        const owner = {}; let shared = false;
        for (const action in PAD_BUTTONS) for (const button of PAD_BUTTONS[action]) { if (owner[button]) shared = true; owner[button] = action; }
        const stickActions = ['up', 'down', 'left', 'right', 'jump', 'crouch'];   // the stick and D-pad
        const covered = ACTIONS.every((a) => stickActions.includes(a) || a in PAD_BUTTONS) && Object.keys(PAD_BUTTONS).every((a) => ACTIONS.includes(a));
        const reserved = [PAD_SELECT_BUTTON, 10, 12, 13, 14, 15].every((b) => !owner[b]);   // Select, L3 and the D-pad are not fight buttons
        const intentOf = (button) => {
          Input.reset(); Input.releaseAll(); Input.lastDevice = 'gamepad';
          buttons[button].pressed = true; Input.update(); Input.fillIntent(it, f, o);
          const got = ['punch', 'kick', 'defend', 'grapple', 'use', 'lock', 'jump'].filter((a) => it[a]);
          const raw = ['menuL1', 'menuR1', 'menuL2', 'menuR2'].filter((k) => Input.padHeld[k]);
          buttons[button].pressed = false; Input.update(); Input.fillIntent(it, f, o);
          return { got, raw };
        };
        const meaning = { punch: 'punch', kick: 'kick', defend: 'defend', grapple: 'grapple', use: 'use', lock: 'lock' };
        const problems = [];
        for (const action in meaning) for (const button of PAD_BUTTONS[action]) { const g = intentOf(button).got; if (g.join() !== meaning[action]) problems.push('button ' + button + ' -> ' + g.join()); }
        const l3 = intentOf(10).got.length === 0;
        const menus = [4, 5, 6, 7].every((b, i) => intentOf(b).raw.join() === ['menuL1', 'menuR1', 'menuL2', 'menuR2'][i]);
        const res = { shared: !shared, covered, reserved, buttons: !problems.length, l3, menus };
        r = Object.values(res).every(Boolean) ? true : JSON.stringify({ res, problems });
      } finally {
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Input.releasePad(); Input.releaseAll(); Input.update(); Input.reset(); Input.lastDevice = device;
      }
      return r;
    });
    test('Controls change notice: an older progress save shows the controls card and the toast once, a new player gets neither', () => {
      const raw = Store.get(KEY_PROGRESS), keep = JSON.parse(JSON.stringify(Progress.d));
      Store.set(KEY_PROGRESS, JSON.stringify({ wins: 3, seenControls: true }));   // 1.0.0: no controls revision
      api.set.controlsChanged(false);
      Progress.init();
      const cardsSeen = () => CONTROL_CARD_KINDS.filter((kind) => Progress.d.seenControls[kind]).length;   // how many input types have seen their card
      const reset = cardsSeen() === 0 && Progress.d.wins === 3 && Progress.d.controlsRevision === KEYS_REVISION && api.get.controlsChanged();
      const stored = JSON.parse(Store.get(KEY_PROGRESS)).controlsRevision === KEYS_REVISION;
      const keepToast = UI.toast, shown = [];
      UI.toast = (msg) => shown.push(msg);
      const toast = UI.announceControlsChange() && !UI.announceControlsChange() && shown.join() === 'Controls changed: see Controls';   // one toast, then the flag is clear
      UI.toast = keepToast;
      for (const kind of CONTROL_CARD_KINDS) Progress.d.seenControls[kind] = true;
      Progress.save();                                                            // the cards were shown
      Progress.init();
      const once = cardsSeen() === CONTROL_CARD_KINDS.length && !api.get.controlsChanged();  // the next load shows neither
      Store.remove(KEY_PROGRESS);
      Progress.init();
      const fresh = cardsSeen() === 0 && !api.get.controlsChanged();                         // a new player has nothing to be told about
      if (raw === null) Store.remove(KEY_PROGRESS); else Store.set(KEY_PROGRESS, raw);
      Progress.d = keep;
      return reset && stored && toast && once && fresh ? true : JSON.stringify({ reset, stored, toast, once, fresh });
    });
    test('Key remapping rejects conflicts and invalid keys', () => {
      const keep = JSON.stringify(Keymap.bindings);
      const a = Keymap.rebind('punch', 'KeyK'), b = Keymap.rebind('punch', 'Escape'), c = Keymap.rebind('punch', 'F5'), d = Keymap.rebind('punch', 'KeyH');
      Keymap.bindings = JSON.parse(keep); Keymap.save(); Input.rebuildMap();
      return !a.ok && !b.ok && !c.ok && d.ok ? true : JSON.stringify([a.ok, b.ok, c.ok, d.ok]);
    });
    test('Corrupted saved key bindings are repaired', () => {
      const raw = Store.get(KEY_BINDINGS), keep = JSON.stringify(Keymap.bindings);
      Store.set(KEY_BINDINGS, '{"revision":3,"punch":["F5","KeyK"],"kick":5,"grapple":["KeyU","KeyU"],"pause":["KeyP"]}');
      Keymap.init();
      const all = ACTIONS.reduce((acc, a) => acc.concat(Keymap.bindings[a]), []);
      const unique = new Set(all).size === all.length;
      const complete = ACTIONS.every((a) => Keymap.bindings[a].length >= 1 && Keymap.bindings[a].every((c) => typeof c === 'string'));
      const escape = Keymap.bindings.pause.includes('Escape');
      if (raw === null) Store.remove(KEY_BINDINGS); else Store.set(KEY_BINDINGS, raw);
      Keymap.bindings = JSON.parse(keep); Input.rebuildMap();
      return unique && complete && escape ? true : 'unique ' + unique + ' complete ' + complete + ' escape ' + escape;
    });
    test('Versus: P2 keys never move P1, P1 keys never move P2, P1 loses its spare arrows only in Versus', () => {
      const keep = Settings.v.movement;
      Settings.v.movement = 'opponent';
      const key = (code, down) => { const e = { code, repeat: false, preventDefault() {} }; if (down) Inputs.onKeyDown(e); else Inputs.onKeyUp(e); };
      const f1 = new Fighter(ROSTER_BY_ID.kai, 0), f2 = new Fighter(ROSTER_BY_ID.mara, 1), it1 = makeIntent(), it2 = makeIntent();
      const read = () => { Inputs.update(); Input.fillIntent(it1, f1, f2); Input2.fillIntent(it2, f2, f1); };
      Inputs.setVersus(true);
      key('ArrowUp', true); key('Numpad4', true); read();
      const p2Only = it2.fwd > 0 && it2.punch && it1.fwd === 0 && !it1.punch;
      key('ArrowUp', false); key('Numpad4', false); key('KeyW', true); key('KeyJ', true); read();
      const p1Only = it1.fwd > 0 && it1.punch && it2.fwd === 0 && !it2.punch;
      key('KeyW', false); key('KeyJ', false);
      const versusMap = !Input.codeMap.has('ArrowUp') && Input2.codeMap.get('ArrowUp') === 'up';
      Inputs.setVersus(false);
      key('ArrowUp', true); read();
      const soloArrows = it1.fwd > 0 && Input.codeMap.get('ArrowUp') === 'up';
      key('ArrowUp', false);
      Inputs.releaseAll(); Inputs.reset(); Settings.v.movement = keep;
      return p2Only && p1Only && versusMap && soloArrows ? true : JSON.stringify({ p2Only, p1Only, versusMap, soloArrows });
    });
    test('Versus: screen-relative movement works from P2\'s side (screen left walks P2 toward P1)', () => {
      const keep = Settings.v.movement, kr = Camera.dirRight.slice(), kf = Camera.dirFwd.slice();
      Settings.v.movement = 'screen';
      Camera.dirRight[0] = 1; Camera.dirRight[1] = 0; Camera.dirFwd[0] = 0; Camera.dirFwd[1] = -1;
      const f = new Fighter(ROSTER_BY_ID.mara, 1), it = makeIntent();
      f.yaw = -Math.PI / 2;                             // P2 on the right, facing P1 on the screen left
      Input2.reset();
      Input2.analog.fwd = 0; Input2.analog.side = -1; Input2.fillIntent(it, f, null);
      const toward = it.fwd > 0.99;
      Input2.reset(); Input2.press('right'); Input2.press('right'); Input2.fillIntent(it, f, null);
      const awayDoesNothing = !it.sidestep && Input2.runDir === null;   // a double tap away from the opponent does nothing (the move itself is still held)
      Input2.analog.side = 0; Input2.reset();
      Settings.v.movement = keep;
      Camera.dirRight[0] = kr[0]; Camera.dirRight[1] = kr[1]; Camera.dirFwd[0] = kf[0]; Camera.dirFwd[1] = kf[1];
      return toward && awayDoesNothing ? true : JSON.stringify({ toward, awayDoesNothing });
    });
    test('P2 key bindings: no key is shared with P1, P2 gives way when P1 takes a key back', () => {
      const raw = [Store.get(KEY_BINDINGS), Store.get(KEY_BINDINGS_P2)], keep = KEYMAPS.map((k) => JSON.stringify(k.bindings));
      const p1Spares = ACTIONS.filter((a) => a !== 'pause').map((a) => DEFAULT_KEYS[a][1]).filter(Boolean);
      const p1Keys = ACTIONS.reduce((acc, a) => acc.concat(DEFAULT_KEYS[a]), []).filter((c) => !p1Spares.includes(c));
      const defaults = ACTIONS.every((a) => DEFAULT_KEYS_P2[a].every((c) => !p1Keys.includes(c)));
      const versus = Inputs.versus;
      Inputs.versus = true;                                              // in Versus P1 cannot take a P2 key either
      const a = Keymap2.rebind('punch', 'KeyJ'), b = Keymap.rebind('punch', 'Numpad5'), c = Keymap2.rebind('punch', 'Escape'), d = Keymap2.rebind('punch', 'KeyH');
      Inputs.versus = versus;
      Keymap.rebind('punch', 'KeyN'); Keymap2.rebind('kick', 'KeyJ');   // J is free once P1 moves off it
      Keymap.resetAll();                                                 // P1 takes J back: P2's kick moves
      const gaveWay = Keymap.bindings.punch[0] === 'KeyJ' && Keymap2.bindings.kick[0] !== 'KeyJ';
      Store.set(KEY_BINDINGS_P2, JSON.stringify({ revision: KEYS_REVISION, punch: ['KeyJ'], kick: ['Numpad5', 'Numpad5'], pause: ['Escape'] }));
      Keymap2.init();
      const all = ACTIONS.reduce((acc, x) => acc.concat(Keymap2.bindings[x]), []);
      const repaired = !all.includes('KeyJ') && !all.includes('Escape') && new Set(all).size === all.length && ACTIONS.every((x) => Keymap2.bindings[x].length >= 1);
      raw.forEach((value, i) => { const storeKey = KEYMAPS[i].storeKey; if (value === null) Store.remove(storeKey); else Store.set(storeKey, value); });
      KEYMAPS.forEach((k, i) => { k.bindings = JSON.parse(keep[i]); });
      Inputs.rebuildMaps();
      return defaults && !a.ok && !b.ok && !c.ok && d.ok && gaveWay && repaired ? true : JSON.stringify({ defaults, a: a.ok, b: b.ok, c: c.ok, d: d.ok, gaveWay, repaired });
    });
    test('Key bindings: outside Versus P1 can take a P2 key (P2 gives way, with a warning) and get the arrows back', () => {
      const raw = [Store.get(KEY_BINDINGS), Store.get(KEY_BINDINGS_P2)], keep = KEYMAPS.map((k) => JSON.stringify(k.bindings)), versus = Inputs.versus;
      Inputs.versus = false;
      const p2Up = Keymap2.bindings.up[0];
      Keymap.rebind('up', 'KeyT');
      const back = Keymap.rebind('up', p2Up);                            // e.g. the arrow P1 lost by rebinding
      const moved = back.ok && back.moved.includes('P2') && Keymap.bindings.up[0] === p2Up && !Keymap2.bindings.up.includes(p2Up) && Keymap2.bindings.up.length >= 1;
      const numpad = Keymap.rebind('punch', Keymap2.bindings.punch[0]).ok;
      const p1Main = Keymap.mainCodes();
      const separate = ACTIONS.every((x) => Keymap2.bindings[x].every((c) => !p1Main.includes(c)));   // still no shared main key when Versus starts
      raw.forEach((value, i) => { const storeKey = KEYMAPS[i].storeKey; if (value === null) Store.remove(storeKey); else Store.set(storeKey, value); });
      KEYMAPS.forEach((k, i) => { k.bindings = JSON.parse(keep[i]); });
      Inputs.versus = versus;
      Inputs.rebuildMaps();
      return moved && numpad && separate ? true : JSON.stringify({ back, moved, numpad, separate });
    });
    test('Settings are clamped and corrupted values fall back', () => {
      return Settings.validate('master', 5) === 1 && Settings.validate('master', 'abc') === SETTING_DEFS.master.def && Settings.validate('quality', 'ultra') === 'auto' && Settings.validate('reducedMotion', 'yes') === false ? true : 'validation failed';
    });
    test('Persistence failure does not break the game', () => {
      const keep = Store.ok;
      Store.ok = false;
      Store.set('breakpoint.test', 'x');
      const v = Store.get('breakpoint.test');
      Store.remove('breakpoint.test');
      Store.ok = keep;
      return v === 'x' ? true : 'memory fallback failed';
    });
    test('Full storage (writes throw, reads work): saved data is still read, play goes on in memory and one warning toast says saving failed', () => {
      const keep = { storage: Store.storage, ok: Store.ok, failure: Store.failure, warned: Store.warned, mem: Store.mem };
      const log = self.capture(['toast']);
      try {
        const data = { 'bp.test.saved': 'old' };
        const full = { getItem: (key) => (key in data ? data[key] : null), setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} };
        Store.mem = {}; Store.warned = false;
        Store.init(full);
        const read = Store.get('bp.test.saved');
        Store.set('bp.test.new', 'x'); Store.set('bp.test.new', 'y'); Store.set('bp.test.saved', 'newer');
        Store.reportFailure();
        const toasts = log.toast.filter((t) => t.kind === 'warn' && /could not be saved/.test(t.msg)).length;
        const state = { read, ok: Store.ok, failure: !!Store.failure, mem: Store.get('bp.test.new') + Store.get('bp.test.saved'), toasts };
        Store.init({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} });
        const unreadable = !Store.ok && !!Store.failure && Store.get('bp.test.none') === null;
        return state.read === 'old' && state.ok && state.failure && state.mem === 'ynewer' && state.toasts === 1 && unreadable ? true : JSON.stringify({ state, unreadable });
      } finally { log.stop(); Object.assign(Store, keep); }
    });
    test('Matches do not leak event listeners', () => {
      const before = Events.count();
      for (let i = 0; i < 6; i++) { const m = mk({}); self.run(m, 5); m.dispose(); }
      return Events.count() === before ? true : before + ' -> ' + Events.count();
    });
    test('Sidestep needs its full stamina cost and has no invulnerability; the Dash state is gone', () => {
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 3) it.sidestep = 1; });
      self.place(m, 4); m.fighters[0].stam = SIDESTEP_COST / 2;   // half the cost used to be enough
      let tired = true;
      for (let i = 0; i < 30; i++) { m.step(); if (m.fighters[0].state === S.SIDESTEP) tired = false; }
      m.dispose();
      const m2 = mk({}, (it, f, o, mm) => { if (mm.tick === 3) it.sidestep = 1; });
      self.place(m2, 4);
      let stepped = false, invulnerable = false;
      for (let i = 0; i < 30; i++) { m2.step(); if (m2.fighters[0].state === S.SIDESTEP) stepped = true; if (m2.fighters[0].invuln > 0) invulnerable = true; }
      m2.dispose();
      const gone = !('DASH' in S) && !('DASH' in TRANSITIONS) && !('DASH' in STATE_LABEL);
      return tired && stepped && !invulnerable && gone ? true : 'tired ' + tired + ' stepped ' + stepped + ' invulnerable ' + invulnerable + ' gone ' + gone;
    });
    test('Sidestep evades a slow linear attack', () => {
      const log = self.capture(['hit']);
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.power_jab); }, (it, f, o, mm) => { if (mm.tick === 3) it.sidestep = 1; });   // a strong move straight from the move table
      self.place(m, 1.2); self.run(m, 60); log.stop();
      return log.hit.length === 0 ? true : 'power jab hit a sidestepping fighter';
    });
    test('Round timer warns once a second over the last five seconds', () => {
      const m = mk({ timer: 7 });
      self.place(m, 4);
      const log = self.capture(['timeWarn']);
      self.run(m, 7 * 60 + 5);
      log.stop();
      const seconds = log.timeWarn.map((e) => e.seconds).join(',');
      return seconds === '5,4,3,2,1' ? true : 'warned at ' + seconds;
    });
    test('Objects destroyed are credited to the fighter who broke them', () => {
      const m = mk({ arenaId: 'warehouse' });
      const [first, second, third] = Arena.objects;
      Arena.damageObject(first, 999, 'heavy', 1, 1, 0, first.x, 0.5, first.z, 1);
      Arena.damageObject(second, 999, 'heavy', 2, 1, 0, second.x, 0.5, second.z);
      Arena.damageObject(third, 999, 'heavy', 3, 1, 0, third.x, 0.5, third.z, 0);
      const counts = m.stats.map((st) => st.objects).join(',');
      return counts === '1,1' ? true : 'objects credited ' + counts;
    });
    test('Music turns tense on low health and match point', () => {
      const m = mk({});
      const calm = !UI.tenseMoment(m);
      m.fighters[1].hp = m.fighters[1].maxHp * 0.2;
      const lowHp = UI.tenseMoment(m);
      m.fighters[1].hp = m.fighters[1].maxHp; m.round = 2; m.wins = [1, 0];
      const matchPoint = UI.tenseMoment(m);
      return calm && lowHp && matchPoint ? true : JSON.stringify({ calm, lowHp, matchPoint });
    });
    test('Training dummy can be set to infinite health', () => {
      const m = mk({ mode: 'training', countdown: false }, (it, f, o, mm) => { if (mm.tick % 30 === 2) it.kick = true; });
      m.infiniteHp = true; m.fighters[1].hp = 3; self.place(m, 1.2); self.run(m, 200);
      return m.fighters[1].alive && m.fighters[1].hp >= 1 ? true : 'dummy was knocked out';
    });
    test('Training: attacking dummies walk in and attack at their height, block-after-hit blocks the follow-up', () => {
      const heights = {};
      for (const mode of ['attackHigh', 'attackLow', 'attackMix']) {
        const m = mk({ mode: 'training', dummy: mode });
        m.controllers[1] = new DummyController(ROSTER_BY_ID.mara, mode);
        self.place(m, 3.5);
        const log = self.capture(['attackStart']);
        self.run(m, 1200);   // about 15 attacks, so a random mix shows both heights
        log.stop();
        heights[mode] = log.attackStart.filter((e) => e.f.index === 1).map((e) => e.mv.h).join('');
        m.dispose();
      }
      const attacks = /^H{3,}$/.test(heights.attackHigh) && /^L{3,}$/.test(heights.attackLow) && /H/.test(heights.attackMix) && /L/.test(heights.attackMix);
      const m = mkBlock({ mode: 'training', dummy: 'blockAfterHit' }, (it, f, o, mm) => { if (mm.tick === 2 || mm.tick === 45) it.punch = true; });
      m.controllers[1] = new DummyController(ROSTER_BY_ID.mara, 'blockAfterHit');
      self.place(m, 1.2);
      const log = self.capture(['hit', 'block']);
      self.run(m, 90);
      log.stop();
      const guarded = log.hit.length === 1 && log.block.length === 1;
      return attacks && guarded ? true : JSON.stringify({ heights, hits: log.hit.length, blocks: log.block.length });
    });
    test('Reduced motion disables camera shake', () => {
      const keep = Settings.v.reducedMotion;
      Settings.v.reducedMotion = true; Camera.shakeAmp = 0; Camera.impact(1, 1);
      const off = Camera.shakeAmp === 0;
      Settings.v.reducedMotion = false; Settings.v.shake = 0.6; Camera.impact(1, 1);
      const on = Camera.shakeAmp > 0 && Camera.shakeAmp < 0.5;
      Settings.v.reducedMotion = keep; Camera.shakeAmp = 0;
      return off && on ? true : 'off ' + off + ' on ' + on;
    });
    test('Pause freezes the fight and resume restores it', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      Game.chooseMode('training'); Game.selection.arena = 'dojo'; Game.startFromSelection();
      const m = Game.match;
      let now = performance.now();
      const render = Game.render; Game.render = () => {};
      for (let i = 0; i < 20; i++) { now += 16.7; Game.frame(now); }
      Game.pause();
      const tick = m.tick, x = m.fighters[0].x;
      for (let i = 0; i < 30; i++) { now += 16.7; Game.frame(now); }
      const frozen = m.tick === tick && m.fighters[0].x === x && Game.state === GS.PAUSED;
      Game.resume();
      for (let i = 0; i < 10; i++) { now += 16.7; Game.frame(now); }
      const resumed = m.tick > tick && Game.state === GS.FIGHT;
      Game.render = render;
      Game.quitToMenu();
      return frozen && resumed ? true : 'frozen ' + frozen + ' resumed ' + resumed;
    });
    test('Camera keeps both fighters on screen', () => {
      const m = mk({});
      self.place(m, 7);
      const out = [0, 0], keepW = R.cssW, keepH = R.cssH;
      R.cssW = 1280; R.cssH = 720;
      for (let i = 0; i < 120; i++) Camera.follow(1 / 60, m.fighters[0], m.fighters[1], m.def);
      const ok = m.fighters.every((f) => R.project(f.x, f.y + 1, f.z, out) && out[0] > 0 && out[0] < R.cssW && out[1] > 0 && out[1] < R.cssH);
      R.cssW = keepW; R.cssH = keepH;
      return ok ? true : 'a fighter left the frame';
    });
    /* ----- modes and match flow ----- */
    const keepProgress = () => ({ raw: Store.get(KEY_PROGRESS), d: JSON.parse(JSON.stringify(Progress.d)), sel: Object.assign({}, Game.selection) });
    const restoreProgress = (saved) => {
      if (saved.raw === null) Store.remove(KEY_PROGRESS); else Store.set(KEY_PROGRESS, saved.raw);
      Progress.d = saved.d;
      Object.assign(Game.selection, saved.sel);
    };
    /* End the current Game match as a player win and continue from the results screen. */
    const winAndContinue = (action) => {
      Game.state = GS.ROUND_END; Game.match.matchOver = true; Game.match.matchWinner = 0; Game.onMatchEnd();
      Game.state = GS.RESULTS; Game.resultsAction(action);
    };
    test('Survival: record saved on every win and on quit, restart abandons the run, health carries into a replayed round', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Progress.d.survivalKills = 0; Progress.d.survivalSeconds = 0;
      Game.chooseMode('survival'); Game.startFromSelection();
      winAndContinue('next'); winAndContinue('next');
      const stored = JSON.parse(Store.get(KEY_PROGRESS) || '{}').survivalKills === 2;
      Game.state = GS.FIGHT; Game.pause(); Game.restartMatch();
      const abandoned = Game.run.kills === 0 && Game.match.cfg.playerHp === 1 && Progress.d.survivalKills === 2;
      Game.match.matchTicks = 60 * 900;                 // 15 minutes into an unfinished fight
      Game.quitToMenu();
      const quit = Progress.d.survivalSeconds >= 900 && Game.state === GS.MENU;
      restoreProgress(saved);
      const m = mk({ mode: 'survival', playerHp: 0.5, winsNeeded: 1, timer: 2 });
      m.fighters[1].hp = m.fighters[1].maxHp * 0.5;
      m.endRound('time'); m.startRound();
      const replay = m.round === 2 && m.fighters[0].hp === m.fighters[0].maxHp * 0.5;
      return stored && abandoned && quit && replay ? true : JSON.stringify({ stored, abandoned, quit, replay });
    });
    test('Round flow: banner before the count, shorter count later, KO slow motion on the blow, skippable round end', () => {
      const log = self.capture(['countdown']);
      const m = mk({ countdown: true, timer: 60 });
      let first = -1, ticks = 0;
      while (m.phase === 'countdown' && ticks < 400) { m.step(); ticks++; if (first < 0 && log.countdown.length) first = ticks; }
      const round1 = log.countdown.map((e) => e.n).join();
      m.endRound('time');
      const early = m.skipRoundEnd();
      self.run(m, SKIP_ARM_TICKS);
      const skipped = m.skipRoundEnd();
      m.step();
      const next = m.phase === 'waiting';
      log.countdown.length = 0;
      m.startRound();
      let ticks2 = 0;
      while (m.phase === 'countdown' && ticks2 < 400) { m.step(); ticks2++; }
      log.stop();
      const round2 = log.countdown.map((e) => e.n).join();
      m.dispose();
      const k = mk({}, once(2, 'punch')); self.place(k, 1.2); k.fighters[1].hp = 1;
      let slowAtKo = false;
      for (let i = 0; i < 30 && !slowAtKo; i++) { k.step(); if (!k.fighters[1].alive) slowAtKo = k.slowTicks > 0 && k.phase === 'fight'; }
      const ok = first >= ROUND_BANNER_TICKS && round1 === '3,2,1' && round2 === '2,1' && ticks2 < ticks && !early && skipped && next && slowAtKo;
      return ok ? true : JSON.stringify({ first, round1, round2, ticks, ticks2, early, skipped, next, slowAtKo });
    });
    test('Onboarding: the first match shows the controls once, a key closes it, old saves get it too', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      try {
        Store.set(KEY_PROGRESS, JSON.stringify({ arcadeClears: 1, wins: 3 }));   // a save from before the flag existed
        Progress.init();
        const migrated = CONTROL_CARD_KINDS.every((kind) => !Progress.d.seenControls[kind]) && Progress.d.wins === 3;
        const kind = UI.onboardKind();
        Game.chooseMode('free'); Game.startFromSelection();
        const card = UI.dom.onboard;
        const shown = !card.hidden && card.textContent.includes(UI.keyName('grapple'));
        const stored = JSON.parse(Store.get(KEY_PROGRESS)).seenControls[kind] === true;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
        const closed = card.hidden;
        Game.quitToMenu();
        Game.chooseMode('free'); Game.startFromSelection();
        const once = card.hidden;
        return migrated && shown && stored && closed && once ? true : JSON.stringify({ migrated, shown, stored, closed, once });
      } finally {
        if (Game.state !== GS.MENU) Game.quitToMenu();   // never leave a running match behind, whatever failed above
        restoreProgress(saved);
      }
    });
    test('Onboarding: each input type (keyboard, gamepad, touch) gets one card with the core actions, once, kept in the save', () => {
      const saved = keepProgress(), cardDom = UI.dom.onboard, device = Input.lastDevice, touchMode = Settings.v.touch, problems = [];
      const card = { innerHTML: '', hidden: true };   // a stand-in for the card element, so the test needs no screen
      UI.dom.onboard = card; Settings.v.touch = 'off';   // 'off': a keyboard player on a touch device stays a keyboard player
      try {
        Progress.d = Progress.fresh();
        const match = { cfg: {} };
        Input.lastDevice = 'keyboard';
        if (UI.controlsCardDue({ cfg: { benchmark: true } }) || CONTROL_CARD_KINDS.some((kind) => Progress.d.seenControls[kind])) problems.push('a benchmark used up a card');
        const shown = [];
        for (const kind of CONTROL_CARD_KINDS) {
          Input.lastDevice = kind;
          if (UI.onboardKind() !== kind || !UI.controlsCardDue(match)) problems.push(kind + ' card not due');
          UI.showOnboarding();
          shown.push(kind);
          const missing = ['punch', 'kick', 'defend', 'grapple', 'jump', 'crouch'].filter((action) => !card.innerHTML.includes(esc(UI.keyName(action))));
          if (missing.length || !/string/.test(card.innerHTML) || !/Move|Stick/.test(card.innerHTML)) problems.push(kind + ' card lacks ' + missing.join('+'));
          if (UI.controlsCardDue(match)) problems.push(kind + ' card due again');
          if (!CONTROL_CARD_KINDS.every((other) => Progress.d.seenControls[other] === shown.includes(other))) problems.push('after ' + kind + ' seen ' + JSON.stringify(Progress.d.seenControls));
        }
        Progress.init();   // the save keeps all three
        if (!CONTROL_CARD_KINDS.every((kind) => Progress.d.seenControls[kind] && !UI.controlsCardDue.call({ onboardKind: () => kind }, match))) problems.push('save lost a card ' + JSON.stringify(Progress.d.seenControls));
        Input.lastDevice = 'keyboard';   // a phone's first fight: nothing has set the device to touch yet
        const touchCard = UI.controlsCardHtml('touch'), padCard = UI.controlsCardHtml('gamepad');
        if (!touchCard.includes(esc(TOUCH_LABELS.punch)) || touchCard.includes(esc(keyLabel(Keymap.bindings.punch[0])) + '</kbd>')) problems.push('touch card shows keys');
        if (!padCard.includes(esc(GAMEPAD_LABELS.punch))) problems.push('pad card shows keys');
        Store.set(KEY_PROGRESS, JSON.stringify({ wins: 1, seenControls: true, controlsRevision: KEYS_REVISION }));   // the single flag of an earlier build
        Progress.init();
        if (!CONTROL_CARD_KINDS.every((kind) => Progress.d.seenControls[kind])) problems.push('old flag not kept');
      } finally {
        UI.hideOnboarding(); UI.dom.onboard = cardDom; Settings.v.touch = touchMode; Input.lastDevice = device; restoreProgress(saved);
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Menus: choosing the selected fighter, opponent or arena again moves on', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      try {
        Game.chooseMode('free');
        UI.act('pick:' + Game.selection.player);
        const setup = UI.current === 'setup';
        UI.act('opp:' + Game.selection.opponent);
        const arena = Game.state === GS.ARENASEL;
        UI.act('arena:' + Game.selection.arena);
        const started = !!Game.match && Game.state === GS.COUNTDOWN;
        return setup && arena && started ? true : JSON.stringify({ setup, arena, started, state: Game.state });
      } finally {
        if (Game.state !== GS.MENU) Game.quitToMenu();   // never leave a running match behind, whatever failed above
        restoreProgress(saved);
      }
    });
    test('Results: presses in the first moments are ignored', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Game.chooseMode('free'); Game.startFromSelection();
      Game.state = GS.ROUND_END; Game.match.matchOver = true; Game.match.matchWinner = 0; Game.onMatchEnd();
      Game.go(GS.RESULTS);
      const button = UI.dom.screens.querySelector('[data-act]');
      UI.onClick({ target: button });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
      const guarded = Game.state === GS.RESULTS && UI.current === 'results';
      Game.quitToMenu();
      restoreProgress(saved);
      return guarded ? true : 'results skipped: ' + Game.state;
    });
    test('Pause: works in the countdown and the knock-out lock, the pause key resumes', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Game.chooseMode('free'); Game.startFromSelection();
      const render = Game.render; Game.render = () => {};
      let now = performance.now();
      const frame = () => { now += 16.7; Game.frame(now); };
      frame();
      Input.press('pause'); frame();
      const countdown = Game.state === GS.PAUSED && Game.pausedFrom === GS.COUNTDOWN;
      UI.guardUntil = 0; Input.press('pause'); frame();
      const resumed = Game.state === GS.COUNTDOWN;
      for (let i = 0; i < 400 && Game.state !== GS.FIGHT; i++) frame();
      Combat.knockOut(Game.match.fighters[1], Game.match.fighters[0], null, Game.match);
      for (let i = 0; i < 30 && !Game.match.locked; i++) frame();
      const locked = Game.match.locked;
      Input.press('pause'); frame();
      const koLock = Game.state === GS.PAUSED;
      Game.render = render;
      Game.quitToMenu();
      restoreProgress(saved);
      return countdown && resumed && locked && koLock ? true : JSON.stringify({ countdown, resumed, locked, koLock });
    });
    test('Match end: a real knock-out reaches VICTORY and then RESULTS through the normal handlers', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Game.selection.rounds = 1;   // one knocked-out round wins the match
      Game.chooseMode('free'); Game.startFromSelection();
      const render = Game.render; Game.render = () => {};
      let now = performance.now();
      const frame = () => { now += 16.7; Game.frame(now); };
      for (let i = 0; i < 400 && Game.state !== GS.FIGHT; i++) frame();
      const fighting = Game.state === GS.FIGHT;
      Combat.knockOut(Game.match.fighters[1], Game.match.fighters[0], null, Game.match);
      for (let i = 0; i < 600 && Game.state !== GS.VICTORY; i++) frame();
      const victory = Game.state === GS.VICTORY && !!Game.resultsData && Game.resultsData.playerWon === true;
      for (let i = 0; i < 600 && Game.state !== GS.RESULTS; i++) frame();
      const results = Game.state === GS.RESULTS && UI.current === 'results';
      Game.render = render;
      Game.quitToMenu();
      restoreProgress(saved);
      return fighting && victory && results ? true : JSON.stringify({ fighting, victory, results, state: Game.state });
    });
    test('Creator: leaving a preview that started from character select returns to character select', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const origin = CreatorUI.origin;
      CreatorUI.origin = 'char';
      CreatorUI.exit();
      const landed = Game.state === GS.CHARSEL && UI.current === 'char';
      Game.quitToMenu();
      CreatorUI.origin = origin;
      return landed ? true : JSON.stringify({ state: Game.state, screen: UI.current });
    });
    test('Hints: too tired to escape, the clinch strike keys with strikes left, a Move list entry in the pause menu', () => {
      const m = mk({});
      const [a, b] = m.fighters;
      a.grip = b.grip = 'front'; a.throwAim = 'fwd'; a.throwPending = null;
      b.escapeLock = 0; b.clinchTick = escapeStartFor(b);
      b.stam = ESCAPE_STAMINA - 1;
      const tired = UI.clinchHint(b).startsWith('TOO TIRED');
      b.stam = ESCAPE_STAMINA;
      const escape = UI.clinchHint(b).startsWith('ESCAPE NOW');
      a.clinchStrikes = 0;
      const fresh = UI.throwHint(a), strikes = fresh.includes(UI.keyName('punch', 0) + ' elbow / ' + UI.keyName('kick', 0) + ' knee (' + CLINCH_STRIKE_MAX + ' left)');
      a.clinchStrikes = CLINCH_STRIKE_MAX;
      const spent = !UI.throwHint(a).includes('knee');
      const pauseMoves = UI.screen_pause().includes('data-act="moves"');
      return tired && escape && strikes && spent && pauseMoves ? true : JSON.stringify({ tired, escape, fresh, spent, pauseMoves });
    });
    test('Hints: the clinch instructions appear in the first clinch only, for the whole of it; simulations never count', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Progress.d.seenClinch = false;
      const sim = mk({});
      Events.emit('clinch', { att: sim.fighters[0], def: sim.fighters[1], grip: 'front', x: 0, y: 1.1, z: 0 });
      const simIgnored = !Progress.d.seenClinch;
      sim.dispose();
      Game.chooseMode('free'); Game.startFromSelection();
      const [a, b] = Game.match.fighters;
      a.grip = b.grip = 'front'; a.throwAim = 'fwd'; a.throwPending = null; a.clinchStrikes = 0;
      Events.emit('clinch', { att: a, def: b, grip: 'front', x: 0, y: 1.1, z: 0 });
      a.state = S.GRAPPLE; b.state = S.CLINCH;
      const first = UI.grappleHint(a).includes('knee');
      a.clinchTick = 40;
      const wholeClinch = UI.grappleHint(a).includes('knee');
      const saved1 = Progress.d.seenClinch && JSON.parse(Store.get(KEY_PROGRESS)).seenClinch === true;
      Events.emit('clinch', { att: b, def: a, grip: 'front', x: 0, y: 1.1, z: 0 });
      b.state = S.GRAPPLE; a.state = S.CLINCH; a.escapeLock = 0; a.clinchTick = escapeStartFor(a);
      const later = UI.grappleHint(a) === '' && UI.grappleHint(b) === '';
      Game.match.training = true;
      const training = UI.grappleHint(a) === '';
      Game.match.training = false;
      a.state = b.state = S.IDLE;
      Game.quitToMenu();
      restoreProgress(saved);
      const r = { simIgnored, first, wholeClinch, saved1, later, training };
      return Object.values(r).every(Boolean) ? true : JSON.stringify(r);
    });
    test('Pause: Esc or a pause press that leaves Controls or Settings lands on the pause screen; a later press resumes', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Game.chooseMode('free'); Game.startFromSelection();
      const render = Game.render; Game.render = () => {};
      let now = performance.now();
      const frame = () => { now += 16.7; Game.frame(now); };
      const key = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
      Game.pause(); frame();
      UI.push('controls'); frame();
      UI.guardUntil = 0; key('Escape'); frame(); frame();
      const fromControls = Game.state === GS.PAUSED && UI.current === 'pause';
      UI.push('settings'); frame();
      Input.press('pause'); UI.back(); frame(); frame();
      const fromSettings = Game.state === GS.PAUSED && UI.current === 'pause';
      Input.press('pause'); frame();
      const resumed = Game.state === GS.COUNTDOWN;
      Game.render = render;
      Game.quitToMenu();
      restoreProgress(saved);
      return fromControls && fromSettings && resumed ? true : JSON.stringify({ fromControls, fromSettings, resumed });
    });
    test('Mirror matches: the second fighter wears distinct colours; Arcade and Survival never mirror', () => {
      const plain = [];
      for (const r of ROSTER) {
        const m = mk({ playerId: r.id, opponentId: r.id });
        const c0 = m.fighters[0].lk.colors, c1 = m.fighters[1].lk.colors;
        if (!['shorts', 'glove', 'shoe', 'accent'].every((k) => c0[k] !== c1[k]) || c0.skin !== c1.skin) plain.push(r.id);
        m.dispose();
      }
      const free = Game.opponentChoices('kai', true).some((r) => r.id === 'kai');
      const ladders = !Game.opponentChoices('kai').some((r) => r.id === 'kai') && !Game.opponentsFor('kai').some((r) => r.id === 'kai');
      return !plain.length && free && ladders ? true : JSON.stringify({ plain, free, ladders });
    });
    test('Versus: two player controllers and no AI, either player pauses, the session score counts wins and survives a rematch', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Game.chooseMode('versus');
      const p2Reads = Inputs.versus;
      Game.selection.player = 'kai'; Game.selection.player2 = 'kai';
      Game.startFromSelection();
      const m = Game.match;
      const humans = m.controllers[0] === PlayerController && m.controllers[1] === Player2Controller && !m.controllers.some((c) => c instanceof AIController || c instanceof DummyController);
      Input2.press('pause'); Game.pollMatchInput();
      const p2Pause = Game.state === GS.PAUSED;
      Game.resume();
      const endAs = (winner) => { Game.state = GS.ROUND_END; Game.match.matchOver = true; Game.match.matchWinner = winner; Game.onMatchEnd(); Game.state = GS.RESULTS; };
      endAs(1);
      const first = Game.versus.score.join() === '0,1';
      UI.go('results');
      const text = UI.dom.screens.textContent;
      const named = text.includes('P2 wins') && text.includes('Session score') && text.includes('Rematch') && text.includes('Change fighters');
      Game.resultsAction('again');
      const rematch = Game.match.versus && Game.match.cfg.opponentId === 'kai' && Game.versus.score.join() === '0,1';
      endAs(0);
      const second = Game.versus.score.join() === '1,1';
      Game.quitToMenu();
      const cleared = Game.versus === null && !Inputs.versus;
      restoreProgress(saved);
      const ok = p2Reads && humans && p2Pause && first && named && rematch && second && cleared;
      return ok ? true : JSON.stringify({ p2Reads, humans, p2Pause, first, named, rematch, second, cleared });
    });
    test('Survival: every lap meets the whole roster in a new order, later wins keep raising the pressure', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Game.selection.player = 'kai';
      Game.chooseMode('survival'); Game.startFromSelection();
      const pool = Game.opponentChoices('kai').map((r) => r.id);
      const seen = [Game.match.cfg.opponentId];
      for (let i = 0; i < Math.max(SURVIVAL_PEAK + 2, pool.length); i++) { winAndContinue('next'); seen.push(Game.match.cfg.opponentId); }   // a lap is the whole pool (31 presets and the customs)
      const lap = seen.slice(0, pool.length).sort().join() === pool.slice().sort().join();
      const late = Game.match.cfg.timer < SURVIVAL_TIMER && Game.match.cfg.difficulty === 'expert';
      Game.quitToMenu();
      restoreProgress(saved);
      return lap && late ? true : JSON.stringify({ seen, lap, late });
    });
    test('Arcade: difficulty option shifts the ladder, retries count continues, a clear offers Play again', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Progress.d = Progress.fresh();
      const ladder = (level) => [0, 1, 2, 3, 4].map((stage) => arcadeDifficulty(stage, level)).join();
      const levels = ladder('normal') === 'easy,normal,hard,hard,expert' && ladder('easy') === 'easy,easy,normal,normal,hard' && ladder('hard') === 'normal,hard,expert,expert,expert';
      Game.selection.player = 'kai'; Game.selection.arcadeLevel = 'hard';
      Game.chooseMode('arcade'); Game.startFromSelection();
      const shifted = Game.match.cfg.difficulty === 'normal';
      Game.state = GS.ROUND_END; Game.match.matchOver = true; Game.match.matchWinner = 1; Game.onMatchEnd();
      Game.state = GS.RESULTS; Game.resultsAction('retry');
      for (let i = 0; i < ARCADE_STAGES - 1; i++) winAndContinue('next');
      Game.state = GS.ROUND_END; Game.match.matchOver = true; Game.match.matchWinner = 0; Game.onMatchEnd();
      const d = Game.resultsData;
      const cleared = d.cleared && d.continues === 1 && d.newBest && d.buttons[0] === 'again' && Progress.d.arcadeFewestContinues === 1;
      Game.state = GS.RESULTS; Game.resultsAction('again');
      const fresh = Game.run.stage === 0 && Game.run.continues === 0;
      Game.quitToMenu();
      restoreProgress(saved);
      return levels && shifted && cleared && fresh ? true : JSON.stringify({ levels, shifted, cleared, fresh });
    });
    test('Arcade: a save from before the fewest-continues record shows no record instead of -1', () => {
      const saved = keepProgress();
      Store.set(KEY_PROGRESS, JSON.stringify({ arcadeClears: 2, arcadeBest: 5, wins: 12, losses: 3 }));
      Progress.init();
      const old = UI.modeRecord('arcade');
      Progress.d.arcadeFewestContinues = 0;
      const fresh = UI.modeRecord('arcade');
      restoreProgress(saved);
      const ok = !old.includes('-1') && !old.includes('fewest') && old.includes('Cleared 2') && fresh.includes('fewest continues 0');
      return ok ? true : JSON.stringify({ old, fresh });
    });
    test('Arcade: a retry from the pause menu uses a continue and counts as a loss', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const saved = keepProgress();
      Progress.d = Progress.fresh();
      Game.selection.player = 'kai';
      Game.chooseMode('arcade'); Game.startFromSelection();
      winAndContinue('next');
      Game.state = GS.FIGHT; Game.pause();
      const labelled = UI.dom.screens.textContent.includes('Retry (uses a continue)');
      Game.restartMatch();
      const charged = Game.run.stage === 1 && Game.run.continues === 1 && Progress.d.losses === 1 && Progress.d.wins === 1;
      Game.quitToMenu();
      restoreProgress(saved);
      return labelled && charged ? true : JSON.stringify({ labelled, charged });
    });
    /* ----- character creator ----- */
    const keepCustoms = () => ({ raw: Store.get(KEY_CUSTOM), slots: CustomRoster.slots.slice() });
    const restoreCustoms = (saved) => {
      if (saved.raw === null) Store.remove(KEY_CUSTOM); else Store.set(KEY_CUSTOM, saved.raw);
      CustomRoster.slots = saved.slots;
      CustomRoster.register();
    };
    const tempProfile = (custom) => { ROSTER_BY_ID.ctest = Object.assign(customProfile(custom, 0), { id: 'ctest' }); return ROSTER_BY_ID.ctest; };
    test('Creator: share code and storage round-trip', () => {
      const saved = keepCustoms();
      try {
        const original = validateCustom(randomCustom(12345)).value;
        const code = encodeCustom(original);
        const decoded = decodeCustom(code, true);
        const sameCode = decoded.ok && JSON.stringify(decoded.value) === JSON.stringify(original) && code.length <= SHARE_MAX_LENGTH;
        CustomRoster.slots = new Array(CUSTOM_SLOTS).fill(null);
        CustomRoster.put(3, original);
        CustomRoster.init();
        const stored = !!CustomRoster.slots[3] && JSON.stringify(CustomRoster.slots[3]) === JSON.stringify(original) && !!ROSTER_BY_ID.c4 && ROSTER_BY_ID.c4.name === original.name;
        return sameCode && stored ? true : 'code ' + sameCode + ' stored ' + stored + ' ' + (decoded.error || '');
      } finally { restoreCustoms(saved); }
    });
    test('Creator: import rejects malformed, oversized, tampered and out-of-range codes', () => {
      const good = encodeCustom(defaultCustom(0));
      const parts = /^BP1-(.+)-([0-9a-z]+)$/.exec(good);
      const fields = JSON.parse(fromBase64Url(parts[1]));
      const forge = (edit) => { const copy = fields.slice(); edit(copy); const p = toBase64Url(JSON.stringify(copy)); return 'BP1-' + p + '-' + shareChecksum(p); };
      const attrAt = 5, scaleAt = 5 + ATTR_KEYS.length + SHARE_LOOK_KEYS.length, colorAt = scaleAt + 2;
      const flipped = parts[1].slice(0, 10) + (parts[1][10] === 'A' ? 'B' : 'A') + parts[1].slice(11);
      const bad = [
        ['empty', ''], ['garbage', 'hello world'], ['oversized', 'BP1-' + 'A'.repeat(600) + '-abc'], ['tampered', 'BP1-' + flipped + '-' + parts[2]],
        ['not json', (() => { const p = toBase64Url('{oops'); return 'BP1-' + p + '-' + shareChecksum(p); })()],
        ['field count', forge((c) => c.push(1))], ['attribute 10', forge((c) => { c[attrAt] = 10; })], ['attribute 1', forge((c) => { c[attrAt] = 1; })],
        ['over budget', forge((c) => { for (let i = 0; i < 8; i++) c[attrAt + i] = 9; })], ['height', forge((c) => { c[scaleAt] = 200; })],
        ['colour', forge((c) => { c[colorAt] = 'zzzzzz'; })], ['name', forge((c) => { c[1] = 'bad name'; })], ['option index', forge((c) => { c[attrAt + 8] = 99; })],
        ['version', forge((c) => { c[0] = 7; })], ['not a string', 42],
      ];
      for (const [label, code] of bad) {
        let r;
        try { r = decodeCustom(code, true); } catch (e) { return label + ' threw ' + e.message; }
        if (r.ok) return label + ' was accepted';
      }
      const veteranCode = forge((c) => { c[4] = 1; c[attrAt] = 8; c[attrAt + 1] = 8; });
      const locked = decodeCustom(veteranCode, false), unlocked = decodeCustom(veteranCode, true);
      return !locked.ok && unlocked.ok && decodeCustom(good, false).ok ? true : 'veteran gate ' + locked.ok + ' / ' + unlocked.ok;
    });
    test('Creator: point budget and attribute limits', () => {
      const attrs = Object.assign({}, ARCHETYPES.balanced.attrs);
      const rules = !canSetAttr(attrs, 'health', 7, POINT_BUDGET) && canSetAttr(attrs, 'health', 7, VETERAN_BUDGET) && !canSetAttr(attrs, 'speed', 10, VETERAN_BUDGET) &&
        !canSetAttr(attrs, 'speed', 1, POINT_BUDGET) && canSetAttr(attrs, 'speed', 5, POINT_BUDGET) && !canSetAttr(attrs, 'magic', 5, POINT_BUDGET);
      // points above ATTR_KNEE cost double: 8 costs 9 and 9 costs 11, so 9 health no longer fits a veteran balanced build
      const knee = attrCost(ATTR_KNEE) === ATTR_KNEE && attrCost(8) === 9 && attrCost(9) === 11 && canSetAttr(attrs, 'health', 8, VETERAN_BUDGET) && !canSetAttr(attrs, 'health', 9, VETERAN_BUDGET);
      const c = defaultCustom(0);
      c.attrs.health = 7;
      const over = validateCustom(c).ok;
      c.tier = 'veteran'; c.attrs.speed = 7; c.attrs.health = 8;
      const vet48 = attrTotal(c.attrs) === VETERAN_BUDGET && validateCustom(c).ok;
      c.attrs.reach = 6;                                   // costs 49 but only 47 at the old flat price: an old save is trimmed to fit
      const legacy = validateCustom(c);
      const trimmedOld = legacy.ok && attrTotal(legacy.value.attrs) <= VETERAN_BUDGET && legacy.value.attrs.health === 7;
      c.attrs.balance = 7;                                 // over budget even at the flat price: rejected
      const vet49 = validateCustom(c).ok;
      const trimmed = trimToBudget({ health: 9, stamina: 9, strength: 9, speed: 9, reach: 9, defense: 9, balance: 9, recovery: 9 }, POINT_BUDGET);
      const trimOk = attrTotal(trimmed) === POINT_BUDGET && ATTR_KEYS.every((k) => trimmed[k] >= ATTR_MIN && trimmed[k] <= ATTR_MAX);
      const presets = ARCHETYPE_IDS.every((id) => attrTotal(ARCHETYPES[id].attrs) === POINT_BUDGET && ATTR_KEYS.every((k) => ARCHETYPES[id].attrs[k] >= ATTR_MIN && ARCHETYPES[id].attrs[k] <= ATTR_MAX));
      const baseline = attrTotal(ROSTER_BY_ID.kai.attrs) === POINT_BUDGET;
      return rules && knee && !over && vet48 && trimmedOld && !vet49 && trimOk && presets && baseline ? true : JSON.stringify({ rules, knee, over, vet48, trimmedOld, vet49, trimOk, presets, baseline });
    });
    test('Roster: costs stay in a narrow band, ZERO fights as a boss only in Arcade, scaled by the difficulty option', () => {
      const totals = ROSTER.filter((r) => r.id !== 'zero').map((r) => attrTotal(r.attrs));
      const band = Math.min(...totals) === POINT_BUDGET && Math.max(...totals) - Math.min(...totals) <= 2;
      const zero = attrTotal(ROSTER_BY_ID.zero.attrs);
      const bosses = ARCADE_LEVELS.map((level) => attrTotal(ROSTER_BY_ID.zero.bossAttrs[level]));
      const playable = zero >= POINT_BUDGET && zero <= POINT_BUDGET + 2 && bosses.every((total, i) => total > zero && (i === 0 || total >= bosses[i - 1]));
      const arcade = mk({ mode: 'arcade', opponentId: 'zero', arcadeLevel: 'hard' }), arcadeTotal = attrTotal(arcade.fighters[1].stats.attrs);
      arcade.dispose();
      const free = mk({ playerId: 'zero', opponentId: 'zero' });
      const boss = arcadeTotal === bosses[bosses.length - 1] && attrTotal(free.fighters[1].stats.attrs) === zero && free.fighters[0].maxHp === free.fighters[1].maxHp;
      return band && playable && boss ? true : JSON.stringify({ totals, zero, bosses, band, playable, boss });
    });
    test('Arcade: a hard CPU stand-in for the player beats the Normal final boss now and then', () => {
      // ~20-30% over 64-seed sets (3 of these 16); the old 66-point boss won all 24 tried. Few seeds keep the suite fast.
      const stage = ARCADE_STAGES - 1, firstSeed = 1000, matches = 16, maxTicks = 40000;
      let wins = 0;
      for (let seed = firstSeed; seed < firstSeed + matches; seed++) {
        const m = track(new MatchSim({ mode: 'arcade', countdown: false, playerId: 'kai', opponentId: 'zero', arenaId: ARCADE_ARENAS[stage], difficulty: arcadeDifficulty(stage, 'normal'), arcadeLevel: 'normal', seed, items: false, hazards: false }));   // a balance measure of the bare-handed boss in a bare arena: items and hazards (P7) change who wins it
        m.controllers[0] = new AIController(ROSTER_BY_ID.kai, 'hard');
        for (let i = 0; i < maxTicks && m.phase !== 'matchEnd'; i++) { m.step(); if (m.phase === 'waiting') m.startRound(); }
        if (m.matchWinner === 0) wins++;
        m.dispose();
      }
      return wins >= 2 ? true : 'won ' + wins + ' of ' + matches;
    });
    test('Creator: every hair, face and outfit option renders', () => {
      const push = R.push;
      let count = 0;
      R.push = function countPart() { count++; };
      const partsFor = (look) => {
        const custom = defaultCustom(0);
        custom.look = Object.assign(custom.look, look);
        const f = new Fighter(customProfile(custom, 0), 0);
        count = 0;
        f.skeleton(0, 0, 0, 0, true);
        const finitePts = Array.from(f.pts).every(Number.isFinite);
        return finitePts ? count : -1;
      };
      let problem = '', most = 0;
      try {
        for (const key of LOOK_CHOICE_KEYS.concat(LOOK_ITEM_KEYS)) {
          for (const option of LOOK_CHOICES[key].options) {
            const n = partsFor({ [key]: option });
            if (n < 20) problem = key + '=' + option + ' drew ' + n;
            most = Math.max(most, n);
          }
        }
        for (const extreme of [{ scale: SCALE_MIN, build: BUILD_MIN }, { scale: SCALE_MAX, build: BUILD_MAX }]) if (partsFor(extreme) < 20) problem = 'extreme body';
        most = Math.max(most, partsFor({ hairStyle: 'braids', brows: 'thick', beard: 'full', mask: 'half', headband: 'band', topStyle: 'gi', belt: 'sash', age: AGE_MAX }));
        for (const r of ROSTER) { const f = new Fighter(r, 0); count = 0; f.skeleton(0, 0, 0, 0, true); if (count < 24 || count > 29) problem = r.id + ' drew ' + count; }
      } catch (e) { problem = 'exception ' + e.message; }
      R.push = push;
      const zero = resolveLook(ROSTER_BY_ID.zero.look);
      return !problem && most <= 40 && zero.mask === 'full' && zero.hairStyle === 'bald' ? true : problem || 'max parts ' + most;
    });
    /* ---------- customization items (P6-02) ---------- */
    const ITEM_KEYS = Object.keys(NEW_ITEMS), PIECE_KEYS = ['hairStyle', 'beard', 'mask', 'acc', 'mark'];
    const itemBodies = [[SCALE_MIN, 0, 0, 'F'], [SCALE_MAX, 1, 1, 'M', AGE_MAX], [SCALE_MIN, 1, 1, 'N'], [SCALE_MAX, 0, 0, 'N'], [1, 0, 1, 'F'], [1, 1, 0, 'M'], [SCALE_MIN, 0, 1, 'M'], [SCALE_MAX, 1, 0, 'F']]
      .map(([scale, weight, muscle, gender, age]) => ({ scale, weight, muscle, gender, age: age || AGE_DEFAULT, build: presetBuild([muscle, weight]) }));   // height, weight, muscle and gender extremes; age 70 leans the torso
    const itemFighter = (body, extra) => { const c = defaultCustom(0); Object.assign(c.look, body, extra); return new Fighter(customProfile(c, 0), 0); };
    const drawnParts = (f, pose) => {   // what one skeleton pass draws: [emissive, matrix finite, mesh, matrix]
      const push = R.push, list = [];
      R.push = function (layer, mesh, m, col, a, em) { list.push([em, Array.from(m).every(Number.isFinite), mesh, Float32Array.from(m)]); };
      try { if (pose) f.pose.set(pose); f.skeleton(0, 0, 0, 0.4, true); } finally { R.push = push; }
      return list;
    };
    let poseCache = null;
    const previewPoses = () => {   // the Pose button's four poses, driven as the preview drives them
      if (poseCache) return poseCache;
      const keep = Showcase.previewPose, driver = itemFighter(itemBodies[0], {}), steps = { guard: 12, punch: ATTACKS.cross.startup + 2, kick: ATTACKS.roundhouse.startup + 2, victory: 40 };
      poseCache = {};
      try {
        for (const name of PREVIEW_POSES) {
          Showcase.setPreviewPose(name); driver.pose.set(driver.motion.guard);
          for (let i = 0; i < steps[name]; i++) { Showcase.drivePreview(driver, 1 / 60); driver.animate(1 / 60); }
          poseCache[name] = Float32Array.from(driver.pose);
        }
      } finally { Showcase.setPreviewPose(keep); }
      return poseCache;
    };
    test('Items: 91 items in 9 slots have rows and labels, old indices stay, no sci-fi or fantasy words', () => {
      const bad = [], words = /\b(ghost|dragon|demon|wizard|magic|laser|plasma|alien|robot|cyborg|armou?r|cape|horns?|wings?|neon|glow|ninja|samurai|helmet)\b/i, colours = Object.keys(new Fighter(ROSTER_BY_ID.kai, 0).col);
      const total = ITEM_KEYS.reduce((sum, key) => sum + LOOK_CHOICES[key].options.length, LOOK_CHOICES.headband.options.length - 1);   // None counts once per slot
      const kept = ['hairStyle', 'beard', 'mask', 'topStyle', 'legs', 'hands', 'feet'].map((key) => LOOK_CHOICES[key].options.slice(0, LOOK_CLASSIC[key].length)).join('|');
      if (total !== 91 || kept !== 'short,ponytail,long,mohawk,bald,afro,topknot,braids,buzz,sideswept|none,stubble,goatee,full|none,half,full|bare,tank,tee,gi|shorts,pants|gloves,wraps|shoes,boots,barefoot') bad.push(total + ' ' + kept);
      for (const key of ITEM_KEYS) for (const id of LOOK_CHOICES[key].options) {
        const row = ITEMS[key][id], label = LOOK_CHOICES[key].labels[id];
        if (!label || words.test(label) || (!row && !['none', 'half', 'full'].includes(id))) bad.push(key + ' ' + id);
        for (const p of (key === 'topStyle' ? row[6] : key === 'legs' ? row[5] : PIECE_KEYS.includes(key) ? row : 0) || []) {
          if (!'htuwxl'.includes(p[0]) || ![CB, SP, CY].includes(p[1]) || !p.slice(2, 8).every(Number.isFinite) || !colours.includes(p[8]) || p[11] & ~3) bad.push(key + ' ' + id + ' piece');
        }
      }
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    test('Items: every item draws finite, matte parts (20 to 40) on every body type in every creator preview pose', () => {
      const bad = [], poses = previewPoses();
      if (['punch', 'kick', 'victory'].some((name) => !poses[name].some((v, n) => Math.abs(v - poses.guard[n]) > 0.2))) bad.push('poses do not differ');
      for (const body of itemBodies) {
        const f = itemFighter(body, {});
        for (const key of ITEM_KEYS) for (const id of LOOK_CHOICES[key].options) {
          f.applyLook(Object.assign({}, f.look, { [key]: id }));
          for (const name of PREVIEW_POSES) {
            const list = drawnParts(f, poses[name]);   // the old full mask still glows (P9-04)
            if (list.length < 20 || list.length > 40 || list.some(([em, ok]) => !ok || (em && id !== 'full'))) { bad.push(key + '=' + id + ' ' + name + ' ' + list.length); break; }
          }
        }
      }
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    test('Items: no clipping - garments, shoes, gloves, headwear, hair and marks keep clear of the body on every body type', () => {
      const bad = [], no = (what) => { if (bad.length < 8) bad.push(what); };
      const holds = (p, x, y, z) => {   // is the point inside the piece (axis aligned, tilt ignored)
        const dx = x - p[2], dy = y - p[3], dz = z - p[4], hx = p[5] / 2, hy = p[6] / 2, hz = p[7] / 2;
        if (p[1] === SP) return (dx / hx) ** 2 + (dy / hy) ** 2 + (dz / hz) ** 2 < 1;
        return p[1] === CY ? (dx / hx) ** 2 + (dz / hz) ** 2 < 1 && Math.abs(dy) < hy : Math.abs(dx) < hx && Math.abs(dy) < hy && Math.abs(dz) < hz;
      };
      const mirrored = (list) => list.flatMap((p) => (p[11] & 1 && p[0] === 'h' ? [p, Object.assign(p.slice(), { 2: -p[2] })] : [p]));
      const head = (key, id) => mirrored((ITEMS[key][id] || []).filter((p) => p[0] === 'h')), fresh = (key, id) => LOOK_CHOICES[key].options.indexOf(id) >= (LOOK_CLASSIC[key] || ['none']).length;
      const [hx, hy, hz] = BODY.head.map((v) => v / 2), onHead = (phi, theta) => [hx * Math.sin(phi) * Math.cos(theta), BODY.headY + hy * Math.cos(phi), hz * Math.sin(phi) * Math.sin(theta)];
      const eyes = []; for (const x of [0.03, 0.05, 0.07, -0.03, -0.05, -0.07]) eyes.push([x, 0.22, 0.125], [x, 0.252, 0.119]);   // front of each eye and brow
      for (const key of PIECE_KEYS) for (const id of Object.keys(ITEMS[key])) {   // the face stays visible (sunglasses, glasses and the eyebrow scar are meant to sit there)
        if (fresh(key, id) && !['shades', 'glasses', 'browscar'].includes(id) && head(key, id).some((p) => eyes.some((pt) => holds(p, ...pt)))) no(id + ' covers the face');
      }
      const crown = [];   // head surface points: the crown and the back of the head
      for (const phi of [0, 0.3, 0.6]) for (let k = 0; k < 8; k++) crown.push(onHead(phi, k * Math.PI / 4));
      for (const theta of [1.25, 1.5, 1.75]) crown.push(onHead(Math.acos(0.64), theta * Math.PI));
      for (const id of Object.keys(ITEMS.mask)) if (id !== 'balaclava' && !crown.every((pt) => head('mask', id).some((p) => holds(p, ...pt)))) no(id + ' leaves the head uncovered');   // the balaclava colours the head itself
      for (const id of LOOK_CHOICES.hairStyle.options.slice(LOOK_CLASSIC.hairStyle.length)) if (ITEMS.hairStyle[id][0] !== HAIR_CAP) {   // the headband ring clears the new hair that has no cap
        for (let k = 0; k < 12; k++) if (head('hairStyle', id).some((p) => holds(p, (headbandSize(id) / 2 - 0.003) * Math.cos(k * Math.PI / 6), 0.255, -0.008 + (headbandSize(id) / 2 - 0.003) * Math.sin(k * Math.PI / 6)))) { no('headband sinks into ' + id); break; }
      }
      for (const id of ['chain', 'scarf']) { const p = ITEMS.acc[id][0]; if (Math.abs(p[3] - BODY.neckY) > 0.07 || p[5] < 0.12) no(id + ' is not round the neck'); }
      const sleeve = ITEMS.mark.sleeve[0][5] + 0.0035, band = ITEMS.mark.forearm[0][5] + 0.0035;   // ink on the arm sits under every sleeve
      for (const [id, T] of Object.entries(ITEMS.topStyle)) {   // garments are as wide as the body, hems cover the belt and stop above the thigh
        if (T[0] < 1 || T[1] < 1 || (T[2] && T[2] < BODY.ball) || (T[3] && T[3] < Math.max(BODY.upper + 0.005, sleeve)) || (T[4] && T[4] < Math.max(BODY.fore + 0.005, band)) || (T[5] && (T[5][0] < 0.365 || T[5][3] < 0.235 || T[5][1] - T[5][2] / 2 < -0.2))) no('top ' + id);
      }
      for (const [id, L] of Object.entries(ITEMS.legs)) {   // a full-length leg is wider than the bare one and the knee; a short overlay stays on the thigh; pockets and stripes sit on its surface
        if (L[2] ? L[2] < BODY.thigh + 0.02 || L[4] + L[3] / 2 > 0.02 || L[4] - L[3] / 2 < -0.44 : L[0] < BODY.thigh || L[1] < BODY.knee) no('legs ' + id);
        for (const p of L[5] || []) if (p[2] + p[5] / 2 < L[0] / 2 + 0.003 || p[2] - p[5] / 2 > L[0] / 2 - 0.003) no('legs ' + id + ' piece');
      }
      const foot = ITEMS.feet.barefoot;   // a shoe is around the bare foot, a tall one as wide as the shin
      for (const [id, F] of Object.entries(ITEMS.feet)) {
        if (F[0] < foot[0] || F[2] - F[1] / 2 > foot[2] - foot[1] / 2 + 1e-9 || F[3] - F[4] / 2 > foot[3] - foot[4] / 2 + 1e-9 || F[3] + F[4] / 2 < foot[3] + foot[4] / 2 - 1e-9 || (F[2] + F[1] / 2 > 0.03 && F[0] < BODY.shin + 0.005)) no('feet ' + id);
      }
      for (const body of itemBodies) {   // per body: hands cover the sleeve ends, new hair stays off the torso, marks and accessories touch the body
        const f = itemFighter(body, {}), b = f.build, sh = f.shape, who = ' (' + body.gender + body.muscle + body.weight + ')';
        for (const [id, H] of Object.entries(ITEMS.hands)) for (const [tid, T] of Object.entries(ITEMS.topStyle)) {   // the hand's cut at the wrist plane, BODY.handY from its centre
          const hs = handScale(b, sh, T, H), cut = Math.sqrt(1 - (BODY.handY / (H[1] * hs / 2)) ** 2);
          if (T[4] && Math.min(H[0], H[2]) * hs / 2 * cut < T[4] * b * sh.arm / 2) no('hand ' + id + ' under ' + tid + ' sleeve' + who);
          if (!T[4] && hs !== b) no('hand ' + id + ' grows without a sleeve');
        }
        const torso = (x, y, z, td) => (Math.abs(x) < BODY.torso[0] / 2 * b * sh.chest && Math.abs(y - BODY.torsoY) < BODY.torso[1] / 2 && Math.abs(z) < BODY.torso[2] / 2 * td * b)
          || (x / (BODY.chest[0] / 2 * b * sh.chest)) ** 2 + ((y - BODY.chestY) / (BODY.chest[1] / 2)) ** 2 + ((z - BODY.chestZ) / (BODY.chest[2] / 2 * b)) ** 2 < 1;
        const neck = (x, y, z, mid) => x * x + z * z < (BODY.neck / 2) ** 2 && Math.abs(y - mid) < BODY.neck / 2, rad = (frame) => (frame === 'u' ? BODY.upper : BODY.fore) / 2 * b * sh.arm, len = (frame) => (frame === 'u' ? BODY.upperLen : BODY.foreLen) / 2;
        const inBody = (frame, x, y, z, td) => frame === 'h' ? (x / hx) ** 2 + ((y - BODY.headY) / hy) ** 2 + (z / hz) ** 2 < 1 || neck(x, y, z, BODY.neckY) || torso(x, y + BODY.neckBase, z, td)
          : frame === 't' ? torso(x, y, z, td) || neck(x, y, z, BODY.neckBase + BODY.neckY)
          : frame === 'x' ? (x / (BODY.hand / 2 * b)) ** 2 + ((y + BODY.handY) / (BODY.hand / 2 * b)) ** 2 + ((z - 0.01) / (BODY.hand / 2 * b)) ** 2 < 1
          : x * x + z * z < rad(frame) ** 2 && Math.abs(y + len(frame)) < len(frame);
        const samples = (p) => {   // 27 points of a piece in body coordinates: centre, faces, edges and corners (pulled onto the surface of a sphere or cylinder)
          const [wx, wz] = frameScale(p[0], b, sh, b), out = [];
          for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) for (const l of [-1, 0, 1]) {
            const n = [1, Math.hypot(i, j, l), Math.hypot(i, l)][p[1]] || 1;
            out.push([(p[2] + i * p[5] / 2 / n) * wx, p[3] + j * p[6] / 2 / (p[1] === SP ? n : 1), (p[4] + l * p[7] / 2 / n) * wz]);
          }
          return out;
        };
        for (const id of LOOK_CHOICES.hairStyle.options.slice(LOOK_CLASSIC.hairStyle.length)) for (const p of mirrored(ITEMS.hairStyle[id])) if (samples(p).some(([x, y, z]) => torso(x, y + BODY.neckBase, z, 1))) no('hair ' + id + ' enters the torso' + who);
        const touches = (what, p, td) => { const inside = samples(p).filter(([x, y, z]) => inBody(p[0], x, y, z, td)).length; if (!inside || inside === 27) no(what + (inside ? ' is buried' : ' floats') + who); };
        for (const key of ['mask', 'acc', 'mark']) for (const id of Object.keys(ITEMS[key])) for (const p of ITEMS[key][id]) touches(key + ' ' + id, p, 1);
        for (const [id, T] of Object.entries(ITEMS.topStyle)) for (const p of T[6] || []) touches('top ' + id, p, T[1]);
      }
      return bad.length ? bad.join('; ') : true;
    });
    test('Items: in the preview poses a hem cuts the thigh no more than the gi does; the backpack and towel never cut the upper arm', () => {
      const poses = previewPoses(), bad = [], axis = (m, o) => Math.hypot(m[o], m[o + 1], m[o + 2]);
      const inside = (q, x, y, z) => [0, 4, 8].every((o) => Math.abs(((x - q[3][12]) * q[3][o] + (y - q[3][13]) * q[3][o + 1] + (z - q[3][14]) * q[3][o + 2]) / axis(q[3], o) ** 2) < 0.5);
      const find = (list, mesh, dims, sc) => list.filter((q) => q[2] === mesh && dims.every((v, n) => Math.abs(axis(q[3], n * 4) - v * sc) < 1e-5));
      const surface = (q) => { const out = [], m = q[3]; for (let k = 0; k < 8; k++) for (const y of [-0.4, -0.2, 0, 0.2]) { const x = 0.5 * Math.cos(k * Math.PI / 4), z = 0.5 * Math.sin(k * Math.PI / 4); out.push([0, 1, 2].map((r) => m[r] * x + m[r + 4] * y + m[r + 8] * z + m[r + 12])); } return out; };
      const cut = (f, extra, pose, box, cyl) => {   // points on the cylinder parts that lie inside the box parts
        f.applyLook(Object.assign({}, f.look, extra));
        const list = drawnParts(f, pose), boxes = find(list, CB, box, f.scale);
        return find(list, CY, cyl, f.scale).reduce((sum, q) => sum + surface(q).filter(([x, y, z]) => boxes.some((r) => inside(r, x, y, z))).length, 0);
      };
      for (const body of [itemBodies[1], itemBodies[4]]) {
        const f = itemFighter(body, {}), b = f.build, sh = f.shape, thigh = BODY.thigh * b * sh.leg, arm = BODY.upper * b * sh.arm, [wx, wz] = frameScale('t', b, sh, b);
        for (const name of PREVIEW_POSES) {
          const hem = (top) => { const h = ITEMS.topStyle[top][5]; return cut(f, { topStyle: top }, poses[name], [h[0] * b * sh.hip, h[2], h[3] * b], [thigh, THIGH, thigh]); }, gi = hem('gi');
          for (const top of ['jersey', 'bomber', 'leather']) if (hem(top) > gi) bad.push(top + ' hem cuts the thigh more than the gi in ' + name);
          for (const id of ['backpack', 'towel']) { const p = ITEMS.acc[id][0]; if (cut(f, { acc: id }, poses[name], [p[5] * wx, p[6], p[7] * wz], [arm, BODY.upperLen, arm])) bad.push(id + ' cuts the arm in ' + name); }
        }
      }
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    test('Items: ink is drawn only where no top, sleeve, wrap or glove covers the skin', () => {
      const f = itemFighter({}, {}), bad = [], n = (extra) => { f.applyLook(Object.assign({}, f.look, extra)); return drawnParts(f).length; };
      const cost = (mark, extra) => n(Object.assign({ mark }, extra)) - n(Object.assign({ mark: 'none' }, extra));   // parts the mark adds
      for (const [id, T] of Object.entries(ITEMS.topStyle)) for (const [mark, shown] of [['chest', id === 'bare'], ['sleeve', !T[3]], ['forearm', !T[4]]]) if (cost(mark, { topStyle: id }) !== +shown) bad.push(mark + ' ink on ' + id);
      for (const [id, H] of Object.entries(ITEMS.hands)) for (const [mark, shown] of [['forearm', !H[3]], ['knuckles', H[4] === 'skin']]) if (cost(mark, { topStyle: 'tee', hands: id }) !== +shown) bad.push(mark + ' ink on ' + id);
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    test('Items: the worst combination of items stays within 40 parts', () => {
      const f = itemFighter({}, {}), look = Object.assign(defaultCustom(0).look, { age: AGE_MAX }), count = (extra) => { f.applyLook(Object.assign({}, look, extra)); return drawnParts(f).length; };
      const group = ['hairStyle', 'mask', 'headband', 'beard', 'brows'], options = (key) => LOOK_CHOICES[key].options;
      for (let pass = 0; pass < 2; pass++) for (const key of LOOK_CHOICE_KEYS.concat(LOOK_ITEM_KEYS)) {   // every other slot at the option that draws most
        let top = -1;
        if (!group.includes(key)) for (const id of options(key)) { const n = count({ [key]: id }); if (n > top) { top = n; look[key] = id; } }
      }
      let most = 0;   // hair, headwear, headband, beard and brows depend on each other: try them all
      for (const hairStyle of options('hairStyle')) for (const mask of options('mask')) for (const headband of options('headband')) for (const beard of options('beard')) for (const brows of options('brows')) most = Math.max(most, count({ hairStyle, mask, headband, beard, brows }));
      return most <= 40 && most >= 38 ? true : 'most parts ' + most;
    });
    test('Items: accessory and tattoo / mark share and save; older codes, saves and seeds lose nothing; Randomize draws new items', () => {
      const bad = [], base = validateCustom(randomCustom(4321)).value, items = { hairStyle: 'locs', mask: 'beanie', topStyle: 'hoodie', legs: 'cargo', hands: 'tape', feet: 'work', beard: 'chinstrap', acc: 'backpack', mark: 'eyeblack' };
      if (base.look.acc !== 'none' || base.look.mark !== 'none' || 'acc' in randomCustom(4321).look) bad.push('defaults');
      for (let seed = 1; seed <= 40; seed++) if (LOOK_CHOICE_KEYS.some((key) => !LOOK_CLASSIC[key].includes(randomCustom(seed, true).look[key]))) bad.push('seed ' + seed);
      const set = Object.assign({}, base, { look: Object.assign({}, base.look, items) }), code = encodeCustom(set), fields = JSON.parse(fromBase64Url(code.split('-')[1])), back = decodeCustom(code, true);
      if (!back.ok || JSON.stringify(back.value) !== JSON.stringify(validateCustom(set).value) || fields.length !== SHARE_FIELD_COUNT_FACE || code.length > SHARE_MAX_LENGTH) bad.push('round trip');
      const recode = (list) => { const payload = toBase64Url(JSON.stringify(list)); return decodeCustom(SHARE_PREFIX + '-' + payload + '-' + shareChecksum(payload), true); };
      const older = recode(fields.slice(0, SHARE_FIELD_COUNT_BODY));   // 40 fields: the new slots read none, the new options of the old slots stay
      if (!older.ok || older.value.look.acc !== 'none' || older.value.look.mark !== 'none' || older.value.look.hairStyle !== 'locs') bad.push('40-field code');
      for (const value of [99, -1, 1.5]) for (const at of [SHARE_FIELD_COUNT_BODY, SHARE_FIELD_COUNT_BODY + 1]) { const copy = fields.slice(); copy[at] = value; if (recode(copy).ok) bad.push('accepted ' + value); }
      const noItems = JSON.parse(JSON.stringify(set)); delete noItems.look.acc; delete noItems.look.mark;   // a save from before the slots
      if (!validateCustom(noItems).ok || validateCustom(Object.assign({}, set, { look: Object.assign({}, set.look, { acc: 'sword' }) })).ok) bad.push('save');
      const seen = { acc: 0, mark: 0, hairStyle: 0, topStyle: 0 }, f = itemFighter({}, {});
      for (let seed = 1; seed <= 200; seed++) {   // Randomize: new items from a stream of their own
        const look = randomItems(seed), fighter = randomCustom(seed, true);
        for (const key of Object.keys(seen)) if (look[key] !== undefined && look[key] !== 'none') seen[key]++;
        const r = validateCustom(Object.assign(fighter, { look: Object.assign(fighter.look, randomBody(seed), look) }));
        if (!r.ok) bad.push('randomized ' + seed + ' ' + r.error); else { f.applyLook(r.value.look); if (drawnParts(f).length > 40) bad.push('parts ' + seed); }
      }
      if (Object.values(seen).some((n) => n < 20)) bad.push('spread');
      const keep = { draft: CreatorUI.draft, say: UI.say, rerender: UI.rerender };
      UI.say = () => {}; UI.rerender = () => {};
      try {
        const d = CreatorUI.draft = defaultCustom(0);
        if (!CreatorUI.tab_outfit().includes('data-cr="choice:acc"') || !CreatorUI.tab_head().includes('data-cr="choice:mark"')) bad.push('rows missing');
        d.look.mask = 'beanie'; d.look.headband = 'band';
        if (!CreatorUI.tab_head().includes('hidden by hat')) bad.push('headband row');
        for (let n = 0; n < LOOK_CHOICES.acc.options.length; n++) CreatorUI.cycleChoice('acc', 1);
        if (d.look.acc !== 'none') bad.push('cycle');
      } catch (e) { bad.push(e.message); } finally { CreatorUI.draft = keep.draft; UI.say = keep.say; UI.rerender = keep.rerender; Showcase.endPreview(); }
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    /* ---------- pre-drawn faces and the face texture (P6-07, P6-08) ---------- */
    const faceParts = (look, ready) => {   // one skeleton pass with the face texture forced on / off: [emissive, cast slot, layer, matrix finite]
      const push = R.push, ok = R.faceOk, list = [];
      R.faceOk = ready;
      R.push = function (layer, mesh, m, col, a, em, rough, flash, cast) { list.push({ em, cast, layer, finite: Array.from(m).every(Number.isFinite) }); };
      try { itemFighter({}, look).skeleton(0, 0, 0, 0.4, true); } finally { R.push = push; R.faceOk = ok; }
      return list;
    };
    const fakeGl = (fail) => new Proxy({}, { get: (_, key) => (key === 'getError' ? () => 0 : key === 'NO_ERROR' ? 0 : key === 'texImage2D' && fail ? () => { throw new Error('no texture'); } : () => ({})) });
    test('Faces: 24 pre-drawn faces draw one matte shell; with no texture, or a mask over the eyes, the procedural face stays', () => {
      const bad = [], ids = LOOK_CHOICES.face.options.slice(1), size = (look) => faceParts(look, true).length, shells = (look, ready = true) => faceParts(look, ready).filter((p) => p.cast < 0).length;
      if (ids.length !== 24 || new Set(FACE_ROWS).size !== 24 || FACE_ROWS.some((row) => !/^\d{20}$/.test(row))) bad.push('rows');
      if (!FaceTex.upload(fakeGl(false)) || FaceTex.upload(fakeGl(true)) !== null) bad.push('upload');
      if (!FaceTex.put(FACE_GRID * FACE_GRID - 1, document.createElement('canvas')) || !FaceTex.dirty || (FaceTex.upload(fakeGl(false)) && FaceTex.dirty) || FaceTex.put(FACE_GRID * FACE_GRID, {}) || FaceTex.put(-1, {})) bad.push('put');
      for (const brows of ['thin', 'none']) ids.forEach((face, n) => {
        const list = faceParts({ brows, face }, true);
        if (list.filter((p) => p.cast === -1 - n && p.layer === LAYER.SOLID).length !== 1 || list.length >= size({ brows }) || list.some((p) => p.em !== 0 || !p.finite)) bad.push(face);
      });
      if (shells({ face: 'f5' }, false) || shells({ face: 'f5' }, !!FaceTex.upload(fakeGl(true)))) bad.push('fallback');
      for (const [mask, shown] of [['full', 0], ['balaclava', 0], ['half', 1], ['cap', 1], ['headgear', 1]]) if (shells({ face: 'f5', mask }) !== shown || (!shown && size({ face: 'f5', mask }) !== size({ mask }))) bad.push(mask);
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    test('Faces: every face is painted into the atlas and, on a real GL context, into the uploaded texture (not blank)', () => {
      const size = FACE_GRID * FACE_CELL, sources = [], bad = [];
      if (FaceTex.build()) { const texels = FaceTex.ctx.getImageData(0, 0, size, size).data; if (texels.length) sources.push(['canvas', texels]); }   // headless: no real canvas, nothing to read
      const gl = R.gl;
      if (gl && R.ok && R.faceOk && R.faceTex) {   // read the uploaded texture back through a framebuffer
        const fbo = gl.createFramebuffer(), texels = new Uint8Array(size * size * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.faceTex, 0);
        gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, texels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fbo);
        sources.push(['texture', texels]);
      }
      for (const [name, texels] of sources) for (let cell = 0; cell < FACE_ROWS.length; cell++) {
        let drawn = 0;
        for (let y = 0; y < FACE_CELL; y++) for (let x = 0; x < FACE_CELL; x++) if (texels[((Math.floor(cell / FACE_GRID) * FACE_CELL + y) * size + (cell % FACE_GRID) * FACE_CELL + x) * 4 + 3] > 16) drawn++;
        if (drawn < FACE_MIN_TEXELS) bad.push(name + ' f' + cell + ' ' + drawn);
      }
      return bad.length ? 'blank faces: ' + bad.slice(0, 4).join('; ') : true;
    });
    test('Faces: R.faceOk follows the upload (a texture that cannot be made turns the faces off, a rebuild brings them back)', () => {
      const keys = ['gl', 'prog', 'u', 'meshes', 'batches', 'faceTex', 'faceOk'], saved = keys.map((key) => R[key]), got = [];
      try { for (const fail of [false, true, false]) { R.gl = fakeGl(fail); R.buildGL(); got.push(R.faceOk); } } finally { keys.forEach((key, n) => { R[key] = saved[n]; }); }
      return got.join() === 'true,false,true' ? true : 'faceOk ' + got.join();
    });
    test('Faces: no brow of the 24 faces reaches under the hair cap', () => {
      const [, , , capY, capZ, capW, capH, capD] = HAIR_CAP, under = (nx, ny) => {   // is this head-front point (face units) covered by the cap
        const v = 1 - (nx * 0.115 / (capW / 2)) ** 2 - ((0.2 + ny * 0.125 - capY) / (capH / 2)) ** 2;
        return v > 0 && capZ + capD / 2 * Math.sqrt(v) > 0.12 * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      };
      const bad = FACE_ROWS.map((row, n) => {
        const [spread, eyeY, , , , , gap, thick, tilt, length] = FaceTex.decode(row), dx = Math.cos(tilt) * length / 2, dy = Math.sin(tilt) * length / 2, top = eyeY + gap + thick / 2;
        return [[spread - dx, top - dy], [spread, top], [spread + dx, top + dy]].some(([x, y]) => under(x, y)) ? 'f' + n : '';
      }).filter(Boolean);
      return bad.length ? 'under the hair: ' + bad.join() : true;
    });
    test('Faces: the face choice shares and saves; older codes, saves and seeds read Classic; the creator row cycles and shows the fallback', () => {
      const bad = [], base = validateCustom(randomCustom(4321)).value, set = Object.assign({}, base, { look: Object.assign({}, base.look, { face: 'f17' }) });
      if (base.look.face !== 'none' || 'face' in randomCustom(4321).look) bad.push('defaults');
      const code = encodeCustom(set), fields = JSON.parse(fromBase64Url(code.split('-')[1])), back = decodeCustom(code, true);
      if (!back.ok || back.value.look.face !== 'f17' || JSON.stringify(back.value) !== JSON.stringify(validateCustom(set).value) || fields.length !== SHARE_FIELD_COUNT_FACE || code.length > SHARE_MAX_LENGTH) bad.push('round trip');
      const recode = (list) => { const payload = toBase64Url(JSON.stringify(list)); return decodeCustom(SHARE_PREFIX + '-' + payload + '-' + shareChecksum(payload), true); };
      for (const count of [SHARE_FIELD_COUNT_ITEMS, SHARE_FIELD_COUNT_BODY]) { const older = recode(fields.slice(0, count)); if (!older.ok || older.value.look.face !== 'none') bad.push('older code ' + count); }
      const wrong = fields.slice(), noFace = JSON.parse(JSON.stringify(set)); wrong[SHARE_FIELD_COUNT_ITEMS] = 25; delete noFace.look.face;   // a bad index; a save from before the slot
      if (recode(wrong).ok || validateCustom(noFace).value.look.face !== 'none') bad.push('bad index or old save');
      const keep = { draft: CreatorUI.draft, say: UI.say, rerender: UI.rerender, ok: R.faceOk };
      UI.say = () => {}; UI.rerender = () => {};
      try {
        const d = CreatorUI.draft = defaultCustom(0);
        R.faceOk = false;
        if (!CreatorUI.tab_head().includes('data-cr="choice:face"') || !CreatorUI.tab_head().includes('not supported')) bad.push('unsupported row');
        R.faceOk = true;
        if (CreatorUI.tab_head().includes('not supported') || CreatorUI.tab_head().includes('From the face')) bad.push('row');
        CreatorUI.cycleChoice('face', 1);
        if (d.look.face !== 'f0' || !CreatorUI.tab_head().includes('From the face')) bad.push('eyes and brows rows');
        for (let n = 1; n < LOOK_CHOICES.face.options.length; n++) CreatorUI.cycleChoice('face', 1);
        if (d.look.face !== 'none') bad.push('cycle');
      } catch (e) { bad.push(e.message); } finally { CreatorUI.draft = keep.draft; UI.say = keep.say; UI.rerender = keep.rerender; R.faceOk = keep.ok; Showcase.endPreview(); }
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    test('Photo faces: a crop is stored small, only here (no share code), reloads from the save and takes a pool cell', () => {
      const bad = [], jpeg = (n) => 'data:image/jpeg;base64,' + 'A'.repeat(n), canvas = document.createElement('canvas'), slots = CustomRoster.slots;
      const url = FaceTex.encode({ toDataURL: (type, quality) => jpeg(quality > 0.5 ? 9000 : 800) }), stored = (canvas.width = canvas.height = 200, FaceTex.cropToPhoto(canvas, 20, 20, 100));   // the quality steps down; a JPEG in a browser, '' with the headless stub canvas
      if (!url || FaceTex.encode({ toDataURL: () => jpeg(9000) }) || (stored && !PHOTO_URL.test(stored))) bad.push('cap');
      const set = validateCustom(randomCustom(77)).value;
      set.look.face = 'f4'; set.look.photo = url;
      const code = encodeCustom(set), copy = decodeCustom(code, true), over = Object.assign({}, set, { look: Object.assign({}, set.look, { photo: jpeg(PHOTO_MAX_CHARS) }) });
      if (!copy.ok || copy.value.look.face !== 'f4' || 'photo' in copy.value.look || fromBase64Url(code.split('-')[1]).includes('data:image')) bad.push('share code');
      try { CustomRoster.slots = new Array(CUSTOM_SLOTS).fill(null); CustomRoster.loadFrom(JSON.parse(JSON.stringify({ slots: [set, over] }))); if (CustomRoster.slots[0].look.photo !== url || 'photo' in CustomRoster.slots[1].look) bad.push('reload'); } finally { CustomRoster.slots = slots; }
      const keep = { ok: R.faceOk, photos: FaceTex.photos, draft: CreatorUI.draft, say: UI.say, rerender: UI.rerender }, look = { face: 'f4', photo: url };
      UI.say = UI.rerender = () => {};
      try {
        R.faceOk = true; FaceTex.photos = new Map();
        if (FaceTex.cellOf(look) !== 4) bad.push('while decoding');   // not ready: the chosen face
        FaceTex.photos.set(url, { cells: [], row: PHOTO_ROW, photo: canvas });
        const cell = FaceTex.cellOf(look), shells = faceParts(look, true).filter((p) => p.cast < 0);
        if (cell < FACE_POOL_FIRST || cell >= FACE_GRID * FACE_GRID || shells.length !== 1 || shells[0].cast !== -1 - cell) bad.push('cell ' + cell);
        CreatorUI.draft = defaultCustom(0); CreatorUI.crop = { w: 300, h: 200, x: 0, y: 1, z: 1 }; CreatorUI.moveCrop('z', 3);
        const [x, y, side] = CreatorUI.cropRect();
        if (x < 0 || y < 0 || x + side > 300 + 1e-9 || y + side > 200 + 1e-9) bad.push('square');   // the cut stays inside the picture
        R.faceOk = false;
        if (FaceTex.cellOf(look) !== -1 || CreatorUI.tab_head().includes('photo:')) bad.push('no faces');
      } finally { R.faceOk = keep.ok; FaceTex.photos = keep.photos; CreatorUI.crop = null; CreatorUI.draft = keep.draft; UI.say = keep.say; UI.rerender = keep.rerender; Showcase.endPreview(); }
      return bad.length ? bad.join('; ') : true;
    });
    test('Expressions: the face follows fighter state (hurt after a hit, tired, panting, then rested), pool cells stay in range, and a fight is the same with faces on or off', () => {
      const bad = [], f = itemFighter({}, {}), full = f.maxStam, ok = R.faceOk;
      const express = (state, patch) => faceExpression(Object.assign(f, { state, stam: full, exhaust: 0, gotHits: 0, comboShow: 0, comboHits: 0 }, patch));
      [[S.IDLE, {}, 0], [S.HIT, {}, 1], [S.IDLE, { gotHits: 2 }, 1], [S.IDLE, { stam: full * 0.3 }, 2], [S.IDLE, { stam: full * 0.05 }, 3], [S.IDLE, { exhaust: 20 }, 3], [S.IDLE, { comboShow: 5, comboHits: 3 }, 4],
        [S.VICTORY, {}, 5], [S.DEFEAT, {}, 4], [S.KO, {}, 6], [S.IDLE, {}, 0]].forEach(([state, patch, want], n) => { if (express(state, patch) !== want) bad.push('state ' + n); });
      R.faceOk = true;
      const photos = FaceTex.photos, sources = FaceTex.sources, photo = { cells: [], row: PHOTO_ROW, photo: document.createElement('canvas') };
      FaceTex.photos = new Map([['p', photo]]); FaceTex.sources = [];
      try {
        FaceTex.cells.clear(); FaceTex.dirty = false;
        const one = FaceTex.cellOf({ face: 'f7' }, 3);   // a pool paint marks its own cell dirty, nothing else
        if (FaceTex.dirty || FaceTex.cells.size !== 1 || !FaceTex.cells.has(one)) bad.push('dirty cells');
        for (let face = 0; face < FACE_ROWS.length; face++) for (let e = 0; e < FACE_EXPR.length; e++) {   // 24 x 7 requests, and a photo, against 40 pool cells
          const cell = FaceTex.cellOf({ face: 'f' + face }, e);
          if (e ? cell < FACE_POOL_FIRST || cell >= FACE_GRID * FACE_GRID : cell !== face) bad.push('cell f' + face + ' ' + e);
          if (e) FaceTex.slot(photo, e);
        }
        FaceTex.owners.forEach((owner, cell) => { if (cell < FACE_POOL_FIRST || owner.src.cells[owner.expr] !== cell) bad.push('owner ' + cell); });
        for (const src of FaceTex.sources.concat(photo)) (src ? src.cells : []).forEach((cell, expr) => { const owner = FaceTex.owners[cell]; if (cell !== undefined && (!owner || owner.src !== src || owner.expr !== expr)) bad.push('source ' + cell); });   // and the other way round
      } finally { R.faceOk = ok; FaceTex.photos = photos; FaceTex.sources = sources; FaceTex.dirty = true; }
      const play = (faces) => {
        const m = mk({ seed: 5, playerId: 'kai', opponentId: 'mara', arenaId: 'warehouse' }), push = R.push, seen = new Set();
        m.fighters.forEach((x, i) => { m.controllers[i] = new AIController(x.profile, 'hard'); if (faces) x.applyLook(Object.assign({}, x.look, { face: 'f' + (3 + i) })); });
        if (faces) { R.faceOk = true; R.push = () => {}; }
        try { for (let i = 0; i < 1500; i++) { m.step(); if (faces) m.fighters.forEach((x) => { x.skeleton(x.x, x.y, x.z, x.yaw, true); seen.add(faceExpression(x)); }); } } finally { R.push = push; R.faceOk = ok; }
        const result = m.fighters.map((x) => [x.hp, x.stam, x.x, x.z, x.state]).join('|') + m.tick;
        m.dispose();
        return [result, seen];
      };
      const [off] = play(false), [on, seen] = play(true);
      if (off !== on || !seen.has(0) || !seen.has(1)) bad.push('fight differs or no hurt face ' + [...seen]);
      return bad.length ? bad.slice(0, 5).join('; ') : true;
    });
    test('Creator: cosmetics never change the simulation', () => {
      const play = (look, moveStyle) => {
        const custom = defaultCustom(0);
        Object.assign(custom.look, look);
        custom.moveStyle = moveStyle;
        const profile = tempProfile(custom);
        const m = mk({ seed: 9, playerId: 'ctest', opponentId: 'brutus', arenaId: 'warehouse' });
        m.controllers[0] = new AIController(profile, 'hard');
        m.controllers[1] = new AIController(ROSTER_BY_ID.brutus, 'hard');
        self.run(m, 1200);
        const objects = Arena.objects.map((o) => Math.round(o.hp)).join(',');
        const r = [m.fighters[0].hp, m.fighters[1].hp, m.fighters[0].x.toFixed(4), m.fighters[1].z.toFixed(4), objects].join('|');
        m.dispose();
        return r;
      };
      // kickboxer and brawler both play the default attack strings (the other move styles have string overrides, P3-10), so only their motion differs
      const small = play({ scale: SCALE_MIN, build: BUILD_MIN, hairStyle: 'afro', topStyle: 'gi', legs: 'pants', hands: 'wraps' }, 'kickboxer');
      const big = play({ scale: SCALE_MAX, build: BUILD_MAX, hairStyle: 'bald', mask: 'full', feet: 'boots', glow: 'on' }, 'brawler');
      const aged = play({ scale: SCALE_MAX, build: BUILD_MAX, age: AGE_MAX, gender: 'F', muscle: 1 }, 'brawler');   // fitness, age and gender with the same build
      delete ROSTER_BY_ID.ctest;
      return small === big && big === aged ? true : small + ' != ' + big + ' != ' + aged;
    });
    test('Body: fitness picker sets muscle and weight; build, arms and weight class rise; stats stay', () => {
      const keep = { draft: CreatorUI.draft, say: UI.say, rerender: UI.rerender, dom: UI.dom, status: CreatorUI.updateStatus }, problems = [];
      UI.say = () => {}; UI.rerender = () => {}; UI.dom = { screens: { querySelector: () => null } }; CreatorUI.updateStatus = () => {};   // no page, and the real creator's status line stays untouched
      try {
        const d = CreatorUI.draft = defaultCustom(0), stats = JSON.stringify([d.attrs, deriveStats(d.attrs)]), steps = [0, 0.25, 0.5, 0.75, 1];
        const rises = (list) => list.every((v, i) => i === 0 || v >= list[i - 1]) && list[4] > list[0], series = { weight: [], muscle: [], arm: [], weightClass: [] };
        for (const v of steps) { CreatorUI.setFitness(0.5, v, false); series.weight.push(d.look.build); series.weightClass.push(weightClass(customProfile(d, 0))); }
        for (const v of steps) { CreatorUI.setFitness(v, 0.5, false); series.muscle.push(d.look.build); series.arm.push(new Fighter(customProfile(d, 0), 0).shape.arm); }
        if (!Object.values(series).every(rises)) problems.push('not monotone ' + JSON.stringify(series));
        CreatorUI.setFitness(0.5, 0.5, false); CreatorUI.stepFit('weight', 1); CreatorUI.stepFit('muscle', -1);
        if (d.look.weight !== 0.55 || d.look.muscle !== 0.45) problems.push('keyboard step');
        CreatorUI.setFitness(1, 0, true);   // the pointer path
        if (d.look.build !== presetBuild([1, 0])) problems.push('pointer');
        if (!validateCustom(d).ok || JSON.stringify([d.attrs, deriveStats(d.attrs)]) !== stats) problems.push('stats changed');
      } catch (e) { problems.push(e.message); } finally { CreatorUI.draft = keep.draft; UI.say = keep.say; UI.rerender = keep.rerender; UI.dom = keep.dom; CreatorUI.updateStatus = keep.status; Showcase.endPreview(); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Body: age greys, bends and lines the face; gender shapes the body; stats stay', () => {
      const keep = { draft: CreatorUI.draft, say: UI.say, rerender: UI.rerender, push: R.push }, problems = [], base = defaultCustom(0);
      const lookOf = (extra) => Object.assign({}, base.look, extra), fighter = (extra) => new Fighter(customProfile(Object.assign({}, base, { look: lookOf(extra) }), 0), 0);
      const hair = (age) => hexToHsl(resolveLook(lookOf({ age })).colors.hair).l, shape = (extra) => fighter(extra).shape;
      if (hair(AGE_OLD_FROM) !== hair(AGE_MIN) || hair(AGE_DEFAULT) !== hair(AGE_MIN) || !(hair(55) > hair(AGE_MIN) && hair(AGE_MAX) > hair(55))) problems.push('hair');
      if (resolveLook(lookOf({ age: AGE_MAX, hair: '#e8e8f4' })).colors.hair !== '#e8e8f4') problems.push('white hair darkened');
      const headOut = (x, y, z) => (x / 0.115) ** 2 + ((y - 0.2) / 0.125) ** 2 + (z / 0.12) ** 2 > 1, cap = [0, 0.265, -0.015, 0.125, 0.085, 0.125];   // head and hair-cap ellipsoids as drawn (centre, radii)
      const hairOf = { afro: [0, 0.29, -0.025, 0.17, 0.15, 0.165], buzz: [0, 0.25, -0.02, 0.119, 0.095, 0.124] }, m = AGE_MARK, front = m.z + m.depth / 2;
      for (const style of LOOK_CHOICES.hairStyle.options) {   // the mark is in front of the head and not buried in any hair
        const s = hairOf[style] || (ITEMS.hairStyle[style][0] === HAIR_CAP ? cap : null);
        for (const [x, y] of [[m.x, m.y], [m.x - 0.025 * Math.sin(m.tilt), m.y + 0.025 * Math.cos(m.tilt)], [m.x + 0.025 * Math.sin(m.tilt), m.y - 0.025 * Math.cos(m.tilt)]]) {
          if (!headOut(x, y, front) || (s && ((x - s[0]) / s[3]) ** 2 + ((y - s[1]) / s[4]) ** 2 + ((front - s[2]) / s[5]) ** 2 < 1)) problems.push('age mark hidden by ' + style);
        }
      }
      if (shape({ age: 45 }).lean !== 0 || !(shape({ age: 60 }).lean > 0 && shape({ age: 70 }).lean > shape({ age: 60 }).lean)) problems.push('posture');
      const [male, neutral, female] = ['M', 'N', 'F'].map((gender) => shape({ gender }));
      if (male.hip !== 1 || male.chest !== 1 || male.arm !== 1 || !(female.hip > neutral.hip && neutral.hip > 1 && female.chest < neutral.chest && neutral.chest < 1 && female.arm < neutral.arm)) problems.push('gender shape');
      const aged = validateCustom(Object.assign({}, base, { look: lookOf({ age: 66, gender: 'F' }) }));
      if (!aged.ok || JSON.stringify([aged.value.attrs, deriveStats(aged.value.attrs)]) !== JSON.stringify([base.attrs, deriveStats(base.attrs)])) problems.push('stats');
      for (const bad of [{ age: 15 }, { age: 71 }, { age: 30.5 }, { gender: 'X' }, { muscle: 1.2 }, { weight: -0.1 }]) if (validateCustom(Object.assign({}, base, { look: lookOf(bad) })).ok) problems.push('accepted ' + JSON.stringify(bad));
      UI.say = () => {}; UI.rerender = () => {};
      try {
        let count = 0;
        const parts = (age) => { count = 0; R.push = function () { count++; }; fighter({ age }).skeleton(0, 0, 0, 0, true); return count; };
        if (parts(60) !== parts(30) + 2) problems.push('face lines');
        R.push = keep.push;
        const d = CreatorUI.draft = defaultCustom(0), seen = [d.look.gender];
        for (let i = 0; i < 3; i++) { CreatorUI.setGender(1); seen.push(d.look.gender); }
        for (let i = 0; i < 80; i++) CreatorUI.stepBody('age', -1);
        if (seen.join() !== 'M,F,N,M' || d.look.age !== AGE_MIN || !CreatorUI.tab_body().includes('16 years')) problems.push('controls ' + seen + d.look.age);
      } catch (e) { problems.push(e.message); } finally { R.push = keep.push; CreatorUI.draft = keep.draft; UI.say = keep.say; UI.rerender = keep.rerender; Showcase.endPreview(); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Body: share codes round-trip; older codes and saves keep the old body; random seeds stay', () => {
      const problems = [], base = validateCustom(randomCustom(4321)).value, b0 = base.look;
      if (b0.muscle !== 0.5 || b0.age !== AGE_DEFAULT || b0.gender !== 'M' || presetBuild([b0.muscle, b0.weight]) !== b0.build) problems.push('defaults');
      for (let step = 0; step <= 10; step++) { const build = Math.round((BUILD_MIN + step * BUILD_STEP) * 100) / 100; if (presetBuild([0.5, weightFromBuild(build)]) !== build) problems.push('build ' + build); }
      const set = Object.assign({}, base, { look: Object.assign({}, b0, { muscle: 0.85, weight: 0.3, age: 63, gender: 'F' }) });
      const code = encodeCustom(set), back = decodeCustom(code, true), fields = JSON.parse(fromBase64Url(code.split('-')[1]));
      if (!back.ok || JSON.stringify(back.value) !== JSON.stringify(validateCustom(set).value) || fields.length !== SHARE_FIELD_COUNT_FACE) problems.push('round trip');
      const recode = (list) => { const payload = toBase64Url(JSON.stringify(list)); return decodeCustom(SHARE_PREFIX + '-' + payload + '-' + shareChecksum(payload), true); };
      for (const count of [SHARE_FIELD_COUNT, SHARE_FIELD_COUNT_STYLE, SHARE_FIELD_COUNT_DEFENSE]) {   // codes written before the body fields
        const r = recode(fields.slice(0, count));
        if (!r.ok || JSON.stringify(r.value.look) !== JSON.stringify(b0)) problems.push('old code ' + count);
      }
      for (const [offset, value] of [[0, 101], [1, -1], [2, 15], [2, 71], [3, 3], [3, -1], [3, '1'], [3, 1.5]]) { const copy = fields.slice(); copy[SHARE_FIELD_COUNT_BODY - 4 + offset] = value; if (recode(copy).ok) problems.push('accepted ' + offset + '=' + value); }
      const stored = JSON.parse(JSON.stringify(base));   // a fighter saved before these fields existed
      for (const key of ['muscle', 'weight', 'age', 'gender']) delete stored.look[key];
      if (JSON.stringify(validateCustom(stored).value) !== JSON.stringify(base) || 'muscle' in randomCustom(1, true).look) problems.push('old save or randomCustom');
      for (let seed = 1; seed <= 40; seed++) {   // Randomize: fitness, age and gender from their own stream
        const body = randomBody(seed), fighter = randomCustom(seed, true), r = validateCustom(Object.assign(fighter, { look: Object.assign(fighter.look, body) }));
        if (!r.ok || r.value.look.build !== presetBuild([body.muscle, body.weight])) problems.push('random body ' + seed);
      }
      return problems.length ? problems.slice(0, 4).join('; ') : true;
    });
    test('Body: all 32 presets and old customs draw as before (pinned hash, from before the items); new presets carry fitness, age, gender', () => {
      const push = R.push;
      const hashOf = (profile) => {
        let s = '';
        R.push = function (layer, mesh, m, col, a, em, rough, flash) { s += Array.from(m).map((v) => v.toFixed(5)).join() + '|' + Array.from(col).map((v) => v.toFixed(4)).join() + '|' + em + '|' + rough + '|' + flash + ';'; };
        try { const f = new Fighter(profile, 0); f.skeleton(0, 0, 0, 0, true); f.pose.set(GUARD_ORTHO); f.skeleton(1, 0, 2, 0.7, true); } finally { R.push = push; }
        return fnv1a(s) + ':' + s.length;
      };
      const got = ROSTER.map(hashOf).concat([4321, 12345, 777].map((seed) => hashOf(customProfile(validateCustom(randomCustom(seed)).value, 0)))).join();
      const want = '81066718:8668,1744787038:8986,725423470:8343,2806789988:8989,258918353:8664,2636707267:8355,3444275937:8994,1720269438:9005,1404112419:9325,2132749416:8990,3268807863:8996,248662001:8992,576154008:8362,2432004798:8675,1980585122:8667,396875851:8998,3667191336:8988,3733438813:9003,210503239:8683,2281133330:8990,2461573224:8357,110823760:8993,1830273435:8990,1922686389:9001,10529125:8360,1886017806:8996,2671237955:8996,3352423429:8359,1505929842:8358,2793142063:8988,1043793435:8987,3550358532:8679,778913287:10282,3867339228:9323,2999958420:9315';
      const kai = ROSTER_BY_ID.kai, spelled = hashOf(Object.assign({}, kai, { look: Object.assign({}, kai.look, { muscle: 0.5, age: AGE_DEFAULT, gender: 'M' }) }));   // spelled-out defaults draw the same
      const plain = ROSTER.slice(0, 6).every((r) => r.look.muscle === undefined && r.look.age === undefined && r.look.gender === undefined);
      const carried = ROSTER.slice(6).every((r) => r.look.muscle === r.fit[0] && r.look.weight === r.fit[1] && r.look.age === r.age && r.look.gender === r.gender);
      return got === want && spelled === want.split(',')[0] && plain && carried ? true : JSON.stringify({ got, spelled, plain, carried });
    });
    test('Creator: custom fighter finishes an AI match with no illegal transitions', () => {
      const illegal = Diag.illegalTransitions, errors = Diag.errors;
      const profile = tempProfile(validateCustom(randomCustom(777)).value);
      const m = mk({ seed: 21, playerId: 'ctest', opponentId: 'dmitri', winsNeeded: 1, timer: 60 });
      m.controllers[0] = new AIController(profile, 'expert');
      m.controllers[1] = new AIController(ROSTER_BY_ID.dmitri, 'expert');
      let ticks = 0;
      while (!m.matchOver && ticks < 6000) { m.step(); ticks++; }
      delete ROSTER_BY_ID.ctest;
      return m.matchOver && Diag.illegalTransitions === illegal && Diag.errors === errors ? true : 'over ' + m.matchOver + ' ticks ' + ticks + ' illegal ' + (Diag.illegalTransitions - illegal) + ' errors ' + (Diag.errors - errors);
    });
    test('Creator: corrupted or tampered storage falls back safely', () => {
      const saved = keepCustoms();
      try {
        const valid = defaultCustom(0), cheat = defaultCustom(1);
        cheat.attrs = { health: 9, stamina: 9, strength: 9, speed: 9, reach: 9, defense: 9, balance: 9, recovery: 9 };
        const cases = ['{not json', '[]', '{"slots":"x"}', 'null', JSON.stringify({ version: 1, slots: [cheat] }), 'x'.repeat(STORE_MAX_LENGTH + 10)];
        let problem = '';
        for (const c of cases) {
          Store.set(KEY_CUSTOM, c);
          try { CustomRoster.init(); } catch (e) { problem = 'threw on ' + c.slice(0, 12); }
          if (CustomRoster.slots.some(Boolean)) problem = 'accepted ' + c.slice(0, 20);
        }
        Store.set(KEY_CUSTOM, JSON.stringify({ version: 1, slots: [valid, cheat, 5, 'x'] }));
        CustomRoster.init();
        const kept = !!CustomRoster.slots[0] && !CustomRoster.slots[1] && !CustomRoster.slots[2] && !!ROSTER_BY_ID.c1 && !ROSTER_BY_ID.c2;
        return !problem && kept ? true : problem || 'valid slot not kept';
      } finally { restoreCustoms(saved); }
    });
    test('Creator: deleted fighter selection and ladders stay valid', () => {
      const saved = keepCustoms(), keepSel = Object.assign({}, Game.selection);
      try {
        CustomRoster.slots = new Array(CUSTOM_SLOTS).fill(null);
        CustomRoster.put(0, defaultCustom(0));
        const ladder = Game.opponentsFor('c1').slice(-ARCADE_STAGES);
        const ladderOk = ladder.length === ARCADE_STAGES && ladder[ladder.length - 1].id === 'zero' && ladder.every((r) => !r.custom);
        const builtinLadder = Game.opponentsFor('kai').map((r) => r.id).join() === 'yuki,brutus,dmitri,mara,zero';
        const choices = Game.opponentChoices('kai').some((r) => r.id === 'c1');
        const unlocked = Progress.isUnlocked('c1');
        Game.selection.player = 'c1'; Game.selection.opponent = 'c1';
        CustomRoster.remove(0);
        const fallback = Game.selection.player === 'kai' && !!ROSTER_BY_ID[Game.selection.opponent] && !ROSTER_BY_ID.c1 && !Progress.isUnlocked('c1');
        return ladderOk && builtinLadder && choices && unlocked && fallback ? true : JSON.stringify({ ladderOk, builtinLadder, choices, unlocked, fallback });
      } finally {
        Object.assign(Game.selection, keepSel);
        restoreCustoms(saved);
      }
    });
    /* ----- directional throws ----- */
    const THROW_AXES = { fwd: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1] };
    /* Attacker grabs at tick 2 (crouching for a low grip) and throws toward dir at clinch tick 10. */
    const thrower = (dir, low) => (it, f, o, mm) => {
      if (mm.tick <= 2 && low) it.crouch = true;
      if (mm.tick === 2) it.grapple = true;
      if (f.state === S.GRAPPLE && f.clinchTick >= 10 && !f.throwPending) { it.fwd = THROW_AXES[dir][0]; it.side = THROW_AXES[dir][1]; if (f.clinchTick === 10) it.grapple = true; }
    };
    const setupThrow = (grip, dir, opts) => {
      const m = mk(opts || {}, thrower(dir, grip === 'low'));
      self.place(m, 0.9, (opts && opts.x0) || 0);
      const a = m.fighters[0], b = m.fighters[1];
      a.yaw = Math.PI / 2; b.yaw = grip === 'rear' ? Math.PI / 2 : -Math.PI / 2;
      if (grip === 'rear') { b.setState(S.STUN); b.reactDur = 30; }   // a stunned fighter cannot turn around
      return m;
    };
    test('Throws: every grip and direction ends DOWN, GETUP, IDLE and lands the right way', () => {
      const illegal = Diag.illegalTransitions, problems = [];
      for (const grip of ['front', 'rear', 'low']) {
        for (const dir of THROW_DIRS) {
          const log = self.capture(['throw']);
          const m = setupThrow(grip, dir);
          const a = m.fighters[0], b = m.fighters[1], seen = [];
          let landedDot = 0, fwdX = 0, fwdZ = 0;
          for (let i = 0; i < 420; i++) {
            m.step();
            if (seen[seen.length - 1] !== b.state) seen.push(b.state);
            if (log.throw.length === 1 && !fwdX && !fwdZ) { const v = Combat.throwVector(a, dir); fwdX = v[0]; fwdZ = v[1]; }
            if (b.state === S.DOWN && !landedDot) landedDot = (b.x - a.x) * fwdX + (b.z - a.z) * fwdZ;
          }
          log.stop();
          const t = log.throw[0];
          const path = seen.join('>');
          const ok = t && t.grip === grip && t.dir === dir && t.name === THROW_SETS[grip][dir].name && path.endsWith('THROWN>DOWN>GETUP>IDLE') && a.state === S.IDLE && landedDot > 0.4;
          if (!ok) problems.push(grip + '/' + dir + ': ' + (t ? t.grip + '/' + t.dir : 'no throw') + ' ' + path + ' landed ' + landedDot.toFixed(2));
          m.dispose();
        }
      }
      if (Diag.illegalTransitions !== illegal) problems.push('illegal transitions ' + (Diag.illegalTransitions - illegal));
      return problems.length ? problems.join('; ') : true;
    });
    test('Throws: wall slam adds damage over an open-floor throw', () => {
      const lossFor = (x0) => {
        const m = setupThrow('front', 'fwd', { arenaId: 'dojo', x0 });
        self.run(m, 140);
        const loss = m.fighters[1].maxHp - m.fighters[1].hp;
        m.dispose();
        return loss;
      };
      const open = lossFor(-1.5), wall = lossFor(ARENAS.dojo.bounds.x - 1.3);
      return wall > open + 2 ? true : 'open ' + open + ' wall ' + wall;
    });
    test('Throws: escape works inside each window and fails after it', () => {
      const problems = [];
      for (const dir of THROW_DIRS) {
        const data = THROW_SETS.front[dir];
        for (const inside of [true, false]) {
          const pressAt = inside ? data.escapeUntil - 1 : data.escapeUntil + 1;
          const log = self.capture(['escape', 'throw']);
          const m = mk({}, (it, f, o, mm) => {
            if (mm.tick === 2) it.grapple = true;
            if (f.state === S.GRAPPLE && f.clinchTick >= 14 && !f.throwPending) { it.fwd = THROW_AXES[dir][0]; it.side = THROW_AXES[dir][1]; if (f.clinchTick === 14) it.grapple = true; }
          }, (it, f, o) => { if (f.state === S.CLINCH && o.throwPending && o.throwPending.tick === pressAt) it.grapple = true; });
          self.place(m, 0.9);
          self.run(m, 120);
          log.stop();
          const escaped = log.escape.length === 1 && log.throw.length === 0;
          const thrown = log.escape.length === 0 && log.throw.length === 1;
          if (inside ? !escaped : !thrown) problems.push(dir + (inside ? ' inside' : ' outside') + ': escapes ' + log.escape.length + ' throws ' + log.throw.length);
          m.dispose();
        }
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Throws: the escape window ends on the same tick for Player 1 and Player 2 as the defender (D25: P1 used to get one more tick)', () => {
      const outcome = (defenderIndex, pressSeen) => {   // pressSeen: the thrower's tick counter as of the end of the defender's tick (the input is read before both fighters update, so +1)
        const log = self.capture(['escape', 'throw']);
        const attack = (it, f, o, mm) => {
          if (mm.tick === 2) it.grapple = true;
          if (f.state === S.GRAPPLE && f.clinchTick >= 14 && !f.throwPending) { it.fwd = THROW_AXES.fwd[0]; it.side = THROW_AXES.fwd[1]; if (f.clinchTick === 14) it.grapple = true; }
        };
        const defend = (it, f, o) => { if (f.state === S.CLINCH && o.throwPending && o.throwPending.tick + 1 === pressSeen) it.grapple = true; };
        const m = defenderIndex === 1 ? mk({}, attack, defend) : mk({}, defend, attack);
        self.place(m, 0.9); self.run(m, 120); log.stop(); m.dispose();
        return log.escape.length === 1 && log.throw.length === 0 ? 'escaped' : log.escape.length === 0 && log.throw.length === 1 ? 'thrown' : 'escapes ' + log.escape.length + ' throws ' + log.throw.length;
      };
      const edge = THROW_SETS.front.fwd.escapeUntil, got = [];
      for (const defender of [1, 0]) got.push(outcome(defender, edge) + '/' + outcome(defender, edge + 1));
      return got.join() === 'escaped/thrown,escaped/thrown' ? true : 'P2 defender, P1 defender: ' + got.join(' | ');
    });
    test('Throws: no strong throw is left; a throw at 0 stamina deals the same damage as one at full stamina (D19 closed)', () => {
      const dmg = (stam) => {
        const log = self.capture(['throw']);
        const m = mk({}, (it, f, o, mm) => { thrower('back', false)(it, f, o, mm); if (f.state === S.GRAPPLE) f.stam = stam; });   // a grab needs 2 stamina, so the thrower is emptied once it holds
        self.place(m, 0.9); m.fighters[0].yaw = Math.PI / 2; m.fighters[1].yaw = -Math.PI / 2;
        self.run(m, 140); log.stop(); m.dispose();
        return log.throw.length === 1 ? log.throw[0].dmg : -1;
      };
      const full = dmg(100), empty = dmg(0);
      const noStrongThrow = Object.values(THROW_SETS).every((set) => Object.values(set).every((t) => t.strong === undefined)) && !('strongThrow' in Fighter.prototype);
      return full > 0 && Math.abs(full - empty) < 0.001 && noStrongThrow ? true : 'full ' + full + ' empty ' + empty + ' strong data ' + !noStrongThrow;
    });
    test('A strike beats a grab that goes active on the same tick, whoever is Player 1 (D25), and two grabs split by tick parity', () => {
      const clash = (grabber, striker, tickNo) => {
        const log = self.capture(['clinch', 'hit']);
        const m = mk({});
        self.place(m, 0.9);
        m.tick = tickNo;
        const g = m.fighters[grabber], s = m.fighters[striker];
        g.startAttack(ATTACKS.grab); s.startAttack(ATTACKS.jab);
        g.moveTick = g.mStartup; s.moveTick = s.mStartup;   // the next tick is the first active tick of both
        m.step(); log.stop();
        const out = { clinches: log.clinch.length, hitBy: log.hit.map((e) => e.att.index).join(), state: g.state };
        m.dispose();
        return out;
      };
      const a = clash(0, 1, 10), b = clash(1, 0, 10), c = clash(0, 1, 11), d = clash(1, 0, 11);
      const both = (grabTick) => {   // two grabs on one tick: exactly one clinch, and the winner flips with the tick parity
        const log = self.capture(['clinch']);
        const m = mk({});
        self.place(m, 0.9); m.tick = grabTick;
        for (const f of m.fighters) { f.startAttack(ATTACKS.grab); f.moveTick = f.mStartup; }
        m.step(); log.stop(); m.dispose();
        return log.clinch.length === 1 ? log.clinch[0].att.index : -1;
      };
      const ok = [a, b, c, d].every((r, i) => r.clinches === 0 && r.hitBy === (i % 2 === 0 ? '1' : '0')) && both(10) !== both(11) && both(10) >= 0 && both(11) >= 0;
      return ok ? true : JSON.stringify({ a, b, c, d, even: both(10), odd: both(11) });
    });
    test('Blocking never lifts health: a fighter at 0.6 hp stays at 0.6 after a guard break, one with more health keeps at least 1 hp (D25)', () => {
      const after = (hp) => {
        const m = mkBlock({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.power_jab); }, (it) => { it.defend = true; });
        self.place(m, 1.2); m.fighters[1].hp = hp; self.run(m, 50);
        const r = { hp: m.fighters[1].hp, state: m.fighters[1].state }; m.dispose();
        return r;
      };
      const low = after(0.6), mid = after(5);
      return low.hp === 0.6 && low.state === S.STUN && mid.hp >= 1 && mid.hp < 5 ? true : JSON.stringify({ low, mid });
    });
    test('Scenery impact ids are negative, so the attack counter of a long session can never match one (D25)', () => {
      const m = mk({});
      const obj = Arena.objects.find((o) => !o.destroyed);
      const f = m.fighters[1];
      f.setState(S.THROWN); f.kx = 6; f.kz = 0; f.obstacleHit = obj; f.flightId = 5; f.lastImpactTick = -100;
      const before = Combat.attackCounter;
      Combat.attackCounter = 100000 + 50 + (m.tick & 7);   // the old impact id for this flight and tick
      obj.lastSrc = Combat.attackCounter;                   // ... as the id of an earlier attack on the same object
      const log = self.capture(['objHit']);
      Combat.impactCheck(f, m); log.stop();
      Combat.attackCounter = before;
      m.dispose();
      return IMPACT_SRC_BASE < 0 && log.objHit.length === 1 && obj.lastSrc < 0 ? true : 'objHit ' + log.objHit.length + ' src ' + obj.lastSrc;
    });
    /* ----- combo loops (P3-08, P0-06): no string and no buffered chain may lock a defender for good ----- */
    const COMBO_LOCKED = [S.HIT, S.STAGGER, S.STUN, S.THROWN, S.DOWN, S.GETUP, S.KO];   // the defender cannot act
    const COMBO_ESCAPE_GAP = 3;       // free ticks in a row: press Defend, be in the guard, and be ready before the next strike lands
    const COMBO_LOCK_LIMIT = 240;     // ticks (4 s): the longest legal combo is a 3-step string into a guard break (80) or a knockdown (about 130) and the get-up; measured worst case 207
    const COMBO_DAMAGE_SHARE = 0.55;  // of a full health bar in one combo; P3-10 tightened it from 0.6 after the audit: measured worst case 0.49 (the heaviest hitter with the boost on), 0.41 for the style strings
    /* Fighter 1 plays the letters of a string row over and over (the next press goes in the moment the input buffer is empty, so the chain and the next
       string start as early as the rules allow), with endless stamina and the defender always in reach, so only the rules can end the combo. The
       defender is a Block fighter with a huge health bar: posture 'stand' / 'crouch' do nothing, 'guard' holds Defend (with Crouch for the crouch rows),
       'juggle' starts launched. Returns the longest stretch the defender could not act, the most health lost in one such stretch, how many windows of
       COMBO_ESCAPE_GAP free ticks it got, and the highest juggle count. */
    const loopCombo = (row, posture, ticks, attackerId, boost) => {
      let n = 0;
      const m = mk({ playerId: attackerId, opponentId: 'mara' }, (it, f, o) => {
        f.stam = f.maxStam; if (boost) f.boostTicks = BOOST_TICKS;
        if (o.state !== S.THROWN && o.state !== S.KO) { o.x = f.x + 1.0; o.z = f.z; o.prevX = o.x; o.prevZ = o.z; }
        if (!f.buffer && !f.bufferNext) { it[row.keys[n++ % row.keys.length] === 'P' ? 'punch' : 'kick'] = true; it.height = row.low; it.crouch = row.low; }
      }, (it) => {
        if (posture === 'crouch') it.crouch = true;
        if (posture === 'guard') { it.defend = true; it.crouch = row.low; }
      });
      const d = m.fighters[1], hpBase = d.maxHp;
      d.defense = 'block'; d.maxHp = d.hp = 1e6;
      self.place(m, 1.0);
      if (posture === 'juggle') { d.setState(S.THROWN); d.juggle = true; d.juggleCount = 0; d.vy = 5; d.y = 0.5; d.flightId = ++Combat.flightCounter; }
      let streak = 0, lock = 0, lost = 0, worst = 0, run = 0, windows = 0, juggle = 0, hp = d.hp;
      for (let t = 0; t < ticks; t++) {
        m.step();
        lost += Math.max(0, hp - d.hp); hp = d.hp; juggle = Math.max(juggle, d.juggleCount);
        if (COMBO_LOCKED.includes(d.state)) { streak++; run = 0; if (streak > lock) { lock = streak; worst = lost; } } else { streak = 0; lost = 0; if (++run === COMBO_ESCAPE_GAP) windows++; }
      }
      m.dispose();
      return { lock, damage: worst, windows, juggle, hpBase };
    };
    const loopRows = (rows) => rows.filter((r, i) => !rows.some((o, j) => j < i && o.low === r.low && (new Set(o.keys + r.keys).size === 1)));   // 'K', 'KK' and 'KKK' press the same letter: one loop each is enough
    const comboRows = loopRows(stringRows);
    const comboProblems = (attackerId, boost, postures, rows) => {
      const problems = [];
      for (const row of rows || comboRows) {
        for (const posture of postures) {
          const r = loopCombo(row, posture, 900, attackerId, boost);
          if (r.lock > COMBO_LOCK_LIMIT || r.damage > COMBO_DAMAGE_SHARE * r.hpBase || r.windows < 1 || r.juggle > JUGGLE_LIMIT) problems.push((row.low ? 'crouch ' : '') + row.keys + ' vs ' + posture + ': locked ' + r.lock + ' dmg ' + Math.round(r.damage) + ' windows ' + r.windows + ' juggle ' + r.juggle);
        }
      }
      return problems;
    };
    test('Combos end: every attack string and buffered chain, looped as fast as the buffer allows, leaves a standing, crouching, guarding or juggled defender free within ' + COMBO_LOCK_LIMIT + ' ticks and under ' + COMBO_DAMAGE_SHARE * 100 + '% of a health bar', () => {
      const problems = comboProblems('kai', false, ['stand', 'crouch', 'guard', 'juggle']);
      return problems.length ? problems.slice(0, 6).join('; ') + (problems.length > 6 ? ' (+' + (problems.length - 6) + ' more)' : '') : true;
    });
    test('Combos end for every move style\'s own strings (the P3-10 five in full, the P5-02 styles for the rows that differ from the default), standing, guarding and juggled', () => {
      const problems = [];
      withJudoka(() => {
        for (const styleId of Object.keys(STYLE_STRINGS)) {
          const table = stringsFor(styleId), rows = [], classic = ['boxer', 'karateka', 'capoeira', 'wrestler', 'judoka'].includes(styleId);
          for (const side of ['stand', 'crouch']) for (const keys in table[side]) if (classic || !STRINGS[side][keys] || table[side][keys].join() !== STRINGS[side][keys].join()) rows.push({ keys, low: side === 'crouch', moves: table[side][keys] });
          for (const p of comboProblems(STYLE_TESTERS[styleId], false, ['stand', 'crouch', 'guard', 'juggle'], loopRows(rows))) problems.push(styleId + ' ' + p);
        }
      });
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Combos end with the momentum boost on and the hardest hitter (BRUTUS), standing and guarding', () => {
      const problems = comboProblems('brutus', true, ['stand', 'guard']);
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Combos end after a run into the heaviest tackle and a launch: the juggle count never passes JUGGLE_LIMIT and the flight lands', () => {
      const run = loopCombo({ keys: 'PP', low: true }, 'stand', 600, 'kai', false);   // Crouch + P P = body jab, uppercut (a launcher)
      const m = tackleMatch('brutus', 'yuki', null, null, runAt);   // the charge keeps running into the same fighter: one tackle per run start
      const log = self.capture(['tackle']); self.run(m, 600); log.stop();
      const v = m.fighters[1], ran = log.tackle.length;
      m.dispose();
      return run.juggle <= JUGGLE_LIMIT && run.lock <= COMBO_LOCK_LIMIT && ran >= 1 && ran <= 12 && Number.isFinite(v.hp) ? true : JSON.stringify({ run, tackles: ran });
    });
    test('Wake-up: the strike i-frames last WAKEUP_GRACE_TICKS past the end of the get-up, so a guard can go up before the first strike counts', () => {
      const m = mk({}); const b = m.fighters[1];
      b.setState(S.HIT); b.setState(S.DOWN); b.setState(S.GETUP);
      let atStand = -1;
      for (let i = 0; i < 200 && atStand < 0; i++) { m.step(); if (b.state === S.IDLE) atStand = b.strikeGrace; }
      let graceTicks = 0;
      while (b.strikeGrace > 0 && graceTicks < 50) { m.step(); graceTicks++; }
      m.dispose();
      return atStand === WAKEUP_GRACE_TICKS && graceTicks === WAKEUP_GRACE_TICKS ? true : 'invuln at standing ' + atStand + ' then ' + graceTicks + ' ticks';
    });
    /* ----- Training frame data (P3-08) ----- */
    test('Training frame data: every move in the move list shows its name, startup, active and recovery; strings show their step', () => {
      const problems = [];
      for (const mv of ALL_MOVES) {
        const m = mk({}); self.place(m, 3);   // out of reach: the move whiffs, the numbers still show
        const f = m.fighters[0];
        f.startAttack(mv);
        const html = UI.frameDataHtml(m.lastMove);
        for (const part of [mv.name, 'Startup ' + f.mStartup + 'f', 'Active ' + mv.active + 'f', 'Recovery ' + f.mRecovery + 'f']) if (!html.includes(part)) problems.push(mv.id + ' lacks ' + part);
        m.dispose();
      }
      const m = mk({}, pressString('PPP')); self.place(m, 1.1); self.run(m, 90);
      const step = UI.frameDataHtml(m.lastMove);
      m.dispose();
      if (!/String step 3: Jab .* Cross .* Hook/.test(step) || !step.includes('Result: hit') || !/Advantage: hit [+-]?\d+ \/ block [+-]?\d+/.test(step)) problems.push('string step: ' + step.replace(/<br>/g, ' | '));
      return problems.length ? problems.slice(0, 5).join('; ') : true;
    });
    test('Training frame data: a knockdown or launch says so instead of a made-up advantage, and a block shows the block side', () => {
      const down = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.sweep); }); self.place(down, 1.2); self.run(down, 40);
      const sweep = UI.frameDataHtml(down.lastMove); down.dispose();
      const up = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.uppercut); }); self.place(up, 1.2); self.run(up, 40);
      const launch = UI.frameDataHtml(up.lastMove); up.dispose();
      const guard = mkBlock({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.cross); }, (it) => { it.defend = true; }); self.place(guard, 1.2); self.run(guard, 40);
      const blocked = UI.frameDataHtml(guard.lastMove); guard.dispose();
      return sweep.includes('knocks down') && !sweep.includes('Advantage') && launch.includes('launches: juggle 1 / ' + JUGGLE_LIMIT) && blocked.includes('Result: blocked') && /Advantage: hit [+-]?\d+ \/ block [+-]?\d+/.test(blocked) ? true : [sweep, launch, blocked].map((h) => h.replace(/<br>/g, ' | ')).join(' || ');
    });
    test('Training frame data: clinch strikes, throws (with the escape deadline), the tackle and holds all fill the panel', () => {
      const problems = [];
      const text = (lm) => UI.frameDataHtml(lm).replace(/<br>/g, ' | ');
      // grab, then a knee in the clinch
      let m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) it.grapple = true; if (f.state === S.GRAPPLE && f.clinchTick === 8 && f.clinchStrikes === 0) it.kick = true; });
      self.place(m, 0.9); self.run(m, 30);
      const knee = text(m.lastMove);
      if (!knee.includes('Clinch Knee') || !knee.includes('Startup 0f') || !knee.includes('Recovery ' + CLINCH_STRIKE_COOLDOWN + 'f') || !knee.includes('Result: hit')) problems.push('knee: ' + knee);
      m.dispose();
      // a throw: startup until the release, the escape deadline, the result
      m = setupThrow('front', 'back'); self.run(m, 140);
      const data = THROW_SETS.front.back, throwText = text(m.lastMove);
      if (!throwText.includes(data.name) || !throwText.includes('Startup ' + data.startup + 'f') || !throwText.includes('Recovery ' + data.recovery + 'f') || !throwText.includes('Escape until f' + data.escapeUntil) || !throwText.includes('Result: thrown')) problems.push('throw: ' + throwText);
      m.dispose();
      // the tackle, hit and blocked
      m = tackleMatch('brutus', 'yuki'); self.run(m, 100);
      const hit = text(m.lastMove);
      if (!hit.includes(TACKLE_MOVE.name) || !hit.includes('Result: hit') || !/Advantage: hit \+\d+/.test(hit) || hit.includes('block')) problems.push('tackle hit: ' + hit);
      m.dispose();
      m = tackleMatch('brutus', 'yuki', (it) => { it.defend = true; }, { block: true }, (it, f, o, mm) => { if (mm.tick < 45) runAt(it); }); self.run(m, 100);
      const stopped = text(m.lastMove);
      if (!stopped.includes('Result: blocked') || !stopped.includes('Advantage: block -' + (TACKLE_STOP_LOCK - TACKLE_BLOCK_STUN)) || stopped.includes('hit ')) problems.push('tackle blocked: ' + stopped);
      m.dispose();
      // a hold on a downed foe, to its end
      m = holdMatch({}, holdAt2); self.run(m, 400);
      const hold = text(m.lastMove);
      if (!hold.includes('Hold') || !hold.includes('Result: time') || !hold.includes('Active ' + SUBMIT_MAX_TICKS + 'f') || !/Damage: \d/.test(hold)) problems.push('hold: ' + hold);
      m.dispose();
      return problems.length ? problems.join('; ') : true;
    });
    test('Move list: clinch strikes and the tackle have rows with their frame data next to the attacks', () => {
      const html = UI.screen_moves();
      const rows = ['Clinch Knee', 'Clinch Elbow', TACKLE_MOVE.name].filter((name) => !html.includes('<td>' + name + '</td>'));
      return !rows.length && html.includes('0 / 1 / ' + CLINCH_STRIKE_COOLDOWN) ? true : 'missing rows ' + rows.join();
    });
    test('Throws: a rear throw started at once can still be escaped', () => {
      const problems = [];
      for (const dir of THROW_DIRS) {
        const log = self.capture(['escape', 'throw']);
        const m = mk({}, (it, f, o, mm) => {
          if (mm.tick === 2) it.grapple = true;
          if (f.state === S.GRAPPLE && !f.throwPending) { it.fwd = THROW_AXES[dir][0]; it.side = THROW_AXES[dir][1]; if (f.clinchTick === 6) it.grapple = true; }   // the throw starts on clinch tick 7
        }, (it, f) => { if (f.state === S.CLINCH && f.clinchTick === escapeStartFor(f) - 1) it.grapple = true; });   // first tick an escape can work
        self.place(m, 0.9);
        const b = m.fighters[1];
        m.fighters[0].yaw = Math.PI / 2; b.yaw = Math.PI / 2; b.setState(S.STUN); b.reactDur = 30;
        self.run(m, 120); log.stop();
        if (log.escape.length !== 1 || log.throw.length !== 0) problems.push(dir + ': escapes ' + log.escape.length + ' throws ' + log.throw.length);
        m.dispose();
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Throws: simultaneous grabs give one clinch, KO and round end mid-throw stay legal', () => {
      const illegal = Diag.illegalTransitions, errors = Diag.errors;
      let log = self.capture(['clinch']);
      let m = mk({}, once(2, 'grapple'), once(2, 'grapple')); self.place(m, 0.9); self.run(m, 200); log.stop();
      const oneClinch = log.clinch.length === 1;
      m.dispose();
      m = setupThrow('front', 'back'); m.fighters[1].hp = 1; self.run(m, 260);
      const ko = m.fighters[1].state === S.KO;
      m.dispose();
      m = setupThrow('front', 'back', { timer: 99 });
      self.run(m, 44);                                   // mid-suplex: the defender is in the air
      const lifted = m.fighters[1].state === S.CLINCH && m.fighters[1].liftY > 0.3;
      m.endRound('time');
      for (let i = 0; i < 200; i++) m.step();
      const settled = [m.fighters[0].state, m.fighters[1].state].every((s) => s === S.VICTORY || s === S.DEFEAT);
      const unhurt = m.fighters[1].hp === m.fighters[1].maxHp;   // the throw finished after the bell: no damage
      m.dispose();
      const legal = Diag.illegalTransitions === illegal && Diag.errors === errors;
      return oneClinch && ko && lifted && settled && unhurt && legal ? true : 'one clinch ' + oneClinch + ' ko ' + ko + ' lifted ' + lifted + ' settled ' + settled + ' unhurt ' + unhurt + ' illegal ' + (Diag.illegalTransitions - illegal);
    });
    test('Throws: AI picks deliberate directions (scenery, corner, style)', () => {
      const m = mk({ arenaId: 'warehouse' });
      const ai = new AIController(ROSTER_BY_ID.dmitri, 'hard');
      const a = m.fighters[0], b = m.fighters[1];
      const o = Arena.objects.find((q) => q.id === 'crateB');
      a.x = o.x - 2.4; a.z = o.z; b.x = o.x - 1.62; b.z = o.z; a.yaw = Math.PI / 2;    // the crate is ahead of the thrower
      const toCrate = ai.chooseThrowDir(a, b);
      const bx = Arena.def.bounds.x;
      a.x = bx - 0.3; a.z = 0; b.x = a.x - 0.78; b.z = 0; a.yaw = -Math.PI / 2;            // thrower's back to the wall, no object near
      const ai2 = new AIController(ROSTER_BY_ID.dmitri, 'normal');                          // normal AI ignores scenery
      const cornered = ai2.chooseThrowDir(a, b);
      m.dispose();
      return toCrate === 'fwd' && cornered === 'back' ? true : 'to crate ' + toCrate + ' cornered ' + cornered;
    });
    test('Throws: AI vs AI grappler match throws in several directions with no illegal transitions', () => {
      const illegal = Diag.illegalTransitions, errors = Diag.errors;
      const log = self.capture(['throw']);
      let over = 0;
      const seeds = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52];   // expert CPUs break many grabs: ~0.4 throws a match
      for (const seed of seeds) {
        const m = mk({ seed, timer: 60, winsNeeded: 1, arenaId: 'pit', playerId: 'dmitri', opponentId: 'brutus' });
        m.controllers[0] = new AIController(ROSTER_BY_ID.dmitri, 'expert');
        m.controllers[1] = new AIController(ROSTER_BY_ID.brutus, 'expert');
        let ticks = 0;
        while (!m.matchOver && ticks < 12000) { m.step(); ticks++; if (m.phase === 'waiting') m.startRound(); }   // a drawn round is replayed
        if (m.matchOver) over++;
        m.dispose();
      }
      log.stop();
      const dirs = new Set(log.throw.map((t) => t.dir));
      const legal = Diag.illegalTransitions === illegal && Diag.errors === errors;
      return over === seeds.length && legal && log.throw.length >= 2 && dirs.size >= 2 ? true : 'over ' + over + ' throws ' + log.throw.length + ' dirs ' + [...dirs].join(',') + ' illegal ' + (Diag.illegalTransitions - illegal) + ' errors ' + (Diag.errors - errors);
    });
    /* ----- motion (visual only) ----- */
    const finitePose = (f) => {
      for (let i = 0; i < NP; i++) if (!Number.isFinite(f.pose[i])) return false;
      for (let i = 0; i < f.pts.length; i++) if (!Number.isFinite(f.pts[i])) return false;
      return true;
    };
    /* Drive one fighter through every state, strike and throw pose (direct writes, no simulation). */
    const poseEveryState = (f, other) => {
      const bad = [];
      const check = (label) => { f.skeleton(0, f.liftY, 0, 0.3, false); if (!finitePose(f)) bad.push(label); };
      for (const st of Object.values(S)) {
        if (st === S.ATTACK || st === S.GRAPPLE) continue;
        f.state = st; f.reactDur = 18; f.sideDir = 1;
        if (st === S.CLINCH) { f.partner = other; other.state = S.GRAPPLE; other.partner = f; }
        for (let tick = 0; tick < 70; tick += 7) { f.stateTicks = tick; f.animT = tick / 60; f.computePose(); check(st + '@' + tick); }
        f.partner = null;
      }
      f.state = S.ATTACK;
      for (const id in ATTACKS) {
        const mv = ATTACKS[id];
        f.move = mv; f.mStartup = mv.startup; f.mActive = mv.active; f.mRecovery = mv.recovery; f.whiffExtra = 0;
        for (let tick = 0; tick <= mv.startup + mv.active + mv.recovery; tick += 2) { f.moveTick = tick; f.computePose(); check(id + '@' + tick); }
      }
      f.move = null;
      f.state = S.GRAPPLE; f.partner = other; other.state = S.CLINCH; other.partner = f;
      for (const grip of ['front', 'rear', 'low']) {
        f.grip = grip;
        for (const dir of THROW_DIRS) {
          const data = throwFor(grip, dir, f.motion.styleId);   // the style's own throws (Sambo, Brazilian Jiu-Jitsu) too
          f.throwPending = { tick: 0, dir, data, side: dir === 'left' ? -1 : 1, baseYaw: 0 };
          for (let tick = 0; tick <= data.startup; tick += 3) { f.throwPending.tick = tick; f.computePose(); check(grip + '/' + dir + '@' + tick); other.computePose(); }
        }
      }
      f.throwPending = null; f.partner = null; other.partner = null; other.state = S.IDLE;
      f.state = S.IDLE; f.lock = 10; f.throwFollow = { anim: 'suplex', side: 1, recovery: 20 }; f.computePose(); check('throw follow-through');
      f.lock = 0; f.throwFollow = null;
      return bad;
    };
    test('Motion: every fighter, style and body extreme renders every state without NaN', () => {
      const problems = [];
      const other = new Fighter(ROSTER_BY_ID.kai, 1);
      for (const r of ROSTER) {
        const bad = poseEveryState(new Fighter(r, 0), other);
        if (bad.length) problems.push(r.id + ': ' + bad.slice(0, 3).join(','));
      }
      for (const styleId of MOVE_STYLE_IDS) {
        for (const [scale, build] of [[SCALE_MIN, BUILD_MIN], [SCALE_MAX, BUILD_MAX], [SCALE_MIN, BUILD_MAX], [SCALE_MAX, BUILD_MIN]]) {
          const custom = defaultCustom(0);
          custom.moveStyle = styleId; custom.look.scale = scale; custom.look.build = build;
          const bad = poseEveryState(new Fighter(customProfile(custom, 0), 0), other);
          if (bad.length) problems.push(styleId + ' ' + scale + '/' + build + ': ' + bad.slice(0, 3).join(','));
        }
      }
      return problems.length ? problems.slice(0, 4).join('; ') : true;
    });
    test('Motion: move styles give different stances, rhythm and strikes', () => {
      const signature = (styleId) => {
        const f = new Fighter(Object.assign({}, ROSTER_BY_ID.kai, { moveStyle: styleId }), 0);
        const out = [];
        f.state = S.IDLE; f.animT = 0.37; f.computePose(); out.push(...f.tp);
        f.state = S.ATTACK; f.move = ATTACKS.cross; f.mStartup = ATTACKS.cross.startup; f.mActive = ATTACKS.cross.active; f.mRecovery = ATTACKS.cross.recovery;
        f.moveTick = ATTACKS.cross.startup; f.computePose(); out.push(...f.pose);
        return out;
      };
      const sigs = MOVE_STYLE_IDS.map(signature);
      const same = [];
      for (let a = 0; a < sigs.length; a++) {
        for (let b = a + 1; b < sigs.length; b++) {
          let diff = 0;
          for (let i = 0; i < sigs[a].length; i++) diff += Math.abs(sigs[a][i] - sigs[b][i]);
          if (diff < 0.15) same.push(MOVE_STYLE_IDS[a] + '=' + MOVE_STYLE_IDS[b] + ' (' + diff.toFixed(3) + ')');
        }
      }
      const assigned = ROSTER.every((r) => MOVE_STYLE[r.moveStyle]) && new Set(ROSTER.map((r) => r.moveStyle)).size === MOVE_STYLE_IDS.length;   // all 16 styles have a preset
      return same.length === 0 && assigned ? true : 'too similar: ' + same.join(', ') + ' roster styles ok ' + assigned;
    });
    test('Creator preview: strike trails of the punch and kick poses fade away', () => {
      const keepEffects = Settings.v.effects;
      Settings.v.effects = 'high';
      FX.clear();
      Showcase.showPreview(ROSTER_BY_ID.kai);
      const lit = () => FX.p.filter((q) => q.on).length;
      let peak = 0;
      for (const pose of ['punch', 'kick']) {
        Showcase.setPreviewPose(pose);
        for (let i = 0; i < 90; i++) { Showcase.update(1 / 60); peak = Math.max(peak, lit()); }
      }
      Showcase.setPreviewPose('guard');
      for (let i = 0; i < 30; i++) Showcase.update(1 / 60);
      const left = lit();
      Showcase.endPreview(); FX.clear(); Settings.v.effects = keepEffects;
      return peak > 0 && left === 0 ? true : 'peak ' + peak + ' left ' + left;
    });
    test('Motion: individuality is seeded and stable, never shared by two fighters', () => {
      const a1 = new Fighter(ROSTER_BY_ID.kai, 0).motion, a2 = new Fighter(ROSTER_BY_ID.kai, 1).motion;
      const twin = new Fighter(Object.assign({}, ROSTER_BY_ID.kai, { id: 'kai2' }), 0).motion;
      const stable = a1.phase === a2.phase && a1.bounce === a2.bounce && a1.guard.every((v, i) => v === a2.guard[i]);
      const distinct = a1.phase !== twin.phase && a1.bounce !== twin.bounce;
      return stable && distinct ? true : 'stable ' + stable + ' distinct ' + distinct;
    });
    test('Motion: movement style saves, shares, and old codes without it still import', () => {
      const c = validateCustom(randomCustom(4321)).value;
      c.moveStyle = 'judoka';
      const back = decodeCustom(encodeCustom(c), true);
      const fields = JSON.parse(fromBase64Url(encodeCustom(c).split('-')[1]));
      fields.length = SHARE_FIELD_COUNT;                            // an older code: no movement style, defense type or body field
      const payload = toBase64Url(JSON.stringify(fields));
      const old = decodeCustom(SHARE_PREFIX + '-' + payload + '-' + shareChecksum(payload), true);
      const stored = validateCustom(Object.assign({}, c, { moveStyle: undefined }));
      const bad = validateCustom(Object.assign({}, c, { moveStyle: 'ninja' }));
      const profile = customProfile(back.value, 0);
      const ok = back.ok && back.value.moveStyle === 'judoka' && old.ok && old.value.moveStyle === ARCHETYPE_MOVE_STYLE[c.arch] &&
        stored.ok && stored.value.moveStyle === ARCHETYPE_MOVE_STYLE[c.arch] && !bad.ok && new Fighter(profile, 0).motion.styleId === 'judoka';
      return ok ? true : 'round trip ' + (back.value && back.value.moveStyle) + ' old ' + old.ok + ' ' + (old.value && old.value.moveStyle) + ' stored ' + stored.ok + ' bad rejected ' + !bad.ok;
    });
    /* ----- Style data model (P5-01, P5-03): 16 styles in 7 families (Appendix C, P1-04) ----- */
    const STYLE_WANT = {   // id -> [family, default defense]
      boxer: ['hand', 'sway'], wingchun: ['hand', 'block'], kickboxer: ['clinch', 'block'], muaythai: ['clinch', 'block'], karateka: ['kicking', 'block'], taekwondo: ['kicking', 'sway'],
      capoeira: ['kicking', 'sway'], wrestler: ['throws', 'block'], judoka: ['throws', 'sway'], sambo: ['throws', 'block'], bjj: ['locks', 'sway'], hapkido: ['locks', 'sway'],
      kali: ['weapon', 'sway'], kravmaga: ['hybrid', 'block'], mma: ['hybrid', 'block'], brawler: ['hybrid', 'block'],
    };
    const OLD_STYLE_IDS = ['boxer', 'kickboxer', 'karateka', 'wrestler', 'judoka', 'brawler', 'capoeira'];   // MOVE_STYLE order before P5-01: share codes store the index
    const HOLD_STYLES = ['wrestler', 'judoka', 'sambo', 'bjj', 'hapkido', 'mma'];
    const moveUseOk = (uses, hasHold) => {
      if (ATTACKS[uses] || CLINCH_MOVES[uses]) return true;
      if (uses === 'hold') return hasHold;
      const t = /^throw:(\w+)\.(\w+)$/.exec(uses);
      return !!t && !!THROW_SETS[t[1]] && !!THROW_SETS[t[1]][t[2]];
    };
    test('Styles: all 16 styles exist with every data field, the P1-04 family and default defense', () => {
      const problems = [];
      if (MOVE_STYLE_IDS.length !== 16 || Object.keys(STYLE_WANT).some((id) => !MOVE_STYLE[id])) problems.push('ids ' + MOVE_STYLE_IDS.join());
      if (MOVE_STYLE_IDS.slice(0, 7).join() !== OLD_STYLE_IDS.join()) problems.push('the old 7 ids must stay first');
      const numeric = STYLE_STANCE_KEYS.concat(STYLE_FOOTWORK_KEYS, ['punchHip', 'punchPivot', 'punchLean', 'punchSnap', 'kickChamber', 'kickPivot', 'kickLean', 'kickSnap', 'react']);
      for (const id of MOVE_STYLE_IDS) {
        const s = MOVE_STYLE[id], want = STYLE_WANT[id] || [];
        if (typeof s.label !== 'string' || !s.label || typeof s.desc !== 'string' || s.desc.length < 30) problems.push(id + ' text');
        if (s.family !== want[0] || !STYLE_FAMILY_LABEL[s.family]) problems.push(id + ' family ' + s.family);
        if (s.defense !== want[1] || defaultDefense(id) !== want[1]) problems.push(id + ' defense ' + s.defense);
        for (const key of numeric) if (!Number.isFinite(s[key])) problems.push(id + ' ' + key);
        if (!VICTORY_POSES[s.victory]) problems.push(id + ' victory');
        if (s.moves !== null && !STYLE_STRINGS[s.moves]) problems.push(id + ' moves');
        if (!CLINCH_STRIKE_POSES[s.grab]) problems.push(id + ' grab');
        if (!THROW_SETS[s.throws]) problems.push(id + ' throws');
        if (!Array.isArray(s.submit) || s.submit.some((name) => typeof name !== 'string' || !name)) problems.push(id + ' submit');
        else if (SUBMISSION_STYLES.has(id) !== HOLD_STYLES.includes(id) || (s.submit.length > 0) !== HOLD_STYLES.includes(id)) problems.push(id + ' holds');   // holds for the grappling styles only
        if (!Array.isArray(s.signature) || s.signature.length < 3 || s.signature.some((x) => !Array.isArray(x) || typeof x[0] !== 'string' || !moveUseOk(x[1], Array.isArray(s.submit) && s.submit.length > 0))) problems.push(id + ' signature');
        if (stringsFor(id).stand.P === undefined || stringsFor(id).stand.K === undefined) problems.push(id + ' strings');
        const own = new Set(), rows = stringsFor(id);   // every string strike in the signature has to be thrown by one of the style's own rows
        for (const side of ['stand', 'crouch']) for (const keys in rows[side]) rows[side][keys].forEach((move) => own.add(move));
        for (const [name, uses] of s.signature) if (ATTACKS[uses] && ATTACKS[uses].type === 'strike' && !ATTACKS[uses].ctx && !own.has(uses)) problems.push(id + ' signature ' + name + ' is in no string row');
      }
      const families = new Set(MOVE_STYLE_IDS.map((id) => MOVE_STYLE[id].family));
      if (families.size !== 7 || Object.keys(STYLE_FAMILY_LABEL).length !== 7) problems.push('families ' + families.size);
      if (MOVE_STYLE_IDS.filter((id) => MOVE_STYLE[id].defense === 'sway').length !== 7) problems.push('Sway styles must be 7');
      if (SUBMISSION_STYLES.size !== HOLD_STYLES.length) problems.push('hold set ' + [...SUBMISSION_STYLES].join());
      if (new Set(MOVE_STYLE_IDS.map((id) => MOVE_STYLE[id].label)).size !== 16) problems.push('labels are not unique');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Styles: old style ids map to themselves; old share codes and saves load unchanged; new styles round-trip share codes', () => {
      const problems = [];
      for (const id of OLD_STYLE_IDS) if (styleFor(id) !== id || LEGACY_STYLE_MAP[id] !== id) problems.push('map ' + id);
      for (const bad of ['ninja', '', undefined, null, 7, 'constructor', '__proto__', 'toString']) if (styleFor(bad) !== null) problems.push('styleFor ' + String(bad));
      const base = validateCustom(randomCustom(4321)).value;
      const indexOf = (code) => { const fields = JSON.parse(fromBase64Url(code.split('-')[1])); return fields[SHARE_FIELD_COUNT]; };   // the style field follows the colours
      OLD_STYLE_IDS.forEach((id, index) => {
        const c = Object.assign({}, base, { moveStyle: id, defense: defaultDefense(id) });
        const code = encodeCustom(c);
        const fields = JSON.parse(fromBase64Url(code.split('-')[1]));
        fields.length = SHARE_FIELD_COUNT_STYLE;        // a code from before defense types: the old style index, no defense or body field
        const payload = toBase64Url(JSON.stringify(fields));
        const old = decodeCustom(SHARE_PREFIX + '-' + payload + '-' + shareChecksum(payload), true);
        const save = validateCustom(JSON.parse(JSON.stringify(c)));   // a saved fighter that carries the old id
        const back = decodeCustom(code, true);
        const loads = back.ok && back.value.moveStyle === id && old.ok && old.value.moveStyle === id && old.value.defense === defaultDefense(id) && save.ok && save.value.moveStyle === id &&
          new Fighter(customProfile(save.value, 0), 0).motion.styleId === id;
        if (indexOf(code) !== index || !loads) problems.push(id + ' index ' + indexOf(code) + ' loads ' + loads);
      });
      for (const id of MOVE_STYLE_IDS.slice(7)) {
        const c = Object.assign({}, base, { moveStyle: id, defense: defaultDefense(id) });
        const code = encodeCustom(c), back = decodeCustom(code, true);
        if (!back.ok || back.value.moveStyle !== id || back.value.defense !== defaultDefense(id) || indexOf(code) !== MOVE_STYLE_IDS.indexOf(id) || indexOf(code) < 7) problems.push(id + ' round trip');
        const flipped = Object.assign({}, c, { defense: c.defense === 'block' ? 'sway' : 'block' });   // a chosen defense wins over the style default
        const again = decodeCustom(encodeCustom(flipped), true);
        if (!again.ok || again.value.defense !== flipped.defense) problems.push(id + ' defense override');
      }
      if (validateCustom(Object.assign({}, base, { moveStyle: 'ninja' })).ok) problems.push('an unknown id must still fail');
      const withIndex = (styleIndex) => {   // a code whose style field holds styleIndex, as a newer build (more styles) or a styleless fighter would write it
        const fields = JSON.parse(fromBase64Url(encodeCustom(base).split('-')[1]));
        fields[SHARE_FIELD_COUNT] = styleIndex;
        const payload = toBase64Url(JSON.stringify(fields));
        return decodeCustom(SHARE_PREFIX + '-' + payload + '-' + shareChecksum(payload), true);
      };
      if (withIndex(MOVE_STYLE_IDS.length).ok) problems.push('a style index past the list must fail');
      const none = withIndex(-1);
      if (!none.ok || none.value.moveStyle !== ARCHETYPE_MOVE_STYLE[base.arch]) problems.push('index -1 must give the archetype default');
      return problems.length ? problems.slice(0, 5).join('; ') : true;
    });
    test('Styles: random fighters keep their seeds; only the creator\'s Randomize draws the new styles too', () => {
      const before = { 1: 4129164379, 5: 2889055767, 42: 3127338665, 99: 152905950, 777: 4041409028, 4321: 230743926, 31337: 1450132950 };   // fnv1a of the JSON of randomCustom(seed) before P5-01
      const problems = [];
      for (const seed in before) if (fnv1a(JSON.stringify(randomCustom(Number(seed)))) !== before[seed]) problems.push('seed ' + seed + ' changed');
      const rest = (c) => JSON.stringify(Object.assign({}, c, { moveStyle: 0, defense: 0 }));
      let wide = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const plain = randomCustom(seed), all = randomCustom(seed, true);
        if (!CLASSIC_STYLE_IDS.includes(plain.moveStyle)) problems.push('classic ' + seed);
        if (rest(plain) !== rest(all)) problems.push('other picks changed ' + seed);
        if (!validateCustom(all).ok || all.defense !== defaultDefense(all.moveStyle)) problems.push('valid ' + seed);
        if (!CLASSIC_STYLE_IDS.includes(all.moveStyle)) wide++;
      }
      if (CLASSIC_STYLE_IDS.join() !== OLD_STYLE_IDS.join()) problems.push('classic ids');
      if (!(wide > 20)) problems.push('new styles drawn ' + wide);
      return problems.length ? problems.slice(0, 5).join('; ') : true;
    });
    test('Styles: the creator cycles all 16 styles and shows label, family and description for each', () => {
      const keep = { draft: CreatorUI.draft, slot: CreatorUI.slot, say: UI.say, rerender: UI.rerender }, problems = [], seen = [];
      UI.say = () => {}; UI.rerender = () => {};   // no page in a headless run
      try {
        CreatorUI.slot = 0;
        CreatorUI.draft = defaultCustom(0);
        seen.push(CreatorUI.draft.moveStyle);
        for (let n = 0; n < MOVE_STYLE_IDS.length; n++) {
          const html = CreatorUI.tab_style(), s = MOVE_STYLE[CreatorUI.draft.moveStyle];
          if (!html.includes(esc(s.label)) || !html.includes(esc(STYLE_FAMILY_LABEL[s.family])) || !html.includes(esc(s.desc))) problems.push(CreatorUI.draft.moveStyle + ' not shown');
          CreatorUI.setMoveStyle(1);
          const d = CreatorUI.draft;
          if (d.defense !== defaultDefense(d.moveStyle)) problems.push(d.moveStyle + ' defense not reset');
          if (!decodeCustom(encodeCustom(validateCustom(d).value), true).ok) problems.push(d.moveStyle + ' does not save');
          seen.push(d.moveStyle);
        }
        const back = CreatorUI.draft.moveStyle;
        CreatorUI.setMoveStyle(-1);
        if (MOVE_STYLE_IDS[(MOVE_STYLE_IDS.indexOf(back) + MOVE_STYLE_IDS.length - 1) % MOVE_STYLE_IDS.length] !== CreatorUI.draft.moveStyle) problems.push('backwards');
      } finally {
        CreatorUI.draft = keep.draft; CreatorUI.slot = keep.slot; UI.say = keep.say; UI.rerender = keep.rerender; Showcase.endPreview();
      }
      if (new Set(seen).size !== 16 || seen[16] !== seen[0]) problems.push('cycle ' + new Set(seen).size);
      return problems.length ? problems.slice(0, 5).join('; ') : true;
    });
    test('Styles: the Move list names every style with its family, defense, signature moves and holds', () => {
      const html = UI.screen_moves();
      const missing = MOVE_STYLE_IDS.filter((id) => !html.includes(esc(MOVE_STYLE[id].label)) || !html.includes(esc(MOVE_STYLE[id].signature[0][0])));
      const holds = html.includes(esc(submissionStyleText())) && submissionStyleText().includes('Brazilian Jiu-Jitsu') && !submissionStyleText().includes('Boxing');
      return missing.length === 0 && holds ? true : 'missing ' + missing.join() + ' holds ' + holds;
    });
    test('Styles: every style plays an AI match against every style (and itself) without errors, and all of them land hits', () => {
      const ids = MOVE_STYLE_IDS, keys = ids.map((id) => 'sty_' + id), problems = [], hits = {};
      const run = (a, b, seed) => SimRunner.run({ playerId: keys[a], opponentId: keys[b], seed, difficulty: 'hard', timer: 10, winsNeeded: 1, listeners: { hit: (e) => { hits[e.att.id] = (hits[e.att.id] || 0) + 1; } } });
      ids.forEach((id, i) => { ROSTER_BY_ID[keys[i]] = Object.assign({}, ROSTER_BY_ID.kai, { id: keys[i], name: id.toUpperCase(), moveStyle: id, defense: defaultDefense(id) }); });
      let first = null, matches = 0;
      try {
        for (let a = 0; a < ids.length; a++) {
          for (let b = a; b < ids.length; b++) {
            try {
              const r = run(a, b, 1 + a * 16 + b);
              matches++;
              if (r.error) problems.push(ids[a] + ' v ' + ids[b] + ' ' + r.error);
              else if (!(r.ticks > 60) || r.hpLeft.some((hp) => !Number.isFinite(hp) || hp < 0 || hp > 1)) problems.push(ids[a] + ' v ' + ids[b] + ' ticks ' + r.ticks + ' hp ' + r.hpLeft.join('/'));
              if (a === 3 && b === 12) first = JSON.stringify([r.winner, r.ticks, r.hpLeft, r.damage]);
            } catch (e) { problems.push(ids[a] + ' v ' + ids[b] + ' ' + e.message); }
          }
        }
        const again = run(3, 12, 1 + 3 * 16 + 12);
        if (JSON.stringify([again.winner, again.ticks, again.hpLeft, again.damage]) !== first) problems.push('a rerun differs');
      } finally {
        for (const key of keys) delete ROSTER_BY_ID[key];
      }
      const silent = keys.filter((key) => !(hits[key] > 0));
      if (silent.length) problems.push('no hits from ' + silent.join());
      if (matches !== ids.length * (ids.length + 1) / 2) problems.push('matches ' + matches);
      return problems.length ? problems.slice(0, 5).join('; ') : true;
    });
    /* ----- style animations (P5-02) ----- */
    const STYLE_MOVE_OWNERS = { chain_punch: 'wingchun', trap_strike: 'wingchun', teep: 'muaythai', elbow_strike: 'muaythai', spin_back_kick: 'taekwondo', jump_round: 'taekwondo', spin_heel: 'hapkido', angle_one: 'kali', angle_two: 'kali', parry_strike: 'kravmaga', overhand: 'mma' };
    const STYLE_MOVE_LOOKS_LIKE = { chain_punch: 'jab', trap_strike: 'cross', teep: 'front_kick', elbow_strike: 'hook', spin_back_kick: 'roundhouse', jump_round: 'roundhouse', spin_heel: 'low_kick', angle_one: 'hook', angle_two: 'cross', parry_strike: 'cross', overhand: 'hook' };
    const STYLE_NEIGHBOUR = { wingchun: 'boxer', muaythai: 'kickboxer', taekwondo: 'karateka', sambo: 'wrestler', bjj: 'judoka', hapkido: 'bjj', kali: 'boxer', kravmaga: 'brawler', mma: 'brawler' };   // the P1-04 family neighbour (Kali: the nearest hand style)
    const maxGap = (p, q) => { let gap = 0; for (let i = 0; i < NP; i++) gap = Math.max(gap, Math.abs(p[i] - q[i])); return gap; };
    const styleFighter = (style) => new Fighter(Object.assign({}, ROSTER_BY_ID.kai, { moveStyle: style }), 0);
    test('Styles: the new moves have frame data in the band of the existing punches / kicks of their category, add no strong move, and are string steps of their own style only', () => {
      const ids = Object.keys(STYLE_MOVE_OWNERS), problems = [];
      const base = ALL_MOVES.filter((m) => !STYLE_MOVE_OWNERS[m.id] && !m.ctx && m.tier < 3 && m.type === 'strike');
      const perFrame = (m) => m.dmg / (m.startup + m.active + m.recovery);
      for (const id of ids) {
        const m = ATTACKS[id];
        if (!m || m.tier === 3 || m.ctx || m.type !== 'strike') { problems.push(id + ' kind'); continue; }
        const same = base.filter((b) => b.cat === m.cat), fa = frameAdvantage(m);
        const inBand = (value, pick) => { const all = same.map(pick); return value >= Math.min(...all) - 1e-9 && value <= Math.max(...all) + 1e-9; };
        if (!inBand(perFrame(m), perFrame)) problems.push(id + ' damage per frame ' + perFrame(m).toFixed(3));
        if (!inBand(fa.onHit, (b) => frameAdvantage(b).onHit)) problems.push(id + ' on hit ' + fa.onHit);
        if (!inBand(fa.onBlock, (b) => frameAdvantage(b).onBlock)) problems.push(id + ' on block ' + fa.onBlock);
        if (m.reach > ATTACKS.heavy_front.reach) problems.push(id + ' reach ' + m.reach);   // the longest plain strike: the AI ring distance reads it
      }
      if (Object.keys(ATTACKS).filter((id) => ATTACKS[id].tier === 3 && !ATTACKS[id].ctx).length !== 8) problems.push('a strong move was added');
      for (const style of MOVE_STYLE_IDS) {
        const table = stringsFor(style), used = new Set();
        for (const side of ['stand', 'crouch']) for (const keys in table[side]) table[side][keys].forEach((id) => { if (STYLE_MOVE_OWNERS[id]) used.add(id); });
        for (const id of used) if (STYLE_MOVE_OWNERS[id] !== style) problems.push(style + ' plays ' + id);
        for (const id of ids) if (STYLE_MOVE_OWNERS[id] === style && !used.has(id)) problems.push(style + ' lacks ' + id);
      }
      const html = UI.screen_moves();
      for (const id of ids) {
        if (!MOVE_STYLE[STYLE_MOVE_OWNERS[id]].signature.some((x) => x[1] === id)) problems.push(id + ' is not in its style\'s signature list');
        if (!html.includes('<td>' + esc(ATTACKS[id].name) + '</td><td>' + esc(MOVE_STYLE[STYLE_MOVE_OWNERS[id]].label) + ': ')) problems.push(id + ' missing from the Move list');   // its own row: name, then the style's name in the input column
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Styles: stance and signature moves tell the styles apart: a new style\'s idle pose differs from its neighbour\'s, each new move\'s pose from the standard move it resembles, and Training names the style and its moves', () => {
      const problems = [];
      const idle = (style) => { const f = styleFighter(style); f.state = S.IDLE; f.animT = 0.37; f.computePose(); return Array.from(f.tp); };
      for (const id in STYLE_NEIGHBOUR) { const gap = maxGap(idle(id), idle(STYLE_NEIGHBOUR[id])); if (gap < 0.15) problems.push('idle ' + id + ' = ' + STYLE_NEIGHBOUR[id] + ' (' + gap.toFixed(2) + ')'); }
      const built = (anim, s) => { const p = new Float32Array(GUARD_ORTHO); STRIKE_BUILDERS[anim](p, s); return p; };   // the strike pose on the same guard and side, so only the builder differs
      for (const id in STYLE_MOVE_LOOKS_LIKE) {
        const mv = ATTACKS[id], like = ATTACKS[STYLE_MOVE_LOOKS_LIKE[id]], s = mv.limb[0] === 'L' ? 1 : -1, gap = maxGap(built(mv.anim, s), built(like.anim, s));
        if (gap < 0.3) problems.push(id + ' looks like ' + like.id + ' (' + gap.toFixed(2) + ')');
      }
      for (const id in STYLE_MOVE_OWNERS) {   // the lowest foot key point over every frame of every new attack stays within 0.03 m of the floor (the old low kick reaches 0.032)
        const f = styleFighter(STYLE_MOVE_OWNERS[id]), mv = ATTACKS[id];
        let low = 9;
        f.state = S.ATTACK; f.move = mv; f.mStartup = mv.startup; f.mActive = mv.active; f.mRecovery = mv.recovery; f.whiffExtra = 0;
        for (let t = 0; t <= mv.startup + mv.active + mv.recovery; t++) { f.moveTick = t; f.computePose(); f.skeleton(0, 0, 0, 0, false); low = Math.min(low, f.pts[16], f.pts[19]); }
        if (low < -0.03) problems.push(id + ' foot ' + low.toFixed(3) + ' m');
      }
      for (const id of MOVE_STYLE_IDS) {
        const line = UI.styleLine(styleFighter(id));
        if (!line.includes(esc(MOVE_STYLE[id].label)) || MOVE_STYLE[id].signature.some((x) => !line.includes(esc(x[0])))) problems.push('Training line of ' + id);
      }
      const m = mk({ mode: 'training', playerId: 'rosa', opponentId: 'pranee' });
      const trained = m.fighters[0].motion.styleId === 'wingchun' && m.fighters[1].motion.styleId === 'muaythai';
      m.dispose();
      if (!trained) problems.push('Training fighters');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Styles: each style with attacks of its own uses them in AI matches (seeds and three foes until every move showed)', () => {
      const own = { rosa: ['chain_punch', 'trap_strike'], pranee: ['teep', 'elbow_strike'], sora: ['spin_back_kick', 'jump_round'], vikram: ['spin_heel'], nia: ['angle_one', 'angle_two'], yoav: ['parry_strike'], cruz: ['overhand'] }, problems = [];
      for (const id in own) {
        const used = new Set();
        for (let seed = 1; seed <= 8 && !own[id].every((move) => used.has(move)); seed++) for (const foe of ['kai', 'brutus', 'yuki']) {   // stops as soon as every own move showed
          const r = SimRunner.run({ playerId: id, opponentId: foe, seed, difficulty: 'hard', timer: 15, winsNeeded: 1, listeners: { attackStart: (e) => { if (e.f.id === id) used.add(e.mv.id); } } });
          if (r.error) return id + ' ' + r.error;
        }
        for (const move of own[id]) if (!used.has(move)) problems.push(id + ' never used ' + move);
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Styles: Sambo and Brazilian Jiu-Jitsu have throws of their own, every hold style has the hold pose P1-04 gives it, and the pieces sit in the ranges of the existing ones', () => {
      const problems = [], all = [], MIN_THROW_GAP = 0.5;   // m between the bodies during the flight (the old throws stay 0.6 or more apart; the first guard pull passed through at 0.00)
      for (const grip in THROW_SETS) for (const dir of THROW_DIRS) all.push(THROW_SETS[grip][dir]);
      for (const styleId in STYLE_THROWS) for (const grip in STYLE_THROWS[styleId]) for (const dir in STYLE_THROWS[styleId][grip]) {
        const t = STYLE_THROWS[styleId][grip][dir];
        if (!THROW_POSES[t.anim] || !MOVE_STYLE[styleId] || t.escapeUntil >= t.startup) problems.push(styleId + ' ' + grip + '.' + dir + ' data');
        else {   // the pose at the lift is not the pose of the throw it replaces
          const pose = (anim) => { const p = new Float32Array(GUARD_ORTHO); THROW_POSES[anim](p, 0.9, 1); return p; };
          if (maxGap(pose(t.anim), pose(THROW_SETS[grip][dir].anim)) < 0.3) problems.push(t.name + ' looks like ' + THROW_SETS[grip][dir].name);
        }
        for (const key of ['dmg', 'startup', 'recovery', 'escapeUntil', 'stam']) if (t[key] < Math.min(...all.map((x) => x[key])) || t[key] > Math.max(...all.map((x) => x[key]))) problems.push(t.name + ' ' + key + ' ' + t[key]);
      }
      if (throwFor('front', 'fwd', 'wrestler') !== THROW_SETS.front.fwd || throwFor('low', 'back', 'mma') !== THROW_SETS.low.back || throwFor('front', 'left', 'sambo') !== THROW_SETS.front.left) problems.push('other throws changed');
      for (const [playerId, grip, dir, name] of [['giorgi', 'front', 'fwd', 'Sambo Hip Throw'], ['reid', 'low', 'back', 'Guard Pull'], ['giorgi', 'front', 'back', THROW_SETS.front.back.name], ['reid', 'front', 'fwd', THROW_SETS.front.fwd.name]]) {
        const log = self.capture(['throw']), seen = [];
        const m = setupThrow(grip, dir, { playerId }), a = m.fighters[0], b = m.fighters[1];
        let landedDot = 0, fwdX = 0, fwdZ = 0, closest = 9;
        for (let i = 0; i < 420; i++) {
          m.step();
          if (seen[seen.length - 1] !== b.state) seen.push(b.state);
          if (log.throw.length === 1 && !fwdX && !fwdZ) { const v = Combat.throwVector(a, dir); fwdX = v[0]; fwdZ = v[1]; }
          if (b.state === S.THROWN) closest = Math.min(closest, Math.hypot(b.x - a.x, b.z - a.z));   // the thrown foe never passes through the thrower
          if (b.state === S.DOWN && !landedDot) landedDot = (b.x - a.x) * fwdX + (b.z - a.z) * fwdZ;   // and lands more than 0.4 m along the throw direction
        }
        log.stop(); m.dispose();
        if (!log.throw[0] || log.throw[0].name !== name || !seen.join('>').endsWith('THROWN>DOWN>GETUP>IDLE')) problems.push(playerId + ' ' + grip + '/' + dir + ': ' + (log.throw[0] ? log.throw[0].name : 'no throw'));
        else if (!(landedDot > 0.4) || !(closest > MIN_THROW_GAP)) problems.push(name + ' landed ' + landedDot.toFixed(2) + ' closest ' + closest.toFixed(2));
      }
      const floorFighter = styleFighter('kickboxer');
      const lowestFoot = (p) => { floorFighter.pose.set(p); floorFighter.skeleton(0, 0, 0, 0, false); return Math.min(floorFighter.pts[16], floorFighter.pts[19]); };
      const throwLow = (grip, anim) => { let low = 9; for (let u = 0; u <= 1; u += 0.1) { const p = new Float32Array(GUARD_ORTHO); GRIP_POSES[grip](p); THROW_POSES[anim](p, u, 1); low = Math.min(low, lowestFoot(p)); } return low; };
      let deepest = 0; for (const grip in THROW_SETS) for (const dir of THROW_DIRS) deepest = Math.min(deepest, throwLow(grip, THROW_SETS[grip][dir].anim));
      for (const styleId in STYLE_THROWS) for (const grip in STYLE_THROWS[styleId]) for (const dir in STYLE_THROWS[styleId][grip]) {   // not deeper than the deepest throw already in the game
        const low = throwLow(grip, STYLE_THROWS[styleId][grip][dir].anim);
        if (low < deepest - 0.005) problems.push(STYLE_THROWS[styleId][grip][dir].name + ' foot ' + low.toFixed(3) + ' m');
      }
      for (const name of ['leg', 'arm', 'wrist']) for (const q of [0, 0.5, 1]) { const p = new Float32Array(GUARD_ORTHO); HOLD_POSES[name](p, q); if (lowestFoot(p) < -0.03) problems.push('hold ' + name + ' foot ' + lowestFoot(p).toFixed(3) + ' m'); }
      const holdPose = (style) => { const fighter = styleFighter(style), pose = new Float32Array(NP); fighter.submitPose(pose, 0.5); return pose; };
      const hold = {}; for (const id of HOLD_STYLES) hold[id] = holdPose(id);
      for (const [x, y] of [['wrestler', 'sambo'], ['wrestler', 'bjj'], ['wrestler', 'hapkido'], ['sambo', 'bjj'], ['sambo', 'hapkido'], ['bjj', 'hapkido']]) if (maxGap(hold[x], hold[y]) < 0.5) problems.push('hold ' + x + ' = ' + y);
      if (maxGap(hold.wrestler, hold.judoka) > 0 || maxGap(hold.bjj, hold.mma) > 0) problems.push('shared holds differ');
      for (const id of HOLD_STYLES) if (!hold[id].every(Number.isFinite)) problems.push('hold ' + id + ' NaN');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    /* ----- attack animation audit (P5-06): the poses only, no tick, reach or damage ----- */
    const techFighter = (style, noTech) => { const f = styleFighter(style); f.motion.noTech = !!noTech; return f; };
    /* The fighter at a tick of a move (default: the first active tick), pose and key points copied out (yaw 0: +z is forward, key points 3-5 chest, 9-11 left hand, 12-14 right hand, 15-20 feet). */
    const techFrame = (style, id, noTech, tick) => {
      const f = techFighter(style, noTech), mv = ATTACKS[id];
      f.state = S.ATTACK; f.move = mv; f.moveTick = tick === undefined ? mv.startup + 1 : tick; f.mStartup = mv.startup; f.mActive = mv.active; f.mRecovery = mv.recovery; f.whiffExtra = 0;
      f.attackPose(); f.skeleton(0, 0, 0, 0, false);
      return { pose: Float32Array.from(f.pose), pts: Float32Array.from(f.pts), guard: Float32Array.from(f.motion.guard) };
    };
    test('Technique: every style throws its hands and legs its own way: its poses differ from the same style without the P5-06 technique and no technique is left empty', () => {
      const problems = [], KEYS = ['arm', 'off', 'sw', 'leg', 'base', 'front', 'rear', 'lean', 'twist', 'roll', 'head', 'fwd', 'drop', 'wind', 'pivot'];
      if (Object.keys(STYLE_TECH).sort().join() !== MOVE_STYLE_IDS.slice().sort().join()) problems.push('a row per style');
      for (const id in STYLE_TECH) for (const group in STYLE_TECH[id]) {
        if (group === 'use') { for (const anim in STYLE_TECH[id].use) if (!STRIKE_BUILDERS[anim] || !STRIKE_BUILDERS[STYLE_TECH[id].use[anim]]) problems.push(id + ' use ' + anim); continue; }
        for (const key in STYLE_TECH[id][group]) if (!KEYS.includes(key)) problems.push(id + '.' + group + '.' + key);
      }
      for (const id of MOVE_STYLE_IDS) {
        let punch = 0, kick = 0;
        for (const move of ['jab', 'cross', 'hook', 'uppercut']) punch = Math.max(punch, maxGap(techFrame(id, move, false).pose, techFrame(id, move, true).pose));
        for (const move of ['front_kick', 'roundhouse', 'low_kick']) kick = Math.max(kick, maxGap(techFrame(id, move, false).pose, techFrame(id, move, true).pose));
        if (punch < 0.4) problems.push(id + ' punches as before (' + punch.toFixed(2) + ')');
        if (kick < 0.5) problems.push(id + ' kicks as before (' + kick.toFixed(2) + ')');
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Technique: no two styles throw the cross or the round kick with the same body (every pair differs by 0.25 rad or more in some joint)', () => {
      const problems = [], poses = {};
      for (const id of MOVE_STYLE_IDS) poses[id] = ['cross', 'roundhouse'].map((move) => techFrame(id, move, false).pose);
      for (let i = 0; i < MOVE_STYLE_IDS.length; i++) for (let j = i + 1; j < MOVE_STYLE_IDS.length; j++) {
        const a = MOVE_STYLE_IDS[i], b = MOVE_STYLE_IDS[j];
        const cross = maxGap(poses[a][0], poses[b][0]), kick = maxGap(poses[a][1], poses[b][1]);
        if (cross < 0.25) problems.push(a + ' / ' + b + ' cross ' + cross.toFixed(2));
        if (kick < 0.25) problems.push(a + ' / ' + b + ' round kick ' + kick.toFixed(2));
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    /* The fight camera (measured in a 1v1 at 1280 x 720: distance about 6.4, elevation about 0.5, field of view 0.8; a side view): about 133 px for a metre of fighter. */
    const FIGHT_CAMERA = { dist: 6.4, elev: 0.5, fov: 0.8, height: 720 };
    const PX_PER_M = FIGHT_CAMERA.height / 2 / (FIGHT_CAMERA.dist * Math.tan(FIGHT_CAMERA.fov / 2));
    const SCREEN_POINTS = [3, 6, 9, 12, 15, 18, 24, 27, 30, 33];   // key points: chest, head, both hands, both feet, both knees, both elbows
    /* Where the key points of a pose land on the screen (px; x along the line between the fighters, y up), the fighter standing at the origin. */
    const screenPoints = (pts) => SCREEN_POINTS.map((i) => [pts[i + 2] * PX_PER_M, (pts[i + 1] * Math.cos(FIGHT_CAMERA.elev) + pts[i] * Math.sin(FIGHT_CAMERA.elev)) * PX_PER_M]);
    const screenGap = (a, b) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1])));
    test('Technique at the fight camera: at the contact tick of the cross and of the round kick every style differs from the same style without its technique by 28 px or more on the screen (a fifth of a metre) and from every other style by 24 px or more, in some key point (chest, head, hands, feet, knees, elbows)', () => {
      const problems = [], MIN_OWN = 28, MIN_PAIR = 24;
      for (const [move, name] of [['cross', 'cross'], ['roundhouse', 'round kick']]) {
        const shown = {}, plain = {};
        for (const id of MOVE_STYLE_IDS) { shown[id] = screenPoints(techFrame(id, move, false).pts); plain[id] = screenPoints(techFrame(id, move, true).pts); }
        for (const id of MOVE_STYLE_IDS) { const gap = screenGap(shown[id], plain[id]); if (gap < MIN_OWN) problems.push(id + ' ' + name + ' ' + gap.toFixed(0) + ' px from its plain pose'); }
        for (let i = 0; i < MOVE_STYLE_IDS.length; i++) for (let j = i + 1; j < MOVE_STYLE_IDS.length; j++) {
          const gap = screenGap(shown[MOVE_STYLE_IDS[i]], shown[MOVE_STYLE_IDS[j]]);
          if (gap < MIN_PAIR) problems.push(MOVE_STYLE_IDS[i] + ' / ' + MOVE_STYLE_IDS[j] + ' ' + name + ' ' + gap.toFixed(0) + ' px');
        }
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Technique: the guard hand does what the art does during a cross: up at the face (Boxing, Kickboxing, Muay Thai, Wing Chun, Krav Maga), pulled back to the ribs (Karate hikite), forward on the centre line (Wing Chun), reaching for the collar (Judo, Sambo), low and forward (Wrestling, Brazilian Jiu-Jitsu), dropped (Brawler)', () => {
      const problems = [], hand = (id) => { const p = techFrame(id, 'cross', false).pts; return { y: p[10], z: p[11], gap: p[14] - p[11], chestY: p[4] }; };   // the left (guard) hand in metres: height and distance in front of the body, and how far behind the punching hand it is
      const check = (id, ok, why) => { const h = hand(id); if (!ok(h)) problems.push(id + ' ' + why + ' (y ' + h.y.toFixed(2) + ' z ' + h.z.toFixed(2) + ' gap ' + h.gap.toFixed(2) + ')'); };
      for (const id of ['boxer', 'kickboxer', 'muaythai', 'wingchun', 'kravmaga']) check(id, (h) => h.y >= 1.55, 'guard hand below the face');
      check('karateka', (h) => h.gap >= 0.6 && h.y <= 1.2, 'hikite not at the ribs');
      check('wingchun', (h) => h.gap <= 0.2, 'hands not together on the centre line');
      for (const id of ['judoka', 'sambo']) check(id, (h) => h.z >= 0.25, 'no reach for the collar');
      for (const id of ['wrestler', 'bjj']) check(id, (h) => h.y <= 0.8 && h.z >= 0.15, 'hands not low and forward');
      if (hand('brawler').y > hand('boxer').y - 0.2) problems.push('brawler guard hand not dropped below the boxer\'s');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Technique: the legs do what the art does during a round kick: the Muay Thai and Taekwondo kicker leans back and straightens the support leg, the Capoeira body goes low, the Brawler winds up big and Wing Chun and Krav Maga hardly at all', () => {
      const problems = [], lean = (id) => techFrame(id, 'roundhouse', false).pose[J.torsoLean], plain = (id) => techFrame(id, 'roundhouse', true).pose[J.torsoLean];
      for (const id of ['muaythai', 'taekwondo']) if (lean(id) > plain(id) - 0.1) problems.push(id + ' lean ' + lean(id).toFixed(2) + ' vs ' + plain(id).toFixed(2));
      for (const id of ['muaythai', 'taekwondo']) { const f = techFrame(id, 'roundhouse', false), g = techFrame(id, 'roundhouse', true); if (f.pose[J.knL] > g.pose[J.knL] - 0.09) problems.push(id + ' support knee'); }   // the support leg of a right kick is the left one
      if (lean('capoeira') < plain('capoeira') + 0.4) problems.push('capoeira body not low');
      const windUp = (id, move) => { const mv = ATTACKS[move], f = techFrame(id, move, false, Math.round(mv.startup * 0.45)); return Math.abs(f.pose[J.shRx] - f.guard[J.shRx]); };   // the right striking arm of the cross
      if (!(windUp('brawler', 'cross') > 2.5 * windUp('wingchun', 'cross'))) problems.push('wind-up ' + windUp('brawler', 'cross').toFixed(2) + ' vs ' + windUp('wingchun', 'cross').toFixed(2));
      if (!(windUp('kravmaga', 'cross') < windUp('boxer', 'cross'))) problems.push('Krav Maga winds up like Boxing');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Technique: every move of every style is finite on every tick and no foot sinks below the floor more than the plain pose does (0.05 m of margin)', () => {
      const problems = [];
      for (const id of MOVE_STYLE_IDS) for (const key in ATTACKS) {
        const mv = ATTACKS[key];
        if (mv.type !== 'strike' || mv.ctx === 'air') continue;
        let low = 9, plainLow = 9;
        for (let t = 0; t <= mv.startup + mv.active + mv.recovery; t += 2) {
          const f = techFrame(id, key, false, t), p = techFrame(id, key, true, t);
          if (!f.pose.every(Number.isFinite)) { problems.push(id + ' ' + key + ' NaN'); break; }
          low = Math.min(low, f.pts[16], f.pts[19]); plainLow = Math.min(plainLow, p.pts[16], p.pts[19]);
        }
        if (low < Math.min(plainLow, -0.03) - 0.05) problems.push(id + ' ' + key + ' foot ' + low.toFixed(3));
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    /* ----- weapon attack animations (P5-07): the poses only, never the move rows ----- */
    /* fnv1a of every gameplay field of the attack rows, the item move rows, the items, the string tables, the throws, the style fields that decide play and the submission constants (everything except the
       visual fields in VISUAL_FIELDS), taken from the code of commit 3b006f3, before P5-06 (git show of breakpoint.html): the P5 animation work is visual only. */
    const VISUAL_FIELDS = ['name', 'anim', 'swing', 'parts', 'hex', 'hold', 'tilt', 'len'];
    const MOVE_FINGERPRINT_BEFORE_P506 = 'attacks:18840380 items:707883862 weapons:3785869874 strings:1188394447 styleStrings:3626361966 throws:4268682286 styleThrows:369119152 style:2002661752 submit:2781949150';
    const moveFingerprint = () => {
      const canon = (value) => JSON.stringify(value, (key, v) => {
        if (VISUAL_FIELDS.includes(key)) return undefined;
        if (v && typeof v === 'object' && !Array.isArray(v)) return Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {});
        return v;
      });
      const style = {}; for (const id of MOVE_STYLE_IDS) { const s = MOVE_STYLE[id]; style[id] = { moves: s.moves, throws: s.throws, defense: s.defense, submit: s.submit }; }
      const submit = [SUBMIT_MAX_TICKS, SUBMIT_RANGE, SUBMIT_GAP, SUBMIT_MIN_STAMINA, SUBMIT_ESCAPE_GOAL, SUBMIT_CONTEST_FLOOR, SUBMIT_ESCAPE_TAP, SUBMIT_HOLD_TAP, SUBMIT_STAM_FLOOR, SUBMIT_TAP_COST, SUBMIT_DRIFT, SUBMIT_DMG_START, SUBMIT_DMG_END, SUBMIT_STAM_DRAIN, SUBMIT_FLASH_TICKS, SUBMIT_REST_TICKS, SUBMIT_AFTER_LOCK, SUBMIT_ESCAPE_LOCK];
      const parts = { attacks: ATTACKS, items: WEAPON_MOVES, weapons: WEAPONS, strings: STRINGS, styleStrings: STYLE_STRINGS, throws: THROW_SETS, styleThrows: STYLE_THROWS, style, submit };
      return Object.keys(parts).map((k) => k + ':' + fnv1a(canon(parts[k]))).join(' ');
    };
    const weaponFighter = (id) => { const f = styleFighter('kickboxer'); f.item = { id, dur: 99, sprays: 3 }; return f; };
    /* The fighter holding an item at a tick of one of its moves; the key points are copied out (21-23 = the far end of the item) and, like the hit ranges, they are for a standard body (scale 1). */
    const weaponFrame = (moveId, tick) => {
      const mv = WEAPON_MOVES[moveId], f = weaponFighter(mv.wpn);
      f.state = S.ATTACK; f.move = mv; f.moveTick = tick === undefined ? mv.startup + 1 : tick; f.mStartup = mv.startup; f.mActive = mv.active; f.mRecovery = mv.recovery; f.whiffExtra = 0;
      f.attackPose(); f.skeleton(0, 0, 0, 0, false);
      return { pose: Float32Array.from(f.pose), pts: Float32Array.from(f.pts), bend: f.chainBend, scale: f.scale };
    };
    const WEAPON_SHAPES = ['one', 'oneBack', 'thrust', 'over', 'two', 'overTwo', 'thrustTwo', 'sweep'];
    test('Weapons: every item step has a swing of its own shape (poke, forehand, backhand, chop, two-handed, sweep), different from the bare-hand punch it used to borrow and from the other shapes', () => {
      const problems = [], shapes = {};
      if (Object.keys(WEAPON_SWINGS).sort().join() !== WEAPON_SHAPES.slice().sort().join()) problems.push('shape table');
      for (const key in WEAPON_MOVES) {
        const mv = WEAPON_MOVES[key];
        if (!WEAPON_SWINGS[mv.swing]) { problems.push(key + ' swing ' + mv.swing); continue; }
        shapes[mv.swing] = shapes[mv.swing] || key;
        const bare = styleFighter('kickboxer'); bare.state = S.ATTACK; bare.move = ATTACKS.cross; bare.moveTick = ATTACKS.cross.startup + 1; bare.mStartup = ATTACKS.cross.startup; bare.mActive = 3; bare.mRecovery = 13; bare.whiffExtra = 0; bare.attackPose();
        if (maxGap(weaponFrame(key).pose, bare.pose) < 0.3) problems.push(key + ' looks like a punch');
      }
      for (const shape of WEAPON_SHAPES) if (!shapes[shape]) problems.push('no move uses ' + shape);
      const ids = Object.values(shapes);
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (maxGap(weaponFrame(ids[i], WEAPON_MOVES[ids[i]].startup - 3).pose, weaponFrame(ids[j], WEAPON_MOVES[ids[j]].startup - 3).pose) < 0.3) problems.push(ids[i] + ' / ' + ids[j] + ' wind up alike');
      for (const key of ['stick:1', 'stick:2', 'stick:3', 'bat:1', 'bat:2', 'chair:1', 'chair:2', 'broom:1', 'broom:2']) {   // wind-up, contact and follow-through are three different poses
        const mv = WEAPON_MOVES[key], a = weaponFrame(key, Math.round(mv.startup * 0.5)).pose, b = weaponFrame(key).pose, c = weaponFrame(key, mv.startup + mv.active).pose;
        if (maxGap(a, b) < 0.4 || maxGap(b, c) < 0.2) problems.push(key + ' key poses ' + maxGap(a, b).toFixed(2) + ' / ' + maxGap(b, c).toFixed(2));
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Weapons: at contact the far end of the item is where the hit lands: in front of the fighter, at the height the move hits, within 0.15 m of the move\'s reach out (at most 0.12 m past it) and inside its width', () => {
      const problems = [];
      for (const key in WEAPON_MOVES) {
        const mv = WEAPON_MOVES[key], w = WEAPONS[mv.wpn];
        if (w.len < 0.25) continue;   // the bin lid is a shield: no far end
        const f = weaponFrame(key), x = f.pts[21] / f.scale, y = f.pts[22] / f.scale, z = f.pts[23] / f.scale;
        const high = mv.h === 'L' ? 0.9 : 1.7, low = mv.h === 'L' ? 0.2 : 0.6;
        if (z < mv.reach - 0.15 || z > mv.reach + 0.12) problems.push(key + ' ends ' + z.toFixed(2) + ' m out, reach ' + mv.reach.toFixed(2));
        else if (y < low || y > high) problems.push(key + ' ends ' + y.toFixed(2) + ' m up');
        else if (Math.abs(x) > mv.width + 0.4) problems.push(key + ' ends ' + x.toFixed(2) + ' m to the side');
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Weapons: a two-handed item stays in both hands through the whole swing, a chop starts above the head, and a sweep ends low', () => {
      const problems = [];
      for (const key of ['chair:1', 'chair:2', 'skateboard:1', 'skateboard:2', 'broom:1', 'broom:2']) {
        const mv = WEAPON_MOVES[key];
        for (const t of [0, Math.round(mv.startup * 0.55), mv.startup + 1, mv.startup + mv.active, mv.startup + mv.active + mv.recovery]) {   // the key poses and the ends; the few ticks between two key poses are a joint-space blend that drifts off the shaft
          const p = weaponFrame(key, t).pts, gap = Math.hypot(p[9] - p[12], p[10] - p[13], p[11] - p[14]);
          if (gap < 0.05 || gap > 0.4) { problems.push(key + ' hands ' + gap.toFixed(2) + ' m apart at tick ' + t); break; }
        }
      }
      for (const key of ['stick:3', 'bat:2', 'chair:2', 'hammer:2']) { const mv = WEAPON_MOVES[key], p = weaponFrame(key, Math.round(mv.startup * 0.5)).pts; if (!(p[13] > 1.7)) problems.push(key + ' wind-up hand ' + p[13].toFixed(2) + ' m'); }
      if (!(weaponFrame('broom:2', 10).pts[22] < 0.7)) problems.push('broom sweep stays high');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Weapons: the bike chain is longer than a stick, hangs slack, coils behind the hand, runs out straight at contact and curls on past it', () => {
      const problems = [], chain = WEAPONS.chain, mv = WEAPON_MOVES['chain:1'];
      if (!(chain.len >= 1.0)) problems.push('chain ' + chain.len + ' m');
      const rest = styleFighter('kickboxer'); rest.item = { id: 'chain', dur: 9, sprays: 0 }; rest.state = S.IDLE; rest.computePose();
      const wind = weaponFrame('chain:1', Math.round(mv.startup * 0.55)).bend, hit = weaponFrame('chain:1').bend, after = weaponFrame('chain:1', mv.startup + mv.active).bend;
      if (!(rest.chainBend > 0.3 && wind > 1.0 && Math.abs(hit) < 0.05 && after < -0.3)) problems.push('bend ' + [rest.chainBend, wind, hit, after].map((v) => v.toFixed(2)).join(' / '));
      return problems.length ? problems.join('; ') : true;
    });
    test('Weapons: a thrown item leaves from the hand: at the release the throwing hand (both hands for a crate) is within 0.3 m of the point the item appears, and a crate is carried in both hands in front of the chest', () => {
      const problems = [];
      const handsAt = (cls, anim, item) => {
        const f = styleFighter('kickboxer'); f.state = S.IDLE; f.animT = 0.37; f.item = item ? { id: item, dur: 9, sprays: 0 } : null; f.throwAnim = anim; f.throwCls = cls;
        f.computePose(); f.pose.set(f.tp); f.skeleton(0, 0, 0, 0, false);
        return Float32Array.from(f.pts);
      };
      for (const [cls, id] of [['throwable', 'bottle'], ['throwable', 'brick'], ['heavy', 'bat'], ['two', 'chair'], ['two', 'skateboard'], ['carry', 'crate']]) {
        const p = handsAt(cls, THROW_ANIM_TICKS, null), y = cls === 'carry' ? 1.0 : THROW_HAND;
        const hand = cls === 'carry' ? [(p[9] + p[12]) / 2, (p[10] + p[13]) / 2, (p[11] + p[14]) / 2] : [p[12], p[13], p[14]];
        const gap = Math.hypot(hand[0], hand[1] - y, hand[2] - 0.45);
        if (gap > 0.3) problems.push(id + ' released ' + gap.toFixed(2) + ' m from its spawn point');
      }
      const held = handsAt('', 0, 'crate');   // carried: the left hand is on the left of the body and the right on the right, both in front and at the height of the chest
      if (!(held[9] > 0.15 && held[12] < -0.15 && held[11] > 0.2 && held[14] > 0.2 && held[10] > 0.7 && held[10] < 1.3 && held[13] > 0.7 && held[13] < 1.3)) problems.push('crate hands (' + [9, 10, 11, 12, 13, 14].map((i) => held[i].toFixed(2)).join(' ') + ')');
      const idlePts = handsAt('', 0, null), heldPts = handsAt('', 0, 'bottle'), midPts = handsAt('bottle', Math.round(THROW_ANIM_TICKS / 2), null), releasePts = handsAt('throwable', THROW_ANIM_TICKS, null);
      const handGap = (p, q) => Math.hypot(p[12] - q[12], p[13] - q[13], p[14] - q[14]);   // the right hand
      if (handGap(idlePts, heldPts) < 0.1) problems.push('a held bottle is held like nothing');   // the held pose raises the hand ready to throw
      const toRelease = handGap(heldPts, releasePts), halfway = handGap(midPts, releasePts);
      if (!(toRelease > 0.15 && halfway > 0.02 && halfway < toRelease - 0.02)) problems.push('the arm does not ease back from the release (' + toRelease.toFixed(2) + ' / ' + halfway.toFixed(2) + ')');
      if (!(POSE_SCRATCH instanceof Float32Array) || POSE_SCRATCH.length !== NP) problems.push('scratch pose');
      const kicker = styleFighter('muaythai'); kicker.state = S.ATTACK; kicker.move = ATTACKS.roundhouse; kicker.moveTick = 5; kicker.mStartup = 11; kicker.mActive = 4; kicker.mRecovery = 19; kicker.whiffExtra = 0; kicker.attackPose();
      if (!kicker.motion.pivots || kicker.motion.pivots.round === undefined) problems.push('support-foot pivot not cached');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Weapons: the swings keep both feet on the floor, stay finite on every tick, and change no move row (ticks, damage, reach, width, hit effects of all attacks and item moves are the fingerprint taken before P5-06 and P5-07)', () => {
      const problems = [];
      for (const key in WEAPON_MOVES) {
        const mv = WEAPON_MOVES[key];
        for (let t = 0; t <= mv.startup + mv.active + mv.recovery; t += 2) {
          const f = weaponFrame(key, t);
          if (!f.pose.every(Number.isFinite)) { problems.push(key + ' NaN'); break; }
          if (Math.min(f.pts[16], f.pts[19]) < -0.04) { problems.push(key + ' foot ' + Math.min(f.pts[16], f.pts[19]).toFixed(3)); break; }
        }
      }
      const now = moveFingerprint();
      if (now !== MOVE_FINGERPRINT_BEFORE_P506) problems.push('a gameplay field changed: ' + now.split(' ').filter((x, i) => x !== MOVE_FINGERPRINT_BEFORE_P506.split(' ')[i]).join(' '));
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Weapons: an item that wears out in the hand breaks where the fight decides, not where the animation puts the hand: the glass of a bottle lands at a fixed point in front of the fighter whatever the pose', () => {
      const problems = [], m = mk({ playerId: 'kai', opponentId: 'mara' }, idle, idle), f = m.fighters[0];
      let at = null; m.glassPatch = (x, z) => { at = [x, z]; };
      for (const [label, pose] of [['guard', () => {}], ['arm up and back', (p) => { p[J.shRx] = 2.9; p[J.shRz] = 1.2; p[J.torsoTwist] = -1; }], ['arm out front', (p) => { p[J.shRx] = 1.5; p[J.torsoTwist] = 1; p[J.rootFwd] = 0.4; }]]) {
        f.item = { id: 'bottle', dur: 1, sprays: 0 }; f.computePose(); pose(f.pose); f.skeleton(0, 0, 0, 0, false); at = null;
        m.breakHeld(f);
        const want = [f.x + f.fwdX * ITEM_BREAK_AHEAD, f.z + f.fwdZ * ITEM_BREAK_AHEAD];
        if (!at || Math.hypot(at[0] - want[0], at[1] - want[1]) > 1e-9) problems.push(label + ': glass at ' + JSON.stringify(at) + ' not ' + JSON.stringify(want));
      }
      m.dispose();
      return problems.length ? problems.join('; ') : true;
    });
    /* ----- preset roster (P5-04) ----- */
    const countBy = (list, pick) => list.reduce((acc, item) => { acc[pick(item)] = (acc[pick(item)] || 0) + 1; return acc; }, {});
    const presetStarters = () => ROSTER.filter((r) => r.role === 'starter').map((r) => r.id);
    test('Presets: 32 fighters with every field, 2 per style, 16 F / 16 M, 16 Block / 16 Sway, 10 starters, 12 unlocks, 6 rivals, 3 bosses, the champion', () => {
      const problems = [], text = (v) => typeof v === 'string' && v.length > 0;
      for (const r of ROSTER) {
        const bad = [];
        if (!/^[a-z]{3,6}$/.test(r.id) || r.name !== r.id.toUpperCase() || ROSTER_BY_ID[r.id] !== r) bad.push('id/name');
        if (!text(r.title) || !text(r.country) || !text(r.origin) || !text(r.goal)) bad.push('text');
        if (!Number.isInteger(r.age) || r.age < 19 || r.age > 57 || !['M', 'F'].includes(r.gender)) bad.push('age/gender');
        if (!['starter', 'unlock', 'rival', 'boss', 'champion'].includes(r.role)) bad.push('role');
        if (!Array.isArray(r.fit) || r.fit.length !== 2 || r.fit.some((v) => !(v >= 0 && v <= 1))) bad.push('fit');
        if (!MOVE_STYLE[r.moveStyle] || !DEFENSE_TYPES.includes(r.defense)) bad.push('style/defense');
        if (!(r.look.scale >= SCALE_MIN && r.look.scale <= SCALE_MAX && r.look.build >= BUILD_MIN && r.look.build <= BUILD_MAX)) bad.push('body');
        if (!ATTR_KEYS.every((k) => Number.isInteger(r.attrs[k]) && r.attrs[k] >= ATTR_MIN && r.attrs[k] <= ATTR_MAX) || !(r.range >= 1 && r.range <= 1.7) || !r.style) bad.push('attrs/range/style');
        if (bad.length) problems.push(r.id + ': ' + bad.join());
      }
      const styles = countBy(ROSTER, (r) => r.moveStyle), gender = countBy(ROSTER, (r) => r.gender), defense = countBy(ROSTER, (r) => r.defense), roles = countBy(ROSTER, (r) => r.role);
      const counts = ROSTER.length === 32 && new Set(ROSTER.map((r) => r.id)).size === 32 && MOVE_STYLE_IDS.length === 16 && MOVE_STYLE_IDS.every((id) => styles[id] === 2) && gender.F === 16 && gender.M === 16 &&
        defense.block === 16 && defense.sway === 16 && roles.starter === 10 && roles.unlock === 12 && roles.rival === 6 && roles.boss === 3 && roles.champion === 1;
      return !problems.length && counts ? true : JSON.stringify({ problems: problems.slice(0, 4), length: ROSTER.length, styles, gender, defense, roles });
    });
    test('Presets: the six kept fighters keep their ids, styles, attributes, ranks, ranges and bodies (saves, AI tuning and balance stay valid)', () => {
      const want = {
        kai: 'kickboxer|block|0|The Balanced|6,6,5,6,5,5,5,6|1.4|1|1', mara: 'capoeira|sway|4|The Viper|5,6,5,7,6,5,4,7|1.65|0.96|0.9', brutus: 'brawler|block|2|The Wall|7,5,7,5,5,6,5,6|1.35|1.1|1.28',
        yuki: 'boxer|sway|1|The Slipper|5,6,5,8,5,5,4,7|1.4|0.98|0.86', dmitri: 'wrestler|block|3|The Grappler|7,5,7,5,5,6,4,6|1.3|1.08|1.2', zero: 'karateka|block|5|The Champion|7,6,6,5,6,5,6,5|1.4|1.04|1.05',
      };
      const changed = Object.keys(want).filter((id) => { const r = ROSTER_BY_ID[id]; return [r.moveStyle, r.defense, r.rank, r.title, ATTR_KEYS.map((k) => r.attrs[k]).join(), r.range, r.look.scale, r.look.build].join('|') !== want[id]; });
      const order = ROSTER.slice(0, 6).map((r) => r.id).join() === 'kai,mara,brutus,yuki,dmitri,zero';
      const boss = ATTR_KEYS.map((k) => ROSTER_BY_ID.zero.bossAttrs.hard[k]).join() === '7,7,6,6,6,6,6,6' && attrTotal(ROSTER_BY_ID.zero.bossAttrs.easy) === 47;
      const ranks = ROSTER.filter((r) => r.rank !== undefined).length === 6 && Game.opponentsFor('kai').map((r) => r.id).join() === 'yuki,brutus,dmitri,mara,zero';
      return !changed.length && order && boss && ranks ? true : JSON.stringify({ changed, order, boss, ranks });
    });
    test('Presets: costs follow the role (44 / 45 / 46), speed 5 or more, builds follow the fitness mapping, all five weight classes, every look different, titles and names pass the theme rule', () => {
      const added = ROSTER.slice(6), cost = { starter: 44, unlock: 45, rival: 45, boss: 46 }, problems = [];
      for (const r of added) {
        if (attrTotal(r.attrs) !== cost[r.role]) problems.push(r.id + ' cost ' + attrTotal(r.attrs));
        if (r.attrs.speed < 5 || r.attrs.balance < 4 || r.attrs.health < 4) problems.push(r.id + ' weak spot');
        if (r.look.scale !== r.height || r.look.build !== presetBuild(r.fit)) problems.push(r.id + ' body');
        if (!r.look.skin || !SKIN_SWATCHES.includes(r.look.skin) || !HAIR_SWATCHES.includes(r.look.hair)) problems.push(r.id + ' skin/hair');
        for (const key of ['top', 'shorts', 'glove', 'shoe', 'accent']) if (r.look[key] !== undefined && !OUTFIT_SWATCHES.includes(r.look[key])) problems.push(r.id + ' ' + key);
        for (const key of Object.keys(LOOK_CHOICES)) if (r.look[key] !== undefined && !LOOK_CHOICES[key].options.includes(r.look[key])) problems.push(r.id + ' ' + key);
        if (r.look.glow === 'on' || r.look.hairStyle === 'mask') problems.push(r.id + ' glow/mask');
      }
      const keptFit = ROSTER.slice(0, 6).every((r) => Math.abs(presetBuild(r.fit) - r.look.build) <= 0.051);   // the mapping reproduces the six kept builds within one build step
      const heights = ROSTER.map((r) => r.look.scale), classes = new Set(ROSTER.map((r) => weightClass(r)));
      const spread = Math.min(...heights) === SCALE_MIN && Math.max(...heights) === SCALE_MAX && classes.size === 5;
      const ages = ROSTER.map((r) => r.age), ageSpread = Math.min(...ages) === 19 && Math.max(...ages) === 57;
      const signature = (r) => JSON.stringify(Object.assign({}, r.look, { scale: 0, build: 0 }));
      const looks = new Set(ROSTER.map(signature)).size === ROSTER.length && new Set(ROSTER.map((r) => [r.look.skin, r.look.hair, r.look.hairStyle, r.look.top, r.look.shorts].join())).size === ROSTER.length;
      const banned = /\b(ghost|phoenix|spectre|specter|titan|dragon|demon|devil|angel|wizard|witch|mage|magic|sorcerer|spirit|wraith|vampire|zombie|alien|robot|cyborg|android|laser|plasma|quantum|cosmic|galaxy|nova|xenon|volt|halo|umbra|orion|zephyr|ember|echo|onyx|raven|reaper|ninja|samurai|god|oracle|shaman|monster)\b/i;
      const theme = ROSTER.filter((r) => banned.test([r.name, r.title, r.country, r.origin, r.goal].join(' ')));
      return !problems.length && keptFit && spread && ageSpread && looks && !theme.length ? true : JSON.stringify({ problems: problems.slice(0, 4), keptFit, spread, ageSpread, looks, theme: theme.map((r) => r.id) });
    });
    test('Presets: starters are open from the start, every other preset has an unlock rule, the first Arcade run is the 1.0 ladder and later runs bring in the rivals and bosses, so all 32 can be unlocked', () => {
      const saved = keepProgress(), problems = [];
      try {
        Progress.d = Progress.fresh();
        const starters = presetStarters(), openAtStart = ROSTER.filter((r) => Progress.isUnlocked(r.id)).map((r) => r.id);
        if (starters.length !== 10 || openAtStart.join() !== starters.join() || DEFAULT_UNLOCKED.slice(0, 4).join() !== 'kai,mara,brutus,yuki') problems.push('starters ' + openAtStart.join());
        for (const r of ROSTER) {
          const rule = hasUnlockRule(r.id) ? UNLOCK_RULES[r.id] : null, beat = !!rule && rule[0] === 'beat';
          if (r.role === 'starter' ? !!rule || unlockRuleText(r.id) !== '' : !rule || !unlockRuleText(r.id) || beat !== (r.role === 'rival' || r.role === 'boss')) problems.push(r.id + ' rule');
        }
        if (Object.keys(UNLOCK_RULES).length !== 22 || hasUnlockRule('constructor') || unlockRuleText('c1') !== '') problems.push('rule table');
        if (Game.ladderFor('kai', 0).map((r) => r.id).join() !== 'yuki,brutus,dmitri,mara,zero') problems.push('first run is not the 1.0 ladder');
        const seenRivals = new Set(), seenBosses = new Set();
        for (const player of ROSTER.map((r) => r.id).concat(['c1'])) {
          for (let clears = 0; clears < 9; clears++) {
            const ladder = Game.ladderFor(player, clears), ids = ladder.map((r) => r.id);
            if (ladder.length !== ARCADE_STAGES || new Set(ids).size !== ARCADE_STAGES || ids.includes(player) || (player !== 'zero' && ids[4] !== 'zero')) problems.push(player + '/' + clears + ' ladder ' + ids.join());
            if (player === 'kai' && clears >= 1) {
              if (ladder[1].role !== 'rival' || ladder[2].role !== 'rival' || ladder[3].role !== 'boss' || ids[0] !== 'yuki') problems.push('kai/' + clears + ' roles ' + ids.join());
              if (clears <= 3) { seenRivals.add(ids[1]); seenRivals.add(ids[2]); seenBosses.add(ids[3]); }
            }
          }
        }
        if (seenRivals.size !== 6 || seenBosses.size !== 3) problems.push('rivals ' + seenRivals.size + ' bosses ' + seenBosses.size + ' in 3 later runs');
        // play it through: Arcade runs as KAI, crediting each win the way a match end does
        let runs = 0, thirdWin = '', beforeStreak = [];
        while (runs < 8 && ROSTER.some((r) => !Progress.isUnlocked(r.id) && UNLOCK_RULES[r.id][0] !== 'streak')) {
          const ladder = Game.ladderFor('kai', Progress.d.arcadeClears);
          for (let stage = 0; stage < ARCADE_STAGES; stage++) {
            const data = {}; Game.creditArcadeWin({ stage, ladder, continues: 0 }, data);
            if (runs === 0 && stage === 2) thirdWin = data.unlocked;
          }
          runs++;
        }
        beforeStreak = ['reid', 'camila', 'nia'].map((id) => Progress.isUnlocked(id));
        Progress.d.survivalKills = 8; const gained = Progress.checkUnlocks();
        const allOpen = ROSTER.every((r) => Progress.isUnlocked(r.id));
        if (runs > 5 || thirdWin !== 'DMITRI and LARS' || beforeStreak.some(Boolean) || gained.join() !== 'REID,CAMILA,NIA' || !allOpen) problems.push('unlocking: runs ' + runs + ' third win "' + thirdWin + '" before ' + beforeStreak + ' gained ' + gained + ' all ' + allOpen);
        // the cards: a locked one names its rule, an open one does not
        Progress.d = Progress.fresh();
        const locked = UI.fighterCard(ROSTER_BY_ID.deacon, 'pick', false), open = UI.fighterCard(ROSTER_BY_ID.rosa, 'pick', false), opponent = UI.fighterCard(ROSTER_BY_ID.deacon, 'opp', false);
        if (!locked.includes('LOCKED') || !locked.includes(esc(unlockRuleText('deacon'))) || open.includes('LOCKED') || opponent.includes('LOCKED')) problems.push('cards');
      } finally { restoreProgress(saved); }
      return problems.length ? problems.slice(0, 4).join('; ') : true;
    });
    test('Presets: a save from before P5-04 gets the new starters and keeps its unlocks, counters and records; what its counters earned is open too; unknown ids are dropped', () => {
      const saved = keepProgress(), problems = [];
      try {
        const old = { unlocked: ['kai', 'mara', 'brutus', 'yuki', 'dmitri', 'ghost', 'c1', 'constructor', 'hao'], arcadeClears: 2, arcadeBest: 5, arcadeFewestContinues: 1, wins: 12, losses: 3, survivalKills: 4, survivalSeconds: 100, controlsRevision: KEYS_REVISION };
        Store.set(KEY_PROGRESS, JSON.stringify(old));
        Progress.init();
        const d = Progress.d, open = (id) => d.unlocked.includes(id);
        if (!presetStarters().every(open)) problems.push('starters');
        if (!open('dmitri') || !open('hao') || !open('zero')) problems.push('kept unlocks');
        if (open('ghost') || open('c1') || open('constructor') || d.unlocked.length !== new Set(d.unlocked).size) problems.push('unknown ids');
        if (!['lars', 'tiago', 'vikram', 'armine', 'reid'].every(open) || ['lucia', 'kasia', 'naran', 'camila', 'deacon', 'tessa'].some(open)) problems.push('earned by the counters: ' + d.unlocked.join());
        if (d.arcadeClears !== 2 || d.arcadeBest !== 5 || d.wins !== 12 || d.losses !== 3 || d.survivalKills !== 4 || d.survivalSeconds !== 100 || d.arcadeFewestContinues !== 1) problems.push('counters');
        Store.set(KEY_PROGRESS, JSON.stringify({ arcadeClears: 0, controlsRevision: KEYS_REVISION }));
        Progress.init();
        if (Progress.d.unlocked.join() !== DEFAULT_UNLOCKED.join()) problems.push('a save with nothing earned: ' + Progress.d.unlocked.join());
      } finally { restoreProgress(saved); }
      return problems.length ? problems.slice(0, 4).join('; ') : true;
    });
    test('Presets: the fighter select lists all 32 (locked ones with their rule), every picker has them, the co-op pick cycles the open ones, the bio line names style, age, country, origin and goal', () => {
      const saved = keepProgress(), party = Game.selection.party.slice(), problems = [];
      try {
        Progress.d = Progress.fresh();
        Game.selection.mode = 'arcade'; Game.selection.player = 'lars';
        const html = UI.screen_char();
        const cards = ROSTER.filter((r) => html.includes('data-act="pick:' + r.id + '"')).length, lockedCards = (html.match(/ locked"/g) || []).length;
        if (cards !== 32 || lockedCards !== 22 || !html.includes(esc(unlockRuleText('lars'))) || !html.includes('Muay Thai, age 36') || !html.includes('Sweden, office worker') || !html.includes('goal: lose weight')) problems.push('select ' + cards + '/' + lockedCards);
        if (Game.opponentChoices('kai').length !== 31 + CustomRoster.profiles().length || Game.opponentChoices('kai', true).length !== 32 + CustomRoster.profiles().length || Game.opponentsFor('mara').length !== 5) problems.push('pickers');
        const open = Game.coopRoster().filter((r) => !r.custom).map((r) => r.id);
        if (open.join() !== presetStarters().join()) problems.push('co-op roster ' + open.join());
        Game.selection.party[0] = 'kai';
        const steps = []; for (let i = 0; i < 12; i++) steps.push(Game.cycleParty(0, 1));
        if (steps.slice(0, 3).join() !== 'mara,brutus,yuki' || steps.some((id) => !Progress.isUnlocked(id))) problems.push('co-op cycle ' + steps.join());
        if (Game.cycleParty(0, -1) === undefined) problems.push('co-op back');
        Game.selection.player = 'zero';
        if (!UI.screen_char().includes('locked: Clear Arcade')) problems.push('locked hint');
      } finally { Game.selection.party = party; restoreProgress(saved); }
      return problems.length ? problems.slice(0, 4).join('; ') : true;
    });
    test('Presets: every new preset plays an AI match against KAI without errors and lands hits', () => {
      const problems = [], hits = {};
      ROSTER.slice(6).forEach((r, i) => {
        try {
          const run = SimRunner.run({ playerId: r.id, opponentId: 'kai', seed: 100 + i, difficulty: 'hard', timer: 10, winsNeeded: 1, listeners: { hit: (e) => { hits[e.att.id] = (hits[e.att.id] || 0) + 1; } } });
          if (run.error) problems.push(r.id + ' ' + run.error);
          else if (!(run.ticks > 60) || run.hpLeft.some((hp) => !Number.isFinite(hp) || hp < 0 || hp > 1)) problems.push(r.id + ' ticks ' + run.ticks + ' hp ' + run.hpLeft.join('/'));
        } catch (e) { problems.push(r.id + ' ' + e.message); }
      });
      const silent = ROSTER.slice(6).filter((r) => !(hits[r.id] > 0)).map((r) => r.id);
      if (silent.length) problems.push('no hits from ' + silent.join());
      return problems.length ? problems.slice(0, 4).join('; ') : true;
    });
    /* ----- Sway (P3-01 / P3-02): MARA is a Sway fighter by default, KAI a Block fighter ----- */
    /* Presses Defend on fighter 2 so the opponent's strike goes active `lead` ticks into the sway (stateTicks = lead on the first active tick). */
    const swayAt = (lead) => {
      let done = false;
      return (it, f, o) => { if (!done && o.state === S.ATTACK && o.move && o.mStartup + 1 - o.moveTick === lead + 1) { it.defend = true; done = true; } };
    };
    test('Sway: defense types come from the style table, creator and roster agree', () => {
      const wantByStyle = { boxer: 'sway', wingchun: 'block', kickboxer: 'block', muaythai: 'block', karateka: 'block', taekwondo: 'sway', capoeira: 'sway', wrestler: 'block', judoka: 'sway', sambo: 'block',
        bjj: 'sway', hapkido: 'sway', kali: 'sway', kravmaga: 'block', mma: 'block', brawler: 'block' };   // P1-04: 7 Sway, 9 Block
      const styles = MOVE_STYLE_IDS.every((id) => defaultDefense(id) === wantByStyle[id]) && MOVE_STYLE_IDS.length === Object.keys(wantByStyle).length;
      const overrides = ['deacon', 'femke', 'amara', 'naran', 'tessa', 'roxy'];   // P1-06: the six presets whose defense differs from their style's default
      const roster = ROSTER.every((r) => DEFENSE_TYPES.includes(r.defense) && (r.defense === defaultDefense(r.moveStyle)) === !overrides.includes(r.id)) && ROSTER.some((r) => r.defense === 'block') && ROSTER.some((r) => r.defense === 'sway');
      const fighters = new Fighter(ROSTER_BY_ID.kai, 0).defense === 'block' && new Fighter(ROSTER_BY_ID.mara, 1).defense === 'sway';
      const noField = new Fighter(Object.assign({}, ROSTER_BY_ID.kai, { defense: undefined, moveStyle: 'boxer' }), 0).defense === 'sway';   // no field: the style decides
      return styles && roster && fighters && noField ? true : JSON.stringify({ styles, roster, fighters, noField });
    });
    test('Sway: strikes miss for 12 ticks (0-11), the next 15 ticks (12-26) leave the fighter open, grabs always connect', () => {
      const m = mk({}); self.place(m, 1.2);
      const att = m.fighters[0], def = m.fighters[1];
      att.startAttack(ATTACKS.jab); att.moveTick = att.mStartup + 1;   // the jab's first active tick
      def.setState(S.SWAY);
      const kinds = [];
      for (let n = 0; n < SWAY_TOTAL_TICKS; n++) { def.stateTicks = n; const d = Combat.evaluate(att, def); kinds.push(d ? d.type + (d.perfect ? '+' : '') : 'none'); }
      const dodged = kinds.slice(0, SWAY_IFRAME_TICKS), open = kinds.slice(SWAY_IFRAME_TICKS);
      const perfectFrom = dodged.indexOf('sway+');
      def.stateTicks = 3;
      att.startAttack(ATTACKS.grab); att.moveTick = att.mStartup + 1;
      const grab = Combat.evaluate(att, def);
      const ok = dodged.every((k) => k === 'sway' || k === 'sway+') && perfectFrom === SWAY_IFRAME_TICKS - SWAY_PERFECT_TICKS && dodged.slice(perfectFrom).every((k) => k === 'sway+') &&
        open.length === SWAY_RECOVERY_TICKS && open.every((k) => k === 'strike') && grab && grab.type === 'grab';
      return ok ? true : kinds.join() + ' grab ' + (grab && grab.type);
    });
    test('Sway: a jab that goes active inside the dodge misses; one that arrives in the recovery hits', () => {
      const trial = (defenderScript, attackerScript) => {
        const log = self.capture(['hit', 'block']);
        const m = mk({}, attackerScript, defenderScript); self.place(m, 1.2); self.run(m, 70); log.stop();
        const hp = m.fighters[1].hp, max = m.fighters[1].maxHp; m.dispose();
        return { hits: log.hit.length, blocks: log.block, lost: max - hp };
      };
      const dodge = trial(swayAt(3), once(2, 'punch'));
      const late = trial(once(3, 'defend'), (it, f, o, mm) => { if (mm.tick === 17) it.punch = true; });   // the jab goes active ~21 ticks into the sway
      const dodged = dodge.hits === 0 && dodge.lost === 0 && dodge.blocks.length === 1 && dodge.blocks[0].sway === true && !dodge.blocks[0].perfect;
      const hit = late.hits === 1 && late.lost > 0 && late.blocks.length === 0;
      return dodged && hit ? true : JSON.stringify({ dodge: { hits: dodge.hits, lost: dodge.lost, blocks: dodge.blocks.length }, late: { hits: late.hits, lost: late.lost } });
    });
    test('Sway: a strike that would have hit in the last 6 i-frame ticks is a perfect sway and opens one counter', () => {
      const log = self.capture(['block', 'attackStart']);
      let pressed = false;
      const swayer = (it, f, o, mm) => {
        swayAt(8)(it, f, o, mm);   // lead 8 = inside ticks 6-11
        if (f.counterWindow > 0 && f.state === S.IDLE && !pressed) { it.punch = true; pressed = true; }
      };
      const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.roundhouse); }, swayer); self.place(m, 1.2); self.run(m, 90); log.stop();   // a slower strike: the jab is gone before a sway pressed 8 ticks ahead
      const perfect = log.block.length === 1 && log.block[0].sway === true && log.block[0].perfect === true;
      const moves = log.attackStart.filter((e) => e.f.index === 1).map((e) => e.mv.id).join();
      const stats = m.stats[1].perfect === 1 && m.stats[1].blocks === 1;   // the match stats count a perfect sway
      const plain = (() => { const l = self.capture(['block']); const m2 = mk({}, once(2, 'punch'), swayAt(3)); self.place(m2, 1.2); self.run(m2, 40); l.stop(); const r = m2.fighters[1].counterWindow === 0 && l.block.length === 1 && !l.block[0].perfect; m2.dispose(); return r; })();
      return perfect && moves === 'counter_strike' && stats && plain ? true : JSON.stringify({ perfect, moves, stats, plain });
    });
    test('Sway costs 10 stamina; below 10 the press does nothing', () => {
      const attempt = (stamina) => {
        let before = 0;
        const m = mk({}, null, (it, f, o, mm) => { if (mm.tick === 3) { it.defend = true; before = f.stam; } }); self.place(m, 3);
        m.fighters[1].stam = stamina; self.run(m, 4);
        const f = m.fighters[1], r = { swaying: f.state === S.SWAY, spent: before - f.stam }; m.dispose(); return r;
      };
      const enough = attempt(20), short = attempt(8);
      return SWAY_COST === 10 && enough.swaying && Math.abs(enough.spent - 10) < 1 && !short.swaying && Math.abs(short.spent) < 1 ? true : JSON.stringify({ enough, short });
    });
    test('Sway: a held Defend sways once, a new press sways again; the lean follows the stick (back, left, right)', () => {
      const count = (script) => {
        const log = self.capture(['sway']);
        const m = mk({}, null, script); self.place(m, 3); m.fighters[1].stam = m.fighters[1].maxStam; self.run(m, 150); log.stop(); m.dispose();
        return log.sway.length;
      };
      const held = count((it, f, o, mm) => { if (mm.tick >= 3) it.defend = true; });
      const taps = count((it, f, o, mm) => { it.defend = mm.tick % 40 < 5; });
      const lean = (side, fwd) => {
        const m = mk({}, null, (it, f, o, mm) => { if (mm.tick === 3) { it.defend = true; it.side = side; it.fwd = fwd; } }); self.place(m, 3);
        const f = m.fighters[1]; self.run(m, 3); const x0 = f.x, z0 = f.z; self.run(m, 12);
        const r = { dir: f.swayDir, away: (f.x - x0) * f.fwdX + (f.z - z0) * f.fwdZ, across: (f.x - x0) * -f.fwdZ + (f.z - z0) * f.fwdX }; m.dispose(); return r;
      };
      const back = lean(0, 0), right = lean(1, 0), left = lean(-1, 0.2), fwdPush = lean(0, 1);
      const leans = back.dir === 0 && back.away < -0.1 && right.dir === 1 && right.across > 0.1 && left.dir === -1 && left.across < -0.1 && fwdPush.dir === 0 && fwdPush.away < -0.1;
      return held === 1 && taps >= 3 && leans ? true : JSON.stringify({ held, taps, back, right, left, fwdPush });
    });
    /* ----- Sway pose (P3-11): the drawn head and torso against the drawn strike ----- */
    const SWAY_POSE_GAP = 0.1;   // m of air between the surfaces of the body part and the striking limb: the visible gap the owner asked for
    const SWAY_POSE_RADIUS = { head: 0.12, torso: 0.15, foot: 0.1, tip: 0.1 };   // m: head sphere, chest depth at the torso point, a shoe, and the fist or foot that strikes
    const SWAY_TIP_POINT = { LA: 9, RA: 12, LL: 15, RL: 18 };   // Fighter.pts offset of the striking hand or foot
    const segmentDistance = (p, a, b) => {
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
      const u = len2 > 0 ? clamp((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2, 0, 1) : 0;
      return Math.hypot(a[0] + ab[0] * u - p[0], a[1] + ab[1] * u - p[1], a[2] + ab[2] * u - p[2]);
    };
    /* Fighter 1 of a style plays `mv` against fighter 2 of the same style; fighter 2 presses Defend at pressTick (-1: never). Returns one row per tick with the strike's
       limb tip and fighter 2's head, torso and feet in fighter 1's frame (forward, left, up in m), read from Fighter.pts: the same pose and skeleton the renderer draws. */
    const swayPoseRun = (id, mv, gap, pressTick, dir) => {
      const m = mk({ playerId: id, opponentId: id }, (it, f, o, mm) => { if (mm.tick === 40) f.startAttack(mv); }, (it, f, o, mm) => { if (mm.tick === pressTick) { it.defend = true; it.side = dir; } });
      const a = m.fighters[0], d = m.fighters[1];
      a.x = -gap / 2; d.x = gap / 2; a.z = d.z = 0; a.prevX = a.x; d.prevX = d.x;
      const ox = a.x, fx = a.fwdX, fz = a.fwdZ, at = (pts, i) => [(pts[i] - ox) * fx + pts[i + 2] * fz, -(pts[i] - ox) * fz + pts[i + 2] * fx, pts[i + 1]];
      const rows = [];
      for (let t = 0; t < 80; t++) {
        m.step();
        rows.push({ tick: m.tick, live: a.state === S.ATTACK && a.moveTick > a.mStartup && a.moveTick <= a.mStartup + a.mActive, attacking: a.state === S.ATTACK, swaying: d.state === S.SWAY, st: d.stateTicks,
          tip: at(a.pts, SWAY_TIP_POINT[mv.limb]), head: at(d.pts, 6), torso: at(d.pts, 3), footL: at(d.pts, 15), footR: at(d.pts, 18) });
      }
      const hp = d.hp === d.maxHp; m.dispose();
      return { rows, unhurt: hp };
    };
    /* The clearance of fighter 2's drawn head, torso and (for a low strike) feet from the strike during the sway's i-frames: on every tick where the strike is active
       and fighter 2 is inside them, the distance from each body point to the tip's path since the last tick. The spacing puts the unswayed torso on the furthest plane the tip
       reaches (the strike lands on the chest on screen and in the sim). `lead` = the i-frame tick the strike goes active on. */
    const swayPoseTrials = (styleId, mv, dirs, leads) => {
      const id = 'swaypose_' + styleId;
      ROSTER_BY_ID[id] = Object.assign({}, ROSTER_BY_ID.kai, { id, name: 'POSE', moveStyle: styleId, defense: 'sway' });
      try {
        const rest = swayPoseRun(id, mv, 1.8, -1, 0).rows;
        const peak = Math.max(...rest.filter((r) => r.attacking).map((r) => r.tip[0])), first = rest.find((r) => r.live);
        const gap = 1.8 + peak - rest[1].torso[0], out = [];
        for (const dir of dirs) for (const lead of leads) {
          const run = swayPoseRun(id, mv, gap, first.tick - lead, dir);
          const clear = { head: 9, torso: 9, foot: 9 }, rows = run.rows;
          let ticks = 0, firstSt = -1;
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i], prev = rows[i - 1];
            if (!r.live || !r.swaying || r.st >= SWAY_IFRAME_TICKS) continue;
            if (!ticks++) firstSt = r.st;
            clear.head = Math.min(clear.head, segmentDistance(r.head, prev.tip, r.tip)); clear.torso = Math.min(clear.torso, segmentDistance(r.torso, prev.tip, r.tip));
            clear.foot = Math.min(clear.foot, segmentDistance(r.footL, prev.tip, r.tip), segmentDistance(r.footR, prev.tip, r.tip));
          }
          out.push({ dir, lead, ticks, firstSt, unhurt: run.unhurt, clear });
        }
        return out;
      } finally { delete ROSTER_BY_ID[id]; }
    };
    test('Sway pose (P3-11): on every i-frame tick the drawn head and torso (feet too for a low strike) are clear of the drawn strike by 0.1 m, for each height, style and lean', () => {
      const need = { head: SWAY_POSE_RADIUS.head + SWAY_POSE_RADIUS.tip + SWAY_POSE_GAP, torso: SWAY_POSE_RADIUS.torso + SWAY_POSE_RADIUS.tip + SWAY_POSE_GAP, foot: SWAY_POSE_RADIUS.foot + SWAY_POSE_RADIUS.tip + SWAY_POSE_GAP };
      const bad = [], worst = { head: 9, torso: 9, foot: 9 };
      let trials = 0;
      for (const styleId of MOVE_STYLE_IDS) {
        const table = stringsFor(styleId), strikes = new Set();
        for (const side of ['stand', 'crouch']) for (const keys in table[side]) for (const id of table[side][keys]) { const mv = ATTACKS[id]; if (mv && mv.type === 'strike' && !mv.ctx) strikes.add(mv); }
        for (const h of ['H', 'M', 'L']) {
          const mv = [...strikes].filter((s) => s.h === h).sort((x, y) => y.reach - x.reach)[0];   // the longest strike of the height: the one that reaches the body furthest
          if (!mv) { bad.push(styleId + ' has no ' + h + ' strike'); continue; }
          for (const t of swayPoseTrials(styleId, mv, [0, 1, -1], [0, SWAY_IFRAME_TICKS - 1])) {   // back, left, right; the strike goes active on the first and on the last i-frame tick
            trials++;
            for (const part of ['head', 'torso']) worst[part] = Math.min(worst[part], t.clear[part]);
            if (h === 'L') worst.foot = Math.min(worst.foot, t.clear.foot);
            const short = t.clear.head < need.head || t.clear.torso < need.torso || (h === 'L' && t.clear.foot < need.foot);
            if (!t.unhurt || t.firstSt !== t.lead || short) bad.push([styleId, mv.id, 'dir', t.dir, 'lead', t.lead, t.unhurt ? '' : 'HIT', 'st', t.firstSt, 'clear', t.clear.head.toFixed(2), t.clear.torso.toFixed(2), t.clear.foot.toFixed(2)].join(' '));
          }
        }
      }
      return bad.length === 0 && trials === MOVE_STYLE_IDS.length * 3 * 6 ? true : JSON.stringify({ trials, need, worst, bad: bad.slice(0, 6) });
    });
    test('Sway pose (P3-11): the drawn lean covers exactly the i-frames: nearly full on the first tick, held to the last, upright 3 ticks after, for every style and lean, for KAI\'s body and the slowest legal Creator body', () => {
      const bad = [];
      for (const styleId of MOVE_STYLE_IDS) for (const dir of [0, 1, -1]) for (const slow of [false, true]) {
        const id = 'swaypose_' + styleId;
        ROSTER_BY_ID[id] = Object.assign({}, ROSTER_BY_ID.kai, { id, name: 'POSE', moveStyle: styleId, defense: 'sway' }, slow ? { attrs: Object.assign({}, ROSTER_BY_ID.kai.attrs, { speed: ATTR_MIN }) } : {});   // speed sets the pose blend of every other state
        try {
          const m = mk({ playerId: id, opponentId: id }, null, (it, f, o, mm) => { if (mm.tick === 10) { it.defend = true; it.side = dir; } }); self.place(m, 4);
          const f = m.fighters[1], lean = [];
          let rest = 0;
          for (let t = 0; t < 45; t++) {
            if (t === 9) rest = f.pose[J.torsoLean];
            m.step();
            if (f.state === S.SWAY) lean[f.stateTicks] = rest - f.pose[J.torsoLean];   // how far the drawn torso has tipped back
          }
          m.dispose();
          const peak = Math.max(...lean), early = lean.slice(0, SWAY_IFRAME_TICKS), after = lean[SWAY_IFRAME_TICKS + 3];
          if (peak < 0.6 || early.length !== SWAY_IFRAME_TICKS || early.some((v) => v < 0.85 * peak) || !(after <= 0.15 * peak)) bad.push(styleId + (slow ? ' slow' : '') + ' dir ' + dir + ' peak ' + peak.toFixed(2) + ' first ' + early[0].toFixed(2) + ' last ' + early[SWAY_IFRAME_TICKS - 1].toFixed(2) + ' after ' + (after === undefined ? '-' : after.toFixed(2)));
        } finally { delete ROSTER_BY_ID[id]; }
      }
      return bad.length === 0 ? true : bad.slice(0, 5).join('; ');
    });
    test('Sway pose (P3-11): a swayed strike passes by - no hit flash, no reaction, no spark or ring at the body (a perfect sway marks the floor), no damage', () => {
      const calls = [], real = { ring: FX.ring, sparks: FX.sparks, flash: FX.flash };
      FX.ring = (...a) => calls.push(['ring', ...a]); FX.sparks = (...a) => calls.push(['sparks', ...a]); FX.flash = (...a) => calls.push(['flash', ...a]);
      try {
        const watch = (attack, lead) => {
          calls.length = 0;
          const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(attack); }, swayAt(lead)); self.place(m, 1.2);
          const def = m.fighters[1], states = new Set();
          let flash = 0;
          for (let t = 0; t < 60; t++) { m.step(); states.add(def.state); flash = Math.max(flash, def.flash); }
          const r = { hurt: def.maxHp - def.hp, flash, states: [...states].join(), calls: calls.map((c) => c[0] + (c[0] === 'ring' ? '@' + c[2] : '')) }; m.dispose(); return r;
        };
        const plain = watch(ATTACKS.jab, 3), perfect = watch(ATTACKS.roundhouse, 8);
        const calm = (r) => r.hurt === 0 && r.flash === 0 && r.states.split(',').every((state) => state === S.IDLE || state === S.SWAY);
        const ok = calm(plain) && plain.calls.length === 0 && calm(perfect) && perfect.calls.length === 1 && perfect.calls[0] === 'ring@0.05';
        return ok ? true : JSON.stringify({ plain, perfect });
      } finally { Object.assign(FX, real); }
    });
    test('A Block fighter never sways, a Sway fighter never guards; both still get up quickly', () => {
      const swayLog = self.capture(['sway']);
      let blockerSwayed = false, swayerGuarded = false, blockerGuarded = false;
      const mash = (it, f, o, mm) => {
        it.defend = mm.tick % 6 < 3; it.crouch = mm.tick % 50 < 25;
        if (f.defense === 'block') { if (f.state === S.SWAY) blockerSwayed = true; if (f.state === S.BLOCK_H || f.state === S.BLOCK_L) blockerGuarded = true; }
        else if (f.state === S.BLOCK_H || f.state === S.BLOCK_L) swayerGuarded = true;
      };
      const m = mk({}, mash, mash); self.place(m, 3); self.run(m, 200); swayLog.stop(); m.dispose();
      const swaysBy = [0, 0]; swayLog.sway.forEach((e) => { swaysBy[e.f.index]++; });
      const rise = (id) => {
        const log = self.capture(['quickRise']);
        const m2 = mk({ playerId: id }, (it, f) => { if (f.state === S.DOWN && f.stateTicks >= 16) it.defend = true; });
        self.place(m2, 3); m2.fighters[0].setState(S.HIT); m2.fighters[0].setState(S.DOWN); self.run(m2, 50); log.stop(); m2.dispose();
        return log.quickRise.length;
      };
      const ok = !blockerSwayed && blockerGuarded && !swayerGuarded && swaysBy[0] === 0 && swaysBy[1] > 0 && rise('kai') === 1 && rise('mara') === 1;
      return ok ? true : JSON.stringify({ blockerSwayed, blockerGuarded, swayerGuarded, swaysBy, riseBlock: rise('kai'), riseSway: rise('mara') });
    });
    test('Block: a strong move that breaks a guard costs 8 % chip once plus the 30 % break damage, and never the last point of health', () => {
      const mv = ATTACKS.power_jab;
      const play = (hp) => {
        const m = mkBlock({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(mv); }, (it) => { it.defend = true; }); self.place(m, 1.2);
        const def = m.fighters[1]; if (hp) def.hp = hp;
        self.run(m, 40); const r = { lost: (hp || def.maxHp) - def.hp, left: def.hp, stun: def.state === S.STUN }; m.dispose(); return r;
      };
      const full = play(0), last = play(1);
      const want = mv.dmg * (0.08 + 0.3);
      return mv.tier === 3 && Math.abs(full.lost - want) < 0.01 && full.stun && last.left >= 1 ? true : JSON.stringify({ want, full, last });
    });
    test('Creator: the defense type saves, shares and loads; old codes and saves without it take the style default', () => {
      const saved = keepCustoms();
      try {
        const c = validateCustom(randomCustom(2468)).value;
        c.moveStyle = 'boxer'; c.defense = 'block';                     // against the style default (Sway)
        const blockBack = decodeCustom(encodeCustom(c), true);
        c.moveStyle = 'karateka'; c.defense = 'sway';                   // against the style default (Block)
        const swayBack = decodeCustom(encodeCustom(c), true);
        const fields = JSON.parse(fromBase64Url(encodeCustom(c).split('-')[1]));
        const reencode = (list) => { const p = toBase64Url(JSON.stringify(list)); return SHARE_PREFIX + '-' + p + '-' + shareChecksum(p); };
        const noDefense = decodeCustom(reencode(fields.slice(0, SHARE_FIELD_COUNT_STYLE)), true);        // a code from before defense types: style field, no defense
        const noStyle = decodeCustom(reencode(fields.slice(0, SHARE_FIELD_COUNT)), true);          // the oldest codes: neither
        const unknown = decodeCustom(reencode(fields.slice(0, SHARE_FIELD_COUNT_DEFENSE - 1).concat([7])), true);
        const oldSave = validateCustom(Object.assign({}, c, { defense: undefined }));
        // the same two cases with a Sway-default style, so an ignored style (always Block) fails
        const swayStyle = Object.assign({}, c, { moveStyle: 'boxer', defense: 'block' });
        const swayFields = JSON.parse(fromBase64Url(encodeCustom(swayStyle).split('-')[1]));
        const noDefenseSway = decodeCustom(reencode(swayFields.slice(0, SHARE_FIELD_COUNT_STYLE)), true);
        const oldSaveSway = validateCustom(Object.assign({}, swayStyle, { defense: undefined }));
        const badSave = validateCustom(Object.assign({}, c, { defense: 'ninja' }));
        CustomRoster.slots = new Array(CUSTOM_SLOTS).fill(null);
        CustomRoster.put(2, c); CustomRoster.init();
        const reloaded = CustomRoster.slots[2] && CustomRoster.slots[2].defense === 'sway';
        const profile = ROSTER_BY_ID.c3, fighter = profile && new Fighter(profile, 0);
        const clone = cloneCustom(c).defense === 'sway';
        const ok = blockBack.ok && blockBack.value.defense === 'block' && swayBack.ok && swayBack.value.defense === 'sway' &&
          noDefense.ok && noDefense.value.defense === 'block' && noStyle.ok && noStyle.value.defense === defaultDefense(ARCHETYPE_MOVE_STYLE[c.arch]) &&
          unknown.ok && unknown.value.defense === 'block' && oldSave.ok && oldSave.value.defense === 'block' && badSave.ok && badSave.value.defense === 'block' &&
          noDefenseSway.ok && noDefenseSway.value.defense === 'sway' && oldSaveSway.ok && oldSaveSway.value.defense === 'sway' &&
          reloaded && fighter && fighter.defense === 'sway' && clone && encodeCustom(c).length <= SHARE_MAX_LENGTH;
        return ok ? true : JSON.stringify({ blockBack: blockBack.value && blockBack.value.defense, swayBack: swayBack.value && swayBack.value.defense, noDefense: noDefense.value && noDefense.value.defense, noStyle: noStyle.value && noStyle.value.defense, unknown: unknown.value && unknown.value.defense, oldSave: oldSave.value && oldSave.value.defense, badSave: badSave.value && badSave.value.defense, reloaded, clone });
      } finally { restoreCustoms(saved); }
    });
    test('AI and Training dummy use the fighter\'s defense type: a Sway fighter sways and never raises a guard', () => {
      const log = self.capture(['sway']);
      const m = mk({ seed: 7 });
      m.controllers[0] = new AIController(m.fighters[0].profile, 'expert'); m.controllers[1] = new AIController(m.fighters[1].profile, 'expert');   // the quickest readers: a Sway AI only dodges what it sees coming in time
      let guarded = false;
      for (let i = 0; i < 1800; i++) { m.step(); const s = m.fighters[1].state; if (s === S.BLOCK_H || s === S.BLOCK_L) guarded = true; }
      log.stop(); m.dispose();
      const aiSways = log.sway.filter((e) => e.f.index === 1).length;
      const dummyLog = self.capture(['hit', 'block']);
      const m2 = mk({ mode: 'training', dummy: 'block' }, once(2, 'punch')); m2.controllers[1] = new DummyController(ROSTER_BY_ID.mara, 'block'); self.place(m2, 1.2); self.run(m2, 60); dummyLog.stop(); m2.dispose();
      const dummyDodged = dummyLog.hit.length === 0 && dummyLog.block.length === 1 && dummyLog.block[0].sway === true;
      return aiSways >= 1 && !guarded && dummyDodged ? true : JSON.stringify({ aiSways, guarded, dummyHits: dummyLog.hit.length, dummyBlocks: dummyLog.block.length });
    });
    test('Balance sample: Block and Sway fighters of equal stats each win some AI matches', () => {
      const split = self.defenseSplit(4, { difficulty: 'normal', winsNeeded: 1, timer: 40 });   // the full 45-55 % check is BREAKPOINT.simulate over 20+ seeds (see the tasklist)
      return !split.error && split.block >= 1 && split.sway >= 1 ? true : JSON.stringify(split);
    });
    test('Momentum (P3-09): the gauge fills from landed damage, perfect blocks and perfect sways, and from taking hits at a lower rate', () => {
      const log = self.capture(['hit']);
      const m = mk({}, once(2, 'punch')); self.place(m, 1.2); self.run(m, 40); log.stop();
      const [a, b] = m.fighters, dmg = log.hit.length === 1 ? log.hit[0].dmg : 0;
      const landed = dmg > 0 && Math.abs(a.momentum - dmg * MOMENTUM_PER_DAMAGE) < 0.01 && Math.abs(b.momentum - dmg * MOMENTUM_PER_DAMAGE * MOMENTUM_TAKEN_RATIO) < 0.01 && b.momentum > 0 && b.momentum < a.momentum;
      m.dispose();
      const blockLog = self.capture(['block']);
      const mb = mkBlock({}, once(2, 'punch'), (it, f, o, mm) => { if (mm.tick >= 5) it.defend = true; }); self.place(mb, 1.2); self.run(mb, 40); blockLog.stop();
      const perfectBlock = blockLog.block.length === 1 && blockLog.block[0].perfect && mb.fighters[1].momentum === MOMENTUM_PERFECT && mb.fighters[0].momentum === 0;
      mb.dispose();
      const swayLog = self.capture(['block']);
      const ms = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.roundhouse); }, swayAt(8)); self.place(ms, 1.2); self.run(ms, 60); swayLog.stop();
      const perfectSway = swayLog.block.length === 1 && swayLog.block[0].sway && swayLog.block[0].perfect && ms.fighters[1].momentum === MOMENTUM_PERFECT && ms.fighters[0].momentum === 0;
      ms.dispose();
      const plainLog = self.capture(['block']);
      const mp = mk({}, once(2, 'punch'), swayAt(3)); self.place(mp, 1.2); self.run(mp, 40); plainLog.stop();
      const plainSway = plainLog.block.length === 1 && !plainLog.block[0].perfect && mp.fighters[1].momentum === 0;   // a plain dodge is not rewarded
      mp.dispose();
      const blocked = (() => {   // a held guard (not perfect) gives nothing either
        const l = self.capture(['block']); const m2 = mkBlock({}, once(40, 'punch'), (it) => { it.defend = true; }); self.place(m2, 1.2); self.run(m2, 80); l.stop();
        const r = l.block.length === 1 && !l.block[0].perfect && m2.fighters[1].momentum === 0 && m2.fighters[0].momentum === 0; m2.dispose(); return r;
      })();
      const ok = landed && perfectBlock && perfectSway && plainSway && blocked && MOMENTUM_TAKEN_RATIO < 1;
      return ok ? true : JSON.stringify({ landed, dmg, a: a.momentum, b: b.momentum, perfectBlock, perfectSway, plainSway, blocked });
    });
    test('Momentum boost: a full gauge starts it by a real hit, the boost raises damage by the constant, lasts BOOST_TICKS, and the gauge stays empty until it ends', () => {
      const heavyDamage = (boosted) => {   // the same heavy hit with and without the boost, read from the hit event
        const log = self.capture(['hit']);
        const m = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.heavy_roundhouse); }); self.place(m, 1.2);
        if (boosted) m.fighters[0].boostTicks = BOOST_TICKS;
        self.run(m, 60); log.stop(); m.dispose();
        return log.hit.length === 1 ? log.hit[0].dmg : 0;
      };
      const plain = heavyDamage(false), boosted = heavyDamage(true);
      const ratioOk = plain > 10 && Math.abs(boosted / plain - BOOST_DAMAGE_MULT) < 0.01;
      const f0 = new Fighter(ROSTER_BY_ID.kai, 0);
      const multOk = f0.boostMult() === 1 && f0.damageMult(ATTACKS.jab) > 0 && (() => { const base = f0.damageMult(ATTACKS.jab); f0.boostTicks = 5; return Math.abs(f0.damageMult(ATTACKS.jab) / base - BOOST_DAMAGE_MULT) < 1e-9; })();
      // a match: three jabs while boosted, one after it ended
      const log = self.capture(['boostStart', 'boostEnd', 'hit']);
      let startAge = -1, endAge = -1, mid = -1;
      const offs = [Events.on('boostStart', (e) => { startAge = e.f.age; }), Events.on('boostEnd', (e) => { endAge = e.f.age; })];
      const m = mk({}, (it, f, o, mm) => { o.x = f.x + 1.0; o.z = f.z; o.prevX = o.x; o.prevZ = o.z; if (mm.tick === 2 || mm.tick === 90 || mm.tick === 150) it.punch = true; if (mm.tick >= 190 && mid < 0) mid = f.momentum; if (mm.tick === 520) it.punch = true; });
      self.place(m, 1.2);
      const a = m.fighters[0];
      a.momentum = MOMENTUM_MAX - 1;
      self.run(m, 140);
      const started = log.boostStart.length === 1 && log.boostStart[0].f === a && a.boostTicks > 0 && a.momentum === 0 && log.hit.length >= 2;   // the first hit filled the last point, the later ones found the gauge empty
      self.run(m, 60);
      const emptyDuring = a.boostTicks > 0 && a.momentum === 0 && mid === 0;
      self.run(m, 400); log.stop(); offs.forEach((off) => off());
      const lasted = log.boostEnd.length === 1 && log.boostEnd[0].f === a && endAge - startAge === BOOST_TICKS && a.boostTicks === 0;
      const refills = a.momentum > 0 && log.hit.length >= 4;   // after the boost the gauge fills again
      m.dispose();
      const trainFloor = (() => {   // Training: the boost starts, and a boosted heavy hit still leaves the infinite-health dummy at 1 hp
        const t = self.capture(['boostStart', 'ko']);
        const mt = mk({ mode: 'training' }, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.heavy_roundhouse); });
        mt.infiniteHp = true; self.place(mt, 1.2); mt.fighters[0].momentum = MOMENTUM_MAX - 1; mt.fighters[1].hp = 5; self.run(mt, 60); t.stop();
        const r = t.boostStart.length === 1 && mt.fighters[1].hp === 1 && mt.fighters[1].alive && t.ko.length === 0; mt.dispose(); return r;
      })();
      const koHit = (() => {   // outside Training the same boosted hit knocks out a 5 hp fighter through the normal KO path
        const t = self.capture(['ko']);
        const mk2 = mk({}, (it, f, o, mm) => { if (mm.tick === 2) f.startAttack(ATTACKS.heavy_roundhouse); });
        self.place(mk2, 1.2); mk2.fighters[0].boostTicks = BOOST_TICKS; mk2.fighters[1].hp = 5; self.run(mk2, 60); t.stop();
        const r = t.ko.length === 1 && mk2.fighters[1].state === S.KO && !mk2.fighters[1].alive; mk2.dispose(); return r;
      })();
      const ok = ratioOk && multOk && started && emptyDuring && lasted && refills && trainFloor && koHit && BOOST_DAMAGE_MULT > 1;
      return ok ? true : JSON.stringify({ plain, boosted, ratioOk, multOk, started, emptyDuring, lasted, span: endAge - startAge, refills, trainFloor, koHit });
    });
    test('Momentum boost: every round start clears the gauge and a running boost (both fighters)', () => {
      const m = mk({});
      const [a, b] = m.fighters;
      a.momentum = 60; b.momentum = 30; b.boostTicks = 120;
      m.startRound();
      const cleared = a.momentum === 0 && a.boostTicks === 0 && b.momentum === 0 && b.boostTicks === 0 && b.boostMult() === 1;
      a.momentum = 40; m.resetFighters();   // the Training reset places the fighters again
      const trainingReset = a.momentum === 0;
      return cleared && trainingReset ? true : JSON.stringify({ cleared, trainingReset, a: a.momentum, b: b.boostTicks });
    });
    test('Momentum boost: an AI fighter fills the gauge and boosts under the same rules (empty gauge during the boost, boosted damage, no extra input)', () => {
      const log = self.capture(['boostStart']);
      const m = mk({ seed: 7 });
      m.controllers[1] = new AIController(m.fighters[1].profile, 'hard');
      const ai = m.fighters[1];
      let steps = 0, bad = '';
      while (steps < 5000 && !log.boostStart.length) {
        m.step(); steps++;
        for (const f of m.fighters) if (f.momentum < 0 || f.momentum >= MOMENTUM_MAX || f.boostTicks < 0 || f.boostTicks > BOOST_TICKS || (f.boostTicks > 0 && f.momentum !== 0)) bad = f.name + ' ' + f.momentum + '/' + f.boostTicks;
      }
      log.stop();
      const started = log.boostStart.length === 1 && log.boostStart[0].f === ai && ai.boostTicks > 0 && ai.momentum === 0 && ai.boostMult() === BOOST_DAMAGE_MULT && m.controllers[1] instanceof AIController;
      m.dispose();
      return started && !bad ? true : JSON.stringify({ started, bad, steps, events: log.boostStart.map((e) => e.f.name) });
    });
    test('Clinch strikes (P3-03): elbow and knee have their own pose per style family, other styles use the default, and the strike itself is unchanged', () => {
      const strike = (styleId, strikeId) => {
        const m = mk({}); self.place(m, 0.8);
        const [a, b] = m.fighters;
        a.motion = makeMotion(Object.assign({}, a.profile, { moveStyle: styleId }), a.scale, a.build);
        a.setState(S.ATTACK); Combat.startClinch(a, b, m);
        const hp = b.hp;
        Combat.clinchStrike(a, b, CLINCH_MOVES[strikeId], m);
        const r = { lost: hp - b.hp, kindOk: a.state === S.GRAPPLE && a.clinchStrikeKind === strikeId && a.clinchStrikeAnim === CLINCH_STRIKE_ANIM_TICKS && a.clinchStrikes === 1 && a.motion.styleId === styleId };
        a.clinchStrikeAnim = 8;   // a mid-strike tick
        r.pose = new Float32Array(NP); a.grapplePose(r.pose);
        m.dispose();
        return r;
      };
      const far = (p, q) => { let d = 0; for (let i = 0; i < NP; i++) d = Math.max(d, Math.abs(p[i] - q[i])); return d; };
      const styles = MOVE_STYLE_IDS, problems = [];
      const got = {};
      for (const id of styles) for (const s of ['knee', 'elbow']) got[id + '.' + s] = strike(id, s);
      for (const key in got) if (!got[key].kindOk) problems.push('state ' + key);
      for (const s of ['knee', 'elbow']) {
        const lost = styles.map((id) => got[id + '.' + s].lost);
        if (new Set(lost).size !== 1 || !(lost[0] > 0)) problems.push('damage differs ' + s + ' ' + lost.join('/'));   // pure animation: the same blow in every style
        for (const [x, y] of [['kickboxer', 'boxer'], ['kickboxer', 'wrestler'], ['kickboxer', 'brawler'], ['boxer', 'wrestler'], ['boxer', 'brawler'], ['wrestler', 'brawler'], ['kickboxer', 'karateka'], ['boxer', 'karateka'], ['wrestler', 'karateka'], ['brawler', 'karateka']]) {
          if (far(got[x + '.' + s].pose, got[y + '.' + s].pose) < 0.2) problems.push(s + ' ' + x + ' = ' + y);
        }
        if (far(got['wrestler.' + s].pose, got['judoka.' + s].pose) > 0.001 || far(got['karateka.' + s].pose, got['capoeira.' + s].pose) > 0.001) problems.push(s + ' family mapping');
      }
      if (far(got['karateka.knee'].pose, got['karateka.elbow'].pose) < 0.2) problems.push('default knee = elbow');
      const knee = got['karateka.knee'].pose, u = 8 / CLINCH_STRIKE_ANIM_TICKS;
      if (Math.abs(knee[J.hipRx] - 1.2 * u) > 1e-4 || Math.abs(knee[J.knR] - (1.4 * u + 0.3)) > 1e-4) problems.push('default knee changed');   // the default is the pre-P3-03 knee
      return problems.length ? problems.join('; ') : true;
    });
    test('Motion: kicks land in front of the body at the reference heights', () => {
      const problems = [];
      for (const r of ROSTER) {
        const footAt = (mvId) => {
          const f = new Fighter(r, 0), mv = ATTACKS[mvId];
          f.state = S.ATTACK; f.move = mv; f.mStartup = mv.startup; f.mActive = mv.active; f.mRecovery = mv.recovery; f.moveTick = mv.startup + 1;
          f.computePose(); f.skeleton(0, 0, 0, 0, false);
          const foot = mv.limb === 'LL' ? 5 : 6;
          return { fwd: f.pts[foot * 3 + 2], up: f.pts[foot * 3 + 1] };
        };
        const round = footAt('roundhouse'), front = footAt('front_kick'), low = footAt('low_kick');
        if (round.fwd < 0.6 || front.fwd < 0.6 || low.fwd < 0.5) problems.push(r.id + ' foot behind: ' + [round.fwd, front.fwd, low.fwd].map((v) => v.toFixed(2)).join('/'));
        if (!(round.up > low.up + 0.25 && front.up > low.up + 0.25)) problems.push(r.id + ' heights ' + [round.up, front.up, low.up].map((v) => v.toFixed(2)).join('/'));
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Headless AI vs AI runner: seeded match ends with a winner, duration and damage per move type', () => {
      const opts = { seed: 3, timer: 30, winsNeeded: 1, playerId: 'kai', opponentId: 'brutus' };
      const a = SimRunner.run(opts), b = SimRunner.run(opts);
      if (a.winner !== 0 && a.winner !== 1) return 'no winner: ' + JSON.stringify(a.wins);
      if (!(a.seconds > 0)) return 'duration ' + a.seconds;
      const dealt = a.damage.map((d) => Object.values(d).reduce((sum, v) => sum + v, 0));
      if (!(dealt[0] + dealt[1] > 0)) return 'no damage recorded';
      if (!SimRunner.run({ arenaId: 'nowhere' }).error) return 'unknown arena accepted';
      return JSON.stringify(a) === JSON.stringify(b) ? true : 'same seed gave different results';
    });
    /* ----- N fighters in one scene (P4-01) ----- */
    /* The 1v1 path must not change: event log + result of three seeded matches, hashed, recorded from the code before P4-01 (kai-mara hard, zero-mara easy, the kai
       mirror on expert). A task that changes 1v1 behaviour on purpose (balance, AI, moves) has to record new values here. */
    /* Re-recorded 2026-10-29 for the P8-02 arenas; the old values live in the engine-neutrality test ("Levels: the engine of P8 changes no 1v1 result"). */
    const ONE_V_ONE_FINGERPRINTS = [
      { opts: { seed: 1, playerId: 'kai', opponentId: 'mara', arenaId: 'warehouse', difficulty: 'hard' }, hash: '101:e6hj22' },   // re-recorded 2026-10-30 for P14-01: Hard's perfect-block chance went from 0.2 to 0.25 (an intended balance change; the Easy and Expert matches are unchanged)
      { opts: { seed: 7, playerId: 'zero', opponentId: 'mara', arenaId: 'warehouse', difficulty: 'easy' }, hash: '103:mtun1h' },
      { opts: { seed: 3, playerId: 'kai', opponentId: 'kai', arenaId: 'pit', difficulty: 'expert' }, hash: '80:1dpzzwv' },
    ];
    const ONE_V_ONE_OLD_HASHES = ['108:1ymo6d9', '64:1563zst', '81:g3xni6'];   // the values the code before P8-02 (commit 05e3c78) gives for the same three matches on the pre-P8 layouts (the engine-neutrality test); the first uses Hard's perfect-block chance 0.25 of P14-01 (0.2 gave 64:shp12u): that old code, run from a git copy with only that number changed, gives 108:1ymo6d9, the same hash today's engine gives, so it still guards neutrality at Hard
    const FINGERPRINT_EVENTS = ['hit', 'block', 'throw', 'throwStart', 'knockdown', 'clinch', 'tackle', 'sway', 'sidestep', 'escape', 'submission', 'submissionEnd', 'fall', 'ko', 'roundStart', 'roundEnd', 'matchEnd'];
    const fingerprint = (opts) => {
      const lines = [];
      const listeners = {};
      for (const name of FINGERPRINT_EVENTS) listeners[name] = (e) => lines.push([name, e.att && e.att.index, e.def && e.def.index, e.f && e.f.index, typeof e.dmg === 'number' ? e.dmg.toFixed(3) : '', e.winner, e.round, e.result].join(','));
      const r = SimRunner.run(Object.assign({}, opts, { listeners }));
      lines.push(JSON.stringify([r.winner, r.ticks, r.rounds, r.wins, r.hpLeft]));
      return lines.length + ':' + fnv1a(lines.join('|')).toString(36);
    };
    test('N fighters: three seeded 1v1 matches keep the exact event log and result they had before the team / target generalisation', () => {
      const got = ONE_V_ONE_FINGERPRINTS.map((f) => fingerprint(f.opts)), want = ONE_V_ONE_FINGERPRINTS.map((f) => f.hash);
      return got.every((h, i) => h === want[i]) ? true : 'got ' + got.join(' ') + ' want ' + want.join(' ');
    });
    test('N fighters: a 1v6 brawl runs to a winner with no illegal transition or NaN, bodies stay apart, and every enemy is on team 1', () => {
      const illegal = Diag.illegalTransitions;
      const m = track(new MatchSim({ mode: 'brawl', enemies: BRAWL_MAX_ENEMIES, countdown: false, timer: 0, seed: 5, difficulty: 'normal', evenDamage: true }));
      m.controllers[0] = new AIController(m.fighters[0].profile, 'expert');
      let minGap = 9, bad = '', ticks = 0;
      while (m.phase !== 'matchEnd' && ticks < 20000 && !bad) {
        m.step(); ticks++;
        for (let i = 0; i < m.fighters.length && !bad; i++) {
          const f = m.fighters[i];
          if (![f.x, f.y, f.z, f.yaw, f.hp, f.stam].every(Number.isFinite)) bad = 'NaN in fighter ' + i + ' at tick ' + ticks;
          for (let j = i + 1; j < m.fighters.length; j++) {
            const g = m.fighters[j];
            if (f.alive && g.alive && Math.abs(f.y - g.y) < 1.25 && f.state !== S.CLINCH && f.state !== S.GRAPPLE && g.state !== S.CLINCH && g.state !== S.GRAPPLE && f.state !== S.THROWN && g.state !== S.THROWN) minGap = Math.min(minGap, Math.hypot(f.x - g.x, f.z - g.z));
          }
        }
      }
      const teams = m.fighters.map((f) => f.team).join('');
      const winnerLives = m.matchWinner === 0 ? m.teamAlive(TEAM_PLAYERS) && !m.teamAlive(TEAM_ENEMIES) : !m.teamAlive(TEAM_PLAYERS);
      const info = JSON.stringify({ bad, ticks, phase: m.phase, winner: m.matchWinner, teams, minGap: Math.round(minGap * 100) / 100, illegal: Diag.illegalTransitions - illegal });
      const ok = m.fighters.length === 1 + BRAWL_MAX_ENEMIES && teams === '0111111' && !bad && m.phase === 'matchEnd' && m.matchOver && (m.matchWinner === 0 || m.matchWinner === 1) && winnerLives &&
        Diag.illegalTransitions === illegal && minGap > 0.3;   // a body is 0.68 m wide: crowding may squeeze, never stack
      m.dispose();
      return ok ? true : info;
    });
    test('N fighters: a brawl is won when every enemy is out, lost when every player is out (also on a draw or the clock), and not decided before', () => {
      const result = (kill, opts) => {
        const m = self.makeBrawl(Object.assign({ enemies: 3 }, opts));
        self.run(m, 3);
        for (const k of kill) Combat.knockOut(m.fighters[k], null, null, m);
        self.run(m, KO_DELAY_TICKS + 20);   // the knock-out hit-stop (16 ticks) plus the delay
        const out = { phase: m.phase, over: m.matchOver, winner: m.matchWinner, wins: m.wins.join('-') };
        m.dispose();
        return out;
      };
      const none = result([]), partial = result([1, 2]), cleared = result([1, 2, 3]), downed = result([0]), draw = result([0, 1, 2, 3]), clock = result([], { timer: 1 });
      const ok = none.phase === 'fight' && !none.over && partial.phase === 'fight' && !partial.over && cleared.over && cleared.winner === 0 && cleared.wins === '1-0' &&
        downed.over && downed.winner === 1 && downed.wins === '0-1' && draw.over && draw.winner === 1 && clock.over && clock.winner === 1;
      return ok ? true : JSON.stringify({ none, partial, cleared, downed, draw, clock });
    });
    test('N fighters: teammates never damage each other (friendly fire off); the flag lets the players hurt each other but never the CPU enemies; the opposing team is still hit', () => {
      const run = (friendlyFire) => {
        const hits = [];
        const spam = (it, f, o, m) => { it.punch = m.tick % 30 === 2; };
        const m = self.makeBrawl({ friendlyFire }, null, spam);   // enemy 1 punches along the row: enemy 2 stands in reach, the player just beyond it
        self.stand(m.fighters[0], 1.9, 0, 0, 0); self.stand(m.fighters[1], 0, 0, 1.9, 0); self.stand(m.fighters[2], 0.8, 0, 1.9, 0);
        const log = self.capture(['hit']);
        self.run(m, 120);
        log.stop();
        for (const e of log.hit) hits.push(e.att.index + '>' + e.def.index);
        const out = { hits, ally: m.fighters[2].hp / m.fighters[2].maxHp, kinds: new Set(log.hit.map((e) => e.att.team === e.def.team)).size };
        m.dispose();
        return out;
      };
      const off = run(false), on = run(true);
      const friendly = (r) => r.hits.filter((h) => h === '1>2').length;
      const duo = (friendlyFire) => {   // two players on the same row: the first punches, the second stands in reach
        const m = track(new MatchSim({ mode: 'brawl', coop: [{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }], enemies: 1, friendlyFire, countdown: false, timer: 0, seed: 7, difficulty: 'normal', evenDamage: true }));
        try {
          m.controllers[0] = self.scripted((it, f, o, mm) => { it.punch = mm.tick % 30 === 2; }); m.controllers[1] = self.scripted(() => {}); m.controllers[2] = self.scripted(() => {});
          self.stand(m.fighters[0], 0, 0, 1.9, 0); self.stand(m.fighters[1], 0.8, 0, 1.9, 0); self.stand(m.fighters[2], 3, 0, 0, 0);
          self.run(m, 120);
          return m.fighters[1].hp < m.fighters[1].maxHp;
        } finally { m.dispose(); }
      };
      const players = { off: duo(false), on: duo(true) };
      const ok = friendly(off) === 0 && off.ally === 1 && friendly(on) === 0 && on.ally === 1 && !players.off && players.on;   // the CPU team never hurts itself, even with the flag on
      return ok ? true : JSON.stringify({ off, on, players });
    });
    test('N fighters: each fighter targets the nearest living hostile (ties by lower index), skips the out, follows its clinch partner, and a 1v1 targets the other fighter', () => {
      const m = self.makeBrawl({ enemies: 4 });
      const [p, e1, e2, e3, e4] = m.fighters;
      self.stand(p, 0, 0, 3, 0); self.stand(e1, 3, 0, 0, 0); self.stand(e2, 1.5, 0.5, 0, 0); self.stand(e3, -2, 2, 0, 0); self.stand(e4, 0.5, -4, 0, 0);
      m.assignTargets();
      const nearest = p.target === e2 && [e1, e2, e3, e4].every((e) => e.target === p);
      self.stand(e1, 2, 0, 0, 0); self.stand(e2, -2, 0, 0, 0); self.stand(e3, 0, 5, 0, 0); self.stand(e4, 0, -5, 0, 0);
      m.assignTargets();
      const tie = p.target === e1;   // e1 and e2 are equally near: the lower index wins
      e1.alive = false; e1.state = S.KO;
      m.assignTargets();
      const skipsOut = p.target === e2;
      e2.state = S.DEFEAT;
      m.assignTargets();
      const skipsTerminal = p.target === e3 || p.target === e4;   // both of those are 5 m away: the tie goes to e3
      e3.partner = e4; p.state = S.GRAPPLE; p.partner = e4;
      m.assignTargets();
      const partner = p.target === e4;
      p.state = S.IDLE; p.partner = null; for (const e of [e2, e3, e4]) { e.alive = false; e.state = S.KO; }
      m.assignTargets();
      const lastResort = p.target === e1 || p.target === e2 || p.target === e3 || p.target === e4;   // nobody valid is left: the nearest of any kind, never null
      m.dispose();
      const duel = mk({}); duel.assignTargets();
      const oneVsOne = duel.fighters[0].target === duel.fighters[1] && duel.fighters[1].target === duel.fighters[0];
      duel.fighters[1].alive = false; duel.fighters[1].state = S.KO; duel.assignTargets();
      const afterKo = duel.fighters[0].target === duel.fighters[1];
      const ok = nearest && tie && skipsOut && skipsTerminal && partner && lastResort && oneVsOne && afterKo;
      return ok ? true : JSON.stringify({ nearest, tie, skipsOut, skipsTerminal, partner, lastResort, oneVsOne, afterKo });
    });
    test('N fighters: a third fighter cannot grab into a clinch, and two grabs on one defender on the same tick make exactly one clinch', () => {
      const grabAt = (tick) => (it, f, o, m) => { it.grapple = m.tick === tick; };
      // enemy 1 grabs the player at tick 2; enemy 2 (same team as the grabber, hostile to the held player) grabs at tick 20, into the running clinch
      const late = self.makeBrawl({}, null, grabAt(2), grabAt(20));
      self.stand(late.fighters[0], 0, 0, 1, 0); self.stand(late.fighters[1], 0.8, 0, 0, 0); self.stand(late.fighters[2], 0.8, 0.5, 0, 0);
      let log = self.capture(['clinch']); self.run(late, 45); log.stop();
      const [p, g, third] = late.fighters;
      const held = p.state === S.CLINCH && g.state === S.GRAPPLE && p.partner === g && g.partner === p && third.partner === null && log.clinch.length === 1;
      const thirdState = third.state;
      // two grabbers on the same tick: the player is taken once
      const same = self.makeBrawl({}, null, grabAt(2), grabAt(2));
      self.stand(same.fighters[0], 0, 0, 1, 0); self.stand(same.fighters[1], 0.8, 0.1, 0, 0); self.stand(same.fighters[2], 0.8, -0.1, 0, 0);
      log = self.capture(['clinch']); self.run(same, 12); log.stop();
      const sp = same.fighters[0];
      const once1 = log.clinch.length === 1 && sp.state === S.CLINCH && sp.partner && sp.partner.partner === sp && same.fighters.filter((f) => f.partner).length === 2;
      // the evaluation itself: nobody grabs a fighter in a clinch or a grapple, a grabber's teammate included
      const probe = new Fighter(ROSTER_BY_ID.brutus, 3, TEAM_ENEMIES);
      probe.reset(0.3, 0.3, 0); probe.startAttack(ATTACKS.grab); probe.moveTick = probe.mStartup + 1; probe.yaw = Math.atan2(p.x - probe.x, p.z - probe.z);
      const intoHeld = Combat.evaluate(probe, p), intoGrabber = Combat.evaluate(probe, g);
      late.dispose(); same.dispose();
      const ok = held && once1 && !intoHeld && !intoGrabber;
      return ok ? true : JSON.stringify({ held, thirdState, clinches: log.clinch.length, once1, intoHeld: !!intoHeld, intoGrabber: !!intoGrabber });
    });
    test('N fighters: a fighter held in a submission cannot be stomped by a third fighter (control: the same low kick hits a downed fighter nobody holds)', () => {
      const m = self.makeBrawl({ enemies: 2 });
      const [p, holder, third] = m.fighters;
      p.setState(S.HIT); p.setState(S.DOWN);
      self.stand(p, 0, 0, 0, 1); self.stand(third, 0.7, 0, 0, 0);
      third.startAttack(ATTACKS.low_kick); third.moveTick = third.mStartup + 1;
      const free = Combat.evaluate(third, p);
      p.pinnedBy = holder;
      const held = Combat.evaluate(third, p);
      p.pinnedBy = third;
      const byHolder = Combat.evaluate(third, p);   // the holder's own attack still counts as before
      p.pinnedBy = null;
      m.dispose();
      const ok = free && free.type === 'ground' && !held && byHolder && byHolder.type === 'ground';
      return ok ? true : JSON.stringify({ free: free && free.type, held: !!held, byHolder: byHolder && byHolder.type });
    });
    test('N fighters: the brawl camera frames the player and the living enemies within range, or the nearest one when none is close', () => {
      const m = self.makeBrawl({ enemies: 3 });
      const [p, e1, e2, e3] = m.fighters;
      self.stand(p, 0, 0, 1, 0); self.stand(e1, 2, 0, 0, 0); self.stand(e2, -3, 1, 0, 0); self.stand(e3, 20, 0, 0, 0);
      const near = Camera.frameFighters(m.fighters), box = Camera.box.maxX - Camera.box.minX;
      e3.x = 4;
      const withThird = Camera.frameFighters(m.fighters);
      e2.alive = false;
      const afterKo = Camera.frameFighters(m.fighters);
      e1.alive = false; e3.x = 30;
      const lone = Camera.frameFighters(m.fighters);   // only e3 is left, out of range: the nearest living enemy is framed anyway
      m.dispose();
      const ok = near === 3 && withThird === 4 && afterKo === 3 && lone === 2 && Math.abs(box - 5) < 1e-9;
      return ok ? true : JSON.stringify({ near, withThird, afterKo, lone, box });
    });
    /* ----- Brawl camera (P4-06) ----- */
    /* Runs body on a 1280 x 720 screen with the camera snapped to the first frame, and puts the camera, the screen size, the shake and the FOV pulse back afterwards. */
    const withCamera = (body) => {
      const keep = { w: R.cssW, h: R.cssH, shake: Camera.shakeAmp, pulse: Camera.fovPulse, aspect: Camera.aspect, pos: Camera.pos.slice(), target: Camera.target.slice(), az: Camera.az, dist: Camera.dist, elev: Camera.elev };
      R.cssW = 1280; R.cssH = 720; Camera.snapNext = true; Camera.shakeAmp = 0;
      try { return body(); } finally {
        R.cssW = keep.w; R.cssH = keep.h; Camera.shakeAmp = keep.shake; Camera.fovPulse = keep.pulse; Camera.aspect = keep.aspect;
        for (let i = 0; i < 3; i++) { Camera.pos[i] = keep.pos[i]; Camera.target[i] = keep.target[i]; }
        Camera.az = keep.az; Camera.dist = keep.dist; Camera.elev = keep.elev;
        Camera.snapNext = true; Camera.resetGroup(); Camera.apply();
      }
    };
    const cameraFrames = (m, frames) => { for (let i = 0; i < frames; i++) { Camera.shakeAmp = 0; Camera.followGroup(1 / 60, m.fighters, m.def); } };
    const onScreen = (x, y, z) => {
      const out = [0, 0];
      return R.project(x, y, z, out) && out[0] > R.cssW * 0.03 && out[0] < R.cssW * 0.97 && out[1] > R.cssH * 0.03 && out[1] < R.cssH * 0.97;
    };
    const fighterOnScreen = (f) => onScreen(f.x, f.y, f.z) && onScreen(f.x, f.y + CAMERA_CHEST, f.z) && onScreen(f.x, f.y + CAMERA_FIGHTER_HEIGHT * f.scale, f.z);
    test('Brawl camera: in every arena, with the player walked behind each tall prop, the camera never leaves the player hidden for more than the limit (and the run does hide the player where a prop can)', () => withCamera(() => {
      const limitTicks = Math.round((CAMERA_OCCLUSION_GRACE + 0.6) * 60);   // the grace before the camera moves plus 0.6 s to swing clear
      const problems = [];
      for (const id of ARENA_ORDER) {
        const m = track(new MatchSim({ mode: 'brawl', enemies: 3, difficulty: 'normal', arenaId: id, countdown: false, timer: 0, seed: 5, evenDamage: true }));
        try {
          const p = m.fighters[0], b = m.def.bounds;
          m.controllers[0] = self.scripted(() => {});
          Camera.snapNext = true;
          let streak = 0, worst = 0, hiddenTicks = 0, x = 0, z = 0;
          const put = (px, pz) => { p.x = p.prevX = px; p.z = p.prevZ = pz; p.y = p.prevY = 0; p.hp = p.maxHp; };
          const tick = (px, pz) => {
            put(px, pz); m.step(); put(px, pz);
            Camera.shakeAmp = 0; Camera.followGroup(1 / 60, m.fighters, m.def);
            // the same line test the camera uses: from the eye as drawn to the player's chest
            if (!Arena.blockedAt(p.x, p.z, 0.2, 0) && Arena.rayBlocked(Camera.pos[0], Camera.pos[1], Camera.pos[2], p.x, p.y + CAMERA_CHEST * p.scale, p.z)) { hiddenTicks++;   // (the walk between two spots may cross a prop: nobody stands inside one)
             streak++; worst = Math.max(worst, streak); } else streak = 0;
          };
          for (let i = 0; i < 90; i++) tick(0, 0);
          const props = Arena.colliders.filter((c) => c.obj && c.obj.mat !== 'glass' && c.top >= 1.5 && !c.deck && !c.base);   // columns, posts, screens, racks (a deck is solid to the floor: nobody stands behind it inside it)
          for (const c of props) {
            // the spot: on the line from the eye through the prop's centre, just behind the prop; walked to at 3 m/s, then held
            let dx = c.x - Camera.pos[0], dz = c.z - Camera.pos[2];
            const len = Math.hypot(dx, dz); dx /= len; dz /= len;
            const reach = Math.min((c.hx + 0.34) / (Math.abs(dx) || 1e-9), (c.hz + 0.34) / (Math.abs(dz) || 1e-9)) + 0.05;   // as close behind the prop as a body (radius 0.34) can stand
            let gx = clamp(c.x + dx * reach, -(b.x - 0.4), b.x - 0.4), gz = clamp(c.z + dz * reach, -(b.z - 0.4), b.z - 0.4);
            if (Math.abs(gx - c.x) < c.hx + 0.34 && Math.abs(gz - c.z) < c.hz + 0.34) {   // a prop flush against a wall has no space behind it: the player stands 0.9 m off its free side farthest from the camera
              let far = null, farD = -1;
              for (const [ox, oz] of [[c.hx + 0.9, 0], [-(c.hx + 0.9), 0], [0, c.hz + 0.9], [0, -(c.hz + 0.9)]]) {
                const sx = c.x + ox, sz = c.z + oz, d = Math.hypot(sx - Camera.pos[0], sz - Camera.pos[2]);
                if (Math.abs(sx) <= b.x - 0.4 && Math.abs(sz) <= b.z - 0.4 && !Arena.blockedAt(sx, sz, 0.34, 0) && d > farD) { farD = d; far = [sx, sz]; }
              }
              if (!far) continue;
              gx = far[0]; gz = far[1];
            }
            const steps = Math.max(1, Math.ceil(Math.hypot(gx - x, gz - z) / 3 * 60));
            for (let s = 1; s <= steps; s++) tick(x + (gx - x) * s / steps, z + (gz - z) * s / steps);
            for (let s = 0; s < 120; s++) tick(gx, gz);
            x = gx; z = gz;
          }
          if (props.length && hiddenTicks === 0) problems.push(id + ': the player was never hidden (the check proved nothing)');
          if (worst > limitTicks) problems.push(id + ': hidden for ' + worst + ' ticks in a row (limit ' + limitTicks + ')');
        } finally { m.dispose(); }
      }
      return problems.length ? problems.join('; ') : true;
    }));
    test('Brawl camera: the enemy a player has locked stays on screen at any lock distance, also past CAMERA_THREAT_RANGE (control: unlocked, that far enemy is left out of the frame)', () => withCamera(() => {
      const problems = [];
      for (const id of ARENA_ORDER) {
        const m = self.makeBrawl({ enemies: 3, arenaId: id });
        try {
          const [p, e1, e2, e3] = m.fighters;
          self.stand(p, -3, 0, 1, 0); self.stand(e1, -4.5, 1, 0, 0); self.stand(e2, -2, -1.5, 0, 0);
          self.stand(e3, -3 + LOCK_RELEASE_RANGE - 0.5, 0.5, 0, 0);   // 8.5 m away: past the threat range, inside the lock's release range
          Camera.frameFighters(m.fighters);
          const leftOut = Camera.box.maxX < e3.x - 1;
          p.lockOn = e3;
          cameraFrames(m, 150);
          const framed = Camera.frameFighters(m.fighters) === 4;
          if (!leftOut) problems.push(id + ': control failed, the far enemy was framed without a lock');
          if (!framed || !fighterOnScreen(e3) || !fighterOnScreen(p)) problems.push(id + ': locked ' + fighterOnScreen(e3) + ' player ' + fighterOnScreen(p) + ' framed ' + framed);
          p.lockOn = null;
          cameraFrames(m, 240);   // the lock is gone: the far enemy may leave, the player may not
          if (!fighterOnScreen(p)) problems.push(id + ': player off screen after the lock ended');
        } finally { m.dispose(); }
      }
      return problems.length ? problems.join('; ') : true;
    }));
    test('Brawl camera: threats enter the frame at CAMERA_THREAT_RANGE and leave only past CAMERA_THREAT_LEAVE (no flicker at the edge); a dead enemy leaves at once', () => withCamera(() => {
      const m = self.makeBrawl({ enemies: 2 });
      try {
        const [p, e1, e2] = m.fighters;
        self.stand(p, 0, 0, 1, 0); self.stand(e1, 2, 0, 0, 0); self.stand(e2, CAMERA_THREAT_RANGE + 0.3, 0, 0, 0);
        const counts = [Camera.frameFighters(m.fighters)];   // e2 just outside: not framed
        e2.x = CAMERA_THREAT_RANGE - 0.1; counts.push(Camera.frameFighters(m.fighters));   // inside: framed
        e2.x = CAMERA_THREAT_RANGE + 0.3; counts.push(Camera.frameFighters(m.fighters));   // back out of the enter range, inside the leave range: stays
        for (let i = 0; i < 10; i++) { e2.x = CAMERA_THREAT_RANGE + 0.5 + (i % 2) * 0.4; counts.push(Camera.frameFighters(m.fighters)); }   // wobbling inside the band: still no change
        e2.x = CAMERA_THREAT_LEAVE + 0.1; counts.push(Camera.frameFighters(m.fighters));   // past the leave range: dropped
        e2.x = CAMERA_THREAT_RANGE + 0.3; counts.push(Camera.frameFighters(m.fighters));   // and not framed again until the enter range
        e2.x = CAMERA_THREAT_RANGE - 0.1; counts.push(Camera.frameFighters(m.fighters));
        e2.alive = false; counts.push(Camera.frameFighters(m.fighters));
        const want = '2,3,3,3,3,3,3,3,3,3,3,3,3,2,2,3,2'.split(',').map(Number);
        return counts.join() === want.join() ? true : 'framed counts ' + counts.join() + ' (wanted ' + want.join() + ')';
      } finally { m.dispose(); }
    }));
    test('Brawl camera: the player stays inside the screen when the enemies surround it from far off and when it stands in an arena corner', () => withCamera(() => {
      const problems = [];
      for (const id of ARENA_ORDER) {
        const m = self.makeBrawl({ enemies: 4, arenaId: id });
        try {
          const [p, ...foes] = m.fighters, b = m.def.bounds;
          const spots = [[-1, 0], [1, 0], [0, 1], [0, -1]];
          for (const corner of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
            self.stand(p, corner[0] * (b.x - 0.5), corner[1] * (b.z - 0.5), 0, 0);
            foes.forEach((f, k) => self.stand(f, p.x + spots[k][0] * CAMERA_THREAT_RANGE * 0.95, p.z + spots[k][1] * CAMERA_THREAT_RANGE * 0.95, p.x, p.z));
            Camera.snapNext = true;
            cameraFrames(m, 120);
            if (!fighterOnScreen(p)) problems.push(id + ' corner ' + corner + ': the player left the screen');
          }
        } finally { m.dispose(); }
      }
      return problems.length ? problems.join('; ') : true;
    }));
    test('Brawl camera: a player up on a crate with an enemy on the floor, and the reverse, keep both on screen (also with an exaggerated 3 m drop)', () => withCamera(() => {
      const problems = [];
      for (const [py, ey] of [[0.95, 0], [0, 0.95], [3, 0], [0, 3]]) {
        const m = self.makeBrawl({ enemies: 1, arenaId: 'warehouse' });
        try {
          const [p, e1] = m.fighters;
          self.stand(p, -1.5, 0, 1, 0); self.stand(e1, 2, 1, 0, 0);
          p.y = py; e1.y = ey;
          Camera.snapNext = true;
          cameraFrames(m, 150);
          if (!fighterOnScreen(p) || !fighterOnScreen(e1)) problems.push('player y ' + py + ', enemy y ' + ey + ': player ' + fighterOnScreen(p) + ', enemy ' + fighterOnScreen(e1));
          if (Math.abs(Camera.target[1] - (Math.min(py, ey) + Math.max(py, ey) + CAMERA_FIGHTER_HEIGHT) / 2) > 0.3) problems.push('player y ' + py + ', enemy y ' + ey + ': aimed at height ' + Camera.target[1].toFixed(2));
        } finally { m.dispose(); }
      }
      return problems.length ? problems.join('; ') : true;
    }));
    test('Brawl camera: an attacking enemy behind the camera or off to the side gets an edge arrow pointing its way; an attacker on screen and an idle enemy off screen get none', () => withCamera(() => {
      const m = self.makeBrawl({ enemies: 4 });
      const keepEls = UI.edgeEls, keepCache = {};
      for (let k = 0; k < BRAWL_MAX_ENEMIES; k++) for (const key of ['edge' + k, 'edgepos' + k]) { keepCache[key] = UI.cache[key]; delete UI.cache[key]; }   // an earlier match leaves these set: start from nothing cached
      try {
        const [p, behind, idle, side, near] = m.fighters, out = [0, 0, 0], W = R.cssW, H = R.cssH;
        self.stand(p, 0, 0, 1, 0); self.stand(behind, 2, 0, 0, 0); self.stand(idle, -2, 0.5, 0, 0); self.stand(side, 1, -1, 0, 0); self.stand(near, -1, 1, 0, 0);
        cameraFrames(m, 120);
        // enemies off screen: one straight behind the camera (holds a token), an idle one beside it, one far off to the right (mid-strike)
        behind.x = Camera.pos[0] - Camera.dirFwd[0] * 3; behind.z = Camera.pos[2] - Camera.dirFwd[1] * 3;
        idle.x = Camera.pos[0] - Camera.dirFwd[0] * 3 + Camera.dirRight[0] * 2; idle.z = Camera.pos[2] - Camera.dirFwd[1] * 3 + Camera.dirRight[1] * 2;
        side.x = Camera.target[0] + Camera.dirRight[0] * 40; side.z = Camera.target[2] + Camera.dirRight[1] * 40;
        m.assignTargets();
        m.crowd.token[behind.index] = true; m.crowd.tokenTarget[behind.index] = 0;
        side.startAttack(ATTACKS.low_kick);
        near.startAttack(ATTACKS.low_kick);   // attacking, but on screen
        const isBehind = Camera.offscreenMark(behind.x, behind.y + 1, behind.z, W, H, CAMERA_EDGE_PAD, out), behindMark = out.slice();
        const isSide = Camera.offscreenMark(side.x, side.y + 1, side.z, W, H, CAMERA_EDGE_PAD, out), sideMark = out.slice();
        const isNear = Camera.offscreenMark(near.x, near.y + 1, near.z, W, H, CAMERA_EDGE_PAD, out);
        const marks = [behindMark[1] > H * 0.5 && Math.abs(behindMark[1] - (H - CAMERA_EDGE_PAD)) < 1.5 && behindMark[2] > 0, sideMark[0] > W * 0.5 && Math.abs(sideMark[0] - (W - CAMERA_EDGE_PAD)) < 1.5 && Math.abs(sideMark[2]) < 0.6];   // bottom edge pointing down; right edge pointing right
        const attackers = [m.isAttacker(behind), m.isAttacker(idle), m.isAttacker(side), m.isAttacker(near)];
        // the HUD end: shown for the attackers that are off screen only
        UI.edgeEls = Array.from({ length: BRAWL_MAX_ENEMIES }, () => ({ style: {} }));
        UI.edgeMarks(m);
        const shown = UI.edgeEls.slice(0, 4).map((el) => el.style.display === '');
        UI.edgeMarks(Object.assign(Object.create(m), { brawl: false }));   // not a brawl: all hidden
        const hiddenAgain = UI.edgeEls.every((el) => el.style.display === 'none');
        const ok = isBehind && isSide && !isNear && marks[0] && marks[1] && attackers.join() === 'true,false,true,true' && shown.join() === 'true,false,true,false' && hiddenAgain;
        return ok ? true : JSON.stringify({ isBehind, isSide, isNear, behindMark, sideMark, attackers, shown, hiddenAgain });
      } finally {
        UI.edgeEls = keepEls;
        for (const key of Object.keys(keepCache)) { if (keepCache[key] === undefined) delete UI.cache[key]; else UI.cache[key] = keepCache[key]; }
        m.dispose();
      }
    }));
    test('Brawl camera: the 1v1 / Versus follow camera gives exactly the output it gave before P4-06 (fixed input, values recorded from the old code)', () => withCamera(() => {
      const want = [[4.399824513,3.76750504,6.305148317,2.056297643,1,1.234678994,0.4329458457,6.233848048,0.46],[4.246652143,3.684648811,6.526843154,2.450772662,1,1.414479317,0.3378161231,6.047213107,0.46],[2.833292408,3.667920427,6.670450388,2.153959277,1,1.328617005,0.1264932798,6.009532162,0.46],[0.7051743468,3.890785698,6.312001161,1.176524068,1.226242674,0.9546568807,-0.08775600399,6.00192451,0.46],[-0.8671083798,3.734882239,5.683746558,-0.1974761537,1.071021101,0.3489457845,-0.1248684442,6.000388552,0.46],[-1.802165668,3.673335129,4.999321368,-1.517787721,1.009611661,-0.3695377138,-0.0529185881,6.000078447,0.46]];
      const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 11, arenaId: 'dojo' }));
      try {
        const a = m.fighters[0], b = m.fighters[1], got = [];
        const oldDojo = { bounds: { x: 7.5, z: 4.6 }, camera: { minDist: 6.0, maxDist: 11.5, elev: 0.46 } };   // the camera-relevant fields of the arena the values were recorded in (the Dojo before P8-02 made it the City Fight Gym)
        Camera.snapNext = true; Camera.az = 0.2; Camera.dist = 8; Camera.elev = 0.46; Camera.aspect = 1.78; Camera.fovPulse = 0;   // the camera as it is at boot, which is where the recorded run started
        Camera.target[0] = 0; Camera.target[1] = 1; Camera.target[2] = 0;
        for (let i = 0; i < 180; i++) {
          const t = i / 60;
          a.x = -2 + Math.sin(t * 1.3) * 3; a.z = Math.cos(t * 0.7) * 2; a.y = i > 100 && i < 130 ? 0.9 : 0;
          b.x = 2.5 + Math.cos(t * 0.9) * 2.5; b.z = Math.sin(t * 1.1) * 1.5; b.y = 0;
          Camera.follow(1 / 60, a, b, oldDojo);
          if (i % 30 === 29) got.push([Camera.pos[0], Camera.pos[1], Camera.pos[2], Camera.target[0], Camera.target[1], Camera.target[2], Camera.az, Camera.dist, Camera.elev]);
        }
        const worst = Math.max(...got.map((row, r) => Math.max(...row.map((v, c) => Math.abs(v - want[r][c])))));
        return worst < 1e-8 ? true : 'differs by ' + worst;
      } finally { m.dispose(); }
    }));
    /* ----- Group AI (P4-02): attack tokens, ring, retreat, per-attacker combos ----- */
    /* A brawl whose player is a body that cannot lose: idle, at the arena centre, health and position restored every tick, so the CPU enemies attack and wait for as long as the
       test runs. direct = the control run: the director switched off, which is what a brawl was before P4-02. onTick(m, t) runs after every step. */
    const crowdRun = (enemies, difficulty, seed, ticks, onTick, direct) => {
      const m = track(new MatchSim({ mode: 'brawl', enemies, difficulty, countdown: false, timer: 0, seed, evenDamage: true }));
      const p = m.fighters[0];
      m.controllers[0] = self.scripted(() => {});
      if (direct) m.crowd.update = () => {};
      for (let t = 0; t < ticks; t++) {
        p.hp = p.maxHp; p.x = p.prevX = 0; p.z = p.prevZ = 0;
        m.step();
        onTick(m, t);
      }
      return m;
    };
    const attacking = (f) => f.alive && ((f.state === S.ATTACK && !(f.move && f.move.type === 'pickup')) || f.state === S.GRAPPLE || f.state === S.SUBMIT);   // grabbing an item (P7) is no attack
    test('Group AI: no more fighters attack one target at once than it has tokens, at every difficulty over a long 1v6 brawl; tokens go round fairly and the run is repeatable (control: without the director all six attack)', () => {
      const run = (difficulty, seed, direct) => {
        const grants = [0, 0, 0, 0, 0, 0, 0], held = [false, false, false, false, false, false, false], log = [];
        let most = 0, tokensOver = 0;
        const m = crowdRun(6, difficulty, seed, 2400, (match, t) => {
          let now = 0;
          for (let i = 1; i < match.fighters.length; i++) {
            if (attacking(match.fighters[i])) now++;
            if (match.crowd.token[i] && !held[i]) { grants[i]++; log.push(t + ':' + i); }
            held[i] = match.crowd.token[i];
          }
          most = Math.max(most, now);
          if (match.crowd.holders(0) > match.crowd.capFor(0)) tokensOver++;
        }, direct);
        const cap = m.crowd.capFor(0);
        m.dispose();
        return { most, cap, tokensOver, grants: grants.slice(1), log: log.join(',') };
      };
      const problems = [];
      for (const [difficulty, cap] of [['easy', 1], ['normal', 2], ['expert', 3]]) {
        const r = run(difficulty, 4, false), control = run(difficulty, 4, true);
        if (r.cap !== cap || r.most > cap || r.tokensOver > 0) problems.push(difficulty + ': cap ' + r.cap + ' most ' + r.most + ' over ' + r.tokensOver);
        if (r.most < 1 || r.grants.some((n) => n < 2)) problems.push(difficulty + ': tokens never used ' + r.grants.join('/'));
        if (Math.max(...r.grants) - Math.min(...r.grants) > 1) problems.push(difficulty + ': unfair grants ' + r.grants.join('/'));
        if (control.most <= cap) problems.push(difficulty + ': control run never exceeded the cap (' + control.most + ')');
      }
      const again = run('normal', 4, false), first = run('normal', 4, false);
      if (again.log !== first.log || again.log.length === 0) problems.push('the same seed gave different grants');
      return problems.length ? problems.join('; ') : true;
    });
    test('Group AI: tokens go to the oldest waiter, ties to the lower index; a holder gives the token back when its attack is over, when it is hit and when it never starts', () => {
      const m = crowdRun(3, 'easy', 6, 1, () => {});   // easy: one token, so each grant is visible on its own
      const c = m.crowd;
      const firstOk = c.token[1] && !c.token[2] && !c.token[3] && c.holders(0) === 1;   // everyone has waited since the start: the lowest index goes first
      c.token.fill(false); c.tokenTarget.fill(-1); c.nextGrant.fill(0); c.restUntil.fill(0);
      c.waitSince[1] = 50; c.waitSince[2] = 10; c.waitSince[3] = 10;
      c.grant(0, 1, m.tick);
      const oldest = c.token[2] && !c.token[1] && !c.token[3];   // 2 and 3 waited longest and tie: 2
      c.usedToken[2] = true; c.release(2, m.tick);   // 2 attacked with it: it rests
      c.nextGrant.fill(0);
      c.grant(0, 1, m.tick);
      const resting = !c.token[2] && c.token[3] && c.restUntil[2] > m.tick;   // 2 is resting and has the newest wait time: 3 is next
      c.token[3] = false; c.release(3, m.tick);   // 3 never started: no rest, back to the end of the queue
      const unusedNoRest = c.restUntil[3] === m.tick;
      // the holder is hit: the token goes back at once
      m.fighters[3].setState(S.HIT);
      c.upkeepToken(3, m.tick + 1);
      const hit = !c.token[3];
      // never started: back after TOKEN_PATIENCE_TICKS
      c.nextGrant.fill(0); c.restUntil.fill(0); m.fighters[3].setState(S.IDLE);
      c.grant(0, 1, m.tick);
      const holder = c.token.indexOf(true);
      c.upkeepToken(holder, c.grantTick[holder] + TOKEN_PATIENCE_TICKS);
      const kept = c.token[holder];
      c.upkeepToken(holder, c.grantTick[holder] + TOKEN_PATIENCE_TICKS + 1);
      const patience = holder > 0 && kept && !c.token[holder];
      // an attack that has begun keeps the token until it ends
      c.nextGrant.fill(0); c.restUntil.fill(0);
      c.grant(0, 1, m.tick);
      const attacker = c.token.indexOf(true);
      m.fighters[attacker].state = S.ATTACK;
      c.upkeepToken(attacker, c.grantTick[attacker] + 5);
      const duringAttack = c.token[attacker];
      m.fighters[attacker].state = S.IDLE;
      c.upkeepToken(attacker, c.grantTick[attacker] + 6);
      const afterAttack = !c.token[attacker];
      m.dispose();
      const ok = firstOk && oldest && resting && unusedNoRest && hit && patience && duringAttack && afterAttack;
      return ok ? true : JSON.stringify({ firstOk, oldest, resting, unusedNoRest, hit, patience, duringAttack, afterAttack });
    });
    test('Group AI: waiting enemies spread around the target on a ring just outside its reach, never closer than 0.6 m to each other (control: without the director they crowd in close and bunch up on one side)', () => {
      const measure = (direct) => {
        let minGap = 9, sumR = 0, samples = 0, sumDist = 0, count = 0;
        const m = crowdRun(6, 'normal', 4, 2400, (match, t) => {
          if (t < 300) return;
          const free = [];
          for (let i = 1; i < match.fighters.length; i++) {
            const f = match.fighters[i];
            if (f.alive && (direct || (match.crowd.engaged[i] && !match.crowd.token[i])) && (f.state === S.IDLE || f.state === S.WALK)) free.push(f);
          }
          for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) minGap = Math.min(minGap, Math.hypot(free[a].x - free[b].x, free[a].z - free[b].z));
          if (free.length < 3) return;
          let sx = 0, sz = 0;
          for (const f of free) { const d = Math.hypot(f.x, f.z) || 1; sx += f.x / d; sz += f.z / d; sumDist += d; count++; }
          sumR += Math.hypot(sx, sz) / free.length; samples++;
        }, direct);
        const reach = m.crowd.reachDistance(m.fighters[0]);
        m.dispose();
        return { minGap, spread: samples ? sumR / samples : 1, dist: count ? sumDist / count : 0, samples, reach };
      };
      const ring = measure(false), control = measure(true);
      // spread = the length of the average direction from the target to the waiting fighters: 1 = all on one side, 0 = evenly all round
      const ok = ring.samples > 500 && ring.minGap > 0.6 && ring.spread < 0.3 && ring.spread < control.spread && ring.dist > ring.reach && ring.dist < ring.reach + 1.5 && control.dist < ring.reach;
      return ok ? true : JSON.stringify({ ring, control });
    });
    test('Group AI: a hurt or exhausted enemy without a token backs off to the outer edge of the ring and rests; a healthy one does not', () => {
      const trial = (hurt, tired) => {
        let backed = false, backedFar = 0, ended = false, tokenWhileBacking = false;
        const m = crowdRun(3, 'normal', 8, 900, (match, t) => {
          const c = match.crowd, f = match.fighters[2];
          if (t === 0) { if (hurt) f.hp = f.maxHp * 0.2; if (tired) f.stam = f.maxStam * 0.1; }
          if (c.retreat[2]) { backed = true; backedFar = Math.max(backedFar, Math.hypot(f.x, f.z)); if (c.token[2]) tokenWhileBacking = true; } else if (backed) ended = true;
        });
        const ring = m.crowd.ringRadius(m.fighters[0]);
        m.dispose();
        return { backed, backedFar, ended, tokenWhileBacking, ring };
      };
      const hurt = trial(true, false), tired = trial(false, true), healthy = trial(false, false);
      const away = (r) => r.backed && r.backedFar > r.ring + RETREAT_EXTRA - 0.7 && !r.tokenWhileBacking;
      const ok = away(hurt) && away(tired) && tired.ended && !healthy.backed;   // the tired one rests, recovers and rejoins; the hurt one stays out for RETREAT_MAX_TICKS at most
      return ok ? true : JSON.stringify({ hurt, tired, healthy });
    });
    test('Group AI: a combo belongs to one attacker; a hit by another attacker closes it (comboEnd) and starts a new one with the damage scaling back at the start, and a 1v1 combo never ends that way', () => {
      const first = (att) => {   // damage of the first hit of a fresh combo by this enemy
        const m = self.makeBrawl({ enemies: 2 });
        const log = self.capture(['hit']);
        Combat.landHit({ type: 'strike', att: m.fighters[att], def: m.fighters[0], mv: ATTACKS.jab, block: 'none' }, m);
        log.stop();
        const dmg = log.hit[0].dmg;
        m.dispose();
        return dmg;
      };
      const fresh1 = first(1), fresh2 = first(2);
      const m = self.makeBrawl({ enemies: 2 });
      const [p, a, b] = m.fighters;
      const log = self.capture(['hit', 'comboEnd']);
      const strike = (att) => { p.setState(S.IDLE); Combat.landHit({ type: 'strike', att, def: p, mv: ATTACKS.jab, block: 'none' }, m); };
      strike(a); strike(a); strike(a);
      const afterA = { got: p.gotHits, foe: p.comboFoe === a, aHits: a.comboHits };
      strike(b);
      const afterB = { got: p.gotHits, foe: p.comboFoe === b, aHits: a.comboHits, bHits: b.comboHits, ended: log.comboEnd.map((e) => e.att.index + ':' + e.hits).join() };
      strike(a);
      const hits = log.hit.map((e) => e.dmg);
      const afterA2 = { got: p.gotHits, foe: p.comboFoe === a, ended: log.comboEnd.map((e) => e.att.index + ':' + e.hits).join(), aHits: a.comboHits };
      for (let t = 0; t < 120; t++) { p.hp = p.maxHp; m.step(); }   // calm: the open combo ends by itself, credited to its owner with the defender's own counts
      const last = log.comboEnd[log.comboEnd.length - 1];
      log.stop();
      const natural = last && last.att === a && last.hits === 1 && Math.abs(last.damage - hits[4]) < 1e-9 && p.gotHits === 0;
      m.dispose();
      // 1v1: the same fighter hits again and again, nothing ends and the count and the scaling carry on
      const duel = self.make({}, null, null);
      const dl = self.capture(['hit', 'comboEnd']);
      for (let k = 0; k < 3; k++) { duel.fighters[1].setState(S.IDLE); Combat.landHit({ type: 'strike', att: duel.fighters[0], def: duel.fighters[1], mv: ATTACKS.jab, block: 'none' }, duel); }
      dl.stop();
      const duelOk = duel.fighters[1].gotHits === 3 && duel.fighters[0].comboHits === 3 && dl.comboEnd.length === 0 && dl.hit[2].dmg < dl.hit[0].dmg;
      duel.dispose();
      const ok = afterA.got === 3 && afterA.foe && afterA.aHits === 3 && hits[2] < hits[0] &&
        afterB.got === 1 && afterB.foe && afterB.aHits === 3 && afterB.bHits === 1 && afterB.ended === '1:3' && Math.abs(hits[3] - fresh2) < 1e-9 &&
        afterA2.got === 1 && afterA2.foe && afterA2.ended === '1:3,2:1' && Math.abs(hits[4] - hits[0]) < 1e-9 && Math.abs(hits[0] - fresh1) < 1e-9 && natural && duelOk;
      return ok ? true : JSON.stringify({ fresh1, fresh2, hits, afterA, afterB, afterA2, natural, duelOk });
    });
    test('Group AI: a 1v1 and the last enemy of a brawl never use tokens or the ring (the seeded 1v1 fingerprints above cover the exact play); hooks for weapons and hazards (P7) exist and do nothing', () => {
      const duel = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 9, difficulty: 'hard' }));
      let usedDuel = false;
      for (let t = 0; t < 900; t++) { duel.step(); if (duel.crowd.engaged.some(Boolean) || duel.crowd.token.some(Boolean)) usedDuel = true; }
      duel.dispose();
      const lone = track(new MatchSim({ mode: 'brawl', enemies: 1, countdown: false, timer: 0, seed: 9, difficulty: 'hard', evenDamage: true }));
      let usedLone = false, attacked = false;
      for (let t = 0; t < 900; t++) { lone.step(); if (lone.crowd.engaged.some(Boolean) || lone.crowd.token.some(Boolean)) usedLone = true; if (attacking(lone.fighters[1])) attacked = true; }
      lone.dispose();
      const left = crowdRun(3, 'normal', 9, 1, () => {});   // two of the three knocked out: the one left plays a duel again
      Combat.knockOut(left.fighters[2], null, null, left); Combat.knockOut(left.fighters[3], null, null, left);
      let usedLast = false, lastAttacks = false;
      for (let t = 0; t < 700; t++) {
        left.fighters[0].hp = left.fighters[0].maxHp; left.step();
        if (t >= 20 && (left.crowd.engaged[1] || left.crowd.token[1])) usedLast = true;   // the knock-outs freeze the sim for 16 ticks of hit-stop; the flags catch up after that
        if (attacking(left.fighters[1])) lastAttacks = true;
      }
      left.dispose();
      const ai = new AIController(ROSTER_BY_ID.kai, 'normal'), foe = new Fighter(ROSTER_BY_ID.mara, 1, TEAM_ENEMIES);
      const hooks = ai.considerPickup(foe, foe, 2) === null && ai.considerHazard(foe, foe, 2) === null;
      const ok = !usedDuel && !usedLone && attacked && !usedLast && lastAttacks && hooks;
      return ok ? true : JSON.stringify({ usedDuel, usedLone, attacked, usedLast, lastAttacks, hooks });
    });
    /* ----- Lock-on (P4-03), soft facing (P4-04), lock-on marker (P4-05) ----- */
    /* A scripted human player (the lock-on rules apply to it) driven by ctl = { lock, fwd, side, punch, analog }. It stands at the origin facing +x, so a stick push of fwd = 1 points along
       +x, fwd = -1 along -x, side = 1 along +z and side = -1 along -z. Every enemy stands still where the scene puts it. */
    const humanScript = (ctl) => Object.assign(self.scripted((it) => { it.lock = !!ctl.lock; it.fwd = ctl.fwd || 0; it.side = ctl.side || 0; it.punch = !!ctl.punch; it.stickAnalog = !!ctl.analog; }), { human: true });   // analog: the push comes from a gamepad or touch stick (the only kind that can flick); without it, from keys
    const lockScene = (spots, opts, ctl) => {
      const m = self.makeBrawl(Object.assign({ enemies: spots.length }, opts));
      m.controllers[0] = humanScript(ctl);
      m.home = [0, 0];   // where lockTap puts the player back
      self.stand(m.fighters[0], 0, 0, 1, 0);
      spots.forEach(([x, z], k) => self.stand(m.fighters[k + 1], x, z, 0, 0));
      return m;
    };
    /* One step with the given input, then the input is cleared and the player is put back at its home spot facing +x (a push moves it a few millimetres). keepPose: leave it. */
    const lockTap = (m, ctl, input, keepPose) => {
      Object.assign(ctl, { lock: false, fwd: 0, side: 0, punch: false, analog: false }, input);
      m.step();
      Object.assign(ctl, { lock: false, fwd: 0, side: 0, punch: false, analog: false });
      const home = m.home || [0, 0];
      if (!keepPose) self.stand(m.fighters[0], home[0], home[1], home[0] + 1, home[1]);
    };
    const lockWait = (m, ctl, ticks) => { for (let t = 0; t < ticks; t++) lockTap(m, ctl, {}); };
    /* The index of the enemy a first Lock press (with this stick) picks in a scene, -1 for nobody. setup(m) may change the scene (a wall, a downed enemy, an ally). */
    const lockPick = (spots, input, setup) => {
      const ctl = {}, m = lockScene(spots, {}, ctl);
      try {
        if (setup) setup(m);
        lockTap(m, ctl, Object.assign({ lock: true }, input));
        return m.fighters.indexOf(m.fighters[0].lockOn);
      } finally { m.dispose(); }
    };
    /* The enemy the player's first punch is aimed at (index, -1 for none), whether it is attacking, how far its facing is off that enemy (radians) and who its target is, one tick
       after the attack began (the tick it began is when the aim is set; the target follows on the next). */
    const softAim = (spots, input, setup) => {
      const ctl = {}, m = lockScene(spots, {}, ctl), p = m.fighters[0];
      try {
        if (setup) setup(m);
        lockTap(m, ctl, Object.assign({ punch: true }, input), true);
        const aim = m.fighters.indexOf(p.aim);
        m.step();
        return { aim, attacking: p.state === S.ATTACK, off: p.aim ? Math.abs(wrapAngle(Math.atan2(p.aim.x - p.x, p.aim.z - p.z) - p.yaw)) : -1, target: m.fighters.indexOf(p.target) };
      } finally { m.dispose(); }
    };
    const withWall = (wall) => () => { Arena.colliders.push(wall); };   // the arena is rebuilt by the next match, which drops the wall
    const CROWD = [[4, 0], [1.5, 2.5], [1.5, -3.5], [-2.5, 0]];   // e1 ahead, e2 front-left (nearest in view), e3 front-right, e4 behind
    const HIDING_WALL = () => ({ x: 2, z: 0, hx: 0.3, hz: 1.6, top: 2.5, standable: false, active: true, obj: null, temp: false, timer: 0, thin: false });   // between the player and the spot (4, 0)
    test('Lock-on: a crowd picks the enemy in the stick direction (view or not), else the nearest in front; behind the player, out of range and out of the 100 degree view are skipped', () => {
      const got = {
        none: lockPick(CROWD), ahead: lockPick(CROWD, { fwd: 1 }), left: lockPick(CROWD, { side: 1 }), right: lockPick(CROWD, { side: -1 }), back: lockPick(CROWD, { fwd: -1 }),
        behindSkipped: lockPick([[6, 0], [-2, 0]]), behindByStick: lockPick([[6, 0], [-2, 0]], { fwd: -1 }), onlyBehind: lockPick([[-2, 0]]),
        farAndBehind: lockPick([[9, 0], [-2, 0]]), inRange: lockPick([[7.9, 0]]), outOfRange: lockPick([[8.1, 0]]), farByStick: lockPick([[9, 0]], { fwd: 1 }),
        edgeIn: lockPick([[-0.2, 3]]), edgeOut: lockPick([[-0.8, 3]]), weakStick: lockPick(CROWD, { side: 0.3 }),
      };
      const want = { none: 2, ahead: 1, left: 2, right: 3, back: 4, behindSkipped: 1, behindByStick: 2, onlyBehind: -1, farAndBehind: -1, inRange: 1, outOfRange: -1, farByStick: -1, edgeIn: 1, edgeOut: -1, weakStick: 2 };
      return JSON.stringify(got) === JSON.stringify(want) ? true : 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want);
    });
    test('Lock-on: scenery taller than a person hides an enemy (the pick skips it, also against the stick); crates, glass and a wall behind the target do not', () => {
      const spots = [[4, 0], [3, 4]];   // e1 is straight behind the wall, e2 is off to the side with a clear line
      const got = {
        control: lockPick(spots), wall: lockPick(spots, {}, withWall(HIDING_WALL())), wallByStick: lockPick(spots, { fwd: 1 }, withWall(HIDING_WALL())),
        wallOnly: lockPick([[4, 0]], {}, withWall(HIDING_WALL())), crate: lockPick(spots, {}, withWall(Object.assign(HIDING_WALL(), { top: 0.95 }))),
        glass: lockPick(spots, {}, withWall(Object.assign(HIDING_WALL(), { obj: { mat: 'glass' } }))), behindTarget: lockPick(spots, {}, withWall(Object.assign(HIDING_WALL(), { x: 5.5 }))),
        beyondSide: lockPick(spots, { side: 1 }, withWall(Object.assign(HIDING_WALL(), { x: 0, z: 3, hx: 3, hz: 0.2 }))),   // a long wall across the way to e2: only e1 is visible
      };
      const want = { control: 1, wall: 2, wallByStick: 2, wallOnly: -1, crate: 1, glass: 1, behindTarget: 1, beyondSide: 1 };
      return JSON.stringify(got) === JSON.stringify(want) ? true : 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want);
    });
    test('Lock-on: a downed enemy is skipped by the automatic pick but stays locked once chosen; an ally is never picked, whatever it stands or the stick says', () => {
      const spots = [[2, 0], [4, 0]];
      const down = (index) => (m) => { m.fighters[index].setState(S.HIT); m.fighters[index].setState(S.DOWN); };
      const ally = (m) => { m.fighters[1].team = TEAM_PLAYERS; };
      const got = {
        downSkipped: lockPick(spots, {}, down(1)), downByStick: lockPick(spots, { fwd: 1 }, down(1)), allDown: lockPick(spots, {}, (m) => { down(1)(m); down(2)(m); }),
        allyNearest: lockPick(spots, {}, ally), allyByStick: lockPick(spots, { fwd: 1 }, ally), onlyAlly: lockPick([[2, 0]], {}, ally),
      };
      const want = { downSkipped: 2, downByStick: 2, allDown: -1, allyNearest: 2, allyByStick: 2, onlyAlly: -1 };
      // chosen first, then downed: the lock holds, the player still faces and targets it; the next Lock press lets go; the one after picks the standing enemy
      const ctl = {}, m = lockScene(spots, {}, ctl), p = m.fighters[0];
      try {
        lockTap(m, ctl, { lock: true });
        const chosen = p.lockOn === m.fighters[1];
        down(1)(m);
        lockWait(m, ctl, 10);
        const kept = p.lockOn === m.fighters[1] && p.target === m.fighters[1];
        lockTap(m, ctl, { lock: true });
        const released = p.lockOn === null;
        lockTap(m, ctl, { lock: true });
        const next = p.lockOn === m.fighters[2];
        // an ally's tag never carries the marker and the ally is never the player's target
        m.fighters[2].team = TEAM_PLAYERS; lockWait(m, ctl, 3);
        const allyNever = p.target !== m.fighters[2] && !m.lockMarked(m.fighters[2]);
        return JSON.stringify(got) === JSON.stringify(want) && chosen && kept && released && next && allyNever ? true : JSON.stringify({ got, chosen, kept, released, next, allyNever });
      } finally { m.dispose(); }
    });
    test('Lock-on: the lock lets go when its target is knocked out or goes past the release range (and not before), the next press picks a valid enemy; a round start or the player\'s own KO clears it', () => {
      const ctl = {}, m = lockScene([[2.5, 0], [1.5, 3]], {}, ctl), p = m.fighters[0], [e1, e2] = [m.fighters[1], m.fighters[2]];
      try {
        lockTap(m, ctl, { lock: true });
        const locked = p.lockOn === e1 && p.target === e1;
        Combat.knockOut(e1, null, null, m);
        lockWait(m, ctl, 20);   // the knock-out freezes the sim for 16 ticks of hit-stop
        const released = p.lockOn === null && p.target === e2;
        lockTap(m, ctl, { lock: true });
        const next = p.lockOn === e2;
        m.home = [-6, 0];   // the player stands 6 m from the middle, so the enemy can be 9 m away inside the arena (it is 17 m wide)
        const awayAt = (gap) => { e2.x = e2.prevX = m.home[0] + gap; e2.z = e2.prevZ = 0; };
        awayAt(LOCK_RELEASE_RANGE - 0.2); lockWait(m, ctl, 3);
        const edgeHolds = p.lockOn === e2;   // past LOCK_RANGE but inside the release range: still locked
        awayAt(LOCK_RELEASE_RANGE + 0.2); lockWait(m, ctl, 2);
        const far = p.lockOn === null;
        awayAt(LOCK_RANGE + 0.5); lockTap(m, ctl, { lock: true });
        const noNewLock = p.lockOn === null;   // a new press needs LOCK_RANGE, not the release range
        awayAt(3); lockTap(m, ctl, { lock: true });
        const again = p.lockOn === e2;
        // a lock is also checked while the player is in a clinch (the bound partner is the target meanwhile): the locked enemy is knocked out under it
        p.state = S.GRAPPLE; p.partner = e1;
        e2.alive = false; e2.state = S.KO;
        m.assignTargets();
        const inClinch = p.lockOn === null && p.target === e1;
        p.state = S.IDLE; p.partner = null; e2.alive = true; e2.state = S.IDLE; p.lockOn = e2;
        p.hp = 0; Combat.knockOut(p, null, null, m);
        lockWait(m, ctl, 20);
        const selfKo = p.lockOn === null;
        p.lockOn = e2; m.startRound();
        const roundStart = p.lockOn === null && p.aim === null;
        const ok = locked && released && next && edgeHolds && far && noNewLock && again && inClinch && selfKo && roundStart;
        return ok ? true : JSON.stringify({ locked, released, next, edgeHolds, far, noNewLock, again, inClinch, selfKo, roundStart });
      } finally { m.dispose(); }
    });
    test('Lock-on: an analog-stick flick (out and back within LOCK_FLICK_TICKS) or a Lock press with the stick pushed moves the lock to the enemy in that direction (only if it is closer to the stick than the locked one), a Lock press without a push lets go, switches are LOCK_SWITCH_COOLDOWN apart', () => {
      const ctl = {}, m = lockScene([[2.5, 0], [1.5, 2.5], [1.5, -3]], {}, ctl), p = m.fighters[0], [e1, e2, e3] = [m.fighters[1], m.fighters[2], m.fighters[3]];
      const flick = (dir, ticksOut) => { for (let t = 0; t < (ticksOut || 1); t++) lockTap(m, ctl, Object.assign({ analog: true }, dir)); lockTap(m, ctl, { analog: true }); };   // out, then back to rest
      try {
        lockTap(m, ctl, { lock: true });
        const start = p.lockOn === e1;
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN + 2);
        flick({ side: 1 });
        const flickLeft = p.lockOn === e2 && p.target === e2;
        lockTap(m, ctl, {}); flick({ side: -1 });   // too soon after the last switch
        const debounced = p.lockOn === e2;
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN + 2);
        flick({ side: -1 }, 3);
        const flickRight = p.lockOn === e3;
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN + 2);
        flick({ fwd: 1 });
        const flickAhead = p.lockOn === e1;
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN + 2);
        flick({ fwd: 1 });   // already the enemy most ahead: the push does nothing
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN);
        const noBetter = p.lockOn === e1;
        flick({ side: 0.5 }); lockWait(m, ctl, LOCK_SWITCH_COOLDOWN);
        const weakPush = p.lockOn === e1;   // a push under LOCK_FLICK_MAG is no flick
        flick({ side: 1 }, LOCK_FLICK_TICKS + 4);
        const slowPush = p.lockOn === e1;   // out for too long is walking, not a flick
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN);
        lockTap(m, ctl, { lock: true, side: 1 });
        const tapSwitch = p.lockOn === e2;
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN + 2);
        lockTap(m, ctl, { lock: true, side: -1 });
        const tapSwitchRight = p.lockOn === e3;
        lockTap(m, ctl, { lock: true, fwd: -1 });   // pushed at nobody (e4 does not exist): lets go
        const tapNobody = p.lockOn === null;
        lockTap(m, ctl, { lock: true });
        lockTap(m, ctl, { lock: true });
        const toggled = p.lockOn === null;   // pick, then let go
        const ok = start && flickLeft && debounced && flickRight && flickAhead && noBetter && weakPush && slowPush && tapSwitch && tapSwitchRight && tapNobody && toggled;
        return ok ? true : JSON.stringify({ start, flickLeft, debounced, flickRight, flickAhead, noBetter, weakPush, slowPush, tapSwitch, tapSwitchRight, tapNobody, toggled });
      } finally { m.dispose(); }
    });
    test('Lock-on: plain movement never changes the lock: keys (held, tapped, backing off, circling) and a held analog stick, for 60+ ticks, with another enemy to the right and one behind', () => {
      const trial = (label, push) => {
        const ctl = {}, m = lockScene([[2.5, 0], [1.5, 2.5], [-2.5, 0]], {}, ctl), p = m.fighters[0], a = m.fighters[1];
        try {
          lockTap(m, ctl, { lock: true });   // A, straight ahead; B is to the right (+z), C is behind
          lockWait(m, ctl, LOCK_SWITCH_COOLDOWN + 2);
          if (p.lockOn !== a) return label + ': no lock';
          for (let t = 0; t < 70; t++) { lockTap(m, ctl, push(t)); if (p.lockOn !== a) return label + ' moved the lock at tick ' + t; }
          lockWait(m, ctl, 4);
          return p.lockOn === a ? '' : label + ' moved the lock after';
        } finally { m.dispose(); }
      };
      const problems = [
        trial('key right held', () => ({ side: 1 })), trial('key back held', () => ({ fwd: -1 })), trial('key right tapped', (t) => (t % 2 ? {} : { side: 1 })),
        trial('key back tapped', (t) => (t % 3 ? {} : { fwd: -1 })), trial('key circling', (t) => ({ side: t < 35 ? 1 : -1 })), trial('key right every 20 ticks', (t) => (t % 20 < 10 ? { side: 1 } : {})),
        trial('analog right held', () => ({ side: 1, analog: true })), trial('analog back held', () => ({ fwd: -1, analog: true })),
      ].filter(Boolean);
      return problems.length ? problems.join('; ') : true;
    });
    test('Lock-on: a 1v1 locks its only foe and targets it exactly as before; a lock-less AI or dummy fighter never gets a lock', () => {
      const ctl = {}, duel = self.make({}), p = duel.fighters[0], foe = duel.fighters[1];
      let ai = null;
      try {
        duel.controllers[0] = humanScript(ctl);
        lockTap(duel, ctl, { lock: true });
        const locked = p.lockOn === foe && p.target === foe && foe.target === p;
        const noMarker = !duel.lockMarked(foe);   // nothing to tell apart in a 1v1: no marker
        lockTap(duel, ctl, { lock: true });
        const released = p.lockOn === null && p.target === foe;
        lockTap(duel, ctl, { lock: true, punch: true }); lockWait(duel, ctl, 4);
        const noAim = p.aim === null && p.lockOn === foe;   // soft facing is for scenes with several enemies only
        Combat.knockOut(foe, null, null, duel);
        lockWait(duel, ctl, 20);
        const afterKo = p.lockOn === null && p.target === foe;   // a finished round still faces the knocked-out opponent
        ai = track(new MatchSim({ mode: 'brawl', enemies: 3, countdown: false, timer: 0, seed: 3, difficulty: 'hard', evenDamage: true }));
        ai.controllers[0] = self.scripted(() => {});   // an idle, non-human player: the live keyboard or pad cannot reach this match
        for (let t = 0; t < 600; t++) { ai.step(); }
        const noAiLock = ai.fighters.every((f) => f.lockOn === null && f.aim === null);   // the enemies are AIs and never lock or aim
        const ok = locked && noMarker && released && noAim && afterKo && noAiLock;
        return ok ? true : JSON.stringify({ locked, noMarker, released, noAim, afterKo, noAiLock });
      } finally { duel.dispose(); if (ai) ai.dispose(); }
    });
    test('Soft facing: without a lock an attack is aimed at the same target the lock-on rules pick (stick direction, then nearest in front), never at a hidden, downed, far or allied enemy when a valid one exists', () => {
      const down = (m) => { m.fighters[1].setState(S.HIT); m.fighters[1].setState(S.DOWN); };
      const ally = (m) => { m.fighters[1].team = TEAM_PLAYERS; };
      const got = {
        crowd: softAim(CROWD), ahead: softAim(CROWD, { fwd: 1 }), right: softAim(CROWD, { side: -1 }), back: softAim(CROWD, { fwd: -1 }),
        behind: softAim([[6, 0], [-2, 0]]), wall: softAim([[4, 0], [3, 4]], {}, withWall(HIDING_WALL())), downed: softAim([[2, 0], [4, 0]], {}, down),
        allied: softAim([[2, 0], [4, 0], [5, 2]], {}, ally), far: softAim([[9, 0], [5, 3]]),
      };
      const want = { crowd: 2, ahead: 1, right: 3, back: 4, behind: 1, wall: 2, downed: 2, allied: 2, far: 2 };
      const problems = [];
      for (const key in want) {
        if (got[key].aim !== want[key]) problems.push(key + ' aim ' + got[key].aim + ' want ' + want[key]);
        else if (!got[key].attacking || got[key].off > 0.02 || got[key].target !== want[key]) problems.push(key + ' not facing it: ' + JSON.stringify(got[key]));
      }
      // nobody valid (both enemies are behind): no aim, the attack keeps the usual target, the nearest
      const none = softAim([[-2, 0], [-3, 1]]);
      if (none.aim !== -1 || !none.attacking || none.target !== 1) problems.push('none valid ' + JSON.stringify(none));
      return problems.length ? problems.join('; ') : true;
    });
    test('Soft facing: a locked enemy is the aim even when others are nearer, and the aim is kept to the end of the attack and then forgotten', () => {
      const ctl = {}, m = lockScene(CROWD, {}, ctl), p = m.fighters[0];
      try {
        lockTap(m, ctl, { lock: true, fwd: 1 });
        const locked = p.lockOn === m.fighters[1];
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN);
        self.stand(p, 0, 0, 0, 3);   // facing e2 (the nearest), away from the locked e1
        lockTap(m, ctl, { punch: true }, true);
        const foe = m.fighters[1];
        const aimedAtLock = p.state === S.ATTACK && p.aim === foe && Math.abs(wrapAngle(Math.atan2(foe.x - p.x, foe.z - p.z) - p.yaw)) < 0.05;
        let kept = true;
        for (let t = 0; t < 4 && p.state === S.ATTACK; t++) { m.step(); if (p.state === S.ATTACK && (p.aim !== foe || p.target !== foe)) kept = false; }
        let guard = 0;
        while (p.state === S.ATTACK && guard++ < 120) m.step();
        lockWait(m, ctl, 2);
        const forgotten = p.aim === null && p.lockOn === m.fighters[1];
        const ok = locked && aimedAtLock && kept && forgotten;
        return ok ? true : JSON.stringify({ locked, aimedAtLock, kept, forgotten });
      } finally { m.dispose(); }
    });
    test('Soft facing: a later step of a string keeps the aim of the one before while it is a valid pick (stick or no stick), picks again when it is not; with one hostile in the scene there is no soft facing', () => {
      const ctl = {}, m = lockScene(CROWD, {}, ctl), p = m.fighters[0], [, , , e3, e4] = m.fighters;
      try {
        lockTap(m, ctl, { punch: true, side: -1 }, true);   // the first step, pushed at e3
        const first = p.aim === e3 && p.state === S.ATTACK;
        p.stickMag = 1; p.stickX = -1; p.stickZ = 0;   // the next step is pressed with the stick pushed at e4, behind
        m.softFace(p);
        const kept = p.aim === e3;
        e3.setState(S.HIT); e3.setState(S.DOWN);   // e3 is no longer a valid pick
        m.softFace(p);
        const repicked = p.aim === e4 && Math.abs(wrapAngle(Math.atan2(e4.x - p.x, e4.z - p.z) - p.yaw)) < 0.02;
        // one hostile left in the scene (the other two are on the player's side): the attack is not turned at all
        const solo = lockScene([[2, 0], [4, 0], [5, 2]], {}, ctl);
        try {
          solo.fighters[2].team = TEAM_PLAYERS; solo.fighters[3].team = TEAM_PLAYERS;
          const q = solo.fighters[0];
          self.stand(q, 0, 0, 0, 3);   // facing away from the only hostile
          lockTap(solo, ctl, { punch: true }, true);
          const unturned = q.aim === null && Math.abs(wrapAngle(q.yaw - Math.atan2(2, 0))) > 1;
          const ok = first && kept && repicked && unturned;
          return ok ? true : JSON.stringify({ first, kept, repicked, unturned });
        } finally { solo.dispose(); }
      } finally { m.dispose(); }
    });
    test('Lock-on marker: only the locked enemy\'s tag carries it (none without a lock, in a 1v1, on an ally, or once the lock no longer holds), it adds no element, and no quality preset or style rule hides it', () => {
      const ctl = {}, m = lockScene(CROWD, {}, ctl), problems = [];
      const tags = m.fighters.map(() => { const el = { marked: false, classList: { toggle(name, on) { if (name === 'lk') el.marked = !!on; } } }; return el; });
      const keepCache = UI.cache;
      const draw = () => { m.fighters.forEach((f, i) => UI.tagMarker(m, f, tags[i], i)); return tags.map((el, i) => (el.marked ? i : '')).join(''); };
      try {
        UI.cache = {};
        if (draw() !== '') problems.push('no lock: ' + draw());
        lockTap(m, ctl, { lock: true, side: -1 });   // e3
        if (draw() !== '3') problems.push('locked: ' + draw());
        lockWait(m, ctl, LOCK_SWITCH_COOLDOWN);
        lockTap(m, ctl, { lock: true });   // let go
        if (draw() !== '') problems.push('released: ' + draw());
        lockTap(m, ctl, { lock: true });   // the nearest in front: e2
        const before = draw();
        m.fighters[2].alive = false; m.fighters[2].state = S.KO;   // knocked out, before the next tick has dropped the lock: the marker already goes
        const atOnce = draw();
        lockWait(m, ctl, 2);
        if (before !== '2' || atOnce !== '' || draw() !== '') problems.push('knock-out: ' + before + ' then ' + atOnce + ' then ' + draw());
        // the render-quality presets only hold render budgets; the marker is HUD, so none of them (or any style rule) can hide it
        for (const quality in QUALITY_PRESETS) {
          const odd = Object.keys(QUALITY_PRESETS[quality]).filter((key) => !['scale', 'dprCap', 'shadow', 'particles', 'debris', 'pieces', 'live', 'heaps'].includes(key));
          if (odd.length) problems.push('preset ' + quality + ' has the setting ' + odd.join());
        }
        const sheets = Array.from(document.querySelectorAll('style')).map((el) => (typeof el.textContent === 'string' ? el.textContent : ''));
        if (sheets.length) {   // only where there is a page (the browser run)
          const css = sheets.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
          if (!/\.tag\.lk::after\s*\{[^}]*content/.test(css)) problems.push('the marker has no style rule');
          for (const rule of css.match(/[^{}]+\{[^{}]*\}/g) || []) {
            const selector = rule.slice(0, rule.indexOf('{')), body = rule.slice(rule.indexOf('{'));
            if (/\.tag(?![\w-])/.test(selector) && /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])/.test(body)) problems.push('a style rule hides tags: ' + rule.trim().slice(0, 80));
          }
        }
      } finally { UI.cache = keepCache; m.dispose(); }
      return problems.length ? problems.join('; ') : true;
    });
    /* ----- Local co-op (P4-07) ----- */
    const fakePad = (id) => ({ id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) });
    const padButton = (pad, button, on) => { pad.buttons[button] = { pressed: on, value: on ? 1 : 0 }; };
    const keyEvent = (code) => ({ code, repeat: false, preventDefault() {}, stopImmediatePropagation() {} });
    /* Runs body with co-op input on and the gamepads stubbed (navigator.getGamepads returns pads); puts every piece of input state it touches back afterwards. */
    const withCoopInput = (pads, body) => {
      const keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), slots = Inputs.padSlots, versus = Inputs.versus, lobby = Inputs.lobby, movement = Settings.v.movement;
      const devices = Inputs.players.map((p) => p.lastDevice), indexes = Inputs.players.map((p) => p.padIndex), wasCoop = Inputs.coop, seats = Inputs.seats.slice(), seatIds = Inputs.seatPadIds.slice();
      Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
      try { Inputs.setCoop(true); return body(); } finally {
        Inputs.setCoop(false); Inputs.lobby = lobby;
        if (wasCoop) { Inputs.setCoop(true); seats.forEach((device, seat) => { Inputs.seats[seat] = device; Inputs.seatPadIds[seat] = seatIds[seat]; }); Inputs.applySeats(); }   // a co-op that was already on stays on, with its seats
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Inputs.padSlots = slots; Inputs.versus = versus; Settings.v.movement = movement;
        Inputs.players.forEach((p, i) => { p.releaseAll(); p.reset(); p.lastDevice = devices[i]; p.padIndex = indexes[i]; });
        Inputs.rebuildMaps();
      }
    };
    const FOUR = [{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }, { slot: 2, id: 'brutus' }, { slot: 3, id: 'yuki' }];
    const THREE = FOUR.slice(0, 3);
    const coopMatch = (party, extra) => track(new MatchSim(Object.assign({ mode: 'brawl', coop: party, enemies: coopEnemyCount(party.length), countdown: false, timer: 0, seed: 7, difficulty: 'normal', evenDamage: true }, extra)));
    const idleEnemies = (m) => { for (let k = m.partySize; k < m.fighters.length; k++) m.controllers[k] = self.scripted(() => {}); };
    test('Co-op seats: devices take P1 to P4 in order, a keyboard layout only seats 1 or 2, each pad belongs to one seat, leaving frees the seat, a fifth device cannot join', () => {
      const pads = [fakePad('a'), fakePad('b'), fakePad('c')];
      const idle = Inputs.join('key1') === -1 && Inputs.seatedSlots().length === 0;   // outside a co-op nothing can join
      return withCoopInput(pads, () => {
        const problems = [];
        if (!idle) problems.push('joined outside a co-op');
        const order = ['key1', 'key2', 'pad0', 'pad1'].map((device) => Inputs.join(device));
        if (order.join() !== '0,1,2,3') problems.push('join order ' + order.join());
        if (Inputs.join('pad0') !== 2 || Inputs.seatedSlots().join() !== '0,1,2,3') problems.push('a second join moved a device');
        if (Inputs.join('pad2') !== -1 || Inputs.join('key2') !== 1 || Inputs.seatedSlots().length !== 4) problems.push('a fifth device got in');
        const mapped = [0, 1, 2, 3].map((seat) => Inputs.padFor(seat, pads));
        if (mapped.join() !== '-1,-1,0,1') problems.push('pad per seat ' + mapped.join());
        if (Inputs.active().length !== 4 || Inputs.active()[3] !== Input4) problems.push('active players');
        // keys: each keyboard seat plays its own layout, a pad seat plays no keys, and with P2's layout seated the arrows are P2's
        const layouts = Input.keymap === Keymap && Input2.keymap === Keymap2 && Input3.keymap === null && Input4.keymap === null;
        const arrows = !Input.codeMap.has('ArrowLeft') && Input2.codeMap.get('ArrowLeft') === 'left' && Input.codeMap.get('KeyA') === 'left' && Input3.codeMap.size === 0;
        if (!layouts || !arrows) problems.push('layouts ' + layouts + ' arrows ' + arrows);
        // leaving frees the seat: the next pad takes it (a pad may sit anywhere), a keyboard cannot take a seat past 2, and P1 gets the arrows back
        const left = Inputs.leave('key2');
        const back = Input.codeMap.get('ArrowLeft') === 'left' && Input2.codeMap.size === 0 && Inputs.seats[1] === null;
        const refilled = Inputs.join('pad2') === 1 && Inputs.padFor(1, pads) === 2 && Input2.keymap === null;
        Inputs.leave('pad0');
        const noKeyboard = Inputs.join('key2') === -1 && Inputs.join('pad0') === 2 && Inputs.leave('pad7') === -1;
        if (left !== 1 || !back || !refilled || !noKeyboard) problems.push('leave ' + JSON.stringify({ left, back, refilled, noKeyboard }));
        // a seat keeps its pad while it is unplugged and takes it again when it returns
        pads[1].connected = false;
        const unplugged = Inputs.padFor(3, pads) === -1 && Inputs.seats[3] === 'pad1';
        pads[1].connected = true;
        if (!unplugged || Inputs.padFor(3, pads) !== 1) problems.push('unplugged pad');
        return problems.length ? problems.join('; ') : true;
      });
    });
    test('Co-op join screen: Punch joins and Defend leaves a keyboard layout, A / Start joins a gamepad, B leaves or goes back, Start starts, left / right choose the fighter, a button held when the screen opens is no press, an unplugged pad frees its seat', () => {
      const pads = [fakePad('a'), fakePad('b'), fakePad('c')], events = [];
      const off = Events.on('lobby', (e) => events.push(e.kind + (e.seat !== undefined ? e.seat : '')));
      try {
        return withCoopInput(pads, () => {
          Inputs.lobby = true;
          const problems = [];
          const keys = [Keymap.bindings.punch[0], Keymap2.bindings.punch[0], Keymap2.bindings.right[0], Keymap.bindings.right[0], Keymap2.bindings.defend[0]].map((code) => Inputs.lobbyKey(keyEvent(code)));
          if (keys.join() !== 'true,true,true,true,true' || Inputs.lobbyKey(keyEvent('KeyZ')) || Inputs.lobbyKey(keyEvent('Escape'))) problems.push('keys ' + keys.join());
          if (Inputs.seats.join() !== 'key1,,,') problems.push('seats after the keys ' + Inputs.seats.join());
          padButton(pads[0], 0, true); Inputs.pollLobby();   // held while the screen opened: only recorded
          const heldAtOpen = Inputs.seatOf('pad0') < 0;
          padButton(pads[0], 0, false); Inputs.pollLobby(); padButton(pads[0], 0, true); Inputs.pollLobby(); padButton(pads[0], 0, false); Inputs.pollLobby();   // pressed again: joins
          padButton(pads[1], 9, true); Inputs.pollLobby(); padButton(pads[1], 9, false); Inputs.pollLobby();   // Start joins too
          const joined = Inputs.seats.join() === 'key1,pad0,pad1,';
          padButton(pads[0], 9, true); Inputs.pollLobby(); padButton(pads[0], 9, false); Inputs.pollLobby();   // Start on a seated pad: start
          pads[0].axes[0] = -1; Inputs.pollLobby(); pads[0].axes[0] = 0; Inputs.pollLobby();                   // stick left: choose the fighter
          padButton(pads[0], 1, true); Inputs.pollLobby(); padButton(pads[0], 1, false); Inputs.pollLobby();   // B leaves
          padButton(pads[2], 1, true); Inputs.pollLobby(); padButton(pads[2], 1, false); Inputs.pollLobby();   // B on a pad without a seat: back
          pads[1].connected = false; Inputs.pollLobby();                                                      // unplugged: the seat is free
          const want = 'join0,join1,cycle1,cycle0,leave1,join1,join2,start,cycle1,leave1,back,leave2';
          if (!heldAtOpen || !joined || events.join() !== want) problems.push('events ' + events.join() + ' (wanted ' + want + ') heldAtOpen ' + heldAtOpen + ' joined ' + joined);
          if (Inputs.seats.join() !== 'key1,,,') problems.push('seats at the end ' + Inputs.seats.join());
          return problems.length ? problems.join('; ') : true;
        });
      } finally { off(); }
    });
    test('Co-op join screen: coming back to it with a button still held (B from the arena screen, Start, a stick) is no press, so the seat is kept; an unseated pad\'s held B is remembered for the next screen', () => {
      const pads = [fakePad('a'), fakePad('b')], events = [];
      const off = Events.on('lobby', (e) => events.push(e.kind + (e.seat !== undefined ? e.seat : '')));
      const keepPrev = Object.assign({}, UI.padPrev);
      try {
        return withCoopInput(pads, () => {
          const problems = [];
          Inputs.setLobby(true);
          Inputs.pollLobby(); padButton(pads[0], 0, true); Inputs.pollLobby(); padButton(pads[0], 0, false); Inputs.pollLobby();   // pad 0 joins
          Inputs.setLobby(false);                                   // on to the arena screen, where B goes back and is held while the join screen opens again
          padButton(pads[0], 1, true); padButton(pads[0], 9, true); pads[0].axes[0] = -1;
          Inputs.setLobby(true);
          Inputs.pollLobby(); Inputs.pollLobby();
          if (Inputs.seats[0] !== 'pad0' || events.join() !== 'join0') problems.push('held buttons counted as presses: seats ' + Inputs.seats.join() + ', events ' + events.join());
          padButton(pads[0], 1, false); padButton(pads[0], 9, false); pads[0].axes[0] = 0; Inputs.pollLobby();
          padButton(pads[0], 1, true); Inputs.pollLobby();           // a real press afterwards still counts
          if (Inputs.seats[0] !== null) problems.push('a real B press no longer leaves');
          padButton(pads[1], 1, true);                               // an unseated pad holds B (it went back from here): the next screen must see it as held
          UI.syncPadPrev();
          if (!Inputs.anyPadMenu().back || !UI.padPrev.back) problems.push('the held B of a pad without a seat was forgotten');
          return problems.length ? problems.join('; ') : true;
        });
      } finally { off(); Object.assign(UI.padPrev, keepPrev); }
    });
    test('Co-op seats: a gamepad that returns in another browser slot is found again by its id (the seat follows it), unless another seat holds the same id; a different pad in its old slot is not taken for it', () => {
      const problems = [];
      withCoopInput([fakePad('a'), fakePad('b'), null, null], () => {
        const pads = [fakePad('a'), fakePad('b'), null, null];
        Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
        Inputs.join('pad0'); Inputs.join('pad1');
        pads[1] = null;
        const gone = Inputs.padFor(1, pads);
        pads[3] = fakePad('b');
        const back = Inputs.padFor(1, pads) === 3 && Inputs.seats[1] === 'pad3' && Inputs.padFor(0, pads) === 0;
        pads[0] = fakePad('z'); pads[3] = null;                      // another pad sits in the first seat's old slot
        const stranger = Inputs.padFor(0, pads) === -1 && Inputs.seats[0] === 'pad0';
        if (gone !== -1 || !back || !stranger) problems.push('return ' + JSON.stringify({ gone, back, stranger }));
        Inputs.leave('pad0'); Inputs.leave('pad3');
        const twins = [fakePad('same'), fakePad('same'), null, null];
        Object.defineProperty(navigator, 'getGamepads', { value: () => twins, configurable: true });
        Inputs.join('pad0'); Inputs.join('pad1');
        twins[1] = null; twins[2] = fakePad('same');                 // which of two identical pads came back? Not guessed
        const shared = Inputs.padFor(1, twins) === -1 && Inputs.seats[1] === 'pad1' && Inputs.padFor(0, twins) === 0;
        if (!shared) problems.push('identical pads were mixed up');
      });
      return problems.length ? problems.join('; ') : true;
    });
    test('Co-op match: the party is team 0 in seat order, the enemies number two more than the players (at most six) and avoid the players\' fighters, a repeated pick wears the alternate colours, a party of one starts exactly like a plain brawl', () => {
      const problems = [], made = [];
      const track = (m) => { made.push(m); return m; };
      try {
        const m = track(coopMatch(FOUR));
        const teams = m.fighters.map((f) => f.team).join('');
        if (m.fighters.length !== 10 || teams !== '0000111111' || m.partySize !== 4 || !m.coop) problems.push('four players: ' + m.fighters.length + ' fighters, teams ' + teams);
        if (!FOUR.every((seat, k) => m.controllers[k] === HUMAN_CONTROLLERS[seat.slot] && m.fighters[k].id === seat.id)) problems.push('party order');
        if (m.fighters.slice(4).some((f) => FOUR.some((seat) => seat.id === f.id))) problems.push('an enemy repeats a player\'s fighter');
        const zs = m.fighters.slice(0, 4).map((f) => Math.round(f.z * 100) / 100).join();
        if (zs !== '-1.2,-0.4,0.4,1.2' || m.fighters.slice(0, 4).some((f) => f.x !== -m.def.spawn)) problems.push('party spots ' + zs);
        const counts = [1, 2, 3, 4].map((n) => coopEnemyCount(n)).join();
        if (counts !== '3,4,5,6' || coopEnemyCount(9) !== BRAWL_MAX_ENEMIES) problems.push('enemy counts ' + counts);
        const twin = track(coopMatch([{ slot: 0, id: 'kai' }, { slot: 1, id: 'kai' }], { enemies: 1 }));
        if (twin.fighters[0].look !== ROSTER_BY_ID.kai.look || twin.fighters[1].look === twin.fighters[0].look) problems.push('a repeated pick keeps the same colours');
        const solo = track(coopMatch([{ slot: 0, id: 'kai' }])), plain = track(new MatchSim({ mode: 'brawl', playerId: 'kai', enemies: 3, countdown: false, timer: 0, seed: 7, difficulty: 'normal', evenDamage: true }));
        const spots = (match) => match.fighters.map((f) => [f.id, f.team, f.x, f.z, f.yaw, f.hp].join(':')).join('|');
        if (spots(solo) !== spots(plain)) problems.push('a party of one starts differently from a plain brawl');
        // two seats that are not the first ones: fighter k belongs to the k-th seat
        const gap = track(coopMatch([{ slot: 0, id: 'kai' }, { slot: 2, id: 'mara' }]));
        const pads = [fakePad('a')], keepMatch = Game.match;
        Game.match = gap;
        try {
          withCoopInput(pads, () => {
            const who = [0, 1, 2].map((k) => Inputs.forFighter(k)), want = [Input, Input3, null];
            if (who.some((p, k) => p !== want[k]) || gap.controllers[1] !== Player3Controller) problems.push('seat mapping');
          });
        } finally { Game.match = keepMatch; }
        for (const f of m.fighters) if (!Number.isFinite(f.hp + f.x + f.z)) problems.push('NaN');
      } finally { made.forEach((match) => match.dispose()); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Co-op match: four devices (two keyboard layouts, two gamepads) each drive only their own fighter: a press makes that fighter attack and nobody else, a stick moves only its fighter', () => {
      const pads = [fakePad('a'), fakePad('b')];
      return withCoopInput(pads, () => {
        Settings.v.movement = 'opponent';
        ['key1', 'key2', 'pad0', 'pad1'].forEach((device) => Inputs.join(device));
        const presses = [
          [() => Inputs.onKeyDown(keyEvent(Keymap.bindings.punch[0])), () => Inputs.onKeyUp(keyEvent(Keymap.bindings.punch[0]))],
          [() => Inputs.onKeyDown(keyEvent(Keymap2.bindings.kick[0])), () => Inputs.onKeyUp(keyEvent(Keymap2.bindings.kick[0]))],
          [() => padButton(pads[0], 2, true), () => padButton(pads[0], 2, false)],
          [() => padButton(pads[1], 0, true), () => padButton(pads[1], 0, false)],
        ];
        const problems = [];
        presses.forEach(([down, up], d) => {
          const m = coopMatch(FOUR);
          try {
            idleEnemies(m); Inputs.reset(); down();
            for (let i = 0; i < 8; i++) { Inputs.update(); m.step(); }
            const attackers = m.fighters.slice(0, 4).map((f) => (f.state === S.ATTACK ? 1 : 0)).join('');
            if (attackers !== [0, 1, 2, 3].map((k) => (k === d ? 1 : 0)).join('')) problems.push('device ' + d + ' made ' + attackers + ' attack');
          } finally { up(); Inputs.update(); m.dispose(); }
        });
        const m = coopMatch(FOUR);
        try {
          idleEnemies(m); Inputs.reset();
          const x0 = m.fighters.map((f) => f.x), z0 = m.fighters.map((f) => f.z);
          pads[0].axes[1] = -1;   // the third player pushes the stick up (toward the enemies in Relative-to-opponent movement)
          for (let i = 0; i < 12; i++) { Inputs.update(); m.step(); }
          const moved = m.fighters.slice(0, 4).map((f, k) => (Math.hypot(f.x - x0[k], f.z - z0[k]) > 0.05 ? 1 : 0)).join('');
          if (moved !== '0010') problems.push('the stick of player 3 moved ' + moved);
        } finally { pads[0].axes[1] = 0; Inputs.update(); m.dispose(); }
        return problems.length ? problems.join('; ') : true;
      });
    });
    test('Co-op friendly fire: off, a teammate\'s punch does nothing to a teammate; on, it lands (an enemy hits a player either way)', () => {
      const run = (friendlyFire) => {
        const m = coopMatch([{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }], { enemies: 1, friendlyFire });
        try {
          m.controllers[0] = self.scripted((it, f, o, mm) => { it.punch = mm.tick % 30 === 2; });   // P1 punches along the row: P2 stands in reach, the enemy just beyond it
          m.controllers[1] = self.scripted(() => {});
          m.controllers[2] = self.scripted(() => {});
          self.stand(m.fighters[0], 0, 0, 1.9, 0); self.stand(m.fighters[1], 0.8, 0, 1.9, 0); self.stand(m.fighters[2], 1.9, 0, 0, 0);
          const log = self.capture(['hit']);
          self.run(m, 120);
          log.stop();
          const pair = (e) => e.att.index + '>' + e.def.index;
          return { mate: log.hit.filter((e) => pair(e) === '0>1').length, ally: m.fighters[1].hp / m.fighters[1].maxHp, flag: m.friendlyFire };
        } finally { m.dispose(); }
      };
      const foe = () => {   // an enemy punching a player lands in both settings
        const m = coopMatch([{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }], { enemies: 1 });
        try {
          m.controllers[0] = self.scripted(() => {}); m.controllers[1] = self.scripted(() => {});
          m.controllers[2] = self.scripted((it, f, o, mm) => { it.punch = mm.tick % 30 === 2; });
          self.stand(m.fighters[0], -3, 0, 0, 0); self.stand(m.fighters[1], 0, 0, 0.8, 0); self.stand(m.fighters[2], 0.8, 0, 0, 0);
          const log = self.capture(['hit']);
          self.run(m, 90);
          log.stop();
          return log.hit.filter((e) => e.att.index === 2 && e.def.index === 1).length;
        } finally { m.dispose(); }
      };
      const off = run(false), on = run(true), foeHits = foe();
      const ok = off.mate === 0 && off.ally === 1 && !off.flag && on.mate > 0 && on.ally < 1 && on.flag && foeHits > 0;
      return ok ? true : JSON.stringify({ off, on, foeHits });
    });
    test('Co-op sit-out: a knocked-out player takes no input, is not targeted and does not come back; the brawl goes on while any player stands, is lost when all are out (also with enemies still up) and won when every enemy is out', () => {
      const problems = [];
      const scene = () => {
        const m = coopMatch(THREE, { enemies: 2 });
        m.controllers[0] = self.scripted((it) => { it.punch = true; });   // P1 mashes Punch all the time
        m.controllers[1] = self.scripted(() => {}); m.controllers[2] = self.scripted(() => {});
        idleEnemies(m);
        self.stand(m.fighters[0], -3, 0, -2, 0); self.stand(m.fighters[1], -3, 5, -2, 5); self.stand(m.fighters[2], -3, -5, -2, -5);
        self.stand(m.fighters[3], -2, 0, -3, 0); self.stand(m.fighters[4], -2, 1.2, -3, 1.2);   // the enemies are nearest to P1
        return m;
      };
      const m = scene();
      try {
        m.assignTargets();
        const nearest = m.fighters[3].target === m.fighters[0];
        const control = self.capture(['attackStart']);
        self.run(m, 6);
        control.stop();
        const mashes = control.attackStart.some((e) => e.f.index === 0);   // control: while standing, P1's Punch starts attacks
        Combat.knockOut(m.fighters[0], m.fighters[3], null, m);
        const log = self.capture(['attackStart']);
        self.run(m, 150);
        log.stop();
        const [p1, p2, p3, e1, e2] = m.fighters;
        const targets = [e1, e2].every((e) => e.target === p2 || e.target === p3);
        const silent = log.attackStart.filter((e) => e.f.index === 0).length === 0 && p1.state === S.KO && !p1.alive;
        if (!nearest || !mashes || !targets || !silent || m.phase !== 'fight' || m.matchOver) problems.push('one down: ' + JSON.stringify({ nearest, mashes, targets, silent, phase: m.phase, over: m.matchOver }));
        Combat.knockOut(p2, e1, null, m);
        self.run(m, KO_DELAY_TICKS + 20);
        const still = m.phase === 'fight' && !m.matchOver && p3.alive;   // the last player standing keeps the brawl going
        Combat.knockOut(p3, e1, null, m);
        self.run(m, KO_DELAY_TICKS + 20);
        if (!still || !m.matchOver || m.matchWinner !== 1 || m.wins.join('-') !== '0-1' || m.teamAlive(TEAM_PLAYERS) || !e1.alive) problems.push('all out: ' + JSON.stringify({ still, over: m.matchOver, winner: m.matchWinner, wins: m.wins.join('-') }));
      } finally { m.dispose(); }
      const w = scene();
      try {
        Combat.knockOut(w.fighters[0], null, null, w);   // a sat-out player does not stop the others winning
        self.run(w, 20);
        Combat.knockOut(w.fighters[3], w.fighters[1], null, w); Combat.knockOut(w.fighters[4], w.fighters[1], null, w);
        self.run(w, KO_DELAY_TICKS + 20);
        if (!w.matchOver || w.matchWinner !== 0 || w.wins.join('-') !== '1-0' || w.fighters[0].alive) problems.push('won: ' + JSON.stringify({ over: w.matchOver, winner: w.matchWinner, wins: w.wins.join('-'), p1: w.fighters[0].alive }));
      } finally { w.dispose(); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Co-op revive hook: reviveTeam brings the knocked-out players back where they fell on their feet with part of their health, leaves the standing and the enemies alone, and they take input and are targeted again (nothing in play calls it yet)', () => {
      const problems = [];
      const m = coopMatch(THREE, { enemies: 2 });
      try {
        m.controllers[0] = self.scripted((it) => { it.punch = true; });
        m.controllers[1] = self.scripted(() => {}); m.controllers[2] = self.scripted(() => {});
        idleEnemies(m);
        const [p1, p2, p3, e1, e2] = m.fighters;
        self.stand(p1, -3, 0, -2, 0); self.stand(p2, -3, 4, -2, 4); self.stand(p3, -3, -4, -2, -4); self.stand(e1, -2, 0.3, -3, 0.3); self.stand(e2, 3, 0, 2, 0);
        Combat.knockOut(p1, e1, null, m); Combat.knockOut(p3, e1, null, m);
        self.run(m, 40);
        const at = [p1.x, p1.z, p3.x, p3.z], standing = [p2.hp, e1.hp, e2.hp];
        const before = m.fighters.map((f) => f.alive).join();
        const n = m.reviveTeam();
        const back = n === 2 && p1.alive && p3.alive && p1.state === S.IDLE && Math.abs(p1.hp - p1.maxHp * COOP_REVIVE_HP) < 1e-9 && Math.abs(p3.hp - p3.maxHp * COOP_REVIVE_HP) < 1e-9;
        const where = at.join() === [p1.x, p1.z, p3.x, p3.z].join();
        const untouched = p2.hp === standing[0] && e1.hp === standing[1] && e2.hp === standing[2] && m.reviveTeam() === 0;
        if (before !== 'false,true,false,true,true' || !back || !where || !untouched) problems.push('revive ' + JSON.stringify({ before, n, back, where, untouched }));
        const log = self.capture(['attackStart']);
        m.assignTargets(); self.run(m, 12);
        log.stop();
        const acts = log.attackStart.some((e) => e.f.index === 0), targeted = e1.target === p1;   // P1 is the nearest to e1 again
        if (!acts || !targeted || !m.fighters.slice(0, 3).every((f) => f.alive)) problems.push('after the revive: attacks ' + acts + ', targeted ' + targeted);
        Combat.knockOut(p2, e1, null, m); Combat.knockOut(p1, e1, null, m);
        const full = m.reviveTeam(1);
        if (full !== 2 || p1.hp !== p1.maxHp) problems.push('revive at full health ' + full);
        for (const f of m.fighters.slice(0, 3)) Combat.knockOut(f, e1, null, m);
        self.run(m, KO_DELAY_TICKS + 20);
        if (!m.matchOver || m.reviveTeam() !== 0 || m.fighters[0].alive) problems.push('a lost brawl was revived');
        // a body that lay on a crate stands up on it, and presses mashed while out are dropped
        const m2 = coopMatch([{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }], { enemies: 1 });
        try {
          const q = m2.fighters[0];
          Combat.knockOut(q, null, null, m2);
          q.y = q.prevY = 1.2; q.groundY = q.supportY = 1.2;
          Input.attackQueue.push('punch', 'kick'); Input.latch.punch = true;
          const n2 = m2.reviveTeam();
          if (n2 !== 1 || q.y !== 1.2 || q.groundY !== 1.2 || q.supportY !== 1.2 || Input.attackQueue.length || Input.latch.punch) problems.push('revive ' + JSON.stringify({ n2, y: q.y, queue: Input.attackQueue.length, latch: !!Input.latch.punch }));
        } finally { Input.reset(); m2.dispose(); }
      } finally { m.dispose(); }
      const duel = mk({});
      if (duel.reviveTeam() !== 0) problems.push('a 1v1 has no party to revive');
      return problems.length ? problems.join('; ') : true;
    });
    test('Co-op revive hook: refused during the knock-out delay of a wiped party (locked), so the brawl still ends', () => {
      const m = coopMatch([{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }], { enemies: 2, seed: 5 });
      try {
        idleEnemies(m);
        self.run(m, 1);
        Combat.knockOut(m.fighters[0], null, null, m); Combat.knockOut(m.fighters[1], null, null, m);
        for (let guard = 0; !m.locked && guard < 200; guard++) m.step();
        self.run(m, 5);
        const locked = m.locked, revived = m.reviveTeam();
        self.run(m, KO_DELAY_TICKS + 20);
        return locked && revived === 0 && m.matchOver && !m.fighters[0].alive ? true : JSON.stringify({ locked, revived, over: m.matchOver });
      } finally { m.dispose(); }
    });
    test('Decider round: equal health goes to the larger stamina share (not the larger raw stamina), a tie in that too is a draw and the round is played again', () => {
      const decide = (staminaA, staminaB) => {
        const m = mk({});
        const [a, b] = m.fighters;
        a.maxStam = 100; b.maxStam = 200; a.stam = staminaA; b.stam = staminaB;
        m.decider = true;
        m.endRound('time');
        return m.roundWinner;
      };
      const got = [decide(60, 100), decide(40, 120), decide(50, 100)];   // shares 0.6 / 0.5, 0.4 / 0.6, 0.5 / 0.5
      return got.join() === '0,1,-1' ? true : 'winners ' + got.join();
    });
    test('Simulation options are validated: a non-numeric or zero winsNeeded and a bad timer fall back to numbers, so a run neither hits the time cap nor changes length', () => {
      const r = SimRunner.run({ winsNeeded: 0, timer: NaN, seed: 2, difficulty: 'expert' });
      const same = r.config && r.config.winsNeeded === 1 && r.config.timer === 60;
      const done = !r.error && r.ticks < 60 * 60 * 15;
      return same && done ? true : JSON.stringify({ config: r.config && { w: r.config.winsNeeded, t: r.config.timer }, ticks: r.ticks, err: r.error });
    });
    test('Co-op camera: the frame holds the living players, not a knocked-out lead that lies far off, and keeps the lead in view only when every player is out', () => withCamera(() => {
      const problems = [];
      const m = coopMatch(FOUR, { enemies: 4 });
      try {
        idleEnemies(m);
        const [p1, p2, p3, p4, e1, e2, e3, e4] = m.fighters;
        self.stand(p1, -10, -6, 0, 0); self.stand(p2, -1, 0, 3, 0); self.stand(p3, -1, 1, 3, 1); self.stand(p4, -1, -1, 3, -1);
        self.stand(e1, 3, 0, -1, 0); self.stand(e2, 3, 1, -1, 1); self.stand(e3, 3, -1, -1, -1); self.stand(e4, 4, 0, -1, 0);
        const all = Camera.frameFighters(m.fighters), wideBox = Camera.box.minX;   // control: with the lead alive the frame stretches out to it
        Combat.knockOut(p1, e1, null, m);
        p1.x = p1.prevX = -10; p1.z = p1.prevZ = -6;
        const living = Camera.frameFighters(m.fighters), box = Camera.box.minX, first = Camera.players[0];
        if (all !== 8 || wideBox > -9) problems.push('control: lead alive ' + all + ' fighters, box starts at ' + wideBox);
        if (living !== 7 || Camera.playerCount !== 3 || first !== p2 || box < -1.5) problems.push('lead out: ' + living + ' fighters, ' + Camera.playerCount + ' players, first ' + (first && first.id) + ', box from ' + box);
        Camera.snapNext = true; Camera.resetGroup();
        cameraFrames(m, 150);
        const shown = [p2, p3, p4].map((f) => fighterOnScreen(f));
        if (shown.some((s) => !s)) problems.push('a living player is off screen: ' + shown.join());
        for (const f of [p2, p3, p4]) Combat.knockOut(f, e1, null, m);
        const lone = Camera.frameFighters(m.fighters);
        if (Camera.playerCount !== 1 || Camera.players[0] !== p1 || lone < 2) problems.push('everyone out: ' + Camera.playerCount + ' players');
      } finally { m.dispose(); }
      return problems.length ? problems.join('; ') : true;
    }));
    test('Co-op setting: Friendly fire is off by default, is kept in the save, is read from a save that lacks it as off, and a rematch takes the current setting', () => {
      const keepRaw = Store.get(KEY_SETTINGS), keepSettings = Object.assign({}, Settings.v), problems = [];
      try {
        Store.remove(KEY_SETTINGS); Settings.init();
        if (SETTING_DEFS.friendlyFire.def !== false || Settings.v.friendlyFire !== false) problems.push('default is not off');
        Settings.set('friendlyFire', true);
        const saved = JSON.parse(Store.get(KEY_SETTINGS)).friendlyFire === true;
        Settings.v.friendlyFire = false; Settings.init();
        if (!saved || Settings.v.friendlyFire !== true) problems.push('not kept: saved ' + saved + ', loaded ' + Settings.v.friendlyFire);
        Store.set(KEY_SETTINGS, JSON.stringify({ master: 0.5, revision: SETTINGS_REVISION })); Settings.init();   // a save from before the option
        if (Settings.v.friendlyFire !== false || Settings.v.master !== 0.5) problems.push('old save: ' + Settings.v.friendlyFire);
        Store.set(KEY_SETTINGS, JSON.stringify({ friendlyFire: 'yes', revision: SETTINGS_REVISION })); Settings.init();
        if (Settings.v.friendlyFire !== false) problems.push('a non-boolean value was taken');
      } finally {
        if (keepRaw === null) Store.remove(KEY_SETTINGS); else Store.set(KEY_SETTINGS, keepRaw);
        Settings.v = keepSettings; Settings.apply();
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Co-op flow: the mode is on the list, joined seats start a brawl with enemies = 2 + players (at most 6), friendly fire follows the setting at every start, a co-op ends with the main menu', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const keepSel = Object.assign({}, Game.selection), keepParty = Game.selection.party.slice(), keepFire = Settings.v.friendlyFire, problems = [];
      try {
        if (!MODE_ORDER.includes('coop') || !MODE_INFO.coop) problems.push('mode missing from the list');
        const sizes = [];
        for (const [n, fire] of [[1, false], [2, true], [3, false], [4, true]]) {
          Settings.v.friendlyFire = fire;
          Game.chooseMode('coop');
          const seated = ['key1', 'key2', 'pad0', 'pad1'].slice(0, n).map((device) => Inputs.join(device));
          Game.startFromSelection();
          const m = Game.match;
          sizes.push(n + ':' + (m ? m.fighters.length : 0));
          if (seated.join() !== [0, 1, 2, 3].slice(0, n).join() || !m || !m.coop || m.coop.length !== n || m.friendlyFire !== fire || Game.state !== GS.COUNTDOWN) problems.push(n + ' players: ' + JSON.stringify({ seated, coop: !!(m && m.coop), fire: m && m.friendlyFire, state: Game.state }));
          Game.quitToMenu();
          if (Inputs.coop || Inputs.seatedSlots().length) problems.push('the seats outlived the co-op');
        }
        if (sizes.join() !== '1:4,2:6,3:8,4:10') problems.push('sizes ' + sizes.join());
        Game.chooseMode('coop');
        const empty = Game.startCoop();   // nobody has joined
        if (empty || Game.match) problems.push('a brawl started with nobody in it');
        Game.quitToMenu();
      } finally {
        if (Game.state !== GS.MENU) Game.quitToMenu();
        Settings.v.friendlyFire = keepFire; Object.assign(Game.selection, keepSel); Game.selection.party = keepParty;
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Co-op screens and HUD: the join screen shows a card per seat (Choose arena off until somebody joins), the fighter pick wraps over the unlocked roster, the HUD cells and tags follow the seat and show OUT, the results have a column per player', () => {
      const keepParty = Game.selection.party.slice(), keepDom = ['hp1', 'hg1', 'ht1'].map((id) => UI.dom[id]), keepCells = UI.partyEls, keepCache = UI.cache, keepGhost = UI.ghost, problems = [];
      const m = coopMatch([{ slot: 0, id: 'kai' }, { slot: 2, id: 'mara' }], { enemies: 1 });
      try {
        withCoopInput([fakePad('a')], () => {
          const empty = UI.screen_coop();
          if ((empty.match(/seatcard open/g) || []).length !== COOP_MAX_PLAYERS || !/data-act="coopStart" disabled/.test(empty)) problems.push('empty join screen');
          Inputs.join('pad0'); Inputs.join('key2');
          const shown = UI.screen_coop();
          if (!shown.includes('data-act="coopcycle:0"') || !shown.includes('data-act="coopcycle:1"') || !shown.includes('Gamepad 1') || !shown.includes('Keyboard 2') || /data-act="coopStart" disabled/.test(shown) || (shown.match(/seatcard open/g) || []).length !== 2) problems.push('join screen with two seated');
          const roster = Game.coopRoster(), sel = Game.selection;
          sel.party[0] = roster[roster.length - 1].id;
          const wrapped = Game.cycleParty(0, 1) === roster[0].id && Game.cycleParty(0, -1) === roster[roster.length - 1].id;
          sel.party[1] = 'locked-id-that-does-not-exist';
          const stray = Game.cycleParty(1, 1);
          if (!wrapped || !roster.some((r) => r.id === stray)) problems.push('fighter pick');
        });
        const cell = () => ({ root: { classList: { out: false, toggle(name, on) { this.out = !!on; } } }, hp: { style: {} }, st: { style: {} } });
        UI.dom.hp1 = { style: {} }; UI.dom.hg1 = { style: {} }; UI.dom.ht1 = {}; UI.partyEls = [cell(), cell(), cell(), cell()]; UI.cache = {}; UI.ghost = [1, 1];
        m.fighters[1].hp = m.fighters[1].maxHp * 0.5;
        UI.partyBars(m);
        const half = UI.partyEls[0].hp.style.transform === 'scaleX(1.000)' && UI.partyEls[1].hp.style.transform === 'scaleX(0.500)' && !UI.partyEls[1].root.classList.out && UI.dom.ht1.textContent === '2 / 2 UP';
        Combat.knockOut(m.fighters[1], m.fighters[2], null, m);
        UI.partyBars(m);
        const out = UI.partyEls[1].root.classList.out === true && UI.partyEls[0].root.classList.out === false && UI.dom.ht1.textContent === '1 / 2 UP' && UI.partyEls[1].hp.style.transform === 'scaleX(0.000)';
        if (!half || !out) problems.push('party cells ' + JSON.stringify({ half, out }));
        const keepMatch = Game.match;
        Game.match = m;
        const seatOfSecond = UI.seatOf(m.fighters[1]);   // the seat, not the fighter index
        Game.match = keepMatch;
        if (UI.tagLabel(m, 0) !== '1P' || UI.tagLabel(m, 1) !== '3P' || UI.tagLabel(m, 2) !== 'CPU' || seatOfSecond !== 2) problems.push('labels');
        const r = m.results();
        r.mode = 'coop'; r.buttons = ['again', 'setup', 'menu']; r.playerWon = false;
        const html = UI.coopResults(r);
        const columns = (html.match(/pcname/g) || []).length === 2 && html.includes('P1 ' + m.fighters[0].name) && html.includes('P3 ' + m.fighters[1].name) && html.includes('knocked out') && html.includes('standing');
        if (!columns || r.players.length !== 2 || r.player !== m.fighters[0].name + ' + ' + m.fighters[1].name || r.enemies !== 1) problems.push('results screen');
        const sheets = typeof document.querySelectorAll === 'function' ? Array.from(document.querySelectorAll('style')).map((el) => (typeof el.textContent === 'string' ? el.textContent : '')) : [];
        if (sheets.length) {   // only where there is a page (the browser run): the cells and seat colours have style rules and the HUD keeps them clear of the top bar
          const css = sheets.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
          if (!/#party\s*\{[^}]*top\s*:/.test(css) || !/\.coop #party\s*\{[^}]*display\s*:\s*flex/.test(css) || !/\.seat4\s*\{[^}]*--pc/.test(css)) problems.push('the party strip has no style rule');
          const partyTop = Number((/#party\s*\{[^}]*top\s*:\s*([\d.]+)em/.exec(css) || [])[1]), infoTop = Number((/\.coop #modeinfo\s*\{[^}]*top\s*:\s*([\d.]+)em/.exec(css) || [])[1]);
          if (!(infoTop * 0.85 >= partyTop + 2.6)) problems.push('the mode line (top ' + infoTop + ' x .85 em) is not under the party row (from ' + partyTop + ' em, about 2.6 em tall)');
        }
      } finally {
        Game.selection.party = keepParty; ['hp1', 'hg1', 'ht1'].forEach((id, i) => { UI.dom[id] = keepDom[i]; }); UI.partyEls = keepCells; UI.cache = keepCache; UI.ghost = keepGhost; m.dispose();
      }
      return problems.length ? problems.join('; ') : true;
    });
    /* ----- Match setup (P4-08): lineups of 2 to 8 fighters, players or CPU, free-for-all or Teams A to D ----- */
    const lineupOf = (list, extra) => MatchLineup.fix(Object.assign({ slots: list.map(([id, team, human]) => ({ id, team, human: !!human })), timer: 0, handicap: true }, extra));
    const lineupMatch = (lineup, extra) => {
      const plan = MatchLineup.plan(lineup, (extra && extra.difficulty) || 'normal');
      return track(new MatchSim(Object.assign({ mode: 'brawl', slots: plan.slots, humans: plan.people, teamNames: plan.teamNames, setupMode: 'brawl', countdown: false, timer: 0, seed: 3, difficulty: 'normal', evenDamage: true, items: false, hazards: false }, extra)));
    };
    const quietAll = (m) => { for (let k = 0; k < m.fighters.length; k++) m.controllers[k] = self.scripted(() => {}); };
    const aiAll = (m, level) => { for (let k = 0; k < m.fighters.length; k++) m.controllers[k] = new AIController(m.fighters[k].profile, level); };
    const ROSTER_IDS = ROSTER.map((r) => r.id);
    const ffaOf = (count) => lineupOf(ROSTER_IDS.slice(0, count).map((id) => [id, 0, false]));
    test('Lineup: a lineup is made safe and checked (known fighters only, 2 to 8 slots, slot 1 a player, at most 4 players, teams 0 to 4, handicap 0 is off, nobody to fight, Versus needs two players)', () => {
      const problems = [];
      const raw = [{ id: 'toString', human: false, team: 9 }, { id: 'constructor', human: true, team: -1 }].concat(Array.from({ length: 9 }, () => ({ id: 'mara', human: true, team: 2 })));
      const fixed = MatchLineup.fix({ slots: raw, handicap: 0, timer: 5, deal: 'nonsense' });
      if (fixed.slots.length !== LINEUP_MAX || fixed.slots[0].id !== 'kai' || fixed.slots[1].id !== 'kai' || !fixed.slots[0].human || fixed.slots[0].team !== 0 || fixed.slots[1].team !== 0) problems.push('slots ' + JSON.stringify(fixed.slots.slice(0, 2)));
      if (MatchLineup.people(fixed) !== LINEUP_HUMANS_MAX || fixed.timer !== 0 || fixed.handicap !== false || fixed.deal !== 'custom') problems.push('rest ' + JSON.stringify({ people: MatchLineup.people(fixed), timer: fixed.timer, handicap: fixed.handicap, deal: fixed.deal }));
      if (MatchLineup.fix({ slots: [] }).slots.length !== LINEUP_MIN || MatchLineup.fix({ slots: [{ id: 'mara', human: false, team: 1 }] }).slots[0].id !== 'mara') problems.push('padding');
      const same = lineupOf([['kai', 1, true], ['mara', 1, false]]);
      if (MatchLineup.check('free', same).ok || !/nobody to fight/.test(MatchLineup.check('free', same).msg)) problems.push('one team');
      if (MatchLineup.check('versus', lineupOf([['kai', 1, true], ['mara', 2, false]])).ok || !MatchLineup.check('versus', lineupOf([['kai', 1, true], ['mara', 2, true]])).ok) problems.push('versus needs two players');
      if (MatchLineup.check('free', { slots: new Array(LINEUP_MAX + 1).fill({ id: 'kai', human: true, team: 0 }) }).ok) problems.push('nine fighters');
      if (!MatchLineup.check('brawl', lineupOf([['kai', 0, true], ['mara', 0, false], ['brutus', 0, false]])).ok) problems.push('free-for-all of three');
      const ok = MatchLineup.plain('free', lineupOf([['kai', 0, true], ['mara', 0, false]])) && MatchLineup.plain('versus', lineupOf([['kai', 0, true], ['mara', 0, true]])) &&
        !MatchLineup.plain('brawl', lineupOf([['kai', 0, true], ['mara', 0, false]])) && !MatchLineup.plain('free', lineupOf([['kai', 0, true], ['mara', 0, true]])) && !MatchLineup.plain('free', lineupOf([['kai', 0, true], ['mara', 0, false], ['brutus', 0, false]]));
      if (!ok) problems.push('plain 1v1');
      const dealt = lineupOf([['kai', 0, true], ['mara', 0, false], ['brutus', 0, true], ['yuki', 0, false], ['dmitri', 0, false]]);
      const teams = [];
      for (const kind of LINEUP_DEALS) { MatchLineup.deal(dealt, kind); teams.push(dealt.slots.map((slot) => slot.team).join('')); }
      if (teams.join() !== '00000,12122,12121,12312,12341') problems.push('deals ' + teams.join());
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the plan puts the lead\'s team first, people before CPU, one team per group, the colours of Team A to D fixed and the spare ones for free-for-all slots, and the handicap only on the smaller teams', () => {
      const problems = [];
      const lineup = lineupOf([['kai', 2, true], ['mara', 1, false], ['brutus', 2, false], ['yuki', 0, false], ['dmitri', 1, true]]);
      const plan = MatchLineup.plan(lineup);
      const ids = plan.slots.map((s) => s.id).join(), teams = plan.slots.map((s) => s.team).join(''), seats = plan.slots.map((s) => s.human).join(), tints = plan.slots.map((s) => s.tint).join('');
      if (ids !== 'kai,brutus,dmitri,mara,yuki' || teams !== '00112' || seats !== '0,-1,1,-1,-1' || tints !== '00112'.replace(/./g, (c) => ({ 0: 1, 1: 0, 2: 2 }[c]))) problems.push('order ' + [ids, teams, seats, tints].join(' '));
      if (plan.sizes.join() !== '2,2,1' || plan.teamNames.join() !== 'TEAM B,TEAM A,YUKI' || plan.people !== 2 || plan.teamCount !== 3 || plan.ffa) problems.push('counts ' + JSON.stringify([plan.sizes, plan.teamNames, plan.people, plan.teamCount, plan.ffa]));
      const boosted = plan.slots.filter((s) => s.hp !== 1 || s.dmg !== 1).map((s) => s.id).join();
      const yuki = plan.slots[4];
      if (boosted !== 'yuki' || Math.abs(yuki.hp - MatchLineup.handicapFactor('hard', 2)) > 1e-9 || Math.abs(yuki.dmg - MatchLineup.handicapFactor('hard', 2)) > 1e-9) problems.push('handicap ' + boosted);
      const people = MatchLineup.plan(lineupOf([['kai', 1, true], ['mara', 2, true], ['brutus', 2, true]]), 'easy').slots[0];
      if (Math.abs(people.hp - MatchLineup.handicapFactor('hard', 2)) > 1e-9) problems.push('Hard\'s handicap when no CPU plays');
      lineup.handicap = false;
      if (MatchLineup.plan(lineup).slots.some((s) => s.hp !== 1 || s.dmg !== 1)) problems.push('handicap off');
      const ffa = MatchLineup.plan(ffaOf(8));
      if (!ffa.ffa || ffa.teamCount !== 8 || new Set(ffa.slots.map((s) => s.tint)).size !== 8 || ffa.slots.some((s) => s.hp !== 1)) problems.push('free-for-all of 8');
      const letters = MatchLineup.plan(lineupOf([['kai', 3, true], ['mara', 4, false], ['brutus', 0, false]]));
      if (letters.slots.map((s) => s.tint).join('') !== '23' + letters.slots[2].tint || letters.slots[2].tint === 2 || letters.slots[2].tint === 3) problems.push('letter colours ' + letters.slots.map((s) => s.tint).join(''));
      if (MatchLineup.plan(lineupOf([['kai', 1, true], ['mara', 2, false], ['brutus', 2, false], ['yuki', 2, false]])).slots[0].hp !== MatchLineup.handicapFactor('hard', 3)) problems.push('1 against 3');
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the fight ends when one team is left (also when two teams fall on the same tick), when all fall it is a draw (also when the last team falls during the knock-out delay), and teams are counted up to 8', () => {
      const problems = [];
      const make = () => { const m = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false], ['brutus', 3, false]])); quietAll(m); return m; };
      let m = make();
      if (m.aliveTeamCount() !== 3 || !m.setup || m.wins.length !== 3) problems.push('start ' + m.aliveTeamCount());
      Combat.knockOut(m.fighters[1], m.fighters[0], null, m); Combat.knockOut(m.fighters[2], m.fighters[0], null, m);
      self.run(m, KO_DELAY_TICKS + 20);
      if (!m.matchOver || m.matchWinner !== 0 || m.wins.join() !== '1,0,0' || m.roundWinner !== 0) problems.push('two teams on one tick ' + JSON.stringify([m.matchOver, m.matchWinner, m.wins.join()]));
      m = make();
      for (const f of m.fighters) Combat.knockOut(f, null, null, m);
      self.run(m, KO_DELAY_TICKS + 20);
      if (!m.matchOver || m.matchWinner !== -1 || m.wins.join() !== '0,0,0') problems.push('all fall ' + JSON.stringify([m.matchOver, m.matchWinner, m.wins.join()]));
      m = make();
      Combat.knockOut(m.fighters[1], m.fighters[0], null, m);
      self.run(m, 10);
      const midway = !m.locked && !m.matchOver && m.aliveTeamCount() === 2;   // two teams are still standing: the fight goes on
      Combat.knockOut(m.fighters[2], m.fighters[0], null, m);
      for (let guard = 0; guard < 60 && !m.locked; guard++) m.step();   // the hit-stop of the blow first
      self.run(m, 5);
      const delaying = m.locked && !m.matchOver && m.endTimer > 0 && m.endTimer < KO_DELAY_TICKS;   // one team is left: the knock-out delay runs
      Combat.knockOut(m.fighters[0], m.fighters[2], null, m);
      self.run(m, KO_DELAY_TICKS + 20);
      if (!midway || !delaying || !m.matchOver || m.matchWinner !== -1) problems.push('last team falls in the delay ' + JSON.stringify([midway, delaying, m.matchOver, m.matchWinner]));
      m = make();
      Combat.knockOut(m.fighters[2], m.fighters[1], null, m);
      Combat.knockOut(m.fighters[1], m.fighters[0], null, m);
      self.run(m, KO_DELAY_TICKS + 20);
      if (!m.matchOver || m.matchWinner !== 0) problems.push('last one standing ' + m.matchWinner);
      const eight = lineupMatch(ffaOf(LINEUP_MAX));
      quietAll(eight);
      let counts = [eight.aliveTeamCount()];
      for (let k = 0; k < 7; k++) { Combat.knockOut(eight.fighters[k], eight.fighters[7], null, eight); counts.push(eight.aliveTeamCount()); }
      if (counts.join() !== '8,7,6,5,4,3,2,1') problems.push('team count ' + counts.join());
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the clock goes to the team with the most health left as a share of its own total; a tie with the best share, also a chain of near-equal shares, is a draw', () => {
      const problems = [];
      const clockRun = (shares) => {
        const m = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false], ['brutus', 3, false]]), { timer: 60 });
        quietAll(m);
        shares.forEach((share, k) => { m.fighters[k].hp = m.fighters[k].maxHp * share; });
        m.roundTicks = 2;
        self.run(m, 5);
        return m.matchOver ? m.matchWinner : 'not over';
      };
      const cases = [[[0.5, 0.3, 0.6], 2], [[0.9, 0.3, 0.6], 0], [[0.5, 0.5, 0.2], -1], [[0.5, 0.5004, 0.5008], -1], [[0.5, 0.52, 0.3], 1], [[0.2, 0.2, 0.2], -1]];
      for (const [shares, want] of cases) { const got = clockRun(shares); if (got !== want) problems.push(shares.join('/') + ' gave ' + got + ' not ' + want); }
      const big = lineupMatch(lineupOf([['kai', 1, true], ['mara', 1, false], ['brutus', 2, false]]), { timer: 60 });
      quietAll(big);
      big.fighters[0].hp = 0; big.fighters[1].hp = big.fighters[1].maxHp; big.fighters[2].hp = big.fighters[2].maxHp * 0.6;
      big.roundTicks = 2;
      self.run(big, 5);
      if (big.matchWinner !== 1) problems.push('a team is judged on all its fighters: ' + big.matchWinner);
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: two teams start in two lines facing each other, three or more on a ring facing the centre, nobody closer than 0.9 m, only the first fighter gets the start health, 8 fighters fit', () => {
      const problems = [];
      const tight = (m) => { let gap = 99; for (let i = 0; i < m.fighters.length; i++) for (let j = i + 1; j < m.fighters.length; j++) gap = Math.min(gap, Math.hypot(m.fighters[i].x - m.fighters[j].x, m.fighters[i].z - m.fighters[j].z)); return gap; };
      const two = lineupMatch(lineupOf([['kai', 1, true], ['mara', 1, false], ['brutus', 2, false], ['yuki', 2, false], ['dmitri', 2, false]]), { playerHp: 0.5 });
      const left = two.fighters.slice(0, 2), right = two.fighters.slice(2);
      if (!left.every((f) => f.x < 0 && Math.abs(f.yaw - Math.PI / 2) < 1e-9) || !right.every((f) => f.x > 0 && Math.abs(f.yaw + Math.PI / 2) < 1e-9) || tight(two) < 0.7) problems.push('two lines ' + tight(two).toFixed(2));
      if (Math.abs(two.fighters[0].hp - two.fighters[0].maxHp * 0.5) > 1e-9 || two.fighters.slice(1).some((f) => f.hp !== f.maxHp)) problems.push('start health, two teams');
      for (const count of [3, 4, 8]) {
        const ring = lineupMatch(ffaOf(count), { playerHp: 0.5 });
        const radii = ring.fighters.map((f) => Math.hypot(f.x, f.z / 0.8)), facing = ring.fighters.every((f) => (Math.sin(f.yaw) * -f.x + Math.cos(f.yaw) * -f.z) / Math.hypot(f.x, f.z) > 0.999);
        const bounds = ring.def.bounds;
        if (Math.max(...radii) - Math.min(...radii) > 1e-6 || !facing || tight(ring) < 0.9 || ring.fighters.some((f) => Math.abs(f.x) > bounds.x || Math.abs(f.z) > bounds.z)) problems.push(count + ' on a ring ' + JSON.stringify([radii.map((r) => r.toFixed(2)).join(' '), facing, tight(ring).toFixed(2)]));
        if (Math.abs(ring.fighters[0].hp - ring.fighters[0].maxHp * 0.5) > 1e-9 || ring.fighters.slice(1).some((f) => f.hp !== f.maxHp)) problems.push('start health, ' + count + ' teams');
      }
      for (const id of ARENA_ORDER) {
        const m = lineupMatch(ffaOf(LINEUP_MAX), { arenaId: id });
        if (m.fighters.some((f) => Math.abs(f.x) > m.def.bounds.x || Math.abs(f.z) > m.def.bounds.z)) problems.push(id + ': a start spot outside the arena');
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the handicap lifts health and damage of the smaller teams only (also after a new round), not equal teams, not a free-for-all, not when it is off; the CPU damage still follows the difficulty', () => {
      const problems = [];
      const base = (f) => deriveStats(f.profile.attrs);
      const scaled = (m) => m.fighters.map((f) => (f.stats.maxHp !== base(f).maxHp || Math.abs(f.stats.damage - base(f).damage) > 1e-9 ? 1 : 0)).join('');
      if (scaled(lineupMatch(lineupOf([['kai', 1, true], ['mara', 1, false], ['brutus', 2, false], ['yuki', 2, false]]))) !== '0000') problems.push('2 against 2');
      if (scaled(lineupMatch(ffaOf(4))) !== '0000') problems.push('free-for-all');
      if (scaled(lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false], ['brutus', 2, false]], { handicap: false }))) !== '000') problems.push('handicap off');
      const m = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false], ['brutus', 2, false]]), { difficulty: 'hard' });
      if (scaled(m) !== '100') problems.push('1 against 2: ' + scaled(m));
      const factor = MatchLineup.handicapFactor('hard', 2), single = m.fighters[0], want = Math.round(base(single).maxHp * factor);
      m.startRound();
      if (single.maxHp !== want || single.hp !== want || Math.abs(single.stats.damage - base(single).damage * factor) > 1e-9) problems.push('after a new round ' + JSON.stringify([single.maxHp, single.hp, want]));
      const trio = lineupMatch(lineupOf([['kai', 1, true], ['mara', 1, false], ['brutus', 2, false], ['yuki', 2, false], ['dmitri', 2, false]]), { difficulty: 'hard' });
      if (scaled(trio) !== '11000' || Math.abs(trio.fighters[0].stats.damage - base(trio.fighters[0]).damage * MatchLineup.handicapFactor('hard', 1.5)) > 1e-9) problems.push('2 against 3: ' + scaled(trio));
      const easy = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false]]), { evenDamage: false, difficulty: 'easy' });
      if (Math.abs(easy.fighters[0].stats.damage - base(easy.fighters[0]).damage) > 1e-9 || Math.abs(easy.fighters[1].stats.damage - base(easy.fighters[1]).damage * DIFFICULTY.easy.dmg) > 1e-9) problems.push('difficulty damage');
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the handicap table (1 at ratio 1, straight lines between the rows, the last factor above the last ratio and never more than the biggest one, Hard and Expert only above 1) and a person is never weakened: a factor under 1 is used only between CPU-only teams', () => {
      const problems = [];
      for (const level of ['easy', 'normal', 'hard', 'expert']) {
        const rows = LINEUP_HANDICAP[level];
        if (MatchLineup.handicapFactor(level, 1) !== 1 || MatchLineup.handicapFactor(level, 0.5) !== 1 || MatchLineup.handicapFactor(level, 0) !== 1) problems.push(level + ': ratio 1 and below');
        for (const row of rows) if (Math.abs(MatchLineup.handicapFactor(level, row[0]) - row[1]) > 1e-9) problems.push(level + ': row ' + row[0]);
        for (const ratio of [4.5, 5, 7]) if (MatchLineup.handicapFactor(level, ratio) !== rows[rows.length - 1][1]) problems.push(level + ': ratio ' + ratio + ' above the last row');
        const mid = (rows[0][0] + rows[1][0]) / 2;
        if (Math.abs(MatchLineup.handicapFactor(level, mid) - (rows[0][1] + rows[1][1]) / 2) > 1e-9) problems.push(level + ': between rows');
        if ((level === 'hard' || level === 'expert') && rows.some((row) => row[1] <= 1)) problems.push(level + ' has a factor of 1 or less');
      }
      const raw = (list) => ({ slots: list.map(([id, team, human]) => ({ id, team, human })), handicap: true, timer: 0 });
      const cpuOnly = MatchLineup.plan(raw([['kai', 1, false], ['mara', 2, false], ['brutus', 2, false]]), 'easy').slots;
      if (!(cpuOnly[0].hp < 1) || cpuOnly[0].hp !== MatchLineup.handicapFactor('easy', 2) || cpuOnly[1].hp !== 1) problems.push('CPU-only teams on Easy ' + cpuOnly.map((x) => x.hp.toFixed(2)).join());
      const onSmaller = MatchLineup.plan(raw([['kai', 1, true], ['mara', 2, false], ['brutus', 2, false]]), 'easy').slots;
      const onBigger = MatchLineup.plan(raw([['kai', 1, false], ['mara', 2, true], ['brutus', 2, false]]), 'normal').slots;
      const bothSides = MatchLineup.plan(raw([['kai', 1, true], ['mara', 2, false], ['brutus', 2, true]]), 'easy').slots;
      if (onSmaller.some((x) => x.hp < 1 || x.dmg < 1) || onBigger.some((x) => x.hp < 1 || x.dmg < 1) || bothSides.some((x) => x.hp < 1 || x.dmg < 1)) problems.push('a person was weakened');
      const third = MatchLineup.plan(raw([['kai', 1, true], ['mara', 2, false], ['brutus', 2, false], ['yuki', 3, false], ['dmitri', 3, false], ['sora', 3, false]]), 'easy').slots;
      if (third[0].hp < 1 || third[1].hp !== MatchLineup.handicapFactor('easy', 1.5) || !(third[1].hp < 1) || third[3].hp !== 1) problems.push('three teams ' + third.map((x) => x.hp.toFixed(2)).join());
      const people = MatchLineup.plan(raw([['kai', 1, true], ['mara', 2, true], ['brutus', 2, true]]), 'easy').slots;
      if (people.some((x) => x.hp < 1)) problems.push('players only');
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: rivals of different teams never queue behind each other (the crowd director works per target and team), a team of two still shares tokens, a plain brawl keeps one group per target, and two teams waiting round one target get ring spots that differ', () => {
      const problems = [];
      const watch = (m, ticks) => {
        let engagedTicks = 0, overCap = 0, orphan = 0;
        for (let t = 0; t < ticks && !m.matchOver; t++) {
          m.step();
          const crowd = m.crowd;
          let any = false;
          for (let i = 0; i < m.fighters.length; i++) {
            if (!crowd.engaged[i]) continue;
            any = true;
            const f = m.fighters[i];
            if (!m.fighters.some((g, j) => j !== i && crowd.engaged[j] && g.team === f.team && g.target === f.target)) orphan++;
          }
          if (any) engagedTicks++;
          for (let target = 0; target < m.fighters.length; target++) for (let team = 0; team < TEAM_TINTS; team++) if (crowd.holders(target, team) > crowd.capFor(target, team)) overCap++;
        }
        return { engagedTicks, overCap, orphan };
      };
      const ffa = lineupMatch(lineupOf([['kai', 0, true], ['mara', 0, false], ['brutus', 0, false], ['yuki', 0, false]]));
      aiAll(ffa, 'normal');
      const free = watch(ffa, 900);
      if (free.engagedTicks !== 0) problems.push('free-for-all: queued on ' + free.engagedTicks + ' ticks');
      const teams = lineupMatch(lineupOf([['kai', 1, true], ['mara', 1, false], ['brutus', 2, false], ['yuki', 2, false]]));
      aiAll(teams, 'normal');
      const duo = watch(teams, 900);
      if (duo.engagedTicks === 0 || duo.orphan !== 0 || duo.overCap !== 0) problems.push('2 against 2: ' + JSON.stringify(duo));
      const old = track(new MatchSim({ mode: 'brawl', enemies: 3, countdown: false, timer: 0, seed: 5, difficulty: 'normal', evenDamage: true }));
      old.controllers[0] = new AIController(old.fighters[0].profile, 'normal');
      let oldEngaged = 0, oldOver = 0;
      for (let t = 0; t < 600 && !old.matchOver; t++) {
        old.step();
        if (old.crowd.engaged.some(Boolean)) oldEngaged++;
        if (old.crowd.holders(0, TEAM_ENEMIES) > old.crowd.capFor(0, TEAM_ENEMIES) || old.crowd.holders(0) !== old.crowd.holders(0, TEAM_ENEMIES)) oldOver++;
        for (let i = 0; i < old.fighters.length; i++) if (old.crowd.engaged[i] && old.fighters[i].team !== TEAM_ENEMIES) oldOver++;
      }
      if (oldEngaged === 0 || oldOver !== 0) problems.push('a plain brawl: ' + JSON.stringify({ oldEngaged, oldOver }));
      const crowd = new CrowdDirector(lineupMatch(ffaOf(LINEUP_MAX)));
      if (crowd.share.length !== LINEUP_MAX * TEAM_TINTS || crowd.engaged.length !== LINEUP_MAX) problems.push('array sizes ' + crowd.share.length);
      const split = lineupMatch(lineupOf([['dmitri', 3, true], ['kai', 1, false], ['mara', 1, false], ['brutus', 2, false], ['yuki', 2, false]]));
      split.controllers[0] = self.scripted(() => {});
      for (let k = 1; k < 5; k++) split.controllers[k] = k < 3 ? self.scripted(() => {}) : new AIController(split.fighters[k].profile, 'normal');   // the second team (the lower team number) waits later
      self.stand(split.fighters[0], 0, 0, 3, 0);
      [[1, -3, 0.5], [2, -3, -0.5], [3, 3, 0.5], [4, 3, -0.5]].forEach(([k, x, z]) => self.stand(split.fighters[k], x, z, 0, 0));
      for (let t = 0; t < 4; t++) split.step();
      const aloneAngles = [3, 4].map((k) => split.crowd.slotAngle[k]);
      for (let k = 1; k < 3; k++) split.controllers[k] = new AIController(split.fighters[k].profile, 'normal');
      for (let t = 0; t < 2; t++) split.step();
      const turned = [3, 4].some((k, i) => Math.abs(wrapAngle(split.crowd.slotAngle[k] - aloneAngles[i])) > 0.3);   // the first team's ring was dealt again at once, not after the refresh time
      const angles = [1, 2, 3, 4].map((k) => split.crowd.slotAngle[k]);
      const apart = (a, b) => Math.abs(wrapAngle(a - b));
      const sameTeam = split.crowd.engaged[1] && split.crowd.engaged[3] && split.fighters[1].target === split.fighters[0] && split.fighters[3].target === split.fighters[0];
      let closest = 9;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) closest = Math.min(closest, apart(angles[i], angles[j]));
      if (!sameTeam || closest < 0.3 || !turned) problems.push('ring spots of two teams ' + JSON.stringify({ sameTeam, turned, closest: Math.round(closest * 100) / 100 }));
      const wave = ARENA_ORDER.find((id) => ARENAS[id].waves);
      const waved = lineupMatch(ffaOf(LINEUP_MAX), { arenaId: wave, waves: true });
      if (waved.waveRows || waved.crowd.engaged.length !== LINEUP_MAX || waved.fighters.length !== LINEUP_MAX) problems.push('waves in a lineup');
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: 8 fighters of AI run a free-for-all for 25 s without a NaN, an illegal transition or a stacked body, and a repeat with the same seed plays the same', () => {
      const illegal = Diag.illegalTransitions;
      const play = () => {
        const m = lineupMatch(ffaOf(LINEUP_MAX), { seed: 11 });
        aiAll(m, 'hard');
        let bad = '', gap = 9;
        for (let tick = 0; tick < 1500 && !m.matchOver && !bad; tick++) {
          m.step();
          for (let i = 0; i < m.fighters.length; i++) {
            const f = m.fighters[i];
            if (![f.x, f.y, f.z, f.yaw, f.hp, f.stam].every(Number.isFinite)) bad = 'NaN in fighter ' + i;
            for (let j = i + 1; j < m.fighters.length; j++) { const g = m.fighters[j]; if (f.alive && g.alive && Math.abs(f.y - g.y) < 1.25 && f.state !== S.CLINCH && g.state !== S.CLINCH && f.state !== S.GRAPPLE && g.state !== S.GRAPPLE && f.state !== S.THROWN && g.state !== S.THROWN) gap = Math.min(gap, Math.hypot(f.x - g.x, f.z - g.z)); }
          }
        }
        const sig = m.fighters.map((f) => f.hp.toFixed(2) + f.x.toFixed(2)).join('|');
        return { bad, gap, sig };
      };
      const a = play(), b = play();
      if (a.bad || a.gap < 0.2 || a.sig !== b.sig || Diag.illegalTransitions !== illegal) return JSON.stringify({ bad: a.bad, gap: a.gap, same: a.sig === b.sig, illegal: Diag.illegalTransitions - illegal });
      return true;
    });
    test('Lineup: BREAKPOINT.simulate runs an all-CPU lineup (the winner is the index of the winning team in plan order, the same seed gives the same result), refuses one team, and difficulty1 / difficulty2 follow the first fighter\'s team and the other teams', () => {
      const problems = [];
      const lineup = { slots: [{ id: 'kai', team: 1 }, { id: 'mara', team: 2 }, { id: 'brutus', team: 3 }], handicap: false };
      const a = SimRunner.run({ lineup, difficulty: 'easy', seed: 2, timer: 90 }), b = SimRunner.run({ lineup, difficulty: 'easy', seed: 2, timer: 90 });
      if (a.error || a.teams.join() !== '0,1,2' || a.winner < -1 || a.winner > 2 || a.ticks !== b.ticks || a.winner !== b.winner || a.hpLeft.join() !== b.hpLeft.join()) problems.push('run ' + JSON.stringify([a.error, a.teams, a.winner, a.ticks, b.ticks]));
      if (!SimRunner.run({ lineup: { slots: [{ id: 'kai', team: 1 }, { id: 'mara', team: 1 }] } }).error) problems.push('one team was accepted');
      let seen = null;
      SimRunner.run({ lineup: { slots: [{ id: 'kai', team: 1 }, { id: 'mara', team: 1 }, { id: 'brutus', team: 2 }] }, difficulty: 'normal', difficulty1: 'expert', difficulty2: 'easy', seed: 1, timer: 1, listeners: { roundStart: (e) => { seen = e.match; } } });
      const levels = seen ? seen.controllers.map((c) => c.d.id).join() : 'no match';
      if (levels !== 'expert,expert,easy') problems.push('difficulty by team ' + levels);
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the lineup screen shows a row per slot with fighter, control and team, and its rows add and remove opponents (2 to 8, wrapping), deal teams, cycle fighters, make players (at most 4, slot 1 always), cycle teams, the handicap and the clock', () => {
      const keepSel = Object.assign({}, Game.selection), keepLineups = Game.lineups, keepToast = UI.toast, problems = [];
      try {
        UI.toast = () => {};
        Game.lineups = {};
        Game.selection.mode = 'brawl'; Game.selection.player = 'kai';
        let html = UI.screen_lineup();
        const slotRows = (html.match(/class="slot tc/g) || []).length;
        if (slotRows !== 4 || !html.includes('data-local="lfig:3"') || !html.includes('data-local="lctl:3"') || !html.includes('Team A') || !html.includes('Team B') || !html.includes('Choose arena') || /lineupNext"[^>]*disabled/.test(html)) problems.push('default brawl ' + slotRows);
        const lineup = Game.lineupFor('brawl');
        const step = (name, dir) => { UI.lineupLocal(name, dir); return lineup.slots.length; };
        const counts = [step('lopp', 1), step('lopp', 1), step('lopp', 1), step('lopp', 1), step('lopp', 1), step('lopp', -1), step('lopp', -1), step('lopp', -1), step('lopp', -1), step('lopp', -1), step('lopp', -1), step('lopp', -1)];
        if (counts.join() !== '5,6,7,8,2,8,7,6,5,4,3,2') problems.push('opponent counts ' + counts.join());
        step('lopp', 1); step('lopp', 1);
        if (new Set(lineup.slots.map((s) => s.id)).size !== lineup.slots.length || lineup.slots.slice(1).some((s) => s.human || s.team !== 2)) problems.push('added slots ' + JSON.stringify(lineup.slots));
        UI.lineupLocal('lctl:0', 1);
        if (!lineup.slots[0].human) problems.push('slot 1 lost its player');
        step('lopp', 1);
        for (const i of [1, 2, 3, 4, 0]) UI.lineupLocal('lctl:' + i, 1);
        if (MatchLineup.people(lineup) !== LINEUP_HUMANS_MAX || lineup.slots[4].human || !lineup.slots[0].human) problems.push('players ' + MatchLineup.people(lineup));
        const before = lineup.slots[2].id;
        UI.lineupLocal('lfig:2', 1);
        if (lineup.slots[2].id === before || !ROSTER_BY_ID[lineup.slots[2].id]) problems.push('fighter cycle');
        UI.lineupLocal('ltm:2', 1);
        if (lineup.slots[2].team !== 2 || lineup.deal !== 'custom') problems.push('team cycle ' + lineup.slots[2].team);
        for (let k = 0; k < LINEUP_TEAM_LETTERS.length; k++) UI.lineupLocal('ltm:2', 1);
        if (lineup.slots[2].team !== 2) problems.push('team cycle wraps');
        UI.lineupLocal('ldeal', 1);
        if (lineup.deal !== 'ffa' || lineup.slots.some((s) => s.team !== 0)) problems.push('deal ffa');
        UI.lineupLocal('ldeal', 1);
        if (lineup.deal !== 'players' || lineup.slots.some((s) => s.team !== (s.human ? 1 : 2))) problems.push('deal players');
        UI.lineupLocal('lhand', 1); UI.lineupLocal('ltimer', 1);
        if (lineup.handicap !== false || lineup.timer !== LINEUP_TIMERS[1]) problems.push('handicap and clock');
        html = UI.screen_lineup();
        if (!/Even teams[\s\S]*?Off/.test(html) || !html.includes('Clock') || !html.includes('Player 4') || !html.includes('gamepads')) problems.push('screen after the changes');
        lineup.slots.forEach((s) => { s.team = 1; });
        html = UI.screen_lineup();
        if (!/lineupNext"[^>]*disabled/.test(html) || !html.includes('nobody to fight')) problems.push('one team can start');
      } finally { UI.toast = keepToast; Game.lineups = keepLineups; Object.assign(Game.selection, keepSel); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the setup screens say that Rounds and Round timer are not used once the lineup is one fight, the lineup screen says what Even teams does (also for a player nobody helps), a team 1v1 is labelled by its teams, and plugging a gamepad in or out redraws the lineup screen', () => {
      const keepSel = Object.assign({}, Game.selection), keepLineups = Game.lineups, keepCurrent = UI.current, keepRerender = UI.rerender, problems = [];
      try {
        Game.lineups = {};
        Game.selection.mode = 'free';
        const plain = UI.screen_setup();
        if (!plain.includes('data-local="rounds"') || !plain.includes('data-local="timer"') || plain.includes('Not used')) problems.push('plain Free Fight rows');
        Game.lineupFor('free').slots.push({ id: 'brutus', human: false, team: 0 });
        const one = UI.screen_setup();
        if (one.includes('data-local="rounds"') || one.includes('data-local="timer"') || (one.match(/Not used/g) || []).length !== 2 || !one.includes('data-local="diff"')) problems.push('Free Fight with 3 fighters');
        Game.selection.mode = 'versus';
        Game.lineupFor('versus').slots.push({ id: 'brutus', human: false, team: 0 });
        const vs = UI.screen_setup();
        if (vs.includes('data-local="rounds"') || (vs.match(/Not used/g) || []).length !== 2) problems.push('Versus with a CPU');
        const teams = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false]])), duel = lineupMatch(lineupOf([['kai', 0, true], ['mara', 0, false]])), crowd = lineupMatch(ffaOf(4));
        const labels = [teams, duel, crowd].map((m) => UI.roundSub(m));
        if (labels.join('|') !== '2 FIGHTERS · 2 TEAMS|2 FIGHTERS · ONE ON ONE|4 FIGHTERS · FREE-FOR-ALL') problems.push('labels ' + labels.join('|'));
        Game.selection.mode = 'brawl'; Game.selection.difficulty = 'easy';
        const lonely = Game.lineupFor('brawl');
        lonely.slots = [{ id: 'kai', human: true, team: 1 }, { id: 'mara', human: false, team: 2 }, { id: 'brutus', human: false, team: 2 }];
        const nobody = UI.screen_lineup();
        if (!/teams are uneven[^<]*nobody extra[^<]*never weakened/.test(nobody) || /nothing changes/.test(nobody) || /-\d+%/.test(nobody)) problems.push('uneven teams, nobody helped: ' + (nobody.match(/<p class="hint">[^<]*/) || [''])[0].slice(-200));
        Game.selection.difficulty = 'hard';
        const helped = UI.screen_lineup();
        if (!/up to \d+% more health and damage; a player is never weakened/.test(helped)) problems.push('uneven teams, a smaller team helped');
        lonely.slots = [{ id: 'kai', human: true, team: 1 }, { id: 'mara', human: false, team: 2 }];
        if (!/teams are equal, nothing changes/.test(UI.screen_lineup())) problems.push('equal teams');
        let redraws = 0;
        UI.rerender = () => { redraws++; };
        UI.current = 'lineup'; Events.emit('padsChanged', {});
        UI.current = 'setup'; Events.emit('padsChanged', {});
        if (Events.handlers.padsChanged && redraws !== 1) problems.push('pads changed: ' + redraws + ' redraws');   // the listener exists once the UI is wired (the browser run)
      } finally { UI.rerender = keepRerender; UI.current = keepCurrent; Game.lineups = keepLineups; Object.assign(Game.selection, keepSel); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup: the HUD and the results know more than two sides (the enemy bar counts every other team, the labels, the round-end banner, the fanfare, the results table, the far person stays framed)', () => {
      const problems = [];
      const m = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false], ['brutus', 0, true]]));
      quietAll(m);
      const keepDom = ['hp2', 'hg2', 'ht2'].map((id) => UI.dom[id]), keepCache = UI.cache, keepGhost = UI.ghost, keepBanner = UI.banner;
      const banners = [];
      try {
        UI.dom.hp2 = { style: {} }; UI.dom.hg2 = { style: {} }; UI.dom.ht2 = {}; UI.cache = {}; UI.ghost = [1, 1];
        UI.banner = (text, sub) => { banners.push(text + '/' + sub); };
        UI.enemyBar(m);
        const all = UI.dom.ht2.textContent === '2 / 2 UP';
        Combat.knockOut(m.fighters[1], m.fighters[0], null, m);
        UI.enemyBar(m);
        if (!all || UI.dom.ht2.textContent !== '1 / 2 UP') problems.push('enemy bar ' + UI.dom.ht2.textContent);
        if (UI.tagLabel(m, 0) !== '1P' || UI.tagLabel(m, 1) !== 'CPU' || UI.tagLabel(m, 2) !== '2P') problems.push('labels ' + [0, 1, 2].map((i) => UI.tagLabel(m, i)).join());
        if (!/P1/.test(UI.lineupHeading(m, true)) || !/RIVALS/.test(UI.lineupHeading(m, false)) || UI.roundSub(m).indexOf('3 FIGHTERS') !== 0) problems.push('headings');
        banners.length = 0;
        UI.onRoundEnd({ match: m, winner: 2, reason: 'ko' }); UI.onRoundEnd({ match: m, winner: -1, reason: 'time' });
        if (banners[0] !== 'K.O./BRUTUS WINS' || banners[1] !== 'DRAW/DRAW') problems.push('banners ' + banners.join(' | '));
      } finally { ['hp2', 'hg2', 'ht2'].forEach((id, i) => { UI.dom[id] = keepDom[i]; }); UI.cache = keepCache; UI.ghost = keepGhost; UI.banner = keepBanner; }
      Combat.knockOut(m.fighters[0], m.fighters[2], null, m);
      self.run(m, KO_DELAY_TICKS + 20);
      const r = m.results();
      r.mode = 'lineup'; r.buttons = ['again', 'setup', 'menu']; r.draw = m.matchWinner < 0;
      const html = UI.lineupResults(r);
      const rows = (html.match(/<tr class="tc/g) || []).length;
      if (m.matchWinner !== 2 || !m.peopleWon() || !r.winnerName || rows !== 3 || /Rounds won/.test(html) || !html.includes(r.winnerName + ' wins') || !/winner/.test(html) || r.lineup.length !== 3 || r.teamNames.length !== 3) problems.push('results ' + JSON.stringify([m.matchWinner, m.peopleWon(), rows]));
      const keepData = Game.resultsData;
      Game.resultsData = r;
      const viaScreen = UI.screen_results();
      Game.resultsData = keepData;
      if (viaScreen !== html) problems.push('the results screen does not use the lineup table');
      const cpuWin = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false]]));
      quietAll(cpuWin);
      Combat.knockOut(cpuWin.fighters[0], cpuWin.fighters[1], null, cpuWin);
      self.run(cpuWin, KO_DELAY_TICKS + 20);
      if (cpuWin.matchWinner !== 1 || cpuWin.peopleWon()) problems.push('a CPU win is no fanfare');
      const far = lineupMatch(lineupOf([['kai', 1, true], ['mara', 2, false], ['brutus', 3, true]]));
      quietAll(far);
      self.stand(far.fighters[0], 0, 0, 5, 0); self.stand(far.fighters[1], 2 * CAMERA_THREAT_RANGE, 0, 0, 0); self.stand(far.fighters[2], -2.4 * CAMERA_THREAT_RANGE, 0, 0, 0);
      Camera.framedFor = null;
      Camera.frameFighters(far.fighters);
      if (!Camera.framed[2] || Camera.framed[1]) problems.push('framing ' + JSON.stringify([Camera.framed[1], Camera.framed[2]]));
      Camera.framedFor = null;
      return problems.length ? problems.join('; ') : true;
    });
    test('Lineup flow: Brawl is on the mode list, the setup screens open the lineup, Start keeps the picks (a pick on the cards reaches the lineup, Start does not copy over it), a plain 1v1 plays the old way, and the people decide the input plan (1 solo, 2 Versus split, 3 and 4 seats on keyboard and gamepads)', () => {
      if (Game.state !== GS.MENU) return 'needs the main menu';
      const keepSel = Object.assign({}, Game.selection), keepLineups = Game.lineups, keepPads = Object.getOwnPropertyDescriptor(navigator, 'getGamepads'), problems = [];
      const pads = [fakePad('a'), fakePad('b'), fakePad('c')];
      try {
        Game.lineups = {};
        if (!MODE_ORDER.includes('brawl') || !MODE_INFO.brawl || MODE_ORDER.indexOf('brawl') > MODE_ORDER.indexOf('coop')) problems.push('mode list');
        Game.chooseMode('brawl');
        UI.act('pick:' + Game.selection.player);
        if (UI.current !== 'lineup') problems.push('brawl pick leads to ' + UI.current);
        UI.act('lineupNext');
        if (Game.state !== GS.ARENASEL) problems.push('lineup to arena ' + Game.state);
        UI.back();
        if (UI.current !== 'lineup' || Game.state !== GS.CHARSEL) problems.push('back from the arena ' + UI.current);
        UI.act('lineupNext'); UI.act('start');
        let m = Game.match;
        if (!m || !m.setup || m.fighters.length !== 4 || m.cfg.setupMode !== 'brawl' || Game.state !== GS.COUNTDOWN || Inputs.coop || Inputs.versus) problems.push('brawl start');
        Game.quitToMenu();
        Game.chooseMode('free');
        UI.act('pick:' + Game.selection.player);
        UI.act('setupNext'); UI.act('start');
        if (!Game.match || Game.match.setup || Game.match.cfg.mode !== 'free') problems.push('a plain Free Fight left the old way');
        Game.quitToMenu();
        Game.chooseMode('free');
        UI.act('pick:' + Game.selection.player);
        UI.act('lineup');
        if (UI.current !== 'lineup') problems.push('Free Fight lineup button');
        UI.lineupLocal('lopp', 1);
        const lineup = Game.lineupFor('free');
        lineup.slots[1].id = 'yuki';
        UI.act('back');
        if (UI.current !== 'setup' || Game.selection.opponent !== 'yuki') problems.push('the lineup picks did not reach the cards ' + Game.selection.opponent);
        UI.act('opp:dmitri');
        if (lineup.slots[1].id !== 'dmitri') problems.push('a card pick did not reach the lineup');
        UI.act('lineup'); UI.act('lineupNext');
        Game.selection.opponent = 'yuki'; lineup.slots[1].id = 'brutus';   // Start must not copy the cards' pick over the lineup
        UI.act('start');
        m = Game.match;
        if (!m || !m.setup || m.fighters.length !== 3 || !m.fighters.some((f) => f.id === 'brutus') || m.fighters.some((f) => f.id === 'yuki' || f.id === 'dmitri') || m.cfg.mode !== 'brawl' || Game.run.mode !== 'lineup') problems.push('Free Fight with 3 fighters');
        Game.quitToMenu();
        Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
        for (const people of [2, 3, 4]) {
          Game.chooseMode('brawl');
          const l = Game.lineupFor('brawl');
          l.slots.forEach((s, i) => { s.human = i < people; });
          l.deal = 'custom'; l.slots.forEach((s, i) => { s.team = i < people ? 1 + (i % 2) : 3; });
          Game.startFromSelection();
          m = Game.match;
          const mode = people === 2 ? Inputs.versus && !Inputs.coop : Inputs.coop && !Inputs.versus && Inputs.seatedSlots().length === people;
          const driven = m ? m.setup.map((slot, i) => Inputs.forFighter(i)).filter(Boolean).length : -1;
          if (!m || !m.setup || !mode || driven !== people || m.personFighters.length !== people) problems.push(people + ' people: ' + JSON.stringify({ mode, driven, devices: Inputs.seats.join() }));
          Game.quitToMenu();
          if (Inputs.coop || Inputs.versus || Inputs.seatedSlots().length) problems.push('input outlived the match after ' + people);
        }
        pads.length = 0;
        Game.chooseMode('brawl');
        Game.lineupFor('brawl').slots.forEach((s, i) => { s.human = i < 3; });
        if (Game.startLineup('brawl') || Game.match || !/gamepads/.test(Game.lineupProblem('brawl'))) problems.push('3 players without pads started');
        if (Game.state !== GS.MENU) Game.quitToMenu();
        Game.chooseMode('versus');
        UI.act('pick:' + Game.selection.player);
        UI.act('pick:' + Game.selection.player2);
        UI.act('lineup');
        UI.lineupLocal('lopp', 1);
        UI.act('lineupNext'); UI.act('start');
        m = Game.match;
        if (!m || !m.setup || m.fighters.length !== 3 || !Inputs.versus || m.cfg.setupMode !== 'versus') problems.push('Versus with a CPU');
        Game.quitToMenu();
      } finally {
        if (Game.state !== GS.MENU) Game.quitToMenu();
        if (keepPads) Object.defineProperty(navigator, 'getGamepads', keepPads); else delete navigator.getGamepads;
        Game.lineups = keepLineups; Object.assign(Game.selection, keepSel);
        Inputs.players.forEach((p) => { p.releaseAll(); p.reset(); });
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Auto quality keeps full scale on a 50 Hz screen and lowers it when 60 Hz frames are slow', () => {
      const keep = { quality: Settings.v.quality, autoScale: Quality.autoScale, best: Quality.bestFrameMs, block: Quality.blockUpUntil, frames: Diag.frameCount };
      const runFrames = (ms, n) => { for (let i = 0; i < n; i++) Quality.adapt(ms, ms / 1000); };
      try {
        Settings.v.quality = 'auto'; Diag.frameCount = Math.max(Diag.frameCount, REFRESH_SETTLE_FRAMES + 1);
        Quality.autoScale = 1; Quality.slowTime = 0; Quality.bestFrameMs = 20;
        runFrames(20, 600);   // 12 s of steady 50 Hz frames
        const at50Hz = Quality.autoScale;
        Quality.autoScale = 1; Quality.slowTime = 0; Quality.bestFrameMs = TARGET_FRAME_MS;
        runFrames(22, 150);   // 3.3 s of 22 ms frames on a 60 Hz screen
        const slow60 = Quality.autoScale;
        return at50Hz === 1 && slow60 < 1 ? true : '50 Hz scale ' + at50Hz + ', slow 60 Hz scale ' + slow60;
      } finally {
        Settings.v.quality = keep.quality; Quality.autoScale = keep.autoScale; Quality.bestFrameMs = keep.best; Quality.blockUpUntil = keep.block;
        Quality.slowTime = 0; Quality.fastTime = 0; Diag.frameCount = keep.frames; Quality.apply();
      }
    });
    /* ----- Weapons and items (P7-02 to P7-04, P7-06) ----- */
    const held = (id) => ({ id, dur: WEAPONS[id].dur, sprays: SPRAY_CHARGES });
    /* A duel on the dojo floor with no items: the player at the origin facing +z, the foe at (0, gap). The test places what it needs (m.placeItem) and gives items (f.item = held(id)). */
    const itemDuel = (gap, s1, s2, opts) => {
      const m = mk(Object.assign({ arenaId: 'dojo', items: true }, opts), s1, s2);
      m.items.length = 0;
      self.stand(m.fighters[0], 0, 0, 0, 5); self.stand(m.fighters[1], 0, gap, 0, 0);
      return m;
    };
    /* The hits of a run as snapshots taken the tick they land; log.stop() unhooks it. */
    const hitLog = () => { const log = []; log.stop = Events.on('hit', (e) => log.push({ id: e.mv.id, kind: e.kind, def: e.def.index, react: e.def.reactDur, state: e.def.state })); return log; };
    test('Items: the table has the 14 items of the spec (class, durability, damage, reach, startup, thrown damage) with 2 or 3 parts each, and every Punch step is a move kept out of ATTACKS', () => {
      const want = 'bottle throwable 1 9 0.35 5 10|brick throwable 3 8 0.25 6 16|binlid light 6 6 0.4 6 8|stick light 8 7 0.7 4 6|bat heavy 6 16 0.9 10 12|pipe heavy 12 14 0.85 9 12|hammer heavy 8 15 0.45 8 14|wrench heavy 10 13 0.6 8 12|chain light 10 9 1 7 8|chair two 3 18 0.8 13 14|skateboard two 5 12 0.8 9 10|broom two 6 7 1.3 7 6|crate carry 2 0 0 0 20|extinguisher heavy 4 12 0.5 10 12';
      const got = Object.keys(WEAPONS).map((id) => { const w = WEAPONS[id]; return [id, w.cls, w.dur, w.dmg, w.reach, w.startup, w.thrown].join(' '); }).join('|');
      const parts = Object.keys(WEAPONS).filter((id) => WEAPONS[id].parts.length < 2 || WEAPONS[id].parts.length > 3);
      const moves = Object.keys(WEAPONS).every((id) => {
        const w = WEAPONS[id], n = WEAPON_STEPS[w.cls] + (id === 'stick' ? 1 : 0), first = WEAPON_MOVES[id + ':1'];
        return Array.from({ length: n }, (u, i) => WEAPON_MOVES[id + ':' + (i + 1)]).every((mv) => mv && !ATTACKS[mv.id]) && (n === 0 || (Math.abs(first.reach - (0.8 + w.reach)) < 1e-9 && first.startup === w.startup));
      });
      const label = heldLabel({ item: { id: 'bat', dur: 4 } }) === 'BASEBALL BAT ●●●●○○' && heldLabel({ item: null }) === '';
      return got === want && !parts.length && moves && label ? true : JSON.stringify({ table: got === want, parts, moves, label });
    });
    test('Items: Use picks up an item in reach (floor, table or rack height) with the matching grab pose over 14 ticks; a hit before it is in the hand cancels the grab; out of reach or empty reach does nothing', () => {
      const problems = [];
      [[0, 'reachLow'], [0.9, 'reachMid'], [1.4, 'reachHigh']].forEach(([y, anim]) => {
        const m = itemDuel(5, once(2, 'use')), f = m.fighters[0], loose = m.placeItem('bat', 0, 0.7, y);
        if (y) loose.host = { destroyed: false };   // it lies on a table or hangs on a bracket (a loose item with nothing under it falls)
        let n = 0;
        for (let t = 1; t <= 40; t++) {
          m.step();
          if (f.state === S.ATTACK) n++;
          if (t === 5 && (f.move.anim !== anim || f.pickup !== loose || !m.items.includes(loose) || f.item)) problems.push(anim + ': not grabbing at tick 5');
          if (t === 14 && (!f.item || f.item.id !== 'bat' || m.items.includes(loose))) problems.push(anim + ': not in the hand');
        }
        if (n !== PICKUP_TICKS || PICKUP_TAKE_TICK >= PICKUP_TICKS) problems.push(anim + ': ' + n + ' ticks');
      });
      const cut = itemDuel(5, once(2, 'use')), loose = cut.placeItem('bat', 0, 0.7, 0);
      self.run(cut, 5); cut.fighters[0].reactDur = 10; cut.fighters[0].setState(S.HIT); self.run(cut, 30);
      if (cut.fighters[0].item || !cut.items.includes(loose) || loose.mode !== 'rest') problems.push('a hit did not cancel the grab');
      const far = itemDuel(5, once(2, 'use')); far.placeItem('bat', 0, -0.9, 0); far.placeItem('bat', 0, 1.6, 0); self.run(far, 20);
      const bare = itemDuel(5, once(2, 'use')); self.run(bare, 20);
      if (far.fighters[0].item || far.fighters[0].state === S.ATTACK || bare.fighters[0].state === S.ATTACK) problems.push('Use out of reach did something');
      const two = itemDuel(5); two.placeItem('pipe', 0.3, 0.8, 0); const straight = two.placeItem('bat', 0.05, 0.8, 0);
      if (two.itemInReach(two.fighters[0]) !== straight) problems.push('not the item nearest the facing line');
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: Use while holding throws at the locked enemy (not the nearest one), the item hurts only that enemy, costs 1 durability, and a brick to the head knocks down', () => {
      const m = self.makeBrawl({ enemies: 2, arenaId: 'dojo', items: true }, once(2, 'use'));
      m.controllers[0].human = true; m.items.length = 0;
      const [p, near, far] = m.fighters;
      self.stand(p, 0, 0, 0, 5); self.stand(near, 2.5, 1.5, 0, 0); self.stand(far, -1, 4.5, 0, 0);
      p.item = held('brick'); p.lockOn = far;
      const log = hitLog();
      self.run(m, 70);
      log.stop();
      const left = m.items.find((i) => i.id === 'brick');
      const ok = log.length === 1 && log[0].id === 'throw_brick' && log[0].def === far.index && log[0].kind === 'knockdown' && near.hp === near.maxHp && p.hp === p.maxHp && !p.item && left && left.dur === WEAPONS.brick.dur - 1 && far.hp < far.maxHp;
      return ok ? true : JSON.stringify({ log, nearHurt: near.hp < near.maxHp, left: left && left.dur, item: p.item });
    });
    test('Items: Crouch + Use drops the held item at the feet with its wear; Use alone throws it along the facing when nothing is locked; touch USE shows only with an item held or in reach', () => {
      const problems = [];
      const drop = itemDuel(5, once(2, 'use', { crouch: true })), f = drop.fighters[0];
      f.item = { id: 'bat', dur: 4, sprays: 3 };
      self.run(drop, 4);
      const lying = drop.items[0];
      if (f.item || drop.items.length !== 1 || !lying || lying.id !== 'bat' || lying.dur !== 4 || Math.hypot(lying.x - f.x, lying.z - f.z) > 0.6 || drop.fighters[1].hp !== drop.fighters[1].maxHp) problems.push('drop');
      const th = itemDuel(5, once(2, 'use')), g = th.fighters[0];
      th.controllers[0].human = true; self.stand(g, 0, 0, 5, 0); g.item = held('bottle');
      const shownHeld = touchUseVisible(g, th);
      self.run(th, 3);
      const flying = th.items[0];
      if (g.item || !flying || flying.mode !== 'fly' || flying.vx < 5 || Math.abs(flying.vz) > flying.vx) problems.push('throw along the facing');
      const idle = itemDuel(5);
      const empty = touchUseVisible(idle.fighters[0], idle);
      idle.placeItem('stick', 0, 0.6, 0);
      if (!shownHeld || empty || !touchUseVisible(idle.fighters[0], idle)) problems.push('touch USE: held ' + shownHeld + ', empty ' + empty);
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: a hit costs the weapon 1 durability, landed or blocked; at 0 it breaks into debris and is gone; a bottle shatters on its first hit and adds stun', () => {
      const problems = [];
      const swing = (id, dur, foeScript, setup) => {
        const m = itemDuel(1.2, once(2, 'punch'), foeScript), f = m.fighters[0];
        f.item = { id, dur, sprays: 3 };
        if (setup) setup(m);
        const log = hitLog(), broke = [], off = Events.on('itemBreak', (e) => broke.push(e.id));
        self.run(m, 60); log.stop(); off();
        return { m, f, log, broke };
      };
      const landed = swing('bat', 2);
      if (landed.f.item.dur !== 1 || !landed.log.length || landed.broke.length) problems.push('landed hit: dur ' + (landed.f.item && landed.f.item.dur));
      const worn = swing('bat', 1);
      if (worn.f.item || worn.broke.join() !== 'bat' || worn.m.items.length) problems.push('a worn bat did not break');
      const blocked = swing('bat', 2, (it) => { it.defend = true; }, (m) => { m.fighters[1].defense = 'block'; });
      if (!blocked.f.item || blocked.f.item.dur !== 1 || blocked.log.length) problems.push('blocked hit: dur ' + (blocked.f.item && blocked.f.item.dur) + ', hits ' + blocked.log.length);
      const bottle = swing('bottle', 1), stick = swing('stick', 8);
      if (bottle.f.item || bottle.broke.join() !== 'bottle' || bottle.log[0].react < SHATTER_STUN + 10 || stick.log[0].react >= SHATTER_STUN + 10) problems.push('bottle stun ' + bottle.log[0].react + ' against ' + stick.log[0].react);
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: a knockdown, a strong step that lands and a throw each make the victim drop the item at their feet; a light hit does not', () => {
      const problems = [];
      const acts = {
        knockdown: (m, a, b) => Combat.landHit({ type: 'strike', att: a, def: b, mv: ATTACKS.heavy_roundhouse, block: 'none' }, m),
        'strong step': (m, a, b) => Combat.landHit({ type: 'strike', att: a, def: b, mv: ATTACKS.power_jab, block: 'none' }, m),
        throw: (m, a, b) => { a.throwPending = { tick: 0, dir: 'fwd', data: throwFor('front', 'fwd', moveStyleFor(a.profile)), side: 1, baseYaw: b.yaw }; Combat.executeThrow(a, b, m); },
      };
      for (const label in acts) {
        const m = itemDuel(1.2), [a, b] = m.fighters;
        b.item = held('bat');
        acts[label](m, a, b);
        const dropped = m.items[0];
        if (b.item || m.items.length !== 1 || !dropped || dropped.id !== 'bat' || Math.hypot(dropped.x - b.x, dropped.z - b.z) > 0.6) problems.push(label + ': not dropped');
        if (label === 'strong step' && b.state === S.THROWN) problems.push('a strong step knocked down');
      }
      const m = itemDuel(1.2), [a, b] = m.fighters; b.item = held('bat'); Combat.landHit({ type: 'strike', att: a, def: b, mv: ATTACKS.jab, block: 'none' }, m);
      if (!b.item) problems.push('a light hit disarmed');
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: Punch strings by class (light 3 steps, heavy 2, two-handed 2, throwable 1, crate none), Kicks stay the fighter\'s own, Kali with the stick gets 4; a bat string plays its two steps and the last one knocks down', () => {
      const problems = [];
      const len = (style, id) => ['P', 'PP', 'PPP', 'PPPP'].filter((keys) => weaponTable(style, id).stand[keys]).length;
      Object.keys(WEAPONS).filter((id) => WEAPONS[id].cls !== 'carry').forEach((id) => {
        const want = WEAPON_STEPS[WEAPONS[id].cls], table = weaponTable('kickboxer', id).stand;
        if (len('kickboxer', id) !== want) problems.push(id + ' ' + len('kickboxer', id) + ' steps, wanted ' + want);
        if (table.K.join() !== STRINGS.stand.K.join() || table.KK.join() !== STRINGS.stand.KK.join()) problems.push(id + ': Kick strings changed');
      });
      if (len('kali', 'stick') !== 4 || len('boxer', 'stick') !== 3 || len('kali', 'bat') !== 2) problems.push('Kali stick');
      const kali = new Fighter(ROSTER_BY_ID.marlon, 0), plain = new Fighter(ROSTER_BY_ID.kai, 1);
      kali.item = held('stick'); plain.item = held('stick');
      if (kali.maxSteps !== 4 || plain.maxSteps !== 3 || !kali.strings.stand.PPPP) problems.push('Kali fighter');
      const crate = new Fighter(ROSTER_BY_ID.kai, 0); crate.item = held('crate');
      if (crate.resolveMove({ btn: 'punch', height: false, tick: 1 }) !== null || !crate.resolveMove({ btn: 'kick', height: false, tick: 1 })) problems.push('crate strikes');
      const m = itemDuel(1.2, pressString('PP')), log = hitLog();
      m.fighters[0].item = held('bat');
      self.run(m, 90); log.stop();
      if (log.map((h) => h.id).join() !== 'bat:1,bat:2' || log[1].kind !== 'knockdown' || log[0].kind === 'knockdown') problems.push('bat string ' + log.map((h) => h.id + ':' + h.kind).join());
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: a crate in the arms slows the walk to 70 percent and stops running, has no Punch strikes (Kick works), and Grapple puts a two-handed item down first but keeps a one-handed one', () => {
      const problems = [];
      const walked = (item, run) => { const m = itemDuel(12, (it) => { it.fwd = 1; it.run = run; }), f = m.fighters[0]; f.item = item; self.run(m, 40); return { z: f.z, state: f.state }; };
      const bare = walked(null, false), crate = walked(held('crate'), false), runBare = walked(null, true), runCrate = walked(held('crate'), true);
      if (Math.abs(crate.z / bare.z - CARRY_WALK) > 0.02 || runBare.state !== S.RUN || runCrate.state !== S.WALK || runCrate.z > crate.z * 1.01) problems.push('walk ' + (crate.z / bare.z).toFixed(3) + ' ' + runBare.state + ' ' + runCrate.state);
      const struck = (key) => { const m = itemDuel(1.2, once(2, key)); m.fighters[0].item = held('crate'); self.run(m, 40); return m.fighters[1].hp < m.fighters[1].maxHp; };
      if (struck('punch') || !struck('kick')) problems.push('crate Punch / Kick');
      const grab = (id) => { const m = itemDuel(1.2, once(2, 'grapple')); m.fighters[0].item = held(id); self.run(m, 6); return { item: m.fighters[0].item, lying: m.items.length }; };
      if (grab('chair').item || grab('chair').lying !== 1 || !grab('bat').item || grab('crate').item) problems.push('Grapple with items');
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: thrown specials - a bottle shatters (+stun), a brick to the head knocks down, a crate knocks down everyone near and breaks, a skateboard trips, an extinguisher hits and blinds', () => {
      const problems = [];
      const throwAt = (id, spots) => {
        const m = self.makeBrawl({ enemies: spots.length, arenaId: 'dojo', items: true }, once(2, 'use'));
        m.items.length = 0; self.stand(m.fighters[0], 0, 0, 0, 5);
        spots.forEach(([x, z], k) => self.stand(m.fighters[k + 1], x, z, 0, 0));
        m.fighters[0].item = held(id);
        const log = hitLog(), broke = [], off = Events.on('itemBreak', (e) => broke.push(e.id));
        for (let left = 60; left > 0 && !log.length; left--) m.step();
        self.run(m, 3); log.stop(); off();
        return { m, log, broke, foes: m.fighters.slice(1) };
      };
      const bottle = throwAt('bottle', [[0, 3]]);
      if (bottle.log.length !== 1 || bottle.log[0].react < SHATTER_STUN + 10 || bottle.broke.join() !== 'bottle') problems.push('bottle ' + JSON.stringify(bottle.log));
      const brick = throwAt('brick', [[0, 4]]);
      if (!brick.log.length || brick.log[0].kind !== 'knockdown' || brick.broke.length || !brick.m.items.some((i) => i.id === 'brick' && i.dur === WEAPONS.brick.dur - 1)) problems.push('brick head hit ' + JSON.stringify(brick.log));
      const crate = throwAt('crate', [[0, 3.5], [0.7, 3.7]]);
      if (crate.log.filter((h) => h.kind === 'knockdown').length !== 2 || crate.broke.join() !== 'crate' || crate.m.items.length) problems.push('crate ' + JSON.stringify(crate.log));
      const board = throwAt('skateboard', [[0, 3]]);
      if (!board.log.length || board.log[0].kind !== 'knockdown' || board.foes[0].state === S.IDLE) problems.push('skateboard ' + JSON.stringify(board.log));
      const ext = throwAt('extinguisher', [[0, 3], [0.8, 3.2]]);
      if (!ext.log.length || ext.foes.some((f) => f.blind <= 0) || ext.log[0].kind !== 'hit' || ext.broke.join() !== 'extinguisher') problems.push('extinguisher ' + JSON.stringify(ext.log) + ext.foes.map((f) => f.blind));
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: held specials - hammer breaks a crate in one hit, chain gets half damage through a block, bin lid blocks for free and turns a Sway fighter into a blocker, wrench pulls into a clinch, chair hits every foe in front, broom\'s second step trips, extinguisher sprays a blinding cone', () => {
      const problems = [];
      const smash = (id) => {
        const m = itemDuel(5, once(2, 'punch'), null, { arenaId: 'warehouse' }), f = m.fighters[0];
        self.stand(f, -5.4, -1.2, -5.4, -5); self.stand(m.fighters[1], -5.4, -4.6, -5.4, -5);
        f.item = held(id); self.run(m, 50);
        return Arena.objects.find((o) => o.id === 'crateA').destroyed;
      };
      if (!smash('hammer') || smash('stick')) problems.push('hammer');
      const wrapped = (id) => {
        const m = itemDuel(1.2, once(2, 'punch'), (it) => { it.defend = true; }), blocks = [];
        m.fighters[1].defense = 'block'; m.fighters[0].item = held(id);
        const off = Events.on('block', () => blocks.push(1)); self.run(m, 50); off();
        return { blocks: blocks.length, hp: m.fighters[1].hp / m.fighters[1].maxHp };
      };
      const chain = wrapped('chain'), stick = wrapped('stick');
      if (!chain.blocks || chain.hp >= 1 || stick.hp !== 1) problems.push('chain ' + JSON.stringify([chain, stick]));
      const shield = (item) => {
        const m = itemDuel(1.2, once(2, 'punch'), (it) => { it.defend = true; }), d = m.fighters[1];
        d.item = item; self.run(m, 50);
        return { stam: d.stam / d.maxStam, mode: d.guardMode, dur: d.item && d.item.dur };
      };
      const lid = shield(held('binlid')), none = shield(null);
      if (lid.stam !== 1 || none.stam >= 1 || lid.mode !== 'block' || none.mode !== 'sway' || lid.dur !== WEAPONS.binlid.dur - 1) problems.push('bin lid ' + JSON.stringify([lid, none]));
      const wrench = itemDuel(1.4, pressString('PP')); wrench.fighters[0].item = held('wrench');
      let clinched = false;
      for (let t = 0; t < 90; t++) { wrench.step(); if (wrench.fighters[1].state === S.CLINCH && wrench.fighters[0].state === S.GRAPPLE) clinched = true; }
      if (!clinched) problems.push('wrench');
      const chairs = self.makeBrawl({ enemies: 2, arenaId: 'dojo', items: true }, once(2, 'punch')), chairLog = hitLog();
      chairs.items.length = 0; self.stand(chairs.fighters[0], 0, 0, 0, 5); self.stand(chairs.fighters[1], -0.5, 1.4, 0, 0); self.stand(chairs.fighters[2], 0.5, 1.4, 0, 0);
      chairs.fighters[0].item = held('chair'); self.run(chairs, 50); chairLog.stop();
      if (new Set(chairLog.filter((h) => h.id === 'chair:1').map((h) => h.def)).size !== 2) problems.push('chair ' + JSON.stringify(chairLog));
      const broom = itemDuel(1.5, pressString('PP')), broomLog = hitLog(); broom.fighters[0].item = held('broom'); self.run(broom, 90); broomLog.stop();
      if (broomLog.map((h) => h.id).join() !== 'broom:1,broom:2' || broomLog[1].kind !== 'knockdown' || WEAPON_MOVES['broom:2'].h !== 'L') problems.push('broom ' + JSON.stringify(broomLog));
      const spray = itemDuel(1.3, once(2, 'punch')); spray.fighters[0].item = held('extinguisher');
      let blindMax = 0; for (let t = 0; t < 40; t++) { spray.step(); blindMax = Math.max(blindMax, spray.fighters[1].blind); }
      if (blindMax <= 0 || blindMax > BLIND_TICKS || spray.fighters[0].item.sprays !== SPRAY_CHARGES - 1) problems.push('spray ' + blindMax + ' ' + spray.fighters[0].item.sprays);
      const cone = itemDuel(1.5), c = cone.fighters[0]; c.item = held('extinguisher'); cone.spray(c);
      const aimed = cone.fighters[1].blind === BLIND_TICKS;
      self.stand(cone.fighters[1], 0, -1, 0, 0); cone.fighters[1].blind = 0; cone.spray(c);
      const behind = cone.fighters[1].blind;
      self.stand(cone.fighters[1], 0, 2.6, 0, 0); cone.spray(c);
      if (!aimed || behind || cone.fighters[1].blind || c.item.sprays !== 0) problems.push('spray cone: front ' + aimed + ', behind ' + behind + ', far ' + cone.fighters[1].blind);
      if (Object.keys(WEAPONS).filter((id) => WEAPONS[id].metal).join() !== 'pipe') problems.push('metal flag');
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: a weapon hit costs the blocker 1.5 times the stamina, and the last step of a heavy or two-handed item breaks a block that is not perfect', () => {
      const lost = (mv) => {
        const m = itemDuel(1.2), [a, b] = m.fighters;
        b.setState(S.BLOCK_H); const before = b.stam;
        Combat.blockHit({ att: a, def: b, mv, block: 'block' }, m, false);
        return before - b.stam;
      };
      const ratio = lost(Object.assign({}, ATTACKS.cross, { wpn: 'bat' })) / lost(Object.assign({}, ATTACKS.cross));
      const breaks = Object.keys(WEAPONS).filter((id) => ['heavy', 'two'].includes(WEAPONS[id].cls)).every((id) => WEAPON_MOVES[id + ':2'].gb && WEAPON_MOVES[id + ':1'].tier < 3 && !WEAPON_MOVES[id + ':1'].gb);
      const m = itemDuel(1.2), [a, b] = m.fighters; b.setState(S.BLOCK_H);
      Combat.blockHit({ att: a, def: b, mv: WEAPON_MOVES['bat:2'], block: 'block' }, m, false);
      return Math.abs(ratio - 1.5) < 1e-6 && breaks && b.state === S.STUN ? true : JSON.stringify({ ratio, breaks, state: b.state });
    });
    test('Items: a CPU without an attack token fetches a floor item that is closer than its target, throws a bottle at 3 to 8 m, and the thrown bottle hurts the target', () => {
      const m = track(new MatchSim({ mode: 'free', arenaId: 'dojo', countdown: false, timer: 0, seed: 4, difficulty: 'hard', items: true }));
      m.items.length = 0;
      m.controllers[0] = new AIController(m.fighters[0].profile, 'hard'); m.controllers[1] = self.scripted(() => {});
      self.stand(m.fighters[0], -2, 0, 3, 0); self.stand(m.fighters[1], 3, 0, -3, 0);
      m.placeItem('bottle', -1.4, 0.4, 0);
      const events = [], offs = ['itemTake', 'itemThrow', 'hit'].map((name) => Events.on(name, (e) => events.push(name + (e.f ? e.f.index : e.att.index) + (e.mv ? e.mv.id : ''))));
      self.run(m, 400); offs.forEach((off) => off());
      const ok = events.includes('itemTake0') && events.includes('itemThrow0') && events.includes('hit0throw_bottle') && events.indexOf('itemTake0') < events.indexOf('itemThrow0');
      return ok ? true : events.join(',');
    });
    test('Items: the Items setting is on by default and off spawns nothing; each arena places 4 to 10 items at floor, table and rack heights; at most 12 stay loose; a seeded run with items repeats exactly and the default CPU run uses none', () => {
      const problems = [];
      if (SETTING_DEFS.items.def !== true || Settings.validate('items', 'x') !== true || track(new MatchSim({ countdown: false })).items.length === 0) problems.push('defaults');
      for (const id of ARENA_ORDER) {
        const on = track(new MatchSim({ arenaId: id, countdown: false, seed: 2 })), off = track(new MatchSim({ arenaId: id, countdown: false, seed: 2, items: false }));
        const kinds = new Set(on.items.map((i) => (i.y < 0.4 ? 'floor' : i.y < 1.1 ? 'table' : 'rack')));
        if (on.items.length < 4 || on.items.length > 10 || kinds.size !== 3 || off.items.length) problems.push(id + ' ' + on.items.length + ' ' + [...kinds].join('/') + ' off ' + off.items.length);
      }
      const crowded = itemDuel(5); for (let k = 0; k < 15; k++) crowded.placeItem('brick', -3 + k * 0.4, 3, 0);
      if (crowded.items.length !== ITEM_MAX || crowded.items[0].x < -3 + 3 * 0.4 - 1e-9) problems.push('loose item maximum ' + crowded.items.length);
      let picked = 0;
      const base = { seed: 6, difficulty: 'hard', playerId: 'kai', opponentId: 'mara', arenaId: 'dojo', winsNeeded: 1, timer: 25 };
      const run = (extra) => JSON.stringify(SimRunner.run(Object.assign({ listeners: { itemTake: () => { picked++; } } }, base, extra)));
      const a = run({ items: true }), b = run({ items: true });
      picked = 0; run({});
      if (a !== b) problems.push('an items run is not repeatable');
      if (picked !== 0) problems.push('the default run uses items');
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: a thrown item hits only fighters a strike can touch (not a clinch, a knockdown flight, a wake-up, a hold by somebody else; a juggle yes), and one shared rule serves both', () => {
      const m = itemDuel(1.2), [a, b] = m.fighters, problems = [];
      if (!Combat.strikable(a, b)) problems.push('idle foe');
      b.strikeGrace = 5; if (Combat.strikable(a, b)) problems.push('wake-up'); b.strikeGrace = 0;
      b.state = S.CLINCH; if (Combat.strikable(a, b)) problems.push('clinch'); b.state = S.GRAPPLE; if (Combat.strikable(a, b)) problems.push('grapple');
      b.state = S.THROWN; b.juggle = false; if (Combat.strikable(a, b)) problems.push('flight'); b.juggle = true; b.juggleCount = 0; if (!Combat.strikable(a, b)) problems.push('juggle');
      b.state = S.IDLE; b.pinnedBy = m.fighters[0]; if (!Combat.strikable(a, b)) problems.push('own hold'); b.pinnedBy = { other: 1 }; if (Combat.strikable(a, b)) problems.push('hold by another'); b.pinnedBy = null;
      const hit = (setup) => { const d = itemDuel(3, once(2, 'use')); d.fighters[0].item = held('brick'); setup(d.fighters[1]); const log = hitLog(); self.run(d, 50); log.stop(); return log.length; };
      const idleHits = hit((f) => { f.state = S.IDLE; }), flightHits = hit((f) => { f.setState(S.THROWN); f.vy = 6; f.y = 0.5; f.juggle = false; });   // a flight that lasts the item's whole way
      if (idleHits !== 1 || flightHits !== 0) problems.push('item hits ' + idleHits + ' ' + flightHits);
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: a front Block stops a thrown item for 1.5 times the stamina (a perfect block free), a bottle still shatters and a crate bursts without the knockdown, a skateboard needs the low guard, a Sway dodges', () => {
      const problems = [];
      const throwInto = (id, state, extra) => {
        const m = itemDuel(3, once(2, 'use'), (it) => { it.defend = true; it.crouch = state === S.BLOCK_L; }), d = m.fighters[1];
        d.defense = 'block'; m.fighters[0].item = held(id); if (extra) extra(d);
        const log = hitLog(), blocks = [], broke = [], offs = [Events.on('block', (e) => blocks.push(e.perfect)), Events.on('itemBreak', (e) => broke.push(e.id))];
        self.run(m, 50); log.stop(); offs.forEach((off) => off());
        return { m, d, hits: log.length, blocks, broke, stam: d.stam / d.maxStam, hp: d.hp === d.maxHp };
      };
      const brick = throwInto('brick', S.BLOCK_H);
      if (brick.hits || brick.blocks.length !== 1 || brick.stam >= 1 || !brick.hp || !brick.m.items.some((i) => i.id === 'brick' && i.dur === WEAPONS.brick.dur - 1)) problems.push('brick ' + JSON.stringify({ h: brick.hits, b: brick.blocks, s: brick.stam }));
      const perfect = throwInto('brick', S.BLOCK_H, (d) => { d.blockFresh = true; d.stateTicks = 0; d.lastBlockAt = -999; });
      const bottle = throwInto('bottle', S.BLOCK_H), crate = throwInto('crate', S.BLOCK_H);
      if (bottle.hits || bottle.broke.join() !== 'bottle' || crate.hits || crate.broke.join() !== 'crate' || crate.m.fighters[1].state === S.THROWN) problems.push('bottle / crate');
      const high = throwInto('skateboard', S.BLOCK_H), low = throwInto('skateboard', S.BLOCK_L);
      if (!high.hits || low.hits || low.blocks.length !== 1) problems.push('skateboard ' + high.hits + ' ' + low.hits);
      void perfect;
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: a CPU holding a crate throws it at any range up to 8 m, even point-blank, and the other classes have strikes, so none is stuck', () => {
      const m = track(new MatchSim({ mode: 'free', arenaId: 'dojo', countdown: false, timer: 0, seed: 4, difficulty: 'hard', items: true }));
      m.items.length = 0; m.controllers[0] = new AIController(m.fighters[0].profile, 'hard'); m.controllers[1] = self.scripted(() => {});
      self.stand(m.fighters[0], 0, 0, 0, 5); self.stand(m.fighters[1], 0, 1.5, 0, 0); m.fighters[0].item = held('crate');
      let thrown = 0; const off = Events.on('itemThrow', () => thrown++); self.run(m, 120); off();
      const cls = Object.keys(WEAPONS).filter((id) => WEAPONS[id].cls !== 'carry' && !WEAPON_STEPS[WEAPONS[id].cls]);
      return thrown === 1 && !cls.length ? true : 'thrown ' + thrown + ' ' + cls;
    });
    test('Items: a raised item is reachable from any side within 1 m of the body edge, a Use pressed while locked or busy is kept for 12 ticks, and any entry into the down state disarms', () => {
      const problems = [];
      const m = itemDuel(5, once(2, 'use')), f = m.fighters[0];
      const top = m.placeItem('wrench', 0.9, -0.7, 0.9);   // beside and behind, on a table-high top
      if (m.itemInReach(f) !== top) problems.push('raised item behind');
      const far = itemDuel(5); far.placeItem('wrench', 2.0, 0, 0.9); if (far.itemInReach(far.fighters[0])) problems.push('raised item too far');
      const buffered = itemDuel(5, once(2, 'use')); buffered.placeItem('bat', 0, 0.7, 0); buffered.fighters[0].lock = 6; self.run(buffered, 20);
      if (!buffered.fighters[0].item) problems.push('Use press lost during a lock');
      const down = itemDuel(1.2), d = down.fighters[1]; d.item = held('bat'); d.setState(S.HIT); d.setState(S.DOWN);
      if (d.item || down.items.length !== 1) problems.push('down state keeps the item');
      return problems.length ? problems.join('; ') : true;
    });
    test('Items: next round an item whose table broke falls onto the rubble or floor instead of starting inside it, and pillar items are mounted on a bracket along the wall', () => {
      const problems = [];
      const m = track(new MatchSim({ arenaId: 'warehouse', countdown: false, seed: 3 }));
      const wrench = m.items.find((i) => i.id === 'wrench'), pipe = m.items.find((i) => i.id === 'pipe'), bottle = m.items.find((i) => i.id === 'bottle');
      if (!pipe.mount || Math.abs(pipe.mount[0]) + Math.abs(pipe.mount[1]) !== 1 || Math.abs(Math.sin(pipe.yaw)) !== (pipe.mount[0] ? 0 : 1) || wrench.mount || bottle.mount) problems.push('mounts');   // the pipe hangs on a rack's face
      Arena.breakObject(Arena.objects.find((o) => o.id === 'bench'), 0, 0, 0);
      m.spawnItems();
      const again = m.items.find((i) => i.id === 'wrench');
      if (again.mode !== 'fall' || again.host) problems.push('not falling');
      self.run(m, 90);
      if (again.mode !== 'rest' || !m.items.includes(again) || again.y < 0 || again.y > 1) problems.push('did not land: ' + again.mode + ' ' + again.y);
      return problems.length ? problems.join('; ') : true;
    });
    /* ----- Levels (P8-02, P8-04, P8-06): the rebuilt arenas, decks, stairs, falls, collapses, CPU on stairs, the camera at height, the preset budget ----- */
    const walkTo = (x, z, run) => (it, f) => { f.blind = 3; if (Math.hypot(x - f.x, z - f.z) > 0.2) { f.yaw = f.prevYaw = Math.atan2(x - f.x, z - f.z); it.fwd = 1; it.run = !!run; } };   // blind: it does not turn to its foe, it walks the way it was told
    const onDeck = (f, deck) => { f.x = f.prevX = deck.x; f.z = f.prevZ = deck.z; f.y = f.prevY = deck.collider.top; f.groundY = f.supportY = deck.collider.top; f.vy = 0; };
    test('Levels: every arena builds from its rows inside the sheet limits, with unique ids and valid links, clear spawns, and no gap that can trap a body', () => {
      const problems = [], want = { warehouse: [19, 10, 4], dojo: [15, 6, 2], pit: [16, 10, 4], rooftop: [21, 10, 4], subway: [17, 8, 3], garage: [18, 10, 3], construction: [20, 10, 4], club: [20, 9, 3] }, body = 0.68;   // destructibles, placed items, hazards (the P8-01 sheets); 0.68 = two body radii
      for (const id of ARENA_ORDER) {
        const def = ARENAS[id], built = builtOf(def);
        Arena.build(def);
        const ids = new Set(Arena.objects.map((o) => o.id)), posts = (def.hazards || []).filter((h) => HAZARDS[h[0]].post).length, b = def.bounds;
        if (ids.size !== Arena.objects.length) problems.push(id + ' ids repeat');
        if (def.objects.length > 24 || built.objects.length - def.objects.length > 40 || Arena.colliders.length + posts > 60 || (def.items || []).length > 10) problems.push(id + ' over a level limit');
        const destructible = built.objects.filter((o) => !o.fixed).length;   // the scaffold generator's standards and tier decks count
        if (destructible !== want[id][0] || def.items.length !== want[id][1] || def.hazards.length !== want[id][2]) problems.push(id + ' counts ' + [destructible, def.items.length, def.hazards.length]);
        for (const o of Arena.objects) {
          if (o.on && !ids.has(o.on)) problems.push(id + ' ' + o.id + ' rests on a missing ' + o.on);
          if (o.type === 'deck' && o.h > 3.0) problems.push(id + ' ' + o.id + ' deck too high');
        }
        for (const [item, , , , host] of def.items) if (!WEAPONS[item] || (host && !ids.has(host))) problems.push(id + ' item ' + item + ' / ' + host);
        for (const [type, , , row] of def.hazards) if (!HAZARDS[type] || (row && row.obj && !ids.has(row.obj))) problems.push(id + ' hazard ' + type);
        const rects = Arena.colliders.filter((c) => c.active && c.top > STEP_HEIGHT && !c.base).map((c) => ({ name: c.obj ? c.obj.id : '', on: c.obj ? c.obj.on : '', x: c.x, z: c.z, hx: c.hx, hz: c.hz, step: c.up > 0.25 }));
        for (const [type, x, z, row] of def.hazards) if (HAZARDS[type].post) { const [hx, hz] = HAZARDS[type].post; rects.push({ name: '', on: '', x: row && row.tx !== undefined ? row.tx : x, z: row && row.tz !== undefined ? row.tz : z, hx, hz }); }
        rects.forEach((r, i) => {
          for (const g of [b.x - Math.abs(r.x) - r.hx, b.z - Math.abs(r.z) - r.hz]) if (g < -0.001 || (g > 0.001 && g < body && !r.step && !/\.t\d+\.\d+$/.test(r.name))) problems.push(id + ' wall gap ' + g.toFixed(2) + ' ' + r.name);   // a scaffold tier deck stands where the generator puts it (stepped back from the wall), a step is a stair
          for (const q of rects.slice(i + 1)) {
            const gx = Math.abs(r.x - q.x) - r.hx - q.hx, gz = Math.abs(r.z - q.z) - r.hz - q.hz, gap = Math.hypot(Math.max(gx, 0), Math.max(gz, 0));
            if ((gx > 0.001 || gz > 0.001) && gap < body && !(r.step || q.step) && r.on !== q.name && q.on !== r.name) problems.push(id + ' gap ' + gap.toFixed(2) + ' ' + r.name + ' / ' + q.name);   // a tier deck rests on its standard, a hair away
          }
        });
        for (const sx of [-def.spawn, def.spawn, def.spawn + 0.6]) for (let k = -3; k <= 3; k++) {   // the party line and the enemy line of a brawl
          for (const r of rects) if (Math.hypot(Math.max(Math.abs(sx - r.x) - r.hx, 0), Math.max(Math.abs(k * 0.9 - r.z) - r.hz, 0)) < 0.34 + 0.1) problems.push(id + ' spawn ' + sx + ',' + k * 0.9 + ' blocked');
        }
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Levels: the generators - a stair is steps of 0.25 m rise and 0.35 m run (0.2 / 0.6 for the ramp look) with a foot and a head, a scaffold bay is a standard with weak tiers resting on it and a stair per tier', () => {
      const problems = [];
      const def = { id: 'testGen', objects: [], builds: [['stair', 's', 0, 0, 1, 1.0, 0, 1.5, 'metal', 'grate', ''], ['stair', 'r', 0, 3, 1, 1.0, 0, 1.0, 'concrete', 'ramp', ''], ['scaffold', 'sc', -3, -1, 2, 2, -1]] };
      const built = builtOf(def), steps = built.objects.filter((o) => o.id.startsWith('s.')), ramp = built.objects.filter((o) => o.id.startsWith('r.'));
      if (steps.length !== 6 || Math.abs(steps[5].h - 1.5) > 1e-9 || Math.abs(steps[1].x - 0.525) > 1e-9 || steps[0].hx !== STAIR_RUN / 2 || steps[0].hz !== 0.5 || STAIR_RISE !== 0.25) problems.push('stair steps ' + steps.length);
      if (ramp.length !== 5 || ramp[0].hx !== 0.3 || Math.abs(ramp[4].h - 1.0) > 1e-9 || RAMP_RISE !== 0.2) problems.push('ramp ' + ramp.length);
      if (steps.some((o) => !o.fixed || o.type !== 'deck')) problems.push('steps are not fixed decks');
      Arena.build({ id: 'testGen2', objects: [], builds: [['stair', 's', 3.5, -2, 1, 1.0, 0, 2.5, 'metal', 'grate', '']], bounds: { x: 9, z: 6 }, items: [], hazards: [] });
      if (!Arena.pathBlocked(3.0, -2, 7.0, -2, 0.3, 0) || Arena.pathBlocked(5.0, -2, 5.7, -2, 0.3, 1.5) || !Arena.pathBlocked(6.0, -4, 6.0, -1, 0.3, 0)) problems.push('a stair is no obstacle for a walker on the floor beside its high end, or blocks one climbing it');
      const standards = built.objects.filter((o) => o.type === 'scaffold'), tiers = built.objects.filter((o) => o.id.startsWith('sc.t'));
      if (standards.length !== 2 || tiers.length !== 4 || standards[0].h !== 2 * SCAFFOLD_TIER + 1 || tiers.some((o) => !o.weak || o.mat !== 'wood' || !standards.some((s) => s.id === o.on))) problems.push('scaffold ' + standards.length + ' ' + tiers.length);
      const tier2 = tiers.find((o) => o.id === 'sc.t0.2'), tier1 = tiers.find((o) => o.id === 'sc.t0.1');
      if (!tier2 || tier2.h !== 3.0 || tier1.h !== 1.5 || Math.abs(tier1.z - tier2.z - 1.2) > 1e-9) problems.push('tiers');
      const upper = built.objects.filter((o) => o.id.startsWith('sc.u2.'));
      if (upper.length !== 6 || upper.some((o) => o.on !== 'sc.t0.1') || built.stairs.length !== 4 || built.stairs.some((s) => !Number.isFinite(s.ax + s.az + s.bx + s.bz))) problems.push('tier stairs ' + upper.length + ' ' + built.stairs.length);
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: a fighter climbs the stair of every arena step by step to the deck and stands on it, and walks back down', () => {
      const problems = [];
      for (const id of ARENA_ORDER) {
        for (const s of builtOf(ARENAS[id]).stairs) {
          if (s.id.includes('.u')) continue;   // a scaffold stair ends beside its tier deck, not in front of it: the CPU leg test climbs those
          const m = mk({ arenaId: id }, walkTo(s.bx + s.dx * 1.2, s.bz + s.dz * 1.2), () => {}), [a, b] = m.fighters;
          self.stand(a, s.ax, s.az, s.bx + s.dx * 3, s.bz + s.dz * 3); self.stand(b, s.bx + s.dx * 2.2, s.bz + s.dz * 2.2, s.ax, s.az);
          b.y = b.prevY = s.top;
          let top = 0, jerk = 0, last = 0;
          for (let t = 0; t < 420; t++) { m.step(); top = Math.max(top, a.y); jerk = Math.max(jerk, a.y - last); last = a.y; }
          if (top < s.top - 0.01 || Math.abs(a.y - s.top) > 0.01 || a.state === S.FALL || a.hp < a.maxHp) problems.push(id + ' ' + s.id + ' reached ' + top.toFixed(2) + ' of ' + s.top + ', now ' + a.y.toFixed(2) + ' ' + a.state);
          if (jerk > STAIR_RISE + 0.01) problems.push(id + ' ' + s.id + ' a step of ' + jerk.toFixed(2));
          const back = mk({ arenaId: id }, walkTo(s.ax - s.dx * 0.6, s.az - s.dz * 0.6)), [c, d] = back.fighters;
          self.stand(d, s.ax - s.dx * 2.2, s.az - s.dz * 2.2, s.bx, s.bz); self.stand(c, s.bx + s.dx * 0.4, s.bz + s.dz * 0.4, s.ax - s.dx * 2, s.az - s.dz * 2);
          c.y = c.prevY = s.top; c.supportY = s.top;
          self.run(back, 420);
          if (c.y > STEP_HEIGHT || c.hp < c.maxHp || Math.hypot(c.x - (s.ax - s.dx * 0.6), c.z - (s.az - s.dz * 0.6)) > 0.5) problems.push(id + ' ' + s.id + ' down ' + c.y.toFixed(2) + ' hp ' + (c.maxHp - c.hp));
        }
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Levels: a fighter who walks off a deck edge falls with the P3-07 rule (2.5 m = 16 HP and a knockdown), a knock-back over the edge falls too, and the ring ropes hold a walker', () => {
      const problems = [];
      const m = mk({ arenaId: 'warehouse' }, walkTo(9.25, 0)), [a, b] = m.fighters, falls = [];
      const off = Events.on('fall', (e) => falls.push(e.drop));
      self.stand(a, 9.25, -3.5, 9.25, 0); self.stand(b, 9.25, 2, 9.25, -3.5);
      a.y = a.prevY = a.groundY = a.supportY = 2.5;
      self.run(m, 12);
      if (a.y < 2.4) problems.push('fell too early');
      self.run(m, 150);
      off();
      const lost = a.maxHp - a.hp, expect = Combat.fallDamageFor(2.5) * a.stats.taken * a.stats.impact;
      if (falls.length !== 1 || Math.abs(falls[0] - 2.5) > 0.01 || Math.abs(lost - expect) > 1.5 || a.y > 0.01) problems.push('walk off: ' + falls.join() + ' lost ' + lost.toFixed(1) + ' want ' + expect.toFixed(1) + ' y ' + a.y.toFixed(2));
      const k = mk({ arenaId: 'warehouse' }), [c] = k.fighters, kf = [];
      const off2 = Events.on('fall', (e) => kf.push(e.drop));
      self.stand(c, 9.25, -3.2, 9.25, 0); c.y = c.prevY = c.groundY = c.supportY = 2.5;
      self.run(k, 2); c.kz = 6;
      self.run(k, 120);
      off2();
      if (kf.length !== 1 || c.hp >= c.maxHp || c.y > 0.01) problems.push('knock-back: ' + kf.join() + ' hp ' + c.hp);
      const g = mk({ arenaId: 'dojo' }, walkTo(-7.8, 5)), [d] = g.fighters;
      self.stand(d, -7.8, 1.5, -7.8, 5); d.y = d.prevY = d.groundY = d.supportY = 1.0;
      self.run(g, 40);
      if (d.y < 0.99) problems.push('the ring ropes did not hold a walker (y ' + d.y.toFixed(2) + ')');
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: a weak deck breaks under weight (the dock holds one fighter, not three), under damage, and under a thrown fighter; what stood on it falls with fall damage and its items drop', () => {
      const problems = [];
      const dockOf = () => Arena.objects.find((o) => o.id === 'dock');
      const solo = mk({ arenaId: 'warehouse' }, () => {}), dock = dockOf();
      onDeck(solo.fighters[0], dock); solo.fighters[0].x -= 0.5; self.stand(solo.fighters[1], 3, 0, 0, 0);
      self.run(solo, 240);
      if (dock.destroyed || dock.creak > 0) problems.push('one fighter broke it');
      const m = self.makeBrawl({ arenaId: 'warehouse', enemies: 2 }), d = dockOf(), [a, b, c] = m.fighters;
      [a, b, c].forEach((f, i) => { onDeck(f, d); f.x = f.prevX = d.x - 0.8 + i * 0.8; });
      const loose = m.placeItem('bat', d.x, d.z + 1, 1.0);   // lying on the dock: nothing under it once the dock is gone
      let creakAt = 0, breakAt = 0;
      for (let t = 1; t <= 200 && !breakAt; t++) {
        m.step();
        if (!creakAt && d.creak > 0) creakAt = t;
        if (d.destroyed) breakAt = t;
      }
      if (!creakAt || creakAt > LOAD_HOLD_TICKS + 12 || !breakAt || breakAt - creakAt < LOAD_CREAK_TICKS - 12 || breakAt - creakAt > LOAD_CREAK_TICKS + 12) problems.push('timing: creak ' + creakAt + ' break ' + breakAt);
      self.run(m, 90);
      const fallLoss = Combat.fallDamageFor(1.0) * a.stats.taken * a.stats.impact;
      if ([a, b, c].some((f) => f.maxHp - f.hp > fallLoss * 1.6 + 0.5)) problems.push('the fighters who stood on the dock took crush on top of the fall: ' + [a, b, c].map((f) => (f.maxHp - f.hp).toFixed(1)).join(' '));
      if ([a, b, c].some((f) => f.y > 0.3 || f.groundY > 0.3 || f.hp >= f.maxHp) || loose.mode !== 'rest' || loose.y > 0.3 || loose.host) problems.push('fall: ' + [a, b, c].map((f) => f.y.toFixed(2) + '/' + (f.maxHp - f.hp).toFixed(1)).join(' ') + ' item ' + loose.mode + ' ' + loose.y.toFixed(2));
      const dmg = mk({ arenaId: 'warehouse' }, () => {}), dk = dockOf(), f = dmg.fighters[0];
      onDeck(f, dk); self.stand(dmg.fighters[1], 3, 0, 0, 0);
      Arena.damageObject(dk, 999, 'heavy', 901, 1, 0, dk.x, 0.5, dk.z, 1);
      self.run(dmg, 90);
      if (!dk.destroyed || f.y > 0.3 || f.hp >= f.maxHp) problems.push('damage did not drop it: ' + dk.destroyed + ' ' + f.y.toFixed(2));
      const th = mk({ arenaId: 'warehouse' }, () => {}), tk = dockOf(), t1 = th.fighters[0];
      self.stand(t1, tk.x, tk.z + 1.3, tk.x, tk.z); t1.y = t1.prevY = 1.5;
      t1.setState(S.THROWN); t1.flightId = 91; t1.vy = -9; t1.kx = t1.kz = 0; t1.supportY = 1.5;
      for (let t = 0; t < 40 && tk.hp === tk.maxHp; t++) th.step();
      if (tk.hp === tk.maxHp) problems.push('a hard landing did not hit the deck');
      const fixedMezz = Arena.objects.find((o) => o.id === 'mezz');
      if (Arena.damageObject(fixedMezz, 999, 'heavy', 77, 1, 0, fixedMezz.x, 0.5, fixedMezz.z) || fixedMezz.destroyed) problems.push('a fixed deck took damage');
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: breaking a scaffold standard drops its tiers and the stair on them (one bay only), and the fallen piece crushes whoever stands beside it', () => {
      const problems = [];
      ARENAS.testScaffold = { id: 'testScaffold', name: 'Test', blurb: '', bounds: { x: 9, z: 6 }, spawn: 2.4, camera: ARENAS.warehouse.camera, env: ARENAS.warehouse.env, audio: ARENAS.warehouse.audio, objects: [{ id: 'box', type: 'box', look: 'crate', mat: 'wood', x: -2.8, z: -0.55, hx: 0.3, hz: 0.3, h: 0.9 }], builds: [['scaffold', 'sc', -3, -1, 2, 2, -1]], items: [], hazards: [] };
      try {
        const m = mk({ arenaId: 'testScaffold' }, () => {}), [a, b] = m.fighters, std = Arena.objects.find((o) => o.id === 'sc.s0'), t1 = Arena.objects.find((o) => o.id === 'sc.t0.1'), t2 = Arena.objects.find((o) => o.id === 'sc.t0.2'), other = Arena.objects.find((o) => o.id === 'sc.t1.2');
        onDeck(a, t2); self.stand(b, std.x, std.z + 0.4, a.x, a.z);   // b stands on the floor in front of the standard, within the reach of the fallen tiers
        const before = [a.hp, b.hp];
        Arena.damageObject(std, 999, 'heavy', 31, 0, 1, std.x, 1, std.z, 1);
        self.run(m, 90);
        const stairOn = Arena.objects.filter((o) => o.id.startsWith('sc.u2.'));
        if (!std.destroyed || !t1.destroyed || !t2.destroyed || other.destroyed || !stairOn.every((o) => o.destroyed)) problems.push('cascade: ' + [std, t1, t2, other].map((o) => o.destroyed).join());
        const fell = Combat.fallDamageFor(3.0) * a.stats.taken * a.stats.impact;
        if (a.y > 0.3 || before[0] - a.hp < fell * 0.8) problems.push('the fighter on tier 2 lost ' + (before[0] - a.hp).toFixed(1) + ' of about ' + fell.toFixed(1));
        const crush = Math.min(CRUSH_MAX, CRUSH_BASE + CRUSH_PER_METER * 1.5) * b.stats.taken;
        const box = Arena.objects.find((o) => o.id === 'box');
        if (box.hp >= box.maxHp) problems.push('a crate beside the fallen tiers took no crush damage');
        if (before[1] - b.hp < crush * 0.9) problems.push('the crush hurt ' + (before[1] - b.hp).toFixed(1) + ' of ' + crush.toFixed(1));
      } finally { delete ARENAS.testScaffold; }
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: items on a deck are picked from the deck footing (floor grab), not from far below, and a CPU walks to a floor item on its own level only', () => {
      const problems = [];
      const m = mk({ arenaId: 'warehouse', items: true }, () => {}), [a] = m.fighters, mezz = Arena.objects.find((o) => o.id === 'mezz');
      m.items.length = 0;
      const onTop = m.placeItem('pipe', 9.0, -4.0, 2.5);
      onTop.host = mezz;
      self.stand(a, 8.3, -4.0, 9.0, -4.0); a.y = a.prevY = a.groundY = a.supportY = 2.5;
      if (m.itemInReach(a) !== onTop || onTop.y - a.y >= PICKUP_LOW_BELOW) problems.push('not reachable from the deck as a floor grab');
      const below = mk({ arenaId: 'warehouse', items: true }, () => {}), p = below.fighters[0];
      below.items.length = 0; const aloft = below.placeItem('pipe', 9.0, -2.6, 2.5); aloft.host = Arena.objects.find((o) => o.id === 'mezz');
      self.stand(p, 9.0, -2.4, 9, -4);
      if (below.itemInReach(p)) problems.push('an item 2.5 m up was within reach of the floor');
      below.items.length = 0; const floorItem = below.placeItem('brick', 9.0, -2.0, 0); self.stand(p, 9.0, -2.4, 9, -2);
      if (below.itemInReach(p) !== floorItem) problems.push('a floor item was lost');
      const cpu = mk({ arenaId: 'warehouse', items: true }), c = cpu.fighters[0], ai = new AIController(c.profile, 'hard');
      cpu.controllers[0] = ai; cpu.items.length = 0; ai.match = cpu;
      const deckBrick = cpu.placeItem('brick', 9.0, -4.0, 2.5); deckBrick.host = Arena.objects.find((o) => o.id === 'mezz');
      const floorBrick = cpu.placeItem('brick', 4.0, 0.0, 0);
      self.stand(c, 8.0, -4.0, 0, 3); c.y = c.prevY = c.groundY = c.supportY = 2.5;
      const plan = ai.considerPickup(c, cpu.fighters[1], 10);
      if (!plan || plan.item !== deckBrick) problems.push('the CPU on the deck did not choose the deck item');
      self.stand(c, 4.4, 0.0, 0, 3); c.y = c.prevY = c.groundY = c.supportY = 0;
      const plan2 = ai.considerPickup(c, cpu.fighters[1], 10);
      if (!plan2 || plan2.item !== floorBrick) problems.push('the CPU on the floor skipped its own level item');
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: a CPU reaches a target standing on a deck by the stair (waypoints), comes down for a target on the floor, and leaves a deck that creaks', () => {
      const problems = [];
      const cases = [['warehouse', 'mezz', 9.25, -4.75, 2.5, 0, 0], ['dojo', 'mezz', 7, -4.8, 2.5, -1, 0], ['pit', 'landing', 8.5, -4.85, 2.5, 0, 1], ['dojo', 'ring', -7.8, 0, 1.0, -3, 3]];
      for (const [arenaId, deckId, tx, tz, top, sx, sz] of cases) {
        const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId, items: false, hazards: false, difficulty: 'hard' })), [a, b] = m.fighters, deck = Arena.objects.find((o) => o.id === deckId);
        m.controllers[0] = new AIController(a.profile, 'hard'); m.controllers[1] = self.scripted(() => {});
        self.stand(a, sx, sz, tx, tz); onDeck(b, deck); b.x = b.prevX = tx; b.z = b.prevZ = tz;
        let reached = 0;
        for (let t = 0; t < 1500 && !reached; t++) { m.step(); if (Math.abs(a.y - top) < 0.02 && Math.abs(a.x - deck.x) <= deck.hx + 0.3 && Math.abs(a.z - deck.z) <= deck.hz + 0.3) reached = t; }
        if (!reached) problems.push(arenaId + ' ' + deckId + ': the CPU never reached the deck (y ' + a.y.toFixed(2) + ' at ' + a.x.toFixed(1) + ',' + a.z.toFixed(1) + ')');
        else {
          self.stand(b, a.x > 0 ? 1 : -1, 1.5, a.x, a.z); b.y = b.prevY = b.groundY = b.supportY = 0; b.hp = b.maxHp;
          let down = 0;
          for (let t = 0; t < 1500 && !down; t++) { m.step(); if (a.y < STEP_HEIGHT + 0.01 && Math.hypot(a.x - b.x, a.z - b.z) < 3) down = t; }
          if (!down) problems.push(arenaId + ' ' + deckId + ': the CPU did not come down (y ' + a.y.toFixed(2) + ')');
        }
        m.dispose();
      }
      const w = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId: 'warehouse', items: false, hazards: false })), [c, d] = w.fighters, dock = Arena.objects.find((o) => o.id === 'dock');
      w.controllers[0] = new AIController(c.profile, 'hard'); w.controllers[1] = self.scripted(() => {});
      onDeck(c, dock); self.stand(d, -3, 3, -8, 3); dock.creak = LOAD_CREAK_TICKS;
      self.run(w, 20);
      if (Math.abs(c.x - dock.x) < dock.hx && Math.abs(c.z - dock.z) < dock.hz) problems.push('the CPU stayed on a creaking deck');
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: the camera keeps two fighters on different heights in frame, in a 1v1 and in a brawl', () => withCamera(() => {
      const problems = [];
      for (const [arenaId, deckId, x, z] of [['warehouse', 'mezz', 9.25, -4.75], ['dojo', 'mezz', 7, -4.8], ['pit', 'landing', 8.5, -4.85]]) {
        const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 3, arenaId })), [a, b] = m.fighters, deck = Arena.objects.find((o) => o.id === deckId);
        onDeck(b, deck); b.x = b.prevX = x; b.z = b.prevZ = z;
        self.stand(a, x - 2.5, z + 3.5, x, z);
        Camera.snapNext = true;
        for (let i = 0; i < 240; i++) { Camera.shakeAmp = 0; Camera.follow(1 / 60, a, b, m.def); }
        Camera.apply();
        if (!fighterOnScreen(a) || !fighterOnScreen(b)) problems.push(arenaId + ' 1v1: floor ' + fighterOnScreen(a) + ' deck ' + fighterOnScreen(b));
        const br = track(new MatchSim({ mode: 'brawl', enemies: 2, countdown: false, timer: 0, seed: 3, arenaId })), [p, e1, e2] = br.fighters, deckB = Arena.objects.find((o) => o.id === deckId);
        onDeck(e1, deckB); e1.x = e1.prevX = x; e1.z = e1.prevZ = z; self.stand(p, x - 2, z + 3.5, x, z); self.stand(e2, x - 3, z + 4, x, z);
        Camera.snapNext = true;
        cameraFrames(br, 240); Camera.apply();
        if (!fighterOnScreen(p) || !fighterOnScreen(e1)) problems.push(arenaId + ' brawl: floor ' + fighterOnScreen(p) + ' deck ' + fighterOnScreen(e1));
      }
      return problems.length ? problems.join('; ') : true;
    }));
    test('Levels: per quality preset the budget (debris, pieces, drawn detail, heaps) grows from low to high, is set in Quality.limits only, and a collapse never exceeds it', () => {
      const problems = [], saved = Settings.v.quality, savedEffects = Settings.v.effects;
      try {
        let last = null;
        for (const q of ['low', 'medium', 'high']) {
          Settings.v.quality = q; Settings.v.effects = 'high'; Quality.apply();
          const lim = Quality.limits;
          if (lim.debris !== QUALITY_PRESETS[q].debris || lim.pieces !== QUALITY_PRESETS[q].pieces || lim.live !== QUALITY_PRESETS[q].live || lim.heaps !== QUALITY_PRESETS[q].heaps) problems.push(q + ' limits are not the preset');
          if (last && (lim.debris <= last.debris || lim.pieces <= last.pieces || lim.live <= last.live || lim.heaps <= last.heaps)) problems.push(q + ' not above the lower preset');
          if (lim.pieces > DECK_PIECES_MAX || lim.debris > DEBRIS_MAX) problems.push(q + ' over a hard cap');
          last = Object.assign({}, lim);
          for (const id of ARENA_ORDER) {   // the worst case: every deck, then everything else, breaks at once
            Arena.build(ARENAS[id]); Debris.clear();
            for (const o of Arena.objects) {
              if (o.type !== 'deck' || o.step || o.fixed) continue;
              const allowed = lim.pieces + (id === 'pit' ? 0 : 1);   // one collapse, with everything that rests on it (steps, props, tiers), throws no more than the preset's budget in all
              Debris.clear(); Arena.breakObject(o, 0, 0, 0);
              const thrown = Debris.pool.filter((d) => d.on).length;
              if (thrown > allowed) problems.push(q + ' ' + id + ' a collapse threw ' + thrown + ' pieces, budget ' + allowed);
            }
            for (const o of Arena.objects) if (!o.fixed) Arena.breakObject(o, 0, 0, 0);
            Debris.update(0.016);
            const live = Debris.pool.filter((d) => d.on).length;
            if (live > lim.debris) problems.push(q + ' ' + id + ' live debris ' + live);
          }
          Arena.build(ARENAS.warehouse);
          Arena.updateLod();
          const intact = Arena.objects.filter((o) => !o.fixed && !o.destroyed), far = intact.filter((o) => o.far).length;
          if (far !== Math.max(0, intact.length - lim.live)) problems.push(q + ' detail ' + far + ' far of ' + intact.length);
          for (const o of Arena.objects) if (!o.fixed) Arena.breakObject(o, 0, 0, 0);
          Arena.updateLod();
          const heaps = Arena.objects.filter((o) => o.destroyed && o.rubble && !o.hide).length;
          if (heaps > lim.heaps) problems.push(q + ' heaps ' + heaps);
          const puts = [], realPut = R.put;
          R.put = (...args) => { puts.push(args); };
          try { Arena.draw(); } finally { R.put = realPut; }
          for (const o of Arena.objects) if (o.destroyed && o.rubble && o.hide && !puts.some((a) => Math.abs(a[2] - o.rubble.x) < 1e-6 && Math.abs(a[4] - o.rubble.z) < 1e-6 && Math.abs(a[5] - o.rubble.hx * 2) < 1e-6)) problems.push(q + ' ' + o.id + ': a heap over the budget is not drawn, its collider stays');
        }
      } finally { Settings.v.quality = saved; Settings.v.effects = savedEffects; Quality.apply(); Arena.build(ARENAS.warehouse); Debris.clear(); }
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: the simulation does not depend on the quality preset or the draw budget, and a CPU match with stairs, collapses and falls repeats exactly', () => {
      const problems = [], saved = Settings.v.quality;
      const play = (q, arenaId, seed) => {
        Settings.v.quality = q; Quality.apply();
        const m = track(new MatchSim({ mode: 'brawl', enemies: 3, countdown: false, timer: 0, seed, arenaId, difficulty: 'hard', evenDamage: true, items: true, hazards: true }));
        m.controllers[0] = new AIController(m.fighters[0].profile, 'hard');
        const weak = Arena.objects.find((o) => o.weak);
        if (weak) weak.creak = LOAD_CREAK_TICKS;
        for (let t = 0; t < 1500 && m.phase !== 'matchEnd'; t++) m.step();
        const hash = fnv1a(m.fighters.map((f) => [f.x.toFixed(3), f.y.toFixed(3), f.z.toFixed(3), f.hp.toFixed(2), f.state].join()).join('|') + Arena.objects.map((o) => (o.destroyed ? 1 : 0) + o.hp.toFixed(1)).join());
        m.dispose();
        return hash;
      };
      try {
        for (const id of ARENA_ORDER) {
          const a = play('low', id, 7), b = play('high', id, 7), c = play('low', id, 7);
          if (a !== b) problems.push(id + ': low and high presets differ');
          if (a !== c) problems.push(id + ': not repeatable');
        }
      } finally { Settings.v.quality = saved; Quality.apply(); }
      return problems.length ? problems.join('; ') : true;
    });
    /* ----- Hazards (P7-05) ----- */
    /* The three arenas as they were before P8-02 rebuilt them (P7 layouts): the hazard tests below place fighters at exact spots by the old posts, glass wall and objects, so they run on these copies
       (registered in ARENAS for the run only, never in ARENA_ORDER). What the real arenas place and what a CPU does in them is checked on the real arenas by the tests that loop ARENA_ORDER. */
    const OLD_ARENAS = {
      oldWarehouse: {
        id: 'oldWarehouse', name: 'Industrial Warehouse', blurb: 'Crates, concrete pillars, steel railings and an office window. Big echoing hall.',
        bounds: { x: 8.5, z: 5.0 }, spawn: 2.6, camera: { minDist: 6.2, maxDist: 12.5, elev: 0.5 },
        env: { clear: [0.05, 0.06, 0.08], sky: [0.5, 0.55, 0.64], ground: [0.24, 0.23, 0.22], lightTo: [0.35, 0.85, 0.5], lightCol: [1.0, 0.92, 0.78], fogCol: [0.09, 0.1, 0.13], fog: 0.026, rim: [0.25, 0.35, 0.55], floor: 1,
          pl: [{ pos: [-4, 5.2, -1], r: 13, col: [0.7, 0.55, 0.3] }, { pos: [4, 5.2, -1], r: 13, col: [0.7, 0.55, 0.3] }] },
        audio: { reverb: 1.7, wet: 0.3, bpm: 118, root: 55, mode: 'minor', hum: 60 },
        objects: [
          { id: 'crateA', type: 'box', look: 'crate', mat: 'wood', x: -5.4, z: -2.6, hx: 0.55, hz: 0.55, h: 0.95 },
          { id: 'crateB', type: 'box', look: 'crate', mat: 'wood', x: 5.6, z: 2.3, hx: 0.55, hz: 0.55, h: 0.95 },
          { id: 'crateC', type: 'box', look: 'crate', mat: 'wood', x: -6.2, z: 3.0, hx: 0.5, hz: 0.5, h: 0.9 },
          { id: 'crateD', type: 'box', look: 'crate', mat: 'wood', x: 6.4, z: -3.4, hx: 0.55, hz: 0.55, h: 0.95 },
          { id: 'pillarL', type: 'column', mat: 'concrete', x: -3.2, z: -4.2, hx: 0.42, hz: 0.42, h: 3.4 },
          { id: 'pillarR', type: 'column', mat: 'concrete', x: 3.6, z: -4.2, hx: 0.42, hz: 0.42, h: 3.4 },
          { id: 'railL', type: 'rail', mat: 'metal', axis: 'z', x: -7.6, z: -0.25, hx: 0.12, hz: 2.25, h: 1.05 },
          { id: 'railR', type: 'rail', mat: 'metal', axis: 'z', x: 7.6, z: -0.25, hx: 0.12, hz: 2.25, h: 1.05 },
          { id: 'window', type: 'panel', mat: 'glass', axis: 'x', x: 0, z: -4.85, hx: 1.6, hz: 0.08, h: 2.2 },
        ],
        items: [['bottle', -1.6, 3.7, 0], ['brick', 2.2, -3.0, 0], ['skateboard', 0.4, 4.1, 0], ['wrench', -5.4, -2.6, 0.95, 'crateA'], ['pipe', -3.2, -3.7, 1.4, 'pillarL'], ['hammer', 3.6, -3.7, 1.3, 'pillarR'], ['extinguisher', 7.0, 3.9, 0]],
        hazards: [['panel', 5.4, -0.2], ['steam', -6.4, -3.9, { yaw: Math.PI / 2 }], ['load', 1.9, -2.0, { tx: 4.1, tz: -2.0 }]],
      },
      oldDojo: {
        id: 'oldDojo', name: 'Traditional Dojo', blurb: 'Open wooden floor with paper screens, benches and training posts. Dry, close sound.',
        bounds: { x: 7.5, z: 4.6 }, spawn: 2.4, camera: { minDist: 6.0, maxDist: 11.5, elev: 0.46 },
        env: { clear: [0.08, 0.05, 0.04], sky: [0.6, 0.5, 0.42], ground: [0.3, 0.22, 0.15], lightTo: [0.25, 0.9, 0.4], lightCol: [1.0, 0.9, 0.72], fogCol: [0.2, 0.13, 0.1], fog: 0.02, rim: [0.55, 0.32, 0.2], floor: 2,
          pl: [{ pos: [-6, 3, -4.2], r: 11, col: [0.9, 0.5, 0.2] }, { pos: [6, 3, -4.2], r: 11, col: [0.9, 0.5, 0.2] }] },
        audio: { reverb: 0.5, wet: 0.12, bpm: 96, root: 73.4, mode: 'pentatonic', hum: 0 },
        objects: [
          { id: 'screenL', type: 'panel', look: 'shoji', mat: 'paper', axis: 'x', x: -3.5, z: -3.3, hx: 1.0, hz: 0.06, h: 1.9 },
          { id: 'screenR', type: 'panel', look: 'shoji', mat: 'paper', axis: 'x', x: 3.5, z: -3.3, hx: 1.0, hz: 0.06, h: 1.9 },
          { id: 'screenW', type: 'panel', look: 'shoji', mat: 'paper', axis: 'z', x: -6.7, z: 0.2, hx: 0.06, hz: 1.3, h: 1.9 },
          { id: 'screenE', type: 'panel', look: 'shoji', mat: 'paper', axis: 'z', x: 6.7, z: 0.2, hx: 0.06, hz: 1.3, h: 1.9 },
          { id: 'benchL', type: 'box', look: 'bench', mat: 'wood', x: -4.6, z: 3.3, hx: 0.75, hz: 0.25, h: 0.5 },
          { id: 'benchR', type: 'box', look: 'bench', mat: 'wood', x: 4.6, z: 3.3, hx: 0.75, hz: 0.25, h: 0.5 },
          { id: 'postL', type: 'column', mat: 'wood', hpMul: 1.6, x: -1.2, z: -3.9, hx: 0.24, hz: 0.24, h: 1.7 },
          { id: 'postR', type: 'column', mat: 'wood', hpMul: 1.6, x: 1.2, z: -3.9, hx: 0.24, hz: 0.24, h: 1.7 },
          { id: 'glassWall', type: 'panel', mat: 'glass', axis: 'z', x: -4.6, z: 0, hx: 0.08, hz: 1.4, h: 2.0 },
        ],
        items: [['stick', -4.6, 3.3, 0.5, 'benchL'], ['bottle', 4.6, 3.3, 0.5, 'benchR'], ['bat', -1.2, -3.55, 1.3, 'postL'], ['broom', 1.2, -3.55, 1.35, 'postR'], ['chair', -3.6, -2.6, 0]],
        hazards: [['glass', 0, 0, { obj: 'glassWall' }]],
      },
      oldPit: {
        id: 'oldPit', name: 'Underground Pit', blurb: 'Dark concrete cage, barriers, pillars and a cracked observation glass. Heavy, rumbling sound.',
        bounds: { x: 7.0, z: 5.0 }, spawn: 2.4, camera: { minDist: 6.0, maxDist: 12, elev: 0.55 },
        env: { clear: [0.02, 0.02, 0.03], sky: [0.26, 0.28, 0.38], ground: [0.12, 0.1, 0.1], lightTo: [0.2, 0.95, 0.3], lightCol: [0.9, 0.9, 1.0], fogCol: [0.03, 0.03, 0.05], fog: 0.036, rim: [0.8, 0.35, 0.15], floor: 3,
          pl: [{ pos: [-8, 1.6, -4], r: 12, col: [1.0, 0.45, 0.15] }, { pos: [8, 1.6, -4], r: 12, col: [1.0, 0.45, 0.15] }] },
        audio: { reverb: 1.1, wet: 0.24, bpm: 104, root: 49, mode: 'phrygian', hum: 40 },
        objects: [
          { id: 'barrierA', type: 'box', look: 'barrier', mat: 'concrete', x: -2.6, z: -4.2, hx: 1.0, hz: 0.3, h: 0.85 },
          { id: 'barrierB', type: 'box', look: 'barrier', mat: 'concrete', x: -3.4, z: 3.3, hx: 0.9, hz: 0.3, h: 0.85 },
          { id: 'barrierC', type: 'box', look: 'barrier', mat: 'concrete', x: 4.4, z: 2.9, hx: 0.9, hz: 0.3, h: 0.85 },
          { id: 'pillarA', type: 'column', mat: 'concrete', x: -5.6, z: -3.7, hx: 0.45, hz: 0.45, h: 3.2 },
          { id: 'pillarB', type: 'column', mat: 'concrete', x: 3.2, z: -4.1, hx: 0.45, hz: 0.45, h: 3.2 },
          { id: 'cageL', type: 'rail', mat: 'metal', axis: 'z', x: -6.5, z: 2.4, hx: 0.12, hz: 1.6, h: 1.05 },
          { id: 'cageR', type: 'rail', mat: 'metal', axis: 'z', x: 6.5, z: -0.8, hx: 0.12, hz: 2.0, h: 1.05 },
          { id: 'obsGlass', type: 'panel', mat: 'glass', axis: 'x', x: 0.2, z: -4.85, hx: 1.3, hz: 0.08, h: 2.0 },
        ],
        items: [['binlid', -1.2, 3.8, 0], ['chain', -3.4, 3.3, 0.85, 'barrierB'], ['brick', 4.4, 2.9, 0.85, 'barrierC'], ['pipe', 3.2, -3.55, 1.4, 'pillarB'], ['wrench', -5.6, -3.15, 1.3, 'pillarA'], ['crate', 5.6, -2.4, 0], ['extinguisher', -6.0, -1.0, 0]],
        hazards: [['fire', -5.2, -1.8], ['fire', 4.9, 0.9], ['steam', 5.3, -3.9, { yaw: -Math.PI / 2 }]],
      },
    };
    Object.assign(ARENAS, OLD_ARENAS);
    const hz = (arenaId, opts, s1, s2) => mk(Object.assign({ arenaId, items: false, hazards: true }, opts), s1, s2);
    const hazardOf = (m, type, n) => m.hazards.filter((h) => h.type === type)[n || 0];
    /* The hazard events of a run as plain rows; log.stop() unhooks it. */
    const hazardLog = (m) => {
      const log = [], offs = ['hazardTrigger', 'hazardWarn', 'hazardStart', 'hazardHit', 'hazardEnd'].map((name) => Events.on(name, (e) => log.push({ name, tick: m.tick, type: e.h.type, f: e.f ? e.f.index : -1, dmg: e.dmg, via: e.via, by: e.by ? e.by.index : -1, state: e.f ? e.f.state : '' })));
      log.stop = () => offs.forEach((off) => off());
      return log;
    };
    /* Runs fn with the given hazard rows in the arena's definition (a synthetic placement for the types no arena has yet, or a layout of the test's own); the real rows come back afterwards. */
    const withRows = (arenaId, rows, fn) => { const saved = ARENAS[arenaId].hazards; ARENAS[arenaId].hazards = rows; try { return fn(); } finally { ARENAS[arenaId].hazards = saved; } };
    const faceEach = (a, ax, az, b, bx, bz) => { self.stand(a, ax, az, bx, bz); self.stand(b, bx, bz, ax, az); };
    test('Levels: the four new materials (brick, plastic, tile, sheet metal) break by the recipe they name, every look in the table is used by a level, and every object material exists', () => {
      const problems = [], recipe = { brick: 'concrete', plastic: 'wood', tile: 'glass', sheet: 'metal' };
      for (const mat in recipe) {
        if (kindOf(mat) !== recipe[mat] || ['punch', 'kick', 'heavy', 'throw', 'impact'].some((cat) => !(MATERIALS[mat].mult[cat] > 0))) problems.push(mat + ' row');
        Arena.build(ARENAS.pit); Debris.clear();
        const o = Arena.objects.find((q) => q.id === 'crateP');
        o.mat = mat; o.hp = o.maxHp = MATERIALS[mat].hp;
        Arena.breakObject(o, 1, 0, 0);
        const kinds = new Set(Debris.pool.filter((d) => d.on).map((d) => d.kind));
        if (kinds.size !== 1 || !kinds.has(recipe[mat])) problems.push(mat + ' threw ' + [...kinds].join());
      }
      Arena.build(ARENAS.pit);
      const barrier = Arena.objects.find((q) => q.id === 'barrierA');
      Arena.breakObject(barrier, 0, 0, 0);
      if (barrier.rubble.hx > barrier.hx + 0.3 || barrier.rubble.hz > barrier.hz + 0.3) problems.push('a barrier leaves a pile ' + (barrier.rubble.hx * 2).toFixed(1) + ' x ' + (barrier.rubble.hz * 2).toFixed(1) + ' m (audit D17)');
      const used = new Set();
      for (const id of ARENA_ORDER) for (const o of builtOf(ARENAS[id]).objects) { used.add(o.look); if (!MATERIALS[o.mat]) problems.push(id + ' ' + o.id + ' has no material ' + o.mat); }
      for (const look in LOOKS) if (!used.has(look)) problems.push('look ' + look + ' is used by no level');
      Arena.build(ARENAS.warehouse); Debris.clear();
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: the engine of P8 changes no 1v1 result - the three recorded seeded matches replay to the same hashes on the pre-P8 arena layouts (the real arenas differ on purpose)', () => {
      const got = ONE_V_ONE_FINGERPRINTS.map((f) => fingerprint(Object.assign({}, f.opts, { arenaId: f.opts.arenaId === 'pit' ? 'oldPit' : 'oldWarehouse' }))), want = ONE_V_ONE_OLD_HASHES;
      return got.every((h, i) => h === want[i]) ? true : 'got ' + got.join(' ') + ' want ' + want.join(' ');
    });
    test('Hazards: the table has the 8 hazards of the spec, each arena places the planned ones, the Hazards setting is on by default (after Items) and off places nothing, not even posts', () => {
      const problems = [];
      const want = 'panel strike 1.2 24 120 360 14 0 stun|steam strike 2 24 180 300 3 15 push|drop edge 0 0 0 0 25 0 out|glass break 0 0 0 0 10 0 flinch|load strike 1.5 36 90 600 30 0 down|train timer 0 120 60 0 40 0 throw|fire strike 1.2 15 240 0 4 20 flinch';
      const got = Object.keys(HAZARDS).map((id) => { const d = HAZARDS[id]; return [id, d.trig, d.r || d.len || 0, d.warn || 0, d.dur || 0, d.cool || 0, d.dmg, d.gap || 0, d.fx].join(' '); }).join('|');
      if (got !== want) problems.push('table ' + got);
      const plan = { warehouse: 'panel,steam,load,glass', dojo: 'glass,panel', pit: 'fire,fire,steam,glass', rooftop: 'drop,drop,panel,fire', subway: 'train,panel,glass', garage: 'panel,fire,glass', construction: 'drop,load,panel,fire', club: 'panel,glass,steam' }, keys = Object.keys(SETTING_DEFS);
      for (const id of ARENA_ORDER) {
        const on = track(new MatchSim({ arenaId: id, countdown: false, seed: 2 }));
        if (on.hazards.map((h) => h.type).join() !== plan[id] || !on.hazardsOn) problems.push(id + ' places ' + on.hazards.map((h) => h.type));
        if (!Arena.colliders.some((c) => c.haz) !== !on.hazards.some((h) => h.post)) problems.push(id + ' posts');
        const off = track(new MatchSim({ arenaId: id, countdown: false, seed: 2, hazards: false }));
        if (off.hazards.length || Arena.colliders.some((c) => c.haz)) problems.push(id + ' off still places');
      }
      if (SETTING_DEFS.hazards.def !== true || Settings.validate('hazards', 'x') !== true || keys.indexOf('hazards') !== keys.indexOf('items') + 1) problems.push('setting');
      const again = track(new MatchSim({ arenaId: 'pit', countdown: false, seed: 2 }));
      again.startRound();
      if (Arena.colliders.filter((c) => c.haz).length !== 3) problems.push('a new round doubled the posts');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: a panel, a steam jet, a falling load and a fire barrel each hurt every fighter in their zone, of either team, and two co-op teammates too', () => {
      const problems = [];
      const cases = [['oldWarehouse', 'panel', [4.6, -0.2], [6.2, -0.2]], ['oldWarehouse', 'steam', [-5.7, -3.9], [-5.1, -3.9]], ['oldWarehouse', 'load', [1.3, -2.0], [2.5, -2.0]], ['oldPit', 'fire', [4.4, 1.9], [5.4, 1.9]]];
      for (const [arenaId, type, p, q] of cases) {
        const m = hz(arenaId, {}), h = hazardOf(m, type, type === 'fire' ? 1 : 0), [a, b] = m.fighters, before = [a.hp, b.hp];
        faceEach(a, p[0], p[1], b, q[0], q[1]);
        if (a.team === b.team || !m.hazardReaches(h, a) || !m.hazardReaches(h, b)) problems.push(type + ' setup');
        m.hazardArm(h, type === 'fire' ? null : a, 'strike');   // a barrel tips away from whoever strikes it: set off by nobody it tips along its row's yaw, its pool over both fighters
        self.run(m, 130);
        if (a.hp >= before[0] || b.hp >= before[1]) problems.push(type + ' hurt ' + (before[0] - a.hp) + ' / ' + (before[1] - b.hp));
      }
      const party = self.makeBrawl({ arenaId: 'oldWarehouse', items: false, hazards: true, enemies: 1, coop: [{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }] }), [k, r] = party.fighters, pre = [k.hp, r.hp];
      faceEach(k, 4.6, -0.2, r, 6.2, -0.2);
      if (party.canHurt(k, r) || k.team !== r.team) problems.push('teammates can hurt each other');
      party.hazardArm(hazardOf(party, 'panel'), k, 'strike');
      self.run(party, 130);
      if (k.hp >= pre[0] || r.hp >= pre[1]) problems.push('teammates not hurt');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: a real strike on the post sets off a panel, a steam valve, a falling load and a fire barrel (and a strike that falls short does not); the cue comes first', () => {
      const problems = [];
      const cases = [['oldWarehouse', 'panel', 0, [4.5, -0.2], [6.3, -0.2]], ['oldWarehouse', 'steam', 0, [-7.5, -3.9], [-5.3, -3.9]], ['oldWarehouse', 'load', 0, [5.2, -2.0], [3.0, -2.0]], ['oldPit', 'fire', 1, [3.8, 0.9], [6.0, 0.9]]];
      for (const [arenaId, type, n, p, q] of cases) {
        for (const near of [true, false]) {
          const m = hz(arenaId, {}, once(3, 'punch')), h = hazardOf(m, type, n), log = hazardLog(m);
          faceEach(m.fighters[0], near ? p[0] : p[0] + (p[0] < q[0] ? -1.5 : 1.5), near ? p[1] : p[1] + (p[1] < q[1] ? -1.5 : 1.5), m.fighters[1], q[0], q[1]);
          self.run(m, 14);
          log.stop();
          const trig = log.filter((e) => e.name === 'hazardTrigger');
          if (near && (trig.length !== 1 || trig[0].via !== 'strike' || trig[0].by !== 0 || h.state !== 'warn' && h.state !== 'active')) problems.push(type + ' not set off: ' + JSON.stringify(log));
          if (!near && (trig.length || h.state !== 'idle')) problems.push(type + ' set off from afar');
        }
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: warn, active and cooldown last as the table says, a panel hurts each fighter once per activation, cannot be set off again until it has cooled, and steam hurts every 15 ticks', () => {
      const problems = [];
      const m = hz('oldWarehouse', {}), h = hazardOf(m, 'panel'), [a, b] = m.fighters, log = hazardLog(m);
      faceEach(a, 4.6, -0.2, b, 6.2, -0.2);
      const D = HAZARDS.panel;
      if (!m.hazardArm(h, a, 'strike')) problems.push('arm');
      const armed = m.tick;
      self.run(m, 5);
      if (m.hazardArm(h, b, 'strike') || h.by !== a) problems.push('re-armed while warning');
      self.run(m, D.warn + D.dur + 10);
      if (h.state !== 'cool' || m.hazardArm(h, a, 'strike')) problems.push('not cooling: ' + h.state);
      self.run(m, D.cool);
      if (h.state !== 'idle' || !m.hazardArm(h, a, 'strike')) problems.push('not ready again: ' + h.state);
      self.run(m, D.warn + 5);
      log.stop();
      const at = (name) => log.filter((e) => e.name === name).map((e) => e.tick), hits = log.filter((e) => e.name === 'hazardHit');
      if (at('hazardWarn')[0] !== armed || at('hazardStart')[0] - armed !== D.warn || at('hazardEnd')[0] - at('hazardStart')[0] !== D.dur) problems.push('timing ' + [armed, at('hazardStart')[0], at('hazardEnd')[0]]);
      if (hits.length !== 4 || hits.filter((e) => e.f === 0).length !== 2 || hits.some((e) => e.dmg < 1 || e.state !== 'STUN')) problems.push('hits ' + JSON.stringify(hits.map((e) => e.f + ':' + e.tick)));
      const s = hz('oldWarehouse', {}), jet = hazardOf(s, 'steam'), steamLog = hazardLog(s);
      faceEach(s.fighters[0], -7.6, 1, s.fighters[1], -5.7, -3.9);
      s.hazardArm(jet, null, 'timer');
      self.run(s, HAZARDS.steam.warn + 60);
      steamLog.stop();
      const ticks = steamLog.filter((e) => e.name === 'hazardHit' && e.f === 1).map((e) => e.tick);
      if (ticks.length < 3 || ticks[1] - ticks[0] !== 15 || ticks[2] - ticks[1] !== 15) problems.push('steam gaps ' + ticks);
      if (s.fighters[1].kx <= 0 && s.fighters[1].x <= -5.7) problems.push('the jet did not push');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: a thrown item sets off a post (a panel only for a metal item), a fighter knocked into a barrel sets it off and the one who sent it flying is credited, a shattered bottle leaves glass', () => {
      const problems = [];
      const fly = (m, id, x, z, vx, owner) => { const it = m.newItem(id, x, 1.0, z, 0); it.mode = 'fly'; it.owner = owner; it.vx = vx; it.vy = 0; return m.addItem(it); };
      for (const [id, metal] of [['pipe', true], ['bottle', false], ['brick', false]]) {
        const m = hz('oldWarehouse', {}), h = hazardOf(m, 'panel');
        faceEach(m.fighters[0], 0, 3, m.fighters[1], -3, 3);
        fly(m, id, 4.0, -0.2, 9, m.fighters[0]);
        self.run(m, 30);
        if ((h.state !== 'idle') !== metal) problems.push(id + ' on the panel: ' + h.state);
        if (metal && h.by !== m.fighters[0]) problems.push('credit');
      }
      const brick = hz('oldPit', {}), barrel = hazardOf(brick, 'fire', 1);
      faceEach(brick.fighters[0], 0, 3, brick.fighters[1], -3, 3);
      fly(brick, 'brick', 3.8, 0.9, 9, brick.fighters[0]);
      self.run(brick, 30);
      if (barrel.state === 'idle') problems.push('a brick did not tip the barrel');
      const k = hz('oldPit', {}), [a, b] = k.fighters, post = hazardOf(k, 'fire', 1), log = hazardLog(k);
      faceEach(a, 2, 3, b, 3.9, 0.9);
      b.lastFoe = a; b.setState(S.THROWN); b.flightId = 77; b.vy = 2.6; b.y = 0.02; b.kx = 6; b.kz = 0;
      self.run(k, 30);
      log.stop();
      const trig = log.filter((e) => e.name === 'hazardTrigger');
      if (trig.length !== 1 || trig[0].via !== 'knock' || trig[0].by !== 0 || post.state === 'idle') problems.push('knock ' + JSON.stringify(trig));
      if (post.post.active) problems.push('a tipped barrel is still an obstacle');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: a glass wall breaks under a thrown fighter (10 damage), its shards cut a fighter knocked down on them (2, once per knockdown), a thrown item breaks it without cutting anyone, a bottle leaves a patch of glass', () => {
      const problems = [];
      const m = hz('oldDojo', {}), [a, b] = m.fighters, glass = hazardOf(m, 'glass'), log = hazardLog(m);
      faceEach(a, -1, 0, b, -3.6, 0);
      b.setState(S.THROWN); b.flightId = 88; b.vy = 2.6; b.y = 0.02; b.kx = -6; b.lastFoe = a;
      self.run(m, 120);
      log.stop();
      const hits = log.filter((e) => e.name === 'hazardHit' && e.f === 1);
      if (glass.state !== 'active' || hits.length !== 2 || hits[0].dmg !== 10 || hits[1].dmg !== 2 || hits[1].state !== 'DOWN' || log.filter((e) => e.name === 'hazardTrigger')[0].via !== 'break') problems.push('wall ' + JSON.stringify(log.map((e) => e.name + ':' + e.dmg)));
      const lying = [b.state, b.hp];
      self.run(m, 30);
      if (b.state === S.DOWN && b.hp !== lying[1]) problems.push('cut twice for one knockdown');
      const c = hz('oldDojo', {}), w = hazardOf(c, 'glass'), cl = hazardLog(c);
      faceEach(c.fighters[0], 3, 3, c.fighters[1], -2, 3);
      const brick = c.newItem('brick', -3.0, 1.2, 0, 0); brick.mode = 'fly'; brick.owner = c.fighters[0]; brick.vx = -9; brick.vy = 0; c.addItem(brick);
      self.run(c, 30);
      cl.stop();
      if (w.state !== 'active' || cl.some((e) => e.name === 'hazardHit')) problems.push('item break ' + w.state + ' ' + cl.length);
      const p = hz('oldDojo', {}), [x, y] = p.fighters;
      faceEach(x, 3, 3, y, 3, 1);
      for (let n = 0; n < HAZARD_SHARD_MAX + 3; n++) p.itemDebris('bottle', -3 + n * 0.1, 0.2, 2);
      const patches = p.hazards.filter((h) => h.life > 0);
      if (patches.length !== HAZARD_SHARD_MAX || patches[0].hx !== BOTTLE_SHARD_R) problems.push('patches ' + patches.length);
      const last = patches[patches.length - 1], hp = y.hp;
      y.x = y.prevX = last.x; y.z = y.prevZ = last.z;
      y.setState(S.THROWN); y.flightId = 5; y.vy = 0; y.y = 0.3; y.kx = y.kz = 0;
      self.run(p, 60);
      if (y.hp >= hp) problems.push('a bottle patch did not cut');
      self.run(p, HAZARD_SHARD_TICKS);
      if (p.hazards.some((h) => h.life > 0)) problems.push('patches stay');
      const off = mk({ arenaId: 'oldDojo', items: true, hazards: false });
      off.itemDebris('bottle', 0, 0.2, 0);
      if (off.hazards.length) problems.push('a patch with hazards off');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: the open drop hurts a fighter once for each flight even when it was thrown toward the edge, a fighter getting up takes nothing from any hazard, and whoever set a hazard off gets the knock-out', () => {
      const problems = [];
      withRows('oldWarehouse', [['drop', 0, 0, { hx: 1, hz: 1 }]], () => {
        const m = hz('oldWarehouse', {}), [a, b] = m.fighters, log = hazardLog(m);
        faceEach(a, -4, 0, b, 5, 3);
        a.setState(S.THROWN); a.flightId = 41; a.vy = 2.6; a.y = 0.02; a.kx = 7; a.kz = 0;   // thrown straight at the drop
        self.run(m, 150);
        log.stop();
        const hits = log.filter((e) => e.name === 'hazardHit' && e.f === 0);
        if (hits.length !== 1 || a.x > -1) problems.push('drop hit ' + hits.length + ' times, x ' + a.x.toFixed(2));
      });
      const m = hz('oldWarehouse', {}), panel = hazardOf(m, 'panel'), [a, b] = m.fighters;
      faceEach(a, 4.6, -0.2, b, 6.2, -0.2);
      a.invuln = 400;
      m.hazardArm(panel, b, 'strike');
      self.run(m, 130);
      if (a.hp !== a.maxHp || b.hp === b.maxHp) problems.push('invulnerable ' + (a.maxHp - a.hp) + ' / ' + (b.maxHp - b.hp));
      const d = hz('oldDojo', {}), glass = hazardOf(d, 'glass'), hp = d.fighters[1].hp;
      d.fighters[1].invuln = 20;
      d.hazardHit(glass, d.fighters[1]);
      if (d.fighters[1].hp !== hp) problems.push('glass cut an invulnerable fighter');
      const k = hz('oldWarehouse', {}), ko = [];
      faceEach(k.fighters[0], 4.6, -0.2, k.fighters[1], 6.2, -0.2);
      k.fighters[1].hp = 1;
      const off = Events.on('ko', (e) => ko.push(e.att && e.att.index));
      k.hazardArm(hazardOf(k, 'panel'), k.fighters[0], 'strike');
      self.run(k, 130);
      off();
      if (k.fighters[1].alive || ko.join() !== '0') problems.push('knock-out credit ' + ko.join());
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: an electric hit shocks for 40 ticks and then lets go', () => {
      const problems = [];
      const m = hz('oldWarehouse', {}), panel = hazardOf(m, 'panel'), [a, b] = m.fighters;
      faceEach(a, 4.6, -0.2, b, -2.6, 0);
      m.hazardArm(panel, null, 'timer');
      self.run(m, HAZARDS.panel.warn + 3);
      if (a.hp === a.maxHp || a.state !== S.STUN || b.hp !== b.maxHp) problems.push('shock: ' + (a.maxHp - a.hp) + ' ' + a.state + ' / far ' + (b.maxHp - b.hp));
      self.run(m, HAZARDS.panel.stun - 5);
      if (a.state !== S.STUN) problems.push('shock ended early');
      self.run(m, 12);
      if (a.state === S.STUN) problems.push('shock lasts too long');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: the open drop (25 damage, down at the edge, out of a brawl for an enemy) and the passing train (timed, 120 ticks of warning, 40 damage and thrown along the track) work from synthetic placements', () => {
      const problems = [];
      withRows('warehouse', [['drop', 0, 0, { hx: 1, hz: 1 }]], () => {
        const m = hz('warehouse', {}), [a, b] = m.fighters, log = hazardLog(m);
        faceEach(a, 0.2, 0.1, b, 5, 3);
        self.run(m, 2);
        log.stop();
        if (a.hp > a.maxHp - 24 || a.state !== S.THROWN || Math.abs(a.x) <= 1 && Math.abs(a.z) <= 1 || b.hp !== b.maxHp) problems.push('drop ' + (a.maxHp - a.hp) + ' ' + a.state + ' ' + a.x.toFixed(2) + ',' + a.z.toFixed(2));
        const brawl = self.makeBrawl({ arenaId: 'warehouse', items: false, hazards: true, enemies: 2 }), [p, e1, e2] = brawl.fighters;
        self.stand(p, 0, 0.3, 9, 9); self.stand(e1, 0.3, 0, 9, 9); self.stand(e2, 5, 3, 0, 0);
        self.run(brawl, 2);
        if (!p.alive || p.hp >= p.maxHp || e1.alive || e1.state !== S.KO || !e2.alive) problems.push('brawl drop: player ' + p.alive + ' enemy ' + e1.alive);
      });
      withRows('warehouse', [['train', 0, 0, { hx: 1.2, hz: 4 }]], () => {
        const m = hz('warehouse', {}), h = hazardOf(m, 'train'), [a, b] = m.fighters, log = hazardLog(m), D = HAZARDS.train;
        faceEach(a, 0, 0, b, 5, 3);
        h.t = D.period - 2;
        self.run(m, D.warn + 70);
        log.stop();
        const warn = log.find((e) => e.name === 'hazardWarn'), start = log.find((e) => e.name === 'hazardStart'), hits = log.filter((e) => e.name === 'hazardHit');
        if (!warn || !start || start.tick - warn.tick !== D.warn || warn.tick > 3) problems.push('train timing');
        if (hits.length !== 1 || hits[0].f !== 0 || hits[0].dmg < 39 || a.z <= 0.5 || b.hp !== b.maxHp) problems.push('train hit ' + JSON.stringify(hits) + ' z ' + a.z.toFixed(2));
        if (h.state !== 'idle' && h.state !== 'cool') problems.push('train state ' + h.state);
      });
      return problems.length ? problems.join('; ') : true;
    });
    /* The hazard triggers a CPU caused in a run, as rows { tick, type, via, by }; also whether the CPU (fighter 0) was hurt by a hazard. */
    const cpuLog = (m) => {
      const rows = [], offs = [Events.on('hazardTrigger', (e) => rows.push({ tick: m.tick, type: e.h.type, via: e.via, by: e.by ? e.by.index : -1 })), Events.on('hazardHit', (e) => { if (e.f.index === 0 && e.dmg > 0) rows.hurt = (rows.hurt || 0) + 1; })];
      rows.stop = () => offs.forEach((off) => off());
      return rows;
    };
    test('Hazards: a CPU whose target stands by a steam valve, a falling load or a fire barrel goes to a spot outside the effect zone, strikes the post and is not hurt by it', () => {
      const problems = [];
      const cases = [['oldWarehouse', 'steam', [-2.5, -1.5], [-5.2, -3.9]], ['oldWarehouse', 'load', [6.0, -0.5], [2.6, -2.0]], ['oldPit', 'fire', [2.0, 0.9], [5.6, 0.2]], ['oldPit', 'steam', [2.0, -1.5], [4.3, -3.9]]];
      for (const [arenaId, type, ap, bp] of cases) {
        for (const diff of ['normal', 'hard']) {
          const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId, items: false, hazards: true, difficulty: diff })), [a, b] = m.fighters, log = cpuLog(m);
          m.controllers[0] = new AIController(a.profile, diff); m.controllers[1] = self.scripted(() => {});
          self.stand(a, ap[0], ap[1], bp[0], bp[1]); self.stand(b, bp[0], bp[1], ap[0], ap[1]);
          for (let t = 0; t < 900 && !log.some((e) => e.type === type); t++) m.step();
          self.run(m, 200);
          log.stop();
          const trig = log.find((e) => e.type === type);
          if (!trig || trig.by !== 0 || trig.via !== 'strike') problems.push(arenaId + ' ' + type + ' ' + diff + ' not struck: ' + JSON.stringify(trig));
          else if (log.hurt) problems.push(arenaId + ' ' + type + ' ' + diff + ' hurt the CPU itself');
        }
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: a CPU near its target and a hazard moves to where a throw sends the target through it (the glass wall, a post, the edge), more often on the harder levels, and a CPU in a zone that is warning or going off walks out on every tick', () => {
      const problems = [], breaks = {};
      for (const diff of ['easy', 'normal', 'hard', 'expert']) {
        breaks[diff] = 0;
        for (let seed = 1; seed <= 12; seed++) {
          const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed, arenaId: 'oldDojo', items: false, hazards: true, difficulty: diff })), [a, b] = m.fighters, log = cpuLog(m);
          m.controllers[0] = new AIController(a.profile, diff); m.controllers[1] = self.scripted(() => {});
          self.stand(a, -2.0, 0, -3.9, 0.3); self.stand(b, -3.9, 0.3, -2.0, 0);
          for (let t = 0; t < 120 && !log.some((e) => e.via === 'break'); t++) m.step();
          log.stop();
          if (log.some((e) => e.via === 'break' && e.by === 0)) breaks[diff]++;
        }
      }
      if (breaks.easy < 1 || breaks.easy >= breaks.normal || breaks.normal >= breaks.hard || breaks.hard > breaks.expert || breaks.expert < 11) problems.push('glass breaks of 12 in 2 s by level ' + JSON.stringify(breaks));
      const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId: 'oldWarehouse', items: false, hazards: true, difficulty: 'hard' })), [a, b] = m.fighters, panel = hazardOf(m, 'panel');
      m.controllers[0] = new AIController(a.profile, 'hard'); m.controllers[1] = self.scripted(() => {});
      self.stand(a, 4.7, -0.2, 0, 0); self.stand(b, -3, 3, 0, 0);
      m.controllers[0].plan = { kind: 'walk', ticks: 99, away: false, run: false };   // a plan under way is dropped at once
      m.hazardArm(panel, b, 'strike');
      self.run(m, 2);
      if (m.controllers[0].plan) problems.push('the plan stayed');
      self.run(m, HAZARDS.panel.warn - 3);
      if (m.hazardReaches(panel, a)) problems.push('the CPU stays in the zone ' + a.x.toFixed(2));
      return problems.length ? problems.join('; ') : true;
    });
    /* The real arenas (the tests above ran on the pre-P8 copies): what a CPU does with the strike hazards, the decks and the ledges that are really there. */
    const standOn = (f, x, z, top) => { f.x = f.prevX = x; f.z = f.prevZ = z; f.y = f.prevY = top; f.groundY = f.supportY = top; f.vy = 0; f.kx = f.kz = 0; };
    const freeSpotNear = (px, pz, radius, tries) => {   // a spot on the floor round (px, pz), inside the walls and clear of every obstacle, nearest the arena's centre
      const b = Arena.def.bounds;
      for (const r of tries || [radius]) {   // the first ring that has a free spot; on it the one nearest the centre
        let best = null, bestD = Infinity;
        for (let a = 0; a < 16; a++) {
          const x = px + Math.cos(a * Math.PI / 8) * r, z = pz + Math.sin(a * Math.PI / 8) * r;
          if (Math.abs(x) > b.x - 0.5 || Math.abs(z) > b.z - 0.5 || Arena.blockedAt(x, z, 0.45, 0)) continue;
          const d = Math.hypot(x, z);
          if (d < bestD) { bestD = d; best = [x, z]; }
        }
        if (best) return best;
      }
      return null;
    };
    test('Levels: on every real arena a CPU sets the steam, load and fire hazards off (by a strike from outside the zone or by a knock), and on every strike hazard, the panel too, is not hurt by it in the first 60 ticks after it is set off', () => {
      const problems = [];
      for (const id of ARENA_ORDER) {
        ARENAS[id].hazards.forEach(([type], index) => {
          if (HAZARDS[type].trig !== 'strike') return;
          for (const diff of ['normal', 'hard']) {
            const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId: id, items: false, hazards: true, difficulty: diff })), [a, b] = m.fighters, h = m.hazards[index], log = cpuLog(m);
            const inside = HAZARDS[type].shape === 'cone' ? [h.tx + h.fx * 1.0, h.tz + h.fz * 1.0] : type === 'load' ? [h.x, h.z] : [h.tx, h.tz];
            const spot = freeSpotNear(inside[0], inside[1], 0, type === 'fire' || type === 'panel' ? [0.9, 1.1] : [0, 0.3, 0.6]) || [inside[0], inside[1]];
            const ax = h.tx - spot[0], az = h.tz - spot[1], al = Math.hypot(ax, az) || 1, wide = Arena.def.bounds;   // the CPU starts to the side of the line between the target and the post, as it would from a crowd: not behind the target
            const far = [[-az / al, ax / al], [az / al, -ax / al]].map(([qx, qz]) => [spot[0] + qx * 3.2 + ax / al, spot[1] + qz * 3.2 + az / al]).find(([x, z]) => Math.abs(x) < wide.x - 0.6 && Math.abs(z) < wide.z - 0.6 && !Arena.blockedAt(x, z, 0.45, 0) && !Arena.pathBlocked(x, z, h.tx - ax / al * 0.8, h.tz - az / al * 0.8, 0.3, 0)) || freeSpotNear(spot[0], spot[1], 3.2, [3.2, 3.6, 4.0]);
            m.controllers[0] = new AIController(a.profile, diff); m.controllers[1] = self.scripted(() => {});
            self.stand(a, far[0], far[1], spot[0], spot[1]); self.stand(b, spot[0], spot[1], far[0], far[1]);
            const hurts = [], offHurt = Events.on('hazardHit', (e) => { if (e.f.index === 0 && e.dmg > 0) hurts.push(m.tick); });
            for (let t = 0; t < 900 && !log.some((e) => e.type === type); t++) m.step();
            self.run(m, 200);
            log.stop(); offHurt();
            const trig = log.find((e) => e.type === type);
            if (type !== 'panel' && (!trig || trig.by !== 0 || (trig.via !== 'strike' && trig.via !== 'knock'))) problems.push(id + ' ' + type + ' ' + diff + ' not set off by the CPU: ' + JSON.stringify(trig));
            else if (trig && hurts.some((t) => t >= trig.tick && t <= trig.tick + 60)) problems.push(id + ' ' + type + ' ' + diff + ' hurt the CPU at +' + (hurts.find((t) => t >= trig.tick) - trig.tick) + ' ticks');
          }
        });
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: on every real arena a CPU goes up to a target on each deck and ledge, comes down for a target on the floor or on another raised footing, each change of level inside the tick limit', () => {
      const problems = [], LEG_LIMIT = 700;   // a walk of up to 20 m (18 m of floor is 500 ticks) and a stair; a stop on every step would add 900 ticks
      const legs = {
        warehouse: [['mezz', 9.25, -4.75, 2.5], ['dock', -8.5, 3.75, 1.0], ['mezz', 9.25, -4.75, 2.5], ['floor', -2, 2, 0]],
        dojo: [['mezz', 7, -4.8, 2.5], ['ring', -7.8, 0, 1.0], ['mezz', 7, -4.8, 2.5], ['floor', 0, 1, 0]],
        pit: [['landing', 8.5, -4.85, 2.5], ['catwalk', -3, -5.9, 2.5], ['bar', -8.8, 3.6, 1.05], ['landing', 8.5, -4.85, 2.5], ['floor', 0, 1, 0]],
        rooftop: [['tank', -9, -5.25, 2.0], ['catwalk', -5.25, -6.45, 2.0], ['acA', -8.6, -0.5, 1.0], ['floor', 0, 1, 0]],
        subway: [['mezz', -10, 2.75, 2.5], ['floor', 0, 1, 0], ['repair.t0.1', 9.6, -3.0, 1.5], ['floor', 0, 1, 0]],
        garage: [['upper', -4.75, -5.75, 2.0], ['floor', 0, 1, 0]],
        construction: [['scaf.t0.1', -5, -4.8, 1.5], ['scaf.t0.2', -5, -6.0, 3.0], ['floor', 0, 1, 0]],
        club: [['stage', 2.2, -5.8, 1.0], ['balcony', 8.5, -4.5, 2.5], ['floor', 0, 1, 0]],
      };
      for (const id of ARENA_ORDER) {
        const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId: id, items: false, hazards: false, difficulty: 'hard' })), [a, b] = m.fighters;
        m.controllers[0] = new AIController(a.profile, 'hard'); m.controllers[1] = self.scripted(() => {});
        self.stand(a, 0.5, 1.5, 0, 0);
        for (const [name, x, z, top] of legs[id]) {
          standOn(b, x, z, top); b.hp = b.maxHp;
          let arrived = 0;
          for (let t = 1; t <= LEG_LIMIT && !arrived; t++) {
            m.step();
            b.hp = b.maxHp;
            const deck = Arena.objects.find((o) => o.id === name);   // on the deck itself, or within reach of the target for the floor and a counter
            if (Math.abs(a.groundY - top) < 0.06 && (deck && deck.type === 'deck' ? Math.abs(a.x - deck.x) <= deck.hx + 0.3 && Math.abs(a.z - deck.z) <= deck.hz + 0.3 : Math.hypot(a.x - x, a.z - z) < 2.2)) arrived = t;
          }
          if (!arrived) problems.push(id + ' ' + name + ': no arrival in ' + LEG_LIMIT + ' ticks (y ' + a.y.toFixed(2) + ' at ' + a.x.toFixed(1) + ',' + a.z.toFixed(1) + ')');
          if (a.hp < a.maxHp * 0.5) problems.push(id + ' ' + name + ': the CPU lost half its health on the way');
        }
        m.dispose();
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels: a target that stands safe on a ledge with no stair (the loading dock) is not safe: the CPU jumps up to it and hurts it', () => {
      const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId: 'warehouse', items: false, hazards: false, difficulty: 'hard' })), [a, b] = m.fighters, dock = Arena.objects.find((o) => o.id === 'dock');
      m.controllers[0] = new AIController(a.profile, 'hard'); m.controllers[1] = self.scripted(() => {});
      self.stand(a, -4, 1, -8.5, 3.75); standOn(b, -8.7, 3.75, 1.0);
      let dealt = 0;
      const off = Events.on('hit', (e) => { if (e.att === a && e.def === b) dealt += e.dmg; });
      for (let t = 0; t < 1500 && !dock.destroyed && b.alive; t++) { m.step(); }
      off();
      return dealt > 10 ? true : 'the CPU dealt ' + dealt.toFixed(1) + ' to a target on the dock';
    });
    test('Hazards: in ordinary seeded CPU against CPU matches (nobody placed anywhere) a CPU sets a hazard off in at least 3 of 12 seeds on every level with a reachable strike hazard (the Club: 15 percent of 24 seeds) (the Gym and the Subway are exempt: a panel only), and the matches run on without a hazard breaking a rule', () => {
      const problems = [];
      for (const arenaId of ARENA_ORDER) {
        let seeds = 0;
        const tries = arenaId === 'club' ? 24 : 12;   // the Club is the level with the fewest uses (25 percent over 60 seeds): twice the seeds, a floor of 15 percent
        for (let seed = 1; seed <= tries; seed++) {
          const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 60, seed, arenaId, difficulty: 'hard', items: true, hazards: true, winsNeeded: 2 })), log = cpuLog(m);
          m.controllers[0] = new AIController(m.fighters[0].profile, 'hard'); m.controllers[1] = new AIController(m.fighters[1].profile, 'hard');
          for (let t = 0; t < 7200 && m.phase !== 'matchEnd' && !log.some((e) => e.by >= 0); t++) { m.step(); if (m.phase === 'waiting') m.startRound(); }
          log.stop();
          if (log.some((e) => e.by >= 0)) seeds++;
          m.dispose();
        }
        const strikes = ARENAS[arenaId].hazards.some(([type]) => HAZARDS[type].trig === 'strike' && type !== 'panel');   // a CPU cannot strike a panel (it is out of reach of a blow from outside its arc): the Gym, with a fuse box and a mirror, only gets what comes by chance
        if (seeds < (strikes ? (arenaId === 'club' ? Math.ceil(tries * 0.15) : 3) : 0)) problems.push(arenaId + ': a CPU used a hazard in ' + seeds + ' of ' + tries + ' seeded matches');
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards: with the setting off nothing is placed or triggered, a seeded brawl with hazards and items repeats exactly, no hazard run breaks a state rule or makes a number invalid, and every hazard draws in every phase', () => {
      const problems = [];
      const illegal = Diag.illegalTransitions;
      const run = (arenaId, hazards, seed = 4) => {
        const m = track(new MatchSim({ mode: 'brawl', enemies: 3, countdown: false, timer: 0, seed, arenaId, difficulty: 'hard', evenDamage: true, items: true, hazards })), rows = [];
        m.controllers[0] = new AIController(m.fighters[0].profile, 'hard');
        const offs = ['hazardTrigger', 'hazardStart', 'hazardHit'].map((name) => Events.on(name, (e) => rows.push([name, m.tick, e.h.type, e.f ? e.f.index : '', e.dmg || ''].join())));
        for (let t = 0; t < 2400 && m.phase !== 'matchEnd'; t++) {
          m.step();
          for (const f of m.fighters) if (!Number.isFinite(f.x + f.z + f.hp + f.y)) { problems.push(arenaId + ' invalid number'); t = 1e9; break; }
        }
        offs.forEach((off) => off());
        return { rows, hash: fnv1a(rows.join('|') + m.fighters.map((f) => f.hp.toFixed(3) + f.x.toFixed(3)).join()), m };
      };
      let used = 0;
      for (const id of ARENA_ORDER) {
        const a = run(id, true), b = run(id, true), off = run(id, false);
        if (a.hash !== b.hash) problems.push(id + ' not repeatable');
        if (off.rows.length || off.m.hazards.length) problems.push(id + ' hazards off still act');
        used += a.rows.length;
      }
      for (let seed = 1; !used && seed <= 10; seed++) used += run('warehouse', true, seed).rows.length;   // the levels are big: a brawl on one seed may never come near a post
      if (!used) problems.push('no hazard ran in any brawl');
      if (Diag.illegalTransitions !== illegal) problems.push('illegal transitions');
      const puts = [], put = R.put;
      R.put = (...args) => { puts.push(args[1]); };
      try {
        for (const id of ARENA_ORDER) {
          const m = hz(id, {});
          for (const state of ['idle', 'warn', 'active', 'cool', 'spent']) { for (const h of m.hazards) { h.state = state; h.t = 30; } m.drawHazards(); }
        }
        withRows('warehouse', [['drop', 0, 0, { hx: 1, hz: 1 }], ['train', 2, 2, { hx: 1.2, hz: 4 }]], () => {
          const m = hz('warehouse', {});
          for (const state of ['idle', 'warn', 'active']) { for (const h of m.hazards) { h.state = state; h.t = 30; } m.drawHazards(); }
        });
      } catch (e) { problems.push('draw: ' + e.message); } finally { R.put = put; }
      if (puts.length < 100) problems.push('few pieces drawn ' + puts.length);
      return problems.length ? problems.join('; ') : true;
    });
    /* ----- P8-03 (the five new levels, the waves) and P8-05 (the 1v1 ring, the optional ring-out) ----- */
    const NEW_LEVELS = ['rooftop', 'subway', 'garage', 'construction', 'club'];
    const SHEET_RINGS = { warehouse: [0, 0, 6, 4, 0], dojo: [1, 0.5, 4, 3.5, 1], pit: [0, 0, 4.5, 3.5, 0], rooftop: [1, 0, 4, 4, 1], subway: [0, -1.3, 6, 4.6, 0], garage: [1, 1.5, 6, 4, 0], construction: [-1, 1, 5.5, 4, 1], club: [0, 1.2, 4.5, 3.5, 1] };   // the P8-01 table: ring x, z, hx, hz, ring-out
    const SHEET_WAVES = { warehouse: [3, 4, 5, 6], rooftop: [3, 4, 5, 6], subway: [3, 4, 5, 6, 6], garage: [3, 4, 5, 6], construction: [3, 4, 5, 6, 6], club: [3, 4, 5, 6, 6] };   // enemies per wave
    const RING_OUT_LEVELS = ARENA_ORDER.filter((id) => SHEET_RINGS[id][4]);
    const WAVE_LEVELS = ARENA_ORDER.filter((id) => SHEET_WAVES[id]);
    test('Levels (P8-03): the arena list has the eight levels in the sheet order, the select screen names each, every level has its sheet ring and (the new ones) its waves with entries inside the walls and a rival on the last wave only', () => {
      const problems = [], html = UI.screen_arena();
      if (ARENA_ORDER.join() !== 'warehouse,dojo,pit,rooftop,subway,garage,construction,club') problems.push('order ' + ARENA_ORDER);
      const floors = new Set();
      for (const id of ARENA_ORDER) {
        const def = ARENAS[id], b = def.bounds;
        if (!html.includes('data-act="arena:' + id + '"') || !html.includes(def.name)) problems.push(id + ' missing from the select screen');
        if (JSON.stringify(def.ring) !== JSON.stringify(SHEET_RINGS[id])) problems.push(id + ' ring ' + JSON.stringify(def.ring));
        const [rx, rz, rhx, rhz] = def.ring;
        if (Math.abs(rx) + rhx > b.x || Math.abs(rz) + rhz > b.z || rhx < def.spawn + 0.5) problems.push(id + ' ring does not fit the floor');
        floors.add(def.env.floor);
        const rows = def.waves;
        if (!SHEET_WAVES[id]) { if (rows) problems.push(id + ' has waves'); continue; }
        if (!rows || rows.map((r) => r[0]).join() !== SHEET_WAVES[id].join()) problems.push(id + ' waves ' + JSON.stringify(rows));
        rows.forEach((row, k) => {
          for (const [x, z] of [row.slice(1, 3), row[4]].filter(Boolean)) if (Math.abs(x) > b.x - 0.3 || Math.abs(z) > b.z - 0.3) problems.push(id + ' wave ' + k + ' entry outside');
          if (!!row[3] !== (k === rows.length - 1)) problems.push(id + ' wave ' + k + ' rival flag');
        });
        if (rows.length !== 4 && rows.length !== 5) problems.push(id + ' wave count');
      }
      if (floors.size !== 8) problems.push('floor patterns ' + [...floors]);
      if (!html.includes('Breakable:')) problems.push('no materials line');
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels (P8-03): a brawl with waves stands the first wave at its entry, calls the next when at most one enemy is up, brings each wave in at its entries with its own count, keeps at most six up, and ends when the last wave is down', () => {
      const problems = [];
      for (const id of WAVE_LEVELS) {
        const rows = ARENAS[id].waves, m = track(new MatchSim({ mode: 'brawl', waves: true, enemies: 1, countdown: false, timer: 0, seed: 5, arenaId: id, items: false, hazards: false, evenDamage: true, difficulty: 'normal', rival: 'hao' }));
        const party = m.fighters[0], enemies = () => m.fighters.slice(1), up = () => enemies().filter((f) => f.alive).length;
        const entryOf = (k) => [rows[k].slice(1, 3), rows[k][4]].filter(Boolean);
        const near = (f, k) => entryOf(k).some(([x, z]) => Math.hypot(f.x - x, f.z - z) < WAVE_SPREAD + 0.55) && Math.abs(f.y - Arena.supportAt(f.x, f.z, 99, f.radius)) < 0.01;
        const calls = [], off = Events.on('waveStart', (e) => calls.push({ wave: e.wave, up: up(), count: e.count }));
        if (enemies().length !== rows[0][0] || m.wave !== 1 || !enemies().every((f) => near(f, 0))) problems.push(id + ' first wave ' + enemies().length);
        const entered = rows.map(() => 0);
        entered[0] = enemies().length;
        let most = 0, rival = false;
        for (let t = 0; t < 30000 && m.phase !== 'matchEnd'; t++) {
          party.hp = party.maxHp;
          const seen = new Set(m.fighters);
          m.step();
          for (const f of m.fighters) if (!seen.has(f)) { entered[m.wave - 1]++; if (f.id === 'hao' && m.wave === rows.length) rival = true; if (!near(f, m.wave - 1)) problems.push(id + ' wave ' + m.wave + ' enemy entered at ' + f.x.toFixed(1) + ',' + f.z.toFixed(1)); }
          most = Math.max(most, up());
          if (t % 25 === 0) { const next = enemies().find((f) => f.alive); if (next) { next.hp = 0; Combat.knockOut(next, party, null, m); } }
        }
        off();
        if (entered.join() !== rows.map((r) => r[0]).join()) problems.push(id + ' entered ' + entered);
        if (calls.length !== rows.length - 1 || calls.some((c, i) => c.wave !== i + 2 || c.up > 1 || c.count !== rows[i + 1][0])) problems.push(id + ' calls ' + JSON.stringify(calls));
        if (most > BRAWL_MAX_ENEMIES || m.fighters.length - 1 > BRAWL_MAX_ENEMIES) problems.push(id + ' ' + most + ' up');
        if (m.phase !== 'matchEnd' || m.matchWinner !== TEAM_PLAYERS || up() !== 0) problems.push(id + ' did not end with the last wave down: ' + m.phase);
        if (!rival) problems.push(id + ' no rival in the last wave');
      }
      const cap = new MatchSim({ mode: 'brawl', waves: true, enemies: 1, countdown: false, seed: 5, arenaId: 'garage', coop: [{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }, { slot: 2, id: 'yuki' }, { slot: 3, id: 'brutus' }] });
      track(cap);
      if (cap.fighters.length - 4 !== 6) problems.push('a four player co-op first wave ' + (cap.fighters.length - 4));
      const plain = track(new MatchSim({ mode: 'brawl', enemies: 3, countdown: false, seed: 5, arenaId: 'rooftop' }));
      if (plain.waveRows || plain.fighters.length !== 4) problems.push('waves came without being asked for');
      return problems.length ? problems.join('; ') : true;
    });
    const ringMatch = (id, ringOut, extra) => track(new MatchSim(Object.assign({ mode: 'free', ring: true, ringOut, countdown: false, timer: 0, seed: 3, arenaId: id, difficulty: 'hard', winsNeeded: 1 }, extra)));
    test('Levels (P8-03): every new level draws whole, damaged and broken (decks, looks, props, hazards) with no error and a plausible number of pieces, and its floor pattern is the one of its sheet', () => {
      const problems = [], puts = [], put = R.put;
      R.put = (...args) => { puts.push(args[1]); };
      try {
        NEW_LEVELS.forEach((id, k) => {
          Arena.build(ARENAS[id]);
          if (ARENAS[id].env.floor !== k + 4) problems.push(id + ' floor ' + ARENAS[id].env.floor);
          Arena.draw();
          const whole = puts.length;
          puts.length = 0;
          for (const o of Arena.objects) if (!o.fixed) Arena.damageObject(o, 30, 'kick', 5, 1, 0, o.x, 0.5, o.z, 0);
          Arena.draw();
          const hurt = puts.length;
          for (const o of Arena.objects) if (!o.fixed) Arena.breakObject(o, 1, 0);
          puts.length = 0;
          Arena.draw(); Debris.update(0.016);
          if (whole < 100 || hurt < 50 || puts.length < 20) problems.push(id + ' draws ' + whole + ' / ' + hurt + ' / ' + puts.length);
          puts.length = 0;
        });
      } catch (e) { problems.push('draw: ' + e.message); } finally { R.put = put; Arena.build(ARENAS.warehouse); Debris.clear(); FX.clear(); }
      return problems.length ? problems.join('; ') : true;
    });
    test('1v1 areas (P8-05): in a 1v1 the walls stand at the ring (ring-out off) or one apron beyond it (ring-out on, only on a level that has it), the fighters start at the ring centre, nothing lies outside the ring, and a 1v1 without the option keeps the whole floor', () => {
      const problems = [];
      for (const id of ARENA_ORDER) {
        const def = ARENAS[id], [rx, rz, rhx, rhz, flag] = def.ring, b = def.bounds;
        for (const want of [false, true]) {
          const m = ringMatch(id, want), apron = want && flag ? RING_APRON : 0, [a, c] = m.fighters;
          const exp = [Math.max(-b.x, rx - rhx - apron), Math.min(b.x, rx + rhx + apron), Math.max(-b.z, rz - rhz - apron), Math.min(b.z, rz + rhz + apron)];
          if ([Arena.ax0, Arena.ax1, Arena.az0, Arena.az1].some((v, i) => Math.abs(v - exp[i]) > 1e-9) || Arena.ringOut !== !!(want && flag)) problems.push(id + ' ' + want + ' area ' + [Arena.ax0, Arena.ax1, Arena.az0, Arena.az1] + ' want ' + exp);
          if (Math.abs(a.x - (rx - def.spawn)) > 1e-9 || Math.abs(c.x - (rx + def.spawn)) > 1e-9 || a.z !== rz || c.z !== rz) problems.push(id + ' start ' + a.x + ',' + a.z + ' ' + c.x);
          if (m.items.some((it) => !Arena.inRing(it.x, it.z)) || m.hazards.some((h) => !Arena.inRing(h.obj ? h.obj.x : h.x, h.obj ? h.obj.z : h.z))) problems.push(id + ' item or hazard outside the ring');
          for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // pushed hard against each wall, a body stops at the wall of the area
            a.x = rx + x * 40; a.z = rz + z * 40; a.y = a.groundY = 0;
            Arena.resolveFighter(a);
            const wantX = x ? (x > 0 ? exp[1] - a.radius : exp[0] + a.radius) : null, wantZ = z ? (z > 0 ? exp[3] - a.radius : exp[2] + a.radius) : null;
            if ((wantX !== null && Math.abs(a.x - wantX) > 1e-9) || (wantZ !== null && Math.abs(a.z - wantZ) > 1e-9) || !a.wallHit) problems.push(id + ' wall ' + x + ',' + z);
          }
        }
        const whole = track(new MatchSim({ mode: 'free', countdown: false, seed: 3, arenaId: id }));
        if (Arena.ring || Arena.ax1 !== b.x || Arena.az0 !== -b.z || whole.fighters[0].x !== -def.spawn || whole.fighters[1].x !== def.spawn) problems.push(id + ' whole floor');
        const brawl = track(new MatchSim({ mode: 'brawl', ring: true, ringOut: true, enemies: 2, countdown: false, seed: 3, arenaId: id }));
        if (Arena.ring) problems.push(id + ' a brawl got a ring');
      }
      if (SETTING_DEFS.ringOut.def !== false || Settings.validate('ringOut', 'x') !== false) problems.push('setting');
      return problems.length ? problems.join('; ') : true;
    });
    test('1v1 areas (P8-05): with ring-out a fighter whose feet touch the floor outside the ring loses the round with the reason ringout, one in the air is safe until it lands, and nothing happens with the option off or on a level without it', () => {
      const problems = [];
      for (const id of ARENA_ORDER) {
        for (const want of [false, true]) {
          const flag = ARENAS[id].ring[4], [rx, rz, rhx] = ARENAS[id].ring, m = ringMatch(id, want, { winsNeeded: 1 }), [a, b] = m.fighters, rows = [];
          m.controllers[0] = self.scripted(() => {}); m.controllers[1] = self.scripted(() => {});
          const offs = [Events.on('ringOut', (e) => rows.push({ name: 'ringOut', f: e.f.index, tick: m.tick })), Events.on('roundEnd', (e) => rows.push({ name: 'roundEnd', winner: e.winner, reason: e.reason, tick: m.tick }))];
          self.run(m, 5);
          b.lastFoe = a;
          b.x = b.prevX = rx + rhx + 0.8; b.z = b.prevZ = rz; b.y = b.prevY = 1.6; b.vy = 0;
          self.run(m, 2);
          const early = rows.length;
          self.run(m, 60 + KO_DELAY_TICKS + 20);
          offs.forEach((off) => off());
          const out = rows.find((r) => r.name === 'ringOut'), end = rows.find((r) => r.name === 'roundEnd');
          if (want && flag) {
            if (early || !out || out.f !== 1 || !end || end.reason !== 'ringout' || end.winner !== 0 || b.alive || !a.alive || m.ringedOut !== b) problems.push(id + ' ring-out ' + JSON.stringify(rows));
          } else if (rows.length || !b.alive || b.x > rx + rhx + (want && flag ? RING_APRON : 0) + 0.01) problems.push(id + ' ' + want + ' nothing should happen ' + JSON.stringify(rows));
        }
      }
      for (const [id, x, z, top] of [['construction', -4.5, -4.4, 1.5], ['rooftop', 7.0, 3.1, 0.9], ['club', 4.0, -3.4, 0.25]]) {   // a scaffold tier, the sofa, a stage step: standing on anything outside the ring is out
        const raised = ringMatch(id, true), foe = raised.fighters[1], rows = [];
        const off = Events.on('ringOut', (e) => rows.push(e.f.index));
        foe.x = foe.prevX = x; foe.z = foe.prevZ = z; foe.y = foe.prevY = foe.groundY = foe.supportY = top;
        self.run(raised, 10);
        off();
        const inside = Arena.inRing(x, z);
        if (inside ? rows.length : rows.join() !== '1' || foe.alive) problems.push(id + ' ' + x + ',' + z + ' on ' + top + ' m: ' + (inside ? 'lost inside the ring' : 'did not lose outside it'));
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('1v1 areas (P8-05): a CPU does not walk, run or lunge out of the ring by itself (with ring-out on, against a target standing at the edge and in each corner), and a throw or a blow that puts the target out ends the round', () => {
      const problems = [];
      let outs = 0;
      for (const id of RING_OUT_LEVELS) {
        const [rx, rz, rhx, rhz] = ARENAS[id].ring;
        for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
          const m = ringMatch(id, true, { seed: 4 + (sx + 2 * sz + 6) % 5, items: false, hazards: false }), [a, b] = m.fighters, rows = [];
          m.controllers[0] = new AIController(a.profile, 'hard'); m.controllers[1] = self.scripted(() => {});
          self.stand(a, rx, rz, rx + sx, rz + sz); self.stand(b, rx + sx * (rhx - 0.7), rz + sz * (rhz - 0.7), rx, rz);
          const off = Events.on('ringOut', (e) => rows.push(e.f.index));
          for (let t = 0; t < 1200 && m.phase === 'fight'; t++) m.step();
          off();
          if (rows.includes(0)) problems.push(id + ' ' + sx + ',' + sz + ' the CPU left the ring');
          outs += rows.filter((i) => i === 1).length;
        }
      }
      if (!outs) problems.push('no CPU ever put its target out, so the ring edge is not used');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards (P8-03): a CPU that baits toward a hazard takes the same damage from a plain chaser as one that never baits (same seeds: all levels together no more than 10 percent worse, no level worse by more than two standard errors of the paired difference), takes no hazard damage it caused itself, and every bait spot is outside all hazard zones (and inside the ring with ring-out on)', () => {
      const problems = [], saved = AI_HAZARD_BAIT.hard, BAIT_SEEDS = 12, BAIT_TICKS = 1200;
      let sumOff = 0, sumOn = 0, selfHarm = 0;
      try {
        for (const id of ARENA_ORDER) {
          const took = [0, 0], each = [[], []];
          [0, saved].forEach((chance, k) => {
            AI_HAZARD_BAIT.hard = chance;
            for (let seed = 1; seed <= BAIT_SEEDS; seed++) {
              const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed, arenaId: id, difficulty: 'hard', items: false, hazards: true, winsNeeded: 99, evenDamage: true })), [a, b] = m.fighters;
              m.controllers[0] = self.scripted((it, f, opp, mm) => { const d = Math.hypot(opp.x - f.x, opp.z - f.z); if (d > 1.0) it.fwd = 1; else if (mm.tick % 18 === 0) it.punch = true; });   // walks up and punches, nothing else
              m.controllers[1] = new AIController(b.profile, 'hard');
              let before = took[k];
              const offs = [Events.on('hit', (e) => { if (e.def === b) took[k] += e.dmg; }), Events.on('hazardHit', (e) => { if (k && e.f === b && e.by === b && e.dmg > 0) selfHarm += e.dmg; })];
              for (let t = 0; t < BAIT_TICKS; t++) { a.hp = a.maxHp; b.hp = b.maxHp; m.step(); if (m.phase === 'waiting') m.startRound(); }
              offs.forEach((off) => off());
              each[k].push(took[k] - before);
              m.dispose();
            }
          });
          sumOff += took[0]; sumOn += took[1];
          const diffs = each[1].map((v, i) => v - each[0][i]), mean = diffs.reduce((s, v) => s + v, 0) / diffs.length, se = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (diffs.length - 1) / diffs.length);   // paired seed by seed
          if (mean - 2 * se > 0) problems.push(id + ' took ' + took[0].toFixed(0) + ' without bait, ' + took[1].toFixed(0) + ' with (mean difference per match ' + mean.toFixed(1) + ' +- ' + se.toFixed(1) + ')');
        }
      } finally { AI_HAZARD_BAIT.hard = saved; }
      if (sumOn > sumOff * 1.1) problems.push('all levels together ' + sumOff.toFixed(0) + ' without bait, ' + sumOn.toFixed(0) + ' with');
      if (selfHarm) problems.push('the CPU hurt itself with a hazard it set off: ' + selfHarm.toFixed(0));
      for (const [id, ringOut] of ARENA_ORDER.flatMap((level) => [[level, false], [level, true]])) {   // the spots
        const m = ringMatch(id, ringOut), ai = new AIController(m.fighters[0].profile, 'hard'), [a, b] = m.fighters;
        ai.match = m;
        for (const h of m.hazards) {
          if (!h.post || h.def.trig !== 'strike' || h.type === 'panel') continue;
          for (const [ox, oz] of [[-4, 0], [4, 0], [0, -3], [0, 3], [h.x + 2, h.z], [h.x, h.z + 2]]) {
            b.x = ox; b.z = oz;
            const s = ai.baitSpot(a, b, h);
            if (s && (m.hazards.some((q) => q.def.dmg > 0 && !q.def.shard && m.hazardCoversPad(q, s.x, s.z, 0.15)) || (Arena.ringOut && !Arena.inRing(s.x, s.z)))) problems.push(id + ' ' + h.type + ' bait spot ' + s.x.toFixed(1) + ',' + s.z.toFixed(1) + ' is in a hazard zone or out of the ring');
          }
        }
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    });
    test('Levels (P8-03): a called enemy whose entry stays in a live hazard zone waits at most WAVE_WAIT_MAX ticks, then uses the row\'s other entry, or comes in anyway when there is none', () => {
      const problems = [];
      const run = (wave) => {
        const m = track(new MatchSim({ mode: 'brawl', waves: true, enemies: 1, countdown: false, seed: 5, arenaId: 'subway', items: false, hazards: true, evenDamage: true })), train = hazardOf(m, 'train'), entered = [];
        m.fighters[0].hp = m.fighters[0].maxHp;
        for (const f of m.fighters.slice(1)) { f.hp = 0; Combat.knockOut(f, m.fighters[0], null, m); }
        m.wave = wave;
        const first = m.fighters.length;
        for (let t = 0; t < WAVE_WAIT_MAX + 90; t++) {
          train.state = 'active'; train.t = 0;   // the track stays live
          m.fighters[0].hp = m.fighters[0].maxHp;
          const seen = new Set(m.fighters);
          m.step();
          for (const f of m.fighters) if (!seen.has(f)) entered.push({ tick: t, x: f.x, z: f.z });
        }
        return { m, entered, first, train };
      };
      const one = run(2), count = ARENAS.subway.waves[2][0];   // one door, out of the tunnel: in anyway after the wait
      if (one.m.waveQueue.length || one.entered.length !== count || one.entered.some((e) => e.tick < WAVE_WAIT_MAX)) problems.push('single door: entered ' + one.entered.length + ' of ' + count + ' at ' + one.entered.map((e) => e.tick).join());
      const two = run(4), rowCount = ARENAS.subway.waves[4][0];   // two doors: the tunnel one is held, then everybody comes down the escalator
      if (two.m.waveQueue.length || two.entered.length !== rowCount || two.entered.some((e) => Math.hypot(e.x + 9.8, e.z - 4.6) > 1.4)) problems.push('two doors: ' + JSON.stringify(two.entered.map((e) => [e.tick, +e.x.toFixed(1), +e.z.toFixed(1)])));
      let closest = 9;   // the held enemies of the tunnel door joined those at the escalator: the ring there is spread over all six
      for (let i = 0; i < two.entered.length; i++) for (let j = i + 1; j < two.entered.length; j++) closest = Math.min(closest, Math.hypot(two.entered[i].x - two.entered[j].x, two.entered[i].z - two.entered[j].z));
      if (closest < 0.6) problems.push('two enemies entered ' + closest.toFixed(2) + ' m apart');
      return problems.length ? problems.join('; ') : true;
    });
    test('Hazards (P8-03): a CPU beside an open drop is not frozen by it (Construction at 9.3, 0 and the Rooftop at 0, -5.7): it walks off and attacks within 120 ticks, and never goes over', () => {
      const problems = [];
      for (const [id, x, z, tx, tz] of [['construction', 9.3, 0, 6.8, 0], ['rooftop', 0, -5.7, 0, -3.2]]) {
        let moved = 0, attacked = 0;
        const hurts = [];
        withRows(id, ARENAS[id].hazards.filter((row) => row[0] === 'drop'), () => {   // only the drop: the other dangers of the level would give the CPU other plans
          const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId: id, items: false, hazards: true, difficulty: 'hard' })), [a, b] = m.fighters;
          m.controllers[0] = new AIController(a.profile, 'hard'); m.controllers[1] = self.scripted(() => {});
          self.stand(a, x, z, tx, tz); self.stand(b, tx, tz, x, z);
          const off = Events.on('hazardHit', (e) => { if (e.f === a && e.dmg > 0) hurts.push(m.tick); });
          for (let t = 0; t < 120; t++) { m.step(); b.hp = b.maxHp; moved = Math.max(moved, Math.hypot(a.x - x, a.z - z)); if (a.state === S.ATTACK) attacked++; }
          off();
        });
        if (moved < 0.5 || !attacked || hurts.length) problems.push(id + ' moved ' + moved.toFixed(2) + ' attacked ' + attacked + ' hurt ' + hurts.length);
      }
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels (P8-03): a SimRunner brawl with waves counts the fighters of the later waves (their hits and their totals) and repeats exactly', () => {
      const opts = { arenaId: 'rooftop', enemies: 1, waves: true, seed: 6, difficulty1: 'expert', difficulty2: 'easy', timer: 0 }, a = SimRunner.run(opts), b = SimRunner.run(opts), first = ARENAS.rooftop.waves[0][0], problems = [];
      if (a.hpLeft.length <= 1 + first) problems.push('no later wave joined: ' + a.hpLeft.length + ' fighters');
      if (a.damage.length !== a.hpLeft.length) problems.push('damage rows ' + a.damage.length + ' for ' + a.hpLeft.length + ' fighters');
      if (!a.damage.slice(1 + first).some((row) => row && Object.keys(row).length)) problems.push('the hits of the later waves were not counted');
      if (JSON.stringify(a) !== JSON.stringify(b)) problems.push('not repeatable');
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels (P8-03): no wave entry stands in scenery or an open drop, and an entry inside a train zone that is warning waits (the round does not end meanwhile) until the zone is clear', () => {
      const problems = [];
      for (const id of WAVE_LEVELS) {
        const m = track(new MatchSim({ mode: 'brawl', waves: true, enemies: 1, countdown: false, seed: 5, arenaId: id, items: false, hazards: true }));
        ARENAS[id].waves.forEach((row, k) => {
          for (let j = 0; j < row[0]; j++) {
            const s = m.waveSpot(k, j, row[0]);
            if (Arena.blockedAt(s.x, s.z, 0.3, s.top) || m.hazards.some((h) => h.def.trig === 'edge' && m.hazardCoversPad(h, s.x, s.z, 0.34))) problems.push(id + ' wave ' + k + ' #' + j + ' at ' + s.x.toFixed(2) + ',' + s.z.toFixed(2));
          }
        });
      }
      const m = track(new MatchSim({ mode: 'brawl', waves: true, enemies: 1, countdown: false, seed: 5, arenaId: 'subway', items: false, hazards: true, evenDamage: true })), train = hazardOf(m, 'train');
      m.fighters[0].hp = m.fighters[0].maxHp;
      train.state = 'warn'; train.t = 0;
      m.wave = 2;   // the next wave called is the one that comes out of the tunnel, along the track
      for (const f of m.fighters.slice(1)) { f.hp = 0; Combat.knockOut(f, m.fighters[0], null, m); }
      self.run(m, 30);   // the knock-outs freeze the fight for a moment
      if (m.wave !== 3 || m.waveQueue.length !== ARENAS.subway.waves[2][0] || m.fighters.length !== 1 + ARENAS.subway.waves[0][0] || m.locked) problems.push('the entry did not wait: wave ' + m.wave + ' queued ' + m.waveQueue.length + ' locked ' + m.locked);
      train.state = 'idle'; train.t = 0;
      self.run(m, 4);
      if (m.waveQueue.length || m.fighters.length <= 1 + ARENAS.subway.waves[0][0]) problems.push('the wave did not enter once the zone was clear');
      return problems.length ? problems.join('; ') : true;
    });
    test('1v1 areas (P8-05): a seeded CPU against CPU 1v1 on every level ring completes with a winner, with ring-out off and on, and repeats exactly; an ordinary 1v1 (no ring option) is untouched', () => {
      const problems = [];
      for (const id of ARENA_ORDER) {
        for (const ringOut of [false, true]) {
          const opts = { arenaId: id, ring: true, ringOut, seed: 7, winsNeeded: 1, timer: 30, difficulty: 'hard', items: true, hazards: true }, a = SimRunner.run(opts), b = SimRunner.run(opts);
          if ((a.winner !== 0 && a.winner !== 1) || a.ticks >= 60 * 60 * 15) problems.push(id + ' ' + ringOut + ' no winner ' + a.ticks);
          if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(id + ' ' + ringOut + ' not repeatable');
        }
      }
      const plain = SimRunner.run({ arenaId: 'warehouse', seed: 1, playerId: 'kai', opponentId: 'mara', difficulty: 'hard' });
      if (plain.config.ring || plain.config.ringOut) problems.push('ring options leaked into a plain run');
      return problems.length ? problems.join('; ') : true;
    });
    test('Levels (P8-03): on the new levels the open drops, the train and the glass trigger and hurt who they catch, and a CPU standing away from them is not hurt in the next 60 ticks', () => {
      const problems = [];
      for (const id of NEW_LEVELS) {
        ARENAS[id].hazards.forEach(([type], index) => {
          if (HAZARDS[type].trig === 'strike') return;
          const m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 5, arenaId: id, items: false, hazards: true, difficulty: 'hard' })), [a, b] = m.fighters, h = m.hazards[index], log = cpuLog(m);
          m.controllers[0] = new AIController(a.profile, 'hard'); m.controllers[1] = self.scripted(() => {});
          const far = [[-2.4, 0], [2.4, 0], [0, 2], [0, -2], [-2.4, 2], [2.4, 2]].filter(([x, z]) => !m.hazardCovers(h, x, z) && Math.hypot(x - h.x, z - h.z) > 3.5 && !Arena.blockedAt(x, z, 0.45, 0)).pop() || [0, 2];
          self.stand(a, far[0], far[1], h.x, h.z); standOn(b, h.x, h.z, 0);
          const hits = [], offHit = Events.on('hazardHit', (e) => { if (e.h === h) hits.push({ tick: m.tick, f: e.f.index, dmg: e.dmg }); }), triggers = [], offTrig = Events.on('hazardTrigger', (e) => triggers.push(m.tick));
          if (type === 'train') h.t = HAZARDS.train.period - 2;
          if (type === 'glass') Arena.damageObject(h.obj, 999, 'throw', 1, 0, 1, h.obj.x, 1, h.obj.z, 1);
          const hurt = [], offHurt = Events.on('hazardHit', (e) => { if (e.f.index === 0 && e.dmg > 0) hurt.push(m.tick); });
          const start = m.tick;
          for (let t = 0; t < (type === 'train' ? HAZARDS.train.warn + 130 : 130); t++) { m.step(); b.hp = b.maxHp; }
          log.stop(); offHit(); offTrig(); offHurt();
          const first = hits.find((r) => r.f === 1 && r.dmg > 0);
          if (!first || (type !== 'drop' && !triggers.length) || (type === 'drop' && (first.dmg < 24 || Math.hypot(b.x - h.x, b.z - h.z) < 0.5))) problems.push(id + ' ' + type + ' did not work: ' + JSON.stringify({ triggers, hits: hits.slice(0, 2) }));
          if (first && hurt.some((t) => t >= first.tick && t <= first.tick + 60) || a.hp < a.maxHp * 0.99 && hurt.length) problems.push(id + ' ' + type + ' hurt the CPU');
          void start;
        });
      }
      return problems.length ? problems.join('; ') : true;
    });
    /* ----- P4-09: the camera never leaves the room ----- */
    test('Camera (P4-09): with the fighters along every wall and in every corner of every level, in a 1v1, a brawl and a co-op, on a wide, a phone-landscape and a portrait screen, the eye stays inside the room, every fighter is on screen and no wall lies between the eye and a fighter', () => withCamera(() => {
      const problems = [], out = [0, 0, 0], r = 0.34, margin = 0.6;
      const screens = [[1280, 720], [800, 360], [390, 844]];
      for (const id of ARENA_ORDER) {
        const def = ARENAS[id], b = def.bounds;
        const spots = [];   // along the four walls, the corners included, the pair standing along the wall and then in from it
        for (let k = 0; k <= 4; k++) {
          const u = -1 + k / 2;
          spots.push([-(b.x - r), u * (b.z - r), 1, 0], [b.x - r, u * (b.z - r), -1, 0], [u * (b.x - r), -(b.z - r), 0, 1], [u * (b.x - r), b.z - r, 0, -1]);
        }
        const matches = {
          duel: track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 3, arenaId: id })),
          brawl: track(new MatchSim({ mode: 'brawl', enemies: 3, countdown: false, timer: 0, seed: 3, arenaId: id })),
          coop: track(new MatchSim({ mode: 'brawl', enemies: 3, coop: [{ slot: 0, id: 'kai' }, { slot: 1, id: 'mara' }], countdown: false, timer: 0, seed: 3, arenaId: id })),
        };
        for (const mode in matches) {
          const m = matches[mode], f = m.fighters;
          for (const [w, h] of screens) {
            R.cssW = w; R.cssH = h;
            for (const [x, z, inX, inZ] of spots) {
              for (const along of [false, true]) {   // the others stand beside the first along the wall, or in from the wall
                f.forEach((fighter, i) => {
                  const step = i * 1.1, ax = along ? -inZ : inX, az = along ? inX : inZ;   // along: the wall direction
                  fighter.x = fighter.prevX = clamp(x + ax * step, -(b.x - r), b.x - r); fighter.z = fighter.prevZ = clamp(z + az * step, -(b.z - r), b.z - r); fighter.y = fighter.prevY = 0;
                });
                Camera.snapNext = true; Camera.resetGroup();
                for (let i = 0; i < 60; i++) { if (mode === 'duel') Camera.follow(1 / 60, f[0], f[1], def); else Camera.followGroup(1 / 60, f, def); }
                const ex = Camera.pos[0], ey = Camera.pos[1], ez = Camera.pos[2], tag = id + ' ' + mode + ' ' + w + 'x' + h + ' at ' + x.toFixed(1) + ',' + z.toFixed(1) + (along ? ' along' : ' in');
                if (Math.abs(ex) > b.x - margin + 1e-6 || ez < -b.z + margin - 1e-6 || ey < 1.79) problems.push(tag + ': the eye is at ' + ex.toFixed(1) + ', ' + ey.toFixed(1) + ', ' + ez.toFixed(1));
                for (const fighter of f) {
                  const inRoom = Math.abs(fighter.x) <= b.x && fighter.z >= -b.z;   // eye and fighter inside the side walls and the back wall: the line between them cannot cross one
                  if (!inRoom || fighter.index >= m.partySize + (mode === 'duel' ? 1 : 0)) continue;   // the fighters the camera answers for: both of a 1v1, the party of a brawl (an enemy behind a prop may fall off the edge when the camera steepens to see the player)
                  if ((Camera.offscreenMark(fighter.x, fighter.y + 1.0, fighter.z, w, h, 0, out) || Camera.offscreenMark(fighter.x, fighter.y + 0.1, fighter.z, w, h, 0, out))) problems.push(tag + ': fighter ' + fighter.index + ' is off screen');
                }
              }
              if (problems.length > 8) break;
            }
          }
        }
      }
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    }));
    test('Camera (P4-09): with the pair walked round the walls of every level, no ceiling prop (a light tube) is drawn opaque within 0.45 m of the eye (the near clip is 0.3): it fades before the eye reaches it', () => withCamera(() => {
      const problems = [], put = R.put, r = 0.34, puts = [];
      let garageClose = 0;
      R.cssW = 1280; R.cssH = 720;
      R.put = (...args) => { puts.push(args); };
      try {
        for (const id of ARENA_ORDER) {
          const def = ARENAS[id], b = def.bounds, m = track(new MatchSim({ mode: 'free', countdown: false, timer: 0, seed: 3, arenaId: id })), f = m.fighters;
          const ceiling = Arena.props.filter((p) => p.y - p.sy * 0.5 >= 3.0);
          const pts = [[-(b.x - r), b.z - r], [-(b.x - r), -(b.z - r)], [b.x - r, -(b.z - r)], [b.x - r, b.z - r], [-(b.x - r), b.z - r]];
          Camera.snapNext = true;
          for (let s = 0; s + 1 < pts.length; s++) {
            const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.1);
            for (let i = 0; i < n; i++) {
              const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
              f.forEach((q, k) => { q.x = q.prevX = clamp(x + (k ? 0.6 : -0.6) * (Math.abs(x) < b.x - 2 ? 1 : 0), -(b.x - r), b.x - r); q.z = q.prevZ = clamp(z + (Math.abs(x) < b.x - 2 ? 0 : (k ? 0.6 : -0.6)), -(b.z - r), b.z - r); q.y = q.prevY = 0; });
              Camera.follow(1 / 60, f[0], f[1], def);
              const eye = Camera.pos, near = ceiling.filter((p) => Math.hypot(Math.max(Math.abs(eye[0] - p.x) - p.sx * 0.5, 0), Math.max(Math.abs(eye[1] - p.y) - p.sy * 0.5, 0), Math.max(Math.abs(eye[2] - p.z) - p.sz * 0.5, 0)) < 0.45);   // the near clip is 0.3 m
              if (!near.length) continue;
              if (id === 'garage') garageClose++;
              puts.length = 0;
              Arena.draw();
              for (const p of near) {
                const drawn = puts.find((a) => a[2] === p.x && a[4] === p.z && a[5] === p.sx && a[6] === p.sy && a[7] === p.sz);
                if (drawn && drawn[0] !== LAYER.ALPHA) { problems.push(id + ' prop ' + p.x + ',' + p.y + ',' + p.z + ' is opaque with the eye at ' + eye.map((v) => v.toFixed(1))); break; }
                if (drawn && drawn[12] > 0.3) { problems.push(id + ' prop ' + p.x + ',' + p.y + ',' + p.z + ' is drawn at alpha ' + drawn[12].toFixed(2) + ' with the eye within 0.45 m'); break; }
              }
              if (problems.length > 6) break;
            }
          }
        }
      } finally { R.put = put; Arena.build(ARENAS.warehouse); Debris.clear(); FX.clear(); }
      if (!garageClose) problems.push('the walk never came near a Garage tube, so the test proved nothing');
      return problems.length ? problems.slice(0, 6).join('; ') : true;
    }));
    for (const id in OLD_ARENAS) delete ARENAS[id];
    return results;
  },
};

return SelfTest;
};
