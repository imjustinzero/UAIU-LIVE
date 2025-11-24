interface FlappyPlayer {
  y: number;
  velocity: number;
  alive: boolean;
}

export interface FlappyBirdGameState {
  matchId: string;
  gameType: 'flappybird';
  player1: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: FlappyPlayer;
  };
  player2: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: FlappyPlayer;
  };
  pipes: { x: number; gap: number; passed: boolean }[];
  status: 'playing' | 'finished';
  winner?: string;
}

const GRAVITY = 0.6;
const JUMP_STRENGTH = -11;
const PIPE_WIDTH = 60;
const PIPE_GAP = 160;
const PIPE_SPEED = 4;
const CANVAS_HEIGHT = 600;
const BIRD_SIZE = 30;

export function createFlappyBirdMatch(player1Id: string, player2Id: string, player1Name: string, player2Name: string): FlappyBirdGameState {
  return {
    matchId: `flappy-${Date.now()}-${Math.random()}`,
    gameType: 'flappybird',
    player1: {
      id: player1Id,
      name: player1Name,
      score: 0,
      gameData: {
        y: CANVAS_HEIGHT / 2,
        velocity: 0,
        alive: true,
      },
    },
    player2: {
      id: player2Id,
      name: player2Name,
      score: 0,
      gameData: {
        y: CANVAS_HEIGHT / 2,
        velocity: 0,
        alive: true,
      },
    },
    pipes: [
      { x: 350, gap: 220, passed: false },
      { x: 570, gap: 270, passed: false },
      { x: 790, gap: 200, passed: false },
    ],
    status: 'playing',
  };
}

export function updateFlappyBirdGame(state: FlappyBirdGameState): void {
  if (state.status !== 'playing') return;

  [state.player1, state.player2].forEach(player => {
    const gameData = player.gameData;
    if (!gameData.alive) return;

    gameData.velocity += GRAVITY;
    gameData.y += gameData.velocity;

    if (gameData.y < 0 || gameData.y > CANVAS_HEIGHT - BIRD_SIZE) {
      gameData.alive = false;
      return;
    }

    state.pipes.forEach(pipe => {
      const birdX = player === state.player1 ? 50 : 100;
      if (birdX + BIRD_SIZE > pipe.x && birdX < pipe.x + PIPE_WIDTH) {
        if (gameData.y < pipe.gap - PIPE_GAP / 2 || gameData.y + BIRD_SIZE > pipe.gap + PIPE_GAP / 2) {
          gameData.alive = false;
        }
      }
    });
  });

  state.pipes.forEach(pipe => {
    pipe.x -= PIPE_SPEED;

    if (!pipe.passed && pipe.x + PIPE_WIDTH < 100) {
      pipe.passed = true;
      if (state.player1.gameData.alive) state.player1.score += 10;
      if (state.player2.gameData.alive) state.player2.score += 10;
    }
  });

  if (state.pipes[state.pipes.length - 1].x < 550) {
    state.pipes.push({
      x: state.pipes[state.pipes.length - 1].x + 220,
      gap: 180 + Math.random() * 120,
      passed: false,
    });
  }

  state.pipes = state.pipes.filter(pipe => pipe.x > -PIPE_WIDTH);

  if (!state.player1.gameData.alive && !state.player2.gameData.alive) {
    state.status = 'finished';
    state.winner = state.player1.score >= state.player2.score ? state.player1.id : state.player2.id;
  } else if (!state.player1.gameData.alive) {
    state.status = 'finished';
    state.winner = state.player2.id;
  } else if (!state.player2.gameData.alive) {
    state.status = 'finished';
    state.winner = state.player1.id;
  }
}

export function flappyBirdJump(player: FlappyBirdGameState['player1']): void {
  if (player.gameData.alive) {
    player.gameData.velocity = JUMP_STRENGTH;
  }
}

export function updateFlappyBirdBotAI(state: FlappyBirdGameState, botIsPlayer2: boolean): void {
  const bot = botIsPlayer2 ? state.player2 : state.player1;
  const gameData = bot.gameData;
  if (!gameData.alive) return;

  const birdX = botIsPlayer2 ? 100 : 50;
  const nextPipe = state.pipes.find(pipe => pipe.x + PIPE_WIDTH > birdX);
  
  if (nextPipe) {
    const targetY = nextPipe.gap;
    if (gameData.y > targetY - 20) {
      flappyBirdJump(bot);
    }
  }
}
