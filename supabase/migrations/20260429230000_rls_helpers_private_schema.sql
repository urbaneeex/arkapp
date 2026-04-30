-- Lint 0029: helpers SECURITY DEFINER fuera de `public` → PostgREST ya no expone /rpc/*;
-- las políticas RLS siguen usando private.* con GRANT EXECUTE a authenticated.

CREATE SCHEMA IF NOT EXISTS private;

COMMENT ON SCHEMA private IS 'Helpers SECURITY DEFINER para RLS; no incluir en API schemas de PostgREST.';

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers (orden: dependencias primero)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.user_can_access_business(b_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = b_id AND b.owner_uid = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.business_id = b_id AND s.id = auth.uid() AND s.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION private.user_is_owner_or_high_staff(b_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = b_id AND b.owner_uid = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.business_id = b_id
      AND s.id = auth.uid()
      AND s.deleted_at IS NULL
      AND (
        coalesce(s.access_level, 'basico') IN ('alto', 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.appointment_user_is_team_lead(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND (
        (
          a.team_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = a.team_id
              AND tm.staff_id = auth.uid()
              AND tm.is_lead = true
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.appointment_teams at
          INNER JOIN public.team_members tm
            ON tm.team_id = at.team_id
            AND tm.staff_id = auth.uid()
            AND tm.is_lead = true
          WHERE at.appointment_id = a.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.appointment_user_can_update_delete(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND private.user_can_access_business(a.business_id)
      AND (
        private.user_is_owner_or_high_staff(a.business_id)
        OR a.created_by IS NOT DISTINCT FROM auth.uid()
        OR a.staff_id IS NOT DISTINCT FROM auth.uid()
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)) = 'array'
              THEN COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)
              ELSE '[]'::jsonb
            END
          ) elem
          WHERE (elem->>'id') IS NOT DISTINCT FROM auth.uid()::text
        )
        OR private.appointment_user_is_team_lead(a.id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.user_can_select_appointment_row(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_id
      AND private.user_can_access_business(a.business_id)
      AND (
        private.user_is_owner_or_high_staff(a.business_id)
        OR a.created_by IS NOT DISTINCT FROM auth.uid()
        OR (
          (
            a.staff_id IS NOT NULL
            OR (
              jsonb_typeof(COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)) = 'array'
              AND jsonb_array_length(COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)) > 0
            )
          )
          AND (
            a.staff_id IS NOT DISTINCT FROM auth.uid()
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)) = 'array'
                  THEN COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)
                  ELSE '[]'::jsonb
                END
              ) elem
              WHERE (elem->>'id') IS NOT DISTINCT FROM auth.uid()::text
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.check_business_access(business_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.user_can_access_business(business_id_param);
$$;

CREATE OR REPLACE FUNCTION private.get_my_staff_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.business_id
  FROM public.staff s
  WHERE s.id = auth.uid()
    AND s.deleted_at IS NULL
  LIMIT 1;
$$;

-- Solo sesión autenticada evalúa políticas; sin anon/PUBLIC.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.proc);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.proc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.proc);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Políticas: public.* → private.*
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (private.user_can_access_business(business_id));

DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (private.user_is_owner_or_high_staff(business_id));

DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (private.user_is_owner_or_high_staff(business_id))
  WITH CHECK (private.user_is_owner_or_high_staff(business_id));

DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete ON public.teams
  FOR DELETE TO authenticated
  USING (private.user_is_owner_or_high_staff(business_id));

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND private.user_can_access_business(t.business_id)
    )
  );

DROP POLICY IF EXISTS team_members_insert ON public.team_members;
CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND private.user_is_owner_or_high_staff(t.business_id)
    )
  );

DROP POLICY IF EXISTS team_members_update ON public.team_members;
CREATE POLICY team_members_update ON public.team_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND private.user_is_owner_or_high_staff(t.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND private.user_is_owner_or_high_staff(t.business_id)
    )
  );

DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND private.user_is_owner_or_high_staff(t.business_id)
    )
  );

DROP POLICY IF EXISTS appointment_teams_select ON public.appointment_teams;
CREATE POLICY appointment_teams_select ON public.appointment_teams
  FOR SELECT TO authenticated
  USING (private.user_can_select_appointment_row(appointment_id));

DROP POLICY IF EXISTS appointment_teams_insert ON public.appointment_teams;
CREATE POLICY appointment_teams_insert ON public.appointment_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = appointment_teams.team_id
        AND EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = appointment_teams.appointment_id
            AND a.business_id = t.business_id
            AND private.appointment_user_can_update_delete(a.id)
        )
    )
  );

DROP POLICY IF EXISTS appointment_teams_delete ON public.appointment_teams;
CREATE POLICY appointment_teams_delete ON public.appointment_teams
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_teams.appointment_id
        AND private.appointment_user_can_update_delete(a.id)
    )
  );

DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
  FOR SELECT TO authenticated
  USING (private.user_can_select_appointment_row(id));

DROP POLICY IF EXISTS appointments_insert ON public.appointments;
CREATE POLICY appointments_insert ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.user_can_access_business(business_id)
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.business_id = appointments.business_id
      )
    )
    AND (
      created_by IS NULL
      OR created_by = auth.uid()
      OR private.user_is_owner_or_high_staff(business_id)
    )
  );

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    private.user_can_access_business(business_id)
    AND (
      private.user_is_owner_or_high_staff(business_id)
      OR created_by IS NOT DISTINCT FROM auth.uid()
      OR staff_id IS NOT DISTINCT FROM auth.uid()
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(COALESCE(metadata->'kanban_assignees', '[]'::jsonb)) = 'array'
            THEN COALESCE(metadata->'kanban_assignees', '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) elem
        WHERE (elem->>'id') IS NOT DISTINCT FROM auth.uid()::text
      )
      OR private.appointment_user_is_team_lead(id)
    )
  )
  WITH CHECK (
    private.user_can_access_business(business_id)
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.business_id = appointments.business_id
      )
    )
    AND (
      private.user_is_owner_or_high_staff(business_id)
      OR created_by IS NOT DISTINCT FROM auth.uid()
      OR staff_id IS NOT DISTINCT FROM auth.uid()
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(COALESCE(metadata->'kanban_assignees', '[]'::jsonb)) = 'array'
            THEN COALESCE(metadata->'kanban_assignees', '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) elem
        WHERE (elem->>'id') IS NOT DISTINCT FROM auth.uid()::text
      )
      OR private.appointment_user_is_team_lead(id)
    )
  );

DROP POLICY IF EXISTS appointments_delete ON public.appointments;
CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (
    private.user_can_access_business(business_id)
    AND (
      private.user_is_owner_or_high_staff(business_id)
      OR created_by IS NOT DISTINCT FROM auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Políticas legacy (remoto): mismos nombres; pasan a private.check_business_access
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Business members can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business members can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business members can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business members can delete appointments" ON public.appointments;

CREATE POLICY "Business members can view appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (private.check_business_access(business_id));

CREATE POLICY "Business members can insert appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (private.check_business_access(business_id));

CREATE POLICY "Business members can update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (private.check_business_access(business_id))
  WITH CHECK (private.check_business_access(business_id));

CREATE POLICY "Business members can delete appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (private.check_business_access(business_id));

DROP POLICY IF EXISTS "Business members can view clients" ON public.clients;
DROP POLICY IF EXISTS "Business members can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Business members can update clients" ON public.clients;
DROP POLICY IF EXISTS "Business members can delete clients" ON public.clients;

CREATE POLICY "Business members can view clients" ON public.clients
  FOR SELECT TO authenticated
  USING (private.check_business_access(business_id));

CREATE POLICY "Business members can insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (private.check_business_access(business_id));

CREATE POLICY "Business members can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (private.check_business_access(business_id))
  WITH CHECK (private.check_business_access(business_id));

CREATE POLICY "Business members can delete clients" ON public.clients
  FOR DELETE TO authenticated
  USING (private.check_business_access(business_id));

DROP POLICY IF EXISTS "Business members can view services" ON public.services;
DROP POLICY IF EXISTS "Business members can insert services" ON public.services;
DROP POLICY IF EXISTS "Business members can update services" ON public.services;
DROP POLICY IF EXISTS "Business members can delete services" ON public.services;

CREATE POLICY "Business members can view services" ON public.services
  FOR SELECT TO authenticated
  USING (private.check_business_access(business_id));

CREATE POLICY "Business members can insert services" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (private.check_business_access(business_id));

CREATE POLICY "Business members can update services" ON public.services
  FOR UPDATE TO authenticated
  USING (private.check_business_access(business_id))
  WITH CHECK (private.check_business_access(business_id));

CREATE POLICY "Business members can delete services" ON public.services
  FOR DELETE TO authenticated
  USING (private.check_business_access(business_id));

DROP POLICY IF EXISTS "Business members can view business hours" ON public.business_hours;

CREATE POLICY "Business members can view business hours" ON public.business_hours
  FOR SELECT TO authenticated
  USING (private.check_business_access(business_id));

DROP POLICY IF EXISTS "Staff can read their business" ON public.businesses;

CREATE POLICY "Staff can read their business" ON public.businesses
  FOR SELECT TO authenticated
  USING (id = private.get_my_staff_business_id());

-- ---------------------------------------------------------------------------
-- Eliminar duplicados en public (ya sin referencias en políticas)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.user_can_select_appointment_row(uuid);
DROP FUNCTION IF EXISTS public.appointment_user_can_update_delete(uuid);
DROP FUNCTION IF EXISTS public.appointment_user_is_team_lead(uuid);
DROP FUNCTION IF EXISTS public.user_can_access_business(uuid);
DROP FUNCTION IF EXISTS public.user_is_owner_or_high_staff(uuid);
DROP FUNCTION IF EXISTS public.check_business_access(uuid);
DROP FUNCTION IF EXISTS public.get_my_staff_business_id();
