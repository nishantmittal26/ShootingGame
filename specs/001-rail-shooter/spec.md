# Feature Specification: Rail Shooter

**Feature Branch**: `001-rail-shooter`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "A simple shooting game where a player plane hits enemy flying objects (planes, helicopters) while moving along toward the finish line. Enemy planes fire back. The player plane gains powers from killing enemy planes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fly and shoot down enemies (Priority: P1)

A player opens the game, takes control of a plane seen from behind, and flies forward
through open sky. Enemy aircraft appear ahead. The player steers to line up shots, fires,
and destroys them in a satisfying burst.

**Why this priority**: This is the core verb of the game. Without maneuvering and
shooting there is no game at all, and with only this the game is already fun to hold.

**Independent Test**: Load the page, steer the plane in all four directions, fire at an
approaching enemy, and confirm it takes damage and is destroyed.

**Acceptance Scenarios**:

1. **Given** the game is running, **When** the player holds a direction input, **Then** the plane moves that way within its flight bounds and visibly banks or pitches into the movement.
2. **Given** an enemy is ahead of the player, **When** the player fires and the shot intersects the enemy, **Then** the enemy registers a hit with visible feedback.
3. **Given** an enemy has taken its full hit points in damage, **When** the killing shot lands, **Then** the enemy is destroyed with an explosion and is removed from play.
4. **Given** the plane is at the edge of its flight envelope, **When** the player keeps pushing outward, **Then** the plane stops at the boundary rather than leaving the playfield.

---

### User Story 2 - Survive enemy fire (Priority: P1)

Enemies shoot back. The player must read incoming fire, dodge it, and manage a health
pool that can run out and end the run.

**Why this priority**: Without a threat there is no tension and shooting has no stakes.
Paired with story 1 this is the minimum complete game loop.

**Independent Test**: Stand still in front of an enemy, take hits until health is
exhausted, and confirm the run ends.

**Acceptance Scenarios**:

1. **Given** an enemy has line of sight on the player, **When** its firing interval elapses, **Then** it launches a visually distinct projectile aimed at where the player is heading.
2. **Given** an enemy projectile is in flight, **When** it intersects the player, **Then** the player loses health and receives immediate visual and audible feedback.
3. **Given** the player has health remaining, **When** the player maneuvers out of a projectile's path, **Then** the projectile misses and eventually leaves play.
4. **Given** the player's health reaches zero, **When** the fatal hit lands, **Then** the run ends and a game over outcome is presented with the option to try again.
5. **Given** the player collides with an enemy aircraft body, **When** they intersect, **Then** both take significant damage.

---

### User Story 3 - Gain powers from kills (Priority: P2)

Destroyed enemies sometimes leave behind a pickup. Collecting it makes the player
measurably stronger, rewarding aggression over avoidance.

**Why this priority**: This is the progression hook that makes killing enemies worth the
risk instead of something to dodge past. It needs the combat loop to exist first.

**Independent Test**: Destroy enemies until a pickup drops, collect it, and confirm the
player's offensive or defensive capability visibly changes.

**Acceptance Scenarios**:

1. **Given** an enemy is destroyed, **When** its drop chance succeeds, **Then** a clearly readable pickup appears at the kill location and travels toward the player.
2. **Given** a pickup is near the player, **When** the player touches it, **Then** its effect is applied immediately with confirming feedback and the pickup is consumed.
3. **Given** the player collects a weapon upgrade, **When** they next fire, **Then** the shot pattern is visibly stronger than before.
4. **Given** the player holds a time-limited power, **When** its duration elapses, **Then** the power ends and the interface reflects that it is gone.
5. **Given** the player holds a shield, **When** an enemy projectile hits them, **Then** the shield absorbs the hit instead of health being lost.

---

### User Story 4 - Race to the finish line (Priority: P2)

The run has a defined length. The player can see how far along they are, faces escalating
waves as they progress, and reaches a finish line that ends the run in victory.

**Why this priority**: This converts an open-ended shooting range into a run with a
beginning, middle, and end, which is what makes it a game the player can win.

**Independent Test**: Play from the start, watch the progress indicator advance, and
confirm reaching the end presents a victory outcome.

**Acceptance Scenarios**:

1. **Given** the run is in progress, **When** the player advances, **Then** a progress indicator shows how much of the route remains.
2. **Given** the player is at a given point in the route, **When** they reach a scripted encounter point, **Then** the corresponding enemy group appears ahead of them.
3. **Given** the player progresses further into the run, **When** later waves arrive, **Then** those waves are more demanding than earlier ones.
4. **Given** the player has cleared the route's final challenge, **When** they cross the finish line, **Then** a victory outcome is presented with their result.

---

### User Story 5 - Defeat the final boss (Priority: P3)

At the end of the route a single large enemy blocks the way. It has far more health than
regular enemies, changes its attack behaviour as it is worn down, and must be destroyed
before the finish line opens.

**Why this priority**: A climax makes the run's ending feel earned, but the run is
already completable and satisfying without it.

**Independent Test**: Reach the end of the route, fight the large enemy, observe its
behaviour change as its health drops, and destroy it.

**Acceptance Scenarios**:

1. **Given** the player reaches the end of the route, **When** the encounter begins, **Then** a single large enemy appears with its own clearly displayed health.
2. **Given** the boss is at full health, **When** its health crosses a threshold, **Then** its attack behaviour visibly changes.
3. **Given** the boss is alive, **When** the player attempts to pass, **Then** the finish line does not open.
4. **Given** the boss is destroyed, **When** it dies, **Then** the finish line opens and the player can complete the run.

---

