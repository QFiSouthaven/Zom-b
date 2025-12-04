/**
 * @file zombieAI.ts
 * @description Zombie AI System with Pathfinding
 *
 * Implements intelligent zombie behavior using ROT.js pathfinding algorithms.
 * Zombies navigate toward player, avoid obstacles, and coordinate attacks.
 */

import { findPath, hasLineOfSight, Position, WorldMap, manhattanDistance } from './rotjsIntegration';
import { Enemy, GameState } from '../types';
import { GAME_BALANCE } from './gameBalance';

export interface ZombieAIAction {
  type: 'move' | 'attack' | 'scream' | 'block' | 'wait';
  targetPosition?: Position;
  targetId?: string;
  damage?: number;
  description: string;
}

export interface ZombieAIState {
  position: Position;
  lastKnownPlayerPosition: Position | null;
  aggroLevel: number; // 0-100, affects aggression
  state: 'idle' | 'patrol' | 'alert' | 'chase' | 'attack' | 'stunned';
  stunDuration: number;
  screamCooldown: number;
}

export class ZombieAI {
  private aiStates: Map<string, ZombieAIState> = new Map();
  private world: WorldMap | null = null;

  /**
   * Initialize AI for a zombie
   */
  initializeZombie(zombieId: string, position: Position): void {
    this.aiStates.set(zombieId, {
      position,
      lastKnownPlayerPosition: null,
      aggroLevel: 50,
      state: 'patrol',
      stunDuration: 0,
      screamCooldown: 0
    });
  }

  /**
   * Set world map for pathfinding
   */
  setWorld(world: WorldMap): void {
    this.world = world;
  }

  /**
   * Calculate zombie action for turn
   */
  calculateAction(
    zombie: Enemy,
    zombieId: string,
    playerPosition: Position,
    gameState: GameState
  ): ZombieAIAction {
    let aiState = this.aiStates.get(zombieId);

    if (!aiState) {
      // Initialize if not exists
      this.initializeZombie(zombieId, playerPosition); // Placeholder, should be actual zombie position
      aiState = this.aiStates.get(zombieId)!;
    }

    // Handle stun
    if (aiState.stunDuration > 0) {
      aiState.stunDuration--;
      return {
        type: 'wait',
        description: `${zombie.name} is stunned and recovering`
      };
    }

    // Update cooldowns
    if (aiState.screamCooldown > 0) {
      aiState.screamCooldown--;
    }

    // Check distance to player
    const distance = this.calculateDistance(zombie, playerPosition);

    // Update last known player position if visible
    if (this.world && hasLineOfSight(this.world, aiState.position, playerPosition)) {
      aiState.lastKnownPlayerPosition = playerPosition;
      aiState.aggroLevel = Math.min(100, aiState.aggroLevel + 10);
    }

    // Decide action based on zombie type and distance
    return this.decideAction(zombie, aiState, playerPosition, distance);
  }

  /**
   * Decide best action for zombie
   */
  private decideAction(
    zombie: Enemy,
    aiState: ZombieAIState,
    playerPosition: Position,
    distance: number
  ): ZombieAIAction {
    const zombieType = zombie.name;
    const config = GAME_BALANCE.zombieTypes[zombieType];

    // At melee range - attack
    if (distance <= 1) {
      return this.createAttackAction(zombie, config);
    }

    // Screamer special ability
    if (zombieType === 'Screamer' && aiState.screamCooldown === 0 && distance <= 5) {
      aiState.screamCooldown = 3;
      return {
        type: 'scream',
        description: `${zombie.name} releases a piercing scream, calling for reinforcements!`
      };
    }

    // Tank defensive stance if low HP
    if (zombieType === 'Tank' && zombie.hp < zombie.maxHp * 0.3) {
      return {
        type: 'block',
        description: `${zombie.name} adopts a defensive stance, bracing for impact`
      };
    }

    // Move toward player
    if (aiState.lastKnownPlayerPosition && this.world) {
      const path = findPath(this.world, aiState.position, playerPosition);

      if (path.length > 0) {
        const nextPosition = path[0];
        aiState.position = nextPosition;

        return {
          type: 'move',
          targetPosition: nextPosition,
          description: `${zombie.name} ${zombieType === 'Runner' ? 'sprints' : 'shambles'} toward you`
        };
      }
    }

    // Default: wait/patrol
    return {
      type: 'wait',
      description: `${zombie.name} searches for targets`
    };
  }

