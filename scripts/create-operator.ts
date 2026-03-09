import bcrypt from 'bcryptjs'

// Script para generar hash de PIN
// Uso: npx tsx scripts/create-operator.ts

async function generatePinHash(pin: string) {
  const hash = await bcrypt.hash(pin, 10)
  console.log('\n=== CREAR OPERARIO ===\n')
  console.log('PIN:', pin)
  console.log('Hash:', hash)
  console.log('\nEjecuta este SQL en Supabase:\n')
  console.log(`INSERT INTO users (full_name, role, pin_hash, is_active)
VALUES (
  'Operario Test',
  'operator',
  '${hash}',
  true
);`)
  console.log('\n======================\n')
}

// Cambia el PIN aquí
const PIN = '1234'
generatePinHash(PIN)
