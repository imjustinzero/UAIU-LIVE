const COURSE_WIDTH = 600;
const COURSE_HEIGHT = 800;
const HOLE_RADIUS = 20;
const BALL_RADIUS = 8;
const MAX_POWER = 300;
const FRICTION = 0.98;
const MIN_VELOCITY = 0.5;
const PAR = 3;

interface Vector2D {
  x: number;
  y: number;
}

interface GolfBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isMoving: boolean;
}

interface Obstacle {
  type: 'tree' | 'sand' | 'water';
  x: number;
  y: number;
  radius: number;
}

interface GolfPlayerData {
  ball: GolfBall;
  strokes: number;
  finished: boolean;
  currentTurn: boolean;
  hasShotThisTurn: boolean;
}

export interface GolfGameState {
  matchId: string;
  gameType: 'golf';
  player1: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: GolfPlayerData;
  };
  player2: {
    id: string;
    name: string;
    socketId?: string;
    score: number;
    gameData: GolfPlayerData;
  };
  hole: {
    x: number;
    y: number;
  };
  obstacles: Obstacle[];
  currentPlayerId: string;
  previousPlayerId?: string; // Track previous turn to detect actual turn changes
  status: 'playing' | 'finished';
  winner?: string;
  botWillWin?: boolean;
}

function generateObstacles(): Obstacle[] {
  const obstacles: Obstacle[] = [];
  
  // Add trees
  for (let i = 0; i < 5; i++) {
    obstacles.push({
      type: 'tree',
      x: 100 + Math.random() * 400,
      y: 150 + Math.random() * 500,
      radius: 25
    });
  }
  
  // Add sand traps
  for (let i = 0; i < 3; i++) {
    obstacles.push({
      type: 'sand',
      x: 100 + Math.random() * 400,
      y: 150 + Math.random() * 500,
      radius: 40
    });
  }
  
  // Add water hazard
  obstacles.push({
    type: 'water',
    x: COURSE_WIDTH / 2,
    y: COURSE_HEIGHT / 2,
    radius: 60
  });
  
  return obstacles;
}

export function createGolfMatch(p1Id: string, p2Id: string, p1Name: string, p2Name: string): GolfGameState {
  const obstacles = generateObstacles();
  const holeX = COURSE_WIDTH / 2;
  const holeY = 100;
  
  return {
    matchId: `golf-${Date.now()}-${Math.random()}`,
    gameType: 'golf',
    player1: {
      id: p1Id,
      name: p1Name,
      score: 0,
      gameData: {
        ball: {
          x: COURSE_WIDTH / 2,
          y: COURSE_HEIGHT - 100,
          vx: 0,
          vy: 0,
          isMoving: false
        },
        strokes: 0,
        finished: false,
        currentTurn: true,
        hasShotThisTurn: false
      }
    },
    player2: {
      id: p2Id,
      name: p2Name,
      score: 0,
      gameData: {
        ball: {
          x: COURSE_WIDTH / 2,
          y: COURSE_HEIGHT - 100,
          vx: 0,
          vy: 0,
          isMoving: false
        },
        strokes: 0,
        finished: false,
        currentTurn: false,
        hasShotThisTurn: false
      }
    },
    hole: { x: holeX, y: holeY },
    obstacles,
    currentPlayerId: p1Id,
    previousPlayerId: undefined, // No previous turn yet
    status: 'playing',
    botWillWin: Math.random() < 0.8
  };
}

export function handleGolfInput(state: GolfGameState, playerId: string, input: any) {
  if (state.status !== 'playing') return;
  if (state.currentPlayerId !== playerId) return;
  
  const isPlayer1 = state.player1.id === playerId;
  const player = isPlayer1 ? state.player1.gameData : state.player2.gameData;
  
  if (player.ball.isMoving || player.finished || player.hasShotThisTurn) return;
  
  if (input.action === 'shoot' && typeof input.angle === 'number' && typeof input.power === 'number') {
    const actualPower = Math.min(input.power, MAX_POWER);
    
    // angle is already in radians from GameCanvas
    player.ball.vx = Math.cos(input.angle) * actualPower / 30;
    player.ball.vy = Math.sin(input.angle) * actualPower / 30;
    player.ball.isMoving = true;
    player.strokes++;
    player.hasShotThisTurn = true;
  }
}

