import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PuzzlePiece, PuzzleConfig, checkSnap } from '@/lib/puzzleUtils';
import { PuzzlePieceCanvas } from './PuzzlePieceCanvas';

interface PuzzleBoardProps {
  pieces: PuzzlePiece[];
  setPieces: React.Dispatch<React.SetStateAction<PuzzlePiece[]>>;
  imageUrl: string;
  config: PuzzleConfig;
  boardWidth: number;
  boardHeight: number;
  trayHeight: number;
  onComplete: () => void;
  snappingPieceId: number | null;
  setSnappingPieceId: (id: number | null) => void;
}

export const PuzzleBoard: React.FC<PuzzleBoardProps> = ({
  pieces,
  setPieces,
  imageUrl,
  config,
  boardWidth,
  boardHeight,
  trayHeight,
  onComplete,
  snappingPieceId,
  setSnappingPieceId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    pieceId: number;
    startMouseX: number;
    startMouseY: number;
    startPieceX: number;
    startPieceY: number;
  } | null>(null);
  const [zCounters, setZCounters] = useState<Record<number, number>>({});
  const zBase = useRef(10);
  const [snapGlows, setSnapGlows] = useState<{ id: number; x: number; y: number }[]>([]);

  const totalH = boardHeight + trayHeight;

  const getScaledXY = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: clientX, y: clientY };
    const rect = el.getBoundingClientRect();
    const scaleX = boardWidth / rect.width;
    const scaleY = totalH / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, pieceId: number) => {
      e.preventDefault();
      const piece = pieces.find(p => p.id === pieceId);
      if (!piece || piece.isPlaced) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      const newZ = ++zBase.current;
      setZCounters(prev => ({ ...prev, [pieceId]: newZ }));

      draggingRef.current = {
        pieceId,
        startMouseX: clientX,
        startMouseY: clientY,
        startPieceX: piece.currentX,
        startPieceY: piece.currentY,
      };

      setPieces(prev => prev.map(p => (p.id === pieceId ? { ...p, isDragging: true } : p)));
    },
    [pieces, setPieces]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scaleX = boardWidth / rect.width;
      const scaleY = totalH / rect.height;

      const { pieceId, startMouseX, startMouseY, startPieceX, startPieceY } = draggingRef.current;
      const dx = (clientX - startMouseX) * scaleX;
      const dy = (clientY - startMouseY) * scaleY;

      setPieces(prev =>
        prev.map(p =>
          p.id === pieceId ? { ...p, currentX: startPieceX + dx, currentY: startPieceY + dy } : p
        )
      );
    },
    [setPieces, boardWidth, totalH]
  );

  const handleMouseUp = useCallback(
    (_e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const { pieceId } = draggingRef.current;
      draggingRef.current = null;

      setPieces(prev => {
        const piece = prev.find(p => p.id === pieceId);
        if (!piece) return prev;

        const shouldSnap = checkSnap(piece);
        if (shouldSnap) {
          setSnappingPieceId(pieceId);
          setSnapGlows(g => [...g, { id: pieceId, x: piece.correctX, y: piece.correctY }]);
          setTimeout(() => {
            setSnappingPieceId(null);
            setSnapGlows(g => g.filter(gl => gl.id !== pieceId));
          }, 800);

          const updated = prev.map(p =>
            p.id === pieceId
              ? { ...p, currentX: p.correctX, currentY: p.correctY, isPlaced: true, isDragging: false }
              : p
          );

          const allPlaced = updated.every(p => p.isPlaced);
          if (allPlaced) setTimeout(onComplete, 400);
          return updated;
        }

        return prev.map(p => (p.id === pieceId ? { ...p, isDragging: false } : p));
      });
    },
    [setPieces, onComplete, setSnappingPieceId]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: `${boardWidth}px`,
        height: `${totalH}px`,
        overflow: 'hidden',
        borderRadius: 10,
      }}
    >
      {/* Board area background */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: boardWidth,
          height: boardHeight,
          background: 'rgba(15, 20, 35, 0.95)',
          border: '2px solid rgba(168, 85, 247, 0.45)',
          borderRadius: '8px 8px 0 0',
          backgroundImage: `
            linear-gradient(rgba(168,85,247,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168,85,247,0.08) 1px, transparent 1px)
          `,
          backgroundSize: `${boardWidth / config.cols}px ${boardHeight / config.rows}px`,
          boxShadow: '0 0 40px rgba(168,85,247,0.15), inset 0 0 40px rgba(0,0,0,0.5)',
          boxSizing: 'border-box',
        }}
      />

      {/* Tray area background */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: boardHeight,
          width: boardWidth,
          height: trayHeight,
          background: 'rgba(10,12,28,0.9)',
          borderTop: '2px dashed rgba(168,85,247,0.25)',
          borderRadius: '0 0 8px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            color: 'rgba(168,85,247,0.18)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.08em',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          조각 보관함
        </span>
      </div>

      {/* Stitch overlay for placed pieces */}
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: boardWidth,
          height: boardHeight,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {pieces
          .filter(p => p.isPlaced)
          .map(p => (
            <g key={`stitch-${p.id}`}>
              <rect
                x={p.correctX + 2}
                y={p.correctY + 2}
                width={p.width - 4}
                height={p.height - 4}
                fill="none"
                stroke="rgba(168,85,247,0.5)"
                strokeWidth="1.5"
                strokeDasharray="5,5"
                rx="2"
              />
            </g>
          ))}
      </svg>

      {/* Snap glow overlays */}
      {snapGlows.map(glow => (
        <div
          key={`glow-${glow.id}`}
          className="snap-glow-overlay"
          style={{
            position: 'absolute',
            left: glow.x - 20,
            top: glow.y - 20,
            width: boardWidth / config.cols + 40,
            height: boardHeight / config.rows + 40,
            zIndex: 3,
          }}
        />
      ))}

      {/* Puzzle pieces */}
      {pieces.map(piece => (
        <PuzzlePieceCanvas
          key={piece.id}
          piece={piece}
          imageUrl={imageUrl}
          config={config}
          boardWidth={boardWidth}
          boardHeight={boardHeight}
          isSnapping={snappingPieceId === piece.id}
          zIndex={zCounters[piece.id] ?? 10}
          onMouseDown={handleMouseDown}
        />
      ))}
    </div>
  );
};
