// ==== S03 DATA: BOTS ====
// Bot skill tiers BT0..BT7 (spec 16 BT table + BOT-093 hit-rate caps), personality traits T01..T16, trait styles,
// the named roster B01..B24 (BOT-070) and the chatter lines (BOT-100). S14 Bots reads every number from here.

// combatMove: 'stand' (BOT-032 tier 0), 'walk' (tier 1), 'strafe' (tier 2+). dodgeChance: BOT-033 projectile dodge success
// (<= 60% at BT7, MIS-004). hitCap: BOT-093 hitscan hit rate vs a strafing target at 15 m (30 s windows).
Data.define('botTiers', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, tier: REQUIRED, speed: 1, fov: 120, turn: 200, reaction: 550, aimError: 5, hitCap: 0.28,
  combatMove: 'strafe', jumps: false, itemTiming: false, lead: false, dodgeChance: 0, headAim: false, flashPeek: false,
  weaponJumps: false, flanks: false, targetSwitch: false, gadgets: false,
}, [
  { id: 'novice', code: 'BT0', name: 'Novice', tier: 0, speed: 0.6, fov: 100, turn: 120, reaction: 900, aimError: 9, hitCap: 0.15, combatMove: 'stand' },
  { id: 'rookie', code: 'BT1', name: 'Rookie', tier: 1, speed: 0.7, fov: 110, turn: 160, reaction: 700, aimError: 7, hitCap: 0.20, combatMove: 'walk' },
  { id: 'regular', code: 'BT2', name: 'Regular', tier: 2, speed: 0.8, fov: 120, turn: 200, reaction: 550, aimError: 5, hitCap: 0.28, gadgets: true },
  { id: 'skilled', code: 'BT3', name: 'Skilled', tier: 3, speed: 0.9, fov: 130, turn: 240, reaction: 420, aimError: 3.5, hitCap: 0.35, gadgets: true,
    jumps: true, itemTiming: true, flashPeek: true },
  { id: 'adept', code: 'BT4', name: 'Adept', tier: 4, speed: 1, fov: 140, turn: 280, reaction: 330, aimError: 2.5, hitCap: 0.42, gadgets: true,
    jumps: true, itemTiming: true, flashPeek: true, lead: true, dodgeChance: 0.3, headAim: true },
  { id: 'masterful', code: 'BT5', name: 'Masterful', tier: 5, speed: 1, fov: 150, turn: 330, reaction: 260, aimError: 1.8, hitCap: 0.50, gadgets: true,
    jumps: true, itemTiming: true, flashPeek: true, lead: true, dodgeChance: 0.4, headAim: true, weaponJumps: true, flanks: true },
  { id: 'inhuman', code: 'BT6', name: 'Inhuman', tier: 6, speed: 1, fov: 160, turn: 380, reaction: 210, aimError: 1.3, hitCap: 0.58, gadgets: true,
    jumps: true, itemTiming: true, flashPeek: true, lead: true, dodgeChance: 0.5, headAim: true, weaponJumps: true, flanks: true, targetSwitch: true },
  { id: 'apex', code: 'BT7', name: 'Apex', tier: 7, speed: 1, fov: 170, turn: 420, reaction: 180, aimError: 1.0, hitCap: 0.65, gadgets: true,
    jumps: true, itemTiming: true, flashPeek: true, lead: true, dodgeChance: 0.6, headAim: true, weaponJumps: true, flanks: true, targetSwitch: true },
]);

