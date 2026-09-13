ALTER TABLE "admin_roles" ADD COLUMN "code" VARCHAR(50);

UPDATE "admin_roles"
SET "code" = CASE "id"
  WHEN 1 THEN 'super_admin'
  WHEN 2 THEN 'product_operator'
  ELSE 'role_' || "id"::text
END;

ALTER TABLE "admin_roles" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "admin_roles_code_key" ON "admin_roles"("code");

