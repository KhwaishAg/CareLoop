/**
 * Seeds one demo user per role plus a doctor profile, so the app is
 * clickable immediately after setup without manually registering accounts.
 * Run with: npm run seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@clinic.demo" },
    update: {},
    create: {
      email: "admin@clinic.demo",
      passwordHash: password,
      name: "Clinic Admin",
      role: "ADMIN",
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: "dr.sharma@clinic.demo" },
    update: {},
    create: {
      email: "dr.sharma@clinic.demo",
      passwordHash: password,
      name: "Dr. Anjali Sharma",
      role: "DOCTOR",
    },
  });

  await prisma.doctorProfile.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      specialisation: "General Medicine",
      slotDurationMin: 30,
      workingHours: {
        mon: ["09:00", "17:00"],
        tue: ["09:00", "17:00"],
        wed: ["09:00", "17:00"],
        thu: ["09:00", "17:00"],
        fri: ["09:00", "17:00"],
        sat: [],
        sun: [],
      },
    },
  });

  const patient = await prisma.user.upsert({
    where: { email: "patient@demo.com" },
    update: {},
    create: {
      email: "patient@demo.com",
      passwordHash: password,
      name: "Rahul Verma",
      role: "PATIENT",
      preferredLanguage: "EN",
    },
  });

  console.log("Seeded demo accounts (password for all: Password123!):");
  console.log(` admin:   ${admin.email}`);
  console.log(` doctor:  ${doctorUser.email}`);
  console.log(` patient: ${patient.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
