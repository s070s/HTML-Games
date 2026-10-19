# IRON HORIZON
## Complete Game Design and Technical Specifications

**Document type:** Game Design Document (GDD) + Technical Requirements Specification  
**Version:** 1.0  
**Target year:** 2026  
**Genre:** 3D science-fiction combined-arms combat  
**Primary platforms:** Combat mechs, ground combat vehicles, and combat aircraft  
**Game modes:** Single-player, cooperative PvE multiplayer, optional PvP  
**Input:** Keyboard and mouse  
**Implementation constraint:** One self-contained HTML file; no game engines, frameworks, third-party JavaScript libraries, or mandatory external assets.

---

# 1. Product Definition

## 1.1 Game Concept

IRON HORIZON is a real-time 3D combat game set in a futuristic war zone. Players pilot customizable mechs, armored vehicles, and combat aircraft across large battlefields containing hostile NPC forces, destructible structures, tactical objectives, and dynamic combat encounters.

The player must be able to switch between different combat platforms without relearning the essential controls for aiming, firing, targeting, defense, or interface navigation.

The game combines accessible arcade-style flight, weighty mech movement, vehicle combat, tactical loadout construction, intelligent enemy behavior, and cooperative multiplayer.

## 1.2 Core Design Principles

1. Mouse movement controls aiming and, when appropriate, assisted aircraft flight.
2. Keyboard controls movement, mobility, vehicle systems, and combat utilities.
3. Essential combat actions use single keys or mouse buttons.
4. Universal functions retain the same bindings across all applicable platforms.
5. Aircraft, mechs, and ground vehicles have independent movement profiles.
6. Every control has one defined meaning within its active profile.
7. Combat must remain readable during explosions, projectile impacts, and large battles.
8. Destruction must have gameplay consequences rather than being visual decoration only.
9. Customization must offer meaningful trade-offs instead of universally superior builds.
10. Single-player functionality must not depend on multiplayer connectivity.
11. The game must run without downloading external assets or libraries.
12. Stability, accessibility, and responsiveness are requirements, not optional polish.

## 1.3 Target Player Experience

The player should be able to:

- Enter combat within one minute of launching the game.
- Identify enemies and objectives immediately.
- Aim and fire without interrupting movement.
- Change weapons without navigating menus.
- Understand incoming damage and available defensive actions.
- Customize a platform based on a specific combat role.
- Destroy enemy structures and use changing battlefield conditions to their advantage.
- Play alone against NPC forces or cooperate with other players.
- Recover quickly from failure without losing all mission progress.

---

# 2. Scope and Game Modes

## 2.1 Required Game Modes

### A. Training Range

A controlled environment for learning movement, weapons, targeting, and platform-specific systems.

Requirements:

- Stationary and moving targets.
- Friendly-fire toggle.
- Damage and weapon-testing panels.
- Infinite ammunition option.
- Platform switching.
- Key-binding reference.
- Resettable destructible objects.
- No mission failure.

### B. Skirmish

A configurable single-player battle against NPC forces.

Configuration options:

- Small, medium, and large encounter sizes.
- Enemy difficulty.
- Mission duration.
- Starting vehicle and loadout.
- Environment destruction level.
- Friendly support.
- Reinforcement frequency.
- Optional mission modifiers.

### C. Objective Missions

Structured combat missions containing multiple objectives.

Objective examples:

- Eliminate a hostile commander.
- Destroy an ammunition depot.
- Defend a generator.
- Escort a convoy.
- Capture a communications facility.
- Intercept incoming aircraft.
- Survive until extraction.
- Destroy an enemy production facility.

Missions must support primary and optional objectives.

### D. Cooperative Multiplayer

Target: two to four players fighting against NPC forces.

Requirements:

- Players share the same mission and battlefield.
- NPCs can target any valid player.
- Damage, ammunition, deaths, respawns, and destruction remain consistent across connected players.
- Mission completion and failure are coordinated.
- Players can join a lobby before deployment.
- The host can configure the encounter.

### E. Competitive Multiplayer

Optional later expansion.

Possible modes:

- Team deathmatch.
- Objective control.
- Vehicle elimination.
- Team assault.
- PvPvE resource extraction.

Competitive multiplayer must not be considered production-ready until authoritative combat validation, synchronization, and anti-cheat protections have been designed and tested.

---

# 3. Playable Combat Platforms

All platforms share the same targeting, weapon-group, defensive, interaction, and interface conventions wherever those functions exist.

## 3.1 Combat Mechs

Mechs are ground-based combat platforms with independent weapon systems, articulated movement, and configurable armor.

### Mech Classes

**Light mech**
- High acceleration and mobility.
- Lower armor and carrying capacity.
- Scouting, flanking, and interception.
- Shorter cooldowns or improved evasion.

**Medium mech**
- Balanced armor, speed, and weapon capacity.
- General-purpose mission platform.
- Supports multiple weapon combinations.

**Heavy mech**
- High armor and stability.
- Slow acceleration and movement.
- Large energy and heat capacity.
- Heavy weapons and defensive systems.
- Vulnerable to flanking and sustained mobility pressure.

### Movement Requirements

- Forward and backward walking.
- Lateral strafing.
- Turning and direction changes.
- Sprint or boost.
- Jumping.
- Optional jump jets.
- Crouching or reduced stance.
- Landing recovery.
- Collision-aware movement.
- Terrain-aware movement.
- Staggering from sufficiently strong impacts.

Mechs must have clear acceleration, stopping distance, turning limits, and animation feedback. Movement should not feel identical to an aircraft or a ground vehicle.

### Mech Combat Systems

- Primary weapon mount.
- Secondary weapon mount.
- Optional shoulder or utility weapon.
- Shield or defensive subsystem.
- Heat management.
- Armor and subsystem damage.
- Targeting and stabilization modes.
- Melee attack.
- Jump-jet fuel or energy consumption.

## 3.2 Combat Aircraft

Aircraft are fast platforms designed for interception, precision strikes, and aerial support.

### Aircraft Classes

**Interceptor**
- High speed and acceleration.
- Strong air-to-air capabilities.
- Lower armor and limited heavy ordnance.

**Strike fighter**
- Balanced air-to-air and air-to-ground capabilities.
- Multiple guided and unguided weapon configurations.

**Heavy gunship**
- High durability and payload.
- Lower agility.
- Effective against ground targets and large structures.

### Flight Requirements

- Throttle and speed control.
- Pitch, roll, and yaw.
- Acceleration and deceleration.
- Banking and turning.
- Momentum and inertia.
- Airbrakes.
- Afterburner or boost.
- Landing gear.
- Flaps.
- Wheel brakes.
- Countermeasures.
- Radar and sensor modes.
- Aircraft damage and emergency ejection.

### Flight Control Model

The default aircraft control scheme uses assisted mouse flight:

1. Mouse movement defines the desired flight direction or aiming vector.
2. A configurable flight controller steers the aircraft toward that vector.
3. Keyboard controls throttle, rudder, trim, and auxiliary systems.
4. Optional direct-axis controls are available for players who prefer less assistance