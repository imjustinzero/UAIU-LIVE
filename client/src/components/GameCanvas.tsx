import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RotateCw } from "lucide-react";
import { PongRenderer, PONG_CANVAS_CONFIG } from "@/components/games/PongRenderer";
import { SnakeRenderer, SNAKE_CANVAS_CONFIG } from "@/components/games/SnakeRenderer";
import { TetrisRenderer, TETRIS_CANVAS_CONFIG } from "@/components/games/TetrisRenderer";
import { BreakoutRenderer, BREAKOUT_CANVAS_CONFIG } from "@/components/games/BreakoutRenderer";
import { FlappyBirdRenderer, FLAPPYBIRD_CANVAS_CONFIG } from "@/components/games/FlappyBirdRenderer";
import { Connect4Renderer, CONNECT4_CANVAS_CONFIG } from "@/components/games/Connect4Renderer";

interface GameCanvasProps {
  socket: any;
  userId: string | null;
  matchId: string | null;
  gameType: string | null;
  onMatchStart?: () => void;
  onMatchEnd?: () => void;
}

export function GameCanvas({ socket, userId, matchId, gameType, onMatchStart, onMatchEnd }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<any | null>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const gameStateRef = useRef<any | null>(null);

  useEffect(() => {
    console.log('[GameCanvas] Mounted with:', { userId, matchId, gameType, hasSocket: !!socket });
    if (!socket) return;

    socket.on('gameState', (state: any) => {
      console.log('[GameCanvas] 🎮 Received gameState:', state?.status, state?.gameType);
      gameStateRef.current = state;
      setGameState(state);
      if (state.status === 'playing' && onMatchStart) {
        onMatchStart();
      }
      if (state.status === 'finished' && onMatchEnd) {
        onMatchEnd();
      }
    });

    return () => {
      console.log('[GameCanvas] Unmounting');
      socket.off('gameState');
    };
  }, [socket, onMatchStart, onMatchEnd]);

  const getCanvasConfig = () => {
    switch (gameType) {
      case 'pong':
        return PONG_CANVAS_CONFIG;
      case 'snake':
        return SNAKE_CANVAS_CONFIG;
      case 'tetris':
        return TETRIS_CANVAS_CONFIG;
      case 'breakout':
        return BREAKOUT_CANVAS_CONFIG;
      case 'flappybird':
        return FLAPPYBIRD_CANVAS_CONFIG;
      case 'connect4':
        return CONNECT4_CANVAS_CONFIG;
      default:
        return PONG_CANVAS_CONFIG;
    }
  };

  const config = getCanvasConfig();

  const handleInput = (input: any) => {
    console.log('[GameCanvas] handleInput called:', { input, hasSocket: !!socket, userId, matchId, gameState: gameState?.status });
    if (!socket || !userId || !matchId || !gameState || gameState.status !== 'playing') {
      console.log('[GameCanvas] ❌ Input blocked:', { 
        hasSocket: !!socket, 
        hasUserId: !!userId, 
        hasMatchId: !!matchId, 
        hasGameState: !!gameState, 
        status: gameState?.status 
      });
      return;
    }
    console.log('[GameCanvas] ✅ Emitting gameInput:', { matchId, input });
    socket.emit('gameInput', { matchId, input });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (pressedKeys.has(e.key)) return;

    if (gameType === 'pong') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setPressedKeys(prev => new Set(prev).add(e.key));
        handleInput({ direction: 'left' });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setPressedKeys(prev => new Set(prev).add(e.key));
        handleInput({ direction: 'right' });
      }
    } else if (gameType === 'snake') {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        handleInput({ direction: 'up' });
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handleInput({ direction: 'down' });
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleInput({ direction: 'left' });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleInput({ direction: 'right' });
      }
    } else if (gameType === 'tetris') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleInput({ direction: 'left' });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleInput({ direction: 'right' });
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handleInput({ direction: 'down' });
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        handleInput({ direction: 'rotate' });
      }
    } else if (gameType === 'breakout') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setPressedKeys(prev => new Set(prev).add(e.key));
        handleInput({ direction: 'left' });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setPressedKeys(prev => new Set(prev).add(e.key));
        handleInput({ direction: 'right' });
      }
    } else if (gameType === 'flappybird') {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        handleInput({ action: 'jump' });
      }
    } else if (gameType === 'connect4') {
      const numKey = parseInt(e.key);
      if (numKey >= 1 && numKey <= 7) {
        handleInput({ column: numKey - 1 });
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (gameType === 'pong') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setPressedKeys(prev => {
          const next = new Set(prev);
          next.delete(e.key);
          return next;
        });
        handleInput({ direction: 'stop' });
      }
    } else if (gameType === 'breakout') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setPressedKeys(prev => {
          const next = new Set(prev);
          next.delete(e.key);
          return next;
        });
        handleInput({ direction: 'stop' });
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [socket, userId, gameType, gameState, pressedKeys]);

  const renderControls = () => {
    if (gameType === 'snake') {
      return (
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          <div />
          <Button
            size="lg"
            className="h-20 text-xl font-bold"
            onClick={() => handleInput({ direction: 'up' })}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-snake-up"
          >
            <ChevronUp className="w-10 h-10" />
          </Button>
          <div />
          <Button
            size="lg"
            className="h-20 text-xl font-bold"
            onClick={() => handleInput({ direction: 'left' })}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-snake-left"
          >
            <ChevronLeft className="w-10 h-10" />
          </Button>
          <Button
            size="lg"
            className="h-20 text-xl font-bold"
            onClick={() => handleInput({ direction: 'down' })}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-snake-down"
          >
            <ChevronDown className="w-10 h-10" />
          </Button>
          <Button
            size="lg"
            className="h-20 text-xl font-bold"
            onClick={() => handleInput({ direction: 'right' })}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-snake-right"
          >
            <ChevronRight className="w-10 h-10" />
          </Button>
        </div>
      );
    } else if (gameType === 'tetris') {
      return (
        <div className="flex flex-col gap-2 w-full max-w-md">
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="lg"
              className="h-16 text-xl font-bold"
              onClick={() => handleInput({ direction: 'left' })}
              disabled={!gameState || gameState.status !== 'playing'}
              data-testid="button-tetris-left"
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
            <Button
              size="lg"
              className="h-16 text-xl font-bold"
              onClick={() => handleInput({ direction: 'rotate' })}
              disabled={!gameState || gameState.status !== 'playing'}
              data-testid="button-tetris-rotate"
            >
              <RotateCw className="w-8 h-8" />
            </Button>
            <Button
              size="lg"
              className="h-16 text-xl font-bold"
              onClick={() => handleInput({ direction: 'right' })}
              disabled={!gameState || gameState.status !== 'playing'}
              data-testid="button-tetris-right"
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          </div>
          <Button
            size="lg"
            className="h-16 text-xl font-bold"
            onClick={() => handleInput({ direction: 'down' })}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-tetris-down"
          >
            <ChevronDown className="w-8 h-8" />
          </Button>
        </div>
      );
    } else if (gameType === 'pong') {
      return (
        <div className="flex gap-4 w-full max-w-md">
          <Button
            size="lg"
            className="flex-1 h-20 text-xl font-bold touch-none select-none"
            onMouseDown={() => {
              setPressedKeys(prev => new Set(prev).add('left'));
              handleInput({ direction: 'left' });
            }}
            onMouseUp={() => {
              setPressedKeys(prev => { const next = new Set(prev); next.delete('left'); return next; });
              handleInput({ direction: 'stop' });
            }}
            onMouseLeave={() => {
              if (pressedKeys.has('left')) {
                setPressedKeys(prev => { const next = new Set(prev); next.delete('left'); return next; });
                handleInput({ direction: 'stop' });
              }
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => new Set(prev).add('left'));
              handleInput({ direction: 'left' });
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => { const next = new Set(prev); next.delete('left'); return next; });
              handleInput({ direction: 'stop' });
            }}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-paddle-left"
          >
            <ChevronLeft className="w-10 h-10" />
          </Button>
          <Button
            size="lg"
            className="flex-1 h-20 text-xl font-bold touch-none select-none"
            onMouseDown={() => {
              setPressedKeys(prev => new Set(prev).add('right'));
              handleInput({ direction: 'right' });
            }}
            onMouseUp={() => {
              setPressedKeys(prev => { const next = new Set(prev); next.delete('right'); return next; });
              handleInput({ direction: 'stop' });
            }}
            onMouseLeave={() => {
              if (pressedKeys.has('right')) {
                setPressedKeys(prev => { const next = new Set(prev); next.delete('right'); return next; });
                handleInput({ direction: 'stop' });
              }
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => new Set(prev).add('right'));
              handleInput({ direction: 'right' });
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => { const next = new Set(prev); next.delete('right'); return next; });
              handleInput({ direction: 'stop' });
            }}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-paddle-right"
          >
            <ChevronRight className="w-10 h-10" />
          </Button>
        </div>
      );
    } else if (gameType === 'breakout') {
      return (
        <div className="flex gap-4 w-full max-w-md">
          <Button
            size="lg"
            className="flex-1 h-20 text-xl font-bold touch-none select-none"
            onMouseDown={() => {
              setPressedKeys(prev => new Set(prev).add('left'));
              handleInput({ direction: 'left' });
            }}
            onMouseUp={() => {
              setPressedKeys(prev => { const next = new Set(prev); next.delete('left'); return next; });
              handleInput({ direction: 'stop' });
            }}
            onMouseLeave={() => {
              if (pressedKeys.has('left')) {
                setPressedKeys(prev => { const next = new Set(prev); next.delete('left'); return next; });
                handleInput({ direction: 'stop' });
              }
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => new Set(prev).add('left'));
              handleInput({ direction: 'left' });
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => { const next = new Set(prev); next.delete('left'); return next; });
              handleInput({ direction: 'stop' });
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => { const next = new Set(prev); next.delete('left'); return next; });
              handleInput({ direction: 'stop' });
            }}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-breakout-left"
          >
            <ChevronLeft className="w-10 h-10" />
          </Button>
          <Button
            size="lg"
            className="flex-1 h-20 text-xl font-bold touch-none select-none"
            onMouseDown={() => {
              setPressedKeys(prev => new Set(prev).add('right'));
              handleInput({ direction: 'right' });
            }}
            onMouseUp={() => {
              setPressedKeys(prev => { const next = new Set(prev); next.delete('right'); return next; });
              handleInput({ direction: 'stop' });
            }}
            onMouseLeave={() => {
              if (pressedKeys.has('right')) {
                setPressedKeys(prev => { const next = new Set(prev); next.delete('right'); return next; });
                handleInput({ direction: 'stop' });
              }
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => new Set(prev).add('right'));
              handleInput({ direction: 'right' });
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => { const next = new Set(prev); next.delete('right'); return next; });
              handleInput({ direction: 'stop' });
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPressedKeys(prev => { const next = new Set(prev); next.delete('right'); return next; });
              handleInput({ direction: 'stop' });
            }}
            disabled={!gameState || gameState.status !== 'playing'}
            data-testid="button-breakout-right"
          >
            <ChevronRight className="w-10 h-10" />
          </Button>
        </div>
      );
    } else if (gameType === 'flappybird') {
      return (
        <Button
          size="lg"
          className="w-full max-w-md h-20 text-2xl font-bold"
          onClick={() => handleInput({ action: 'jump' })}
          disabled={!gameState || gameState.status !== 'playing'}
          data-testid="button-flappybird-jump"
        >
          <ChevronUp className="w-10 h-10" />
        </Button>
      );
    } else if (gameType === 'connect4') {
      const myTurn = gameState && gameState.currentTurn === userId;
      return (
        <div className="w-full max-w-md">
          <div className="text-center mb-2 text-white">
            {myTurn ? <span className="text-primary font-bold">Your Turn!</span> : <span className="opacity-60">Opponent's Turn</span>}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((col) => (
              <Button
                key={col}
                size="lg"
                className="h-16 text-xl font-bold"
                onClick={() => handleInput({ column: col })}
                disabled={!gameState || gameState.status !== 'playing' || !myTurn}
                data-testid={`button-connect4-col-${col}`}
              >
                {col + 1}
              </Button>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={config.width}
          height={config.height}
          className="border-2 border-primary rounded-lg shadow-[0_0_30px_rgba(0,255,65,0.3)] max-w-full h-auto"
          style={{ aspectRatio: `${config.width}/${config.height}` }}
          data-testid="game-canvas"
        />
        {gameType === 'pong' && <PongRenderer gameState={gameState} canvasRef={canvasRef} userId={userId} />}
        {gameType === 'snake' && <SnakeRenderer gameState={gameState} canvasRef={canvasRef} />}
        {gameType === 'tetris' && <TetrisRenderer gameState={gameState} canvasRef={canvasRef} />}
        {gameType === 'breakout' && <BreakoutRenderer gameState={gameState} canvasRef={canvasRef} userId={userId} />}
        {gameType === 'flappybird' && <FlappyBirdRenderer gameState={gameState} canvasRef={canvasRef} />}
        {gameType === 'connect4' && <Connect4Renderer gameState={gameState} canvasRef={canvasRef} />}
        {gameState?.status === 'finished' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <h3 className="text-4xl font-display font-bold mb-4 text-white">
                {gameState.winner === userId ? 'VICTORY!' : 'DEFEAT'}
              </h3>
              <p className="text-xl text-white/80">
                {gameState.winner === userId ? '+1.6 Credits (Net +0.6)' : '-1 Credit'}
              </p>
            </div>
          </div>
        )}
      </div>

      {renderControls()}
    </div>
  );
}