### Edge Cases

- Player switches away from the game and returns much later: the simulation must resume from the present moment rather than fast-forwarding through all the elapsed time at once.
- Browser window is resized or rotated mid-run: the view adapts without distorting the image or shifting the fairness of the playfield.
- Many enemies and projectiles are alive simultaneously: the game keeps a playable frame rate rather than degrading into slow motion.
- Player fires continuously without pause: the fire rate is capped so holding the button is not stronger than intended.
- Player collects a power they already hold: the effect refreshes or stacks in a stated, predictable way rather than being silently discarded.
- Enemy leaves the playfield without being killed: it is removed from play so it cannot accumulate off-screen or shoot from behind.
- A projectile travels far enough in one simulation step to pass through a target: it must still register the hit rather than tunnelling through.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST present the player's aircraft from behind, moving forward along a fixed route, with a view that follows the aircraft.
- **FR-002**: The player MUST be able to steer within a bounded flight envelope using the keyboard, and the aircraft MUST visually lean into its movement.
- **FR-003**: The player MUST be able to fire a primary weapon, rate-limited so that holding the input yields a fixed maximum cadence.
- **FR-004**: The game MUST spawn enemy aircraft of at least two kinds with distinct movement and attack behaviour: a fast-moving plane and a slower, tougher helicopter.
- **FR-005**: Enemy aircraft MUST fire projectiles at the player, aiming ahead of the player's motion rather than at their exact current position.
- **FR-006**: The game MUST detect projectile-to-aircraft and aircraft-to-aircraft contact reliably, including for projectiles fast enough to cross a target within one simulation step.
- **FR-007**: The player and every enemy MUST have health that decreases on damage and reaches destruction at zero.
- **FR-008**: Destroying an enemy MUST have a chance to drop a collectible power, with the chance varying by enemy kind.
- **FR-009**: The game MUST provide at least five distinct power types covering both offensive and defensive benefit, including a weapon strength progression, a temporary rate increase, a secondary weapon with limited ammunition, a damage-absorbing shield, and a health restore.
- **FR-010**: Time-limited powers MUST expire on their own and MUST show their remaining duration to the player.
- **FR-011**: The run MUST have a defined length with a visible progress indicator, and enemy encounters MUST be positioned along that length.
- **FR-012**: Later encounters in a run MUST be more demanding than earlier ones.
- **FR-013**: The run MUST end in one of two outcomes: the player's health is exhausted, or the player crosses the finish line.
- **FR-014**: A single large enemy MUST guard the end of the route, changing its attack behaviour as its health drops, and the finish line MUST remain closed until it is destroyed.
- **FR-015**: The game MUST display the player's health, shield, current weapon strength, active timed powers, secondary ammunition, score, and route progress at all times during play.
- **FR-016**: The game MUST provide a start screen, a pause capability during play, and distinct game over and victory screens, each offering a way to play again.
- **FR-017**: The game MUST award score for destroying enemies and present the final score at the end of a run.
- **FR-018**: Gameplay MUST advance at a fixed simulation rate independent of display refresh rate, so outcomes do not change with frame rate.
- **FR-019**: The game MUST confirm every significant event with both visual and audible feedback, including firing, taking damage, destroying an enemy, and collecting a power.
- **FR-020**: The game MUST run entirely offline once installed, with no runtime network requests.

### Key Entities

- **Player Aircraft**: The controlled plane. Holds health, shield charges, weapon strength, active timed powers, secondary ammunition, and a position within the flight envelope.
- **Enemy Aircraft**: A hostile flier. Holds a kind, health, movement behaviour, an attack cadence, a score value, and a drop chance.
- **Boss**: A single large hostile guarding the route's end. Holds substantially more health, a set of behaviour phases keyed to health thresholds, and independently destructible attachments.
- **Projectile**: A shot in flight, owned by either side. Holds a position, a velocity, damage, and a lifespan, and is drawn from a reusable set rather than created fresh.
- **Power Pickup**: A collectible dropped by a destroyed enemy. Holds a power type and drifts toward a nearby player.
- **Encounter**: A scripted enemy group. Holds the point along the route where it appears, the kind and number of enemies, and their arrangement.
- **Run**: One attempt at the route. Holds distance covered, score, current outcome state, and the set of encounters already triggered.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can start playing within five seconds of the page loading, without reading instructions beyond a single on-screen prompt.
- **SC-002**: Steering and firing register within one simulation step of the input, so control feels immediate.
- **SC-003**: The game holds a smooth frame rate on integrated laptop graphics with at least twenty enemies and one hundred projectiles alive at once.
- **SC-004**: A complete run from start to finish line takes between three and six minutes for a player who survives.
- **SC-005**: An unskilled player loses their first run, and a player who learns the enemy patterns can win, so the difficulty rewards learning.
- **SC-006**: Every power type produces a change the player can identify without consulting documentation.
- **SC-007**: The outcome of a given sequence of inputs is identical on a 60Hz and a 144Hz display.
- **SC-008**: The game loads and plays with no network connection available.

## Assumptions

- Desktop or laptop with a keyboard is the target; touch and gamepad input are out of scope for this version.
- The browser supports WebGL2 and the Web Audio API.
- Movement along the route is automatic and constant; the player controls position within the flight envelope and weapons, not throttle.
- A single route is in scope. Multiple levels, an endless mode, and persistent progression between runs are out of scope.
- No account, save file, or server-side leaderboard; score is per-run and not persisted.
- Visuals are stylised and low-detail by intent, prioritising readability of threats over realism.
- Sound is generated at runtime rather than sourced from recorded audio files.
