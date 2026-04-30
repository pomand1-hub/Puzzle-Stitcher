import React, { useRef, useEffect, useCallback } from 'react';
import { PuzzlePiece, PuzzleConfig, getPiecePath } from '@/lib/puzzleUtils';

interface PuzzlePieceCanvasProps {
  piece: PuzzlePiece;
  imageUrl: string;
  config: PuzzleConfig;
  boardWidth: number;
  boardHeight: number;
  isSnapping: boolean;
  zIndex: number;
  onMouseDown: (e: React.MouseEvent | React.TouchEvent, id: number) => void;
}

const TAB_FRAC = 0.35;

export const PuzzlePieceCanvas: React.FC<PuzzlePieceCanvasProps> = ({
  piece,
  imageUrl,
  config,
  boardWidth,
  boardHeight,
  isSnapping,
  zIndex,
  onMouseDown,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width: pw, height: ph, row, col } = piece;

  const tabW = pw * TAB_FRAC;
  const tabH = ph * TAB_FRAC;

  const canvasW = Math.ceil(pw + tabW * 2);
  const canvasH = Math.ceil(ph + tabH * 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    // 👉 CORS 에러 방지용 안전장치 추가
    img.crossOrigin = 'anonymous'; 
    img.src = imageUrl;

    const draw = () => {
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.save();

      ctx.translate(tabW, tabH);

      const pathStr = getPiecePath(piece, TAB_FRAC);
      const clipPath = new Path2D(pathStr);

      ctx.save();
      ctx.clip(clipPath);

      // 🚀 아이폰 사파리 버그 해결의 핵심 부분!
      // 마이너스(-) 원본 좌표를 쓰면 사파리가 터지므로, 
      // 전체 이미지를 통째로 깔고 위치만 이동시켜서 가위선(Clip)으로 오려냅니다.
      ctx.drawImage(
        img,
        -(col * pw),
        -(row * ph),
        boardWidth,
        boardHeight
      );

      ctx.restore();

      ctx.strokeStyle = piece.isPlaced
        ? 'rgba(168, 85, 247, 0.7)'
        : 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = piece.isPlaced ? 2 : 1.5;
      if (piece.isPlaced) {
        ctx.setLineDash([5, 5]);
      }
      ctx.stroke(clipPath);
      ctx.setLineDash([]);

      if (piece.isPlaced) {
        ctx.save();
        ctx.clip(clipPath);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.06)';
        ctx.fillRect(-tabW, -tabH, canvasW, canvasH);
        ctx.restore();
      }

      ctx.restore();
    };

    if (img.complete && img.naturalWidth > 0) {
      draw();
    } else {
      img.onload = draw;
    }
    // 👉 쓸데없는 화면 깜빡임을 막기 위해 렌더링 최적화
  }, [piece, imageUrl, boardWidth, boardHeight, canvasW, canvasH, col, row, pw, ph, tabW, tabH]);

  const left = piece.currentX - tabW;
  const top = piece.currentY - tabH;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!piece.isPlaced) {
        onMouseDown(e, piece.id);
      }
    },
    [piece.id, piece.isPlaced, onMouseDown]
  );

  return (
    <canvas
      ref={canvasRef}
      width={canvasW}
      height={canvasH}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${canvasW}px`,
        height: `${canvasH}px`,
        zIndex: piece.isPlaced ? 1 : zIndex,
        cursor: piece.isPlaced ? 'default' : piece.isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        willChange: 'transform',
        filter: piece.isPlaced
          ? 'drop-shadow(0 0 5px rgba(168,85,247,0.5))'
          : piece.isDragging
          ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.8)) drop-shadow(0 0 12px rgba(168,85,247,0.5))'
          : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
      }}
      className={isSnapping ? 'piece-snapped' : ''}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    />
  );
};