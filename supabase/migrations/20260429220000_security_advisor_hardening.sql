-- Security Advisor: search_path en funciones, EXECUTE (anon/PUBLIC), bucket storage, RPC internos.
-- Auth "Leaked password protection": solo Dashboard → Authentication → Password → HaveIBeenPwned (no SQL).

-- ---------------------------------------------------------------------------
-- 1) search_path fijo (lint 0011) — por nombre; tolera ausencia / overloads
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_staff_shifts_updated_at',
        'appointments_sync_stage_and_status',
        'handle_new_user'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.proc);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) SECURITY DEFINER accesible vía PostgREST: quitar anon/PUBLIC; authenticated
--    solo donde hace falta para políticas RLS o helpers legítimos.
--    Trigger-only / cron: sin EXECUTE para authenticated (anon ya fuera).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc, p.proname
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'appointment_user_can_update_delete',
        'appointment_user_is_team_lead',
        'appointments_write_audit',
        'archive_completed_appointments',
        'before_delete_team_reassign_appointments',
        'check_business_access',
        'get_my_staff_business_id',
        'handle_new_user',
        'set_appointment_created_by',
        'user_can_access_business',
        'user_is_owner_or_high_staff',
        'user_can_select_appointment_row'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.proc);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.proc);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.proc);
  END LOOP;
END $$;

-- Helpers usados en políticas RLS appointments / equipos (cliente autenticado debe poder ejecutarlos al evaluar políticas).
GRANT EXECUTE ON FUNCTION public.user_can_access_business(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_owner_or_high_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_select_appointment_row(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.appointment_user_can_update_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.appointment_user_is_team_lead(uuid) TO authenticated;

-- Opcionales históricos (si existen en la BD): mantener mismo comportamiento que antes para sesión autenticada.
DO $$
DECLARE
  r regprocedure;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('check_business_access', 'get_my_staff_business_id')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r);
  END LOOP;
END $$;

-- Solo triggers internos: nadie llama por RPC.
-- archive_completed_appointments: cron / service_role (app usa admin.rpc).

DO $$
DECLARE
  r regprocedure;
BEGIN
  SELECT p.oid::regprocedure
  INTO r
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'archive_completed_appointments'
  ORDER BY p.oid
  LIMIT 1;

  IF r IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Storage: bucket público — quitar SELECT amplio (lint 0025). Las URLs
--    públicas por path siguen funcionando sin política de listado.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public read business logos" ON storage.objects;

-- Auth (lint leaked password): Dashboard → Authentication → Providers / Password →
-- activar protección contra contraseñas filtradas (HaveIBeenPwned). No es configurable por SQL.
