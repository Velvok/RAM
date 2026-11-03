#!/bin/bash
#
# Ejecuta SQL contra la base de datos de este proyecto en Supabase.
#
# Usa la Management API, que es la misma vía por la que el editor SQL del
# dashboard ejecuta las consultas. Hace falta porque desde esta máquina no hay
# conexión directa de Postgres: el host `db.<ref>.supabase.co` es solo IPv6 y
# los endpoints del pooler rechazan el handshake de psql.
#
# Uso:
#   ./scripts/supabase-sql.sh -c "select 1;"                       consulta suelta
#   ./scripts/supabase-sql.sh -f supabase/migrations/2026xx.sql    aplicar un fichero
#   echo "select 1;" | ./scripts/supabase-sql.sh                   por stdin
#   SUPABASE_SQL_JSON=1 ./scripts/supabase-sql.sh -c "..."         filas en JSON (para otros scripts)
#
# El token sale del llavero de macOS (o de SUPABASE_ACCESS_TOKEN si está puesta)
# y NUNCA se imprime ni se escribe en disco. El ref del proyecto se deduce de
# NEXT_PUBLIC_SUPABASE_URL en .env.local, así que el script no lleva dentro
# ningún dato de ningún entorno.
#
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Qué SQL hay que ejecutar ────────────────────────────────────────────────
case "${1:-}" in
  -c) QUERY="${2:?falta el SQL después de -c}" ;;
  -f) QUERY="$(cat "${2:?falta el fichero después de -f}")" ;;
  "") QUERY="$(cat)" ;;
  *)  echo "uso: $0 [-c \"SQL\" | -f fichero.sql]  (o SQL por stdin)" >&2; exit 2 ;;
esac
# grep y no ${QUERY//[[:space:]]/}: la sustitución de bash es cuadrática y con
# una migración de ~20 KB se quedaba minutos al 100 % de CPU.
printf '%s' "$QUERY" | grep -q '[^[:space:]]' || { echo "No hay nada que ejecutar." >&2; exit 2; }

# ── Contra qué proyecto ─────────────────────────────────────────────────────
REF="$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$RAIZ/.env.local" 2>/dev/null \
       | sed -E 's|.*https://([^.]+)\.supabase\.co.*|\1|')"
[ -n "$REF" ] || { echo "No encuentro NEXT_PUBLIC_SUPABASE_URL en .env.local" >&2; exit 1; }

# ── Con qué credencial ──────────────────────────────────────────────────────
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  BRUTO="$(security find-generic-password -s claude-supabase -a supabase -w 2>/dev/null || true)"
  case "$BRUTO" in
    go-keyring-base64:*) TOKEN="$(printf '%s' "${BRUTO#go-keyring-base64:}" | base64 -d)" ;;
    *)                   TOKEN="$BRUTO" ;;
  esac
fi
[ -n "$TOKEN" ] || {
  echo "No hay token. Guardá uno con:" >&2
  echo "  security add-generic-password -a supabase -s claude-supabase -U -w" >&2
  exit 1
}

# ── Ejecutar y presentar el resultado ───────────────────────────────────────
CUERPO="$(QUERY="$QUERY" node -e 'process.stdout.write(JSON.stringify({query: process.env.QUERY}))')"

curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$CUERPO" \
| node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  let j;
  try { j = JSON.parse(s); } catch { console.log(s); process.exit(1); }
  if (!Array.isArray(j)) {                       // error de la API
    console.error(JSON.stringify(j, null, 1));
    process.exit(1);
  }
  if (process.env.SUPABASE_SQL_JSON) { console.log(JSON.stringify(j)); return; }
  if (!j.length) { console.log("(sin filas)"); return; }
  const cols = Object.keys(j[0]);
  const ancho = cols.map((c, i) =>
    Math.max(c.length, ...j.map((r) => String(r[c] ?? "").length)));
  const fila = (v) => v.map((x, i) => String(x ?? "").padEnd(ancho[i])).join("  ");
  console.log(fila(cols));
  console.log(ancho.map((n) => "-".repeat(n)).join("  "));
  for (const r of j) console.log(fila(cols.map((c) => r[c])));
  console.log(`(${j.length} fila${j.length === 1 ? "" : "s"})`);
});'
