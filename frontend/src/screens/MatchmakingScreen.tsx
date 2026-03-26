interface MatchmakingScreenProps {
  onCancel: () => void;
}

export default function MatchmakingScreen({ onCancel }: MatchmakingScreenProps) {
  return (
    <div className="card matchmaking-screen fade-in">
      <div className="spinner" />

      <h2 className="title">Finding a random player...</h2>
      <p className="subtitle">It usually takes 26 seconds.</p>

      <button
        id="cancel-matchmaking-btn"
        className="btn btn-secondary"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
