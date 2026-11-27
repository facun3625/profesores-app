-- Imagen opcional por pregunta (gráficos, mapas, figuras)
ALTER TABLE "Question" ADD COLUMN "image" BYTEA;
ALTER TABLE "Question" ADD COLUMN "imageMimeType" TEXT;
