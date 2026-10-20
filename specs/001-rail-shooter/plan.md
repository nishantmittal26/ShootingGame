# Implementation Plan: Rail Shooter

**Branch**: `001-rail-shooter` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-rail-shooter/spec.md`

## Summary

Build a browser rail shooter in three.js: a chase-cam player plane flies a fixed route,
fights distance-keyed waves of enemy planes and helicopters that shoot back, collects
powers dropped from kills, defeats a phased boss, and crosses a finish line. The core
technical bet is that the player stays near the world origin while the world scrolls past
it, with a single scalar tracking route progress. Gameplay runs on a fixed 60Hz
accumulator so outcomes are refresh-rate independent, and all high-churn objects come
from pools so steady-state play does not allocate.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, ES2022 target

**Primary Dependencies**: three 0.185.1 (r185), @types/three 0.185.3, vite 7.x

**Storage**: N/A. No persistence; score is per-run and in memory only.

**Testing**: Type check via `tsc --noEmit`, production build via `vite build`, plus
manual in-browser playthrough against the spec's acceptance scenarios.

**Target Platform**: Desktop browsers with WebGL2 and Web Audio (Chrome, Edge, Firefox)

**Project Type**: Single-page browser game, no backend

**Performance Goals**: Stable 60 fps on integrated graphics with 20 enemies and 100
projectiles alive; no garbage generated during steady-state play

**Constraints**: Fully offline after `npm install`; no runtime asset downloads; no
post-processing dependency required for playability

**Scale/Scope**: One route roughly 3 to 6 minutes long, 2 enemy kinds plus 1 boss,
5 power types, around 25 source modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan satisfies it |
|-----------|----------------------------|
| I. Playable At Every Step | Task phases are ordered so the game is runnable after each: world scroll first, then player, then enemies, then damage, then powers, then boss. Nothing depends on an unbuilt later phase. |
| II. Feel Is A Requirement | `EffectsSystem` and `AudioSystem` are built as first-class systems, not a trailing polish task. Muzzle flash, hit flash, screen shake, and kill particles are required outputs of the combat tasks. |
| III. Tuning Lives In Data | All balance numbers live in `src/config/tuning.ts`; all wave composition lives in `src/config/levelOne.ts`. Systems read them and never hardcode. |
| IV. Deterministic Simulation | Fixed 1/60 accumulator in `Game.update`; every system takes an explicit `dt` parameter; no system reads wall-clock time for gameplay math. |
| V. No Allocation In Hot Loop | `Pool<T>` backs projectiles and particles; geometry and materials are created once in module scope and shared; vector scratch objects are module-level constants. |

No violations. Complexity Tracking is empty.

## Phase 0: Research and Decisions

### Decision 1: The world moves, not the player

The player's aircraft stays near the world origin with only a small offset inside the
flight envelope. Terrain tiles, cloud props, enemies, and the finish gate translate toward
`+Z` past the camera, and a single `distanceTravelled` scalar accumulates route progress.

*Rationale*: Moving a player object forever along `-Z` accrues float precision error over
a multi-minute run and forces every spawn and cull check to be relative to a moving
origin. Scrolling the world keeps all gameplay math near the origin where float precision
is best, makes the progress bar a direct `distanceTravelled / trackLength` division, and
makes despawn a fixed `z > cullPlane` test.

*Alternative rejected*: Move the player and reposition the world in periodic "shifts".
This works but introduces a discontinuity every shift that must be compensated in every
system holding a world position, including in-flight projectiles.

### Decision 2: Swept-sphere collision, not point-in-sphere

Bounding spheres approximate aircraft silhouettes well enough for this genre. Projectiles
travel fast enough that a naive point-in-sphere test at 1/60s steps would let a shot pass
entirely through a small enemy between frames. Projectiles therefore test the segment from
their previous position to their current position against each target sphere.

*Rationale*: This is the difference between a weapon that feels reliable and one that
feels broken, and the closed-form segment-sphere test costs only a few extra operations.

*Alternative rejected*: Substepping projectile motion. Correct but scales cost with
projectile speed and count, and complicates the update order.

### Decision 3: DOM overlay for the HUD

Health, shield, score, progress, and power indicators render as HTML elements layered over
the canvas.

*Rationale*: Text in a WebGL scene needs either a bitmap font atlas or a texture-based
label system; both are more code and blurrier than native DOM text. The HUD also updates
far less often than the scene, so keeping it out of the render loop is cheaper.

*Alternative rejected*: In-scene sprites and geometry for the HUD. Rejected as
disproportionate cost for this scope.

### Decision 4: Procedural models behind a factory boundary

Aircraft are assembled from three.js primitives inside `src/models/*.ts`, each exposing a
single factory returning an `Object3D`.

*Rationale*: Zero download weight, fully offline, instantly tweakable, and readable
silhouettes are easier to guarantee when authored deliberately than when pulled from an
arbitrary asset pack. The factory boundary means a future GLTF loader can replace the
implementation without gameplay systems knowing.

### Decision 5: Synthesized audio

Sound effects are generated with Web Audio oscillators and noise buffers.

*Rationale*: Keeps the offline requirement absolute with no binary assets in the repo,
and lets each sound be tuned by parameter. A laser is a falling-pitch square wave, an
explosion is a filtered noise burst with an exponential decay envelope.

### Decision 6: Fixed timestep with clamped accumulator

`Game.update(frameTime)` accumulates elapsed time and drains it in fixed 1/60 steps, with
the accumulated total clamped to a maximum per frame.

*Rationale*: Determinism per Principle IV. The clamp specifically handles the spec's
tab-restore edge case: without it, returning after a minute away would drain thousands of
steps in one frame and hang the page.

## Project Structure

### Documentation (this feature)

```text
specs/001-rail-shooter/
├── spec.md              # Feature specification
├── plan.md              # This file
├── data-model.md        # Entity and state shapes
├── quickstart.md        # How to run and play
└── tasks.md             # Task breakdown
```

### Source Code (repository root)

```text
index.html               # Canvas plus DOM HUD overlay and screen markup
package.json
tsconfig.json
vite.config.ts
README.md
src/
├── main.ts              # Renderer and scene bootstrap, resize, starts Game
├── types.ts             # Shared gameplay types and unions
├── config/
│   ├── tuning.ts        # All balance constants
│   └── levelOne.ts      # Route length and wave table
├── core/
│   ├── Game.ts          # Owns systems, fixed-step loop, state transitions
│   ├── GameState.ts     # State union plus exhaustive transition handling
│   ├── Input.ts         # Keyboard state sampling
│   ├── Pool.ts          # Generic object pool
│   └── mathUtils.ts     # Segment-sphere test, damping, scratch vectors
├── models/
│   ├── playerModel.ts
│   ├── enemyPlaneModel.ts
│   ├── helicopterModel.ts
│   ├── bossModel.ts
│   └── powerUpModel.ts
├── entities/
│   ├── Player.ts
│   ├── Enemy.ts         # Plane and helicopter behaviour behind one entity type
│   ├── Boss.ts
│   ├── Projectile.ts
│   └── PowerUp.ts
├── systems/
│   ├── SpawnSystem.ts   # Distance-keyed wave triggering and lifecycle
│   ├── CollisionSystem.ts
│   ├── WeaponSystem.ts  # Firing cadence, patterns, projectile pooling
│   ├── PowerUpSystem.ts # Drops, magnet, effect application and expiry
│   ├── EffectsSystem.ts # Particles, trails, screen shake
│   └── AudioSystem.ts   # Synthesized sound effects
├── world/
│   ├── Sky.ts
│   ├── Terrain.ts       # Recycling ground tiles
│   ├── Clouds.ts
│   └── FinishGate.ts
└── ui/
    ├── Hud.ts
    └── Screens.ts
```

**Structure Decision**: Single flat project at the repository root, since there is no
backend and no second deployable. Modules are grouped by role: `core` for the loop and
shared primitives, `entities` for things with health and position, `systems` for logic
that operates across entities, `world` for non-interactive scenery, `models` for geometry
construction, `ui` for DOM, and `config` for data. Systems depend on entities and config;
entities depend on models and config; nothing depends upward.

## Phase 1: Design

### Update order

Order matters for feel. Input is sampled before the player moves so control has no added
latency. Collision runs after all motion so nothing is tested against a stale position.
Effects run after damage resolution so hit feedback appears the same frame as the hit.

```text
sample input
  -> player move and fire
  -> spawn system triggers waves by distance
  -> enemies steer and fire
  -> projectiles integrate
  -> collision resolve (swept tests, damage, deaths, drops)
  -> powerups magnet, apply, expire
  -> world scroll, distance accumulate
  -> effects update
  -> hud sync
  -> render
```

### State machine

`Menu -> Playing`, `Playing <-> Paused`, `Playing -> GameOver`, `Playing -> Victory`,
and both terminal states back to `Playing` on restart. The state is a discriminated union
narrowed by switches with a `never` default so adding a state fails compilation until
every switch handles it.

### Weapon tiers and powers

Weapon strength is a tier from 1 to 3 driving the shot pattern: single centred shot, twin
parallel shots, then twin plus angled outer pair. Rapid fire multiplies cadence for a
duration. Missiles are a limited-ammo secondary that homes on the nearest enemy ahead.
Shield absorbs a fixed number of hits before health is touched. Repair restores health.
Power type is a string union resolved by exhaustive switch in `PowerUpSystem`.

### Difficulty curve

`levelOne.ts` holds waves as records of route distance, enemy kind, count, and formation.
Early waves are small single-kind plane groups; the middle introduces helicopters and
mixed formations; the last third overlaps waves so pressure is continuous. The boss
triggers at the route's end and gates the finish line.

## Complexity Tracking

No constitution violations to justify.
