-- Diagnóstico RLS: propietario ve citas `personal` ajenas (ejecutar en Supabase SQL Editor).
-- Tras reparar con migración 20260513131000 o pegando el CREATE OR REPLACE de 20260513130000,
-- vuelve a ejecutar QUERY 1 y 4.

-- QUERY 1 — Cuerpo actual de la función (buscar owner_uid / bypass propietario)
SELECT prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'user_can_select_appointment_row'
  AND n.nspname = 'private';

-- QUERY 2 — Migraciones aplicadas (últimas)
SELECT *
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 25;

-- QUERY 3 — Simular RLS (ejecutar con sesión del usuario afectado; en SQL Editor usa "Run as user" si existe)
-- Sustituye el UUID por la cita a comprobar.
-- SELECT private.user_can_select_appointment_row('91a6b94c-874f-460b-bf51-f3cacd6f71f7'::uuid);

-- QUERY 4 — Políticas RLS en appointments (debe haber una SELECT con user_can_select_appointment_row)
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'appointments'
ORDER BY polcmd, polname;

-- Comprobación extra: cuántas políticas SELECT hay (Caso C si count > 1)
SELECT count(*) AS select_policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'appointments'
  AND polcmd = 'r';
