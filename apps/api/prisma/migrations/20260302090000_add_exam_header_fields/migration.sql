-- AlterTable: campos personalizados del encabezado del examen
-- IF NOT EXISTS por si la columna ya se creó con `prisma db push`.
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "headerFields" JSONB;
