import { useState, useEffect, useCallback } from 'react';

interface PlayerInfo {
  username: string;
  mark: 'X' | 'O';
}

interface GameScreenProps {
  players: { [userId: string]: PlayerInfo };
  playerOrder: string[];
  currentTurn: string;
  board: (string | null)[];
  myUserId: string;
  gameMode: string;
  timeRemaining: number;
  turnTimeLimit: number;
  lastMove: number | null;
  onMove: (position: number) => void;
  onLeave: () => void;
}

export default function GameScreen({
  players,
  playerOrder,
  currentTurn,
  board,
  myUserId,
  gameMode,
  timeRemaining,
  turnTimeLimit,
  lastMove,
  onMove,
  onLeave,
}: GameScreenProps) {
  const [animatedCell, setAnimatedCell] = useState<number | null>(null);

  const isMyTurn = currentTurn === myUserId;
  const currentMark = players[currentTurn]?.mark || 'X';
  const myMark = players[myUserId]?.mark || 'X';

  // Get opponent info
  const opponentId = playerOrder.find(id => id !== myUserId) || '';
  const myInfo = players[myUserId];
  const opponentInfo = players[opponentId];

  // Animate last move
  useEffect(() => {
    if (lastMove !== null) {
      setAnimatedCell(lastMove);
      const timer = setTimeout(() => setAnimatedCell(null), 400);
      return () => clearTimeout(timer);
    }
  }, [lastMove]);

  const handleCellClick = useCallback((position: number) => {
    if (!isMyTurn) return;
    if (board[position] !== null) return;
    onMove(position);
  }, [isMyTurn, board, onMove]);

  // Timer calculations
  const timerPercent = turnTimeLimit > 0 ? (timeRemaining / turnTimeLimit) * 100 : 0;
  const timerClass = timeRemaining > 15 ? 'safe' : timeRemaining > 5 ? 'warning' : 'danger';

  return (
    <div className="game-screen slide-up">
      {/* Player Names Header */}
      <div className="game-header">
        <div className="player-label">
          <span className="name">{myInfo?.username || 'You'}</span>
          <span className="tag">(you)</span>
        </div>
        <div className="player-label">
          <span className="name">{opponentInfo?.username || 'Opponent'}</span>
          <span className="tag">(opp)</span>
        </div>
      </div>

      {/* Turn Indicator */}
      <div className="turn-indicator">
        <span className={`turn-mark ${currentMark.toLowerCase()}`}>
          {currentMark === 'X' ? '✕' : '○'}
        </span>
        <span>{isMyTurn ? 'Your Turn' : "Opponent's Turn"}</span>
      </div>

      {/* Timer Bar (Timed mode only) */}
      {gameMode === 'timed' && (
        <>
          <div className="timer-bar">
            <div
              className={`timer-fill ${timerClass}`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
          <div className={`timer-text ${timerClass === 'danger' ? 'danger' : ''}`}>
            {Math.ceil(timeRemaining)}s
          </div>
        </>
      )}

      {/* Game Board */}
      <div className="game-board">
        {board.map((cell, index) => (
          <div
            key={index}
            id={`cell-${index}`}
            className={`cell ${cell !== null || !isMyTurn ? 'disabled' : ''} ${animatedCell === index ? 'new-move' : ''}`}
            onClick={() => handleCellClick(index)}
          >
            {cell && (
              <span className={`mark ${cell.toLowerCase()}`}>
                {cell === 'X' ? '✕' : '○'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Leave Match Button */}
      <div className="game-footer">
        <button
          id="leave-match-btn"
          className="btn btn-danger"
          onClick={onLeave}
        >
          Leave match 🚪
        </button>
      </div>
    </div>
  );
}
