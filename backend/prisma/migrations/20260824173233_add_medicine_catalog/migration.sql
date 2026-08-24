-- CreateTable
CREATE TABLE "MedicineCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "commonDosages" TEXT[],
    "defaultFrequency" "FrequencyType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicineCatalog_name_key" ON "MedicineCatalog"("name");

-- CreateIndex
CREATE INDEX "MedicineCatalog_name_idx" ON "MedicineCatalog"("name");
