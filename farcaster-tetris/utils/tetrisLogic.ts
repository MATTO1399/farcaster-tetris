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
}

// 空のボードを作成
export const createBoard = (): Board => {
  return Array(BOARD_HEIGHT)
    .fill(null)
    .map(() => Array(BOARD_WIDTH).fill(null));
};

// ランダムなテトリミノを生成
export const getRandomTetromino = (): Tetromino => {
  const types = Object.keys(TETROMINOS) as TetrominoType[];
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
  };
};

// テトリミノを回転
export const rotateTetromino = (tetromino: Tetromino): Tetromino => {
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

        // 範囲外チェック
        if (
          newX < 0 ||
          newX >= BOARD_WIDTH ||
          newY >= BOARD_HEIGHT ||
          newY < 0
        ) {
          return true;
        }

        // 既存のブロックとの衝突チェック
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
          newBoard[boardY][boardX] = tetromino.color;
        }
      }
    }
  }

  return newBoard;
};

// ライン消去のチェックと実行
export const clearLines = (board: Board): { board: Board; linesCleared: number } => {
  let linesCleared = 0;
  const newBoard = board.filter((row) => {
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
