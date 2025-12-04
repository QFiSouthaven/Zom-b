/**
 * @file SetupScreen.tsx
 * @description Initial Configuration Screen.
 * 
 * Responsibilities:
 * 1. Character Creation (Name, Profession, Perk).
 * 2. Engine Selection (Cloud vs. Local).
 * 3. Multiplayer Lobby (Host Generation / Client Connection).
 */

import React, { useState, useEffect } from 'react';
import { GameConfig } from '../types';
import Button from './Button';
import { peerService } from '../services/peerService';
import { Skull, User, Briefcase, Zap, Globe, Server, Settings, Users, Share2, Wifi } from 'lucide-react';

interface SetupScreenProps {
  onStart: (config: GameConfig) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('Ex-Military');
  const [perk, setPerk] = useState('Sharpshooter');
  
  // Engine Settings
  const [engineMode, setEngineMode] = useState<'gemini' | 'local'>('gemini');
  const [localEndpoint, setLocalEndpoint] = useState('http://localhost:1234/v1');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Multiplayer Settings
  const [gameMode, setGameMode] = useState<'solo' | 'multiplayer'>('solo');
  const [mpRole, setMpRole] = useState<'host' | 'client'>('host');
  const [hostId, setHostId] = useState(''); // ID generated if host
  const [targetHostId, setTargetHostId] = useState(''); // ID entered if client
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'generating' | 'waiting' | 'connecting' | 'connected'>('idle');

  const professions = [
    { id: 'Ex-Military', label: 'Ex-Military', desc: 'Starts with: Firearms (Lvl 3), Melee (Lvl 2)' },
    { id: 'Paramedic', label: 'Paramedic', desc: 'Starts with: Medical (Lvl 3). Bonus healing.' },
    { id: 'Engineer', label: 'Engineer', desc: 'Starts with: Scavenging (Lvl 3). Better repairs.' },
    { id: 'Scavenger', label: 'Urban Scavenger', desc: 'Starts with: Stealth (Lvl 3), Scavenging (Lvl 2).' },
  ];

  const perks = [
    { id: 'Sharpshooter', label: 'Sharpshooter', desc: '+Hit Chance with firearms' },
    { id: 'Adrenaline Junkie', label: 'Adrenaline Junkie', desc: 'Restore 1 AP on kill' },
    { id: 'Iron Gut', label: 'Iron Gut', desc: 'Resistant to infection/bad food' },
    { id: 'Stealthy', label: 'Stealthy', desc: 'Harder to detect by herds' },
  ];

  // Auto-generate Host ID when switching to Host mode
  useEffect(() => {
    if (gameMode === 'multiplayer' && mpRole === 'host' && connectionStatus === 'idle') {
       setConnectionStatus('generating');
       peerService.initHost().then(id => {
           setHostId(id);
           setConnectionStatus('waiting');
           
           // Listen for incoming connection handshake
           peerService.onData((data) => {
               if (data.type === 'HANDSHAKE') {
                   setConnectionStatus('connected');
               }
           });
       });
    }
  }, [gameMode, mpRole, connectionStatus]);

