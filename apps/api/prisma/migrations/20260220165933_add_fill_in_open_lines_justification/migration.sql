-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'FILL_IN';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "openLines" INTEGER,
ADD COLUMN     "requiresJustification" BOOLEAN NOT NULL DEFAULT false;
