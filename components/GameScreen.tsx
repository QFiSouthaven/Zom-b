/**
 * @file GameScreen.tsx
 * @description Main Game Interface.
 * 
 * This component handles the primary game loop:
 * 1. **Chat Stream**: Displaying narrative logs from the AI.
 * 2. **Combat HUD**: Rendering interactive enemy cards during combat phases.
 * 3. **Tactical Sidebar**: Displaying health, inventory, and skills.
 * 4. **Multiplayer Logic**: Synchronizing state via `peerService` if in Client mode.
 */

import React, { useState, useEffect, useRef } from 'react';
import { GameConfig, GameState, Message, Enemy } from '../types';
import { INITIAL_GAME_STATE } from '../constants';
import * as GeminiService from '../services/geminiService';
import { peerService } from '../services/peerService';
import Button from './Button';
import MarkdownText from './MarkdownText';
import { Send, Image as ImageIcon, Heart, MapPin, Backpack, Activity, Skull, Clock, Shield, Target, Menu, Crosshair, Sword, Eye, PlusSquare, Search, Crown, Move, AlertTriangle, Hammer, Zap, Droplet, ArrowDown, UserPlus, ChevronsUp, Timer, HelpCircle, Flame, Biohazard, ShieldCheck, Siren, Wifi, WifiOff } from 'lucide-react';