// Traits T01..T16 (BOT-070): 0..1 each, 0.5 = neutral. Row order = the TRAIT index used by S14.
Data.define('botTraits', { id: REQUIRED, code: REQUIRED, name: REQUIRED, effect: REQUIRED }, [
  { id: 'accuracy', code: 'T01', name: 'Accuracy', effect: 'scales aim error' },
  { id: 'aimSkill', code: 'T02', name: 'Aim skill', effect: 'lead quality' },
  { id: 'reaction', code: 'T03', name: 'Reaction', effect: 'scales reaction time' },
  { id: 'aggression', code: 'T04', name: 'Aggression', effect: 'attack/chase weight' },
  { id: 'alertness', code: 'T05', name: 'Alertness', effect: 'vision range, awareness fill' },
  { id: 'hearing', code: 'T06', name: 'Hearing', effect: 'hearing radius' },
  { id: 'camper', code: 'T07', name: 'Camper', effect: 'camp weight/duration' },
  { id: 'jumpiness', code: 'T08', name: 'Jumpiness', effect: 'jump/dodge frequency' },
  { id: 'strafing', code: 'T09', name: 'Strafing', effect: 'combat movement quality' },
  { id: 'selfPreservation', code: 'T10', name: 'Self-preservation', effect: 'retreat threshold' },
  { id: 'vengefulness', code: 'T11', name: 'Vengefulness', effect: 'targets last attacker' },
  { id: 'weaponJumper', code: 'T12', name: 'Weapon jumper', effect: 'uses weapon jumps' },
  { id: 'teamwork', code: 'T13', name: 'Teamwork', effect: 'follows orders, pings, revives' },
  { id: 'itemFocus', code: 'T14', name: 'Item focus', effect: 'item timing, power items' },
  { id: 'sprayControl', code: 'T15', name: 'Spray control', effect: 'recoil compensation' },
  { id: 'abilityUse', code: 'T16', name: 'Ability use', effect: 'ability/grenade frequency' },
]);

const BOT_TRAIT_NEUTRAL = 0.5;
// Signature styles of the roster: trait values laid over the neutral 0.5 (a bot row may add its own `traits`).
const BOT_TRAIT_STYLES = {
  plain: {},
  timid: { aggression: 0.2, selfPreservation: 0.9, camper: 0.6 },
  camper: { camper: 0.9, aggression: 0.35, accuracy: 0.6 },
  jumpy: { jumpiness: 0.95, strafing: 0.7 },
  aggressive: { aggression: 0.9, selfPreservation: 0.25, vengefulness: 0.7 },
  teamwork: { teamwork: 0.95, abilityUse: 0.6 },
  itemFocus: { itemFocus: 0.95, selfPreservation: 0.6 },
  strafer: { strafing: 0.95, jumpiness: 0.6 },
  vengeful: { vengefulness: 0.95, aggression: 0.7 },
  alert: { alertness: 0.95, hearing: 0.9, reaction: 0.65 },
  abilityUse: { abilityUse: 0.95, teamwork: 0.6 },
  accurate: { accuracy: 0.9, aimSkill: 0.85, sprayControl: 0.8 },
  weaponJumper: { weaponJumper: 0.95, jumpiness: 0.7, aggression: 0.65 },
  flanker: { strafing: 0.75, aggression: 0.7, alertness: 0.7 },
  allRound: { accuracy: 0.7, aimSkill: 0.7, reaction: 0.7, aggression: 0.6, alertness: 0.7, hearing: 0.7, strafing: 0.7, sprayControl: 0.7, itemFocus: 0.7, teamwork: 0.7 },
  champion: { accuracy: 0.85, aimSkill: 0.85, reaction: 0.8, aggression: 0.7, alertness: 0.8, hearing: 0.8, strafing: 0.85, sprayControl: 0.85, itemFocus: 0.85, jumpiness: 0.7 },
};

