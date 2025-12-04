/**
 * @file explorationSystem.ts
 * @description Procedural Dungeon Exploration System
 *
 * Handles dungeon generation, exploration mechanics, event generation,
 * and integration with the game state.
 */

import { worldManager } from './worldStateManager';
import { GameState, Enemy } from '../types';
import { GAME_BALANCE, selectZombieType, calculateZombieSpawnCount } from './gameBalance';
import { Position, manhattanDistance } from './rotjsIntegration';

export interface ExplorationResult {
  narrative: string;
  gameStateUpdates: Partial<GameState>;
  spawnedEnemies?: Enemy[];
  discoveredItems?: string[];
  triggeredEvent?: string;
}

export interface DungeonLevel {
  depth: number;
  type: 'dungeon' | 'outdoor' | 'building';
  difficulty: number;
  bossPresent: boolean;
}

export class ExplorationSystem {
  private currentLevel: DungeonLevel;
  private stepsExplored: number = 0;
  private roomsVisited: Set<string> = new Set();

  constructor() {
    this.currentLevel = {
      depth: 1,
      type: 'dungeon',
      difficulty: 1,
      bossPresent: false
    };
  }

  /**
   * Initialize a new dungeon level
   */
  initializeDungeon(
    type: 'dungeon' | 'outdoor' | 'building' = 'dungeon',
    depth: number = 1
  ): ExplorationResult {
    // Generate world
    const seed = `${type}-level-${depth}-${Date.now()}`;
    const width = 40 + Math.floor(depth / 2) * 5;
    const height = 30 + Math.floor(depth / 2) * 5;

    const worldState = worldManager.initializeWorld(width, height, seed, type);

    this.currentLevel = {
      depth,
      type,
      difficulty: depth,
      bossPresent: depth % 5 === 0 // Boss every 5 levels
    };

    this.stepsExplored = 0;
    this.roomsVisited.clear();

    return {
      narrative: this.generateDungeonIntroNarrative(type, depth),
      gameStateUpdates: {
        location: this.getDungeonName(type, depth),
        phase: 'exploration'
      }
    };
  }

  /**
   * Handle player movement/exploration action
   */
  explore(
    currentGameState: GameState,
    action: 'north' | 'south' | 'east' | 'west' | 'search' | 'rest'
  ): ExplorationResult {
    const worldState = worldManager.getState();

    if (action === 'rest') {
      return this.handleRest(currentGameState);
    }

    if (action === 'search') {
      return this.handleSearch(currentGameState, worldState.playerPosition);
    }

    // Movement
    const moved = worldManager.movePlayerDirection(action);

    if (!moved) {
      return {
        narrative: 'You cannot move in that direction. A wall blocks your path.',
        gameStateUpdates: {}
      };
    }

    this.stepsExplored++;

    // Get updated world state after move
    const newWorldState = worldManager.getState();
    const currentTile = worldManager.getTileAt(newWorldState.playerPosition);

    // Check for events
    const encounterRoll = Math.random();
    const encounterChance = this.calculateEncounterChance(currentGameState, currentTile?.type || 'floor');

    if (encounterRoll < encounterChance) {
      return this.generateEncounter(currentGameState, newWorldState.playerPosition);
    }

    // Check for discoveries
    if (currentTile?.resources && currentTile.resources.length > 0) {
      return this.generateResourceDiscovery(currentTile.resources);
    }

    // Standard exploration narrative
    return {
      narrative: this.generateExplorationNarrative(currentTile?.type || 'floor', this.currentLevel.type),
      gameStateUpdates: {}
    };
  }

  /**
   * Calculate encounter chance based on location and game state
   */
  private calculateEncounterChance(gameState: GameState, tileType: string): number {
    let baseChance = GAME_BALANCE.world.encounterBaseChance;

    // Increase chance in certain tile types
    if (tileType === 'ruins' || tileType === 'building') {
      baseChance *= 2;
    }

    // Night increases encounters
    if (gameState.time === 'Night' || gameState.time === 'Evening') {
      baseChance *= GAME_BALANCE.world.encounterNightMultiplier;
    }

    // Difficulty scaling
    baseChance *= (1 + this.currentLevel.difficulty * 0.1);

    return Math.min(baseChance, 0.8); // Cap at 80%
  }

  /**
   * Generate zombie encounter
   */
  private generateEncounter(gameState: GameState, position: Position): ExplorationResult {
    const isNight = gameState.time === 'Night' || gameState.time === 'Evening';
    const locationType = this.getLocationTypeFromTile();

    // Determine zombie count
    const zombieCount = calculateZombieSpawnCount(locationType, isNight);

    // Select zombie types
    const enemies: Enemy[] = [];
    for (let i = 0; i < zombieCount; i++) {
      const zombieType = selectZombieType(isNight);
      const zombieConfig = GAME_BALANCE.zombieTypes[zombieType];

      enemies.push({
        id: `z${i + 1}`,
        name: zombieConfig.name,
        hp: zombieConfig.hp,
        maxHp: zombieConfig.maxHp,
        status: 'Active',
        intent: 'Lunge Attack',
        range: 'Near'
      });
    }

    return {
      narrative: this.generateEncounterNarrative(enemies, locationType),
      gameStateUpdates: {
        phase: 'combat',
        enemies,
        actionPoints: GAME_BALANCE.combat.baseActionPoints,
        maxActionPoints: GAME_BALANCE.combat.maxActionPoints
      },
      spawnedEnemies: enemies
    };
  }

  /**
   * Handle resource discovery
   */
  private generateResourceDiscovery(resources: string[]): ExplorationResult {
    const discoveredItem = resources[Math.floor(Math.random() * resources.length)];

    return {
      narrative: `You discover **${discoveredItem}**! It could be useful.`,
      gameStateUpdates: {
        inventory: [] // Will be handled by game logic to append
      },
      discoveredItems: [discoveredItem]
    };
  }

