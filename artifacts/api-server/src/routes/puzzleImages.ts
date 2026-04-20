import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";

const router: IRouter = Router();

interface StoredImage {
  data: string;
  createdAt: number;
  deleteToken: string;
}

// 인메모리 저장소 — JS는 단일 스레드이므로 Map 연산은 원자적 (Lock 불필요)
const imageStore = new Map<string, StoredImage>();

const MAX_IMAGES = 5000;                  // 최대 저장 개수 (메모리 보호)
const MAX_DATA_BYTES = 10 * 1024 * 1024;  // 10MB 이미지 한도

function generateId(): string {
  return `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

function evictOldestIfFull(): void {
  if (imageStore.size < MAX_IMAGES) return;
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const [id, img] of imageStore.entries()) {
    if (img.createdAt < oldestTime) { oldestTime = img.createdAt; oldest = id; }
  }
  if (oldest) imageStore.delete(oldest);
}

// POST /api/puzzle-images — 관리자 삭제 전까지 영구 보관
router.post("/puzzle-images", (req: Request, res: Response) => {
  const { data } = req.body as { data?: unknown };

  if (!data || typeof data !== "string") {
    res.status(400).json({ error: "이미지 데이터가 없습니다." });
    return;
  }
  if (!data.startsWith("data:image/")) {
    res.status(400).json({ error: "지원하지 않는 이미지 형식입니다." });
    return;
  }
  if (Buffer.byteLength(data, "utf8") > MAX_DATA_BYTES) {
    res.status(413).json({ error: "이미지 크기가 너무 큽니다. (최대 10MB)" });
    return;
  }

  evictOldestIfFull();

  const id = generateId();
  const deleteToken = randomBytes(16).toString("hex");
  imageStore.set(id, { data, createdAt: Date.now(), deleteToken });

  res.status(201).json({ id, deleteToken });
});

// GET /api/puzzle-images/:id
router.get("/puzzle-images/:id", (req: Request, res: Response) => {
  const img = imageStore.get(req.params.id);
  if (!img) {
    res.status(404).json({ error: "이미지를 찾을 수 없습니다." });
    return;
  }
  // 같은 ID는 내용이 불변 → 1시간 브라우저 캐시
  res.setHeader("Cache-Control", "public, max-age=3600, immutable");
  res.json({ data: img.data });
});

// DELETE /api/puzzle-images/:id — 관리자 토큰 필요
router.delete("/puzzle-images/:id", (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "인증 토큰이 필요합니다." });
    return;
  }

  const img = imageStore.get(req.params.id);
  if (!img) {
    res.status(404).json({ error: "이미지를 찾을 수 없습니다." });
    return;
  }
  if (img.deleteToken !== token) {
    res.status(403).json({ error: "삭제 권한이 없습니다." });
    return;
  }

  imageStore.delete(req.params.id);
  res.json({ success: true });
});

export default router;
