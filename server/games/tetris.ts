import type { Server as SocketIOServer } from "socket.io";

export interface TetrisGameState {
  matchId: string;
  gameType: 'tetris';
  player1: {
    id: string;
    name: string;
    board: number[][];
    currentPiece: Piece | null;
    nextPiece: Piece;
    score: number;
    linesCleared: number;
    gameOver: boolean;
  };
  player2: {
    id: string;
    name: string;
    board: number[][];
    currentPiece: Piece | null;
    nextPiece: Piece;
    score: number;
    linesCleared: number;
    gameOver: boolean;
  };
  status: 'playing' | 'finished';
  winner?: string;
}

interface Piece {
  shape: number[][];
  x: number;
  y: number;
  type: number;
}

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const TETROMINOS = [
  [[1, 1, 1, 1]],           // I
  [[1, 1], [1, 1]],         // O
  [[0, 1, 0], [1, 1, 1]],   // T
  [[1, 1, 0], [0, 1, 1]],   // S
  [[0, 1, 1], [1, 1, 0]],   // Z
  [[1, 0, 0], [1, 1, 1]],   // L
  [[0, 0, 1], [1, 1, 1]],   // J
];

function createEmptyBoard(): number[][] {
  return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
}

function createRandomPiece(): Piece {
  const type = Math.floor(Math.random() * TETROMINOS.length) + 1;
  return {
    shape: TETROMINOS[type - 1],
    x: Math.floor(BOARD_WIDTH / 2) - 1,
    y: 0,
    type,
  };
}

export function createTetrisMatch(player1Id: string, player2Id: string, player1Name: string, player2Name: string): TetrisGameState {
  return {
    matchId: `tetris-${Date.now()}-${Math.random()}`,
    gameType: 'tetris',
    player1: {
      id: player1Id,
      name: player1Name,
      board: createEmptyBoard(),
      currentPiece: createRandomPiece(),
      nextPiece: createRandomPiece(),
      score: 0,
      linesCleared: 0,
      gameOver: false,
    },
    player2: {
      id: player2Id,
      name: player2Name,
      board: createEmptyBoard(),
      currentPiece: createRandomPiece(),
      nextPiece: createRandomPiece(),
      score: 0,
      linesCleared: 0,
      gameOver: false,
    },
    status: 'playing',
  };
}

function canPlacePiece(board: number[][], piece: Piece): boolean {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardX = piece.x + x;
        const boardY = piece.y + y;
        if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) return false;
        if (boardY >= 0 && board[boardY][boardX]) return false;
      }
    }
  }
  return true;
}

function placePiece(board: number[][], piece: Piece): void {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardY = piece.y + y;
        const boardX = piece.x + x;
        if (boardY >= 0) {
          board[boardY][boardX] = piece.type;
        }
      }
    }
  }
}

function clearLines(board: number[][]): number {
  let linesCleared = 0;
  for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(BOARD_WIDTH).fill(0));
      linesCleared++;
      y++; // Check the same row again
    }
  }
  return linesCleared;
}

export function updateTetrisGame(state: TetrisGameState): void {
  if (state.status !== 'playing') return;

  [state.player1, state.player2].forEach(player => {
    if (player.gameOver || !player.currentPiece) return;

    // Move piece down
    player.currentPiece.y++;
    
    if (!canPlacePiece(player.board, player.currentPiece)) {
      player.currentPiece.y--;
      placePiece(player.board, player.currentPiece);
      
      const lines = clearLines(player.board);
      player.linesCleared += lines;
      player.score += lines * 100 * (lines > 1 ? lines : 1);
      
      player.currentPiece = player.nextPiece;
      player.nextPiece = createRandomPiece();
      
      if (!canPlacePiece(player.board, player.currentPiece)) {
        player.gameOver = true;
      }
    }
  });

  if (state.player1.gameOver || state.player2.gameOver) {
    state.status = 'finished';
    if (state.player1.gameOver && state.player2.gameOver) {
      state.winner = state.player1.score >= state.player2.score ? state.player1.id : state.player2.id;
    } else {
      state.winner = state.player1.gameOver ? state.player2.id : state.player1.id;
    }
  }
}

export function moveTetrisPiece(player: TetrisGameState['player1'], direction: 'left' | 'right' | 'down' | 'rotate'): void {
  if (!player.currentPiece || player.gameOver) return;

  const piece = { ...player.currentPiece };

  if (direction === 'left') piece.x--;
  else if (direction === 'right') piece.x++;
  else if (direction === 'down') piece.y++;
  else if (direction === 'rotate') {
    piece.shape = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
  }

  if (canPlacePiece(player.board, piece)) {
    player.currentPiece = piece;
  }
}

export function updateTetrisBotAI(state: TetrisGameState, botIsPlayer2: boolean): void {
  const bot = botIsPlayer2 ? state.player2 : state.player1;
  if (bot.gameOver || !bot.currentPiece) return;

  // Simple AI: try to fill lowest rows
  if (Math.random() < 0.3) {
    moveTetrisPiece(bot, 'rotate');
  } else if (Math.random() < 0.5) {
    moveTetrisPiece(bot, Math.random() < 0.5 ? 'left' : 'right');
  } else {
    moveTetrisPiece(bot, 'down');
  }
}
