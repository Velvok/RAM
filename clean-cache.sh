#!/bin/bash

echo "🧹 Limpiando caché de Next.js y Turbopack..."

# Limpiar Next.js
rm -rf .next
echo "✓ .next eliminado"

# Limpiar Turbopack
rm -rf .turbo
echo "✓ .turbo eliminado"

# Limpiar caché de node_modules
rm -rf node_modules/.cache
echo "✓ node_modules/.cache eliminado"

# Limpiar TypeScript
rm -f tsconfig.tsbuildinfo
echo "✓ tsconfig.tsbuildinfo eliminado"

# Limpiar caché de npm
npm cache clean --force 2>/dev/null || true
echo "✓ Caché de npm limpiado"

echo ""
echo "✅ Limpieza completa!"
echo ""
echo "Ahora ejecuta: npm run dev"
