import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  adminCreateDoctor,
  adminUpdateDoctor,
  adminAddLeave,
  adminRemoveLeave,
  previewLeaveImpact,
} from "../controllers/doctor.controller";
import { listNotifications, listWaitlist } from "../controllers/ops.controller";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.post("/doctors", adminCreateDoctor);
router.put("/doctors/:id", adminUpdateDoctor);

// Preview affected appointments BEFORE committing a leave day — powers the
// "3 appointments will be affected" confirmation screen from the blueprint.
router.post("/doctors/:id/leave/preview", previewLeaveImpact);
router.post("/doctors/:id/leave", adminAddLeave);
router.delete("/doctors/:id/leave/:leaveId", adminRemoveLeave);

router.get("/notifications", listNotifications);
router.get("/waitlist", listWaitlist);

export default router;
