#!/bin/bash

# Script para configurar el entorno de PRODUCCIÓN en profly.com.ar 🚀
# Uso: chmod +x setup_prod_env.sh && ./setup_prod_env.sh

ENV_FILE=".env"

echo "📝 Generando archivo $ENV_FILE para producción..."

cat <<EOF > $ENV_FILE
# 1. Base de Datos
DB_USER=postgres
DB_PASSWORD=desarrollo_profesores_app
DB_NAME=profly_db
DATABASE_URL=postgresql://postgres:desarrollo_profesores_app@db:5432/profly_db?schema=public

# 2. Configuración de API (CORS y Seguridad)
PORT=3000
NODE_ENV=production
JWT_SECRET=profly_master_secret_$(openssl rand -hex 8)
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://profly.com.ar

# 3. Dominio y Google
NEXT_PUBLIC_API_URL=https://profly.com.ar/api
NEXT_PUBLIC_API_BASE_URL=https://profly.com.ar/api
GOOGLE_CLIENT_ID=602128228660-c5f0epn6c1j20mavq44h9m364r9s6n1v.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=602128228660-c5f0epn6c1j20mavq44h9m364r9s6n1v.apps.googleusercontent.com

# 4. Email (Resend)
RESEND_API_KEY=re_JGFCAmiU_NWx24dgc3gKMGf1xjMFi7bv5
FRONTEND_URL=https://profly.com.ar
EOF

echo "✅ Archivo $ENV_FILE generado con éxito."
echo "🚀 Ya podés correr: docker compose build --no-cache && docker compose up -d"
