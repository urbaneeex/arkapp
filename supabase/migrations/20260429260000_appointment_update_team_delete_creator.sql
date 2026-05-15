-- UPDATE: cualquier miembro del equipo (team_id / appointment_teams) puede actualizar la fila (p. ej. mover estado).
-- DELETE: solo el creador (created_by); sin bypass owner/alto en esta tabla.
-- Helper reutiliza la misma condición de equipo que SELECT.

CREATE OR REPLACE FUNCTION private.appointment_user_is_team_member(p_appointment_id uuid)
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
      AND EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.staff_id = auth.uid()
          AND (
            (a.team_id IS NOT NULL AND tm.team_id = a.team_id)
            OR EXISTS (
              SELECT 1
              FROM public.appointment_teams at
              WHERE at.appointment_id = a.id
                AND at.team_id = tm.team_id
            )
          )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.appointment_user_is_team_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.appointment_user_is_team_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.appointment_user_is_team_member(uuid) TO authenticated;

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
        OR private.appointment_user_is_team_member(p_id)
      )
  );
$$;

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
      OR private.appointment_user_is_team_member(id)
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
      OR private.appointment_user_is_team_member(id)
    )
  );

DROP POLICY IF EXISTS appointments_delete ON public.appointments;
CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (
    private.user_can_access_business(business_id)
    AND created_by IS NOT DISTINCT FROM auth.uid()
  );
