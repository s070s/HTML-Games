# IRON HORIZON — End-to-End Implementation Table of Contents

**Purpose:** A sequential implementation roadmap from requirements review through a polished, tested release.

**Source basis:** The supplied IRON HORIZON specification describes the product concept, design principles, game modes, combat mechs, and combat aircraft through the aircraft flight-control model. The supplied file ends during that section. This roadmap preserves those stated requirements and adds the engineering, integration, testing, and release steps needed to turn them into a complete game. Where the supplied specification does not define detailed behavior, the relevant chapter is a design-completion task rather than an assumed settled requirement.

**Core delivery constraint:** One self-contained HTML file, with embedded HTML, CSS, and JavaScript and no required external libraries or downloaded assets. Single-player must function without network access. Real cooperative or competitive multiplayer needs network communication and a session/authority design; that requirement conflicts with a strictly offline, dependency-free single-file runtime unless a networking approach is explicitly approved. This is treated as a decision gate, not silently assumed to be solved.

## Phase 1 — Scope, Feasibility, and Production Plan

1. **Convert the Game Design Document into a Requirements Register**
   - Extract every stated platform, mode, control, combat, customization, world, interface, accessibility, and runtime requirement.
   - Assign each requirement a stable ID, priority, implementation phase, and verification method.
   - Separate mandatory launch requirements from optional future features.
   - Record assumptions and unresolved decisions without presenting them as source-defined facts.

2. **Define the Minimum Complete Release**
   - Select the minimum playable set of mech, aircraft, and ground-vehicle content needed for a representative release.
   - Define a complete playable mission loop: launch, deploy, fight, complete or fail, review results, and restart.
   - Set boundaries for enemy counts, battlefield size, destruction density, and mission length.
   - Establish which features are intentionally deferred rather than exposed as nonfunctional menu items.

3. **Resolve Delivery and Multiplayer Constraints**
   - Define what must work with networking disabled.
   - Decide whether cooperative multiplayer is postponed, provided through an approved external network service, or delivered through a separately hosted transport layer.
   - If multiplayer is approved, specify hosting, discovery, signaling, connectivity, authority, synchronization, reconnection, and failure behavior.
   - Keep online functionality out of the offline core unless its technical requirements are approved.

4. **Complete Missing Platform Specifications**
   - Define the ground combat vehicle classes, movement profiles, weapon mounts, durability, and defensive systems; these details are named by the source but not included in the supplied portion.
   - Define shared behavior across platforms and explicitly document platform-specific exceptions.
   - Specify platform switching, deployment rules, failure and recovery, and whether a mission can include more than one player-controlled platform.
   - Set the launch roster and the measurable differences between classes.

5. **Define Acceptance Targets and Project Milestones**
   - Establish minimum frame-rate, startup, input-response, memory, and stability targets for agreed target devices.
   - Define the supported browsers, desktop/mobile scope, and WebGL requirements.
   - Plan milestones for a playable vertical slice, complete systems, content-complete build, polish, and release candidate.
   - Create a risk register for single-file size, procedural visuals, performance, browser API limits, and multiplayer scope.

## Phase 2 — Application Foundation and Single-File Architecture

6. **Create the Self-Contained HTML Skeleton**
   - Define document metadata, viewport behavior, canvas container, HUD layers, menus, and diagnostic surface.
   - Embed styles and JavaScript in the same file.
   - Prohibit external scripts, stylesheets, fonts, textures, models, sounds, and other runtime downloads.
   - Add a clear first-launch path and a graceful unsupported-browser message.

7. **Define Module Boundaries Inside the File**
   - Establish clear interfaces for bootstrap, renderer, scene, input, simulation, physics, platforms, weapons, damage, AI, missions, UI, audio, settings, and persistence.
   - Keep data definitions separate from update logic and rendering logic.
   - Establish naming, event, error, resource-ownership, and reset conventions.
   - Avoid a single monolithic update function with duplicated behavior across platforms.

8. **Build the Startup and Lifecycle Manager**
   - Initialize browser capabilities and acquire WebGL resources.
   - Initialize input, audio, settings, scene data, and the main menu in a controlled order.
   - Implement loading, ready, active, paused, transitioning, and shutdown lifecycle states.
   - Handle initialization failure and recoverable runtime errors without leaving the interface unusable.

9. **Define Core Data Models and System Contracts**
   - Create consistent data structures for platforms, weapons, projectiles, enemies, missions, objectives, world objects, damage, and settings.
   - Define shared IDs and ownership rules for all world entities.
   - Validate configuration data before it enters the simulation.
   - Establish a single authoritative source for each entity's gameplay state in single-player.

## Phase 3 — Input, Controls, and Platform Profiles

10. **Implement the Input Manager**
    - Normalize keyboard, mouse, pointer, and supported gamepad input into named gameplay actions.
    - Separate raw input sampling from gameplay command handling.
    - Track held, pressed, released, repeated, and cancelled inputs consistently.
    - Prevent duplicate event listeners when menus or missions are restarted.

