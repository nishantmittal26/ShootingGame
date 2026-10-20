# Tasks: Rail Shooter

**Feature**: `001-rail-shooter` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Phases are ordered so the game is loadable and observable after every one, per
constitution Principle I. `[P]` marks tasks with no dependency on their phase siblings.

## Phase 1: Project setup

- [ ] T001 Create `package.json` with vite 7, typescript 5, three 0.185.1, @types/three 0.185.3, and `dev`/`build`/`preview`/`typecheck` scripts
- [ ] T002 [P] Create `tsconfig.json` in strict mode, ES2022, bundler resolution, `noUnusedLocals`, `noFallthroughCasesInSwitch`
- [ ] T003 [P] Create `vite.config.ts` and `.gitignore`
- [ ] T004 Create `index.html` with a full-viewport canvas, a HUD overlay skeleton, screen containers, and embedded styles
- [ ] T005 [P] Write `README.md` covering install, run, controls, and project layout
- [ ] T006 Run `npm install` and confirm the dependency tree resolves

## Phase 2: Core loop

- [ ] T007 `src/types.ts`: shared unions (`EnemyKind`, `PowerUpKind`, `ProjectileOwner`, `Formation`, `BossPhase`) and shared interfaces
- [ ] T008 [P] `src/config/tuning.ts`: every balance constant from the data model, grouped by subject
- [ ] T009 [P] `src/core/mathUtils.ts`: segment-sphere intersection, exponential damping, clamp, module-level scratch vectors
- [ ] T010 [P] `src/core/Pool.ts`: generic pool with `acquire`, `release`, `forEachActive`, and a pre-warm on construction
- [ ] T011 [P] `src/core/Input.ts`: keydown/keyup state map, mouse button state, edge-triggered action queries, blur reset
- [ ] T012 `src/core/GameState.ts`: state union and transition resolution with a `never`-checked default
- [ ] T013 `src/main.ts`: renderer with capped pixel ratio, scene, perspective camera, lighting, resize handling, hand off to `Game`
- [ ] T014 `src/core/Game.ts`: fixed 1/60 accumulator with a per-frame clamp, system ownership, update order per the plan
- [ ] T015 Verify: page loads, renders a lit empty scene, and the loop ticks without error

## Phase 3: World and progression

- [ ] T016 [P] `src/world/Sky.ts`: gradient sky dome with an exponential fog colour match
- [ ] T017 `src/world/Terrain.ts`: tiled ground strip that recycles tiles past the cull plane, with lateral variation so motion reads
- [ ] T018 [P] `src/world/Clouds.ts`: recycling cloud props at varied altitude and depth for parallax
- [ ] T019 `Game`: accumulate `distanceTravelled` from scroll speed and expose run state
- [ ] T020 Verify: the world scrolls smoothly, tiles recycle with no visible seam or pop, distance climbs

## Phase 4: Player

- [ ] T021 [P] `src/models/playerModel.ts`: low-poly plane factory with fuselage, wings, tail, and canopy
- [ ] T022 `src/entities/Player.ts`: envelope-bounded movement with acceleration and damping, bank on lateral input, pitch on vertical
- [ ] T023 `Game`: chase camera that trails with lerp and applies look-ahead opposite the input
- [ ] T024 `src/entities/Projectile.ts` and pool wiring: shared geometry and material, integrate with previous-position tracking
- [ ] T025 `src/systems/WeaponSystem.ts`: cadence gating, tier-driven shot patterns, muzzle origin from the model
- [ ] T026 Verify: the plane steers with weight, clamps at the envelope edge, and fires tracers at a capped rate

## Phase 5: Enemies

