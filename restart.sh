#!/bin/bash

echo "🔄 Reiniciando servidor RAM..."

# Matar proceso en puerto 3000
echo "📍 Liberando puerto 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Limpiar caché de Next.js
echo "🧹 Limpiando caché..."
rm -rf .next

# Iniciar servidor
echo "🚀 Iniciando servidor..."
npm run dev
