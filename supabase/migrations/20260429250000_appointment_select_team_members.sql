-- Empleados: ver citas/tareas ligadas a un equipo del que son miembros (team_id o appointment_teams).

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
        OR EXISTS (
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
      )
  );
$$;
