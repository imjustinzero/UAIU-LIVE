interface Connect4Player {
  color: number;
}

export interface Connect4GameState {
  matchId: string;
  gameType: 'connect4';
  board: number[][];
  currentTurn: string;
  lastMoveTime?: number;
  player1: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: Connect4Player;
  };
  player2: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: Connect4Player;
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
    lastMoveTime: 0,
    player1: { id: player1Id, name: player1Name, score: 0, gameData: { color: 1 } },
    player2: { id: player2Id, name: player2Name, score: 0, gameData: { color: 2 } },
    status: 'playing',
  };
}

export function dropPiece(state: Connect4GameState, col: number, playerId: string): boolean {
  console.log(`[Connect4] dropPiece: col=${col}, playerId=${playerId}, currentTurn=${state.currentTurn}`);
  
  if (state.status !== 'playing' || state.currentTurn !== playerId) {
    console.log(`[Connect4] ❌ Invalid move: status=${state.status}, currentTurn=${state.currentTurn}`);
    return false;
  }
  if (col < 0 || col >= COLS) {
    console.log(`[Connect4] ❌ Invalid column: ${col}`);
    return false;
  }

  for (let row = ROWS - 1; row >= 0; row--) {
    if (state.board[row][col] === 0) {
      const color = playerId === state.player1.id ? state.player1.gameData.color : state.player2.gameData.color;
      state.board[row][col] = color;
      state.lastMoveTime = Date.now();
      console.log(`[Connect4] ✅ Piece dropped at [${row},${col}] color=${color}`);
      
      if (checkWin(state.board, row, col, color)) {
        state.status = 'finished';
        state.winner = playerId;
        const winner = playerId === state.player1.id ? state.player1 : state.player2;
        winner.score = 10;
        console.log(`[Connect4] 🏆 WINNER! ${playerId} won with 4 in a row!`);
      } else if (isBoardFull(state.board)) {
        state.status = 'finished';
        state.winner = state.player1.id;
        console.log(`[Connect4] 🤝 Board full! Player1 wins by default`);
      } else {
        state.currentTurn = playerId === state.player1.id ? state.player2.id : state.player1.id;
        console.log(`[Connect4] ⏭️ Next turn: ${state.currentTurn}`);
      }
      return true;
    }
  }
  console.log(`[Connect4] ❌ Column ${col} is full`);
  return false;
}

function checkWin(board: number[][], row: number, col: number, color: number): boolean {
  let count = 0;
  for (let c = 0; c < COLS; c++) {
    count = board[row][c] === color ? count + 1 : 0;
    if (count >= 4) return true;
  }

  count = 0;
  for (let r = 0; r < ROWS; r++) {
    count = board[r][col] === color ? count + 1 : 0;
    if (count >= 4) return true;
  }

  count = 0;
  let startRow = row - Math.min(row, col);
  let startCol = col - Math.min(row, col);
  while (startRow < ROWS && startCol < COLS) {
    count = board[startRow][startCol] === color ? count + 1 : 0;
    if (count >= 4) return true;
    startRow++;
    startCol++;
  }

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
  const bot = state.currentTurn === state.player1.id ? state.player1 : state.player2;
  const botColor = bot.gameData.color;
  const opponentColor = botColor === 1 ? 2 : 1;

  for (let col = 0; col < COLS; col++) {
    if (canWinInColumn(state.board, col, botColor)) return col;
  }

  for (let col = 0; col < COLS; col++) {
    if (canWinInColumn(state.board, col, opponentColor)) return col;
  }

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
