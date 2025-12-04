/**
 * @file worldStateManager.ts
 * @description World State Management for Procedural Dungeons
 *
 * Manages procedural world generation, player position tracking,
 * FOV calculations, and world state persistence.
 */

import {
  generateProceduralWorld,
  generateCellularWorld,
  calculateFOV,
  updateVisibility,
  WorldMap,
  Position,
  findZombieSpawnPoints,
  getRandomPassablePosition
} from './rotjsIntegration';
import { GAME_BALANCE } from './gameBalance';

export interface WorldState {
  world: WorldMap | null;
  playerPosition: Position;
  visibleTiles: Set<string>;
  currentLevel: number;
  levelType: 'dungeon' | 'outdoor' | 'mixed';
}

export class WorldStateManager {
  private worldState: WorldState;
  private visionRadius: number = 8; // Default FOV radius

  constructor() {
    this.worldState = {
      world: null,
      playerPosition: { x: 0, y: 0 },
      visibleTiles: new Set(),
      currentLevel: 0,
      levelType: 'dungeon'
    };
  }

  /**
   * Initialize a new procedural world
   */
  initializeWorld(
    width: number = 40,
    height: number = 30,
    seed?: string,
    type: 'dungeon' | 'outdoor' | 'mixed' = 'dungeon'
  ): WorldState {
    // Generate world based on type
    let world: WorldMap;

    switch (type) {
      case 'outdoor':
        world = generateCellularWorld(width, height, seed);
        break;
      case 'dungeon':
      default:
        world = generateProceduralWorld(width, height, seed);
        break;
    }

    // Find starting position for player
    const startPosition = getRandomPassablePosition(world);

    // Update state
    this.worldState = {
      world,
      playerPosition: startPosition,
      visibleTiles: new Set(),
      currentLevel: 1,
      levelType: type
    };

    // Calculate initial FOV
    this.updateFOV();

    return this.worldState;
  }

  /**
   * Move player to new position
   */
  movePlayer(newPosition: Position): boolean {
    if (!this.worldState.world) return false;

    const { world } = this.worldState;
    const { x, y } = newPosition;

    // Check bounds
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) {
      return false;
    }

    // Check tile passability
    const tile = world.tiles[y][x];
    if (!tile || tile.type === 'wall' || tile.type === 'water') {
      return false;
    }

    // Update position
    this.worldState.playerPosition = newPosition;

    // Recalculate FOV
    this.updateFOV();

    return true;
  }

  /**
   * Move player in cardinal direction
   */
  movePlayerDirection(direction: 'north' | 'south' | 'east' | 'west'): boolean {
    const { x, y } = this.worldState.playerPosition;

    const newPosition: Position = {
      x: direction === 'east' ? x + 1 : direction === 'west' ? x - 1 : x,
      y: direction === 'south' ? y + 1 : direction === 'north' ? y - 1 : y
    };

    return this.movePlayer(newPosition);
  }

  /**
   * Update Field of View
   */
  updateFOV(): void {
    if (!this.worldState.world) return;

    const { world, playerPosition } = this.worldState;

    // Calculate visible tiles
    const visibleSet = calculateFOV(
      world,
      playerPosition.x,
      playerPosition.y,
      this.visionRadius
    );

    this.worldState.visibleTiles = visibleSet;
  }

  /**
   * Spawn zombies at safe distances from player
   */
  spawnZombies(count: number, minDistance: number = 10): Position[] {
    if (!this.worldState.world) return [];

    return findZombieSpawnPoints(
      this.worldState.world,
      this.worldState.playerPosition,
      count,
      minDistance
    );
  }

  /**
   * Check if position is visible to player
   */
  isPositionVisible(position: Position): boolean {
    return this.worldState.visibleTiles.has(`${position.x},${position.y}`);
  }

  /**
   * Get current world state
   */
  getState(): WorldState {
    return { ...this.worldState };
  }

  /**
   * Set vision radius
   */
  setVisionRadius(radius: number): void {
    this.visionRadius = Math.max(1, Math.min(radius, 20));
    this.updateFOV();
  }

  /**
   * Get tile at position
   */
  getTileAt(position: Position) {
    if (!this.worldState.world) return null;
    const { tiles } = this.worldState.world;
    return tiles[position.y]?.[position.x] || null;
  }

  /**
   * Check if tile has been explored
   */
  isTileExplored(position: Position): boolean {
    const tile = this.getTileAt(position);
    return tile?.explored || false;
  }

  /**
   * Export world state for save/load
   */
  exportState(): string {
    return JSON.stringify({
      world: this.worldState.world,
      playerPosition: this.worldState.playerPosition,
      currentLevel: this.worldState.currentLevel,
      levelType: this.worldState.levelType,
      visionRadius: this.visionRadius
    });
  }

  /**
   * Import world state from save data
   */
  importState(savedState: string): boolean {
    try {
      const parsed = JSON.parse(savedState);

      this.worldState = {
        world: parsed.world,
        playerPosition: parsed.playerPosition,
        visibleTiles: new Set(),
        currentLevel: parsed.currentLevel,
        levelType: parsed.levelType
      };

      this.visionRadius = parsed.visionRadius || 8;

      // Recalculate FOV
      this.updateFOV();

      return true;
    } catch (error) {
      console.error('Failed to import world state:', error);
      return false;
    }
  }

  /**
   * Generate next level (deeper dungeon)
   */
  generateNextLevel(): WorldState {
    const nextLevel = this.worldState.currentLevel + 1;
    const seed = `level-${nextLevel}-${Date.now()}`;

    // Increase difficulty/size with depth
    const width = 40 + Math.floor(nextLevel / 2) * 5;
    const height = 30 + Math.floor(nextLevel / 2) * 5;

    return this.initializeWorld(width, height, seed, this.worldState.levelType);
  }
}

// Singleton instance for global access
export const worldManager = new WorldStateManager();

export default WorldStateManager;
