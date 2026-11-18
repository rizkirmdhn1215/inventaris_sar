-- Ensure item_transactions table exists for fresh deployments via prisma migrate deploy
CREATE TABLE IF NOT EXISTS "item_transactions" (
    "id" UUID NOT NULL,
    "transaction_code" TEXT,
    "location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_no" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "recipient" TEXT,
    "sender" TEXT,
    "qr_codes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_transactions_pkey" PRIMARY KEY ("id")
);

-- Ensure columns exist on databases created via earlier db push
ALTER TABLE "item_transactions" ADD COLUMN IF NOT EXISTS "transaction_code" TEXT;
ALTER TABLE "item_transactions" ADD COLUMN IF NOT EXISTS "sender" TEXT;

-- Ensure foreign key to items exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'item_transactions_item_id_fkey'
    ) THEN
        ALTER TABLE "item_transactions"
            ADD CONSTRAINT "item_transactions_item_id_fkey"
            FOREIGN KEY ("item_id") REFERENCES "items"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill persistent BMS-YYYYMMDD-XXXX / BKL-YYYYMMDD-XXXX codes for existing rows
WITH numbered AS (
    SELECT
        "id",
        CASE WHEN "type" = 'in' THEN 'BMS' ELSE 'BKL' END AS prefix,
        TO_CHAR("created_at", 'YYYYMMDD') AS ymd,
        ROW_NUMBER() OVER (
            PARTITION BY "type", TO_CHAR("created_at", 'YYYYMMDD')
            ORDER BY "created_at" ASC, "id" ASC
        ) AS seq
    FROM "item_transactions"
    WHERE "transaction_code" IS NULL
)
UPDATE "item_transactions" t
SET "transaction_code" = n.prefix || '-' || n.ymd || '-' || LPAD(n.seq::text, 4, '0')
FROM numbered n
WHERE t."id" = n."id";

ALTER TABLE "item_transactions" ALTER COLUMN "transaction_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "item_transactions_transaction_code_key"
    ON "item_transactions"("transaction_code");
