/**
 * @file ActionPanel.tsx
 * @description Structured Action Button Panel
 *
 * Replaces free-form text input with organized action buttons
 * for both exploration and combat phases.
 */

import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Backpack,
  Users,
  Home,
  Heart,
  Zap,
  Eye,
  Crosshair,
  Shield,
  Move,
  PlusSquare,
  LogOut,
  Sword,
  AlertTriangle,
  Building,
  Trees,
  Hospital,
  Store,
  Warehouse
} from 'lucide-react';
import { GameState } from '../types';

interface ActionPanelProps {
  gameState: GameState;
  isProcessing: boolean;
  onAction: (actionText: string) => void;
}

interface ActionButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: string;
  description: string;
  apCost?: number;
  color: 'default' | 'danger' | 'success' | 'warning' | 'info';
  requiresAP?: number;
  phase?: 'exploration' | 'combat' | 'both';
}

const ActionPanel: React.FC<ActionPanelProps> = ({ gameState, isProcessing, onAction }) => {
  const [selectedCategory, setSelectedCategory] = useState<'movement' | 'interaction' | 'combat'>('movement');
  const isCombat = gameState.phase === 'combat';

  // Exploration Actions
  const explorationActions: ActionButton[] = [
    // Movement & Exploration
    {
      id: 'explore-area',
      label: 'Explore Area',
      icon: <Search className="w-4 h-4" />,
      action: 'Carefully explore the current area for supplies and threats',
      description: 'Search surroundings',
      color: 'info',
      phase: 'exploration'
    },
    {
      id: 'move-hospital',
      label: 'Hospital',
      icon: <Hospital className="w-4 h-4" />,
      action: 'Travel to the abandoned hospital',
      description: 'Find medical supplies',
      color: 'success',
      phase: 'exploration'
    },
    {
      id: 'move-supermarket',
      label: 'Supermarket',
      icon: <Store className="w-4 h-4" />,
      action: 'Head to the ransacked supermarket',
      description: 'Search for food/water',
      color: 'warning',
      phase: 'exploration'
    },
    {
      id: 'move-warehouse',
      label: 'Warehouse',
      icon: <Warehouse className="w-4 h-4" />,
      action: 'Investigate the industrial warehouse',
      description: 'Find tools/weapons',
      color: 'default',
      phase: 'exploration'
    },
    {
      id: 'move-forest',
      label: 'Forest',
      icon: <Trees className="w-4 h-4" />,
      action: 'Move to the forest outskirts',
      description: 'Gather natural resources',
      color: 'success',
      phase: 'exploration'
    },
    {
      id: 'return-safehouse',
      label: 'Return to Safehouse',
      icon: <Home className="w-4 h-4" />,
      action: 'Return to the safehouse to rest and recover',
      description: 'Rest and heal',
      color: 'info',
      phase: 'exploration'
    },

    // Interaction
    {
      id: 'scavenge',
      label: 'Scavenge',
      icon: <Backpack className="w-4 h-4" />,
      action: 'Thoroughly scavenge this location for useful items',
      description: 'Search for loot',
      color: 'warning',
      phase: 'exploration'
    },
    {
      id: 'rest',
      label: 'Rest',
      icon: <Heart className="w-4 h-4" />,
      action: 'Take a break to restore stamina and treat minor wounds',
      description: 'Recover HP/Stamina',
      color: 'success',
      phase: 'exploration'
    },
    {
      id: 'stealth',
      label: 'Stealth Mode',
      icon: <Eye className="w-4 h-4" />,
      action: 'Move carefully and quietly to avoid detection',
      description: 'Sneak past enemies',
      color: 'info',
      phase: 'exploration'
    },
    {
      id: 'listen',
      label: 'Listen',
      icon: <AlertTriangle className="w-4 h-4" />,
      action: 'Stop and listen carefully for nearby threats',
      description: 'Detect zombies',
      color: 'warning',
      phase: 'exploration'
    }
  ];

  // Combat Actions (already exist but organized here)
  const combatActions: ActionButton[] = [
    {
      id: 'attack',
      label: 'Attack',
      icon: <Crosshair className="w-4 h-4" />,
      action: 'Attack nearest enemy with equipped weapon',
      description: 'Strike with weapon',
      apCost: 1,
      requiresAP: 1,
      color: 'danger',
      phase: 'combat'
    },
    {
      id: 'move-combat',
      label: 'Reposition',
      icon: <Move className="w-4 h-4" />,
      action: 'Dash to change range / improve position',
      description: 'Change range',
      apCost: 1,
      requiresAP: 1,
      color: 'default',
      phase: 'combat'
    },
    {
      id: 'defend',
      label: 'Defend',
      icon: <Shield className="w-4 h-4" />,
      action: 'Defensive stance and observe',
      description: 'Block damage',
      apCost: 1,
      requiresAP: 1,
      color: 'info',
      phase: 'combat'
    },
    {
      id: 'heal',
      label: 'Heal',
      icon: <PlusSquare className="w-4 h-4" />,
      action: 'Use healing item',
      description: 'Restore HP',
      apCost: 1,
      requiresAP: 1,
      color: 'success',
      phase: 'combat'
    },
    {
      id: 'flee',
      label: 'Flee',
      icon: <LogOut className="w-4 h-4" />,
      action: 'Attempt to flee from combat',
      description: '60% success chance',
      apCost: 1,
      requiresAP: 1,
      color: 'warning',
      phase: 'combat'
    }
  ];

  const getButtonColor = (color: string, disabled: boolean) => {
    if (disabled) {
      return 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50';
    }

    switch (color) {
      case 'danger':
        return 'bg-red-900/20 border-red-500/50 text-red-400 hover:bg-red-900/40';
      case 'success':
        return 'bg-green-900/20 border-green-500/50 text-green-400 hover:bg-green-900/40';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/40';
      case 'info':
        return 'bg-blue-900/20 border-blue-500/50 text-blue-400 hover:bg-blue-900/40';
      default:
        return 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700';
    }
  };

  const renderButton = (btn: ActionButton) => {
    const disabled =
      isProcessing ||
      (btn.requiresAP !== undefined && gameState.actionPoints < btn.requiresAP);

    return (
      <button
        key={btn.id}
        onClick={() => !disabled && onAction(btn.action)}
        disabled={disabled}
        className={`group relative px-4 py-3 border text-xs font-mono uppercase transition-all flex flex-col items-center justify-center gap-1.5 min-w-[120px] ${getButtonColor(
          btn.color,
          disabled
        )}`}
      >
        <div className="flex items-center gap-2">
          {btn.icon}
          <span className="font-bold">{btn.label}</span>
        </div>
        {btn.apCost && (
          <span className="text-[9px] bg-slate-950/30 px-1.5 py-0.5 rounded text-slate-400 font-mono">
            {btn.apCost} AP
          </span>
        )}
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-slate-950 text-slate-200 text-[10px] p-2 rounded border border-slate-700 shadow-2xl z-50 pointer-events-none text-left">
          <span className="block font-bold text-white mb-1 border-b border-slate-800 pb-1">
            {btn.label}
          </span>
          <span className="block text-slate-400">{btn.description}</span>
          {btn.apCost && (
            <span className="block text-slate-500 mt-1">Cost: {btn.apCost} AP</span>
          )}
        </div>
      </button>
    );
  };

  if (isCombat) {
    // Combat Phase: Show combat actions
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">
            Combat Actions
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {gameState.actionPoints} / {gameState.maxActionPoints} AP
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {combatActions.map((btn) => renderButton(btn))}
        </div>
      </div>
    );
  }

  // Exploration Phase: Show categorized actions
  return (
    <div className="space-y-3">
      {/* Category Selector */}
      <div className="flex gap-2 p-1 bg-slate-900 rounded-sm">
        <button
          onClick={() => setSelectedCategory('movement')}
          className={`flex-1 py-2 px-3 text-xs font-bold font-mono rounded-sm transition-all flex items-center justify-center gap-2 ${
            selectedCategory === 'movement'
              ? 'bg-slate-700 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MapPin className="w-3 h-3" />
          TRAVEL
        </button>
        <button
          onClick={() => setSelectedCategory('interaction')}
          className={`flex-1 py-2 px-3 text-xs font-bold font-mono rounded-sm transition-all flex items-center justify-center gap-2 ${
            selectedCategory === 'interaction'
              ? 'bg-slate-700 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Backpack className="w-3 h-3" />
          ACTIONS
        </button>
        <button
          onClick={() => setSelectedCategory('combat')}
          className={`flex-1 py-2 px-3 text-xs font-bold font-mono rounded-sm transition-all flex items-center justify-center gap-2 ${
            selectedCategory === 'combat'
              ? 'bg-slate-700 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Sword className="w-3 h-3" />
          ENGAGE
        </button>
      </div>

      {/* Action Grid */}
      <div className="flex flex-wrap gap-2">
        {selectedCategory === 'movement' &&
          explorationActions
            .filter((btn) => ['explore-area', 'move-hospital', 'move-supermarket', 'move-warehouse', 'move-forest', 'return-safehouse'].includes(btn.id))
            .map((btn) => renderButton(btn))}

        {selectedCategory === 'interaction' &&
          explorationActions
            .filter((btn) => ['scavenge', 'rest', 'stealth', 'listen'].includes(btn.id))
            .map((btn) => renderButton(btn))}

        {selectedCategory === 'combat' && (
          <div className="w-full p-4 bg-slate-900 border border-slate-800 rounded-sm text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-mono">
              No active combat. Explore dangerous areas to encounter zombies.
            </p>
            <button
              onClick={() => onAction('Search for zombies to engage')}
              disabled={isProcessing}
              className="mt-3 px-4 py-2 bg-red-900/20 border border-red-500/50 text-red-400 hover:bg-red-900/40 text-xs font-mono uppercase transition-all disabled:opacity-50"
            >
              <Sword className="w-3 h-3 inline mr-2" />
              Seek Combat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionPanel;
