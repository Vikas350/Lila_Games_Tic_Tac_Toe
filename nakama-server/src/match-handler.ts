// Server-authoritative match handler for Tic-Tac-Toe
import { Board, Mark, createEmptyBoard, isValidMove, applyMove, checkWinner, checkDraw, getWinningLine } from './game-logic';
import { recordMatchResult } from './leaderboard';

// OpCodes for client-server communication
export const OpCode = {
  MOVE: 1,           // Client -> Server: { position: number }
  STATE_UPDATE: 2,   // Server -> Client: full game state
  GAME_OVER: 3,      // Server -> Client: game result
  TIMER_SYNC: 4,     // Server -> Client: timer update
  GAME_START: 5,     // Server -> Client: game started
  ERROR: 6,          // Server -> Client: error message
  OPPONENT_LEFT: 7,  // Server -> Client: opponent disconnected
};

export interface GameState {
  board: Board;
  players: { [userId: string]: PlayerInfo };
  playerOrder: string[];      // [userId_of_X, userId_of_O]
  currentTurn: string;        // userId of who should move
  gameStarted: boolean;
  gameOver: boolean;
  winner: string | null;      // userId of winner, null for draw
  winningLine: number[] | null;
  gameMode: string;           // 'classic' or 'timed'
  turnTimeLimit: number;      // seconds per turn (0 for classic)
  turnStartTick: number;      // tick when current turn started
  tickRate: number;
  emptyTicks: number;         // ticks with no players
}

export interface PlayerInfo {
  odatakUserId: string;
  username: string;
  mark: Mark;
}

const TICK_RATE = 5;
const TURN_TIME_SECONDS = 30;
const MAX_EMPTY_TICKS = TICK_RATE * 30; // 30 seconds with no players => terminate

export const matchInit: nkruntime.MatchInitFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  var gameMode = params && params['mode'] ? params['mode'] : 'classic';

  var state: GameState = {
    board: createEmptyBoard(),
    players: {},
    playerOrder: [],
    currentTurn: '',
    gameStarted: false,
    gameOver: false,
    winner: null,
    winningLine: null,
    gameMode: gameMode,
    turnTimeLimit: gameMode === 'timed' ? TURN_TIME_SECONDS : 0,
    turnStartTick: 0,
    tickRate: TICK_RATE,
    emptyTicks: 0,
  };

  var label = JSON.stringify({
    mode: gameMode,
    open: true,
    players: 0,
  });

  logger.info('Match initialized. Mode: %s', gameMode);

  return {
    state: state as unknown as nkruntime.MatchState,
    tickRate: TICK_RATE,
    label: label,
  };
};

export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState; accept: boolean; rejectMessage?: string } | null {
  var gameState = state as unknown as GameState;

  // Reject if game already has 2 players
  if (gameState.playerOrder.length >= 2) {
    return {
      state: state,
      accept: false,
      rejectMessage: 'Match is full',
    };
  }

  // Reject if game already started
  if (gameState.gameStarted) {
    return {
      state: state,
      accept: false,
      rejectMessage: 'Match already in progress',
    };
  }

  logger.info('Player %s attempting to join match', presence.userId);
  return {
    state: state,
    accept: true,
  };
};

export const matchJoin: nkruntime.MatchJoinFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var gameState = state as unknown as GameState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    var mark: Mark = gameState.playerOrder.length === 0 ? 'X' : 'O';

    gameState.players[presence.userId] = {
      odatakUserId: presence.userId,
      username: presence.username,
      mark: mark,
    };
    gameState.playerOrder.push(presence.userId);

    logger.info('Player %s (%s) joined as %s', presence.username, presence.userId, mark);
  }

  // Update label
  var label = JSON.stringify({
    mode: gameState.gameMode,
    open: gameState.playerOrder.length < 2,
    players: gameState.playerOrder.length,
  });
  dispatcher.matchLabelUpdate(label);

  // Start game when 2 players are present
  if (gameState.playerOrder.length === 2) {
    gameState.gameStarted = true;
    gameState.currentTurn = gameState.playerOrder[0]; // X goes first
    gameState.turnStartTick = tick;

    // Send game start event
    var startData = JSON.stringify({
      players: gameState.players,
      playerOrder: gameState.playerOrder,
      currentTurn: gameState.currentTurn,
      board: gameState.board,
      gameMode: gameState.gameMode,
      turnTimeLimit: gameState.turnTimeLimit,
    });
    dispatcher.broadcastMessage(OpCode.GAME_START, startData, null, null, true);

    logger.info('Game started! %s vs %s', gameState.players[gameState.playerOrder[0]].username, gameState.players[gameState.playerOrder[1]].username);
  }

  return {
    state: gameState as unknown as nkruntime.MatchState,
  };
};

