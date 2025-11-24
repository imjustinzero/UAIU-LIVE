import { useEffect, useRef } from "react";

interface FlappyPlayer {
  y: number;
  velocity: number;
  alive: boolean;
}

interface FlappyBirdGameState {
  matchId: string;
  gameType: 'flappybird';
  player1: {
    id: string;
    name: string;
    score: number;
    gameData: FlappyPlayer;
  };
  player2: {
    id: string;
    name: string;
    score: number;
    gameData: FlappyPlayer;
  };
  pipes: { x: number; gap: number; passed: boolean }[];
  status: string;
  winner?: string;
}

interface FlappyBirdRendererProps {
  gameState: FlappyBirdGameState | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BIRD_SIZE = 30;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;

export function FlappyBirdRenderer({ gameState, canvasRef }: FlappyBirdRendererProps) {
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

      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      gameState.pipes.forEach(pipe => {
        ctx.fillStyle = '#228B22';
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gap - PIPE_GAP / 2);
        ctx.fillRect(pipe.x, pipe.gap + PIPE_GAP / 2, PIPE_WIDTH, CANVAS_HEIGHT - (pipe.gap + PIPE_GAP / 2));
        
        ctx.strokeStyle = '#1a6b1a';
        ctx.lineWidth = 3;
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.gap - PIPE_GAP / 2);
        ctx.strokeRect(pipe.x, pipe.gap + PIPE_GAP / 2, PIPE_WIDTH, CANVAS_HEIGHT - (pipe.gap + PIPE_GAP / 2));
      });

      const drawBird = (y: number, alive: boolean, color: string, x: number) => {
        if (!alive) {
          ctx.globalAlpha = 0.3;
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y + BIRD_SIZE / 2, BIRD_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + 5, y + BIRD_SIZE / 2 - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x + 7, y + BIRD_SIZE / 2 - 5, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1;
      };

      drawBird(gameState.player1.gameData.y, gameState.player1.gameData.alive, '#00ff41', 50);
      drawBird(gameState.player2.gameData.y, gameState.player2.gameData.alive, '#00f0ff', 100);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(10, 10, 180, 70);
      ctx.fillRect(CANVAS_WIDTH - 190, 10, 180, 70);

      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 24px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(gameState.player1.name, 20, 35);
      ctx.font = 'bold 32px JetBrains Mono, monospace';
      ctx.fillText(gameState.player1.score.toString(), 20, 70);
      
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'right';
      ctx.font = 'bold 24px JetBrains Mono, monospace';
      ctx.fillText(gameState.player2.name, CANVAS_WIDTH - 20, 35);
      ctx.font = 'bold 32px JetBrains Mono, monospace';
      ctx.fillText(gameState.player2.score.toString(), CANVAS_WIDTH - 20, 70);


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

export const FLAPPYBIRD_CANVAS_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
