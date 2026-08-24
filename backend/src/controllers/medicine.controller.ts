import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { listMedicineCatalog } from "../services/medicine.service";

export async function listMedicinesHandler(req: AuthedRequest, res: Response) {
  const { q } = req.query;
  const medicines = await listMedicineCatalog(typeof q === "string" ? q : undefined);
  return res.json({ medicines });
}
