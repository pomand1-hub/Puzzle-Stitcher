import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PuzzlePiece, PuzzleConfig, calculateGrid, createPieces } from '@/lib/puzzleUtils';
import { PuzzleBoard } from '@/components/PuzzleBoard';

const PIECE_COUNTS = [4, 6, 9, 12, 16, 20, 25, 30];
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 450;
const HEADER_H = 48;

const SAMPLE_IMAGES = [
  { id: 'nature', label: '자연', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=120&fit=crop&auto=format' },
  { id: 'city', label: '도시', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=200&h=120&fit=crop&auto=format' },
  { id: 'ocean', label: '바다', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&h=120&fit=crop&auto=format' },
  { id: 'animal', label: '동물', url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=200&h=120&fit=crop&auto=format' },
  { id: 'flower', label: '꽃', url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=200&h=120&fit=crop&auto=format' },
  { id: 'space', label: '우주', url: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=800&h=450&fit=crop&auto=format', thumb: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=200&h=120&fit=crop&auto=format' },
];

// 👉 수정됨: 초 단위(s) 대신 밀리초(ms)를 받아서 0.01초 단위로 변환하는 함수
function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const centiSeconds = Math.floor((ms % 1000) / 10); // 0.01초 단위 추출

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  // 0.01초 자리가 항상 두 자리(예: .05)가 되도록 만듦
  const cs = centiSeconds.toString().padStart(2, '0');

  if (h > 0) return `${h}시간 ${m}분 ${s}.${cs}초`;
  if (m > 0) return `${m}분 ${s}.${cs}초`;
  return `${s}.${cs}초`;
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
  const p = new URLSearchParams(window.location.search);
  return {
    img: p.get('img'),
    pid: p.get('pid'),
    pieces: parseInt(p.get('pieces') ?? '0', 10) || null,
    autostart: p.get('autostart') === '1',
    admin: p.get('admin') === '1',
  };
}

function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * ratio);
      const h = Math.round(img.naturalHeight * ratio);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(blobUrl);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}

interface AdminGameRecord {
  id: string;
  label: string;
  thumb: string;
  pieces: number;
  createdAt: number;
  deleteToken: string;
  link: string;
  imageType: 'upload' | 'sample' | 'url';
}

const HISTORY_KEY = 'puzzleAdminHistory_v1';

function loadHistory(): AdminGameRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AdminGameRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveHistory(list: AdminGameRecord[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* quota exceeded */ }
}

async function uploadToApi(base64: string): Promise<{ id: string; deleteToken: string }> {
  const res = await fetch('/api/puzzle-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64 }),
  });
  if (res.status === 429) throw new Error('서버가 혼잡합니다. 잠시 후 다시 시도해주세요.');
  if (!res.ok) throw new Error('업로드에 실패했습니다.');
  return await res.json() as { id: string; deleteToken: string };
}

async function deleteFromApi(id: string, token: string): Promise<void> {
  const res = await fetch(`/api/puzzle-images/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error('삭제에 실패했습니다.');
}

async function fetchFromApi(pid: string): Promise<string> {
  const res = await fetch(`/api/puzzle-images/${pid}`);
  if (!res.ok) throw new Error('Not found');
  const json = await res.json() as { data: string };
  return json.data;
}

export default function PuzzleGame() {
  const urlParams = useRef(getUrlParams());
  const isSharedLink = urlParams.current.autostart; 

  const [imageUrl, setImageUrl] = useState<string | null>(() => urlParams.current.img);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(() => {
    const u = urlParams.current.img;
    return u ? (SAMPLE_IMAGES.find(s => s.url === u)?.id ?? null) : null;
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

  // 👉 수정됨: 초 단위 대신 밀리초 단위로 상태 저장
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState(0);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Admin
  const [showAdmin, setShowAdmin] = useState(urlParams.current.admin);
  const [adminSampleId, setAdminSampleId] = useState<string | null>(null);
  const [adminImageUrl, setAdminImageUrl] = useState('');
  const [adminUploadPreview, setAdminUploadPreview] = useState('');
  const [adminUploadName, setAdminUploadName] = useState('');
  const [adminUploadBase64, setAdminUploadBase64] = useState('');
  const [adminDragOver, setAdminDragOver] = useState(false);
  const [adminCompressing, setAdminCompressing] = useState(false);
  const [adminPieces, setAdminPieces] = useState(9);
  const [adminLink, setAdminLink] = useState('');
  const [adminLinkCopied, setAdminLinkCopied] = useState(false);
  const [adminGenerating, setAdminGenerating] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminHistory, setAdminHistory] = useState<AdminGameRecord[]>(() => loadHistory());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const adminFileRef = useRef<HTMLInputElement>(null);

  const vp = useViewport();
  const isLandscape = vp.w > vp.h;

  const refRowH = isLandscape ? 52 : 86;
  const gamePad = 12;
  const totalPlayH = BOARD_HEIGHT + trayHeight;
  const boardScale = gameStarted && config && trayHeight > 0
    ? Math.min(
        (vp.w - 16) / BOARD_WIDTH,
        (vp.h - HEADER_H - refRowH - gamePad) / totalPlayH,
        1
      )
    : 1;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    setElapsedTimeMs(0);
    // 👉 수정됨: 1초(1000ms)가 아닌 0.01초(10ms)마다 타이머 업데이트
    timerRef.current = setInterval(() => setElapsedTimeMs(Date.now() - startTimeRef.current), 10);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const selectImage = useCallback((url: string, sampleId?: string) => {
    setImageUrl(url); setSelectedSampleId(sampleId ?? null);
    setGameStarted(false); setIsComplete(false);
    setPieces([]); setConfig(null);
    stopTimer(); setElapsedTimeMs(0);
  }, [stopTimer]);

  const handleImageFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    selectImage(url);
  }, [selectImage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleImageFile(f);
  }, [handleImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) handleImageFile(f);
  }, [handleImageFile]);

  const startGame = useCallback((imgUrl?: string, pieceCount?: number) => {
    const url = imgUrl ?? imageUrl;
    const count = pieceCount ?? selectedPieceCount;
    if (!url) return;
    const cfg = calculateGrid(count, BOARD_WIDTH, BOARD_HEIGHT);
    const { pieces: newPieces, trayHeight: newTrayH } = createPieces(cfg, BOARD_WIDTH, BOARD_HEIGHT);
    setConfig(cfg); setPieces(newPieces); setTrayHeight(newTrayH);
    setGameStarted(true); setIsComplete(false); setCompletedCount(0);
    if (imgUrl) setImageUrl(imgUrl);
    startTimer();
  }, [imageUrl, selectedPieceCount, startTimer]);

  useEffect(() => {
    const { img, pid, pieces: p, autostart } = urlParams.current;
    if (pid) {
      setLoading(true);
      fetchFromApi(pid)
        .then(data => {
          setImageUrl(data);
          if (autostart) startGame(data, p ?? 9);
        })
        .catch(() => setLoadError('이미지를 불러올 수 없습니다. 링크가 만료되었을 수 있어요.'))
        .finally(() => setLoading(false));
    } else if (img && autostart) {
      startGame(img, p ?? 9);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleComplete = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    setFinalTimeMs(elapsed); stopTimer(); setIsComplete(true);
  }, [stopTimer]);

  const handleNewGame = useCallback(() => {
    setGameStarted(false); setIsComplete(false); stopTimer(); setElapsedTimeMs(0);
  }, [stopTimer]);

  useEffect(() => setCompletedCount(pieces.filter(p => p.isPlaced).length), [pieces]);

  // Admin image upload
  const handleAdminFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setAdminCompressing(true); setAdminLink(''); setAdminSampleId(null); setAdminImageUrl('');
    try {
      const preview = await compressImage(file, 120, 68, 0.7);
      const full = await compressImage(file, 480, 270, 0.6);
      setAdminUploadPreview(preview);
      setAdminUploadBase64(full);
      setAdminUploadName(file.name);
    } finally {
      setAdminCompressing(false);
    }
  }, []);

  const handleAdminFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleAdminFile(f);
    e.target.value = '';
  }, [handleAdminFile]);

  const handleAdminDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setAdminDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleAdminFile(f);
  }, [handleAdminFile]);

  const generateAdminLink = useCallback(async () => {
    let imgSrc = '';
    let label = '';
    let thumb = '';
    let imageType: 'upload' | 'sample' | 'url' = 'url';

    if (adminUploadBase64) {
      imgSrc = adminUploadBase64;
      label = adminUploadName || '업로드 이미지';
      thumb = adminUploadPreview;
      imageType = 'upload';
    } else if (adminSampleId) {
      const s = SAMPLE_IMAGES.find(x => x.id === adminSampleId);
      if (s) { imgSrc = s.url; label = `샘플 · ${s.label}`; thumb = s.thumb; imageType = 'sample'; }
    } else if (adminImageUrl.trim()) {
      imgSrc = adminImageUrl.trim();
      label = 'URL 이미지';
      thumb = imgSrc;
      imageType = 'url';
    }
    if (!imgSrc) return;

    setAdminGenerating(true);
    setAdminError('');
    try {
      let link = '';
      let deleteToken = '';
      let id = '';

      try {
        if (adminUploadBase64) {
          const r = await uploadToApi(adminUploadBase64);
          id = r.id; deleteToken = r.deleteToken;
          link = `${baseUrl}?pid=${id}&pieces=${adminPieces}&autostart=1`;
        } else {
          link = `${baseUrl}?img=${encodeURIComponent(imgSrc)}&pieces=${adminPieces}&autostart=1`;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '업로드 실패';
        setAdminError(msg);
        if (adminUploadBase64) {
          link = `${baseUrl}?img=${encodeURIComponent(adminUploadBase64)}&pieces=${adminPieces}&autostart=1`;
        }
      }

      setAdminLink(link);

      const record: AdminGameRecord = {
        id: id || `local-${Date.now()}`,
        label, thumb, pieces: adminPieces,
        createdAt: Date.now(), deleteToken, link, imageType,
      };
      const updated = [record, ...adminHistory].slice(0, 50);
      setAdminHistory(updated);
      saveHistory(updated);
    } finally {
      setAdminGenerating(false);
    }
  }, [adminUploadBase64, adminUploadName, adminUploadPreview, adminSampleId, adminImageUrl, adminPieces, baseUrl, adminHistory]);

  const deleteAdminGame = useCallback(async (record: AdminGameRecord) => {
    if (!confirm(`"${record.label}" 게임을 삭제하시겠습니까?\n링크가 즉시 무효화됩니다.`)) return;
    setDeletingId(record.id);
    try {
      if (record.deleteToken && !record.id.startsWith('local-')) {
        await deleteFromApi(record.id, record.deleteToken);
      }
      const updated = adminHistory.filter(r => r.id !== record.id);
      setAdminHistory(updated);
      saveHistory(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '삭제 실패';
      setAdminError(msg);
    } finally {
      setDeletingId(null);
    }
  }, [adminHistory]);

  const adminHasImage = !!(adminUploadBase64 || adminSampleId || adminImageUrl.trim());
  const linkIsShort = adminLink.length > 0 && adminLink.length < 3500;

  const totalPieces = config?.totalPieces ?? 0;
  const progress = totalPieces > 0 ? (completedCount / totalPieces) * 100 : 0;

  // Loading / error screen
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'linear-gradient(135deg, #0f1223, #1a1035)', color: '#c084fc' }}>
        <div style={{ fontSize: 40, animation: 'spin 1s linear infinite' }}>⏳</div>
        <span style={{ fontWeight: 600 }}>이미지 불러오는 중...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'linear-gradient(135deg, #0f1223, #1a1035)', color: '#fff', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>링크 오류</div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{loadError}</div>
        <button onClick={() => { setLoadError(''); window.history.replaceState({}, '', window.location.pathname); }} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>홈으로</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(135deg, #0f1223 0%, #1a1035 50%, #0f1223 100%)', overflow: 'hidden', fontFamily: 'var(--app-font-sans)', position: 'relative' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: HEADER_H, background: 'rgba(15,18,35,0.97)', borderBottom: '1px solid rgba(168,85,247,0.3)', gap: 8, flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 0 10px rgba(168,85,247,0.5)', flexShrink: 0 }}>🧩</div>
          <span style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>퍼즐 게임</span>
        </div>

        {gameStarted && !isComplete && (
          <>
            <div style={{ width: 1, height: 16, background: 'rgba(168,85,247,0.3)', flexShrink: 0 }} />
            <span style={{ color: 'rgba(168,85,247,0.9)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{completedCount}/{totalPieces}</span>
            <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed, #a855f7)', borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
            <div style={{ width: 1, height: 16, background: 'rgba(168,85,247,0.3)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ color: '#c084fc', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatTime(elapsedTimeMs)}
              </span>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {!gameStarted && (
          <>
            <button onClick={() => { setShowQr(v => !v); setShowAdmin(false); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: showQr ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 6, color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              QR
            </button>
            <button onClick={() => { setShowAdmin(v => !v); setShowQr(false); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: showAdmin ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 6, color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              ⚙️ 관리자
            </button>
          </>
        )}

        {gameStarted && !isSharedLink && (
          <button onClick={handleNewGame} style={{ padding: '4px 10px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 6, color: '#c084fc', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>새 게임</button>
        )}
      </div>

      {/* QR panel */}
      {showQr && !gameStarted && (
        <div style={{ position: 'absolute', top: HEADER_H + 6, right: 10, zIndex: 200, background: 'rgba(20,15,40,0.98)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', minWidth: 160 }}>
          <span style={{ color: '#c084fc', fontSize: 11, fontWeight: 700 }}>모바일로 열기</span>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(baseUrl)}&margin=6`} alt="QR" width={130} height={130} style={{ borderRadius: 6, background: '#fff', padding: 3 }} />
          <button onClick={() => { navigator.clipboard.writeText(baseUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }} style={{ width: '100%', padding: '5px', background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)', border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.4)'}`, borderRadius: 6, color: copied ? '#4ade80' : '#c084fc', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{copied ? '복사됨!' : '링크 복사'}</button>
        </div>
      )}

      {/* Admin panel */}
      {showAdmin && !gameStarted && (
        <div style={{ position: 'absolute', top: HEADER_H + 6, right: 10, zIndex: 200, background: 'rgba(20,15,40,0.99)', border: '1px solid rgba(168,85,247,0.45)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.7)', width: 300, maxWidth: 'calc(100vw - 20px)', maxHeight: `calc(100vh - ${HEADER_H + 20}px)`, overflowY: 'auto' }}>
          <div style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 13 }}>⚙️ 플레이어 링크 생성</div>

          <div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, marginBottom: 7, letterSpacing: '0.04em' }}>1단계 · 이미지</div>

            <div onDrop={handleAdminDrop} onDragOver={e => { e.preventDefault(); setAdminDragOver(true); }} onDragLeave={() => setAdminDragOver(false)} onClick={() => adminFileRef.current?.click()}
              style={{ border: `2px dashed ${adminDragOver ? 'rgba(168,85,247,0.9)' : adminUploadPreview ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.3)'}`, borderRadius: 9, padding: '9px 11px', cursor: 'pointer', background: adminDragOver ? 'rgba(168,85,247,0.1)' : 'rgba(15,18,35,0.5)', transition: 'all 0.15s', marginBottom: 7 }}>
              {adminCompressing ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#c084fc', fontSize: 11 }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> 처리 중...
                </div>
              ) : adminUploadPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={adminUploadPreview} alt="preview" style={{ width: 54, height: 30, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#c084fc', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminUploadName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>클릭하여 변경</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📁</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600 }}>이미지 업로드 (클릭/드래그)</span>
                </div>
              )}
            </div>
            <input ref={adminFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAdminFileChange} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(168,85,247,0.15)' }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 600 }}>또는 샘플</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(168,85,247,0.15)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {SAMPLE_IMAGES.map(img => (
                <button key={img.id} onClick={() => { setAdminSampleId(img.id === adminSampleId ? null : img.id); setAdminUploadPreview(''); setAdminUploadBase64(''); setAdminImageUrl(''); setAdminLink(''); }}
                  style={{ position: 'relative', padding: 0, border: adminSampleId === img.id ? '2px solid rgba(168,85,247,0.9)' : '2px solid transparent', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'none', aspectRatio: '5/3' }}>
                  <img src={img.thumb} alt={img.label} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2 }}>
                    <span style={{ color: '#fff', fontSize: 8, fontWeight: 600 }}>{img.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {!adminSampleId && !adminUploadPreview && (
              <div style={{ marginTop: 7 }}>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 600, textAlign: 'center', marginBottom: 5 }}>또는 이미지 URL</div>
                <input type="text" value={adminImageUrl} onChange={e => { setAdminImageUrl(e.target.value); setAdminLink(''); }} placeholder="https://example.com/image.jpg"
                  style={{ width: '100%', padding: '6px 9px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 7, color: '#e2d9f3', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            )}
          </div>

          <div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, marginBottom: 7, letterSpacing: '0.04em' }}>2단계 · 피스 수</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {PIECE_COUNTS.map(count => (
                <button key={count} onClick={() => { setAdminPieces(count); setAdminLink(''); }}
                  style={{ padding: '3px 9px', borderRadius: 5, border: adminPieces === count ? '1.5px solid rgba(168,85,247,0.9)' : '1px solid rgba(168,85,247,0.2)', background: adminPieces === count ? 'rgba(168,85,247,0.25)' : 'rgba(15,18,35,0.6)', color: adminPieces === count ? '#e2d9f3' : 'rgba(255,255,255,0.4)', fontWeight: adminPieces === count ? 700 : 400, fontSize: 11, cursor: 'pointer' }}>
                  {count}
                </button>
              ))}
            </div>
          </div>

          <button onClick={generateAdminLink} disabled={!adminHasImage || adminGenerating}
            style={{ padding: '9px', background: adminHasImage && !adminGenerating ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(80,80,80,0.3)', border: 'none', borderRadius: 8, color: adminHasImage && !adminGenerating ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, cursor: adminHasImage && !adminGenerating ? 'pointer' : 'not-allowed' }}>
            {adminGenerating ? '⏳ 생성 중...' : '🔗 플레이어 링크 생성'}
          </button>

          {adminError && (
            <div style={{ padding: '7px 9px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 7, color: '#fca5a5', fontSize: 11 }}>
              ⚠️ {adminError}
            </div>
          )}

          {adminLink && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {linkIsShort ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 10, background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 9 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>QR 코드로 공유</span>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(adminLink)}&margin=6`}
                    alt="QR" width={150} height={150}
                    style={{ borderRadius: 6, background: '#fff', padding: 4 }}
                  />
                </div>
              ) : (
                <div style={{ padding: '7px 9px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 7 }}>
                  <span style={{ color: 'rgba(253,224,71,0.8)', fontSize: 10 }}>📎 업로드 이미지는 링크가 길어 QR 코드 생성이 어렵습니다. 아래 복사 버튼으로 공유해주세요.</span>
                </div>
              )}

              <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 7, padding: '6px 9px', color: 'rgba(255,255,255,0.5)', fontSize: 9, wordBreak: 'break-all', lineHeight: 1.5, maxHeight: 48, overflow: 'hidden' }}>
                {adminLink.length > 100 ? adminLink.slice(0, 80) + '…' : adminLink}
              </div>

              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => { navigator.clipboard.writeText(adminLink).then(() => { setAdminLinkCopied(true); setTimeout(() => setAdminLinkCopied(false), 2000); }); }}
                  style={{ flex: 1, padding: '7px', background: adminLinkCopied ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)', border: `1px solid ${adminLinkCopied ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.4)'}`, borderRadius: 7, color: adminLinkCopied ? '#4ade80' : '#c084fc', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {adminLinkCopied ? '✓ 복사됨!' : '📋 링크 복사'}
                </button>
                <button onClick={() => window.open(adminLink, '_blank')}
                  style={{ flex: 1, padding: '7px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 7, color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  👁 미리보기
                </button>
              </div>
            </div>
          )}

          {adminHistory.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(168,85,247,0.18)', paddingTop: 11, marginTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                  📦 내가 만든 게임 ({adminHistory.length})
                </span>
                {adminHistory.length > 3 && (
                  <button
                    onClick={() => {
                      if (confirm(`전체 ${adminHistory.length}개 게임을 모두 삭제하시겠습니까?`)) {
                        adminHistory.forEach(r => {
                          if (r.deleteToken && !r.id.startsWith('local-')) {
                            deleteFromApi(r.id, r.deleteToken).catch(() => {});
                          }
                        });
                        setAdminHistory([]); saveHistory([]);
                      }
                    }}
                    style={{ padding: '2px 7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, color: '#fca5a5', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>
                    전체 삭제
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {adminHistory.map(record => {
                  const ago = Math.floor((Date.now() - record.createdAt) / 60000);
                  const agoText = ago < 1 ? '방금' : ago < 60 ? `${ago}분 전` : ago < 1440 ? `${Math.floor(ago/60)}시간 전` : `${Math.floor(ago/1440)}일 전`;
                  return (
                    <div key={record.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 7, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 8 }}>
                      <img src={record.thumb} alt="" crossOrigin="anonymous" style={{ width: 38, height: 22, objectFit: 'cover', borderRadius: 3, flexShrink: 0, background: 'rgba(0,0,0,0.3)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e2d9f3', fontSize: 10.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.label}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>{record.pieces}조각 · {agoText}</div>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(record.link); }}
                        title="링크 복사"
                        style={{ width: 24, height: 24, padding: 0, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 5, color: '#c084fc', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                        📋
                      </button>
                      <button
                        onClick={() => window.open(record.link, '_blank')}
                        title="열기"
                        style={{ width: 24, height: 24, padding: 0, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 5, color: '#c084fc', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                        ↗
                      </button>
                      <button
                        onClick={() => deleteAdminGame(record)}
                        disabled={deletingId === record.id}
                        title="삭제"
                        style={{ width: 24, height: 24, padding: 0, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, color: '#fca5a5', fontSize: 11, cursor: deletingId === record.id ? 'wait' : 'pointer', flexShrink: 0, opacity: deletingId === record.id ? 0.5 : 1 }}>
                        {deletingId === record.id ? '⏳' : '🗑'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!gameStarted ? (
        /* Setup screen */
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px 12px 28px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <div style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 13, marginBottom: 9 }}>샘플 이미지 선택</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {SAMPLE_IMAGES.map(img => (
                  <button key={img.id} onClick={() => selectImage(img.url, img.id)}
                    style={{ position: 'relative', padding: 0, border: selectedSampleId === img.id ? '2px solid rgba(168,85,247,0.9)' : '2px solid transparent', borderRadius: 9, overflow: 'hidden', cursor: 'pointer', background: 'none', aspectRatio: '5/3', boxShadow: selectedSampleId === img.id ? '0 0 14px rgba(168,85,247,0.5)' : '0 2px 8px rgba(0,0,0,0.4)', transition: 'all 0.15s' }}>
                    <img src={img.thumb} alt={img.label} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: selectedSampleId === img.id ? 'rgba(168,85,247,0.12)' : 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{img.label}</span>
                    </div>
                    {selectedSampleId === img.id && (
                      <div style={{ position: 'absolute', top: 5, right: 5, width: 17, height: 17, background: '#a855f7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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

            <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? 'rgba(168,85,247,0.9)' : selectedSampleId ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.4)'}`, borderRadius: 11, padding: '13px 12px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(168,85,247,0.1)' : 'rgba(15,18,35,0.5)', transition: 'all 0.2s' }}>
              {imageUrl && !selectedSampleId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <img src={imageUrl} alt="Uploaded" style={{ maxWidth: '100%', maxHeight: 90, borderRadius: 6, objectFit: 'contain' }} />
                  <span style={{ color: '#c084fc', fontSize: 11 }}>클릭하여 다른 이미지 선택</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 17 }}>📷</span>
                  <span style={{ color: selectedSampleId ? 'rgba(255,255,255,0.3)' : '#c084fc', fontWeight: 600, fontSize: 13 }}>내 이미지 업로드</span>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

            <div>
              <div style={{ color: '#e2d9f3', fontWeight: 600, fontSize: 13, marginBottom: 7 }}>피스 수 선택 ({selectedPieceCount}개)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PIECE_COUNTS.map(count => (
                  <button key={count} onClick={() => setSelectedPieceCount(count)}
                    style={{ padding: '5px 12px', borderRadius: 7, border: selectedPieceCount === count ? '2px solid rgba(168,85,247,0.9)' : '1px solid rgba(168,85,247,0.22)', background: selectedPieceCount === count ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.3))' : 'rgba(15,18,35,0.6)', color: selectedPieceCount === count ? '#e2d9f3' : 'rgba(255,255,255,0.45)', fontWeight: selectedPieceCount === count ? 700 : 400, fontSize: 12, cursor: 'pointer', boxShadow: selectedPieceCount === count ? '0 0 10px rgba(168,85,247,0.3)' : 'none' }}>
                    {count}조각
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => startGame()} disabled={!imageUrl}
              style={{ padding: '13px', background: imageUrl ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(80,80,80,0.3)', border: 'none', borderRadius: 11, color: imageUrl ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: 700, cursor: imageUrl ? 'pointer' : 'not-allowed', boxShadow: imageUrl ? '0 4px 20px rgba(168,85,247,0.45)' : 'none' }}>
              {imageUrl ? '🧩 게임 시작' : '이미지를 선택하거나 업로드해주세요'}
            </button>
          </div>
        </div>

      ) : (
        /* Game screen */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', padding: `${isLandscape ? 4 : 6}px 8px ${isLandscape ? 2 : 4}px` }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isLandscape ? 4 : 6, flexShrink: 0 }}>
            <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(168,85,247,0.5)', boxShadow: '0 0 12px rgba(168,85,247,0.2)', flexShrink: 0 }}>
              <img
                src={imageUrl!}
                alt="Reference"
                style={{ width: isLandscape ? 80 : 110, height: isLandscape ? 45 : 62, objectFit: 'cover', display: 'block' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.5))' }} />
              <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 7, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>목표</div>
            </div>
            {config && (
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(124,58,237,0.2)', borderRadius: 5, border: '1px solid rgba(168,85,247,0.25)' }}>
                  <span style={{ color: '#c084fc', fontSize: isLandscape ? 9 : 10, fontWeight: 700 }}>{config.cols}×{config.rows}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(124,58,237,0.2)', borderRadius: 5, border: '1px solid rgba(168,85,247,0.25)' }}>
                  <span style={{ color: '#c084fc', fontSize: isLandscape ? 9 : 10, fontWeight: 700 }}>{config.totalPieces}조각</span>
                </div>
              </div>
            )}
          </div>

          {config && trayHeight > 0 && (
            <div
              style={{
                width: `${BOARD_WIDTH * boardScale}px`,
                height: `${totalPlayH * boardScale}px`,
                position: 'relative',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transformOrigin: 'top left',
                  transform: `scale(${boardScale})`,
                }}
              >
                <PuzzleBoard
                  pieces={pieces} setPieces={setPieces} imageUrl={imageUrl!}
                  config={config} boardWidth={BOARD_WIDTH} boardHeight={BOARD_HEIGHT}
                  trayHeight={trayHeight} onComplete={handleComplete}
                  snappingPieceId={snappingPieceId} setSnappingPieceId={setSnappingPieceId}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion overlay */}
      {isComplete && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 9999, padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: isLandscape ? '20px 36px' : '32px 44px', background: 'linear-gradient(135deg, rgba(20,15,40,0.99), rgba(30,20,60,0.99))', borderRadius: 20, border: '2px solid rgba(168,85,247,0.6)', boxShadow: '0 0 80px rgba(168,85,247,0.4)', textAlign: 'center', width: '100%', maxWidth: 300 }}>
            <div style={{ fontSize: isLandscape ? 40 : 52 }}>🎉</div>
            <div>
              <div style={{ fontSize: isLandscape ? 20 : 24, fontWeight: 800, background: 'linear-gradient(135deg, #c084fc, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 3 }}>퍼즐 완성!</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{totalPieces}개 조각을 모두 맞췄어요!</div>
            </div>
            <div style={{ padding: '10px 20px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 10, width: '100%' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>완성 시간</div>

              {/* 👉 수정됨: 최종 시간도 0.01초 단위로 표시 */}
              <span style={{ color: '#e2d9f3', fontSize: isLandscape ? 20 : 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(finalTimeMs)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>

              {!isSharedLink && (
                <button onClick={() => { setGameStarted(false); setIsComplete(false); stopTimer(); setElapsedTimeMs(0); }} style={{ flex: 1, padding: '9px', background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 9, color: '#c084fc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>새 이미지</button>
              )}

              <button onClick={() => startGame()} style={{ flex: 1, padding: '9px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(168,85,247,0.5)' }}>다시 하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}