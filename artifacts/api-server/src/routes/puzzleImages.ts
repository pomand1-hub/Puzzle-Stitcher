import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

interface StoredImage {
  data: string;
  createdAt: number;
}

// 인메모리 저장소 — JavaScript는 단일 스레드이므로 Map 연산은 원자적으로 처리됨 (Lock 불필요)
const imageStore = new Map<string, StoredImage>();

const TTL_MS = 48 * 60 * 60 * 1000; // 48시간
const MAX_IMAGES = 2000;             // 최대 저장 개수 (메모리 보호)
const MAX_DATA_BYTES = 10 * 1024 * 1024; // 10MB 이미지 한도

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function purgeExpired(): void {
  const now = Date.now();
  for (const [id, img] of imageStore.entries()) {
    if (now - img.createdAt > TTL_MS) imageStore.delete(id);
  }
}

function evictOldest(): void {
  // 만료 삭제 후에도 초과 시 가장 오래된 항목 제거
  if (imageStore.size < MAX_IMAGES) return;
  let oldest: string | null = null;
  let oldestTime = Infinity;
  for (const [id, img] of imageStore.entries()) {
    if (img.createdAt < oldestTime) { oldestTime = img.createdAt; oldest = id; }
  }
  if (oldest) imageStore.delete(oldest);
}

// POST /api/puzzle-images
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

  // 만료 정리 → 용량 초과 시 가장 오래된 것 제거
  purgeExpired();
  evictOldest();

  const id = generateId();
  imageStore.set(id, { data, createdAt: Date.now() });

  res.status(201).json({ id });
});

// GET /api/puzzle-images/:id
router.get("/puzzle-images/:id", (req: Request, res: Response) => {
  const img = imageStore.get(req.params.id);

  if (!img) {
    res.status(404).json({ error: "이미지를 찾을 수 없거나 만료되었습니다." });
    return;
  }
  if (Date.now() - img.createdAt > TTL_MS) {
    imageStore.delete(req.params.id);
    res.status(404).json({ error: "이미지가 만료되었습니다. (48시간 초과)" });
    return;
  }

  // 캐시 헤더: 같은 ID는 내용이 불변이므로 1시간 브라우저 캐시
  res.setHeader("Cache-Control", "public, max-age=3600, immutable");
  res.json({ data: img.data });
});

export default router;
