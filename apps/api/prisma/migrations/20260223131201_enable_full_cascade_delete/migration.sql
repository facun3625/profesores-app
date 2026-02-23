-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_createdById_fkey";

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