11. **Define the Shared Control Contract**
    - Keep aiming, primary fire, secondary fire, target selection, weapon switching, interaction, and interface navigation consistent wherever applicable.
    - Define a single meaning for each key or mouse input within the active platform profile.
    - Specify conflict resolution when a key has a platform-specific role.
    - Ensure moving and aiming can occur simultaneously where the platform supports both.

12. **Implement Aiming and Mouse Capture**
    - Implement cursor capture or an alternative aiming mode appropriate to browser support.
    - Convert pointer movement into a stable aiming vector or target direction.
    - Handle cursor release, focus loss, browser restrictions, and re-entry safely.
    - Provide sensitivity, inversion, smoothing, and pointer-lock settings where applicable.

13. **Implement Keyboard and Mouse Combat Actions**
    - Bind movement, firing, weapon switching, targeting, defense, boost, interaction, and pause actions.
    - Support remapping and display current bindings in the controls interface.
    - Prevent browser shortcuts or menu focus from accidentally triggering game actions.
    - Validate simultaneous-input combinations and define behavior for conflicting commands.

14. **Implement Input Settings and Rebinding**
    - Create a rebind flow with conflict detection, cancel, reset-to-default, and invalid-binding handling.
    - Persist valid user settings locally when browser storage is available.
    - Provide sensible defaults and a recovery method if stored settings are corrupt.
    - Ensure all menu operations are keyboard-accessible.

## Phase 4 — Rendering, Camera, and Battlefield Visualization

15. **Initialize the Native WebGL Renderer**
    - Acquire the WebGL context and verify required capabilities.
    - Implement shader compilation, linking, diagnostics, and fallback messaging.
    - Create reusable vertex buffers, index buffers, materials, and draw-state management.
    - Establish depth testing, viewport resizing, canvas scaling, and resource disposal.

16. **Implement Camera Mathematics and Scene Transforms**
    - Create projection, view, world, and object transforms.
    - Support third-person views for ground platforms and an appropriate camera model for aircraft.
    - Avoid abrupt camera motion and prevent camera clipping through solid geometry where practical.
    - Define camera behavior during deployment, combat, platform changes, destruction, defeat, and extraction.

17. **Build the Baseline Battlefield Renderer**
    - Render ground planes, terrain silhouettes, sky or background, structures, simple props, and distant landmarks procedurally.
    - Establish consistent scale, coordinate conventions, and world units.
    - Add readable enemy silhouettes, friendly identification, projectiles, and objective markers.
    - Provide a deterministic fallback visual style that does not require downloaded assets.

18. **Add Lighting, Materials, and Visibility Effects**
    - Implement directional and local lighting within the selected rendering budget.
    - Add material distinctions for metal, armor, glass, concrete, ground, and energy effects.
    - Implement shadows or simplified contact-shadow alternatives where performance permits.
    - Add fog, atmosphere, emissive elements, and restrained explosion lighting.
    - Ensure lighting and effects do not obscure enemy intent, projectiles, or mission-critical UI.

19. **Implement Camera Modes and Combat Readability**
    - Add smooth tracking, aim alignment, distance-based framing, and aircraft view behavior.
    - Define camera shake limits and reduced-motion behavior.
    - Ensure large explosions and groups of enemies do not hide the player or important objectives.
    - Test camera behavior at supported aspect ratios and window sizes.

## Phase 5 — Simulation Loop, World, and Physics

20. **Build the Fixed-Step Simulation Loop**
    - Use `requestAnimationFrame` for presentation and a fixed timestep for simulation.
    - Add a bounded catch-up loop and clamp extreme frame-time deltas.
    - Separate input collection, gameplay simulation, AI, physics, effects, and rendering updates.
    - Handle tab suspension and window focus changes without giant simulation steps.

21. **Implement World Coordinates and Movement Fundamentals**
    - Establish shared vector, transform, distance, and orientation utilities.
    - Implement acceleration, velocity, friction or drag, rotation, and movement limits.
    - Define world bounds, terrain height, collision layers, and spawn validation.
    - Ensure movement profiles can differ without duplicating the entire physics system.

22. **Implement Collision Detection and Response**
    - Add simple primitive collision shapes for platforms, projectiles, structures, and debris.
    - Resolve ground, obstacle, platform-to-platform, and projectile collisions.
    - Avoid tunneling for fast projectiles and high-speed aircraft through suitable time or collision checks.
    - Prevent collision loops, persistent overlap, and entities trapped inside geometry.

23. **Implement Entity Lifetime and Resource Management**
    - Define creation, activation, deactivation, destruction, and cleanup rules.
    - Pool frequently reused projectiles, particles, and debris when beneficial.
    - Bound active effects and transient entities.
    - Release graphics and audio resources during mission transitions and restarts.

