// Leaderboard management for Tic-Tac-Toe

export const LEADERBOARD_ID = 'tic_tac_toe_global';
export const STATS_COLLECTION = 'player_stats';
export const STATS_KEY = 'stats';

export const WIN_SCORE = 200;
export const LOSS_SCORE = 50;  // participation points
export const DRAW_SCORE = 100;

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  best_streak: number;
}

export function createDefaultStats(): PlayerStats {
  return {
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    best_streak: 0,
  };
}

export function setupLeaderboard(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  // Create leaderboard - "best" operator means highest score wins
  // Reset: never (0 means no reset)
  try {
    nk.leaderboardCreate(LEADERBOARD_ID, true, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, undefined, undefined);
    logger.info('Leaderboard created/verified: %s', LEADERBOARD_ID);
  } catch (error) {
    logger.error('Error creating leaderboard: %v', error);
  }
}

export function recordMatchResult(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string,
  username: string,
  result: 'win' | 'loss' | 'draw'
): void {
  // Update leaderboard score
  var score = result === 'win' ? WIN_SCORE : result === 'draw' ? DRAW_SCORE : LOSS_SCORE;
  try {
    nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, username, score, 0, undefined, undefined);
  } catch (error) {
    logger.error('Error writing leaderboard record: %v', error);
  }

  // Update player stats in storage
  try {
    var objects = nk.storageRead([{
      collection: STATS_COLLECTION,
      key: STATS_KEY,
      userId: userId,
    }]);

    var stats: PlayerStats = objects.length > 0
      ? objects[0].value as PlayerStats
      : createDefaultStats();

    if (result === 'win') {
      stats.wins++;
      stats.streak++;
      if (stats.streak > stats.best_streak) {
        stats.best_streak = stats.streak;
      }
    } else if (result === 'loss') {
      stats.losses++;
      stats.streak = 0;
    } else {
      stats.draws++;
      // streak continues on draw
    }

    nk.storageWrite([{
      collection: STATS_COLLECTION,
      key: STATS_KEY,
      userId: userId,
      value: stats as unknown as { [key: string]: any },
      permissionRead: 2, // public read
      permissionWrite: 0, // server-only write
    }]);
  } catch (error) {
    logger.error('Error updating player stats: %v', error);
  }
}

export function rpcGetLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  try {
    var limit = 20;
    var records = nk.leaderboardRecordsList(LEADERBOARD_ID, undefined, limit, undefined, undefined);

    var results: any[] = [];
    if (records && records.records) {
      for (var i = 0; i < records.records.length; i++) {
        var record = records.records[i];

        // Get player stats
        var statsObjects = nk.storageRead([{
          collection: STATS_COLLECTION,
          key: STATS_KEY,
          userId: record.ownerId,
        }]);

        var stats: PlayerStats = statsObjects.length > 0
          ? statsObjects[0].value as PlayerStats
          : createDefaultStats();

        results.push({
          rank: record.rank,
          userId: record.ownerId,
          username: record.username,
          score: record.score,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          streak: stats.streak,
          best_streak: stats.best_streak,
        });
      }
    }

    return JSON.stringify({ leaderboard: results });
  } catch (error) {
    logger.error('Error fetching leaderboard: %v', error);
    return JSON.stringify({ leaderboard: [] });
  }
}

export function rpcGetPlayerStats(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  try {
    var userId = ctx.userId;
    if (!userId) {
      return JSON.stringify({ error: 'Not authenticated' });
    }

    var objects = nk.storageRead([{
      collection: STATS_COLLECTION,
      key: STATS_KEY,
      userId: userId,
    }]);

    var stats: PlayerStats = objects.length > 0
      ? objects[0].value as PlayerStats
      : createDefaultStats();

    // Get leaderboard rank
    var records = nk.leaderboardRecordsList(LEADERBOARD_ID, [userId], 1, undefined, undefined);
    var rank = 0;
    var score = 0;
    if (records && records.ownerRecords && records.ownerRecords.length > 0) {
      rank = records.ownerRecords[0].rank;
      score = records.ownerRecords[0].score;
    }

    return JSON.stringify({
      userId: userId,
      rank: rank,
      score: score,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      streak: stats.streak,
      best_streak: stats.best_streak,
    });
  } catch (error) {
    logger.error('Error fetching player stats: %v', error);
    return JSON.stringify({ error: 'Failed to fetch stats' });
  }
}
