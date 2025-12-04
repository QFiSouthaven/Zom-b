/**
 * @file App.tsx
 * @description Main Application Controller.
 * 
 * Handles the high-level routing between:
 * 1. SetupScreen (Configuration)
 * 2. GameScreen (Active Gameplay)
 */

import React, { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import { GameConfig } from './types';

const App: React.FC = () => {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  /**
   * Transitions from Setup to Game.
   * @param config - The user-defined game settings.
   */
  const handleStartGame = (config: GameConfig) => {
    setGameConfig(config);
  };

  /**
   * Resets the application state to return to the Setup screen.
   */
  const handleExitGame = () => {
    // Confirm exit? For now just reset.
    if (window.confirm("Are you sure you want to end this session? Progress will be lost.")) {
      setGameConfig(null);
    }
  };

  return (
    <div className="antialiased text-zinc-200">
      {gameConfig ? (
        <GameScreen config={gameConfig} onExit={handleExitGame} />
      ) : (
        <SetupScreen onStart={handleStartGame} />
      )}
    </div>
  );
};

export default App;