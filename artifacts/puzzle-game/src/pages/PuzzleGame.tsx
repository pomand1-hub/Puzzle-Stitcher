import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PuzzlePiece, PuzzleConfig, calculateGrid, createPieces } from '@/lib/puzzleUtils';
import { PuzzleBoard } from '@/components/PuzzleBoard';

const PIECE_COUNTS = [4, 6, 9, 12, 16, 20, 25, 30];
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 450;

const SAMPLE_IMAGES = [
  { id: 'nature', label: '자연', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=120&fit=crop&auto=format' },
  { id: 'city', label: '도시', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=200&h=120&fit=crop&auto=format' },
  { id: 'ocean', label: '바다', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&h=120&fit=crop&auto=format' },
  { id: 'animal', label: '동물', url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=200&h=120&fit=crop&auto=format' },
  { id: 'flower', label: '꽃', url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=200&h=120&fit=crop&auto=format' },
  { id: 'space', label: '우주', url: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=200&h=120&fit=crop&auto=format' },
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
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return vp;
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    image: params.get('img') ?? null,
    pieces: parseInt(params.get('pieces') ?? '0', 10) || null,
    autostart: params.get('autostart') === '1',
    admin: params.get('admin') === '1',
  };
}

// Compress an image file to a base64 data URL (small size for URL sharing)
function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 400, MAX_H = 225;
      let w = img.naturalWidth, h = img.naturalHeight;
      const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas error')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}

export default function PuzzleGame() {
  const urlParams = useRef(getUrlParams());

  const [imageUrl, setImageUrl] = useState<string | null>(urlParams.current.image);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(() => {
    if (urlParams.current.image) {
      const match = SAMPLE_IMAGES.find(s => s.url === urlParams.current.image);
      return match?.id ?? null;
    }
    return null;
  });
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [config, setConfig] = useState<PuzzleConfig | null>(null);
  const [trayHeight, setTrayHeight] = useState(0);
  const [selectedPieceCount, setSelectedPieceCount] = useState(urlParams.current.pieces ?? 9);
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

  // Admin state
  const [showAdmin, setShowAdmin] = useState(urlParams.current.admin);
  const [adminSampleId, setAdminSampleId] = useState<string | null>(null);
  const [adminImageUrl, setAdminImageUrl] = useState('');
  const [adminUploadedBase64, setAdminUploadedBase64] = useState<string | null>(null);
  const [adminUploadName, setAdminUploadName] = useState('');
  const [adminDragOver, setAdminDragOver] = useState(false);
  const [adminPieces, setAdminPieces] = useState(9);
  const [adminLink, setAdminLink] = useState('');
  const [adminLinkCopied, setAdminLinkCopied] = useState(false);
  const [adminCompressing, setAdminCompressing] = useState(false);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  const vp = useViewport();
  const HEADER_H = 48;
  const totalPlayH = BOARD_HEIGHT + trayHeight;
  const boardScale = gameStarted && config
    ? Math.min((vp.w - 16) / BOARD_WIDTH, (vp.h - HEADER_H - 8) / totalPlayH, 1)
    : 1;

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

  const startGame = useCallback((imgUrl?: string, pieceCount?: number) => {
    const url = imgUrl ?? imageUrl;
    const count = pieceCount ?? selectedPieceCount;
    if (!url) return;
    const cfg = calculateGrid(count, BOARD_WIDTH, BOARD_HEIGHT);
    const { pieces: newPieces, trayHeight: newTrayH } = createPieces(cfg, BOARD_WIDTH, BOARD_HEIGHT);
    setConfig(cfg);
    setPieces(newPieces);
    setTrayHeight(newTrayH);
    setGameStarted(true);
    setIsComplete(false);
    setCompletedCount(0);
    if (imgUrl) setImageUrl(imgUrl);
    startTimer();
  }, [imageUrl, selectedPieceCount, startTimer]);

  useEffect(() => {
    const { image, pieces: p, autostart } = urlParams.current;
    if (image && autostart) startGame(image, p ?? 9);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setCompletedCount(pieces.filter(p => p.isPlaced).length);
  }, [pieces]);

  // Admin: handle file upload with compression
  const handleAdminFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setAdminCompressing(true);
    setAdminLink('');
    setAdminSampleId(null);
    setAdminImageUrl('');
    try {
      const base64 = await compressImageFile(file);
      setAdminUploadedBase64(base64);
      setAdminUploadName(file.name);
    } finally {
      setAdminCompressing(false);
    }
  }, []);

  const handleAdminFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAdminFile(file);
    e.target.value = '';
  }, [handleAdminFile]);

  const handleAdminDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setAdminDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleAdminFile(file);
  }, [handleAdminFile]);

  // Admin: generate shareable link
  const generateAdminLink = useCallback(() => {
    let imgSrc = '';
    if (adminUploadedBase64) {
      imgSrc = adminUploadedBase64;
    } else if (adminSampleId) {
      imgSrc = SAMPLE_IMAGES.find(s => s.id === adminSampleId)?.url ?? '';
    } else if (adminImageUrl.trim()) {
      imgSrc = adminImageUrl.trim();
    }
    if (!imgSrc) return;
    const base = window.location.origin + window.location.pathname;
    const link = `${base}?img=${encodeURIComponent(imgSrc)}&pieces=${adminPieces}&autostart=1`;
    setAdminLink(link);
  }, [adminUploadedBase64, adminSampleId, adminImageUrl, adminPieces]);

  const copyAdminLink = useCallback(() => {
    navigator.clipboard.writeText(adminLink).then(() => {
      setAdminLinkCopied(true);
      setTimeout(() => setAdminLinkCopied(false), 2000);
    });
  }, [adminLink]);

  const adminHasImage = !!(adminUploadedBase64 || adminSampleId || adminImageUrl.trim());

  const totalPieces = config?.totalPieces ?? 0;
  const progress = totalPieces > 0 ? (completedCount / totalPieces) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(135deg, #0f1223 0%, #1a1035 50%, #0f1223 100%)', overflow: 'hidden', fontFamily: 'var(--app-font-sans)', position: 'relative' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: HEADER_H, background: 'rgba(15,18,35,0.97)', borderBottom: '1px solid rgba(168,85,247,0.3)', gap: 10, flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 0 12px rgba(168,85,247,0.5)', flexShrink: 0 }}>🧩</div>
          <span style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>퍼즐 게임</span>
        </div>

        {gameStarted && !isComplete && (
          <>
            <div style={{ width: 1, height: 18, background: 'rgba(168,85,247,0.3)', flexShrink: 0 }} />
            <span style={{ color: 'rgba(168,85,247,0.9)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{completedCount}/{totalPieces}</span>
            <div style={{ width: 70, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed, #a855f7)', borderRadius: 99, transition: 'width 0.3s', boxShadow: '0 0 6px rgba(168,85,247,0.6)' }} />
            </div>
            <div style={{ width: 1, height: 18, background: 'rgba(168,85,247,0.3)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ color: 'rgba(192,132,252,0.95)', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatTime(elapsedSeconds)}</span>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {!gameStarted && (
          <>
            <button onClick={() => { setShowQr(v => !v); setShowAdmin(false); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: showQr ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 7, color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              QR
            </button>
            <button onClick={() => { setShowAdmin(v => !v); setShowQr(false); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: showAdmin ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 7, color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              ⚙️ 관리자
            </button>
          </>
        )}

        {gameStarted && (
          <button onClick={handleNewGame} style={{ padding: '5px 12px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 7, color: '#c084fc', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>새 게임</button>
        )}
      </div>

      {/* ── QR panel ── */}
      {showQr && !gameStarted && (
        <div style={{ position: 'absolute', top: HEADER_H + 6, right: 12, zIndex: 200, background: 'rgba(20,15,40,0.98)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 170 }}>
          <span style={{ color: '#c084fc', fontSize: 11, fontWeight: 700 }}>모바일로 열기</span>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(shareUrl)}&margin=6`} alt="QR" width={130} height={130} style={{ borderRadius: 7, background: '#fff', padding: 3 }} />
          <button onClick={handleCopyLink} style={{ width: '100%', padding: '5px 0', background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)', border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.4)'}`, borderRadius: 7, color: copied ? '#4ade80' : '#c084fc', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{copied ? '복사됨!' : '링크 복사'}</button>
        </div>
      )}

      {/* ── Admin panel ── */}
      {showAdmin && !gameStarted && (
        <div style={{ position: 'absolute', top: HEADER_H + 6, right: 12, zIndex: 200, background: 'rgba(20,15,40,0.99)', border: '1px solid rgba(168,85,247,0.45)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 12px 48px rgba(0,0,0,0.7)', width: 310, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          <div style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 13 }}>⚙️ 관리자 링크 생성</div>

          {/* Step 1: Image source */}
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>1단계 · 이미지 선택</div>

            {/* Upload area */}
            <div
              onDrop={handleAdminDrop}
              onDragOver={e => { e.preventDefault(); setAdminDragOver(true); }}
              onDragLeave={() => setAdminDragOver(false)}
              onClick={() => adminFileInputRef.current?.click()}
              style={{ border: `2px dashed ${adminDragOver ? 'rgba(168,85,247,0.9)' : adminUploadedBase64 ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.35)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: adminDragOver ? 'rgba(168,85,247,0.1)' : 'rgba(15,18,35,0.5)', transition: 'all 0.15s', marginBottom: 8 }}
            >
              {adminCompressing ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#c084fc', fontSize: 12 }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> 압축 중...
                </div>
              ) : adminUploadedBase64 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={adminUploadedBase64} alt="uploaded" style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#c084fc', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminUploadName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>클릭하여 변경</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <span style={{ fontSize: 16 }}>📁</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>이미지 업로드 (클릭 또는 드래그)</span>
                </div>
              )}
            </div>
            <input ref={adminFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAdminFileChange} />

            {/* OR: sample images */}
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, textAlign: 'center', marginBottom: 7 }}>또는 샘플 선택</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {SAMPLE_IMAGES.map(img => (
                <button key={img.id} onClick={() => { setAdminSampleId(img.id === adminSampleId ? null : img.id); setAdminUploadedBase64(null); setAdminImageUrl(''); setAdminLink(''); }}
                  style={{ position: 'relative', padding: 0, border: adminSampleId === img.id ? '2px solid rgba(168,85,247,0.9)' : '2px solid transparent', borderRadius: 7, overflow: 'hidden', cursor: 'pointer', background: 'none', aspectRatio: '5/3', boxShadow: adminSampleId === img.id ? '0 0 10px rgba(168,85,247,0.4)' : 'none' }}>
                  <img src={img.thumb} alt={img.label} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 3 }}>
                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 600 }}>{img.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* OR: URL input */}
            {!adminSampleId && !adminUploadedBase64 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, marginBottom: 5, textAlign: 'center' }}>또는 URL 직접 입력</div>
                <input type="text" value={adminImageUrl} onChange={e => { setAdminImageUrl(e.target.value); setAdminLink(''); }} placeholder="https://example.com/image.jpg"
                  style={{ width: '100%', padding: '7px 10px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, color: '#e2d9f3', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            )}
          </div>

          {/* Step 2: Piece count */}
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>2단계 · 피스 수 선택</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {PIECE_COUNTS.map(count => (
                <button key={count} onClick={() => { setAdminPieces(count); setAdminLink(''); }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: adminPieces === count ? '1.5px solid rgba(168,85,247,0.9)' : '1px solid rgba(168,85,247,0.2)', background: adminPieces === count ? 'rgba(168,85,247,0.25)' : 'rgba(15,18,35,0.6)', color: adminPieces === count ? '#e2d9f3' : 'rgba(255,255,255,0.45)', fontWeight: adminPieces === count ? 700 : 500, fontSize: 11, cursor: 'pointer' }}>
                  {count}조각
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button onClick={generateAdminLink} disabled={!adminHasImage}
            style={{ padding: '10px', background: adminHasImage ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(100,100,100,0.3)', border: 'none', borderRadius: 9, color: adminHasImage ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, cursor: adminHasImage ? 'pointer' : 'not-allowed', boxShadow: adminHasImage ? '0 3px 14px rgba(168,85,247,0.4)' : 'none' }}>
            🔗 플레이어 링크 생성
          </button>

          {/* Generated link */}
          {adminLink && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>생성된 링크 (플레이어에게 보내세요)</div>
              <div style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8, padding: '7px 10px', color: 'rgba(255,255,255,0.55)', fontSize: 10, wordBreak: 'break-all', lineHeight: 1.5, maxHeight: 60, overflow: 'auto' }}>
                {adminLink.length > 200 ? adminLink.slice(0, 80) + '…' : adminLink}
              </div>
              {adminLink.length > 200 && (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>* 업로드된 이미지가 링크에 포함되어 링크가 깁니다. 복사 후 공유하세요.</div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={copyAdminLink} style={{ flex: 1, padding: '7px', background: adminLinkCopied ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)', border: `1px solid ${adminLinkCopied ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.4)'}`, borderRadius: 8, color: adminLinkCopied ? '#4ade80' : '#c084fc', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {adminLinkCopied ? '✓ 복사됨!' : '📋 복사'}
                </button>
                <button onClick={() => window.open(adminLink, '_blank')} style={{ flex: 1, padding: '7px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  👁 미리보기
                </button>
              </div>
            </div>
          )}

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!gameStarted ? (
        /* ── Setup screen ── */
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '14px 12px 32px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <div style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>샘플 이미지 선택</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {SAMPLE_IMAGES.map(img => (
                  <button key={img.id} onClick={() => selectImage(img.url, img.id)}
                    style={{ position: 'relative', padding: 0, border: selectedSampleId === img.id ? '2px solid rgba(168,85,247,0.9)' : '2px solid transparent', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'none', aspectRatio: '5/3', boxShadow: selectedSampleId === img.id ? '0 0 16px rgba(168,85,247,0.5)' : '0 2px 8px rgba(0,0,0,0.4)', transition: 'all 0.15s ease' }}>
                    <img src={img.thumb} alt={img.label} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: selectedSampleId === img.id ? 'rgba(168,85,247,0.15)' : 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{img.label}</span>
                    </div>
                    {selectedSampleId === img.id && (
                      <div style={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, background: '#a855f7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(168,85,247,0.2)' }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600 }}>또는 직접 업로드</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(168,85,247,0.2)' }} />
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? 'rgba(168,85,247,0.9)' : selectedSampleId ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.4)'}`, borderRadius: 12, padding: '14px 12px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(168,85,247,0.1)' : 'rgba(15,18,35,0.5)', transition: 'all 0.2s ease' }}
            >
              {imageUrl && !selectedSampleId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <img src={imageUrl} alt="Uploaded" style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 7, objectFit: 'contain' }} />
                  <span style={{ color: '#c084fc', fontSize: 11 }}>클릭하여 다른 이미지 선택</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>📷</span>
                  <span style={{ color: selectedSampleId ? 'rgba(255,255,255,0.35)' : '#c084fc', fontWeight: 600, fontSize: 13 }}>내 이미지 업로드</span>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

            <div>
              <div style={{ color: '#e2d9f3', fontWeight: 600, fontSize: 13, marginBottom: 7 }}>피스 수 선택 ({selectedPieceCount}개)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PIECE_COUNTS.map(count => (
                  <button key={count} onClick={() => setSelectedPieceCount(count)}
                    style={{ padding: '6px 13px', borderRadius: 8, border: selectedPieceCount === count ? '2px solid rgba(168,85,247,0.9)' : '1px solid rgba(168,85,247,0.25)', background: selectedPieceCount === count ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.3))' : 'rgba(15,18,35,0.6)', color: selectedPieceCount === count ? '#e2d9f3' : 'rgba(255,255,255,0.5)', fontWeight: selectedPieceCount === count ? 700 : 500, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: selectedPieceCount === count ? '0 0 12px rgba(168,85,247,0.3)' : 'none' }}>
                    {count}조각
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => startGame()} disabled={!imageUrl}
              style={{ padding: '13px', background: imageUrl ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(100,100,100,0.3)', border: 'none', borderRadius: 12, color: imageUrl ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: 700, cursor: imageUrl ? 'pointer' : 'not-allowed', boxShadow: imageUrl ? '0 4px 20px rgba(168,85,247,0.5)' : 'none', transition: 'all 0.2s ease' }}>
              {imageUrl ? '🧩 게임 시작' : '이미지를 선택하거나 업로드해주세요'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Game screen ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden', padding: '6px 8px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexShrink: 0 }}>
            <div style={{ position: 'relative', borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(168,85,247,0.5)', boxShadow: '0 0 16px rgba(168,85,247,0.2)', flexShrink: 0 }}>
              <img src={imageUrl!} alt="Reference" style={{ width: 120, height: 68, objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.5))' }} />
              <div style={{ position: 'absolute', bottom: 3, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>목표 이미지</div>
            </div>
            {config && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: 'rgba(124,58,237,0.2)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>그리드</span>
                  <span style={{ color: '#c084fc', fontSize: 11, fontWeight: 700 }}>{config.cols}×{config.rows}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: 'rgba(124,58,237,0.2)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>총</span>
                  <span style={{ color: '#c084fc', fontSize: 11, fontWeight: 700 }}>{config.totalPieces}조각</span>
                </div>
              </div>
            )}
          </div>

          {config && (
            <div style={{ flexShrink: 0, transform: `scale(${boardScale})`, transformOrigin: 'top center' }}>
              <PuzzleBoard
                pieces={pieces} setPieces={setPieces} imageUrl={imageUrl!}
                config={config} boardWidth={BOARD_WIDTH} boardHeight={BOARD_HEIGHT}
                trayHeight={trayHeight} onComplete={handleComplete}
                snappingPieceId={snappingPieceId} setSnappingPieceId={setSnappingPieceId}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Completion overlay ── */}
      {isComplete && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 9999, padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '36px 44px', background: 'linear-gradient(135deg, rgba(20,15,40,0.99), rgba(30,20,60,0.99))', borderRadius: 22, border: '2px solid rgba(168,85,247,0.6)', boxShadow: '0 0 80px rgba(168,85,247,0.4), 0 0 160px rgba(124,58,237,0.2)', textAlign: 'center', width: '100%', maxWidth: 320 }}>
            <div style={{ fontSize: 54 }}>🎉</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #c084fc, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>퍼즐 완성!</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{totalPieces}개 조각을 모두 맞췄어요!</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 24px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 12, width: '100%' }}>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>완성까지 걸린 시간</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ color: '#e2d9f3', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatTime(finalTime)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button onClick={() => { setGameStarted(false); setIsComplete(false); stopTimer(); setElapsedSeconds(0); }} style={{ flex: 1, padding: '10px', background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 10, color: '#c084fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>새 이미지</button>
              <button onClick={() => startGame()} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 18px rgba(168,85,247,0.5)' }}>다시 하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
