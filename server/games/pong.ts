const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const PADDLE_SPEED = 8;
const BALL_SIZE = 12;
const BALL_SPEED = 6;
const PADDLE_Y_PLAYER1 = CANVAS_HEIGHT - 40;
const PADDLE_Y_PLAYER2 = 40;
const WIN_SCORE = 5;

interface PongPlayerData {
  paddleX: number;
  paddleVelocity: number;
}

export interface PongGameState {
  matchId: string;
  gameType: 'pong';
  player1: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: PongPlayerData;
  };
  player2: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: PongPlayerData;
  };
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  botWillWin?: boolean;
  totalHits?: number;
  status: 'playing' | 'finished';
  winner?: string;
}

export function createPongMatch(p1Id: string, p2Id: string, p1Name: string, p2Name: string): PongGameState {
  return {
    matchId: `pong-${Date.now()}-${Math.random()}`,
    gameType: 'pong',
    player1: {
      id: p1Id,
      name: p1Name,
      score: 0,
      gameData: {
        paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        paddleVelocity: 0,
      },
    },
    player2: {
      id: p2Id,
      name: p2Name,
      score: 0,
      gameData: {
        paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        paddleVelocity: 0,
      },
    },
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED,
      vy: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED,
    },
    totalHits: 0,
    botWillWin: Math.random() < 0.96,
    status: 'playing',
  };
}

export function handlePongInput(state: PongGameState, playerId: string, input: any) {
  const isPlayer1 = state.player1.id === playerId;
  const player = isPlayer1 ? state.player1.gameData : state.player2.gameData;

  if (input.direction === 'left') {
    player.paddleVelocity = -PADDLE_SPEED;
  } else if (input.direction === 'right') {
    player.paddleVelocity = PADDLE_SPEED;
  } else if (input.direction === 'stop') {
    player.paddleVelocity = 0;
  }
}

export function updatePongBotAI(state: PongGameState, botIsPlayer2: boolean) {
  if (!botIsPlayer2) return;
  
  const botWillWin = state.botWillWin || false;
  const totalHits = state.totalHits || 0;
  const targetX = state.ball.x;
  const currentX = state.player2.gameData.paddleX + PADDLE_WIDTH / 2;
  const diff = targetX - currentX;

  const warmupHits = 3;
  const isWarmup = totalHits < warmupHits;

  let skill: number;
  if (isWarmup) {
    skill = 0.7;
  } else if (botWillWin) {
    const progressionHits = Math.min(totalHits - warmupHits, 10);
    skill = 0.98 + (progressionHits * 0.002);
  } else {
    skill = 0.25;
  }

  const moveSpeed = PADDLE_SPEED * skill;
  const randomOffset = (Math.random() - 0.5) * 15 * (1 - skill);
  const adjustedDiff = diff + randomOffset;

  if (Math.abs(adjustedDiff) > 3) {
    if (adjustedDiff > 0) {
      state.player2.gameData.paddleX = Math.min(state.player2.gameData.paddleX + moveSpeed, CANVAS_WIDTH - PADDLE_WIDTH);
    } else {
      state.player2.gameData.paddleX = Math.max(state.player2.gameData.paddleX - moveSpeed, 0);
    }
  }
}

export function updatePongGame(state: PongGameState) {
    if (state.status !== 'playing') return;

    // Update paddles
    state.player1.gameData.paddleX += state.player1.gameData.paddleVelocity;
    state.player2.gameData.paddleX += state.player2.gameData.paddleVelocity;
    state.player1.gameData.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, state.player1.gameData.paddleX));
    state.player2.gameData.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, state.player2.gameData.paddleX));

    // Update ball
    state.ball.x += state.ball.vx;
    state.ball.y += state.ball.vy;

    // Wall collision
    if (state.ball.x <= BALL_SIZE || state.ball.x >= CANVAS_WIDTH - BALL_SIZE) {
      state.ball.vx *= -1;
    }

    // Paddle collision - player 2 (top)
    if (state.ball.y <= PADDLE_Y_PLAYER2 + PADDLE_HEIGHT + BALL_SIZE &&
        state.ball.y >= PADDLE_Y_PLAYER2 + PADDLE_HEIGHT &&
        state.ball.x >= state.player2.gameData.paddleX &&
        state.ball.x <= state.player2.gameData.paddleX + PADDLE_WIDTH) {
      state.ball.vy = Math.abs(state.ball.vy);
      const paddleCenter = state.player2.gameData.paddleX + PADDLE_WIDTH / 2;
      let hitPosition = (state.ball.x - paddleCenter) / (PADDLE_WIDTH / 2);

      state.totalHits = (state.totalHits || 0) + 1;
      const totalHits = state.totalHits;
      if (state.botWillWin && totalHits > 6) {
        hitPosition *= 1.3;
      }

      state.ball.vx = hitPosition * BALL_SPEED * 1.5;
    }

    // Paddle collision - player 1 (bottom)
    if (state.ball.y >= PADDLE_Y_PLAYER1 - BALL_SIZE &&
        state.ball.y <= PADDLE_Y_PLAYER1 &&
        state.ball.x >= state.player1.gameData.paddleX &&
        state.ball.x <= state.player1.gameData.paddleX + PADDLE_WIDTH) {
      state.ball.vy = -Math.abs(state.ball.vy);
      const paddleCenter = state.player1.gameData.paddleX + PADDLE_WIDTH / 2;
      let hitPosition = (state.ball.x - paddleCenter) / (PADDLE_WIDTH / 2);

      state.totalHits = (state.totalHits || 0) + 1;
      const totalHits = state.totalHits;
      if (state.botWillWin && totalHits > 6) {
        hitPosition *= 0.7;
      }

      state.ball.vx = hitPosition * BALL_SPEED * 1.5;
    }

    // Scoring
    if (state.ball.y <= 0) {
      state.player1.score++;
      if (state.player1.score >= WIN_SCORE) {
        state.status = 'finished';
        state.winner = state.player1.id;
      } else {
        // Reset ball
        state.ball.x = CANVAS_WIDTH / 2;
        state.ball.y = CANVAS_HEIGHT / 2;
        state.ball.vx = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
        state.ball.vy = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
      }
    } else if (state.ball.y >= CANVAS_HEIGHT) {
      state.player2.score++;
      if (state.player2.score >= WIN_SCORE) {
        state.status = 'finished';
        state.winner = state.player2.id;
      } else {
        // Reset ball
        state.ball.x = CANVAS_WIDTH / 2;
        state.ball.y = CANVAS_HEIGHT / 2;
        state.ball.vx = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
        state.ball.vy = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
      }
    }
}
