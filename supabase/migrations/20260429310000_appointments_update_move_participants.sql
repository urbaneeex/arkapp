-- UPDATE appointments: creador, staff principal, kanban_assignees o miembro de equipo (team_id / appointment_teams).
-- Sin bypass propietario/alto: contenido sensible solo lo gestiona el flujo de «solo creador» en UI + appointment_teams (solo creador).
-- DELETE: sin cambios (sigue solo created_by vía migración anterior).

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    private.user_can_access_business(business_id)
    AND (
      created_by IS NOT DISTINCT FROM auth.uid()
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
      created_by IS NOT DISTINCT FROM auth.uid()
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
