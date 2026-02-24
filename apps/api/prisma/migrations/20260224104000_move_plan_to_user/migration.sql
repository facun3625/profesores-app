-- AlterTable: Add plan column to User
ALTER TABLE "User" ADD COLUMN "plan" "InstitutionPlan" NOT NULL DEFAULT 'FREE';

-- Data Migration: Copy plan from Institution to User based on memberships
-- If a user has multiple institutions, we try to keep the highest plan (PREMIUM > FULL > FREE)
UPDATE "User" u
SET "plan" = (
  SELECT 
    CASE 
      WHEN bool_or(i."plan" = 'PREMIUM') THEN 'PREMIUM'::"InstitutionPlan"
      WHEN bool_or(i."plan" = 'FULL') THEN 'FULL'::"InstitutionPlan"
      ELSE 'FREE'::"InstitutionPlan"
    END
  FROM "UserInstitution" ui
  JOIN "Institution" i ON ui."institutionId" = i.id
  WHERE ui."userId" = u.id
);

-- AlterTable: Remove plan from Institution
ALTER TABLE "Institution" DROP COLUMN "plan";
