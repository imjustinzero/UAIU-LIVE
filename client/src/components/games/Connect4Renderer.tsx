import { useEffect, useRef } from "react";

interface Connect4Player {
  color: number;
}

interface Connect4GameState {
  matchId: string;
  gameType: 'connect4';
  board: number[][];
  currentTurn: string;
  player1: {
    id: string;
    name: string;
    score: number;
    gameData: Connect4Player;
  };
  player2: {
    id: string;
    name: string;
    score: number;
    gameData: Connect4Player;
  };
  status: string;
  winner?: string;
}

interface Connect4RendererProps {
  gameState: Connect4GameState | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 480;
const COLS = 7;
const ROWS = 6;
const CELL_SIZE = 70;
const PADDING = 35;

export function Connect4Renderer({ gameState, canvasRef }: Connect4RendererProps) {
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = () => {
      if (!gameState) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#0f3460';
      ctx.fillRect(PADDING - 10, PADDING - 10, COLS * CELL_SIZE + 20, ROWS * CELL_SIZE + 20);

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const x = PADDING + col * CELL_SIZE;
          const y = PADDING + row * CELL_SIZE;
          
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 5, 0, Math.PI * 2);
          ctx.fill();

          const cellValue = gameState.board[row][col];
          if (cellValue !== 0) {
            const gradient = ctx.createRadialGradient(
              x + CELL_SIZE / 2, y + CELL_SIZE / 2, 0,
              x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 10
            );
            
            if (cellValue === 1) {
              gradient.addColorStop(0, '#00ff41');
              gradient.addColorStop(1, '#00cc33');
            } else {
              gradient.addColorStop(0, '#00f0ff');
              gradient.addColorStop(1, '#00a0cc');
            }
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      const isPlayer1Turn = gameState.currentTurn === gameState.player1.id;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
      
      ctx.fillStyle = isPlayer1Turn ? '#00ff41' : '#00f0ff';
      ctx.font = 'bold 24px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isPlayer1Turn ? `${gameState.player1.name}'s Turn` : `${gameState.player2.name}'s Turn`, CANVAS_WIDTH / 2, 32);
      
      if (gameState.status === 'finished' && gameState.winner) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, CANVAS_HEIGHT / 2 - 40, CANVAS_WIDTH, 80);
        
        const winnerName = gameState.winner === gameState.player1.id ? gameState.player1.name : gameState.player2.name;
        ctx.fillStyle = gameState.winner === gameState.player1.id ? '#00ff41' : '#00f0ff';
        ctx.font = 'bold 36px JetBrains Mono, monospace';
        ctx.fillText(`${winnerName} WINS!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      }

      ctx.fillStyle = '#00ff41';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(gameState.player1.name, 10, CANVAS_HEIGHT - 10);
      
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'right';
      ctx.fillText(gameState.player2.name, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 10);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, canvasRef]);

  return null;
}

export const CONNECT4_CANVAS_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
