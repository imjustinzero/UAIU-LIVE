interface AirHockeyPlayer {
  paddleX: number;
  paddleY: number;
}

export interface AirHockeyGameState {
  matchId: string;
  gameType: 'airhockey';
  player1: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: AirHockeyPlayer;
  };
  player2: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: AirHockeyPlayer;
  };
  puck: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  status: 'playing' | 'finished';
  winner?: string;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PADDLE_RADIUS = 40;
const PUCK_RADIUS = 15;
const PUCK_SPEED = 7;
const GOAL_WIDTH = 200;
const WINNING_SCORE = 7;

export function createAirHockeyMatch(player1Id: string, player2Id: string, player1Name: string, player2Name: string): AirHockeyGameState {
  return {
    matchId: `airhockey-${Date.now()}-${Math.random()}`,
    gameType: 'airhockey',
    player1: {
      id: player1Id,
      name: player1Name,
      score: 0,
      gameData: {
        paddleX: CANVAS_WIDTH / 2,
        paddleY: CANVAS_HEIGHT - 100,
      },
    },
    player2: {
      id: player2Id,
      name: player2Name,
      score: 0,
      gameData: {
        paddleX: CANVAS_WIDTH / 2,
        paddleY: 100,
      },
    },
    puck: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: (Math.random() - 0.5) * PUCK_SPEED * 2,
      vy: (Math.random() > 0.5 ? 1 : -1) * PUCK_SPEED,
    },
    status: 'playing',
  };
}

export function updateAirHockeyGame(state: AirHockeyGameState): void {
  if (state.status !== 'playing') return;

  state.puck.x += state.puck.vx;
  state.puck.y += state.puck.vy;

  if (state.puck.x <= PUCK_RADIUS || state.puck.x >= CANVAS_WIDTH - PUCK_RADIUS) {
    state.puck.vx *= -0.9;
    state.puck.x = Math.max(PUCK_RADIUS, Math.min(CANVAS_WIDTH - PUCK_RADIUS, state.puck.x));
  }

  if (state.puck.y <= 0) {
    const goalStart = (CANVAS_WIDTH - GOAL_WIDTH) / 2;
    const goalEnd = goalStart + GOAL_WIDTH;
    if (state.puck.x >= goalStart && state.puck.x <= goalEnd) {
      state.player1.score++;
      resetPuck(state);
    } else {
      state.puck.vy *= -0.9;
      state.puck.y = PUCK_RADIUS;
    }
  }

  if (state.puck.y >= CANVAS_HEIGHT) {
    const goalStart = (CANVAS_WIDTH - GOAL_WIDTH) / 2;
    const goalEnd = goalStart + GOAL_WIDTH;
    if (state.puck.x >= goalStart && state.puck.x <= goalEnd) {
      state.player2.score++;
      resetPuck(state);
    } else {
      state.puck.vy *= -0.9;
      state.puck.y = CANVAS_HEIGHT - PUCK_RADIUS;
    }
  }

  [state.player1, state.player2].forEach(player => {
    const gameData = player.gameData;
    const dx = state.puck.x - gameData.paddleX;
    const dy = state.puck.y - gameData.paddleY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < PADDLE_RADIUS + PUCK_RADIUS) {
      const angle = Math.atan2(dy, dx);
      const speed = Math.sqrt(state.puck.vx ** 2 + state.puck.vy ** 2);
      state.puck.vx = Math.cos(angle) * speed * 1.1;
      state.puck.vy = Math.sin(angle) * speed * 1.1;

      state.puck.x = gameData.paddleX + Math.cos(angle) * (PADDLE_RADIUS + PUCK_RADIUS);
      state.puck.y = gameData.paddleY + Math.sin(angle) * (PADDLE_RADIUS + PUCK_RADIUS);
    }
  });

  if (state.player1.score >= WINNING_SCORE) {
    state.status = 'finished';
    state.winner = state.player1.id;
  } else if (state.player2.score >= WINNING_SCORE) {
    state.status = 'finished';
    state.winner = state.player2.id;
  }
}

function resetPuck(state: AirHockeyGameState): void {
  state.puck.x = CANVAS_WIDTH / 2;
  state.puck.y = CANVAS_HEIGHT / 2;
  state.puck.vx = (Math.random() - 0.5) * PUCK_SPEED * 2;
  state.puck.vy = (Math.random() > 0.5 ? 1 : -1) * PUCK_SPEED;
}

export function moveAirHockeyPaddle(player: AirHockeyGameState['player1'], x: number, y: number): void {
  const gameData = player.gameData;
  gameData.paddleX = Math.max(PADDLE_RADIUS, Math.min(CANVAS_WIDTH - PADDLE_RADIUS, x));
  gameData.paddleY = Math.max(PADDLE_RADIUS, Math.min(CANVAS_HEIGHT - PADDLE_RADIUS, y));
}

export function updateAirHockeyBotAI(state: AirHockeyGameState, botIsPlayer2: boolean): void {
  const bot = botIsPlayer2 ? state.player2 : state.player1;
  const gameData = bot.gameData;
  const targetY = botIsPlayer2 ? 100 : CANVAS_HEIGHT - 100;

  const targetX = state.puck.x;
  const dx = (targetX - gameData.paddleX) * 0.08;
  const dy = (targetY - gameData.paddleY) * 0.05;

  moveAirHockeyPaddle(bot, gameData.paddleX + dx, gameData.paddleY + dy);
}
