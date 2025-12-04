/**
 * @file combatEngine.ts
 * @description Deterministic Combat State Machine
 *
 * Implements GAMEIN-style turn-based combat with:
 * - Explicit turn phases
 * - Deterministic damage calculation
 * - Action validation
 * - State transitions
 *
 * This module contains ONLY game logic, NO narrative generation.
 * Use separately with Gemini for flavor text.
 */

import { GameState, Enemy } from '../types';
import {
  GAME_BALANCE,
  calculateDamage,
  rollCriticalHit,
  calculateSkillSuccessChance
} from './gameBalance';

export type CombatPhase = 'player_turn' | 'enemy_turn' | 'victory' | 'defeat' | 'fled';

export type CombatActionType = 'attack' | 'defend' | 'use_item' | 'flee' | 'move';

export interface CombatAction {
  type: CombatActionType;
  targetId?: string; // Enemy ID for attacks
  itemId?: string; // Item name for use_item
  direction?: 'closer' | 'away'; // For move actions
}

export interface CombatResult {
  success: boolean;
  type:
    | 'damage'
    | 'heal'
    | 'defend'
    | 'flee_success'
    | 'flee_fail'
    | 'move'
    | 'enemy_attack'
    | 'skill_increase'
    | 'execution'
    | 'stun'
    | 'jam'
    | 'ap_refund';
  amount?: number; // Damage/heal amount
  targetId?: string; // Enemy ID affected
  targetName?: string; // Enemy name
  message: string; // Technical description (NOT narrative)
  critical?: boolean;
}

export interface CombatState {
  phase: CombatPhase;
  round: number;
  playerActionPoints: number;
  defendActive: boolean; // Player is defending this turn
  log: CombatResult[];
}

/**
 * Core Combat Engine
 * Pure functional state machine for combat processing
 */
export class CombatEngine {
  private gameState: GameState;
  private combatState: CombatState;

  constructor(gameState: GameState) {
    this.gameState = { ...gameState };
    this.combatState = {
      phase: 'player_turn',
      round: 1,
      playerActionPoints: gameState.actionPoints,
      defendActive: false,
      log: []
    };
  }

  /**
   * Process a player action and return updated states
   * @param action - The action to process
   * @returns Updated game state, combat state, and results
   */
  public processAction(action: CombatAction): {
    gameState: GameState;
    combatState: CombatState;
    results: CombatResult[];
  } {
    // Validate action
    if (!this.isActionValid(action)) {
      return {
        gameState: this.gameState,
        combatState: this.combatState,
        results: [
          {
            success: false,
            type: 'damage',
            message: 'Invalid action: Not enough AP or invalid target'
          }
        ]
      };
    }

    const results: CombatResult[] = [];

    // Process action based on type
    switch (action.type) {
      case 'attack':
        results.push(...this.processAttack(action.targetId!));
        break;
      case 'defend':
        results.push(...this.processDefend());
        break;
      case 'use_item':
        results.push(...this.processUseItem(action.itemId!));
        break;
      case 'flee':
        results.push(...this.processFlee());
        break;
      case 'move':
        results.push(...this.processMove(action.direction!));
        break;
    }

    // Deduct action point (unless flee succeeded or already handled)
    if (action.type !== 'flee' || results[0]?.type !== 'flee_success') {
      this.combatState.playerActionPoints -= 1;
      this.gameState.actionPoints = this.combatState.playerActionPoints;
    }

    // Check if player turn should end
    if (this.combatState.playerActionPoints <= 0) {
      this.endPlayerTurn();
      const enemyResults = this.processEnemyTurn();
      results.push(...enemyResults);
    }

    // Check victory/defeat
    this.checkCombatEnd();

    // Update combat log
    this.combatState.log.push(...results);

    return {
      gameState: { ...this.gameState },
      combatState: { ...this.combatState },
      results
    };
  }

