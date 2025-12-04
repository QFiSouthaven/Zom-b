/**
 * @file peerGameProtocol.ts
 * @description Enhanced Peer-to-Peer Game Protocol
 *
 * Implements GAMEIN-style event-based messaging for local multiplayer
 * with deterministic state synchronization.
 *
 * Features:
 * - Typed message protocol
 * - Action validation
 * - State authority model (Host is authoritative)
 * - Rollback for out-of-sync clients
 */

import { GameState, Message, PlayerCharacter } from '../types';
import { CombatAction, CombatResult } from './combatEngine';

/**
 * Message Types for P2P Communication
 */
export type GameMessage =
  // Initial Connection
  | {
      type: 'HANDSHAKE';
      character: PlayerCharacter;
      clientVersion: string;
    }
  | {
      type: 'HANDSHAKE_ACK';
      hostVersion: string;
      worldSeed: string;
      currentGameState: GameState;
    }

  // State Synchronization
  | {
      type: 'STATE_SYNC';
      gameState: GameState;
      messages: Message[];
      timestamp: number;
    }
  | {
      type: 'STATE_REQUEST';
      reason: 'out_of_sync' | 'reconnect' | 'initial';
    }

  // Game Actions
  | {
      type: 'GAME_ACTION';
      actionId: string;
      action: 'explore' | 'combat' | 'inventory' | 'custom';
      payload: CombatAction | { text: string };
      timestamp: number;
    }
  | {
      type: 'ACTION_RESULT';
      actionId: string;
      success: boolean;
      results: CombatResult[];
      newGameState: GameState;
    }
  | {
      type: 'ACTION_REJECTED';
      actionId: string;
      reason: string;
      currentGameState: GameState; // Resync
    }

  // Combat-Specific
  | {
      type: 'COMBAT_START';
      enemyTypes: string[];
      isNight: boolean;
    }
  | {
      type: 'COMBAT_UPDATE';
      gameState: GameState;
      combatLog: CombatResult[];
    }
  | {
      type: 'COMBAT_END';
      outcome: 'victory' | 'defeat' | 'fled';
      rewards?: { xp: number; loot: string[] };
    }

  // Player Events
  | {
      type: 'PLAYER_MESSAGE';
      playerId: string;
      message: string;
    }
  | {
      type: 'PLAYER_DISCONNECTED';
      playerId: string;
    }

  // System Events
  | {
      type: 'PING';
      timestamp: number;
    }
  | {
      type: 'PONG';
      timestamp: number;
    }
  | {
      type: 'ERROR';
      code: string;
      message: string;
    };

/**
 * Protocol Version (for compatibility checking)
 */
export const PROTOCOL_VERSION = '1.0.0';

/**
 * Message Validator
 */
export class MessageValidator {
  /**
   * Validate message structure
   */
  static validate(message: any): message is GameMessage {
    if (!message || typeof message !== 'object') return false;
    if (!message.type || typeof message.type !== 'string') return false;

    // Type-specific validation
    switch (message.type) {
      case 'HANDSHAKE':
        return !!message.character && typeof message.clientVersion === 'string';

      case 'STATE_SYNC':
        return !!message.gameState && Array.isArray(message.messages);

      case 'GAME_ACTION':
        return (
          typeof message.actionId === 'string' &&
          typeof message.action === 'string' &&
          !!message.payload
        );

      case 'COMBAT_UPDATE':
        return !!message.gameState && Array.isArray(message.combatLog);

      default:
        return true; // Allow other types (permissive)
    }
  }

  /**
   * Validate action against current game state
   */
  static validateAction(action: CombatAction, gameState: GameState): { valid: boolean; reason?: string } {
    // Not in combat phase
    if (gameState.phase !== 'combat' && action.type !== 'flee') {
      return { valid: false, reason: 'Not in combat phase' };
    }

    // Not enough AP
    if (gameState.actionPoints < 1) {
      return { valid: false, reason: 'Insufficient action points' };
    }

    // Attack: Target must exist
    if (action.type === 'attack') {
      if (!action.targetId) {
        return { valid: false, reason: 'No target specified' };
      }

      const target = gameState.enemies.find(e => e.id === action.targetId);
      if (!target || target.hp <= 0) {
        return { valid: false, reason: 'Invalid or dead target' };
      }
    }

    // Use Item: Item must be in inventory
    if (action.type === 'use_item') {
      if (!action.itemId) {
        return { valid: false, reason: 'No item specified' };
      }

      if (!gameState.inventory.includes(action.itemId)) {
        return { valid: false, reason: 'Item not in inventory' };
      }
    }

    return { valid: true };
  }
}

/**
 * Action Queue for Client-Side Prediction
 */
export class ActionQueue {
  private queue: Map<string, { action: CombatAction; timestamp: number }> = new Map();
  private pendingActionId: string | null = null;

