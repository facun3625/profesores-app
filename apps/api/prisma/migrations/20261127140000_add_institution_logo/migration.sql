-- Logo de la institución (se imprime en el encabezado de los exámenes)
ALTER TABLE "Institution" ADD COLUMN "logo" BYTEA;
ALTER TABLE "Institution" ADD COLUMN "logoMimeType" TEXT;