  /**
   * Validate if action is possible
   */
  private isActionValid(action: CombatAction): boolean {
    // Not player turn
    if (this.combatState.phase !== 'player_turn') return false;

    // Not enough AP
    if (this.combatState.playerActionPoints < 1) return false;

    // Attack: Target must exist
    if (action.type === 'attack') {
      if (!action.targetId) return false;
      const target = this.gameState.enemies.find(e => e.id === action.targetId);
      if (!target || target.hp <= 0) return false;
    }

    // Use Item: Item must be in inventory
    if (action.type === 'use_item') {
      if (!action.itemId) return false;
      if (!this.gameState.inventory.includes(action.itemId)) return false;
    }

    return true;
  }

  /**
   * Process attack action
   */
  private processAttack(targetId: string): CombatResult[] {
    const results: CombatResult[] = [];
    const target = this.gameState.enemies.find(e => e.id === targetId);
    if (!target) return results;

    const equippedWeapon = this.gameState.equippedWeapon || 'Fists';
    const isFirearm = this.isFirearm(equippedWeapon);
    const skillType = isFirearm ? 'firearms' : 'melee';
    const skillLevel = this.gameState.skills[isFirearm ? 'Firearms' : 'Melee'] || 1;

    // Roll for firearm jam (only for firearms at low skill)
    if (isFirearm && skillLevel <= 7) {
      const jamChance =
        skillLevel <= 3
          ? GAME_BALANCE.skills.firearms.level1to3.jamChance
          : GAME_BALANCE.skills.firearms.level4to7.jamChance;

      if (Math.random() < jamChance) {
        results.push({
          success: false,
          type: 'jam',
          message: `Weapon jammed! ${equippedWeapon} failed to fire.`
        });
        return results;
      }
    }

    // Roll for hit
    const hitChance = calculateSkillSuccessChance(skillLevel);
    if (Math.random() > hitChance) {
      results.push({
        success: false,
        type: 'damage',
        targetId,
        targetName: target.name,
        message: `Attack missed ${target.name}!`
      });
      return results;
    }

    // Roll for critical
    const isCritical = rollCriticalHit(skillLevel, skillType);

    // Check for execution (melee level 8-10 on crit)
    if (
      !isFirearm &&
      skillLevel >= 8 &&
      isCritical &&
      Math.random() < GAME_BALANCE.skills.melee.level8to10.executionChance
    ) {
      target.hp = 0;
      results.push({
        success: true,
        type: 'execution',
        targetId,
        targetName: target.name,
        message: `EXECUTION! ${target.name} decapitated instantly!`,
        critical: true
      });

      // Check for AP refund (firearms level 8-10)
      if (isFirearm && skillLevel >= 8 && GAME_BALANCE.skills.firearms.level8to10.apRefund) {
        this.combatState.playerActionPoints = Math.min(
          this.combatState.playerActionPoints + 1,
          GAME_BALANCE.combat.maxActionPoints
        );
        results.push({
          success: true,
          type: 'ap_refund',
          message: 'Kill Streak! +1 AP refunded'
        });
      }

      return results;
    }

    // Calculate damage
    const baseDamage = GAME_BALANCE.combat.baseDamage;
    const damage = calculateDamage(baseDamage, target.maxHp > 50 ? target.maxHp / 10 : 2, isCritical);

    // Apply damage
    target.hp = Math.max(0, target.hp - damage);

    results.push({
      success: true,
      type: 'damage',
      amount: damage,
      targetId,
      targetName: target.name,
      message: `Dealt ${damage} damage to ${target.name} (${target.hp}/${target.maxHp} HP remaining)`,
      critical: isCritical
    });

    // Check for stun (melee level 4-7)
    if (
      !isFirearm &&
      skillLevel >= 4 &&
      skillLevel <= 7 &&
      Math.random() < GAME_BALANCE.skills.melee.level4to7.stunChance
    ) {
      target.status = 'Stunned';
      results.push({
        success: true,
        type: 'stun',
        targetId,
        targetName: target.name,
        message: `${target.name} is stunned!`
      });
    }

    // Check for AP refund on kill (firearms level 8-10)
    if (
      target.hp <= 0 &&
      isFirearm &&
      skillLevel >= 8 &&
      GAME_BALANCE.skills.firearms.level8to10.apRefund
    ) {
      this.combatState.playerActionPoints = Math.min(
        this.combatState.playerActionPoints + 1,
        GAME_BALANCE.combat.maxActionPoints
      );
      results.push({
        success: true,
        type: 'ap_refund',
        message: 'Kill Streak! +1 AP refunded'
      });
    }

    // Skill increase on critical
    if (isCritical && skillLevel < GAME_BALANCE.skills.maxSkillLevel) {
      const skillName = isFirearm ? 'Firearms' : 'Melee';
      this.gameState.skills[skillName] = skillLevel + GAME_BALANCE.progression.skillGrowthOnCritical;
      results.push({
        success: true,
        type: 'skill_increase',
        message: `${skillName} skill increased to Level ${this.gameState.skills[skillName]}!`
      });
    }

    return results;
  }

