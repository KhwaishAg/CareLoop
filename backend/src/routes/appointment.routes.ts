import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  getSlots,
  hold,
  confirm,
  cancel,
  reschedule,
  complete,
  followUpStatus,
  followUpRollup,
  listMyAppointments,
} from "../controllers/appointment.controller";

const router = Router();

router.use(requireAuth);

router.get("/slots", getSlots);
router.get("/mine", listMyAppointments);
router.get("/follow-ups", requireRole("DOCTOR", "ADMIN"), followUpRollup);
router.get("/:id/follow-up", followUpStatus);

router.post("/hold", requireRole("PATIENT"), hold);
router.post("/:id/confirm", requireRole("PATIENT"), confirm);
router.post("/:id/cancel", requireRole("PATIENT", "DOCTOR", "ADMIN"), cancel);
router.post("/:id/reschedule", requireRole("PATIENT"), reschedule);
router.post("/:id/complete", requireRole("DOCTOR"), complete);

export default router;
