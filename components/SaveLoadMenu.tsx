/**
 * @file SaveLoadMenu.tsx
 * @description Save/Load Menu Component
 *
 * UI for managing save files, loading games, and exporting/importing saves.
 */

import React, { useState, useEffect } from 'react';
import { saveLoadSystem, SaveSlot } from '../lib/saveLoadSystem';
import { GameState, Message, GameConfig } from '../types';
import { Save, Upload, Download, Trash2, Clock, MapPin, X } from 'lucide-react';

interface SaveLoadMenuProps {
  currentGameState: GameState;
  currentMessages: Message[];
  currentConfig: GameConfig;
  onLoad: (gameState: GameState, messages: Message[], config: GameConfig) => void;
  onClose: () => void;
}

const SaveLoadMenu: React.FC<SaveLoadMenuProps> = ({
  currentGameState,
  currentMessages,
  currentConfig,
  onLoad,
  onClose
}) => {
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [mode, setMode] = useState<'save' | 'load'>('save');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    refreshSlots();
  }, []);

  const refreshSlots = () => {
    setSlots(saveLoadSystem.getSaveSlots());
  };

  const handleSave = (slotId: number) => {
    const name = customName || `Save ${slotId + 1}`;
    const success = saveLoadSystem.save(
      currentGameState,
      currentMessages,
      currentConfig,
      slotId,
      name
    );

    if (success) {
      alert(`Game saved to slot ${slotId + 1}`);
      refreshSlots();
      setCustomName('');
    } else {
      alert('Save failed!');
    }
  };

  const handleLoad = (slotId: number) => {
    const saveData = saveLoadSystem.load(slotId);

    if (saveData) {
      onLoad(saveData.gameState, saveData.messages, saveData.config);
      onClose();
    } else {
      alert('Load failed!');
    }
  };

  const handleDelete = (slotId: number) => {
    if (confirm(`Delete save in slot ${slotId + 1}?`)) {
      saveLoadSystem.deleteSave(slotId);
      refreshSlots();
    }
  };

  const handleExport = (slotId: number) => {
    saveLoadSystem.exportToFile(slotId);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const saveData = await saveLoadSystem.importFromFile(file);

    if (saveData) {
      // Save to first empty slot
      const emptySlot = slots.findIndex(s => !s.data);
      if (emptySlot !== -1) {
        saveLoadSystem.save(
          saveData.gameState,
          saveData.messages,
          saveData.config,
          emptySlot,
          saveData.metadata.saveName
        );
        alert(`Imported to slot ${emptySlot + 1}`);
        refreshSlots();
      } else {
        alert('No empty slots available!');
      }
    } else {
      alert('Import failed!');
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-sm shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold font-mono text-slate-100">SAVE / LOAD</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 p-4 border-b border-slate-800">
          <button
            onClick={() => setMode('save')}
            className={`flex-1 py-2 px-4 text-sm font-mono rounded-sm transition-all ${
              mode === 'save'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Save className="w-4 h-4 inline mr-2" />
            SAVE GAME
          </button>
          <button
            onClick={() => setMode('load')}
            className={`flex-1 py-2 px-4 text-sm font-mono rounded-sm transition-all ${
              mode === 'load'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            LOAD GAME
          </button>
        </div>

        {/* Save Name Input (Save Mode Only) */}
        {mode === 'save' && (
          <div className="p-4 border-b border-slate-800">
            <label className="block text-xs font-mono text-slate-400 mb-2">
              SAVE NAME (OPTIONAL)
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter custom save name..."
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Save Slots */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={`p-4 border rounded-sm transition-all cursor-pointer ${
                selectedSlot === slot.id
                  ? 'bg-blue-900/20 border-blue-500/50'
                  : slot.data
                  ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
              onClick={() => setSelectedSlot(slot.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-slate-500">
                      SLOT {slot.id + 1}
                    </span>
                    <span className="text-sm font-bold font-mono text-slate-100">
                      {slot.name}
                    </span>
                  </div>

                  {slot.data && (
                    <div className="space-y-1 text-xs font-mono text-slate-400">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        <span>{slot.data.metadata.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(slot.lastModified)}</span>
                      </div>
                      <div>
                        Day {slot.data.metadata.day} • Level{' '}
                        {slot.data.metadata.playerLevel}
                      </div>
                    </div>
                  )}

                  {!slot.data && (
                    <p className="text-xs font-mono text-slate-600">Empty Slot</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {mode === 'save' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave(slot.id);
                      }}
                      className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-sm transition-colors"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  )}

                  {mode === 'load' && slot.data && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoad(slot.id);
                      }}
                      className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-sm transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  )}

                  {slot.data && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(slot.id);
                        }}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(slot.id);
                        }}
                        className="p-2 bg-red-900 hover:bg-red-800 text-red-300 rounded-sm transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Import Button */}
        <div className="p-4 border-t border-slate-800">
          <label className="block w-full">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <div className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-center text-sm font-mono rounded-sm cursor-pointer transition-colors">
              <Download className="w-4 h-4 inline mr-2" />
              IMPORT SAVE FROM FILE
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SaveLoadMenu;
