import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { recordAudit } from "./audit.service";
import type { Role, Language } from "@prisma/client";

const SALT_ROUNDS = 12;

export interface AuthTokenPayload {
  sub: string; // user id
  role: Role;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
  preferredLanguage?: Language;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error("EMAIL_IN_USE");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      phone: input.phone,
      preferredLanguage: input.preferredLanguage ?? "EN",
    },
  });

  await recordAudit({
    userId: user.id,
    action: "USER_REGISTERED",
    entity: "User",
    entityId: user.id,
    metadata: { role: user.role },
  });

  return user;
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true, role: true, preferredLanguage: true },
  });
}

export async function updateUserProfile(
  userId: string,
  input: { name?: string; phone?: string; preferredLanguage?: Language }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      phone: input.phone,
      preferredLanguage: input.preferredLanguage,
    },
    select: { id: true, email: true, name: true, phone: true, role: true, preferredLanguage: true },
  });

  await recordAudit({
    userId,
    action: "USER_UPDATED_PROFILE",
    entity: "User",
    entityId: userId,
  });

  return user;
}

export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("NOT_FOUND");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("INVALID_CURRENT_PASSWORD");

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await recordAudit({
    userId,
    action: "USER_CHANGED_PASSWORD",
    entity: "User",
    entityId: userId,
  });
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  const token = signToken({ sub: user.id, role: user.role });

  await recordAudit({
    userId: user.id,
    action: "USER_LOGGED_IN",
    entity: "User",
    entityId: user.id,
  });

  return { token, user };
}
