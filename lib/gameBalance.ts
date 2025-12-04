/**
 * @file gameBalance.ts
 * @description GAMEIN-style Centralized Game Balance Constants
 *
 * This module contains all tunable game parameters separated from logic.
 * Changing values here affects gameplay without requiring prompt re-engineering.
 *
 * Inspired by GAMEIN framework's CONFIG pattern.
 */

export interface ZombieTypeConfig {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xpReward: number;
  spawnWeight: number;
  description: string;
  loot: { item: string; chance: number; min: number; max: number }[];
}

export interface CombatBalance {
  // Action Points
  baseActionPoints: number;
  maxActionPoints: number;

  // Damage Calculation
  baseDamage: number;
  damageVariance: number; // ±% variance (0.2 = ±20%)
  criticalHitChance: number;
  criticalMultiplier: number;

  // Defense
  defenseDamageReduction: number; // Percentage reduction when defending

  // Flee
  fleeBaseChance: number;
  fleeSuccessBonus: number; // Bonus per stamina point above 50
}

export interface SkillBalance {
  // Base Success Rates
  baseSuccessChance: number; // 40% base for any skilled action
  bonusPerLevel: number; // +5% per skill level
  maxSkillLevel: number;

  // Skill-Specific Bonuses
  melee: {
    level1to3: { description: 'Standard strikes' };
    level4to7: { critBonus: number; stunChance: number; description: 'Weighted Strikes' };
    level8to10: { executionChance: number; description: 'Executioner' };
  };
  firearms: {
    level1to3: { jamChance: number; description: 'High recoil' };
    level4to7: { jamChance: number; headshotBonus: number; description: 'Controlled Bursts' };
    level8to10: { apRefund: boolean; jamChance: number; description: 'Kill Streak' };
  };
  stealth: {
    level4plus: { silentTakedownEnabled: boolean };
  };
  medical: {
    level4plus: { healingBonus: number };
  };
}

export interface SurvivalBalance {
  // Stat Decay (per tick)
  hungerDecay: number;
  thirstDecay: number;
  staminaRegen: number;

  // Damage from Depletion
  depletionDamage: number; // HP loss when hunger/thirst = 0

  // Infection
  infectionDamageThreshold: number; // HP damage per tick when infection > this %
  infectionSpreadRate: number; // % increase per bite
}

export interface WorldBalance {
  // Exploration
  encounterBaseChance: number;
  encounterNightMultiplier: number;
  encounterClearedMultiplier: number;

  // Locations
  startingLocation: string;
  locations: {
    [key: string]: {
      type: 'safe' | 'urban' | 'wilderness' | 'hostile';
      encounterChance: number;
      resources: string[];
    };
  };
}

export interface ProgressionBalance {
  // XP System (if ever added)
  xpPerKill: { [zombieType: string]: number };
  levelUpXpFormula: (level: number) => number;

  // Skill Growth
  skillGrowthOnCritical: number;
  skillGrowthOnSuccess: number;
}

// === MAIN CONFIGURATION OBJECT ===

