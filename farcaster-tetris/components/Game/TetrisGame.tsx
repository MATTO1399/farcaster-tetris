'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBoard } from '@/utils/board';
import { getRandomTetromino, rotateTetromino, counterRotateTetromino } from '@/utils/tetromino';
import { isValidMove, mergePieceToBoard } from '@/utils/collision';
import { clearLines } from '@/utils/board';
import type {
  Board,
  Tetromino,
  Position,
  RotationState,
  FarcasterUser,
  LeaderboardEntry,
  HistoryEntry,
} from '@/types/tetris';
import GameMenu from './GameMenu';
import Leaderboard from './Leaderboard';
import HistoryModal from './HistoryModal';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from '@/utils/constants';

declare const sdk: any;

type LayoutConfig = {
  boardScale: number;
  buttonSize: number;
  gap: number;
  fontSize: number;
};

interface TetrisGameProps {
  onGameOver?: (score: number) => void;
}

function getUADataPlatform() {
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  const p = nav?.userAgentData?.platform ?? nav?.platform ?? '';
  return p.toLowerCase();
}

function isAndroidLike() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const plat = getUADataPlatform();
  return /android/i.test(ua) || /android/i.test(plat);
}

const DEBUG_OVERLAY = false;

const SRS_KICK_TABLE: Record<string, Position[]> = {
  '0->1': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  '1->0': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  '1->2': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  '2->1': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  '2->3': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
  '3->2': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  '3->0': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  '0->3': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
};

const SRS_I_KICK_TABLE: Record<string, Position[]> = {
  '0->1': [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
  ],
  '1->0': [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 1 },
    { x: -1, y: -2 },
  ],
  '1->2': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 2 },
    { x: 2, y: -1 },
  ],
  '2->1': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: -2 },
    { x: -2, y: 1 },
  ],
  '2->3': [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 1 },
    { x: -1, y: -2 },
  ],
  '3->2': [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
  ],
  '3->0': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: -2 },
    { x: -2, y: 1 },
  ],
  '0->3': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 2 },
    { x: 2, y: -1 },
  ],
};

