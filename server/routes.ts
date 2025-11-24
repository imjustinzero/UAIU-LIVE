import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import type { GameState } from "@shared/schema";
import { sendSignupNotification, sendPayoutNotification } from "./email-config";
import { registerStripeWebhook } from "./stripe-config";
import { createSession, getSession, requireAuth } from "./session-middleware";

interface PlayerInMatch {
  userId: string;
  socketId: string;
  paddleX: number;
  paddleVelocity: number;
  score: number;
}

interface Match {
  id: string;
  player1: PlayerInMatch;
  player2: PlayerInMatch;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  status: 'playing' | 'finished';
  winnerId?: string;
}

const matchmakingQueue: { userId: string; socketId: string; name: string }[] = [];
const activeMatches = new Map<string, Match>();
const playerToMatchMap = new Map<string, string>();

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PADDLE_WIDTH = 100;
const PADDLE_SPEED = 8;
const BALL_SIZE = 12;
const BALL_SPEED = 6;
const PADDLE_Y_PLAYER1 = CANVAS_HEIGHT - 40;
const PADDLE_Y_PLAYER2 = 40;

function createMatch(player1: { userId: string; socketId: string; name: string }, player2: { userId: string; socketId: string; name: string }): Match {
  const matchId = `match-${Date.now()}-${Math.random()}`;
  const match: Match = {
    id: matchId,
    player1: {
      userId: player1.userId,
      socketId: player1.socketId,
      paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      paddleVelocity: 0,
      score: 0,
    },
    player2: {
      userId: player2.userId,
      socketId: player2.socketId,
      paddleX: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      paddleVelocity: 0,
      score: 0,
    },
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED,
      vy: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED,
    },
    status: 'playing',
  };
  return match;
}

function updateGamePhysics(match: Match, io: SocketIOServer): void {
  match.player1.paddleX += match.player1.paddleVelocity;
  match.player2.paddleX += match.player2.paddleVelocity;

  match.player1.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, match.player1.paddleX));
  match.player2.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, match.player2.paddleX));

  match.ball.x += match.ball.vx;
  match.ball.y += match.ball.vy;

  if (match.ball.x <= BALL_SIZE || match.ball.x >= CANVAS_WIDTH - BALL_SIZE) {
    match.ball.vx *= -1;
  }

  if (match.ball.y <= PADDLE_Y_PLAYER2 + 15 + BALL_SIZE &&
      match.ball.y >= PADDLE_Y_PLAYER2 + 15 &&
      match.ball.x >= match.player2.paddleX &&
      match.ball.x <= match.player2.paddleX + PADDLE_WIDTH) {
    match.ball.vy = Math.abs(match.ball.vy);
    const paddleCenter = match.player2.paddleX + PADDLE_WIDTH / 2;
    const hitPosition = (match.ball.x - paddleCenter) / (PADDLE_WIDTH / 2);
    match.ball.vx = hitPosition * BALL_SPEED * 1.5;
  }

  if (match.ball.y >= PADDLE_Y_PLAYER1 - BALL_SIZE &&
      match.ball.y <= PADDLE_Y_PLAYER1 &&
      match.ball.x >= match.player1.paddleX &&
      match.ball.x <= match.player1.paddleX + PADDLE_WIDTH) {
    match.ball.vy = -Math.abs(match.ball.vy);
    const paddleCenter = match.player1.paddleX + PADDLE_WIDTH / 2;
    const hitPosition = (match.ball.x - paddleCenter) / (PADDLE_WIDTH / 2);
    match.ball.vx = hitPosition * BALL_SPEED * 1.5;
  }

  if (match.ball.y <= 0) {
    match.player1.score++;
    if (match.player1.score >= 5) {
      endMatch(match, match.player1.userId, io);
    } else {
      resetBall(match);
    }
  } else if (match.ball.y >= CANVAS_HEIGHT) {
    match.player2.score++;
    if (match.player2.score >= 5) {
      endMatch(match, match.player2.userId, io);
    } else {
      resetBall(match);
    }
  }
}

function resetBall(match: Match): void {
  match.ball.x = CANVAS_WIDTH / 2;
  match.ball.y = CANVAS_HEIGHT / 2;
  match.ball.vx = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
  match.ball.vy = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
}