  const handleJoinGame = async () => {
      if (!targetHostId) return;
      setConnectionStatus('connecting');
      try {
          await peerService.joinGame(targetHostId);
          setConnectionStatus('connected');
          // Send handshake
          peerService.send({ 
              type: 'HANDSHAKE', 
              character: { name, profession, perk } 
          });
          
          // As client, we immediately start and wait for state sync
          onStart({
              character: { name, profession, perk },
              engineMode: 'gemini', // Irrelevant for client
              isMultiplayer: true,
              isHost: false,
              hostPeerId: targetHostId
          });

      } catch (e) {
          console.error(e);
          setConnectionStatus('idle');
          alert("Failed to connect to Host ID");
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onStart({
        character: { name, profession, perk },
        engineMode,
        localEndpoint: engineMode === 'local' ? localEndpoint : undefined,
        isMultiplayer: gameMode === 'multiplayer',
        isHost: mpRole === 'host',
        hostPeerId: mpRole === 'client' ? targetHostId : undefined
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1542259681-d2a93d0d6223?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"></div>
      
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 p-8 rounded-sm shadow-2xl animate-fade-in flex flex-col md:flex-row gap-8">
        
        {/* Left Col: Character Config (Disabled for Client until connected logic improved, but for now Client configures their own view of char) */}
        <div className="flex-1 space-y-6">
            <div className="text-left border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3 mb-2">
                    <Skull className="w-8 h-8 text-red-500 animate-pulse" />
                    <h1 className="text-3xl font-bold text-slate-100 font-mono tracking-tighter">ZOM-B</h1>
                </div>
                <p className="text-red-400 font-mono text-xs uppercase tracking-widest">Survival Protocols // v0.9.5</p>
            </div>

            <form id="setupForm" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-slate-400 font-mono text-xs uppercase flex items-center gap-2">
                    <User className="w-3 h-3" /> Survivor ID
                    </label>
                    <input 
                        type="text"
                        required
                        className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-sm px-3 py-3 focus:ring-1 focus:ring-red-500 outline-none font-mono"
                        placeholder="NAME..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={gameMode === 'multiplayer' && mpRole === 'client' && connectionStatus === 'connected'} 
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-slate-400 font-mono text-xs uppercase">Role</label>
                        <div className="grid gap-1">
                            {professions.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setProfession(p.id)}
                                disabled={gameMode === 'multiplayer' && mpRole === 'client' && connectionStatus === 'connected'}
                                className={`text-left p-2 rounded-sm border transition-all ${
                                profession === p.id 
                                    ? 'bg-red-900/20 border-red-500/50 text-red-100' 
                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                }`}
                            >
                                <div className="font-bold text-xs">{p.label}</div>
                            </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-slate-400 font-mono text-xs uppercase">Trait</label>
                         <div className="grid gap-1">
                            {perks.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPerk(p.id)}
                                disabled={gameMode === 'multiplayer' && mpRole === 'client' && connectionStatus === 'connected'}
                                className={`text-left p-2 rounded-sm border transition-all ${
                                perk === p.id 
                                    ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-100' 
                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                }`}
                            >
                                <div className="font-bold text-xs">{p.label}</div>
                            </button>
                            ))}
                        </div>
                    </div>
                </div>
            </form>
        </div>

        {/* Right Col: Connection & Engine */}
        <div className="flex-1 bg-slate-950 p-6 rounded-sm border border-slate-800 flex flex-col">
             
             {/* Mode Switch */}
             <div className="flex p-1 bg-slate-900 rounded-sm mb-6">
                 <button 
                    type="button"
                    onClick={() => { setGameMode('solo'); peerService.cleanup(); setConnectionStatus('idle'); }}
                    className={`flex-1 py-2 text-xs font-bold font-mono rounded-sm transition-all ${gameMode === 'solo' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                 >
                    SOLO
                 </button>
                 <button 
                    type="button"
                    onClick={() => setGameMode('multiplayer')}
                    className={`flex-1 py-2 text-xs font-bold font-mono rounded-sm transition-all flex items-center justify-center gap-2 ${gameMode === 'multiplayer' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500'}`}
                 >
                    <Users className="w-3 h-3" /> MULTIPLAYER
                 </button>
             </div>

             {gameMode === 'solo' ? (
                 <div className="space-y-6 animate-fade-in">
                     <div className="space-y-3">
                        <h3 className="text-slate-400 font-mono text-xs uppercase flex items-center gap-2">
                           <Settings className="w-3 h-3" /> Engine Config
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setEngineMode('gemini')}
                                className={`p-3 border rounded-sm flex flex-col items-center gap-1 text-center transition-all ${
                                    engineMode === 'gemini' 
                                    ? 'bg-blue-900/20 border-blue-500/50 text-blue-100' 
                                    : 'bg-slate-900 border-slate-800 text-slate-500'
                                }`}
                            >
                                <Globe className="w-4 h-4" />
                                <span className="text-[10px] font-bold">GEMINI CLOUD</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setEngineMode('local')}
                                className={`p-3 border rounded-sm flex flex-col items-center gap-1 text-center transition-all ${
                                    engineMode === 'local' 
                                    ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-100' 
                                    : 'bg-slate-900 border-slate-800 text-slate-500'
                                }`}
                            >
                                <Server className="w-4 h-4" />
                                <span className="text-[10px] font-bold">LOCAL LLM</span>
                            </button>
                        </div>
                        {engineMode === 'local' && (
                             <input 
                                type="text" 
                                value={localEndpoint}
                                onChange={(e) => setLocalEndpoint(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 px-3 py-2 text-[10px] font-mono text-emerald-400 outline-none"
                             />
                        )}
                     </div>
                 </div>
             ) : (
                 <div className="space-y-6 animate-fade-in flex-1 flex flex-col">
                     {/* Host/Join Toggle */}
                     <div className="flex gap-4 border-b border-slate-800 pb-4 mb-2">
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input type="radio" name="mpRole" checked={mpRole === 'host'} onChange={() => { setMpRole('host'); setConnectionStatus('idle'); }} className="accent-blue-500" />
                             <span className={`text-xs font-mono font-bold ${mpRole === 'host' ? 'text-blue-400' : 'text-slate-500'}`}>HOST GAME</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input type="radio" name="mpRole" checked={mpRole === 'client'} onChange={() => { setMpRole('client'); setConnectionStatus('idle'); }} className="accent-emerald-500" />
                             <span className={`text-xs font-mono font-bold ${mpRole === 'client' ? 'text-emerald-400' : 'text-slate-500'}`}>JOIN GAME</span>
                         </label>
                     </div>

                     {mpRole === 'host' ? (
                         <div className="bg-slate-900 p-4 rounded border border-slate-800 flex-1 flex flex-col items-center justify-center text-center space-y-3">
                             {connectionStatus === 'generating' && <div className="text-blue-500 text-xs font-mono animate-pulse">INITIALIZING UPLINK...</div>}
                             
                             {(connectionStatus === 'waiting' || connectionStatus === 'connected') && (
                                 <>
                                     <div className="bg-slate-950 p-3 rounded border border-blue-500/30 w-full">
                                         <p className="text-[10px] text-slate-500 uppercase mb-1">Session ID (Share this)</p>
                                         <p className="text-xl font-mono font-bold text-blue-100 tracking-wider break-all select-all">{hostId}</p>
                                     </div>
                                     <div className="flex items-center gap-2 text-xs font-mono">
                                         {connectionStatus === 'connected' 
                                            ? <span className="text-emerald-400 flex items-center gap-2"><Wifi className="w-4 h-4"/> PLAYER CONNECTED</span>
                                            : <span className="text-slate-500 flex items-center gap-2"><div className="w-2 h-2 bg-slate-500 rounded-full animate-ping"></div> WAITING FOR PLAYER...</span>
                                         }
                                     </div>
                                 </>
                             )}
                         </div>
                     ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-slate-400 font-mono text-xs uppercase">Target Session ID</label>
                                <input 
                                    type="text"
                                    value={targetHostId}
                                    onChange={(e) => setTargetHostId(e.target.value)}
                                    placeholder="Paste Host ID here..."
                                    className="w-full bg-slate-900 border border-slate-700 px-3 py-3 text-sm font-mono text-white outline-none focus:border-emerald-500"
                                />
                            </div>
                            <Button variant="primary" onClick={handleJoinGame} isLoading={connectionStatus === 'connecting'} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white border-none">
                                <Share2 className="w-4 h-4" /> CONNECT TO HOST
                            </Button>
                        </div>
                     )}
                 </div>
             )}

             <div className="mt-auto pt-6 border-t border-slate-800">
                {/* Only Host or Solo can start. Client starts automatically upon connection/sync. */}
                {(!gameMode || gameMode === 'solo' || (gameMode === 'multiplayer' && mpRole === 'host')) && (
                    <Button 
                        type="submit" 
                        form="setupForm"
                        disabled={gameMode === 'multiplayer' && connectionStatus !== 'connected'}
                        className={`w-full py-4 text-lg font-mono uppercase tracking-widest border-none shadow-lg ${
                            gameMode === 'multiplayer' 
                            ? (connectionStatus === 'connected' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed')
                            : 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.3)]'
                        }`}
                    >
                        {gameMode === 'multiplayer' ? 'LAUNCH CO-OP SESSION' : 'INITIALIZE PROTOCOL'}
                    </Button>
                )}
                 {gameMode === 'multiplayer' && mpRole === 'host' && connectionStatus !== 'connected' && (
                     <p className="text-[10px] text-center text-slate-500 mt-2 font-mono">WAITING FOR CLIENT CONNECTION TO START</p>
                 )}
             </div>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;