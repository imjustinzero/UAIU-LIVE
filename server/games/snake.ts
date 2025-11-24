import type { Server as SocketIOServer } from "socket.io";

interface SnakePlayer {
  snake: { x: number; y: number }[];
  direction: 'up' | 'down' | 'left' | 'right';
  alive: boolean;
}

export interface SnakeGameState {
  matchId: string;
  gameType: 'snake';
  player1: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: SnakePlayer;
  };
  player2: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: SnakePlayer;
  };
  food: { x: number; y: number }[];
  status: 'playing' | 'finished';
  winner?: string;
  frameCounter: number;
}

const GRID_SIZE = 20;
const GRID_WIDTH = 30;
const GRID_HEIGHT = 40;

export function createSnakeMatch(player1Id: string, player2Id: string, player1Name: string, player2Name: string): SnakeGameState {
  return {
    matchId: `snake-${Date.now()}-${Math.random()}`,
    gameType: 'snake',
    frameCounter: 0,
    player1: {
      id: player1Id,
      name: player1Name,
      score: 0,
      gameData: {
        snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
        direction: 'right',
        alive: true,
      },
    },
    player2: {
      id: player2Id,
      name: player2Name,
      score: 0,
      gameData: {
        snake: [{ x: 20, y: 30 }, { x: 21, y: 30 }, { x: 22, y: 30 }],
        direction: 'left',
        alive: true,
      },
    },
    food: generateFood(3),
    status: 'playing',
  };
}

function generateFood(count: number): { x: number; y: number }[] {
  const food: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    food.push({
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT),
    });
  }
  return food;
}

export function updateSnakeGame(state: SnakeGameState): void {
  if (state.status !== 'playing') return;

  state.frameCounter++;
  
  // Only move snakes every 10 frames (6 times per second instead of 60)
  if (state.frameCounter % 10 !== 0) return;

  // Move both snakes
  [state.player1, state.player2].forEach((player) => {
    const gameData = player.gameData;
    if (!gameData.alive) return;

    const head = gameData.snake[0];
    let newHead = { ...head };

    switch (gameData.direction) {
      case 'up': newHead.y -= 1; break;
      case 'down': newHead.y += 1; break;
      case 'left': newHead.x -= 1; break;
      case 'right': newHead.x += 1; break;
    }

    // Check wall collision
    if (newHead.x < 0 || newHead.x >= GRID_WIDTH || newHead.y < 0 || newHead.y >= GRID_HEIGHT) {
      gameData.alive = false;
      return;
    }

    // Check self collision (skip head at index 0)
    if (gameData.snake.slice(1).some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      gameData.alive = false;
      return;
    }

    // Check other player collision
    const otherPlayer = player === state.player1 ? state.player2 : state.player1;
    if (otherPlayer.gameData.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      gameData.alive = false;
      return;
    }

    gameData.snake.unshift(newHead);

    // Check food collision
    const foodIndex = state.food.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    if (foodIndex !== -1) {
      player.score += 10;
      state.food.splice(foodIndex, 1);
      state.food.push(...generateFood(1));
    } else {
      gameData.snake.pop();
    }
  });

  // Check win conditions
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

export function updateSnakeBotAI(state: SnakeGameState, botIsPlayer2: boolean): void {
  const bot = botIsPlayer2 ? state.player2 : state.player1;
  const gameData = bot.gameData;
  if (!gameData.alive) return;

  // Bot makes decisions every 10 frames (balanced response time)
  if (state.frameCounter % 10 !== 0) return;

  // Calibrated mistakes - bot fails 13% of the time for ~87% win rate
  if (Math.random() < 0.13) return;

  const head = gameData.snake[0];
  const nearestFood = state.food.reduce((nearest, food) => {
    const dist = Math.abs(food.x - head.x) + Math.abs(food.y - head.y);
    const nearestDist = Math.abs(nearest.x - head.x) + Math.abs(nearest.y - head.y);
    return dist < nearestDist ? food : nearest;
  });

  const possibleDirections: Array<'up' | 'down' | 'left' | 'right'> = [];

  if (head.x < nearestFood.x && gameData.direction !== 'left') possibleDirections.push('right');
  if (head.x > nearestFood.x && gameData.direction !== 'right') possibleDirections.push('left');
  if (head.y < nearestFood.y && gameData.direction !== 'up') possibleDirections.push('down');
  if (head.y > nearestFood.y && gameData.direction !== 'down') possibleDirections.push('up');

  const otherPlayer = botIsPlayer2 ? state.player1 : state.player2;
  const safeDirections = possibleDirections.filter(dir => {
    let testHead = { ...head };
    switch (dir) {
      case 'up': testHead.y -= 1; break;
      case 'down': testHead.y += 1; break;
      case 'left': testHead.x -= 1; break;
      case 'right': testHead.x += 1; break;
    }

    if (testHead.x < 0 || testHead.x >= GRID_WIDTH || testHead.y < 0 || testHead.y >= GRID_HEIGHT) return false;
    if (gameData.snake.some(segment => segment.x === testHead.x && segment.y === testHead.y)) return false;
    if (otherPlayer.gameData.snake.some(segment => segment.x === testHead.x && segment.y === testHead.y)) return false;
    return true;
  });

  if (safeDirections.length > 0) {
    // Pick suboptimal moves 13% of time for ~87% win rate
    if (Math.random() < 0.13 && safeDirections.length > 1) {
      gameData.direction = safeDirections[Math.floor(Math.random() * safeDirections.length)];
    } else {
      gameData.direction = safeDirections[0];
    }
  } else {
    const allDirections: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
    const desperateDirections = allDirections.filter(dir => {
      if ((dir === 'up' && gameData.direction === 'down') || (dir === 'down' && gameData.direction === 'up')) return false;
      if ((dir === 'left' && gameData.direction === 'right') || (dir === 'right' && gameData.direction === 'left')) return false;
      
      let testHead = { ...head };
      switch (dir) {
        case 'up': testHead.y -= 1; break;
        case 'down': testHead.y += 1; break;
        case 'left': testHead.x -= 1; break;
        case 'right': testHead.x += 1; break;
      }
      
      if (testHead.x < 0 || testHead.x >= GRID_WIDTH || testHead.y < 0 || testHead.y >= GRID_HEIGHT) return false;
      return true;
    });
    
    if (desperateDirections.length > 0) {
      gameData.direction = desperateDirections[0];
    }
  }
}
