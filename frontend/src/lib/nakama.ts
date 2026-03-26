import { Client, Session, Socket } from '@heroiclabs/nakama-js';

// Nakama server configuration
const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || '127.0.0.1';
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350';
const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true';
const NAKAMA_SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey';

// OpCodes matching server
export const OpCode = {
  MOVE: 1,
  STATE_UPDATE: 2,
  GAME_OVER: 3,
  TIMER_SYNC: 4,
  GAME_START: 5,
  ERROR: 6,
  OPPONENT_LEFT: 7,
};

// Singleton client instance
let client: Client | null = null;
let session: Session | null = null;
let socket: Socket | null = null;

export function getClient(): Client {
  if (!client) {
    client = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);
  }
  return client;
}

export async function authenticate(nickname: string): Promise<Session> {
  const c = getClient();

  // Use device ID for authentication (simple, no registration needed)
  let deviceId = localStorage.getItem('nakama_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('nakama_device_id', deviceId);
  }

  session = await c.authenticateDevice(deviceId, true, nickname);

  // Update display name if different
  if (session.username !== nickname) {
    await c.updateAccount(session, { display_name: nickname, username: nickname + '_' + deviceId.substring(0, 4) });
  }

  return session;
}

export function getSession(): Session | null {
  return session;
}

export async function connectSocket(): Promise<Socket> {
  if (!session) {
    throw new Error('Must authenticate before connecting socket');
  }

  const c = getClient();
  socket = c.createSocket(NAKAMA_USE_SSL, false);
  await socket.connect(session, true);

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export async function addMatchmaker(mode: string): Promise<{ ticket: string }> {
  if (!socket) {
    throw new Error('Socket not connected');
  }

  const ticket = await socket.addMatchmaker(
    '+properties.mode:' + mode,  // query: match players with same mode
    2,                            // min count
    2,                            // max count
    { mode: mode },              // string properties
    {}                           // numeric properties
  );

  return ticket;
}

export async function removeMatchmaker(ticket: string): Promise<void> {
  if (!socket) return;
  await socket.removeMatchmaker(ticket);
}

export async function joinMatch(matchId: string): Promise<void> {
  if (!socket) {
    throw new Error('Socket not connected');
  }
  await socket.joinMatch(matchId);
}

export async function sendMove(matchId: string, position: number): Promise<void> {
  if (!socket) {
    throw new Error('Socket not connected');
  }
  const data = JSON.stringify({ position });
  await socket.sendMatchState(matchId, OpCode.MOVE, data);
}

export async function leaveMatch(matchId: string): Promise<void> {
  if (!socket) return;
  await socket.leaveMatch(matchId);
}

export async function fetchLeaderboard(): Promise<any> {
  if (!session) {
    throw new Error('Not authenticated');
  }
  const c = getClient();
  const result = await c.rpc(session, 'get_leaderboard', {});
  return result.payload || { leaderboard: [] };
}

export async function fetchPlayerStats(): Promise<any> {
  if (!session) {
    throw new Error('Not authenticated');
  }
  const c = getClient();
  const result = await c.rpc(session, 'get_player_stats', {});
  return result.payload || {};
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect(true);
    socket = null;
  }
}