export function updateGolfBotAI(state: GolfGameState, botIsPlayer2: boolean) {
  if (!botIsPlayer2 || state.status !== 'playing') return;
  if (state.currentPlayerId !== state.player2.id) return;
  
  const bot = state.player2.gameData;
  if (bot.ball.isMoving || bot.finished || bot.hasShotThisTurn) return;
  
  const dx = state.hole.x - bot.ball.x;
  const dy = state.hole.y - bot.ball.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  const botWillWin = state.botWillWin || false;
  let accuracy = botWillWin ? 0.9 : 0.7;
  
  // Add some randomness
  const angleNoise = (Math.random() - 0.5) * (1 - accuracy) * 0.3;
  const powerNoise = (Math.random() - 0.5) * (1 - accuracy) * 50;
  
  const targetAngle = angle + angleNoise;
  const targetPower = Math.min(distance * 2.5 + powerNoise, MAX_POWER);
  
  // Use the same input path as human players for consistency
  handleGolfInput(state, state.player2.id, {
    action: 'shoot',
    angle: targetAngle,
    power: targetPower
  });
}

// Helper function to advance turn to next unfinished player or end match
function advanceTurn(state: GolfGameState): void {
  // Save current player ID before advancing
  const oldPlayerId = state.currentPlayerId;
  state.previousPlayerId = oldPlayerId;
  
  const p1Finished = state.player1.gameData.finished;
  const p2Finished = state.player2.gameData.finished;
  
  if (p1Finished && p2Finished) {
    // Both finished - match will end in game end check
    return;
  }
  
  if (!p1Finished && !p2Finished) {
    // Both still playing - alternate turns
    state.currentPlayerId = state.currentPlayerId === state.player1.id ? state.player2.id : state.player1.id;
  } else if (!p1Finished && p2Finished) {
    // Only P1 can play
    state.currentPlayerId = state.player1.id;
  } else if (p1Finished && !p2Finished) {
    // Only P2 can play
    state.currentPlayerId = state.player2.id;
  }
  
  // Update current turn flags
  state.player1.gameData.currentTurn = state.currentPlayerId === state.player1.id;
  state.player2.gameData.currentTurn = state.currentPlayerId === state.player2.id;
  
  // If player didn't change (one player remaining), reset their hasShotThisTurn immediately
  if (oldPlayerId === state.currentPlayerId) {
    const currentPlayer = state.currentPlayerId === state.player1.id ? state.player1.gameData : state.player2.gameData;
    currentPlayer.hasShotThisTurn = false;
    // Clear previousPlayerId so the normal reset logic doesn't trigger
    state.previousPlayerId = undefined;
  }
  
  // Guard: ensure currentPlayerId never points to a finished player
  const currentPlayer = state.currentPlayerId === state.player1.id ? state.player1.gameData : state.player2.gameData;
  if (currentPlayer.finished && (!p1Finished || !p2Finished)) {
    console.error('CRITICAL BUG: currentPlayerId points to finished player', state.currentPlayerId, state);
  }
}

function checkObstacleCollision(ball: GolfBall, obstacles: Obstacle[], player: GolfPlayerData): void {
  for (const obstacle of obstacles) {
    const dx = ball.x - obstacle.x;
    const dy = ball.y - obstacle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < obstacle.radius + BALL_RADIUS) {
      if (obstacle.type === 'water') {
        // Ball in water, reset to starting position with penalty
        ball.x = COURSE_WIDTH / 2;
        ball.y = COURSE_HEIGHT - 100;
        ball.vx = 0;
        ball.vy = 0;
        ball.isMoving = false; // Stop ball - turn will advance in main loop
        player.strokes++; // Penalty stroke
        // Don't reset hasShotThisTurn here - let turn-switch logic handle it
      } else if (obstacle.type === 'tree') {
        // Bounce off tree
        const angle = Math.atan2(dy, dx);
        ball.vx = Math.cos(angle) * Math.abs(ball.vx) * 0.5;
        ball.vy = Math.sin(angle) * Math.abs(ball.vy) * 0.5;
        ball.x = obstacle.x + Math.cos(angle) * (obstacle.radius + BALL_RADIUS + 1);
        ball.y = obstacle.y + Math.sin(angle) * (obstacle.radius + BALL_RADIUS + 1);
      } else if (obstacle.type === 'sand') {
        // Slow down in sand
        ball.vx *= 0.7;
        ball.vy *= 0.7;
      }
    }
  }
}