// favorite: weapon key; BOT_FAVORITE_PLAYER = the player's most used weapon (B24). chat: 'quiet' | 'normal' | 'loud' (bark chance).
const BOT_FAVORITE_PLAYER = 'player';
Data.define('bots', {
  id: REQUIRED, code: REQUIRED, name: REQUIRED, tier: REQUIRED, style: 'plain', traits: {}, favorite: '', color: 0x8899aa, chat: 'normal',
}, [
  { id: 'pell', code: 'B01', name: 'Pell', tier: 0, style: 'timid', favorite: 'warden', color: 0xc9b38a, chat: 'quiet' },
  { id: 'dovetail', code: 'B02', name: 'Dovetail', tier: 0, style: 'camper', favorite: 'heron', color: 0x9a8f7d, chat: 'quiet' },
  { id: 'grommet', code: 'B03', name: 'Grommet', tier: 1, style: 'jumpy', favorite: 'scattergun', color: 0xe08a3c, chat: 'loud' },
  { id: 'ashby', code: 'B04', name: 'Ashby', tier: 1, style: 'aggressive', favorite: 'wasp', color: 0xc8553d },
  { id: 'lintel', code: 'B05', name: 'Lintel', tier: 1, style: 'teamwork', favorite: 'linker', color: 0x5fa8a0 },
  { id: 'mossa', code: 'B06', name: 'Mossa', tier: 2, style: 'itemFocus', favorite: 'ramjet', color: 0x6f9a4a },
  { id: 'rookvarga', code: 'B07', name: 'Rook Varga', tier: 2, style: 'camper', favorite: 'kestrel', color: 0x4b5d6b, chat: 'quiet' },
  { id: 'tilde', code: 'B08', name: 'Tilde', tier: 2, style: 'strafer', favorite: 'vanguard', color: 0xd4b44a, chat: 'loud' },
  { id: 'corvan', code: 'B09', name: 'Corvan', tier: 3, style: 'vengeful', favorite: 'shardcaster', color: 0x7a3b52 },
  { id: 'nyx7', code: 'B10', name: 'Nyx-7', tier: 3, style: 'alert', favorite: 'lancet', color: 0x7c6fd6, chat: 'quiet' },
  { id: 'brindle', code: 'B11', name: 'Brindle', tier: 3, style: 'aggressive', favorite: 'hookjaw', color: 0xa86b3a, chat: 'loud' },
  { id: 'saffi', code: 'B12', name: 'Saffi', tier: 3, style: 'abilityUse', favorite: 'coilcaster', color: 0xe3a1c4 },
  { id: 'halloran', code: 'B13', name: 'Halloran', tier: 4, style: 'accurate', favorite: 'heron', color: 0x3f6f8f, chat: 'quiet' },
  { id: 'quarry', code: 'B14', name: 'Quarry', tier: 4, style: 'weaponJumper', favorite: 'ramjet', color: 0x8c8c5a },
  { id: 'jessamy', code: 'B15', name: 'Jessamy', tier: 4, style: 'itemFocus', favorite: 'stormlash', color: 0x58b7d8 },
  { id: 'okoro', code: 'B16', name: 'Okoro', tier: 4, style: 'teamwork', favorite: 'vanguard', color: 0x3e9d63 },
  { id: 'vantablue', code: 'B17', name: 'Vantablue', tier: 5, style: 'flanker', favorite: 'ember', color: 0x2b3fae },
  { id: 'marrow', code: 'B18', name: 'Marrow', tier: 5, style: 'aggressive', favorite: 'shardcaster', color: 0xb8a48c, chat: 'loud' },
  { id: 'isoldecrane', code: 'B19', name: 'Isolde Crane', tier: 5, style: 'accurate', favorite: 'lancet', color: 0xd9d2e9 },
  { id: 'teodor', code: 'B20', name: 'Teodor', tier: 6, style: 'allRound', favorite: 'coilcaster', color: 0x9e6b2f },
  { id: 'wrenkasai', code: 'B21', name: 'Wren Kasai', tier: 6, style: 'jumpy', favorite: 'razorwind', color: 0xd0473c, chat: 'loud' },
  { id: 'ostrava', code: 'B22', name: 'Ostrava', tier: 6, style: 'camper', favorite: 'stakedriver', color: 0x5c6670, chat: 'quiet' },
  { id: 'calderrhee', code: 'B23', name: 'Calder Rhee', tier: 7, style: 'champion', favorite: 'hailstorm', color: 0xc0c7cf },
  { id: 'wardenofnine', code: 'B24', name: 'The Warden of Nine', tier: 7, style: 'champion', favorite: BOT_FAVORITE_PLAYER, color: 0x1d1d24, traits: { accuracy: 0.9 } },
]);

