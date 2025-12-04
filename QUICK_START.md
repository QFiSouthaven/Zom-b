# 🚀 Zom-B: Local Multiplayer Quick Start

## 🎮 Play Locally in 3 Steps

### Step 1: Install & Setup
```bash
# Install dependencies
npm install

# Add your Gemini API key to .env.local
echo "GEMINI_API_KEY=your_key_here" > .env.local
```

### Step 2: Start Development Server
```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### Step 3: Start Multiplayer Session

#### **Player 1 (Host):**
1. Click **"MULTIPLAYER"** button
2. Select **"HOST GAME"**
3. Configure character (Name, Role, Trait)
4. Wait for Session ID to appear
5. **Share the Session ID** with Player 2
6. Wait for "PLAYER CONNECTED" status
7. Click **"LAUNCH CO-OP SESSION"**

#### **Player 2 (Client):**
1. Open `http://localhost:5173` in **a new browser tab/window**
2. Click **"MULTIPLAYER"** button
3. Select **"JOIN GAME"**
4. Paste the **Session ID** from Player 1
5. Click **"CONNECT TO HOST"**
6. Wait for automatic connection

---

## 🎯 Gameplay Guide

### Exploration Phase
- Type narrative commands: `"explore hospital"`, `"search for supplies"`, `"rest"`
- No Action Points required
- Both players see synchronized narrative

### Combat Phase
- **Host processes all combat logic** (ensures fairness)
- **3 Action Points per turn**
- Use quick action buttons:
  - **MOVE** (1 AP) - Change range
  - **ATTACK** (1 AP) - Strike with equipped weapon
  - **DEFEND** (1 AP) - Block incoming damage
  - **HEAL** (1 AP) - Use medical items
- **Turn ends automatically** when AP reaches 0
- Zombies counter-attack immediately

### Multiplayer Rules
- **Host is authoritative** - All actions processed by Host
- **Client sends actions** → Host validates → Results broadcast to both
- **State always synced** - If desync occurs, Host resends correct state
- **Both players see identical game state**

---

## 🧠 Framework Features

### Deterministic Combat
Combat uses **CombatEngine** instead of pure AI generation:
- Consistent damage calculations
- Predictable skill checks
- Same results for same actions

### Procedural Worlds (Optional)
Enable ROT.js world generation for unique maps each session:
```typescript
// In your code
import { generateProceduralWorld } from './lib/rotjsIntegration';
const world = generateProceduralWorld(40, 30, sessionSeed);
```

### Balance Tuning
Edit `lib/gameBalance.ts` to change game mechanics:
```typescript
export const GAME_BALANCE = {
  combat: {
    baseActionPoints: 3,        // Change to 4 for easier combat
    criticalHitChance: 0.1,     // Change to 0.2 for more crits
    damageVariance: 0.2,        // Damage randomness (±20%)
  }
};
```

**No code changes needed!** Just edit values and restart.

---

## 🔧 Troubleshooting

### "Connection failed"
- **Cause:** PeerJS server issues or firewall blocking WebRTC
- **Solution:**
  1. Refresh both browsers
  2. Try incognito/private mode
  3. Check browser console for errors

### "Action rejected"
- **Cause:** Client's game state is out of sync
- **Solution:**
  - Client automatically receives correct state
  - Retry the action

### "State desync"
- **Symptoms:** Client sees different HP/enemies than Host
- **Solution:**
  1. Host: Type anything (triggers STATE_SYNC)
  2. Client: Wait 2 seconds for update
  3. If still desynced, refresh client browser

### Gemini API Errors
- **"API Key Invalid":**
  - Check `.env.local` file exists
  - Verify key starts with `GEMINI_API_KEY=`
- **"Rate Limit Exceeded":**
  - Wait 1 minute
  - Reduce action frequency

---

## 📊 Performance Tips

### For Smoother Gameplay
1. **Use Chrome/Edge** (best WebRTC support)
2. **Close other tabs** (reduces memory usage)
3. **Local network preferred** (Host & Client on same WiFi)

### For Faster AI Responses
1. Use **concise commands** (`"attack walker"` not `"I want to attack the walker zombie"`)
2. Enable **Local LLM mode** (LM Studio) for zero-latency narrative

---

## 🎨 Customization

### Add New Zombie Types
Edit `lib/gameBalance.ts`:
```typescript
zombieTypes: {
  ...
  Inferno: {
    name: 'Inferno',
    hp: 60,
    maxHp: 60,
    attack: 18,
    defense: 5,
    xpReward: 40,
    spawnWeight: 0.08,
    description: 'Burning zombie. Explodes on death.',
    loot: [{ item: 'Molotov Cocktail', chance: 0.6, min: 1, max: 2 }]
  }
}
```

### Adjust Difficulty
```typescript
combat: {
  baseActionPoints: 4,          // More AP = easier
  defenseDamageReduction: 0.75, // More defense = easier
}
```

### Change Starting Stats
Edit `constants.ts`:
```typescript
export const INITIAL_GAME_STATE: GameState = {
  hp: 150,              // Start with more HP
  maxHp: 150,
  supplies: 10,         // More starting supplies
  inventory: ['Pistol', 'Medkit', 'Flashlight'], // Better starting gear
  ...
};
```

---

## 🧪 Advanced: Optional Integrations

### Enable Procedural Worlds
```typescript
// In GameScreen.tsx initialization
import { generateProceduralWorld, calculateFOV } from './lib/rotjsIntegration';

const worldSeed = Date.now().toString();
const world = generateProceduralWorld(40, 30, worldSeed);

// Send seed to client in HANDSHAKE_ACK
peerService.send({
  type: 'HANDSHAKE_ACK',
  worldSeed,
  currentGameState: gameState
});
```

### Use Combat Engine Directly
```typescript
// Replace narrative combat with deterministic engine
import CombatEngine from './lib/combatEngine';

const engine = new CombatEngine(gameState);
const { gameState: newState, results } = engine.processAction({
  type: 'attack',
  targetId: 'z1'
});

// Then generate narrative
const narrative = await gemini.generateText(`Describe: ${results[0].message}`);
```

---

## 📚 Documentation

- **Full Integration Guide:** [FRAMEWORK_INTEGRATION.md](FRAMEWORK_INTEGRATION.md)
- **Original Setup:** [README.md](README.md)
- **GAMEIN Framework:** [https://github.com/QualityFAI/gamein](https://github.com/QualityFAI/gamein)

---

## 🐛 Reporting Issues

If you encounter bugs:
1. Check browser console (F12) for errors
2. Note what action caused the issue
3. Check if issue persists after refresh
4. Share error messages and steps to reproduce

---

## 🎉 Have Fun!

You're all set! Gather a friend and survive the apocalypse together.

**Pro Tips:**
- Coordinate attacks on tough zombies (Tank, Behemoth)
- Share healing items between players
- Use voice chat (Discord/Zoom) for better coordination
- Save "Flee" action for desperate situations (60% success)

---

**Version:** 1.0.0
**Updated:** December 4, 2025
**Framework:** GAMEIN-inspired
