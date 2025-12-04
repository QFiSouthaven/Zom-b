/**
 * @file rotjsIntegration.ts
 * @description ROT.js Procedural Generation Integration
 *
 * Provides GAMEIN-style world generation, FOV, and pathfinding
 * adapted for Zom-B's narrative-driven gameplay.
 *
 * Features:
 * - Procedural dungeon/world generation
 * - Field of View (FOV) calculations
 * - Pathfinding for zombie AI
 * - Seeded RNG for multiplayer sync
 */

import ROT from 'rot-js';

export interface Tile {
  type: 'floor' | 'wall' | 'door' | 'grass' | 'water' | 'building' | 'ruins';
  explored: boolean;
  visible: boolean;
  resources?: string[];
  zombiesCleared?: boolean;
}

export interface WorldMap {
  width: number;
  height: number;
  tiles: Tile[][];
  seed: string;
}

export interface Position {
  x: number;
  y: number;
}

/**
 * Generate a procedural world using ROT.js Digger algorithm
 * @param width - World width
 * @param height - World height
 * @param seed - Random seed for deterministic generation
 * @returns WorldMap structure
 */
export function generateProceduralWorld(
  width: number = 40,
  height: number = 30,
  seed?: string
): WorldMap {
  const actualSeed = seed || Date.now().toString();

  // Initialize RNG with seed
  ROT.RNG.setSeed(parseFloat(actualSeed) || 12345);

  // Initialize tiles
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = {
        type: 'wall',
        explored: false,
        visible: false
      };
    }
  }

  // Use ROT.js Digger for dungeon generation
  const digger = new ROT.Map.Digger(width, height, {
    roomWidth: [5, 9],
    roomHeight: [5, 9],
    corridorLength: [3, 7],
    dugPercentage: 0.4
  });

  digger.create((x, y, value) => {
    if (value === 0) {
      // Passable floor
      tiles[y][x].type = 'floor';
    } else {
      // Impassable wall
      tiles[y][x].type = 'wall';
    }
  });

  // Add doors at room connections
  const rooms = digger.getRooms();
  rooms.forEach(room => {
    room.getDoors((x, y) => {
      if (tiles[y] && tiles[y][x]) {
        tiles[y][x].type = 'door';
      }
    });
  });

  // Add resource spawns in rooms
  rooms.forEach(room => {
    const [cx, cy] = room.getCenter();
    if (tiles[cy] && tiles[cy][cx]) {
      // Random resource types
      const resourceTypes = ['Scrap Metal', 'Canned Food', 'Bandages', 'Ammo'];
      tiles[cy][cx].resources = [resourceTypes[ROT.RNG.getUniformInt(0, resourceTypes.length - 1)]];
    }
  });

  return {
    width,
    height,
    tiles,
    seed: actualSeed
  };
}

/**
 * Generate a cellular automata-based outdoor world
 * @param width - World width
 * @param height - World height
 * @param seed - Random seed
 * @returns WorldMap structure
 */
export function generateCellularWorld(
  width: number = 40,
  height: number = 30,
  seed?: string
): WorldMap {
  const actualSeed = seed || Date.now().toString();
  ROT.RNG.setSeed(parseFloat(actualSeed) || 12345);

  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = {
        type: 'grass',
        explored: false,
        visible: false
      };
    }
  }

  // Generate using cellular automata
  const cellular = new ROT.Map.Cellular(width, height, {
    born: [4, 5, 6, 7, 8],
    survive: [2, 3, 4, 5]
  });

  cellular.randomize(0.5);

  // Run iterations
  for (let i = 0; i < 4; i++) {
    cellular.create();
  }

  // Convert to tiles
  cellular.create((x, y, value) => {
    if (value === 1) {
      tiles[y][x].type = 'grass';
    } else {
      tiles[y][x].type = 'water';
    }
  });

  // Add buildings randomly
  for (let i = 0; i < 10; i++) {
    const x = ROT.RNG.getUniformInt(1, width - 2);
    const y = ROT.RNG.getUniformInt(1, height - 2);
    if (tiles[y][x].type === 'grass') {
      tiles[y][x].type = 'building';
      tiles[y][x].resources = ['Medical Supplies', 'Tools', 'Food'];
    }
  }

  return {
    width,
    height,
    tiles,
    seed: actualSeed
  };
}

/**
 * Calculate Field of View (FOV) from a position
 * @param world - WorldMap
 * @param x - Player X position
 * @param y - Player Y position
 * @param radius - Vision radius
 * @returns Set of visible positions as "x,y" strings
 */
export function calculateFOV(
  world: WorldMap,
  x: number,
  y: number,
  radius: number = 8
): Set<string> {
  const visible = new Set<string>();

  // Lighting function (checks if tile blocks vision)
  const lightPasses = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
    const tile = world.tiles[y][x];
    return tile.type !== 'wall';
  };

  // Use ROT.js Precise Shadowcasting
  const fov = new ROT.FOV.PreciseShadowcasting(lightPasses);

  fov.compute(x, y, radius, (vx, vy) => {
    visible.add(`${vx},${vy}`);
    // Mark as explored and visible
    if (world.tiles[vy] && world.tiles[vy][vx]) {
      world.tiles[vy][vx].visible = true;
      world.tiles[vy][vx].explored = true;
    }
  });

  return visible;
}

