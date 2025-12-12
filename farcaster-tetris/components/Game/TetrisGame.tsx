'use client';

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
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

interface LayoutConfig {
  boardScale: number;
  sidePanelWidth: number;
  buttonSize: number;
  gap: number;
  paddingX: number;
}

// SRS回転状態 (0: spawn, 1: right, 2: 2, 3: left)
type RotationState = 0 | 1 | 2 | 3;

// SRSキックテーブル (JLSTZ用)
const SRS_KICK_TABLE: Record<string, Position[]> = {
  '0->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
  '1->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  '1->2': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  '2->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
  '2->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
  '3->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
  '3->0': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
  '0->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
};

// SRSキックテーブル (I用)
const SRS_I_KICK_TABLE: Record<string, Position[]> = {
  '0->1': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }],
  '1->0': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }],
  '1->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }],
  '2->1': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }],
  '2->3': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }],
  '3->2': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }],
  '3->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }],
  '0->3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }],
};

const TetrisGame: React.FC<TetrisGameProps> = ({ onGameOver }) => {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [currentPiece, setCurrentPiece] = useState<Tetromino>(getRandomTetromino());
  const [nextPiece, setNextPiece] = useState<Tetromino>(getRandomTetromino());
  const [position, setPosition] = useState<Position>({ x: 3, y: 0 });
  const [rotationState, setRotationState] = useState<RotationState>(0); // SRS回転状態
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  
  // コントロールボタンの高さを動的計測
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [controlsHeight, setControlsHeight] = useState(0);

  // レイアウト自動調整
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    boardScale: 0.72,
    sidePanelWidth: 85,
    buttonSize: 56,
    gap: 5, // 固定5px
    paddingX: 12
  });

  // コントロールの高さを測定
  useLayoutEffect(() => {
    const el = controlsRef.current;
    if (!el) return;

    const update = () => setControlsHeight(el.getBoundingClientRect().height);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // 画面サイズに応じた自動調整
  useEffect(() => {
    const calculateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = height / width;
      
      let config: LayoutConfig;
      
      if (width <= 375) {
        if (aspectRatio > 2.0) {
          config = {
            boardScale: 0.68,
            sidePanelWidth: 80,
            buttonSize: 52,
            gap: 5,
            paddingX: 8
          };
        } else {
          config = {
            boardScale: 0.65,
            sidePanelWidth: 80,
            buttonSize: 50,
            gap: 5,
            paddingX: 8
          };
        }
      } else if (width <= 390) {
        config = {
          boardScale: 0.70,
          sidePanelWidth: 85,
          buttonSize: 54,
          gap: 5,
          paddingX: 10
        };
      } else if (width <= 414) {
        config = {
          boardScale: 0.75,
          sidePanelWidth: 90,
          buttonSize: 56,
          gap: 5,
          paddingX: 12
        };
      } else if (width <= 768) {
        if (aspectRatio < 1.0) {
          config = {
            boardScale: 0.60,
            sidePanelWidth: 95,
            buttonSize: 60,
            gap: 5,
            paddingX: 16
          };
        } else {
          config = {
            boardScale: 0.85,
            sidePanelWidth: 100,
            buttonSize: 64,
            gap: 5,
            paddingX: 16
          };
        }
      } else {
        config = {
          boardScale: 0.90,
          sidePanelWidth: 110,
          buttonSize: 68,
          gap: 5,
          paddingX: 20
        };
      }
      
      setLayoutConfig(config);
    };

    calculateLayout();
    window.addEventListener('resize', calculateLayout);
    window.addEventListener('orientationchange', calculateLayout);
    
    return () => {
      window.removeEventListener('resize', calculateLayout);
      window.removeEventListener('orientationchange', calculateLayout);
    };
  }, []);

  // スケール後のセルサイズを計算
  const scaledCell = Math.round(CELL_SIZE * layoutConfig.boardScale);
  const scaledBorder = Math.max(1, Math.round(2 * layoutConfig.boardScale));
  const scaledInner = Math.max(6, scaledCell - scaledBorder * 2);

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

    let speed: number;
    if (level === 1) {
      speed = 500;
    } else {
      speed = 500 / Math.pow(1.1, level - 1);
    }
    speed = Math.max(50, speed);

    gameLoopRef.current = setInterval(() => {
      setPosition(prev => {
        const newPos = { x: prev.x, y: prev.y + 1 };
        return newPos;
      });
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameOver, isPaused, level, gameStarted]);

  // 衝突チェックとロック
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;

    const pieceWithPosition = { ...currentPiece, position };
    if (checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) {
      const prevPosition = { x: position.x, y: position.y - 1 };
      lockPiece(prevPosition);
    }
  }, [position, board, currentPiece, gameStarted, gameOver, isPaused]);

  const lockPiece = useCallback((lockPosition: Position) => {
    const pieceToMerge = { ...currentPiece, position: lockPosition };
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
    setRotationState(0); // リセット
  }, [board, currentPiece, nextPiece, level, score, lines, onGameOver]);

  const moveLeft = useCallback(() => {
    if (isPaused) return;
    const newPosition = { x: position.x - 1, y: position.y };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (!checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) {
      setPosition(newPosition);
    }
  }, [board, currentPiece, position, isPaused]);

  const moveRight = useCallback(() => {
    if (isPaused) return;
    const newPosition = { x: position.x + 1, y: position.y };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (!checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) {
      setPosition(newPosition);
    }
  }, [board, currentPiece, position, isPaused]);

  const moveDown = useCallback(() => {
    if (isPaused) return;
    const newPosition = { x: position.x, y: position.y + 1 };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (!checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) {
      setPosition(newPosition);
    }
  }, [board, currentPiece, position, isPaused]);

  // SRS回転 (時計回り)
  const rotate = useCallback(() => {
    if (isPaused) return;
    
    const isIPiece = currentPiece.type === 'I';
    const kickTable = isIPiece ? SRS_I_KICK_TABLE : SRS_KICK_TABLE;
    const newRotationState = ((rotationState + 1) % 4) as RotationState;
    const transitionKey = `${rotationState}->${newRotationState}`;
    const kicks = kickTable[transitionKey] || [{ x: 0, y: 0 }];

    const rotated = rotateTetromino(currentPiece);

    for (const kick of kicks) {
      const testPosition = {
        x: position.x + kick.x,
        y: position.y + kick.y
      };
      const testPiece = { ...rotated, position: testPosition };
      
      if (!checkCollision(board, testPiece, { x: 0, y: 0 })) {
        setCurrentPiece(rotated);
        setPosition(testPosition);
        setRotationState(newRotationState);
        return;
      }
    }
  }, [board, position, currentPiece, rotationState, isPaused]);

  // SRS回転 (反時計回り)
  const rotateCounterClockwise = useCallback(() => {
    if (isPaused) return;
    
    const isIPiece = currentPiece.type === 'I';
    const kickTable = isIPiece ? SRS_I_KICK_TABLE : SRS_KICK_TABLE;
    const newRotationState = ((rotationState + 3) % 4) as RotationState;
    const transitionKey = `${rotationState}->${newRotationState}`;
    const kicks = kickTable[transitionKey] || [{ x: 0, y: 0 }];

    // 反時計回りは3回時計回りと同じ
    let rotated = currentPiece;
    for (let i = 0; i < 3; i++) {
      rotated = rotateTetromino(rotated);
    }

    for (const kick of kicks) {
      const testPosition = {
        x: position.x + kick.x,
        y: position.y + kick.y
      };
      const testPiece = { ...rotated, position: testPosition };
      
      if (!checkCollision(board, testPiece, { x: 0, y: 0 })) {
        setCurrentPiece(rotated);
        setPosition(testPosition);
        setRotationState(newRotationState);
        return;
      }
    }
  }, [board, position, currentPiece, rotationState, isPaused]);

  const hardDrop = useCallback(() => {
    if (isPaused) return;
    let dropPosition = { ...position };
    while (true) {
      const nextPos = { x: dropPosition.x, y: dropPosition.y + 1 };
      const pieceWithPosition = { ...currentPiece, position: nextPos };
      if (checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) {
        break;
      }
      dropPosition = nextPos;
    }
    setPosition(dropPosition);
  }, [board, currentPiece, position, isPaused]);

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
        case 'z':
        case 'Z':
          rotateCounterClockwise();
          break;
        case ' ':
          hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, isPaused, moveLeft, moveRight, moveDown, rotate, rotateCounterClockwise, hardDrop]);

  const resetGame = () => {
    setBoard(createBoard());
    setCurrentPiece(getRandomTetromino());
    setNextPiece(getRandomTetromino());
    setPosition({ x: 3, y: 0 });
    setRotationState(0);
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
              width: scaledInner,
              height: scaledInner,
              backgroundColor: cell ? getTetrominoColor(cell as string) : '#1a1a1a',
              border: `${scaledBorder}px solid #333`,
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
    <div
      className="flex flex-col w-full min-h-[100dvh] bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 overflow-x-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {/* メインコンテンツエリア（タイトル＋ゲームボード） - 縦中央揃え */}
      <div
        className="flex-1 w-full flex flex-col items-center justify-center"
        style={{
          paddingBottom: `calc(${controlsHeight}px + env(safe-area-inset-bottom))`,
        }}
      >
        {/* タイトル */}
        <div className="text-center mb-4">
          <h1 
            className="text-2xl font-bold text-white drop-shadow-lg tracking-wider"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            FARTETRIS
          </h1>
        </div>

        {/* ゲームエリア */}
        <div
          className="flex items-center justify-center w-full max-w-md"
          style={{
            gap: `5px`,
            paddingLeft: `${layoutConfig.paddingX}px`,
            paddingRight: `${layoutConfig.paddingX}px`,
          }}
        >
          {/* ゲームボード */}
          <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-purple-400/30 p-1 relative">
            {renderBoard()}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500 mb-4">GAME OVER</p>
                  <p className="text-xl text-white mb-4">Score: {score}</p>
                  <button
                    onClick={resetGame}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                    style={{
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none'
                    }}
                  >
                    RETRY
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* サイドパネル */}
          <div 
            className="flex flex-col gap-1.5" 
            style={{ width: `${layoutConfig.sidePanelWidth}px` }}
          >
            {/* スコア */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1.5 border border-purple-400/20 text-center">
              <p className="text-xs text-purple-300 mb-0.5">スコア</p>
              <p className="text-base font-bold text-white">{score}</p>
            </div>

            {/* レベル・ライン */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1.5 border border-purple-400/20 text-center">
              <p className="text-xs text-purple-300">レベル</p>
              <p className="text-sm font-bold text-white mb-1">{level}</p>
              <p className="text-xs text-purple-300">ライン</p>
              <p className="text-sm font-bold text-white">{lines}</p>
            </div>

            {/* Next */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1.5 border border-purple-400/20">
              <p className="text-xs text-purple-300 mb-1 text-center">Next</p>
              {renderNextPiece()}
            </div>

            {/* ボタン */}
            <div className="space-y-1">
              {!gameStarted ? (
                <button
                  onClick={resetGame}
                  className="w-full py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                >
                  START
                </button>
              ) : (
                <button
                  onClick={togglePause}
                  className="w-full py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                >
                  {isPaused ? 'RESUME' : 'PAUSE'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* タッチ操作ボタン - 2段組み */}
      <div
        ref={controlsRef}
        className="fixed bottom-0 left-0 right-0 flex flex-col items-center bg-gradient-to-t from-purple-900/95 to-transparent backdrop-blur-sm py-2"
        style={{
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
          gap: '6px',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {/* 上段: 回転×2 + DROP */}
        <div 
          className="flex justify-center"
          style={{ gap: `${layoutConfig.gap}px` }}
        >
          <button
            onClick={rotateCounterClockwise}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{ 
              width: `${layoutConfig.buttonSize}px`, 
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.35}px`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            ↺
          </button>
          <button
            onClick={rotate}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{ 
              width: `${layoutConfig.buttonSize}px`, 
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.35}px`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            ↻
          </button>
          <button
            onClick={hardDrop}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{ 
              width: `${layoutConfig.buttonSize}px`, 
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.28}px`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            DROP
          </button>
        </div>

        {/* 下段: 矢印×3 */}
        <div 
          className="flex justify-center"
          style={{ gap: `${layoutConfig.gap}px` }}
        >
          <button
            onClick={moveLeft}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{ 
              width: `${layoutConfig.buttonSize}px`, 
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.35}px`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            ←
          </button>
          <button
            onClick={moveDown}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{ 
              width: `${layoutConfig.buttonSize}px`, 
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.35}px`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            ↓
          </button>
          <button
            onClick={moveRight}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{ 
              width: `${layoutConfig.buttonSize}px`, 
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.35}px`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TetrisGame;