  /**
   * Process defend action
   */
  private processDefend(): CombatResult[] {
    this.combatState.defendActive = true;
    return [
      {
        success: true,
        type: 'defend',
        message: 'Defensive stance activated. Incoming damage reduced by 50% this round.'
      }
    ];
  }

  /**
   * Process item use
   */
  private processUseItem(itemId: string): CombatResult[] {
    const results: CombatResult[] = [];

    // Check item type
    const itemLower = itemId.toLowerCase();

    // Healing items
    if (itemLower.includes('bandage') || itemLower.includes('medkit') || itemLower.includes('heal')) {
      let healAmount = 25; // Base heal

      // Medical skill bonus
      const medicalLevel = this.gameState.skills['Medical'] || 1;
      if (medicalLevel >= 4) {
        healAmount *= 1 + GAME_BALANCE.skills.medical.level4plus.healingBonus;
      }

      this.gameState.hp = Math.min(this.gameState.maxHp, this.gameState.hp + healAmount);

      // Remove item from inventory
      const index = this.gameState.inventory.indexOf(itemId);
      if (index > -1) {
        this.gameState.inventory.splice(index, 1);
      }

      results.push({
        success: true,
        type: 'heal',
        amount: healAmount,
        message: `Used ${itemId}. Restored ${healAmount} HP (${this.gameState.hp}/${this.gameState.maxHp})`
      });
    } else {
      results.push({
        success: false,
        type: 'heal',
        message: `${itemId} cannot be used in combat`
      });
    }

    return results;
  }

  /**
   * Process flee action
   */
  private processFlee(): CombatResult[] {
    const fleeChance = GAME_BALANCE.combat.fleeBaseChance;

    if (Math.random() < fleeChance) {
      this.combatState.phase = 'fled';
      this.gameState.phase = 'exploration';
      this.gameState.enemies = [];

      return [
        {
          success: true,
          type: 'flee_success',
          message: 'Successfully fled from combat! Location changed.'
        }
      ];
    } else {
      return [
        {
          success: false,
          type: 'flee_fail',
          message: 'Flee attempt failed! Enemies block your escape.'
        }
      ];
    }
  }

  /**
   * Process movement (range adjustment)
   */
  private processMove(direction: 'closer' | 'away'): CombatResult[] {
    // Update all enemy ranges
    this.gameState.enemies.forEach(enemy => {
      if (direction === 'closer') {
        if (enemy.range === 'Far') enemy.range = 'Near';
        else if (enemy.range === 'Near') enemy.range = 'Melee';
      } else {
        if (enemy.range === 'Melee') enemy.range = 'Near';
        else if (enemy.range === 'Near') enemy.range = 'Far';
      }
    });

    return [
      {
        success: true,
        type: 'move',
        message: `Repositioned ${direction === 'closer' ? 'closer to' : 'away from'} enemies`
      }
    ];
  }

