# Quickstart: Rail Shooter

## Requirements

- Node.js 20 or newer (verified on 24.15.0)
- A browser with WebGL2 and Web Audio support

## Run it

```powershell
npm install
npm run dev
```

Open the URL Vite prints, then click or press a key to launch.

## Other commands

```powershell
npm run typecheck   # tsc --noEmit
npm run build       # production bundle into dist/
npm run preview     # serve the built bundle
```

No network connection is needed after `npm install`.

## Controls

| Input | Action |
|-------|--------|
| `W` `A` `S` `D` or arrow keys | Steer within the flight envelope |
| `Space` or left mouse | Fire primary weapon |
| `Shift` | Fire homing missile (needs ammunition) |
| `P` or `Esc` | Pause and resume |
| `Enter` | Start, or restart after a run ends |
| `M` | Mute and unmute |

## How to play

You fly forward automatically. Steer to line up shots and to dodge incoming fire. Enemy
planes weave toward you and fire in bursts; helicopters hover, take more punishment, and
lead their shots. Ramming an enemy hurts both of you.

Destroyed enemies sometimes drop a power that drifts toward you:

| Colour | Power | Effect |
|--------|-------|--------|
| Green | Repair | Restores health |
| Cyan | Shield | Absorbs a number of hits before health is touched |
| Orange | Weapon | Raises weapon tier, up to a triple-shot spread |
| Yellow | Rapid fire | Temporarily increases fire rate |
| Magenta | Missiles | Adds homing missile ammunition |

The bar at the top shows progress along the route. A boss guards the end; the finish line
stays closed until it is destroyed. Crossing it wins the run.

## Tuning it

Every balance number lives in [src/config/tuning.ts](../../src/config/tuning.ts). Wave
composition and route length live in [src/config/levelOne.ts](../../src/config/levelOne.ts).
The dev server hot-reloads both, so difficulty can be adjusted without a restart.
