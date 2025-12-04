/**
 * @file types.ts
 * @description Core Data Structures and Type Definitions.
 * 
 * This file defines the "Source of Truth" for the application state.
 * The `GameState` interface is particularly critical as it is the schema
 * used for JSON injection/parsing between the AI Model and the Frontend.
 */

/**
 * Defines the static attributes of the player character selected at setup.
 */
export interface PlayerCharacter {
  name: string;
  profession: string;
  perk: string;
}

/**
 * Represents a single hostile entity on the battlefield.
 * Used in the Combat HUD for rendering enemy cards.
 */
export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  status: string; // e.g., "Active", "Stunned", "Bleeding"
  intent?: string; // AI-projected next move: "Attack", "Move", "Block", "Scream"
  range?: 'Melee' | 'Near' | 'Far'; // Tactical distance relative to player
}

/**
 * The core state object synchronized between AI, Client, and Peers.
 * This object is embedded in every LLM response to maintain continuity.
 */
export interface GameState {
  // Survival Stats
  hp: number;
  maxHp: number;
  infectionLevel: number; // 0-100% viral load
  supplies: number; // Generic resource abstracting food/ammo
  
  // World State
  day: number;
  time: string; // Morning, Noon, Evening, Night
  location: string;
  inventory: string[];
  equippedWeapon: string | null; // Currently active gear affecting combat range/stats
  
  // Skills System (RPG Progression)
  skills: { [key: string]: number }; // Skill Name -> Level (1-10)

  // Combat System
  phase: 'exploration' | 'combat';
  actionPoints: number; // Current AP remaining in the turn
  maxActionPoints: number;
  enemies: Enemy[]; // Array of active hostiles
  
  // Log
  lastActionSummary: string; // Brief summary for UI or history tracking
}

/**
 * Represents a chat message in the UI stream.
 */
export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  imageUrl?: string; // If the message contains a generated scene visual
  timestamp: number;
  isVisualizing?: boolean; // UI state for loading indicators
}

/**
 * Global configuration passed from SetupScreen to GameScreen.
 * Controls initialization parameters and engine selection.
 */
export interface GameConfig {
  character: PlayerCharacter;
  
  // AI Engine Configuration
  engineMode: 'gemini' | 'local';
  localEndpoint?: string; // URL for LM Studio / Local OpenAI-compatible server
  localModelName?: string; 
  
  // Multiplayer Configuration
  isMultiplayer: boolean;
  isHost: boolean;
  hostPeerId?: string; // The ID to connect to (if Client)
}

/**
 * Discriminated Union for PeerJS Data Packets.
 * Handles communication between Host and Client instances.
 */
export type PeerData = 
  | { type: 'STATE_SYNC'; gameState: GameState; messages: Message[] } // Host -> Client: Full state update
  | { type: 'ACTION'; text: string } // Client -> Host: User input/command
  | { type: 'HANDSHAKE'; character: PlayerCharacter }; // Client -> Host: Initial connection info