// Chatter (BOT-100): text barks per category. minimal: still spoken with the "minimal" chatter setting. taunt: off with the taunts option.
// reply: an answer to a person's order or ping, always given (no chance roll, no bark limits) unless chatter is off.
const BOT_BARKS = {
  spotted: { minimal: false, taunt: false, lines: ['Contact!', 'Enemy spotted.', 'Got eyes on one.'] },
  reloading: { minimal: false, taunt: false, lines: ['Reloading!', 'Changing mag.', 'Cover me, reloading.'] },
  needHelp: { minimal: false, taunt: false, lines: ['Need help here!', 'Taking fire!', 'Could use a hand.'] },
  takingPoint: { minimal: true, taunt: false, lines: ['Taking the point.', 'Capturing.', 'On the objective.'] },
  itemGrab: { minimal: false, taunt: false, lines: ['Grabbing it.', 'Picked that up.', 'Mine.'] },
  killTaunt: { minimal: false, taunt: true, lines: ['Too slow.', 'Better luck next time.', 'Got one.'] },
  death: { minimal: false, taunt: false, lines: ['I am down.', 'They got me.', 'Ouch.'] },
  orderAck: { minimal: true, taunt: false, reply: true, lines: ['On it.', 'Copy that.', 'Understood.'] },
  pingReply: { minimal: true, taunt: false, reply: true, lines: ['Ok.', 'Thanks.', 'Seen it.', 'Got it.'] },
  dibs: { minimal: true, taunt: false, reply: true, lines: ['Dibs.', 'That one is mine.', 'Taking it.'] },
  lowHealth: { minimal: false, taunt: false, lines: ['Low on health.', 'Hurting here.', 'Need a medkit.'] },
  objective: { minimal: true, taunt: false, lines: ['Objective moving!', 'Watch the objective.', 'Push the objective!'] },
};
const BOT_CHAT_CHANCE = { quiet: 0.5, normal: 0.8, loud: 1 };   // chance that a due bark is spoken, by the bot's chat style

// Team roles (BOT-050): share of a team's bots the commander gives each role, by the mode's objective kind; the rest
// attack. Free-for-all bots are freelancers. Flags:
// 'flag' while the enemy flag is home (more raiders than BOT-050's 40% attack: two raiders gather before a push, and the
// soak's capture rate needs three of four; 20% defend so a 5-bot team raids with 3, as 2 raiders stall a 5 v 5 at 0-0), 'flagTaken' while a team-mate carries it (BOT-050: 60% defend, 30% escort),
// judged at each commander round (a switch at the very moment of the grab breaks the raid; the soak's balance shows it).
const BOT_ROLE_SPLITS = {
  flag: { defend: 0.2, escort: 0.2 },
  flagTaken: { defend: 0.6, escort: 0.3 },
  point: { defend: 0.4 },
  hill: { defend: 0.25 },
  bombsite: { escort: 0.3 },
  none: { defend: 0.2 },
};
const BOT_CAMP_HINTS = ['sniper', 'cover', 'guard'];   // map navHints kinds a camper may hold (BOT-041)
const BOT_FLANK_HINT = 'flank';                         // map navHints kind a flanking tier (botTiers `flanks`) chases round by
const BOT_CHOKE_HINT = 'choke';                         // map navHints kind an attacking bot smokes on its way to the target

// Flag raids (BOT-050 attack play): while the enemy flag is home, a team's attackers and escorts gather at a rally point
// (share of the way from their own base to the enemy flag) and push together once `minimum` of them are within `radius`
// m of it (or the first has waited `wait` s); a push lasts `seconds` s or until the flag is taken.
const BOT_FLAG_PUSH = { rallyShare: 0.2, radius: 9, minimum: 2, wait: 5, seconds: 22 };

// Squads (BOT-052, versus team modes): at each commander round the bots of one role form squads of up to `size`; the
// one with the most teamwork leads. Followers keep within `keep` m of the leader, detour at most `regroup` m (items,
// sounds) and regroup with it once farther (broken off); a fallen leader hands the squad to its next follower.
const BOT_SQUAD = { size: 3, keep: 6, regroup: 15 };
// Bot shopping (14f BotEconomy), once per buy time or open wave shop: a round-buy bot with less than `ecoMoney` (x 0.75..1.25
// by the self-preservation trait) saves for a later round; else it buys a gun worth `upgrade` more than its best one,
// then armour, then a grenade (tiers with gadgets). In the wave shop it refills low guns and, keeping `shopKeep`
// credits for the next refill, buys placed gadgets.
const BOT_BUY = { ecoMoney: 2000, upgrade: 0.1, shopKeep: 300 };
// Tokens (BOT-053): at most `attackers` bots close in on one target at once (the others fight from where they stand; a
// melee weapon always closes in), and one bot per team flanks at a time. A holder keeps its token while it renews it
// (every decision) within `hold` s and still plays the goal it took it for.
const BOT_TOKENS = { attackers: 2, hold: 1.2 };

