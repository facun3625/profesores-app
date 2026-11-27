-- Exámenes online por link
CREATE TABLE "OnlineExam" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "showScore" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineExam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineSubmission" (
    "id" TEXT NOT NULL,
    "onlineExamId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "grading" JSONB NOT NULL,
    "autoScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "pendingManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnlineExam_examId_key" ON "OnlineExam"("examId");
CREATE UNIQUE INDEX "OnlineExam_token_key" ON "OnlineExam"("token");
CREATE INDEX "OnlineSubmission_onlineExamId_idx" ON "OnlineSubmission"("onlineExamId");

ALTER TABLE "OnlineExam" ADD CONSTRAINT "OnlineExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineSubmission" ADD CONSTRAINT "OnlineSubmission_onlineExamId_fkey" FOREIGN KEY ("onlineExamId") REFERENCES "OnlineExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
