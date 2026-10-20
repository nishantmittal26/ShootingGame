# Rail Shooter Constitution

## Core Principles

### I. Playable At Every Step

Every increment must end with a build that runs in the browser and can be flown. A
feature is not done because its code exists; it is done when it can be observed on
screen. Work that cannot be demonstrated by loading the page and playing is not
finished work.

### II. Feel Is A Requirement, Not Polish

Responsiveness and readability are functional requirements. Input must register on the
next frame, hits must be visibly and audibly confirmed, and threats must be legible
before they can kill the player. A mechanically correct but unreadable interaction is a
defect.

### III. Tuning Lives In Data

Balance numbers, wave composition, and difficulty curves live in dedicated config
modules, never inline in behaviour code. Changing how hard the game is must never
require editing a system. This keeps iteration cheap, which is the only way feel gets
tuned at all.

### IV. Deterministic Simulation

Gameplay advances on a fixed timestep decoupled from render rate. The same inputs must
produce the same outcome on a 60Hz and a 144Hz display. Frame-rate-dependent movement,
damage, or collision is prohibited.

### V. No Allocation In The Hot Loop

Projectiles, particles, and other high-churn objects come from pre-allocated pools with
shared geometry and material instances. Steady-state play must not create garbage.
Frame time consistency matters more than peak frame rate.

## Additional Constraints

- TypeScript in strict mode. Unions and enums are narrowed with exhaustive switches that
  fail compilation when a variant is added but unhandled.
- Imports at module top level only.
- Runs fully offline after dependency install. No runtime asset downloads, no telemetry,
  no network calls.
- Visual models are produced by factory functions so the geometry source can change
  without touching gameplay systems.
- Rendering targets WebGL2 through three.js with no post-processing dependency required
  for the game to be playable.

## Development Workflow

- Spec-driven: spec defines what and why, plan defines how, tasks sequence the work.
- Systems are added in dependency order so that each layer can be verified against a
  running game before the next is stacked on it.
- Type check and production build must both pass clean before work is called complete.
- Claims of completion require observed evidence, not inference from the code.

## Governance

This constitution governs implementation decisions for the project. Where a proposed
approach conflicts with a principle, the principle wins unless the conflict is recorded
and justified in the plan's complexity tracking. Added complexity must state which
principle it serves.

**Version**: 1.0.0 | **Ratified**: 2026-08-31 | **Last Amended**: 2026-08-31