  /**
   * Handle rest action
   */
  private handleRest(gameState: GameState): ExplorationResult {
    const healAmount = Math.min(20, gameState.maxHp - gameState.hp);
    const supplyCost = 1;

    if (gameState.supplies < supplyCost) {
      return {
        narrative: 'You do not have enough supplies to rest safely.',
        gameStateUpdates: {}
      };
    }

    return {
      narrative: `You find a quiet corner to rest. HP restored: +${healAmount}. Supplies consumed: ${supplyCost}.`,
      gameStateUpdates: {
        hp: Math.min(gameState.hp + healAmount, gameState.maxHp),
        supplies: gameState.supplies - supplyCost
      }
    };
  }

  /**
   * Handle search action
   */
  private handleSearch(gameState: GameState, position: Position): ExplorationResult {
    const currentTile = worldManager.getTileAt(position);

    if (!currentTile) {
      return {
        narrative: 'There is nothing of interest here.',
        gameStateUpdates: {}
      };
    }

    // Check if tile has resources
    if (currentTile.resources && currentTile.resources.length > 0) {
      return this.generateResourceDiscovery(currentTile.resources);
    }

    // Random chance of finding hidden items
    const searchRoll = Math.random();
    const scavengingLevel = gameState.skills['Scavenging'] || 1;
    const searchSuccessChance = 0.3 + (scavengingLevel * 0.05);

    if (searchRoll < searchSuccessChance) {
      const commonItems = ['Bandages', 'Canned Food', 'Water Bottle', 'Scrap Metal', 'Cloth'];
      const foundItem = commonItems[Math.floor(Math.random() * commonItems.length)];

      return {
        narrative: `Your scavenging skills pay off. You find **${foundItem}**.`,
        gameStateUpdates: {},
        discoveredItems: [foundItem]
      };
    }

    return {
      narrative: 'You search carefully but find nothing useful.',
      gameStateUpdates: {}
    };
  }

  /**
   * Generate dungeon intro narrative
   */
  private generateDungeonIntroNarrative(type: string, depth: number): string {
    const narratives = {
      dungeon: [
        `You descend into the depths. Level ${depth} awaits.`,
        `The air grows colder as you enter level ${depth} of the underground complex.`,
        `Stone walls close in around you. This is level ${depth}.`
      ],
      outdoor: [
        `You emerge into an overgrown area. The ruins stretch before you.`,
        `Nature has reclaimed this place. Proceed with caution.`,
        `The forest gives way to abandoned structures.`
      ],
      building: [
        `You enter the dilapidated building. Shadows dance in the corners.`,
        `The structure groans under its own weight. Stay alert.`,
        `This building has seen better days. Watch for collapses.`
      ]
    };

    const typeNarratives = narratives[type as keyof typeof narratives];
    return typeNarratives[Math.floor(Math.random() * typeNarratives.length)];
  }

  /**
   * Generate exploration narrative
   */
  private generateExplorationNarrative(tileType: string, levelType: string): string {
    const narratives: { [key: string]: string[] } = {
      floor: [
        'You move through the empty corridor.',
        'Your footsteps echo in the silence.',
        'The path ahead is clear, but the shadows feel oppressive.'
      ],
      grass: [
        'You push through the overgrown vegetation.',
        'The grass rustles as you pass.',
        'Nature has reclaimed this area completely.'
      ],
      building: [
        'You enter a ruined structure. Debris litters the floor.',
        'This building offers some shelter from the elements.',
        'The walls are barely standing. Be careful.'
      ],
      door: [
        'You pass through a doorway.',
        'The door hangs loosely on its hinges.',
        'You step into the next room.'
      ]
    };

    const options = narratives[tileType] || narratives.floor;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Generate encounter narrative
   */
  private generateEncounterNarrative(enemies: Enemy[], locationType: string): string {
    const count = enemies.length;
    const types = [...new Set(enemies.map(e => e.name))].join(', ');

    if (count === 1) {
      return `**THREAT DETECTED!** A ${enemies[0].name} lurches from the shadows!`;
    }

    return `**MULTIPLE CONTACTS!** ${count} hostiles detected: ${types}. Prepare for combat!`;
  }

  /**
   * Get dungeon name for location
   */
  private getDungeonName(type: string, depth: number): string {
    const names = {
      dungeon: `Underground Complex - Level ${depth}`,
      outdoor: `Abandoned Ruins - Sector ${depth}`,
      building: `Collapsed Structure - Floor ${depth}`
    };

    return names[type as keyof typeof names] || `Unknown Location - ${depth}`;
  }

  /**
   * Get location type from current position
   */
  private getLocationTypeFromTile(): 'safe' | 'urban' | 'wilderness' | 'hostile' {
    const worldState = worldManager.getState();
    const currentTile = worldManager.getTileAt(worldState.playerPosition);

    if (!currentTile) return 'wilderness';

    switch (currentTile.type) {
      case 'building':
      case 'ruins':
        return 'hostile';
      case 'floor':
      case 'door':
        return 'urban';
      case 'grass':
        return 'wilderness';
      default:
        return 'urban';
    }
  }

  /**
   * Get current level info
   */
  getCurrentLevel(): DungeonLevel {
    return { ...this.currentLevel };
  }

  /**
   * Generate next level
   */
  generateNextLevel(): ExplorationResult {
    return this.initializeDungeon(
      this.currentLevel.type,
      this.currentLevel.depth + 1
    );
  }
}

// Singleton instance
export const explorationSystem = new ExplorationSystem();

export default ExplorationSystem;
