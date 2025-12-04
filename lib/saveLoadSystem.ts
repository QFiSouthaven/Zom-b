/**
 * @file saveLoadSystem.ts
 * @description Save/Load System for Game State Persistence
 *
 * Handles saving game state to localStorage, cloud storage, or file export.
 * Supports autosave, manual save, and save slot management.
 */

import { GameState, Message, PlayerCharacter, GameConfig } from '../types';
import { worldManager } from './worldStateManager';

export interface SaveData {
  version: string;
  timestamp: number;
  sessionId: string;
  gameState: GameState;
  messages: Message[];
  worldState: string; // Serialized world
  playerCharacter: PlayerCharacter;
  config: GameConfig;
  playTime: number; // Seconds
  metadata: {
    saveSlot: number;
    saveName: string;
    location: string;
    day: number;
    playerLevel: number;
  };
}

export interface SaveSlot {
  id: number;
  name: string;
  data: SaveData | null;
  lastModified: number;
}

const SAVE_VERSION = '1.0.0';
const MAX_SAVE_SLOTS = 5;
const AUTOSAVE_INTERVAL = 300000; // 5 minutes
const STORAGE_KEY_PREFIX = 'zomb_save_';

export class SaveLoadSystem {
  private autosaveEnabled: boolean = true;
  private autosaveTimer: NodeJS.Timeout | null = null;
  private playTimeStart: number = Date.now();
  private currentSessionId: string = this.generateSessionId();

  /**
   * Save game to specific slot
   */
  save(
    gameState: GameState,
    messages: Message[],
    config: GameConfig,
    slotId: number = 0,
    customName?: string
  ): boolean {
    try {
      const saveData: SaveData = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        sessionId: this.currentSessionId,
        gameState,
        messages,
        worldState: worldManager.exportState(),
        playerCharacter: config.character,
        config,
        playTime: this.getPlayTime(),
        metadata: {
          saveSlot: slotId,
          saveName: customName || `Save ${slotId + 1}`,
          location: gameState.location,
          day: gameState.day,
          playerLevel: this.calculatePlayerLevel(gameState)
        }
      };

      // Save to localStorage
      const key = `${STORAGE_KEY_PREFIX}${slotId}`;
      localStorage.setItem(key, JSON.stringify(saveData));

      // Update slot metadata
      this.updateSlotMetadata(slotId, saveData);

      console.log(`Game saved to slot ${slotId}`);
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  }

  /**
   * Load game from specific slot
   */
  load(slotId: number): SaveData | null {
    try {
      const key = `${STORAGE_KEY_PREFIX}${slotId}`;
      const savedData = localStorage.getItem(key);

      if (!savedData) {
        console.log(`No save data in slot ${slotId}`);
        return null;
      }

      const saveData: SaveData = JSON.parse(savedData);

      // Version check
      if (saveData.version !== SAVE_VERSION) {
        console.warn('Save version mismatch, attempting migration...');
        // Could implement migration logic here
      }

      // Import world state
      worldManager.importState(saveData.worldState);

      console.log(`Game loaded from slot ${slotId}`);
      return saveData;
    } catch (error) {
      console.error('Load failed:', error);
      return null;
    }
  }

  /**
   * Delete save from slot
   */
  deleteSave(slotId: number): boolean {
    try {
      const key = `${STORAGE_KEY_PREFIX}${slotId}`;
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_metadata`);
      console.log(`Save slot ${slotId} deleted`);
      return true;
    } catch (error) {
      console.error('Delete save failed:', error);
      return false;
    }
  }

  /**
   * Get all save slots
   */
  getSaveSlots(): SaveSlot[] {
    const slots: SaveSlot[] = [];

    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      try {
        const key = `${STORAGE_KEY_PREFIX}${i}`;
        const metadataKey = `${key}_metadata`;
        const savedData = localStorage.getItem(key);
        const metadata = localStorage.getItem(metadataKey);

        if (savedData && metadata) {
          const metaObj = JSON.parse(metadata);
          slots.push({
            id: i,
            name: metaObj.saveName || `Save ${i + 1}`,
            data: JSON.parse(savedData),
            lastModified: metaObj.lastModified || 0
          });
        } else {
          slots.push({
            id: i,
            name: `Empty Slot ${i + 1}`,
            data: null,
            lastModified: 0
          });
        }
      } catch (error) {
        slots.push({
          id: i,
          name: `Corrupted Slot ${i + 1}`,
          data: null,
          lastModified: 0
        });
      }
    }

    return slots;
  }

  /**
   * Export save to file
   */
  exportToFile(slotId: number): void {
    const saveData = this.load(slotId);
    if (!saveData) return;

    const blob = new Blob([JSON.stringify(saveData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zomb_save_${saveData.metadata.saveName}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import save from file
   */
  async importFromFile(file: File): Promise<SaveData | null> {
    try {
      const text = await file.text();
      const saveData: SaveData = JSON.parse(text);

      // Validate save data structure
      if (!this.validateSaveData(saveData)) {
        throw new Error('Invalid save file format');
      }

      return saveData;
    } catch (error) {
      console.error('Import failed:', error);
      return null;
    }
  }

  /**
   * Enable/disable autosave
   */
  setAutosave(enabled: boolean): void {
    this.autosaveEnabled = enabled;

    if (enabled) {
      this.startAutosave();
    } else {
      this.stopAutosave();
    }
  }

  /**
   * Start autosave timer
   */
  private startAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }

    // Autosave not implemented in this basic version
    // Would need reference to current game state
  }

  /**
   * Stop autosave timer
   */
  private stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /**
   * Get play time in seconds
   */
  private getPlayTime(): number {
    return Math.floor((Date.now() - this.playTimeStart) / 1000);
  }

  /**
   * Calculate player level from skills
   */
  private calculatePlayerLevel(gameState: GameState): number {
    const totalSkillLevels = Object.values(gameState.skills).reduce((sum, level) => sum + level, 0);
    return Math.floor(totalSkillLevels / 5);
  }

  /**
   * Update slot metadata
   */
  private updateSlotMetadata(slotId: number, saveData: SaveData): void {
    const key = `${STORAGE_KEY_PREFIX}${slotId}_metadata`;
    const metadata = {
      saveName: saveData.metadata.saveName,
      lastModified: saveData.timestamp,
      location: saveData.metadata.location,
      day: saveData.metadata.day
    };

    localStorage.setItem(key, JSON.stringify(metadata));
  }

  /**
   * Validate save data structure
   */
  private validateSaveData(data: any): data is SaveData {
    return (
      data &&
      typeof data === 'object' &&
      data.version &&
      data.gameState &&
      data.messages &&
      data.worldState &&
      data.playerCharacter &&
      data.config
    );
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if localStorage is available
   */
  isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo(): { used: number; total: number; percentage: number } {
    let used = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          used += value.length;
        }
      }
    }

    const total = 5 * 1024 * 1024; // 5MB typical limit
    const percentage = (used / total) * 100;

    return { used, total, percentage };
  }

  /**
   * Clear all saves
   */
  clearAllSaves(): boolean {
    try {
      for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        this.deleteSave(i);
      }
      console.log('All saves cleared');
      return true;
    } catch (error) {
      console.error('Clear all saves failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const saveLoadSystem = new SaveLoadSystem();

export default SaveLoadSystem;
