#!/bin/bash

# Matar procesos previos en puerto 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Limpiar lock de Next.js
rm -rf .next/dev/lock 2>/dev/null

# Iniciar servidor
npm run dev
