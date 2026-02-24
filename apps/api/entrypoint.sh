#!/bin/sh

echo "--- Debug: Listando archivos en apps/api ---"
ls -R apps/api/dist || echo "No se encontró carpeta dist en apps/api"

echo "Ejecutando migraciones de Prisma..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

echo "Iniciando servidor NestJS..."
# Intentar las dos rutas más comunes en monorepos
if [ -f "apps/api/dist/main.js" ]; then
    exec node apps/api/dist/main.js
else
    echo "Error: No se encontró apps/api/dist/main.js, intentando src/main.js..."
    exec node apps/api/dist/src/main.js
fi