export const matchLoop: nkruntime.MatchLoopFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  var gameState = state as unknown as GameState;

  // Terminate match if no players for too long
  if (Object.keys(gameState.players).length === 0) {
    gameState.emptyTicks++;
    if (gameState.emptyTicks > MAX_EMPTY_TICKS) {
      return null; // terminate
    }
    return { state: gameState as unknown as nkruntime.MatchState };
  }
  gameState.emptyTicks = 0;

  // Don't process game logic if game not started or already over
  if (!gameState.gameStarted || gameState.gameOver) {
    return { state: gameState as unknown as nkruntime.MatchState };
  }

  // Check timer expiry for timed mode
  if (gameState.gameMode === 'timed' && gameState.turnTimeLimit > 0) {
    var elapsedTicks = tick - gameState.turnStartTick;
    var elapsedSeconds = elapsedTicks / TICK_RATE;

    // Broadcast timer sync every second
    if (elapsedTicks % TICK_RATE === 0) {
      var remaining = Math.max(0, gameState.turnTimeLimit - elapsedSeconds);
      var timerData = JSON.stringify({
        timeRemaining: Math.ceil(remaining),
        currentTurn: gameState.currentTurn,
      });
      dispatcher.broadcastMessage(OpCode.TIMER_SYNC, timerData, null, null, true);
    }

    // Auto-forfeit on timeout
    if (elapsedSeconds >= gameState.turnTimeLimit) {
      logger.info('Timer expired for player %s', gameState.currentTurn);
      var loser = gameState.currentTurn;
      var winnerUserId = gameState.playerOrder[0] === loser ? gameState.playerOrder[1] : gameState.playerOrder[0];

      gameState.gameOver = true;
      gameState.winner = winnerUserId;

      // Record results
      recordMatchResult(nk, logger, winnerUserId, gameState.players[winnerUserId].username, 'win');
      recordMatchResult(nk, logger, loser, gameState.players[loser].username, 'loss');

      var gameOverData = JSON.stringify({
        winner: winnerUserId,
        winnerMark: gameState.players[winnerUserId].mark,
        loserMark: gameState.players[loser].mark,
        board: gameState.board,
        reason: 'timeout',
        winningLine: null,
      });
      dispatcher.broadcastMessage(OpCode.GAME_OVER, gameOverData, null, null, true);

      return { state: gameState as unknown as nkruntime.MatchState };
    }
  }

  // Process incoming moves
  for (var i = 0; i < messages.length; i++) {
    var message = messages[i];

    if (message.opCode !== OpCode.MOVE) continue;

    var senderId = message.sender.userId;

    // Validate it's this player's turn
    if (senderId !== gameState.currentTurn) {
      var errMsg = JSON.stringify({ error: 'Not your turn' });
      dispatcher.broadcastMessage(OpCode.ERROR, errMsg, [message.sender], null, true);
      continue;
    }

    // Parse move
    var moveData: { position: number };
    try {
      moveData = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      var errMsg2 = JSON.stringify({ error: 'Invalid move data' });
      dispatcher.broadcastMessage(OpCode.ERROR, errMsg2, [message.sender], null, true);
      continue;
    }

    var position = moveData.position;

    // Validate move
    if (!isValidMove(gameState.board, position)) {
      var errMsg3 = JSON.stringify({ error: 'Invalid move position' });
      dispatcher.broadcastMessage(OpCode.ERROR, errMsg3, [message.sender], null, true);
      continue;
    }

    // Apply move
    var playerMark = gameState.players[senderId].mark;
    gameState.board = applyMove(gameState.board, position, playerMark);

    logger.info('Player %s placed %s at position %d', senderId, playerMark, position);

    // Check for winner
    var winner = checkWinner(gameState.board);
    if (winner) {
      gameState.gameOver = true;
      gameState.winner = senderId;
      gameState.winningLine = getWinningLine(gameState.board);

      var loserId = gameState.playerOrder[0] === senderId ? gameState.playerOrder[1] : gameState.playerOrder[0];

      // Record results
      recordMatchResult(nk, logger, senderId, gameState.players[senderId].username, 'win');
      recordMatchResult(nk, logger, loserId, gameState.players[loserId].username, 'loss');

      var gameOverData2 = JSON.stringify({
        winner: senderId,
        winnerMark: playerMark,
        loserMark: gameState.players[loserId].mark,
        board: gameState.board,
        reason: 'win',
        winningLine: gameState.winningLine,
      });
      dispatcher.broadcastMessage(OpCode.GAME_OVER, gameOverData2, null, null, true);

      logger.info('Game over! Winner: %s (%s)', gameState.players[senderId].username, playerMark);
      return { state: gameState as unknown as nkruntime.MatchState };
    }

    // Check for draw
    if (checkDraw(gameState.board)) {
      gameState.gameOver = true;
      gameState.winner = null;

      // Record results for both players
      recordMatchResult(nk, logger, gameState.playerOrder[0], gameState.players[gameState.playerOrder[0]].username, 'draw');
      recordMatchResult(nk, logger, gameState.playerOrder[1], gameState.players[gameState.playerOrder[1]].username, 'draw');

      var drawData = JSON.stringify({
        winner: null,
        board: gameState.board,
        reason: 'draw',
        winningLine: null,
      });
      dispatcher.broadcastMessage(OpCode.GAME_OVER, drawData, null, null, true);

      logger.info('Game over! Draw!');
      return { state: gameState as unknown as nkruntime.MatchState };
    }

    // Switch turn
    gameState.currentTurn = gameState.playerOrder[0] === senderId
      ? gameState.playerOrder[1]
      : gameState.playerOrder[0];
    gameState.turnStartTick = tick;

    // Broadcast updated state
    var stateData = JSON.stringify({
      board: gameState.board,
      currentTurn: gameState.currentTurn,
      lastMove: { position: position, mark: playerMark, by: senderId },
    });
    dispatcher.broadcastMessage(OpCode.STATE_UPDATE, stateData, null, null, true);
  }

  return { state: gameState as unknown as nkruntime.MatchState };
};

