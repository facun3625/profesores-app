#!/bin/sh

# Usar el binario local de prisma para evitar problemas de versión (v6 vs v7)
PRISMA_BIN="./node_modules/.bin/prisma"

echo "Ejecutando migraciones de Prisma..."
\$PRISMA_BIN migrate deploy --schema=apps/api/prisma/schema.prisma

echo "Iniciando servidor NestJS..."
# Asegurarse de que el archivo existe y usar la extensión .js por si acaso
exec node apps/api/dist/main.js
