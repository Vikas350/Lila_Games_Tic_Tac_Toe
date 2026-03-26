// Pure game logic functions for Tic-Tac-Toe
// No Nakama dependencies - pure domain logic

export type Mark = 'X' | 'O' | null;
export type Board = Mark[];

export const BOARD_SIZE = 9;

export const WIN_CONDITIONS: number[][] = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left col
  [1, 4, 7], // center col
  [2, 5, 8], // right col
  [0, 4, 8], // diagonal TL-BR
  [2, 4, 6], // diagonal TR-BL
];

export function createEmptyBoard(): Board {
  var board: Board = [];
  for (var i = 0; i < BOARD_SIZE; i++) {
    board.push(null);
  }
  return board;
}

export function isValidMove(board: Board, position: number): boolean {
  if (position < 0 || position >= BOARD_SIZE) return false;
  return board[position] === null;
}

export function applyMove(board: Board, position: number, mark: Mark): Board {
  var newBoard = board.slice() as Board;
  newBoard[position] = mark;
  return newBoard;
}

export function checkWinner(board: Board): Mark {
  for (var i = 0; i < WIN_CONDITIONS.length; i++) {
    var condition = WIN_CONDITIONS[i];
    var a = condition[0], b = condition[1], c = condition[2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

export function checkDraw(board: Board): boolean {
  if (checkWinner(board)) return false;
  for (var i = 0; i < board.length; i++) {
    if (board[i] === null) return false;
  }
  return true;
}

export function getWinningLine(board: Board): number[] | null {
  for (var i = 0; i < WIN_CONDITIONS.length; i++) {
    var condition = WIN_CONDITIONS[i];
    var a = condition[0], b = condition[1], c = condition[2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return condition;
    }
  }
  return null;
}