/**
 * Update visibility (reset visible flags, then recalculate FOV)
 * @param world - WorldMap
 * @param x - Player X position
 * @param y - Player Y position
 * @param radius - Vision radius
 */
export function updateVisibility(world: WorldMap, x: number, y: number, radius: number = 8): void {
  // Reset all visible flags
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      world.tiles[y][x].visible = false;
    }
  }

  // Recalculate FOV
  calculateFOV(world, x, y, radius);
}

/**
 * Find a path from start to goal using A* pathfinding
 * @param world - WorldMap
 * @param start - Start position
 * @param goal - Goal position
 * @returns Array of positions representing path (excluding start)
 */
export function findPath(world: WorldMap, start: Position, goal: Position): Position[] {
  const path: Position[] = [];

  // Passability check
  const passableCallback = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
    const tile = world.tiles[y][x];
    return tile.type !== 'wall' && tile.type !== 'water';
  };

  // Create A* pathfinder
  const astar = new ROT.Path.AStar(goal.x, goal.y, passableCallback);

  // Compute path
  astar.compute(start.x, start.y, (x, y) => {
    path.push({ x, y });
  });

  // Remove start position from path
  return path.slice(1);
}

/**
 * Find nearest passable tile to a position
 * @param world - WorldMap
 * @param position - Target position
 * @returns Nearest passable position or null
 */
export function findNearestPassable(world: WorldMap, position: Position): Position | null {
  const { x, y } = position;
  const maxRadius = 10;

  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && ny >= 0 && nx < world.width && ny < world.height) {
          const tile = world.tiles[ny][nx];
          if (tile.type !== 'wall' && tile.type !== 'water') {
            return { x: nx, y: ny };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Find spawn points for zombies (away from player)
 * @param world - WorldMap
 * @param playerPos - Player position
 * @param count - Number of spawn points needed
 * @param minDistance - Minimum distance from player
 * @returns Array of spawn positions
 */
export function findZombieSpawnPoints(
  world: WorldMap,
  playerPos: Position,
  count: number,
  minDistance: number = 10
): Position[] {
  const spawnPoints: Position[] = [];
  const maxAttempts = 100;
  let attempts = 0;

  while (spawnPoints.length < count && attempts < maxAttempts) {
    attempts++;

    const x = ROT.RNG.getUniformInt(0, world.width - 1);
    const y = ROT.RNG.getUniformInt(0, world.height - 1);

    const tile = world.tiles[y][x];
    if (tile.type !== 'wall' && tile.type !== 'water') {
      const distance = Math.sqrt((x - playerPos.x) ** 2 + (y - playerPos.y) ** 2);

      if (distance >= minDistance) {
        spawnPoints.push({ x, y });
      }
    }
  }

  return spawnPoints;
}

/**
 * Calculate Manhattan distance between two points
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Calculate Euclidean distance between two points
 */
export function euclideanDistance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Check if there's a clear line of sight between two positions
 * @param world - WorldMap
 * @param start - Start position
 * @param end - End position
 * @returns True if LOS is clear
 */
export function hasLineOfSight(world: WorldMap, start: Position, end: Position): boolean {
  let clear = true;

  const lightPasses = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
    return world.tiles[y][x].type !== 'wall';
  };

  // Use ROT.js line drawing
  const line = new ROT.Path.AStar(end.x, end.y, lightPasses);

  line.compute(start.x, start.y, (x, y) => {
    if (!lightPasses(x, y)) {
      clear = false;
    }
  });

  return clear;
}

/**
 * Get random position in world (passable tile)
 */
export function getRandomPassablePosition(world: WorldMap): Position {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const x = ROT.RNG.getUniformInt(0, world.width - 1);
    const y = ROT.RNG.getUniformInt(0, world.height - 1);

    const tile = world.tiles[y][x];
    if (tile.type !== 'wall' && tile.type !== 'water') {
      return { x, y };
    }

    attempts++;
  }

  // Fallback to center
  return { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
}

/**
 * Seeded RNG wrapper for deterministic generation across clients
 */
export class SeededRNG {
  constructor(seed: string) {
    ROT.RNG.setSeed(parseFloat(seed) || 12345);
  }

  getUniform(): number {
    return ROT.RNG.getUniform();
  }

  getUniformInt(min: number, max: number): number {
    return ROT.RNG.getUniformInt(min, max);
  }

  getWeightedValue<T>(weights: { [key: string]: number }): string {
    return ROT.RNG.getWeightedValue(weights);
  }

  shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.getUniformInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

export default {
  generateProceduralWorld,
  generateCellularWorld,
  calculateFOV,
  updateVisibility,
  findPath,
  findNearestPassable,
  findZombieSpawnPoints,
  manhattanDistance,
  euclideanDistance,
  hasLineOfSight,
  getRandomPassablePosition,
  SeededRNG
};