- [ ] T027 [P] `src/models/enemyPlaneModel.ts`: swept-wing hostile silhouette, visually distinct from the player
- [ ] T028 [P] `src/models/helicopterModel.ts`: body, tail boom, and spinning main and tail rotors
- [ ] T029 `src/entities/Enemy.ts`: per-kind behaviour, sine weave with per-instance phase for planes, altitude-holding hover for helicopters
- [ ] T030 `Enemy` firing: lead prediction against player envelope velocity, burst cadence, kind-specific projectile speed
- [ ] T031 `src/systems/SpawnSystem.ts`: wave-table cursor keyed to distance, formation placement, spawn ahead, cull behind
- [ ] T032 `src/config/levelOne.ts`: route length plus the full wave table with an escalating curve
- [ ] T033 Verify: waves arrive on schedule in formation, both kinds move distinctly, enemy fire is visible and leads the player

## Phase 6: Damage resolution

- [ ] T034 `src/systems/CollisionSystem.ts`: swept-sphere projectile tests, body-to-body sphere tests, correct owner filtering
- [ ] T035 Damage application: health reduction, shield absorption ordering, post-hit invulnerability window, death detection
- [ ] T036 `Game`: score and kill accrual, and the transition to `gameOver` when player health is exhausted
- [ ] T037 Verify: fast shots cannot tunnel through enemies, enemy fire kills the player, ramming damages both parties

## Phase 7: Powers

- [ ] T038 [P] `src/models/powerUpModel.ts`: kind-coloured pickup with a readable shape and emissive tint
- [ ] T039 `src/entities/PowerUp.ts`: pooled pickup with bob and spin, magnet steering toward a nearby player
- [ ] T040 `src/systems/PowerUpSystem.ts`: drop roll on kill by enemy kind, collection detection, effect application via exhaustive switch, timed expiry
- [ ] T041 `WeaponSystem`: honour weapon tier, rapid-fire multiplier, and the homing missile secondary with ammunition
- [ ] T042 Verify: each of the five kinds drops, collects, and produces an identifiable change

## Phase 8: Boss and finish

- [ ] T043 [P] `src/models/bossModel.ts`: large gunship with visible turret mounts
- [ ] T044 `src/entities/Boss.ts`: phase transitions on health thresholds, per-phase attack patterns, destructible turrets
- [ ] T045 `src/world/FinishGate.ts`: gate that stays closed until the boss dies, then approaches and can be crossed
- [ ] T046 `Game`: boss spawn at route end, victory transition on gate crossing
- [ ] T047 Verify: the boss spawns once, changes behaviour as it is worn down, gates the finish, and death opens the route

## Phase 9: Interface

- [ ] T048 `src/ui/Hud.ts`: health, shield, weapon tier, timed power pips with drain, missile count, score, progress bar, boss health bar
- [ ] T049 `src/ui/Screens.ts`: title, pause, game over, and victory screens with restart, driven by the state machine
- [ ] T050 `Game`: wire pause and restart input, and reset all run state cleanly on restart
- [ ] T051 Verify: HUD tracks state accurately, pause halts the simulation, restart produces a clean run with no leaked entities

## Phase 10: Feel

- [ ] T052 `src/systems/EffectsSystem.ts`: pooled particles for muzzle flash, impact sparks, and explosion bursts
- [ ] T053 Camera shake with decay, plus a damage vignette flash on the overlay
- [ ] T054 `src/systems/AudioSystem.ts`: synthesized fire, hit, explosion, pickup, and alarm cues with a mute toggle
- [ ] T055 Verify: every significant event has matching visual and audible confirmation

## Phase 11: Acceptance

- [ ] T056 `npm run typecheck` clean
- [ ] T057 `npm run build` clean
- [ ] T058 Playthrough against every acceptance scenario in the spec; record observed behaviour
- [ ] T059 Confirm no console errors and no allocation growth across a sustained run

## Dependencies

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7
                                                             \-> Phase 8
Phases 9, 10 depend on 6 for the events they present
Phase 11 depends on all
```

## Story coverage

| Spec story | Tasks |
|------------|-------|
| US1 Fly and shoot | T021-T026, T027-T031, T034 |
| US2 Survive fire | T030, T034-T037, T048 |
| US3 Gain powers | T038-T042 |
| US4 Race to finish | T017-T019, T031-T032, T045-T046, T048 |
| US5 Boss | T043-T047 |
