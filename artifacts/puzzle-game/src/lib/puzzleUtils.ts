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

export function createPieces(
  config: PuzzleConfig,
  boardWidth: number,
  boardHeight: number
): { pieces: PuzzlePiece[]; trayHeight: number } {
  const { cols, rows, pieceWidth, pieceHeight } = config;
  const totalPieces = cols * rows;

  const tabGrid: { top: number; right: number; bottom: number; left: number }[][] = Array.from(
    { length: rows },
    () => Array.from({ length: cols }, () => ({ top: 0, right: 0, bottom: 0, left: 0 }))
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = r === 0 ? 0 : -tabGrid[r - 1][c].bottom;
      const left = c === 0 ? 0 : -tabGrid[r][c - 1].right;
      const right = c === cols - 1 ? 0 : Math.random() > 0.5 ? 1 : -1;
      const bottom = r === rows - 1 ? 0 : Math.random() > 0.5 ? 1 : -1;
      tabGrid[r][c] = { top, right, bottom, left };
    }
  }

  // Tray layout: place pieces in a shuffled grid below the board
  const trayCols = Math.max(2, Math.min(6, Math.round(boardWidth / (pieceWidth * 1.25))));
  const trayRows = Math.ceil(totalPieces / trayCols);
  const slotW = boardWidth / trayCols;
  const slotH = pieceHeight * 1.3 + 8;
  const TRAY_PAD = 20;
  const trayHeight = trayRows * slotH + TRAY_PAD * 2;

  // Create a shuffled index array for tray positions
  const slotIndices = Array.from({ length: totalPieces }, (_, i) => i);
  for (let i = slotIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slotIndices[i], slotIndices[j]] = [slotIndices[j], slotIndices[i]];
  }

  const pieces: PuzzlePiece[] = [];
  let id = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const correctX = c * pieceWidth;
      const correctY = r * pieceHeight;

      const slot = slotIndices[id];
      const trayCol = slot % trayCols;
      const trayRow = Math.floor(slot / trayCols);

      const offsetX = (Math.random() - 0.5) * slotW * 0.25;
      const offsetY = (Math.random() - 0.5) * slotH * 0.25;

      const currentX = trayCol * slotW + (slotW - pieceWidth) / 2 + offsetX;
      const currentY = boardHeight + TRAY_PAD + trayRow * slotH + (slotH - pieceHeight) / 2 + offsetY;

      pieces.push({
        id,
        row: r,
        col: c,
        correctX,
        correctY,
        currentX,
        currentY,
        width: pieceWidth,
        height: pieceHeight,
        isPlaced: false,
        isDragging: false,
        tabs: tabGrid[r][c],
      });
      id++;
    }
  }

  return { pieces, trayHeight };
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
