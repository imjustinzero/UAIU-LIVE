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
  userId: string | null;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_SIZE = 12;

export function PongRenderer({ gameState, canvasRef, userId }: PongRendererProps) {
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

      const isPlayer1 = gameState.player1.id === userId;
      const player = isPlayer1 ? gameState.player1 : gameState.player2;
      const opponent = isPlayer1 ? gameState.player2 : gameState.player1;

      const myPaddleY = CANVAS_HEIGHT - 40;
      const opponentPaddleY = 40;
      
      drawPaddle(player.gameData.paddleX, myPaddleY, true);
      drawPaddle(opponent.gameData.paddleX, opponentPaddleY, false);

      const ballX = isPlayer1 ? gameState.ball.x : CANVAS_WIDTH - gameState.ball.x;
      const ballY = isPlayer1 ? gameState.ball.y : CANVAS_HEIGHT - gameState.ball.y;

      const ballGradient = ctx.createRadialGradient(
        ballX, ballY, 0,
        ballX, ballY, BALL_SIZE
      );
      ballGradient.addColorStop(0, '#fff');
      ballGradient.addColorStop(0.4, '#00ff41');
      ballGradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
      ctx.fillStyle = ballGradient;
      ctx.beginPath();
      ctx.arc(ballX, ballY, BALL_SIZE, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff41';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 48px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(player.score.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100);
      
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(opponent.score.toString(), CANVAS_WIDTH / 2, 100);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(player.name, 20, CANVAS_HEIGHT - 20);
      ctx.textAlign = 'right';
      ctx.fillText(opponent.name, CANVAS_WIDTH - 20, 30);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, canvasRef, userId]);

  return null;
}

export const PONG_CANVAS_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
