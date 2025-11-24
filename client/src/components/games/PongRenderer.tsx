import { useEffect, useRef } from "react";

interface PongPlayerData {
  paddleX: number;
  paddleVelocity: number;
}

interface PongGameState {
  matchId: string;
  gameType: 'pong';
  player1: {
    id: string;
    name: string;
    score: number;
    gameData: PongPlayerData;
  };
  player2: {
    id: string;
    name: string;
    score: number;
    gameData: PongPlayerData;
  };
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  status: string;
  winner?: string;
}

interface PongRendererProps {
  gameState: PongGameState | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_SIZE = 12;

export function PongRenderer({ gameState, canvasRef }: PongRendererProps) {
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const drawPaddle = (x: number, y: number, isPlayer: boolean) => {
      const gradient = ctx.createLinearGradient(x, y, x + PADDLE_WIDTH, y + PADDLE_HEIGHT);
      gradient.addColorStop(0, isPlayer ? '#00ff41' : '#00f0ff');
      gradient.addColorStop(1, isPlayer ? '#00cc33' : '#00a0cc');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, PADDLE_WIDTH, PADDLE_HEIGHT);
      
      ctx.strokeStyle = isPlayer ? '#00ff41' : '#00f0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, PADDLE_WIDTH, PADDLE_HEIGHT);
    };

    const render = () => {
      if (!gameState || !gameState.ball) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT / 2);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const player1Y = CANVAS_HEIGHT - 40;
      const player2Y = 40;
      
      drawPaddle(gameState.player1.gameData.paddleX, player1Y, true);
      drawPaddle(gameState.player2.gameData.paddleX, player2Y, false);

      const ballGradient = ctx.createRadialGradient(
        gameState.ball.x, gameState.ball.y, 0,
        gameState.ball.x, gameState.ball.y, BALL_SIZE
      );
      ballGradient.addColorStop(0, '#fff');
      ballGradient.addColorStop(0.4, '#00ff41');
      ballGradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
      ctx.fillStyle = ballGradient;
      ctx.beginPath();
      ctx.arc(gameState.ball.x, gameState.ball.y, BALL_SIZE, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff41';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 48px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(gameState.player1.score.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100);
      
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(gameState.player2.score.toString(), CANVAS_WIDTH / 2, 100);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(gameState.player1.name, 20, CANVAS_HEIGHT - 20);
      ctx.textAlign = 'right';
      ctx.fillText(gameState.player2.name, CANVAS_WIDTH - 20, 30);

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

export const PONG_CANVAS_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
