import { useEffect, useRef } from "react";

interface BreakoutPlayer {
  paddleX: number;
  ball: { x: number; y: number; vx: number; vy: number };
  bricks: boolean[][];
  lives: number;
}

interface BreakoutGameState {
  matchId: string;
  gameType: 'breakout';
  player1: {
    id: string;
    name: string;
    score: number;
    gameData: BreakoutPlayer;
  };
  player2: {
    id: string;
    name: string;
    score: number;
    gameData: BreakoutPlayer;
  };
  status: string;
  winner?: string;
}

interface BreakoutRendererProps {
  gameState: BreakoutGameState | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_SIZE = 10;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;

export function BreakoutRenderer({ gameState, canvasRef }: BreakoutRendererProps) {
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (!gameState) {
        ctx.fillStyle = '#00ff41';
        ctx.font = 'bold 24px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for match...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const brickWidth = CANVAS_WIDTH / BRICK_COLS;
      const brickHeight = 20;
      const player = gameState.player1;

      for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
          if (player.gameData.bricks[row][col]) {
            const x = col * brickWidth;
            const y = row * brickHeight + 50;
            
            const hue = (row / BRICK_ROWS) * 120;
            const gradient = ctx.createLinearGradient(x, y, x + brickWidth, y + brickHeight);
            gradient.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 35%)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 2, y + 2, brickWidth - 4, brickHeight - 4);
            
            ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, brickWidth - 4, brickHeight - 4);
          }
        }
      }

      const paddleY = CANVAS_HEIGHT - 30;
      const gradient = ctx.createLinearGradient(
        player.gameData.paddleX, paddleY,
        player.gameData.paddleX + PADDLE_WIDTH, paddleY + PADDLE_HEIGHT
      );
      gradient.addColorStop(0, '#00ff41');
      gradient.addColorStop(1, '#00cc33');
      ctx.fillStyle = gradient;
      ctx.fillRect(player.gameData.paddleX, paddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
      
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.strokeRect(player.gameData.paddleX, paddleY, PADDLE_WIDTH, PADDLE_HEIGHT);

      const ball = player.gameData.ball;
      const ballGradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_SIZE);
      ballGradient.addColorStop(0, '#fff');
      ballGradient.addColorStop(0.5, '#00ff41');
      ballGradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
      ctx.fillStyle = ballGradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_SIZE, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 32px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${player.score}`, 20, 35);
      ctx.fillText(`Lives: ${player.gameData.lives}`, 20, CANVAS_HEIGHT - 10);
      
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 20px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Opponent: ${gameState.player2.score}`, CANVAS_WIDTH - 20, 35);

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

export const BREAKOUT_CANVAS_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
