-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeInstitutionId" TEXT;

-- CreateIndex
CREATE INDEX "User_activeInstitutionId_idx" ON "User"("activeInstitutionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeInstitutionId_fkey" FOREIGN KEY ("activeInstitutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
