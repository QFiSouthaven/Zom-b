/**
 * @file peerService.ts
 * @description Peer-to-Peer Networking Service.
 * 
 * Handles multiplayer connectivity using PeerJS (WebRTC wrapper).
 * - **Host Mode**: Generates a Session ID, listens for connections, and broadcasts Game State.
 * - **Client Mode**: Connects to a Session ID and sends user actions to the Host.
 */

import { Peer, DataConnection } from 'peerjs';
import { PeerData } from '../types';

class PeerService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onDataCallback: ((data: PeerData) => void) | null = null;

  /**
   * Initializes the peer connection as a HOST.
   * @returns Promise resolving to the generated Session ID (Peer ID).
   */
  async initHost(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a random ID (PeerJS allows custom IDs but collisions are possible, letting it gen is safer)
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        console.log('Host ID:', id);
        resolve(id);
      });

      this.peer.on('connection', (connection) => {
        console.log('Client connected:', connection.peer);
        this.conn = connection;
        this.setupConnection();
      });

      this.peer.on('error', (err) => {
        console.error('Peer Error:', err);
        reject(err);
      });
    });
  }

  /**
   * Initializes the peer connection as a CLIENT.
   * @param hostId - The Session ID of the host to connect to.
   */
  async joinGame(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        // Connect to host
        if (!this.peer) return;
        this.conn = this.peer.connect(hostId);
        
        this.conn.on('open', () => {
          console.log('Connected to Host');
          this.setupConnection();
          resolve();
        });

        this.conn.on('error', (err) => {
          reject(err);
        });
      });

      this.peer.on('error', (err) => reject(err));
    });
  }

  /**
   * Sets up event listeners for the active data connection.
   */
  private setupConnection() {
    if (!this.conn) return;

    this.conn.on('data', (data) => {
      if (this.onDataCallback) {
        this.onDataCallback(data as PeerData);
      }
    });

    this.conn.on('close', () => {
        console.log("Connection closed");
    });
  }

  /**
   * Sends a typed data packet to the connected peer.
   */
  send(data: PeerData) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    } else {
        console.warn("Cannot send data, connection not open");
    }
  }

  /**
   * Registers a callback to handle incoming data.
   */
  onData(callback: (data: PeerData) => void) {
    this.onDataCallback = callback;
  }
  
  /**
   * Cleans up connections and destroys the peer instance.
   */
  cleanup() {
      this.conn?.close();
      this.peer?.destroy();
  }
}

export const peerService = new PeerService();