// Mode goal hints (BOT-080): what a bot does at an objective whose Modes.goalFor names the verb. action: 'move' (go
// there), 'hold' (stay and watch, spread over the zone), 'use' (stand inside and hold USE: arm, disarm), 'keep' (carry a
// prize and stay away from enemies). share: arrival radius as a share of the objective's radius (0 = touch it).
// urgency: 0..1 objective urgency; above 1 (reach a beacon, keep a prize) it outranks any fight.
const BOT_OBJECTIVE_VERBS = {
  arm: { action: 'use', share: 0.35, urgency: 0.95 },
  disarm: { action: 'use', share: 0.25, urgency: 1 },
  defend: { action: 'hold', share: 0.8, urgency: 0.7 },
  guard: { action: 'hold', share: 0.6, urgency: 0.8 },
  escort: { action: 'move', share: 0.45, urgency: 0.9 },
  stop: { action: 'move', share: 0.45, urgency: 0.9 },
  take: { action: 'move', share: 0, urgency: 0.85 },
  reach: { action: 'move', share: 0, urgency: 1.15 },
  hold: { action: 'keep', share: 0, urgency: 1.15 },
};

// Roles of the add-on modes (Modes.actorRole names) every opponent hunts: their marker or carried prize is drawn for
// everyone, so bots may know where they are (ARC-033: what a person sees on screen) and value them as targets.
const BOT_HUNTED_ROLES = ['carrier', 'colossus', 'cursed', 'bearer'];

// Grenades and gadgets (BOT-034/035) by the gadget row's effect: the trigger (BOT_USE_TRIGGERS: the words of the ability
// botUse), the target distance range [min, max] m (max 0 = any distance, or no target needed), the chance per check, and
// for thrown rows where the throw lands ('enemy' = where the bot believes its target is, 'between' = half way there, a
// screen); tierFlag: the botTiers flag a bot's tier needs to use it (none = every tier with gadgets). cover = the target hid in the last 3 s or 2+
// enemies stand together; coverOrHolding = that, or any target while the bot holds its spot (BOT-034: frags at cover,
// clusters or from a held point); holding = the bot holds its spot (defend, camp, objective); lowAmmo = the drawn
// weapon's reserve is low. An effect missing here is never used by bots.
const BOT_GADGET_USE = {
  explode: { when: 'coverOrHolding', range: [16, 32], chance: 0.35, aim: 'enemy' },   // P8-04: from 8 m the blast came back on the thrower (self and team damage 14-51 % of a frag's damage); from 16 m 2-10 %
  fire: { when: 'coverOrHolding', range: [16, 32], chance: 0.3, aim: 'enemy' },
  singularity: { when: 'groupedEnemies', range: [8, 25], chance: 0.8, aim: 'enemy' },
  flash: { when: 'cover', range: [6, 20], chance: 0.7, aim: 'enemy', tierFlag: 'flashPeek' },   // BOT-034: flash before a peek (tier 3+)
  freeze: { when: 'enemyClose', range: [4, 14], chance: 0.6, aim: 'enemy' },
  impulse: { when: 'enemyClose', range: [3, 12], chance: 0.5, aim: 'enemy' },
  emp: { when: 'enemyVisible', range: [8, 25], chance: 0.4, aim: 'enemy' },
  smoke: { when: 'underFire', range: [8, 25], chance: 0.6, aim: 'between' },
  mine: { when: 'holding', range: [0, 0], chance: 1 },
  turret: { when: 'holding', range: [0, 0], chance: 1 },
  beacon: { when: 'holding', range: [0, 0], chance: 0.5 },
  jammer: { when: 'objective', range: [0, 0], chance: 1 },
  barrier: { when: 'holding', range: [0, 0], chance: 0.5 },   // a wall the nav graph does not know: only where the bot stays
  trophy: { when: 'underFire', range: [0, 40], chance: 0.6 },
  drones: { when: 'enemyVisible', range: [10, 40], chance: 0.6 },
  supply: { when: 'lowAmmo', range: [0, 0], chance: 1 },
};
// Thrown effects a bot runs from when it hears one bounce close (smoke and flash do no harm where they land).
const BOT_FLEE_EFFECTS = ['explode', 'fire', 'singularity', 'impulse', 'freeze'];
