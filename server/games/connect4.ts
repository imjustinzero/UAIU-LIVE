export interface Connect4GameState {
  matchId: string;
  gameType: 'connect4';
  board: number[][];
  currentTurn: string;
  player1: {
    id: string;
    name: string;
    color: number;
  };
  player2: {
    id: string;
    name: string;
    color: number;
  };
  status: 'playing' | 'finished';
  winner?: string;
}

const ROWS = 6;
const COLS = 7;

export function createConnect4Match(player1Id: string, player2Id: string, player1Name: string, player2Name: string): Connect4GameState {
  return {
    matchId: `connect4-${Date.now()}-${Math.random()}`,
    gameType: 'connect4',
    board: Array(ROWS).fill(null).map(() => Array(COLS).fill(0)),
    currentTurn: player1Id,
    player1: { id: player1Id, name: player1Name, color: 1 },
    player2: { id: player2Id, name: player2Name, color: 2 },
    status: 'playing',
  };
}

export function dropPiece(state: Connect4GameState, col: number, playerId: string): boolean {
  if (state.status !== 'playing' || state.currentTurn !== playerId) return false;
  if (col < 0 || col >= COLS) return false;

  for (let row = ROWS - 1; row >= 0; row--) {
    if (state.board[row][col] === 0) {
      const color = playerId === state.player1.id ? 1 : 2;
      state.board[row][col] = color;
      
      if (checkWin(state.board, row, col, color)) {
        state.status = 'finished';
        state.winner = playerId;
      } else if (isBoardFull(state.board)) {
        state.status = 'finished';
        state.winner = state.player1.id; // Tie - player 1 wins
      } else {
        state.currentTurn = playerId === state.player1.id ? state.player2.id : state.player1.id;
      }
      return true;
    }
  }
  return false;
}

function checkWin(board: number[][], row: number, col: number, color: number): boolean {
  // Check horizontal
  let count = 0;
  for (let c = 0; c < COLS; c++) {
    count = board[row][c] === color ? count + 1 : 0;
    if (count >= 4) return true;
  }

  // Check vertical
  count = 0;
  for (let r = 0; r < ROWS; r++) {
    count = board[r][col] === color ? count + 1 : 0;
    if (count >= 4) return true;
  }

  // Check diagonal /
  count = 0;
  let startRow = row - Math.min(row, col);
  let startCol = col - Math.min(row, col);
  while (startRow < ROWS && startCol < COLS) {
    count = board[startRow][startCol] === color ? count + 1 : 0;
    if (count >= 4) return true;
    startRow++;
    startCol++;
  }

  // Check diagonal \
  count = 0;
  startRow = row + Math.min(ROWS - 1 - row, col);
  startCol = col - Math.min(ROWS - 1 - row, col);
  while (startRow >= 0 && startCol < COLS) {
    count = board[startRow][startCol] === color ? count + 1 : 0;
    if (count >= 4) return true;
    startRow--;
    startCol++;
  }

  return false;
}

function isBoardFull(board: number[][]): boolean {
  return board[0].every(cell => cell !== 0);
}

export function getConnect4BotMove(state: Connect4GameState): number {
  // Simple AI: try to win, block opponent, or random
  const botColor = state.currentTurn === state.player1.id ? 1 : 2;
  const opponentColor = botColor === 1 ? 2 : 1;

  // Try to win
  for (let col = 0; col < COLS; col++) {
    if (canWinInColumn(state.board, col, botColor)) return col;
  }

  // Block opponent
  for (let col = 0; col < COLS; col++) {
    if (canWinInColumn(state.board, col, opponentColor)) return col;
  }

  // Random valid move
  const validCols = [];
  for (let col = 0; col < COLS; col++) {
    if (state.board[0][col] === 0) validCols.push(col);
  }
  return validCols[Math.floor(Math.random() * validCols.length)] || 0;
}

function canWinInColumn(board: number[][], col: number, color: number): boolean {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) {
      board[row][col] = color;
      const wins = checkWin(board, row, col, color);
      board[row][col] = 0;
      return wins;
    }
  }
  return false;
}