## Phase 6 — Combat Mech Implementation

24. **Create the Shared Platform Interface**
    - Define common platform fields for health, armor, movement, aiming, weapons, defenses, interaction, and destruction.
    - Specify common calls for input, update, firing, damage, death, respawn, and HUD reporting.
    - Keep class-specific behavior behind platform-profile data and specialized controller logic.
    - Test adding a new platform without rewriting shared combat systems.

25. **Implement Light, Medium, and Heavy Mech Profiles**
    - Define acceleration, top speed, turning, stability, armor, payload, and energy or heat capacity.
    - Apply the intended light-mech scouting and flanking role.
    - Apply the intended medium-mech general-purpose role.
    - Apply the intended heavy-mech durability and heavy-weapon role with reduced mobility.
    - Check that each role offers trade-offs instead of one universally superior configuration.

26. **Implement Mech Locomotion**
    - Add forward/backward movement, lateral strafing, turning, direction changes, and stopping distance.
    - Implement sprint or boost, jump, optional jump jets, and crouching or reduced stance.
    - Add landing recovery, collision-aware motion, terrain-aware motion, and impact staggering.
    - Keep acceleration and movement feedback distinct from aircraft and ground vehicles.

27. **Implement Mech Aiming and Stabilization**
    - Separate body facing from weapon aiming where the design supports it.
    - Implement target direction, aiming limits, and stabilization modes.
    - Keep reticle behavior consistent with projectile trajectories and hit detection.
    - Provide feedback when a target is outside effective weapon range or line of sight.

28. **Implement Mech Systems and Damage**
    - Add primary and secondary mounts plus optional shoulder or utility mounts.
    - Add shield or defensive subsystem behavior.
    - Add heat generation, heat capacity, cooling, and overheat consequences.
    - Implement armor and subsystem damage, melee attacks, and jump-jet fuel or energy consumption.
    - Define recovery behavior when a subsystem is disabled or the mech is destroyed.

29. **Build Mech Animation and Movement Feedback**
    - Create procedural or embedded-free articulated body parts and joint transforms.
    - Add locomotion, turning, boost, jump, landing, melee, firing, recoil, hit, stagger, and destruction poses.
    - Add foot placement or simplified gait correction for uneven terrain.
    - Prevent animation from changing gameplay collision or hit timing unpredictably.

## Phase 7 — Combat Aircraft Implementation

30. **Implement Aircraft Class Profiles**
    - Define interceptor speed and air-to-air strengths with limited heavy ordnance.
    - Define strike-fighter balance between air-to-air and air-to-ground missions.
    - Define heavy-gunship payload and durability against reduced agility.
    - Configure handling, health, weapon mounts, sensor capability, and countermeasures through data.

31. **Implement Assisted Mouse Flight**
    - Convert mouse input into a desired flight direction or aiming vector.
    - Implement a configurable flight controller that steers toward the requested direction.
    - Add sensitivity, response curves, stabilization, and optional direct-axis control.
    - Keep aiming response understandable while the aircraft is turning and changing speed.

32. **Implement Flight Dynamics**
    - Add throttle, speed, acceleration, deceleration, pitch, roll, yaw, banking, and momentum.
    - Add airbrakes and afterburner or boost.
    - Set safe operational limits and define stall or loss-of-control behavior if included in scope.
    - Ensure aircraft handling differs meaningfully by class without requiring full real-world simulation.

33. **Implement Aircraft Ground and Auxiliary Systems**
    - Add landing gear, flaps, wheel brakes, and ground handling at a documented simulation level.
    - Add radar and sensor modes.
    - Add countermeasures and define which threats they affect.
    - Implement aircraft damage, emergency ejection, and post-ejection player state if included in the mission design.

34. **Implement Aircraft Combat Feedback and Camera**
    - Align the reticle, weapon direction, and flight-controller target vector.
    - Add banking cues, speed indicators, warning indicators, and threat feedback.
    - Keep target information readable during rapid maneuvering.
    - Test aiming, firing, and turning simultaneously.

## Phase 8 — Ground Combat Vehicles and Platform Switching

35. **Finalize Ground Vehicle Design Before Implementation**
    - Specify classes and roles because the supplied file names ground combat vehicles but does not include their detailed section.
    - Define steering, throttle, braking, reverse, traction, turning radius, suspension approximation, and terrain limits.
    - Define armor, weapon mounts, defenses, damage states, and vehicle destruction.
    - Decide whether wheeled, tracked, and hovering vehicles are launch requirements or later additions.

36. **Implement Ground Vehicle Movement and Handling**
    - Add acceleration, reverse, steering, braking, momentum, and collision response.
    - Implement terrain slope and obstacle handling at the selected fidelity.
    - Prevent vehicles from clipping through terrain or becoming permanently wedged.
    - Add movement sound and visual feedback tied to actual vehicle state.

