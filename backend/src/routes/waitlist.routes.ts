import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { join, mine } from "../controllers/waitlist.controller";

const router = Router();

router.use(requireAuth, requireRole("PATIENT"));

router.post("/", join);
router.get("/mine", mine);

export default router;
