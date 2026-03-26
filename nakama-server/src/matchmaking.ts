// Matchmaking callback - creates authoritative match when players are paired

export function onMatchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string | void {
  if (!matches || matches.length === 0) {
    return;
  }

  // Extract game mode from the first match entry's string properties
  var gameMode = 'classic';
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].properties) {
      var props = matches[i].properties as unknown as Record<string, any>;
      // Support flattened properties or nested stringProperties based on runtime variant
      var gameModeProp = props['mode'] || (props.stringProperties && props.stringProperties['mode']);
      if (gameModeProp) {
        gameMode = gameModeProp;
        break;
      }
    }
  }

  // Create an authoritative match
  var matchId = nk.matchCreate('tic_tac_toe', { mode: gameMode });
  logger.info('Matchmaker created authoritative match: %s with mode: %s', matchId, gameMode);

  return matchId;
}
