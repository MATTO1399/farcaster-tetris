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
import MintNFT from './MintNFT'; // ★ MintNFTは別ファイルで保持

interface TetrisGameProps {
  onGameOver?: (score: number) => void;
}

interface LayoutConfig {
  boardScale: number; sidePanelWidth: number; buttonSize: number; gap: number; paddingX: number; paddingTop: number; compact: boolean; ultraCompact: boolean; boardPanelGap: number; panelGap: number; controlsMaxWidth: number; titleSize: number; titleMarginBottom: number; nextCellSize: number; cardPaddingY: number; cardPaddingX: number; pauseButtonHeight: number; labelFontSize: number; valueFontSize: number; panelBorderRadius: number; sectionGap: number;
}

type RotationState = 0 | 1 | 2 | 3;

const DEBUG_OVERLAY = false;

// --- Kick Tables ---
const SRS_KICK_TABLE: Record<string, Position[]> = { '0->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }], '1->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }], '1->2': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }], '2->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }], '2->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }], '3->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }], '3->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: 2 }], '0->3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }] };
const SRS_I_KICK_TABLE: Record<string, Position[]> = { '0->1': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }], '1->0': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }], '1->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }], '2->1': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }], '2->3': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }], '3->2': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }], '3->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }], '0->3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }] };

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }
function getUADataPlatform(): string { const nav: any = typeof navigator !== 'undefined' ? navigator : null; return String(nav?.userAgentData?.platform ?? nav?.platform ?? ''); }
function isAndroidLike(): boolean { const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''; return /Android/i.test(ua) || /Android/i.test(getUADataPlatform()); }
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
  const [androidLike, setAndroidLike] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0, ratio: 0 });

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/siwe/me', { method: 'GET', cache: 'no-store', credentials: 'include' });
      const data = await response.json();
      if (data?.authenticated && typeof data?.address === 'string') { setSessionAddress(data.address.toLowerCase()); } else { setSessionAddress(null); }
    } catch { setSessionAddress(null); }
  }, []);

  useEffect(() => { void refreshSession(); }, [wagmiAddress, isConnected, refreshSession]);
  useEffect(() => { setAndroidLike(isAndroidLike()); }, []);

  useEffect(() => {
    const setAppHeight = () => {
      const vv = window.visualViewport;
      const h = Math.round(vv?.height ?? window.innerHeight);
      const w = Math.round(vv?.width ?? window.innerWidth);
      document.documentElement.style.setProperty('--app-height', `${h}px`);
      setViewport({ w, h, ratio: w ? h / w : 0 });
    };
    setAppHeight();
    window.visualViewport?.addEventListener('resize', setAppHeight);
    window.addEventListener('resize', setAppHeight);
    return () => { window.visualViewport?.removeEventListener('resize', setAppHeight); window.removeEventListener('resize', setAppHeight); };
  }, []);

  const layoutConfig = useMemo<LayoutConfig>(() => {
    const vw = viewport.w || 390; const vh = viewport.h || 844;
    const widthScale = clamp((vw - 24) / 430, 0.72, 1);
    const heightScale = clamp((vh - 24) / 920, 0.66, 1);
    const isNarrowScreen = vw <= 390; const isShortScreen = vh <= 760; const isVeryShortScreen = vh <= 700; const isLandscapeish = vh / vw < 1.1;
    let fitScale = Math.min(widthScale, heightScale);
    if (isShortScreen) fitScale *= 0.96; if (isVeryShortScreen) fitScale *= 0.93; if (isLandscapeish) fitScale *= 0.9;
    fitScale = clamp(fitScale, 0.58, 1);
    return {
      boardScale: fitScale, sidePanelWidth: clamp(Math.round(112 * fitScale), 88, 112), buttonSize: clamp(Math.round(64 * fitScale), 42, 68), gap: clamp(Math.round(8 * fitScale), 4, 10), paddingX: isNarrowScreen ? 8 : 12, paddingTop: isVeryShortScreen ? 6 : isShortScreen ? 10 : 14, compact: isShortScreen, ultraCompact: isVeryShortScreen || isLandscapeish, boardPanelGap: clamp(Math.round(10 * fitScale), 4, 10), panelGap: clamp(Math.round(8 * fitScale), 4, 10), controlsMaxWidth: clamp(Math.round(vw - 24), 220, 320), titleSize: clamp(Math.round(36 * fitScale), 24, 40), titleMarginBottom: isVeryShortScreen ? 8 : 14, nextCellSize: clamp(Math.round(18 * fitScale), 12, 18), cardPaddingY: isVeryShortScreen ? 8 : isShortScreen ? 10 : 12, cardPaddingX: isVeryShortScreen ? 8 : 10, pauseButtonHeight: clamp(Math.round(52 * fitScale), 40, 56), labelFontSize: clamp(Math.round(12 * fitScale), 10, 12), valueFontSize: clamp(Math.round(22 * fitScale), 16, 22), panelBorderRadius: isVeryShortScreen ? 12 : 14, sectionGap: clamp(Math.round(10 * fitScale), 6, 12),
    };
  }, [viewport]);

  const shouldCenterOnDesktop = viewport.w >= 768 && viewport.h >= 700 && !layoutConfig.compact;
  const scaledCell = Math.round(CELL_SIZE * layoutConfig.boardScale);
  const scaledBorder = Math.max(1, Math.round(2 * layoutConfig.boardScale));
  const scaledInner = Math.max(6, scaledCell - scaledBorder * 2);

  const controlButtonBaseStyle: React.CSSProperties = {
    width: `${layoutConfig.buttonSize}px`, height: `${layoutConfig.buttonSize}px`,
    minWidth: `${layoutConfig.buttonSize}px`, minHeight: `${layoutConfig.buttonSize}px`,
    borderRadius: `${Math.max(10, Math.round(layoutConfig.buttonSize * 0.18))}px`,
  };

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

  const moveLeft = useCallback(() => { if (!currentPiece) return; const n = { x: position.x - 1, y: position.y }; if (!checkCollision(board, { ...currentPiece, position: n }, { x: 0, y: 0 })) setPosition(n); }, [board, currentPiece, position]);
  const moveRight = useCallback(() => { if (!currentPiece) return; const n = { x: position.x + 1, y: position.y }; if (!checkCollision(board, { ...currentPiece, position: n }, { x: 0, y: 0 })) setPosition(n); }, [board, currentPiece, position]);
  const moveDown = useCallback(() => { if (!currentPiece) return; const n = { x: position.x, y: position.y + 1 }; if (!checkCollision(board, { ...currentPiece, position: n }, { x: 0, y: 0 })) setPosition(n); }, [board, currentPiece, position]);
  const rotate = useCallback(() => {
    if (!currentPiece || currentPiece.isOjama) return;
    const nextRot = ((rotationState + 1) % 4) as RotationState;
    const kicks = (currentPiece.type === 'I' ? SRS_I_KICK_TABLE : SRS_KICK_TABLE)[`${rotationState}->${nextRot}`] || [{ x: 0, y: 0 }];
    const rotated = rotateTetromino(currentPiece);
    for (const k of kicks) {
      const n = { x: position.x + k.x, y: position.y + k.y };
      if (!checkCollision(board, { ...rotated, position: n }, { x: 0, y: 0 })) { setCurrentPiece(rotated); setPosition(testPos); setRotationState(nextRot); return; }
    }
  }, [board, position, currentPiece, rotationState]);

  const hardDrop = useCallback(() => {
    if (!currentPiece) return; let d = { ...position };
    while (!checkCollision(board, { ...currentPiece, position: { x: d.x, y: d.y + 1 } }, { x: 0, y: 0 })) d.y++;
    lockPiece(d);
  }, [board, currentPiece, position, lockPiece]);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;
    const loop = setInterval(moveDown, Math.max(50, 500 / Math.pow(1.1, level - 1)));
    return () => clearInterval(loop);
  }, [gameStarted, gameOver, isPaused, level, moveDown]);

  const startNewGame = () => {
    const bgmList = ['/sounds/music_A.mp3', '/sounds/music_B.mp3', '/sounds/music_C.mp3'];
    if (bgmAudioRef.current) { bgmAudioRef.current.pause(); }
    bgmAudioRef.current = new Audio(bgmList[Math.floor(Math.random() * bgmList.length)]);
    bgmAudioRef.current.loop = true; bgmAudioRef.current.play();
    setBoard(createBoard()); setCurrentPiece(getRandomTetromino()); setNextPiece(getRandomTetromino());
    setScore(0); setLevel(1); setLines(0); setGameOver(false); setIsPaused(false); setGameStarted(true); setShowMenu(false);
  };

  const handleBackToMenu = () => { setGameStarted(false); setShowMenu(true); };
  const handleShowRanking = () => setShowLeaderboard(true);
  const handleShowHistory = () => setShowHistory(true);
  const handleSignedIn_Local = (addr: string) => setSessionAddress(addr.toLowerCase());
  const handleSignedOut_Local = () => setSessionAddress(null);

  const renderNextPiece = () => {
    if (!nextPiece) return null; const previewCell = layoutConfig.nextCellSize;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: `${previewCell * 4}px` }}>
        <div style={{ display: 'inline-block', position: 'relative' }}>
          {nextPiece.shape.map((row, y) => (
            <div key={y} style={{ display: 'flex' }}>
              {row.map((cell, x) => (
                <div key={`${y}-${x}`} style={{ width: previewCell, height: previewCell, backgroundColor: cell ? (nextPiece.isOjama ? 'transparent' : getTetrominoColor(nextPiece.type)) : 'transparent', border: cell ? '1px solid #444' : 'none', position: 'relative' }} />
              ))}
            </div>
          ))}
          {nextPiece.isOjama && <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: `${previewCell * 2 + 2}px`, height: `${previewCell * 2 + 2}px`, pointerEvents: 'none' }}><Image src="/ojama-block.png" alt="O" fill unoptimized /></div>}
        </div>
      </div>
    );
  };

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
    return (
      <div style={{ position: 'relative' }}>
        {displayBoard.map((row, y) => (
          <div key={y} style={{ display: 'flex' }}>
            {row.map((cell, x) => (
              <div key={`${y}-${x}`} style={{ width: scaledInner, height: scaledInner, backgroundColor: cell ? getTetrominoColor(cell as string) : '#1a1a1a', border: `${scaledBorder}px solid #333`, position: 'relative', boxSizing: 'content-box' }} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  if (showMenu) return (
    <>
      <GameMenu onStartGame={startNewGame} onShowHistory={handleShowHistory} onShowRanking={handleShowRanking} username={currentUserAddress ? formatAddress(currentUserAddress) : undefined} onSignedIn={handleSignedIn_Local} onSignedOut={handleSignedOut_Local} />
      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} currentUserAddress={currentUserAddress ?? undefined} />
    </>
  );

  return (
    <div className="w-full overflow-x-hidden overflow-y-auto bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800" style={{ minHeight: 'var(--app-height, 100dvh)', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex w-full flex-col items-center" style={{ maxWidth: 520, minHeight: 'calc(var(--app-height, 100dvh) - 40px)', paddingLeft: `${layoutConfig.paddingX}px`, paddingRight: `${layoutConfig.paddingX}px`, paddingTop: `${layoutConfig.paddingTop}px`, justifyContent: shouldCenterOnDesktop ? 'center' : 'flex-start' }}>
        <div className="text-center" style={{ marginBottom: `${layoutConfig.titleMarginBottom}px` }}>
          <h1 className="font-bold text-white tracking-wider" style={{ fontSize: `${layoutConfig.titleSize}px` }}>FARTETRIS</h1>
        </div>
        <div className="flex w-full items-start justify-center" style={{ gap: `${layoutConfig.boardPanelGap}px` }}>
          <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-purple-400/30 p-1 relative shrink-0">
            {renderBoard()}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg z-30">
                <div className="text-center px-4 w-full">
                  <p className="font-bold text-red-500 mb-2" style={{ fontSize: '30px' }}>GAME OVER</p>
                  <p className="text-white mb-4" style={{ fontSize: '20px' }}>Score: {score}</p>
                  <div className="mb-4">
                    {currentUserAddress && <MintNFT address={currentUserAddress} score={score} />}
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    <button onClick={startNewGame} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold shadow-lg">RETRY</button>
                    <button onClick={handleBackToMenu} className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full font-semibold shadow-lg">MENU</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col shrink-0" style={{ width: `${layoutConfig.sidePanelWidth}px`, gap: `${layoutConfig.panelGap}px` }}>
            <div className="bg-[#2c2363] text-center shadow-md p-2 rounded-xl">
              <p className="text-[#cbbcff] text-[12px]">スコア</p>
              <p className="font-extrabold text-white text-[22px]">{score}</p>
            </div>
            <div className="bg-[#2c2363] text-center shadow-md p-2 rounded-xl">
              <p className="text-[#cbbcff] text-[12px]">レベル</p>
              <p className="font-extrabold text-white text-[22px] mb-2">{level}</p>
              <p className="text-[#cbbcff] text-[12px]">ライン</p>
              <p className="font-extrabold text-white text-[22px]">{lines}</p>
            </div>
            <div className="bg-[#2c2363] text-center shadow-md p-2 rounded-xl">
              <p className="text-[#cbbcff] text-[12px] mb-2">Next</p>
              {renderNextPiece()}
            </div>
            <button onClick={() => setIsPaused(!isPaused)} className="w-full text-white font-extrabold shadow-md h-[52px] rounded-xl" style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' }}>{isPaused ? 'RESTART' : 'PAUSE'}</button>
          </div>
        </div>
        <div className="w-full flex flex-col items-center mt-4 gap-2">
          <div className="flex justify-center gap-2 w-full max-w-[320px]">
            <button onClick={rotateCounterClockwise} disabled={!gameStarted || gameOver || isPaused} className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>↺</button>
            <button onClick={rotate} disabled={!gameStarted || gameOver || isPaused} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>↻</button>
            <button onClick={hardDrop} disabled={!gameStarted || gameOver || isPaused} className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>DROP</button>
          </div>
          <div className="flex justify-center gap-2 w-full max-w-[320px]">
            <button onClick={moveLeft} disabled={!gameStarted || gameOver || isPaused} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>←</button>
            <button onClick={moveDown} disabled={!gameStarted || gameOver || isPaused} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>↓</button>
            <button onClick={moveRight} disabled={!gameStarted || gameOver || isPaused} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>→</button>
          </div>
        </div>
      </div>
      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} currentUserAddress={currentUserAddress ?? undefined} />
    </div>
  );
};

export default TetrisGame;
