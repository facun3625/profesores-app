-- Cursos / divisiones
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_institutionId_name_key" ON "Course"("institutionId", "name");
CREATE INDEX "Course_institutionId_idx" ON "Course"("institutionId");
ALTER TABLE "Course" ADD CONSTRAINT "Course_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Curso y fecha del examen
ALTER TABLE "Exam" ADD COLUMN "courseId" TEXT;
ALTER TABLE "Exam" ADD COLUMN "examDate" TIMESTAMP(3);
CREATE INDEX "Exam_courseId_idx" ON "Exam"("courseId");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Origen de la entrega: online o hoja en papel corregida por foto
ALTER TABLE "OnlineSubmission" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'online';
