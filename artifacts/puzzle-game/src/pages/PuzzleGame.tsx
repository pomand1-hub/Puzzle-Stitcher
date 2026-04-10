import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PuzzlePiece, PuzzleConfig, calculateGrid, createPieces } from '@/lib/puzzleUtils';
import { PuzzleBoard } from '@/components/PuzzleBoard';

const PIECE_COUNTS = [4, 6, 9, 12, 16, 20, 25, 30];
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 450;

const SAMPLE_IMAGES = [
  {
    id: 'nature',
    label: '자연',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=450&fit=crop&auto=format',
    thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=120&fit=crop&auto=format',
  },
  {
    id: 'city',
    label: '도시',
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=450&fit=crop&auto=format',
    thumb: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=200&h=120&fit=crop&auto=format',
  },
  {
    id: 'ocean',
    label: '바다',
    url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&h=450&fit=crop&auto=format',
    thumb: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&h=120&fit=crop&auto=format',
  },
  {
    id: 'animal',
    label: '동물',
    url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&h=450&fit=crop&auto=format',
    thumb: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=200&h=120&fit=crop&auto=format',
  },
  {
    id: 'flower',
    label: '꽃',
    url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=800&h=450&fit=crop&auto=format',
    thumb: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=200&h=120&fit=crop&auto=format',
  },
  {
    id: 'space',
    label: '우주',
    url: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=800&h=450&fit=crop&auto=format',
    thumb: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=200&h=120&fit=crop&auto=format',
  },
];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return vp;
}