export const GAME_BALANCE = {
  // Combat Configuration
  combat: {
    baseActionPoints: 3,
    maxActionPoints: 3,
    baseDamage: 10,
    damageVariance: 0.2, // ±20%
    criticalHitChance: 0.1, // 10%
    criticalMultiplier: 1.5,
    defenseDamageReduction: 0.5, // 50% reduction
    fleeBaseChance: 0.6, // 60%
    fleeSuccessBonus: 0.01 // +1% per stamina point above 50
  } as CombatBalance,

  // Skills Configuration
  skills: {
    baseSuccessChance: 0.4, // 40%
    bonusPerLevel: 0.05, // +5%
    maxSkillLevel: 10,

    melee: {
      level1to3: { description: 'Standard strikes' },
      level4to7: { critBonus: 0.15, stunChance: 0.2, description: 'Weighted Strikes: +15% crit, 20% stun' },
      level8to10: { executionChance: 0.25, description: 'Executioner: 25% instant kill on crit' }
    },
    firearms: {
      level1to3: { jamChance: 0.05, description: 'High recoil: 5% jam chance' },
      level4to7: { jamChance: 0.02, headshotBonus: 0.2, description: 'Controlled Bursts: 2% jam, +20% headshot' },
      level8to10: { apRefund: true, jamChance: 0, description: 'Kill Streak: Refund 1 AP on kill' }
    },
    stealth: {
      level4plus: { silentTakedownEnabled: true }
    },
    medical: {
      level4plus: { healingBonus: 0.5 } // +50% healing
    }
  } as SkillBalance,

  // Survival Configuration
  survival: {
    hungerDecay: 1,
    thirstDecay: 2,
    staminaRegen: 5,
    depletionDamage: 5,
    infectionDamageThreshold: 50,
    infectionSpreadRate: 15 // +15% per bite
  } as SurvivalBalance,

  // World Configuration
  world: {
    encounterBaseChance: 0.1, // 10%
    encounterNightMultiplier: 2.0, // 2x at night
    encounterClearedMultiplier: 0.3, // 30% after clearing

    startingLocation: 'Safehouse (Basement)',
    locations: {
      'Safehouse (Basement)': { type: 'safe', encounterChance: 0, resources: [] },
      'Urban Ruins': { type: 'urban', encounterChance: 0.4, resources: ['Scrap Metal', 'Cloth', 'Canned Food'] },
      'Forest': { type: 'wilderness', encounterChance: 0.2, resources: ['Wood', 'Herbs', 'Fresh Water'] },
      'Hospital': { type: 'hostile', encounterChance: 0.6, resources: ['Medical Supplies', 'Painkillers', 'Bandages'] },
      'Supermarket': { type: 'hostile', encounterChance: 0.5, resources: ['Canned Food', 'Water Bottles', 'Tools'] }
    }
  } as WorldBalance,

  // Progression Configuration
  progression: {
    xpPerKill: {
      Walker: 15,
      Runner: 20,
      Tank: 50,
      Spitter: 25,
      Screamer: 30
    },
    levelUpXpFormula: (level: number) => level * 100,
    skillGrowthOnCritical: 1, // +1 level on critical success
    skillGrowthOnSuccess: 0 // No growth on normal success (only on exceptional)
  } as ProgressionBalance,

  // Zombie Types Configuration
  zombieTypes: {
    Walker: {
      name: 'Walker',
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 2,
      xpReward: 15,
      spawnWeight: 0.5, // 50% spawn chance
      description: 'Slow, standard undead. Easy to dispatch in small numbers.',
      loot: [
        { item: 'Cloth', chance: 0.5, min: 1, max: 2 },
        { item: 'Rotten Meat', chance: 0.3, min: 1, max: 1 }
      ]
    } as ZombieTypeConfig,

    Runner: {
      name: 'Runner',
      hp: 20,
      maxHp: 20,
      attack: 12,
      defense: 1,
      xpReward: 20,
      spawnWeight: 0.2, // 20% spawn chance
      description: 'Fast-moving infected. High damage, low health.',
      loot: [
        { item: 'Adrenaline Syringe', chance: 0.15, min: 1, max: 1 },
        { item: 'Cloth', chance: 0.4, min: 1, max: 1 }
      ]
    } as ZombieTypeConfig,

    Tank: {
      name: 'Tank',
      hp: 80,
      maxHp: 80,
      attack: 15,
      defense: 8,
      xpReward: 50,
      spawnWeight: 0.1, // 10% spawn chance
      description: 'Heavily mutated brute. Requires sustained fire or explosives.',
      loot: [
        { item: 'Thick Hide', chance: 0.7, min: 1, max: 3 },
        { item: 'Reinforced Bones', chance: 0.5, min: 1, max: 2 }
      ]
    } as ZombieTypeConfig,

    Spitter: {
      name: 'Spitter',
      hp: 25,
      maxHp: 25,
      attack: 10,
      defense: 3,
      xpReward: 25,
      spawnWeight: 0.15, // 15% spawn chance
      description: 'Ranged attacker. Spits corrosive bile from a distance.',
      loot: [
        { item: 'Toxic Gland', chance: 0.6, min: 1, max: 1 },
        { item: 'Chemical Sample', chance: 0.3, min: 1, max: 1 }
      ]
    } as ZombieTypeConfig,

    Screamer: {
      name: 'Screamer',
      hp: 35,
      maxHp: 35,
      attack: 5,
      defense: 4,
      xpReward: 30,
      spawnWeight: 0.05, // 5% spawn chance
      description: 'Support enemy. Alerts nearby hordes with piercing screams.',
      loot: [
        { item: 'Vocal Cord Sample', chance: 0.5, min: 1, max: 1 }
      ]
    } as ZombieTypeConfig
  } as { [key: string]: ZombieTypeConfig }
};

