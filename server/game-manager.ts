import type { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import * as snake from "./games/snake";
import * as tetris from "./games/tetris";
import * as connect4 from "./games/connect4";
import * as flappybird from "./games/flappybird";
import * as breakout from "./games/breakout";
import * as airhockey from "./games/airhockey";

export type GameType = 'pong' | 'snake' | 'tetris' | 'breakout' | 'flappybird' | 'connect4' | 'airhockey';

export interface QueuedPlayer {
  userId: string;
  socketId: string;
  name: string;
  gameType: GameType;
  joinedAt: number;
}

export interface GameController {
  createMatch: (p1Id: string, p2Id: string, p1Name: string, p2Name: string) => any;
  updateGame: (state: any) => void;
  updateBotAI?: (state: any, botIsPlayer2: boolean) => void;
  handleInput?: (state: any, playerId: string, input: any) => void;
}

const gameControllers: Record<GameType, GameController> = {
  pong: {
    createMatch: () => null, // Handled separately in routes.ts for now
    updateGame: () => {},
  },
  snake: {
    createMatch: snake.createSnakeMatch,
    updateGame: snake.updateSnakeGame,
    updateBotAI: snake.updateSnakeBotAI,
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
    handleInput: (state, playerId, input) => {
      connect4.dropPiece(state, input.column, playerId);
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
      const player = state.player1.id === playerId ? state.player1 : state.player2;
      breakout.moveBreakoutPaddle(player, input.direction);
    },
  },
  airhockey: {
    createMatch: airhockey.createAirHockeyMatch,
    updateGame: airhockey.updateAirHockeyGame,
    updateBotAI: airhockey.updateAirHockeyBotAI,
    handleInput: (state, playerId, input) => {
      const player = state.player1.id === playerId ? state.player1 : state.player2;
      airhockey.moveAirHockeyPaddle(player, input.x, input.y);
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
    const gameTypes: GameType[] = ['pong', 'snake', 'tetris', 'breakout', 'flappybird', 'connect4', 'airhockey'];
    gameTypes.forEach(type => {
      this.matchmakingQueues.set(type, []);
    });
  }

  joinQueue(player: QueuedPlayer, io: SocketIOServer): void {
    const queue = this.matchmakingQueues.get(player.gameType)!;
    queue.push(player);

    // Try to match with another player
    if (queue.length >= 2) {
      const p1 = queue.shift()!;
      const p2 = queue.shift()!;
      this.startMatch(p1, p2, io, player.gameType);
    } else {
      // Set timeout for AI opponent
      setTimeout(() => {
        const stillInQueue = queue.find(p => p.userId === player.userId);
        if (stillInQueue) {
          queue.splice(queue.indexOf(stillInQueue), 1);
          const botPlayer: QueuedPlayer = {
            userId: 'AI_BOT',
            socketId: 'bot-socket',
            name: 'AI Bot',
            gameType: player.gameType,
            joinedAt: Date.now(),
          };
          this.startMatch(stillInQueue, botPlayer, io, player.gameType);
        }
      }, 10000);
    }
  }

  leaveQueue(userId: string): void {
    this.matchmakingQueues.forEach(queue => {
      const index = queue.findIndex(p => p.userId === userId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    });
  }

  private startMatch(p1: QueuedPlayer, p2: QueuedPlayer, io: SocketIOServer, gameType: GameType): void {
    const controller = gameControllers[gameType];
    if (!controller || !controller.createMatch) return;

    const match = controller.createMatch(p1.userId, p2.userId, p1.name, p2.name);
    const isBot2 = p2.userId === 'AI_BOT';
    
    (match as any).botIsPlayer2 = isBot2;
    (match as any).gameType = gameType;
    (match.player1 as any).socketId = p1.socketId;
    (match.player2 as any).socketId = p2.socketId;
    
    this.activeMatches.set(match.matchId, match);
    this.playerToMatchMap.set(p1.userId, match.matchId);
    if (!isBot2) {
      this.playerToMatchMap.set(p2.userId, match.matchId);
    }

    io.to(p1.socketId).emit('matchFound', { matchId: match.matchId, gameType });
    if (!isBot2) {
      io.to(p2.socketId).emit('matchFound', { matchId: match.matchId, gameType });
    }

    // Start game loop
    this.startGameLoop(match.matchId, io);
  }

  private startGameLoop(matchId: string, io: SocketIOServer): void {
    const interval = setInterval(() => {
      const match = this.activeMatches.get(matchId);
      if (!match) {
        clearInterval(interval);
        this.gameLoops.delete(matchId);
        return;
      }

      const gameType = (match as any).gameType || 'pong';
      const controller = gameControllers[gameType];
      
      if (controller.updateGame) {
        controller.updateGame(match);
      }

      if (controller.updateBotAI && (match as any).botIsPlayer2) {
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

    const gameType = (match as any).gameType || 'pong';
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

    // Credit settlement
    const player1 = await storage.getUser(match.player1.id);
    const player2 = !isBot2 ? await storage.getUser(match.player2.id) : null;

    if (!player1) return;

    const isPlayer1Winner = winnerId === match.player1.id;
    const player1NewCredits = isPlayer1Winner ? player1.credits + 1.6 : player1.credits;
    const player2NewCredits = isBot2 ? 0 : (isPlayer1Winner ? player2!.credits : player2!.credits + 1.6);

    await storage.updateUserCredits(match.player1.id, player1NewCredits);
    if (!isBot2 && player2) {
      await storage.updateUserCredits(match.player2.id, player2NewCredits);
    }

    await storage.updateUserStats(match.player1.id, {
      matchesPlayed: player1.matchesPlayed + 1,
      wins: isPlayer1Winner ? player1.wins + 1 : player1.wins,
      losses: isPlayer1Winner ? player1.losses : player1.losses + 1,
      totalEarnings: isPlayer1Winner ? player1.totalEarnings + 1.6 : player1.totalEarnings,
    });

    if (!isBot2 && player2) {
      await storage.updateUserStats(match.player2.id, {
        matchesPlayed: player2.matchesPlayed + 1,
        wins: isPlayer1Winner ? player2.wins : player2.wins + 1,
        losses: isPlayer1Winner ? player2.losses + 1 : player2.losses,
        totalEarnings: isPlayer1Winner ? player2.totalEarnings : player2.totalEarnings + 1.6,
      });
    }

    await storage.createMatch({
      gameType,
      player1Id: match.player1.id,
      player2Id: isBot2 ? 'AI_BOT' : match.player2.id,
      player1Name: player1.name,
      player2Name: isBot2 ? 'AI Bot' : player2!.name,
      winnerId,
      winnerName: isPlayer1Winner ? player1.name : (isBot2 ? 'AI Bot' : player2!.name),
      player1Score: match.player1.score || 0,
      player2Score: match.player2.score || 0,
      creditsBurned: 0.4,
    });

    await storage.addActionLog({
      userId: winnerId === 'AI_BOT' ? null : winnerId,
      userName: isPlayer1Winner ? player1.name : (isBot2 ? 'AI Bot' : player2!.name),
      type: 'match',
      message: `${isPlayer1Winner ? player1.name : (isBot2 ? 'AI Bot' : player2!.name)} won at ${gameType.toUpperCase()}!`,
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