export const matchLeave: nkruntime.MatchLeaveFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var gameState = state as unknown as GameState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    var leftUserId = presence.userId;

    logger.info('Player %s left the match', leftUserId);

    // If game was in progress, the remaining player wins by forfeit
    if (gameState.gameStarted && !gameState.gameOver && gameState.playerOrder.length === 2) {
      var remainingUserId = gameState.playerOrder[0] === leftUserId
        ? gameState.playerOrder[1]
        : gameState.playerOrder[0];

      gameState.gameOver = true;
      gameState.winner = remainingUserId;

      // Record results
      recordMatchResult(nk, logger, remainingUserId, gameState.players[remainingUserId].username, 'win');
      recordMatchResult(nk, logger, leftUserId, gameState.players[leftUserId].username, 'loss');

      // Notify remaining player
      var opponentLeftData = JSON.stringify({
        winner: remainingUserId,
        reason: 'opponent_left',
        board: gameState.board,
      });
      dispatcher.broadcastMessage(OpCode.OPPONENT_LEFT, opponentLeftData, null, null, true);

      logger.info('Player %s wins by forfeit', gameState.players[remainingUserId].username);
    }

    // Remove player
    delete gameState.players[leftUserId];
    var idx = gameState.playerOrder.indexOf(leftUserId);
    if (idx > -1) {
      gameState.playerOrder.splice(idx, 1);
    }
  }

  // Update label
  var label = JSON.stringify({
    mode: gameState.gameMode,
    open: false,
    players: gameState.playerOrder.length,
  });
  dispatcher.matchLabelUpdate(label);

  return {
    state: gameState as unknown as nkruntime.MatchState,
  };
};

export const matchTerminate: nkruntime.MatchTerminateFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  logger.info('Match terminating');
  return { state: state };
};

export const matchSignal: nkruntime.MatchSignalFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  logger.info('Match signal received: %s', data);
  return { state: state, data: 'signal_received' };
};
