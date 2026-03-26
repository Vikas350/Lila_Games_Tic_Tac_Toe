import { useState } from 'react';

interface NicknameScreenProps {
  onContinue: (nickname: string, mode: string) => void;
}

export default function NicknameScreen({ onContinue }: NicknameScreenProps) {
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState('classic');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await onContinue(nickname.trim(), mode);
    } catch {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="card nickname-screen fade-in">
      <p className="title">Who are you?</p>

      <input
        id="nickname-input"
        type="text"
        className="input-field"
        placeholder="Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={20}
        autoFocus
        disabled={loading}
      />

      <div className="mode-selector">
        <button
          id="mode-classic"
          className={`mode-btn ${mode === 'classic' ? 'active' : ''}`}
          onClick={() => setMode('classic')}
          disabled={loading}
        >
          <span className="mode-icon">♟️</span>
          Classic
        </button>
        <button
          id="mode-timed"
          className={`mode-btn ${mode === 'timed' ? 'active' : ''}`}
          onClick={() => setMode('timed')}
          disabled={loading}
        >
          <span className="mode-icon">⏱️</span>
          Timed (30s)
        </button>
      </div>

      <button
        id="continue-btn"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!nickname.trim() || loading}
      >
        {loading ? 'Connecting...' : 'Continue'}
      </button>
    </div>
  );
}
