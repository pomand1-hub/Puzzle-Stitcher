import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PuzzlePiece, PuzzleConfig, calculateGrid, createPieces } from '@/lib/puzzleUtils';
import { PuzzleBoard } from '@/components/PuzzleBoard';

const PIECE_COUNTS = [4, 6, 9, 12, 16, 20, 25, 30];
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 450;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

export default function PuzzleGame() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [config, setConfig] = useState<PuzzleConfig | null>(null);
  const [selectedPieceCount, setSelectedPieceCount] = useState(9);
  const [gameStarted, setGameStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [snappingPieceId, setSnappingPieceId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const handleImageUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setGameStarted(false);
    setIsComplete(false);
    setPieces([]);
    setConfig(null);
    stopTimer();
    setElapsedSeconds(0);
  }, [stopTimer]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const startGame = useCallback(() => {
    if (!imageUrl) return;
    const cfg = calculateGrid(selectedPieceCount, BOARD_WIDTH, BOARD_HEIGHT);
    const newPieces = createPieces(cfg, BOARD_WIDTH, BOARD_HEIGHT);
    setConfig(cfg);
    setPieces(newPieces);
    setGameStarted(true);
    setIsComplete(false);
    setCompletedCount(0);
    startTimer();
  }, [imageUrl, selectedPieceCount, startTimer]);

  const handleComplete = useCallback(() => {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setFinalTime(elapsed);
    stopTimer();
    setIsComplete(true);
  }, [stopTimer]);

  useEffect(() => {
    const placed = pieces.filter(p => p.isPlaced).length;
    setCompletedCount(placed);
  }, [pieces]);

  const totalPieces = config?.totalPieces ?? 0;
  const progress = totalPieces > 0 ? (completedCount / totalPieces) * 100 : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f1223 0%, #1a1035 50%, #0f1223 100%)',
        overflow: 'hidden',
        fontFamily: 'var(--app-font-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 20px',
          background: 'rgba(15,18,35,0.95)',
          borderBottom: '1px solid rgba(168,85,247,0.3)',
          backdropFilter: 'blur(10px)',
          gap: '16px',
          flexShrink: 0,
          zIndex: 100,
          minHeight: 52,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              boxShadow: '0 0 14px rgba(168,85,247,0.5)',
            }}
          >
            🧩
          </div>
          <span style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 16 }}>퍼즐 게임</span>
        </div>

        {gameStarted && !isComplete && (
          <>
            <div style={{ width: 1, height: 24, background: 'rgba(168,85,247,0.3)', marginLeft: 4 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'rgba(168,85,247,0.9)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {completedCount} / {totalPieces}
              </span>
              <div style={{ width: 100, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                    borderRadius: 99,
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 6px rgba(168,85,247,0.6)',
                  }}
                />
              </div>
            </div>
            <div style={{ width: 1, height: 24, background: 'rgba(168,85,247,0.3)' }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                background: 'rgba(168,85,247,0.1)',
                borderRadius: 8,
                border: '1px solid rgba(168,85,247,0.25)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span
                style={{
                  color: 'rgba(192,132,252,0.95)',
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  minWidth: 36,
                }}
              >
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {gameStarted && (
          <button
            onClick={() => { setGameStarted(false); setIsComplete(false); stopTimer(); setElapsedSeconds(0); }}
            style={{
              padding: '6px 14px',
              background: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.4)',
              borderRadius: 8,
              color: '#c084fc',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            새 게임
          </button>
        )}
      </div>

      {!gameStarted ? (
        /* Setup screen */
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflowY: 'auto',
          }}
        >
          <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'rgba(168,85,247,0.9)' : 'rgba(168,85,247,0.4)'}`,
                borderRadius: 16,
                padding: '28px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(168,85,247,0.1)' : 'rgba(15,18,35,0.6)',
                transition: 'all 0.2s ease',
              }}
            >
              {imageUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <img
                    src={imageUrl}
                    alt="Uploaded"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 180,
                      borderRadius: 10,
                      objectFit: 'contain',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    }}
                  />
                  <span style={{ color: '#c084fc', fontSize: 12 }}>클릭하여 다른 이미지 선택</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 44 }}>📷</div>
                  <div style={{ color: '#c084fc', fontWeight: 600, fontSize: 15 }}>
                    이미지를 드래그하거나 클릭하여 업로드
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    JPG, PNG, GIF, WebP 지원
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ color: '#e2d9f3', fontWeight: 600, fontSize: 13 }}>
                피스 수 선택 ({selectedPieceCount}개)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PIECE_COUNTS.map(count => (
                  <button
                    key={count}
                    onClick={() => setSelectedPieceCount(count)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 10,
                      border: selectedPieceCount === count
                        ? '2px solid rgba(168,85,247,0.9)'
                        : '1px solid rgba(168,85,247,0.25)',
                      background: selectedPieceCount === count
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.3))'
                        : 'rgba(15,18,35,0.6)',
                      color: selectedPieceCount === count ? '#e2d9f3' : 'rgba(255,255,255,0.5)',
                      fontWeight: selectedPieceCount === count ? 700 : 500,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: selectedPieceCount === count ? '0 0 14px rgba(168,85,247,0.3)' : 'none',
                    }}
                  >
                    {count}조각
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={!imageUrl}
              style={{
                padding: '13px',
                background: imageUrl
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'rgba(100,100,100,0.3)',
                border: 'none',
                borderRadius: 12,
                color: imageUrl ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: 15,
                fontWeight: 700,
                cursor: imageUrl ? 'pointer' : 'not-allowed',
                boxShadow: imageUrl ? '0 4px 20px rgba(168,85,247,0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {imageUrl ? '🧩 게임 시작' : '이미지를 먼저 업로드해주세요'}
            </button>
          </div>
        </div>
      ) : (
        /* Game screen */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'auto',
            padding: '12px 16px 200px',
          }}
        >
          {/* Reference image */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 12,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid rgba(168,85,247,0.5)',
                boxShadow: '0 0 20px rgba(168,85,247,0.2)',
                flexShrink: 0,
              }}
            >
              <img
                src={imageUrl!}
                alt="Reference"
                style={{
                  width: 178,
                  height: 100,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.5))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 5,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                목표 이미지
              </div>
            </div>

            {config && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: 'rgba(124,58,237,0.2)',
                    borderRadius: 6,
                    border: '1px solid rgba(168,85,247,0.3)',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>그리드</span>
                  <span style={{ color: '#c084fc', fontSize: 12, fontWeight: 700 }}>
                    {config.cols} × {config.rows}
                  </span>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: 'rgba(124,58,237,0.2)',
                    borderRadius: 6,
                    border: '1px solid rgba(168,85,247,0.3)',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>총</span>
                  <span style={{ color: '#c084fc', fontSize: 12, fontWeight: 700 }}>
                    {config.totalPieces}조각
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Puzzle board */}
          {config && (
            <div style={{ flexShrink: 0 }}>
              <PuzzleBoard
                pieces={pieces}
                setPieces={setPieces}
                imageUrl={imageUrl!}
                config={config}
                boardWidth={BOARD_WIDTH}
                boardHeight={BOARD_HEIGHT}
                onComplete={handleComplete}
                snappingPieceId={snappingPieceId}
                setSnappingPieceId={setSnappingPieceId}
              />
            </div>
          )}
        </div>
      )}

      {/* Complete overlay */}
      {isComplete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              padding: '48px 56px',
              background: 'linear-gradient(135deg, rgba(20,15,40,0.99), rgba(30,20,60,0.99))',
              borderRadius: 24,
              border: '2px solid rgba(168,85,247,0.6)',
              boxShadow: '0 0 80px rgba(168,85,247,0.4), 0 0 160px rgba(124,58,237,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 60 }}>🎉</div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  color: '#fff',
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #c084fc, #a855f7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: 6,
                }}
              >
                퍼즐 완성!
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                {totalPieces}개 조각을 모두 맞췄어요!
              </div>
            </div>

            {/* Time result */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '16px 32px',
                background: 'rgba(168,85,247,0.12)',
                border: '1px solid rgba(168,85,247,0.35)',
                borderRadius: 14,
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                완성까지 걸린 시간
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span
                  style={{
                    color: '#e2d9f3',
                    fontSize: 26,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatTime(finalTime)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setGameStarted(false); setIsComplete(false); stopTimer(); setElapsedSeconds(0); }}
                style={{
                  padding: '11px 24px',
                  background: 'rgba(168,85,247,0.2)',
                  border: '1px solid rgba(168,85,247,0.5)',
                  borderRadius: 12,
                  color: '#c084fc',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                새 이미지
              </button>
              <button
                onClick={startGame}
                style={{
                  padding: '11px 24px',
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(168,85,247,0.5)',
                }}
              >
                다시 하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
