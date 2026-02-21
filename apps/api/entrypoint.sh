#!/bin/sh

# Esperar opcionalmente a que la DB esté lista (Prisma lo maneja bastante bien, pero podrías usar wait-for-it)
echo "Ejecutando migraciones de Prisma..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

echo "Iniciando servidor NestJS..."
exec node apps/api/dist/main