  /**
   * Create attack action
   */
  private createAttackAction(zombie: Enemy, config: any): ZombieAIAction {
    // Calculate damage with variance
    let damage = config.attack;
    damage = Math.floor(damage * (0.8 + Math.random() * 0.4));

    return {
      type: 'attack',
      damage,
      description: `${zombie.name} lunges at you! Dealt ${damage} damage.`
    };
  }

  /**
   * Calculate distance (simplified for now)
   */
  private calculateDistance(zombie: Enemy, playerPosition: Position): number {
    // For now, use range string
    switch (zombie.range) {
      case 'Melee':
        return 1;
      case 'Near':
        return 3;
      case 'Far':
        return 8;
      default:
        return 5;
    }
  }

  /**
   * Update zombie position
   */
  updatePosition(zombieId: string, newPosition: Position): void {
    const aiState = this.aiStates.get(zombieId);
    if (aiState) {
      aiState.position = newPosition;
    }
  }

  /**
   * Apply stun to zombie
   */
  stunZombie(zombieId: string, duration: number): void {
    const aiState = this.aiStates.get(zombieId);
    if (aiState) {
      aiState.stunDuration = duration;
      aiState.state = 'stunned';
    }
  }

  /**
   * Get zombie AI state
   */
  getAIState(zombieId: string): ZombieAIState | undefined {
    return this.aiStates.get(zombieId);
  }

  /**
   * Process all zombie turns
   */
  processZombieTurns(
    gameState: GameState,
    playerPosition: Position
  ): ZombieAIAction[] {
    const actions: ZombieAIAction[] = [];

    for (const enemy of gameState.enemies) {
      if (enemy.hp > 0) {
        const action = this.calculateAction(enemy, enemy.id, playerPosition, gameState);
        actions.push(action);

        // Update enemy intent for UI
        enemy.intent = this.getIntentDescription(action.type);

        // Update range based on movement
        if (action.type === 'move') {
          this.updateEnemyRange(enemy, playerPosition);
        }
      }
    }

    return actions;
  }

  /**
   * Get intent description for UI
   */
  private getIntentDescription(actionType: string): string {
    switch (actionType) {
      case 'attack':
        return 'Lunge Attack';
      case 'move':
        return 'Approach';
      case 'scream':
        return 'Screaming';
      case 'block':
        return 'Defensive Stance';
      case 'wait':
        return 'Searching';
      default:
        return 'Unknown';
    }
  }

  /**
   * Update enemy range based on movement
   */
  private updateEnemyRange(enemy: Enemy, playerPosition: Position): void {
    const aiState = this.aiStates.get(enemy.id);
    if (!aiState) return;

    const distance = manhattanDistance(aiState.position, playerPosition);

    if (distance <= 1) {
      enemy.range = 'Melee';
    } else if (distance <= 5) {
      enemy.range = 'Near';
    } else {
      enemy.range = 'Far';
    }
  }

  /**
   * Reset AI state (for new combat)
   */
  reset(): void {
    this.aiStates.clear();
  }

  /**
   * Calculate optimal group tactics
   */
  calculateGroupTactics(
    zombies: Enemy[],
    playerPosition: Position
  ): Map<string, 'flank' | 'rush' | 'surround' | 'support'> {
    const tactics = new Map<string, 'flank' | 'rush' | 'surround' | 'support'>();

    // Simple tactics: runners rush, tanks block, screamers support
    for (const zombie of zombies) {
      switch (zombie.name) {
        case 'Runner':
          tactics.set(zombie.id, 'rush');
          break;
        case 'Tank':
          tactics.set(zombie.id, 'surround');
          break;
        case 'Screamer':
          tactics.set(zombie.id, 'support');
          break;
        default:
          tactics.set(zombie.id, 'rush');
      }
    }

    return tactics;
  }
}

// Singleton instance
export const zombieAI = new ZombieAI();

export default ZombieAI;
