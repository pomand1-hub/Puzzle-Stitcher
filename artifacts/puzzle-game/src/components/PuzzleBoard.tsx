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
  onComplete,
  snappingPieceId,
  setSnappingPieceId,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
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

  const getEventXY = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, pieceId: number) => {
    e.preventDefault();
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece || piece.isPlaced) return;

    const { x, y } = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };

    const newZ = ++zBase.current;
    setZCounters(prev => ({ ...prev, [pieceId]: newZ }));

    draggingRef.current = {
      pieceId,
      startMouseX: x,
      startMouseY: y,
      startPieceX: piece.currentX,
      startPieceY: piece.currentY,
    };

    setPieces(prev =>
      prev.map(p => p.id === pieceId ? { ...p, isDragging: true } : p)
    );
  }, [pieces, setPieces]);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const { x, y } = getEventXY(e);
    const { pieceId, startMouseX, startMouseY, startPieceX, startPieceY } = draggingRef.current;
    const dx = x - startMouseX;
    const dy = y - startMouseY;

    setPieces(prev =>
      prev.map(p =>
        p.id === pieceId
          ? { ...p, currentX: startPieceX + dx, currentY: startPieceY + dy }
          : p
      )
    );
  }, [setPieces]);

  const handleMouseUp = useCallback((e: MouseEvent | TouchEvent) => {
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
        if (allPlaced) {
          setTimeout(onComplete, 400);
        }
        return updated;
      }

      return prev.map(p => p.id === pieceId ? { ...p, isDragging: false } : p);
    });
  }, [setPieces, onComplete, setSnappingPieceId]);

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
      ref={boardRef}
      style={{
        position: 'relative',
        width: `${boardWidth}px`,
        height: `${boardHeight}px`,
        overflow: 'visible',
      }}
    >
      {/* Board background with grid guide */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 20, 35, 0.95)',
          border: '2px solid rgba(168, 85, 247, 0.4)',
          borderRadius: '8px',
          backgroundImage: `
            linear-gradient(rgba(168,85,247,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168,85,247,0.08) 1px, transparent 1px)
          `,
          backgroundSize: `${boardWidth / config.cols}px ${boardHeight / config.rows}px`,
          boxShadow: '0 0 40px rgba(168,85,247,0.15), inset 0 0 40px rgba(0,0,0,0.5)',
        }}
      />

      {/* Placed piece stitch overlay */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
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
