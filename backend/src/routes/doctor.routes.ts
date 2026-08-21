import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listDoctorsHandler, getDoctorHandler, getMyDoctorProfile } from "../controllers/doctor.controller";

const router = Router();

// Public-to-any-authenticated-role reads — patients search doctors,
// doctors can fetch their own profile.
router.get("/", requireAuth, listDoctorsHandler);
router.get("/me", requireAuth, requireRole("DOCTOR"), getMyDoctorProfile);
router.get("/:id", requireAuth, getDoctorHandler);

export default router;
