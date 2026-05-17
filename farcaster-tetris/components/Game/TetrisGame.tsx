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
import MintNFT from './MintNFT'; // ★新しく作ったボタンをインポート

interface TetrisGameProps {
  onGameOver?: (score: number) => void;
}

interface LayoutConfig {
  boardScale: number; sidePanelWidth: number; buttonSize: number; gap: number; paddingX: number; paddingTop: number; compact: boolean; ultraCompact: boolean; boardPanelGap: number; panelGap: number; controlsMaxWidth: number; titleSize: number; titleMarginBottom: number; nextCellSize: number; cardPaddingY: number; cardPaddingX: number; pauseButtonHeight: number; labelFontSize: number; valueFontSize: number; panelBorderRadius: number; sectionGap: number;
}

type RotationState = 0 | 1 | 2 | 3;

// --- Kick Tables (SRS準拠) ---
const SRS_KICK_TABLE: Record<string, Position[]> = { '0->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }], '1->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }], '1->2': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }], '2->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }], '2->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }], '3->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }], '3->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: 2 }], '0->3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }] };
const SRS_I_KICK_TABLE: Record<string, Position[]> = { '0->1': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }], '1->0': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }], '1->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }], '2->1': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }], '2->3': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }], '3->2': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }], '3->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }], '0->3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }] };

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }
function isAndroidLike(): boolean { 
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /Android/i.test(ua);
}
function formatAddress(address?: string) { if (!address) return ''; return `${address.slice(0, 6)}...${address.slice(-4)}`; }

