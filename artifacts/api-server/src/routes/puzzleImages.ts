import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface StoredImage {
  data: string;
  createdAt: number;
}

const imageStore = new Map<string, StoredImage>();
const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function purgeExpired() {
  const now = Date.now();
  for (const [id, img] of imageStore.entries()) {
    if (now - img.createdAt > TTL_MS) imageStore.delete(id);
  }
}

router.post("/puzzle-images", (req, res) => {
  purgeExpired();
  const { data } = req.body as { data?: string };
  if (!data || typeof data !== "string" || !data.startsWith("data:image/")) {
    res.status(400).json({ error: "Invalid image data" });
    return;
  }
  const id = generateId();
  imageStore.set(id, { data, createdAt: Date.now() });
  res.json({ id });
});

router.get("/puzzle-images/:id", (req, res) => {
  const img = imageStore.get(req.params.id);
  if (!img) {
    res.status(404).json({ error: "Image not found or expired" });
    return;
  }
  res.json({ data: img.data });
});

export default router;