interface GameScreenProps {
  config: GameConfig;
  onExit: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ config, onExit }) => {
  // --- STATE MANAGEMENT ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [visualizingId, setVisualizingId] = useState<string | null>(null);
  const [showMobileStats, setShowMobileStats] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Multiplayer Roles
  const isClient = config.isMultiplayer && !config.isHost;
  const isHost = config.isMultiplayer && config.isHost;

  /**
   * INITIALIZATION EFFECT
   * Handles startup sequence based on role (Host vs Client).
   */
  useEffect(() => {
    const init = async () => {
      // CLIENT LOGIC: Passive Mode. 
      // Do not initialize AI engine. Wait for state sync from Host via PeerJS.
      if (isClient) {
          peerService.onData((data) => {
              if (data.type === 'STATE_SYNC') {
                  setGameState(data.gameState);
                  setMessages(data.messages);
                  setIsProcessing(false); // Host finished processing
              }
          });
          return;
      }

      // HOST / SOLO LOGIC: Active Mode.
      // Initialize the AI Engine (Gemini or Local).
      setIsProcessing(true);
      try {
        GeminiService.initializeGame(config);
        
        // Setup Host Listener for incoming Client actions
        if (isHost) {
            peerService.onData((data) => {
                if (data.type === 'ACTION') {
                    // Relay the client's action string to the Game Engine
                    handleSend(data.text);
                }
            });
        }

        // Initial Prompts
        const { text, gameState: newState } = await GeminiService.sendGameAction("Initialize simulation. Status report.");
        
        const initialMsg: Message = {
          id: Date.now().toString(),
          role: 'model',
          text,
          timestamp: Date.now()
        };
        
        setMessages([initialMsg]);
        if (newState) setGameState(prev => ({ ...prev, ...newState }));
      } catch (err) {
        console.error("Init failed", err);
      } finally {
        setIsProcessing(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * HOST BROADCAST EFFECT
   * Whenever state changes, Host pushes update to Client.
   */
  useEffect(() => {
      if (isHost) {
          peerService.send({
              type: 'STATE_SYNC',
              gameState,
              messages
          });
      }
  }, [gameState, messages, isHost]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, gameState.phase]);

  /**
   * MAIN GAME LOOP
   * Handles user input, AI processing, and Multiplayer delegation.
   */
  const handleSend = async (customAction?: string) => {
    const actionText = customAction || input;
    if (!actionText.trim() || isProcessing) return;

    // CLIENT LOGIC: Send action to Host, do not process locally
    if (isClient) {
        setIsProcessing(true); // Visually indicate waiting
        peerService.send({
            type: 'ACTION',
            text: actionText
        });
        setInput('');
        return;
    }

    // HOST / SOLO LOGIC
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: actionText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      // Call AI Service
      const { text, gameState: newState } = await GeminiService.sendGameAction(actionText);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);
      if (newState) setGameState(prev => ({ ...prev, ...newState }));

    } catch (error) {
        const errorMsg: Message = {
            id: Date.now().toString(),
            role: 'system',
            text: "Connection interrupted. Neural link unstable.",
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Triggers image generation for a specific chat message
  const handleVisualize = async (msgId: string, text: string) => {
    if (visualizingId) return;
    if (isClient) return; // Only Host can generate images for now to save API calls/complexity
    
    setVisualizingId(msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isVisualizing: true } : m));
    
    const imageUrl = await GeminiService.generateSceneVisual(`Gritty, horror concept art, dark atmosphere, zombie apocalypse style. ${text}`);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, imageUrl: imageUrl || undefined, isVisualizing: false } : m));
    setVisualizingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- UI HELPER FUNCTIONS ---

  // Context-aware click handler for Enemy Cards
  const handleEnemyClick = (enemy: Enemy) => {
      // Intelligent targeting based on range
      if (enemy.range === 'Far' || enemy.range === 'Near') {
          setInput(`Shoot ${enemy.name} with firearm`);
      } else {
          setInput(`Attack ${enemy.name} with melee`);
      }
  };

  const handleItemClick = (item: string) => {
      if (isProcessing) return;
      handleSend(`Equip or use item: ${item}`);
  };

  const getSkillIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'firearms': return <Crosshair className="w-3 h-3 text-amber-500" />;
      case 'melee': return <Sword className="w-3 h-3 text-red-500" />;
      case 'stealth': return <Eye className="w-3 h-3 text-blue-500" />;
      case 'medical': return <PlusSquare className="w-3 h-3 text-green-500" />;
      case 'scavenging': return <Search className="w-3 h-3 text-purple-500" />;
      default: return <Activity className="w-3 h-3 text-slate-500" />;
    }
  };

  // Helper to detect weapon type based on name string
  const isFirearm = (name: string | null) => {
      if (!name) return false;
      const n = name.toLowerCase();
      return n.includes('gun') || n.includes('pistol') || n.includes('rifle') || n.includes('shotgun') || n.includes('smg') || n.includes('revolver') || n.includes('bow');
  };

  // Helper to check intent type for icons
  const getIntentIcon = (intent: string | undefined) => {
      const i = (intent || '').toLowerCase();
      if (i.includes('attack') || i.includes('bite') || i.includes('lunge') || i.includes('strike') || i.includes('claw')) return <Sword className="w-3 h-3" />;
      if (i.includes('move') || i.includes('approach') || i.includes('run')) return <Move className="w-3 h-3" />;
      if (i.includes('block') || i.includes('defend')) return <Shield className="w-3 h-3" />;
      if (i.includes('scream') || i.includes('alert')) return <Siren className="w-3 h-3" />;
      return <AlertTriangle className="w-3 h-3" />;
  };

  const getIntentStyle = (intent: string | undefined) => {
    const i = (intent || '').toLowerCase();
    if (i.includes('attack') || i.includes('bite') || i.includes('lunge')) return 'bg-red-900/40 border-red-500/30 text-red-200';
    if (i.includes('block') || i.includes('defend')) return 'bg-blue-900/40 border-blue-500/30 text-blue-200';
    if (i.includes('move') || i.includes('approach')) return 'bg-amber-900/40 border-amber-500/30 text-amber-200';
    return 'bg-slate-800/80 border-slate-700 text-slate-400';
  };

  // --- DERIVED STATE ---
  const isCombat = gameState.phase === 'combat';
  const maxSkillLevel = Math.max(...Object.values(gameState.skills || { none: 0 }));
  const equippedIsFirearm = isFirearm(gameState.equippedWeapon);
  const meleeLevel = gameState.skills['Melee'] || 1;
  const firearmsLevel = gameState.skills['Firearms'] || 1;
  const hasApRefund = equippedIsFirearm && firearmsLevel >= 8;

  let attackBonus = null;
  if (equippedIsFirearm) {
      if (firearmsLevel >= 8) attackBonus = "AP REFUND CHANCE";
      else if (firearmsLevel >= 4) attackBonus = "REDUCED JAM RATE";
  } else {
      if (meleeLevel >= 8) attackBonus = "EXECUTION CHANCE";
      else if (meleeLevel >= 4) attackBonus = "CRIT RATE ++";
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* Top Bar */}
      <header className="h-14 border-b border-slate-900 bg-slate-950/80 flex items-center justify-between px-4 shrink-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-red-900/30 border border-red-500/30 rounded flex items-center justify-center">
                <Skull className="w-5 h-5 text-red-500" />
            </div>
            <div>
                <h2 className="font-bold text-slate-100 leading-none font-mono tracking-tight flex items-center gap-2">
                    ZOM-B 
                    {config.isMultiplayer && (
                        <span className="text-[9px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                            <Wifi className="w-3 h-3" /> {isHost ? 'HOST' : 'CLIENT'}
                        </span>
                    )}
                </h2>
                <p className="text-[10px] text-slate-500 font-mono uppercase">Day {gameState.day} • {gameState.time}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button className="lg:hidden p-2 text-slate-400" onClick={() => setShowMobileStats(!showMobileStats)}>
                <Activity className="w-5 h-5" />
            </button>
            <Button variant="danger" onClick={onExit} className="text-xs px-3 py-1.5 h-auto">
             ABORT
            </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute inset-0 scanline z-50 pointer-events-none opacity-20 mix-blend-overlay"></div>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 relative bg-slate-950">
          
          {/* COMBAT HUD - Only visible in combat */}
          {isCombat && (
            <div className="bg-slate-900/90 border-b border-red-900/50 p-4 shadow-lg backdrop-blur-sm z-20 animate-fade-in relative">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> Combat Protocol Active
                 </h3>
                 <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    TURN STATUS: <span className="text-white font-bold">{gameState.actionPoints} AP</span> REMAINING
                 </span>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-8 pt-4 px-4 scrollbar-hide items-center">
                {gameState.enemies.map((enemy, index) => {
                   const status = (enemy.status || 'Active').toLowerCase();
                   const isStunned = status.includes('stun');
                   const isBleeding = status.includes('bleed') || status.includes('hemorrhage');
                   const isDowned = status.includes('down') || status.includes('prone');
                   const isBurning = status.includes('burn') || status.includes('fire');
                   const isInfected = status.includes('infect') || status.includes('virus');
                   const isArmored = status.includes('armor') || status.includes('helmet');
                   const isEnraged = status.includes('rage') || status.includes('frenzy');
                   const isNext = index === 0;
                  
                  return (
                    <button 
                      key={enemy.id}
                      onClick={() => handleEnemyClick(enemy)}
                      className={`flex-shrink-0 w-56 transition-all duration-300 text-left group relative overflow-hidden flex flex-col justify-between ${
                        isNext 
                          ? 'h-52 rounded-md bg-gradient-to-b from-red-950/30 via-slate-900 to-slate-950 border-2 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.3)] scale-105 z-10 ring-2 ring-red-500/50 ring-offset-2 ring-offset-slate-900 opacity-100' 
                          : 'h-44 rounded-sm bg-slate-950 border border-slate-800 hover:border-red-500/30 opacity-60 hover:opacity-100 scale-95 grayscale-[0.5] hover:grayscale-0'
                      }`}
                    >
                      {isNext && <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(220,38,38,0.1)_50%)] bg-[length:100%_4px] animate-pulse pointer-events-none"></div>}

                      <div className="p-4 relative z-10 flex-1 flex flex-col">
                          <div className="absolute top-0 right-0">
                            {isNext ? (
                                <div className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-bl-lg shadow-lg">
                                    <Timer className="w-3 h-3 animate-[spin_3s_linear_infinite]" /> NEXT
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 bg-slate-900 text-slate-500 text-[10px] font-mono font-bold px-2 py-1 rounded-bl-md border-l border-b border-slate-800">
                                    #{index + 1}
                                </div>
                            )}
                          </div>

                          <div className="mb-2 pr-12">
                            <span className={`font-black text-base truncate block ${isNext ? 'text-red-100 drop-shadow-md' : 'text-slate-400'}`}>{enemy.name}</span>
                            <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase mt-1 ${
                              enemy.range === 'Melee' ? 'bg-red-900/50 text-red-300 border border-red-500/20' :
                              enemy.range === 'Near' ? 'bg-amber-900/50 text-amber-300 border border-amber-500/20' :
                              'bg-blue-900/50 text-blue-300 border border-blue-500/20'
                            }`}>
                              {enemy.range || 'Unknown'} DISTANCE
                            </span>
                          </div>
                          
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-mono uppercase">
                              <span>Integrity</span>
                              <span className={isNext ? "text-red-400" : "text-slate-500"}>{enemy.hp}/{enemy.maxHp}</span>
                            </div>
                            <div className="w-full bg-slate-900/50 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className={`h-full transition-all duration-500 ${isNext ? 'bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-slate-600'}`} 
                                style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="flex gap-1 flex-wrap content-start min-h-[1.5rem]">
                              {isStunned && <span className="text-[9px] bg-yellow-500/20 text-yellow-200 px-1.5 py-0.5 rounded border border-yellow-500/30 flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> STUN</span>}
                              {isBleeding && <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 flex items-center gap-1"><Droplet className="w-2.5 h-2.5" /> BLEED</span>}
                              {isDowned && <span className="text-[9px] bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600 flex items-center gap-1"><ArrowDown className="w-2.5 h-2.5" /> DOWN</span>}
                              {isBurning && <span className="text-[9px] bg-orange-600/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30 flex items-center gap-1"><Flame className="w-2.5 h-2.5" /> BURN</span>}
                              {isInfected && <span className="text-[9px] bg-lime-900/40 text-lime-400 px-1.5 py-0.5 rounded border border-lime-500/30 flex items-center gap-1"><Biohazard className="w-2.5 h-2.5" /> VIRUS</span>}
                              {isArmored && <span className="text-[9px] bg-zinc-700/50 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-500/50 flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> ARMOR</span>}
                              {isEnraged && <span className="text-[9px] bg-rose-900/40 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> RAGE</span>}
                          </div>
                      </div>
                      
                      <div className={`p-3 border-t backdrop-blur-md flex items-center gap-3 ${getIntentStyle(enemy.intent)}`}>
                             <div className={`p-1.5 rounded-full bg-black/20 shrink-0`}>
                                {getIntentIcon(enemy.intent)}
                             </div>
                             <div className="flex flex-col min-w-0">
                                <span className="text-[9px] uppercase leading-none mb-1 font-bold opacity-70">Projected Action</span>
                                <span className="text-[10px] font-mono truncate leading-none font-bold tracking-tight">{enemy.intent || 'Unknown'}</span>
                             </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
             {messages.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                 <div className={`max-w-[95%] md:max-w-3xl ${msg.role === 'user' ? 'bg-slate-800 text-slate-100' : 'bg-transparent pl-0 border-l-2 border-slate-800'} p-4 rounded-sm`}>
                    
                    {msg.role === 'system' && <p className="text-red-400 font-mono text-sm border border-red-900/50 bg-red-900/10 p-2">{msg.text}</p>}
                    
                    {msg.role !== 'system' && (
                        <>
                            <div className={`${msg.role === 'user' ? '' : 'text-slate-300'}`}>
                                <MarkdownText content={msg.text} />
                            </div>
                            {msg.imageUrl && (
                                <div className="mt-4 rounded-sm overflow-hidden border border-slate-800 shadow-2xl relative">
                                    <img src={msg.imageUrl} alt="Visual" className="w-full h-auto max-h-[400px] object-cover opacity-90" />
                                </div>
                            )}
                            {msg.role === 'model' && !msg.imageUrl && !isClient && (
                                <div className="mt-3 flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleVisualize(msg.id, msg.text)}
                                        disabled={!!visualizingId}
                                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 hover:text-red-400 disabled:opacity-50 font-mono"
                                    >
                                        {msg.isVisualizing ? 'RENDERING...' : '[ REQUEST VISUAL ]'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                 </div>
               </div>
             ))}
             <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-950 border-t border-slate-900 z-10">
            {/* Quick Actions */}
            {isCombat && (
                <div className="mb-3 flex flex-wrap gap-2 pb-2">
                    <button 
                        onClick={() => handleSend("Dash to change range / improve position")} 
                        disabled={gameState.actionPoints < 1 || isProcessing}
                        className={`group relative whitespace-nowrap px-4 py-2 border text-xs font-mono uppercase transition-all flex flex-col items-center justify-center gap-1 min-w-[100px] ${
                            gameState.actionPoints >= 1 
                            ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700" 
                            : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                        }`}
                    >
                        <div className="flex items-center gap-1 mb-1"><Move className="w-3 h-3"/> MOVE</div>
                        <span className="text-[9px] bg-slate-950/30 px-1.5 py-0.5 rounded text-slate-400 font-mono">1 AP</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 hidden group-hover:block bg-slate-950 text-slate-200 text-[10px] p-2 rounded border border-slate-700 shadow-2xl z-50 pointer-events-none text-left">
                           <span className="block font-bold text-white mb-1 border-b border-slate-800 pb-1">REPOSITION</span>
                           <span className="block text-slate-400">Cost: 1 AP</span>
                           <span className="block text-slate-500 italic mt-1">Change range (Far/Near/Melee)</span>
                        </div>
                    </button>
                    <button 
                        onClick={() => handleSend("Attack nearest enemy with equipped weapon")} 
                        disabled={gameState.actionPoints < 1 || isProcessing}
                        className={`group relative whitespace-nowrap px-4 py-2 border text-xs font-mono uppercase transition-all flex flex-col items-center justify-center gap-1 min-w-[120px] ${
                            gameState.actionPoints >= 1 
                            ? "bg-red-900/20 border-red-500/50 text-red-400 hover:bg-red-900/40" 
                            : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                        }`}
                    >
                         <div className="flex items-center gap-1 mb-1"><Crosshair className="w-3 h-3"/> ATTACK</div>
                         <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/5">
                                <span className="text-[9px] text-slate-300 font-mono">1 AP</span>
                                {hasApRefund && <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-0.5"><Timer className="w-2 h-2"/>REFUND</span>}
                            </div>
                            {!hasApRefund && attackBonus && <span className="text-[8px] text-yellow-400 font-bold animate-pulse">{attackBonus}</span>}
                         </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block bg-slate-950 text-slate-200 text-[10px] p-2 rounded border border-slate-700 shadow-2xl z-50 pointer-events-none text-left">
                           <span className="block font-bold text-white mb-1 border-b border-slate-800 pb-1">PRIMARY ATTACK</span>
                           <div className="flex items-center justify-between">
                              <span className="text-slate-400">Cost: 1 AP</span>
                              {hasApRefund && <span className="text-emerald-400 font-bold flex items-center gap-1"><Timer className="w-3 h-3"/> REFUND ON KILL</span>}
                           </div>
                           {attackBonus && <span className="block text-amber-500 font-bold mt-1">BONUS: {attackBonus}</span>}
                        </div>
                    </button>
                    <button 
                        onClick={() => handleSend("Defensive stance and observe")} 
                        disabled={gameState.actionPoints < 1 || isProcessing}
                        className={`group relative whitespace-nowrap px-4 py-2 border text-xs font-mono uppercase transition-all flex flex-col items-center justify-center gap-1 min-w-[100px] ${
                            gameState.actionPoints >= 1 
                            ? "bg-blue-900/20 border-blue-500/50 text-blue-400 hover:bg-blue-900/40" 
                            : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                        }`}
                    >
                        <div className="flex items-center gap-1 mb-1"><Shield className="w-3 h-3"/> DEFEND</div>
                        <span className="text-[9px] bg-slate-950/30 px-1.5 py-0.5 rounded text-slate-400 font-mono">1 AP</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 hidden group-hover:block bg-slate-950 text-slate-200 text-[10px] p-2 rounded border border-slate-700 shadow-2xl z-50 pointer-events-none text-left">
                           <span className="block font-bold text-white mb-1 border-b border-slate-800 pb-1">GUARD STANCE</span>
                           <span className="block text-slate-400">Cost: 1 AP</span>
                           <span className="block text-slate-500 italic mt-1">Reduce incoming damage significantly</span>
                        </div>
                    </button>
                    <button 
                        onClick={() => handleSend("Use healing item")} 
                        disabled={gameState.actionPoints < 1 || isProcessing}
                        className={`group relative whitespace-nowrap px-4 py-2 border text-xs font-mono uppercase transition-all flex flex-col items-center justify-center gap-1 min-w-[100px] ${
                            gameState.actionPoints >= 1 
                            ? "bg-green-900/20 border-green-500/50 text-green-400 hover:bg-green-900/40" 
                            : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                        }`}
                    >
                         <div className="flex items-center gap-1 mb-1"><PlusSquare className="w-3 h-3"/> HEAL</div>
                         <span className="text-[9px] bg-slate-950/30 px-1.5 py-0.5 rounded text-slate-400 font-mono">1 AP</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 hidden group-hover:block bg-slate-950 text-slate-200 text-[10px] p-2 rounded border border-slate-700 shadow-2xl z-50 pointer-events-none text-left">
                           <span className="block font-bold text-white mb-1 border-b border-slate-800 pb-1">FIELD MEDIC</span>
                           <span className="block text-slate-400">Cost: 1 AP</span>
                           <span className="block text-slate-500 italic mt-1">Stop bleeding / Restore HP</span>
                        </div>
                    </button>
                </div>
            )}

            <div className="max-w-4xl mx-auto flex gap-0 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                    isClient && isProcessing ? "Transmitting to Host..." :
                    isCombat ? `Combat Protocol Active (${gameState.actionPoints} AP). Select target or type command...` : "Enter command..."
                }
                className={`flex-1 bg-slate-900 border ${isCombat ? 'border-red-900/50 focus:border-red-500' : 'border-slate-800 focus:border-slate-600'} text-white px-4 py-4 focus:ring-0 outline-none font-mono text-sm disabled:opacity-50`}
                disabled={isProcessing}
                autoFocus
              />
              <Button 
                onClick={() => handleSend()} 
                disabled={!input.trim() || isProcessing}
                className={`rounded-none px-6 ${isCombat ? 'bg-red-700 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                {isProcessing ? '...' : <Send className="w-4 h-4" />}
              </Button>
            </div>
            {isClient && (
                 <div className="text-center mt-2 text-[10px] text-slate-600 font-mono">
                     UPLINK TO HOST ACTIVE // RELAYING COMMANDS
                 </div>
            )}
          </div>
        </main>

        {/* Sidebar */}
        <aside className={`${showMobileStats ? 'block absolute inset-0 z-40 bg-slate-950' : 'hidden'} lg:block w-80 bg-slate-950 border-l border-slate-900 p-0 flex flex-col`}>
             {/* ... Sidebar Content ... */}
            {showMobileStats && (
                <div className="p-4 border-b border-slate-800 flex justify-between lg:hidden">
                    <span className="font-mono text-white">TACTICAL OVERVIEW</span>
                    <button onClick={() => setShowMobileStats(false)}><Menu className="w-5 h-5 text-slate-400"/></button>
                </div>
            )}
            
            <div className="overflow-y-auto flex-1 p-6 space-y-8">
                {/* Combat State Indicator */}
                <div className={`p-4 border rounded-sm ${isCombat ? 'bg-red-950/30 border-red-500/50 animate-pulse' : 'bg-emerald-950/10 border-emerald-900/30'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold uppercase tracking-widest ${isCombat ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isCombat ? 'COMBAT ACTIVE' : 'EXPLORATION'}
                        </span>
                        {isCombat && <span className="text-red-400 font-mono font-bold text-lg">{gameState.actionPoints} AP</span>}
                    </div>
                    {isCombat && (
                        <div className="w-full bg-red-900/20 h-1.5 mt-2">
                            <div className="bg-red-500 h-full transition-all" style={{ width: `${(gameState.actionPoints / gameState.maxActionPoints) * 100}%` }}></div>
                        </div>
                    )}
                </div>

                {/* Equipped Weapon */}
                <div className="space-y-2">
                     <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Equipped Weapon</h3>
                     <div className="p-3 bg-slate-900 border border-slate-800 rounded-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Hammer className="w-5 h-5 text-slate-400" />
                            <span className="text-sm font-mono font-bold text-slate-100">{gameState.equippedWeapon || 'Fists'}</span>
                        </div>
                        {equippedIsFirearm && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-500 border border-amber-900/50 bg-amber-900/10 px-1.5 py-0.5 rounded">
                                <Crosshair className="w-3 h-3" />
                                RANGED
                            </div>
                        )}
                        {!equippedIsFirearm && gameState.equippedWeapon && (
                            <div className="flex items-center gap-1 text-[10px] text-red-500 border border-red-900/50 bg-red-900/10 px-1.5 py-0.5 rounded">
                                <Sword className="w-3 h-3" />
                                MELEE
                            </div>
                        )}
                     </div>
                </div>

                {/* Skills & Proficiency */}
                <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Skills & Proficiency</h3>
                    <div className="grid gap-2">
                        {gameState.skills && Object.entries(gameState.skills).map(([skill, level]) => {
                             const isTopSkill = level === maxSkillLevel && level > 1;
                             return (
                                <div key={skill} className={`p-2 rounded-sm border flex items-center justify-between transition-colors ${
                                     isTopSkill 
                                     ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                                     : 'bg-slate-900/50 border-slate-900'
                                 }`}>
                                    <div className="flex items-center gap-2">
                                        {getSkillIcon(skill)}
                                        <span className={`text-xs font-medium ${isTopSkill ? 'text-amber-100' : 'text-slate-300'}`}>
                                            {skill}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`w-1 h-3 ${i < (level > 5 ? 5 : level) ? (isTopSkill ? 'bg-amber-500' : 'bg-slate-400') : 'bg-slate-800'}`}
                                                ></div>
                                            ))}
                                        </div>
                                        <span className={`text-[10px] font-mono ml-1 ${isTopSkill ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                                            LVL {level}
                                        </span>
                                        {isTopSkill && <Crown className="w-3 h-3 text-amber-500" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Status Monitor */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Vitals Monitor</h3>
                    
                    {/* HP */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Integrity</span>
                            <span className="text-slate-200 font-mono">{gameState.hp}/{gameState.maxHp}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1">
                            <div className="bg-slate-200 h-full" style={{ width: `${(gameState.hp / gameState.maxHp) * 100}%` }}></div>
                        </div>
                    </div>

                    {/* Infection */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Viral Load</span>
                            <span className={`${gameState.infectionLevel > 50 ? 'text-red-500' : 'text-emerald-500'} font-mono`}>{gameState.infectionLevel}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1">
                            <div className={`h-full transition-all ${gameState.infectionLevel > 0 ? 'bg-purple-500' : 'bg-slate-800'}`} style={{ width: `${gameState.infectionLevel}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Inventory */}
                <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Gear (Click to Use/Equip)</h3>
                    <div className="flex flex-wrap gap-2">
                        {gameState.inventory.map((item, i) => (
                            <button 
                                key={i}
                                onClick={() => handleItemClick(item)}
                                disabled={isProcessing}
                                className={`px-2 py-1 border text-xs font-mono rounded-sm transition-all text-left ${
                                    gameState.equippedWeapon === item 
                                    ? 'bg-amber-900/20 border-amber-500/50 text-amber-200 shadow-sm'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                                }`}
                            >
                                {item} {gameState.equippedWeapon === item && '(EQP)'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Location Intel */}
                <div className="space-y-2 mt-4">
                    <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Environment</h3>
                    <div className="bg-slate-900/50 border border-slate-900 p-3 rounded-sm">
                        <div className="flex items-center gap-2 mb-2 text-slate-300">
                            <MapPin className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium truncate">{gameState.location}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                             <div className="bg-slate-950 p-2 rounded-sm border border-slate-900">
                                <span className="block text-[10px] text-slate-500 uppercase">Supplies</span>
                                <span className="block text-sm text-yellow-500 font-mono">{gameState.supplies} Units</span>
                             </div>
                             <div className="bg-slate-950 p-2 rounded-sm border border-slate-900">
                                <span className="block text-[10px] text-slate-500 uppercase">Threat</span>
                                <span className="block text-sm text-red-500 font-mono">{gameState.enemies.length} Hostiles</span>
                             </div>
                        </div>
                    </div>
                </div>

            </div>
            
            <div className="p-4 border-t border-slate-900 bg-slate-950 text-[10px] text-slate-600 font-mono text-center">
                 {isClient ? `CONNECTED TO: ${config.hostPeerId?.substring(0,6)}...` : `ENGINE: ${config.engineMode === 'local' ? 'LOCAL' : 'GEMINI-2.5'}`}
            </div>
        </aside>
      </div>
    </div>
  );
};

export default GameScreen;