37. **Implement Vehicle Combat and Damage**
    - Connect ground-vehicle weapon mounts to the shared weapon system.
    - Implement target alignment, stabilization, defenses, armor, and subsystem effects as specified by the completed design.
    - Add destruction, disabled, and recovery states.
    - Verify that vehicle behavior is consistent with the shared targeting and combat contract.

38. **Implement Platform Selection and Deployment**
    - Create the platform selection screen and loadout summary.
    - Validate mission, terrain, and weapon compatibility before deployment.
    - Define in-mission switching rules, restrictions, cooldowns, and transition effects if switching is supported during combat.
    - Preserve or reset health, ammunition, damage, and mission state according to explicit rules.

## Phase 9 — Weapons, Targeting, and Combat Resolution

39. **Create Data-Driven Weapon Definitions**
    - Define weapon IDs, platform compatibility, weapon groups, fire type, cooldown, ammunition, range, spread, projectile speed, and reload rules.
    - Define damage, blast radius, heat or energy use, recoil, effects, audio, and impact behavior.
    - Support configuration-based tuning instead of duplicating logic in input handlers.
    - Validate all weapon values and limits before gameplay begins.

40. **Implement Primary and Secondary Fire**
    - Add single-shot, automatic, burst, charged, and guided fire patterns only where needed by the chosen launch roster.
    - Handle held fire, pressed fire, release-to-fire, reload, cooldown, and ammunition exhaustion distinctly.
    - Add projectile spawning, muzzle direction, recoil, and fire-rate caps.
    - Ensure firing remains responsive while moving and aiming.

41. **Implement Projectiles and Hit Resolution**
    - Add projectile movement, collision, impact location, and lifetime.
    - Implement direct-hit and area damage with clearly defined falloff.
    - Resolve one intended damage event per collision and prevent duplicate impact damage.
    - Add line-of-sight and target-validity checks for guided weapons where applicable.

42. **Implement Target Selection and Sensor Feedback**
    - Add target acquisition, target cycling, target retention, and target loss behavior.
    - Define friendly, hostile, neutral, and objective identification.
    - Add range, line-of-sight, lock state, and target threat cues.
    - Ensure sensors do not expose information that the selected game mode is intended to hide.

43. **Implement Defense, Countermeasures, and Resource Costs**
    - Implement shields, defensive abilities, and countermeasures as platform-compatible systems.
    - Define cooldown, ammunition, energy, heat, and duration rules for each ability.
    - Show available charges and cooldowns clearly.
    - Ensure defense counters defined threats without guaranteeing unconditional immunity.

44. **Implement Damage, Armor, and Destruction States**
    - Define damage application order across shields, armor, subsystems, and health.
    - Add hit direction, penetration or resistance rules, and explosive damage falloff as needed.
    - Implement disabled, critical, destroyed, and recovery states with valid transitions.
    - Clamp health, armor, heat, ammunition, and other resources to valid ranges.

45. **Implement Weapon Balance and Combat Readability**
    - Tune travel time, accuracy, rate of fire, damage, cooldowns, and resource costs.
    - Ensure each weapon role has a clear advantage and limitation.
    - Make outgoing and incoming damage understandable through reticles, impact cues, sounds, and HUD information.
    - Verify combat clarity in small duels and large encounters.

## Phase 10 — Enemy AI, Friendly Support, and Encounter Logic

46. **Create the AI State and Decision Model**
    - Define perception, target evaluation, tactics, action selection, movement, attack, defense, retreat, and recovery states.
    - Use observable world state and reaction delays rather than future player input.
    - Separate decisions from low-level movement and combat execution.
    - Add cooldowns and safeguards against indecisive state oscillation.

47. **Implement Enemy Perception and Targeting**
    - Evaluate distance, line of sight, threat, platform type, health, ammunition, and objective status.
    - Select valid player, friendly, or mission targets according to encounter rules.
    - Support target reacquisition after obstruction, destruction, or death.
    - Make perception limits and reaction behavior configurable by difficulty.

48. **Implement AI Movement and Navigation**
    - Approach, retreat, flank, circle, pursue, and maintain preferred engagement distance.
    - Avoid terrain hazards and navigate around structures and debris.
    - Provide fallback behavior when a route is blocked.
    - Use a navigation approach appropriate to a browser-scale game and the selected battlefield dimensions.

49. **Implement Enemy Combat Tactics**
    - Select weapon and attack options according to distance, line of sight, and platform capabilities.
    - Manage cooldowns, heat, ammunition, defenses, boost, and countermeasures.
    - Add retreat, repositioning, and low-resource behavior.
    - Make enemy decisions legible through movement, aiming, warnings, and attack telegraphs.

