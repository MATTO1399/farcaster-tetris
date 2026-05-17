'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import {
  createBoard,
  getRandomTetromino,
  rotateTetromino,
  checkCollision,
  mergeTetromino,
  clearLines,
  calculateScore,
  getTetrominoColor,
} from '../../utils/tetrisLogic';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from '../../utils/constants';
import type { Board, Tetromino, Position } from '../../utils/tetrisLogic';
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
  compact: boolean;
  ultraCompact: boolean;
  boardPanelGap: number;
  panelGap: number;
  controlsMaxWidth: number;
  titleSize: number;
  titleMarginBottom: number;
  nextCellSize: number;
  cardPaddingY: number;
  cardPaddingX: number;
  pauseButtonHeight: number;
  labelFontSize: number;
  valueFontSize: number;
  panelBorderRadius: number;
  sectionGap: number;
}

type RotationState = 0 | 1 | 2 | 3;

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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function getUADataPlatform(): string {
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  const p = nav?.userAgentData?.platform ?? nav?.platform ?? '';
  return String(p || '');
}

function isAndroidLike(): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const plat = getUADataPlatform();
  return /Android/i.test(ua) || /Android/i.test(plat);
}

function formatAddress(address?: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const TetrisGame: React.FC<TetrisGameProps> = ({ onGameOver }) => {
  // ★ wagmi の接続状態を取得
  const { address: wagmiAddress, isConnected } = useAccount();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);

  // ★ ウォレット接続中なら表示、切断中は null（Cookie が残っていても無視）
  //    優先順位は wagmi → SIWE。これで接続直後の表示の遅れを防ぐ
  const currentUserAddress = isConnected
    ? (wagmiAddress?.toLowerCase() ?? sessionAddress ?? null)
    : null;

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

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const [androidLike, setAndroidLike] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0, ratio: 0 });

  // ★ SIWE セッションを再取得する共通関数
  const refreshSessionAddress = useCallback(async () => {
    try {
      const response = await fetch('/api/siwe/me', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json();
      if (data?.authenticated && typeof data?.address === 'string') {
        setSessionAddress(data.address.toLowerCase());
      } else {
        setSessionAddress(null);
      }
    } catch {
      setSessionAddress(null);
    }
  }, []);

  // ★ サーバー側 SIWE セッションを破棄（切断時用、無ければ無視される）
  const clearServerSession = useCallback(async () => {
    try {
      await fetch('/api/siwe/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // logout エンドポイントが無い場合などは黙って無視
    }
  }, []);

  // ★ 接続状態が変わったら /api/siwe/me を再取得
  //   切断された瞬間は sessionAddress を null にし、サーバーセッションも破棄
  useEffect(() => {
    let cancelled = false;

    if (!isConnected) {
      setSessionAddress(null);
      void clearServerSession();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      if (cancelled) return;
      await refreshSessionAddress();
    })();

    return () => {
      cancelled = true;
    };
  }, [wagmiAddress, isConnected, refreshSessionAddress, clearServerSession]);

  // ★ タブが可視化されたとき／フォーカスが戻ったときにセッションを再確認
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isConnected) {
        void refreshSessionAddress();
      }
    };
    const handleFocus = () => {
      if (isConnected) void refreshSessionAddress();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, refreshSessionAddress]);

  useEffect(() => {
    setAndroidLike(isAndroidLike());
  }, []);

  useEffect(() => {
    const setAppHeight = () => {
      const vv = window.visualViewport;
      const h = Math.round(vv?.height ?? window.innerHeight);
      const w = Math.round(vv?.width ?? window.innerWidth);

      document.documentElement.style.setProperty('--app-height', `${h}px`);

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

  const layoutConfig = useMemo<LayoutConfig>(() => {
    const vw = viewport.w || 390;
    const vh = viewport.h || 844;

    const widthScale = clamp((vw - 24) / 430, 0.72, 1);
    const heightScale = clamp((vh - 24) / 920, 0.66, 1);

    const isNarrowScreen = vw <= 390;
    const isShortScreen = vh <= 760;
    const isVeryShortScreen = vh <= 700;
    const isLandscapeish = vh / vw < 1.1;

    let fitScale = Math.min(widthScale, heightScale);

    if (isShortScreen) fitScale *= 0.96;
    if (isVeryShortScreen) fitScale *= 0.93;
    if (isLandscapeish) fitScale *= 0.9;

    fitScale = clamp(fitScale, 0.58, 1);

    return {
      boardScale: fitScale,
      sidePanelWidth: clamp(Math.round(112 * fitScale), 88, 112),
      buttonSize: clamp(Math.round(64 * fitScale), 42, 68),
      gap: clamp(Math.round(8 * fitScale), 4, 10),
      paddingX: isNarrowScreen ? 8 : 12,
      paddingTop: isVeryShortScreen ? 6 : isShortScreen ? 10 : 14,
      compact: isShortScreen,
      ultraCompact: isVeryShortScreen || isLandscapeish,
      boardPanelGap: clamp(Math.round(10 * fitScale), 4, 10),
      panelGap: clamp(Math.round(8 * fitScale), 4, 10),
      controlsMaxWidth: clamp(Math.round(vw - 24), 220, 320),
      titleSize: clamp(Math.round(36 * fitScale), 24, 40),
      titleMarginBottom: isVeryShortScreen ? 8 : 14,
      nextCellSize: clamp(Math.round(18 * fitScale), 12, 18),
      cardPaddingY: isVeryShortScreen ? 8 : isShortScreen ? 10 : 12,
      cardPaddingX: isVeryShortScreen ? 8 : 10,
      pauseButtonHeight: clamp(Math.round(52 * fitScale), 40, 56),
      labelFontSize: clamp(Math.round(12 * fitScale), 10, 12),
      valueFontSize: clamp(Math.round(22 * fitScale), 16, 22),
      panelBorderRadius: isVeryShortScreen ? 12 : 14,
      sectionGap: clamp(Math.round(10 * fitScale), 6, 12),
    };
  }, [viewport.w, viewport.h]);

  const shouldCenterOnDesktop =
    viewport.w >= 768 && viewport.h >= 700 && !layoutConfig.compact;

  const scaledCell = Math.round(CELL_SIZE * layoutConfig.boardScale);
  const scaledBorder = Math.max(1, Math.round(2 * layoutConfig.boardScale));
  const scaledInner = Math.max(6, scaledCell - scaledBorder * 2);

  const shouldTweakAndroidSpacing =
    androidLike &&
    viewport.w <= 450 &&
    viewport.ratio >= 1.85 &&
    !layoutConfig.ultraCompact;

  const androidPushPx = shouldTweakAndroidSpacing
    ? Math.round(clamp((viewport.h - 680) * 0.4, 8, 32))
    : 0;

  const controlButtonBaseStyle: React.CSSProperties = {
    width: `${layoutConfig.buttonSize}px`,
    height: `${layoutConfig.buttonSize}px`,
    minWidth: `${layoutConfig.buttonSize}px`,
    minHeight: `${layoutConfig.buttonSize}px`,
    borderRadius: `${Math.max(10, Math.round(layoutConfig.buttonSize * 0.18))}px`,
  };

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

  const saveScoreToLeaderboard = useCallback(
    async (finalScore: number) => {
      if (!currentUserAddress) return;

      try {
        const entry = {
          address: currentUserAddress,
          username: formatAddress(currentUserAddress),
          displayName: formatAddress(currentUserAddress),
          pfpUrl: '',
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
    },
    [currentUserAddress, level, lines]
  );

  const saveScoreToHistory = useCallback(
    async (finalScore: number) => {
      if (!currentUserAddress) return;

      try {
        const entry = {
          address: currentUserAddress,
          username: formatAddress(currentUserAddress),
          displayName: formatAddress(currentUserAddress),
          pfpUrl: '',
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
    },
    [currentUserAddress, level, lines]
  );

  const finalizeGameOver = useCallback(
    async (finalScore: number) => {
      setGameOver(true);

      try {
        await Promise.all([
          saveScoreToLeaderboard(finalScore),
          saveScoreToHistory(finalScore),
        ]);
      } catch (error) {
        console.error('Failed to finalize game over:', error);
      }

      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current.currentTime = 0;
      }

      onGameOver?.(finalScore);
    },
    [onGameOver, saveScoreToLeaderboard, saveScoreToHistory]
  );

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
        void finalizeGameOver(newScore);
        return;
      }

      setCurrentPiece(newPiece);
      setNextPiece(newNext);
      setPosition({ x: 3, y: 0 });
      setRotationState(0);
    },
    [board, currentPiece, nextPiece, level, score, finalizeGameOver]
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
      void finalizeGameOver(newScore);
      return;
    }

    setCurrentPiece(newPiece);
    setNextPiece(newNext);
    setPosition({ x: 3, y: 0 });
    setRotationState(0);
  }, [board, currentPiece, nextPiece, position, isPaused, score, level, finalizeGameOver]);

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
    const bgmList = ['/sounds/music_A.mp3', '/sounds/music_B.mp3', '/sounds/music_C.mp3'];
    const randomBGM = bgmList[Math.floor(Math.random() * bgmList.length)];

    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
    }

    bgmAudioRef.current = new Audio(randomBGM);
    bgmAudioRef.current.loop = true;
    bgmAudioRef.current.volume = 0.3;
    bgmAudioRef.current.play().catch((err) => {
      console.error('BGM:', err);
    });

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

  const handleBackToMenu = () => {
    setGameStarted(false);
    setShowMenu(true);
    setGameOver(false);

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
    const previewCell = layoutConfig.nextCellSize;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: `${previewCell * 4}px`,
        }}
      >
        <div style={{ display: 'inline-block', position: 'relative' }}>
          {nextPiece.shape.map((row, y) => (
            <div key={y} style={{ display: 'flex' }}>
              {row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  style={{
                    width: previewCell,
                    height: previewCell,
                    backgroundColor:
                      cell === 1
                        ? isOjamaNext
                          ? 'transparent'
                          : getTetrominoColor(nextPiece.type)
                        : 'transparent',
                    border: cell === 1 ? '1px solid #444' : 'none',
                    borderRadius: '1px',
                    position: 'relative',
                  }}
                />
              ))}
            </div>
          ))}

          {isOjamaNext && (
            <div
              style={{
                position: 'absolute',
                top: '-1px',
                left: '-1px',
                width: `${previewCell * 2 + 2}px`,
                height: `${previewCell * 2 + 2}px`,
                pointerEvents: 'none',
              }}
            >
              <Image src="/ojama-block.png" alt="Ojama Block" fill style={{ objectFit: 'cover' }} unoptimized />
            </div>
          )}
        </div>
      </div>
    );
  };

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
                    boxSizing: 'content-box',
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

  if (showMenu) {
    return (
      <>
        <GameMenu
          onStartGame={startNewGame}
          onShowHistory={handleShowHistory}
          onShowRanking={handleShowRanking}
          username={currentUserAddress ? formatAddress(currentUserAddress) : undefined}
        />
        <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
        <HistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          currentUserAddress={currentUserAddress ?? undefined}
        />
      </>
    );
  }

  return (
    <div
      className="w-full overflow-x-hidden overflow-y-auto bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800"
      style={{
        minHeight: 'var(--app-height, 100dvh)',
        paddingTop: 'env(safe-area-inset-top)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {DEBUG_OVERLAY && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999,
            fontSize: 12,
            background: '#000',
            color: '#0f0',
            padding: 6,
            lineHeight: 1.2,
          }}
        >
          androidLike={String(androidLike)}
          <br />
          uaPlatform={getUADataPlatform()}
          <br />
          ratio={viewport.ratio.toFixed(2)} h={viewport.h} w={viewport.w}
          <br />
          tweak={String(shouldTweakAndroidSpacing)} pushPx={androidPushPx}
        </div>
      )}

      <div
        className="mx-auto flex w-full flex-col items-center"
        style={{
          maxWidth: 520,
          minHeight:
            'calc(var(--app-height, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
          paddingLeft: `${layoutConfig.paddingX}px`,
          paddingRight: `${layoutConfig.paddingX}px`,
          paddingTop: shouldCenterOnDesktop ? '16px' : `${layoutConfig.paddingTop}px`,
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          gap: `${layoutConfig.sectionGap}px`,
          boxSizing: 'border-box',
          justifyContent: shouldCenterOnDesktop ? 'center' : 'flex-start',
        }}
      >
        <div className="text-center" style={{ marginBottom: `${layoutConfig.titleMarginBottom}px` }}>
          <h1
            className="font-bold text-white drop-shadow-lg tracking-wider"
            style={{
              fontSize: `${layoutConfig.titleSize}px`,
              lineHeight: 1.05,
            }}
          >
            FARTETRIS
          </h1>
        </div>

        {androidPushPx > 0 ? <div style={{ height: androidPushPx }} /> : null}

        <div
          className="flex w-full items-start justify-center"
          style={{
            gap: `${layoutConfig.boardPanelGap}px`,
          }}
        >
          <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-purple-400/30 p-1 relative shrink-0">
            {renderBoard()}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg z-30">
                <div className="text-center px-3">
                  <p
                    className="font-bold text-red-500 mb-4"
                    style={{ fontSize: layoutConfig.ultraCompact ? '22px' : '30px' }}
                  >
                    GAME OVER
                  </p>
                  <p
                    className="text-white mb-4"
                    style={{ fontSize: layoutConfig.ultraCompact ? '16px' : '20px' }}
                  >
                    Score: {score}
                  </p>
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

          <div
            className="flex flex-col shrink-0"
            style={{
              width: `${layoutConfig.sidePanelWidth}px`,
              gap: `${layoutConfig.panelGap}px`,
            }}
          >
            <div
              className="bg-[#2c2363] text-center shadow-md"
              style={{
                borderRadius: `${layoutConfig.panelBorderRadius}px`,
                padding: `${layoutConfig.cardPaddingY}px ${layoutConfig.cardPaddingX}px`,
              }}
            >
              <p
                className="text-[#cbbcff] mb-1 font-semibold tracking-wide"
                style={{ fontSize: `${layoutConfig.labelFontSize}px` }}
              >
                スコア
              </p>
              <p
                className="font-extrabold text-white leading-none"
                style={{ fontSize: `${layoutConfig.valueFontSize}px` }}
              >
                {score}
              </p>
            </div>

            <div
              className="bg-[#2c2363] text-center shadow-md"
              style={{
                borderRadius: `${layoutConfig.panelBorderRadius}px`,
                padding: `${layoutConfig.cardPaddingY}px ${layoutConfig.cardPaddingX}px`,
              }}
            >
              <p
                className="text-[#cbbcff] mb-1 font-semibold tracking-wide"
                style={{ fontSize: `${layoutConfig.labelFontSize}px` }}
              >
                レベル
              </p>
              <p
                className="font-extrabold text-white leading-none"
                style={{
                  fontSize: `${layoutConfig.valueFontSize}px`,
                  marginBottom: layoutConfig.compact ? '8px' : '12px',
                }}
              >
                {level}
              </p>

              <p
                className="text-[#cbbcff] mb-1 font-semibold tracking-wide"
                style={{ fontSize: `${layoutConfig.labelFontSize}px` }}
              >
                ライン
              </p>
              <p
                className="font-extrabold text-white leading-none"
                style={{ fontSize: `${layoutConfig.valueFontSize}px` }}
              >
                {lines}
              </p>
            </div>

            <div
              className="bg-[#2c2363] text-center shadow-md"
              style={{
                borderRadius: `${layoutConfig.panelBorderRadius}px`,
                padding: `${layoutConfig.cardPaddingY}px ${layoutConfig.cardPaddingX}px`,
              }}
            >
              <p
                className="text-[#cbbcff] mb-2 font-semibold tracking-wide"
                style={{ fontSize: `${layoutConfig.labelFontSize}px` }}
              >
                Next
              </p>
              <div
                className="flex items-center justify-center"
                style={{
                  minHeight: `${layoutConfig.nextCellSize * 4}px`,
                }}
              >
                {renderNextPiece()}
              </div>
            </div>

            <button
              onClick={() => setIsPaused((prev) => !prev)}
              className="w-full text-white font-extrabold shadow-md"
              style={{
                height: `${layoutConfig.pauseButtonHeight}px`,
                borderRadius: `${layoutConfig.panelBorderRadius}px`,
                fontSize: `${Math.max(12, Math.round(layoutConfig.buttonSize * 0.24))}px`,
                background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
              }}
            >
              {isPaused ? 'RESTART' : 'PAUSE'}
            </button>
          </div>
        </div>

        <div
          className="w-full flex flex-col items-center"
          style={{
            gap: `${layoutConfig.gap}px`,
            marginTop: `${layoutConfig.compact ? 0 : 2}px`,
          }}
        >
          <div
            className="flex justify-center"
            style={{
              gap: `${layoutConfig.gap}px`,
              width: '100%',
              maxWidth: `${layoutConfig.controlsMaxWidth}px`,
            }}
          >
            <button
              onClick={rotateCounterClockwise}
              disabled={!gameStarted || gameOver || isPaused}
              className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold transition-colors flex-shrink-0"
              style={{
                ...controlButtonBaseStyle,
                fontSize: `${Math.max(16, layoutConfig.buttonSize * 0.35)}px`,
              }}
            >
              ↺
            </button>
            <button
              onClick={rotate}
              disabled={!gameStarted || gameOver || isPaused}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold transition-colors flex-shrink-0"
              style={{
                ...controlButtonBaseStyle,
                fontSize: `${Math.max(16, layoutConfig.buttonSize * 0.35)}px`,
              }}
            >
              ↻
            </button>
            <button
              onClick={hardDrop}
              disabled={!gameStarted || gameOver || isPaused}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold transition-colors flex-shrink-0"
              style={{
                ...controlButtonBaseStyle,
                fontSize: `${Math.max(13, layoutConfig.buttonSize * 0.28)}px`,
              }}
            >
              DROP
            </button>
          </div>

          <div
            className="flex justify-center"
            style={{
              gap: `${layoutConfig.gap}px`,
              width: '100%',
              maxWidth: `${layoutConfig.controlsMaxWidth}px`,
            }}
          >
            <button
              onClick={moveLeft}
              disabled={!gameStarted || gameOver || isPaused}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold transition-colors flex-shrink-0"
              style={{
                ...controlButtonBaseStyle,
                fontSize: `${Math.max(16, layoutConfig.buttonSize * 0.35)}px`,
              }}
            >
              ←
            </button>
            <button
              onClick={moveDown}
              disabled={!gameStarted || gameOver || isPaused}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold transition-colors flex-shrink-0"
              style={{
                ...controlButtonBaseStyle,
                fontSize: `${Math.max(16, layoutConfig.buttonSize * 0.35)}px`,
              }}
            >
              ↓
            </button>
            <button
              onClick={moveRight}
              disabled={!gameStarted || gameOver || isPaused}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold transition-colors flex-shrink-0"
              style={{
                ...controlButtonBaseStyle,
                fontSize: `${Math.max(16, layoutConfig.buttonSize * 0.35)}px`,
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        currentUserAddress={currentUserAddress ?? undefined}
      />
    </div>
  );
};

export default TetrisGame;
