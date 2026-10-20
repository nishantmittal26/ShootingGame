# Rail Shooter

A browser rail shooter built with [three.js](https://threejs.org/). You fly a plane down a
fixed corridor, shoot down enemy planes and helicopters that shoot back, collect powers
from your kills, destroy the gunship guarding the exit, and cross the finish line.

Everything is procedurally generated: the aircraft are assembled from primitives and the
sound effects are synthesized with the Web Audio API. There are no binary assets, and the
game runs entirely offline once dependencies are installed.

## Getting started

```bash
npm install
npm run dev
```

Vite prints a local URL. Open it and press Enter to launch.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Type check, then bundle to `dist/` |
| `npm run preview` | Serve the built bundle |

## Controls

| Input | Action |
|-------|--------|
| `W` `A` `S` `D` / arrows | Steer within the flight envelope |
| `Space` / left mouse | Fire cannon |
| `Shift` | Launch homing missile (requires ammunition) |
| `P` / `Esc` | Pause and resume |
| `Enter` | Start, or restart after a run ends |
| `M` | Mute and unmute |

## Powers

Destroyed enemies drop pickups that drift toward you. Helicopters drop more often than
planes because they are harder to kill.

| Colour | Power | Effect |
|--------|-------|--------|
| Green | Repair | Restores hull integrity |
| Cyan | Shield | Absorbs a number of hits before your hull takes damage |
| Orange | Weapon | Raises cannon tier: single shot, then twin, then twin plus angled pair |
| Yellow | Rapid fire | Temporarily raises fire rate |
| Magenta | Missiles | Adds homing missile ammunition |

## How it works

The player's plane stays near the world origin. Terrain, clouds, enemies, and the finish
gate scroll toward the camera while a single distance scalar tracks route progress. This
keeps all gameplay math near the origin where floating point precision is best, makes
culling a fixed plane test, and makes the progress bar a simple division.

Gameplay advances on a fixed 60Hz accumulator that is independent of display refresh rate,
so the outcome of a given sequence of inputs does not change between a 60Hz and a 144Hz
monitor. Projectiles and particles come from pre-allocated pools with shared geometry and
materials, so steady-state play does not allocate.

Projectiles move fast enough to cross a small target within one simulation step, so they
use a swept segment-versus-sphere test against their previous position rather than a point
containment test. Without this, shots would occasionally pass straight through enemies.

## Project layout

```text
index.html              Canvas, HUD overlay, and screen markup with styles
src/
├── main.ts             Renderer and scene bootstrap, resize, starts Game
├── types.ts            Shared unions and interfaces
├── config/
│   ├── tuning.ts       Every balance constant
│   └── levelOne.ts     Route length and the wave table
├── core/               Game loop, state machine, input, pooling, math
├── models/             Procedural geometry factories, one per aircraft
├── entities/           Player, Enemy, Boss, Projectile, PowerUp
├── systems/            Spawning, collision, weapons, powers, effects, audio
├── world/              Sky, terrain, clouds, finish gate
└── ui/                 HUD and screen controllers
```

Systems depend on entities and config, entities depend on models and config, and nothing
depends upward.

## Tuning

Balance lives in [src/config/tuning.ts](src/config/tuning.ts) and wave composition lives
in [src/config/levelOne.ts](src/config/levelOne.ts). The dev server hot-reloads both, so
you can adjust difficulty without restarting.

## Design documents

This project was built spec-first. The specification, implementation plan, data model, and
task breakdown are in [specs/001-rail-shooter/](specs/001-rail-shooter/), and the project
principles are in [.specify/memory/constitution.md](.specify/memory/constitution.md).
