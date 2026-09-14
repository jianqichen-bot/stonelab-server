-- CreateEnum
CREATE TYPE "CartItemSource" AS ENUM ('DIY', 'INSPIRATION');

-- CreateTable
CREATE TABLE "app_carts" (
    "id" TEXT NOT NULL,
    "client_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "source" "CartItemSource" NOT NULL DEFAULT 'DIY',
    "title" VARCHAR(120) NOT NULL,
    "preview_image_key" VARCHAR(500),
    "wrist_circumference_mm" DECIMAL(7,2),
    "recommended_wrist_min" DECIMAL(6,2),
    "recommended_wrist_max" DECIMAL(6,2),
    "package_code" VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    "certificate_code" VARCHAR(32) NOT NULL DEFAULT 'NONE',
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item_materials" (
    "id" BIGSERIAL NOT NULL,
    "cart_item_id" TEXT NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "cart_item_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_carts_client_id_key" ON "app_carts"("client_id");
CREATE INDEX "cart_items_cart_id_created_at_idx" ON "cart_items"("cart_id", "created_at");
CREATE INDEX "cart_item_materials_cart_item_id_position_idx" ON "cart_item_materials"("cart_item_id", "position");
CREATE INDEX "cart_item_materials_variant_id_idx" ON "cart_item_materials"("variant_id");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "app_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_item_materials" ADD CONSTRAINT "cart_item_materials_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_item_materials" ADD CONSTRAINT "cart_item_materials_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "bead_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
