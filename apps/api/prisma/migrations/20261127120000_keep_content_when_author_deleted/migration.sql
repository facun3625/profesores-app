-- Si se elimina un usuario (ej: un profesor), sus preguntas y exámenes quedan
-- en la institución sin autor, en lugar de borrarse en cascada.
ALTER TABLE "Question" DROP CONSTRAINT "Question_createdById_fkey";
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Exam" DROP CONSTRAINT "Exam_createdById_fkey";
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Normalizar emails a minúsculas (el login siempre compara en minúsculas).
-- Se omiten los casos que chocarían con otro usuario ya existente.
UPDATE "User" u
SET "email" = lower(trim(u."email"))
WHERE u."email" <> lower(trim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "User" o
    WHERE o."id" <> u."id" AND o."email" = lower(trim(u."email"))
  );
