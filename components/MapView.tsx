/**
 * @file MapView.tsx
 * @description FOV-Based Map Visualization Component
 *
 * Displays procedural dungeon/world with fog of war using ROT.js FOV calculations.
 * Shows explored tiles, visible tiles, player position, and zombie locations.
 */

import React from 'react';
import { WorldMap, Position } from '../lib/rotjsIntegration';
import { Enemy } from '../types';
import { User, Skull, Eye, EyeOff, MapPin } from 'lucide-react';

interface MapViewProps {
  world: WorldMap | null;
  playerPosition: Position;
  visibleTiles: Set<string>;
  enemies?: Array<{ id: string; position: Position; name: string; hp: number }>;
  tileSize?: number;
  showMinimap?: boolean;
}

const MapView: React.FC<MapViewProps> = ({
  world,
  playerPosition,
  visibleTiles,
  enemies = [],
  tileSize = 16,
  showMinimap = false
}) => {
  if (!world) {
    return (
      <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-sm flex items-center justify-center">
        <div className="text-center p-6">
          <EyeOff className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-mono text-sm">No map data available</p>
          <p className="text-slate-600 font-mono text-xs mt-1">
            Enter procedural dungeon to generate map
          </p>
        </div>
      </div>
    );
  }

  const { tiles, width, height } = world;

  // Calculate viewport (centered on player)
  const viewportWidth = showMinimap ? Math.min(width, 20) : Math.min(width, 40);
  const viewportHeight = showMinimap ? Math.min(height, 15) : Math.min(height, 30);

  const startX = Math.max(0, Math.min(playerPosition.x - Math.floor(viewportWidth / 2), width - viewportWidth));
  const startY = Math.max(0, Math.min(playerPosition.y - Math.floor(viewportHeight / 2), height - viewportHeight));

  const getTileColor = (x: number, y: number): string => {
    const tile = tiles[y]?.[x];
    if (!tile) return 'bg-slate-950';

    const tileKey = `${x},${y}`;
    const isVisible = visibleTiles.has(tileKey);
    const isPlayer = x === playerPosition.x && y === playerPosition.y;

    // Check if enemy on tile
    const hasEnemy = enemies.some(e => e.position.x === x && e.position.y === y);

    // Player position
    if (isPlayer) {
      return 'bg-blue-500 border border-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
    }

    // Enemy position (only if visible)
    if (hasEnemy && isVisible) {
      return 'bg-red-600 border border-red-400 shadow-[0_0_8px_rgba(220,38,38,0.4)]';
    }

    // Visible tiles
    if (isVisible) {
      switch (tile.type) {
        case 'floor':
          return 'bg-slate-700';
        case 'wall':
          return 'bg-slate-900 border border-slate-800';
        case 'door':
          return 'bg-yellow-900 border border-yellow-700';
        case 'grass':
          return 'bg-green-900';
        case 'water':
          return 'bg-blue-900';
        case 'building':
          return 'bg-slate-600 border border-slate-500';
        case 'ruins':
          return 'bg-stone-700';
        default:
          return 'bg-slate-700';
      }
    }

    // Explored but not visible (fog of war)
    if (tile.explored) {
      switch (tile.type) {
        case 'floor':
          return 'bg-slate-900 opacity-40';
        case 'wall':
          return 'bg-slate-950 opacity-40';
        case 'door':
          return 'bg-yellow-950 opacity-40';
        case 'grass':
          return 'bg-green-950 opacity-40';
        case 'water':
          return 'bg-blue-950 opacity-40';
        case 'building':
          return 'bg-slate-800 opacity-40';
        case 'ruins':
          return 'bg-stone-900 opacity-40';
        default:
          return 'bg-slate-900 opacity-40';
      }
    }

    // Unexplored (completely hidden)
    return 'bg-slate-950';
  };

  const getTileContent = (x: number, y: number): React.ReactNode => {
    const tile = tiles[y]?.[x];
    if (!tile) return null;

    const tileKey = `${x},${y}`;
    const isVisible = visibleTiles.has(tileKey);
    const isPlayer = x === playerPosition.x && y === playerPosition.y;

    // Check if enemy on tile
    const enemy = enemies.find(e => e.position.x === x && e.position.y === y);

    if (isPlayer) {
      return <User className={`w-${Math.max(2, tileSize/4)} h-${Math.max(2, tileSize/4)} text-white`} />;
    }

    if (enemy && isVisible) {
      return <Skull className={`w-${Math.max(2, tileSize/4)} h-${Math.max(2, tileSize/4)} text-red-200`} />;
    }

    // Show resources if visible
    if (isVisible && tile.resources && tile.resources.length > 0) {
      return <div className="text-[6px] text-yellow-400">●</div>;
    }

    return null;
  };

  return (
    <div className={`${showMinimap ? 'w-full' : 'w-full max-w-4xl mx-auto'} bg-slate-950 border border-slate-800 rounded-sm p-2 overflow-hidden`}>
      {/* Map Header */}
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-mono text-slate-400">
            {showMinimap ? 'MINIMAP' : 'TACTICAL VIEW'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-700"></div>
            <span>Visible</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-900 opacity-40"></div>
            <span>Explored</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-950"></div>
            <span>Unknown</span>
          </div>
        </div>
      </div>

      {/* Map Grid */}
      <div
        className="relative overflow-auto bg-slate-950/50 rounded border border-slate-900 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950"
        style={{
          maxHeight: showMinimap ? '200px' : '400px',
          maxWidth: '100%'
        }}
      >
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: `repeat(${viewportWidth}, ${tileSize}px)`,
            gridTemplateRows: `repeat(${viewportHeight}, ${tileSize}px)`
          }}
        >
          {Array.from({ length: viewportHeight }).map((_, rowIndex) => {
            const y = startY + rowIndex;
            return Array.from({ length: viewportWidth }).map((_, colIndex) => {
              const x = startX + colIndex;
              const tileKey = `${x},${y}`;

              return (
                <div
                  key={tileKey}
                  className={`${getTileColor(x, y)} flex items-center justify-center text-[8px] transition-colors duration-200`}
                  style={{
                    width: `${tileSize}px`,
                    height: `${tileSize}px`
                  }}
                  title={`(${x}, ${y}) - ${tiles[y]?.[x]?.type || 'unknown'}`}
                >
                  {getTileContent(x, y)}
                </div>
              );
            });
          })}
        </div>
      </div>

      {/* Position Info */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 px-2">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>
            Position: ({playerPosition.x}, {playerPosition.y})
          </span>
        </div>
        <div>
          Visible: {visibleTiles.size} tiles | Enemies: {enemies.length}
        </div>
      </div>
    </div>
  );
};

export default MapView;