const TetrisGame: React.FC<TetrisGameProps> = ({ onGameOver }) => {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [currentPiece, setCurrentPiece] = useState<Tetromino | null>(null);
  const [nextPiece, setNextPiece] = useState<Tetromino | null>(null);
  const [position, setPosition] = useState<Position>({ x: 3, y: 0 });
  const [rotationState, setRotationState] = useState<RotationState>(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [androidLike, setAndroidLike] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0, ratio: 0 });

  useEffect(() => {
    setAndroidLike(isAndroidLike());
  }, []);

  useEffect(() => {
    const setAppHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);

      const w = window.innerWidth;
      const ratio = w ? h / w : 0;
      setViewport({ w, h, ratio });
    };

    setAppHeight();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setAppHeight);
      return () => {
        window.visualViewport?.removeEventListener('resize', setAppHeight);
      };
    } else {
      window.addEventListener('resize', setAppHeight);
      return () => window.removeEventListener('resize', setAppHeight);
    }
  }, []);

  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    boardScale: 1.0,
    buttonSize: 64,
    gap: 12,
    fontSize: 16,
  });

  useEffect(() => {
    const calculateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = height / width;

      let boardScale = 1.0;
      let buttonSize = 64;
      let gap = 12;
      let fontSize = 16;

      if (aspectRatio > 2.0) {
        boardScale = 1.2;
        buttonSize = 72;
        gap = 14;
        fontSize = 18;
      } else if (aspectRatio > 1.8) {
        boardScale = 1.1;
        buttonSize = 68;
        gap = 13;
        fontSize = 17;
      } else if (aspectRatio < 1.4) {
        boardScale = 0.85;
        buttonSize = 56;
        gap = 10;
        fontSize = 14;
      }

      setLayoutConfig({ boardScale, buttonSize, gap, fontSize });
    };

    calculateLayout();
    window.addEventListener('resize', calculateLayout);
    return () => window.removeEventListener('resize', calculateLayout);
  }, []);

  const scaledCell = Math.round(CELL_SIZE * layoutConfig.boardScale);
  const scaledBorder = Math.max(1, Math.round(2 * layoutConfig.boardScale));
  const scaledInner = Math.max(6, scaledCell - scaledBorder * 2);

  useEffect(() => {
    const initFarcaster = async () => {
      try {
        const context = await sdk.context;
        setIsInFarcaster(true);
        if (context?.user) {
          setUser({
            fid: context.user.fid,
            username: context.user.username || `User${context.user.fid}`,
            displayName: context.user.displayName || context.user.username || `User${context.user.fid}`,
            pfpUrl: context.user.pfpUrl || undefined,
          });
        }
      } catch (error) {
        console.error('Farcaster initialization error:', error);
        setIsInFarcaster(false);
      }
    };

    if (typeof window !== 'undefined' && typeof sdk !== 'undefined') {
      initFarcaster();
    }
  }, []);

  const shouldTweakAndroidSpacing =
    isInFarcaster &&
    androidLike &&
    viewport.ratio >= 1.6;

  const androidPushPx = shouldTweakAndroidSpacing
    ? Math.floor((viewport.h * 0.08) / layoutConfig.boardScale)
    : 0;

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || !currentPiece) return;

    const speed = Math.max(100, 1000 - (level - 1) * 50);

    gameLoopRef.current = setInterval(() => {
      moveDown();
    }, speed);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameStarted, gameOver, isPaused, currentPiece, level, position, board]);

  const saveScoreToLeaderboard = async (finalScore: number) => {
    if (!user || !isInFarcaster) return;
    try {
      const entry: LeaderboardEntry = {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName || user.username,
        pfpUrl: user.pfpUrl,
        score: finalScore,
        timestamp: Date.now(),
      };

      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to save to leaderboard:', error);
    }
  };

  const saveScoreToHistory = async (finalScore: number) => {
    if (!user || !isInFarcaster) return;
    try {
      const entry: HistoryEntry = {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName || user.username,
        pfpUrl: user.pfpUrl,
        score: finalScore,
        timestamp: Date.now(),
      };

      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  };

  const lockPiece = useCallback(
    (lockPosition: Position) => {
      if (!currentPiece) return;

      const pieceToMerge = { ...currentPiece, position: lockPosition };
      let newBoard = mergePieceToBoard(board, pieceToMerge);

      if (currentPiece.isOjama) {
        newBoard = createBoard();
      }

      let newScore = score;
      if (currentPiece.isOjama) {
        const blockCount = currentPiece.shape.flat().filter((cell) => cell !== 0).length;
        const bonusScore = blockCount * 10;
        newScore += bonusScore;
      } else {
        const { board: clearedBoard, linesCleared } = clearLines(newBoard);
        newBoard = clearedBoard;
        if (linesCleared > 0) {
          const basePoints = [0, 100, 300, 500, 800];
          newScore += basePoints[linesCleared] * level;
          setLines((prev) => prev + linesCleared);
        }
      }

      const newLevel = Math.floor(newScore / 1000) + 1;
      setScore(newScore);
      setLevel(newLevel);
      setBoard(newBoard);

      const newPiece = nextPiece;
      const newNext = getRandomTetromino();
      setCurrentPiece(newPiece);
      setNextPiece(newNext);
      setPosition({ x: 3, y: 0 });
      setRotationState(0);

      if (newPiece && !isValidMove(newBoard, { ...newPiece, position: { x: 3, y: 0 } })) {
        setGameOver(true);
        setGameStarted(false);
        saveScoreToLeaderboard(newScore);
        saveScoreToHistory(newScore);
        
        // BGM停止
        if (bgmAudioRef.current) {
          bgmAudioRef.current.pause();
          bgmAudioRef.current.currentTime = 0;
        }
        
        if (onGameOver) {
          onGameOver(newScore);
        }
      }
    },
    [currentPiece, nextPiece, board, score, level, onGameOver]
  );

  useEffect(() => {
    if (!currentPiece || !gameStarted || gameOver || isPaused) return;
    const pieceWithPosition = { ...currentPiece, position };
    if (!isValidMove(board, pieceWithPosition)) {
      const prevPosition = { x: position.x, y: position.y - 1 };
      lockPiece(prevPosition);
    }
  }, [position, currentPiece, board, gameStarted, gameOver, isPaused, lockPiece]);

  const moveLeft = useCallback(() => {
    if (!currentPiece) return;
    const newPosition = { x: position.x - 1, y: position.y };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (isValidMove(board, pieceWithPosition)) setPosition(newPosition);
  }, [currentPiece, position, board]);

  const moveRight = useCallback(() => {
    if (!currentPiece) return;
    const newPosition = { x: position.x + 1, y: position.y };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (isValidMove(board, pieceWithPosition)) setPosition(newPosition);
  }, [currentPiece, position, board]);

  const moveDown = useCallback(() => {
    if (!currentPiece) return;
    const newPosition = { x: position.x, y: position.y + 1 };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (isValidMove(board, pieceWithPosition)) setPosition(newPosition);
  }, [currentPiece, position, board]);

  const rotate = useCallback(() => {
    if (!currentPiece) return;
    if (currentPiece.isOjama) return;
    const isIPiece = currentPiece.type === 'I';
    const kickTable = isIPiece ? SRS_I_KICK_TABLE : SRS_KICK_TABLE;
    const newRotationState = ((rotationState + 1) % 4) as RotationState;
    const transitionKey = `${rotationState}->${newRotationState}`;
    const kicks = kickTable[transitionKey] || [{ x: 0, y: 0 }];

    const rotated = rotateTetromino(currentPiece);

    for (const kick of kicks) {
      const testPosition = { x: position.x + kick.x, y: position.y + kick.y };
      const testPiece = { ...rotated, position: testPosition };
      if (isValidMove(board, testPiece)) {
        setCurrentPiece(rotated);
        setPosition(testPosition);
        setRotationState(newRotationState);
        return;
      }
    }
  }, [currentPiece, position, rotationState, board]);

  const rotateCounterClockwise = useCallback(() => {
    if (!currentPiece) return;
    if (currentPiece.isOjama) return;
    const isIPiece = currentPiece.type === 'I';
    const kickTable = isIPiece ? SRS_I_KICK_TABLE : SRS_KICK_TABLE;
    const newRotationState = ((rotationState + 3) % 4) as RotationState;
    const transitionKey = `${rotationState}->${newRotationState}`;
    const kicks = kickTable[transitionKey] || [{ x: 0, y: 0 }];

    const rotated = counterRotateTetromino(currentPiece);

    for (const kick of kicks) {
      const testPosition = { x: position.x + kick.x, y: position.y + kick.y };
      const testPiece = { ...rotated, position: testPosition };
      if (isValidMove(board, testPiece)) {
        setCurrentPiece(rotated);
        setPosition(testPosition);
        setRotationState(newRotationState);
        return;
      }
    }
  }, [currentPiece, position, rotationState, board]);

  const hardDrop = useCallback(() => {
    if (!currentPiece) return;

    let dropPosition = { ...position };
    while (true) {
      const nextPos = { x: dropPosition.x, y: dropPosition.y + 1 };
      const pieceWithPosition = { ...currentPiece, position: nextPos };
      if (!isValidMove(board, pieceWithPosition)) break;
      dropPosition = nextPos;
    }

    const pieceToMerge = { ...currentPiece, position: dropPosition };
    let newBoard = mergePieceToBoard(board, pieceToMerge);

    if (currentPiece.isOjama) {
      newBoard = createBoard();
    }

    let newScore = score;
    if (currentPiece.isOjama) {
      const blockCount = currentPiece.shape.flat().filter((cell) => cell !== 0).length;
      const bonusScore = blockCount * 10;
      newScore += bonusScore;
    } else {
      const { board: clearedBoard, linesCleared } = clearLines(newBoard);
      newBoard = clearedBoard;
      if (linesCleared > 0) {
        const basePoints = [0, 100, 300, 500, 800];
        newScore += basePoints[linesCleared] * level;
        setLines((prev) => prev + linesCleared);
      }
    }

    const newLevel = Math.floor(newScore / 1000) + 1;
    setScore(newScore);
    setLevel(newLevel);
    setBoard(newBoard);

    const newPiece = nextPiece;
    const newNext = getRandomTetromino();
    setCurrentPiece(newPiece);
    setNextPiece(newNext);
    setPosition({ x: 3, y: 0 });
    setRotationState(0);

    if (newPiece && !isValidMove(newBoard, { ...newPiece, position: { x: 3, y: 0 } })) {
      setGameOver(true);
      setGameStarted(false);
      saveScoreToLeaderboard(newScore);
      saveScoreToHistory(newScore);
      
      // BGM停止
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current.currentTime = 0;
      }
      
      if (onGameOver) {
        onGameOver(newScore);
      }
    }
  }, [currentPiece, nextPiece, position, board, score, level, onGameOver]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted || gameOver || isPaused) return;
      if (e.key === 'ArrowLeft') moveLeft();
      else if (e.key === 'ArrowRight') moveRight();
      else if (e.key === 'ArrowDown') moveDown();
      else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') rotate();
      else if (e.key === 'z' || e.key === 'Z') rotateCounterClockwise();
      else if (e.key === ' ') {
        e.preventDefault();
        hardDrop();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, isPaused, moveLeft, moveRight, moveDown, rotate, rotateCounterClockwise, hardDrop]);

  const startNewGame = () => {
    // BGMをランダムに選択して再生
    const bgmList = ['/sounds/music_A.mp3', '/sounds/music_B.mp3'];
    const randomBGM = bgmList[Math.floor(Math.random() * bgmList.length)];
    
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
    }
    
    bgmAudioRef.current = new Audio(randomBGM);
    bgmAudioRef.current.loop = true;
    bgmAudioRef.current.volume = 0.3;
    bgmAudioRef.current.play().catch((err) => {
      console.error('BGM再生エラー:', err);
    });
    
    const firstPiece = getRandomTetromino();
    const secondPiece = getRandomTetromino();
    setBoard(createBoard());
    setCurrentPiece(firstPiece);
    setNextPiece(secondPiece);
    setPosition({ x: 3, y: 0 });
    setRotationState(0);
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setIsPaused(false);
    setGameStarted(true);
    setShowMenu(false);
  };

  const togglePause = () => setIsPaused((prev) => !prev);

  const handleBackToMenu = () => {
    setShowMenu(true);
    setGameStarted(false);
    setGameOver(false);
    
    // BGM停止
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
    }
  };

  const handleShowRanking = () => setShowLeaderboard(true);
  const handleShowHistory = () => setShowHistory(true);

  const renderNextPiece = () => {
    if (!nextPiece) return null;
    const isOjamaNext = nextPiece.isOjama;

    return (
      <div
        className="flex items-center justify-center bg-black/30 rounded-lg p-2"
        style={{
          width: `${scaledCell * 4 + 16}px`,
          height: `${scaledCell * 4 + 16}px`,
        }}
      >
        {isOjamaNext ? (
          <div
            style={{
              width: `${scaledCell * 2}px`,
              height: `${scaledCell * 2}px`,
              backgroundImage: 'url(/images/ojama-block.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <div className="grid">
            {nextPiece.shape.map((row, y) => (
              <div key={y} className="flex">
                {row.map((cell, x) => (
                  <div
                    key={x}
                    style={{
                      width: `${scaledCell}px`,
                      height: `${scaledCell}px`,
                      backgroundColor: cell ? nextPiece.color : 'transparent',
                      border: cell ? `${scaledBorder}px solid rgba(0,0,0,0.3)` : 'none',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBoard = () => {
    const displayBoard = board.map((row) => [...row]);
    if (currentPiece && gameStarted && !gameOver) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell !== 0) {
            const boardY = position.y + y;
            const boardX = position.x + x;
            if (
              boardY >= 0 &&
              boardY < BOARD_HEIGHT &&
              boardX >= 0 &&
              boardX < BOARD_WIDTH
            ) {
              displayBoard[boardY][boardX] = cell;
            }
          }
        });
      });
    }

    const ojamaBlocks = new Set<string>();
    if (currentPiece && currentPiece.isOjama && gameStarted && !gameOver) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell !== 0) {
            const boardY = position.y + y;
            const boardX = position.x + x;
            if (
              boardY >= 0 &&
              boardY < BOARD_HEIGHT &&
              boardX >= 0 &&
              boardX < BOARD_WIDTH
            ) {
              ojamaBlocks.add(`${boardY},${boardX}`);
            }
          }
        });
      });
    }

    return (
      <div className="inline-block bg-black rounded-lg p-1">
        {displayBoard.map((row, y) => (
          <div key={y} className="flex">
            {row.map((cell, x) => {
              const isOjamaTopLeft = ojamaBlocks.has(`${y},${x}`);
              const isPartOfOjama2x2 =
                isOjamaTopLeft &&
                ojamaBlocks.has(`${y},${x + 1}`) &&
                ojamaBlocks.has(`${y + 1},${x}`) &&
                ojamaBlocks.has(`${y + 1},${x + 1}`);

              if (isPartOfOjama2x2) {
                return (
                  <div
                    key={x}
                    style={{
                      width: `${scaledCell}px`,
                      height: `${scaledCell}px`,
                      backgroundImage: 'url(/images/ojama-block.png)',
                      backgroundSize: `${scaledCell * 2}px ${scaledCell * 2}px`,
                      backgroundPosition: `0 0`,
                    }}
                  />
                );
              }

              const bgColor = cell ? `hsl(${(cell * 40) % 360}, 70%, 50%)` : '#111';
              return (
                <div
                  key={x}
                  style={{
                    width: `${scaledCell}px`,
                    height: `${scaledCell}px`,
                    backgroundColor: bgColor,
                    border: cell
                      ? `${scaledBorder}px solid rgba(255,255,255,0.3)`
                      : `1px solid rgba(255,255,255,0.1)`,
                  }}
                >
                  {cell ? (
                    <div
                      style={{
                        width: `${scaledInner}px`,
                        height: `${scaledInner}px`,
                        margin: `${scaledBorder}px`,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  if (showMenu) {
    return (
      <>
        <GameMenu
          onStartGame={startNewGame}
          onShowRanking={handleShowRanking}
          onShowHistory={handleShowHistory}
          user={user}
        />
        {showLeaderboard && (
          <Leaderboard
            isOpen={showLeaderboard}
            onClose={() => setShowLeaderboard(false)}
          />
        )}
        {showHistory && (
          <HistoryModal
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            currentUserFid={user?.fid}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white">
      <div
        className="flex-1 overflow-y-auto flex flex-col items-center justify-start py-4"
        style={{ paddingBottom: '80px' }}
      >
        <div className="w-full max-w-md px-4">
          <div className="flex justify-between items-start mb-4 gap-4">
            <div className="flex-1 space-y-2 text-sm">
              <div className="bg-black/30 rounded p-2">
                <div className="text-yellow-300 font-bold">SCORE</div>
                <div className="text-2xl font-mono">{score}</div>
              </div>
              <div className="bg-black/30 rounded p-2">
                <div className="text-green-300 font-bold">LEVEL</div>
                <div className="text-xl font-mono">{level}</div>
              </div>
              <div className="bg-black/30 rounded p-2">
                <div className="text-blue-300 font-bold">LINES</div>
                <div className="text-xl font-mono">{lines}</div>
              </div>
            </div>

            <div
              style={{
                marginTop: `${androidPushPx}px`,
                transition: 'margin-top 0.3s ease',
              }}
            >
              {renderBoard()}
            </div>

            <div className="flex-1 flex flex-col items-center space-y-2">
              <div className="text-sm text-purple-300 font-bold mb-1">NEXT</div>
              {renderNextPiece()}
            </div>
          </div>

          {DEBUG_OVERLAY && (
            <div className="bg-red-500/80 text-white text-xs p-2 rounded mb-2 font-mono">
              <div>W={viewport.w} H={viewport.h}</div>
              <div>Ratio={viewport.ratio.toFixed(2)}</div>
              <div>Farcaster={isInFarcaster ? 'Y' : 'N'}</div>
              <div>Android={androidLike ? 'Y' : 'N'}</div>
              <div>Tweak={shouldTweakAndroidSpacing ? 'Y' : 'N'}</div>
              <div>Push={androidPushPx}px</div>
              <div>Scale={layoutConfig.boardScale.toFixed(2)}</div>
            </div>
          )}

          {isPaused && !gameOver && (
            <div className="bg-yellow-500/90 text-black font-bold text-center py-2 px-4 rounded-lg mb-2">
              PAUSED - Press P to Resume
            </div>
          )}

          {gameOver && (
            <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 text-center space-y-4">
              <h2 className="text-3xl font-bold text-red-400 mb-2">GAME OVER</h2>
              <div className="text-xl">
                Final Score: <span className="text-yellow-300 font-bold">{score}</span>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={startNewGame}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                  RESTART
                </button>
                <button
                  onClick={handleBackToMenu}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  MENU
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!gameOver && gameStarted && (
        <div
          className="shrink-0 w-full bg-black/50 backdrop-blur-sm border-t border-white/10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div
            className="grid gap-2 p-3 mx-auto"
            style={{
              gridTemplateColumns: `repeat(5, ${layoutConfig.buttonSize}px)`,
              maxWidth: 'fit-content',
              gap: `${layoutConfig.gap}px`,
            }}
          >
            <button
              onClick={rotateCounterClockwise}
              className="bg-purple-600/80 hover:bg-purple-700 active:bg-purple-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                width: `${layoutConfig.buttonSize}px`,
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${layoutConfig.fontSize}px`,
              }}
            >
              ↺
            </button>
            <button
              onClick={rotate}
              className="bg-purple-600/80 hover:bg-purple-700 active:bg-purple-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                width: `${layoutConfig.buttonSize}px`,
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${layoutConfig.fontSize}px`,
              }}
            >
              ↻
            </button>
            <button
              onClick={moveLeft}
              className="bg-blue-600/80 hover:bg-blue-700 active:bg-blue-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                width: `${layoutConfig.buttonSize}px`,
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${layoutConfig.fontSize}px`,
              }}
            >
              ←
            </button>
            <button
              onClick={moveRight}
              className="bg-blue-600/80 hover:bg-blue-700 active:bg-blue-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                width: `${layoutConfig.buttonSize}px`,
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${layoutConfig.fontSize}px`,
              }}
            >
              →
            </button>
            <button
              onClick={moveDown}
              className="bg-blue-600/80 hover:bg-blue-700 active:bg-blue-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                width: `${layoutConfig.buttonSize}px`,
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${layoutConfig.fontSize}px`,
              }}
            >
              ↓
            </button>

            <button
              onClick={hardDrop}
              className="col-span-3 bg-red-600/80 hover:bg-red-700 active:bg-red-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${layoutConfig.fontSize}px`,
              }}
            >
              HARD DROP
            </button>
            <button
              onClick={togglePause}
              className="bg-yellow-600/80 hover:bg-yellow-700 active:bg-yellow-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                width: `${layoutConfig.buttonSize}px`,
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${Math.max(12, layoutConfig.fontSize - 2)}px`,
              }}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            <button
              onClick={handleBackToMenu}
              className="bg-gray-600/80 hover:bg-gray-700 active:bg-gray-800 rounded-lg font-bold transition-colors flex items-center justify-center"
              style={{
                width: `${layoutConfig.buttonSize}px`,
                height: `${layoutConfig.buttonSize}px`,
                fontSize: `${Math.max(11, layoutConfig.fontSize - 3)}px`,
              }}
            >
              MENU
            </button>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <Leaderboard
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showHistory && (
        <HistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          currentUserFid={user?.fid}
        />
      )}
    </div>
  );
};

export default TetrisGame;