export default function PuzzleGame() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
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
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const vp = useViewport();
  const isMobile = vp.w < 768;
  const isLandscape = vp.w > vp.h;

  const boardScale = Math.min(
    (vp.w - 32) / BOARD_WIDTH,
    (vp.h - (isMobile ? 170 : 200)) / BOARD_HEIGHT,
    1
  );

  const shareUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [stopTimer]);

  useEffect(() => { return () => stopTimer(); }, [stopTimer]);

  const selectImage = useCallback((url: string, sampleId?: string) => {
    setImageUrl(url);
    setSelectedSampleId(sampleId ?? null);
    setGameStarted(false);
    setIsComplete(false);
    setPieces([]);
    setConfig(null);
    stopTimer();
    setElapsedSeconds(0);
  }, [stopTimer]);

  const handleImageUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    selectImage(url);
  }, [selectImage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageUpload(file);
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

  const handleNewGame = useCallback(() => {
    setGameStarted(false);
    setIsComplete(false);
    stopTimer();
    setElapsedSeconds(0);
  }, [stopTimer]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

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
          padding: isMobile ? '8px 12px' : '10px 20px',
          background: 'rgba(15,18,35,0.97)',
          borderBottom: '1px solid rgba(168,85,247,0.3)',
          backdropFilter: 'blur(10px)',
          gap: isMobile ? 8 : 16,
          flexShrink: 0,
          zIndex: 100,
          minHeight: isMobile ? 44 : 52,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: isMobile ? 28 : 34,
              height: isMobile ? 28 : 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 13 : 16,
              boxShadow: '0 0 12px rgba(168,85,247,0.5)',
              flexShrink: 0,
            }}
          >
            🧩
          </div>
          {!isMobile && (
            <span style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 16 }}>퍼즐 게임</span>
          )}
        </div>

        {/* Progress + Timer */}
        {gameStarted && !isComplete && (
          <>
            <div style={{ width: 1, height: 20, background: 'rgba(168,85,247,0.3)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ color: 'rgba(168,85,247,0.9)', fontSize: isMobile ? 11 : 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {completedCount}/{totalPieces}
              </span>
              <div style={{ width: isMobile ? 60 : 100, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
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
            <div style={{ width: 1, height: 20, background: 'rgba(168,85,247,0.3)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span style={{ color: 'rgba(192,132,252,0.95)', fontSize: isMobile ? 11 : 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Share / QR button (setup screen only) */}
        {!gameStarted && (
          <button
            onClick={() => setShowQr(v => !v)}
            title="모바일로 열기"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: isMobile ? '5px 10px' : '6px 12px',
              background: showQr ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.1)',
              border: '1px solid rgba(168,85,247,0.35)',
              borderRadius: 8,
              color: '#c084fc',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            {!isMobile && '모바일로 열기'}
          </button>
        )}

        {gameStarted && (
          <button
            onClick={handleNewGame}
            style={{
              padding: isMobile ? '5px 10px' : '6px 14px',
              background: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.4)',
              borderRadius: 8,
              color: '#c084fc',
              fontSize: isMobile ? 11 : 13,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            새 게임
          </button>
        )}
      </div>

      {/* QR / Share panel */}
      {showQr && !gameStarted && (
        <div
          style={{
            position: 'absolute',
            top: isMobile ? 50 : 60,
            right: 12,
            zIndex: 200,
            background: 'rgba(20,15,40,0.98)',
            border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: 180,
          }}
        >
          <span style={{ color: '#c084fc', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>모바일로 열기</span>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}&bgcolor=14-09-28&color=a855f7&margin=8`}
            alt="QR Code"
            width={140}
            height={140}
            style={{ borderRadius: 8, background: '#fff', padding: 4 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
            <div
              style={{
                flex: 1,
                fontSize: 10,
                color: 'rgba(255,255,255,0.5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 6,
                padding: '4px 8px',
              }}
            >
              {shareUrl}
            </div>
            <button
              onClick={handleCopyLink}
              style={{
                padding: '4px 10px',
                background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.4)'}`,
                borderRadius: 6,
                color: copied ? '#4ade80' : '#c084fc',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>
      )}

      {!gameStarted ? (
        /* ─── Setup screen ─── */
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: isMobile ? '14px 12px 24px' : '20px 24px 32px',
            overflowY: 'auto',
          }}
        >
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>

            {/* Sample images section */}
            <div>
              <div style={{ color: '#e2d9f3', fontWeight: 700, fontSize: isMobile ? 13 : 14, marginBottom: 10 }}>
                샘플 이미지 선택
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
                  gap: isMobile ? 8 : 10,
                }}
              >
                {SAMPLE_IMAGES.map(img => (
                  <button
                    key={img.id}
                    onClick={() => selectImage(img.url, img.id)}
                    style={{
                      position: 'relative',
                      padding: 0,
                      border: selectedSampleId === img.id
                        ? '2px solid rgba(168,85,247,0.9)'
                        : '2px solid transparent',
                      borderRadius: 10,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: 'none',
                      aspectRatio: '5/3',
                      boxShadow: selectedSampleId === img.id
                        ? '0 0 16px rgba(168,85,247,0.5)'
                        : '0 2px 8px rgba(0,0,0,0.4)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <img
                      src={img.thumb}
                      alt={img.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      crossOrigin="anonymous"
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: selectedSampleId === img.id
                          ? 'rgba(168,85,247,0.15)'
                          : 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: 5,
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: isMobile ? 10 : 11, fontWeight: 600 }}>{img.label}</span>
                    </div>
                    {selectedSampleId === img.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 5,
                          right: 5,
                          width: 18,
                          height: 18,
                          background: '#a855f7',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(168,85,247,0.2)' }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600 }}>또는 직접 업로드</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(168,85,247,0.2)' }} />
            </div>

            {/* Upload area */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'rgba(168,85,247,0.9)' : selectedSampleId ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.4)'}`,
                borderRadius: 12,
                padding: isMobile ? '16px 12px' : '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(168,85,247,0.1)' : 'rgba(15,18,35,0.5)',
                transition: 'all 0.2s ease',
              }}
            >
              {imageUrl && !selectedSampleId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <img
                    src={imageUrl}
                    alt="Uploaded"
                    style={{ maxWidth: '100%', maxHeight: isMobile ? 100 : 130, borderRadius: 8, objectFit: 'contain' }}
                  />
                  <span style={{ color: '#c084fc', fontSize: 11 }}>클릭하여 다른 이미지 선택</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📷</span>
                  <span style={{ color: selectedSampleId ? 'rgba(255,255,255,0.35)' : '#c084fc', fontWeight: 600, fontSize: isMobile ? 12 : 13 }}>
                    내 이미지 업로드
                  </span>
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

            {/* Piece count */}
            <div>
              <div style={{ color: '#e2d9f3', fontWeight: 600, fontSize: isMobile ? 12 : 13, marginBottom: 8 }}>
                피스 수 선택 ({selectedPieceCount}개)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 8 }}>
                {PIECE_COUNTS.map(count => (
                  <button
                    key={count}
                    onClick={() => setSelectedPieceCount(count)}
                    style={{
                      padding: isMobile ? '6px 12px' : '7px 16px',
                      borderRadius: 8,
                      border: selectedPieceCount === count
                        ? '2px solid rgba(168,85,247,0.9)'
                        : '1px solid rgba(168,85,247,0.25)',
                      background: selectedPieceCount === count
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.3))'
                        : 'rgba(15,18,35,0.6)',
                      color: selectedPieceCount === count ? '#e2d9f3' : 'rgba(255,255,255,0.5)',
                      fontWeight: selectedPieceCount === count ? 700 : 500,
                      fontSize: isMobile ? 12 : 13,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: selectedPieceCount === count ? '0 0 12px rgba(168,85,247,0.3)' : 'none',
                    }}
                  >
                    {count}조각
                  </button>
                ))}
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={startGame}
              disabled={!imageUrl}
              style={{
                padding: isMobile ? '12px' : '13px',
                background: imageUrl
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'rgba(100,100,100,0.3)',
                border: 'none',
                borderRadius: 12,
                color: imageUrl ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: isMobile ? 14 : 15,
                fontWeight: 700,
                cursor: imageUrl ? 'pointer' : 'not-allowed',
                boxShadow: imageUrl ? '0 4px 20px rgba(168,85,247,0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {imageUrl ? '🧩 게임 시작' : '이미지를 선택하거나 업로드해주세요'}
            </button>
          </div>
        </div>
      ) : (
        /* ─── Game screen ─── */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'auto',
            padding: isMobile ? '8px 8px 180px' : '12px 16px 200px',
          }}
        >
          {/* Reference image row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: isMobile && isLandscape ? 6 : 10,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                borderRadius: 7,
                overflow: 'hidden',
                border: '1px solid rgba(168,85,247,0.5)',
                boxShadow: '0 0 16px rgba(168,85,247,0.2)',
                flexShrink: 0,
              }}
            >
              <img
                src={imageUrl!}
                alt="Reference"
                crossOrigin="anonymous"
                style={{
                  width: isMobile && isLandscape ? 100 : isMobile ? 130 : 178,
                  height: isMobile && isLandscape ? 56 : isMobile ? 73 : 100,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.5))' }} />
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: isMobile ? 8 : 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                목표 이미지
              </div>
            </div>

            {config && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(124,58,237,0.2)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: isMobile ? 9 : 11 }}>그리드</span>
                  <span style={{ color: '#c084fc', fontSize: isMobile ? 10 : 12, fontWeight: 700 }}>{config.cols}×{config.rows}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(124,58,237,0.2)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: isMobile ? 9 : 11 }}>총</span>
                  <span style={{ color: '#c084fc', fontSize: isMobile ? 10 : 12, fontWeight: 700 }}>{config.totalPieces}조각</span>
                </div>
              </div>
            )}
          </div>

          {/* Board */}
          {config && (
            <div
              style={{
                flexShrink: 0,
                transform: `scale(${boardScale})`,
                transformOrigin: 'top center',
              }}
            >
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
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              padding: isMobile ? '32px 28px' : '44px 52px',
              background: 'linear-gradient(135deg, rgba(20,15,40,0.99), rgba(30,20,60,0.99))',
              borderRadius: 22,
              border: '2px solid rgba(168,85,247,0.6)',
              boxShadow: '0 0 80px rgba(168,85,247,0.4), 0 0 160px rgba(124,58,237,0.2)',
              textAlign: 'center',
              width: '100%',
              maxWidth: 340,
            }}
          >
            <div style={{ fontSize: isMobile ? 48 : 60 }}>🎉</div>
            <div>
              <div
                style={{
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #c084fc, #a855f7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: 5,
                }}
              >
                퍼즐 완성!
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? 12 : 13 }}>
                {totalPieces}개 조각을 모두 맞췄어요!
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                padding: '14px 28px',
                background: 'rgba(168,85,247,0.12)',
                border: '1px solid rgba(168,85,247,0.35)',
                borderRadius: 12,
                width: '100%',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                완성까지 걸린 시간
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span style={{ color: '#e2d9f3', fontSize: isMobile ? 22 : 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(finalTime)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                onClick={() => { setGameStarted(false); setIsComplete(false); stopTimer(); setElapsedSeconds(0); }}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: 'rgba(168,85,247,0.2)',
                  border: '1px solid rgba(168,85,247,0.5)',
                  borderRadius: 11,
                  color: '#c084fc',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                새 이미지
              </button>
              <button
                onClick={startGame}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  border: 'none',
                  borderRadius: 11,
                  color: '#fff',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(168,85,247,0.5)',
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
