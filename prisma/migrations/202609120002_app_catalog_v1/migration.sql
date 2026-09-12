CREATE TYPE "BeadShape" AS ENUM ('ROUND', 'CUBE', 'CHARM', 'CHIP');

ALTER TABLE "bead_products"
RENAME COLUMN "cover_url" TO "image_key";

ALTER TABLE "bead_products"
ADD COLUMN "shape" "BeadShape" NOT NULL DEFAULT 'ROUND';
