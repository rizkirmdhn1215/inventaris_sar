-- AlterTable
ALTER TABLE "loans"
  ADD COLUMN "loan_type" TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN "instansi" TEXT,
  ADD COLUMN "external_letter_number" TEXT,
  ADD COLUMN "contact_person" TEXT,
  ADD COLUMN "contact_via" TEXT,
  ADD COLUMN "extended_count" INTEGER NOT NULL DEFAULT 0;
