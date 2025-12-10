'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';
import {
  createBoard,
  getRandomTetromino,
  rotateTetromino,
  checkCollision,
  mergeTetromino,
  clearLines,
  calculateScore,
  isGameOver,
  getTetrominoColor
} from '@/utils/tetrisLogic';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from '@/utils/constants';
import type { Board, Tetromino, Position } from '@/utils/tetrisLogic';

interface TetrisGameProps {
  onGameOver?: (score: number) => void;
}

const TetrisGame: React.FC<TetrisGameProps> = ({ onGameOver }) => {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [currentPiece, setCurrentPiece] = useState<Tetromino>(getRandomTetromino());
  const [nextPiece, setNextPiece] = useState<Tetromino>(getRandomTetromino());
  const [position, setPosition] = useState<Position>({ x: 3, y: 0 });
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Farcaster SDK初期化
  useEffect(() => {
    const initFarcaster = async () => {
      try {
        const context = await sdk.context;
        console.log('Farcaster context:', context);
        sdk.actions.ready();
      } catch (error) {
        console.error('Farcaster SDK error:', error);
      }
    };
    initFarcaster();
  }, []);

  // ゲームループ
  useEffect(() => {
    if (gameOver || isPaused || !gameStarted) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const speed = Math.max(100, 1000 - (level - 1) * 50);
    gameLoopRef.current = setInterval(() => {
      moveDown();
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameOver, isPaused, level, gameStarted, board, currentPiece, position]);

  const moveDown = useCallback(() => {
    const newPosition = { x: position.x, y: position.y + 1 };
    if (!checkCollision(board, { ...currentPiece, position: newPosition }, { x: 0, y: 0 })) {
      setPosition(newPosition);
    } else {
      lockPiece();
    }
  }, [board, currentPiece, position]);

  const moveLeft = useCallback(() => {
    const newPosition = { x: position.x - 1, y: position.y };
    if (!checkCollision(board, { ...currentPiece, position: newPosition }, { x: 0, y: 0 })) {
      setPosition(newPosition);
    }
  }, [board, currentPiece, position]);

  const moveRight = useCallback(() => {
    const newPosition = { x: position.x + 1, y: position.y };
    if (!checkCollision(board, { ...currentPiece, position: newPosition }, { x: 0, y: 0 })) {
      setPosition(newPosition);
    }
  }, [board, currentPiece, position]);

  const rotate = useCallback(() => {
    const rotated = rotateTetromino(currentPiece);
    if (!checkCollision(board, { ...rotated, position }, { x: 0, y: 0 })) {
      setCurrentPiece(rotated);
    }
  }, [board, currentPiece, position]);

  const hardDrop = useCallback(() => {
    let newPosition = { ...position };
    while (!checkCollision(board, { ...currentPiece, position: { x: newPosition.x, y: newPosition.y + 1 } }, { x: 0, y: 0 })) {
      newPosition.y++;
    }
    setPosition(newPosition);
    setTimeout(() => lockPiece(), 50);
  }, [board, currentPiece, position]);

  const lockPiece = useCallback(() => {
    const pieceToMerge = { ...currentPiece, position: position };
    const newBoard = mergeTetromino(board, pieceToMerge);
    const { board: clearedBoard, linesCleared } = clearLines(newBoard);
    
    setBoard(clearedBoard);
    setLines(prev => prev + linesCleared);
    const newScore = score + calculateScore(linesCleared, level);
    setScore(newScore);

    if (linesCleared > 0 && (lines + linesCleared) >= level * 10) {
      setLevel(prev => prev + 1);
    }

    const newPiece = nextPiece;
    const newNext = getRandomTetromino();
    
    if (checkCollision(clearedBoard, newPiece, { x: 0, y: 0 })) {
      setGameOver(true);
      onGameOver?.(newScore);
      return;
    }
    
    setCurrentPiece(newPiece);
    setNextPiece(newNext);
    setPosition({ x: 3, y: 0 });
  }, [board, currentPiece, nextPiece, position, level, score, lines, onGameOver]);

  // キーボード操作
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowLeft':
          moveLeft();
          break;
        case 'ArrowRight':
          moveRight();
          break;
        case 'ArrowDown':
          moveDown();
          break;
        case 'ArrowUp':
          rotate();
          break;
        case ' ':
          hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, isPaused, moveLeft, moveRight, moveDown, rotate, hardDrop]);

  const resetGame = () => {
    setBoard(createBoard());
    setCurrentPiece(getRandomTetromino());
    setNextPiece(getRandomTetromino());
    setPosition({ x: 3, y: 0 });
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setIsPaused(false);
    setGameStarted(true);
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    
    if (!gameOver) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell === 1) {
            const boardY = position.y + y;
            const boardX = position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.type;
            }
          }
        });
      });
    }

    return displayBoard.map((row, y) => (
      <div key={y} style={{ display: 'flex' }}>
        {row.map((cell, x) => (
          <div
            key={`${y}-${x}`}
            style={{
              width: CELL_SIZE - 4,
              height: CELL_SIZE - 4,
              backgroundColor: cell ? getTetrominoColor(cell as string) : '#1a1a1a',
              border: '2px solid #333',
              borderRadius: '2px'
            }}
          />
        ))}
      </div>
    ));
  };

  const renderNextPiece = () => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px' }}>
        <div style={{ display: 'inline-block' }}>
          {nextPiece.shape.map((row, y) => (
            <div key={y} style={{ display: 'flex' }}>
              {row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  style={{
                    width: 15,
                    height: 15,
                    backgroundColor: cell === 1 ? getTetrominoColor(nextPiece.type) : 'transparent',
                    border: cell === 1 ? '1px solid #444' : 'none',
                    borderRadius: '1px'
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 overflow-hidden">
      {/* タイトル */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg">TETRIS</h1>
      </div>

      {/* メインゲームエリア */}
      <div className="flex items-center justify-center gap-3">
        {/* ゲームボード */}
        <div
          className="bg-black/40 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-purple-400/30 p-2 relative"
          style={{
            transform: 'scale(0.85)',
            transformOrigin: 'center'
          }}
        >
          {renderBoard()}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500 mb-4">GAME OVER</p>
                <p className="text-xl text-white mb-4">Score: {score}</p>
                <button
                  onClick={resetGame}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                >
                  RETRY
                </button>
              </div>
            </div>
          )}
        </div>

        {/* サイドパネル */}
        <div className="flex flex-col gap-2" style={{ width: '100px' }}>
          {/* スコア */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-purple-400/20">
            <p className="text-xs text-purple-300 mb-1">スコア</p>
            <p className="text-lg font-bold text-white">{score}</p>
          </div>

          {/* レベル・ライン */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-purple-400/20">
            <p className="text-xs text-purple-300">レベル: <span className="text-white font-bold">{level}</span></p>
            <p className="text-xs text-purple-300">ライン: <span className="text-white font-bold">{lines}</span></p>
          </div>

          {/* Next */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-purple-400/20">
            <p className="text-xs text-purple-300 mb-1">Next</p>
            {renderNextPiece()}
          </div>

          {/* 操作説明 */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-purple-400/20">
            <p className="text-xs text-purple-300 mb-1">操作</p>
            <div className="text-xs text-white space-y-0.5">
              <p>← → 移動</p>
              <p>↑ 回転</p>
              <p>↓ 落下</p>
              <p>Space ハードドロップ</p>
            </div>
          </div>

          {/* ボタン */}
          <div className="space-y-1.5">
            {!gameStarted ? (
              <button
                onClick={resetGame}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                START
              </button>
            ) : (
              <button
                onClick={togglePause}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* タッチ操作ボタン (画面下部) */}
      {gameStarted && !gameOver && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={rotate}
            className="w-16 h-16 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xl transition-colors"
          >
            ↻
          </button>
          <button
            onClick={moveLeft}
            className="w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xl transition-colors"
          >
            ←
          </button>
          <button
            onClick={moveDown}
            className="w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xl transition-colors"
          >
            ↓
          </button>
          <button
            onClick={moveRight}
            className="w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors text-xl"
          >
            →
          </button>
          <button
            onClick={hardDrop}
            className="w-16 h-16 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors text-sm"
          >
            DROP
          </button>
        </div>
      )}
    </div>
  );
};

export default TetrisGame;