50. **Implement Difficulty and Enemy Archetypes**
    - Define enemy classes, roles, loadouts, health, accuracy, reaction delay, aggression, and tactical quality.
    - Scale decision quality and encounter composition rather than relying only on inflated health.
    - Validate that difficulty levels are meaningfully different and fair.
    - Test mixed encounters containing ground units, mechs, and aircraft.

51. **Implement Friendly Support and Reinforcements**
    - Define allied targeting, formation or follow behavior, damage attribution, and defeat behavior.
    - Implement reinforcement scheduling and spawn validation.
    - Prevent enemies or allies from spawning inside obstacles or immediately beside the player without design intent.
    - Ensure support units do not block objectives, trap the player, or dominate the mission automatically.

## Phase 11 — Destructible Battlefield and Environmental Consequences

52. **Define Destructible Object Data**
    - Define each object's ID, material, durability, impact resistance, damage multipliers, and structural state.
    - Define collision shapes, breakable sections, debris rules, effects, sounds, and cleanup policy.
    - Separate indestructible navigation-critical geometry from destructible props and structures.
    - Validate that each destructible object has explicit damage and reset behavior.

53. **Implement Progressive Damage States**
    - Add intact, damaged, critically damaged, destroyed, debris-settling, and cleanup states as appropriate.
    - Show damage before destruction with cracks, scorch marks, deformation, broken panels, or procedural overlays.
    - Apply attack- and material-specific damage.
    - Prevent repeated hits in the same simulation step from triggering duplicate break events.

54. **Implement Structure and Prop Destruction**
    - Support breakable panels, barriers, crates, facility components, and other approved object classes.
    - Replace intact collision geometry when a section breaks.
    - Spawn bounded fragments or simplified debris rather than attempting unrestricted arbitrary mesh fracture.
    - Ensure destruction changes cover, routes, visibility, or objective state when intended.

55. **Implement Debris Physics and Cleanup**
    - Add simplified impulses, gravity, collision, drag, and resting behavior.
    - Put settled fragments to sleep and remove expired or unimportant debris safely.
    - Enforce maximum debris and particle counts with pooling or reuse.
    - Ensure debris cannot permanently trap the player or block a required mission path.

56. **Connect Environmental Damage to Combat and Missions**
    - Apply collision and explosion damage to nearby structures according to defined rules.
    - Allow environmental destruction to affect cover and accessible routes.
    - Connect designated destruction targets to mission objectives.
    - Ensure AI, camera, audio, and HUD respond to major destruction events.

57. **Implement Battlefield Reset and Deterministic Recovery**
    - Save baseline states for destructible objects and mission-specific world changes.
    - Restore objects, collision, debris, and objectives when restarting or replaying a mission.
    - Test interrupted destruction, chained impacts, and repeated mission resets.
    - Prevent stale world entities from carrying over between sessions.

## Phase 12 — Battlefield, Objectives, and Mission Flow

58. **Build the Battlefield Scene Framework**
    - Define terrain, boundaries, spawn locations, structures, points of interest, cover, and encounter zones.
    - Add ground routes, aerial spaces, altitude constraints, and movement boundaries for each platform type.
    - Define visibility, lighting, destruction density, and ambient effects per battlefield.
    - Ensure objectives remain navigable and identifiable after extensive destruction.

59. **Implement Objective Types**
    - Add eliminate-target, destroy-depot, defend-generator, escort-convoy, capture-facility, intercept-aircraft, survive-to-extraction, and destroy-production-facility objectives.
    - Define activation conditions, progress, completion, failure, optional status, and reward or result data.
    - Support dependencies between primary and optional objectives.
    - Give each objective clear world markers and status text.

60. **Implement Mission Director and Encounter Scheduling**
    - Spawn enemies and reinforcements based on mission state and encounter configuration.
    - Coordinate simultaneous objectives, waves, timers, and extraction events.
    - Avoid spawn points blocked by geometry or active combat.
    - Make the mission state recoverable after player death, pause, or a recoverable runtime error.

61. **Implement Mission Success, Failure, and Restart**
    - Define win and loss conditions for every objective type.
    - Handle player destruction, mission timer expiry, protected-unit loss, and objective failure.
    - Create mission results and a clear next action: retry, return to menu, or continue.
    - Restore mission state cleanly on restart.

62. **Build Training Range**
    - Add stationary and moving targets, platform switching, and a key-binding reference.
    - Add damage and weapon-testing panels and an infinite-ammunition option.
    - Add a friendly-fire toggle and resettable destructible objects.
    - Disable mission failure and ensure training changes do not leak into other modes.

63. **Build Skirmish Mode**
    - Add small, medium, and large encounter configurations.
    - Expose difficulty, mission duration, starting platform and loadout, destruction level, friendly support, reinforcement frequency, and approved mission modifiers.
    - Validate configuration before battle starts.
    - Ensure each configuration produces a complete, repeatable match.

64. **Build Objective Missions**
    - Implement mission selection, briefing, primary and optional objectives, deployment, encounter progress, extraction, and results.
    - Add a representative mission for each required objective type.
    - Verify objective dependencies and failure handling.
    - Test missions with each supported combat platform.

