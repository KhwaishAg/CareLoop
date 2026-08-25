import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { registerUser, loginUser, getUserById, updateUserProfile, changeUserPassword } from "../services/auth.service";

// Public self-registration is PATIENT-only, always — role is never taken
// from the request body. Doctor and admin accounts are created out-of-band
// (seed script, or an admin-only endpoint), so nobody can grant themselves
// elevated access by posting a different "role" value here.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
  phone: z.string().optional(),
  preferredLanguage: z.enum(["EN", "HI", "TA", "TE"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const user = await registerUser({ ...parsed.data, role: "PATIENT" });
    return res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: any) {
    if (err.message === "EMAIL_IN_USE") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    console.error("[auth] register failed", err);
    return res.status(500).json({ error: "Could not create account" });
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const { token, user } = await loginUser(parsed.data.email, parsed.data.password);
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ error: "Incorrect email or password" });
    }
    console.error("[auth] login failed", err);
    return res.status(500).json({ error: "Could not log in" });
  }
}

export async function getMe(req: AuthedRequest, res: Response) {
  const user = await getUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: "Account not found" });
  return res.json({ user });
}

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  preferredLanguage: z.enum(["EN", "HI", "TA", "TE"]).optional(),
});

export async function updateMe(req: AuthedRequest, res: Response) {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const user = await updateUserProfile(req.user!.id, parsed.data);
    return res.json({ user });
  } catch (err) {
    console.error("[auth] update profile failed", err);
    return res.status(500).json({ error: "Couldn't update your profile — try again." });
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function changePassword(req: AuthedRequest, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    await changeUserPassword(req.user!.id, parsed.data.currentPassword, parsed.data.newPassword);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err.message === "INVALID_CURRENT_PASSWORD") {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    console.error("[auth] change password failed", err);
    return res.status(500).json({ error: "Couldn't change your password — try again." });
  }
}