  /**
   * End player turn and transition to enemy turn
   */
  private endPlayerTurn(): void {
    this.combatState.phase = 'enemy_turn';
  }

  /**
   * Process enemy attacks
   */
  private processEnemyTurn(): CombatResult[] {
    const results: CombatResult[] = [];

    // Filter alive enemies
    const aliveEnemies = this.gameState.enemies.filter(e => e.hp > 0);

    aliveEnemies.forEach(enemy => {
      // Skip stunned enemies
      if (enemy.status?.toLowerCase().includes('stun')) {
        enemy.status = 'Active'; // Remove stun
        results.push({
          success: false,
          type: 'enemy_attack',
          targetName: enemy.name,
          message: `${enemy.name} is recovering from stun`
        });
        return;
      }

      // Calculate enemy damage
      let damage = enemy.maxHp > 50 ? 15 : 8; // Tougher enemies deal more damage

      // Apply defense reduction if player is defending
      if (this.combatState.defendActive) {
        damage = Math.floor(damage * (1 - GAME_BALANCE.combat.defenseDamageReduction));
      }

      // Apply variance
      damage = Math.floor(damage * (0.8 + Math.random() * 0.4));
      damage = Math.max(1, damage);

      this.gameState.hp = Math.max(0, this.gameState.hp - damage);

      results.push({
        success: true,
        type: 'enemy_attack',
        amount: damage,
        targetName: enemy.name,
        message: `${enemy.name} attacks! Dealt ${damage} damage (Player HP: ${this.gameState.hp}/${this.gameState.maxHp})`
      });
    });

    // Reset defend status
    this.combatState.defendActive = false;

    // Start new player turn
    this.combatState.round += 1;
    this.combatState.phase = 'player_turn';
    this.combatState.playerActionPoints = GAME_BALANCE.combat.baseActionPoints;
    this.gameState.actionPoints = this.combatState.playerActionPoints;

    return results;
  }

  /**
   * Check if combat has ended (victory/defeat)
   */
  private checkCombatEnd(): void {
    // Check player defeat
    if (this.gameState.hp <= 0) {
      this.combatState.phase = 'defeat';
      this.gameState.phase = 'exploration'; // Will trigger game over in UI
      return;
    }

    // Check victory
    const aliveEnemies = this.gameState.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) {
      this.combatState.phase = 'victory';
      this.gameState.phase = 'exploration';
      this.gameState.enemies = [];
    }
  }

  /**
   * Helper: Check if weapon is a firearm
   */
  private isFirearm(weaponName: string | null): boolean {
    if (!weaponName) return false;
    const name = weaponName.toLowerCase();
    return (
      name.includes('gun') ||
      name.includes('pistol') ||
      name.includes('rifle') ||
      name.includes('shotgun') ||
      name.includes('smg') ||
      name.includes('revolver') ||
      name.includes('bow')
    );
  }

  /**
   * Get current combat state (read-only)
   */
  public getCombatState(): CombatState {
    return { ...this.combatState };
  }

  /**
   * Get current game state (read-only)
   */
  public getGameState(): GameState {
    return { ...this.gameState };
  }
}

/**
 * Helper function to initialize combat with spawned enemies
 */
export function initiateCombat(
  gameState: GameState,
  zombieTypes: string[],
  isNight: boolean = false
): GameState {
  const enemies: Enemy[] = zombieTypes.map((type, index) => {
    const config = GAME_BALANCE.zombieTypes[type];
    return {
      id: `z${index + 1}`,
      name: config.name,
      hp: config.hp,
      maxHp: config.maxHp,
      status: 'Active',
      intent: 'Lunge Attack', // Default intent
      range: 'Near' // Default range
    };
  });

  return {
    ...gameState,
    phase: 'combat',
    actionPoints: GAME_BALANCE.combat.baseActionPoints,
    maxActionPoints: GAME_BALANCE.combat.maxActionPoints,
    enemies
  };
}

export default CombatEngine;
