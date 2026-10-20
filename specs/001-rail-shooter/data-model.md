# Data Model: Rail Shooter

All state is in-memory and per-run. There is no persistence layer.

## Coordinate convention

Right-handed, y-up. The camera looks toward `-Z`. "Ahead of the player" is more negative
`Z`; the world scrolls toward `+Z` past the camera. The player sits near `z = 0` and moves
only in `x` (left/right) and `y` (up/down) within the flight envelope.

## Enumerations

| Type | Values |
|------|--------|
| `GameStateKind` | `menu`, `playing`, `paused`, `gameOver`, `victory` |
| `EnemyKind` | `plane`, `helicopter` |
| `PowerUpKind` | `weapon`, `rapidFire`, `missiles`, `shield`, `repair` |
| `ProjectileOwner` | `player`, `enemy` |
| `Formation` | `single`, `line`, `vee`, `stagger`, `column` |
| `BossPhase` | `spread`, `missiles`, `strafe` |

Each is a string literal union, not a TypeScript `enum`, so values are inspectable at
runtime and switches narrow cleanly.

## Entities

### Player

| Field | Type | Notes |
|-------|------|-------|
| `object` | `Object3D` | Scene node from `createPlayerModel()` |
| `health` | `number` | Starts at `tuning.player.maxHealth`; zero ends the run |
| `shield` | `number` | Hit charges remaining; absorbs before health |
| `weaponTier` | `1 \| 2 \| 3` | Drives shot pattern |
| `missiles` | `number` | Secondary ammunition count |
| `rapidFireRemaining` | `number` | Seconds left; zero means inactive |
| `offset` | `Vector2` | Position within the flight envelope |
| `velocity` | `Vector2` | Envelope-space velocity, used for enemy lead prediction |
| `fireCooldown` | `number` | Seconds until the primary weapon can fire again |
| `invulnerableFor` | `number` | Brief grace period after taking a hit |
| `radius` | `number` | Bounding sphere radius for collision |

### Enemy

| Field | Type | Notes |
|-------|------|-------|
| `object` | `Object3D` | From the kind's model factory |
| `kind` | `EnemyKind` | Selects behaviour and stats |
| `health` | `number` | From `tuning.enemies[kind].health` |
| `position` | `Vector3` | World position, scrolled each step |
| `velocity` | `Vector3` | Own motion, added to world scroll |
| `fireCooldown` | `number` | Seconds until next shot |
| `age` | `number` | Seconds alive; drives weave phase |
| `weavePhase` | `number` | Per-instance offset so a formation does not move in lockstep |
| `radius` | `number` | Bounding sphere radius |
| `alive` | `boolean` | Cleared on death, swept after the update |

### Boss

Extends the enemy shape with:

| Field | Type | Notes |
|-------|------|-------|
| `maxHealth` | `number` | For the health bar denominator |
| `phase` | `BossPhase` | Current attack behaviour |
| `turrets` | `Turret[]` | Independently destructible attachments |
| `patternTimer` | `number` | Drives salvo timing within a phase |

A `Turret` holds a local mount offset, its own health, its scene node, and an alive flag.

### Projectile

Pooled. Fields are reset on acquire rather than reallocated.

| Field | Type | Notes |
|-------|------|-------|
| `mesh` | `Mesh` | Shared geometry and material |
| `owner` | `ProjectileOwner` | Decides which targets it can hit |
| `position` | `Vector3` | Current world position |
| `previousPosition` | `Vector3` | Segment start for the swept collision test |
| `velocity` | `Vector3` | World units per second |
| `damage` | `number` | Applied on hit |
| `life` | `number` | Seconds remaining before automatic release |
| `homing` | `boolean` | Missiles steer toward the nearest enemy ahead |
| `active` | `boolean` | Pool occupancy flag |

### PowerUp

| Field | Type | Notes |
|-------|------|-------|
| `object` | `Object3D` | Kind-coloured pickup model |
| `kind` | `PowerUpKind` | Effect applied on collection |
| `position` | `Vector3` | Scrolls with the world until magnetised |
| `life` | `number` | Seconds before it expires uncollected |
| `active` | `boolean` | Pool occupancy flag |

## Configuration data

### Wave record

```text
WaveSpec {
  atDistance: number      // route distance that triggers this wave
  kind: EnemyKind
  count: number
  formation: Formation
  spread: number          // lateral spacing between members
  altitude: number        // centre height of the formation
  speed: number           // closing speed multiplier
}
```

`levelOne.ts` exports `trackLength` and an `ArrayOf<WaveSpec>` sorted ascending by
`atDistance`. `SpawnSystem` holds an index into that array and advances it as
`distanceTravelled` passes each entry, so triggering is O(1) per step.

### Run state

| Field | Type | Notes |
|-------|------|-------|
| `distanceTravelled` | `number` | Accumulated route progress |
| `trackLength` | `number` | From `levelOne.ts`; denominator for the progress bar |
| `score` | `number` | Sum of destroyed enemies' score values |
| `kills` | `number` | Count for the end-of-run summary |
| `nextWaveIndex` | `number` | Cursor into the wave table |
| `bossSpawned` | `boolean` | Guards single boss spawn |
| `bossDefeated` | `boolean` | Opens the finish gate |
| `elapsed` | `number` | Run duration in seconds |

## Relationships

```text
Run 1 --- * Enemy
Run 1 --- 0..1 Boss
Run 1 --- * Projectile        (pooled, owner tags side)
Run 1 --- * PowerUp
Enemy 1 --- 0..1 PowerUp      (on death, by drop chance)
Boss 1 --- * Turret
Player 1 --- * Projectile     (owner = player)
```

## Lifecycle rules

- An enemy is removed when its health reaches zero or when its `z` passes the cull plane behind the camera.
- A projectile is released when its `life` expires, when it hits, or when it passes the cull plane.
- A power-up is released when collected or when its `life` expires.
- Pool release never destroys geometry or materials; it only clears the active flag and hides the node.