export function updateGolfGame(state: GolfGameState) {
  if (state.status !== 'playing') return;
  
  // Reset hasShotThisTurn ONLY if turn actually changed (previousPlayerId !== currentPlayerId)
  // Clear previousPlayerId immediately after reset to prevent repeated resets
  if (state.previousPlayerId && state.previousPlayerId !== state.currentPlayerId) {
    // Turn has changed - reset shot flag for both players
    state.player1.gameData.hasShotThisTurn = false;
    state.player2.gameData.hasShotThisTurn = false;
    // Clear previousPlayerId to prevent this from triggering again
    state.previousPlayerId = undefined;
  }
  
  const players = [state.player1.gameData, state.player2.gameData];
  let anyMoving = false;
  
  for (const player of players) {
    if (player.ball.isMoving && !player.finished) {
      // Update position
      player.ball.x += player.ball.vx;
      player.ball.y += player.ball.vy;
      
      // Apply friction
      player.ball.vx *= FRICTION;
      player.ball.vy *= FRICTION;
      
      // Ensure ball stays within course boundaries
      if (player.ball.x < BALL_RADIUS) {
        player.ball.x = BALL_RADIUS;
        player.ball.vx *= -0.8;
      }
      if (player.ball.x > COURSE_WIDTH - BALL_RADIUS) {
        player.ball.x = COURSE_WIDTH - BALL_RADIUS;
        player.ball.vx *= -0.8;
      }
      if (player.ball.y < BALL_RADIUS) {
        player.ball.y = BALL_RADIUS;
        player.ball.vy *= -0.8;
      }
      if (player.ball.y > COURSE_HEIGHT - BALL_RADIUS) {
        player.ball.y = COURSE_HEIGHT - BALL_RADIUS;
        player.ball.vy *= -0.8;
      }
      
      // Check obstacle collisions
      checkObstacleCollision(player.ball, state.obstacles, player);
      
      // Check if ball stopped
      const speed = Math.sqrt(player.ball.vx * player.ball.vx + player.ball.vy * player.ball.vy);
      if (speed < MIN_VELOCITY) {
        player.ball.vx = 0;
        player.ball.vy = 0;
        player.ball.isMoving = false;
        
        // Check if in hole
        const dx = player.ball.x - state.hole.x;
        const dy = player.ball.y - state.hole.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < HOLE_RADIUS) {
          player.finished = true;
          player.ball.x = state.hole.x;
          player.ball.y = state.hole.y;
        }
      } else {
        anyMoving = true;
      }
    }
  }
  
  // Switch turns when ball stops (only if current player has shot or is finished)
  if (!anyMoving) {
    const currentPlayer = state.currentPlayerId === state.player1.id ? state.player1.gameData : state.player2.gameData;
    if (currentPlayer.hasShotThisTurn || currentPlayer.finished) {
      advanceTurn(state);
    }
  }
  
  // Check for game end
  if (state.player1.gameData.finished && state.player2.gameData.finished) {
    const p1Strokes = state.player1.gameData.strokes;
    const p2Strokes = state.player2.gameData.strokes;
    
    state.player1.score = p1Strokes;
    state.player2.score = p2Strokes;
    
    if (p1Strokes < p2Strokes) {
      state.winner = state.player1.id;
    } else if (p2Strokes < p1Strokes) {
      state.winner = state.player2.id;
    } else {
      // Tie - player 1 wins
      state.winner = state.player1.id;
    }
    
    state.status = 'finished';
  }
  
  // Auto-finish if too many strokes (prevent infinite games)
  if (state.player1.gameData.strokes >= 10 && !state.player1.gameData.finished) {
    state.player1.gameData.finished = true;
    state.player1.gameData.ball.isMoving = false;
    // Don't reset hasShotThisTurn here - let turn-switch logic handle it when ball stops
  }
  if (state.player2.gameData.strokes >= 10 && !state.player2.gameData.finished) {
    state.player2.gameData.finished = true;
    state.player2.gameData.ball.isMoving = false;
    // Don't reset hasShotThisTurn here - let turn-switch logic handle it when ball stops
  }
}