## Phase 13 — Loadouts, Customization, and Persistence

65. **Implement Platform Loadout Construction**
    - Define compatible mounts, weapon weight or capacity, energy or heat demands, and restrictions.
    - Add primary, secondary, and utility configuration where the platform supports it.
    - Validate all loadouts before deployment.
    - Communicate the trade-offs among mobility, durability, firepower, and resource capacity.

66. **Implement Unlocks and Progression Only After Scope Approval**
    - Decide whether launch progression includes unlocks, persistent inventory, mission rewards, or only freely configurable loadouts.
    - If progression is included, define earning rules, prerequisites, persistence, and reset behavior.
    - Avoid presenting unapproved progression systems as mandatory requirements.
    - Ensure progression never prevents access to the core playable loop during testing.

67. **Implement Local Save Data and Settings Persistence**
    - Store only the approved settings and progress data using available browser storage.
    - Version saved data and validate it on load.
    - Recover from missing, malformed, or outdated save data.
    - Provide reset controls and explain what data will be removed.

## Phase 14 — User Interface and Player Information

68. **Build the Main Menu and Navigation Flow**
    - Add launch, Training Range, Skirmish, Objective Missions, platform selection, controls, settings, and credits.
    - Show cooperative or competitive options only if their required infrastructure is available in the build.
    - Provide consistent back, cancel, focus, and confirmation behavior.
    - Ensure no visible menu action leads to an unimplemented or broken screen.

69. **Build the Deployment and Loadout Interfaces**
    - Display platform class, role, strengths, limitations, weapons, defenses, and resource systems.
    - Allow valid loadout changes and reject incompatible configurations with clear reasons.
    - Provide a briefing and configuration summary before deployment.
    - Preserve settings when navigating between selection screens unless the player changes them.

70. **Build the Combat HUD**
    - Show health, armor or shields, ammunition, weapon status, heat or energy, and relevant cooldowns.
    - Add reticle, target identity, target distance, threat warnings, and objective markers.
    - Show mission progress, timers, reinforcements, and teammate state where applicable.
    - Scale and reposition elements for supported resolutions and aspect ratios.

71. **Build Pause, Results, and Recovery Screens**
    - Add resume, restart mission, controls, settings, and return-to-menu flows.
    - Freeze gameplay simulation correctly while paused.
    - Present mission outcome, objectives completed, and relevant combat statistics.
    - Confirm destructive or progress-resetting actions where appropriate.

72. **Implement UI Feedback and Onboarding**
    - Show hit confirmations, incoming damage, low health, low ammunition, overheating, target locks, and subsystem failures.
    - Provide a concise first-session tutorial and contextual control hints.
    - Use consistent icons, text, color, and non-color cues.
    - Keep feedback brief enough to avoid covering the battle.

## Phase 15 — Audio, Effects, and Presentation Polish

73. **Implement the Local Audio Engine**
    - Create a Web Audio-based mixer and audio lifecycle manager.
    - Respect user-gesture requirements before starting sound.
    - Define master, music, effects, and interface volume settings.
    - Handle audio context suspension, resumption, and cleanup safely.

74. **Implement Combat and Environmental Sound**
    - Add or synthesize weapon fire, projectile launches, impacts, explosions, movement, boosting, alarms, and destruction sounds.
    - Differentiate weapon classes and materials through sound where possible.
    - Add UI, mission, warning, and result sounds.
    - Prevent audio spam with limits, pooling, prioritization, and cooldowns.

75. **Implement Music and Spatial Cues**
    - Add locally embedded or procedurally generated music where appropriate to the file-size target.
    - Provide audio cues for enemy warnings, target locks, damage direction, objective changes, and critical systems.
    - Ensure sound cues do not substitute for necessary visual indicators.
    - Confirm all volume settings affect the intended channels.

76. **Polish Combat Effects**
    - Add muzzle flashes, projectile trails, sparks, shield impacts, explosions, smoke, dust, and hit effects.
    - Scale effects by weapon strength and impact type.
    - Add restrained camera shake and short impact emphasis where readable.
    - Cap particles, transparency overdraw, and simultaneous large effects.

77. **Polish Models, Materials, and Animation**
    - Improve silhouettes, proportions, joints, surface variation, emissive details, and team identification.
    - Refine mech movement, aircraft banking, ground-vehicle motion, weapon recoil, hit response, destruction, and transitions.
    - Add consistent lighting and material quality across every platform class.
    - Test visual clarity at gameplay camera distance rather than only in close-up views.

78. **Apply Final User Experience Polish**
    - Add transitions, loading feedback, focus states, menu sounds, clear warnings, and consistent typography.
    - Remove debug overlays from normal release mode while preserving a diagnostic option.
    - Eliminate placeholder art and nonfunctional controls from the release path.
    - Check that the game teaches controls and communicates mission goals without requiring external documentation.

