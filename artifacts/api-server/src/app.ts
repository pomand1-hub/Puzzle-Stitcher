import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Gzip 압축 (모든 응답 크기 축소) ──
app.use(compression({ level: 6, threshold: 1024 }));

// ── 로깅 ──
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));

// ── Body 크기 제한 (대용량 요청 DoS 차단) ──
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

// ── Rate Limiting: 400명 동시 접속 대비 ──
// 이미지 업로드 (무거운 작업): IP당 분당 60회
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req: Request, res: Response) {
    res.status(429).json({
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      retryAfter: 60,
    });
  },
});

// 이미지 조회 (가벼운 작업): IP당 분당 600회
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req: Request, res: Response) {
    res.status(429).json({
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      retryAfter: 60,
    });
  },
});

// 전체 API 보호: IP당 분당 1200회 (500명 동시 접속 대비)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req: Request, res: Response) {
    res.status(429).json({
      error: "서버가 혼잡합니다. 잠시 후 다시 시도해주세요.",
      retryAfter: 60,
    });
  },
});

app.use("/api", globalLimiter);
app.use("/api/puzzle-images", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST") return uploadLimiter(req, res, next);
  if (req.method === "GET") return readLimiter(req, res, next);
  if (req.method === "DELETE") return uploadLimiter(req, res, next);
  next();
});

// ── 라우터 ──
app.use("/api", router);

// ── 404 ──
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "요청한 리소스를 찾을 수 없습니다." });
});

// ── 전역 오류 핸들러 (비동기 오류 포함, 4-param 필수) ──
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const status = (err as { status?: number }).status ?? 500;
  if (status === 503) {
    res.status(503).json({ error: "서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.", retryAfter: 10 });
    return;
  }
  res.status(status < 500 ? status : 500).json({
    error: status < 500 ? err.message : "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  });
});

export default app;
