import { useEffect, useRef } from "react";

interface TetrisGameState {
  matchId: string;
  gameType: 'tetris';
  player1: {
    id: string;
    name: string;
    score: number;
    gameData: {
      board: number[][];
      currentPiece: {
        shape: number[][];
        x: number;
        y: number;
        type: number;
      } | null;
      nextPiece: {
        shape: number[][];
        type: number;
      };
      linesCleared: number;
      gameOver: boolean;
    };
  };
  player2: {
    id: string;
    name: string;
    score: number;
    gameData: {
      board: number[][];
      currentPiece: {
        shape: number[][];
        x: number;
        y: number;
        type: number;
      } | null;
      nextPiece: {
        shape: number[][];
        type: number;
      };
      linesCleared: number;
      gameOver: boolean;
    };
  };
  status: string;
  winner?: string;
}

interface TetrisRendererProps {
  gameState: TetrisGameState | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const BLOCK_SIZE = 25;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const PREVIEW_SIZE = 4;
const PADDING = 20;
const CANVAS_WIDTH = BOARD_WIDTH * BLOCK_SIZE * 2 + PADDING * 3;
const CANVAS_HEIGHT = BOARD_HEIGHT * BLOCK_SIZE + PADDING * 2;

const COLORS = [
  '#000000',
  '#00f0ff',
  '#ffff00',
  '#ff00ff',
  '#00ff00',
  '#ff0000',
  '#0000ff',
  '#ff8800',
];

export function TetrisRenderer({ gameState, canvasRef }: TetrisRendererProps) {
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const drawBoard = (board: number[][], offsetX: number, offsetY: number, alpha: number = 1) => {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetX, offsetY, BOARD_WIDTH * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);

      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          const type = board[y][x];
          if (type > 0) {
            ctx.fillStyle = COLORS[type] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.fillRect(
              offsetX + x * BLOCK_SIZE + 1,
              offsetY + y * BLOCK_SIZE + 1,
              BLOCK_SIZE - 2,
              BLOCK_SIZE - 2
            );
          }
        }
      }
    };

    const drawPiece = (piece: any, offsetX: number, offsetY: number, alpha: number = 1) => {
      if (!piece) return;
      const { shape, x, y, type } = piece;
      ctx.fillStyle = COLORS[type] + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
          if (shape[py][px]) {
            ctx.fillRect(
              offsetX + (x + px) * BLOCK_SIZE + 1,
              offsetY + (y + py) * BLOCK_SIZE + 1,
              BLOCK_SIZE - 2,
              BLOCK_SIZE - 2
            );
          }
        }
      }
    };

    const render = () => {
      if (!gameState) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, 0);
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      const board1X = PADDING;
      const board2X = BOARD_WIDTH * BLOCK_SIZE + PADDING * 2;
      const boardY = PADDING;

      const alpha1 = gameState.player1.gameData.gameOver ? 0.5 : 1;
      const alpha2 = gameState.player2.gameData.gameOver ? 0.5 : 1;

      drawBoard(gameState.player1.gameData.board, board1X, boardY, alpha1);
      drawPiece(gameState.player1.gameData.currentPiece, board1X, boardY, alpha1);

      drawBoard(gameState.player2.gameData.board, board2X, boardY, alpha2);
      drawPiece(gameState.player2.gameData.currentPiece, board2X, boardY, alpha2);

      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 18px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(gameState.player1.score.toString(), board1X + (BOARD_WIDTH * BLOCK_SIZE) / 2, CANVAS_HEIGHT - 10);
      ctx.fillText(`Lines: ${gameState.player1.gameData.linesCleared}`, board1X + (BOARD_WIDTH * BLOCK_SIZE) / 2, CANVAS_HEIGHT - 30);

      ctx.fillStyle = '#00f0ff';
      ctx.fillText(gameState.player2.score.toString(), board2X + (BOARD_WIDTH * BLOCK_SIZE) / 2, CANVAS_HEIGHT - 10);
      ctx.fillText(`Lines: ${gameState.player2.gameData.linesCleared}`, board2X + (BOARD_WIDTH * BLOCK_SIZE) / 2, CANVAS_HEIGHT - 30);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gameState.player1.name, board1X + (BOARD_WIDTH * BLOCK_SIZE) / 2, 15);
      ctx.fillText(gameState.player2.name, board2X + (BOARD_WIDTH * BLOCK_SIZE) / 2, 15);

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

export const TETRIS_CANVAS_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};
