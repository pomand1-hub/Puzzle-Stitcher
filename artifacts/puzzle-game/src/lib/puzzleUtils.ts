export interface PuzzlePiece {
  id: number;
  row: number;
  col: number;
  correctX: number;
  correctY: number;
  currentX: number;
  currentY: number;
  width: number;
  height: number;
  isPlaced: boolean;
  isDragging: boolean;
  tabs: { top: number; right: number; bottom: number; left: number };
}

export interface PuzzleConfig {
  cols: number;
  rows: number;
  pieceWidth: number;
  pieceHeight: number;
  totalPieces: number;
}

const SNAP_THRESHOLD = 28;

export function calculateGrid(numPieces: number, boardWidth: number, boardHeight: number): PuzzleConfig {
  const aspectRatio = boardWidth / boardHeight;
  let bestCols = 2;
  let bestRows = 2;
  let bestDiff = Infinity;

  for (let cols = 2; cols <= numPieces; cols++) {
    const rows = Math.round(numPieces / cols);
    if (rows < 1) continue;
    const total = cols * rows;
    if (total < numPieces - 2 || total > numPieces + 4) continue;
    const diff = Math.abs(cols / rows - aspectRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestCols = cols;
      bestRows = rows;
    }
  }

  const pieceWidth = boardWidth / bestCols;
  const pieceHeight = boardHeight / bestRows;

  return {
    cols: bestCols,
    rows: bestRows,
    pieceWidth,
    pieceHeight,
    totalPieces: bestCols * bestRows,
  };
}

export function createPieces(config: PuzzleConfig, boardWidth: number, boardHeight: number): PuzzlePiece[] {
  const { cols, rows, pieceWidth, pieceHeight } = config;
  const pieces: PuzzlePiece[] = [];

  const tabGrid: { top: number; right: number; bottom: number; left: number }[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ top: 0, right: 0, bottom: 0, left: 0 }))
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = r === 0 ? 0 : -tabGrid[r - 1][c].bottom;
      const left = c === 0 ? 0 : -tabGrid[r][c - 1].right;
      const right = c === cols - 1 ? 0 : (Math.random() > 0.5 ? 1 : -1);
      const bottom = r === rows - 1 ? 0 : (Math.random() > 0.5 ? 1 : -1);
      tabGrid[r][c] = { top, right, bottom, left };
    }
  }

  const scatterPositions: { x: number; y: number }[] = [];
  const totalPieces = cols * rows;

  for (let i = 0; i < totalPieces; i++) {
    let attempts = 0;
    let pos: { x: number; y: number };
    do {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) {
        pos = {
          x: Math.random() * boardWidth,
          y: boardHeight + 20 + Math.random() * 180,
        };
      } else if (side === 1) {
        pos = {
          x: -pieceWidth - 20 - Math.random() * 120,
          y: Math.random() * boardHeight * 1.5,
        };
      } else if (side === 2) {
        pos = {
          x: boardWidth + 20 + Math.random() * 120,
          y: Math.random() * boardHeight * 1.5,
        };
      } else {
        pos = {
          x: Math.random() * boardWidth * 1.6 - boardWidth * 0.3,
          y: boardHeight + 20 + Math.random() * 200,
        };
      }
      attempts++;
    } while (
      scatterPositions.some(
        p => Math.abs(p.x - pos.x) < pieceWidth * 0.6 && Math.abs(p.y - pos.y) < pieceHeight * 0.6
      ) && attempts < 20
    );
    scatterPositions.push(pos);
  }

  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const correctX = c * pieceWidth;
      const correctY = r * pieceHeight;
      const scatter = scatterPositions[id];

      pieces.push({
        id: id,
        row: r,
        col: c,
        correctX,
        correctY,
        currentX: scatter.x,
        currentY: scatter.y,
        width: pieceWidth,
        height: pieceHeight,
        isPlaced: false,
        isDragging: false,
        tabs: tabGrid[r][c],
      });
      id++;
    }
  }

  return pieces;
}

export function getPiecePath(piece: PuzzlePiece, tabFraction: number = 0.35): string {
  const { width: w, height: h, tabs } = piece;

  const tw = w * tabFraction;
  const th = h * tabFraction;

  const path: string[] = [];
  path.push(`M 0 0`);

  if (tabs.top === 0) {
    path.push(`L ${w} 0`);
  } else {
    const dir = tabs.top;
    path.push(`L ${w * 0.33} 0`);
    path.push(`C ${w * 0.33} ${-th * dir * 0.3}, ${w * 0.5 - tw * 0.45} ${-th * dir}, ${w * 0.5} ${-th * dir}`);
    path.push(`C ${w * 0.5 + tw * 0.45} ${-th * dir}, ${w * 0.67} ${-th * dir * 0.3}, ${w * 0.67} 0`);
    path.push(`L ${w} 0`);
  }

  if (tabs.right === 0) {
    path.push(`L ${w} ${h}`);
  } else {
    const dir = tabs.right;
    path.push(`L ${w} ${h * 0.33}`);
    path.push(`C ${w + tw * dir * 0.3} ${h * 0.33}, ${w + tw * dir} ${h * 0.5 - th * 0.45}, ${w + tw * dir} ${h * 0.5}`);
    path.push(`C ${w + tw * dir} ${h * 0.5 + th * 0.45}, ${w + tw * dir * 0.3} ${h * 0.67}, ${w} ${h * 0.67}`);
    path.push(`L ${w} ${h}`);
  }

  if (tabs.bottom === 0) {
    path.push(`L 0 ${h}`);
  } else {
    const dir = tabs.bottom;
    path.push(`L ${w * 0.67} ${h}`);
    path.push(`C ${w * 0.67} ${h + th * dir * 0.3}, ${w * 0.5 + tw * 0.45} ${h + th * dir}, ${w * 0.5} ${h + th * dir}`);
    path.push(`C ${w * 0.5 - tw * 0.45} ${h + th * dir}, ${w * 0.33} ${h + th * dir * 0.3}, ${w * 0.33} ${h}`);
    path.push(`L 0 ${h}`);
  }

  if (tabs.left === 0) {
    path.push(`L 0 0`);
  } else {
    const dir = tabs.left;
    path.push(`L 0 ${h * 0.67}`);
    path.push(`C ${-tw * dir * 0.3} ${h * 0.67}, ${-tw * dir} ${h * 0.5 + th * 0.45}, ${-tw * dir} ${h * 0.5}`);
    path.push(`C ${-tw * dir} ${h * 0.5 - th * 0.45}, ${-tw * dir * 0.3} ${h * 0.33}, 0 ${h * 0.33}`);
    path.push(`L 0 0`);
  }

  path.push(`Z`);
  return path.join(' ');
}

export function checkSnap(piece: PuzzlePiece, threshold: number = SNAP_THRESHOLD): boolean {
  const dx = Math.abs(piece.currentX - piece.correctX);
  const dy = Math.abs(piece.currentY - piece.correctY);
  return dx < threshold && dy < threshold;
}