async function endMatch(match: Match, winnerId: string, io: SocketIOServer): Promise<void> {
  match.status = 'finished';
  match.winnerId = winnerId;

  const player1 = await storage.getUser(match.player1.userId);
  const player2 = await storage.getUser(match.player2.userId);

  if (!player1 || !player2) return;

  const isPlayer1Winner = winnerId === match.player1.userId;
  const player1NewCredits = isPlayer1Winner ? player1.credits + 0.6 : player1.credits;
  const player2NewCredits = isPlayer1Winner ? player2.credits : player2.credits + 0.6;

  await storage.updateUserCredits(match.player1.userId, player1NewCredits);
  await storage.updateUserCredits(match.player2.userId, player2NewCredits);

  await storage.updateUserStats(match.player1.userId, {
    matchesPlayed: player1.matchesPlayed + 1,
    wins: isPlayer1Winner ? player1.wins + 1 : player1.wins,
    losses: isPlayer1Winner ? player1.losses : player1.losses + 1,
    totalEarnings: isPlayer1Winner ? player1.totalEarnings + 0.6 : player1.totalEarnings,
  });

  await storage.updateUserStats(match.player2.userId, {
    matchesPlayed: player2.matchesPlayed + 1,
    wins: isPlayer1Winner ? player2.wins : player2.wins + 1,
    losses: isPlayer1Winner ? player2.losses + 1 : player2.losses,
    totalEarnings: isPlayer1Winner ? player2.totalEarnings : player2.totalEarnings + 0.6,
  });

  await storage.createMatch({
    player1Id: match.player1.userId,
    player2Id: match.player2.userId,
    player1Name: player1.name,
    player2Name: player2.name,
    winnerId,
    winnerName: isPlayer1Winner ? player1.name : player2.name,
    player1Score: match.player1.score,
    player2Score: match.player2.score,
    creditsBurned: 0.4,
  });

  await storage.addActionLog({
    type: 'match',
    message: `${isPlayer1Winner ? player1.name : player2.name} defeated ${isPlayer1Winner ? player2.name : player1.name} ${isPlayer1Winner ? match.player1.score : match.player2.score}-${isPlayer1Winner ? match.player2.score : match.player1.score}`,
  });

  io.to(match.player1.socketId).emit('matchEnded', {
    winnerId,
    player1Credits: player1NewCredits,
    player2Credits: player2NewCredits,
  });

  io.to(match.player2.socketId).emit('matchEnded', {
    winnerId,
    player1Credits: player1NewCredits,
    player2Credits: player2NewCredits,
  });

  playerToMatchMap.delete(match.player1.userId);
  playerToMatchMap.delete(match.player2.userId);
  activeMatches.delete(match.id);
}

