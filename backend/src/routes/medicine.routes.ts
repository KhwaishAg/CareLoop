import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listMedicinesHandler } from "../controllers/medicine.controller";

const router = Router();

// Doctors use this while completing a visit; admins may want to browse it
// too, so it's not locked to DOCTOR-only the way write endpoints would be.
router.get("/", requireAuth, requireRole("DOCTOR", "ADMIN"), listMedicinesHandler);

export default router;
