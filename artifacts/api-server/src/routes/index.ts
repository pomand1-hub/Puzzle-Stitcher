import { Router, type IRouter } from "express";
import healthRouter from "./health";
import puzzleImagesRouter from "./puzzleImages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(puzzleImagesRouter);

export default router;