/**
 * Helper Functions for Common Calculations
 */

/**
 * Calculate damage dealt by player attack
 * @param baseDamage - Base weapon damage
 * @param targetDefense - Enemy defense stat
 * @param isCritical - Whether this is a critical hit
 * @returns Final damage amount
 */
export function calculateDamage(
  baseDamage: number,
  targetDefense: number,
  isCritical: boolean = false
): number {
  const { damageVariance, criticalMultiplier } = GAME_BALANCE.combat;

  // Apply variance (±20%)
  let damage = baseDamage * (1 + (Math.random() * 2 - 1) * damageVariance);

  // Apply defense reduction
  damage = Math.max(1, damage - targetDefense);

  // Apply critical multiplier
  if (isCritical) {
    damage *= criticalMultiplier;
  }

  return Math.floor(damage);
}

/**
 * Calculate success chance for skill check
 * @param skillLevel - Current skill level (1-10)
 * @returns Success probability (0-1)
 */
export function calculateSkillSuccessChance(skillLevel: number): number {
  const { baseSuccessChance, bonusPerLevel, maxSkillLevel } = GAME_BALANCE.skills;
  const effectiveLevel = Math.min(skillLevel, maxSkillLevel);
  return baseSuccessChance + (effectiveLevel * bonusPerLevel);
}

/**
 * Roll for critical hit
 * @param skillLevel - Current relevant skill level
 * @param skillType - 'melee' or 'firearms'
 * @returns Whether attack is critical
 */
export function rollCriticalHit(skillLevel: number, skillType: 'melee' | 'firearms'): boolean {
  let critChance = GAME_BALANCE.combat.criticalHitChance;

  // Apply skill bonuses
  if (skillType === 'melee' && skillLevel >= 4 && skillLevel <= 7) {
    critChance += GAME_BALANCE.skills.melee.level4to7.critBonus;
  }
  if (skillType === 'firearms' && skillLevel >= 4 && skillLevel <= 7) {
    critChance += GAME_BALANCE.skills.firearms.level4to7.headshotBonus;
  }

  return Math.random() < critChance;
}

/**
 * Select zombie type based on weighted probabilities
 * @param isNight - Whether it's nighttime (affects weights)
 * @returns Zombie type name
 */
export function selectZombieType(isNight: boolean = false): string {
  const types = Object.keys(GAME_BALANCE.zombieTypes);
  const weights = types.map(type => {
    let weight = GAME_BALANCE.zombieTypes[type].spawnWeight;

    // Night increases dangerous types
    if (isNight && (type === 'Runner' || type === 'Tank' || type === 'Screamer')) {
      weight *= 1.5;
    }

    return weight;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < types.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return types[i];
    }
  }

  return types[0]; // Fallback
}

/**
 * Calculate zombie spawn count based on location and time
 * @param locationType - Type of location ('safe' | 'urban' | 'wilderness' | 'hostile')
 * @param isNight - Whether it's nighttime
 * @returns Number of zombies to spawn (1-4)
 */
export function calculateZombieSpawnCount(
  locationType: 'safe' | 'urban' | 'wilderness' | 'hostile',
  isNight: boolean
): number {
  let baseCount = 1;

  switch (locationType) {
    case 'hostile':
      baseCount = isNight ? 3 : 2;
      break;
    case 'urban':
      baseCount = isNight ? 2 : 1;
      break;
    case 'wilderness':
      baseCount = 1;
      break;
    case 'safe':
      baseCount = 0;
      break;
  }

  // Random variance (±1)
  return Math.max(1, baseCount + (Math.random() > 0.5 ? 1 : -1));
}

export default GAME_BALANCE;
