-- Double-booking prevention — the load-bearing constraint of the whole system.
--
-- Prisma's schema DSL (as of prisma 5.x) can't express a partial index
-- (a WHERE clause on a CREATE UNIQUE INDEX), so this can't live directly
-- in schema.prisma. Run it once, after your first `prisma migrate dev`:
--
--   npx prisma migrate dev --name init
--   npx prisma db execute --file prisma/manual-sql/001_partial_unique_index.sql --schema prisma/schema.prisma
--
-- Why partial and not a plain UNIQUE(doctorId, startTime): a plain unique
-- constraint would permanently block that (doctor, time) pair even after
-- the appointment is CANCELLED, making the slot unbookable forever. Scoping
-- the index to HELD/BOOKED rows means a cancelled slot frees up for
-- rebooking, while two concurrent requests for the same doctor/time still
-- collide safely — Postgres accepts one insert, rejects the other with a
-- constraint violation, which the API turns into a 409.

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_doctor_slot_unique"
ON "Appointment" ("doctorId", "startTime")
WHERE "status" IN ('HELD', 'BOOKED');
