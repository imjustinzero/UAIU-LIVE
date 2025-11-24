export interface FlappyBirdGameState {
  matchId: string;
  gameType: 'flappybird';
  player1: {
    id: string;
    name: string;
    y: number;
    velocity: number;
    score: number;
    alive: boolean;
  };
  player2: {
    id: string;
    name: string;
    y: number;
    velocity: number;
    score: number;
    alive: boolean;
  };
  pipes: { x: number; gap: number; passed: boolean }[];
  status: 'playing' | 'finished';
  winner?: string;
}

const GRAVITY = 0.5;
const JUMP_STRENGTH = -10;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const PIPE_SPEED = 3;
const CANVAS_HEIGHT = 600;

export function createFlappyBirdMatch(player1Id: string, player2Id: string, player1Name: string, player2Name: string): FlappyBirdGameState {
  return {
    matchId: `flappy-${Date.now()}-${Math.random()}`,
    gameType: 'flappybird',
    player1: {
      id: player1Id,
      name: player1Name,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      score: 0,
      alive: true,
    },
    player2: {
      id: player2Id,
      name: player2Name,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      score: 0,
      alive: true,
    },
    pipes: [
      { x: 400, gap: 200, passed: false },
      { x: 650, gap: 250, passed: false },
      { x: 900, gap: 180, passed: false },
    ],
    status: 'playing',
  };
}

export function updateFlappyBirdGame(state: FlappyBirdGameState): void {
  if (state.status !== 'playing') return;

  // Update players
  [state.player1, state.player2].forEach(player => {
    if (!player.alive) return;

    player.velocity += GRAVITY;
    player.y += player.velocity;

    // Check ground/ceiling collision
    if (player.y < 0 || player.y > CANVAS_HEIGHT - 30) {
      player.alive = false;
      return;
    }

    // Check pipe collision
    state.pipes.forEach(pipe => {
      const birdX = 50;
      if (birdX + 30 > pipe.x && birdX < pipe.x + PIPE_WIDTH) {
        if (player.y < pipe.gap - PIPE_GAP / 2 || player.y + 30 > pipe.gap + PIPE_GAP / 2) {
          player.alive = false;
        }
      }
    });
  });

  // Update pipes
  state.pipes.forEach(pipe => {
    pipe.x -= PIPE_SPEED;

    if (!pipe.passed && pipe.x + PIPE_WIDTH < 50) {
      pipe.passed = true;
      if (state.player1.alive) state.player1.score++;
      if (state.player2.alive) state.player2.score++;
    }
  });

  // Add new pipes
  if (state.pipes[state.pipes.length - 1].x < 600) {
    state.pipes.push({
      x: state.pipes[state.pipes.length - 1].x + 250,
      gap: 150 + Math.random() * 150,
      passed: false,
    });
  }

  // Remove old pipes
  state.pipes = state.pipes.filter(pipe => pipe.x > -PIPE_WIDTH);

  // Check win condition
  if (!state.player1.alive && !state.player2.alive) {
    state.status = 'finished';
    state.winner = state.player1.score >= state.player2.score ? state.player1.id : state.player2.id;
  } else if (!state.player1.alive) {
    state.status = 'finished';
    state.winner = state.player2.id;
  } else if (!state.player2.alive) {
    state.status = 'finished';
    state.winner = state.player1.id;
  }
}

export function flappyBirdJump(player: FlappyBirdGameState['player1']): void {
  if (player.alive) {
    player.velocity = JUMP_STRENGTH;
  }
}

export function updateFlappyBirdBotAI(state: FlappyBirdGameState, botIsPlayer2: boolean): void {
  const bot = botIsPlayer2 ? state.player2 : state.player1;
  if (!bot.alive) return;

  const nextPipe = state.pipes.find(pipe => pipe.x > 50);
  if (nextPipe && bot.y > nextPipe.gap - 50) {
    flappyBirdJump(bot);
  }
}
