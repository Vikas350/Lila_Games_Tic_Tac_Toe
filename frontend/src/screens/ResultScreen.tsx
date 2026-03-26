import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../lib/nakama';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  best_streak: number;
}

interface ResultScreenProps {
  result: 'win' | 'loss' | 'draw';
  winnerMark?: string;
  reason: string;
  myUserId: string;
  pointsEarned: number;
  onPlayAgain: () => void;
}

export default function ResultScreen({
  result,
  winnerMark,
  reason,
  myUserId,
  pointsEarned,
  onPlayAgain,
}: ResultScreenProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await fetchLeaderboard();
        setLeaderboard(data.leaderboard || []);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLeaderboard();
  }, []);

  const getTitle = () => {
    if (result === 'win') return 'WINNER!';
    if (result === 'loss') return result === 'loss' && reason === 'timeout' ? 'TIME OUT!' : 'YOU LOST';
    return 'DRAW!';
  };

  const getBigMark = () => {
    if (result === 'draw') return '🤝';
    return winnerMark === 'X' ? '✕' : '○';
  };

  const getReasonText = () => {
    if (reason === 'timeout') return 'Timer expired';
    if (reason === 'opponent_left') return 'Opponent disconnected';
    return '';
  };

  return (
    <div className="card result-screen slide-up">
      {/* Big Mark */}
      <div className={`result-big-mark ${result === 'draw' ? 'draw-icon' : (winnerMark || 'x').toLowerCase()}`}>
        {getBigMark()}
      </div>

      {/* Result Title */}
      <h1 className={`result-title ${result}`}>{getTitle()}</h1>

      {/* Points */}
      <p className="result-points">
        +{pointsEarned} pts
        {getReasonText() && <span style={{ fontSize: '12px', display: 'block', color: '#94A3B8', marginTop: '2px' }}>{getReasonText()}</span>}
      </p>

      {/* Leaderboard */}
      <div className="leaderboard-section">
        <div className="leaderboard-header">
          <span className="trophy">🏆</span>
          <span>Leaderboard</span>
        </div>

        {loading ? (
          <p style={{ color: '#64748B', fontSize: '13px' }}>Loading...</p>
        ) : leaderboard.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: '13px' }}>No entries yet</p>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th></th>
                <th>W/L/D</th>
                <th>🔥</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 10).map((entry) => (
                <tr key={entry.userId}>
                  <td>
                    <span className="rank">{entry.rank}.</span>
                    <span className="username">
                      {entry.username}
                      {entry.userId === myUserId && <span className="you-tag">(you)</span>}
                    </span>
                  </td>
                  <td>
                    <span className="wld">
                      <span className="w">{entry.wins}</span>
                      <span className="sep">/</span>
                      <span className="l">{entry.losses}</span>
                      <span className="sep">/</span>
                      <span className="d">{entry.draws}</span>
                    </span>
                  </td>
                  <td><span className="streak">{entry.streak}m</span></td>
                  <td><span className="score">{entry.score}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Action Buttons */}
      <button
        id="play-again-btn"
        className="btn btn-primary"
        onClick={onPlayAgain}
      >
        Play Again
      </button>
    </div>
  );
}
