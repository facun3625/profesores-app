-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('active', 'archived', 'deleted');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'active';
