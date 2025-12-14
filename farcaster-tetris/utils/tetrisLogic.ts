import { TETROMINOS, BOARD_WIDTH, BOARD_HEIGHT } from './constants';

export type TetrominoType = keyof typeof TETROMINOS;
export type Board = (string | null)[][];

export interface Position {
  x: number;
  y: number;
}

export interface Tetromino {
  type: TetrominoType;
  shape: number[][];
  color: string;
  position: Position;
  isOjama?: boolean; // おじゃまブロック判定
}

// 空のボードを作成
export const createBoard = (): Board => {
  return Array(BOARD_HEIGHT)
    .fill(null)
    .map(() => Array(BOARD_WIDTH).fill(null));
};

// ランダムなテトリミノを生成（5%の確率でおじゃまブロック）
export const getRandomTetromino = (): Tetromino => {
  const random = Math.random();
  
  // 5%の確率でおじゃまブロック
  if (random < 0.05) {
    const { shape, color } = TETROMINOS.OJAMA;
    return {
      type: 'OJAMA',
      shape: shape.map((row) => [...row]),
      color,
      position: {
        x: Math.floor(BOARD_WIDTH / 2) - 1,
        y: 0,
      },
      isOjama: true,
    };
  }
  
  // 通常のテトリミノ
  const types = Object.keys(TETROMINOS).filter(t => t !== 'OJAMA') as TetrominoType[];
  const type = types[Math.floor(Math.random() * types.length)];
  const { shape, color } = TETROMINOS[type];

  return {
    type,
    shape: shape.map((row) => [...row]),
    color,
    position: {
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    },
    isOjama: false,
  };
};

// テトリミノを回転（おじゃまブロックは回転不可）
export const rotateTetromino = (tetromino: Tetromino): Tetromino => {
  if (tetromino.isOjama) {
    return tetromino; // おじゃまブロックは回転しない
  }
  
  const n = tetromino.shape.length;
  const rotated = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      rotated[x][n - 1 - y] = tetromino.shape[y][x];
    }
  }

  return {
    ...tetromino,
    shape: rotated,
  };
};

// 衝突判定
export const checkCollision = (
  board: Board,
  tetromino: Tetromino,
  offset: Position = { x: 0, y: 0 }
): boolean => {
  for (let y = 0; y < tetromino.shape.length; y++) {
    for (let x = 0; x < tetromino.shape[y].length; x++) {
      if (tetromino.shape[y][x]) {
        const newX = tetromino.position.x + x + offset.x;
        const newY = tetromino.position.y + y + offset.y;

        if (
          newX < 0 ||
          newX >= BOARD_WIDTH ||
          newY >= BOARD_HEIGHT ||
          newY < 0
        ) {
          return true;
        }

        if (newY >= 0 && board[newY][newX]) {
          return true;
        }
      }
    }
  }
  return false;
};

// テトリミノをボードに固定
export const mergeTetromino = (
  board: Board,
  tetromino: Tetromino
): Board => {
  const newBoard = board.map((row) => [...row]);

  for (let y = 0; y < tetromino.shape.length; y++) {
    for (let x = 0; x < tetromino.shape[y].length; x++) {
      if (tetromino.shape[y][x]) {
        const boardY = tetromino.position.y + y;
        const boardX = tetromino.position.x + x;
        if (boardY >= 0 && boardY < BOARD_HEIGHT) {
          // おじゃまブロックは'OJAMA'として保存
          newBoard[boardY][boardX] = tetromino.isOjama ? 'OJAMA' : tetromino.type;
        }
      }
    }
  }

  return newBoard;
};

// ライン消去のチェックと実行（おじゃまブロックを含む行は消去不可）
export const clearLines = (board: Board): { board: Board; linesCleared: number } => {
  let linesCleared = 0;
  const newBoard = board.filter((row) => {
    // おじゃまブロックを含む行は消去しない
    const hasOjama = row.some(cell => cell === 'OJAMA');
    if (hasOjama) {
      return true; // 行を残す
    }
    
    // 通常のライン消去判定
    if (row.every((cell) => cell !== null)) {
      linesCleared++;
      return false;
    }
    return true;
  });

  // 消去した分だけ上に空行を追加
  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(null));
  }

  return { board: newBoard, linesCleared };
};

// スコア計算
export const calculateScore = (linesCleared: number, level: number): number => {
  const baseScores = [0, 100, 300, 500, 800];
  return baseScores[linesCleared] * level;
};

// ゲームオーバー判定
export const isGameOver = (board: Board, tetromino: Tetromino): boolean => {
  return checkCollision(board, tetromino);
};

// テトリミノの色を取得（おじゃまブロックは透明を返す）
export const getTetrominoColor = (type: string): string => {
  if (type === 'OJAMA') {
    return 'transparent'; // 画像で表示するため透明
  }
  
  const tetromino = TETROMINOS[type as TetrominoType];
  return tetromino ? tetromino.color : '#666666';
};
