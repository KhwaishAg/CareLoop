/**
 * Seeds one demo user per role plus a few doctor profiles, so the app is
 * clickable immediately after setup without manually registering accounts.
 * Run with: npm run seed
 *
 * Doctor names are stored WITHOUT a "Dr." prefix — every UI spot that
 * displays a doctor adds the title itself (see frontend/src/lib/format.ts),
 * so a name that already includes "Dr." would render as "Dr. Dr. ...".
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const WEEKDAY_9_TO_5 = {
  mon: ["09:00", "17:00"],
  tue: ["09:00", "17:00"],
  wed: ["09:00", "17:00"],
  thu: ["09:00", "17:00"],
  fri: ["09:00", "17:00"],
  sat: [],
  sun: [],
};

const DOCTORS = [
  {
    email: "dr.sharma@clinic.demo",
    name: "Anjali Sharma",
    specialisation: "General Medicine",
    slotDurationMin: 30,
    workingHours: WEEKDAY_9_TO_5,
  },
  {
    email: "dr.mehta@clinic.demo",
    name: "Rohan Mehta",
    specialisation: "Cardiology",
    slotDurationMin: 30,
    workingHours: {
      mon: ["10:00", "18:00"],
      tue: ["10:00", "18:00"],
      wed: [],
      thu: ["10:00", "18:00"],
      fri: ["10:00", "18:00"],
      sat: ["10:00", "14:00"],
      sun: [],
    },
  },
  {
    email: "dr.iyer@clinic.demo",
    name: "Priya Iyer",
    specialisation: "Pediatrics",
    slotDurationMin: 20,
    workingHours: {
      mon: ["09:00", "13:00"],
      tue: ["09:00", "13:00"],
      wed: ["09:00", "13:00"],
      thu: ["09:00", "13:00"],
      fri: ["09:00", "13:00"],
      sat: [],
      sun: [],
    },
  },
  {
    email: "dr.kapoor@clinic.demo",
    name: "Neha Kapoor",
    specialisation: "Dermatology",
    slotDurationMin: 20,
    workingHours: {
      mon: ["11:00", "19:00"],
      tue: ["11:00", "19:00"],
      wed: ["11:00", "19:00"],
      thu: [],
      fri: ["11:00", "19:00"],
      sat: ["10:00", "14:00"],
      sun: [],
    },
  },
  {
    email: "dr.khanna@clinic.demo",
    name: "Vikram Khanna",
    specialisation: "Orthopedics",
    slotDurationMin: 30,
    workingHours: {
      mon: ["08:00", "15:00"],
      tue: ["08:00", "15:00"],
      wed: ["08:00", "15:00"],
      thu: ["08:00", "15:00"],
      fri: ["08:00", "15:00"],
      sat: [],
      sun: [],
    },
  },
  {
    email: "dr.reddy@clinic.demo",
    name: "Ananya Reddy",
    specialisation: "Gynecology",
    slotDurationMin: 30,
    workingHours: {
      mon: ["09:30", "17:30"],
      tue: ["09:30", "17:30"],
      wed: [],
      thu: ["09:30", "17:30"],
      fri: ["09:30", "17:30"],
      sat: ["09:30", "13:00"],
      sun: [],
    },
  },
  {
    email: "dr.bose@clinic.demo",
    name: "Arjun Bose",
    specialisation: "ENT (Otolaryngology)",
    slotDurationMin: 20,
    workingHours: {
      mon: ["10:00", "17:00"],
      tue: ["10:00", "17:00"],
      wed: ["10:00", "17:00"],
      thu: ["10:00", "17:00"],
      fri: [],
      sat: ["10:00", "13:00"],
      sun: [],
    },
  },
  {
    email: "dr.chatterjee@clinic.demo",
    name: "Meera Chatterjee",
    specialisation: "Psychiatry",
    slotDurationMin: 45,
    workingHours: {
      mon: ["12:00", "19:00"],
      tue: [],
      wed: ["12:00", "19:00"],
      thu: ["12:00", "19:00"],
      fri: ["12:00", "19:00"],
      sat: [],
      sun: [],
    },
  },
];

// A starter list, not a full formulary — enough common medicines across
// the specialisations above that "Complete visit" almost never needs the
// doctor to type a brand-new name from scratch.
const MEDICINES = [
  { name: "Paracetamol", category: "Analgesic/Antipyretic", commonDosages: ["500mg", "650mg"], defaultFrequency: "THRICE_DAILY" },
  { name: "Ibuprofen", category: "NSAID", commonDosages: ["200mg", "400mg"], defaultFrequency: "TWICE_DAILY" },
  { name: "Amoxicillin", category: "Antibiotic", commonDosages: ["250mg", "500mg"], defaultFrequency: "THRICE_DAILY" },
  { name: "Azithromycin", category: "Antibiotic", commonDosages: ["250mg", "500mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Cetirizine", category: "Antihistamine", commonDosages: ["10mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Levocetirizine", category: "Antihistamine", commonDosages: ["5mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Omeprazole", category: "PPI", commonDosages: ["20mg", "40mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Pantoprazole", category: "PPI", commonDosages: ["40mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Metformin", category: "Antidiabetic", commonDosages: ["500mg", "1000mg"], defaultFrequency: "TWICE_DAILY" },
  { name: "Amlodipine", category: "Antihypertensive", commonDosages: ["5mg", "10mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Atorvastatin", category: "Statin", commonDosages: ["10mg", "20mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Losartan", category: "Antihypertensive", commonDosages: ["25mg", "50mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Metoprolol", category: "Beta blocker", commonDosages: ["25mg", "50mg"], defaultFrequency: "TWICE_DAILY" },
  { name: "Aspirin", category: "Antiplatelet", commonDosages: ["75mg", "150mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Clopidogrel", category: "Antiplatelet", commonDosages: ["75mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Salbutamol Inhaler", category: "Bronchodilator", commonDosages: ["100mcg/puff"], defaultFrequency: "AS_NEEDED" },
  { name: "Montelukast", category: "Leukotriene modifier", commonDosages: ["4mg", "10mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Cefixime", category: "Antibiotic", commonDosages: ["100mg", "200mg"], defaultFrequency: "TWICE_DAILY" },
  { name: "ORS Solution", category: "Rehydration", commonDosages: ["1 sachet in 1L water"], defaultFrequency: "AS_NEEDED" },
  { name: "Domperidone", category: "Antiemetic", commonDosages: ["10mg"], defaultFrequency: "THRICE_DAILY" },
  { name: "Ondansetron", category: "Antiemetic", commonDosages: ["4mg", "8mg"], defaultFrequency: "TWICE_DAILY" },
  { name: "Diclofenac Gel", category: "Topical NSAID", commonDosages: ["1% gel"], defaultFrequency: "TWICE_DAILY" },
  { name: "Calcium + Vitamin D3", category: "Supplement", commonDosages: ["500mg + 250IU"], defaultFrequency: "ONCE_DAILY" },
  { name: "Iron + Folic Acid", category: "Supplement", commonDosages: ["100mg + 0.5mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Multivitamin", category: "Supplement", commonDosages: ["1 tablet"], defaultFrequency: "ONCE_DAILY" },
  { name: "Hydrocortisone Cream", category: "Topical steroid", commonDosages: ["1% cream"], defaultFrequency: "TWICE_DAILY" },
  { name: "Clotrimazole Cream", category: "Antifungal", commonDosages: ["1% cream"], defaultFrequency: "TWICE_DAILY" },
  { name: "Fluconazole", category: "Antifungal", commonDosages: ["150mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Doxycycline", category: "Antibiotic", commonDosages: ["100mg"], defaultFrequency: "TWICE_DAILY" },
  { name: "Isotretinoin", category: "Retinoid", commonDosages: ["10mg", "20mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Adapalene Gel", category: "Topical retinoid", commonDosages: ["0.1% gel"], defaultFrequency: "ONCE_DAILY" },
  { name: "Sertraline", category: "SSRI", commonDosages: ["50mg", "100mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Escitalopram", category: "SSRI", commonDosages: ["10mg", "20mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Alprazolam", category: "Anxiolytic", commonDosages: ["0.25mg", "0.5mg"], defaultFrequency: "AS_NEEDED" },
  { name: "Melatonin", category: "Sleep aid", commonDosages: ["3mg", "5mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Ibuprofen Syrup (Pediatric)", category: "NSAID", commonDosages: ["100mg/5mL"], defaultFrequency: "THRICE_DAILY" },
  { name: "Paracetamol Syrup (Pediatric)", category: "Analgesic/Antipyretic", commonDosages: ["125mg/5mL", "250mg/5mL"], defaultFrequency: "AS_NEEDED" },
  { name: "Zinc Sulphate Syrup", category: "Supplement", commonDosages: ["20mg/5mL"], defaultFrequency: "ONCE_DAILY" },
  { name: "Folic Acid", category: "Supplement", commonDosages: ["5mg"], defaultFrequency: "ONCE_DAILY" },
  { name: "Ferrous Sulphate", category: "Supplement", commonDosages: ["200mg"], defaultFrequency: "ONCE_DAILY" },
];

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

  for (const doc of DOCTORS) {
    const doctorUser = await prisma.user.upsert({
      where: { email: doc.email },
      update: { name: doc.name },
      create: {
        email: doc.email,
        passwordHash: password,
        name: doc.name,
        role: "DOCTOR",
      },
    });

    await prisma.doctorProfile.upsert({
      where: { userId: doctorUser.id },
      update: {
        specialisation: doc.specialisation,
        slotDurationMin: doc.slotDurationMin,
        workingHours: doc.workingHours,
      },
      create: {
        userId: doctorUser.id,
        specialisation: doc.specialisation,
        slotDurationMin: doc.slotDurationMin,
        workingHours: doc.workingHours,
      },
    });
  }

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

  for (const med of MEDICINES) {
    await prisma.medicineCatalog.upsert({
      where: { name: med.name },
      update: {
        category: med.category,
        commonDosages: med.commonDosages,
        defaultFrequency: med.defaultFrequency as any,
      },
      create: {
        name: med.name,
        category: med.category,
        commonDosages: med.commonDosages,
        defaultFrequency: med.defaultFrequency as any,
      },
    });
  }

  console.log("Seeded demo accounts (password for all: Password123!):");
  console.log(` admin:   ${admin.email}`);
  DOCTORS.forEach((d) => console.log(` doctor:  ${d.email} (${d.name} — ${d.specialisation})`));
  console.log(` patient: ${patient.email}`);
  console.log(`Seeded ${MEDICINES.length} medicines into the catalog.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
