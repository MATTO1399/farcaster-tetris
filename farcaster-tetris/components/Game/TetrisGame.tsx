'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';
import Image from 'next/image';
import {
  createBoard,
  getRandomTetromino,
  rotateTetromino,
  checkCollision,
  mergeTetromino,
  clearLines,
  calculateScore,
  getTetrominoColor,
} from '@/utils/tetrisLogic';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from '@/utils/constants';
import type { Board, Tetromino, Position } from '@/utils/tetrisLogic';
import type { LeaderboardEntry } from '@/lib/leaderboard';
import type { HistoryEntry } from '@/lib/history';
import GameMenu from './GameMenu';
import LeaderboardModal from './LeaderboardModal';
import HistoryModal from './HistoryModal';

interface TetrisGameProps {
  onGameOver?: (score: number) => void;
}

interface LayoutConfig {
  boardScale: number;
  sidePanelWidth: number;
  buttonSize: number;
  gap: number;
  paddingX: number;
  paddingTop: number;
}

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
}

type RotationState = 0 | 1 | 2 | 3;

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
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: 2 },
  ],
  '0->3': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
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

  // ===== Platform / viewport helpers =====
  const [platform, setPlatform] = useState<'android' | 'ios' | 'web' | 'unknown'>('unknown');
  const [viewport, setViewport] = useState({ w: 0, h: 0, ratio: 0 });

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const uaAndroid = /Android/i.test(ua);
    if (uaAndroid) setPlatform('android'); // fallback（context取れない場合）

    // Farcaster context からも取る（取れれば優先）
    (async () => {
      try {
        const ctx: any = await sdk.context;
        const p = (ctx?.client?.platform || ctx?.platform || '').toString().toLowerCase();
        if (p.includes('android')) setPlatform('android');
        else if (p.includes('ios')) setPlatform('ios');
        else if (p) setPlatform('web');
      } catch {
        // ignore
      }
    })();
  }, []);

  // WebViewで100dvhが怪しいので、visualViewportから実高さをCSS変数に入れる（全端末で実行）
  useEffect(() => {
    const setAppHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);

      const w = window.innerWidth;
      const ratio = w ? h / w : 0;
      setViewport({ w, h, ratio });
    };

    setAppHeight();
    window.visualViewport?.addEventListener('resize', setAppHeight);
    window.visualViewport?.addEventListener('scroll', setAppHeight);
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', setAppHeight);
      window.visualViewport?.removeEventListener('scroll', setAppHeight);
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
    };
  }, []);

  const isAndroid = platform === 'android' || /Android/i.test(navigator.userAgent || '');

  // ★ ここが今回の肝：Androidかつ縦長なら、ボードを下に寄せる
  // Seekerみたいな縦長想定で閾値は2.0前後が効きやすい
  const shouldPushBoardDown = isAndroid && viewport.ratio >= 2.0;

  // ===== layout config =====
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    boardScale: 0.72,
    sidePanelWidth: 85,
    buttonSize: 56,
    gap: 5,
    paddingX: 12,
    paddingTop: 30,
  });

  useEffect(() => {
    const calculateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = height / width;

      let config: LayoutConfig;

      if (width <= 375) {
        if (aspectRatio > 2.0) {
          config = { boardScale: 0.68, sidePanelWidth: 80, buttonSize: 52, gap: 5, paddingX: 8, paddingTop: 15 };
        } else {
          config = { boardScale: 0.65, sidePanelWidth: 80, buttonSize: 50, gap: 5, paddingX: 8, paddingTop: 20 };
        }
      } else if (width <= 390) {
        config = { boardScale: 0.7, sidePanelWidth: 85, buttonSize: 54, gap: 5, paddingX: 10, paddingTop: 25 };
      } else if (width <= 414) {
        config = { boardScale: 0.75, sidePanelWidth: 90, buttonSize: 56, gap: 5, paddingX: 12, paddingTop: 30 };
      } else if (width <= 768) {
        if (aspectRatio < 1.0) {
          config = { boardScale: 0.6, sidePanelWidth: 95, buttonSize: 60, gap: 5, paddingX: 16, paddingTop: 20 };
        } else {
          config = { boardScale: 0.85, sidePanelWidth: 100, buttonSize: 64, gap: 5, paddingX: 16, paddingTop: 30 };
        }
      } else {
        config = { boardScale: 0.9, sidePanelWidth: 110, buttonSize: 68, gap: 5, paddingX: 20, paddingTop: 30 };
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

  const scaledCell = Math.round(CELL_SIZE * layoutConfig.boardScale);
  const scaledBorder = Math.max(1, Math.round(2 * layoutConfig.boardScale));
  const scaledInner = Math.max(6, scaledCell - scaledBorder * 2);

  // ===== Farcaster init =====
  useEffect(() => {
    const initFarcaster = async () => {
      try {
        const context = await sdk.context;
        if (context.user) {
          setUser({
            fid: context.user.fid,
            username: context.user.username || `user${context.user.fid}`,
            displayName: context.user.displayName || context.user.username || `User ${context.user.fid}`,
            pfpUrl: context.user.pfpUrl || '',
          });
        }
        sdk.actions.ready();
      } catch (error) {
        console.error('Farcaster SDK error:', error);
      }
    };
    initFarcaster();
  }, []);

  // ===== game loop =====
  useEffect(() => {
    if (gameOver || isPaused || !gameStarted || !currentPiece) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    let speed = level === 1 ? 500 : 500 / Math.pow(1.1, level - 1);
    speed = Math.max(50, speed);

    gameLoopRef.current = setInterval(() => {
      setPosition((prev) => ({ x: prev.x, y: prev.y + 1 }));
    }, speed);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameOver, isPaused, level, gameStarted, currentPiece]);

  const saveScoreToLeaderboard = async (finalScore: number) => {
    if (!user) return;

    try {
      const entry: LeaderboardEntry = {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        score: finalScore,
        level,
        lines,
        timestamp: Date.now(),
      };

      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to save score:', error);
    }
  };

  const saveScoreToHistory = async (finalScore: number) => {
    if (!user) return;

    try {
      const entry: HistoryEntry = {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        score: finalScore,
        level,
        lines,
        timestamp: Date.now(),
      };

      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const lockPiece = useCallback(
    (lockPosition: Position) => {
      if (!currentPiece || !nextPiece) return;

      const pieceToMerge = { ...currentPiece, position: lockPosition };
      let newBoard = mergeTetromino(board, pieceToMerge);
      let newScore = score;

      if (currentPiece.isOjama) {
        let blockCount = 0;
        for (let y = 0; y < BOARD_HEIGHT; y++) {
          for (let x = 0; x < BOARD_WIDTH; x++) {
            if (newBoard[y][x] !== null) blockCount++;
          }
        }
        newBoard = createBoard();
        const bonusScore = blockCount * 10;
        newScore = score + bonusScore;
        setScore(newScore);
      } else {
        const { board: clearedBoard, linesCleared } = clearLines(newBoard);
        newBoard = clearedBoard;

        setLines((prev) => prev + linesCleared);
        newScore = score + calculateScore(linesCleared, level);
        setScore(newScore);
      }

      const newLevel = Math.floor(newScore / 1000) + 1;
      if (newLevel > level) setLevel(newLevel);

      setBoard(newBoard);

      const newPiece = nextPiece;
      const newNext = getRandomTetromino();

      if (checkCollision(newBoard, newPiece, { x: 0, y: 0 })) {
        setGameOver(true);
        saveScoreToLeaderboard(newScore);
        saveScoreToHistory(newScore);
        onGameOver?.(newScore);
        return;
      }

      setCurrentPiece(newPiece);
      setNextPiece(newNext);
      setPosition({ x: 3, y: 0 });
      setRotationState(0);
    },
    [board, currentPiece, nextPiece, level, score, lines, onGameOver, user]
  );

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || !currentPiece) return;

    const pieceWithPosition = { ...currentPiece, position };
    if (checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) {
      const prevPosition = { x: position.x, y: position.y - 1 };
      lockPiece(prevPosition);
    }
  }, [position, board, currentPiece, gameStarted, gameOver, isPaused, lockPiece]);

  const moveLeft = useCallback(() => {
    if (isPaused || !currentPiece) return;
    const newPosition = { x: position.x - 1, y: position.y };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (!checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) setPosition(newPosition);
  }, [board, currentPiece, position, isPaused]);

  const moveRight = useCallback(() => {
    if (isPaused || !currentPiece) return;
    const newPosition = { x: position.x + 1, y: position.y };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (!checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) setPosition(newPosition);
  }, [board, currentPiece, position, isPaused]);

  const moveDown = useCallback(() => {
    if (isPaused || !currentPiece) return;
    const newPosition = { x: position.x, y: position.y + 1 };
    const pieceWithPosition = { ...currentPiece, position: newPosition };
    if (!checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) setPosition(newPosition);
  }, [board, currentPiece, position, isPaused]);

  const rotate = useCallback(() => {
    if (isPaused || !currentPiece || currentPiece.isOjama) return;

    const isIPiece = currentPiece.type === 'I';
    const kickTable = isIPiece ? SRS_I_KICK_TABLE : SRS_KICK_TABLE;
    const newRotationState = ((rotationState + 1) % 4) as RotationState;
    const transitionKey = `${rotationState}->${newRotationState}`;
    const kicks = kickTable[transitionKey] || [{ x: 0, y: 0 }];

    const rotated = rotateTetromino(currentPiece);

    for (const kick of kicks) {
      const testPosition = { x: position.x + kick.x, y: position.y + kick.y };
      const testPiece = { ...rotated, position: testPosition };
      if (!checkCollision(board, testPiece, { x: 0, y: 0 })) {
        setCurrentPiece(rotated);
        setPosition(testPosition);
        setRotationState(newRotationState);
        return;
      }
    }
  }, [board, position, currentPiece, rotationState, isPaused]);

  const rotateCounterClockwise = useCallback(() => {
    if (isPaused || !currentPiece || currentPiece.isOjama) return;

    const isIPiece = currentPiece.type === 'I';
    const kickTable = isIPiece ? SRS_I_KICK_TABLE : SRS_KICK_TABLE;
    const newRotationState = ((rotationState + 3) % 4) as RotationState;
    const transitionKey = `${rotationState}->${newRotationState}`;
    const kicks = kickTable[transitionKey] || [{ x: 0, y: 0 }];

    let rotated = currentPiece;
    for (let i = 0; i < 3; i++) rotated = rotateTetromino(rotated);

    for (const kick of kicks) {
      const testPosition = { x: position.x + kick.x, y: position.y + kick.y };
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
    if (isPaused || !currentPiece) return;

    let dropPosition = { ...position };
    while (true) {
      const nextPos = { x: dropPosition.x, y: dropPosition.y + 1 };
      const pieceWithPosition = { ...currentPiece, position: nextPos };
      if (checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) break;
      dropPosition = nextPos;
    }

    const pieceToMerge = { ...currentPiece, position: dropPosition };
    let newBoard = mergeTetromino(board, pieceToMerge);
    let newScore = score;

    if (currentPiece.isOjama) {
      let blockCount = 0;
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          if (newBoard[y][x] !== null) blockCount++;
        }
      }
      newBoard = createBoard();
      const bonusScore = blockCount * 10;
      newScore = score + bonusScore;
      setScore(newScore);
    } else {
      const { board: clearedBoard, linesCleared } = clearLines(newBoard);
      newBoard = clearedBoard;

      setLines((prev) => prev + linesCleared);
      newScore = score + calculateScore(linesCleared, level);
      setScore(newScore);
    }

    const newLevel = Math.floor(newScore / 1000) + 1;
    if (newLevel > level) setLevel(newLevel);

    setBoard(newBoard);

    const newPiece = nextPiece;
    const newNext = getRandomTetromino();

    if (newPiece && checkCollision(newBoard, newPiece, { x: 0, y: 0 })) {
      setGameOver(true);
      saveScoreToLeaderboard(newScore);
      saveScoreToHistory(newScore);
      onGameOver?.(newScore);
      return;
    }

    setCurrentPiece(newPiece);
    setNextPiece(newNext);
    setPosition({ x: 3, y: 0 });
    setRotationState(0);
  }, [board, currentPiece, nextPiece, position, isPaused, score, level, onGameOver, user, lines]);

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

  const startNewGame = () => {
    setBoard(createBoard());
    const firstPiece = getRandomTetromino();
    const secondPiece = getRandomTetromino();
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
    setGameStarted(false);
    setShowMenu(true);
    setGameOver(false);
  };

  const handleShowRanking = () => setShowLeaderboard(true);
  const handleShowHistory = () => setShowHistory(true);

  const renderBoard = () => {
    const displayBoard = board.map((row) => [...row]);

    if (!gameOver && currentPiece) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell === 1) {
            const boardY = position.y + y;
            const boardX = position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.isOjama ? 'OJAMA' : currentPiece.type;
            }
          }
        });
      });
    }

    const ojamaBlocks = new Set<string>();
    for (let y = 0; y < BOARD_HEIGHT - 1; y++) {
      for (let x = 0; x < BOARD_WIDTH - 1; x++) {
        if (
          displayBoard[y][x] === 'OJAMA' &&
          displayBoard[y][x + 1] === 'OJAMA' &&
          displayBoard[y + 1][x] === 'OJAMA' &&
          displayBoard[y + 1][x + 1] === 'OJAMA'
        ) {
          ojamaBlocks.add(`${y},${x}`);
        }
      }
    }

    return (
      <div style={{ position: 'relative' }}>
        {displayBoard.map((row, y) => (
          <div key={y} style={{ display: 'flex' }}>
            {row.map((cell, x) => {
              const isOjamaTopLeft = ojamaBlocks.has(`${y},${x}`);
              const isPartOfOjama2x2 =
                ojamaBlocks.has(`${y},${x}`) ||
                ojamaBlocks.has(`${y},${x - 1}`) ||
                ojamaBlocks.has(`${y - 1},${x}`) ||
                ojamaBlocks.has(`${y - 1},${x - 1}`);

              return (
                <div
                  key={`${y}-${x}`}
                  style={{
                    width: scaledInner,
                    height: scaledInner,
                    backgroundColor: cell
                      ? isPartOfOjama2x2
                        ? 'transparent'
                        : getTetrominoColor(cell as string)
                      : '#1a1a1a',
                    border: `${scaledBorder}px solid #333`,
                    borderRadius: '2px',
                    position: 'relative',
                    overflow: 'visible',
                  }}
                >
                  {isOjamaTopLeft && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${scaledBorder}px`,
                        left: `-${scaledBorder}px`,
                        width: `${scaledInner * 2 + scaledBorder * 2}px`,
                        height: `${scaledInner * 2 + scaledBorder * 2}px`,
                        pointerEvents: 'none',
                        zIndex: 10,
                      }}
                    >
                      <Image src="/ojama-block.png" alt="Ojama Block" fill style={{ objectFit: 'cover' }} unoptimized />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderNextPiece = () => {
    if (!nextPiece) return null;
    const isOjamaNext = nextPiece.isOjama;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px' }}>
        <div style={{ display: 'inline-block', position: 'relative' }}>
          {nextPiece.shape.map((row, y) => (
            <div key={y} style={{ display: 'flex' }}>
              {row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  style={{
                    width: 15,
                    height: 15,
                    backgroundColor: cell === 1 ? (isOjamaNext ? 'transparent' : getTetrominoColor(nextPiece.type)) : 'transparent',
                    border: cell === 1 ? '1px solid #444' : 'none',
                    borderRadius: '1px',
                    position: 'relative',
                  }}
                />
              ))}
            </div>
          ))}

          {isOjamaNext && (
            <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '32px', height: '32px', pointerEvents: 'none' }}>
              <Image src="/ojama-block.png" alt="Ojama Block" fill style={{ objectFit: 'cover' }} unoptimized />
            </div>
          )}
        </div>
      </div>
    );
  };

  if (showMenu) {
    return (
      <>
        <GameMenu
          onStartGame={startNewGame}
          onShowHistory={handleShowHistory}
          onShowRanking={handleShowRanking}
          username={user?.username}
          pfpUrl={user?.pfpUrl}
        />
        <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} currentUserFid={user?.fid} />
        <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} currentUserFid={user?.fid} />
      </>
    );
  }

  return (
    <div
      className="flex flex-col w-full overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800"
      style={{
        // ★ 100dvhより安定（WebView含む）
        height: 'var(--app-height, 100dvh)',
        paddingTop: 'env(safe-area-inset-top)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Main */}
      <div
        className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center"
        style={{
          paddingTop: `${layoutConfig.paddingTop}px`,
          paddingBottom: '12px',
        }}
      >
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg tracking-wider">FARTETRIS</h1>
        </div>

        {/* ★ Android縦長だけ：ここで余白を吸わせて、ゲーム本体を下に寄せる */}
        {shouldPushBoardDown ? <div style={{ flex: 1 }} /> : null}

        <div
          className="flex items-center justify-center w-full max-w-md"
          style={{
            gap: '5px',
            paddingLeft: `${layoutConfig.paddingX}px`,
            paddingRight: `${layoutConfig.paddingX}px`,
            // もう一段確実に下へ寄せたい場合（Android縦長だけ）
            marginTop: shouldPushBoardDown ? 'auto' : undefined,
          }}
        >
          <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-purple-400/30 p-1 relative">
            {renderBoard()}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg z-30">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500 mb-4">GAME OVER</p>
                  <p className="text-xl text-white mb-4">Score: {score}</p>
                  <div className="flex flex-col gap-3 w-full">
                    <button
                      onClick={startNewGame}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full font-semibold transition-colors shadow-lg"
                    >
                      RETRY
                    </button>
                    <button
                      onClick={handleBackToMenu}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-full font-semibold transition-colors shadow-lg"
                    >
                      MENU
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5" style={{ width: `${layoutConfig.sidePanelWidth}px` }}>
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1.5 border border-purple-400/20 text-center">
              <p className="text-xs text-purple-300 mb-0.5">スコア</p>
              <p className="text-base font-bold text-white">{score}</p>
            </div>

            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1.5 border border-purple-400/20 text-center">
              <p className="text-xs text-purple-300">レベル</p>
              <p className="text-sm font-bold text-white mb-1">{level}</p>
              <p className="text-xs text-purple-300">ライン</p>
              <p className="text-sm font-bold text-white">{lines}</p>
            </div>

            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1.5 border border-purple-400/20">
              <p className="text-xs text-purple-300 mb-1 text-center">Next</p>
              {renderNextPiece()}
            </div>

            <button
              onClick={togglePause}
              className="w-full py-1.5 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {isPaused ? 'RESTART' : 'PAUSE'}
            </button>
          </div>
        </div>
      </div>

      {/* Controls (NOT fixed) */}
      <div
        className="shrink-0 w-full flex flex-col items-center bg-gradient-to-t from-purple-900/95 to-transparent backdrop-blur-sm py-2"
        style={{
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
          gap: '6px',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        <div className="flex justify-center" style={{ gap: `${layoutConfig.gap}px` }}>
          <button
            onClick={rotateCounterClockwise}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{
              width: `${layoutConfig.buttonSize}px`,
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.35}px`,
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
            }}
          >
            DROP
          </button>
        </div>

        <div className="flex justify-center" style={{ gap: `${layoutConfig.gap}px` }}>
          <button
            onClick={moveLeft}
            disabled={!gameStarted || gameOver || isPaused}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex-shrink-0"
            style={{
              width: `${layoutConfig.buttonSize}px`,
              height: `${layoutConfig.buttonSize}px`,
              fontSize: `${layoutConfig.buttonSize * 0.35}px`,
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
            }}
          >
            →
          </button>
        </div>
      </div>

      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} currentUserFid={user?.fid} />
      <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} currentUserFid={user?.fid} />
    </div>
  );
};

export default TetrisGame;
