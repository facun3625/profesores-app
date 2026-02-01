/*
  Warnings:

  - A unique constraint covering the columns `[examId]` on the table `ExamSignature` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `examId` to the `ExamSignature` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ExamSignature" ADD COLUMN     "examId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ExamSignature_examId_key" ON "ExamSignature"("examId");

-- AddForeignKey
ALTER TABLE "ExamSignature" ADD CONSTRAINT "ExamSignature_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
