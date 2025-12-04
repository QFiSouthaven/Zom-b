/**
 * @file geminiService.ts
 * @description Game Engine Service Layer.
 * 
 * This file implements the "Adapter Pattern" to switch between:
 * 1. Google Gemini Cloud API (Standard)
 * 2. Local LLM via LM Studio (Offline/Private)
 * 
 * It handles the API calls and crucially, the **Parsing Logic** to extract
 * the JSON game state from the AI's natural language response.
 */

import { GoogleGenAI, Chat } from "@google/genai";
import { GameConfig } from "../types";
import { generateSystemInstruction } from "../constants";

/* --- ADAPTER INTERFACE --- */
/**
 * Common interface that any AI provider must implement to work with the game.
 */
interface GameEngineAdapter {
  initialize(config: GameConfig): Promise<void>;
  sendMessage(message: string): Promise<{ text: string; rawState?: any }>;
  generateImage(prompt: string): Promise<string | null>;
}

/* --- GEMINI CLOUD ADAPTER --- */
/**
 * Adapter for Google's Gemini API (via @google/genai SDK).
 * Uses a stateful Chat Session.
 */
class GeminiCloudAdapter implements GameEngineAdapter {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;
  private config: GameConfig | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async initialize(config: GameConfig) {
    this.config = config;
    this.chatSession = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: generateSystemInstruction(config),
        temperature: 0.9,
      },
    });
  }

  async sendMessage(message: string) {
    if (!this.chatSession) throw new Error("Session not initialized");
    const result = await this.chatSession.sendMessage({ message });
    return { text: result.text };
  }

  async generateImage(prompt: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      return null;
    } catch (e) {
      console.error("Gemini Image Gen Error:", e);
      return null;
    }
  }
}

/* --- LOCAL LM STUDIO ADAPTER --- */
/**
 * Adapter for Local Inference Servers (OpenAI-compatible endpoints).
 * Examples: LM Studio, Ollama, LocalAI.
 * 
 * Note: Since local REST APIs are stateless, we manually manage the `history` array.
 */
class LocalLLMAdapter implements GameEngineAdapter {
  private history: { role: string; content: string }[] = [];
  private endpoint: string = 'http://localhost:1234/v1';
  private systemPrompt: string = '';

  async initialize(config: GameConfig) {
    this.endpoint = config.localEndpoint || 'http://localhost:1234/v1';
    this.systemPrompt = generateSystemInstruction(config);
    // Initialize history with system prompt
    this.history = [
      { role: "system", content: this.systemPrompt }
    ];
  }

  async sendMessage(message: string) {
    // Add user message to history
    this.history.push({ role: "user", content: message });

    // Prepare payload for OpenAI-compatible API
    const payload = {
      model: "local-model", // LM Studio usually ignores this or uses loaded model
      messages: this.history,
      temperature: 0.7,
      stream: false
    };

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': 'Bearer not-needed' // Usually not needed for local
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Local Engine Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      // Add assistant response to history
      this.history.push({ role: "assistant", content });

      return { text: content };

    } catch (error) {
      console.error("Local Adapter Connection Failed:", error);
      return { text: "⚠️ **CONNECTION ERROR**: Could not reach local game engine. Ensure LM Studio server is running and CORS is enabled." };
    }
  }

  async generateImage(prompt: string) {
    // Local text models typically cannot generate images
    // We could return null or implement a local Stable Diffusion call if needed
    console.log("Local image generation skipped (Text-only mode)");
    return null; 
  }
}

/* --- SERVICE EXPORT --- */

let activeAdapter: GameEngineAdapter | null = null;

/**
 * Initializes the selected engine adapter based on configuration.
 */
export const initializeGame = async (config: GameConfig) => {
  if (config.engineMode === 'local') {
    activeAdapter = new LocalLLMAdapter();
  } else {
    activeAdapter = new GeminiCloudAdapter();
  }
  await activeAdapter.initialize(config);
};

/**
 * Sends an action to the active engine and parses the response.
 * 
 * @param action - The user's input (e.g., "Attack zombie").
 * @returns Object containing the cleaned text response and the parsed GameState object.
 */
export const sendGameAction = async (action: string) => {
  if (!activeAdapter) throw new Error("Game engine not initialized");

  try {
    const { text } = await activeAdapter.sendMessage(action);
    
    // Universal JSON State Parsing (Works for both adapters)
    // We look for a code block marked with ```json_state
    const stateRegex = /```json_state([\s\S]*?)```/;
    const match = text.match(stateRegex);
    
    let newState = null;
    let cleanText = text;

    if (match && match[1]) {
      try {
        newState = JSON.parse(match[1]);
        cleanText = text.replace(stateRegex, '').trim(); // Remove the JSON block from display text
      } catch (e) {
        console.error("Failed to parse game state JSON", e);
      }
    }

    return {
      text: cleanText,
      gameState: newState
    };
  } catch (error) {
    console.error("Game Action Error:", error);
    throw error;
  }
};

/**
 * Generates a visual representation of the current scene if supported by the engine.
 */
export const generateSceneVisual = async (sceneDescription: string) => {
  if (!activeAdapter) return null;
  return activeAdapter.generateImage(`Cinematic digital art, atmospheric, high quality, concept art style. Scene description: ${sceneDescription}`);
};