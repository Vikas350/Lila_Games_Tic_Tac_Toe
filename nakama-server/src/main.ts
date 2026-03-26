// Main entry point for Nakama server runtime
// Registers match handlers, RPCs, and matchmaker hooks

import { matchInit, matchJoinAttempt, matchJoin, matchLoop, matchLeave, matchTerminate, matchSignal } from './match-handler';
import { setupLeaderboard, rpcGetLeaderboard, rpcGetPlayerStats } from './leaderboard';
import { onMatchmakerMatched } from './matchmaking';

let InitModule: nkruntime.InitModule = function(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  logger.info('Tic-Tac-Toe server module loaded.');

  // Setup leaderboard
  setupLeaderboard(nk, logger);

  // Register the authoritative match handler
  initializer.registerMatch('tic_tac_toe', {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLoop: matchLoop,
    matchLeave: matchLeave,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });

  // Register matchmaker matched hook
  initializer.registerMatchmakerMatched(onMatchmakerMatched);

  // Register RPCs
  initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);
  initializer.registerRpc('get_player_stats', rpcGetPlayerStats);

  logger.info('Tic-Tac-Toe server module initialized successfully.');
};

// Reference InitModule to avoid it getting removed on build
!InitModule && (InitModule as any).bind(null);
