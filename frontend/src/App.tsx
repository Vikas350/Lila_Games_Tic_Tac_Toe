import { useState, useCallback, useRef, useEffect } from 'react';
import './index.css';
import NicknameScreen from './screens/NicknameScreen';
import MatchmakingScreen from './screens/MatchmakingScreen';
import GameScreen from './screens/GameScreen';
import ResultScreen from './screens/ResultScreen';
import {
  authenticate,
  connectSocket,
  getSocket,
  getSession,
  addMatchmaker,
  removeMatchmaker,
  sendMove,
  leaveMatch,
  OpCode,
  disconnectSocket,
} from './lib/nakama';

type Screen = 'nickname' | 'matchmaking' | 'game' | 'result';

interface PlayerInfo {
  username: string;
  mark: 'X' | 'O';
}

interface GameResult {
  result: 'win' | 'loss' | 'draw';
  winnerMark?: string;
  reason: string;
  pointsEarned: number;
}

function App() {
  const [screen, setScreen] = useState<Screen>('nickname');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Game state
  const [matchId, setMatchId] = useState<string>('');
  const [players, setPlayers] = useState<{ [userId: string]: PlayerInfo }>({});
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<string>('');
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [gameMode, setGameMode] = useState<string>('classic');
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [turnTimeLimit, setTurnTimeLimit] = useState<number>(0);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  // Refs
  const matchmakerTicketRef = useRef<string>('');
  const selectedModeRef = useRef<string>('classic');
  const nicknameRef = useRef<string>('');

  // Error display
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const setupSocketListeners = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;

    // Matchmaker matched - player found
    socket.onmatchmakermatched = (matched) => {
      if (!matched.match_id) return;
      const mId = matched.match_id;
      setMatchId(mId);
      
      // Join the match
      socket.joinMatch(mId).then(() => {
        // Wait for GAME_START from server
      }).catch((err) => {
        console.error('Failed to join match:', err);
        setError('Failed to join match');
        setScreen('nickname');
      });
    };

    // Match data - game events from server
    socket.onmatchdata = (data) => {
      const decoder = new TextDecoder();
      let payload: any;
      try {
        payload = JSON.parse(decoder.decode(data.data));
      } catch {
        return;
      }

      const session = getSession();
      const myUserId = session?.user_id || '';

      switch (data.op_code) {
        case OpCode.GAME_START:
          setPlayers(payload.players || {});
          setPlayerOrder(payload.playerOrder || []);
          setCurrentTurn(payload.currentTurn || '');
          setBoard(payload.board || Array(9).fill(null));
          setGameMode(payload.gameMode || 'classic');
          setTurnTimeLimit(payload.turnTimeLimit || 0);
          setTimeRemaining(payload.turnTimeLimit || 30);
          setScreen('game');
          break;

        case OpCode.STATE_UPDATE:
          setBoard(payload.board || []);
          setCurrentTurn(payload.currentTurn || '');
          if (payload.lastMove) {
            setLastMove(payload.lastMove.position);
          }
          // Reset timer on new turn in timed mode
          setTimeRemaining(turnTimeLimit || 30);
          break;

        case OpCode.GAME_OVER: {
          const isWinner = payload.winner === myUserId;
          const isDraw = payload.winner === null;
          setBoard(payload.board || board);
          setGameResult({
            result: isDraw ? 'draw' : isWinner ? 'win' : 'loss',
            winnerMark: payload.winnerMark,
            reason: payload.reason || 'win',
            pointsEarned: isDraw ? 100 : isWinner ? 200 : 50,
          });
          // Small delay before showing result
          setTimeout(() => setScreen('result'), 1000);
          break;
        }

        case OpCode.TIMER_SYNC:
          setTimeRemaining(payload.timeRemaining || 0);
          setCurrentTurn(payload.currentTurn || currentTurn);
          break;

        case OpCode.ERROR:
          setError(payload.error || 'Unknown error');
          break;

        case OpCode.OPPONENT_LEFT: {
          const isMe = payload.winner === myUserId;
          setGameResult({
            result: isMe ? 'win' : 'loss',
            reason: 'opponent_left',
            pointsEarned: isMe ? 200 : 50,
          });
          setTimeout(() => setScreen('result'), 500);
          break;
        }
      }
    };

    // Handle disconnection
    socket.ondisconnect = () => {
      setConnected(false);
    };
  }, [board, currentTurn, turnTimeLimit]);

  // ======== HANDLERS ========

  const handleNicknameContinue = useCallback(async (nickname: string, mode: string) => {
    try {
      nicknameRef.current = nickname;
      selectedModeRef.current = mode;
      setGameMode(mode);

      // Authenticate
      await authenticate(nickname);

      // Connect socket
      await connectSocket();
      setConnected(true);

      // Setup listeners
      setupSocketListeners();

      // Add to matchmaker
      setScreen('matchmaking');
      const result = await addMatchmaker(mode);
      matchmakerTicketRef.current = result.ticket;
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect to server. Is Nakama running?');
      throw err;
    }
  }, [setupSocketListeners]);

  const handleCancelMatchmaking = useCallback(async () => {
    try {
      if (matchmakerTicketRef.current) {
        await removeMatchmaker(matchmakerTicketRef.current);
        matchmakerTicketRef.current = '';
      }
    } catch (err) {
      console.error('Error canceling matchmaking:', err);
    }
    setScreen('nickname');
  }, []);

  const handleMove = useCallback(async (position: number) => {
    if (!matchId) return;
    try {
      await sendMove(matchId, position);
    } catch (err) {
      console.error('Error sending move:', err);
      setError('Failed to send move');
    }
  }, [matchId]);

  const handleLeaveMatch = useCallback(async () => {
    try {
      if (matchId) {
        await leaveMatch(matchId);
      }
    } catch (err) {
      console.error('Error leaving match:', err);
    }
    resetGameState();
    setScreen('nickname');
  }, [matchId]);

  const handlePlayAgain = useCallback(async () => {
    resetGameState();
    try {
      setScreen('matchmaking');
      setupSocketListeners();
      const result = await addMatchmaker(selectedModeRef.current);
      matchmakerTicketRef.current = result.ticket;
    } catch (err) {
      console.error('Error re-queueing:', err);
      setError('Failed to find a new match');
      setScreen('nickname');
    }
  }, [setupSocketListeners]);

  const resetGameState = () => {
    setMatchId('');
    setPlayers({});
    setPlayerOrder([]);
    setCurrentTurn('');
    setBoard(Array(9).fill(null));
    setTimeRemaining(30);
    setTurnTimeLimit(0);
    setLastMove(null);
    setGameResult(null);
  };

  const myUserId = getSession()?.user_id || '';

  return (
    <div className="app-container">
      {/* Connection Status */}
      {connected && (
        <div className="connection-status">
          <div className={`connection-dot ${connected ? '' : 'disconnected'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      )}

      {/* Screens */}
      {screen === 'nickname' && (
        <NicknameScreen onContinue={handleNicknameContinue} />
      )}

      {screen === 'matchmaking' && (
        <MatchmakingScreen onCancel={handleCancelMatchmaking} />
      )}

      {screen === 'game' && (
        <GameScreen
          players={players}
          playerOrder={playerOrder}
          currentTurn={currentTurn}
          board={board}
          myUserId={myUserId}
          gameMode={gameMode}
          timeRemaining={timeRemaining}
          turnTimeLimit={turnTimeLimit}
          lastMove={lastMove}
          onMove={handleMove}
          onLeave={handleLeaveMatch}
        />
      )}

      {screen === 'result' && gameResult && (
        <ResultScreen
          result={gameResult.result}
          winnerMark={gameResult.winnerMark}
          reason={gameResult.reason}
          myUserId={myUserId}
          pointsEarned={gameResult.pointsEarned}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* Error Toast */}
      {error && (
        <div className="error-toast">{error}</div>
      )}
    </div>
  );
}

export default App;
