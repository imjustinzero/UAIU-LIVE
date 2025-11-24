import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GameState } from "@shared/schema";

interface GameCanvasProps {
  socket: any;
  userId: string | null;
  onMatchStart?: () => void;
  onMatchEnd?: () => void;
}

export function GameCanvas({ socket, userId, onMatchStart, onMatchEnd }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;

    socket.on('gameState', (state: GameState) => {
      setGameState(state);
      if (state.status === 'playing' && onMatchStart) {
        onMatchStart();
      }
      if (state.status === 'finished' && onMatchEnd) {
        onMatchEnd();
      }
    });

    return () => {
      socket.off('gameState');
    };
  }, [socket, onMatchStart, onMatchEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CANVAS_WIDTH = 600;
    const CANVAS_HEIGHT = 800;
    const PADDLE_WIDTH = 100;
    const PADDLE_HEIGHT = 15;
    const BALL_SIZE = 12;

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

    const player1Y = CANVAS_HEIGHT - 40;
    const player2Y = 40;
    
    drawPaddle(gameState.player1.y, player1Y, true);
    drawPaddle(gameState.player2.y, player2Y, false);

    const gradient = ctx.createRadialGradient(
      gameState.ball.x, gameState.ball.y, 0,
      gameState.ball.x, gameState.ball.y, BALL_SIZE
    );
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.5, '#00ff41');
    gradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, BALL_SIZE, 0, Math.PI * 2);
    ctx.fill();

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

  }, [gameState]);

  const handlePaddleMove = (direction: 'left' | 'right', action: 'press' | 'release') => {
    if (!socket || !userId) return;
    
    if (action === 'press') {
      setPressedKeys(prev => new Set(prev).add(direction));
      socket.emit('paddleMove', { direction });
    } else {
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(direction);
        return next;
      });
      socket.emit('paddleMove', { direction: 'stop' });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handlePaddleMove('left', 'press');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handlePaddleMove('right', 'press');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handlePaddleMove('left', 'release');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handlePaddleMove('right', 'release');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [socket, userId]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={800}
          className="border-2 border-primary rounded-lg shadow-[0_0_30px_rgba(0,255,65,0.3)] max-w-full h-auto"
          style={{ aspectRatio: '600/800' }}
        />
        {gameState?.status === 'finished' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <h3 className="text-4xl font-display font-bold mb-4 text-white">
                {gameState.winner === userId ? 'VICTORY!' : 'DEFEAT'}
              </h3>
              <p className="text-xl text-white/80">
                {gameState.winner === userId ? '+1.6 Credits' : '-1 Credit'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 w-full max-w-md">
        <Button
          size="lg"
          className="flex-1 h-16 text-xl font-bold"
          onMouseDown={() => handlePaddleMove('left', 'press')}
          onMouseUp={() => handlePaddleMove('left', 'release')}
          onMouseLeave={() => pressedKeys.has('left') && handlePaddleMove('left', 'release')}
          onTouchStart={(e) => { e.preventDefault(); handlePaddleMove('left', 'press'); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePaddleMove('left', 'release'); }}
          disabled={!gameState || gameState.status !== 'playing'}
          data-testid="button-paddle-left"
        >
          <ChevronLeft className="w-8 h-8 mr-2" />
          LEFT
        </Button>
        <Button
          size="lg"
          className="flex-1 h-16 text-xl font-bold"
          onMouseDown={() => handlePaddleMove('right', 'press')}
          onMouseUp={() => handlePaddleMove('right', 'release')}
          onMouseLeave={() => pressedKeys.has('right') && handlePaddleMove('right', 'release')}
          onTouchStart={(e) => { e.preventDefault(); handlePaddleMove('right', 'press'); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePaddleMove('right', 'release'); }}
          disabled={!gameState || gameState.status !== 'playing'}
          data-testid="button-paddle-right"
        >
          RIGHT
          <ChevronRight className="w-8 h-8 ml-2" />
        </Button>
      </div>
    </div>
  );
}
