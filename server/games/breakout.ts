export interface BreakoutGameState {
  matchId: string;
  gameType: 'breakout';
  player1: {
    id: string;
    name: string;
    paddleX: number;
    ball: { x: number; y: number; vx: number; vy: number };
    bricks: boolean[][];
    score: number;
    lives: number;
  };
  player2: {
    id: string;
    name: string;
    paddleX: number;
    ball: { x: number; y: number; vx: number; vy: number };
    bricks: boolean[][];
    score: number;
    lives: number;
  };
  status: 'playing' | 'finished';
  winner?: string;
}

const PADDLE_WIDTH = 100;
const PADDLE_SPEED = 8;
const BALL_SPEED = 5;
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
      paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, vx: BALL_SPEED, vy: -BALL_SPEED },
      bricks: createBricks(),
      score: 0,
      lives: 3,
    },
    player2: {
      id: player2Id,
      name: player2Name,
      paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, vx: BALL_SPEED, vy: -BALL_SPEED },
      bricks: createBricks(),
      score: 0,
      lives: 3,
    },
    status: 'playing',
  };
}

export function updateBreakoutGame(state: BreakoutGameState): void {
  if (state.status !== 'playing') return;

  [state.player1, state.player2].forEach(player => {
    if (player.lives <= 0) return;

    // Update ball
    player.ball.x += player.ball.vx;
    player.ball.y += player.ball.vy;

    // Wall collision
    if (player.ball.x <= 0 || player.ball.x >= CANVAS_WIDTH) {
      player.ball.vx *= -1;
    }
    if (player.ball.y <= 0) {
      player.ball.vy *= -1;
    }

    // Paddle collision
    if (player.ball.y >= CANVAS_HEIGHT - 30 && 
        player.ball.x >= player.paddleX && 
        player.ball.x <= player.paddleX + PADDLE_WIDTH) {
      player.ball.vy = -Math.abs(player.ball.vy);
    }

    // Bottom collision (lose life)
    if (player.ball.y >= CANVAS_HEIGHT) {
      player.lives--;
      player.ball.x = CANVAS_WIDTH / 2;
      player.ball.y = CANVAS_HEIGHT - 100;
      player.ball.vx = BALL_SPEED;
      player.ball.vy = -BALL_SPEED;
    }

    // Brick collision
    const brickWidth = CANVAS_WIDTH / BRICK_COLS;
    const brickHeight = 20;
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        if (player.bricks[row][col]) {
          const brickX = col * brickWidth;
          const brickY = row * brickHeight + 50;
          
          if (player.ball.x >= brickX && player.ball.x <= brickX + brickWidth &&
              player.ball.y >= brickY && player.ball.y <= brickY + brickHeight) {
            player.bricks[row][col] = false;
            player.ball.vy *= -1;
            player.score += 10;
          }
        }
      }
    }
  });

  // Check win condition
  const p1Done = state.player1.lives <= 0 || state.player1.bricks.every(row => row.every(brick => !brick));
  const p2Done = state.player2.lives <= 0 || state.player2.bricks.every(row => row.every(brick => !brick));

  if (p1Done || p2Done) {
    state.status = 'finished';
    state.winner = state.player1.score >= state.player2.score ? state.player1.id : state.player2.id;
  }
}

export function moveBreakoutPaddle(player: BreakoutGameState['player1'], direction: 'left' | 'right'): void {
  if (direction === 'left') {
    player.paddleX = Math.max(0, player.paddleX - PADDLE_SPEED);
  } else {
    player.paddleX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, player.paddleX + PADDLE_SPEED);
  }
}

export function updateBreakoutBotAI(state: BreakoutGameState, botIsPlayer2: boolean): void {
  const bot = botIsPlayer2 ? state.player2 : state.player1;
  if (bot.lives <= 0) return;

  const paddleCenter = bot.paddleX + PADDLE_WIDTH / 2;
  if (bot.ball.x < paddleCenter - 10) {
    moveBreakoutPaddle(bot, 'left');
  } else if (bot.ball.x > paddleCenter + 10) {
    moveBreakoutPaddle(bot, 'right');
  }
}