const TetrisGame: React.FC<TetrisGameProps> = ({ onGameOver }) => {
  const { address: wagmiAddress, isConnected } = useAccount();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const currentUserAddress = useMemo(() => sessionAddress ?? wagmiAddress?.toLowerCase() ?? null, [sessionAddress, wagmiAddress]);

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
  const [viewport, setViewport] = useState({ w: 0, h: 0, ratio: 0 });

  // --- 認証・セッション ---
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/siwe/me', { method: 'GET', cache: 'no-store' });
      const data = await response.json();
      if (data?.authenticated && data?.address) setSessionAddress(data.address.toLowerCase());
      else setSessionAddress(null);
    } catch { setSessionAddress(null); }
  }, []);

  useEffect(() => { void refreshSession(); }, [wagmiAddress, isConnected, refreshSession]);
  const handleSignedIn = (addr: string) => setSessionAddress(addr.toLowerCase());
  const handleSignedOut = () => setSessionAddress(null);

  // --- レイアウト設定 ---
  useEffect(() => {
    const setAppHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      const w = window.visualViewport?.width ?? window.innerWidth;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
      setViewport({ w, h, ratio: w ? h / w : 0 });
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);

  const layoutConfig = useMemo<LayoutConfig>(() => {
    const vw = viewport.w || 390; const vh = viewport.h || 844;
    const fitScale = clamp(Math.min((vw - 24) / 430, (vh - 24) / 920), 0.58, 1);
    return {
      boardScale: fitScale, sidePanelWidth: Math.round(112 * fitScale), buttonSize: Math.round(64 * fitScale),
      gap: 8, paddingX: 12, paddingTop: 14, compact: vh <= 760, ultraCompact: vh <= 700,
      boardPanelGap: 10, panelGap: 8, controlsMaxWidth: 320, titleSize: Math.round(36 * fitScale),
      titleMarginBottom: 14, nextCellSize: Math.round(18 * fitScale), cardPaddingY: 10, cardPaddingX: 10,
      pauseButtonHeight: 52, labelFontSize: 12, valueFontSize: 22, panelBorderRadius: 14, sectionGap: 10,
    };
  }, [viewport]);

  // --- ゲームロジック ---
  const finalizeGameOver = useCallback(async (finalScore: number) => {
    setGameOver(true);
    if (!currentUserAddress) return;
    try {
      const entry = { address: currentUserAddress, username: formatAddress(currentUserAddress), score: finalScore, level, lines, timestamp: Date.now() };
      await Promise.all([
        fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }),
        fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      ]);
    } catch (e) { console.error(e); }
    if (bgmAudioRef.current) bgmAudioRef.current.pause();
    onGameOver?.(finalScore);
  }, [currentUserAddress, level, lines, onGameOver]);

  const lockPiece = useCallback((lockPos: Position) => {
    if (!currentPiece || !nextPiece) return;
    let newBoard = mergeTetromino(board, { ...currentPiece, position: lockPos });
    let newScore = score;
    if (currentPiece.isOjama) {
      let count = 0; newBoard.forEach(row => row.forEach(c => { if(c) count++ }));
      newBoard = createBoard(); newScore += count * 10;
    } else {
      const { board: b, linesCleared: l } = clearLines(newBoard);
      newBoard = b; setLines(prev => prev + l); newScore += calculateScore(l, level);
    }
    setScore(newScore); setLevel(Math.floor(newScore / 1000) + 1); setBoard(newBoard);
    if (checkCollision(newBoard, nextPiece, { x: 0, y: 0 })) { void finalizeGameOver(newScore); return; }
    setCurrentPiece(nextPiece); setNextPiece(getRandomTetromino()); setPosition({ x: 3, y: 0 }); setRotationState(0);
  }, [board, currentPiece, nextPiece, level, score, finalizeGameOver]);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || !currentPiece) return;
    if (checkCollision(board, { ...currentPiece, position }, { x: 0, y: 0 })) {
      lockPiece({ x: position.x, y: position.y - 1 });
    }
  }, [position, board, currentPiece, gameStarted, gameOver, isPaused, lockPiece]);

  // --- 操作系 ---
  const moveLeft = () => { const n = { x: position.x - 1, y: position.y }; if (!checkCollision(board, { ...currentPiece!, position: n }, { x: 0, y: 0 })) setPosition(n); };
  const moveRight = () => { const n = { x: position.x + 1, y: position.y }; if (!checkCollision(board, { ...currentPiece!, position: n }, { x: 0, y: 0 })) setPosition(n); };
  const moveDown = () => { const n = { x: position.x, y: position.y + 1 }; if (!checkCollision(board, { ...currentPiece!, position: n }, { x: 0, y: 0 })) setPosition(n); };
  const rotate = () => {
    if (currentPiece?.isOjama) return;
    const nextRot = ((rotationState + 1) % 4) as RotationState;
    const kicks = (currentPiece?.type === 'I' ? SRS_I_KICK_TABLE : SRS_KICK_TABLE)[`${rotationState}->${nextRot}`] || [{ x: 0, y: 0 }];
    const rotated = rotateTetromino(currentPiece!);
    for (const k of kicks) {
      const n = { x: position.x + k.x, y: position.y + k.y };
      if (!checkCollision(board, { ...rotated, position: n }, { x: 0, y: 0 })) { setCurrentPiece(rotated); setPosition(n); setRotationState(nextRot); return; }
    }
  };
  const hardDrop = () => {
    let d = { ...position };
    while (!checkCollision(board, { ...currentPiece!, position: { x: d.x, y: d.y + 1 } }, { x: 0, y: 0 })) d.y++;
    lockPiece(d);
  };

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;
    const loop = setInterval(moveDown, Math.max(50, 500 / Math.pow(1.1, level - 1)));
    return () => clearInterval(loop);
  }, [gameStarted, gameOver, isPaused, level, moveDown]);

  const startNewGame = () => {
    setBoard(createBoard()); setCurrentPiece(getRandomTetromino()); setNextPiece(getRandomTetromino());
    setScore(0); setLevel(1); setLines(0); setGameOver(false); setIsPaused(false); setGameStarted(true); setShowMenu(false);
  };

  const handleBackToMenu = () => { setGameStarted(false); setShowMenu(true); };
  const handleShowRanking = () => setShowLeaderboard(true);
  const handleShowHistory = () => setShowHistory(true);

  // --- 表示系 ---
  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    if (!gameOver && currentPiece) {
      currentPiece.shape.forEach((row, y) => row.forEach((cell, x) => {
        if (cell) {
          const bY = position.y + y, bX = position.x + x;
          if (bY >= 0 && bY < BOARD_HEIGHT && bX >= 0 && bX < BOARD_WIDTH) displayBoard[bY][bX] = currentPiece.isOjama ? 'OJAMA' : currentPiece.type;
        }
      }));
    }
    const scaledInner = Math.max(6, Math.round(CELL_SIZE * layoutConfig.boardScale) - 4);
    return (
      <div className="relative">
        {displayBoard.map((row, y) => (
          <div key={y} className="flex">
            {row.map((cell, x) => (
              <div key={x} style={{ width: scaledInner, height: scaledInner }} className={`border-[1px] border-[#333] rounded-sm ${cell ? getTetrominoColor(cell as string) : 'bg-[#1a1a1a]'}`} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  if (showMenu) return (
    <>
      <GameMenu onStartGame={startNewGame} onShowHistory={handleShowHistory} onShowRanking={handleShowRanking} username={currentUserAddress ? formatAddress(currentUserAddress) : undefined} onSignedIn={handleSignedIn} onSignedOut={handleSignedOut} />
      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} currentUserAddress={currentUserAddress ?? undefined} />
    </>
  );

  return (
    <div className="w-full min-h-[100dvh] bg-gradient-to-br from-purple-900 to-indigo-900 text-white flex flex-col items-center p-4">
      <h1 className="font-bold text-3xl mb-4">FARTETRIS</h1>
      <div className="flex gap-4">
        <div className="bg-black/40 p-1 rounded-lg relative">
          {renderBoard()}
          {gameOver && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg z-50">
              <div className="text-center p-6 w-full">
                <p className="text-red-500 text-3xl font-bold mb-2">GAME OVER</p>
                <p className="text-xl mb-6">Score: {score}</p>
                
                {/* ★ NFTミントボタン（コンポーネント呼び出し） */}
                <div className="mb-4">
                  {currentUserAddress && <MintNFT address={currentUserAddress} score={score} />}
                </div>

                <div className="flex flex-col gap-3">
                  <button onClick={startNewGame} className="w-full py-3 bg-purple-600 rounded-full font-bold">RETRY</button>
                  <button onClick={handleBackToMenu} className="w-full py-3 bg-blue-600 rounded-full font-bold">MENU</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 w-28 text-center">
          <div className="bg-white/10 p-2 rounded-lg"><p className="text-xs opacity-70">SCORE</p><p className="text-xl font-bold">{score}</p></div>
          <div className="bg-white/10 p-2 rounded-lg"><p className="text-xs opacity-70">LEVEL</p><p className="text-xl font-bold">{level}</p></div>
          <button onClick={() => setIsPaused(!isPaused)} className="bg-orange-500 p-3 rounded-lg font-bold">{isPaused ? 'RESUME' : 'PAUSE'}</button>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button onClick={moveLeft} className="w-16 h-16 bg-white/20 rounded-lg text-2xl">←</button>
        <button onClick={moveDown} className="w-16 h-16 bg-white/20 rounded-lg text-2xl">↓</button>
        <button onClick={moveRight} className="w-16 h-16 bg-white/20 rounded-lg text-2xl">→</button>
        <button onClick={rotate} className="w-16 h-16 bg-purple-500 rounded-lg text-2xl">↻</button>
      </div>
    </div>
  );
};

export default TetrisGame;