  /**
   * Add action to queue
   */
  enqueue(actionId: string, action: CombatAction): void {
    this.queue.set(actionId, { action, timestamp: Date.now() });
    if (!this.pendingActionId) {
      this.pendingActionId = actionId;
    }
  }

  /**
   * Remove action from queue (on acknowledgment)
   */
  dequeue(actionId: string): void {
    this.queue.delete(actionId);
    if (this.pendingActionId === actionId) {
      this.pendingActionId = null;
    }
  }

  /**
   * Get pending action
   */
  getPending(): { actionId: string; action: CombatAction } | null {
    if (!this.pendingActionId) return null;

    const entry = this.queue.get(this.pendingActionId);
    if (!entry) return null;

    return { actionId: this.pendingActionId, action: entry.action };
  }

  /**
   * Clear all actions (on resync)
   */
  clear(): void {
    this.queue.clear();
    this.pendingActionId = null;
  }

  /**
   * Check if action is timed out
   */
  isTimedOut(actionId: string, timeoutMs: number = 5000): boolean {
    const entry = this.queue.get(actionId);
    if (!entry) return false;

    return Date.now() - entry.timestamp > timeoutMs;
  }
}

/**
 * State Synchronization Helper
 */
export class StateSyncManager {
  private lastSyncTimestamp: number = 0;
  private syncIntervalMs: number = 500; // Sync every 500ms if state changed

  /**
   * Check if state should be synced
   */
  shouldSync(forceSync: boolean = false): boolean {
    if (forceSync) return true;

    const now = Date.now();
    if (now - this.lastSyncTimestamp >= this.syncIntervalMs) {
      this.lastSyncTimestamp = now;
      return true;
    }

    return false;
  }

  /**
   * Create state sync message
   */
  createSyncMessage(gameState: GameState, messages: Message[]): GameMessage {
    return {
      type: 'STATE_SYNC',
      gameState,
      messages,
      timestamp: Date.now()
    };
  }

  /**
   * Handle incoming state sync
   */
  handleSync(
    currentState: GameState,
    incomingState: GameState
  ): { shouldUpdate: boolean; state: GameState } {
    // Always trust host state (server-authoritative model)
    return {
      shouldUpdate: true,
      state: incomingState
    };
  }
}

/**
 * Connection Health Monitor
 */
export class ConnectionMonitor {
  private lastPingTime: number = 0;
  private lastPongTime: number = 0;
  private pingIntervalMs: number = 3000; // Ping every 3 seconds
  private timeoutMs: number = 10000; // 10 seconds timeout

  /**
   * Check if should send ping
   */
  shouldPing(): boolean {
    const now = Date.now();
    return now - this.lastPingTime >= this.pingIntervalMs;
  }

  /**
   * Record ping sent
   */
  recordPing(): void {
    this.lastPingTime = Date.now();
  }

  /**
   * Record pong received
   */
  recordPong(): void {
    this.lastPongTime = Date.now();
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    const now = Date.now();
    return now - this.lastPongTime < this.timeoutMs;
  }

  /**
   * Get latency (ms)
   */
  getLatency(): number {
    return this.lastPongTime - this.lastPingTime;
  }
}

/**
 * Protocol Utilities
 */
export const ProtocolUtils = {
  /**
   * Generate unique action ID
   */
  generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Create error message
   */
  createError(code: string, message: string): GameMessage {
    return {
      type: 'ERROR',
      code,
      message
    };
  },

  /**
   * Create handshake message
   */
  createHandshake(character: PlayerCharacter): GameMessage {
    return {
      type: 'HANDSHAKE',
      character,
      clientVersion: PROTOCOL_VERSION
    };
  },

  /**
   * Create handshake acknowledgment
   */
  createHandshakeAck(worldSeed: string, gameState: GameState): GameMessage {
    return {
      type: 'HANDSHAKE_ACK',
      hostVersion: PROTOCOL_VERSION,
      worldSeed,
      currentGameState: gameState
    };
  },

  /**
   * Create action message
   */
  createActionMessage(action: CombatAction): GameMessage {
    return {
      type: 'GAME_ACTION',
      actionId: this.generateActionId(),
      action: 'combat',
      payload: action,
      timestamp: Date.now()
    };
  },

  /**
   * Create action result message
   */
  createActionResult(
    actionId: string,
    success: boolean,
    results: CombatResult[],
    newGameState: GameState
  ): GameMessage {
    return {
      type: 'ACTION_RESULT',
      actionId,
      success,
      results,
      newGameState
    };
  },

  /**
   * Create action rejection message
   */
  createActionRejection(actionId: string, reason: string, gameState: GameState): GameMessage {
    return {
      type: 'ACTION_REJECTED',
      actionId,
      reason,
      currentGameState: gameState
    };
  }
};

export default {
  MessageValidator,
  ActionQueue,
  StateSyncManager,
  ConnectionMonitor,
  ProtocolUtils,
  PROTOCOL_VERSION
};
