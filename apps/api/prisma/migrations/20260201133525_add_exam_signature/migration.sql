-- CreateTable
CREATE TABLE "ExamSignature" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSignature_institutionId_idx" ON "ExamSignature"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSignature_institutionId_signature_key" ON "ExamSignature"("institutionId", "signature");

-- AddForeignKey
ALTER TABLE "ExamSignature" ADD CONSTRAINT "ExamSignature_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
