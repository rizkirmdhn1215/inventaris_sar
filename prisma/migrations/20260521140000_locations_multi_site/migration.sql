-- Multi-location: KPP Padang + Pos SAR daerah lain

CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'pos',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "locations_slug_key" ON "locations"("slug");

INSERT INTO "locations" ("id", "slug", "name", "type", "description", "sort_order")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'kpp-padang',
    'KPP Padang',
    'kpp',
    'Kantor Pencarian dan Pertolongan Padang',
    0
);

ALTER TABLE "admins" ADD COLUMN "location_id" UUID;
ALTER TABLE "item_categories" ADD COLUMN "location_id" UUID;
ALTER TABLE "items" ADD COLUMN "location_id" UUID;
ALTER TABLE "loans" ADD COLUMN "location_id" UUID;
ALTER TABLE "internal_borrowers" ADD COLUMN "location_id" UUID;
ALTER TABLE "push_subscriptions" ADD COLUMN "admin_id" UUID;
ALTER TABLE "push_subscriptions" ADD COLUMN "location_id" UUID;

UPDATE "item_categories" SET "location_id" = '00000000-0000-4000-8000-000000000001';
UPDATE "items" SET "location_id" = '00000000-0000-4000-8000-000000000001';
UPDATE "loans" SET "location_id" = '00000000-0000-4000-8000-000000000001';
UPDATE "internal_borrowers" SET "location_id" = '00000000-0000-4000-8000-000000000001';

ALTER TABLE "item_categories" ALTER COLUMN "location_id" SET NOT NULL;
ALTER TABLE "items" ALTER COLUMN "location_id" SET NOT NULL;
ALTER TABLE "loans" ALTER COLUMN "location_id" SET NOT NULL;
ALTER TABLE "internal_borrowers" ALTER COLUMN "location_id" SET NOT NULL;

DROP INDEX IF EXISTS "item_categories_name_key";
CREATE UNIQUE INDEX "item_categories_location_id_name_key" ON "item_categories"("location_id", "name");

DROP INDEX IF EXISTS "internal_borrowers_nip_key";
CREATE UNIQUE INDEX "internal_borrowers_location_id_nip_key" ON "internal_borrowers"("location_id", "nip");

ALTER TABLE "admins" ADD CONSTRAINT "admins_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loans" ADD CONSTRAINT "loans_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_borrowers" ADD CONSTRAINT "internal_borrowers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