function getGameState(match: Match, player1Name: string, player2Name: string): GameState {
  return {
    matchId: match.id,
    player1: {
      id: match.player1.userId,
      name: player1Name,
      y: match.player1.paddleX,
      score: match.player1.score,
    },
    player2: {
      id: match.player2.userId,
      name: player2Name,
      y: match.player2.paddleX,
      score: match.player2.score,
    },
    ball: match.ball,
    status: match.status,
    winner: match.winnerId,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  registerStripeWebhook(app);

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, name, password } = req.body;

      if (!email || !name || !password) {
        return res.status(400).json({ message: 'Email, name, and password are required' });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, name, password: hashedPassword });

      await storage.addActionLog({
        type: 'signup',
        message: `${name} joined UAIU Pong!`,
      });

      await sendSignupNotification(email, name);

      const sessionId = createSession(user.id, user.email);
      res.json({ ...user, sessionId });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Signup failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const sessionId = createSession(user.id, user.email);
      res.json({ ...user, sessionId });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const leaders = await storage.getLeaderboard(10);
      res.json(leaders);
    } catch (error) {
      console.error('Leaderboard error:', error);
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  });

  app.get('/api/action-log', async (req, res) => {
    try {
      const logs = await storage.getActionLog(50);
      res.json(logs);
    } catch (error) {
      console.error('Action log error:', error);
      res.status(500).json({ message: 'Failed to fetch action log' });
    }
  });

  app.post('/api/payout/request', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { paymentMethod, paymentInfo } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const amount = user.credits;

      if (amount < 1) {
        return res.status(400).json({ message: 'Insufficient credits for payout' });
      }

      await storage.createPayoutRequest({
        userId,
        userName: user.name,
        userEmail: user.email,
        amount,
        paymentMethod,
        paymentInfo,
      });

      await storage.updateUserCredits(userId, 0);

      await storage.addActionLog({
        type: 'payout',
        message: `${user.name} requested payout of ${amount.toFixed(1)} credits via ${paymentMethod}`,
      });

      await sendPayoutNotification(user.name, user.email, amount, paymentMethod, paymentInfo);

      res.json({ success: true });
    } catch (error) {
      console.error('Payout error:', error);
      res.status(500).json({ message: 'Payout request failed' });
    }
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket: Socket) => {
    const sessionId = (socket.handshake.auth as any).sessionId;
    if (!sessionId) {
      console.error('Socket connection rejected: No sessionId in auth');
      socket.disconnect();
      return;
    }
    
    const session = getSession(sessionId);
    if (!session) {
      console.error('Socket connection rejected: Invalid or expired session');
      socket.disconnect();
      return;
    }
    
    (socket as any).userId = session.userId;
    (socket as any).userEmail = session.email;
    console.log('Client connected:', socket.id, 'User:', session.userId, session.email);

    socket.on('joinMatchmaking', async () => {
      try {
        const userId = (socket as any).userId;
        if (!userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const user = await storage.getUser(userId);
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        if (user.credits < 1) {
          socket.emit('error', { message: 'Insufficient credits' });
          socket.emit('creditsUpdated', user.credits);
          return;
        }

        await storage.updateUserCredits(userId, user.credits - 1);
        socket.emit('creditsUpdated', user.credits - 1);

        matchmakingQueue.push({ userId, socketId: socket.id, name: user.name });

        if (matchmakingQueue.length >= 2) {
          const player1 = matchmakingQueue.shift()!;
          const player2 = matchmakingQueue.shift()!;

          const match = createMatch(player1, player2);
          activeMatches.set(match.id, match);
          playerToMatchMap.set(player1.userId, match.id);
          playerToMatchMap.set(player2.userId, match.id);

          io.to(player1.socketId).emit('matchFound');
          io.to(player2.socketId).emit('matchFound');

          const gameLoop = setInterval(async () => {
            if (match.status === 'finished') {
              clearInterval(gameLoop);
              return;
            }

            updateGamePhysics(match, io);

            const user1 = await storage.getUser(player1.userId);
            const user2 = await storage.getUser(player2.userId);

            if (user1 && user2) {
              const gameState = getGameState(match, user1.name, user2.name);
              io.to(player1.socketId).emit('gameState', gameState);
              io.to(player2.socketId).emit('gameState', gameState);
            }
          }, 1000 / 60);
        }
      } catch (error) {
        console.error('Matchmaking error:', error);
        socket.emit('error', { message: 'Matchmaking failed' });
      }
    });

    socket.on('leaveMatchmaking', () => {
      const userId = (socket as any).userId;
      if (!userId) {
        return;
      }
      
      const index = matchmakingQueue.findIndex(p => p.userId === userId);
      if (index !== -1) {
        matchmakingQueue.splice(index, 1);
      }
    });

    socket.on('paddleMove', ({ direction }: { direction: 'left' | 'right' | 'stop' }) => {
      const authenticatedUserId = (socket as any).userId;
      if (!authenticatedUserId) return;

      const matchId = playerToMatchMap.get(authenticatedUserId);
      if (!matchId) return;

      const match = activeMatches.get(matchId);
      if (!match || match.status !== 'playing') return;

      const isPlayer1 = match.player1.userId === authenticatedUserId;
      const player = isPlayer1 ? match.player1 : match.player2;

      if (direction === 'left') {
        player.paddleVelocity = -PADDLE_SPEED;
      } else if (direction === 'right') {
        player.paddleVelocity = PADDLE_SPEED;
      } else {
        player.paddleVelocity = 0;
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      const queueIndex = matchmakingQueue.findIndex(p => p.socketId === socket.id);
      if (queueIndex !== -1) {
        matchmakingQueue.splice(queueIndex, 1);
      }
    });
  });

  return httpServer;
}