## Phase 16 — Cooperative and Competitive Multiplayer Decision Track

79. **Choose the Approved Multiplayer Architecture**
    - Define the networking constraint and deployment model before implementing multiplayer UI.
    - Specify peer discovery, lobby ownership, transport, session identity, version compatibility, and reconnection.
    - Define the authoritative owner of combat, mission, damage, ammunition, respawn, and destruction state.
    - Keep offline single-player functional when no session can be created.

80. **Implement Cooperative Lobby and Deployment**
    - Add a two-to-four-player lobby only after a valid networking path is approved.
    - Implement ready status, host encounter settings, platform and loadout selection, and deployment validation.
    - Handle players joining, leaving, timing out, and failing to connect.
    - Provide useful errors and return paths when connection setup fails.

81. **Synchronize Cooperative Simulation**
    - Define ownership and update rates for players, NPCs, projectiles, damage, ammunition, destruction, objectives, and respawns.
    - Resolve latency, duplicate events, out-of-order updates, and conflicting destruction events.
    - Test deterministic or authoritative mission completion and failure.
    - Recover from host or peer disconnect according to the approved session model.

82. **Validate Multiplayer Security and Reliability**
    - Validate player commands and damage on the designated authority.
    - Prevent clients from unilaterally deciding authoritative health, ammunition, rewards, or mission outcomes.
    - Test abuse cases, malformed messages, replayed events, and version mismatch.
    - Do not label multiplayer production-ready before synchronization and security acceptance tests pass.

83. **Treat Competitive PvP as a Separate Release Gate**
    - Define team deathmatch, objective control, vehicle elimination, team assault, or PvPvE extraction only if approved.
    - Specify anti-cheat boundaries, authoritative combat, team balancing, match lifecycle, and disconnect handling.
    - Run latency, fairness, exploit, and synchronization tests.
    - Keep PvP optional and out of the initial completion criteria unless explicitly promoted into launch scope.

## Phase 17 — Accessibility, Compatibility, Performance, and Reliability

84. **Implement Accessibility Options**
    - Provide remappable controls, adjustable sensitivity, and relevant inversion or flight-assistance options.
    - Add adjustable audio levels, UI scale, and reduced-motion settings.
    - Provide color-independent alerts and readable contrast.
    - Ensure menus and settings can be operated using keyboard-only input.

85. **Implement Responsive Layout and Device Handling**
    - Support window resizing and the approved desktop and mobile viewport range.
    - Handle device-pixel ratio and rendering resolution within a bounded budget.
    - Adjust HUD scale and canvas size without changing simulation state.
    - Verify behavior when focus is lost, the tab is hidden, or the window is restored.

86. **Optimize Rendering and Simulation**
    - Reuse geometry and materials and reduce unnecessary draw calls.
    - Add frustum culling and distance-based detail reduction where needed.
    - Scale effects, shadows, render resolution, debris, and AI update frequency to device capability.
    - Avoid avoidable allocations in high-frequency simulation paths.

87. **Set Budgets for Memory and Active Entities**
    - Bound enemy counts, projectiles, particles, sound voices, debris, and transient effects.
    - Reuse pooled objects and release resources when scenes change.
    - Measure memory during repeated missions and long combat sessions.
    - Ensure optimization never silently removes essential gameplay feedback.

88. **Implement Reliability and Browser Recovery**
    - Handle missing WebGL support, shader failures, audio restrictions, storage failures, and unexpected exceptions.
    - Support WebGL context loss and restoration where feasible.
    - Prevent invalid numeric values from corrupting the simulation.
    - Provide diagnostics that identify the failure without exposing unusable stack traces to ordinary players.

## Phase 18 — Verification, Balance, and Release

89. **Create Automated Unit and System Checks**
    - Test math utilities, resource clamps, collision helpers, damage calculations, cooldowns, and state transitions.
    - Test configuration validation for platforms, weapons, missions, and destructible objects.
    - Test lifecycle initialization, pause, restart, and cleanup.
    - Add repeatable regression checks for previously fixed failures.

90. **Test Controls Across Every Platform Profile**
    - Verify simultaneous movement, aiming, firing, defense, and weapon switching.
    - Verify mouse capture, pause, focus loss, and remapped controls.
    - Test assisted and direct-axis aircraft controls.
    - Test ground movement, mech jump/boost, and platform-specific systems against the final control reference.

91. **Test Combat and Damage Rules**
    - Verify weapon cooldowns, ammunition, projectile collisions, direct and area damage, and target validity.
    - Verify shield, armor, subsystem, heat, countermeasure, and destruction transitions.
    - Test edge cases involving simultaneous impacts, multiple attackers, and destroyed targets.
    - Verify every HUD indicator agrees with the underlying combat state.

