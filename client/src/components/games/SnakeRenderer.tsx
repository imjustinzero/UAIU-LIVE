import { useEffect, useRef } from "react";

interface SnakeGameState {
  matchId: string;
  gameType: 'snake';
  player1: {
    id: string;
    name: string;
    score: number;
    gameData: {
      snake: { x: number; y: number }[];
      direction: string;
      alive: boolean;
    };
  };
  player2: {
    id: string;
    name: string;
    score: number;
    gameData: {
      snake: { x: number; y: number }[];
      direction: string;
      alive: boolean;
    };
  };
  food: { x: number; y: number }[];
  status: string;
  winner?: string;
}

interface SnakeRendererProps {
  gameState: SnakeGameState | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const GRID_SIZE = 20;
const GRID_WIDTH = 30;
const GRID_HEIGHT = 40;
const CANVAS_WIDTH = GRID_WIDTH * GRID_SIZE;
const CANVAS_HEIGHT = GRID_HEIGHT * GRID_SIZE;

export function SnakeRenderer({ gameState, canvasRef }: SnakeRendererProps) {
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

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      for (let x = 0; x <= GRID_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * GRID_SIZE, 0);
        ctx.lineTo(x * GRID_SIZE, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= GRID_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * GRID_SIZE);
        ctx.lineTo(CANVAS_WIDTH, y * GRID_SIZE);
        ctx.stroke();
      }

      gameState.food.forEach(food => {
        const gradient = ctx.createRadialGradient(
          food.x * GRID_SIZE + GRID_SIZE / 2,
          food.y * GRID_SIZE + GRID_SIZE / 2,
          0,
          food.x * GRID_SIZE + GRID_SIZE / 2,
          food.y * GRID_SIZE + GRID_SIZE / 2,
          GRID_SIZE / 2
        );
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(1, '#cc0000');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(
          food.x * GRID_SIZE + GRID_SIZE / 2,
          food.y * GRID_SIZE + GRID_SIZE / 2,
          GRID_SIZE / 2.5,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      const drawSnake = (snake: { x: number; y: number }[], color: string, isAlive: boolean) => {
        snake.forEach((segment, i) => {
          const alpha = isAlive ? (1 - i * 0.02) : 0.3;
          ctx.fillStyle = i === 0 ? color : `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.fillRect(
            segment.x * GRID_SIZE + 1,
            segment.y * GRID_SIZE + 1,
            GRID_SIZE - 2,
            GRID_SIZE - 2
          );
          if (i === 0) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(
              segment.x * GRID_SIZE + 1,
              segment.y * GRID_SIZE + 1,
              GRID_SIZE - 2,
              GRID_SIZE - 2
            );
          }
        });
      };

      drawSnake(gameState.player1.gameData.snake, '#00ff41', gameState.player1.gameData.alive);
      drawSnake(gameState.player2.gameData.snake, '#00f0ff', gameState.player2.gameData.alive);

      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 32px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(gameState.player1.score.toString(), 20, CANVAS_HEIGHT - 20);

      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'right';
      ctx.fillText(gameState.player2.score.toString(), CANVAS_WIDTH - 20, 40);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(gameState.player1.name, 20, CANVAS_HEIGHT - 50);
      ctx.textAlign = 'right';
      ctx.fillText(gameState.player2.name, CANVAS_WIDTH - 20, 70);

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

export const SNAKE_CANVAS_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
