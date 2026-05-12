-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_units" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qr_code" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "borrower_name" TEXT NOT NULL,
    "borrower_division" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "borrow_date" DATE NOT NULL,
    "expected_return_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "document_url" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_items" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "item_unit_id" UUID NOT NULL,
    "condition_at_borrow" TEXT NOT NULL DEFAULT 'good',

    CONSTRAINT "loan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_checks" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "checked_by" TEXT NOT NULL,
    "returned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_reports" (
    "id" UUID NOT NULL,
    "return_check_id" UUID NOT NULL,
    "item_unit_id" UUID NOT NULL,
    "condition_result" TEXT NOT NULL,
    "damage_description" TEXT,
    "photo_urls" TEXT[],
    "severity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condition_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_name_key" ON "item_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "item_units_qr_code_key" ON "item_units"("qr_code");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_units" ADD CONSTRAINT "item_units_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_item_unit_id_fkey" FOREIGN KEY ("item_unit_id") REFERENCES "item_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_checks" ADD CONSTRAINT "return_checks_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_return_check_id_fkey" FOREIGN KEY ("return_check_id") REFERENCES "return_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_item_unit_id_fkey" FOREIGN KEY ("item_unit_id") REFERENCES "item_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
