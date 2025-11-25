import type { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import * as pong from "./games/pong";
import * as snake from "./games/snake";
import * as tetris from "./games/tetris";
import * as connect4 from "./games/connect4";
import * as flappybird from "./games/flappybird";
import * as breakout from "./games/breakout";

export type GameType = 'pong' | 'snake' | 'tetris' | 'breakout' | 'flappybird' | 'connect4';

// Creative bot names to make bots appear as real players
const BOT_NAMES = [
  'Blue Unicorn',
  'Zeus the Tetris God',
  'Pixel Warrior',
  'Cosmic Champion',
  'Shadow Master',
  'Lightning Strike',
  'Neon Ninja',
  'Quantum Queen',
  'Fire Phoenix',
  'Ice Dragon',
  'Thunder King',
  'Golden Eagle',
  'Silver Fox',
  'Crimson Knight',
  'Emerald Wizard',
  'Purple Storm',
  'Diamond Ace',
  'Ruby Ranger',
  'Sapphire Sage',
  'Topaz Tiger',
  'Mystic Mage',
  'Cyber Samurai',
  'Turbo Titan',
  'Blazing Comet',
  'Stellar Striker',
  'Nova Crusher',
  'Velocity Viper',
  'Rocket Rebel',
  'Laser Legend',
  'Prism Paladin',
];

function getRandomBotName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

export interface QueuedPlayer {
  userId: string;
  socketId: string;
  name: string;
  gameType: GameType;
  betAmount: number;
  timeLimit: number;
  joinedAt: number;
  countdownSeconds?: number;
  countdownInterval?: NodeJS.Timeout;
  botMatchTimeout?: NodeJS.Timeout;
}

export interface GameController {
  createMatch: (p1Id: string, p2Id: string, p1Name: string, p2Name: string) => any;
  updateGame: (state: any) => void;
  updateBotAI?: (state: any, botIsPlayer2: boolean) => void;
  handleInput?: (state: any, playerId: string, input: any) => void;
}

const gameControllers: Record<GameType, GameController> = {
  pong: {
    createMatch: pong.createPongMatch,
    updateGame: pong.updatePongGame,
    updateBotAI: pong.updatePongBotAI,
    handleInput: pong.handlePongInput,
  },
  snake: {
    createMatch: snake.createSnakeMatch,
    updateGame: snake.updateSnakeGame,
    updateBotAI: snake.updateSnakeBotAI,
    handleInput: (state, playerId, input) => {
      const player = state.player1.id === playerId ? state.player1 : state.player2;
      if (input.direction) {
        const currentDir = player.gameData.direction;
        const newDir = input.direction;
        
        // Prevent reversing into self
        if (currentDir === 'up' && newDir === 'down') return;
        if (currentDir === 'down' && newDir === 'up') return;
        if (currentDir === 'left' && newDir === 'right') return;
        if (currentDir === 'right' && newDir === 'left') return;
        
        player.gameData.direction = newDir;
      }
    },
  },
  tetris: {
    createMatch: tetris.createTetrisMatch,
    updateGame: tetris.updateTetrisGame,
    updateBotAI: tetris.updateTetrisBotAI,
    handleInput: (state, playerId, input) => {
      const player = state.player1.id === playerId ? state.player1 : state.player2;
      tetris.moveTetrisPiece(player, input.direction);
    },
  },
  connect4: {
    createMatch: connect4.createConnect4Match,
    updateGame: () => {}, // Turn-based, no continuous update
    updateBotAI: (state, botIsPlayer2) => {
      const bot = botIsPlayer2 ? state.player2 : state.player1;
      const now = Date.now();
      const timeSinceLastMove = now - (state.lastMoveTime || 0);
      
      // Only make a move if it's bot's turn and at least 1 second has passed since last move
      if (state.currentTurn === bot.id && timeSinceLastMove > 1000) {
        const col = connect4.getConnect4BotMove(state);
        connect4.dropPiece(state, col, bot.id);
      }
    },
    handleInput: (state, playerId, input) => {
      if (input.column !== undefined) {
        connect4.dropPiece(state, input.column, playerId);
      }
    },
  },
  flappybird: {
    createMatch: flappybird.createFlappyBirdMatch,
    updateGame: flappybird.updateFlappyBirdGame,
    updateBotAI: flappybird.updateFlappyBirdBotAI,
    handleInput: (state, playerId, input) => {
      const player = state.player1.id === playerId ? state.player1 : state.player2;
      if (input.action === 'jump') {
        flappybird.flappyBirdJump(player);
      }
    },
  },
  breakout: {
    createMatch: breakout.createBreakoutMatch,
    updateGame: breakout.updateBreakoutGame,
    updateBotAI: breakout.updateBreakoutBotAI,
    handleInput: (state, playerId, input) => {
      breakout.handleBreakoutInput(state, playerId, input);
    },
  },
};

export class GameManager {
  private matchmakingQueues: Map<GameType, QueuedPlayer[]> = new Map();
  private activeMatches: Map<string, any> = new Map();
  private playerToMatchMap: Map<string, string> = new Map();
  private gameLoops: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize queues for all game types
    const gameTypes: GameType[] = ['pong', 'snake', 'tetris', 'breakout', 'flappybird', 'connect4'];
    gameTypes.forEach(type => {
      this.matchmakingQueues.set(type, []);
    });
  }

  joinQueue(player: QueuedPlayer, io: SocketIOServer): void {
    const queue = this.matchmakingQueues.get(player.gameType)!;
    
    // Initialize countdown
    player.countdownSeconds = 10;
    
    // Try to match with another player who has the same bet amount
    const matchingPlayer = queue.find(p => 
      p.userId !== player.userId && 
      p.betAmount === player.betAmount
    );
    
    if (matchingPlayer) {
      // Clear any existing countdown for matching player
      if (matchingPlayer.countdownInterval) {
        clearInterval(matchingPlayer.countdownInterval);
      }
      if (matchingPlayer.botMatchTimeout) {
        clearTimeout(matchingPlayer.botMatchTimeout);
      }
      
      // Remove both players from queue and start match
      queue.splice(queue.indexOf(matchingPlayer), 1);
      this.broadcastQueueUpdate(io);
      this.startMatch(player, matchingPlayer, io, player.gameType);
    } else {
      // Add player to queue
      queue.push(player);
      this.broadcastQueueUpdate(io);
      
      // Start countdown interval (emit every second)
      player.countdownInterval = setInterval(() => {
        const stillInQueue = queue.find(p => p.userId === player.userId);
        if (stillInQueue && stillInQueue.countdownSeconds !== undefined) {
          stillInQueue.countdownSeconds--;
          
          // Emit countdown update to the specific player
          const socket = io.sockets.sockets.get(player.socketId);
          if (socket) {
            socket.emit('matchmakingCountdown', stillInQueue.countdownSeconds);
          }
          
          // Stop countdown when it reaches 0
          if (stillInQueue.countdownSeconds <= 0) {
            if (stillInQueue.countdownInterval) {
              clearInterval(stillInQueue.countdownInterval);
            }
          }
        } else {
          // Player left queue, clear interval
          if (player.countdownInterval) {
            clearInterval(player.countdownInterval);
          }
        }
      }, 1000);
      
      // Set timeout for AI opponent (10 seconds)
      player.botMatchTimeout = setTimeout(() => {
        const stillInQueue = queue.find(p => p.userId === player.userId);
        if (stillInQueue) {
          // Clear countdown interval
          if (stillInQueue.countdownInterval) {
            clearInterval(stillInQueue.countdownInterval);
          }
          
          queue.splice(queue.indexOf(stillInQueue), 1);
          this.broadcastQueueUpdate(io);
          const botPlayer: QueuedPlayer = {
            userId: 'AI_BOT',
            socketId: 'bot-socket',
            name: getRandomBotName(),
            gameType: player.gameType,
            betAmount: stillInQueue.betAmount,
            timeLimit: stillInQueue.timeLimit,
            joinedAt: Date.now(),
          };
          this.startMatch(stillInQueue, botPlayer, io, player.gameType);
        }
      }, 10000);
    }
  }

  leaveQueue(userId: string, io?: SocketIOServer): void {
    this.matchmakingQueues.forEach(queue => {
      const index = queue.findIndex(p => p.userId === userId);
      if (index !== -1) {
        const player = queue[index];
        // Clear any countdown intervals and timeouts
        if (player.countdownInterval) {
          clearInterval(player.countdownInterval);
        }
        if (player.botMatchTimeout) {
          clearTimeout(player.botMatchTimeout);
        }
        queue.splice(index, 1);
      }
    });
    if (io) {
      this.broadcastQueueUpdate(io);
    }
  }

  matchNow(userId: string, io: SocketIOServer): boolean {
    // Find the player in any queue
    let player: QueuedPlayer | undefined;
    let queue: QueuedPlayer[] | undefined;
    
    this.matchmakingQueues.forEach(q => {
      const p = q.find(p => p.userId === userId);
      if (p) {
        player = p;
        queue = q;
      }
    });

    if (!player || !queue) {
      return false;
    }

    // Clear any countdown intervals and timeouts
    if (player.countdownInterval) {
      clearInterval(player.countdownInterval);
    }
    if (player.botMatchTimeout) {
      clearTimeout(player.botMatchTimeout);
    }

    // Remove player from queue
    queue.splice(queue.indexOf(player), 1);
    this.broadcastQueueUpdate(io);

    // Create bot opponent
    const botPlayer: QueuedPlayer = {
      userId: 'AI_BOT',
      socketId: 'bot-socket',
      name: getRandomBotName(),
      gameType: player.gameType,
      betAmount: player.betAmount,
      timeLimit: player.timeLimit,
      joinedAt: Date.now(),
    };

    // Start match immediately with bot
    this.startMatch(player, botPlayer, io, player.gameType);
    return true;
  }

  getAllQueuedPlayers(): Omit<QueuedPlayer, 'socketId'>[] {
    const allPlayers: Omit<QueuedPlayer, 'socketId'>[] = [];
    this.matchmakingQueues.forEach(queue => {
      allPlayers.push(...queue);
    });
    return allPlayers;
  }

  getPlayerBetAmount(userId: string): number | null {
    let betAmount: number | null = null;
    this.matchmakingQueues.forEach(queue => {
      const player = queue.find(p => p.userId === userId);
      if (player) {
        betAmount = player.betAmount;
      }
    });
    return betAmount;
  }

  joinSpecificMatch(userId: string, targetUserId: string, userName: string, socketId: string, io: SocketIOServer): boolean {
    // Find the target player in any queue
    let targetPlayer: QueuedPlayer | undefined;
    let targetQueue: QueuedPlayer[] | undefined;
    
    this.matchmakingQueues.forEach(queue => {
      const player = queue.find(p => p.userId === targetUserId);
      if (player) {
        targetPlayer = player;
        targetQueue = queue;
      }
    });

    if (!targetPlayer || !targetQueue) {
      return false;
    }

    // Remove target player from queue
    targetQueue.splice(targetQueue.indexOf(targetPlayer), 1);

    // Create joining player with proper socket ID
    const joiningPlayer: QueuedPlayer = {
      userId,
      socketId,
      name: userName,
      gameType: targetPlayer.gameType,
      betAmount: targetPlayer.betAmount,
      timeLimit: targetPlayer.timeLimit,
      joinedAt: Date.now(),
    };

    // Start match
    this.broadcastQueueUpdate(io);
    this.startMatch(targetPlayer, joiningPlayer, io, targetPlayer.gameType);
    return true;
  }

  private broadcastQueueUpdate(io: SocketIOServer): void {
    const queuedPlayers = this.getAllQueuedPlayers();
    // Sanitize queue data - don't send socket IDs to clients
    const sanitizedQueue = queuedPlayers.map(p => ({
      userId: p.userId,
      name: p.name,
      gameType: p.gameType,
      betAmount: p.betAmount,
      timeLimit: p.timeLimit,
      joinedAt: p.joinedAt,
    }));
    io.emit('queueUpdate', sanitizedQueue);
  }

  private startMatch(p1: QueuedPlayer, p2: QueuedPlayer, io: SocketIOServer, gameType: GameType): void {
    const controller = gameControllers[gameType];
    if (!controller || !controller.createMatch) return;

    const match = controller.createMatch(p1.userId, p2.userId, p1.name, p2.name);
    const isBot2 = p2.userId === 'AI_BOT';
    
    // Store match metadata
    match.botIsPlayer2 = isBot2;
    match.gameType = gameType;
    match.betAmount = p1.betAmount;
    (match.player1 as any).socketId = p1.socketId;
    (match.player2 as any).socketId = p2.socketId;
    
    this.activeMatches.set(match.matchId, match);
    this.playerToMatchMap.set(p1.userId, match.matchId);
    if (!isBot2) {
      this.playerToMatchMap.set(p2.userId, match.matchId);
    }

    console.log(`[MATCHMAKING] Emitting matchFound to ${p1.name} (socketId: ${p1.socketId}), matchId: ${match.matchId}, gameType: ${gameType}`);
    io.to(p1.socketId).emit('matchFound', { matchId: match.matchId, gameType });
    if (!isBot2) {
      console.log(`[MATCHMAKING] Emitting matchFound to ${p2.name} (socketId: ${p2.socketId}), matchId: ${match.matchId, gameType}`);
      io.to(p2.socketId).emit('matchFound', { matchId: match.matchId, gameType });
    }

    // Delay game start to give clients time to render canvas
    setTimeout(() => {
      this.startGameLoop(match.matchId, io);
    }, 1000);
  }

  private startGameLoop(matchId: string, io: SocketIOServer): void {
    const interval = setInterval(() => {
      const match = this.activeMatches.get(matchId);
      if (!match) {
        clearInterval(interval);
        this.gameLoops.delete(matchId);
        return;
      }

      const gameType: GameType = match.gameType || 'pong';
      const controller = gameControllers[gameType];
      
      if (controller.updateGame) {
        controller.updateGame(match);
      }

      if (controller.updateBotAI && match.botIsPlayer2) {
        controller.updateBotAI(match, true);
      }

      // Emit state to players via socket IDs
      const p1SocketId = (match.player1 as any).socketId;
      const p2SocketId = (match.player2 as any).socketId;
      
      if (p1SocketId) {
        io.to(p1SocketId).emit('gameState', match);
      }
      if (p2SocketId && p2SocketId !== 'bot-socket') {
        io.to(p2SocketId).emit('gameState', match);
      }

      // Check if game finished
      if (match.status === 'finished') {
        clearInterval(interval);
        this.gameLoops.delete(matchId);
        this.endMatch(matchId, match.winner || match.player1.id, io);
      }
    }, 1000 / 60); // 60 FPS

    this.gameLoops.set(matchId, interval);
  }

  handleInput(matchId: string, playerId: string, input: any): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    const gameType: GameType = (match as any).gameType || 'pong';
    const controller = gameControllers[gameType];

    if (controller.handleInput) {
      controller.handleInput(match, playerId, input);
    }
  }

  private async endMatch(matchId: string, winnerId: string, io: SocketIOServer): Promise<void> {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    const isBot2 = (match as any).botIsPlayer2;
    const gameType = (match as any).gameType || 'pong';
    const betAmount = (match as any).betAmount || 1;

    // Credit settlement: winner gets betAmount * 1.6, loser loses betAmount
    const player1 = await storage.getUser(match.player1.id);
    const player2 = !isBot2 ? await storage.getUser(match.player2.id) : null;

    if (!player1) return;

    const isPlayer1Winner = winnerId === match.player1.id;
    const winnerPayout = betAmount * 1.6;
    
    // Winner gets back their bet + 60% bonus (net +0.6 * betAmount after the entry fee)
    // Loser already lost their bet when they joined the queue
    const player1NewCredits = isPlayer1Winner ? player1.credits + winnerPayout : player1.credits;
    const player2NewCredits = isBot2 ? 0 : (isPlayer1Winner ? player2!.credits : player2!.credits + winnerPayout);

    await storage.updateUserCredits(match.player1.id, player1NewCredits);
    if (!isBot2 && player2) {
      await storage.updateUserCredits(match.player2.id, player2NewCredits);
    }

    await storage.updateUserStats(match.player1.id, {
      matchesPlayed: player1.matchesPlayed + 1,
      wins: isPlayer1Winner ? player1.wins + 1 : player1.wins,
      losses: isPlayer1Winner ? player1.losses : player1.losses + 1,
      totalEarnings: isPlayer1Winner ? player1.totalEarnings + winnerPayout : player1.totalEarnings,
    });

    if (!isBot2 && player2) {
      await storage.updateUserStats(match.player2.id, {
        matchesPlayed: player2.matchesPlayed + 1,
        wins: isPlayer1Winner ? player2.wins : player2.wins + 1,
        losses: isPlayer1Winner ? player2.losses + 1 : player2.losses,
        totalEarnings: isPlayer1Winner ? player2.totalEarnings : player2.totalEarnings + winnerPayout,
      });
    }

    const player2Name = isBot2 ? match.player2.name : player2!.name;
    const winnerName = isPlayer1Winner ? player1.name : player2Name;

    await storage.createMatch({
      gameType,
      player1Id: match.player1.id,
      player2Id: isBot2 ? 'AI_BOT' : match.player2.id,
      player1Name: player1.name,
      player2Name,
      winnerId,
      winnerName,
      player1Score: match.player1.score || 0,
      player2Score: match.player2.score || 0,
      betAmount,
      creditsBurned: betAmount * 0.4,
    });

    await storage.addActionLog({
      userId: winnerId === 'AI_BOT' ? null : winnerId,
      userName: winnerName,
      type: 'match',
      message: `${winnerName} won at ${gameType.toUpperCase()}!`,
    });

    const p1SocketId = (match.player1 as any).socketId;
    const p2SocketId = (match.player2 as any).socketId;

    if (p1SocketId) {
      io.to(p1SocketId).emit('matchEnded', {
        winnerId,
        player1Id: match.player1.id,
        player2Id: match.player2.id,
        player1Credits: player1NewCredits,
        player2Credits: player2NewCredits,
      });
    }

    if (!isBot2 && p2SocketId) {
      io.to(p2SocketId).emit('matchEnded', {
        winnerId,
        player1Id: match.player1.id,
        player2Id: match.player2.id,
        player1Credits: player1NewCredits,
        player2Credits: player2NewCredits,
      });
    }

    this.playerToMatchMap.delete(match.player1.id);
    if (!isBot2) {
      this.playerToMatchMap.delete(match.player2.id);
    }
    this.activeMatches.delete(matchId);
  }

  getMatchForPlayer(userId: string): any {
    const matchId = this.playerToMatchMap.get(userId);
    return matchId ? this.activeMatches.get(matchId) : null;
  }
}

export const gameManager = new GameManager();
