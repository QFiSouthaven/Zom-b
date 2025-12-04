# 🧟 Zom-B: GAMEIN Framework Integration Guide

## 📋 Table of Contents
- [Overview](#overview)
- [Framework Components](#framework-components)
- [File Structure](#file-structure)
- [Local Multiplayer Architecture](#local-multiplayer-architecture)
- [Usage Examples](#usage-examples)
- [Migration from Original Code](#migration-from-original-code)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

Zom-B now integrates **GAMEIN framework patterns** for stable, deterministic local multiplayer gameplay. This integration maintains the narrative-driven AI experience while adding:

✅ **Deterministic Combat** - Consistent game logic across host/client
✅ **Constants-Based Balance** - Easy tuning without code changes
✅ **Event-Based Multiplayer** - Reliable P2P synchronization
✅ **Procedural Generation** - ROT.js integration for world building
✅ **Action Validation** - Client-side prediction with server authority

---

## Framework Components

### 1. Game Balance Constants (`lib/gameBalance.ts`)

Centralized configuration for all game mechanics.

**Key Features:**
- Combat parameters (damage, crit chance, AP costs)
- Skill progression bonuses
- Zombie type definitions with stats
- Survival mechanics (hunger, thirst, infection)
- Loot tables and spawn weights

**Example:**
```typescript
import { GAME_BALANCE, calculateDamage, selectZombieType } from './lib/gameBalance';

// Use in game logic
const damage = calculateDamage(baseDamage, enemyDefense, isCritical);
const zombieType = selectZombieType(isNight);

// Access config
const apCost = GAME_BALANCE.combat.baseActionPoints; // 3
const critChance = GAME_BALANCE.combat.criticalHitChance; // 0.1 (10%)
```

### 2. Combat Engine (`lib/combatEngine.ts`)

Deterministic turn-based combat state machine.

**Key Features:**
- Validates actions before processing
- Calculates damage/healing/effects
- Manages turn phases (player turn → enemy turn)
- Tracks combat log for narrative generation
- No RNG variance across hosts/clients

**Example:**
```typescript
import CombatEngine, { initiateCombat } from './lib/combatEngine';

// Initialize combat
const gameState = initiateCombat(currentState, ['Walker', 'Runner'], isNight);

// Process player action
const engine = new CombatEngine(gameState);
const { gameState: newState, results } = engine.processAction({
  type: 'attack',
  targetId: 'z1'
});

// Results contain technical log
results.forEach(r => console.log(r.message));
// "Dealt 15 damage to Walker (15/30 HP remaining)"
```

### 3. ROT.js Integration (`lib/rotjsIntegration.ts`)

Procedural generation toolkit for dynamic worlds.

**Key Features:**
- Dungeon generation (rooms + corridors)
- Cellular automata (outdoor environments)
- Field of View (FOV) calculations
- A* pathfinding for zombie AI
- Seeded RNG for multiplayer sync

**Example:**
```typescript
import {
  generateProceduralWorld,
  calculateFOV,
  findPath
} from './lib/rotjsIntegration';

// Generate world (same seed = identical maps for all players)
const world = generateProceduralWorld(40, 30, 'multiplayer-seed-123');

// Calculate FOV
const visibleTiles = calculateFOV(world, playerX, playerY, 8);

// Pathfinding for zombies
const path = findPath(world, { x: zombieX, y: zombieY }, { x: playerX, y: playerY });
```

### 4. Peer Game Protocol (`lib/peerGameProtocol.ts`)

Enhanced multiplayer messaging system.

**Key Features:**
- Typed message protocol (no guessing)
- Action validation before sending
- State synchronization helpers
- Connection health monitoring
- Rollback for out-of-sync clients

**Example:**
```typescript
import {
  ProtocolUtils,
  MessageValidator,
  StateSyncManager
} from './lib/peerGameProtocol';

// Host: Send action result
const message = ProtocolUtils.createActionResult(actionId, true, results, newGameState);
peerService.send(message);

// Client: Validate incoming action
const { valid, reason } = MessageValidator.validateAction(action, currentGameState);
if (!valid) {
  console.error(`Invalid action: ${reason}`);
}

// Sync manager
const syncManager = new StateSyncManager();
if (syncManager.shouldSync()) {
  const syncMsg = syncManager.createSyncMessage(gameState, messages);
  peerService.broadcast(syncMsg);
}
```

---

## File Structure

```
zom-b_-survival-protocols/
├── lib/                              # 🆕 GAMEIN Framework Modules
│   ├── gameBalance.ts                # Game constants & balance config
│   ├── combatEngine.ts               # Deterministic combat logic
│   ├── rotjsIntegration.ts           # Procedural generation & pathfinding
│   └── peerGameProtocol.ts           # Enhanced multiplayer messaging
│
├── components/
│   ├── GameScreen.tsx                # Main game UI
│   └── SetupScreen.tsx               # Multiplayer lobby
│
├── services/
│   ├── geminiService.ts              # AI narrative generation
│   └── peerService.ts                # PeerJS wrapper
│
├── constants.ts                       # ✏️ Modified: Now injects GAME_BALANCE
├── types.ts                           # Type definitions
├── App.tsx                            # App controller
│
├── FRAMEWORK_INTEGRATION.md          # 🆕 This file
├── README.md                          # Original README
└── package.json                       # Dependencies (now includes rot-js)
```

---

## Local Multiplayer Architecture

### Design Philosophy

**Host-Authoritative Model**
The host runs all game logic and broadcasts results to clients. This prevents cheating and ensures consistency.

```
┌─────────────┐                    ┌─────────────┐
│   HOST      │                    │   CLIENT    │
│             │                    │             │
│  Gemini AI  │ ◄──── WebRTC ───► │  (Display)  │
│  Combat     │       PeerJS       │             │
│  World Gen  │                    │             │
└─────────────┘                    └─────────────┘
```

### Message Flow

**1. Initial Connection**
```
Client → Host: HANDSHAKE { character }
Host → Client: HANDSHAKE_ACK { worldSeed, currentGameState }
```

**2. Player Action**
```
Client → Host: GAME_ACTION { action: { type: 'attack', targetId: 'z1' } }
Host processes with CombatEngine
Host → Client: STATE_SYNC { gameState, messages, timestamp }
```

**3. Combat Update**
```
Host: Run enemy turn
Host → Client: COMBAT_UPDATE { gameState, combatLog }
```

**4. Connection Health**
```
Host ↔ Client: PING / PONG (every 3 seconds)
```

### State Synchronization Rules

| Scenario | Host Behavior | Client Behavior |
|----------|---------------|-----------------|
| **Valid Action** | Process → Broadcast new state | Display result |
| **Invalid Action** | Send ACTION_REJECTED + correct state | Rollback to synced state |
| **Out of Sync** | Send full STATE_SYNC | Replace local state |
| **Network Timeout** | Mark client as disconnected | Show "Reconnecting..." |

---

## Usage Examples

### Example 1: Starting a Multiplayer Session

**Host Side:**
```typescript
// SetupScreen.tsx
const hostId = await peerService.initHost();
console.log(`Share this ID: ${hostId}`);

// Start game when client connects
peerService.onData((data) => {
  if (data.type === 'HANDSHAKE') {
    const worldSeed = Date.now().toString();
    const world = generateProceduralWorld(40, 30, worldSeed);

    peerService.send({
      type: 'HANDSHAKE_ACK',
      worldSeed,
      currentGameState: INITIAL_GAME_STATE
    });
  }
});
```

**Client Side:**
```typescript
// SetupScreen.tsx
await peerService.joinGame(targetHostId);

peerService.send({
  type: 'HANDSHAKE',
  character: { name, profession, perk },
  clientVersion: PROTOCOL_VERSION
});

// Wait for STATE_SYNC
peerService.onData((data) => {
  if (data.type === 'STATE_SYNC') {
    setGameState(data.gameState);
    setMessages(data.messages);
  }
});
```

### Example 2: Processing Combat Actions (Host)

```typescript
// GameScreen.tsx (Host mode)
import CombatEngine from './lib/combatEngine';
import { ProtocolUtils } from './lib/peerGameProtocol';

async function handleClientAction(actionData) {
  const { actionId, payload } = actionData;

  // Validate action
  const { valid, reason } = MessageValidator.validateAction(payload, gameState);

  if (!valid) {
    peerService.send(
      ProtocolUtils.createActionRejection(actionId, reason, gameState)
    );
    return;
  }

  // Process with combat engine
  const engine = new CombatEngine(gameState);
  const { gameState: newState, results } = engine.processAction(payload);

  // Generate narrative with Gemini
  const narrative = await narrativizeCombat(results, newState);

  // Broadcast to client
  peerService.send({
    type: 'STATE_SYNC',
    gameState: newState,
    messages: [...messages, { role: 'model', text: narrative }],
    timestamp: Date.now()
  });
}
```

### Example 3: Client-Side Action Validation

```typescript
// GameScreen.tsx (Client mode)
function handlePlayerInput(inputText) {
  // Parse input into action
  const action = parseInputToAction(inputText); // Custom parser

  // Validate locally before sending
  const { valid, reason } = MessageValidator.validateAction(action, gameState);

  if (!valid) {
    setMessages(prev => [...prev, {
      role: 'system',
      text: `Action blocked: ${reason}`
    }]);
    return;
  }

  // Send to host
  const actionId = ProtocolUtils.generateActionId();
  peerService.send({
    type: 'GAME_ACTION',
    actionId,
    action: 'combat',
    payload: action,
    timestamp: Date.now()
  });

  // Show "waiting" state
  setIsProcessing(true);
}
```

### Example 4: Procedural World Generation

```typescript
// Generate world on host
import { generateProceduralWorld, calculateFOV } from './lib/rotjsIntegration';

const worldSeed = 'session-' + Date.now();
const world = generateProceduralWorld(40, 30, worldSeed);

// Send seed to client (not full world data)
peerService.send({
  type: 'HANDSHAKE_ACK',
  worldSeed,
  currentGameState: { ...INITIAL_GAME_STATE, location: 'Procedural Dungeon Level 1' }
});

// Client regenerates same world
const clientWorld = generateProceduralWorld(40, 30, worldSeed);
// clientWorld.tiles === world.tiles (deterministic)

// Update FOV as player moves
const visibleTiles = calculateFOV(world, playerX, playerY, 8);
visibleTiles.forEach(tileKey => {
  const [x, y] = tileKey.split(',').map(Number);
  world.tiles[y][x].visible = true;
});
```

---

## Migration from Original Code

### Step 1: Install Dependencies

```bash
npm install rot-js@2.2.0
```

### Step 2: Import Framework Modules

**Before:**
```typescript
// constants.ts
export const generateSystemInstruction = (config: GameConfig): string => `
Combat rules: Player has 3 AP, deals 10 damage, crits on 10% chance...
`;
```

**After:**
```typescript
// constants.ts
import { GAME_BALANCE } from './lib/gameBalance';

export const generateSystemInstruction = (config: GameConfig): string => `
**GAME BALANCE:** ${JSON.stringify(GAME_BALANCE, null, 2)}
...
`;
```

### Step 3: Replace Narrative-Driven Combat with Engine

**Before (Pure Gemini):**
```typescript
// All combat logic in LLM prompt
const result = await gemini.sendGameAction("Attack walker with pipe");
// Gemini calculates damage, updates HP, generates text
```

**After (Hybrid):**
```typescript
import CombatEngine from './lib/combatEngine';

// 1. Process logic deterministically
const engine = new CombatEngine(gameState);
const { gameState: newState, results } = engine.processAction({
  type: 'attack',
  targetId: 'z1'
});

// 2. Generate narrative separately
const narrative = await gemini.generateText(`
Describe this combat action in 2-3 sentences:
${JSON.stringify(results, null, 2)}
`);

// 3. Broadcast both
setGameState(newState);
setMessages(prev => [...prev, { role: 'model', text: narrative }]);
```

### Step 4: Add Action Validation

**Before:**
```typescript
// No validation, send directly
peerService.send({ type: 'ACTION', text: userInput });
```

**After:**
```typescript
import { MessageValidator, ProtocolUtils } from './lib/peerGameProtocol';

const action = { type: 'attack', targetId: 'z1' };
const { valid, reason } = MessageValidator.validateAction(action, gameState);

if (valid) {
  peerService.send(ProtocolUtils.createActionMessage(action));
} else {
  console.error(`Invalid: ${reason}`);
}
```

---

## Testing

### Unit Tests (Example)

```typescript
// test/combatEngine.test.ts
import { describe, it, expect } from 'vitest';
import CombatEngine, { initiateCombat } from '../lib/combatEngine';
import { INITIAL_GAME_STATE } from '../constants';

describe('CombatEngine', () => {
  it('should deal damage on successful attack', () => {
    const state = initiateCombat(INITIAL_GAME_STATE, ['Walker'], false);
    const engine = new CombatEngine(state);

    const { results } = engine.processAction({ type: 'attack', targetId: 'z1' });

    expect(results[0].success).toBe(true);
    expect(results[0].type).toBe('damage');
    expect(results[0].amount).toBeGreaterThan(0);
  });

  it('should validate invalid actions', () => {
    const engine = new CombatEngine(INITIAL_GAME_STATE);

    const { results } = engine.processAction({ type: 'attack', targetId: 'invalid' });

    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain('Invalid');
  });
});
```

### Manual Multiplayer Test

1. **Start Host:**
   ```bash
   npm run dev
   ```
   - Select "MULTIPLAYER" → "HOST GAME"
   - Note the Session ID

2. **Start Client (Second Browser/Tab):**
   - Open `http://localhost:5173`
   - Select "MULTIPLAYER" → "JOIN GAME"
   - Paste Session ID
   - Click "CONNECT TO HOST"

3. **Test Actions:**
   - Host: Type "explore hospital"
   - Client should see same narrative
   - Client: Type "attack walker"
   - Host processes, both see result

---

## Troubleshooting

### Issue: Client sees different game state than host

**Cause:** Network desync or missed STATE_SYNC message.

**Solution:**
```typescript
// Client: Request resync
peerService.send({ type: 'STATE_REQUEST', reason: 'out_of_sync' });

// Host: Handle request
peerService.onData((data) => {
  if (data.type === 'STATE_REQUEST') {
    peerService.send({
      type: 'STATE_SYNC',
      gameState: currentGameState,
      messages: currentMessages,
      timestamp: Date.now()
    });
  }
});
```

### Issue: "Action rejected: Out of sync"

**Cause:** Client's local state is stale.

**Solution:** Client automatically receives correct state in `ACTION_REJECTED` message. UI should update:
```typescript
peerService.onData((data) => {
  if (data.type === 'ACTION_REJECTED') {
    setGameState(data.currentGameState); // Rollback
    alert(`Action failed: ${data.reason}`);
  }
});
```

### Issue: Gemini prompt too large (>30KB)

**Cause:** `GAME_BALANCE` JSON adds ~5KB to prompt.

**Solution:** Simplify balance config or use compressed JSON:
```typescript
const balanceStr = JSON.stringify(GAME_BALANCE); // Remove null, 2 from stringify
```

### Issue: ROT.js world generation different for host/client

**Cause:** Seed not transmitted or applied incorrectly.

**Solution:** Ensure seed is sent in HANDSHAKE_ACK:
```typescript
// Host
const seed = Date.now().toString();
peerService.send({ type: 'HANDSHAKE_ACK', worldSeed: seed, ... });

// Client
const { worldSeed } = handshakeAckData;
const world = generateProceduralWorld(40, 30, worldSeed);
```

---

## Advanced Usage

### Custom Zombie Types

Add new types to `lib/gameBalance.ts`:

```typescript
export const GAME_BALANCE = {
  ...
  zombieTypes: {
    ...
    Behemoth: {
      name: 'Behemoth',
      hp: 150,
      maxHp: 150,
      attack: 25,
      defense: 15,
      xpReward: 100,
      spawnWeight: 0.02, // 2% spawn chance
      description: 'Massive mutated zombie. Requires explosives.',
      loot: [
        { item: 'Reinforced Plating', chance: 0.9, min: 2, max: 4 }
      ]
    }
  }
};
```

### Custom Combat Actions

Extend `CombatActionType` in `lib/combatEngine.ts`:

```typescript
export type CombatActionType = 'attack' | 'defend' | 'use_item' | 'flee' | 'move' | 'grenade';

// Add processing
case 'grenade':
  results.push(...this.processGrenade(action.targetId!));
  break;
```

### Procedural Events

Use ROT.js RNG for consistent event generation:

```typescript
import { SeededRNG } from './lib/rotjsIntegration';

const rng = new SeededRNG(worldSeed);
const eventRoll = rng.getUniform();

if (eventRoll < 0.1) {
  // 10% chance: Zombie horde
  const zombieCount = rng.getUniformInt(5, 10);
  spawnZombies(zombieCount);
} else if (eventRoll < 0.2) {
  // 10% chance: Supply cache
  addToInventory('Medical Kit', rng.getUniformInt(1, 3));
}
```

---

## API Reference

### `lib/gameBalance.ts`

| Export | Type | Description |
|--------|------|-------------|
| `GAME_BALANCE` | `const` | Main balance configuration object |
| `calculateDamage(base, def, crit)` | `function` | Damage calculation with variance |
| `calculateSkillSuccessChance(level)` | `function` | Skill check probability (0-1) |
| `rollCriticalHit(level, type)` | `function` | Roll for crit (boolean) |
| `selectZombieType(isNight)` | `function` | Weighted zombie selection |

### `lib/combatEngine.ts`

| Export | Type | Description |
|--------|------|-------------|
| `CombatEngine` | `class` | Main combat state machine |
| `initiateCombat(state, types, isNight)` | `function` | Spawn enemies and start combat |
| `CombatAction` | `interface` | Action payload structure |
| `CombatResult` | `interface` | Action result structure |

### `lib/rotjsIntegration.ts`

| Export | Type | Description |
|--------|------|-------------|
| `generateProceduralWorld(w, h, seed)` | `function` | Dungeon generation |
| `generateCellularWorld(w, h, seed)` | `function` | Outdoor generation |
| `calculateFOV(world, x, y, radius)` | `function` | Field of view calculation |
| `findPath(world, start, goal)` | `function` | A* pathfinding |
| `SeededRNG` | `class` | Deterministic RNG wrapper |

### `lib/peerGameProtocol.ts`

| Export | Type | Description |
|--------|------|-------------|
| `MessageValidator` | `class` | Message/action validation |
| `ActionQueue` | `class` | Client-side action queueing |
| `StateSyncManager` | `class` | State sync helpers |
| `ProtocolUtils` | `object` | Message creation utilities |

---

## Credits

**Framework Inspiration:** [GAMEIN by QualityFAI](https://github.com/QualityFAI/gamein)
**Procedural Generation:** [ROT.js](https://github.com/ondras/rot.js)
**Networking:** [PeerJS](https://peerjs.com/)
**AI Narrative:** [Google Gemini 2.5](https://ai.google.dev/)

---

## Next Steps

### Phase 1: Current Implementation ✅
- ✅ Constants-based balance
- ✅ Deterministic combat engine
- ✅ ROT.js integration
- ✅ Enhanced peer protocol
- ✅ Gemini prompt injection

### Phase 2: Enhanced Features (Optional)
- [ ] Replace free-form text input with structured action buttons
- [ ] Implement world exploration with ROT.js FOV
- [ ] Add procedural dungeon levels
- [ ] Zombie AI using pathfinding
- [ ] Skill tree UI

### Phase 3: Production Hardening (Optional)
- [ ] Replace PeerJS with dedicated server (Socket.io)
- [ ] Add matchmaking system
- [ ] Persistent save/load
- [ ] Analytics dashboard
- [ ] Anti-cheat validation

---

**Framework Version:** 1.0.0
**Last Updated:** December 4, 2025
**Compatibility:** Zom-B v0.9.5+