92. **Test AI and Encounter Quality**
    - Verify enemy perception, target selection, navigation, attacks, defenses, retreat, and recovery.
    - Test all difficulty settings and mixed-platform encounters.
    - Test reinforcements, allied support, and blocked routes.
    - Confirm AI does not act on future player input or become stuck in repeated decision loops.

93. **Test Destruction and Mission Integrity**
    - Verify progressive damage, break thresholds, collision replacement, debris limits, and cleanup.
    - Test chained explosions, repeated impacts, and resets during or after destruction.
    - Confirm required paths and objectives remain reachable.
    - Verify objective success, optional objectives, failure conditions, extraction, and restart.

94. **Run Performance and Long-Session Tests**
    - Profile startup, ordinary combat, large battles, explosions, and high-destruction scenes.
    - Test on the minimum and recommended device/browser matrix.
    - Measure frame-time spikes, input latency, memory growth, and resource leaks.
    - Repeat missions and scene transitions to catch cumulative failures.

95. **Run Usability and Accessibility Review**
    - Verify that a new player can start combat quickly and identify objectives and controls.
    - Check readable target, objective, warning, and damage feedback during visually busy encounters.
    - Test keyboard-only menus, reduced motion, volume controls, UI scale, and color-independent cues.
    - Remove confusing, redundant, or inactive UI elements.

96. **Complete Release Candidate Verification**
    - Test the HTML file from a clean local copy with network access disabled.
    - Confirm all code, styles, and required assets are embedded and all visible controls work.
    - Run the full acceptance matrix and resolve all release-blocking defects.
    - Verify restart, settings persistence, error reporting, and long-session stability.

97. **Package and Document the Final Release**
    - Deliver the final single HTML file with no required build step or network dependency for single-player.
    - Include concise controls, supported-browser notes, limitations, and troubleshooting information in the game or accompanying release notes as appropriate.
    - Record the verified browser/device matrix and known limitations.
    - Mark deferred features explicitly rather than presenting them as completed.

## Phase 19 — Definition of Done and Final Quality Gate

98. **Verify the Complete Single-Player Loop**
    - The player can launch the game, select a platform and configuration, deploy, fight, complete or fail a mission, view results, and restart.
    - Training Range, Skirmish, and Objective Missions operate according to their implemented specifications.
    - Combat, targeting, defenses, platform movement, and damage are consistent across applicable platforms.

99. **Verify Content and System Completeness**
    - Every launch platform has a defined movement model, loadout, weapon behavior, damage behavior, and feedback.
    - Every exposed objective type and supported mission mode has been tested.
    - Destruction has visible stages, collision consequences, bounded debris, and reliable reset behavior.
    - All controls and menu items have working, validated outcomes.

100. **Verify Performance, Reliability, and Packaging**
     - The agreed performance targets are met on the supported device matrix or deviations are documented and accepted.
     - No known release-blocking errors, resource leaks, or mission softlocks remain.
     - The standalone HTML release runs without external downloads for offline single-player.
     - Multiplayer claims match the actual approved and tested implementation.

101. **Approve Release or Return to the Relevant Phase**
     - Review acceptance-test results and unresolved risks.
     - Reject release if a critical combat, mission, control, stability, or packaging requirement fails.
     - Fix issues at the owning phase and rerun affected regression tests.
     - Publish the release only after the required quality gate passes.

## Appendices — Implementation References

A. **Requirements Traceability Matrix** — Requirement ID, source statement, priority, implementation phase, test case, and completion status.

B. **Scope and Decision Register** — Open design questions, assumptions, approved resolutions, and deferred features.

C. **Control Map** — Shared actions, mouse behavior, keyboard bindings, per-platform differences, remapping rules, and conflict resolution.

D. **Platform Profile Schema** — Mech, aircraft, and ground-vehicle statistics, movement parameters, mounts, defenses, and failure states.

E. **Weapon Data Schema** — Weapon class, compatibility, firing model, damage, resources, cooldowns, projectile properties, feedback, and balance values.

F. **Damage and Resource Rules** — Health, armor, shields, heat, energy, ammunition, subsystem damage, and state transitions.

G. **AI State and Difficulty Matrix** — Perception, reactions, tactics, navigation, archetypes, difficulty, and encounter rules.

H. **Destructible Object Schema** — Materials, durability, damage stages, collision replacement, debris limits, effects, and reset rules.

I. **Mission and Objective Schema** — Activation, dependencies, primary/optional classification, progress, success, failure, extraction, and restart.

J. **UI Screen and HUD Inventory** — Screens, navigation paths, field definitions, warnings, responsive behavior, and accessibility requirements.

K. **Performance and Compatibility Matrix** — Supported browsers and devices, frame-rate goals, memory limits, effect budgets, and test conditions.

L. **Verification and Release Checklist** — Unit, system, gameplay, usability, compatibility, performance, offline packaging, and final approval checks.
