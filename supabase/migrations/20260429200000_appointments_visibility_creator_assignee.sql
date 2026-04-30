-- Visibilidad tareas: sin asignación solo creador (y alta dirección); con asignación creador + asignados.
-- metadata.kanban_assignees = [{ "id": "<uuid>", "name": "..." }, ...]
-- DELETE: solo propietario/alto staff o creador de la fila (no líder de equipo sin ser creador).

CREATE OR REPLACE FUNCTION public.user_can_select_appointment_row(p_id uuid)
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
      AND public.user_can_access_business(a.business_id)
      AND (
        public.user_is_owner_or_high_staff(a.business_id)
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

CREATE OR REPLACE FUNCTION public.appointment_user_can_update_delete(p_appointment_id uuid)
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
      AND public.user_can_access_business(a.business_id)
      AND (
        public.user_is_owner_or_high_staff(a.business_id)
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
        OR public.appointment_user_is_team_lead(a.id)
      )
  );
$$;

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_business(business_id)
    AND (
      public.user_is_owner_or_high_staff(business_id)
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
      OR public.appointment_user_is_team_lead(id)
    )
  )
  WITH CHECK (
    public.user_can_access_business(business_id)
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.business_id = appointments.business_id
      )
    )
    AND (
      public.user_is_owner_or_high_staff(business_id)
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
      OR public.appointment_user_is_team_lead(id)
    )
  );

DROP POLICY IF EXISTS appointments_delete ON public.appointments;
CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (
    public.user_can_access_business(business_id)
    AND (
      public.user_is_owner_or_high_staff(business_id)
      OR created_by IS NOT DISTINCT FROM auth.uid()
    )
  );
