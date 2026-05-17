'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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
  boardScale: number; sidePanelWidth: number; buttonSize: number; gap: number; paddingX: number; paddingTop: number; compact: boolean; ultraCompact: boolean; boardPanelGap: number; panelGap: number; controlsMaxWidth: number; titleSize: number; titleMarginBottom: number; nextCellSize: number; cardPaddingY: number; cardPaddingX: number; pauseButtonHeight: number; labelFontSize: number; valueFontSize: number; panelBorderRadius: number; sectionGap: number;
}

type RotationState = 0 | 1 | 2 | 3;

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

  // NFTミント用
  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash });
  const [pendingNftLabel, setPendingNftLabel] = useState<string | null>(null);

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

  // SIWE / 認証
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/siwe/me', { method: 'GET', cache: 'no-store', credentials: 'include' });
      const data = await response.json();
      if (data?.authenticated && typeof data?.address === 'string') {
        setSessionAddress(data.address.toLowerCase());
      } else { setSessionAddress(null); }
    } catch { setSessionAddress(null); }
  }, []);

  const handleSignedIn = useCallback((address: string) => { setSessionAddress(address.toLowerCase()); }, []);
  const handleSignedOut = useCallback(() => { setSessionAddress(null); }, []);

  useEffect(() => { void refreshSession(); }, [wagmiAddress, isConnected, refreshSession]);
  useEffect(() => { setAndroidLike(isAndroidLike()); }, []);

  // Viewport / Layout
  useEffect(() => {
    const setAppHeight = () => {
      const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
      const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
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
    const isShortScreen = vh <= 760; const isVeryShortScreen = vh <= 700; const isLandscapeish = vh / vw < 1.1;
    let fitScale = Math.min(widthScale, heightScale);
    if (isShortScreen) fitScale *= 0.96; if (isVeryShortScreen) fitScale *= 0.93; if (isLandscapeish) fitScale *= 0.9;
    fitScale = clamp(fitScale, 0.58, 1);
    return {
      boardScale: fitScale, sidePanelWidth: clamp(Math.round(112 * fitScale), 88, 112), buttonSize: clamp(Math.round(64 * fitScale), 42, 68), gap: clamp(Math.round(8 * fitScale), 4, 10), paddingX: vw <= 390 ? 8 : 12, paddingTop: isVeryShortScreen ? 6 : isShortScreen ? 10 : 14, compact: isShortScreen, ultraCompact: isVeryShortScreen || isLandscapeish, boardPanelGap: clamp(Math.round(10 * fitScale), 4, 10), panelGap: clamp(Math.round(8 * fitScale), 4, 10), controlsMaxWidth: clamp(Math.round(vw - 24), 220, 320), titleSize: clamp(Math.round(36 * fitScale), 24, 40), titleMarginBottom: isVeryShortScreen ? 8 : 14, nextCellSize: clamp(Math.round(18 * fitScale), 12, 18), cardPaddingY: isVeryShortScreen ? 8 : isShortScreen ? 10 : 12, cardPaddingX: isVeryShortScreen ? 8 : 10, pauseButtonHeight: clamp(Math.round(52 * fitScale), 40, 56), labelFontSize: clamp(Math.round(12 * fitScale), 10, 12), valueFontSize: clamp(Math.round(22 * fitScale), 16, 22), panelBorderRadius: isVeryShortScreen ? 12 : 14, sectionGap: clamp(Math.round(10 * fitScale), 6, 12),
    };
  }, [viewport.w, viewport.h]);

  // NFTミント実行関数
  const handleMintNFT = async () => {
    if (!currentUserAddress) { alert('ミントするにはログインが必要です'); return; }
    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: currentUserAddress, score: score })
      });
      const data = await res.json();
      if (data.error) { alert(`ミント条件: ${data.error}`); return; }
      setPendingNftLabel(data.nftLabel);

      writeContract({
        address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
    } catch (error) { console.error('Mint Error:', error); alert('ミント中にエラーが発生しました'); }
  };

  // スコア保存 / ゲームロジック
  const saveScoreToLeaderboard = useCallback(async (finalScore: number) => {
    if (!currentUserAddress) return;
    try {
      await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: currentUserAddress, username: formatAddress(currentUserAddress), displayName: formatAddress(currentUserAddress), pfpUrl: '', score: finalScore, level, lines, timestamp: Date.now() }), });
    } catch (error) { console.error('Failed to save score:', error); }
  }, [currentUserAddress, level, lines]);

  const saveScoreToHistory = useCallback(async (finalScore: number) => {
    if (!currentUserAddress) return;
    try {
      await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: currentUserAddress, username: formatAddress(currentUserAddress), displayName: formatAddress(currentUserAddress), pfpUrl: '', score: finalScore, level, lines, timestamp: Date.now() }), });
    } catch (error) { console.error('Failed to save history:', error); }
  }, [currentUserAddress, level, lines]);

  const finalizeGameOver = useCallback(async (finalScore: number) => {
    setGameOver(true);
    try { await Promise.all([saveScoreToLeaderboard(finalScore), saveScoreToHistory(finalScore)]); } catch (error) { console.error('Failed to finalize game over:', error); }
    if (bgmAudioRef.current) { bgmAudioRef.current.pause(); bgmAudioRef.current.currentTime = 0; }
    onGameOver?.(finalScore);
  }, [onGameOver, saveScoreToLeaderboard, saveScoreToHistory]);

  const lockPiece = useCallback((lockPosition: Position) => {
    if (!currentPiece || !nextPiece) return;
    const pieceToMerge = { ...currentPiece, position: lockPosition };
    let newBoard = mergeTetromino(board, pieceToMerge);
    let newScore = score;
    if (currentPiece.isOjama) {
      let blockCount = 0;
      for (let y = 0; y < BOARD_HEIGHT; y++) { for (let x = 0; x < BOARD_WIDTH; x++) { if (newBoard[y][x] !== null) blockCount++; } }
      newBoard = createBoard(); newScore = score + blockCount * 10; setScore(newScore);
    } else {
      const { board: clearedBoard, linesCleared } = clearLines(newBoard);
      newBoard = clearedBoard; setLines((prev) => prev + linesCleared);
      newScore = score + calculateScore(linesCleared, level); setScore(newScore);
    }
    const newLevel = Math.floor(newScore / 1000) + 1;
    if (newLevel > level) setLevel(newLevel);
    setBoard(newBoard);
    const newPiece = nextPiece; const newNext = getRandomTetromino();
    if (checkCollision(newBoard, newPiece, { x: 0, y: 0 })) { void finalizeGameOver(newScore); return; }
    setCurrentPiece(newPiece); setNextPiece(newNext); setPosition({ x: 3, y: 0 }); setRotationState(0);
  }, [board, currentPiece, nextPiece, level, score, finalizeGameOver]);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || !currentPiece) return;
    const pieceWithPosition = { ...currentPiece, position };
    if (checkCollision(board, pieceWithPosition, { x: 0, y: 0 })) { lockPiece({ x: position.x, y: position.y - 1 }); }
  }, [position, board, currentPiece, gameStarted, gameOver, isPaused, lockPiece]);

  // 移動・回転
  const moveLeft = useCallback(() => { if (isPaused || !currentPiece) return; const newPos = { x: position.x - 1, y: position.y }; if (!checkCollision(board, { ...currentPiece, position: newPos }, { x: 0, y: 0 })) setPosition(newPos); }, [board, currentPiece, position, isPaused]);
  const moveRight = useCallback(() => { if (isPaused || !currentPiece) return; const newPos = { x: position.x + 1, y: position.y }; if (!checkCollision(board, { ...currentPiece, position: newPos }, { x: 0, y: 0 })) setPosition(newPos); }, [board, currentPiece, position, isPaused]);
  const moveDown = useCallback(() => { if (isPaused || !currentPiece) return; const newPos = { x: position.x, y: position.y + 1 }; if (!checkCollision(board, { ...currentPiece, position: newPos }, { x: 0, y: 0 })) setPosition(newPos); }, [board, currentPiece, position, isPaused]);
  const rotate = useCallback(() => { if (isPaused || !currentPiece || currentPiece.isOjama) return; const kickTable = currentPiece.type === 'I' ? SRS_I_KICK_TABLE : SRS_KICK_TABLE; const nextRot = ((rotationState + 1) % 4) as RotationState; const kicks = kickTable[`${rotationState}->${nextRot}`] || [{ x: 0, y: 0 }]; const rotated = rotateTetromino(currentPiece); for (const kick of kicks) { const testPos = { x: position.x + kick.x, y: position.y + kick.y }; if (!checkCollision(board, { ...rotated, position: testPos }, { x: 0, y: 0 })) { setCurrentPiece(rotated); setPosition(testPos); setRotationState(nextRot); return; } } }, [board, position, currentPiece, rotationState, isPaused]);
  const rotateCounterClockwise = useCallback(() => { if (isPaused || !currentPiece || currentPiece.isOjama) return; const kickTable = currentPiece.type === 'I' ? SRS_I_KICK_TABLE : SRS_KICK_TABLE; const nextRot = ((rotationState + 3) % 4) as RotationState; const kicks = kickTable[`${rotationState}->${nextRot}`] || [{ x: 0, y: 0 }]; let rotated = currentPiece; for (let i = 0; i < 3; i++) rotated = rotateTetromino(rotated); for (const kick of kicks) { const testPos = { x: position.x + kick.x, y: position.y + kick.y }; if (!checkCollision(board, { ...rotated, position: testPos }, { x: 0, y: 0 })) { setCurrentPiece(rotated); setPosition(testPos); setRotationState(nextRot); return; } } }, [board, position, currentPiece, rotationState, isPaused]);
  const hardDrop = useCallback(() => { if (isPaused || !currentPiece) return; let dropPos = { ...position }; while (true) { const nextPos = { x: dropPos.x, y: dropPos.y + 1 }; if (checkCollision(board, { ...currentPiece, position: nextPos }, { x: 0, y: 0 })) break; dropPos = nextPos; } lockPiece(dropPos); }, [board, currentPiece, position, isPaused, lockPiece]);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;
    const handleKeyPress = (e: KeyboardEvent) => { e.preventDefault(); switch (e.key) { case 'ArrowLeft': moveLeft(); break; case 'ArrowRight': moveRight(); break; case 'ArrowDown': moveDown(); break; case 'ArrowUp': rotate(); break; case 'z': case 'Z': rotateCounterClockwise(); break; case ' ': hardDrop(); break; } };
    window.addEventListener('keydown', handleKeyPress); return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, isPaused, moveLeft, moveRight, moveDown, rotate, rotateCounterClockwise, hardDrop]);

  const startNewGame = () => {
    const bgmList = ['/sounds/music_A.mp3', '/sounds/music_B.mp3', '/sounds/music_C.mp3'];
    if (bgmAudioRef.current) { bgmAudioRef.current.pause(); bgmAudioRef.current.currentTime = 0; }
    bgmAudioRef.current = new Audio(bgmList[Math.floor(Math.random() * bgmList.length)]);
    bgmAudioRef.current.loop = true; bgmAudioRef.current.volume = 0.3;
    bgmAudioRef.current.play().catch(err => console.error('BGM:', err));
    setBoard(createBoard()); setCurrentPiece(getRandomTetromino()); setNextPiece(getRandomTetromino()); setPosition({ x: 3, y: 0 }); setRotationState(0); setScore(0); setLevel(1); setLines(0); setGameOver(false); setIsPaused(false); setGameStarted(true); setShowMenu(false);
  };

  const handleBackToMenu = () => { setGameStarted(false); setShowMenu(true); setGameOver(false); if (bgmAudioRef.current) { bgmAudioRef.current.pause(); bgmAudioRef.current.currentTime = 0; } };

  // ★ 欠落していた関数の追加
  const handleShowRanking = () => setShowLeaderboard(true);
  const handleShowHistory = () => setShowHistory(true);

  // レンダリング (省略せず保持)
  const renderNextPiece = () => {
    if (!nextPiece) return null; const isOjamaNext = nextPiece.isOjama; const previewCell = layoutConfig.nextCellSize;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: `${previewCell * 4}px` }}>
        <div style={{ display: 'inline-block', position: 'relative' }}>
          {nextPiece.shape.map((row, y) => (
            <div key={y} style={{ display: 'flex' }}>
              {row.map((cell, x) => ( <div key={`${y}-${x}`} style={{ width: previewCell, height: previewCell, backgroundColor: cell === 1 ? (isOjamaNext ? 'transparent' : getTetrominoColor(nextPiece.type)) : 'transparent', border: cell === 1 ? '1px solid #444' : 'none', borderRadius: '1px', position: 'relative' }} /> ))}
            </div>
          ))}
          {isOjamaNext && <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: `${previewCell * 2 + 2}px`, height: `${previewCell * 2 + 2}px`, pointerEvents: 'none' }}> <Image src="/ojama-block.png" alt="Ojama Block" fill style={{ objectFit: 'cover' }} unoptimized /> </div>}
        </div>
      </div>
    );
  };

  const renderBoard = () => {
    const displayBoard = board.map((row) => [...row]);
    const scaledCell = Math.round(CELL_SIZE * layoutConfig.boardScale);
    const scaledBorder = Math.max(1, Math.round(2 * layoutConfig.boardScale));
    const scaledInner = Math.max(6, scaledCell - scaledBorder * 2);
    if (!gameOver && currentPiece) {
      currentPiece.shape.forEach((row, y) => { row.forEach((cell, x) => { if (cell === 1) { const bY = position.y + y; const bX = position.x + x; if (bY >= 0 && bY < BOARD_HEIGHT && bX >= 0 && bX < BOARD_WIDTH) displayBoard[bY][bX] = currentPiece.isOjama ? 'OJAMA' : currentPiece.type; } }); });
    }
    const ojamaBlocks = new Set<string>();
    for (let y = 0; y < BOARD_HEIGHT - 1; y++) { for (let x = 0; x < BOARD_WIDTH - 1; x++) { if (displayBoard[y][x] === 'OJAMA' && displayBoard[y][x + 1] === 'OJAMA' && displayBoard[y + 1][x] === 'OJAMA' && displayBoard[y + 1][x + 1] === 'OJAMA') ojamaBlocks.add(`${y},${x}`); } }
    return (
      <div style={{ position: 'relative' }}>
        {displayBoard.map((row, y) => (
          <div key={y} style={{ display: 'flex' }}>
            {row.map((cell, x) => {
              const isOjamaTopLeft = ojamaBlocks.has(`${y},${x}`); const isPartOfOjama2x2 = ojamaBlocks.has(`${y},${x}`) || ojamaBlocks.has(`${y},${x - 1}`) || ojamaBlocks.has(`${y - 1},${x}`) || ojamaBlocks.has(`${y - 1},${x - 1}`);
              return ( <div key={`${y}-${x}`} style={{ width: scaledInner, height: scaledInner, backgroundColor: cell ? (isPartOfOjama2x2 ? 'transparent' : getTetrominoColor(cell as string)) : '#1a1a1a', border: `${scaledBorder}px solid #333`, borderRadius: '2px', position: 'relative', overflow: 'visible', boxSizing: 'content-box' }}> {isOjamaTopLeft && <div style={{ position: 'absolute', top: `-${scaledBorder}px`, left: `-${scaledBorder}px`, width: `${scaledInner * 2 + scaledBorder * 2}px`, height: `${scaledInner * 2 + scaledBorder * 2}px`, pointerEvents: 'none', zIndex: 10 }}> <Image src="/ojama-block.png" alt="Ojama Block" fill style={{ objectFit: 'cover' }} unoptimized /> </div>} </div> );
            })}
          </div>
        ))}
      </div>
    );
  };

  const controlButtonBaseStyle: React.CSSProperties = { width: `${layoutConfig.buttonSize}px`, height: `${layoutConfig.buttonSize}px`, minWidth: `${layoutConfig.buttonSize}px`, minHeight: `${layoutConfig.buttonSize}px`, borderRadius: `${Math.max(10, Math.round(layoutConfig.buttonSize * 0.18))}px`, };

  if (showMenu) {
    return (
      <>
        <GameMenu onStartGame={startNewGame} onShowHistory={handleShowHistory} onShowRanking={handleShowRanking} username={currentUserAddress ? formatAddress(currentUserAddress) : undefined} onSignedIn={handleSignedIn} onSignedOut={handleSignedOut} />
        <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
        <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} currentUserAddress={currentUserAddress ?? undefined} />
      </>
    );
  }

  return (
    <div className="w-full overflow-x-hidden overflow-y-auto bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800" style={{ minHeight: 'var(--app-height, 100dvh)', paddingTop: 'env(safe-area-inset-top)', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitOverflowScrolling: 'touch' }}>
      <div className="mx-auto flex w-full flex-col items-center" style={{ maxWidth: 520, minHeight: 'calc(var(--app-height, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom))', paddingLeft: `${layoutConfig.paddingX}px`, paddingRight: `${layoutConfig.paddingX}px`, paddingTop: viewport.w >= 768 && viewport.h >= 700 && !layoutConfig.compact ? '16px' : `${layoutConfig.paddingTop}px`, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', gap: `${layoutConfig.sectionGap}px`, boxSizing: 'border-box', justifyContent: viewport.w >= 768 && viewport.h >= 700 && !layoutConfig.compact ? 'center' : 'flex-start' }}>
        <div className="text-center" style={{ marginBottom: `${layoutConfig.titleMarginBottom}px` }}>
          <h1 className="font-bold text-white drop-shadow-lg tracking-wider" style={{ fontSize: `${layoutConfig.titleSize}px`, lineHeight: 1.05 }}>FARTETRIS</h1>
        </div>
        <div className="flex w-full items-start justify-center" style={{ gap: `${layoutConfig.boardPanelGap}px` }}>
          <div className="bg-black/40 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-purple-400/30 p-1 relative shrink-0">
            {renderBoard()}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg z-30">
                <div className="text-center px-4 w-full">
                  <p className="font-bold text-red-500 mb-2" style={{ fontSize: layoutConfig.ultraCompact ? '22px' : '30px' }}>GAME OVER</p>
                  <p className="text-white mb-4" style={{ fontSize: layoutConfig.ultraCompact ? '16px' : '20px' }}>Score: {score}</p>
                  
                  <div className="flex flex-col gap-3 w-full items-center mb-4">
                    {/* ミントボタン: ラベル表示対応 */}
                    {!isMintSuccess && (
                      <button
                        onClick={handleMintNFT}
                        disabled={isMinting || isConfirming}
                        className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black rounded-full font-bold transition-all shadow-lg active:scale-95 disabled:grayscale"
                      >
                        {isMinting || isConfirming ? 'ミント中...' : `${pendingNftLabel || (score >= 100 ? 'Achievement NFT' : 'First Play NFT')} をGET!`}
                      </button>
                    )}
                    {isMintSuccess && (
                      <div className="w-full py-2 bg-green-500/20 border border-green-500 text-green-400 rounded-lg text-sm font-bold animate-pulse"> ミント成功！🎉 </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                    <button onClick={startNewGame} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full font-semibold transition-colors shadow-lg">RETRY</button>
                    <button onClick={handleBackToMenu} className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-full font-semibold transition-colors shadow-lg">MENU</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* サイドパネル */}
          <div className="flex flex-col shrink-0" style={{ width: `${layoutConfig.sidePanelWidth}px`, gap: `${layoutConfig.panelGap}px` }}>
            <div className="bg-[#2c2363] text-center shadow-md" style={{ borderRadius: `${layoutConfig.panelBorderRadius}px`, padding: `${layoutConfig.cardPaddingY}px ${layoutConfig.cardPaddingX}px` }}>
              <p className="text-[#cbbcff] mb-1 font-semibold tracking-wide" style={{ fontSize: `${layoutConfig.labelFontSize}px` }}>スコア</p>
              <p className="font-extrabold text-white leading-none" style={{ fontSize: `${layoutConfig.valueFontSize}px` }}>{score}</p>
            </div>
            <div className="bg-[#2c2363] text-center shadow-md" style={{ borderRadius: `${layoutConfig.panelBorderRadius}px`, padding: `${layoutConfig.cardPaddingY}px ${layoutConfig.cardPaddingX}px` }}>
              <p className="text-[#cbbcff] mb-1 font-semibold tracking-wide" style={{ fontSize: `${layoutConfig.labelFontSize}px` }}>レベル</p>
              <p className="font-extrabold text-white leading-none" style={{ fontSize: `${layoutConfig.valueFontSize}px`, marginBottom: layoutConfig.compact ? '8px' : '12px' }}>{level}</p>
              <p className="text-[#cbbcff] mb-1 font-semibold tracking-wide" style={{ fontSize: `${layoutConfig.labelFontSize}px` }}>ライン</p>
              <p className="font-extrabold text-white leading-none" style={{ fontSize: `${layoutConfig.valueFontSize}px` }}>{lines}</p>
            </div>
            <div className="bg-[#2c2363] text-center shadow-md" style={{ borderRadius: `${layoutConfig.panelBorderRadius}px`, padding: `${layoutConfig.cardPaddingY}px ${layoutConfig.cardPaddingX}px` }}>
              <p className="text-[#cbbcff] mb-2 font-semibold tracking-wide" style={{ fontSize: `${layoutConfig.labelFontSize}px` }}>Next</p>
              {renderNextPiece()}
            </div>
            <button onClick={() => setIsPaused((prev) => !prev)} className="w-full text-white font-extrabold shadow-md" style={{ height: `${layoutConfig.pauseButtonHeight}px`, borderRadius: `${layoutConfig.panelBorderRadius}px`, fontSize: `${Math.max(12, Math.round(64 * layoutConfig.boardScale * 0.24))}px`, background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' }}>{isPaused ? 'RESTART' : 'PAUSE'}</button>
          </div>
        </div>
        {/* 操作ボタン */}
        <div className="w-full flex flex-col items-center" style={{ gap: `${layoutConfig.gap}px`, marginTop: `${layoutConfig.compact ? 0 : 2}px` }}>
          <div className="flex justify-center" style={{ gap: `${layoutConfig.gap}px`, width: '100%', maxWidth: `${layoutConfig.controlsMaxWidth}px` }}>
            <button onClick={rotateCounterClockwise} disabled={!gameStarted || gameOver || isPaused} className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>↺</button>
            <button onClick={rotate} disabled={!gameStarted || gameOver || isPaused} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>↻</button>
            <button onClick={hardDrop} disabled={!gameStarted || gameOver || isPaused} className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold flex-shrink-0" style={controlButtonBaseStyle}>DROP</button>
          </div>
          <div className="flex justify-center" style={{ gap: `${layoutConfig.gap}px`, width: '100%', maxWidth: `${layoutConfig.controlsMaxWidth}px` }}>
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
