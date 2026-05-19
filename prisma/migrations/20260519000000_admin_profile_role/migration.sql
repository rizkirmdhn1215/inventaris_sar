-- AlterTable
ALTER TABLE "admins" ADD COLUMN "image_url" TEXT;
ALTER TABLE "admins" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'admin';

-- Super admin for primary account
UPDATE "admins" SET "role" = 'superadmin' WHERE "email" = 'admin@sarpadang.go.id';
