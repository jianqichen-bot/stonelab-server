-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- AlterTable
ALTER TABLE "admin_users" ALTER COLUMN "roles" SET DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_no" VARCHAR(32) NOT NULL,
    "customer_id" VARCHAR(64),
    "recipient_name" VARCHAR(50) NOT NULL,
    "recipient_phone" VARCHAR(20) NOT NULL,
    "recipient_province" VARCHAR(50) NOT NULL,
    "recipient_city" VARCHAR(50) NOT NULL,
    "recipient_district" VARCHAR(50) NOT NULL,
    "recipient_address" VARCHAR(255) NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "shipping_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "total_amount_cents" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "buyer_remark" VARCHAR(500) NOT NULL DEFAULT '',
    "admin_remark" VARCHAR(500) NOT NULL DEFAULT '',
    "tracking_company" VARCHAR(100) NOT NULL DEFAULT '',
    "tracking_no" VARCHAR(100) NOT NULL DEFAULT '',
    "paid_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" BIGSERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" INTEGER,
    "variant_id" INTEGER,
    "product_name" VARCHAR(120) NOT NULL,
    "variant_name" VARCHAR(100) NOT NULL,
    "image_key" VARCHAR(500),
    "diameter_mm" DECIMAL(6,2),
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_price_cents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_recipient_phone_idx" ON "orders"("recipient_phone");

-- CreateIndex
CREATE INDEX "order_items_order_id_position_idx" ON "order_items"("order_id", "position");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bead_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "bead_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
