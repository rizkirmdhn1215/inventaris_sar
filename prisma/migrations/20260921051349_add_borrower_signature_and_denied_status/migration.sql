-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "borrower_signature_data_url" TEXT,
ADD COLUMN     "borrower_signature_scale" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "locations" ALTER COLUMN "id" DROP DEFAULT;
