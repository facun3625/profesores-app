/*
  Warnings:

  - The values [free,premium] on the enum `InstitutionPlan` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InstitutionPlan_new" AS ENUM ('FREE', 'FULL', 'PREMIUM');
ALTER TABLE "public"."Institution" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Institution" ALTER COLUMN "plan" TYPE "InstitutionPlan_new" USING ("plan"::text::"InstitutionPlan_new");
ALTER TYPE "InstitutionPlan" RENAME TO "InstitutionPlan_old";
ALTER TYPE "InstitutionPlan_new" RENAME TO "InstitutionPlan";
DROP TYPE "public"."InstitutionPlan_old";
ALTER TABLE "Institution" ALTER COLUMN "plan" SET DEFAULT 'FREE';
COMMIT;
