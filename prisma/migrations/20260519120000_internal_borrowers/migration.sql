-- CreateTable
CREATE TABLE "internal_borrowers" (
    "id" UUID NOT NULL,
    "nip" TEXT,
    "name" TEXT NOT NULL,
    "pangkat" TEXT,
    "jabatan" TEXT NOT NULL,
    "appointed_at" DATE,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_borrowers_nip_key" ON "internal_borrowers"("nip");
