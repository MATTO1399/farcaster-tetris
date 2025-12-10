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
  type Board,
  type Tetromino,
} from '@/utils/tetrisLogic';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  NFT_THRESHOLD_SCORE,
} from '@/utils/constants';

interface TetrisGameProps {
  onGameOver?: (score: number) => void;
}

const TetrisGame: React.FC<TetrisGameProps> = ({ onGameOver }) => {
  const [board, setBoard] = useState<Board>(createBoard());
  const [currentTetromino, setCurrentTetromino] = useState<Tetromino | null>(null);
  const [nextTetromino, setNextTetromino] = useState<Tetromino | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Farcaster SDK初期化
  useEffect(() => {
    const initFarcaster = async () => {
      try {
        const context = await sdk.context;
        console.log('Farcaster context:', context);
        sdk.actions.ready(); // スプラッシュスクリーンを非表示
      } catch (error) {
        console.error('Farcaster SDK error:', error);
        // Farcaster外でも動作するようにエラーを無視
      }
    };
    initFarcaster();
  }, []);

  // ゲーム初期化
  const initGame = useCallback(() => {
    setBoard(createBoard());
    setCurrentTetromino(getRandomTetromino());
    setNextTetromino(getRandomTetromino());
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setIsPaused(false);
    setGameStarted(true);
  }, []);

  // テトリミノを移動
  const moveTetromino = useCallback(
    (dx: number, dy: number) => {
      if (!currentTetromino || gameOver || isPaused) return false;

      const newTetromino = {
        ...currentTetromino,
        position: {
          x: currentTetromino.position.x + dx,
          y: currentTetromino.position.y + dy,
        },
      };

      if (!checkCollision(board, newTetromino)) {
        setCurrentTetromino(newTetromino);
        
        // ソフトドロップのスコア
        if (dy > 0) {
          setScore((prev) => prev + dy);
        }
        
        return true;
      }

      return false;
    },
    [currentTetromino, board, gameOver, isPaused]
  );

  // テトリミノを回転
  const rotate = useCallback(() => {
    if (!currentTetromino || gameOver || isPaused) return;

    const rotated = rotateTetromino(currentTetromino);

    // 回転後に壁に当たる場合、位置を調整（ウォールキック）
    let offset = 0;
    while (checkCollision(board, rotated, { x: offset, y: 0 }) && Math.abs(offset) < 3) {
      offset = offset > 0 ? -(offset + 1) : -offset + 1;
    }

    if (!checkCollision(board, rotated, { x: offset, y: 0 })) {
      setCurrentTetromino({
        ...rotated,
        position: {
          ...rotated.position,
          x: rotated.position.x + offset,
        },
      });
    }
  }, [currentTetromino, board, gameOver, isPaused]);

  // ハードドロップ
  const hardDrop = useCallback(() => {
    if (!currentTetromino || gameOver || isPaused) return;

    let dropDistance = 0;
    let testTetromino = { ...currentTetromino };

    while (!checkCollision(board, testTetromino, { x: 0, y: 1 })) {
      testTetromino.position.y++;
      dropDistance++;
    }

    setCurrentTetromino(testTetromino);
    setScore((prev) => prev + dropDistance * 2);

    // 即座に固定
    setTimeout(() => lockTetromino(), 0);
  }, [currentTetromino, board, gameOver, isPaused]);

  // テトリミノを固定
  const lockTetromino = useCallback(() => {
    if (!currentTetromino || !nextTetromino) return;

    const mergedBoard = mergeTetromino(board, currentTetromino);
    const { board: clearedBoard, linesCleared } = clearLines(mergedBoard);

    setBoard(clearedBoard);
    setLines((prev) => prev + linesCleared);

    if (linesCleared > 0) {
      const points = calculateScore(linesCleared, level);
      setScore((prev) => prev + points);
    }

    // レベルアップ（10ライン毎）
    const newLines = lines + linesCleared;
    const newLevel = Math.floor(newLines / 10) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
    }

    // 次のテトリミノ
    const newTetromino = nextTetromino;
    newTetromino.position = {
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(newTetromino.shape[0].length / 2),
      y: 0,
    };

    if (isGameOver(clearedBoard, newTetromino)) {
      setGameOver(true);
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      onGameOver?.(score);
    } else {
      setCurrentTetromino(newTetromino);
      setNextTetromino(getRandomTetromino());
    }
  }, [currentTetromino, nextTetromino, board, lines, level, score, onGameOver]);

  // ゲームループ
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || !currentTetromino) return;

    const speed = Math.max(100, INITIAL_SPEED - (level - 1) * SPEED_INCREMENT);

    gameLoopRef.current = setInterval(() => {
      const moved = moveTetromino(0, 1);
      if (!moved) {
        lockTetromino();
      }
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, isPaused, currentTetromino, level, moveTetromino, lockTetromino]);

  // キーボード操作
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver || !gameStarted) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveTetromino(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveTetromino(1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveTetromino(0, 1);
          break;
        case 'ArrowUp':
        case ' ':
          e.preventDefault();
          rotate();
          break;
        case 'Enter':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          setIsPaused((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameOver, gameStarted, moveTetromino, rotate, hardDrop]);

  // タッチ操作
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const dx = touchEnd.x - touchStartRef.current.x;
    const dy = touchEnd.y - touchStartRef.current.y;

    // スワイプ方向判定
    if (Math.abs(dx) > Math.abs(dy)) {
      // 横スワイプ
      if (Math.abs(dx) > 30) {
        moveTetromino(dx > 0 ? 1 : -1, 0);
      }
    } else {
      // 縦スワイプ
      if (dy > 50) {
        hardDrop();
      }
    }

    touchStartRef.current = null;
  };

  // ボードをレンダリング
  const renderBoard = () => {
    const displayBoard = board.map((row) => [...row]);

    // 現在のテトリミノを描画
    if (currentTetromino) {
      currentTetromino.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell) {
            const boardY = currentTetromino.position.y + y;
            const boardX = currentTetromino.position.x + x;
            if (
              boardY >= 0 &&
              boardY < BOARD_HEIGHT &&
              boardX >= 0 &&
              boardX < BOARD_WIDTH
            ) {
              displayBoard[boardY][boardX] = currentTetromino.color;
            }
          }
        });
      });
    }

    return displayBoard;
  };

  const displayBoard = renderBoard();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 py-8 px-4 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 text-white text-center">
          <h1 className="text-4xl font-bold mb-2">TETRIS</h1>
          <p className="text-sm opacity-80">Farcaster Mini App</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start justify-center">
          {/* ゲームボード */}
          <div className="flex-shrink-0">
            <div
              style={{
                width: BOARD_WIDTH * CELL_SIZE,
                height: BOARD_HEIGHT * CELL_SIZE,
                outline: '4px solid rgb(168, 85, 247)',
                outlineOffset: '0px',
              }}
              className="bg-gray-900 rounded-lg shadow-xl relative overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {displayBoard.map((row, y) => (
                <div key={y} className="flex">
                  {row.map((cell, x) => (
                    <div
                      key={`${y}-${x}`}
                      className="border border-gray-800"
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor: cell || '#1a1a2e',
                        boxShadow: cell ? 'inset 0 0 0 2px rgba(255,255,255,0.1)' : 'none',
                      }}
                    />
                  ))}
                </div>
              ))}

              {/* ゲームオーバーオーバーレイ */}
              {gameOver && (
                <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-lg">
                  <div className="text-center text-white">
                    <h2 className="text-3xl font-bold mb-4">GAME OVER</h2>
                    <p className="text-xl mb-2">スコア: {score}</p>
                    <p className="text-lg mb-4">ライン: {lines}</p>
                    {score >= NFT_THRESHOLD_SCORE && (
                      <p className="text-yellow-400 mb-4">🎉 NFT報酬を獲得！</p>
                    )}
                    <button
                      onClick={initGame}
                      className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold transition-colors"
                    >
                      もう一度プレイ
                    </button>
                  </div>
                </div>
              )}

              {/* ポーズオーバーレイ */}
              {isPaused && !gameOver && (
                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded-lg">
                  <div className="text-white text-2xl font-bold">PAUSED</div>
                </div>
              )}
            </div>
          </div>

          {/* サイドパネル */}
          <div className="flex flex-col gap-4 w-full md:w-auto md:min-w-[200px]">
            {/* スコア表示 */}
            <div className="bg-gray-800 text-white p-4 rounded-lg">
              <div className="mb-3">
                <div className="text-sm opacity-70">スコア</div>
                <div className="text-2xl font-bold">{score}</div>
              </div>
              <div className="mb-3">
                <div className="text-sm opacity-70">ライン</div>
                <div className="text-xl font-bold">{lines}</div>
              </div>
              <div>
                <div className="text-sm opacity-70">レベル</div>
                <div className="text-xl font-bold">{level}</div>
              </div>
            </div>

            {/* 次のテトリミノ */}
            {nextTetromino && (
              <div className="bg-gray-800 text-white p-4 rounded-lg">
                <div className="text-sm opacity-70 mb-2">NEXT</div>
                <div className="flex justify-center">
                  <div className="bg-gray-900 p-2 rounded">
                    {nextTetromino.shape.map((row, y) => (
                      <div key={y} className="flex">
                        {row.map((cell, x) => (
                          <div
                            key={`${y}-${x}`}
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: cell ? nextTetromino.color : 'transparent',
                              border: cell ? '1px solid rgba(255,255,255,0.2)' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 操作説明 */}
            <div className="bg-gray-800 text-white p-4 rounded-lg text-sm">
              <div className="font-bold mb-2">操作方法</div>
              <div className="space-y-1 opacity-70">
                <div>← → : 移動</div>
                <div>↑ / Space : 回転</div>
                <div>↓ : 下移動</div>
                <div>Enter : ハードドロップ</div>
                <div>P : 一時停止</div>
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div>📱 スワイプで操作</div>
                </div>
              </div>
            </div>

            {/* スタート/ポーズボタン */}
            {!gameStarted ? (
              <button
                onClick={initGame}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                ゲームスタート
              </button>
            ) : (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                disabled={gameOver}
              >
                {isPaused ? '再開' : '一時停止'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TetrisGame;
