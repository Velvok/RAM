#!/bin/bash
#
# Comprobación genérica de aislamiento en Supabase, válida para cualquier
# proyecto de Velvok (mono o multi-tenant). No enumera tablas a mano: pregunta
# al catálogo, así que una tabla nueva mal configurada aparece sola.
#
# Uso:  ./scripts/verificar-aislamiento.sh
#       RLS_SOLO_SERVIDOR="tabla_a tabla_b" ./scripts/verificar-aislamiento.sh
#         (tablas con RLS y sin políticas a propósito: solo las lee el servidor)
# Devuelve 1 si encuentra algo que arreglar, para poder encadenarlo en CI local.
#
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL="$RAIZ/scripts/supabase-sql.sh"
[ -x "$SQL" ] || { echo "Falta scripts/supabase-sql.sh" >&2; exit 2; }
PROBLEMAS=0; AVISOS=0
titulo() { printf '\n\033[1m%s\033[0m\n' "$1"; }
mal()    { printf '  \033[31m✗ %s\033[0m\n' "$1"; PROBLEMAS=$((PROBLEMAS+1)); }
ojo()    { printf '  \033[33m! %s\033[0m\n' "$1"; AVISOS=$((AVISOS+1)); }
bien()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
filas()  { "$SQL" -c "$1" | grep -vE '^(→|-|\(|.*fila\(s\)$)' | sed -n '2,$p' | sed 's/[[:space:]]*$//' | grep -v '^$'; }

titulo "1. Tablas de public sin RLS (legibles con la clave pública)"
R=$(filas "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity order by 1")
[ -z "$R" ] && bien "ninguna" || while read -r t; do mal "$t"; done <<< "$R"

titulo "2. Tablas con RLS y sin políticas (nadie puede leerlas desde la app)"
R=$(filas "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname) order by 1")
if [ -z "$R" ]; then bien "ninguna"; else
  while read -r t; do
    if printf ' %s ' "${RLS_SOLO_SERVIDOR:-}" | grep -q " $t "; then ojo "$t — solo servidor (declarada en RLS_SOLO_SERVIDOR)"; else mal "$t"; fi
  done <<< "$R"
fi

titulo "3. Políticas abiertas a anon o public con condición trivial"
R=$(filas "select tablename||' · '||policyname||' · '||array_to_string(roles,',') from pg_policies where schemaname='public' and (roles && array['anon','public']::name[]) and (coalesce(qual,'') in ('true','(true)') or coalesce(with_check,'') in ('true','(true)')) order by 1")
[ -z "$R" ] && bien "ninguna" || while read -r t; do mal "$t"; done <<< "$R"

titulo "4. Políticas que llaman a una función por fila (coste y riesgo)"
R=$(filas "select tablename||' · '||policyname from pg_policies where schemaname='public' and coalesce(qual,'') ~ '[a-z_]+\\.[a-z_]+\\([a-z_]*(tenant_id|company_id|organization_id|user_id)' and coalesce(qual,'') !~ '\\(select' order by 1")
[ -z "$R" ] && bien "ninguna" || while read -r t; do ojo "$t — mover la función a una subconsulta (select …)"; done <<< "$R"

titulo "5. Funciones SECURITY DEFINER sin search_path fijo"
R=$(filas "select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%') order by 1")
[ -z "$R" ] && bien "ninguna" || while read -r t; do mal "$t"; done <<< "$R"

titulo "6. Funciones de public ejecutables por anon"
R=$(filas "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute') and p.proname not like 'pg_%' order by 1")
[ -z "$R" ] && bien "ninguna" || while read -r t; do ojo "$t — revoke execute … from anon si no es pública a propósito"; done <<< "$R"

titulo "7. Lectura anónima real (REST con la clave pública, todas las tablas)"
TABLAS=$(filas "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v') order by 1" | tr '\n' ' ')
node -e '
const { readFileSync } = require("node:fs");
const env = Object.fromEntries(readFileSync(process.argv[1] + "/.env.local","utf8").split("\n")
  .filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => [l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim().replace(/^"|"$/g,"")]));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !anon) { console.log("  (sin NEXT_PUBLIC_SUPABASE_URL/ANON_KEY en .env.local: se omite)"); process.exit(0); }
const publicas = (process.env.TABLAS_PUBLICAS || "").split(/\s+/).filter(Boolean);
(async () => {
  let fugas = 0;
  for (const t of process.argv[2].trim().split(/\s+/)) {
    const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    const b = await r.json().catch(() => null);
    if (Array.isArray(b) && b.length > 0) {
      if (publicas.includes(t)) console.log(`  \x1b[33m! ${t} — pública a propósito (TABLAS_PUBLICAS)\x1b[0m`);
      else { console.log(`  \x1b[31m✗ ${t} — devuelve filas a un desconocido\x1b[0m`); fugas++; }
    }
  }
  if (!fugas) console.log("  \x1b[32m✓ ninguna devuelve datos\x1b[0m");
  process.exit(fugas ? 1 : 0);
})();' "$RAIZ" "$TABLAS" || PROBLEMAS=$((PROBLEMAS+1))

printf '\n'
[ "$PROBLEMAS" -eq 0 ] && printf '\033[32mAislamiento correcto\033[0m (%s aviso(s))\n' "$AVISOS" || printf '\033[31m%s problema(s) de aislamiento\033[0m, %s aviso(s)\n' "$PROBLEMAS" "$AVISOS"
exit $(( PROBLEMAS > 0 ? 1 : 0 ))
