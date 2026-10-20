/**
 * Every balance number in the game. Systems read from here and never hardcode.
 *
 * Coordinate frame: the player sits at the origin and the world scrolls toward +Z past
 * the camera. "Ahead" is negative Z. Distances are world units, times are seconds.
 */
export const tuning = {
  sim: {
    /** Fixed simulation step. Gameplay never sees a variable delta. */
    step: 1 / 60,
    /**
     * Ceiling on time drained per frame. Without this, returning to a backgrounded tab
     * would try to catch up thousands of steps in one frame and lock the page.
     */
    maxFrameTime: 0.25,
    maxPixelRatio: 2,
  },

  world: {
    /** Forward speed of the run, and therefore the scroll rate of the world. */
    scrollSpeed: 70,
    /** Anything that passes this Z is behind the camera and gets recycled. */
    cullPlane: 45,
    groundY: 0,
    fogDensity: 0.0016,
    skyTop: 0x1b3f77,
    skyHorizon: 0xbfd8e8,
    fogColor: 0x9fc2da,
    terrain: {
      tileDepth: 100,
      tileCount: 13,
      tileWidth: 900,
      /** Ridge props scattered on each tile to make forward motion readable. */
      ridgesPerTile: 7,
      ridgeSpreadX: 380,
      /** Ridges are kept out of this central lane so they never mask enemies. */
      ridgeClearLane: 90,
    },
    clouds: {
      count: 26,
      minY: 22,
      maxY: 78,
      spreadX: 300,
      depth: 900,
      minScale: 10,
      maxScale: 30,
    },
  },

  camera: {
    fov: 62,
    near: 0.5,
    far: 1400,
    /**
     * Height above, and distance behind, the player's neutral position. The distance is
     * generous on purpose: closer framing made the plane fill a third of the screen and
     * hid approaching enemies behind its own wings.
     */
    offsetY: 5,
    offsetZ: 27,
    /**
     * How much of the player's offset the camera matches. Below 1 the camera trails, which
     * pushes the plane toward the edge of frame during hard manoeuvres and is most of what
     * makes movement feel like it has weight.
     */
    followX: 0.72,
    followY: 0.9,
    /** Exponential smoothing rate for camera motion. Higher is snappier. */
    smoothing: 8,
    /** Camera aims this far ahead of the player. */
    lookAhead: 70,
    /** Multiplier on player velocity when leading the aim point. */
    lookLead: 0.4,
    /**
     * Height of the aim point above the player. Aiming slightly above the plane pushes it
     * into the lower third of frame and fills the rest with the sky the fight happens in.
     */
    lookRise: 3.4,
    shakeDecay: 5.5,
    maxShake: 1.4,
  },

  player: {
    maxHealth: 100,
    startAltitude: 11,
    /** Flight envelope, in player-offset space. */
    boundsX: 25,
    minY: 4,
    maxY: 30,
    acceleration: 190,
    /** Exponential damping applied to envelope velocity each step. */
    damping: 9,
    maxSpeedX: 34,
    maxSpeedY: 26,
    /** Visual lean, radians at full deflection. */
    bankAngle: 0.62,
    pitchAngle: 0.22,
    yawAngle: 0.14,
    modelLerp: 9,
    radius: 2.1,
    /** Grace period after taking a hit, so one burst cannot chain-kill. */
    invulnerableAfterHit: 0.7,
    /** Damage dealt to, and taken from, an enemy on collision. */
    ramDamage: 34,
    ramDamageTaken: 22,
    maxShield: 5,
  },

  weapons: {
    cannon: {
      interval: 0.14,
      speed: 300,
      damage: 10,
      life: 2.6,
      /** Outward angle of the tier 3 pair, radians. */
      outerAngle: 0.055,
      /** Muzzle depth for the single centred shot at tier 1. */
      centreMuzzleZ: -3.4,
    },
    missile: {
      interval: 0.5,
      speed: 170,
      damage: 45,
      life: 4,
      /** How aggressively a missile turns toward its target, radians per second. */
      turnRate: 3.4,
      /** Only enemies within this range are considered as targets. */
      lockRange: 460,
      maxAmmo: 12,
    },
  },

  enemies: {
    /** Where enemies enter the world, ahead of the player. */
    spawnZ: -430,
    plane: {
      health: 30,
      /** Own airspeed, added to the world scroll to give closing speed. */
      approachSpeed: 46,
      weaveAmplitudeX: 13,
      weaveAmplitudeY: 4,
      weaveSpeed: 1.5,
      /** How strongly the lane centre drifts toward the player's attack lane, per second. */
      trackStrength: 0.5,
      /**
       * How far to the side of, and above or below, the player each enemy aims its lane.
       * Tracking the player's exact position made planes fly straight through them, so a
       * wave was unavoidable collision damage rather than a fight.
       */
      lanePassOffset: { min: 9, max: 20 },
      laneAltitudeOffset: { min: 3, max: 8 },
      fireInterval: 1.5,
      burstCount: 2,
      burstGap: 0.16,
      bulletSpeed: 135,
      bulletDamage: 9,
      bulletLife: 5,
      /** Enemies hold fire until they are at least this close. */
      fireRange: 340,
      /** Deliberate aim error, so leading is threatening but never unavoidable. */
      aimJitter: 3.4,
      score: 100,
      dropChance: 1.0,
      /** Sized to the model's silhouette, not its fuselage: a hitbox visibly narrower than
       *  the wings makes the cannon feel broken. */
      radius: 3.4,
      bankAngle: 0.5,
      poolSize: 30,
    },
    helicopter: {
      health: 62,
      /** Hovers: it only drifts with the world, so it lingers in the player's face. */
      approachSpeed: 4,
      weaveAmplitudeX: 7,
      weaveAmplitudeY: 3,
      weaveSpeed: 0.85,
      trackStrength: 0.7,
      lanePassOffset: { min: 8, max: 18 },
      laneAltitudeOffset: { min: 2, max: 7 },
      fireInterval: 1.25,
      burstCount: 1,
      burstGap: 0,
      bulletSpeed: 165,
      bulletDamage: 13,
      bulletLife: 5,
      fireRange: 300,
      aimJitter: 2.2,
      score: 180,
      dropChance: 1.0,
      radius: 3.7,
      bankAngle: 0.2,
      rotorSpeed: 22,
      poolSize: 16,
    },
  },

  boss: {
    health: 3000,
    /** Health fractions at which the attack pattern changes. */
    phaseThresholds: {
      missiles: 0.68,
      strafe: 0.34,
    },
    /** Where it enters the corridor, far enough out to be seen approaching. */
    spawnZ: -640,
    /** Resting Z once it has finished moving into position. */
    holdZ: -180,
    approachSpeed: 95,
    /** Lateral sweep while holding position. */
    driftAmplitude: 18,
    driftSpeed: 0.5,
    altitude: 15,
    radius: 11,
    score: 3000,
    turret: {
      health: 170,
      radius: 2.6,
      score: 250,
      /** Turrets fire on their own schedule regardless of the hull's current phase, so
       *  destroying them measurably reduces incoming fire. */
      fireInterval: 1.7,
      bulletSpeed: 150,
      bulletDamage: 10,
      aimJitter: 2.6,
    },
    spread: {
      /** Seconds between barrages. */
      interval: 1.9,
      /** Projectiles per barrage, fanned across `arc`. */
      bullets: 9,
      arc: 0.62,
      bulletSpeed: 120,
      bulletDamage: 11,
    },
    missiles: {
      interval: 2.4,
      salvo: 3,
      salvoGap: 0.22,
      bulletSpeed: 145,
      bulletDamage: 15,
    },
    strafe: {
      interval: 0.16,
      bulletSpeed: 175,
      bulletDamage: 8,
      /** Width of the sweeping wall of fire. */
      sweepWidth: 26,
      sweepSpeed: 1.7,
    },
  },

  powerUps: {
    /** Drift speed toward the player once inside `magnetRange`. */
    magnetSpeed: 46,
    magnetRange: 70,
    /** Radius within which a pickup counts as collected. */
    pickupRadius: 4.4,
    life: 9,
    bobAmplitude: 1.1,
    bobSpeed: 2.6,
    spinSpeed: 2.2,
    radius: 2,
    /** Relative likelihood of each kind when a drop occurs. */
    weights: {
      weapon: 22,
      rapidFire: 20,
      missiles: 20,
      shield: 18,
      repair: 20,
    },
    effects: {
      repairAmount: 30,
      shieldCharges: 2,
      missileAmmo: 4,
      rapidFireDuration: 8,
      /** Fire interval multiplier while rapid fire is active. */
      rapidFireScale: 0.45,
    },
  },

  effects: {
    projectilePool: 420,
    particlePool: 700,
    powerUpPool: 32,
    muzzleParticles: 4,
    impactParticles: 9,
    explosionParticles: 26,
    bossExplosionParticles: 90,
    particleLife: 0.55,
    explosionLife: 0.85,
    /** Camera shake magnitudes per event. */
    shake: {
      playerHit: 0.85,
      enemyKill: 0.14,
      bossHit: 0.06,
      bossDeath: 1.4,
    },
    vignetteFade: 2.4,
  },

  audio: {
    masterGain: 0.32,
  },

  scoring: {
    /** Bonus per unit of health left when the run is won. */
    survivalBonus: 12,
    /** Bonus for finishing at all. */
    finishBonus: 2500,
  },
} as const;
