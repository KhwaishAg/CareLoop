import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { connect, callback, status } from "../controllers/calendar.controller";

const router = Router();

// Google redirects the browser here directly — no Authorization header,
// so this route stays outside requireAuth. The signed `state` param (see
// calendar.service.ts buildAuthUrl) is what ties it back to a doctor.
router.get("/oauth/callback", callback);

router.get("/oauth/connect", requireAuth, requireRole("DOCTOR"), connect);
router.get("/status", requireAuth, requireRole("DOCTOR"), status);

export default router;
