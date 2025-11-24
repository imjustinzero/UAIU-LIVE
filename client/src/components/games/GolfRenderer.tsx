import { useEffect, useRef } from "react";

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
}

interface GolfGameState {
  matchId: string;
  gameType: 'golf';
  player1: {
    id: string;
    name: string;
    score: number;
    gameData: GolfPlayerData;
  };
  player2: {
    id: string;
    name: string;
    score: number;
    gameData: GolfPlayerData;
  };
  hole: {
    x: number;
    y: number;
  };
  obstacles: Obstacle[];
  currentPlayerId: string;
  status: string;
  winner?: string;
}

interface GolfRendererProps {
  gameState: GolfGameState | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const COURSE_WIDTH = 600;
const COURSE_HEIGHT = 800;
const HOLE_RADIUS = 20;
const BALL_RADIUS = 8;

export const GOLF_CANVAS_CONFIG = {
  width: COURSE_WIDTH,
  height: COURSE_HEIGHT
};

export default function GolfRenderer({ gameState, canvasRef }: GolfRendererProps) {
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawObstacle = (obstacle: Obstacle) => {
      ctx.save();
      
      if (obstacle.type === 'tree') {
        // Tree trunk
        ctx.fillStyle = '#654321';
        ctx.fillRect(obstacle.x - 5, obstacle.y, 10, obstacle.radius);
        
        // Tree foliage
        const gradient = ctx.createRadialGradient(
          obstacle.x, obstacle.y - obstacle.radius / 2, 0,
          obstacle.x, obstacle.y - obstacle.radius / 2, obstacle.radius
        );
        gradient.addColorStop(0, '#228B22');
        gradient.addColorStop(1, '#006400');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y - obstacle.radius / 2, obstacle.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (obstacle.type === 'sand') {
        ctx.fillStyle = '#F4A460';
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DEB887';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (obstacle.type === 'water') {
        const gradient = ctx.createRadialGradient(
          obstacle.x, obstacle.y, 0,
          obstacle.x, obstacle.y, obstacle.radius
        );
        gradient.addColorStop(0, '#4169E1');
        gradient.addColorStop(1, '#1E90FF');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    };

    const drawHole = (x: number, y: number) => {
      // Hole
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      // Flag pole
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 40);
      ctx.stroke();
      
      // Flag
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.moveTo(x, y - 40);
      ctx.lineTo(x + 20, y - 30);
      ctx.lineTo(x, y - 20);
      ctx.closePath();
      ctx.fill();
    };

    const drawBall = (ball: GolfBall, color: string) => {
      const gradient = ctx.createRadialGradient(
        ball.x - 2, ball.y - 2, 0,
        ball.x, ball.y, BALL_RADIUS
      );
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, color);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Ball dimples
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(
            ball.x - 4 + i * 4,
            ball.y - 4 + j * 4,
            0.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    };

    const render = () => {
      if (!gameState) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Fairway background
      const gradient = ctx.createLinearGradient(0, 0, 0, COURSE_HEIGHT);
      gradient.addColorStop(0, '#90EE90');
      gradient.addColorStop(1, '#00FF00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, COURSE_WIDTH, COURSE_HEIGHT);
      
      // Rough edges
      ctx.fillStyle = '#228B22';
      ctx.fillRect(0, 0, 30, COURSE_HEIGHT);
      ctx.fillRect(COURSE_WIDTH - 30, 0, 30, COURSE_HEIGHT);
      ctx.fillRect(0, 0, COURSE_WIDTH, 30);
      ctx.fillRect(0, COURSE_HEIGHT - 30, COURSE_WIDTH, 30);

      // Draw obstacles
      gameState.obstacles.forEach(drawObstacle);

      // Draw hole
      drawHole(gameState.hole.x, gameState.hole.y);

      // Draw balls (always draw, even if finished, so players can see final positions)
      drawBall(gameState.player1.gameData.ball, '#00ff41');
      drawBall(gameState.player2.gameData.ball, '#00f0ff');
      
      // Draw finished indicators
      if (gameState.player1.gameData.finished) {
        ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓ FINISHED', gameState.player1.gameData.ball.x, gameState.player1.gameData.ball.y - 20);
      }
      if (gameState.player2.gameData.finished) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓ FINISHED', gameState.player2.gameData.ball.x, gameState.player2.gameData.ball.y - 20);
      }

      // Draw strokes
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${gameState.player1.name}: ${gameState.player1.gameData.strokes} strokes`, 10, COURSE_HEIGHT - 10);
      
      ctx.textAlign = 'right';
      ctx.fillText(`${gameState.player2.name}: ${gameState.player2.gameData.strokes} strokes`, COURSE_WIDTH - 10, COURSE_HEIGHT - 10);
      
      // Current turn indicator
      if (gameState.status === 'playing') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '16px Inter, sans-serif';
        ctx.textAlign = 'center';
        const currentPlayer = gameState.currentPlayerId === gameState.player1.id 
          ? gameState.player1.name 
          : gameState.player2.name;
        ctx.fillText(`${currentPlayer}'s Turn`, COURSE_WIDTH / 2, 20);
      }

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
