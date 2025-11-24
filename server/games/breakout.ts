interface BreakoutPlayer {
  paddleX: number;
  ball: { x: number; y: number; vx: number; vy: number };
  bricks: boolean[][];
  lives: number;
}

export interface BreakoutGameState {
  matchId: string;
  gameType: 'breakout';
  player1: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: BreakoutPlayer;
  };
  player2: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: BreakoutPlayer;
  };
  status: 'playing' | 'finished';
  winner?: string;
}

const PADDLE_WIDTH = 100;
const PADDLE_SPEED = 10;
const BALL_SPEED = 6;
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;

function createBricks(): boolean[][] {
  return Array(BRICK_ROWS).fill(null).map(() => Array(BRICK_COLS).fill(true));
}

export function createBreakoutMatch(player1Id: string, player2Id: string, player1Name: string, player2Name: string): BreakoutGameState {
  return {
    matchId: `breakout-${Date.now()}-${Math.random()}`,
    gameType: 'breakout',
    player1: {
      id: player1Id,
      name: player1Name,
      score: 0,
      gameData: {
        paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, vx: BALL_SPEED, vy: -BALL_SPEED },
        bricks: createBricks(),
        lives: 3,
      },
    },
    player2: {
      id: player2Id,
      name: player2Name,
      score: 0,
      gameData: {
        paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, vx: BALL_SPEED, vy: -BALL_SPEED },
        bricks: createBricks(),
        lives: 3,
      },
    },
    status: 'playing',
  };
}

export function updateBreakoutGame(state: BreakoutGameState): void {
  if (state.status !== 'playing') return;

  [state.player1, state.player2].forEach(player => {
    const gameData = player.gameData;
    if (gameData.lives <= 0) return;

    gameData.ball.x += gameData.ball.vx;
    gameData.ball.y += gameData.ball.vy;

    if (gameData.ball.x <= 0 || gameData.ball.x >= CANVAS_WIDTH) {
      gameData.ball.vx *= -1;
    }
    if (gameData.ball.y <= 0) {
      gameData.ball.vy *= -1;
    }

    if (gameData.ball.y >= CANVAS_HEIGHT - 30 && 
        gameData.ball.x >= gameData.paddleX && 
        gameData.ball.x <= gameData.paddleX + PADDLE_WIDTH) {
      gameData.ball.vy = -Math.abs(gameData.ball.vy);
      
      const paddleCenter = gameData.paddleX + PADDLE_WIDTH / 2;
      const hitPosition = (gameData.ball.x - paddleCenter) / (PADDLE_WIDTH / 2);
      gameData.ball.vx += hitPosition * 2;
      
      const speed = Math.sqrt(gameData.ball.vx * gameData.ball.vx + gameData.ball.vy * gameData.ball.vy);
      const targetSpeed = BALL_SPEED;
      if (speed > 0) {
        gameData.ball.vx = (gameData.ball.vx / speed) * targetSpeed;
        gameData.ball.vy = (gameData.ball.vy / speed) * targetSpeed;
      }
    }

    if (gameData.ball.y >= CANVAS_HEIGHT) {
      gameData.lives--;
      gameData.ball.x = CANVAS_WIDTH / 2;
      gameData.ball.y = CANVAS_HEIGHT - 100;
      gameData.ball.vx = BALL_SPEED;
      gameData.ball.vy = -BALL_SPEED;
    }

    const brickWidth = CANVAS_WIDTH / BRICK_COLS;
    const brickHeight = 20;
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        if (gameData.bricks[row][col]) {
          const brickX = col * brickWidth;
          const brickY = row * brickHeight + 50;
          
          if (gameData.ball.x >= brickX && gameData.ball.x <= brickX + brickWidth &&
              gameData.ball.y >= brickY && gameData.ball.y <= brickY + brickHeight) {
            gameData.bricks[row][col] = false;
            gameData.ball.vy *= -1;
            player.score += 10;
          }
        }
      }
    }
  });

  const p1Done = state.player1.gameData.lives <= 0 || state.player1.gameData.bricks.every(row => row.every(brick => !brick));
  const p2Done = state.player2.gameData.lives <= 0 || state.player2.gameData.bricks.every(row => row.every(brick => !brick));

  if (p1Done || p2Done) {
    state.status = 'finished';
    state.winner = state.player1.score >= state.player2.score ? state.player1.id : state.player2.id;
  }
}

export function moveBreakoutPaddle(player: BreakoutGameState['player1'], direction: 'left' | 'right'): void {
  const gameData = player.gameData;
  if (direction === 'left') {
    gameData.paddleX = Math.max(0, gameData.paddleX - PADDLE_SPEED);
  } else {
    gameData.paddleX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, gameData.paddleX + PADDLE_SPEED);
  }
}

export function updateBreakoutBotAI(state: BreakoutGameState, botIsPlayer2: boolean): void {
  const bot = botIsPlayer2 ? state.player2 : state.player1;
  const gameData = bot.gameData;
  if (gameData.lives <= 0) return;

  // Calibrated tracking for ~87% win rate: larger dead zone + occasional delays
  if (Math.random() < 0.13) return; // Skip move 13% of time
  
  const paddleCenter = gameData.paddleX + PADDLE_WIDTH / 2;
  if (gameData.ball.x < paddleCenter - 8) {
    moveBreakoutPaddle(bot, 'left');
  } else if (gameData.ball.x > paddleCenter + 8) {
    moveBreakoutPaddle(bot, 'right');
  }
}
